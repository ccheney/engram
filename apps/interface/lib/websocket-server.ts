import { createRedisSubscriber, type SessionUpdate } from "@engram/storage/redis";
import { WebSocket } from "ws";
import { getSessionLineage, getSessionTimeline, getSessionsForWebSocket } from "./graph-queries";

const redisSubscriber = createRedisSubscriber();

// Global channel for session list updates
const SESSIONS_CHANNEL = "sessions:updates";

export async function handleSessionConnection(ws: WebSocket, sessionId: string) {
	console.log(`[WS] Client connected to session ${sessionId}`);

	// Subscribe to Redis channel for real-time updates
	const unsubscribe = await redisSubscriber.subscribe(sessionId, (update: SessionUpdate) => {
		if (ws.readyState !== WebSocket.OPEN) return;

		// Forward the update to the WebSocket client
		ws.send(
			JSON.stringify({
				type: "update",
				data: update,
			}),
		);
	});

	// Send initial data
	try {
		const lineageData = await getSessionLineage(sessionId);
		if (lineageData.nodes.length > 0) {
			ws.send(JSON.stringify({ type: "lineage", data: lineageData }));
		}

		const timelineData = await getSessionTimeline(sessionId);
		if (timelineData.timeline.length > 0) {
			ws.send(JSON.stringify({ type: "replay", data: timelineData }));
		}
	} catch (error) {
		console.error("[WS] Initial fetch error:", error);
	}

	ws.on("close", async () => {
		console.log(`[WS] Client disconnected from session ${sessionId}`);
		await unsubscribe();
	});

	ws.on("message", async (message) => {
		try {
			const data = JSON.parse(message.toString());

			if (data.type === "refresh") {
				const lineageData = await getSessionLineage(sessionId);
				ws.send(JSON.stringify({ type: "lineage", data: lineageData }));

				const timelineData = await getSessionTimeline(sessionId);
				ws.send(JSON.stringify({ type: "replay", data: timelineData }));
			}
		} catch (e) {
			console.error("[WS] Invalid message", e);
		}
	});
}

export async function handleSessionsConnection(ws: WebSocket) {
	console.log("[WS] Client connected to sessions list");

	// Subscribe to global sessions channel for real-time updates
	const unsubscribe = await redisSubscriber.subscribe(SESSIONS_CHANNEL, (update: SessionUpdate) => {
		if (ws.readyState !== WebSocket.OPEN) return;

		ws.send(
			JSON.stringify({
				type: update.type,
				data: update.data,
			}),
		);
	});

	// Send initial session list
	try {
		const sessionsData = await getSessionsForWebSocket();
		ws.send(JSON.stringify({ type: "sessions", data: sessionsData }));
	} catch (error) {
		console.error("[WS] Initial sessions fetch error:", error);
		ws.send(JSON.stringify({ type: "error", message: "Failed to fetch sessions" }));
	}

	ws.on("close", async () => {
		console.log("[WS] Client disconnected from sessions list");
		await unsubscribe();
	});

	ws.on("message", async (message) => {
		try {
			const data = JSON.parse(message.toString());

			if (data.type === "refresh" || data.type === "subscribe") {
				const sessionsData = await getSessionsForWebSocket();
				ws.send(JSON.stringify({ type: "sessions", data: sessionsData }));
			}
		} catch (e) {
			console.error("[WS] Invalid message", e);
		}
	});
}
