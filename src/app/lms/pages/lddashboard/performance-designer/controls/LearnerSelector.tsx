"use client";

/**
 * 2. Learners — searchable multi-select over the UNIQUE people in scope
 * (the container already collapses a learner on three courses to one
 * option). Default is everyone; the status row below the picker says how
 * many are in, with a × to go back to all.
 */

import React from "react";
import { X } from "lucide-react";
import { DrawerSection } from "./DrawerSection";
import { MultiPickBox } from "../MultiPickBox";

export function LearnerSelector({
    options,
    sel,
    onChange,
}: {
    options: { id: string; name: string; sub?: string }[];
    sel: Set<string> | null;
    onChange: (v: Set<string> | null) => void;
}) {
    const count = sel === null ? options.length : sel.size;
    return (
        <DrawerSection id="learners" n={2} title="Learners" info="Everyone enrolled in the selected scope. A learner on several courses is still one person here.">
            <MultiPickBox
                label="Learners"
                placeholder="Search learners…"
                options={options}
                sel={sel}
                onChange={onChange}
                empty="No learners in scope"
                summary={(c, t) => (c === t ? `All ${t} learners` : `${c} of ${t} learners`)}
            />
            <div className="mt-2 flex items-center gap-2">
                <span
                    className={`inline-flex items-center gap-1.5 rounded-chip border px-2 py-0.5 text-[10.5px] font-semibold tabular-nums ${
                        count === 0
                            ? "border-danger-500/30 bg-danger-500/10 text-danger-500"
                            : "border-brand-500/25 bg-brand-wash text-brand-strong"
                    }`}
                >
                    {count} learner{count === 1 ? "" : "s"} selected
                    {sel !== null ? (
                        <button
                            type="button"
                            onClick={() => onChange(null)}
                            aria-label="Select all learners"
                            title="Back to all learners"
                            className="-mr-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-brand-500/15"
                        >
                            <X className="h-3 w-3" aria-hidden />
                        </button>
                    ) : null}
                </span>
                {count === 0 ? <span className="text-[10.5px] text-danger-500">Nothing to report on.</span> : null}
            </div>
        </DrawerSection>
    );
}

export default LearnerSelector;
