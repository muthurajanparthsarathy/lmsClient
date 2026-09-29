"use client"

/* Course Setup ▸ Report.
 *
 * Mirrors the shape of Business Reports (a filter form, then a snapshotted
 * review table on Generate, plus a Print button that opens the shared
 * PrintPreviewModal) but is sourced from course-structure records rather
 * than service mappings. What the reader is looking at is a per-client
 * roll-up of every course that has been set up under the institution.
 *
 * Nothing loads until Generate report is pressed — the dropdowns are a
 * draft, and the table below is a snapshot of the draft at the moment it
 * was generated, so a filter fiddle after the fact cannot silently
 * disagree with the rows on screen. Leaving all filters alone and
 * pressing Generate reports on every course, which is the common case. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useServiceMappings, type ServiceMapping } from '@/app/lms/pages/servicemapping/api/serviceMappingService'
import { motion } from 'framer-motion'
import * as Popover from '@radix-ui/react-popover'
import { BarChart3, ChevronDown, ChevronRight, Info, Loader2, Printer, RotateCcw } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { pageEnter } from '@/app/lms/shared/ui'
import {
    MappingMultiFilter,
    displayLabel,
} from '@/app/lms/pages/servicemapping/components/MappingReportFilters'
import ProvidingYearPicker from '@/app/lms/pages/servicemapping/components/ProvidingYearPicker'
import { businessModelDisplayName } from '@/app/lms/pages/clientmanagement/features/lib'
import { useClients, type Client } from '@/app/lms/pages/clientmanagement/api/clientManagementService'
import { fetchAllCourseStructures } from '@/app/lms/pages/coursestructure/api/createCourseStucture'
import {
    activeFormat, fetchReportSettings, newFormat,
    type ReportFormat, type ReportSettings,
} from '@/app/lms/pages/reportsettings/api/reportSettingsService'
import { BRAND_FALLBACK } from '@/app/lms/pages/reportsettings/api/brand'
import { fetchInstitutionById } from '@/app/lms/pages/instutionmanagement/api/institutionService'
import type { ReportClientBlock } from '@/app/lms/pages/servicemapping/components/serviceReport'
import { PrintPreviewModal, type FieldRow } from '@/app/lms/pages/businessreports/components/PrintPreviewModal'

/* ── Filter draft ─────────────────────────────────────────────────────
 *  Order matches the interface MappingFilters exposes to the Courses
 *  tab (clients / services / models / course / from / to) so the two
 *  pages describe the same universe with the same words. Year has two
 *  modes — a checkbox list of individual years (default, matches how
 *  businessreports lets the reader pick "2024 and 2026") and a from /
 *  to range for spans. A switch above the year filter swaps them. */
type PeriodMode = 'years' | 'range'
type Draft = {
    clients: string[]
    services: string[]
    models: string[]
    /** Course IDs ticked at course-level. Ticking the parent in the
     *  hierarchical picker adds the course id here AND all its batch
     *  ids to `batches`; ticking a specific batch adds only the batch. */
    courses: string[]
    /** Individual batch IDs ticked. A course with no batches only
     *  contributes to `courses`; a course with batches contributes
     *  batch ids here and (when all batches are ticked) its own id
     *  above. */
    batches: string[]
    /** User IDs ticked — narrows the report to courses that include at
     *  least one of these users in any of their batches. */
    users: string[]
    /** Individually ticked years — used when `period === 'years'`. */
    years: string[]
    /** Span bounds — used when `period === 'range'`. */
    from: string
    to: string
    period: PeriodMode
}

const EMPTY: Draft = {
    clients: [], services: [], models: [],
    courses: [], batches: [], users: [], years: [], from: '', to: '',
    /** Default mode is Range — the reader most often reports on a span
     *  of years, and the List mode is a click away via the segmented
     *  control beside the label. */
    period: 'range',
}

/** "active" → "Active". */
const capitalise = (value: string) => value ? value.charAt(0).toUpperCase() + value.slice(1) : value

/** The stored clientAddress carries the three lines the client form
 *  builds — Address Line, City, State - Pincode. This helper reverses
 *  that so the report can offer City / State / Pincode as their own
 *  columns instead of dumping the whole string. Kept in step with the
 *  mirror in businessreports/page.tsx; a shared helper would be nicer,
 *  but neither page owns the client model and the split is tiny. */
type AddressParts = { line: string; city: string; state: string; pincode: string }
function parseClientAddress(raw: string): AddressParts {
    const plain = (raw || '')
        .replace(/<br\s*\/?>(\r?\n)?/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/\r/g, '')
        .trim()
    if (!plain) return { line: '', city: '', state: '', pincode: '' }
    const lines = plain.split(/\n+/).map((s) => s.trim()).filter(Boolean)
    if (lines.length >= 2) {
        const csp = lines[1].match(/^(.+?),\s*(.+?)\s*[-–]\s*(\d[\d\s]*)$/)
        if (csp) {
            const [, city, state, pincode] = csp
            return { line: lines[0], city: city.trim(), state: state.trim(), pincode: pincode.replace(/\s+/g, '') }
        }
    }
    return { line: plain, city: '', state: '', pincode: '' }
}

/* ── Column set the modal renders ─────────────────────────────────────
 *  Order top-to-bottom here is the sidebar's initial order, which the
 *  sheet then reads left-to-right. Client-scope rows rowspan once per
 *  block; service-scope rows render one per course. */
const COURSE_FIELDS: FieldRow[] = [
    // Client scope
    { key: 'clientName', label: 'Client Name', required: true, scope: 'client', column: 'Client', dataKey: 'client' },
    { key: 'clientId', label: 'Client ID', scope: 'client', column: 'Client ID', dataKey: 'clientId' },
    { key: 'businessModel', label: 'Business Model', scope: 'client', column: 'Business Model', dataKey: 'business' },
    { key: 'contactPerson', label: 'Contact Person', scope: 'client', column: 'Contact Person', dataKey: 'contactPerson' },
    { key: 'primaryEmail', label: 'Email', scope: 'client', column: 'Email', dataKey: 'email' },
    { key: 'primaryPhone', label: 'Primary Phone', scope: 'client', column: 'Primary Phone', dataKey: 'contactNumber' },
    { key: 'city', label: 'City', scope: 'client', column: 'City', dataKey: 'city' },
    { key: 'state', label: 'State', scope: 'client', column: 'State', dataKey: 'state' },
    // Course scope
    { key: 'courseName', label: 'Course Name', required: true, scope: 'service', column: 'Course Name', dataKey: 'courseName' },
    { key: 'courseCode', label: 'Course Code', scope: 'service', column: 'Course Code', dataKey: 'courseCode' },
    { key: 'category', label: 'Category', scope: 'service', column: 'Category', dataKey: 'category' },
    { key: 'level', label: 'Level', scope: 'service', column: 'Level', dataKey: 'level' },
    { key: 'degree', label: 'Degree', scope: 'service', column: 'Degree', dataKey: 'degree' },
    { key: 'department', label: 'Department', scope: 'service', column: 'Department', dataKey: 'department' },
    { key: 'section', label: 'Section', scope: 'service', column: 'Section', dataKey: 'section' },
    { key: 'semester', label: 'Semester', scope: 'service', column: 'Semester', dataKey: 'semester' },
    { key: 'offeringYear', label: 'Service Providing Year', required: true, scope: 'service', column: 'Providing Year', dataKey: 'year' },
    { key: 'status', label: 'Status', scope: 'service', column: 'Status', dataKey: 'status' },
    { key: 'serviceModel', label: 'Service Model', scope: 'service', column: 'Service Model', dataKey: 'serviceModel' },
    // Off by default — the reader ticks Batch on when they've narrowed
    // by course/batch and want the batch names on the printed sheet.
    // Shows a dash on rows whose course has no batches.
    { key: 'batch', label: 'Batch', scope: 'service', column: 'Batch', dataKey: 'batch' },
    // Off by default — the reader ticks Users on when they've narrowed
    // by user or otherwise want the enrolled user names on the printed
    // sheet. Shows a dash on rows whose course has no enrolled users.
    { key: 'users', label: 'Users', scope: 'service', column: 'Users', dataKey: 'users' },
]

