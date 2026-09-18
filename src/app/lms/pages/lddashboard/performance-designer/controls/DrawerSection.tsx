"use client";

/**
 * One numbered group in the configuration drawer: "3. Learning Stages", an
 * optional aside ("(I Do → We Do → You Do)"), an optional info tooltip, then
 * the control. Dividers come from the parent's `divide-y`, so the section
 * itself stays a plain block rather than another card-inside-a-card.
 */

import React from "react";
import { Info } from "lucide-react";
import { sectionDomId, type DrawerSectionId } from "./sections";

export function DrawerSection({
    id,
    n,
    title,
    aside,
    info,
    disabled,
    children,
}: {
    id: DrawerSectionId;
    n: number;
    title: string;
    aside?: React.ReactNode;
    info?: string;
    /** Greys the section out and blocks interaction — for controls whose
     *  precondition (a view being on, a single course) is not met. */
    disabled?: boolean;
    children: React.ReactNode;
}) {
    return (
        <section
            id={sectionDomId(id)}
            data-section={id}
            aria-disabled={disabled || undefined}
            className={`py-3.5 first:pt-1 ${disabled ? "opacity-50 pointer-events-none select-none" : ""}`}
        >
            <header className="mb-2 flex items-center gap-1.5">
                <h3 className="text-[12px] font-bold text-heading">
                    <span className="tabular-nums">{n}.</span> {title}
                </h3>
                {aside ? <span className="text-[10.5px] font-medium text-subtle">{aside}</span> : null}
                {info ? (
                    <span className="ml-auto inline-flex text-faint hover:text-subtle" title={info} aria-label={info}>
                        <Info className="h-3.5 w-3.5" aria-hidden />
                    </span>
                ) : null}
            </header>
            {children}
        </section>
    );
}

export default DrawerSection;
