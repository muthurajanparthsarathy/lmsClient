"use client";

/**
 * 7. Roster Columns — the 11 toggles rendered as compact chips; a tick on
 * the chip means the column is in. Greyed out while the Learner Roster
 * section is off, since it would configure nothing visible.
 */

import React from "react";
import { Check } from "lucide-react";
import { DrawerSection } from "./DrawerSection";
import { COLUMNS, type ColKey } from "../model";

export function RosterColumnSelector({
    cols,
    onToggle,
    enabled,
}: {
    cols: Set<ColKey>;
    onToggle: (k: ColKey) => void;
    enabled: boolean;
}) {
    return (
        <DrawerSection
            id="columns"
            n={7}
            title="Roster Columns"
            aside={`${cols.size} of ${COLUMNS.length}`}
            info="Columns of the Learner Roster. Student name is always shown."
            disabled={!enabled}
        >
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Roster columns">
                {COLUMNS.map((c) => {
                    const on = cols.has(c.key);
                    return (
                        <button
                            key={c.key}
                            type="button"
                            role="checkbox"
                            aria-checked={on}
                            onClick={() => onToggle(c.key)}
                            title={c.hint}
                            className={`inline-flex h-7 items-center gap-1 rounded-chip border px-2 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 ${
                                on
                                    ? "border-brand-500/60 bg-brand-wash text-brand-strong"
                                    : "border-hairline bg-surface text-subtle hover:border-hairline-strong hover:text-body"
                            }`}
                        >
                            {c.label}
                            {on ? <Check className="h-3 w-3" strokeWidth={2.6} aria-hidden /> : null}
                        </button>
                    );
                })}
            </div>
        </DrawerSection>
    );
}

export default RosterColumnSelector;
