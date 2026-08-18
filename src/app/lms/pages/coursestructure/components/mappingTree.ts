import type { ServiceMapping, MappedCourse } from '@/apiServices/serviceMappingService'

// Course Setup reads the hierarchy the Map Service wizard built. The wizard
// stores each course against a semester PATH — the names of its ancestors joined
// by PATH_SEP — and this is the one place that path is taken apart again.
// Everywhere else it stays an opaque key.
export const PATH_SEP = ' ▸ '

export type Placement = {
    degree: string
    department: string
    section: string | null
    semester: string
}

// Where a course sits in a batch hierarchy. `phase` is null when the batch does
// not run in phases, which is the batch's own leaf level.
export type BatchPlacement = {
    batch: string
    phase: string | null
}

// A course as Course Setup deals with it: one record per course name AT ONE
// PLACE in the mapping.
//
// This used to group by NAME alone, so a course taught in five semesters was a
// single setup carrying five placements. That was wrong: setting up "Java" under
// CSE also set it up under ECE, because the two were not merely sharing a record
// — they WERE one record, and the schedule, resources and hierarchy of one
// silently became the other's. The same name in two places is two courses that
// happen to be called the same thing, and each gets its own setup.
//
// The two placement lists stay mutually exclusive: a mapping is either
// degree-shaped or batch-shaped, and the path it saves says which. Each list now
// holds at most one entry, since a group IS a single path.
export type CourseGroup = {
    key: string
    // The raw mapping path this course sits at ("B.E ▸ CSE ▸ A ▸ 3", a phase
    // name, or '' for the flat flows). Part of the setup's identity, and sent
    // with the record so the two can be matched up again on the way back.
    path: string
    courseName: string
    category: string
    placements: Placement[]
    batchPlacements: BatchPlacement[]
    // The course's OWN batch names (the Degree Program per-course batches, from
    // MappedCourse.batches). Distinct from batchPlacements, which describe the
    // Batch → Phase hierarchy of the non-degree flows: these are the batches a
    // degree course runs for, stored on the course itself and shown as chips on
    // its row. Empty when the course opted out of batches.
    batches: string[]
}

// Paths are 4 parts with sections ("B.E ▸ CSE ▸ A ▸ 3") and 3 without
// ("B.E ▸ CSE ▸ 3"). Anything else — including the empty path non-degree flows
// leave behind — has no placement to show, so it returns null rather than
// guessing at which part is which.
export const parsePlacement = (path: string | undefined): Placement | null => {
    const parts = (path || '').split(PATH_SEP).map((p) => p.trim()).filter(Boolean)
    if (parts.length === 4) {
        return { degree: parts[0], department: parts[1], section: parts[2], semester: parts[3] }
    }
    if (parts.length === 3) {
        return { degree: parts[0], department: parts[1], section: null, semester: parts[2] }
    }
    return null
}

// Batch paths are "Batch A" or "Batch A ▸ Phase 1" — 1 or 2 parts. Degree paths
// are always 3 or 4, so the part count alone tells the two shapes apart and no
// service-model check is needed to decide which parser applies. A path that
// parses here can never parse as a degree placement, and vice versa.
export const parseBatchPlacement = (path: string | undefined): BatchPlacement | null => {
    const parts = (path || '').split(PATH_SEP).map((p) => p.trim()).filter(Boolean)
    if (parts.length === 2) return { batch: parts[0], phase: parts[1] }
    if (parts.length === 1) return { batch: parts[0], phase: null }
    return null
}

export const placementLabel = (p: Placement): string =>
    [p.department, p.section, `Sem ${p.semester}`].filter(Boolean).join(' ▸ ')

export const batchPlacementLabel = (p: BatchPlacement): string =>
    p.phase ? `${p.batch}${PATH_SEP}${p.phase}` : p.batch

