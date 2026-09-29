"use client";

/**
 * 4. Sub-categories — chips for every bucket the selected stages actually
 * allocate (discovered from the learners' progress objects, never
 * hard-coded). `sel === null` is "all"; toggling keeps that convention so
 * the container's selected-set math is untouched.
 */

import React from "react";
import { Check } from "lucide-react";
import { DrawerSection } from "./DrawerSection";
import { ACTIVITIES, prettySubcat, type SubcatOpt } from "../model";

export function SubcategorySelector({
    options,
    sel,
    onChange,
}: {
    options: SubcatOpt[];
    sel: Set<string> | null;
    onChange: (v: Set<string> | null) => void;
}) {
    const isOn = (id: string) => sel === null || sel.has(id);
    const toggle = (id: string) => {
        const next = new Set(sel === null ? options.map((o) => o.id) : sel);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        onChange(next.size === options.length ? null : next);
    };
    // The same pretty name can live under two stages ("Assignment" under
    // both We Do and You Do exists in live data) — tag the stage only then.
    const dupes = new Set(
        options.map((o) => prettySubcat(o.subcat)).filter((n, i, arr) => arr.indexOf(n) !== i),
    );
    const count = sel === null ? options.length : sel.size;

    return (
        <DrawerSection
            id="subcats"
            n={4}
            title="Activity Types"
            aside={options.length ? `${count} of ${options.length}` : undefined}
            info="Only the activity types (Assignment, Assessment, Practical, Test Your Skills) your selected courses and stages actually allocate."
        >
            {options.length === 0 ? (
                <p className="rounded-control border border-dashed border-hairline bg-surface-sunken/50 px-2.5 py-2 text-[10.5px] text-subtle">
                    No learning activities are available for the selected stages.
                </p>
            ) : (
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Sub-categories">
                    {options.map((o) => {
                        const on = isOn(o.id);
                        const name = prettySubcat(o.subcat);
                        const stage = ACTIVITIES.find((a) => a.key === o.stage)?.label;
                        return (
                            <button
                                key={o.id}
                                type="button"
                                role="checkbox"
                                aria-checked={on}
                                onClick={() => toggle(o.id)}
                                title={o.label}
                                className={`inline-flex h-7 items-center gap-1.5 rounded-chip border px-2 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 ${
                                    on
                                        ? "border-brand-500/60 bg-brand-wash text-brand-strong"
                                        : "border-hairline bg-surface text-subtle hover:border-hairline-strong hover:text-body"
                                }`}
                            >
                                <span
                                    className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border ${
                                        on ? "border-brand-500 bg-brand-500 text-white" : "border-hairline-strong bg-surface"
                                    }`}
                                    aria-hidden
                                >
                                    {on ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
                                </span>
                                {name}
                                {dupes.has(name) && stage ? <span className="text-[10px] font-normal text-faint">({stage})</span> : null}
                            </button>
                        );
                    })}
                </div>
            )}
        </DrawerSection>
    );
}

export default SubcategorySelector;
