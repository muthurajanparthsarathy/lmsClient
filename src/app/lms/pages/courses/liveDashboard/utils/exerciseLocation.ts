// Where does this exercise actually live in the course tree?
//
// `findExerciseInCourseData` (computeStudentMarks.ts) answers "which exercise
// document is this id?" — enough for marks, but not for Rerun. The rerun
// endpoints key a student's stored answers by the PEDAGOGY MAP KEY
// (`answers[category][subcategoryKey]`, see answer.js:getRerunContext), and
// that key is the course's own subcategory label lowercased with spaces
// underscored — "Assessment" -> "assessment".
//
// The Live Dashboard URL only carries the human LABEL ("Assesment"), which is
// NOT the map key, so passing it straight through returns an empty context and
// the rerun silently finds nothing to run. This walk returns the real key (and
// the real category) alongside the exercise, so Rerun on the dashboard sends
// exactly what the reviewSubmission list used to send from `_category` /
// `_subcategory`.

type Loose = Record<string, any>;

export type PedagogyCategory = "I_Do" | "We_Do" | "You_Do";

export interface ExerciseLocation {
  exercise: Loose;
  /** Pedagogy tab the exercise hangs off — the rerun API's `category`. */
  category: PedagogyCategory;
  /** Pedagogy map KEY (not the label) — the rerun API's `subcategory`. */
  subcategory: string;
}

const idOf = (v: unknown): string =>
  v == null ? "" : typeof v === "string" ? v : String((v as Loose)?._id ?? v);

// Same identity test `computeStudentMarks.matchesExercise` uses, kept local so
// the two files stay independently readable.
const matches = (ex: Loose, exerciseId: string): boolean => {
  if (!ex || !exerciseId) return false;
  const target = idOf(exerciseId);
  if (!target) return false;
  const exId = idOf(ex._id);
  if (exId === target) return true;
  const infoId = idOf(ex.exerciseInformation?.exerciseId);
  if (infoId === target) return true;
  if (exId && exId.includes(target)) return true;
  if (infoId && infoId.includes(target)) return true;
  return false;
};

const CATEGORIES: PedagogyCategory[] = ["I_Do", "We_Do", "You_Do"];

const scanPedagogy = (pedagogy: Loose | undefined, exerciseId: string): ExerciseLocation | null => {
  if (!pedagogy) return null;
  for (const category of CATEGORIES) {
    const tab = pedagogy[category];
    if (!tab || typeof tab !== "object") continue;
    // No allowlist of subcategory names — the keys are admin-authored in
    // Dynamic Field Settings ▸ Pedagogy, so every array under the tab is an
    // exercise bucket and that is the only test available.
    for (const [subcategory, list] of Object.entries(tab)) {
      if (!Array.isArray(list)) continue;
      for (const ex of list) {
        if (matches(ex, exerciseId)) return { exercise: ex, category, subcategory };
      }
    }
  }
  return null;
};

/**
 * Locate an exercise inside a `/getAll/courses-data` payload and report the
 * pedagogy category + subcategory KEY it is filed under. Walks module →
 * submodule → topic → subtopic, same four levels as the marks pipeline.
 */
export const findExerciseLocation = (
  courseData: Loose | null | undefined,
  exerciseId: string,
): ExerciseLocation | null => {
  if (!courseData?.modules || !Array.isArray(courseData.modules) || !exerciseId) return null;

  for (const mod of courseData.modules) {
    const modHit = scanPedagogy(mod?.pedagogy, exerciseId);
    if (modHit) return modHit;

    for (const topic of mod?.topics || []) {
      const tHit = scanPedagogy(topic?.pedagogy, exerciseId);
      if (tHit) return tHit;
      for (const st of topic?.subTopics || []) {
        const stHit = scanPedagogy(st?.pedagogy, exerciseId);
        if (stHit) return stHit;
      }
    }

    for (const sub of mod?.subModules || []) {
      const sHit = scanPedagogy(sub?.pedagogy, exerciseId);
      if (sHit) return sHit;
      for (const topic of sub?.topics || []) {
        const tHit = scanPedagogy(topic?.pedagogy, exerciseId);
        if (tHit) return tHit;
        for (const st of topic?.subTopics || []) {
          const stHit = scanPedagogy(st?.pedagogy, exerciseId);
          if (stHit) return stHit;
        }
      }
    }
  }

  return null;
};
