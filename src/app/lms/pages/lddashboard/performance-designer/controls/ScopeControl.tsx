"use client";

/**
 * 1. Scope — read-only. Client and course are owned by the page's filters;
 * the designer only reports what it was handed, which is why both pills
 * carry a lock and there is no picker here.
 */

import React from "react";
import { Lock } from "lucide-react";
import { DrawerSection } from "./DrawerSection";

export function ScopeControl({ clientName, courseName }: { clientName?: string; courseName?: string }) {
    const client = clientName && clientName !== "all" ? clientName : "All clients";
    const course = courseName || "All courses";
    return (
        <DrawerSection id="scope" n={1} title="Scope" info="What the report covers. Change it from the Client and Course filters on the page behind this designer.">
            <div className="grid grid-cols-2 gap-2">
                <ScopePill label="Client" value={client} />
                <ScopePill label="Course" value={course} />
            </div>
            <p className="mt-1.5 text-[10.5px] text-faint">Course and client are controlled from the main page filters.</p>
        </DrawerSection>
    );
}

function ScopePill({ label, value }: { label: string; value: string }) {
    return (
        <div
            className="flex h-8 min-w-0 items-center gap-1.5 rounded-control border border-hairline bg-surface-sunken/60 px-2.5 text-[11px]"
            title={`${label}: ${value}`}
        >
            <span className="shrink-0 font-medium text-subtle">{label}:</span>
            <span className="min-w-0 flex-1 truncate font-semibold text-heading">{value}</span>
            <Lock className="h-3 w-3 shrink-0 text-faint" aria-hidden />
        </div>
    );
}

export default ScopeControl;
