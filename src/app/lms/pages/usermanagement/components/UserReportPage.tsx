"use client"

/* User Management ▸ Reports.
 *
 * Mirrors the shape of Course Setup ▸ Report (a filter form, then a
 * snapshotted review table on Generate, plus a Print button that opens
 * the shared PrintPreviewModal) but is sourced from the users export
 * rather than course-structure records. What the reader is looking at
 * is a per-client roll-up of every user attached to the institution.
 *
 * Nothing loads until Generate report is pressed — the dropdowns are a
 * draft, and the table below is a snapshot of the draft at the moment
 * it was generated, so a filter fiddle after the fact cannot silently
 * disagree with the rows on screen. Leaving all filters alone and
 * pressing Generate reports on every user, which is the common case. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { BarChart3, Info, Loader2, Printer, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { pageEnter } from '@/app/lms/shared/ui'
import {
    MappingMultiFilter,
    displayLabel,
} from '@/app/lms/pages/servicemapping/components/MappingReportFilters'
import { businessModelDisplayName } from '@/app/lms/pages/clientmanagement/features/lib'
import { useClients, type Client } from '@/app/lms/pages/clientmanagement/api/clientManagementService'
import { useServiceMappings, type ServiceMapping } from '@/app/lms/pages/servicemapping/api/serviceMappingService'
import { fetchUsersForExport, type ServiceIndexEntry } from '../api/userService'
import {
    activeFormat, fetchReportSettings, newFormat,
    type ReportFormat, type ReportSettings,
} from '@/app/lms/pages/reportsettings/api/reportSettingsService'
import { BRAND_FALLBACK } from '@/app/lms/pages/reportsettings/api/brand'
import { fetchInstitutionById } from '@/app/lms/pages/instutionmanagement/api/institutionService'
import type { ReportClientBlock } from '@/app/lms/pages/servicemapping/components/serviceReport'
import { PrintPreviewModal, type FieldRow } from '@/app/lms/pages/businessreports/components/PrintPreviewModal'

/* ── Filter draft ─────────────────────────────────────────────────────
 *  Order mirrors the Users tab's filter panel:
 *    Business Model → Service Providing Year → Service Model →
 *    Client → Course → Role, with Status still available for the
 *    account-state narrowing. The `services` key holds Business Model
 *    values in this codebase (see Course Setup's MappingFilterPanel). */
type Draft = {
    roles: string[]
    services: string[]
    serviceModels: string[]
    statuses: string[]
    clients: string[]
    providingYears: string[]
    courses: string[]
}

const EMPTY: Draft = {
    roles: [], services: [], serviceModels: [], statuses: [], clients: [],
    providingYears: [], courses: [],
}

/** "active" → "Active". */
const capitalise = (value: string) => value ? value.charAt(0).toUpperCase() + value.slice(1) : value

/** The stored clientAddress carries the three lines the client form
 *  builds — Address Line, City, State - Pincode. This helper reverses
 *  that so the report can offer City / State / Pincode as their own
 *  columns instead of dumping the whole string. Kept in step with the
 *  mirror in coursestructure/components/CourseReportPage.tsx. */
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
 *  block; service-scope rows render one per user under the client. */
const USER_FIELDS: FieldRow[] = [
    // Client scope
    { key: 'clientName', label: 'Client Name', required: true, scope: 'client', column: 'Client', dataKey: 'client' },
    { key: 'clientId', label: 'Client ID', scope: 'client', column: 'Client ID', dataKey: 'clientId' },
    { key: 'businessModel', label: 'Business Model', scope: 'client', column: 'Business Model', dataKey: 'business' },
    // Service scope — the mapping the user belongs to.
    { key: 'service', label: 'Service', scope: 'service', column: 'Service', dataKey: 'service' },
    { key: 'serviceModel', label: 'Service Model', scope: 'service', column: 'Service Model', dataKey: 'serviceModel' },
    // User scope — mapped to `service` scope so the paginator emits one
    // row per user, the same shape ReportClientBlock and PrintPreviewModal
    // already understand.
    { key: 'userName', label: 'User Name', required: true, scope: 'service', column: 'User Name', dataKey: 'userName' },
    { key: 'userEmail', label: 'Email', scope: 'service', column: 'Email', dataKey: 'userEmail' },
    { key: 'userRole', label: 'Role', scope: 'service', column: 'Role', dataKey: 'userRole' },
    { key: 'userStatus', label: 'Status', scope: 'service', column: 'Status', dataKey: 'userStatus' },
    { key: 'userPhone', label: 'Phone', scope: 'service', column: 'Phone', dataKey: 'userPhone' },
]

