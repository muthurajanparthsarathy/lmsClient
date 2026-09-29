import React from 'react';

// Label + count + share meter — used by the Service Mix legend and the Course
// Levels breakdown so both speak one visual language. Share math matches the
// page's pct() helper (rounded, divide-by-zero guarded).
export function DistRow({
    label,
    count,
    total,
    color,
}: {
    label: string;
    count: number;
    total: number;
    color: string;
}) {
    const share = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
        <div>
            <div className="mb-1 flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 font-medium text-body">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                    {label}
                </span>
                <span className="tabular-nums text-subtle">
                    <span className="font-semibold text-heading">{count}</span> · {share}%
                </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
                <div
                    className="h-full rounded-full transition-[width] duration-200 ease-standard"
                    style={{ width: `${share}%`, backgroundColor: color }}
                />
            </div>
        </div>
    );
}
