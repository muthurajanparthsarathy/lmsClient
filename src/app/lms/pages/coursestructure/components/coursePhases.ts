// Does THIS course run in phases, and if so which ones?
// ─────────────────────────────────────────────────────────────────────────────
// Phases are configured once, in the Service Mapping wizard, and only for the
// flows that use them (Placement Training). Every screen that wants to offer a
// Phase choice asks here rather than deciding for itself, so Course Structure
// and Program Calendar can never disagree about whether a course is phased.
//
// The answer is NO unless all of these hold:
//   1. the mapping carries a phase configuration for THIS course,
//   2. phase configuration is enabled on it, and
//   3. at least one phase is actually configured.
//
// (1) is what keeps the dropdown honest: a mapping can be phased while holding
// other courses that are not, and those must not inherit its phase list just
// for sharing a mapping. Matching is by course NAME against the configuration.
//
// A course is set up ONCE and runs in every phase configured for it — the phase
// is a scope inside Course Structure and the Program Calendar, not a reason to
// set the course up again. So every configured phase is offered; none is ever
// disabled for want of a record of its own.
//
// IDENTITY IS THE NAME, NEVER THE _id. For a mapping saved before course
// configurations existed the server derives them on read
// (courseConfigurationsFromLegacy), minting a fresh ObjectId for every phase on
// EVERY request — so a stored phase _id would point at nothing by the next
// page load. The phase NAME is the only durable handle.

import type { ServiceMapping } from '@/app/lms/pages/servicemapping/api/serviceMappingService'
import { PATH_SEP } from './mappingTree'

const norm = (v: unknown) => String(v ?? '').trim().toLowerCase()

/** The fields of a Course Management record this module needs. Deliberately
 *  structural: the three screens type their courses differently, and all three
 *  carry these. */
export interface PhaseCourseRef {
    _id: string
    courseName?: string
    mappingId?: string
    /** Where the course sits in its mapping. For a phased course this is the
     *  phase name on its own; for a degree course a " ▸ "-joined path. */
    coursePath?: string
}

export interface PhaseOption {
    /** The configured phase name, exactly as saved — never a generated label. */
    name: string
    /**
     * The course record to work on for this phase.
     *
     * A course is set up ONCE and runs in all of its phases, so this is normally
     * the record already open — the phase is a scope within it, not a different
     * course. Mappings saved under the older model DID keep a record per phase
     * (the phase name in `coursePath`); where such a record exists it is used,
     * so those keep working. Never null: every configured phase is selectable.
     */
    courseId: string
}

/** A course record's phase is a one-part path. A multi-part path is a degree
 *  placement ("B.E ▸ CSE ▸ A ▸ 3"), which is not a phase. */
const phaseOfPath = (path: string | undefined): string => {
    const parts = (path || '').split(PATH_SEP).map((p) => p.trim()).filter(Boolean)
    return parts.length === 1 ? parts[0] : ''
}

/**
 * The phases configured for `courseName`, in the order they were configured.
 * Empty when the course is not phased — which is the signal to render nothing.
 */
export const configuredPhaseNames = (
    mapping: ServiceMapping | null | undefined,
    courseName: string | null | undefined,
): string[] => {
    if (!mapping) return []
    const wanted = norm(courseName)

    // The authoritative shape. `phaseConfigEnabled` is the user's own checkbox,
    // and `phases` is what they filled in under it — both must agree, so a
    // configuration that was switched off keeps its phases without offering
    // them.
    const config = (mapping.courseConfigurations || []).find(
        (c) => wanted && norm(c.courseName) === wanted,
    )
    if (config) {
        if (!config.phaseConfigEnabled) return []
        return [...(config.phases || [])]
            .map((p, i) => ({ name: String(p?.name ?? '').trim(), order: p?.order ?? i }))
            .filter((p) => p.name)
            .sort((a, b) => a.order - b.order)
            .map((p) => p.name)
    }

    // No configuration names this course. That is not proof it is unphased:
    // `courseConfigurations` is derived on read only by the detail endpoint, so
    // a mapping reached through a list arrives without it. Fall back to the
    // legacy mirror the wizard still writes beside it.
    const configured = (mapping.masterData || [])
        .filter((m) => norm(m.level) === 'phase')
        .flatMap((m) => m.values || [])
        .map((v) => String(v ?? '').trim())
        .filter(Boolean)
    if (!configured.length) return []

    // …but only for a course that is actually part of that structure. A phased
    // mapping can hold courses outside every phase, and they must not inherit
    // the mapping's phase list just for sharing a mapping with a phased course.
    const inPhase = configured.map(norm)
    const courses = mapping.courses || []
    const belongs =
        // The current model: the record keeps the course's own name and puts
        // the phase in its path.
        courses.some((c) => norm(c.courseName) === wanted && inPhase.includes(norm(phaseOfPath(c.path)))) ||
        // The older one: the record is NAMED for its phase, so the course under
        // consideration is itself a phase.
        (inPhase.includes(wanted) && courses.some((c) => norm(phaseOfPath(c.path)) === wanted))
    return belongs ? configured : []
}

/**
 * The Phase options to offer for the course currently on screen.
 *
 * Returns an empty array whenever no Phase control should be rendered at all,
 * which is every course that does not run in phases.
 *
 * @param allCourses every Course Management record the caller already has.
 *        Both screens load the full list for their own reasons, so resolving
 *        older per-phase records here costs no extra request.
 */
export const phaseOptionsFor = (
    mapping: ServiceMapping | null | undefined,
    allCourses: PhaseCourseRef[] | undefined,
    course: PhaseCourseRef | null | undefined,
): PhaseOption[] => {
    if (!course) return []

    const names = configuredPhaseNames(mapping, course.courseName)
    if (!names.length) return []

    // Older mappings kept a SEPARATE course record per phase, with the phase
    // name in `coursePath`. Those are still honoured — selecting such a phase
    // opens its own record — but a course set up once for all of its phases has
    // no siblings, and then every phase resolves to the record already open.
    // Scoped by mapping rather than by name because that older model named each
    // record after its phase; same name still wins the tie at a shared path.
    const mappingId = norm(course.mappingId)
    const siblings = (allCourses || []).filter(
        (c) => mappingId && norm(c.mappingId) === mappingId && c._id !== course._id,
    )
    const recordFor = (phase: string): string => {
        const atPath = siblings.filter((c) => norm(phaseOfPath(c.coursePath)) === norm(phase))
        const sameName = atPath.find((c) => norm(c.courseName) === norm(course.courseName))
        return (sameName || atPath[0])?._id || course._id
    }

    const here = norm(phaseOfPath(course.coursePath))
    return names.map((name) => ({
        name,
        // The record already open is authoritative for its own phase — the list
        // it came from may be stale or scoped away from it.
        courseId: norm(name) === here ? course._id : recordFor(name),
    }))
}
