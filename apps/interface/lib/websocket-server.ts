import { WebSocket } from 'ws';
import { createFalkorClient } from '@engram/storage/falkor';

const falkor = createFalkorClient();

interface LineageNode {
    id: string;
    label: string;
    type?: string;
    [key: string]: unknown;
}

interface LineageLink {
    source: string;
    target: string;
    type: string;
}

// Keep track of active intervals to clear them on disconnect
const activeIntervals = new WeakMap<WebSocket, NodeJS.Timeout>();

export function handleSessionConnection(ws: WebSocket, sessionId: string) {
    console.log(`[WS] Client connected to session ${sessionId}`);

    // Send initial "connected" message if needed
    // ws.send(JSON.stringify({ type: 'status', message: 'connected' }));

    // Setup polling for this session
    // In a real prod scenario, we'd listen to Kafka or Redis PubSub.
    // For now, to satisfy the requirement of "real-time updates" via WS,
    // we'll poll the DB and push changes.
    
    let lastNodeCount = 0;
    let lastEventCount = 0;

    const poll = async () => {
        if (ws.readyState !== WebSocket.OPEN) return;

        try {
            await falkor.connect();

            // 1. Fetch Lineage (Simplified query for counts/diffing)
            // We reuse the logic from the API route roughly
            const lineageQuery = `
                MATCH (s:Session {id: $sessionId})
                OPTIONAL MATCH p = (s)-[:TRIGGERS|NEXT*0..100]->(n)
                RETURN count(distinct n) as nodeCount
            `;
            
            // biome-ignore lint/suspicious/noExplicitAny: FalkorDB response
            const lineageRes: any = await falkor.query(lineageQuery, { sessionId });
            const currentNodeCount = Number(lineageRes?.[0]?.nodeCount || 0);
            console.log(`[WS Poll] Session ${sessionId}: Node count ${currentNodeCount} (Last: ${lastNodeCount})`);

            // 2. Fetch Replay/Timeline count
            const replayQuery = `
                MATCH (s:Session {id: $sessionId})-[:TRIGGERS]->(t:Thought)
                RETURN count(t) as eventCount
            `;
             // biome-ignore lint/suspicious/noExplicitAny: FalkorDB response
            const replayRes: any = await falkor.query(replayQuery, { sessionId });
            const currentEventCount = Number(replayRes?.[0]?.eventCount || 0);
            console.log(`[WS Poll] Session ${sessionId}: Event count ${currentEventCount} (Last: ${lastEventCount})`);

            // If changed, fetch full data and push
            // Note: This is inefficient for large graphs, but fine for prototype/small sessions.
            if (currentNodeCount !== lastNodeCount) {
                 // Fetch full lineage
                 // We can reuse the logic or just signal client to refetch?
                 // The useSessionStream hook expects data in the message.
                 // Let's fetch full data.
                 console.log(`[WS Poll] Fetching full lineage for ${sessionId}`);
                 const fullLineageData = await getFullLineage(sessionId);
                 console.log(`[WS Poll] Sending lineage data: ${fullLineageData.nodes.length} nodes, ${fullLineageData.links.length} links`);
                 ws.send(JSON.stringify({ type: 'lineage', data: fullLineageData }));
                 lastNodeCount = currentNodeCount;
            }

            if (currentEventCount !== lastEventCount) {
                console.log(`[WS Poll] Fetching full timeline for ${sessionId}`);
                const fullReplayData = await getFullTimeline(sessionId);
                console.log(`[WS Poll] Sending replay data: ${fullReplayData.timeline.length} items`);
                ws.send(JSON.stringify({ type: 'replay', data: fullReplayData }));
                lastEventCount = currentEventCount;
            }

        } catch (error) {
            console.error('[WS] Polling error:', error);
            // Optionally send error to client
        }
    };

    // Poll every 1 second
    const interval = setInterval(poll, 1000);
    activeIntervals.set(ws, interval);

    // Initial poll
    poll();

    ws.on('close', () => {
        console.log(`[WS] Client disconnected from session ${sessionId}`);
        const interval = activeIntervals.get(ws);
        if (interval) clearInterval(interval);
    });

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            if (data.type === 'subscribe') {
                // Handled by connection logic currently
            }
        } catch (e) {
            console.error('[WS] Invalid message', e);
        }
    });
}

// Helpers to fetch full data (duplicated from API routes for now to keep independent)
async function getFullLineage(sessionId: string) {
    const query = `
      MATCH (s:Session {id: $sessionId})
      OPTIONAL MATCH p = (s)-[:TRIGGERS|NEXT*0..100]->(n)
      RETURN s, nodes(p) as path_nodes, relationships(p) as path_edges
    `;
    // biome-ignore lint/suspicious/noExplicitAny: FalkorDB response
    const res: any = await falkor.query(query, { sessionId });
    
    // FalkorDB TS returns an array of objects where keys match RETURN alias
    // [{ s: Node, path_nodes: Node[], path_edges: Edge[] }, ...]

    const internalIdToUuid = new Map<number, string>();
    const nodes: any[] = [];
    const links: any[] = [];

    if (res && Array.isArray(res)) {
        for (const row of res) {
             const sessionNode = row.s;
             if (sessionNode) {
                 const uuid = sessionNode.properties?.id;
                 if (uuid) {
                     internalIdToUuid.set(sessionNode.id, uuid);
                     if (!nodes.find(n => n.id === uuid)) {
                         nodes.push({ ...sessionNode.properties, id: uuid, label: "Session", type: "session" });
                     }
                 }
             }
             
             const pathNodes = row.path_nodes;
             if (Array.isArray(pathNodes)) {
                 for (const n of pathNodes) {
                     if (n) {
                         const uuid = n.properties?.id;
                         if (uuid) {
                             internalIdToUuid.set(n.id, uuid);
                             if (!nodes.find(x => x.id === uuid)) {
                                 const label = n.labels?.[0] || "Unknown";
                                 nodes.push({ ...n.properties, id: uuid, label, type: label.toLowerCase() });
                             }
                         }
                     }
                 }
             }
        }
        
        // Now process edges
        for (const row of res) {
            const pathEdges = row.path_edges;
            if (Array.isArray(pathEdges)) {
                for (const e of pathEdges) {
                    if (e) {
                        const sourceUuid = internalIdToUuid.get(e.sourceId || e.srcNodeId);
                        const targetUuid = internalIdToUuid.get(e.destinationId || e.destNodeId);
                        // Fallback for different library versions property names if needed
                        // But test script showed sourceId/destinationId
                        
                        if (sourceUuid && targetUuid) {
                            links.push({
                                source: sourceUuid,
                                target: targetUuid,
                                type: e.relationshipType || e.relation,
                                properties: e.properties
                            });
                        }
                    }
                }
            }
        }
    }

    return {
        nodes,
        links
    };
}

async function getFullTimeline(sessionId: string) {
    const cypher = `
        MATCH (s:Session {id: $sessionId})-[:TRIGGERS]->(t:Thought)
        RETURN t
        ORDER BY t.vt_start ASC
    `;
    // biome-ignore lint/suspicious/noExplicitAny: FalkorDB response
    const result: any = await falkor.query(cypher, { sessionId });
    const timeline = [];
    if (Array.isArray(result)) {
        for (const row of result) {
            const node = row.t;
            if (node && node.properties) {
                timeline.push({ ...node.properties, id: node.properties.id, type: 'thought' });
            }
        }
    }
    return { timeline };
}
