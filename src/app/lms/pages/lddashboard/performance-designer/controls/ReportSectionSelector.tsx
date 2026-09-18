"use client";

/**
 * 6. Include in Report — which sections the canvas (and therefore the
 * export) carries. Two columns of plain checkboxes; the keys are the same
 * ViewKeys the export code switches on, only the labels were reworded.
 */

import React from "react";
import { DrawerSection } from "./DrawerSection";
import { VIEWS, type ViewKey } from "../model";

export function ReportSectionSelector({
    views,
    onToggle,
    onSelectAll,
}: {
    views: Set<ViewKey>;
    onToggle: (k: ViewKey) => void;
    onSelectAll: () => void;
}) {
    const allOn = VIEWS.every((v) => views.has(v.key));
    return (
        <DrawerSection
            id="sections"
            n={6}
            title="Include in Report"
            info="Sections on the canvas are exactly what Download Report ships."
            aside={
                allOn ? undefined : (
                    <button type="button" onClick={onSelectAll} className="font-semibold text-brand-strong hover:underline">
                        Select all
                    </button>
                )
            }
        >
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                {VIEWS.map((v) => {
                    const on = views.has(v.key);
                    return (
                        <label
                            key={v.key}
                            className={`flex cursor-pointer items-center gap-2 rounded-chip px-1.5 py-1 hover:bg-row-hover ${
                                v.key === "exerciseDetail" ? "col-span-2" : ""
                            }`}
                        >
                            <input
                                type="checkbox"
                                checked={on}
                                onChange={() => onToggle(v.key)}
                                className="size-3.5 cursor-pointer rounded border-hairline-strong text-brand-500 focus:ring-2 focus:ring-brand-500/30"
                            />
                            <span className={`text-[11px] font-medium ${on ? "text-body" : "text-subtle"}`}>{v.label}</span>
                        </label>
                    );
                })}
            </div>
        </DrawerSection>
    );
}

export default ReportSectionSelector;
