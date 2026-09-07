// Shared types for the Degree Program structure editor.
//
// The flow is a story told in five beats: pick the degree, pick its departments,
// answer whether they split into sections, pick the semesters in scope, then fill
// in the courses. Each beat only appears once the one before it is answered.
//
// Everything below the degree is addressed by a PATH: the names of its ancestors
// joined by PATH_SEP, e.g. "B.E ▸ CSE ▸ A ▸ 3" is semester 3 of section A of CSE
// under B.E. Paths are opaque keys — only ever built (see scope.ts), never split.
export const PATH_SEP = ' ▸ '

// The one blue. Structure and form controls both use it so they stop disagreeing.
export const ACCENT = '#F97316'

// One course under a semester — a category plus a name from that category, or a
// free-typed name when `custom` is set ("Others" in the name picker).
//
// Batches are opt-in per course: the checkbox decides whether this course splits
// at all, and only then does it ask how many and what they're called. Most
// courses aren't batched, so the fields stay out of the way until asked for.
export type CourseEntry = {
    category: string
    courseName: string
    custom: boolean
    batchesEnabled: boolean
    batches: string[]
}
export const blankCourse = (): CourseEntry => ({
    category: '', courseName: '', custom: false, batchesEnabled: false, batches: [],
})

// The single degree this mapping covers. Null until beat 1 is answered.
export type DegreeView = {
    name: string
    startYear: string
    endYear: string | null
    durationKnown: boolean
    // Every semester the degree has (from Degree Management) — the options.
    semesterOptions: string[]
    // The subset the user put in scope.
    semesters: string[]
    departments: string[]
    // ALL departments of this degree, not the not-yet-added remainder: a
    // checkbox list needs the full set so ticked rows can render ticked.
    departmentOptions: string[]
    sectionsFor: (department: string) => string[]
}

// Everything the editor needs to read and write a semester's courses. The wizard
// (page.tsx) owns the data; these components only call back into it.
export type CourseApi = {
    categories: { id: string; name: string }[]
    // Course names configured under a category (Course Management).
    namesFor: (category: string) => string[]
    coursesAt: (path: string) => CourseEntry[]
    setCount: (path: string, count: number) => void
    // Deleting a specific row, as opposed to shrinking the count — those are
    // different actions and only one of them is what the row's bin icon means.
    removeAt: (path: string, index: number) => void
    update: (path: string, index: number, patch: Partial<CourseEntry>) => void
    // Batches, once a course opts into them.
    setBatchCount: (path: string, index: number, count: number) => void
    setBatchName: (path: string, index: number, bi: number, value: string) => void
    errorAt: (path: string, index: number, field: 'category' | 'courseName') => string | undefined
    batchErrorAt: (path: string, index: number, bi: number) => string | undefined
    // Roll-ups for the scope list's counters and error badges.
    filledCountUnder: (prefix: string) => { filled: number; total: number }
    errorCountUnder: (prefix: string) => number
}
