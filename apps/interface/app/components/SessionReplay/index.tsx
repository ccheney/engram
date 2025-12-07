"use client";

import React from 'react';
import type { ReplayResponse } from '@lib/types';

interface SessionReplayProps {
    data: ReplayResponse | null;
}

export function SessionReplay({ data }: SessionReplayProps) {
    if (!data) return <div>Loading Replay...</div>;

    return (
        <div className="flex flex-col gap-4 p-4 max-w-2xl mx-auto">
            {data.timeline.map((item, i) => (
                <div key={item.id || i} className="border rounded p-4 shadow-sm bg-white">
                    <div className="text-xs text-gray-500 mb-1">Step {i + 1}</div>
                    <pre className="whitespace-pre-wrap text-sm font-mono bg-gray-50 p-2 rounded">
                        {JSON.stringify(item, null, 2)}
                    </pre>
                </div>
            ))}
        </div>
    );
}