/* Default Customize Fields set — the five user-scope columns the
 * reader wants on the printed sheet by default. Client / Business
 * Model / Service / Service Model are all AVAILABLE (see USER_FIELDS
 * above) but start unticked; toggling them on switches the printed
 * sheet to the per-client rowspanned layout, and toggling them off
 * gives the sheet ONE ROW PER USER with its own S. No. */
const USER_DEFAULT_ENABLED = new Set(['userName', 'userEmail', 'userPhone', 'userRole', 'userStatus'])

/* ── Reading a user record ────────────────────────────────────────────
 *  The export payload types users as `any`; this narrows the fields
 *  the report actually consumes. Legacy top-level clientId/serviceModel/
 *  serviceMappingId is treated as the FIRST enrolment; anything in
 *  `services[]` was added later by Reassign Users. */
type ClientRef = { _id?: unknown; clientCompany?: string; businessModel?: string }
type MappingRef = { _id?: unknown; service?: string }
type ServiceEntry = { clientId?: unknown; clientName?: unknown; serviceMappingId?: unknown; serviceModel?: unknown }
type UserRecord = {
    _id?: string
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
    status?: string
    role?: { renameRole?: string; originalRole?: string; _id?: string } | string
    clientId?: unknown
    clientName?: unknown
    serviceMappingId?: unknown
    serviceModel?: unknown
    services?: ServiceEntry[]
}

const asClient = (value: unknown): ClientRef | undefined =>
    value && typeof value === 'object' ? value as ClientRef : undefined
const asMapping = (value: unknown): MappingRef | undefined =>
    value && typeof value === 'object' ? value as MappingRef : undefined
const idOf = (value: unknown): string => {
    if (!value) return ''
    if (typeof value === 'string') return value
    const record = value as { _id?: unknown }
    return record._id ? String(record._id) : String(value)
}

const UNASSIGNED = '__no_client__'

/** Every (client, service, service model) a user belongs to — one entry
 *  per enrolment. A user enrolled with two clients belongs under both. */
type Enrolment = {
    clientKey: string
    clientName: string
    service: string
    serviceModel: string
    serviceMappingId: string
}

/* Users created before `serviceMappingId` existed carry a service-model
   name and nothing else — this resolves those: given the client and the
   model, the mapping that offers it names the service. Ambiguous cases
   (two of the client's services offer the same model) resolve to nothing
   rather than to a guess. */
function serviceResolver(index: ServiceIndexEntry[]) {
    const byPair = new Map<string, string | null>()
    ;(index || []).forEach((mapping) => {
        const client = String(mapping.client || '')
        if (!client || !mapping.service) return
        ;(mapping.serviceModels || []).forEach((model) => {
            const key = `${client}|${String(model).trim().toLowerCase()}`
            if (!byPair.has(key)) byPair.set(key, mapping.service as string)
            else if (byPair.get(key) !== mapping.service) byPair.set(key, null)
        })
    })
    return (clientKey: string, model: string) =>
        byPair.get(`${clientKey}|${model.trim().toLowerCase()}`) || ''
}

