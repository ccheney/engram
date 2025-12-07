"use client";

import React, { useEffect } from 'react';
import { ReactFlow, useNodesState, useEdgesState, Background, Controls, MiniMap, type Node, type Edge, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { LineageResponse } from '@lib/types';
import dagre from 'dagre';

interface LineageGraphProps {
    data: LineageResponse | null;
}

const nodeWidth = 172;
const nodeHeight = 36;

const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    dagreGraph.setGraph({ rankdir: 'TB' });

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const layoutedNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        return {
            ...node,
            targetPosition: Position.Top,
            sourcePosition: Position.Bottom,
            position: {
                x: nodeWithPosition.x - nodeWidth / 2,
                y: nodeWithPosition.y - nodeHeight / 2,
            },
        };
    });

    return { nodes: layoutedNodes, edges };
};

export function LineageGraph({ data }: LineageGraphProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    useEffect(() => {
        if (!data) return;

        const initialNodes: Node[] = data.nodes.map(n => ({
            id: n.id,
            position: { x: 0, y: 0 }, // Layout will fix
            data: { label: n.label || n.id, ...n },
            type: 'input' // default node type
        }));

        const initialEdges: Edge[] = data.links.map((l, i) => ({
            id: `e${i}`,
            source: l.source,
            target: l.target,
            label: l.type,
            animated: true
        }));

        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
            initialNodes,
            initialEdges,
        );

        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
    }, [data, setNodes, setEdges]);

    if (!data) return <div>Loading Graph...</div>;

    return (
        <div style={{ width: '100%', height: '600px', border: '1px solid #eee' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                fitView
            >
                <Background />
                <Controls />
                <MiniMap />
            </ReactFlow>
        </div>
    );
}
