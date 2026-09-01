"use client"

// ─────────────────────────────────────────────────────────────────────────────
// Course Setup — three stages over the service mappings:
//
//   1. Clients   — one row per mapped service, with a Manage Course action
//   2. Hierarchy — the degree/department/section/semester tree the Map Service
//                  wizard built, and the courses already chosen inside it
//   3. Setup     — the course's own details (description, image, level, I Do /
//                  We Do / You Do, resources), with the course code generated
//
// Courses are NOT chosen here. The category and course name come from the
// mapping; this module only decides which of them is being configured.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo, useRef, useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import DashboardLayout from '../../component/layout'
import { useServiceMapping, serviceMappingKeys, type ServiceMapping } from '@/apiServices/serviceMappingService'
import { fetchCourseStructuresSummary } from '@/apiServices/createCourseStucture'
import MappingList from './components/MappingList'
import HierarchyPicker from './components/HierarchyPicker'
import CourseSetupPanel from './components/CourseSetupPanel'
import CoursePreview from './components/CoursePreview'
import { type CourseGroup } from './components/mappingTree'

type Stage =
    | { name: 'list' }
    // `openActionsForCourseId` reopens one course's Course Actions modal on
    // arrival — set when this stage is entered by backing out of that course's
    // setup panel, so Back / Close return to the modal they came from.
    | { name: 'hierarchy'; mapping: ServiceMapping; openActionsForCourseId?: string | null }
    // `courseId` pins the record when the stage is entered straight after a
    // save: the invalidated query has not refetched yet, so the id cannot be
    // looked up from the (stale) record list at that moment.
    | { name: 'setup'; mapping: ServiceMapping; course: CourseGroup; readOnly?: boolean; courseId?: string }
    // The student-facing presentation of a just-saved course. Unlike setup's
    // optional pin, the id is required here: the preview fetches the SAVED
    // record, and without an id there is nothing to fetch.
    | { name: 'preview'; mapping: ServiceMapping; course: CourseGroup; courseId: string }