// Group a mapping's courses by name AND path, so each place a course is taught
// is its own setup. Two entries only merge when they are the same course at the
// same place — which happens when a mapping lists a course twice for one
// semester, and there a single row is right.
//
// The category comes from the first entry that has one: the same course
// shouldn't carry different categories, but if the data disagrees we take the
// first rather than dropping it.
export const groupCourses = (mapping: ServiceMapping | null): CourseGroup[] => {
    if (!mapping?.courses?.length) return []
    const byKey = new Map<string, CourseGroup>()
    mapping.courses.forEach((c: MappedCourse) => {
        const name = (c.courseName || '').trim()
        if (!name) return
        const path = (c.path || '').trim()
        // Path first: it is the discriminator, and leading with it keeps the
        // keys of one semester's courses next to each other when debugging.
        const key = `${path.toLowerCase()}::${name.toLowerCase()}`
        if (!byKey.has(key)) {
            byKey.set(key, {
                key, path, courseName: name, category: c.category || '', placements: [], batchPlacements: [], batches: [],
            })
        }
        const group = byKey.get(key) as CourseGroup
        if (!group.category && c.category) group.category = c.category
        // Per-course batches, carried through so the hierarchy can show which
        // batches a degree course runs for. The wizard pads the list with blanks
        // for unfilled inputs, so empties are dropped here. First non-empty list
        // wins, matching how category is taken from the first entry that has one.
        if (!group.batches.length && c.batches?.length) {
            const named = c.batches.map((b) => String(b).trim()).filter(Boolean)
            if (named.length) group.batches = named
        }
        const placement = parsePlacement(c.path)
        // Guarded against the duplicate-entry case above: the same course listed
        // twice for one semester must not show its placement twice.
        if (placement && group.placements.length === 0) group.placements.push(placement)
        // At most one of the two parsers can match a given path, so this is not
        // an else-branch by accident — it is one by construction of the formats.
        const batchPlacement = parseBatchPlacement(c.path)
        if (batchPlacement && group.batchPlacements.length === 0) {
            group.batchPlacements.push(batchPlacement)
        }
    })
    return Array.from(byKey.values())
}

// The hierarchy as a tree, built from the placements themselves rather than from
// masterData — what matters here is where courses actually landed, and a degree
// with no courses has nothing for this page to offer.
export type SemesterNode = { semester: string; courses: CourseGroup[] }
export type SectionNode = { section: string | null; semesters: SemesterNode[] }
export type DepartmentNode = { department: string; sections: SectionNode[] }
export type DegreeNode = { degree: string; departments: DepartmentNode[] }

export const buildTree = (groups: CourseGroup[]): DegreeNode[] => {
    const degrees = new Map<string, Map<string, Map<string, Map<string, CourseGroup[]>>>>()

    groups.forEach((group) => {
        group.placements.forEach((p) => {
            // A null section is its own bucket keyed by '', which keeps
            // sectioned and unsectioned departments from merging.
            const sectionKey = p.section || ''
            if (!degrees.has(p.degree)) degrees.set(p.degree, new Map())
            const depts = degrees.get(p.degree) as Map<string, Map<string, Map<string, CourseGroup[]>>>
            if (!depts.has(p.department)) depts.set(p.department, new Map())
            const sections = depts.get(p.department) as Map<string, Map<string, CourseGroup[]>>
            if (!sections.has(sectionKey)) sections.set(sectionKey, new Map())
            const semesters = sections.get(sectionKey) as Map<string, CourseGroup[]>
            if (!semesters.has(p.semester)) semesters.set(p.semester, [])
            const list = semesters.get(p.semester) as CourseGroup[]
            if (!list.some((c) => c.key === group.key)) list.push(group)
        })
    })

    const numeric = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true })

    return Array.from(degrees.entries()).map(([degree, depts]) => ({
        degree,
        departments: Array.from(depts.entries()).map(([department, sections]) => ({
            department,
            sections: Array.from(sections.entries()).map(([section, semesters]) => ({
                section: section || null,
                semesters: Array.from(semesters.entries())
                    .sort((a, b) => numeric(a[0], b[0]))
                    .map(([semester, courses]) => ({ semester, courses })),
            })),
        })),
    }))
}

// Everything that is not in the degree tree, which is what the batch tree is
// built from. Note this deliberately ignores batchPlacements: a placement course
// now HAS a path, but it is still not a degree placement, and the batch tree is
// where it belongs. Courses that land nowhere at all are picked out by
// `looseCourses` below, once the batch tree is known.
export const unplacedCourses = (groups: CourseGroup[]): CourseGroup[] =>
    groups.filter((g) => g.placements.length === 0)

// ─── Batch hierarchy (Placement Training and the other non-degree flows) ──────
//
// These mappings have no degree tree. Their structure is Batch → Phase, held in
// `batchConfigs`, and each course now names the batch (and phase) it belongs to
// through its path. The one-setup-per-course rule is unchanged: a course under
// two phases is still ONE setup, and every row for it opens that same setup.
export type PhaseNode = { phase: string | null; courses: CourseGroup[] }
export type BatchNode = { batch: string; phases: PhaseNode[] }

type RawBatchConfig = { name?: string; phases?: string[] }

