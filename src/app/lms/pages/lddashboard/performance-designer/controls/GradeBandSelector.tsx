"use client";

/**
 * 5. Grade Bands — the Performance Report's five learner bands
 * (Excellent ≥80 · Good 60–79 · Average 40–59 · Poor 1–39 · Not Started 0),
 * each in its own semantic tint. Multi-select with the same null-means-all
 * convention as every other picker in the drawer.
 */

import React from "react";
import { Check } from "lucide-react";
import { DrawerSection } from "./DrawerSection";
import { GRADE_BANDS, type GradeKey } from "../model";

export function GradeBandSelector({
    sel,
    onChange,
}: {
    sel: Set<GradeKey> | null;
    onChange: (v: Set<GradeKey> | null) => void;
}) {
    const isOn = (k: GradeKey) => sel === null || sel.has(k);
    const toggle = (k: GradeKey) => {
        const next = new Set<GradeKey>(sel === null ? GRADE_BANDS.map((g) => g.key) : sel);
        if (next.has(k)) next.delete(k);
        else next.add(k);
        onChange(next.size === GRADE_BANDS.length ? null : next);
    };
    return (
        <DrawerSection
            id="grades"
            n={5}
            title="Grade Bands"
            info="Bands on the selected % (falls back to overall % when nothing is selected). These are learner grades, not course readiness."
        >
            <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Grade bands">
                {GRADE_BANDS.map((g) => {
                    const on = isOn(g.key);
                    return (
                        <button
                            key={g.key}
                            type="button"
                            role="checkbox"
                            aria-checked={on}
                            onClick={() => toggle(g.key)}
                            className={`relative flex min-w-0 flex-col items-start rounded-control border px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 ${
                                on ? "" : "border-hairline bg-surface opacity-70 hover:opacity-100"
                            }`}
                            style={on ? { borderColor: `${g.color}66`, background: `${g.color}12` } : undefined}
                        >
                            <span className="flex w-full items-center justify-between gap-1">
                                <span className="truncate text-[11px] font-bold" style={{ color: on ? g.color : undefined }}>
                                    {g.label}
                                </span>
                                <span
                                    className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border ${
                                        on ? "text-white" : "border-hairline-strong bg-surface"
                                    }`}
                                    style={on ? { background: g.color, borderColor: g.color } : undefined}
                                    aria-hidden
                                >
                                    {on ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
                                </span>
                            </span>
                            <span className="text-[10px] tabular-nums text-subtle">{g.range}</span>
                        </button>
                    );
                })}
            </div>
        </DrawerSection>
    );
}

export default GradeBandSelector;
