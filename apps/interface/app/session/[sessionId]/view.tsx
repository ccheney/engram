"use client";

import React, { useEffect, useState } from 'react';
import { LineageGraph } from "../../components/LineageGraph";
import { SessionReplay } from "../../components/SessionReplay";
import type { LineageResponse, ReplayResponse } from "@lib/types";

export function SessionView({ sessionId }: { sessionId: string }) {
    const [lineage, setLineage] = useState<LineageResponse | null>(null);
    const [replay, setReplay] = useState<ReplayResponse | null>(null);

    useEffect(() => {
        fetch(`/api/lineage/${sessionId}`).then(res => res.json()).then(data => setLineage(data.data));
        fetch(`/api/replay/${sessionId}`).then(res => res.json()).then(data => setReplay(data.data));
    }, [sessionId]);

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Session: {sessionId}</h1>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                    <h2 className="text-xl font-semibold mb-2">Lineage Graph</h2>
                    <LineageGraph data={lineage} />
                </div>
                <div>
                    <h2 className="text-xl font-semibold mb-2">Replay / Thoughts</h2>
                    <SessionReplay data={replay} />
                </div>
            </div>
        </div>
    );
}
