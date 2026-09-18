'use client';

import React from 'react';

// Shape of the entries Recharts hands a custom tooltip. Every chart datum on
// this page carries BOTH `name` (truncated course code, shown on the axis) and
// `fullName` (the full course name) — the tooltip prefers `fullName` so
// hovering a truncated bar still tells you which course it is. That payload
// contract must not change.
type TooltipEntry = {
    fill?: string;
    stroke?: string;
    value?: React.ReactNode;
    name?: React.ReactNode;
    payload?: { fullName?: string };
};

export const ChartTooltip = ({
    active,
    payload,
    label,
}: {
    active?: boolean;
    payload?: TooltipEntry[];
    label?: React.ReactNode;
}) => {
    if (active && payload && payload.length) {
        return (
            <div className="rounded-tile border border-hairline-strong bg-surface px-3 py-2.5 shadow-lg">
                <p className="mb-1.5 text-xs font-medium text-heading">
                    {payload[0]?.payload?.fullName || label}
                </p>
                {payload.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2 text-xs">
                        <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: entry.fill || entry.stroke }}
                        />
                        <span className="font-semibold tabular-nums text-heading">{entry.value}</span>
                        <span className="capitalize text-subtle">{entry.name}</span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

// Legend text stays in text tokens, never the series color.
export const legendFormatter = (value: string) => (
    <span className="text-xs text-subtle">{value}</span>
);
