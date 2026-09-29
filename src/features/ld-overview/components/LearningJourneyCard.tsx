"use client";

/**
 * Learning Journey – Completion.
 *
 * The left half of the paired I Do → We Do → You Do comparison. This card
 * shows COMPLETION only — how far the learners in scope have progressed
 * through each stage. The value comes from `stageDone` on the server's
 * progress roll-up (completed / total across a stage's sub-types), the same
 * number the L&D dashboard has always shown as "stage %".
 *
 * The paired right-hand card (`IndustryReadinessCard`) answers a different
 * question — how well learners scored — and uses the same shell so the two
 * cards read as a matched set.
 */

import { Card, Empty, Skeleton } from "./primitives";
import { StageProgressCard, type StageDatum } from "./StageProgressCard";
import type { OverviewModel } from "../types";

/** Descriptors are card-specific: on this card each stage names an
 *  ACTIVITY TYPE, not the performance the learner demonstrated. */
const COMPLETION_TAG = {
    iDo: "Concept Learning",
    weDo: "Guided Activities",
    youDo: "Independent Activities",
} as const;

export function LearningJourneyCard({ model }: { model: OverviewModel | null }) {
    if (!model) return <SkeletonCard />;

    const stages: StageDatum[] = model.journey.map((s) => ({
        key: s.key,
        label: s.label,
        tag: COMPLETION_TAG[s.key],
        value: s.value,
    }));

    // If NO stage has any content in scope, we've got nothing to compare —
    // fall back to the empty state rather than three "—" rows.
    if (stages.every((s) => s.value === null)) {
        return (
            <Card title="Learning Journey – Completion">
                <Empty
                    title="No pedagogy data in this scope"
                    hint="No I Do, We Do or You Do content is configured for the selected courses."
                />
            </Card>
        );
    }

    return (
        <StageProgressCard
            title="Learning Journey – Completion"
            subtitle="How far learners have progressed in each learning stage"
            badge={{ label: "COMPLETION", tone: "info" }}
            infoTip="Completion — the share of assigned I Do / We Do / You Do content each learner has finished."
            stages={stages}
            valueUnit="completed"
            emptyValueSymbol="—"
            emptyValueHint={() => "Not applicable"}
        />
    );
}

function SkeletonCard() {
    return (
        <section className="ldo-spc" aria-busy="true">
            <header className="ldo-spc-h">
                <Skeleton h={18} w={220} />
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

export default LearningJourneyCard;