const COURSE_DEFAULT_ENABLED = new Set(['clientName', 'businessModel', 'courseName', 'category', 'level', 'offeringYear'])

/* ── Reading a course record ──────────────────────────────────────────
 *  The summary payload types courses as `any`; this narrows the fields
 *  the report actually consumes. Everything is optional at the record
 *  level — a course created before a given field existed reads back as
 *  an empty string, which the paginator renders as an em-dash. */
type CourseHierarchy = {
    degreeName?: string
    departmentName?: string
    sectionName?: string
    semesterName?: string
    year?: string | number
}
type CourseRecordBatchUser = {
    _id?: string
    firstName?: string
    lastName?: string
    email?: string
}
type CourseRecordBatchEnrolment = {
    user?: CourseRecordBatchUser | string
}
type CourseRecordBatch = {
    _id?: string
    batchName?: string
    users?: CourseRecordBatchEnrolment[]
}
type CourseRecord = {
    _id?: string
    clientId?: string
    mappingId?: string
    courseName?: string
    courseCode?: string
    category?: string
    courseLevel?: string
    serviceType?: string
    serviceModal?: string
    status?: string
    year?: string | number
    coursePath?: string
    courseHierarchy?: CourseHierarchy | string[] | unknown
    /** Batches under this course (may be empty). The server stores this
     *  as `batchAndParticipants` — an array of {_id, batchName, users…}.
     *  Only present when the full course payload is fetched (the
     *  `?summary=1` projection strips it). */
    batchAndParticipants?: CourseRecordBatch[]
}

/** Read the object-shaped hierarchy fields off a record if they exist,
 *  otherwise best-effort parse from coursePath ("B.E ▸ CSE ▸ A ▸ 3"). */
function readHierarchy(record: CourseRecord): CourseHierarchy {
    const hierarchy = record.courseHierarchy
    if (hierarchy && typeof hierarchy === 'object' && !Array.isArray(hierarchy)) {
        return hierarchy as CourseHierarchy
    }
    const path = String(record.coursePath || '')
    if (!path) return {}
    const parts = path.split(/▸|>|\/|::/).map((s) => s.trim()).filter(Boolean)
    return {
        degreeName: parts[0],
        departmentName: parts[1],
        sectionName: parts[2],
        semesterName: parts[3],
    }
}

/** Read a course record's providing year.
 *
 *  The `?summary=1` course-structure projection deliberately drops the
 *  `courseHierarchy` sub-document, so `record.year` and
 *  `record.courseHierarchy.year` are both empty on the wire. The year the
 *  reader actually cares about lives on the LINKED ServiceMapping —
 *  service mapping is where "Offering / Providing Year" is authored, and
 *  a course is created against one — so the mapping lookup is where this
 *  helper resolves the value.
 *
 *  Signature takes the mapping lookup as a Map rather than closing over
 *  it, so the helper stays pure and can be tested with a fixed input. */
function yearOf(record: CourseRecord, mappingById?: Map<string, ServiceMapping>): string {
    const direct = record.year != null ? String(record.year) : ''
    if (direct) return direct
    const hy = readHierarchy(record).year
    if (hy != null && hy !== '') return String(hy)
    if (mappingById && record.mappingId) {
        const mapping = mappingById.get(String(record.mappingId))
        if (mapping?.year) return String(mapping.year)
    }
    return ''
}

/* ── Course/Batch tree ────────────────────────────────────────────────
 *  One node per course; each carries its batches (may be empty). A
 *  course with no batches ticks at course-level only; a course with
 *  batches ticks each batch as an indented child. */
type CourseBatchOption = { id: string; name: string }
type CourseTreeNode = { id: string; name: string; batches: CourseBatchOption[] }

/* ── Course & Batch picker ─────────────────────────────────────────────
 *  One trigger button. Popover shows every course; a course with
 *  batches expands into indented checkbox children. Parent and children
 *  stay in sync — ticking the parent ticks every batch, ticking every
 *  batch under a course auto-ticks the parent. */
