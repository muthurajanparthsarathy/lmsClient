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
    | { name: 'hierarchy'; mapping: ServiceMapping }
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
    // A ref so the deep-link effect only opens each id ONCE. Without it, the
    // Back button needs two clicks: setStage('list') runs, but router.replace
    // hasn't cleared ?openMappingId from the URL yet, so on the next render
    // the effect sees wantsDeepLink=true again and re-opens the hierarchy.
    // Resetting the ref inside onBack lets a genuine re-visit still work.
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
        const byKey = new Map<string, { id: string; moduleCount: number; participantCount: number; courseCode: string; hasModuleHours: boolean }>()
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
                courseCode: String(c.courseCode || ''),
                // Program Calendar's gate: the server sets this only when the
                // course has ≥1 module AND pedagogy hours to plan from.
                hasModuleHours: Boolean(c.hasModuleHours),
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

    return (
        <DashboardLayout>
            {/* No page-canvas background at all: the shell's white workspace
                panel is the ground. flex flex-col lets the list stage's own
                flex-1 chain propagate down to the table, so pagination lands
                at the true viewport bottom instead of leaving an empty band. */}
            <div className="h-full min-h-0 flex flex-col">
                <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                        key={stage.name}
                        initial={{ opacity: 0, x: dir * 16 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: dir * -16 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="flex flex-1 min-h-0 flex-col"
                    >
                        {stage.name === 'list' && (
                            // Self-fetching: the list owns its own search,
                            // filters, sort and page, and those ARE the request
                            // now, so the query lives with the state that
                            // decides it rather than being threaded down.
                            <MappingList
                                // The stage lives in React state, so without the
                                // URL carrying it, leaving for another page (an
                                // Actions destination) and coming Back reloads
                                // this page at its initial state — the clients
                                // list — dumping the user out of the hierarchy
                                // they were in. Mirroring the mapping into
                                // ?openMappingId makes Back land where they left:
                                // the deep-link effect above reopens it.
                                onOpen={(mapping) => {
                                    setStage({ name: 'hierarchy', mapping })
                                    router.replace(`/lms/pages/coursestructure?openMappingId=${mapping._id}`)
                                }}
                            />
                        )}

                        {stage.name === 'hierarchy' && (
                            <HierarchyPicker
                                mapping={stage.mapping}
                                statusFor={(courseName, coursePath) => courseStatusFor(clientIdOf(stage.mapping), stage.mapping._id, courseName, coursePath)}
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
                                mapping={stage.mapping}
                                course={stage.course}
                                existingCourseId={stage.courseId
                                    || sessionIds[sessionKeyFor(clientIdOf(stage.mapping), stage.mapping._id, stage.course.courseName, stage.course.path)]
                                    || courseStatusFor(clientIdOf(stage.mapping), stage.mapping._id, stage.course.courseName, stage.course.path)?.id
                                    || null}
                                existingCourseIds={existingCourseIds}
                                readOnly={stage.readOnly}
                                onBack={() => setStage({ name: 'hierarchy', mapping: stage.mapping })}
                                // From the READ-ONLY FORM (the hierarchy's View
                                // action), Edit reopens the same course editable.
                                // The student-facing preview stage below has its
                                // own separate Edit.
                                onEdit={() => setStage({ ...stage, readOnly: false })}
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