// Names are user-typed free text and a saved path preserves whatever casing and
// padding was in the wizard, so node matching normalises both sides rather than
// trusting them to be byte-identical.
const norm = (s: string | null | undefined) => (s || '').trim().toLowerCase()

export const buildBatchTree = (
    batchConfigs: RawBatchConfig[] | undefined,
    groups: CourseGroup[],
    // The oldest mappings predate `batchConfigs` and keep their batch names in
    // masterData under level 'Batch'. The wizard already falls back to exactly
    // that when it loads one; without the same fallback here their courses render
    // with no batch structure at all, under a heading saying they are tied to
    // nothing — which misdescribes them.
    fallbackBatchNames?: string[]
): BatchNode[] => {
    // BACKWARD COMPATIBILITY, and the highest-risk decision in this file.
    // Mappings saved before courses carried batch paths have placement courses
    // with no path at all. Filtering those by batch would match nothing and every
    // existing placement mapping would render as empty. So the fallback is decided
    // ONCE PER MAPPING, not per course: if no course here names a batch, the whole
    // mapping is treated as legacy and keeps the old show-everywhere behaviour.
    // Per-course would be wrong — in a mapping that has been re-saved, a course
    // the user deliberately left off every batch would silently reappear under all
    // of them, which is indistinguishable from legacy data at the course level.
    const isLegacy = !groups.some((g) => g.batchPlacements.length)

    const named = (batchConfigs || []).filter((b) => (b?.name || '').trim())
    const configs: RawBatchConfig[] = named.length
        ? named
        : (fallbackBatchNames || [])
            .filter((n) => (n || '').trim())
            .map((name) => ({ name }))

    return configs
        .map((b) => {
            const batch = String(b.name).trim()
            const phases = (b.phases || []).map((p) => String(p).trim()).filter(Boolean)
            const inBatch = isLegacy
                ? groups
                : groups.filter((g) => g.batchPlacements.some((p) => norm(p.batch) === norm(batch)))

            const coursesIn = (phase: string | null) => {
                if (isLegacy) return groups
                return inBatch.filter((g) =>
                    g.batchPlacements.some((p) => {
                        if (norm(p.batch) !== norm(batch)) return false
                        // A course saved against the batch alone, in a batch that
                        // now runs in phases, means phases were switched on after
                        // the course was entered. Showing it in every phase keeps
                        // it reachable; dropping it would hide a real course.
                        if (p.phase === null || phase === null) return true
                        return norm(p.phase) === norm(phase)
                    })
                )
            }

            return {
                batch,
                // A batch that doesn't run in phases gets a single null phase, so
                // the renderer has one shape to walk instead of two.
                phases: phases.length
                    ? phases.map((phase) => ({ phase, courses: coursesIn(phase) }))
                    : [{ phase: null, courses: coursesIn(null) }],
            }
        })
}

// ─── Phase-first hierarchy (the NEW Placement Training shape) ─────────────────
//
// Placement Training no longer nests phases inside batches. Its shape is now
// Phase → one course → that course's own batches: each phase carries EXACTLY ONE
// course, saved with the phase name as a 1-part path, and the batches live on
// the course itself (`batchesEnabled`/`batches` on MappedCourse — the same
// per-course batches the degree flow uses). Zero phases collapses to one
// pathless course with its batches. There is nothing batch-level left, so these
// mappings save `batchConfigs: []`.
//
// DETECTION PREDICATE (quoted from the shape contract): a mapping is phase-first
// only when batchConfigs is EMPTY AND (masterData carries Phase values OR some
// course carries its own batches with a <=1-part path). Any named batchConfig
// means the OLD batch-first placement shape, which keeps buildBatchTree above —
// that includes old mappings whose 1-part paths are BATCH names, which is why
// the 1-part path alone can never decide the shape.
export type PhaseFirstNode = { phase: string | null; course: CourseGroup; batches: string[] }

