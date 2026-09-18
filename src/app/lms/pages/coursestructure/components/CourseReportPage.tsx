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
import { BarChart3, Info, Loader2, Printer, RotateCcw } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { pageEnter } from '@/app/lms/shared/ui'
import {
    MappingMultiFilter,
    MappingYearRange,
    displayLabel,
} from '@/app/lms/pages/servicemapping/components/MappingReportFilters'
import { businessModelDisplayName } from '@/app/lms/pages/clientmanagement/features/lib'
import { useClients, type Client } from '@/app/lms/pages/clientmanagement/api/clientManagementService'
import { courseStructuresSummaryQuery } from '@/app/lms/pages/coursestructure/api/createCourseStucture'
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
    /** Multi-select of course names, mirroring the way clients / services
     *  / models are picked. Was a free-text search string but that gave
     *  the reader nothing to browse — a report is chosen from what the
     *  data has, and every course name is already known at load time. */
    courses: string[]
    /** Individually ticked years — used when `period === 'years'`. */
    years: string[]
    /** Span bounds — used when `period === 'range'`. */
    from: string
    to: string
    period: PeriodMode
}

const EMPTY: Draft = {
    clients: [], services: [], models: [],
    courses: [], years: [], from: '', to: '',
    period: 'years',
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
    { key: 'primaryEmail', label: 'Primary Email', scope: 'client', column: 'Primary Email', dataKey: 'email' },
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
    { key: 'offeringYear', label: 'Offering Year', required: true, scope: 'service', column: 'Offering Year', dataKey: 'year' },
    { key: 'status', label: 'Status', scope: 'service', column: 'Status', dataKey: 'status' },
    { key: 'serviceModel', label: 'Service Model', scope: 'service', column: 'Service Model', dataKey: 'serviceModel' },
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
type CourseRecord = {
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

export default function CourseReportPage() {
    const [draft, setDraft] = useState<Draft>({ ...EMPTY })
    const [snapshot, setSnapshot] = useState<{ draft: Draft; rows: CourseRecord[]; generated: string } | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [printModalOpen, setPrintModalOpen] = useState(false)

    /* ── The course-structures summary. This is what the Courses tab
     *  reads too, so both tabs share the same cache entry. */
    const { data: coursesRes, isLoading: coursesLoading } = useQuery({ ...courseStructuresSummaryQuery() })
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
     *  the dropdown shows the company name rather than the raw id. */
    const options = useMemo(() => {
        const clientIds = new Set<string>()
        const services = new Set<string>()
        const models = new Set<string>()
        const years = new Set<string>()
        const courseNames = new Set<string>()
        for (const c of courses) {
            if (c.clientId) clientIds.add(String(c.clientId))
            const svc = String(c.serviceType || '').trim()
            if (svc) services.add(svc)
            const model = String(c.serviceModal || '').trim()
            if (model) models.add(model)
            const y = yearOf(c, mappingById)
            if (y) years.add(y)
            const name = String(c.courseName || '').trim()
            if (name) courseNames.add(name)
        }
        const clientOpts = [...clientIds].map((id) => {
            const record = clientById.get(id)
            return { value: id, label: record?.clientCompany || id }
        }).sort((a, b) => a.label.localeCompare(b.label))
        return {
            clients: clientOpts,
            services: [...services].sort().map((value) => ({ value, label: value })),
            models: [...models].sort().map((value) => ({ value, label: value })),
            courses: [...courseNames].sort().map((value) => ({ value, label: value })),
            years: [...years].sort(),
        }
    }, [courses, clientById, mappingById])

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
            courses: options.courses.map((o) => o.value),
            // Seed the year checklist with every year present so pressing
            // Generate right away answers "all years". Ignored while the
            // reader is in `range` mode.
            years: [...options.years].sort(),
        }))
    }, [courses.length, options.clients, options.services, options.models, options.courses, options.years])

    const hasDraft = Boolean(
        draft.clients.length || draft.services.length || draft.models.length
        || draft.courses.length || draft.years.length || draft.from || draft.to,
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
            const courseSet = asked.courses.length && asked.courses.length < options.courses.length
                ? new Set(asked.courses) : null
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
                if (courseSet && !courseSet.has(String(record.courseName || ''))) return false
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
    }, [draft, courses, mappingById, options.clients.length, options.services.length, options.models.length, options.courses.length, options.years.length])

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
            courses: options.courses.map((o) => o.value),
            years: [...options.years].sort(),
        })
        setSnapshot(null)
        setError('')
        setLoading(false)
    }

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
        describe('Service', asked.services, options.services.length)
        describe('Model', asked.models, options.models.length)
        describe('Course', asked.courses, options.courses.length)
        if (asked.period === 'range') {
            if (asked.from || asked.to) parts.push(`Providing Year: ${asked.from || '…'}–${asked.to || '…'}`)
        } else {
            describe('Providing Year', [...asked.years].sort(), options.years.length)
        }
        return parts.length ? `Filtered by  ·  ${parts.join('  ·  ')}` : ''
    }, [snapshot, options.services.length, options.models.length, options.courses.length, options.years.length])

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

                    {/* Top row — title on the left, Print on the right once a
                        report has been generated. */}
                    <div className="no-print flex shrink-0 flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                            <h1 className="text-sm font-semibold tracking-[-0.01em] text-heading sm:text-base">Report</h1>
                            <p className="mt-0.5 text-xs text-subtle">
                                Choose the courses you want to include in this report.
                            </p>
                        </div>
                        {snapshot && totalRows ? (
                            <div role="group" aria-label="Report output" className="flex shrink-0 flex-wrap items-center gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    className="text-xs font-bold"
                                    onClick={() => setPrintModalOpen(true)}
                                >
                                    <Printer className="size-3.5" />Print
                                </Button>
                            </div>
                        ) : null}
                    </div>

                    {/* ── The scope form ───────────────────────────────────
                        Filters run in the same left-to-right order Business
                        Reports uses: Service, Model, Course, Providing
                        year, and Client LAST. Client sits at the end
                        because it is the widest-scope narrowing — the
                        one the reader most often leaves at "all" — and
                        keeping the frequently-tweaked filters first
                        matches the pattern the other report page
                        already trained readers on. */}
                    <div className="no-print mt-3 shrink-0 rounded-xl border border-hairline bg-canvas/40 p-3">
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <div className="min-w-0">
                                <p className="mb-1.5 text-xs font-medium text-subtle">Service</p>
                                <MappingMultiFilter
                                    label="Services"
                                    options={options.services}
                                    value={draft.services}
                                    onChange={(services) => setDraft((d) => ({ ...d, services }))}
                                    placeholder="Select service"
                                />
                            </div>
                            <div className="min-w-0">
                                <p className="mb-1.5 text-xs font-medium text-subtle">Model</p>
                                <MappingMultiFilter
                                    label="Models"
                                    options={options.models}
                                    value={draft.models}
                                    onChange={(models) => setDraft((d) => ({ ...d, models }))}
                                    placeholder="Select model"
                                />
                            </div>
                            <div className="min-w-0">
                                <p className="mb-1.5 text-xs font-medium text-subtle">Course</p>
                                <MappingMultiFilter
                                    label="Courses"
                                    options={options.courses}
                                    value={draft.courses}
                                    onChange={(list) => setDraft((d) => ({ ...d, courses: list }))}
                                    placeholder="Select course"
                                />
                            </div>
                            <div className="min-w-0 [&>div>button]:w-full">
                                {/* Providing year — mirrors the two-mode
                                    control businessreports uses. The
                                    switch beside the label toggles the
                                    multi-select checklist (default, for
                                    picking one or two named years) and
                                    the from / to range (for a span).
                                    Switching CLEARS the other mode's
                                    state so a report never carries a
                                    stale year from a mode the reader
                                    already left. */}
                                <div className="mb-1.5 flex items-center justify-between gap-2">
                                    <p className="truncate text-xs font-medium text-subtle">Providing year</p>
                                    <label className="flex shrink-0 cursor-pointer items-center gap-1.5" title="Report on a span of years instead of individual ones">
                                        <span className={`text-[11px] font-medium ${draft.period === 'range' ? 'text-brand-strong' : 'text-subtle'}`}>Range</span>
                                        <Switch
                                            checked={draft.period === 'range'}
                                            onCheckedChange={(on) => setDraft((d) => (on
                                                ? { ...d, period: 'range', years: [] }
                                                : { ...d, period: 'years', from: '', to: '' }))}
                                            aria-label="Use a year range"
                                            className="scale-75"
                                        />
                                    </label>
                                </div>

                                {draft.period === 'years' ? (
                                    <MappingMultiFilter
                                        label="Years"
                                        options={options.years.map((year) => ({ value: year, label: year }))}
                                        value={draft.years}
                                        onChange={(years) => setDraft((d) => ({ ...d, years }))}
                                        placeholder="Select year"
                                    />
                                ) : (
                                    <MappingYearRange
                                        from={draft.from}
                                        to={draft.to}
                                        years={options.years}
                                        onChange={(from, to) => setDraft((d) => ({ ...d, from, to }))}
                                        placeholder="Select year range"
                                        hideRangeToggle
                                    />
                                )}
                            </div>

                            {/* Client — sits last so the filter row reads
                                Service → Model → Course → Providing year →
                                Client, the same order the Business Reports
                                filter row uses. */}
                            <div className="min-w-0">
                                <p className="mb-1.5 text-xs font-medium text-subtle">Client</p>
                                <MappingMultiFilter
                                    label="Clients"
                                    options={options.clients}
                                    value={draft.clients}
                                    onChange={(clients) => setDraft((d) => ({ ...d, clients }))}
                                    placeholder="Select client"
                                />
                            </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Button
                                type="button"
                                size="sm"
                                className="text-xs"
                                disabled={loading || coursesLoading}
                                onClick={() => generate()}
                            >
                                {loading ? <Loader2 className="size-3.5 animate-spin" /> : <BarChart3 className="size-3.5" />}
                                {loading ? 'Generating…' : 'Generate report'}
                            </Button>

                            {(hasDraft || snapshot) && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="text-xs"
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
                        </div>
                    </div>

                    {/* ── The report ─────────────────────────────────────── */}
                    <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
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
                            <div className={`transition-opacity ${loading ? 'opacity-50' : ''}`}>
                                <div className="no-print mb-3 flex flex-wrap items-center gap-2">
                                    <div className="flex h-8 items-center gap-2 rounded-lg border border-hairline bg-canvas/40 px-2.5">
                                        <span className="text-xs text-subtle">Clients</span>
                                        <span className="text-sm font-semibold tabular-nums text-heading">{report.blocks.length.toLocaleString()}</span>
                                    </div>
                                    <div className="flex h-8 items-center gap-2 rounded-lg border border-hairline bg-canvas/40 px-2.5">
                                        <span className="text-xs text-subtle">Courses</span>
                                        <span className="text-sm font-semibold tabular-nums text-heading">{totalRows.toLocaleString()}</span>
                                    </div>
                                    <span className="ml-auto text-[11px] text-faint">
                                        Generated {snapshot.generated}
                                    </span>
                                </div>

                                {filterSummary && (
                                    <p className="no-print mb-3 text-[11px] text-subtle">
                                        {filterSummary}
                                    </p>
                                )}

                                {!totalRows ? (
                                    <p className="rounded-xl border border-dashed border-hairline py-12 text-center text-sm text-subtle">
                                        Nothing matches this combination. Try a wider scope.
                                    </p>
                                ) : (
                                    <div className="overflow-hidden rounded-xl border border-hairline bg-white">
                                        <div className="max-w-full overflow-x-auto">
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
                                                    <tr className="bg-canvas/60">
                                                        <th className="border-b border-r border-hairline px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-subtle">S. No.</th>
                                                        <th className="border-b border-r border-hairline px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-subtle">Client</th>
                                                        <th className="border-b border-r border-hairline px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-subtle">Business Model</th>
                                                        <th className="border-b border-r border-hairline px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-subtle">Service Model</th>
                                                        <th className="border-b border-r border-hairline px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-subtle">Course Name</th>
                                                        <th className="border-b border-hairline px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-subtle">Providing Year</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(() => {
                                                        let counter = 0
                                                        return report.blocks.map((block, blockIdx) => block.services.map((svc, svcIdx) => {
                                                            counter += 1
                                                            const isFirst = svcIdx === 0
                                                            const boundary = isFirst && blockIdx > 0
                                                                ? 'border-t-2 border-hairline-strong'
                                                                : 'border-t border-hairline/60'
                                                            return (
                                                                <tr key={`${blockIdx}-${svcIdx}`} className={`${boundary} hover:bg-row-hover`}>
                                                                    <td className="border-r border-hairline/60 px-3 py-2 text-center align-middle tabular-nums text-subtle">
                                                                        {counter}
                                                                    </td>
                                                                    {isFirst && (
                                                                        <>
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
                                                        }))
                                                    })()}
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