function enrolmentsOf(entry: UserRecord): Enrolment[] {
    const rows: Enrolment[] = []
    const push = (rawClient: unknown, rawName: unknown, rawMapping: unknown, rawModel: unknown) => {
        const client = asClient(rawClient)
        const mapping = asMapping(rawMapping)
        const clientKey = idOf(rawClient) || String(rawName ?? '').trim()
        const name = client?.clientCompany || String(rawName ?? '').trim()
        const service = mapping?.service || ''
        const model = String(rawModel ?? '').trim()
        // An entry with nothing in it at all is a schema artefact — an
        // empty `services[]` slot left by an earlier edit.
        if (!clientKey && !name && !service && !model) return
        rows.push({
            clientKey: clientKey || UNASSIGNED,
            clientName: name,
            service,
            serviceModel: model,
            serviceMappingId: idOf(rawMapping),
        })
    }

    push(entry.clientId, entry.clientName, entry.serviceMappingId, entry.serviceModel)
    const extra = Array.isArray(entry.services) ? entry.services : []
    extra.forEach((item) => push(item?.clientId, item?.clientName, item?.serviceMappingId, item?.serviceModel))

    // A user with no client at all still belongs in the report under
    // "No client assigned" — dropping them would make the totals lie.
    if (!rows.length) rows.push({ clientKey: UNASSIGNED, clientName: '', service: '', serviceModel: '', serviceMappingId: '' })

    // Two identical enrolments (the legacy pair duplicated into services[])
    // is one enrolment as far as the reader is concerned.
    const seen = new Set<string>()
    return rows.filter((row) => {
        const key = `${row.clientKey}|${row.service}|${row.serviceModel}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })
}

const roleName = (role: UserRecord['role']): string => {
    if (!role) return ''
    if (typeof role === 'string') return role
    return role.renameRole || role.originalRole || ''
}
const roleId = (role: UserRecord['role']): string => {
    if (!role) return ''
    if (typeof role === 'string') return role
    return role._id || ''
}

export default function UserReportPage() {
    const [draft, setDraft] = useState<Draft>({ ...EMPTY })
    const [snapshot, setSnapshot] = useState<{ draft: Draft; rows: UserRecord[]; serviceIndex: ServiceIndexEntry[]; generated: string } | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [printModalOpen, setPrintModalOpen] = useState(false)

    /* ── Auth ── The institution and token the users endpoint needs.
     *  Read from localStorage on mount, the same shape the rest of the
     *  page uses. Absent when the reader is not signed in — the query
     *  stays disabled until both are present. */
    const [institutionId, setInstitutionId] = useState<string | null>(null)
    const [token, setToken] = useState<string | null>(null)
    useEffect(() => {
        if (typeof window === 'undefined') return
        setInstitutionId(localStorage.getItem('smartcliff_institution'))
        setToken(localStorage.getItem('smartcliff_token'))
    }, [])

    /* ── The full users export. Shares its own cache entry — pulling the
     *  whole directory a second time when the Print modal opens would
     *  be wasteful. `enabled` waits for the auth pair to arrive. */
    const { data: exportRes, isLoading: usersLoading } = useQuery({
        queryKey: ['usermanagement', 'reportExport', institutionId] as const,
        queryFn: async () => {
            if (!institutionId || !token) return { rows: [] as UserRecord[], serviceIndex: [] as ServiceIndexEntry[] }
            const rows = await fetchUsersForExport(institutionId, token, {}) as UserRecord[] & { serviceIndex?: ServiceIndexEntry[] }
            const serviceIndex = Array.isArray(rows.serviceIndex) ? rows.serviceIndex : []
            return { rows: rows as UserRecord[], serviceIndex }
        },
        enabled: Boolean(institutionId && token),
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    })
    const users: UserRecord[] = useMemo(() => exportRes?.rows ?? [], [exportRes])
    const serviceIndex: ServiceIndexEntry[] = useMemo(() => exportRes?.serviceIndex ?? [], [exportRes])

    const { data: clientList } = useClients()
    const clientById = useMemo(() => {
        const map = new Map<string, Client>()
        for (const client of clientList ?? []) map.set(String(client._id), client)
        return map
    }, [clientList])

    /* ── Mapping lookup for Course and Providing Year ─────────────────
     *  A user's enrolment carries a serviceMappingId; the mapping
     *  carries the "Providing Year" and the list of courses it teaches.
     *  Same pattern Course Setup ▸ Report uses (CourseReportPage), so
     *  both reports read the same source of truth. */
    const { data: mappings } = useServiceMappings()
    const mappingById = useMemo(() => {
        const map = new Map<string, ServiceMapping>()
        for (const mapping of mappings ?? []) map.set(String(mapping._id), mapping)
        return map
    }, [mappings])

    /* ── The letterhead a designed export prints. Same pattern as the
     *  course-structure report — one fetch per mount, silent fall-back
     *  to the built-in layout / brand wording when neither exists. */
    const [reportSettings, setReportSettings] = useState<ReportSettings | undefined>()
    const [letterhead, setLetterhead] = useState<{ org: string; address: string; contact: string }>(BRAND_FALLBACK)
    useEffect(() => {
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
    }, [institutionId])

    /* ── Facet options ────────────────────────────────────────────────
     *  Every unique role / service / model / status / client the loaded
     *  export contains. Client labels come from the clients query so
     *  the dropdown shows the company name rather than the raw id. */
    const resolveServiceFor = useMemo(() => serviceResolver(serviceIndex), [serviceIndex])
    const options = useMemo(() => {
        const roleIds = new Map<string, string>()
        const services = new Set<string>()
        const serviceModels = new Set<string>()
        const statuses = new Set<string>()
        const clientIds = new Set<string>()
        // Course + Providing Year come off the SERVICE MAPPING each user is
        // enrolled with, not off the user record. Following each user's
        // serviceMappingId into mappingById gives the mapping's `year` and
        // `courses[]` — the same source of truth Course Setup ▸ Report reads.
        const providingYears = new Set<string>()
        const courseNames = new Map<string, string>() // key: lower-case name, value: display name
        for (const user of users) {
            const rId = roleId(user.role)
            const rName = roleName(user.role)
            if (rId && !roleIds.has(rId)) roleIds.set(rId, rName || rId)
            const status = String(user.status || '').trim()
            if (status) statuses.add(status)
            for (const enrolment of enrolmentsOf(user)) {
                if (enrolment.clientKey && enrolment.clientKey !== UNASSIGNED) clientIds.add(enrolment.clientKey)
                const svc = enrolment.service || resolveServiceFor(enrolment.clientKey, enrolment.serviceModel)
                if (svc) services.add(svc)
                if (enrolment.serviceModel) serviceModels.add(enrolment.serviceModel)
                const mapping = enrolment.serviceMappingId ? mappingById.get(enrolment.serviceMappingId) : undefined
                if (mapping) {
                    const year = String(mapping.year ?? '').trim()
                    if (year) providingYears.add(year)
                    for (const course of mapping.courses ?? []) {
                        const name = String(course.courseName ?? '').trim()
                        if (!name) continue
                        const key = name.toLowerCase()
                        if (!courseNames.has(key)) courseNames.set(key, name)
                    }
                }
            }
        }
        const clientOpts = [...clientIds].map((id) => {
            const record = clientById.get(id)
            return { value: id, label: record?.clientCompany || id }
        }).sort((a, b) => a.label.localeCompare(b.label))
        return {
            roles: [...roleIds.entries()].map(([id, label]) => ({ value: id, label }))
                .sort((a, b) => a.label.localeCompare(b.label)),
            services: [...services].sort().map((value) => ({ value, label: value })),
            serviceModels: [...serviceModels].sort().map((value) => ({ value, label: value })),
            statuses: [...statuses].sort().map((value) => ({ value, label: capitalise(value) })),
            clients: clientOpts,
            providingYears: [...providingYears].sort().map((value) => ({ value, label: value })),
            courses: [...courseNames.entries()]
                .map(([value, label]) => ({ value, label }))
                .sort((a, b) => a.label.localeCompare(b.label)),
        }
    }, [users, clientById, resolveServiceFor, mappingById])

    /* ── Seed every filter as "everything selected" once the users have
     *  loaded, so pressing Generate right away answers "show me the
     *  whole directory" without any setup. Seeded once. */
    const seeded = useRef(false)
    useEffect(() => {
        if (seeded.current || !users.length) return
        seeded.current = true
        setDraft((d) => ({
            ...d,
            roles: options.roles.map((o) => o.value),
            services: options.services.map((o) => o.value),
            serviceModels: options.serviceModels.map((o) => o.value),
            statuses: options.statuses.map((o) => o.value),
            clients: options.clients.map((o) => o.value),
            providingYears: options.providingYears.map((o) => o.value),
            courses: options.courses.map((o) => o.value),
        }))
    }, [users.length, options.roles, options.services, options.serviceModels, options.statuses, options.clients, options.providingYears, options.courses])

    const hasDraft = Boolean(
        draft.roles.length || draft.services.length || draft.serviceModels.length
        || draft.statuses.length || draft.clients.length
        || draft.providingYears.length || draft.courses.length,
    )

    const generate = useCallback(() => {
        setLoading(true)
        setError('')
        const asked: Draft = { ...draft }
        try {
            // "Everything ticked" collapses to "no narrowing" so the
            // filter is a real narrowing, not a set-equality check.
            const roleSet = asked.roles.length && asked.roles.length < options.roles.length
                ? new Set(asked.roles) : null
            const serviceSet = asked.services.length && asked.services.length < options.services.length
                ? new Set(asked.services) : null
            const modelSet = asked.serviceModels.length && asked.serviceModels.length < options.serviceModels.length
                ? new Set(asked.serviceModels) : null
            const statusSet = asked.statuses.length && asked.statuses.length < options.statuses.length
                ? new Set(asked.statuses) : null
            const clientSet = asked.clients.length && asked.clients.length < options.clients.length
                ? new Set(asked.clients) : null
            const yearSet = asked.providingYears.length && asked.providingYears.length < options.providingYears.length
                ? new Set(asked.providingYears) : null
            const courseSet = asked.courses.length && asked.courses.length < options.courses.length
                ? new Set(asked.courses) : null

            const rows = users.filter((user) => {
                if (roleSet && !roleSet.has(roleId(user.role))) return false
                if (statusSet && !statusSet.has(String(user.status || ''))) return false
                if (clientSet || serviceSet || modelSet || yearSet || courseSet) {
                    // The user's enrolments must include at least one that
                    // matches every enrolment-scoped filter simultaneously.
                    const matches = enrolmentsOf(user).some((enrolment) => {
                        if (clientSet && !clientSet.has(enrolment.clientKey)) return false
                        const svc = enrolment.service || resolveServiceFor(enrolment.clientKey, enrolment.serviceModel)
                        if (serviceSet && !serviceSet.has(svc)) return false
                        if (modelSet && !modelSet.has(enrolment.serviceModel)) return false
                        // Year + Course come off the enrolment's SERVICE
                        // MAPPING — same source of truth the option list uses.
                        if (yearSet || courseSet) {
                            const mapping = enrolment.serviceMappingId ? mappingById.get(enrolment.serviceMappingId) : undefined
                            if (yearSet) {
                                const year = String(mapping?.year ?? '').trim()
                                if (!year || !yearSet.has(year)) return false
                            }
                            if (courseSet) {
                                const teaches = (mapping?.courses ?? []).some((course) => {
                                    const key = String(course.courseName ?? '').trim().toLowerCase()
                                    return key && courseSet.has(key)
                                })
                                if (!teaches) return false
                            }
                        }
                        return true
                    })
                    if (!matches) return false
                }
                return true
            })

            setSnapshot({ draft: asked, rows, serviceIndex, generated: new Date().toLocaleString() })
        } catch (err) {
            setError(err instanceof Error && err.message ? err.message : 'Could not build the report. Please try again.')
        } finally {
            setLoading(false)
        }
    }, [draft, users, serviceIndex, resolveServiceFor, mappingById, options.roles.length, options.services.length, options.serviceModels.length, options.statuses.length, options.clients.length, options.providingYears.length, options.courses.length])

    /* ── Group into per-client blocks with rowspan-friendly shape ──── */
    const generatedTimestamp = snapshot?.generated ?? ''
    const report = useMemo(() => {
        if (!snapshot) return null
        const resolveService = serviceResolver(snapshot.serviceIndex)
        type Node = { clientKey: string; clientName: string; rows: { user: UserRecord; enrolment: Enrolment; service: string }[] }
        const byClient = new Map<string, Node>()
        for (const user of snapshot.rows) {
            const enrolments = enrolmentsOf(user).filter((enrolment) => {
                const asked = snapshot.draft
                if (asked.clients.length && asked.clients.length < options.clients.length
                    && !asked.clients.includes(enrolment.clientKey)) return false
                const svc = enrolment.service || resolveService(enrolment.clientKey, enrolment.serviceModel)
                if (asked.services.length && asked.services.length < options.services.length
                    && !asked.services.includes(svc)) return false
                if (asked.serviceModels.length && asked.serviceModels.length < options.serviceModels.length
                    && !asked.serviceModels.includes(enrolment.serviceModel)) return false
                const narrowedYear = asked.providingYears.length && asked.providingYears.length < options.providingYears.length
                const narrowedCourse = asked.courses.length && asked.courses.length < options.courses.length
                if (narrowedYear || narrowedCourse) {
                    const mapping = enrolment.serviceMappingId ? mappingById.get(enrolment.serviceMappingId) : undefined
                    if (narrowedYear) {
                        const year = String(mapping?.year ?? '').trim()
                        if (!year || !asked.providingYears.includes(year)) return false
                    }
                    if (narrowedCourse) {
                        const teaches = (mapping?.courses ?? []).some((course) => {
                            const key = String(course.courseName ?? '').trim().toLowerCase()
                            return key && asked.courses.includes(key)
                        })
                        if (!teaches) return false
                    }
                }
                return true
            })
            if (!enrolments.length) continue
            for (const enrolment of enrolments) {
                const clientKey = enrolment.clientKey || UNASSIGNED
                const clientRecord = clientById.get(clientKey)
                const name = clientRecord?.clientCompany
                    || enrolment.clientName
                    || (clientKey === UNASSIGNED ? 'No client assigned' : 'Unnamed client')
                const node = byClient.get(clientKey) || { clientKey, clientName: name, rows: [] }
                const svc = enrolment.service || resolveService(clientKey, enrolment.serviceModel)
                node.rows.push({ user, enrolment, service: svc })
                byClient.set(clientKey, node)
            }
        }

        const blocks: ReportClientBlock[] = [...byClient.values()]
            .sort((a, b) => {
                if (a.clientKey === UNASSIGNED) return 1
                if (b.clientKey === UNASSIGNED) return -1
                return a.clientName.localeCompare(b.clientName)
            })
            .map((node) => {
                const clientRecord = clientById.get(node.clientKey)
                const rawBusiness = clientRecord?.businessModel || ''
                const business = rawBusiness
                    ? businessModelDisplayName(rawBusiness) || rawBusiness
                    : 'No business model'
                const addressParts = parseClientAddress(clientRecord?.clientAddress || '')
                const clientExtras: Record<string, string> = {
                    clientId: clientRecord?.clientId || '—',
                    businessModel: business,
                    clientStatus: clientRecord?.status ? capitalise(clientRecord.status) : '—',
                    address: clientRecord?.clientAddress || '—',
                    addressLine: addressParts.line || '—',
                    city: addressParts.city || '—',
                    state: addressParts.state || '—',
                    pincode: addressParts.pincode || '—',
                }
                const services: Record<string, string>[] = [...node.rows]
                    .sort((a, b) => {
                        const na = `${a.user.firstName || ''} ${a.user.lastName || ''}`.trim().toLowerCase()
                        const nb = `${b.user.firstName || ''} ${b.user.lastName || ''}`.trim().toLowerCase()
                        return na.localeCompare(nb)
                    })
                    .map((row) => {
                        const first = String(row.user.firstName || '').trim()
                        const last = String(row.user.lastName || '').trim()
                        const fullName = `${first} ${last}`.trim()
                        return {
                            userName: fullName || '—',
                            userEmail: String(row.user.email || '').trim() || '—',
                            userPhone: String(row.user.phone || '').trim() || '—',
                            userRole: roleName(row.user.role) || '—',
                            userStatus: row.user.status ? capitalise(String(row.user.status)) : '—',
                            service: row.service ? displayLabel(row.service) : '—',
                            serviceModel: row.enrolment.serviceModel
                                ? displayLabel(row.enrolment.serviceModel) : '—',
                            generatedDate: generatedTimestamp,
                        }
                    })
                return { client: node.clientName, business, clientExtras, services }
            })

        return { blocks }
    }, [snapshot, clientById, generatedTimestamp, mappingById, options.clients.length, options.services.length, options.serviceModels.length, options.providingYears.length, options.courses.length])

    const totalRows = report?.blocks.reduce((sum, block) => sum + block.services.length, 0) ?? 0

    const reset = () => {
        setDraft({
            ...EMPTY,
            roles: options.roles.map((o) => o.value),
            services: options.services.map((o) => o.value),
            serviceModels: options.serviceModels.map((o) => o.value),
            statuses: options.statuses.map((o) => o.value),
            clients: options.clients.map((o) => o.value),
            providingYears: options.providingYears.map((o) => o.value),
            courses: options.courses.map((o) => o.value),
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
        const roleLabelFor = (id: string) => options.roles.find((o) => o.value === id)?.label || id
        const describe = (label: string, values: string[], total: number, formatter?: (value: string) => string) => {
            if (!values.length || values.length >= total) return
            const format = formatter ?? displayLabel
            parts.push(values.length <= 4
                ? `${label}: ${values.map(format).join(', ')}`
                : `${label}: ${values.slice(0, 3).map(format).join(', ')} +${values.length - 3} more`)
        }
        const courseLabelFor = (value: string) => options.courses.find((o) => o.value === value)?.label || value
        describe('Business Model', asked.services, options.services.length)
        describe('Providing Year', asked.providingYears, options.providingYears.length, (v) => v)
        describe('Service Model', asked.serviceModels, options.serviceModels.length)
        describe('Course', asked.courses, options.courses.length, courseLabelFor)
        describe('Role', asked.roles, options.roles.length, roleLabelFor)
        describe('Status', asked.statuses, options.statuses.length, capitalise)
        return parts.length ? `Filtered by  ·  ${parts.join('  ·  ')}` : ''
    }, [snapshot, options.roles, options.services.length, options.serviceModels.length, options.statuses.length, options.providingYears.length, options.courses])

    const printMeta = useMemo(() => ({
        title: 'Users report',
        scope: report
            ? `${report.blocks.length} client${report.blocks.length === 1 ? '' : 's'}  ·  ${totalRows} user${totalRows === 1 ? '' : 's'}`
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
                    {/* ── The scope form ───────────────────────────────────
                        Order mirrors the Users tab's filter panel:
                          Business Model → Service Providing Year →
                          Service Model → Client → Course → Role, with
                        Status kept at the end for the account-state
                        narrowing the shared four don't have. */}
                    <div className="no-print mt-3 shrink-0 rounded-xl border border-hairline bg-canvas/40 p-3">
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">

                            <div className="min-w-0">
                                <p className="mb-1.5 text-xs font-medium text-subtle">Business Model</p>
                                <MappingMultiFilter
                                    label="Business Model"
                                    options={options.services}
                                    value={draft.services}
                                    onChange={(services) => setDraft((d) => ({ ...d, services }))}
                                    placeholder="Select business model"
                                />
                            </div>
                            <div className="min-w-0">
                                <p className="mb-1.5 text-xs font-medium text-subtle">Service Providing Year</p>
                                <MappingMultiFilter
                                    label="Service Providing Year"
                                    options={options.providingYears}
                                    value={draft.providingYears}
                                    onChange={(providingYears) => setDraft((d) => ({ ...d, providingYears }))}
                                    placeholder="Select service providing year"
                                />
                            </div>
                            <div className="min-w-0">
                                <p className="mb-1.5 text-xs font-medium text-subtle">Service Model</p>
                                <MappingMultiFilter
                                    label="Service Model"
                                    options={options.serviceModels}
                                    value={draft.serviceModels}
                                    onChange={(serviceModels) => setDraft((d) => ({ ...d, serviceModels }))}
                                    placeholder="Select service model"
                                />
                            </div>
                            <div className="min-w-0">
                                <p className="mb-1.5 text-xs font-medium text-subtle">Client</p>
                                <MappingMultiFilter
                                    label="Client"
                                    options={options.clients}
                                    value={draft.clients}
                                    onChange={(clients) => setDraft((d) => ({ ...d, clients }))}
                                    placeholder="Select client"
                                />
                            </div>
                            <div className="min-w-0">
                                <p className="mb-1.5 text-xs font-medium text-subtle">Course</p>
                                <MappingMultiFilter
                                    label="Course"
                                    options={options.courses}
                                    value={draft.courses}
                                    onChange={(courses) => setDraft((d) => ({ ...d, courses }))}
                                    placeholder="Select course"
                                />
                            </div>
                            <div className="min-w-0">
                                <p className="mb-1.5 text-xs font-medium text-subtle">Role</p>
                                <MappingMultiFilter
                                    label="Role"
                                    options={options.roles}
                                    value={draft.roles}
                                    onChange={(roles) => setDraft((d) => ({ ...d, roles }))}
                                    placeholder="Select role"
                                />
                            </div>
                            <div className="min-w-0">
                                <p className="mb-1.5 text-xs font-medium text-subtle">Status</p>
                                <MappingMultiFilter
                                    label="Status"
                                    options={options.statuses}
                                    value={draft.statuses}
                                    onChange={(statuses) => setDraft((d) => ({ ...d, statuses }))}
                                    placeholder="Select status"
                                />
                            </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Button
                                type="button"
                                size="sm"
                                className="text-xs"
                                disabled={loading || usersLoading}
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

                            {/* Preview & Print — opens the preview modal
                                that owns the actual Print / PDF actions.
                                Pinned right on the Generate row, green
                                as the final-step action. */}
                            {snapshot && totalRows ? (
                                <Button
                                    type="button"
                                    size="sm"
                                    className="ml-auto text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600"
                                    onClick={() => setPrintModalOpen(true)}
                                >
                                    <Printer className="size-3.5" />Preview &amp; Print
                                </Button>
                            ) : null}
                        </div>
                    </div>

                    {/* ── The report ───────────────────────────────────────
                        Flex column so the table card can claim every pixel
                        remaining below the filter card. Only the table body
                        scrolls; the outer container is not scrollable so
                        the reader never sees a nested pair of scrollbars. */}
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
                                    <div className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-xl border border-hairline bg-white">
                                        {/* Single scroll container filling remaining
                                            viewport — no nested scrollbars, sticky
                                            thead sticks to the top of this container. */}
                                        <div className="min-h-0 flex-1 overflow-auto">
                                            <table className="w-full table-fixed border-collapse text-xs">
                                                {/* Six columns after Generate — the user-scope
                                                    default set: S. No. / User Name / Email /
                                                    Phone / Role / Status. Client and Business
                                                    Model are OFF by default; the reader ticks
                                                    them in Customize Fields when they want a
                                                    per-client roll-up on the printed sheet.
                                                    No rowspan here: every user is its own row
                                                    and its own S.No, since without a Client
                                                    column there is no block to merge under.
                                                    Widths sum to 100. */}
                                                <colgroup>
                                                    <col style={{ width: '6%' }} />
                                                    <col style={{ width: '22%' }} />
                                                    <col style={{ width: '26%' }} />
                                                    <col style={{ width: '16%' }} />
                                                    <col style={{ width: '18%' }} />
                                                    <col style={{ width: '12%' }} />
                                                </colgroup>
                                                <thead>
                                                    <tr>
                                                        <th className="sticky top-0 z-10 bg-canvas border-b border-r border-hairline px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-subtle">S. No.</th>
                                                        <th className="sticky top-0 z-10 bg-canvas border-b border-r border-hairline px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-subtle">User Name</th>
                                                        <th className="sticky top-0 z-10 bg-canvas border-b border-r border-hairline px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-subtle">Email</th>
                                                        <th className="sticky top-0 z-10 bg-canvas border-b border-r border-hairline px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-subtle">Phone</th>
                                                        <th className="sticky top-0 z-10 bg-canvas border-b border-r border-hairline px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-subtle">Role</th>
                                                        <th className="sticky top-0 z-10 bg-canvas border-b border-hairline px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-subtle">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(() => {
                                                        let counter = 0
                                                        return report.blocks.flatMap((block, blockIdx) => block.services.map((svc, svcIdx) => {
                                                            counter += 1
                                                            return (
                                                                <tr key={`${blockIdx}-${svcIdx}`} className="border-t border-hairline/60 hover:bg-row-hover">
                                                                    <td className="border-r border-hairline/60 px-3 py-2 text-center align-middle tabular-nums text-subtle">
                                                                        {counter}
                                                                    </td>
                                                                    <td className="border-r border-hairline/60 px-3 py-2 align-middle text-body" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                                                                        {svc.userName || '—'}
                                                                    </td>
                                                                    <td className="border-r border-hairline/60 px-3 py-2 align-middle text-body" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                                                                        {svc.userEmail || '—'}
                                                                    </td>
                                                                    <td className="border-r border-hairline/60 px-3 py-2 align-middle text-body" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                                                                        {svc.userPhone || '—'}
                                                                    </td>
                                                                    <td className="border-r border-hairline/60 px-3 py-2 align-middle text-body" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                                                                        {svc.userRole || '—'}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-center align-middle text-body">
                                                                        {svc.userStatus || '—'}
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
                Reports and Course Setup ▸ Report use, with the Users-
                report field list. */}
            <PrintPreviewModal
                open={printModalOpen}
                onClose={() => setPrintModalOpen(false)}
                snapshot={snapshot ? { draft: snapshot.draft, rows: [] as ServiceMapping[], generated: snapshot.generated } : null}
                blocks={report?.blocks ?? []}
                letterhead={letterhead}
                initialFormat={initialFormat}
                meta={printMeta}
                fields={USER_FIELDS}
                defaultEnabled={USER_DEFAULT_ENABLED}
            />
        </>
    )
}