export const buildPhaseTree = (
    mapping: ServiceMapping | null,
    groups: CourseGroup[]
): PhaseFirstNode[] => {
    if (!mapping) return []
    // A named batchConfig is the old shape's signature; its presence ends the
    // question here regardless of what the paths look like.
    if ((mapping.batchConfigs || []).some((b) => (b?.name || '').trim())) return []

    const courses = mapping.courses || []
    const parts = (path: string | undefined) =>
        (path || '').split(PATH_SEP).map((p) => p.trim()).filter(Boolean)
    const ownBatches = (c: MappedCourse) =>
        (c.batches || []).map((b) => String(b).trim()).filter(Boolean)

    // The mapping-level phase list comes from masterData, not from the paths:
    // it is what fixes the phase ORDER. A phase whose course cannot be resolved
    // is dropped from the tree — there is nothing to set up under it.
    const phaseNames = (mapping.masterData || [])
        .filter((m) => m.level === 'Phase' && !m.group)
        .flatMap((m) => m.values || [])
        .map((v) => String(v).trim())
        .filter(Boolean)

    // Second half of the predicate: with no Phase values, only a course that
    // carries its OWN batches under a <=1-part path marks the new shape. A
    // pathless course withOUT batches is the pre-batchConfigs legacy shape and
    // must stay with the batch tree's fallback rendering.
    const newShapeCourse = courses.some(
        (c) => parts(c.path).length <= 1 && ownBatches(c).length > 0
    )
    if (!phaseNames.length && !newShapeCourse) return []

    const groupFor = (name: string | undefined) =>
        groups.find((g) => g.key === norm(name)) || null

    if (!phaseNames.length) {
        // No Phase master data, so the paths themselves have to carry the shape:
        // a batch-carrying course under a 1-part path names its phase (Phase
        // master data lost or never written), and a pathless one is the
        // zero-phase single course. First record per phase wins, the same
        // tie-break the phase-list branch below applies.
        const seen = new Set<string>()
        const nodes: PhaseFirstNode[] = []
        courses.forEach((c) => {
            const p = parts(c.path)
            if (p.length > 1 || !ownBatches(c).length) return
            const key = norm(p[0] || '')
            if (seen.has(key)) return
            const course = groupFor(c.courseName)
            if (!course) return
            seen.add(key)
            nodes.push({ phase: p[0] || null, course, batches: ownBatches(c) })
        })
        return nodes
    }

    return phaseNames
        .map((phase): PhaseFirstNode | null => {
            // One course per phase by construction; if the data disagrees the
            // FIRST record under the phase's path wins, matching how the wizard
            // translates legacy mappings.
            const entry = courses.find((c) => {
                const p = parts(c.path)
                return p.length === 1 && norm(p[0]) === norm(phase)
            })
            const course = groupFor(entry?.courseName)
            if (!entry || !course) return null
            return { phase, course, batches: ownBatches(entry) }
        })
        .filter((n): n is PhaseFirstNode => n !== null)
}

// Courses that landed in no hierarchy at all: not in a semester, and not in any
// node the batch tree actually rendered. Derived from the built tree rather than
// from the placements, so it stays correct in the legacy case above (where a
// pathless course IS rendered, under every batch) without repeating that rule.
export const looseCourses = (groups: CourseGroup[], batches: BatchNode[]): CourseGroup[] => {
    const shown = new Set<string>()
    batches.forEach((b) => b.phases.forEach((p) => p.courses.forEach((c) => shown.add(c.key))))
    return groups.filter((g) => g.placements.length === 0 && !shown.has(g.key))
}

// Where a course runs, described for whichever hierarchy the mapping uses. Used
// by the flat table view, which has one "Runs In" cell for both shapes.
export const runsInLabel = (
    course: CourseGroup,
    batches: BatchNode[],
    // Present only for phase-first mappings; empty otherwise, so the older
    // branches below keep deciding for every other shape.
    phaseNodes: PhaseFirstNode[] = []
): string => {
    if (course.placements.length) return course.placements.map(placementLabel).join(', ')
    // Phase-first: the course runs in its phase(s). This must come before the
    // batchPlacements branch — a 1-part phase path also parses as a batch
    // placement, and reporting the phase name as a batch would mislabel it.
    // The zero-phase mapping has no phase to name, so its course reports the
    // batches it actually carries.
    const inPhases = phaseNodes.filter((n) => n.course.key === course.key)
    if (inPhases.length) {
        return inPhases
            .map((n) => n.phase ?? (n.batches.length ? n.batches.join(', ') : 'All batches'))
            .join(', ')
    }
    // A course that names its own batches reports those and only those. Listing
    // every batch on the mapping would be a lie now that courses are owned by one.
    if (course.batchPlacements.length) {
        return course.batchPlacements.map(batchPlacementLabel).join(', ')
    }
    // No path of any kind: legacy placement data, which really does run in every
    // batch on the mapping, so naming them all is accurate here.
    if (batches.length) {
        return batches
            .map((b) => {
                const named = b.phases.map((p) => p.phase).filter(Boolean) as string[]
                return named.length ? `${b.batch} (${named.join(', ')})` : b.batch
            })
            .join(', ')
    }
    return 'Not tied to a batch or semester'
}
