"use client";

/**
 * Shared shell for the two paired L&D Overview cards:
 *
 *   Learning Journey – Completion    — how much did learners complete?
 *   Industry Readiness – Performance — how well did learners perform?
 *
 * Both cards render an identical three-stage horizontal layout so they read as
 * a comparison — different tone (blue vs green), different tags ("Guided
 * Activities" vs "Guided Performance"), and different value semantics
 * (completion vs score), but the SAME structure. Keeping them in one shell
 * makes drift impossible.
 *
 * The component is presentational: the caller passes already-computed stage
 * values and the copy that names them. It does not decide whether a stage is
 * about completion or performance — that context lives with the caller.
 */

import { ArrowRight, Handshake, Info, Lightbulb, Rocket, type LucideIcon } from "lucide-react";
// `LucideIcon` is kept only for the stage-icon table below — the card no
// longer renders a bottom footer strip, so no other icon type flows through.
import { TONE_VAR } from "./primitives";
import type { Tone } from "../types";

export type StageKey = "iDo" | "weDo" | "youDo";

export interface StageDatum {
    key: StageKey;
    label: string;
    /** One-line descriptor under the stage label — e.g. "Concept Learning" on
     *  the completion card, "Concept Performance" on the performance card. */
    tag: string;
    /** 0–100, or null when this stage has no applicable value in scope. */
    value: number | null;
}

export interface StageProgressCardProps {
    title: string;
    subtitle: string;
    /** Small pill next to the title — the semantic label ("COMPLETION" /
     *  "PERFORMANCE") that carries the card's meaning. */
    badge: { label: string; tone: "info" | "success" };
    /** Tooltip shown on the info dot beside the title. */
    infoTip: string;

    stages: StageDatum[];
    /** Label shown under the value on rows that DO have a value — "completed"
     *  on the completion card, empty on the performance card. */
    valueUnit?: string;

    /** How to render a stage whose value is null. Both cards need this and
     *  need it to differ: the completion card says "Not applicable" for a
     *  stage that has no content, the performance card says "No score-based
     *  evaluation" for I Do. */
    emptyValueSymbol: string;
    emptyValueHint: (stage: StageKey) => string;
}

const STAGE_ICON: Record<StageKey, LucideIcon> = { iDo: Lightbulb, weDo: Handshake, youDo: Rocket };

/** Semantic tone for a completion/performance value. Same bands as elsewhere
 *  in the Overview — 80/60/45 — so a "17%" reads the same way here as it
 *  would on any other card. */
const valueTone = (v: number | null): Tone => {
    if (v === null) return "neutral";
    if (v >= 80) return "success";
    if (v >= 60) return "brand";
    if (v >= 45) return "warning";
    return "danger";
};

export function StageProgressCard(props: StageProgressCardProps) {
    return (
        <section className="ldo-spc" aria-label={`${props.title} – ${props.badge.label.toLowerCase()}`}>
            <header className="ldo-spc-h">
                <div className="ldo-spc-title">
                    <h2>{props.title}</h2>
                    <span className={`ldo-spc-badge t-${props.badge.tone}`}>{props.badge.label}</span>
                    <span className="ldo-spc-info" title={props.infoTip} aria-label={props.infoTip}>
                        <Info size={12} strokeWidth={2} aria-hidden />
                    </span>
                </div>
                <p className="ldo-spc-sub">{props.subtitle}</p>
            </header>

            <div className="ldo-spc-stages">
                {props.stages.map((s, i) => (
                    <Stage
                        key={s.key}
                        stage={s}
                        valueUnit={props.valueUnit}
                        emptyValueSymbol={props.emptyValueSymbol}
                        emptyValueHint={props.emptyValueHint(s.key)}
                        arrowAfter={i < props.stages.length - 1}
                    />
                ))}
            </div>
        </section>
    );
}

function Stage({
    stage,
    valueUnit,
    emptyValueSymbol,
    emptyValueHint,
    arrowAfter,
}: {
    stage: StageDatum;
    valueUnit?: string;
    emptyValueSymbol: string;
    emptyValueHint: string;
    arrowAfter: boolean;
}) {
    const Ico = STAGE_ICON[stage.key];
    const tone = valueTone(stage.value);
    const color = TONE_VAR[tone];
    const na = stage.value === null;
    // stage.value is guaranteed non-null when !na, but TS can't narrow through
    // a stored `na` flag — pull it into a local const so the widen stays safe.
    const value = stage.value ?? 0;
    const width = na ? 0 : Math.max(4, Math.min(100, value));

    return (
        <>
            <div className="ldo-spc-stage">
                <span className="ldo-spc-ring" style={{ color, borderColor: na ? "var(--grid)" : color }}>
                    <Ico size={22} strokeWidth={1.9} aria-hidden />
                </span>
                <b>{stage.label}</b>
                <small>{stage.tag}</small>

                {na ? (
                    <span className="ldo-spc-v na" aria-label={`${stage.label} — ${emptyValueHint}`}>
                        {emptyValueSymbol}
                    </span>
                ) : (
                    <span className="ldo-spc-v" style={{ color }} aria-label={`${stage.label} ${stage.value}%${valueUnit ? ` ${valueUnit}` : ""}`}>
                        {stage.value}%
                        {valueUnit ? <em>{valueUnit}</em> : null}
                    </span>
                )}

                <span
                    className={`ldo-spc-bar ${na ? "na" : ""}`}
                    role={na ? undefined : "progressbar"}
                    aria-valuemin={na ? undefined : 0}
                    aria-valuemax={na ? undefined : 100}
                    aria-valuenow={na ? undefined : stage.value ?? undefined}
                    aria-hidden={na ? true : undefined}
                >
                    {na ? null : <i style={{ width: `${width}%`, background: color }} />}
                </span>

                {na ? <small className="ldo-spc-hint">{emptyValueHint}</small> : null}
            </div>
            {arrowAfter ? (
                <ArrowRight className="ldo-spc-arrow" size={16} strokeWidth={1.9} aria-hidden />
            ) : null}
        </>
    );
}

export default StageProgressCard;