export default function CourseStructurePage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const queryClient = useQueryClient()
    const [stage, setStage] = useState<Stage>({ name: 'list' })
    // Bumped when the setup panel leaves edit mode, to remount it. Cancel Edit
    // has to drop whatever was typed and not saved, and the panel seeds its
    // form from the record once on mount — so a fresh mount is the reset. Only
    // this direction remounts: entering edit mode has nothing to throw away and
    // should not flash the loading skeleton.
    const [setupResetKey, setSetupResetKey] = useState(0)

    // Which page of the client list to come back to.
    //
    // MappingList is unmounted while a mapping is open (the stages swap under
    // one AnimatePresence), so it cannot remember this itself — every
    // "Manage → Back to clients" used to drop the user back on page 1 however
    // far into the list they had drilled. This component stays mounted for the
    // whole visit, so it can hand the page back.
    //
    // Scoped to the visit ON PURPOSE. A reload, or arriving from another page,
    // remounts this component and starts at 1 — which is what a refresh is
    // expected to do. Keeping it in the URL or at module scope would survive
    // both, and the stale number could not even be trusted on a cold load:
    // pageSize is fitted to the viewport AFTER first paint, so the restored
    // page could land out of range and get clamped to something arbitrary.
    const [listPage, setListPage] = useState(1)

    // Deep-link: arriving with ?openMappingId=<id> (e.g. from the User Enrolment
    // breadcrumb) opens that mapping's hierarchy directly instead of the client
    // list. It used to look the id up in the full mapping list this page held;
    // with the list paginated the mapping is usually NOT on the page that
    // happens to be loaded, so the one record is fetched by id instead.
    //
    // Only while still on the list stage: the query is disabled the moment a
    // mapping is open, so drilling in (which writes the id into the URL) never
    // costs a request, and the effect can never yank the user back out of a
    // hierarchy they navigated to.
    const openMappingId = searchParams.get('openMappingId')
    const wantsDeepLink = Boolean(openMappingId) && stage.name === 'list'
    const { data: deepLinkMapping } = useServiceMapping(
        wantsDeepLink ? (openMappingId as string) : undefined
    )
    // The id whose hierarchy is already open, so the effect below opens each
    // one ONCE.
    //
    // Without it, Back needs two clicks: setStage('list') commits before
    // router.replace has cleared ?openMappingId, so for one render the effect
    // sees wantsDeepLink=true and re-opens the hierarchy it was just asked to
    // leave — the URL goes clean while the screen stays on the mapping.
    //
    // It must be armed on BOTH ways in. The effect sets it for a genuine
    // deep-link; onOpen sets it when the user clicks Manage, which is the case
    // that was missing. On that path the effect never runs (stage is already
    // 'hierarchy', so the query is disabled and deepLinkMapping stays
    // undefined), so the ref stayed null and the guard was inert — which is
    // why Back misbehaved only after clicking Manage, and only when the detail
    // query could resolve inside that one-render window.
    const openedDeepLinkRef = useRef<string | null>(null)
    useEffect(() => {
        if (!wantsDeepLink || !deepLinkMapping) return
        if (deepLinkMapping._id !== openMappingId) return
        if (openedDeepLinkRef.current === openMappingId) return
        openedDeepLinkRef.current = openMappingId
        setStage({ name: 'hierarchy', mapping: deepLinkMapping })
    }, [openMappingId, deepLinkMapping, wantsDeepLink])

    // Every existing course-structure record, used to answer "does this course
    // already have a setup?" and to keep generated course codes unique. The
    // ?summary=1 projection carries exactly the fields this page reads (ids,
    // codes, mapping placement, counts) — a fraction of the full deep-populated
    // payload. Shares the 'courseStructures' root so this page's save
    // invalidation (below) and other pages' course mutations refresh it too.
    // Still fetched on the list stage even though the list no longer reads it:
    // the hierarchy and setup stages do, and it is what gates their Program
    // Calendar / Course Structure actions. This is NOT a list and must not be
    // paginated — it is a lookup keyed by course.
    const { data: coursesRes } = useQuery({
        queryKey: ['courseStructures', 'summary'],
        queryFn: fetchCourseStructuresSummary,
        staleTime: 30_000,
        // Always re-ask on mount: structure and pedagogy hours are edited on
        // OTHER pages (pedagogy2) that don't invalidate this cache, and a
        // stale list here leaves gated actions (Program Calendar) wrongly
        // disabled after the user just earned them.
        refetchOnMount: 'always',
    })

    const courseRecords: Array<Record<string, unknown>> = useMemo(() => {
        const raw = coursesRes as { data?: unknown } | undefined
        const list = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : []
        return list as Array<Record<string, unknown>>
    }, [coursesRes])

    // A setup is matched on client + mapping + course name: the same course name
    // mapped under a different service is a genuinely different course, so it
    // must not inherit another mapping's setup. Records saved before mappingId
    // existed carry none, and they keep the old client + name identity — without
    // that fallback every pre-existing setup would flip to "not set up" the
    // moment this shipped.
    //
    // `moduleCount` is how many Module1 docs the course has, and it is what
    // separates "set up" from "structured": a course with a setup but no modules
    // has nothing for the Program Calendar to schedule.
    const courseStatusFor = useMemo(() => {
        const byKey = new Map<string, { id: string; moduleCount: number; participantCount: number; exerciseCount: number; courseCode: string; hasModuleHours: boolean; hasProgramCalendar: boolean }>()
        courseRecords.forEach((c) => {
            const name = String(c.courseName || '').trim().toLowerCase()
            const client = String(c.clientId || '').trim()
            const recordMappingId = String(c.mappingId || '').trim()
            const recordPath = String(c.coursePath || '').trim().toLowerCase()
            const id = String(c._id || c.id || '')
            if (!name || !id) return
            const entry = {
                id,
                moduleCount: Number(c.moduleCount) || 0,
                // Enrolled-user count from the server. The Program Calendar
                // ungates on EITHER this or moduleCount, so a course full of
                // auto-enrolled students can be scheduled before its structure
                // is built.
                participantCount: Number(c.participantCount) || 0,
                exerciseCount: Number(c.exerciseCount) || 0,
                courseCode: String(c.courseCode || ''),
                // Program Calendar's gate: the server sets this only when the
                // course has ≥1 module AND pedagogy hours to plan from.
                hasModuleHours: Boolean(c.hasModuleHours),
                hasProgramCalendar: Boolean(c.hasProgramCalendar),
            }
            if (recordMappingId && recordPath) {
                byKey.set(`${client}::${recordMappingId}::${recordPath}::${name}`, entry)
                return
            }
            // Records from before courses were identified by place. They are
            // indexed under the pathless keys ONLY — a record that HAS a path
            // must never answer for a different place, which is the whole bug.
            // The consequence is deliberate: the first time such a record is
            // edited it gains a path and stops matching the other placements,
            // which then correctly read as "Not set up" and get their own
            // setups. Same adoption rule the mappingId fix already uses.
            byKey.set(recordMappingId ? `${client}::${recordMappingId}::${name}` : `${client}::${name}`, entry)
        })
        return (clientId: string, mappingId: string, courseName: string, coursePath = '') => {
            const name = courseName.trim().toLowerCase()
            const path = coursePath.trim().toLowerCase()
            return (
                (path ? byKey.get(`${clientId}::${mappingId}::${path}::${name}`) : undefined) ||
                byKey.get(`${clientId}::${mappingId}::${name}`) ||
                byKey.get(`${clientId}::${name}`) ||
                null
            )
        }
    }, [courseRecords])

    // Codes saved this session, before the invalidated query has refetched.
    // Without them, setting up two courses back to back generates the same code
    // twice — the second panel mounts against the stale record list, and the
    // server then rejects the duplicate with nothing useful on screen.
    const [sessionCodes, setSessionCodes] = useState<string[]>([])
    // Same staleness problem, other direction: a course created this session is
    // not in the record list until the refetch lands, so reopening it straight
    // away would look like "not set up" and a second save would CREATE A SECOND
    // RECORD under a fresh code. Keyed exactly like courseStatusFor's index.
    const [sessionIds, setSessionIds] = useState<Record<string, string>>({})
    const sessionKeyFor = (clientId: string, mappingId: string, courseName: string, coursePath = '') =>
        `${clientId}::${mappingId}::${coursePath.trim().toLowerCase()}::${courseName.trim().toLowerCase()}`
    const existingCourseIds = useMemo(
        () => new Set([
            ...courseRecords.map((c) => String(c.courseCode || '')).filter(Boolean),
            ...sessionCodes,
        ]),
        [courseRecords, sessionCodes]
    )

    const clientIdOf = (m: ServiceMapping) =>
        typeof m.client === 'string' ? m.client : m.client?._id || ''

    // The Configured tile's count and each row's configured/total used to be
    // computed here, by walking EVERY mapping against the course-structure
    // records. Both are whole-set numbers that one page of mappings cannot
    // produce, so they moved to the server (getSetupProgress) and now arrive
    // with the page — as `stats` for the tiles and `setupProgress` per row.
    // `courseStatusFor` above stays: the hierarchy and setup stages still ask
    // it about the ONE mapping that is open.

    // Forward into a stage slides one way, back the other, so the two read as
    // different moves rather than the same animation twice.
    const dir = stage.name === 'list' ? -1 : 1

    // The course record the setup stage is working on. Needed twice — as the
    // panel's existingCourseId, and as the row whose Course Actions modal
    // reopens when the user backs out of the panel — so it is resolved once
    // here rather than spelled out again inside the handler.
    const setupCourseId = stage.name !== 'setup' ? null : (
        stage.courseId
        || sessionIds[sessionKeyFor(clientIdOf(stage.mapping), stage.mapping._id, stage.course.courseName, stage.course.path)]
        || courseStatusFor(clientIdOf(stage.mapping), stage.mapping._id, stage.course.courseName, stage.course.path)?.id
        || null
    )

    return (
        <DashboardLayout>
            {/* No page-canvas background at all: the shell's white workspace
                panel is the ground. flex flex-col lets the list stage's own
                flex-1 chain propagate down to the table, so pagination lands
                at the true viewport bottom instead of leaving an empty band. */}
            <div className="h-full min-h-0 flex flex-col">
                {/* Stage transition: fade only, no horizontal slide.
                    Previously used `x: dir * 16 → 0 → dir * -16` with
                    mode="wait", so opening a heavy destination like
                    Course setup showed the old panel sliding left, then
                    the new panel sliding in from the right (~400ms of
                    horizontal shuffle) which read as jank (2026-08-30
                    user report — "first in center then going left").
                    Fade-only keeps a subtle transition without moving
                    layout, so nothing looks like it's flying. `dir` is
                    still computed above so the old slide can be
                    restored with one line if the fade feels too flat. */}
                <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                        key={stage.name}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="flex flex-1 min-h-0 flex-col"
                    >
                        {stage.name === 'list' && (
                            // Self-fetching: the list owns its own search,
                            // filters, sort and page, and those ARE the request
                            // now, so the query lives with the state that
                            // decides it rather than being threaded down. The
                            // page is the one exception — it is handed in and
                            // reported back, because it has to outlive this
                            // component being unmounted (see listPage above).
                            <MappingList
                                initialPage={listPage}
                                onPageChange={setListPage}
                                // The stage lives in React state, so without the
                                // URL carrying it, leaving for another page (an
                                // Actions destination) and coming Back reloads
                                // this page at its initial state — the clients
                                // list — dumping the user out of the hierarchy
                                // they were in. Mirroring the mapping into
                                // ?openMappingId makes Back land where they left:
                                // the deep-link effect above reopens it.
                                onOpen={(mapping) => {
                                    // Arms the guard above: this id is now open,
                                    // so the deep-link effect must not re-open it
                                    // during the render where Back has cleared the
                                    // stage but not yet the URL.
                                    openedDeepLinkRef.current = mapping._id
                                    setStage({ name: 'hierarchy', mapping })
                                    router.replace(`/lms/pages/coursestructure?openMappingId=${mapping._id}`)
                                }}
                            />
                        )}

                        {stage.name === 'hierarchy' && (
                            <HierarchyPicker
                                mapping={stage.mapping}
                                statusFor={(courseName, coursePath) => courseStatusFor(clientIdOf(stage.mapping), stage.mapping._id, courseName, coursePath)}
                                openActionsForCourseId={stage.openActionsForCourseId}
                                // Clear the deep-link param too — left in the URL
                                // it would re-open this hierarchy the moment the
                                // list mounts, making Back to clients a no-op.
                                onBack={() => {
                                    // Do NOT clear openedDeepLinkRef here — the
                                    // URL hasn't dropped ?openMappingId yet, so
                                    // the very next render would see the ref
                                    // cleared and re-open the hierarchy (which
                                    // is exactly the "back doesn't work" bug
                                    // the user reported). The ref stays set for
                                    // this component's lifetime; a genuine
                                    // re-visit from another page remounts the
                                    // component and gets a fresh ref, so this
                                    // doesn't break the deep-link on re-entry.
                                    setStage({ name: 'list' })
                                    router.replace('/lms/pages/coursestructure')
                                }}
                                onSetup={(course) => setStage({ name: 'setup', mapping: stage.mapping, course })}
                                onView={(course) => setStage({ name: 'setup', mapping: stage.mapping, course, readOnly: true })}
                                // Both pages key off the COURSE STRUCTURE record's
                                // id, not the mapping's — sending the wrong one
                                // lands on a page with nothing to show.
                                onProgramCalendar={(courseId) =>
                                    router.push(`/lms/pages/coursestructure/programcalendar?courseId=${encodeURIComponent(courseId)}`)}
                                onCourseStructure={(courseId) =>
                                    router.push(`/lms/pages/coursestructure/pedagogy2?courseId=${encodeURIComponent(courseId)}`)}
                                // The batch-aware Resources screen. It reads the
                                // course's Resources-by-batch config and, when an
                                // element is batch-wise, files uploads under the
                                // batch picked in its strip.
                                onCourseResources={(courseId) =>
                                    router.push(`/lms/pages/coursestructure/uploadcourseresources?courseId=${encodeURIComponent(courseId)}`)}
                                onCourseEnrollment={(courseId) =>
                                    router.push(`/lms/pages/coursestructure/course-participants?courseId=${encodeURIComponent(courseId)}`)}
                            />
                        )}

                        {stage.name === 'setup' && (
                            <CourseSetupPanel
                                key={`setup-${setupResetKey}`}
                                mapping={stage.mapping}
                                course={stage.course}
                                existingCourseId={setupCourseId}
                                existingCourseIds={existingCourseIds}
                                readOnly={stage.readOnly}
                                // Back to Course Action / Close / Cancel all land
                                // on the modal this panel was opened from, not on
                                // the bare tree behind it.
                                onBack={() => setStage({ name: 'hierarchy', mapping: stage.mapping, openActionsForCourseId: setupCourseId })}
                                // From the READ-ONLY FORM (the hierarchy's View
                                // action), Edit reopens the same course editable.
                                // The student-facing preview stage below has its
                                // own separate Edit.
                                onEdit={() => setStage({ ...stage, readOnly: false })}
                                // Back to the read-only face, reading the saved
                                // record again — see setupResetKey above.
                                onCancelEdit={() => {
                                    setStage({ ...stage, readOnly: true })
                                    setSetupResetKey((k) => k + 1)
                                }}
                                onSaved={(courseId, courseCode, action) => {
                                    if (courseCode) setSessionCodes((prev) => [...prev, courseCode])
                                    if (courseId) {
                                        const key = sessionKeyFor(clientIdOf(stage.mapping), stage.mapping._id, stage.course.courseName, stage.course.path)
                                        setSessionIds((prev) => ({ ...prev, [key]: courseId }))
                                    }
                                    // Refetch so the row flips to Configured and its
                                    // follow-on actions appear without a reload — on
                                    // BOTH paths, so the hierarchy behind the preview
                                    // is already right when the user closes it.
                                    queryClient.invalidateQueries({ queryKey: ['courseStructures'] })
                                    // And the list, because the row's progress is
                                    // now computed SERVER-side from those same
                                    // records: without this the mapping the user
                                    // just configured would still read as it did
                                    // before the save.
                                    queryClient.invalidateQueries({ queryKey: serviceMappingKeys.lists() })
                                    // Save and display = the course as a student
                                    // will see it. The preview fetches by id, so a
                                    // create response that carried no id (nothing
                                    // to fetch) falls back to the hierarchy, where
                                    // the refetch above will surface the record.
                                    if (action === 'display' && courseId) {
                                        setStage({
                                            name: 'preview',
                                            mapping: stage.mapping,
                                            course: stage.course,
                                            courseId,
                                        })
                                    } else {
                                        setStage({ name: 'hierarchy', mapping: stage.mapping })
                                    }
                                }}
                            />
                        )}

                        {stage.name === 'preview' && (
                            <CoursePreview
                                courseId={stage.courseId}
                                fallbackName={stage.course.courseName}
                                // Edit goes to the EDITABLE setup (not the read-only
                                // form): the preview exists to check the student
                                // view, and finding it wrong means changing it. The
                                // pinned id keeps the load working before the
                                // invalidated record list has refetched.
                                onEdit={() => setStage({
                                    name: 'setup',
                                    mapping: stage.mapping,
                                    course: stage.course,
                                    courseId: stage.courseId,
                                })}
                                onClose={() => setStage({ name: 'hierarchy', mapping: stage.mapping })}
                            />
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </DashboardLayout>
    )
}
