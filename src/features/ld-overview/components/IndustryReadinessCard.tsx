"use client";

/**
 * Industry Readiness – Performance.
 *
 * The right half of the paired I Do → We Do → You Do comparison. This card
 * shows PERFORMANCE only — how well learners scored on each stage's
 * score-based content, not how much they completed. Values come from
 * `readinessParts` on the model (see `lib/metrics.ts`), which reads the
 * marks-weighted `percentage` the server already emits for We_Do / You_Do,
 * and returns null for I Do because the platform tracks I Do as completion
 * rather than a score.
 *
 * The N/A vs 0% distinction is load-bearing: I Do renders "N/A · No
 * score-based evaluation", never "0%", and the two mean different things.
 * The paired left-hand card (`LearningJourneyCard`) uses the same shell.
 */

import { Card, Empty, Skeleton } from "./primitives";
import { StageProgressCard, type StageDatum } from "./StageProgressCard";
import type { OverviewModel, ReadinessPart } from "../types";

/** Stage labels are kept plain — "I Do", "We Do", "You Do" — because the
 *  card's PERFORMANCE badge in the header already carries the "Performance"
 *  qualifier. Repeating it on every ring ("I Do Performance", "We Do
 *  Performance", …) reads as redundant beside the badge. */
const STAGE_LABEL = { iDo: "I Do", weDo: "We Do", youDo: "You Do" } as const;

/** Descriptors are card-specific: on this card each stage names the KIND OF
 *  PERFORMANCE being measured — not the activity type. */
const PERFORMANCE_TAG = {
    iDo: "Concept Performance",
    weDo: "Guided Performance",
    youDo: "Independent Performance",
} as const;

/** Empty-state hint per stage. I Do says the metric doesn't exist at all;
 *  We Do / You Do say we simply have no scored data yet in this scope. */
const EMPTY_HINT: Record<keyof typeof PERFORMANCE_TAG, string> = {
    iDo: "No score-based evaluation",
    weDo: "No score-based data",
    youDo: "No score-based data",
};

export function IndustryReadinessCard({ model }: { model: OverviewModel | null }) {
    if (!model) return <SkeletonCard />;

    // Pull the three per-stage rows out of the model, drop the "overall" row
    // (this card is stage-specific — the overall score belongs on the
    // Executive Summary strip above, not repeated inside the card).
    const stageOf = (k: keyof typeof PERFORMANCE_TAG): StageDatum => {
        const part = model.readinessParts.find((p): p is ReadinessPart => p.key === k);
        return {
            key: k,
            label: STAGE_LABEL[k],
            tag: PERFORMANCE_TAG[k],
            value: part?.value ?? null,
        };
    };
    const stages: StageDatum[] = [stageOf("iDo"), stageOf("weDo"), stageOf("youDo")];

    if (stages.every((s) => s.value === null)) {
        return (
            <Card title="Industry Readiness – Performance">
                <Empty
                    title="No performance data in this scope"
                    hint="No score-based I Do, We Do or You Do results in the selected scope."
                />
            </Card>
        );
    }

    return (
        <StageProgressCard
            title="Industry Readiness – Performance"
            subtitle="How well learners performed in each learning stage"
            badge={{ label: "PERFORMANCE", tone: "success" }}
            infoTip="Performance — marks-weighted score on I Do / We Do / You Do work. Distinct from completion."
            stages={stages}
            // N/A on every empty performance row — the metric doesn't exist for
            // that learner-set, whereas the completion card uses "—" because the
            // stage simply has no assigned content to complete.
            emptyValueSymbol="N/A"
            emptyValueHint={(key) => EMPTY_HINT[key as keyof typeof EMPTY_HINT] ?? "No score-based data"}
        />
    );
}

function SkeletonCard() {
    return (
        <section className="ldo-spc" aria-busy="true">
            <header className="ldo-spc-h">
                <Skeleton h={18} w={240} />
                <div style={{ marginTop: 6 }}><Skeleton h={12} w={260} /></div>
            </header>
            <div className="ldo-spc-stages">
                {[0, 1, 2].map((i) => (
                    <div key={i} className="ldo-spc-stage" style={{ gridColumn: i * 2 + 1 }}>
                        <Skeleton h={50} w={50} r={99} />
                        <div style={{ marginTop: 8 }}><Skeleton h={12} w="70%" /></div>
                        <div style={{ marginTop: 12 }}><Skeleton h={20} w="50%" /></div>
                        <div style={{ marginTop: 10 }}><Skeleton h={6} w="80%" r={4} /></div>
                    </div>
                ))}
            </div>
            <div style={{ marginTop: 14 }}><Skeleton h={30} r={9} /></div>
        </section>
    );
}

export default IndustryReadinessCard;
