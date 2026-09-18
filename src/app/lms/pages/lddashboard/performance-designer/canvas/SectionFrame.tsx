"use client";

/**
 * One section of the report preview — title and optional right-hand aside.
 *
 * The old A./B./C. letter prefix was dropped 2026-09-04: with only 5–7
 * sections that flow in a fixed reader order (Summary → Learning
 * Journey → Learning Performance → Learner Results → Activity Performance
 * → Learners → Assignments & Assessments) the letter added nothing an
 * L&D-Head needed to scan. Callers still pass `letter` for backwards
 * compatibility, but it's ignored.
 *
 * The tiny × "hide from preview" affordance was removed 2026-09-04 —
 * per-section hiding is now controlled exclusively from the filter
 * popover's Include-in-Report checklist, so the canvas stays visually
 * clean. `onRemove` is retained on the interface for compatibility.
 *
 * The frame also registers its DOM node with the container's `chartRefs`,
 * which the PDF export walks to rasterise whatever chart the section holds.
 */

import React from "react";
import type { ViewKey } from "../model";

export function SectionFrame({
    id,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    letter: _letter,
    title,
    aside,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onRemove: _onRemove,
    registerRef,
    bodyClassName = "",
    children,
}: {
    id: ViewKey;
    /** Historical letter prefix — retained on the interface so nothing
     *  breaks, but no longer rendered. */
    letter?: string;
    title: string;
    aside?: React.ReactNode;
    /** Legacy hide-from-canvas hook — retained on the interface so
     *  callers keep compiling, but the × button is no longer rendered.
     *  Sections are now toggled from the filter popover instead. */
    onRemove?: (k: ViewKey) => void;
    registerRef: (k: ViewKey, el: HTMLElement | null) => void;
    bodyClassName?: string;
    children: React.ReactNode;
}) {
    return (
        <section
            className="relative rounded-tile border border-hairline bg-surface shadow-xs"
            ref={(el) => registerRef(id, el)}
            aria-label={title}
        >
            <header className="flex items-center gap-3 px-4 pt-3 pb-2">
                <h3 className="text-[13px] font-bold text-heading">{title}</h3>
                {aside ? <div className="ml-auto flex min-w-0 items-center gap-2 text-[10.5px] text-subtle">{aside}</div> : null}
            </header>
            <div className={`px-4 pb-4 ${bodyClassName}`}>{children}</div>
        </section>
    );
}

export function CanvasEmpty({ children }: { children: React.ReactNode }) {
    return (
        <div className="rounded-control border border-dashed border-hairline bg-surface-sunken/40 px-4 py-6 text-center text-[11.5px] text-subtle">
            {children}
        </div>
    );
}

export default SectionFrame;