type CourseBatchPickerProps = {
    courses: CourseTreeNode[]
    tickedCourses: string[]
    tickedBatches: string[]
    onChange: (courses: string[], batches: string[]) => void
}
function CourseBatchPicker({ courses, tickedCourses, tickedBatches, onChange }: CourseBatchPickerProps) {
    const [open, setOpen] = useState(false)
    const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

    const totalCourses = courses.length
    const totalBatches = courses.reduce((n, c) => n + c.batches.length, 0)

    const tickedCourseSet = useMemo(() => new Set(tickedCourses), [tickedCourses])
    const tickedBatchSet = useMemo(() => new Set(tickedBatches), [tickedBatches])
    const anyTicked = tickedCourseSet.size > 0 || tickedBatchSet.size > 0
    const allTicked = totalCourses > 0
        && tickedCourseSet.size >= totalCourses
        && tickedBatchSet.size >= totalBatches

    const caption = totalCourses === 0
        ? 'No courses'
        : allTicked || !anyTicked
            ? 'All courses'
            : `${tickedCourseSet.size} of ${totalCourses} courses`

    const parentState = (course: CourseTreeNode): 'all' | 'none' | 'some' => {
        const parentTicked = tickedCourseSet.has(course.id)
        if (!course.batches.length) return parentTicked ? 'all' : 'none'
        const on = course.batches.filter(b => tickedBatchSet.has(b.id)).length
        if (on === 0 && !parentTicked) return 'none'
        if (on === course.batches.length && parentTicked) return 'all'
        return 'some'
    }

    const toggleCourse = (course: CourseTreeNode, next: boolean) => {
        const nextCourses = new Set(tickedCourseSet)
        const nextBatches = new Set(tickedBatchSet)
        if (next) {
            nextCourses.add(course.id)
            course.batches.forEach(b => nextBatches.add(b.id))
        } else {
            nextCourses.delete(course.id)
            course.batches.forEach(b => nextBatches.delete(b.id))
        }
        onChange([...nextCourses], [...nextBatches])
    }

    const toggleBatch = (course: CourseTreeNode, batchId: string, next: boolean) => {
        const nextCourses = new Set(tickedCourseSet)
        const nextBatches = new Set(tickedBatchSet)
        if (next) nextBatches.add(batchId)
        else nextBatches.delete(batchId)
        const on = course.batches.filter(b => nextBatches.has(b.id)).length
        if (on === course.batches.length) nextCourses.add(course.id)
        else nextCourses.delete(course.id)
        onChange([...nextCourses], [...nextBatches])
    }

    const toggleAll = (next: boolean) => {
        if (next) {
            const allC = courses.map(c => c.id)
            const allB = courses.flatMap(c => c.batches.map(b => b.id))
            onChange(allC, allB)
        } else {
            onChange([], [])
        }
    }

    const toggleExpanded = (courseId: string) => {
        const next = new Set(expanded)
        if (next.has(courseId)) next.delete(courseId)
        else next.add(courseId)
        setExpanded(next)
    }

    const partial = anyTicked && !allTicked

    return (
        <Popover.Root open={open} onOpenChange={setOpen}>
            <Popover.Trigger asChild>
                <button
                    type="button"
                    aria-label="Course and batch"
                    title={caption}
                    className={`inline-flex h-8 w-full min-w-0 items-center gap-2 rounded-control border px-2.5 text-xs text-body outline-none focus-visible:ring-2 focus-visible:ring-brand/20 ${partial
                        ? 'border-brand-500/30 bg-brand-wash'
                        : 'border-hairline-strong bg-surface'}`}
                >
                    <span className="min-w-0 flex-1 truncate text-left">{caption}</span>
                    <ChevronDown className="size-3.5 shrink-0" />
                </button>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content
                    align="start"
                    sideOffset={6}
                    collisionPadding={12}
                    className="pointer-events-auto z-popover w-80 max-w-[calc(100vw-1rem)] rounded-xl border border-hairline bg-surface p-3 shadow-lg"
                >
                    {!courses.length ? (
                        <p className="px-2 py-3 text-center text-xs text-subtle">No courses available</p>
                    ) : (
                        <>
                            <label className="flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-body hover:bg-canvas/60">
                                <Checkbox
                                    checked={allTicked ? true : anyTicked ? 'indeterminate' : false}
                                    onCheckedChange={(checked) => toggleAll(checked === true)}
                                    className="border-hairline-strong data-[state=checked]:border-brand-700 data-[state=checked]:bg-brand-700 data-[state=checked]:text-white data-[state=indeterminate]:border-brand-700 data-[state=indeterminate]:bg-brand-700 data-[state=indeterminate]:text-white"
                                />
                                Select all courses
                            </label>
                            <div className="mt-1 max-h-72 overflow-y-auto pr-1">
                                {courses.map((course) => {
                                    const state = parentState(course)
                                    const hasBatches = course.batches.length > 0
                                    const isOpen = expanded.has(course.id)
                                    return (
                                        <div key={course.id}>
                                            <div className="flex items-center gap-1 rounded-md px-1 py-1 text-xs text-body hover:bg-canvas/60">
                                                {hasBatches ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleExpanded(course.id)}
                                                        aria-label={isOpen ? `Collapse ${course.name}` : `Expand ${course.name}`}
                                                        className="flex size-4 shrink-0 items-center justify-center rounded text-subtle hover:text-heading"
                                                    >
                                                        {isOpen
                                                            ? <ChevronDown className="size-3" />
                                                            : <ChevronRight className="size-3" />}
                                                    </button>
                                                ) : (
                                                    <span className="size-4 shrink-0" aria-hidden />
                                                )}
                                                <label className="flex flex-1 cursor-pointer select-none items-center gap-2 py-0.5">
                                                    <Checkbox
                                                        checked={state === 'all' ? true : state === 'some' ? 'indeterminate' : false}
                                                        onCheckedChange={(checked) => toggleCourse(course, checked === true)}
                                                        className="border-hairline-strong data-[state=checked]:border-brand-700 data-[state=checked]:bg-brand-700 data-[state=checked]:text-white data-[state=indeterminate]:border-brand-700 data-[state=indeterminate]:bg-brand-700 data-[state=indeterminate]:text-white"
                                                    />
                                                    <span className="min-w-0 flex-1 truncate">{course.name}</span>
                                                </label>
                                            </div>
                                            {hasBatches && isOpen && (
                                                <div className="ml-6 border-l border-hairline pl-2">
                                                    {course.batches.map((batch) => (
                                                        <label key={batch.id} className="flex cursor-pointer select-none items-center gap-2 rounded-md px-1 py-1 text-xs text-body hover:bg-canvas/60">
                                                            <Checkbox
                                                                checked={tickedBatchSet.has(batch.id)}
                                                                onCheckedChange={(checked) => toggleBatch(course, batch.id, checked === true)}
                                                                className="border-hairline-strong data-[state=checked]:border-brand-700 data-[state=checked]:bg-brand-700 data-[state=checked]:text-white"
                                                            />
                                                            <span className="min-w-0 flex-1 truncate">{batch.name}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </>
                    )}
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    )
}

export default function CourseReportPage() {
    const [draft, setDraft] = useState<Draft>({ ...EMPTY })
    const [snapshot, setSnapshot] = useState<{ draft: Draft; rows: CourseRecord[]; generated: string } | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [printModalOpen, setPrintModalOpen] = useState(false)

    /* ── The course-structures summary. This is what the Courses tab
     *  reads too, so both tabs share the same cache entry. */
    /* Full fetch — summary strips `batchAndParticipants`, which the
     *  Course/Batch picker and Batch column both need. The Courses tab
     *  still uses the summary; only this report page pays for the
     *  extra payload, and it's cached under its own key. */
    const { data: coursesRes, isLoading: coursesLoading } = useQuery({
        queryKey: ['courseReport', 'courses-full'] as const,
        queryFn: fetchAllCourseStructures,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    })
    const courses: CourseRecord[] = useMemo(() => {
        const raw = coursesRes as { data?: unknown } | unknown
        const list = Array.isArray((raw as { data?: unknown })?.data)
            ? (raw as { data: unknown[] }).data
            : Array.isArray(raw) ? raw as unknown[] : []
        return list as CourseRecord[]
    }, [coursesRes])

    const { data: clientList } = useClients()
    const clientById = useMemo(() => {
        const map = new Map<string, Client>()
        for (const client of clientList ?? []) map.set(String(client._id), client)
        return map
    }, [clientList])

    /* ── Mapping lookup for Providing Year ────────────────────────────
     *  Course records carry a mappingId; the mapping carries the year
     *  the report calls "Providing Year". Fetched once and joined by id
     *  so every downstream helper (facets, filter, table row) reads the
     *  same source of truth. */
    const { data: mappings } = useServiceMappings()
    const mappingById = useMemo(() => {
        const map = new Map<string, ServiceMapping>()
        for (const mapping of mappings ?? []) map.set(String(mapping._id), mapping)
        return map
    }, [mappings])

    /* ── The letterhead a designed export prints. Same pattern as
     *  businessreports — one fetch per mount, silent fall-back to the
     *  built-in layout / brand wording when neither exists. */
    const [reportSettings, setReportSettings] = useState<ReportSettings | undefined>()
    const [letterhead, setLetterhead] = useState<{ org: string; address: string; contact: string }>(BRAND_FALLBACK)
    useEffect(() => {
        const institutionId = typeof window === 'undefined' ? null : localStorage.getItem('smartcliff_institution')
        if (!institutionId) return
        let cancelled = false
        fetchReportSettings(institutionId)
            .then((settings) => { if (!cancelled) setReportSettings(settings) })
            .catch(() => { /* plain layout */ })
        fetchInstitutionById(institutionId)
            .then((institution) => {
                if (cancelled) return
                setLetterhead({
                    org: institution?.inst_name?.trim() || BRAND_FALLBACK.org,
                    address: institution?.address?.trim() || '',
                    contact: institution?.phone?.trim() || '',
                })
            })
            .catch(() => { /* fallback wording */ })
        return () => { cancelled = true }
    }, [])

    /* ── Facet options ────────────────────────────────────────────────
     *  Every unique clientId / service / model / year present in the
     *  loaded course list. Client labels come from the clients query so
     *  the dropdown shows the company name rather than the raw id.
     *  Courses/batches are keyed by their real _id (not name) so the
     *  hierarchical picker can distinguish two courses that happen to
     *  share a name and the Batch column can join batch names per row. */
    const options = useMemo(() => {
        const clientIds = new Set<string>()
        const services = new Set<string>()
        const models = new Set<string>()
        const years = new Set<string>()
        const courseIds: string[] = []
        const batchIds: string[] = []
        // User label lookup — deduped by user id so a student sitting in
        // two batches contributes one option. Populated user objects give
        // us name + email; a bare id falls back to the id itself.
        const userLabelById = new Map<string, string>()
        for (const c of courses) {
            if (c.clientId) clientIds.add(String(c.clientId))
            const svc = String(c.serviceType || '').trim()
            if (svc) services.add(svc)
            const model = String(c.serviceModal || '').trim()
            if (model) models.add(model)
            const y = yearOf(c, mappingById)
            if (y) years.add(y)
            const cid = String(c._id || '')
            if (cid) courseIds.push(cid)
            for (const b of (c.batchAndParticipants || [])) {
                const bid = String(b._id || '')
                if (bid) batchIds.push(bid)
                for (const enrolment of (b.users || [])) {
                    const raw = enrolment?.user
                    const uid = typeof raw === 'string'
                        ? raw
                        : raw && typeof raw === 'object' ? String(raw._id || '') : ''
                    if (!uid || userLabelById.has(uid)) continue
                    const populated = raw && typeof raw === 'object' ? raw : null
                    const name = populated
                        ? `${String(populated.firstName || '').trim()} ${String(populated.lastName || '').trim()}`.trim()
                        : ''
                    const email = populated ? String(populated.email || '').trim() : ''
                    userLabelById.set(uid, name || email || uid)
                }
            }
        }
        const clientOpts = [...clientIds].map((id) => {
            const record = clientById.get(id)
            return { value: id, label: record?.clientCompany || id }
        }).sort((a, b) => a.label.localeCompare(b.label))
        const userOpts = [...userLabelById.entries()].map(([value, label]) => ({ value, label }))
            .sort((a, b) => a.label.localeCompare(b.label))
        return {
            clients: clientOpts,
            services: [...services].sort().map((value) => ({ value, label: value })),
            models: [...models].sort().map((value) => ({ value, label: value })),
            courseIds,
            batchIds,
            users: userOpts,
            years: [...years].sort(),
        }
    }, [courses, clientById, mappingById])

    /* ── Cascading dropdown options ───────────────────────────────────
     *  Each dropdown lists only what appears in courses passing every
     *  OTHER filter — so ticking B2B under Service narrows the Client
     *  dropdown to B2B clients, Service Model to service-models that
     *  belong to B2B services, and so on. A dimension does NOT narrow
     *  itself, so a reader can still untick / retick within a dropdown
     *  they've partially chosen without their own selections vanishing.
     *  A ticked-all filter (length equals its universe) is treated as
     *  no-narrowing, matching how generate() reads the draft. */
    /* Course/batch narrowing helper — a course row survives when its
     *  own id is ticked OR at least one of its batches is ticked. Used
     *  by both the cascade and the generate() filter. */
    const courseMatches = useCallback((c: CourseRecord, courseSet: Set<string> | null, batchSet: Set<string> | null) => {
        if (!courseSet && !batchSet) return true
        const cid = String(c._id || '')
        if (courseSet && cid && courseSet.has(cid)) return true
        if (batchSet && Array.isArray(c.batchAndParticipants)) {
            for (const b of c.batchAndParticipants) {
                const bid = String(b._id || '')
                if (bid && batchSet.has(bid)) return true
            }
        }
        return false
    }, [])

    /* User narrowing — a course row survives when at least one of the
     *  ticked user ids appears in any of the course's batch rosters. */
    const userMatches = useCallback((c: CourseRecord, userSet: Set<string> | null) => {
        if (!userSet) return true
        for (const b of (c.batchAndParticipants || [])) {
            for (const enrolment of (b.users || [])) {
                const raw = enrolment?.user
                const uid = typeof raw === 'string'
                    ? raw
                    : raw && typeof raw === 'object' ? String(raw._id || '') : ''
                if (uid && userSet.has(uid)) return true
            }
        }
        return false
    }, [])

    const visibleOptions = useMemo(() => {
        const clientNarrow = draft.clients.length && draft.clients.length < options.clients.length
            ? new Set(draft.clients) : null
        const serviceNarrow = draft.services.length && draft.services.length < options.services.length
            ? new Set(draft.services) : null
        const modelNarrow = draft.models.length && draft.models.length < options.models.length
            ? new Set(draft.models) : null
        // Course/Batch narrowing collapses only when EVERY course id and
        // EVERY batch id is ticked; a mixed pick narrows.
        const totalCB = options.courseIds.length + options.batchIds.length
        const pickedCB = draft.courses.length + draft.batches.length
        const narrowCB = pickedCB > 0 && pickedCB < totalCB
        const courseNarrow = narrowCB ? new Set(draft.courses) : null
        const batchNarrow = narrowCB ? new Set(draft.batches) : null
        const userNarrow = draft.users.length && draft.users.length < options.users.length
            ? new Set(draft.users) : null
        const yearNarrow = draft.period === 'years' && draft.years.length && draft.years.length < options.years.length
            ? new Set(draft.years) : null

        const passes = (c: CourseRecord, skip: 'client'|'service'|'model'|'course'|'user'|'year') => {
            if (skip !== 'client' && clientNarrow && !clientNarrow.has(String(c.clientId || ''))) return false
            if (skip !== 'service' && serviceNarrow && !serviceNarrow.has(String(c.serviceType || ''))) return false
            if (skip !== 'model' && modelNarrow && !modelNarrow.has(String(c.serviceModal || ''))) return false
            if (skip !== 'course' && (courseNarrow || batchNarrow) && !courseMatches(c, courseNarrow, batchNarrow)) return false
            if (skip !== 'user' && userNarrow && !userMatches(c, userNarrow)) return false
            if (skip !== 'year' && yearNarrow) {
                const y = yearOf(c, mappingById)
                if (!yearNarrow.has(y)) return false
            }
            return true
        }

        const clientIds = new Set<string>()
        const services = new Set<string>()
        const models = new Set<string>()
        const years = new Set<string>()
        const courseTreeAvailable: CourseTreeNode[] = []
        const userLabelById = new Map<string, string>()
        for (const c of courses) {
            if (passes(c, 'client')) { if (c.clientId) clientIds.add(String(c.clientId)) }
            if (passes(c, 'service')) { const v = String(c.serviceType || '').trim(); if (v) services.add(v) }
            if (passes(c, 'model')) { const v = String(c.serviceModal || '').trim(); if (v) models.add(v) }
            if (passes(c, 'course')) {
                courseTreeAvailable.push({
                    id: String(c._id || ''),
                    name: String(c.courseName || 'Unnamed course'),
                    batches: (c.batchAndParticipants || [])
                        .filter(b => b && (b._id != null || b.batchName != null))
                        .map(b => ({ id: String(b._id || ''), name: String(b.batchName || 'Batch') })),
                })
            }
            if (passes(c, 'user')) {
                for (const b of (c.batchAndParticipants || [])) {
                    for (const enrolment of (b.users || [])) {
                        const raw = enrolment?.user
                        const uid = typeof raw === 'string'
                            ? raw
                            : raw && typeof raw === 'object' ? String(raw._id || '') : ''
                        if (!uid || userLabelById.has(uid)) continue
                        const populated = raw && typeof raw === 'object' ? raw : null
                        const name = populated
                            ? `${String(populated.firstName || '').trim()} ${String(populated.lastName || '').trim()}`.trim()
                            : ''
                        const email = populated ? String(populated.email || '').trim() : ''
                        userLabelById.set(uid, name || email || uid)
                    }
                }
            }
            if (passes(c, 'year')) { const y = yearOf(c, mappingById); if (y) years.add(y) }
        }

        const clientOpts = [...clientIds].map((id) => {
            const record = clientById.get(id)
            return { value: id, label: record?.clientCompany || id }
        }).sort((a, b) => a.label.localeCompare(b.label))
        const userOpts = [...userLabelById.entries()].map(([value, label]) => ({ value, label }))
            .sort((a, b) => a.label.localeCompare(b.label))
        return {
            clients: clientOpts,
            services: [...services].sort().map((value) => ({ value, label: value })),
            models: [...models].sort().map((value) => ({ value, label: value })),
            courseTree: courseTreeAvailable.sort((a, b) => a.name.localeCompare(b.name)),
            users: userOpts,
            years: [...years].sort(),
        }
    }, [courses, draft, clientById, mappingById, courseMatches, userMatches, options.clients.length, options.services.length, options.models.length, options.courseIds.length, options.batchIds.length, options.users.length, options.years.length])

    /* ── Seed every filter as "everything selected" once the courses
     *  have loaded, so pressing Generate right away answers "show me
     *  the whole book" without any setup. Seeded once. */
    const seeded = useRef(false)
    useEffect(() => {
        if (seeded.current || !courses.length) return
        seeded.current = true
        setDraft((d) => ({
            ...d,
            clients: options.clients.map((o) => o.value),
            services: options.services.map((o) => o.value),
            models: options.models.map((o) => o.value),
            courses: options.courseIds,
            batches: options.batchIds,
            users: options.users.map((o) => o.value),
            // Seed the year checklist with every year present so pressing
            // Generate right away answers "all years". Ignored while the
            // reader is in `range` mode.
            years: [...options.years].sort(),
        }))
    }, [courses.length, options.clients, options.services, options.models, options.courseIds, options.batchIds, options.users, options.years])

    const hasDraft = Boolean(
        draft.clients.length || draft.services.length || draft.models.length
        || draft.courses.length || draft.batches.length || draft.users.length
        || draft.years.length || draft.from || draft.to,
    )

    const generate = useCallback(() => {
        setLoading(true)
        setError('')
        const asked: Draft = { ...draft }
        try {
            // "Everything ticked" collapses to "no narrowing" so the
            // filter is a real narrowing, not a set-equality check.
            const clientSet = asked.clients.length && asked.clients.length < options.clients.length
                ? new Set(asked.clients) : null
            const serviceSet = asked.services.length && asked.services.length < options.services.length
                ? new Set(asked.services) : null
            const modelSet = asked.models.length && asked.models.length < options.models.length
                ? new Set(asked.models) : null
            // Course/Batch — one hierarchical narrowing. Only "every tick"
            // collapses to no-narrowing; a mixed pick (some courses full,
            // some by specific batch) narrows the report to courses that
            // have the course id ticked OR at least one batch ticked.
            const totalCB = options.courseIds.length + options.batchIds.length
            const pickedCB = asked.courses.length + asked.batches.length
            const narrowCB = pickedCB > 0 && pickedCB < totalCB
            const courseSet = narrowCB ? new Set(asked.courses) : null
            const batchSet = narrowCB ? new Set(asked.batches) : null
            const userSet = asked.users.length && asked.users.length < options.users.length
                ? new Set(asked.users) : null
            // years mode: keep only rows whose year is in the ticked set.
            // "Every year ticked" collapses to no narrowing.
            const yearSet = asked.period === 'years'
                && asked.years.length
                && asked.years.length < options.years.length
                ? new Set(asked.years) : null

            const rows = courses.filter((record) => {
                if (clientSet && !clientSet.has(String(record.clientId || ''))) return false
                if (serviceSet && !serviceSet.has(String(record.serviceType || ''))) return false
                if (modelSet && !modelSet.has(String(record.serviceModal || ''))) return false
                if ((courseSet || batchSet) && !courseMatches(record, courseSet, batchSet)) return false
                if (userSet && !userMatches(record, userSet)) return false
                if (yearSet) {
                    const y = yearOf(record, mappingById)
                    if (!yearSet.has(y)) return false
                }
                if (asked.period === 'range' && (asked.from || asked.to)) {
                    const y = yearOf(record, mappingById)
                    if (!y) return false
                    if (asked.from && y < asked.from) return false
                    if (asked.to && y > asked.to) return false
                }
                return true
            })

            setSnapshot({ draft: asked, rows, generated: new Date().toLocaleString() })
        } catch (err) {
            setError(err instanceof Error && err.message ? err.message : 'Could not build the report. Please try again.')
        } finally {
            setLoading(false)
        }
    }, [draft, courses, mappingById, courseMatches, userMatches, options.clients.length, options.services.length, options.models.length, options.courseIds.length, options.batchIds.length, options.users.length, options.years.length])

    /* ── Group into per-client blocks with rowspan-friendly shape ──── */
    const generatedTimestamp = snapshot?.generated ?? ''
    const report = useMemo(() => {
        if (!snapshot) return null
        type Node = { client: string; clientId: string; records: CourseRecord[] }
        const byClient = new Map<string, Node>()
        for (const record of snapshot.rows) {
            const clientId = String(record.clientId || 'unknown')
            const clientRecord = clientById.get(clientId)
            const name = clientRecord?.clientCompany || 'Unnamed client'
            const node = byClient.get(clientId) || { client: name, clientId, records: [] }
            node.records.push(record)
            byClient.set(clientId, node)
        }
        const blocks: ReportClientBlock[] = [...byClient.values()]
            .sort((a, b) => a.client.localeCompare(b.client))
            .map((node) => {
                const clientRecord = clientById.get(node.clientId)
                const rawBusiness = clientRecord?.businessModel || ''
                const business = rawBusiness
                    ? businessModelDisplayName(rawBusiness) || rawBusiness
                    : 'No business model'
                const primary = (clientRecord?.contactPersons ?? []).find((person) => person.isPrimary)
                    ?? clientRecord?.contactPersons?.[0]
                const addressParts = parseClientAddress(clientRecord?.clientAddress || '')
                const clientExtras: Record<string, string> = {
                    clientId: clientRecord?.clientId || '—',
                    clientStatus: clientRecord?.status ? capitalise(clientRecord.status) : '—',
                    contactPerson: primary?.name || '—',
                    email: primary?.email || '—',
                    secondaryEmail: primary?.secondaryEmail || '—',
                    contactNumber: primary?.phoneNumber || '—',
                    secondaryPhone: primary?.secondaryPhoneNumber || '—',
                    clientPhone: clientRecord?.clientPhone || '—',
                    address: clientRecord?.clientAddress || '—',
                    addressLine: addressParts.line || '—',
                    city: addressParts.city || '—',
                    state: addressParts.state || '—',
                    pincode: addressParts.pincode || '—',
                }
                const services: Record<string, string>[] = [...node.records]
                    .sort((a, b) => (a.courseName || '').localeCompare(b.courseName || ''))
                    .map((record) => {
                        const hierarchy = readHierarchy(record)
                        // Batch names for this course — joined so a course
                        // with multiple batches reads faithfully on the
                        // printed sheet, and empty courses print a dash.
                        const batchNames = (record.batchAndParticipants || [])
                            .map(b => String(b.batchName || '').trim())
                            .filter(Boolean)
                        // Users enrolled in any of this course's batches.
                        // Deduped by user id; a populated user gives us a
                        // name, otherwise the email or the raw id is used.
                        const userNamesById = new Map<string, string>()
                        for (const b of (record.batchAndParticipants || [])) {
                            for (const enrolment of (b.users || [])) {
                                const raw = enrolment?.user
                                const uid = typeof raw === 'string'
                                    ? raw
                                    : raw && typeof raw === 'object' ? String(raw._id || '') : ''
                                if (!uid || userNamesById.has(uid)) continue
                                const populated = raw && typeof raw === 'object' ? raw : null
                                const name = populated
                                    ? `${String(populated.firstName || '').trim()} ${String(populated.lastName || '').trim()}`.trim()
                                    : ''
                                const email = populated ? String(populated.email || '').trim() : ''
                                userNamesById.set(uid, name || email || uid)
                            }
                        }
                        const userNames = [...userNamesById.values()]
                        return {
                            courseName: record.courseName || '—',
                            courseCode: record.courseCode || '—',
                            category: record.category || '—',
                            level: record.courseLevel || '—',
                            degree: hierarchy.degreeName || '—',
                            department: hierarchy.departmentName || '—',
                            section: hierarchy.sectionName || '—',
                            semester: hierarchy.semesterName || '—',
                            year: yearOf(record, mappingById) || '—',
                            status: record.status ? capitalise(record.status) : '—',
                            serviceModel: record.serviceModal || '—',
                            service: record.serviceType || '—',
                            batch: batchNames.length ? batchNames.join(', ') : '—',
                            users: userNames.length ? userNames.join(', ') : '—',
                            generatedDate: generatedTimestamp,
                        }
                    })
                return { client: node.client, business, clientExtras, services }
            })

        return { blocks }
    }, [snapshot, clientById, generatedTimestamp, mappingById])

    const totalRows = report?.blocks.reduce((sum, block) => sum + block.services.length, 0) ?? 0

    const reset = () => {
        setDraft({
            ...EMPTY,
            clients: options.clients.map((o) => o.value),
            services: options.services.map((o) => o.value),
            models: options.models.map((o) => o.value),
            courses: options.courseIds,
            batches: options.batchIds,
            users: options.users.map((o) => o.value),
            years: [...options.years].sort(),
        })
        setSnapshot(null)
        setError('')
        setLoading(false)
    }

    /* Lookup: course id → name, batch id → name — for the summary lines
     *  that show what was filtered. Rebuilds when the source list moves. */
    const courseNameById = useMemo(() => {
        const map = new Map<string, string>()
        for (const c of courses) {
            const id = String(c._id || '')
            if (id) map.set(id, String(c.courseName || 'Unnamed course'))
        }
        return map
    }, [courses])
    const batchNameById = useMemo(() => {
        const map = new Map<string, string>()
        for (const c of courses) {
            for (const b of (c.batchAndParticipants || [])) {
                const id = String(b._id || '')
                if (id) map.set(id, String(b.batchName || 'Batch'))
            }
        }
        return map
    }, [courses])

    /* ── The design the print modal opens on ─────────────────────── */
    const initialFormat: ReportFormat = useMemo(
        () => activeFormat(reportSettings) ?? newFormat('Report layout', false),
        [reportSettings],
    )

    /* ── The "Filtered by …" line the printed sheet carries ───────── */
    const filterSummary = useMemo(() => {
        if (!snapshot) return ''
        const asked = snapshot.draft
        const parts: string[] = []
        const describe = (label: string, values: string[], total: number) => {
            if (!values.length || values.length >= total) return
            parts.push(values.length <= 4
                ? `${label}: ${values.map(displayLabel).join(', ')}`
                : `${label}: ${values.slice(0, 3).map(displayLabel).join(', ')} +${values.length - 3} more`)
        }
        describe('Business Model', asked.services, options.services.length)
        describe('Service Model', asked.models, options.models.length)
        // Course/Batch — labelled with names, not raw ids. Report "Course"
        // when the pick is course-level and "Batch" when it drills below.
        const courseLabels = asked.courses.map(id => courseNameById.get(id) || id)
        const batchLabels = asked.batches.map(id => batchNameById.get(id) || id)
        describe('Course', courseLabels, options.courseIds.length)
        describe('Batch', batchLabels, options.batchIds.length)
        if (asked.period === 'range') {
            if (asked.from || asked.to) parts.push(`Service Providing Year: ${asked.from || '…'}–${asked.to || '…'}`)
        } else {
            describe('Service Providing Year', [...asked.years].sort(), options.years.length)
        }
        return parts.length ? `Filtered by  ·  ${parts.join('  ·  ')}` : ''
    }, [snapshot, courseNameById, batchNameById, options.services.length, options.models.length, options.courseIds.length, options.batchIds.length, options.years.length])

    /* ── The on-page "Showing: …" chip line ───────────────────────────
     *  A compact one-line summary sitting between the filter card and
     *  the results table, so the reader can see at a glance what the
     *  generated report represents without reopening every dropdown.
     *  Format: "Showing: <val1> · <val2> · <val3> · <val4> · All Clients"
     *  — an "All X" placeholder replaces a filter that was left at
     *  every value ticked, so all five positions always render. */
    const showingSummary = useMemo(() => {
        if (!snapshot) return ''
        const asked = snapshot.draft
        const pick = (values: string[], total: number, allWord: string) => {
            if (!values.length || values.length >= total) return allWord
            if (values.length <= 3) return values.map(displayLabel).join(', ')
            return `${values.slice(0, 2).map(displayLabel).join(', ')} +${values.length - 2}`
        }
        const parts: string[] = []
        parts.push(pick(asked.services, options.services.length, 'All Business Models'))
        parts.push(pick(asked.models, options.models.length, 'All Service Models'))
        const courseLabels = asked.courses.map(id => courseNameById.get(id) || id)
        parts.push(pick(courseLabels, options.courseIds.length, 'All Courses'))
        if (asked.period === 'range') {
            parts.push(asked.from || asked.to ? `${asked.from || '…'}–${asked.to || '…'}` : 'All Years')
        } else {
            parts.push(pick([...asked.years].sort(), options.years.length, 'All Years'))
        }
        const clientLabels = asked.clients.map(id => clientById.get(id)?.clientCompany || id)
        parts.push(pick(clientLabels, options.clients.length, 'All Clients'))
        return parts.join('  ·  ')
    }, [snapshot, courseNameById, options.services.length, options.models.length, options.courseIds.length, options.years.length, options.clients.length, clientById])

    const printMeta = useMemo(() => ({
        title: 'Courses report',
        scope: report
            ? `${report.blocks.length} client${report.blocks.length === 1 ? '' : 's'}  ·  ${totalRows} row${totalRows === 1 ? '' : 's'}`
            : '',
        generated: snapshot?.generated ?? '',
        filters: filterSummary,
        ...letterhead,
    }), [snapshot, report, totalRows, letterhead, filterSummary])

    return (
        <>
            <motion.div variants={pageEnter} initial="hidden" animate="visible" className="flex h-full min-h-0 min-w-0 flex-col">
                <div className="flex min-h-0 flex-1 flex-col px-4 pb-3 pt-3 sm:px-6 md:px-8">

                    {/* ── The scope form ───────────────────────────────────
                        Filters read left-to-right as: Business Model →
                        Providing Year → Service Model → Client → Course.
                        Same order the Courses tab's Show filters panel
                        uses, so the reader learns one sequence and it
                        reads the same on both surfaces. */}
                    <div className="no-print mt-3 shrink-0 rounded-xl border border-hairline bg-canvas/40 px-4 py-3">
                        {/* Five filters on ONE row from md up with weighted
                            widths — Client and Course get more room since
                            their values run longer, Providing Year gets
                            less since the values are short. `fr` shares
                            leftover space after gaps so the row always
                            fills the card exactly. */}
                        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-[16fr_14fr_16fr_20fr_18fr_16fr]">
                            <div className="min-w-0">
                                <p className="mb-1 text-[11px] font-medium text-subtle">Business Model</p>
                                <MappingMultiFilter
                                    label="Business Models"
                                    options={visibleOptions.services}
                                    value={draft.services}
                                    onChange={(services) => setDraft((d) => ({ ...d, services }))}
                                    placeholder="Select business model"
                                />
                            </div>
                            <div className="min-w-0">
                                {/* Providing Year — one trigger button, same
                                    height / border / typography as its
                                    neighbours. The Range / List mode toggle
                                    lives INSIDE the popover (see
                                    ProvidingYearPicker), so the outer
                                    filter row stays uniform. */}
                                <p className="mb-1 text-[11px] font-medium text-subtle">Service Providing Year</p>
                                <ProvidingYearPicker
                                    period={draft.period}
                                    years={draft.years}
                                    from={draft.from}
                                    to={draft.to}
                                    availableYears={visibleOptions.years}
                                    onPeriodChange={(next) => setDraft((d) => (d.period === next
                                        ? d
                                        : next === 'range'
                                            ? { ...d, period: 'range', years: [] }
                                            : { ...d, period: 'years', from: '', to: '' }))}
                                    onYearsChange={(nextYears) => setDraft((d) => ({ ...d, years: nextYears }))}
                                    onRangeChange={(nextFrom, nextTo) => setDraft((d) => ({ ...d, from: nextFrom, to: nextTo }))}
                                />
                            </div>
                            <div className="min-w-0">
                                <p className="mb-1 text-[11px] font-medium text-subtle">Service Model</p>
                                <MappingMultiFilter
                                    label="Service Models"
                                    options={visibleOptions.models}
                                    value={draft.models}
                                    onChange={(models) => setDraft((d) => ({ ...d, models }))}
                                    placeholder="Select service model"
                                />
                            </div>
                            <div className="min-w-0">
                                <p className="mb-1 text-[11px] font-medium text-subtle">Client</p>
                                <MappingMultiFilter
                                    label="Clients"
                                    options={visibleOptions.clients}
                                    value={draft.clients}
                                    onChange={(clients) => setDraft((d) => ({ ...d, clients }))}
                                    placeholder="Select client"
                                />
                            </div>
                            <div className="min-w-0">
                                {/* Course — hierarchical picker (course
                                    parent + indented batches). Ticking a
                                    course ticks every batch under it;
                                    ticking a specific batch marks the
                                    parent indeterminate. */}
                                <p className="mb-1 text-[11px] font-medium text-subtle">Course</p>
                                <CourseBatchPicker
                                    courses={visibleOptions.courseTree}
                                    tickedCourses={draft.courses}
                                    tickedBatches={draft.batches}
                                    onChange={(nextCourses, nextBatches) => setDraft((d) => ({ ...d, courses: nextCourses, batches: nextBatches }))}
                                />
                            </div>
                            <div className="min-w-0">
                                {/* Users — narrows the report to courses
                                    that enrol at least one ticked user in
                                    any of their batches. */}
                                <p className="mb-1 text-[11px] font-medium text-subtle">Users</p>
                                <MappingMultiFilter
                                    label="Users"
                                    options={visibleOptions.users}
                                    value={draft.users}
                                    onChange={(nextUsers) => setDraft((d) => ({ ...d, users: nextUsers }))}
                                    placeholder="Select user"
                                />
                            </div>
                        </div>

                        {/* Action row — Generate is the primary action (bold
                            brand button), Reset is a subtle outline, and
                            Preview & Print sits at the far right. It stays
                            RENDERED at all times so the workflow reads
                            Generate → Preview & Print, and it's disabled
                            (neutral outline) until a report has been
                            generated. Once there is something to print it
                            flips to solid green as the final-step action. */}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Button
                                type="button"
                                size="sm"
                                className="text-xs font-semibold bg-brand-strong hover:bg-brand-800 text-white"
                                disabled={loading || coursesLoading}
                                onClick={() => generate()}
                            >
                                {loading ? <Loader2 className="size-3.5 animate-spin" /> : <BarChart3 className="size-3.5" />}
                                {loading ? 'Generating…' : 'Generate Report'}
                            </Button>

                            {(hasDraft || snapshot) && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs text-subtle hover:text-heading"
                                    disabled={loading}
                                    onClick={reset}
                                >
                                    <RotateCcw className="size-3.5" />Reset
                                </Button>
                            )}

                            {!draft.clients.length && (
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-brand-strong">
                                    <Info className="size-3.5 shrink-0" />
                                    No client selected — pick at least one, or generate to include every client.
                                </span>
                            )}

                            <Button
                                type="button"
                                size="sm"
                                variant={snapshot && totalRows ? 'default' : 'outline'}
                                className={`ml-auto text-xs font-bold ${snapshot && totalRows
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                                    : ''}`}
                                disabled={!snapshot || !totalRows}
                                onClick={() => setPrintModalOpen(true)}
                                title={snapshot && totalRows ? 'Preview & print the report' : 'Generate a report first'}
                            >
                                <Printer className="size-3.5" />Preview &amp; Print
                            </Button>
                        </div>
                    </div>

                    {/* ── The report ───────────────────────────────────────
                        A flex column so the table card can claim every
                        pixel remaining below the filter card. Only the
                        table body scrolls (see the scroll wrapper below);
                        the outer container is not scrollable so the reader
                        never sees a nested pair of scrollbars. */}
                    <div className="mt-3 min-h-0 flex-1 flex flex-col">
                        {error && (
                            <div role="alert" className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-danger-500/30 bg-danger-50 p-3 text-sm text-danger-700">
                                {error}
                                <Button variant="outline" size="sm" className="text-xs" onClick={() => generate()}>Retry</Button>
                            </div>
                        )}

                        {!snapshot && !loading && !error && (
                            <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-hairline bg-canvas/30 p-6 text-center">
                                <div className="relative mb-3">
                                    <svg
                                        aria-hidden
                                        className="pointer-events-none absolute left-1/2 top-1/2 h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 text-brand-300"
                                        viewBox="0 0 72 72"
                                        fill="none"
                                    >
                                        <path
                                            d="M10 51 A 30 30 0 1 1 62 51"
                                            stroke="currentColor"
                                            strokeWidth="1.5"
                                            strokeLinecap="round"
                                            strokeDasharray="1 7"
                                        />
                                    </svg>
                                    <div className="relative flex h-11 w-11 items-center justify-center rounded-tile bg-brand-wash">
                                        <BarChart3 className="size-5 text-brand-strong" aria-hidden />
                                    </div>
                                </div>
                                <h2 className="text-sm font-semibold text-heading">Generate a report to see the results</h2>
                                <p className="mt-1 max-w-sm text-xs leading-5 text-subtle">
                                    Choose your filters above and click <span className="font-semibold text-heading">Generate report</span>.
                                </p>
                            </div>
                        )}

                        {loading && !snapshot && (
                            <div role="status" aria-label="Generating report" className="space-y-3">
                                {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-ink-100" />)}
                            </div>
                        )}

                        {snapshot && report && (
                            <div className={`flex flex-1 min-h-0 flex-col transition-opacity ${loading ? 'opacity-50' : ''}`}>
                                {showingSummary && (
                                    <p className="no-print mb-3 text-[11px] text-subtle">
                                        <span className="font-semibold text-heading">Showing:</span> {showingSummary}
                                    </p>
                                )}

                                {!totalRows ? (
                                    <p className="rounded-xl border border-dashed border-hairline py-12 text-center text-sm text-subtle">
                                        Nothing matches this combination. Try a wider scope.
                                    </p>
                                ) : (
                                    <div className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-xl border border-hairline bg-white">
                                        {/* One scroll container — the table body — that
                                            fills every pixel between the summary line
                                            above and the bottom of the viewport. The
                                            outer report container is not scrollable, so
                                            the reader never sees a second scrollbar
                                            outside this one. Sticky thead needs a per-
                                            cell background because border-collapse
                                            disables sticky on <thead> in most engines. */}
                                        <div className="min-h-0 flex-1 overflow-auto">
                                            <table className="w-full table-fixed border-collapse text-xs">
                                                {/* Six columns after Generate: Service Model
                                                    comes BEFORE Course Name so the review
                                                    table reads Service Model → Course Name →
                                                    Providing Year, the same left-to-right
                                                    order the reader asked for. Widths sum
                                                    to 100. */}
                                                <colgroup>
                                                    <col style={{ width: '6%' }} />
                                                    <col style={{ width: '22%' }} />
                                                    <col style={{ width: '16%' }} />
                                                    <col style={{ width: '20%' }} />
                                                    <col style={{ width: '22%' }} />
                                                    <col style={{ width: '14%' }} />
                                                </colgroup>
                                                <thead>
                                                    <tr>
                                                        <th className="sticky top-0 z-10 bg-canvas border-b border-r border-hairline px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-subtle">S. No.</th>
                                                        <th className="sticky top-0 z-10 bg-canvas border-b border-r border-hairline px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-subtle">Client</th>
                                                        <th className="sticky top-0 z-10 bg-canvas border-b border-r border-hairline px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-subtle">Business Model</th>
                                                        <th className="sticky top-0 z-10 bg-canvas border-b border-r border-hairline px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-subtle">Service Model</th>
                                                        <th className="sticky top-0 z-10 bg-canvas border-b border-r border-hairline px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-subtle">Course Name</th>
                                                        <th className="sticky top-0 z-10 bg-canvas border-b border-hairline px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-subtle">Providing Year</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {report.blocks.map((block, blockIdx) => block.services.map((svc, svcIdx) => {
                                                        const isFirst = svcIdx === 0
                                                        const boundary = isFirst && blockIdx > 0
                                                            ? 'border-t-2 border-hairline-strong'
                                                            : 'border-t border-hairline/60'
                                                        return (
                                                            <tr key={`${blockIdx}-${svcIdx}`} className={`${boundary} hover:bg-row-hover`}>
                                                                {/* S. No. rowspans the entire client
                                                                    block — one number per client,
                                                                    not per course. Matches how the
                                                                    Client and Business Model cells
                                                                    merge across the same rows. */}
                                                                {isFirst && (
                                                                    <>
                                                                        <td
                                                                            rowSpan={block.services.length}
                                                                            className="border-r border-hairline/60 px-3 py-2 text-center align-middle tabular-nums text-subtle"
                                                                        >
                                                                            {blockIdx + 1}
                                                                        </td>
                                                                        <td
                                                                            rowSpan={block.services.length}
                                                                            className="border-r border-hairline/60 px-3 py-2 align-middle font-semibold text-heading"
                                                                            style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                                                                        >
                                                                            {block.client}
                                                                        </td>
                                                                        <td
                                                                            rowSpan={block.services.length}
                                                                            className="border-r border-hairline/60 px-3 py-2 align-middle font-semibold text-heading"
                                                                            style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                                                                        >
                                                                            {block.business}
                                                                        </td>
                                                                    </>
                                                                )}
                                                                    <td className="border-r border-hairline/60 px-3 py-2 align-middle text-body" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                                                                        {svc.serviceModel || '—'}
                                                                    </td>
                                                                    <td className="border-r border-hairline/60 px-3 py-2 align-middle text-body" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                                                                        {svc.courseName}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-center align-middle tabular-nums text-body">
                                                                        {svc.year}
                                                                    </td>
                                                            </tr>
                                                        )
                                                    }))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>

            {/* ── Print Preview modal — the same shared modal Business
                Reports uses, with the Course-report field list. */}
            <PrintPreviewModal
                open={printModalOpen}
                onClose={() => setPrintModalOpen(false)}
                snapshot={snapshot ? { draft: snapshot.draft, rows: [] as ServiceMapping[], generated: snapshot.generated } : null}
                blocks={report?.blocks ?? []}
                letterhead={letterhead}
                initialFormat={initialFormat}
                meta={printMeta}
                fields={COURSE_FIELDS}
                defaultEnabled={COURSE_DEFAULT_ENABLED}
            />
        </>
    )
}
