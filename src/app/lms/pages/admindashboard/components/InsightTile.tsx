import React from 'react';
import type { LucideIcon } from 'lucide-react';

// Key-insight tile — a named finding with its supporting number.
export function InsightTile({
    icon: Icon,
    label,
    value,
    sub,
}: {
    icon: LucideIcon;
    label: string;
    value: string;
    sub?: string;
}) {
    return (
        <div className="flex items-start gap-3 rounded-tile border border-hairline bg-canvas px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-chip bg-brand-wash">
                <Icon size={16} className="text-brand-strong" aria-hidden="true" />
            </div>
            <div className="min-w-0">
                <div className="text-2xs font-semibold uppercase tracking-wider text-faint">{label}</div>
                <div className="mt-0.5 truncate text-sm font-semibold text-heading">{value}</div>
                {sub ? <div className="mt-0.5 text-xs text-subtle">{sub}</div> : null}
            </div>
        </div>
    );
}
