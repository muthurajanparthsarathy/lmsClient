// Degree Program student groups on a course — the client mirror of
// server/utils/courseGroups.js. Keep the two in step.
//
// A Degree Program mapping keeps its courses per department + semester
// ("BE ▸ Civil ▸ 1") and, separately, how that department's students are split
// that semester: sections, each optionally split into batches
// (`mapping.studentGroups`). A course runs for every one of those groups:
//
//   Section A: Batch 1, Batch 2   →  "Section A · Batch 1", "Section A · Batch 2"
//   Section B: (no batches)       →  "Section B"
//
// Every other service has no sections, and none of this applies to it.

export const PATH_SEP = ' ▸ '

export type SectionGroup = { section: string; batches: string[] }

/** The slice of a Service Mapping this needs. */
type MappingLike = {
    studentGroups?: { path: string; sections: { name: string; batches: string[] }[] }[]
    masterData?: { level: string; group?: string; values?: string[] }[]
}

const clean = (v: unknown) => String(v ?? '').trim()
const norm = (v: unknown) => clean(v).toLowerCase()
const parts = (path: string | undefined) => clean(path).split(PATH_SEP).map(clean).filter(Boolean)

/** "A" → "Section A"; a name that already says "Section …" is left alone. */
export const sectionLabel = (name: string) => (/^section\s/i.test(clean(name)) ? clean(name) : `Section ${clean(name)}`)

/** Compare section names ignoring case and a leading "Section". */
export const sectionKey = (name: string) => norm(name).replace(/^section\s+/, '')

const uniq = (list: string[]) => {
    const seen = new Set<string>()
    return list.filter((v) => {
        const k = norm(v)
        if (!v || seen.has(k)) return false
        seen.add(k)
        return true
    })
}

/**
 * The sections (and their batches) a degree course runs for.
 *
 *   "BE ▸ Civil ▸ 1"       — the department + semester: every section of it
 *   "BE ▸ Civil ▸ A ▸ 1"   — an older mapping that put the course on one
 *                            section: that section only
 *
 * Anything shorter is not a degree placement and has no sections. Mappings
 * saved before student groups existed name their sections in masterData; those
 * are read as sections without batches.
 */
export function sectionGroupsForCourse(mapping: MappingLike | null | undefined, coursePath: string | undefined): SectionGroup[] {
    const p = parts(coursePath)
    if (!mapping || p.length < 3) return []
    const [degree, department] = p
    const semester = p[p.length - 1]
    const onlySection = p.length >= 4 ? p[2] : null

    const groupPath = [degree, department, semester].join(PATH_SEP)
    const stored = (mapping.studentGroups || []).find((g) => norm(g?.path) === norm(groupPath))

    let sections: SectionGroup[]
    if (stored) {
        sections = (stored.sections || []).map((s) => ({
            section: clean(s?.name),
            batches: uniq((s?.batches || []).map(clean)),
        }))
    } else {
        const entry = (mapping.masterData || []).find(
            (m) => norm(m?.level) === 'section' && norm(m?.group) === norm([degree, department].join(PATH_SEP)),
        )
        sections = uniq((entry?.values || []).map(clean)).map((name) => ({ section: name, batches: [] }))
    }

    const seen = new Set<string>()
    sections = sections.filter((s) => {
        const k = sectionKey(s.section)
        if (!k || seen.has(k)) return false
        seen.add(k)
        return true
    })

    if (onlySection) {
        const hit = sections.find((s) => sectionKey(s.section) === sectionKey(onlySection))
        return [hit || { section: onlySection, batches: [] }]
    }
    return sections
}

/** Every group those sections make, as display names: one per batch, or the
 *  section itself when it has none. */
export const groupLabelsFromSections = (sections: SectionGroup[]): string[] =>
    sections.flatMap((s) => (s.batches.length
        ? s.batches.map((b) => `${sectionLabel(s.section)} · ${b}`)
        : [sectionLabel(s.section)]))

/** A batch entry's display name: "Section A · Batch 1", "Section B", or — for
 *  a batch with no section (every other service) — the batch name itself.
 *  Degree groups are stored under their full name already; that is returned
 *  as it is. */
export const groupLabel = (b: { section?: string; batchName?: string }): string => {
    const section = clean(b?.section)
    const name = clean(b?.batchName)
    if (!section) return name
    const prefix = sectionLabel(section)
    if (!name || norm(name) === norm(prefix)) return prefix
    if (norm(name).startsWith(`${norm(prefix)} · `)) return name
    return `${prefix} · ${name}`
}

/** The batch's own part of a degree group's name — "Batch 1" out of
 *  "Section A · Batch 1", "" for a whole-section group. For a batch with no
 *  section, its name. */
export const groupBatchPart = (b: { section?: string; batchName?: string }): string => {
    const section = clean(b?.section)
    const name = clean(b?.batchName)
    if (!section) return name
    const prefix = sectionLabel(section)
    if (!name || norm(name) === norm(prefix)) return ''
    return norm(name).startsWith(`${norm(prefix)} · `) ? name.slice(prefix.length + 3).trim() : name
}
