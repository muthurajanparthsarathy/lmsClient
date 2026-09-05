"use client";

/**
 * 3. Learning Stages — the control that carries the method. Three cards in a
 * row, read left to right as a progression. A stage with no content in the
 * current scope is disabled, not merely unchecked, so the head cannot filter
 * the report down to nothing by accident (the rule the modal always had).
 */

import React from "react";
import { Check, Handshake, Lightbulb, Rocket, type LucideIcon } from "lucide-react";
import { DrawerSection } from "./DrawerSection";
import { ACTIVITIES, STAGE_ROLE, type Stage } from "../model";

const STAGE_ICON: Record<Stage, LucideIcon> = { I_Do: Lightbulb, We_Do: Handshake, You_Do: Rocket };
/** Tint per stage — same identity colours the pathway on the canvas uses. */
const STAGE_TINT: Record<Stage, string> = { I_Do: "#0E9F6E", We_Do: "#2E90C4", You_Do: "#F97316" };

export function LearningStageSelector({
    available,
    selected,
    onToggle,
}: {
    available: Set<Stage>;
    selected: Set<Stage>;
    onToggle: (stage: Stage) => void;
}) {
    return (
        <DrawerSection
            id="stages"
            n={3}
            title="Learning Stages"
            aside="(I Do → We Do → You Do)"
            info="SmartCliff's I Do → We Do → You Do pedagogy measures the transition from instruction to guided practice to independent performance."
        >
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="Learning stages">
                {ACTIVITIES.map((a) => {
                    const Icon = STAGE_ICON[a.key];
                    const has = available.has(a.key);
                    const on = has && selected.has(a.key);
                    const tint = STAGE_TINT[a.key];
                    return (
                        <button
                            key={a.key}
                            type="button"
                            role="checkbox"
                            aria-checked={on}
                            disabled={!has}
                            onClick={() => onToggle(a.key)}
                            title={has ? `${a.label} — ${STAGE_ROLE[a.key]}` : `${a.label} has no content in this scope`}
                            className={`relative flex min-h-[86px] flex-col items-start rounded-control border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 ${
                                !has
                                    ? "cursor-not-allowed border-dashed border-hairline bg-surface-sunken/50 opacity-60"
                                    : on
                                        ? "bg-surface"
                                        : "border-hairline bg-surface hover:border-hairline-strong"
                            }`}
                            style={on ? { borderColor: tint, background: `${tint}0F` } : undefined}
                        >
                            {on ? (
                                <span
                                    className="absolute right-1.5 top-1.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-white"
                                    style={{ background: tint }}
                                    aria-hidden
                                >
                                    <Check className="h-2.5 w-2.5" strokeWidth={3} />
                                </span>
                            ) : null}
                            <span className="mb-1 inline-flex items-center gap-1.5">
                                <Icon className="h-3.5 w-3.5" style={{ color: has ? tint : undefined }} aria-hidden />
                                <span className="text-[11.5px] font-bold text-heading">{a.label}</span>
                            </span>
                            <span className="text-[10px] leading-snug text-subtle">{a.hint}</span>
                        </button>
                    );
                })}
            </div>
        </DrawerSection>
    );
}

export default LearningStageSelector;
