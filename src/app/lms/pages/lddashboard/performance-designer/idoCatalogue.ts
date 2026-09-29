/**
 * I Do catalogue + scoring — the missing half of the report configurator.
 *
 * We Do / You Do items are exercise objects on `pedagogy[stage][subcat]` and
 * are scored by `computeStudentMarks`. I Do content, in contrast, is per-FILE:
 *
 *   pedagogy.I_Do[subcat] = {
 *     files:      [ { _id, fileName, mcqQuestions: [ { _id, isActive, … } ] } ],
 *     folders:    [ { files, folders, subfolders } ],  // recursive
 *     subfolders: [ { files, folders, subfolders } ],
 *   }
 *
 * Only files that carry at least one `mcqQuestions[].isActive` question count
 * as I Do "attendable" content — that is the same rule the server's
 * `iDoDocCountByCourse` counter uses in `pedagogyView.js`, so this walker
 * lines up with what the analytics roll-up already reports.
 *
 * Student answers live under `answers.I_Do[fileId]`:
 *
 *   { completionPercentage: 0-100, answers: [{ questionId, isCorrect, ... }] }
 *
 * `completionPercentage` is the platform's own tracked value (progress) and
 * `answers[].isCorrect` gives performance. Both are surfaced by
 * `computeIDoMarks` so the report can score I Do learners the same way We Do
 * / You Do learners are scored (percentage + numerator / denominator).
 */

import { prettySubcat } from "./model";

export interface IDoFile {
    /** File-scoped id from courseData — the key we lookup answers under. */
    id: string;
    /** `fileName` from the file, fallback to a stored `fileName` on the ans. */
    name: string;
    /** "Module → Topic" trail so the picker can show where the file lives. */
    path: string;
    /** Sub-category key (raw). `prettySubcat(subCategory)` renders the label. */
    subCategory: string;
    /** Count of MCQs on the file with `isActive !== false`. */
    totalMcq: number;
    /** Kept for parity with `CatalogueEx` — the same stage field the report
     *  groups on. Always `"I_Do"` here. */
    stage: "I_Do";
    /** The raw file object, in case a downstream helper (e.g. the Student
     *  Detail modal) wants to inspect `mcqQuestions[]` directly. */
    file: any;
}

/** Walk one container's `files / folders / subfolders` tree. */
function collectFiles(container: any, bag: any[]) {
    if (!container || typeof container !== "object") return;
    (container.files || []).forEach((f: any) => bag.push(f));
    (container.folders || []).forEach((folder: any) => collectFiles(folder, bag));
    if (Array.isArray(container.subfolders)) {
        container.subfolders.forEach((sf: any) => collectFiles(sf, bag));
    }
}

const activeMcqCount = (file: any): number =>
    (Array.isArray(file?.mcqQuestions) ? file.mcqQuestions : []).filter(
        (q: any) => q && q.isActive !== false,
    ).length;

/**
 * Every I Do file with at least one active MCQ, flattened out of the whole
 * pedagogy tree (module → sub-module → topic → sub-topic). Sorted by
 * `path · name` so a scroll through the picker matches the syllabus order.
 */
export function walkIDoCatalogue(courseData: any): IDoFile[] {
    if (!courseData?.modules || !Array.isArray(courseData.modules)) return [];
    const out: IDoFile[] = [];
    const seen = new Set<string>();

    const scan = (entity: any, path: string) => {
        const iDo = entity?.pedagogy?.I_Do;
        if (!iDo || typeof iDo !== "object") return;
        for (const [subcat, container] of Object.entries(iDo)) {
            const files: any[] = [];
            collectFiles(container, files);
            for (const file of files) {
                const totalMcq = activeMcqCount(file);
                if (totalMcq === 0) continue;
                const id = String(file?._id || "");
                if (!id || seen.has(id)) continue;
                seen.add(id);
                out.push({
                    id,
                    name: file.fileName || "Untitled document",
                    path: `${path} · ${prettySubcat(subcat)}`,
                    subCategory: subcat,
                    totalMcq,
                    stage: "I_Do",
                    file,
                });
            }
        }
    };

    for (const mod of courseData.modules) {
        const mPath = mod?.title || "Module";
        scan(mod, mPath);
        for (const topic of mod?.topics || []) {
            const tPath = `${mPath} → ${topic?.title || "Topic"}`;
            scan(topic, tPath);
            for (const st of topic?.subTopics || []) {
                scan(st, `${tPath} → ${st?.title || "Subtopic"}`);
            }
        }
        for (const sub of mod?.subModules || []) {
            const sPath = `${mPath} → ${sub?.title || "Sub-module"}`;
            scan(sub, sPath);
            for (const topic of sub?.topics || []) {
                const tPath = `${sPath} → ${topic?.title || "Topic"}`;
                scan(topic, tPath);
                for (const st of topic?.subTopics || []) {
                    scan(st, `${tPath} → ${st?.title || "Subtopic"}`);
                }
            }
        }
    }

    return out.sort((a, b) => (a.path + a.name).localeCompare(b.path + b.name));
}

export interface IDoMarks {
    /** True if the student has any recorded I Do answer on this file. */
    hasAttempted: boolean;
    /** The platform's per-file completion (0-100). Same field the server's
     *  `calcIDoPercentage` averages. */
    completionPercentage: number;
    /** Total MCQs on the file — the denominator for correctness. */
    totalMcq: number;
    /** MCQs the student answered (latest attempt per question). */
    attemptedMcq: number;
    /** MCQs the student got right (`isCorrect === true`). */
    correctMcq: number;
    /** The value the report displays in the I Do score bubble.
     *
     *  I Do is COMPLETION-tracked, not marks-tracked: our resources are
     *  documents / videos / MCQ-bearing files where "how much did the
     *  learner finish" is the primary signal — not "did they get every
     *  MCQ right". So `pct` is the file's `completionPercentage` (0-100),
     *  which is what the platform already stores per file per learner.
     *  `correctMcq` / `attemptedMcq` are surfaced separately for the
     *  Student Detail modal, which does show correctness question-by-
     *  question. `null` when the learner hasn't opened the file at all. */
    pct: number | null;
}

const EMPTY: IDoMarks = {
    hasAttempted: false,
    completionPercentage: 0,
    totalMcq: 0,
    attemptedMcq: 0,
    correctMcq: 0,
    pct: null,
};

/**
 * One student's marks for one I Do file. Reads `courses[courseId].answers.I_Do[fileId]`
 * off the participant document — that document is exactly what
 * `courseDataApi.getById` populates under `batchAndParticipants[].users[].user`,
 * so the caller can pass either the outer wrapper (`.user`) or the raw user.
 */
export function computeIDoMarks(args: {
    participant: any;
    courseId: string;
    file: IDoFile;
}): IDoMarks {
    const { participant, courseId, file } = args;
    // The participant document may be either `{ user: <userDoc> }` (roster
    // shape) or a raw user doc. Both need the same navigation.
    const userDoc = participant?.user ?? participant;
    const enrolled = (userDoc?.courses || []).find((c: any) =>
        String(c?.courseId || "") === String(courseId || ""),
    );
    const ans = enrolled?.answers?.I_Do?.[file.id];
    if (!ans) return { ...EMPTY, totalMcq: file.totalMcq };

    // Latest attempt per question — students commonly retry, and the report
    // has to reflect their final answer, not their first.
    const answers: any[] = Array.isArray(ans.answers) ? ans.answers : [];
    const latestByQ = new Map<string, any>();
    for (const r of answers) {
        const qid = r?.questionId ? String(r.questionId) : `${r?.pageNumber ?? ""}-${r?.questionTitle ?? ""}`;
        const prev = latestByQ.get(qid);
        if (!prev || new Date(r.submittedAt || 0) >= new Date(prev.submittedAt || 0)) {
            latestByQ.set(qid, r);
        }
    }
    const records = [...latestByQ.values()];
    const attemptedMcq = records.length;
    const correctMcq = records.filter((r) => r?.isCorrect === true).length;
    const completionPercentage = Number(ans.completionPercentage) || 0;

    const totalMcq = file.totalMcq;
    // Completion is the LEARNING metric for I Do resources. The platform
    // records `completionPercentage` per (learner, file) — reuse it rather
    // than fabricating a correctness "score" for content that is often
    // watch-and-close (a lecture PDF, a video), not marked.
    const hasAttempted = attemptedMcq > 0 || completionPercentage > 0;
    const pct = hasAttempted ? Math.round(completionPercentage) : null;

    return {
        hasAttempted,
        completionPercentage,
        totalMcq,
        attemptedMcq,
        correctMcq,
        pct,
    };
}
