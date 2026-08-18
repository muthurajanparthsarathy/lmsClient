"use client"
import { getToken } from "@/lib/session";

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
    Layers, Trash2, Plus, X, Building, Check, ChevronDown, Search,
    ArrowLeft, ArrowRight, AlertTriangle, Loader2, Edit,
    Lock, Briefcase, ListTree, BookOpen,
    HelpCircle,
    SlidersHorizontal, LayoutGrid, List, MoreHorizontal, Download,
    MoreVertical, Settings2, ChevronLeft, ChevronRight, Eye,
} from 'lucide-react'
import { toast } from 'react-toastify'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import DashboardLayout from '../../component/layout'
import { useClients, type Client } from '@/apiServices/clientManagementService'
import {
    useServiceMappingsPage, useClientGroupsPage, useMappingsByClient,
    useCreateServiceMapping, useUpdateServiceMapping,
    useDeleteServiceMapping, useToggleServiceMappingStatus, serviceMappingApi, serviceMappingKeys,
    useInvalidateMappingCaches,
    type ServiceMapping, type ServiceMappingInput, type MappedClientRef,
    type HierarchyLevelConfig, type MasterDataEntry, type BatchConfig, type MappedCourse,
} from '@/apiServices/serviceMappingService'
import { useServices } from '@/apiServices/dynamicFields/servicemodel'
import { degreeService, type Degree } from '@/apiServices/dynamicFields/degreeService'
// Course setup — the mapping now creates the course itself, reusing the Course
// Management popup's data plumbing, for the category and course-name lists.
import { useCourseData } from '../../component/Addcoursestructure/useCourseData'
import { initialCourseFormData } from '../../component/Addcoursestructure/utils/constants'
import type {
    FormData as CourseFormData,
    Category as CourseCategory,
} from '../../component/Addcoursestructure/types'
import { createCourseStructure, updateCourseStructure, courseStructuresSummaryQuery } from '@/apiServices/createCourseStucture'
// Step 3 reuses Course Setup's own Resource Type section verbatim — see
// ResourceDefaultsStep below.
import ResourceTypeSection from '../../component/Resourcetypesection '
import { initializeResourcesType } from '../../component/Addcoursestructure/utils/helpers'
import { FieldLabel, FieldError } from './components/shared/primitives'
import MappingPreview, { type MappingPreviewProps } from './components/MappingPreview'
// Step 2's two narrow flows are Moodle-style accordions of their own, matching
// Course Setup. Both are pure presentation — every value and mutation below is
// still owned here and handed down.
import PlacementForm from './components/PlacementForm'
import SimpleCourseForm, { DEFAULT_BATCH_COUNT } from './components/SimpleCourseForm'
import { FieldRow } from './components/shared/SectionForm'
import DegreeSetupForm from './components/DegreeSetupForm'
import WizardTour, { type WizardTourHandle } from './components/WizardTour'
// The listing chrome is the shared Business Management kit, so Services and
// Clients stay one implementation rather than two that drift.
import DataTable, { type Column, type SortDir } from '../../shared/listing/DataTable'
import TableFooter from '../../shared/listing/TableFooter'
import { EmptyState, pageEnter } from '../../shared/ui'
import { HeaderStats } from '../../shared/ui/HeaderStats'
// Redesigned listing workspace (presentation only — all data + handlers stay in
// ServiceMappingView below and are passed down).
import { buildRowVM, extractHierarchy, ClientAvatar, type MappingRowVM } from './components/workspaceShared'
import MappingWorkspaceTable from './components/MappingWorkspaceTable'
import MappingHierarchyCards from './components/MappingHierarchyCards'
import { MappingWorkspaceFilterPanel } from './components/MappingWorkspaceFilterPanel'
import MappingDetailPanel from './components/MappingDetailPanel'
import Workbench from './components/HierarchyBuilder/Workbench'
import { PATH_SEP, blankCourse, type CourseEntry, type CourseApi, type DegreeView } from './components/HierarchyBuilder/types'
import { isUnder, type Scope } from './components/HierarchyBuilder/scope'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSION_IDS } from '@/components/permissions'

// ─── Configuration (data-driven — extend here, no component changes needed) ───

// Hierarchy levels shown in Step 2 for generic services, top → bottom (matches
// the legacy Client Management structure — courses live in Course Management).
// `Phase` is intentionally NOT here: it only applies to the Placement Training
// flow, which supplies its own fixed level list (see the wizard).
const HIERARCHY_LEVELS = ['Batch', 'Degree', 'Department', 'Section', 'Semester']

// Every level the wizard can ever persist (superset of HIERARCHY_LEVELS plus the
// Placement-Training-only `Phase`). Used when saving the hierarchy config so a
// level is never dropped just because it isn't in the generic list.
const ALL_LEVELS = ['Batch', 'Phase', 'Degree', 'Department', 'Section', 'Semester']

// Per-level wizard metadata: hint + example shown in Steps 2/3 and the live
// structure preview; `single: true` renders one input instead of a value list
// (only honoured when the level is not a parent of another enabled level).
// `auto: true` — values aren't typed; they're derived (Semester count comes from
// each degree's length in Degree Management, so B.Sc gets 1–6, B.E gets 1–8).
const LEVEL_META: Record<string, { hint: string; example: string; single?: boolean; auto?: boolean }> = {
    Batch: { hint: '', example: 'Graduation batch', single: true },
    Phase: { hint: 'Phases under each batch', example: 'Phase 1, Phase 2' },
    Degree: { hint: 'Degrees offered under this service', example: 'B.Sc, B.E, MBA' },
    Department: { hint: 'Departments under each degree', example: 'CSE, IT, ECE' },
    Semester: { hint: "Auto-filled from each degree's length", example: '1–8', auto: true },
    Section: { hint: 'Sections under each department', example: 'A, B, C' },
}

// Which hierarchy levels are mandatory for a given service model. Matched
// against the (dynamic) service model name, so new models can define rules by
// adding a row here. (Placement Training is handled specially in the wizard
// because its structure depends on the "Degree based" toggle.)
const MANDATORY_LEVEL_RULES: { match: RegExp; levels: string[] }[] = [
    { match: /degree\s*program/i, levels: ['Batch', 'Degree', 'Department'] },
]

// Quick-add suggestions per level in Step 3 (besides masters-driven ones).
const LEVEL_QUICK_VALUES: Record<string, string[]> = {
    // Phases are typed manually per batch — no recommended values.
    Section: ['A', 'B', 'C', 'D'],
}

// A level can nest under a parent level: when BOTH are enabled, its values are
// entered per parent value (e.g. departments per degree, phases per batch), so
// "CSE belongs to BE" / "Phase 1 belongs to Batch A" is never ambiguous.
const PARENT_LEVEL: Record<string, string> = {
    Department: 'Degree',
    Phase: 'Batch',
    // Semesters belong to a degree (auto-filled from its length); sections belong
    // to a department. Both nest two levels under Degree.
    Semester: 'Degree',
    Section: 'Department',
}

// Matches the Placement Training service model by (dynamic) name.
const isPlacementTraining = (serviceModels: string[]): boolean =>
    serviceModels.some((m) => /placement\s*training/i.test(m))

// The three business models — matched by pattern so DB naming variants all
// resolve ("B2B", "Business to Business", "business-to-business" → the first).
// CSR is intentionally NOT here: it's a service MODEL under B2B (like COE), so
// it must stay visible in the service-model grid, not the business-model list.
const ALLOWED_SERVICE_PATTERNS: RegExp[] = [
    /^\s*(b2b|business[\s\-_]*to[\s\-_]*business)\s*$/i,
    /^\s*(b2i|business[\s\-_]*to[\s\-_]*institut(e|ion))\s*$/i,
    /^\s*(b2c|business[\s\-_]*to[\s\-_]*(customer|consumer|client))\s*$/i,
]
const isAllowedService = (name: string) =>
    ALLOWED_SERVICE_PATTERNS.some((p) => p.test(name || ''))

// The three business models, in display order. Each entry lines up with the
// ALLOWED_SERVICE_PATTERNS row at the same index. The business model is defined
// on the CLIENT (Client Management); the wizard derives the mapping's service
// from the selected client — reusing the fetched service (its id + service
// models) when one matches a pattern and synthesising the rest.
const BUSINESS_MODELS = ['B2B', 'B2I', 'B2C']

// The two service models that use the degree-hierarchy flow, matched by
// (dynamic) name so DB naming variants resolve. Both are matched on a word
// boundary so a model merely containing the word — "Individual", "Divisional" —
// does not trip them.
const isDegreeProgramModel = (serviceModels: string[]): boolean =>
    serviceModels.some((m) => /degree\s*program/i.test(m || ''))
const isDIVModel = (serviceModels: string[]): boolean =>
    serviceModels.some((m) => /\bdiv\b/i.test(m || ''))

// Matches the Business-to-Business service by its (dynamic) name — keyed off the
// SERVICE, not the model, so ANY model under B2B applies. B2B mappings have a flat
// structure: only Batch (multiple allowed), no further hierarchy.
const isBusinessToBusiness = (service: string): boolean =>
    /business\s*to\s*business|b2b/i.test(service || '')

// Matches the Business-to-Institution service by its (dynamic) name. B2I gets the
// "Degree based" toggle for ANY service model; degree-based B2I additionally offers
// Semester and Section as optional (unticked) levels.
const isBusinessToInstitution = (service: string): boolean =>
    /business\s*to\s*institut(e|ion)|b2i/i.test(service || '')

// Partner Institutions — existing Client Management records picked alongside the
// corporate client (references, never newly created clients; a mapping may carry
// several). CSR and COE are both service *models* under Business-to-Business
// (alongside HTD and TD); the service-NAME check is kept only for legacy
// mappings saved when CSR was offered as a top-level business model.
const CSR_RE = /^\s*(csr|corporate[\s\-_]*social[\s\-_]*responsibility)\s*$/i
const isCSR = (service: string): boolean => CSR_RE.test(service || '')
const isCSRModel = (serviceModels: string[]): boolean =>
    serviceModels.some((m) => CSR_RE.test(m || ''))
const isCOEModel = (serviceModels: string[]): boolean =>
    serviceModels.some((m) => /^\s*(coe|cent(er|re)[\s\-_]*of[\s\-_]*excellence)\s*$/i.test(m || ''))

// "1st batch name", "2nd batch name", … labels for the per-batch name inputs
const ordinal = (n: number): string =>
    n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`

// Synthetic masterData level used to persist each degree's start year (the end
// year is always re-derived from the degree's length). Stored as
// { level: 'AcademicYear', group: degreeName, values: [startYear] }. It is not a
// real hierarchy level and never appears in Step 2.
const ACADEMIC_YEAR_LEVEL = 'AcademicYear'

// Synthetic masterData level for each semester's own start and end dates, keyed
// by "<degree> ▸ <semester>". Like AcademicYear it is not a real hierarchy level
// and must be pushed into `hierarchy` as enabled at save time, or the server's
// normalizeMasterData drops it for not being an enabled level.
//
// BOTH dates ride in ONE delimited value rather than as [start, end], because
// the server runs the values array through cleanStrArray + uniq: a blank start
// would shift the end into slot 0, and a semester whose start and end are the
// same instant would collapse to a single value. One string survives both.
const SEMESTER_DATES_LEVEL = 'SemesterDates'
const SEMESTER_DATE_SEP = '|'
const semesterDateKey = (degree: string, semester: string): string =>
    `${degree}${PATH_SEP}${semester}`

// A semester's date window must span at least a full day. A same-day (or under-24h)
// start/end is a typo, not a real window: it fails validation and must not commit
// (and lock) the semester.
const DAY_MS = 24 * 60 * 60 * 1000

// "15 Dec 2026" — used in the blocked-semester tooltips ("Unlocks after Semester
// 2 ends (15 Dec 2026)"). Guards a bad ISO so a tip never reads "Invalid Date".
const fmtShortDate = (iso: string): string => {
    const d = new Date(iso)
    return Number.isNaN(d.getTime())
        ? ''
        : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// How a semester appears in the dropdown that lists them all. `reason` is the
// hover tooltip on a locked one. `removable` marks a chosen semester the user may
// still change (unpick) — true until course setup adds a module, then it locks.
export type SemStatus = { status: 'chosen' | 'available' | 'blocked'; reason?: string; removable?: boolean }

// The lock state of one semester in the degree flow's sequential setup. Shared
// shape between the wizard (which derives it) and DegreeSetupForm (which renders it).
export type SemLock = {
    // available: editable, may become the current semester.
    // active: the semester currently being set up.
    // completed: a past semester already set up (read-only).
    // skipped: before the chosen starting semester — in scope but never editable.
    // waiting: a later semester still locked until the one before it ends.
    state: 'available' | 'active' | 'completed' | 'skipped' | 'waiting'
    canEditStart: boolean
    canEditEnd: boolean
    hint?: string
}

// Separator for composite group keys — shared with the tree editor, which uses
// the same paths to address section and semester nodes. Sections are scoped to a
// full path so the same department name under two degrees stays separate: the
// group for B.E's CSE sections is "B.E ▸ CSE", distinct from "B.Sc ▸ CSE".

// ─── Types ────────────────────────────────────────────────────────────────────

// A service option pulled from course-structure-dynamic (via useServices)
type ServiceOption = {
    id: string
    name: string
    description?: string
    serviceModals: { id: string; name: string; description?: string }[]
}

// One table row: a client, summarised.
//
// `mappings` used to be every one of that client's mappings, because the page
// held them all anyway. It no longer does — the row now arrives pre-aggregated
// from Mongo and carries COUNTS, and the array is filled only where a client's
// actual mappings are needed (the Manage Services modal, which fetches them for
// the one client it opens on). The agg* helpers below prefer the server's
// numbers and fall back to the array, so both shapes render identically.
type ClientRow = {
    _id: string
    client: MappedClientRef
    mappings: ServiceMapping[]
    /** Total services for this client, across every page. */
    services?: number
    /** How many of them are active. */
    activeCount?: number
    /** Distinct years, for the "2023–2025" label. */
    yearsList?: (string | number)[]
    /** Most recent updatedAt/createdAt among them, ISO. */
    lastUpdatedAt?: string
}

// One table row = one mapping, not one client. A client with three services
// under two models is three rows, each numbered in its own right — collapsing
// them into a single client row hid exactly the thing the table is for.
type MappingRow = {
    _id: string
    client: MappedClientRef
    mapping: ServiceMapping
}

// DataTable hands sort keys back as plain strings, but the page keeps this union
// so the sort comparator stays exhaustive over the columns that are sortable.
type SortKey = 'client' | 'service' | 'model' | 'year' | 'status'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mandatoryLevelsFor = (serviceModels: string[]): Set<string> => {
    const set = new Set<string>()
    serviceModels.forEach((model) => {
        MANDATORY_LEVEL_RULES.forEach((rule) => {
            if (rule.match.test(model)) rule.levels.forEach((l) => set.add(l))
        })
    })
    return set
}

// Format an ISO date string as e.g. "15 Jul 2026, 3:42 PM" (falls back to —)
function fmtDate(value?: string): string {
    if (!value) return '—'
    const d = new Date(value)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleString(undefined, {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: 'numeric', minute: '2-digit',
    })
}

// The listing's row chrome. These live here rather than in the shared kit
// because the palettes are Services-specific; the kit stays generic and the page
// supplies what a cell should look like.

// Shared so the kebab matches the eye and pencil beside it exactly.
const ICON_BUTTON_CLASS =
    'w-7 h-7 rounded-chip border border-hairline bg-surface text-subtle flex items-center ' +
    'justify-center hover:text-heading hover:border-line-hover hover:bg-row-hover transition-colors ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/25'

// (The listing's avatar/model tone helpers moved into components/workspaceShared
// alongside the redesigned table & cards. The wizard and modals keep fmtDate and
// ICON_BUTTON_CLASS above.)

// Minimal toast — a clean surface pill with a green tick (success) or red X (error)
function showNotify(type: 'success' | 'error', message: string) {
    toast(
        <div className="flex items-center gap-2.5">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-white ${type === 'success' ? 'bg-success-500' : 'bg-danger-500'}`}>
                {type === 'success' ? <Check size={13} strokeWidth={3} /> : <X size={13} strokeWidth={3} />}
            </span>
            <span className="text-sm font-medium text-ink-800">{message}</span>
        </div>,
        {
            toastId: `${type}:${message}`,
            icon: false,
            hideProgressBar: true,
            closeButton: false,
            autoClose: 2500,
            className: '!min-h-0 !rounded-xl !shadow-lg !border !border-hairline !bg-surface !px-3 !py-2.5',
        }
    )
}
const notify = {
    success: (message: string) => showNotify('success', message),
    error: (message: string) => showNotify('error', message),
}

// ─── Field helpers ────────────────────────────────────────────────────────────
// FieldLabel, AddInline, SelectAdd, RemovableChip, inputCls, selectCls now live
// in ./components/shared/primitives (imported above) — moved out, not changed.

// Nearest scrollable ancestor. The dropdown sizes itself to fit inside THIS box
// (e.g. the modal body) rather than the whole viewport, so it never spills past the
// modal edge and the list scrolls on its own instead of the modal scrolling.
function getScrollParent(el: HTMLElement | null): HTMLElement | null {
    let node = el?.parentElement || null
    while (node) {
        const oy = getComputedStyle(node).overflowY
        if (oy === 'auto' || oy === 'scroll') return node
        node = node.parentElement
    }
    return null
}

// ─── Client combobox (searchable client picker, used in wizard Step 1) ────────

function ClientCombobox({
    clients,
    value,
    onChange,
    disabled,
    placeholder = 'Select a client…',
}: {
    clients: Client[]
    value: string | null
    onChange: (id: string) => void
    disabled?: boolean
    placeholder?: string
}) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    // Open upward when there isn't room below (e.g. this picker sits low in the
    // modal), so the list is never clipped by the scroll container.
    const [dropUp, setDropUp] = useState(false)
    // Max height of the scrollable list, capped to the space actually available so
    // the menu fits inside the modal and scrolls on its own — the modal never scrolls.
    const [listMaxH, setListMaxH] = useState(224)
    const boxRef = React.useRef<HTMLDivElement>(null)

    // Decide the drop direction + list height from the space around the trigger.
    // Flip up only when below is tight and above is roomier; then size the list to
    // whatever room the chosen direction leaves (minus the search header + margins).
    const openMenu = () => {
        if (!open && boxRef.current) {
            const rect = boxRef.current.getBoundingClientRect()
            // Measure against the scroll container (modal body), not the viewport —
            // the modal ends above the window bottom, so the viewport overstates room.
            const scrollParent = getScrollParent(boxRef.current)
            const bounds = scrollParent
                ? scrollParent.getBoundingClientRect()
                : ({ top: 0, bottom: window.innerHeight } as DOMRect)
            const spaceBelow = bounds.bottom - rect.bottom
            const spaceAbove = rect.top - bounds.top
            const up = spaceBelow < 300 && spaceAbove > spaceBelow
            setDropUp(up)
            const room = (up ? spaceAbove : spaceBelow) - 76 // search box + margins
            setListMaxH(Math.max(120, Math.min(224, room)))
        }
        setOpen((o) => !o)
    }

    const selected = clients.find((c) => c._id === value) || null
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return clients
        return clients.filter((c) => (c.clientCompany || '').toLowerCase().includes(q))
    }, [clients, query])

    // Close on outside click / Escape
    useEffect(() => {
        if (!open) return
        const onDown = (e: MouseEvent) => {
            if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
        }
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
        window.addEventListener('mousedown', onDown)
        window.addEventListener('keydown', onKey)
        return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey) }
    }, [open])

    useEffect(() => { if (!open) setQuery('') }, [open])

    return (
        <div ref={boxRef} className="relative">
            <button
                type="button"
                disabled={disabled}
                onClick={openMenu}
                className={`w-full h-10 flex items-center gap-2 px-3 rounded-control border bg-surface text-left transition-colors disabled:bg-surface-sunken disabled:cursor-not-allowed ${
                    open ? 'border-brand-500 ring-2 ring-brand-500/15' : 'border-hairline-strong hover:border-line-hover'
                }`}
            >
                {selected ? (
                    <>
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${selected.status === 'active' ? 'bg-success-500' : 'bg-ink-300'}`} />
                        <span className="text-sm font-medium text-heading truncate flex-1">{selected.clientCompany || 'Untitled'}</span>
                        {selected.businessModel ? (
                            <span className="text-2xs font-medium px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200 flex-shrink-0 whitespace-nowrap">
                                {selected.businessModel}
                            </span>
                        ) : (
                            <span className="text-2xs font-medium px-1.5 py-0.5 rounded-full bg-warn-50 text-warn-700 border border-warn-500/20 flex-shrink-0 whitespace-nowrap">
                                No model
                            </span>
                        )}
                    </>
                ) : (
                    <span className="text-sm text-faint flex-1">{placeholder}</span>
                )}
                <ChevronDown size={15} className={`text-faint flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: dropUp ? 4 : -4, scale: 0.99 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: dropUp ? 4 : -4, scale: 0.99 }}
                        transition={{ duration: 0.12 }}
                        className={`absolute z-50 w-full rounded-xl border border-hairline bg-surface shadow-lg overflow-hidden ${
                            dropUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                        }`}
                    >
                        <div className="p-2 border-b border-hairline">
                            <div className="relative">
                                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
                                <input
                                    autoFocus
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search clients…"
                                    className="w-full h-9 text-sm rounded-control border border-hairline-strong pl-8 pr-2 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 focus:outline-none transition-colors"
                                />
                            </div>
                        </div>
                        <div className="overflow-y-auto py-1" style={{ maxHeight: listMaxH }}>
                            {filtered.length === 0 ? (
                                <p className="text-2xs text-faint text-center py-5">No clients found.</p>
                            ) : (
                                filtered.map((c) => {
                                    const isSel = c._id === value
                                    return (
                                        <button
                                            key={c._id}
                                            type="button"
                                            onClick={() => { onChange(c._id); setOpen(false) }}
                                            className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors ${isSel ? 'bg-brand-wash' : 'hover:bg-row-hover'}`}
                                        >
                                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.status === 'active' ? 'bg-success-500' : 'bg-ink-300'}`} />
                                            <span className={`text-sm truncate flex-1 ${isSel ? 'font-semibold text-brand-700' : 'font-medium text-body'}`}>
                                                {c.clientCompany || 'Untitled'}
                                            </span>
                                            {c.businessModel ? (
                                                <span className="text-2xs font-medium px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200 flex-shrink-0 whitespace-nowrap">
                                                    {c.businessModel}
                                                </span>
                                            ) : (
                                                <span
                                                    className="text-2xs font-medium px-1.5 py-0.5 rounded-full bg-warn-50 text-warn-700 border border-warn-500/20 flex-shrink-0 whitespace-nowrap"
                                                    title="Set the business model in the Clients tab"
                                                >
                                                    No model
                                                </span>
                                            )}
                                            {isSel && <Check size={13} className="text-brand-700 flex-shrink-0" />}
                                        </button>
                                    )
                                })
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// ─── Step 3 — Resources ────────────────────────────────────────────────────────
// The SAME component Course Setup uses for its Resource Type step, so the two
// can never drift apart: identical I Do / We Do / You Do tabs, identical rows,
// and identical institution gating (it reads Resource Management itself). The
// only difference is `requirePedagogySelection={false}` — the mapping has no
// pedagogy methods to gate the tabs behind, because it's setting the DEFAULTS
// that courses created later start from.
function ResourceDefaultsStep({
    value,
    onChange,
}: {
    value: CourseFormData['resourcesType']
    onChange: (next: CourseFormData['resourcesType']) => void
}) {
    return (
        <div className="space-y-3">
            <div>
                <h3 className="text-sm font-semibold text-heading">Resources</h3>
                <p className="text-xs text-subtle mt-0.5">
                    Set the resources courses under this mapping start with. Only what the
                    institution enabled in Resource Management is shown, and Course Setup can
                    still change it per course — these are just the defaults.
                </p>
            </div>
            <ResourceTypeSection
                formData={{ iDo: [], weDo: [], youDo: [], resourcesType: value, aiChatGlobal: false }}
                setFormData={(updater) => {
                    const next = updater({ resourcesType: value, aiChatGlobal: false })
                    onChange(next.resourcesType)
                }}
                validationErrors={{}}
                setValidationErrors={() => {}}
                requirePedagogySelection={false}
            />
        </div>
    )
}

// ─── Map Service wizard (3-step modal) ────────────────────────────────────────

function MapServiceWizard({
    open,
    onClose,
    clients,
    servicesList,
    isLoadingServices,
    degreesList,
    editingMapping,
    presetClientId,
    isSaving,
    onSave,
}: {
    open: boolean
    onClose: () => void
    clients: Client[]
    servicesList: ServiceOption[]
    isLoadingServices: boolean
    degreesList: Degree[]
    editingMapping: ServiceMapping | null
    presetClientId: string | null
    isSaving: boolean
    // coursePayload is the course-structure create/update body (same shape the
    // old New Course popup submitted) — null on a partial save (Step 1/2), where
    // only the mapping is stored; existingCourseId links an edit to the course
    // the mapping already created. Resolves with the saved ids (so the wizard
    // can keep updating the same mapping on later saves), or null on failure.
    onSave: (
        payload: ServiceMappingInput,
        coursePayload: Record<string, unknown> | null,
        mappingId?: string,
        existingCourseId?: string,
    ) => Promise<{ mappingId: string; courseId: string } | null>
}) {
    const [stepIndex, setStepIndex] = useState(0)
    // 'form' is the wizard as it always was; 'preview' swaps the body and
    // footer for a read-only hierarchy view of what a successful FULL save just
    // wrote. Only the last step's Save & Preview enters it — partial saves stay
    // in 'form' on their step, exactly as before.
    const [phase, setPhase] = useState<'form' | 'preview'>('form')
    // Frozen at save time — see handleSave. The preview renders this snapshot,
    // never a live derivation.
    const [previewModel, setPreviewModel] =
        useState<Pick<MappingPreviewProps, 'degree' | 'batches' | 'flatCourses' | 'phasesTree'> | null>(null)
    const tourRef = useRef<WizardTourHandle>(null)
    // Step 2's accordions assign these on mount. A failed Next calls whichever
    // flow is on screen so the sections holding errors open themselves and the
    // first offender is scrolled to — otherwise the message sits inside a folded
    // section and the save looks like it failed for no reason.
    const placementRevealRef = useRef<(() => void) | null>(null)
    const simpleRevealRef = useRef<(() => void) | null>(null)
    const degreeRevealRef = useRef<(() => void) | null>(null)
    // Which way the step content slides. Back and Next must not animate the
    // same way or the wizard loses its sense of direction.
    const [stepDir, setStepDir] = useState<1 | -1>(1)
    const [clientId, setClientId] = useState<string | null>(null)
    // CSR / COE only: the existing clients where the sponsored training runs.
    const [partnerInstitutionIds, setPartnerInstitutionIds] = useState<string[]>([])
    const [service, setService] = useState('')
    const [year, setYear] = useState('')
    const [serviceModels, setServiceModels] = useState<string[]>([])
    // ── Step 2 — course & batches (every flow ends in Course → Batches) ──
    // Placement Training only: 'general' (course + batches) or 'department'
    // (each batch tied to a degree + departments).
    const [prtMode, setPrtMode] = useState<'' | 'general' | 'department'>('')
    // Non-degree flows pick a single course for the whole mapping.
    const [courses, setCourses] = useState<CourseEntry[]>([blankCourse()])

    // Degree Program: courses hang off the tree, one list per semester, keyed by
    // the semester's full path ("B.E ▸ CSE ▸ A ▸ 3"). Semesters come from the
    // degree's length, so a path only exists once its section does.
    const [semesterCourses, setSemesterCourses] = useState<Record<string, CourseEntry[]>>({})
    // Which department/section row the workbench is showing.
    const [scope, setScope] = useState<Scope | null>(null)
    // Close-confirmation: closing a half-finished NEW mapping should not silently
    // drop the work. Shown only while creating (not editing) once the user has
    // actually begun — picked a client, or stepped past the first question; the
    // post-save preview has nothing unsaved, so it is excluded.
    const [confirmClose, setConfirmClose] = useState(false)
    const isDirty = !editingMapping && phase === 'form' && (Boolean(clientId) || stepIndex > 0)
    // Route every close path (Escape, backdrop, ✕, Cancel) through here so the
    // prompt is the single gate; with nothing to lose, close straight away.
    const requestClose = () => {
        if (isSaving) return
        if (isDirty) setConfirmClose(true)
        else onClose()
    }
    const coursesAt = (path: string): CourseEntry[] => semesterCourses[path] || []
    // Drop every field error belonging to course rows at or past `from` — without
    // this, shrinking a list leaves errors pointing at rows that no longer exist
    // and Next fails with nothing on screen to explain why.
    const dropCourseErrorsFrom = (path: string, from: number) =>
        setFieldErrors((prev) => {
            const next = { ...prev }
            let changed = false
            Object.keys(next).forEach((k) => {
                const m = k.match(/^sem:(.*):(\d+):/)
                if (m && m[1] === path && parseInt(m[2], 10) >= from) { delete next[k]; changed = true }
            })
            return changed ? next : prev
        })

    const setSemesterCourseCount = (path: string, n: number) => {
        const count = Math.max(0, Math.min(20, Number.isFinite(n) ? n : 0))
        setSemesterCourses((prev) => ({
            ...prev,
            [path]: Array.from({ length: count }, (_, i) => prev[path]?.[i] || blankCourse()),
        }))
        dropCourseErrorsFrom(path, count)
    }
    const removeCourseAt = (path: string, index: number) => {
        setSemesterCourses((prev) => ({
            ...prev,
            [path]: (prev[path] || []).filter((_, i) => i !== index),
        }))
        // Errors are keyed by index, so removing a row shifts every later row's
        // key. Clearing from the removal point is simpler and safe — validation
        // re-derives them on the next Next.
        dropCourseErrorsFrom(path, index)
    }
    const updateSemesterCourse = (path: string, index: number, patch: Partial<CourseEntry>) =>
        setSemesterCourses((prev) => ({
            ...prev,
            [path]: (prev[path] || []).map((c, i) => (i === index ? { ...c, ...patch } : c)),
        }))
    // Batches, for a course that opted into them. The resize reads the previous
    // names from inside the updater — reading them from the render closure drops
    // entries when two writes land in the same tick.
    const setCourseBatchCount = (path: string, index: number, n: number) => {
        const count = Math.max(0, Math.min(20, Number.isFinite(n) ? n : 0))
        setSemesterCourses((prev) => ({
            ...prev,
            [path]: (prev[path] || []).map((c, i) => (i === index
                ? { ...c, batches: Array.from({ length: count }, (_, bi) => c.batches[bi] ?? '') }
                : c)),
        }))
        setFieldErrors((prev) => {
            const next = { ...prev }
            let changed = false
            Object.keys(next).forEach((k) => {
                const m = k.match(/^sem:(.*):(\d+):batch:(\d+)$/)
                if (m && m[1] === path && Number(m[2]) === index && Number(m[3]) >= count) {
                    delete next[k]; changed = true
                }
            })
            return changed ? next : prev
        })
    }
    const setCourseBatchName = (path: string, index: number, batchIndex: number, value: string) =>
        setSemesterCourses((prev) => ({
            ...prev,
            [path]: (prev[path] || []).map((c, i) => (i === index
                ? { ...c, batches: c.batches.map((b, bi) => (bi === batchIndex ? value : b)) }
                : c)),
        }))

    // Everything stored under a path — used when a department, section or degree
    // goes away. Without this, orphaned paths keep failing validation and keep
    // being serialised, for structure the user can no longer see.
    const removeCoursesUnder = (prefix: string) => {
        const under = (k: string) => k === prefix || k.startsWith(prefix + PATH_SEP)
        setSemesterCourses((prev) => {
            const next = { ...prev }
            let changed = false
            Object.keys(next).forEach((k) => { if (under(k)) { delete next[k]; changed = true } })
            return changed ? next : prev
        })
        setFieldErrors((prev) => {
            const next = { ...prev }
            let changed = false
            Object.keys(next).forEach((k) => {
                if (k.startsWith('sem:') && under(k.slice(4).replace(/:\d+:.*$/, ''))) {
                    delete next[k]; changed = true
                }
            })
            return changed ? next : prev
        })
    }
    // The mapping's own courseName/category columns are single-valued, so the
    // first course stays the one written to them (and to the course record).
    const category = courses[0]?.category || ''
    const courseName = courses[0]?.courseName || ''

    const setCourseAt = (i: number, patch: Partial<CourseEntry>) =>
        setCourses((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))
    // A fresh mapping opens with Batches ON and two of them — the same number the
    // Enable-batches checkbox writes when it is ticked. ZERO is the off state, and
    // the count is the ONLY thing that records it: with no second flag there is
    // nothing that can drift out of step with the number of batch rows on screen.
    const [batchCount, setBatchCount] = useState(DEFAULT_BATCH_COUNT)
    const [batchNames, setBatchNames] = useState<string[]>(() =>
        Array.from({ length: DEFAULT_BATCH_COUNT }, () => ''))
    // Phases within each batch, index-aligned with batchNames:
    // batchPhases[0] = ['Phase 1', 'Phase 2'] for the first batch. Opt-in — a
    // batch that doesn't run in phases carries an empty list and its own flag,
    // so "phases off" and "phases on but not filled in yet" stay distinct.
    // These carry the flat (B2B/CSR/COE) flow's LEGACY data only — nothing edits
    // them any more; Placement Training no longer runs batches in phases at all.
    const [batchPhasesEnabled, setBatchPhasesEnabled] = useState<boolean[]>(() =>
        Array.from({ length: DEFAULT_BATCH_COUNT }, () => false))
    const [batchPhases, setBatchPhases] = useState<string[][]>(() =>
        Array.from({ length: DEFAULT_BATCH_COUNT }, () => []))
    // Placement Training phases — MAPPING-level now, not per-batch. Zero phases
    // means the mapping delivers a single course directly; otherwise each phase
    // carries exactly one course (with its own batches). Names default to
    // "Phase N" but stay editable; renaming never moves courses, because the
    // course store is keyed by INDEX ('ph<i>'), not by name.
    const [phaseNames, setPhaseNames] = useState<string[]>([])
    // Placement WITHOUT phase configuration can still deliver MULTIPLE courses —
    // e.g. a "placement training" service that runs java AND python as plain
    // courses, no phase grouping. This is how many. It only matters when phases
    // are off (phaseNames empty); a phased mapping ignores it. Keys for these
    // courses use a distinct 'phd<i>' namespace (first stays 'ph' for backward
    // compatibility with the old single-course shape) so they can never collide
    // with the phase machinery's 'ph<i>' keys.
    const [noPhaseCourseCount, setNoPhaseCourseCount] = useState(1)
    // Per-field validation messages, keyed by field name ('client', 'courseName',
    // 'batch-0', 'sem:<path>:<i>:category'…) so a failed Next points at the
    // offending field instead of firing a toast.
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
    // Clearing on change is what stops an error from lingering after it's fixed.
    const clearFieldError = (key: string) =>
        setFieldErrors((prev) => {
            if (!prev[key]) return prev
            const next = { ...prev }
            delete next[key]
            return next
        })
    const [masterData, setMasterData] = useState<Record<string, string[]>>({})
    // Per-degree start year (degreeName → 4-digit year). The end year is derived
    // from the degree's length when known; when the length is unknown the user
    // types it, so we keep a manual override map too.
    const [degreeStartYears, setDegreeStartYears] = useState<Record<string, string>>({})
    const [degreeEndYears, setDegreeEndYears] = useState<Record<string, string>>({})
    // Each semester's own teaching window, keyed by "<degree> ▸ <semester>". Held
    // as ISO strings so the shared DateTimePicker can round-trip them unchanged,
    // and scoped to the DEGREE (not the department or section) because the
    // semester list itself is degree-scoped — sem 3 runs on the same dates for
    // every department under that degree.
    const [semesterDates, setSemesterDates] =
        useState<Record<string, { start: string; end: string }>>({})
    // Values of a child level per parent value, e.g. groupedData['Department']['BE'] = ['CSE']
    const [groupedData, setGroupedData] = useState<Record<string, Record<string, string[]>>>({})
    // Ids from a partial (non-final-step) save this session, so the NEXT save
    // updates that same mapping/course instead of creating a duplicate. A
    // partial save keeps the wizard open (see handleSave) rather than closing
    // it, so editingMapping alone isn't enough to track this across steps.
    const [savedIds, setSavedIds] = useState<{ mappingId: string; courseId: string } | null>(null)
    // Step 3 — the resource configuration courses under this mapping start
    // from. Same shape as a course's own `resourcesType`, so applying it later
    // is a straight copy (see applyMappingResourceDefaults).
    const [resourceDefaults, setResourceDefaults] = useState<CourseFormData['resourcesType']>(
        () => initializeResourcesType({})
    )

    const isEditing = Boolean(editingMapping?._id)

    // Three steps. Course *setup* (level, module/topic hierarchy) is not part of
    // mapping — courses are defined in Course Management, and the mapping only
    // records which of them run where. Step 3 is the one exception: it records
    // which Resource Management types this mapping's courses start with checked.
    const steps = [
        { key: 'details', label: 'Client & service', icon: Briefcase },
        { key: 'structure', label: 'Structure & course', icon: ListTree },
        { key: 'resources', label: 'Resources', icon: Layers },
    ] as const
    const isLastStep = stepIndex === steps.length - 1

    // Service-model driven flow flags. The structure is FIXED per flow — there
    // is no "choose structure" step anymore.
    const isPlacement = useMemo(() => isPlacementTraining(serviceModels), [serviceModels])
    // CSR and COE are service models under B2B; both carry partner institutions.
    // (The isCSR(service) check covers legacy mappings saved when CSR was still
    // offered as a top-level business model.)
    const isCSRFlow = useMemo(() => isCSRModel(serviceModels) || isCSR(service), [serviceModels, service])
    const isCOEFlow = useMemo(() => isCOEModel(serviceModels), [serviceModels])
    // Both CSR and COE reveal the Partner Institution picker in Step 1.
    const isPartnerFlow = isCSRFlow || isCOEFlow

    // DIV starts as the simple course-and-batches form; the degree hierarchy is
    // OPT-IN via this toggle. Degree Program always has it. On edit the flag is
    // derived from the data — a DIV mapping that saved a Degree is degree-based.
    const [divDegreeEnabled, setDivDegreeEnabled] = useState(false)

    // The degree-hierarchy flow: Degree → Department → Semester → Section, with
    // courses (and their batches) hanging off each semester. Degree Program is
    // always built this way; DIV only once its "Degree based" toggle is on —
    // the flag is named for the flow rather than for any model.
    const isDegreeFlow = useMemo(
        () => isDegreeProgramModel(serviceModels)
            || (isDIVModel(serviceModels) && divDegreeEnabled),
        [serviceModels, divDegreeEnabled]
    )
    // Placement Training owns its own step: mapping-level phases, one course per
    // phase, batches on the course. Every other non-degree flow (CSR, COE,
    // anything else) still picks a single course, so this flag — not
    // `!isDegreeFlow` — is what gates the placement UI. The old PRT "department
    // mode" (per-batch degree + departments) is retired: its batches no longer
    // exist at mapping level, so there is nothing left to tie a degree to.
    const isPlacementCourses = isPlacement && !isDegreeFlow

    // Fixed hierarchy per flow. Every flow ends in Course → Batch(es); what comes
    // before depends on the service model:
    //   Degree Program, DIV → Degree → Department → Semester → Section
    //   Placement Training  → Phase (mapping-level; may be zero)
    //   everything else     → nothing (course + batches only)
    const activeLevels = useMemo<string[]>(() => {
        if (isDegreeFlow) return ['Batch', 'Degree', 'Department', 'Semester', 'Section']
        if (isPlacementCourses) return ['Batch', 'Phase']
        return ['Batch']
    }, [isDegreeFlow, isPlacementCourses])
    const mandatoryLevels = useMemo(() => new Set(activeLevels), [activeLevels])
    const isLevelEnabled = (level: string) => activeLevels.includes(level)

    // (Re-)initialise whenever the modal opens
    useEffect(() => {
        if (!open) return
        // Editing opens straight onto the structure — the data is what the user
        // came to see, and step 1's identity fields are locked anyway. A new
        // mapping still starts at the beginning.
        setStepIndex(editingMapping ? 1 : 0)
        // A fresh open (create or edit) always starts on the form — a preview
        // left over from the previous mapping would show the wrong data.
        setPhase('form')
        // A stale snapshot from the previous mapping must never flash inside
        // the next one's preview.
        setPreviewModel(null)
        setFieldErrors({})
        // Reset first so a fresh (non-editing) open never inherits the previous
        // mapping's selection; the branch below overwrites it for an edit.
        setResourceDefaults(initializeResourcesType({}))

        setScope(null)
        if (editingMapping) {
            const clientRef = editingMapping.client
            setClientId(typeof clientRef === 'string' ? clientRef : clientRef?._id || null)
            setPartnerInstitutionIds(
                (editingMapping.partnerInstitutions || [])
                    .map((p) => (typeof p === 'string' ? p : p?._id))
                    .filter(Boolean) as string[]
            )
            setService(editingMapping.service || '')
            // The saved year, which the user can now change. Legacy mappings
            // without one fall back to the current year so the field is never
            // stuck empty — and because that fallback is a GUESS, not stored
            // data, the picker leaves it editable rather than presenting it as
            // fact.
            setYear(editingMapping.year || String(new Date().getFullYear()))
            const models = [...(editingMapping.serviceModels || [])]
            setServiceModels(models)
            setPrtMode(editingMapping.prtMode || '')
            setResourceDefaults(initializeResourcesType(editingMapping.resourceDefaults || {}))
            // DIV's degree toggle is not stored as a flag — the DATA answers it:
            // a mapping that saved a Degree level was built degree-based.
            setDivDegreeEnabled(
                (editingMapping.masterData || []).some(
                    (m) => m.level === 'Degree' && (m.values || []).length > 0
                )
            )
            // Prefer the full list; fall back to the single course columns for
            // mappings saved before multi-course existed.
            const savedCourses = editingMapping.courses || []
            // Tree courses (those carrying a semester path) go back into their
            // semesters; the rest are the mapping-level list.
            const byPath: Record<string, CourseEntry[]> = {}
            savedCourses.filter((c) => c.path).forEach((c) => {
                const key = c.path as string
                ;(byPath[key] = byPath[key] || []).push({
                    category: c.category || '',
                    courseName: c.courseName || '',
                    custom: false,
                    batchesEnabled: Boolean(c.batchesEnabled) || Boolean(c.batches?.length),
                    batches: [...(c.batches || [])],
                })
            })
            // `byPath` is keyed by the SAVED path. The degree flow uses that key
            // verbatim; Placement Training translates its phase-name (or legacy
            // batch/phase) paths back into index keys — see below, once the
            // batch/phase config is known.

            const flat = savedCourses.filter((c) => !c.path)
            setCourses(flat.length
                ? flat.map((c) => ({
                    category: c.category || '',
                    courseName: c.courseName || '',
                    custom: false,
                    batchesEnabled: Boolean(c.batchesEnabled) || Boolean(c.batches?.length),
                    batches: [...(c.batches || [])],
                }))
                : [{
                    category: editingMapping.category || '',
                    courseName: editingMapping.courseName || '',
                    custom: false,
                    batchesEnabled: false,
                    batches: [],
                }])
            const md: Record<string, string[]> = {}
            const gd: Record<string, Record<string, string[]>> = {}
            const dsy: Record<string, string> = {}
            const dey: Record<string, string> = {}
            const sd: Record<string, { start: string; end: string }> = {}
            ;(editingMapping.masterData || []).forEach((m) => {
                if (m.level === ACADEMIC_YEAR_LEVEL) {
                    // Companion entry: { level: 'AcademicYear', group: degreeName, values: [startYear, endYear?] }
                    if (m.group) {
                        dsy[m.group] = m.values?.[0] || ''
                        if (m.values?.[1]) dey[m.group] = m.values[1]
                    }
                } else if (m.level === SEMESTER_DATES_LEVEL) {
                    // Companion entry: one delimited "start|end" value per
                    // "<degree> ▸ <semester>". Split with a limit of 2 so an ISO
                    // string that ever grows a separator cannot spill extra parts.
                    if (m.group) {
                        const [start = '', end = ''] = String(m.values?.[0] || '').split(SEMESTER_DATE_SEP)
                        if (start || end) sd[m.group] = { start, end }
                    }
                } else if (m.group) {
                    gd[m.level] = gd[m.level] || {}
                    gd[m.level][m.group] = [...(m.values || [])]
                } else {
                    md[m.level] = [...(m.values || [])]
                }
            })
            setMasterData(md)
            setGroupedData(gd)
            setDegreeStartYears(dsy)
            setDegreeEndYears(dey)
            setSemesterDates(sd)
            // Batches — from batchConfigs; legacy mappings (saved before the
            // course/batch redesign) fall back to their Batch master-data values.
            const cfgs: BatchConfig[] = (editingMapping.batchConfigs || []).length
                ? (editingMapping.batchConfigs as BatchConfig[])
                : (md['Batch'] || []).map((name) => ({ name, degree: '', departments: [] }))
            // No saved batches means the Enable-batches checkbox comes back OFF.
            // Seeding a lone empty row instead would reopen an unbatched mapping as
            // a batched one carrying a blank name the user must fill before it will
            // save again — zero IS the off state, so it is restored as zero.
            setBatchCount(cfgs.length)
            setBatchNames(cfgs.map((b) => b.name))
            setBatchPhases(cfgs.map((b) => [...(b.phases || [])]))
            setBatchPhasesEnabled(cfgs.map((b) => Boolean(b.phases?.length)))

            // Placement Training — restore into the phase-per-course shape.
            // NEW-shape mappings are recognisable by batchConfigs being EMPTY
            // (the new save always writes []) while paths are 1-part phase names
            // (or '' for the zero-phase course); anything that still carries
            // batchConfigs — or a 'Batch ▸ Phase' 2-part path — is legacy and is
            // translated best-effort, which is LOSSY for legacy mappings that
            // held several courses per batch/phase: each phase keeps only its
            // FIRST course, and the Save & Preview shows exactly what will be
            // written, which is the honest guard.
            const loadedPlacement = isPlacementTraining(models)
                && !isDegreeProgramModel(models) && !isDIVModel(models)
            if (!loadedPlacement) {
                setPhaseNames([])
                setSemesterCourses(byPath)
            } else {
                const eq = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
                // Batches are OPT-IN, so the flag must come from the DATA — the
                // same rule the flat restore uses. Forcing it on re-opened every
                // batchless course with a ticked box and one empty input, and the
                // next save then failed validation on data the user never touched.
                const entryOf = (
                    c: { category?: string; courseName?: string; batchesEnabled?: boolean },
                    batches: string[]
                ): CourseEntry => {
                    const enabled = Boolean(c.batchesEnabled) || batches.length > 0
                    return {
                        category: c.category || '',
                        courseName: c.courseName || '',
                        custom: false,
                        batchesEnabled: enabled,
                        batches: enabled ? (batches.length ? [...batches] : ['']) : [],
                    }
                }
                // A phase with no saved course starts opted OUT of batches,
                // matching the in-wizard seeding (blankCourse()).
                const blankRow = (): CourseEntry => blankCourse()
                const rawCfgs = (editingMapping.batchConfigs || []) as BatchConfig[]
                const isLegacyShape = rawCfgs.length > 0
                    || savedCourses.some((c) => (c.path || '').includes(PATH_SEP))
                const byKey: Record<string, CourseEntry[]> = {}
                if (!isLegacyShape) {
                    // New shape: phase names from masterData's Phase entry; each
                    // course sits under its phase's name (or '' when phase-less)
                    // and carries its own batches.
                    const phases = (md['Phase'] || []).filter(Boolean)
                    setPhaseNames([...phases])
                    if (phases.length) {
                        phases.forEach((p, i) => {
                            const saved = savedCourses.find((c) => eq(c.path || '', p))
                            byKey[`ph${i}`] = [saved ? entryOf(saved, saved.batches || []) : blankRow()]
                        })
                    } else {
                        // No phases: every pathless course is a direct course.
                        // Restore them all into the 'ph' / 'phd<i>' slots and set
                        // the count so the wizard reopens with the same list — a
                        // placement with java AND python comes back with both.
                        const directCourses = savedCourses.filter((c) => !(c.path || '').trim())
                        const rows = directCourses.length ? directCourses : [null]
                        setNoPhaseCourseCount(rows.length)
                        rows.forEach((saved, i) => {
                            byKey[noPhaseCourseKey(i)] = [saved ? entryOf(saved, saved.batches || []) : blankRow()]
                        })
                    }
                } else {
                    // Legacy translation: phases = union of every batch's phases
                    // (order preserved); per phase, the FIRST course stored under
                    // any '<batch> ▸ <phase>' path becomes that phase's course,
                    // and its batches are the batch names that carried it
                    // (falling back to all batch names). Zero-phase legacy: the
                    // first pathless-or-batch-path course becomes THE course,
                    // with every batch name.
                    const phaseUnion: string[] = []
                    rawCfgs.forEach((b) => (b.phases || []).forEach((p) => {
                        const v = p.trim()
                        if (v && !phaseUnion.some((x) => eq(x, v))) phaseUnion.push(v)
                    }))
                    const allBatchNames = (rawCfgs.length ? rawCfgs.map((b) => b.name) : (md['Batch'] || []))
                        .map((n) => n.trim()).filter(Boolean)
                    setPhaseNames(phaseUnion)
                    if (phaseUnion.length) {
                        phaseUnion.forEach((p, i) => {
                            let course: MappedCourse | null = null
                            const carriers: string[] = []
                            savedCourses.forEach((c) => {
                                const path = c.path || ''
                                const sep = path.indexOf(PATH_SEP)
                                if (sep === -1) return
                                const batchPart = path.slice(0, sep)
                                const phasePart = path.slice(sep + PATH_SEP.length)
                                if (!eq(phasePart, p)) return
                                if (!course) course = c
                                if ((c.category || '') === (course.category || '')
                                    && eq(c.courseName || '', course.courseName || '')
                                    && !carriers.some((x) => eq(x, batchPart))) {
                                    carriers.push(batchPart)
                                }
                            })
                            byKey[`ph${i}`] = [course
                                ? entryOf(course, carriers.length ? carriers : allBatchNames)
                                : { ...blankRow(), batches: allBatchNames.length ? [...allBatchNames] : [''] }]
                        })
                    } else {
                        const saved = savedCourses.find((c) => !(c.path || '').trim())
                            || savedCourses.find((c) => Boolean(c.path) && !(c.path as string).includes(PATH_SEP))
                        byKey['ph'] = [saved
                            ? entryOf(saved, allBatchNames)
                            : { ...blankRow(), batches: allBatchNames.length ? [...allBatchNames] : [''] }]
                    }
                }
                setSemesterCourses(byKey)
            }
            // Step 3 (course setup) is populated from the linked course record by
            // the effect below once it loads.
            setCourseForm(initialCourseFormData)
            setSavedIds(null)
        } else {
            setClientId(presetClientId || null)
            setPartnerInstitutionIds([])
            setService('')
            // Current year as the DEFAULT for a new mapping, not a rule — the
            // step-1 picker can move it, which is what lets the same client be
            // mapped for several different years.
            setYear(String(new Date().getFullYear()))
            setServiceModels([])
            setPrtMode('')
            setDivDegreeEnabled(false)
            setCourses([blankCourse()])
            setSemesterCourses({})
            setBatchCount(DEFAULT_BATCH_COUNT)
            setBatchNames(Array.from({ length: DEFAULT_BATCH_COUNT }, () => ''))
            setBatchPhases(Array.from({ length: DEFAULT_BATCH_COUNT }, () => []))
            setBatchPhasesEnabled(Array.from({ length: DEFAULT_BATCH_COUNT }, () => false))
            setPhaseNames([])
            setNoPhaseCourseCount(1)
            setCourseForm(initialCourseFormData)
            setMasterData({})
            setGroupedData({})
            setDegreeStartYears({})
            setDegreeEndYears({})
            setSemesterDates({})
            setSavedIds(null)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, editingMapping, presetClientId])

    // The business model now lives on the client record, so the mapping's
    // service is derived from the selected client — the wizard has no select of
    // its own. Reuses the servicesList option at the same index (real service id
    // + models when the master list has it). Editing keeps the saved service:
    // the client can't change while editing.
    useEffect(() => {
        if (!open || editingMapping) return
        const bm = clients.find((c) => c._id === clientId)?.businessModel || ''
        const idx = BUSINESS_MODELS.indexOf(bm)
        const next = idx >= 0 ? servicesList[idx]?.name || bm : ''
        if (next === service) return
        setService(next)
        // Same resets the old select's onChange performed
        setServiceModels([])
        setPrtMode('')
        setPartnerInstitutionIds([])
    }, [open, editingMapping, clientId, clients, servicesList, service])

    // Escape-to-close (ignored while saving). While the confirm prompt is up,
    // Escape dismisses the prompt instead — otherwise it goes through the same
    // unsaved-changes gate as every other close.
    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape' || isSaving) return
            if (confirmClose) { setConfirmClose(false); return }
            if (isDirty) setConfirmClose(true)
            else onClose()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open, isSaving, onClose, confirmClose, isDirty])

    const selectedService = servicesList.find((s) => s.name === service)
    // Drop any "service model" that is actually one of the business models (e.g. CSR
    // shows up under B2B in the master data). Business models belong in the top-level
    // select, never in the service-model grid.
    const availableModels = (selectedService?.serviceModals || []).filter((m) => !isAllowedService(m.name))

    // Single-select: only one service model at a time — the following steps
    // (structure, course) depend on the chosen model. Clicking the selected
    // one clears it; clicking another replaces the selection.
    // Once a mapping has been SAVED carrying a model, the model is final: the
    // whole structure step is built on it, and switching it on a saved record
    // would orphan the hierarchy (semesters, batches, courses) already written
    // against the old one. A different model means a new mapping.
    const modelLocked = Boolean(editingMapping?.serviceModels?.length)
        || Boolean(savedIds?.mappingId && serviceModels.length)

    const toggleModel = (name: string) => {
        if (modelLocked) return
        clearFieldError('serviceModel')
        setServiceModels((prev) => (prev.includes(name) ? [] : [name]))
        // The structure step is model-driven — reset the per-model choices.
        setPrtMode('')
        setDivDegreeEnabled(false)
    }

    // ── Course data — only for the category/course-name lists the pickers in
    // Step 2 offer. The mapping no longer collects course setup, but useCourseData
    // needs a form to bind to, so it gets a throwaway one that nothing renders.
    const [courseForm, setCourseForm] = useState<CourseFormData>(initialCourseFormData)
    const { categoriesData } = useCourseData({
        isOpen: open,
        isEditMode: false,
        formData: courseForm,
        setFormData: setCourseForm,
        clientList: [] as never[],
    })
    const categoryOptions: CourseCategory[] = categoriesData?.allCategories || []
    // Per-row now — each course picks its own category, so the name options are
    // looked up per category rather than from one shared selection.
    const courseNamesFor = (cat: string): string[] =>
        categoryOptions.find((c) => c.categoryName === cat)?.courseNames || []

    // Editing: decide whether the saved course name is a standard one for its
    // category or a custom name (drives the "Others" input in Step 2).
    useEffect(() => {
        if (!open || !editingMapping || !courseName || !categoryOptions.length) return
        const names = courseNamesFor(category)
        setCourseAt(0, { custom: !names.includes(courseName) })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, editingMapping, categoryOptions.length])

    // The same derivation for every course in the tree/batch store. `custom` is
    // not persisted — it is worked out from the data, so this also repairs rows
    // saved before it was tracked. Without it a free-typed ("Others") course name
    // reloads into a <select> that matches no option and therefore renders blank,
    // hiding a name that IS stored; a user who then fills the apparently empty
    // field overwrites the original. Deferred until the category lists arrive,
    // because that is what the check needs to be meaningful.
    useEffect(() => {
        if (!open || !editingMapping || !categoryOptions.length) return
        setSemesterCourses((prev) => {
            let changed = false
            const next: Record<string, CourseEntry[]> = {}
            Object.entries(prev).forEach(([key, list]) => {
                next[key] = list.map((c) => {
                    const custom = Boolean(c.courseName.trim())
                        && !courseNamesFor(c.category).includes(c.courseName)
                    if (custom === c.custom) return c
                    changed = true
                    return { ...c, custom }
                })
            })
            return changed ? next : prev
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, editingMapping, categoryOptions.length])

    // Course image picker — same limits as the Course Management popup

    // ── Batches — count-driven name (and PRT-department degree/dept) inputs ──
    const applyBatchCount = (n: number) => {
        // Zero is the Enable-batches checkbox saying OFF, so it has to survive the
        // clamp; every other value floors at one, matching the spinner's own min.
        // A mid-retype empty field parses to NaN and lands on one rather than
        // zero, so clearing the input can never silently untick batches.
        const raw = Math.floor(Number.isFinite(n) ? n : 1)
        const count = raw <= 0 ? 0 : Math.min(20, Math.max(1, raw))
        setBatchCount(count)
        const resize = <T,>(arr: T[], fill: () => T): T[] =>
            Array.from({ length: count }, (_, i) => (i < arr.length ? arr[i] : fill()))
        setBatchNames((prev) => resize(prev, () => ''))
        setBatchPhases((prev) => resize(prev, () => []))
        setBatchPhasesEnabled((prev) => resize(prev, () => false))
    }

    // Batch-level phases have no editor any more: Placement Training moved its
    // phases up to the mapping, and the flat models never ran a batch in stages.
    // The DATA is still carried — loaded into batchPhases/batchPhasesEnabled,
    // resized by applyBatchCount and written back out at save time — so a legacy
    // mapping keeps its phases through an edit instead of losing them. Only the
    // add/rename/remove helpers are gone, because nothing can call them.
    const setBatchName = (i: number, v: string) =>
        setBatchNames((prev) => prev.map((x, idx) => (idx === i ? v : x)))

    // ── Placement Training phases (mapping-level) ──
    // Placement courses live in the SAME `semesterCourses` store the degree flow
    // uses; only the key shape differs, so there is exactly one store and one
    // courseApi. Keys are by INDEX — 'ph0', 'ph1', … one per phase, or the
    // single 'ph' when the mapping runs without phases — because phase names are
    // free text the user retypes constantly; a name key would orphan a phase's
    // course the moment it is renamed.
    // The store keys for a placement mapping's courses. Phased → one per phase
    // ('ph0','ph1',…). No phases → one per direct course, first at 'ph' (legacy)
    // then 'phd1','phd2',… so multiple courses without phases are possible.
    const noPhaseCourseKey = (i: number): string => (i === 0 ? 'ph' : `phd${i}`)
    const placementPhaseKeys = (): string[] =>
        phaseNames.length
            ? phaseNames.map((_, i) => `ph${i}`)
            : Array.from({ length: Math.max(1, noPhaseCourseCount) }, (_, i) => noPhaseCourseKey(i))

    const applyPhaseCount = (n: number) => {
        const count = Math.max(0, Math.min(10, Math.floor(Number.isFinite(n) ? n : 0)))
        const prevCount = phaseNames.length
        if (count === prevCount) return
        // New phases start with an EMPTY name: the name IS the phase's course name,
        // and the section header already says "Phase 1"/"Phase 2", so seeding it
        // would put placeholder text in the Course name field for the user to clear.
        setPhaseNames((prev) => Array.from({ length: count }, (_, i) => prev[i] ?? ''))
        // Course keys are positional, so shrinking drops the trailing phases'
        // courses the same way applyBatchCount cleans batch keys — left behind,
        // raising the count again would resurrect them inside what the user
        // experiences as a brand-new phase. Crossing zero migrates the single
        // course between its 'ph' and 'ph0' homes so typed work is never lost.
        setSemesterCourses((prev) => {
            const next = { ...prev }
            if (prevCount === 0 && count > 0 && next['ph']) {
                next['ph0'] = next['ph0'] || next['ph']
            }
            if (prevCount > 0 && count === 0 && next['ph0']) {
                next['ph'] = next['ph'] || next['ph0']
            }
            if (count > 0) delete next['ph']
            Object.keys(next).forEach((k) => {
                const m = /^ph(\d+)$/.exec(k)
                if (m && Number(m[1]) >= count) delete next[k]
            })
            return next
        })
        // Dropped or shifted rows take their messages with them; validation
        // re-derives whatever still applies on the next Next.
        setFieldErrors((prev) => {
            const next = { ...prev }
            let changed = false
            Object.keys(next).forEach((k) => {
                if (k.startsWith('sem:ph') || /^phase-\d+-0$/.test(k)) { delete next[k]; changed = true }
            })
            return changed ? next : prev
        })
    }
    // Renaming never moves courses — keys are by index, so the course follows
    // the slot, not the label.
    const setPhaseNameAt = (i: number, v: string) =>
        setPhaseNames((prev) => prev.map((p, idx) => (idx === i ? v : p)))

    // No-phase course count. Shrinking drops the trailing 'phd<i>' courses so a
    // later re-grow starts them blank rather than resurrecting typed work; 'ph'
    // (index 0) is never a 'phd' key so it is untouched. Floors at 1 — a
    // placement always delivers at least one course. (No longer user-facing as a
    // spinner: the form's Add/Remove buttons below are the only writers.)
    const applyNoPhaseCourseCount = (n: number) => {
        const count = Math.max(1, Math.min(20, Math.floor(Number.isFinite(n) ? n : 1)))
        setNoPhaseCourseCount(count)
        setSemesterCourses((prev) => {
            const next = { ...prev }
            Object.keys(next).forEach((k) => {
                const m = /^phd(\d+)$/.exec(k)
                if (m && Number(m[1]) >= count) delete next[k]
            })
            return next
        })
        setFieldErrors((prev) => {
            const next = { ...prev }
            let changed = false
            Object.keys(next).forEach((k) => {
                if (k.startsWith('sem:phd')) { delete next[k]; changed = true }
            })
            return changed ? next : prev
        })
    }

    // "+ Add another course" — one more direct course, through the same clamp.
    const addNoPhaseCourse = () =>
        applyNoPhaseCourseCount(Math.max(1, noPhaseCourseCount) + 1)

    // Remove the course at index i and shift the ones after it down a slot, so
    // the store keys stay dense ('ph','phd1','phd2',… with no holes) and every
    // remaining course keeps its typed work. Floors at one — a placement always
    // delivers at least one course, so the last course has no Remove control.
    const removeNoPhaseCourse = (i: number) => {
        const count = Math.max(1, noPhaseCourseCount)
        if (count <= 1 || i < 0 || i >= count) return
        setSemesterCourses((prev) => {
            const next = { ...prev }
            for (let j = i; j < count - 1; j++) {
                const from = noPhaseCourseKey(j + 1)
                const to = noPhaseCourseKey(j)
                if (next[from]) next[to] = next[from]
                else delete next[to]
            }
            delete next[noPhaseCourseKey(count - 1)]
            return next
        })
        setNoPhaseCourseCount(count - 1)
        // Indices shifted, so every placement-key message may now point at the
        // wrong row — drop them all; validation re-derives on the next Next.
        setFieldErrors((prev) => {
            const next = { ...prev }
            let changed = false
            Object.keys(next).forEach((k) => {
                if (k.startsWith('sem:ph')) { delete next[k]; changed = true }
            })
            return changed ? next : prev
        })
    }

    // Each active placement key must hold exactly ONE CourseEntry before its row
    // renders, because courseApi.update maps over the existing list — an
    // unseeded key would swallow the first edit. The seed is a plain
    // blankCourse(): batches are OPT-IN via the row's own checkbox, exactly as
    // in the degree flow.
    useEffect(() => {
        if (!open || !isPlacementCourses) return
        setSemesterCourses((prev) => {
            let changed = false
            const next = { ...prev }
            placementPhaseKeys().forEach((key) => {
                if (!(next[key] || []).length) {
                    next[key] = [blankCourse()]
                    changed = true
                }
            })
            return changed ? next : prev
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, isPlacementCourses, phaseNames.length])
    // Partner institutions (CSR/COE) — a list with at least one row. Each row is a
    // client picker; extra rows are added via "+ Add another" and removed per-row.
    const setPartnerAt = (index: number, id: string) => {
        setPartnerInstitutionIds((prev) => {
            const base = prev.length ? [...prev] : ['']
            base[index] = id
            return base
        })
    }
    const removePartnerAt = (index: number) => {
        setPartnerInstitutionIds((prev) => prev.filter((_, i) => i !== index))
    }
    const addPartnerRow = () => {
        setPartnerInstitutionIds((prev) => [...(prev.length ? prev : ['']), ''])
    }

    // The parent a level nests under (static — departments per degree, etc.)
    const parentOf = (level: string): string | undefined => PARENT_LEVEL[level]

    // A level is "grouped" when it declares a parent and that parent is enabled
    // too — its values are then entered per parent value (departments per degree).
    const isGrouped = (level: string) => {
        const parent = parentOf(level)
        return Boolean(parent && isLevelEnabled(parent))
    }

    const addGroupedValue = (level: string, group: string, value: string) => {
        setGroupedData((prev) => {
            const forLevel = prev[level] || {}
            const arr = forLevel[group] || []
            if (arr.some((v) => v.toLowerCase() === value.toLowerCase())) return prev
            return { ...prev, [level]: { ...forLevel, [group]: [...arr, value] } }
        })
    }
    const removeGroupedValue = (level: string, group: string, value: string) => {
        setGroupedData((prev) => {
            const forLevel = prev[level] || {}
            return { ...prev, [level]: { ...forLevel, [group]: (forLevel[group] || []).filter((v) => v !== value) } }
        })
    }
    // Masters-driven suggestions for Step 3. `group` narrows Department
    // suggestions to the chosen degree's own departments from Degree Management.
    const suggestionsFor = (level: string, existingValues: string[], group?: string): string[] => {
        const existing = new Set(existingValues.map((v) => v.toLowerCase()))
        let pool: string[] = []
        if (level === 'Degree') {
            pool = degreesList.map((d) => d.degreeName).filter(Boolean)
        } else if (level === 'Department') {
            const matchedDegree = group ? degreesList.find((d) => d.degreeName === group) : undefined
            pool = (matchedDegree ? [matchedDegree] : degreesList)
                .flatMap((d) => (d.departments || []).map((dep) => dep.departmentName))
                .filter(Boolean)
        } else {
            pool = LEVEL_QUICK_VALUES[level] || []
        }
        return Array.from(new Set(pool)).filter((v) => !existing.has(v.toLowerCase())).slice(0, 12)
    }

    // The Degree Program picker offers every degree, not the un-added remainder:
    // it only shows when nothing is chosen, and choosing replaces rather than
    // appends, so subtracting what's "already added" would empty the list.
    const allDegreeOptions = (): string[] =>
        Array.from(new Set(degreesList.map((d) => d.degreeName).filter(Boolean)))

    // Auto semester list for a degree, straight from Degree Management's
    // numberOfSemesters — B.Sc (6) → ['1'..'6'], B.E (8) → ['1'..'8']. This is
    // why semesters are never a shared list: each degree carries its own count.
    const semestersForDegree = (degreeName: string): string[] => {
        const degree = degreesList.find((d) => d.degreeName === degreeName)
        const n = degree?.numberOfSemesters || 0
        return Array.from({ length: n }, (_, i) => String(i + 1))
    }

    // The semesters actually in effect for a degree: exactly what the user has
    // picked, nothing more. They used to default to the degree's full list, but
    // an all-selected control reads as already answered — and it also made the
    // modal jump wide the moment the first department landed, since the
    // workbench gate saw a non-empty semester list it was never really given.
    const effectiveSemesters = (degreeName: string): string[] =>
        groupedData['Semester']?.[degreeName] ?? []

    // ── Degree Program: the single-degree flow ───────────────────────────────
    // A mapping covers exactly one degree, so choosing one REPLACES whatever was
    // there rather than appending. Everything below a degree belongs to it, so
    // switching clears it all — leaving stale departments from the old degree
    // would silently produce a mapping that references structure it doesn't have.
    const chooseDegree = (name: string) => {
        clearFieldError('hierarchy')
        const previous = (masterData['Degree'] || [])[0]
        if (previous === name) return
        setMasterData((prev) => ({ ...prev, Degree: [name] }))
        if (previous) {
            setGroupedData((prev) => ({
                ...prev,
                Department: {},
                Semester: {},
                Section: {},
            }))
            setSemesterCourses({})
            // The old degree's semester windows go with its semesters. Keyed by
            // degree name they would otherwise sit inert and then reappear if the
            // user switched back — everything else under the degree is cleared,
            // so dates surviving would be the one inconsistency.
            setSemesterDates({})
            setFieldErrors((prev) => {
                const next = { ...prev }
                Object.keys(next).forEach((k) => {
                    if (k.startsWith('sem:') || k.startsWith('semdate:')) delete next[k]
                })
                return next
            })
        }

        setScope(null)
        // Deliberately NOT seeding the semester list here. It used to arrive
        // with every semester pre-selected, but a pre-answered control reads as
        // already decided and slipped through unlooked-at — the user picks them
        // in beat 4 (the All/Odd/Even shortcuts make "all of them" one click).
    }


    // Semesters apply to every scope, so changing the set opens or closes the
    // matching path under each one. Closing also drops the courses that lived
    // there — the row is gone, so keeping its data would orphan it.
    const setDegreeSemesters = (degreeName: string, next: string[]) => {
        const sorted = [...next].sort((a, b) => Number(a) - Number(b))
        const before = groupedData['Semester']?.[degreeName] ?? []
        setGroupedData((prev) => ({
            ...prev,
            Semester: { ...(prev['Semester'] || {}), [degreeName]: sorted },
        }))
        const added = sorted.filter((s) => !before.includes(s))
        const removed = before.filter((s) => !sorted.includes(s))
        const depts = groupedData['Department']?.[degreeName] || []
        const scopePaths = depts.flatMap((dept) => {
            const secs = groupedData['Section']?.[`${degreeName}${PATH_SEP}${dept}`] || []
            return secs.length
                ? secs.map((sec) => `${degreeName}${PATH_SEP}${dept}${PATH_SEP}${sec}`)
                : [`${degreeName}${PATH_SEP}${dept}`]
        })
        if (added.length) {
            setSemesterCourses((prev) => {
                const nextMap = { ...prev }
                scopePaths.forEach((sp) => added.forEach((sem) => {
                    const p = `${sp}${PATH_SEP}${sem}`
                    if (nextMap[p] === undefined) nextMap[p] = []
                }))
                return nextMap
            })
        }
        removed.forEach((sem) => scopePaths.forEach((sp) => removeCoursesUnder(`${sp}${PATH_SEP}${sem}`)))
    }

    // A department or section arriving after beat 4 needs the degree's semesters
    // straight away, or its row would open empty with no way to add them.
    const seedSemestersFor = (scopePathValue: string, degreeName: string) => {
        const sems = groupedData['Semester']?.[degreeName] ?? []
        if (!sems.length) return
        setSemesterCourses((prev) => {
            const next = { ...prev }
            sems.forEach((sem) => {
                const p = `${scopePathValue}${PATH_SEP}${sem}`
                if (next[p] === undefined) next[p] = []
            })
            return next
        })
    }

    // How much work hangs off a department — what the remove confirm reports.
    const departmentDataCount = (degreeName: string) => (department: string) => {
        const prefix = `${degreeName}${PATH_SEP}${department}`
        let courses = 0
        Object.entries(semesterCourses).forEach(([path, list]) => {
            if (isUnder(path, prefix)) courses += list.length
        })
        return {
            sections: (groupedData['Section']?.[prefix] || []).length,
            courses,
        }
    }

    // Parent buckets a grouped level nests under.
    // Section is special: it's scoped to the FULL degree→department path, so the
    // same department under two degrees keeps its own sections. Its buckets are
    // composite keys like "B.E ▸ CSE". Everything else nests under a single
    // parent value (departments per degree).
    const parentOptionsFor = (level: string): string[] => {
        // Section is scoped to the FULL degree ▸ department path (composite
        // keys like "B.E ▸ CSE").
        const degreeScoped = level === 'Section'
        if (degreeScoped) {
            // Degree-scoped: one bucket per (degree, department) pair.
            if (isLevelEnabled('Degree') && isGrouped('Department')) {
                const keys: string[] = []
                ;(masterData['Degree'] || []).forEach((deg) => {
                    ;(groupedData['Department']?.[deg] || []).forEach((dept) => {
                        keys.push(`${deg}${PATH_SEP}${dept}`)
                    })
                })
                return keys
            }
            // No degree in play — fall back to plain departments.
            return isGrouped('Department')
                ? Array.from(new Set(Object.values(groupedData['Department'] || {}).flat()))
                : (masterData['Department'] || [])
        }
        const parent = parentOf(level)
        if (!parent) return []
        if (isGrouped(parent)) {
            return Array.from(new Set(Object.values(groupedData[parent] || {}).flat()))
        }
        return masterData[parent] || []
    }

    // Degree length in years from Degree Management. Uses the degree's own
    // `duration` (Number of Years) when set — so a 2-year degree with start 2026
    // ends 2028 — and falls back to deriving it from the semester count
    // (2 semesters = 1 year) for older degrees that have no years recorded.
    // null when neither is known.
    const degreeDurationYears = (degreeName: string): number | null => {
        const degree = degreesList.find((d) => d.degreeName === degreeName)
        if (!degree) return null
        if (degree.duration && degree.duration > 0) return degree.duration
        const sems = degree.numberOfSemesters
        if (!sems) return null
        return Math.ceil(sems / 2)
    }

    // The start year for a degree — only what the user actually typed. It used
    // to fall back to the mapping's year so the field came pre-filled, but a
    // pre-filled year reads as already answered and slipped through unchecked;
    // Save & continue is gated on it, so blank forces a deliberate choice.
    const startYearForDegree = (degreeName: string): string =>
        degreeStartYears[degreeName] ?? ''

    const setDegreeStartYear = (degreeName: string, value: string) => {
        const v = value.replace(/\D/g, '').slice(0, 4)
        setDegreeStartYears((prev) => ({ ...prev, [degreeName]: v }))
    }
    const setDegreeEndYear = (degreeName: string, value: string) => {
        const v = value.replace(/\D/g, '').slice(0, 4)
        setDegreeEndYears((prev) => ({ ...prev, [degreeName]: v }))
    }

    // End year: start + length when the length is known; otherwise the year the
    // user typed. null when it can't be determined yet.
    const endYearForDegree = (degreeName: string): string | null => {
        const dur = degreeDurationYears(degreeName)
        if (dur) {
            const start = parseInt(startYearForDegree(degreeName), 10)
            if (!start || Number.isNaN(start)) return null
            return String(start + dur)
        }
        return degreeEndYears[degreeName] || null
    }

    // The ISO window a semester of this degree must fall inside: 1 Jan of the
    // start year to 31 Dec of the end year. Returned as plain ISO strings so both
    // the validator and the pickers' min/max can use them without re-deriving,
    // and null while either year is still unknown — an unbounded field is better
    // than one bounded by a guess.
    const academicBoundsFor = (degreeName: string): { min: string; max: string; label: string } | null => {
        const start = startYearForDegree(degreeName).trim()
        const end = (endYearForDegree(degreeName) || '').trim()
        if (!/^\d{4}$/.test(start) || !/^\d{4}$/.test(end)) return null
        return {
            min: new Date(Number(start), 0, 1, 0, 0, 0).toISOString(),
            max: new Date(Number(end), 11, 31, 23, 59, 59).toISOString(),
            label: `${start} – ${end}`,
        }
    }

    // ── Semester locking (degree flow) ───────────────────────────────────────
    // Course records for this mapping, fetched to learn which semesters have begun
    // course setup (a course with at least one module) so that ONE semester can be
    // frozen. A brand-new mapping has none, so nothing freezes. The summary
    // projection carries everything this reads (mappingId, coursePath,
    // moduleCount); the shared 'courseStructures' root means handleSave's
    // invalidation below still refreshes the lock computation.
    const { data: allCourseStructuresRes } = useQuery({
        ...courseStructuresSummaryQuery(),
        enabled: open,
    })
    // The semesters (as "<degree>|<sem>" date keys) whose course setup already has
    // at least one module, scoped to THIS mapping. A course sits at "<leaf> ▸ <sem>",
    // so its degree is the first path segment and its semester the last. Once a
    // semester is in here it can no longer be changed — its calendar is committed to
    // real course content. Filtered by mappingId so another mapping never locks this
    // one, and only THAT semester locks, so setting up the next one still works.
    const moduleLockedSemKeys = useMemo(() => {
        const raw = allCourseStructuresRes as { data?: unknown } | undefined
        const list = Array.isArray(raw?.data)
            ? raw.data
            : Array.isArray(allCourseStructuresRes) ? (allCourseStructuresRes as unknown[]) : []
        const mappingId = String(editingMapping?._id || savedIds?.mappingId || '')
        const keys = new Set<string>()
        if (!mappingId) return keys
        for (const c of list as Array<Record<string, unknown>>) {
            if ((Number(c.moduleCount) || 0) <= 0) continue
            if (String(c.mappingId || '') !== mappingId) continue
            const segs = String(c.coursePath || '').split(PATH_SEP)
            if (segs.length < 2) continue
            keys.add(`${segs[0]}${PATH_SEP}${segs[segs.length - 1]}`)
        }
        return keys
    }, [allCourseStructuresRes, editingMapping, savedIds])

    // Whether one semester's own course setup already has a module (so it is locked).
    const semesterHasModule = (degreeName: string, semester: string): boolean =>
        moduleLockedSemKeys.has(semesterDateKey(degreeName, semester))

    // Whether one semester's end date has already passed in real time — the signal
    // that it is over, so the NEXT semester may now be set up.
    const semesterEnded = (degreeName: string, semester: string): boolean => {
        const d = semesterDates[semesterDateKey(degreeName, semester)]
        if (!d?.start || !d?.end) return false
        // A same-day / under-24h range is invalid, so it never counts as ended:
        // the semester stays active and editable to be fixed rather than locking.
        if (new Date(d.end).getTime() - new Date(d.start).getTime() < DAY_MS) return false
        return new Date(d.end) <= new Date()
    }

    // The chosen (in-scope) semesters, in degree order. The user sets these up ONE
    // AT A TIME through the dropdown; only these ask for dates.
    const chosenSemesters = (degreeName: string): string[] => {
        const scope = new Set(effectiveSemesters(degreeName))
        return semestersForDegree(degreeName).filter((s) => scope.has(s))
    }

    // The single semester currently being set up: the latest chosen one whose end
    // date has NOT yet passed. Once its end date passes it commits and nothing is
    // active until the next semester is picked. '' when none is active.
    const activeSemesterFor = (degreeName: string): string => {
        const chosen = chosenSemesters(degreeName)
        const last = chosen[chosen.length - 1]
        return last && !semesterEnded(degreeName, last) ? last : ''
    }

    // The lock state of one CHOSEN semester's date fields. Only the active semester
    // (the current one, still module-free) is editable; a semester locked by a
    // module, or one that has already ended, is read-only. An unchosen semester has
    // no date fields — the dropdown is what adds it.
    const semesterLockFor = (degreeName: string, semester: string): SemLock => {
        const chosen = chosenSemesters(degreeName)
        if (!chosen.includes(semester)) {
            return { state: 'waiting', canEditStart: false, canEditEnd: false }
        }
        if (semesterHasModule(degreeName, semester)) {
            return { state: 'completed', canEditStart: false, canEditEnd: false,
                hint: 'Locked — a module has been added for this semester' }
        }
        if (semester !== activeSemesterFor(degreeName)) {
            return { state: 'completed', canEditStart: false, canEditEnd: false,
                hint: 'Locked — this semester has ended' }
        }
        return { state: 'active', canEditStart: true, canEditEnd: true }
    }

    // How each semester appears in the dropdown that lists them ALL, plus the hover
    // tooltip (`reason`) for a locked one. Exactly ONE semester is being set up at a
    // time — the "current" pick — with the ended ones kept as read-only history:
    //   • The current pick can be changed freely: clicking any other still-open
    //     semester SWAPS to it (so "change Semester 2 to 3" just works), until a
    //     module locks that pick.
    //   • A semester commits when its end date passes; it then joins history and the
    //     user picks the next one. You can't go back into or before that run.
    //   • A module added to the current semester locks it — it can no longer be
    //     changed or swapped away, and the next stays shut until its end date passes.
    //   chosen    — added (its dates show below); ticked. Changeable only while it
    //               is the current, module-free semester.
    //   available — may be picked or swapped to now.
    //   blocked   — a committed/ended semester (can't go back), or everything while
    //               the current one is locked by a module.
    const semesterStatusFor = (degreeName: string, semester: string): SemStatus => {
        const chosen = chosenSemesters(degreeName)
        const all = semestersForDegree(degreeName)
        const active = activeSemesterFor(degreeName)
        // Committed = chosen semesters whose end date has passed (locked history).
        const committedIdxs = chosen.filter((s) => semesterEnded(degreeName, s)).map((s) => all.indexOf(s))
        // The earliest position still open: just after the last committed semester.
        const frontier = committedIdxs.length ? Math.max(...committedIdxs) + 1 : 0

        if (chosen.includes(semester)) {
            // The current, module-free semester is the only changeable one.
            if (semester === active && !semesterHasModule(degreeName, semester)) {
                return { status: 'chosen', removable: true }
            }
            return { status: 'chosen', removable: false, reason: semesterHasModule(degreeName, semester)
                ? 'Locked — a module has been added for this semester, so it can no longer be changed.'
                : 'Locked — this semester has ended.' }
        }
        // Can't go back into or before the committed (ended) run.
        if (all.indexOf(semester) < frontier) {
            return { status: 'blocked', reason: chosen.length
                ? `Locked — this mapping starts at Semester ${chosen[0]}; earlier semesters are done.`
                : `Locked — Semester ${semester} is already past.` }
        }
        // Forward of the committed run. A module on the current semester freezes
        // selection until its end date passes; otherwise any forward semester is
        // selectable — pick the next, or swap the current pick to it.
        if (active && semesterHasModule(degreeName, active)) {
            const end = semesterDates[semesterDateKey(degreeName, active)]?.end
            return { status: 'blocked', reason: end
                ? `Locked — Semester ${active} is locked by a module; the next opens once it ends on ${fmtShortDate(end as string)}.`
                : `Locked — Semester ${active} is locked by a module.` }
        }
        return { status: 'available' }
    }

    // Pick a semester in the dropdown. Three cases:
    //   • click the changeable current one → unpick it (and clear its dates);
    //   • click another while one is active → SWAP: replace the current pick with
    //     the clicked semester (the previous pick's dates are dropped);
    //   • click one with no active semester → add it as the next in sequence.
    // Anything the dropdown marks non-selectable is ignored here as a backstop.
    const toggleSemester = (degreeName: string, semester: string) => {
        clearFieldError('hierarchy')
        const scope = effectiveSemesters(degreeName)
        const clearSemErrors = (sem: string) => {
            clearFieldError(`semdate:${semesterDateKey(degreeName, sem)}:start`)
            clearFieldError(`semdate:${semesterDateKey(degreeName, sem)}:end`)
        }
        if (scope.includes(semester)) {
            // Unpick the current changeable semester.
            if (!semesterStatusFor(degreeName, semester).removable) return
            setDegreeSemesters(degreeName, scope.filter((s) => s !== semester))
            setSemesterDates((prev) => {
                const next = { ...prev }
                delete next[semesterDateKey(degreeName, semester)]
                return next
            })
            clearSemErrors(semester)
            return
        }
        if (semesterStatusFor(degreeName, semester).status !== 'available') return
        const active = activeSemesterFor(degreeName)
        if (active) {
            // Swap: drop the current active pick, take the clicked one instead.
            setDegreeSemesters(degreeName, [...scope.filter((s) => s !== active), semester])
            setSemesterDates((prev) => {
                const next = { ...prev }
                delete next[semesterDateKey(degreeName, active)]
                return next
            })
            clearSemErrors(active)
        } else {
            // Add the next semester in sequence.
            setDegreeSemesters(degreeName, Array.from(new Set([...scope, semester])))
        }
    }

    const setSemesterDate = (degreeName: string, semester: string, field: 'start' | 'end', iso: string) => {
        // Backstop for the disabled pickers: a locked field must never change,
        // even if some path bypasses the UI guard.
        const lock = semesterLockFor(degreeName, semester)
        if (field === 'start' && !lock.canEditStart) return
        if (field === 'end' && !lock.canEditEnd) return
        const key = semesterDateKey(degreeName, semester)
        clearFieldError(`semdate:${key}:${field}`)
        // The paired field's message is cleared too: "End must be after the
        // start" is a statement about the PAIR, so moving the start is just as
        // likely to have resolved it as moving the end.
        clearFieldError(`semdate:${key}:${field === 'start' ? 'end' : 'start'}`)
        setSemesterDates((prev) => {
            const current = prev[key] || { start: '', end: '' }
            return { ...prev, [key]: { ...current, [field]: iso } }
        })
        // Real-time 24h guard: a same-day / under-24h window flags its error the
        // moment it is picked, not only on Save. Paired with semesterEnded ignoring
        // such ranges, the semester stays editable so the typo can be corrected.
        const pair = { ...(semesterDates[key] || { start: '', end: '' }), [field]: iso }
        if (pair.start && pair.end && new Date(pair.end).getTime() - new Date(pair.start).getTime() < DAY_MS) {
            setFieldErrors((prev) => ({ ...prev, [`semdate:${key}:end`]: 'End must be at least 24 hours after the start' }))
        }
        // Scope is owned by the dropdown (addSemester); a semester is always
        // chosen before its dates can be set, so nothing to expand here.
    }

    // "2026 – 2029" convenience span for the preview (null if end unknown).
    const academicSpanForDegree = (degreeName: string): string | null => {
        const end = endYearForDegree(degreeName)
        const start = startYearForDegree(degreeName)
        if (!start || !end) return null
        return `${start} – ${end}`
    }

    const trimmedBatchNames = () => batchNames.slice(0, batchCount).map((n) => n.trim())

    const validateStep = (step: number): boolean => {
        // Steps 1 and 2 collect every problem at once and surface them under the
        // fields themselves — no toast, and no stopping at the first failure, so
        // the user sees everything that needs fixing in one pass.
        if (step === 0) {
            const errs: Record<string, string> = {}
            if (!clientId) errs.client = 'Please select a client'
            if (!service.trim()) errs.service = 'This client has no business model — set it in the Clients tab first'
            // Without a model the whole rest of the wizard is undefined: the
            // structure is model-driven, so an unset model silently falls back to
            // batches-only and would save a mapping with no hierarchy at all.
            if (!serviceModels.length) errs.serviceModel = 'Please select a service model'
            if (!year.trim()) errs.year = 'Please enter the year'
            if (isPartnerFlow) {
                const chosen = partnerInstitutionIds.filter(Boolean)
                if (!chosen.length) errs.partner = 'Please select a partner institution'
                else if (chosen.some((id) => id === clientId)) {
                    errs.partner = 'Partner institution must be different from the client'
                }
            }
            setFieldErrors(errs)
            if (Object.keys(errs).length) return false
        }
        if (step === 1) {
            const errs: Record<string, string> = {}
            if (isDegreeFlow) {
                // The setup row, in the order it's filled in — report the first
                // thing that's actually missing rather than all three at once.
                const deg = (masterData['Degree'] || [])[0]
                if (!deg) errs.hierarchy = 'Pick a degree'
                else if (!startYearForDegree(deg).trim()) {
                    errs.degreeStartYear = 'Enter the starting year'
                    errs.hierarchy = 'Enter the starting year'
                } else if (parseInt(startYearForDegree(deg), 10) < new Date().getFullYear()) {
                    // The picker no longer offers a past year, so this only fires
                    // for an OLDER SAVED mapping being edited — it catches stored
                    // data rather than a fresh mistake, which is exactly why it
                    // cannot be left to the dropdown alone.
                    const msg = `The starting year cannot be before ${new Date().getFullYear()}`
                    errs.degreeStartYear = msg
                    errs.hierarchy = msg
                } else if (!(groupedData['Department']?.[deg] || []).length) {
                    errs.hierarchy = 'Pick at least one department'
                } else if (!(groupedData['Semester']?.[deg] || []).length) {
                    errs.hierarchy = 'Pick at least one semester'
                }
                // Semester windows. Dates are optional — a mapping may be saved
                // before the calendar is known — but anything half-filled or
                // outside the degree's own span is a mistake worth catching here
                // rather than at the far end in Course Setup.
                if (deg) {
                    const bounds = academicBoundsFor(deg)
                    const startYearNum = parseInt(startYearForDegree(deg), 10)
                    // Numeric order, not the order they were ticked in: the
                    // chronological check below compares each semester with the
                    // one BEFORE it, which is only meaningful in sequence.
                    const orderedSems = [...effectiveSemesters(deg)].sort((a, b) => {
                        const na = parseInt(a, 10)
                        const nb = parseInt(b, 10)
                        return Number.isNaN(na) || Number.isNaN(nb) ? a.localeCompare(b) : na - nb
                    })
                    // The last semester before this one that actually has an end
                    // date, so a gap in the middle does not disable the ordering
                    // check for everything after it.
                    let prev: { sem: string; end: string } | null = null
                    orderedSems.forEach((sem) => {
                        const key = semesterDateKey(deg, sem)
                        const d = semesterDates[key]
                        if (!d || (!d.start && !d.end)) return
                        if (!d.start) errs[`semdate:${key}:start`] = 'Add the start date'
                        if (!d.end) errs[`semdate:${key}:end`] = 'Add the end date'
                        if (d.start && d.end && new Date(d.end).getTime() - new Date(d.start).getTime() < DAY_MS) {
                            errs[`semdate:${key}:end`] = 'End must be at least 24 hours after the start'
                        }
                        // Outside the degree's own years the date is almost
                        // certainly a typo — a semester cannot run before the
                        // cohort starts or after it graduates.
                        if (bounds) {
                            if (d.start && (d.start < bounds.min || d.start > bounds.max)) {
                                errs[`semdate:${key}:start`] = `Must fall within ${bounds.label}`
                            }
                            if (d.end && (d.end < bounds.min || d.end > bounds.max)) {
                                errs[`semdate:${key}:end`] = `Must fall within ${bounds.label}`
                            }
                        }
                        // Which calendar year this semester may begin in. Two
                        // semesters make one academic year, and an academic year
                        // straddles two calendar years: with a 2026 intake,
                        // sem 1 runs Jul–Dec 2026 but sem 2 runs Jan–May 2027.
                        // So an ODD semester must start in its academic year's
                        // first calendar year, while an EVEN one may start in
                        // either half. That is what catches "start year is 2026
                        // but semester 1 begins in 2027".
                        const n = parseInt(sem, 10)
                        if (d.start && !errs[`semdate:${key}:start`] && startYearNum && !Number.isNaN(n) && n > 0) {
                            const academicYear = Math.floor((n - 1) / 2)
                            const base = startYearNum + academicYear
                            const allowed = n % 2 === 1 ? [base] : [base, base + 1]
                            const actual = new Date(d.start).getFullYear()
                            if (!allowed.includes(actual)) {
                                errs[`semdate:${key}:start`] = allowed.length === 1
                                    ? `Semester ${n} should start in ${allowed[0]}`
                                    : `Semester ${n} should start in ${allowed[0]} or ${allowed[1]}`
                            }
                        }
                        // Semesters run one after another — an overlap means one
                        // of the two windows is wrong, and the later one is the
                        // one the user is most likely still editing.
                        if (d.start && prev && !errs[`semdate:${key}:start`]) {
                            if (new Date(d.start) <= new Date(prev.end)) {
                                errs[`semdate:${key}:start`] = `Must start after semester ${prev.sem} ends`
                            }
                        }
                        if (d.end && !errs[`semdate:${key}:end`]) prev = { sem, end: d.end }
                    })
                    if (Object.keys(errs).some((k) => k.startsWith('semdate:'))) {
                        errs.hierarchy = errs.hierarchy || 'Check the semester dates'
                    }
                }
            }
            if (isDegreeFlow) {
                // Courses live on the tree's semesters here. Only rows the user
                // actually asked for (by setting a count) are validated — a
                // semester left at zero courses is legitimate.
                // Only degree-shaped keys. The placement flow shares this store,
                // and switching service model mid-wizard leaves its keys behind —
                // a degree path always contains PATH_SEP (it joins at least degree
                // and department), a placement key never does, so the two partition
                // cleanly and neither flow can ever read the other's rows.
                Object.entries(semesterCourses).filter(([path]) => path.includes(PATH_SEP)).forEach(([path, list]) => {
                    const seen = new Map<string, number>()
                    list.forEach((c, i) => {
                        if (!c.category) errs[`sem:${path}:${i}:category`] = 'Pick a category'
                        if (!c.courseName.trim()) errs[`sem:${path}:${i}:courseName`] = 'Pick a course'
                        else {
                            const key = `${c.category}::${c.courseName.trim().toLowerCase()}`
                            if (seen.has(key)) errs[`sem:${path}:${i}:courseName`] = 'Already added in this semester'
                            else seen.set(key, i)
                        }
                        // Only a course that opted into batches has to name them.
                        if (c.batchesEnabled) {
                            const seenBatch = new Map<string, number>()
                            c.batches.forEach((b, bi) => {
                                const v = b.trim()
                                if (!v) errs[`sem:${path}:${i}:batch:${bi}`] = 'Name this batch'
                                else if (seenBatch.has(v.toLowerCase())) {
                                    errs[`sem:${path}:${i}:batch:${bi}`] = 'Duplicate batch name'
                                } else seenBatch.set(v.toLowerCase(), bi)
                            })
                        }
                    })
                })
                if (Object.keys(errs).some((k) => k.startsWith('sem:'))) {
                    errs.hierarchy = errs.hierarchy || 'Complete the highlighted courses'
                }
            } else if (isPlacementCourses) {
                // Phase names first — the saved per-phase paths are keyed by
                // name, so a blank or duplicated name would collide on disk.
                // Phases may legitimately be zero. Error keys reuse the
                // phase-<i>-0 pattern the batch-phase inputs used, so the
                // clearing wiring stays one convention.
                const seenPhase = new Map<string, number>()
                phaseNames.forEach((p, i) => {
                    const v = p.trim()
                    if (!v) errs[`phase-${i}-0`] = 'Name this phase'
                    // The phase name IS the stored course path, and PATH_SEP is
                    // how paths are told apart — a name containing it would
                    // corrupt shape detection on reload and in Course Setup.
                    else if (v.includes(PATH_SEP)) errs[`phase-${i}-0`] = `Name cannot contain "${PATH_SEP.trim()}"`
                    else if (seenPhase.has(v.toLowerCase())) errs[`phase-${i}-0`] = 'Duplicate phase name'
                    else seenPhase.set(v.toLowerCase(), i)
                })
                // Exactly one course per phase (or the single zero-phase course):
                // category + name; batches only when opted in. Error
                // keys keep the `sem:<path>:` shape so courseApi.errorAt
                // addresses them with the store key ('ph*') and CourseRow needs
                // no knowledge of which flow it renders inside.
                placementPhaseKeys().forEach((key) => {
                    const c = (semesterCourses[key] || [])[0]
                    // Phases ON: the phase name IS the course name, validated
                    // with the phase names above. Only the zero-phase single
                    // course carries a name of its own. No category here — the
                    // phase-as-course shape has none.
                    if (!phaseNames.length && (!c || !c.courseName.trim())) {
                        errs[`sem:${key}:0:courseName`] = 'Name this course'
                    }
                    if (!c) return
                    // Batches are OPT-IN, same rule as the degree flow: only a
                    // course that ticked the box has to name them.
                    if (c.batchesEnabled) {
                        const seenBatch = new Map<string, number>()
                        c.batches.forEach((b, bi) => {
                            const v = b.trim()
                            if (!v) errs[`sem:${key}:0:batch:${bi}`] = 'Name this batch'
                            else if (seenBatch.has(v.toLowerCase())) errs[`sem:${key}:0:batch:${bi}`] = 'Duplicate batch name'
                            else seenBatch.set(v.toLowerCase(), bi)
                        })
                        if (!c.batches.length) errs[`sem:${key}:0:batch:0`] = 'Add at least one batch'
                    }
                })
                if (Object.keys(errs).some((k) => k.startsWith('sem:') || k.startsWith('phase-'))) {
                    errs.hierarchy = errs.hierarchy || 'Complete the highlighted fields'
                }
            } else {
                // Every course row must be complete, and no course may repeat.
                const seenCourses = new Map<string, number>()
                courses.forEach((c, i) => {
                    if (!c.category) errs[`courseCategory-${i}`] = 'Please select a course category'
                    if (!c.courseName.trim()) errs[`courseName-${i}`] = 'Please enter the course name'
                    else {
                        const key = `${c.category}::${c.courseName.trim().toLowerCase()}`
                        if (seenCourses.has(key)) errs[`courseName-${i}`] = 'This course is already added'
                        else seenCourses.set(key, i)
                    }
                })
            }

            // Mapping-level batch names only exist in the flat flows now — the
            // degree flow keeps batches per course, and Placement Training's
            // batches belong to its phase courses. Don't validate what the flow
            // doesn't render.
            // Batches are opt-in in the flat flows now: the Enable-batches checkbox
            // writes a count of zero, and a mapping with none has no batch rows on
            // screen to validate.
            const batchesVisible = !isDegreeFlow && !isPlacementCourses && batchCount > 0
            if (batchesVisible) {
                const names = trimmedBatchNames()
                names.forEach((n, i) => {
                    if (!n) errs[`batch-${i}`] = batchCount === 1 ? 'Please enter the batch name' : `Please enter the ${ordinal(i + 1)} batch name`
                })
                // Duplicate names — flag every repeat after the first occurrence,
                // so the error lands on the row the user needs to change.
                const seen = new Map<string, number>()
                names.forEach((n, i) => {
                    if (!n) return
                    const key = n.toLowerCase()
                    if (seen.has(key)) errs[`batch-${i}`] = 'Batch names must be unique'
                    else seen.set(key, i)
                })
                // Only a batch that switched phases on has to name them.
                for (let i = 0; i < batchCount; i++) {
                    if (!batchPhasesEnabled[i]) continue
                    const phases = batchPhases[i] || []
                    if (!phases.length) { errs[`phase-${i}-0`] = 'Add at least one phase'; continue }
                    const seenPhase = new Map<string, number>()
                    phases.forEach((p, pi) => {
                        const v = p.trim()
                        if (!v) errs[`phase-${i}-${pi}`] = 'Name this phase'
                        else if (seenPhase.has(v.toLowerCase())) errs[`phase-${i}-${pi}`] = 'Duplicate phase name'
                        else seenPhase.set(v.toLowerCase(), pi)
                    })
                }
            }
            setFieldErrors(errs)
            if (Object.keys(errs).length) {
                // Step 2's accordions fold their sections, so a message can land
                // out of sight and the save reads as having failed for no reason.
                // Only one flow is mounted at a time; the other ref is null.
                placementRevealRef.current?.()
                simpleRevealRef.current?.()
                degreeRevealRef.current?.()
                return false
            }
        }
        return true
    }

    const goToStep = (target: number) => {
        // The stepper is only visually inert during the preview; it stays in
        // the tab order, and a keyboard Enter must not step the hidden form.
        if (phase === 'preview') return
        if (target > stepIndex) {
            for (let s = stepIndex; s < target; s++) {
                if (!validateStep(s)) return
            }
        }
        setStepDir(target >= stepIndex ? 1 : -1)
        setStepIndex(target)
    }

    // Save up to (and including) the given step. Saving from Step 1 stores the
    // mapping as-is — it appears in the list and can be completed later via Edit.
    // No course record is created: courses are defined in Course Management, and
    // the mapping only records which of them run where.
    const handleSave = async (uptoStep: number = steps.length - 1) => {
        for (let s = 0; s <= uptoStep; s++) {
            if (!validateStep(s)) { setStepIndex(s); return }
        }
        // Batch names for the mapping as a whole. Degree Program has no shared
        // batch list — they belong to individual courses — so the distinct names
        // used across the tree stand in; Placement Training likewise carries its
        // batches on each phase's course, so the mapping-level list is their
        // union (which is what legacy read models keep seeing as Batch values).
        const names = isDegreeFlow
            ? Array.from(new Set(
                Object.values(semesterCourses)
                    .flatMap((list) => list.filter((c) => c.batchesEnabled).flatMap((c) => c.batches))
                    .map((b) => b.trim())
                    .filter(Boolean)
            ))
            : isPlacementCourses
                ? Array.from(new Set(
                    placementPhaseKeys()
                        // Only OPTED-IN batches: unticking keeps typed names in
                        // state on purpose, and letting them leak here would put
                        // batches the save excluded into masterData and the
                        // legacy read models.
                        .flatMap((k) => (semesterCourses[k] || [])
                            .filter((c) => c.batchesEnabled)
                            .flatMap((c) => c.batches))
                        .map((b) => b.trim())
                        .filter(Boolean)
                ))
                : trimmedBatchNames().filter(Boolean)

        // Fixed hierarchy for this flow (AcademicYear rides along as an extra
        // enabled level so its master-data entries survive server normalisation).
        const hierarchy: HierarchyLevelConfig[] = ALL_LEVELS.map((level) => ({
            level,
            enabled: isLevelEnabled(level),
            mandatory: mandatoryLevels.has(level),
        }))
        if (isDegreeFlow) {
            hierarchy.push({ level: ACADEMIC_YEAR_LEVEL, enabled: true, mandatory: false })
            // Same trick, same reason: the server keeps master data only for
            // levels this array marks enabled, so an unlisted synthetic level is
            // dropped without a word.
            hierarchy.push({ level: SEMESTER_DATES_LEVEL, enabled: true, mandatory: false })
        }

        // Master data — kept in the legacy shape so the embedded client.services
        // read model (course cascade, user listings, …) stays in sync unchanged.
        const masterEntries: MasterDataEntry[] = [{ level: 'Batch', values: names }]
        if (isPlacementCourses) {
            // Phase names ride in masterData so the new shape needs no schema
            // change; the Batch union above is what keeps legacy read models
            // (embedded client.services) seeing batch names.
            const phases = phaseNames.map((p) => p.trim()).filter(Boolean)
            if (phases.length) masterEntries.push({ level: 'Phase', values: phases })
        } else if (isDegreeFlow) {
            const degs = masterData['Degree'] || []
            if (degs.length) masterEntries.push({ level: 'Degree', values: degs })
            degs.forEach((deg) => {
                const depts = groupedData['Department']?.[deg] || []
                if (depts.length) masterEntries.push({ level: 'Department', group: deg, values: depts })
                const sems = effectiveSemesters(deg)
                if (sems.length) masterEntries.push({ level: 'Semester', group: deg, values: sems })
                // One entry per semester that actually has a window. Semesters
                // left blank are skipped rather than written as "|", so a mapping
                // saved before this field existed stays indistinguishable from
                // one where the user simply did not fill the dates in.
                sems.forEach((sem) => {
                    const d = semesterDates[semesterDateKey(deg, sem)]
                    if (!d || (!d.start && !d.end)) return
                    masterEntries.push({
                        level: SEMESTER_DATES_LEVEL,
                        group: semesterDateKey(deg, sem),
                        values: [`${d.start}${SEMESTER_DATE_SEP}${d.end}`],
                    })
                })
                depts.forEach((dept) => {
                    const key = `${deg}${PATH_SEP}${dept}`
                    const secs = groupedData['Section']?.[key] || []
                    if (secs.length) masterEntries.push({ level: 'Section', group: key, values: secs })
                })
                const start = startYearForDegree(deg).trim()
                const end = (endYearForDegree(deg) || '').trim()
                if (start || end) masterEntries.push({ level: ACADEMIC_YEAR_LEVEL, group: deg, values: [start, end] })
            })
        }

        // Courses as a flat list. The degree flow collects them from the tree,
        // tagging each with the semester path ("B.E ▸ CSE ▸ A ▸ 3") it belongs
        // to; every other flow has a single list with no path.
        const mappedCourses = isDegreeFlow
            // Degree-shaped keys only — see the matching filter in validateStep.
            ? Object.entries(semesterCourses).filter(([path]) => path.includes(PATH_SEP)).flatMap(([path, list]) =>
                list
                    .filter((c) => c.category && c.courseName.trim())
                    .map((c) => ({
                        category: c.category,
                        courseName: c.courseName.trim(),
                        path,
                        batchesEnabled: c.batchesEnabled,
                        batches: c.batchesEnabled
                            ? c.batches.map((b) => b.trim()).filter(Boolean)
                            : [],
                    })))
            : isPlacementCourses
            // New placement shape: one course per phase, its path the 1-part
            // phase NAME ('' for the zero-phase single course), and its batches
            // on the course itself. batchConfigs stays EMPTY below — that pair
            // (empty batchConfigs, Phase masterData / batch-carrying courses)
            // is exactly what load uses to tell new shape from legacy.
            ? placementPhaseKeys().flatMap((key, i) => {
                const c = (semesterCourses[key] || [])[0]
                // The phase name IS the course name (and, being 1-part, also the
                // stored path). The zero-phase course carries its own name with
                // an empty path. No category — the phase-as-course shape has none.
                const name = phaseNames.length
                    ? (phaseNames[i] || '').trim()
                    : (c?.courseName || '').trim()
                if (!name) return []
                return [{
                    category: '',
                    courseName: name,
                    path: phaseNames.length ? name : '',
                    batchesEnabled: Boolean(c?.batchesEnabled),
                    batches: c?.batchesEnabled
                        ? c.batches.map((b) => b.trim()).filter(Boolean)
                        : [],
                }]
            })
            : courses
                .filter((c) => c.category && c.courseName.trim())
                .map((c) => ({ category: c.category, courseName: c.courseName.trim() }))

        // Per-batch configs for the flat flows. Placement Training writes an
        // EMPTY list on purpose: nothing batch-level remains in the new shape,
        // and the emptiness is the marker load uses to recognise it.
        const batchConfigs: BatchConfig[] = isPlacementCourses
            ? []
            : names.map((n, i) => ({
                name: n,
                degree: '',
                departments: [],
                phases: batchPhasesEnabled[i] ? (batchPhases[i] || []).map((p) => p.trim()).filter(Boolean) : [],
            }))

        // No course record is created by the mapping any more — course setup
        // (level, hierarchy, resources) lives in Course Management. The mapping
        // records which courses run where; courseCode is preserved so mappings
        // saved before this still point at whatever they created back then.
        const courseCode = editingMapping?.courseCode || ''
        const coursePayload: Record<string, unknown> | null = null

        // A partial (non-final-step) save keeps the wizard open, so the mapping's
        // id has to come from either the record being edited or an earlier
        // partial save this session — otherwise the next save would create a
        // duplicate mapping instead of updating the one just saved.
        const mappingId = editingMapping?._id || savedIds?.mappingId
        const existingCourseId = editingMapping?.courseId || savedIds?.courseId || ''

        const result = await onSave(
            {
                client: clientId as string,
                // CSR/COE carry partner institutions; every other service clears them.
                partnerInstitutions: isPartnerFlow
                    ? Array.from(new Set(partnerInstitutionIds.filter(Boolean)))
                    : [],
                service: service.trim(),
                year: year.trim(),
                serviceModels,
                hierarchy,
                masterData: masterEntries,
                // The mapping's legacy single-value columns. Placement Training no
                // longer has a mapping-level course to fill them from, so the
                // first phase's course stands in — leaving them empty would
                // break every consumer still reading these two fields.
                courseName: (isPlacementCourses ? mappedCourses[0]?.courseName || '' : courseName).trim(),
                category: (isPlacementCourses ? mappedCourses[0]?.category || '' : category),
                // Every course picked in Step 2. The mapping's own
                // courseName/category above stay the first one for compatibility;
                // this carries the full list. Under Degree Program the courses
                // hang off the tree, so each one records the semester path it
                // was entered under.
                courses: mappedCourses,
                // Step 3 — which of the institution's Resource Management types
                // this mapping's courses default to using.
                resourceDefaults,
                prtMode: isPlacement && !isDegreeFlow ? prtMode : '',
                batchConfigs,
                courseCode,
            },
            coursePayload,
            mappingId,
            existingCourseId
        )
        // Nothing closes the wizard on success any more — a partial save stays
        // on its step, and a full (last-step) save swaps to the in-modal
        // preview of what was written. Either way the ids are remembered so the
        // NEXT save (including a re-save after Modify) updates this same
        // mapping instead of creating a duplicate.
        if (result) {
            setSavedIds(result)
            if (uptoStep === steps.length - 1) {
                // Snapshotted NOW, not derived at render: the preview must show
                // what this save wrote. Deriving live would let any state change
                // after this moment silently present a tree the record does not
                // contain.
                setPreviewModel(buildPreviewModel())
                setPhase('preview')
            }
        }
        // Success is what lets Save & Next actually advance — stepping forward
        // after a failed save would walk away from the errors it just raised.
        return Boolean(result)
    }

    // The preview's view model, derived from the very same state handleSave
    // just serialised (masterData/groupedData/semesterCourses for the degree
    // flow, the batch/phase config plus the placement store for Placement
    // Training, the flat course list for everything else). Kept beside
    // handleSave so the two readings of that state cannot drift apart.
    const buildPreviewModel = (): Pick<MappingPreviewProps, 'degree' | 'batches' | 'flatCourses' | 'phasesTree'> => {
        const completeAt = (path: string) =>
            (semesterCourses[path] || []).filter((c) => c.category && c.courseName.trim())
        if (isDegreeFlow) {
            // First degree only, knowingly: the wizard's whole editing model is
            // single-degree (chooseDegree replaces), and validateStep checks
            // deg[0] the same way. A legacy multi-degree mapping saves all of
            // its degrees but previews just the one the form can show.
            const deg = (masterData['Degree'] || [])[0] || ''
            const sems = effectiveSemesters(deg)
            // Courses live at "<leaf> ▸ <semester>" where the leaf is the
            // department or, when it has sections, each section — the same
            // paths scope.ts builds and handleSave's mappedCourses walks.
            const semestersAt = (base: string) => sems.map((sem) => ({
                semester: sem,
                courses: completeAt(`${base}${PATH_SEP}${sem}`).map((c) => ({
                    category: c.category,
                    courseName: c.courseName.trim(),
                    batches: c.batchesEnabled ? c.batches.map((b) => b.trim()).filter(Boolean) : [],
                })),
            }))
            return {
                degree: {
                    name: deg,
                    startYear: startYearForDegree(deg).trim(),
                    endYear: (endYearForDegree(deg) || '').trim(),
                    departments: (groupedData['Department']?.[deg] || []).map((dept) => {
                        const base = `${deg}${PATH_SEP}${dept}`
                        const secs = groupedData['Section']?.[base] || []
                        return {
                            name: dept,
                            sections: secs.length
                                ? secs.map((sec) => ({ name: sec, semesters: semestersAt(`${base}${PATH_SEP}${sec}`) }))
                                : [{ name: null, semesters: semestersAt(base) }],
                        }
                    }),
                },
            }
        }
        if (isPlacementCourses) {
            // The new placement tree: phases at mapping level, exactly ONE
            // course per phase, batches under the course. `name: null` marks
            // the zero-phase single entry; `course` is null only when the row
            // is genuinely empty (a partial save can leave it so).
            const entryAt = (key: string, derivedName?: string) => {
                const c: CourseEntry | undefined = (semesterCourses[key] || [])[0]
                // The course name derives exactly as the SAVE derives it: the
                // phase name when phases are on, the entry's own name otherwise.
                const name = (derivedName ?? c?.courseName ?? '').trim()
                return {
                    course: name ? { category: '', courseName: name } : null,
                    // Only when opted in — the preview must show what the save
                    // WRITES, and the save excludes unticked batches.
                    batches: c && c.batchesEnabled ? c.batches.map((b) => b.trim()).filter(Boolean) : [],
                }
            }
            return {
                phasesTree: phaseNames.length
                    ? phaseNames.map((p, i) => ({ name: p.trim() || `Phase ${i + 1}`, ...entryAt(`ph${i}`, p) }))
                    : [{ name: null as string | null, ...entryAt('ph') }],
            }
        }
        // The flat flows share the batch/phase shape (phases only ever arrive
        // from legacy data — their BatchCards render with showPhases off) and
        // carry their courses as the flat list.
        const noCourses: { category: string; courseName: string }[] = []
        const batches = Array.from({ length: batchCount }, (_, i) => {
            const phaseList = batchPhasesEnabled[i] ? (batchPhases[i] || []) : []
            return {
                name: (batchNames[i] || '').trim(),
                phases: phaseList.length
                    ? phaseList
                        .map((p) => ({ name: p.trim() as string | null, courses: noCourses }))
                        .filter((p) => p.name)
                    : [{ name: null, courses: noCourses }],
            }
        }).filter((b) => b.name)
        return {
            batches,
            flatCourses: courses
                .filter((c) => c.category && c.courseName.trim())
                .map((c) => ({ category: c.category, courseName: c.courseName.trim() })),
        }
    }

    const overlayVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.2, ease: [0.2, 0, 0, 1] as const } },
        exit: { opacity: 0, transition: { duration: 0.16 } },
    }
    // One standard tween under the console's 240ms ceiling — the panel scales
    // in quietly rather than bouncing; exit stays a shorter fade so closing
    // never feels slower than opening.
    const modalVariants = {
        hidden: { opacity: 0, scale: 0.97, y: 12 },
        visible: {
            opacity: 1,
            scale: 1,
            y: 0,
            transition: { duration: 0.2, ease: [0.2, 0, 0, 1] as const },
        },
        exit: { opacity: 0, scale: 0.98, y: 8, transition: { duration: 0.14, ease: 'easeIn' as const } },
    }

    const title = isEditing ? 'Edit service mapping' : 'Map service'
    const subtitle = phase === 'preview'
        ? 'Saved — review the structure below'
        : `Step ${stepIndex + 1} of ${steps.length} · ${steps[stepIndex].label}`

    // Who this mapping is for — surfaced in the top bar so the user always sees
    // the client and the service (model) being configured while stepping through.
    const headerClientName = clients.find((c) => c._id === clientId)?.clientCompany
    const headerService = [service, ...serviceModels].filter(Boolean).join(' · ')

    // Data for the HierarchyBuilder tree editor — one entry per added degree,
    // built from the exact same closures/state the flat list used to read
    // directly (degreeDurationYears, effectiveSemesters, groupedData, …).
    // Everything the tree needs to read and edit a semester's courses. Errors are
    // keyed by the same path the tree addresses nodes with, so a failed Next
    // lands the message on the exact course row that's incomplete.
    const courseApi: CourseApi = {
        categories: categoryOptions.map((c) => ({ id: c._id, name: c.categoryName })),
        namesFor: courseNamesFor,
        coursesAt,
        setCount: setSemesterCourseCount,
        removeAt: removeCourseAt,
        update: (path, index, patch) => {
            clearFieldError(`sem:${path}:${index}:category`)
            clearFieldError(`sem:${path}:${index}:courseName`)
            updateSemesterCourse(path, index, patch)
        },
        setBatchCount: setCourseBatchCount,
        setBatchName: (path, index, bi, v) => {
            clearFieldError(`sem:${path}:${index}:batch:${bi}`)
            setCourseBatchName(path, index, bi, v)
        },
        errorAt: (path, index, field) => fieldErrors[`sem:${path}:${index}:${field}`],
        batchErrorAt: (path, index, bi) => fieldErrors[`sem:${path}:${index}:batch:${bi}`],
        // Roll-ups for the WHERE column. `total` counts every course row that
        // exists under the prefix; `filled` counts the ones actually answered.
        filledCountUnder: (prefix) => {
            let filled = 0
            let total = 0
            Object.entries(semesterCourses).forEach(([path, list]) => {
                if (!isUnder(path, prefix)) return
                total += list.length
                filled += list.filter((c) => c.category && c.courseName.trim()).length
            })
            return { filled, total }
        },
        errorCountUnder: (prefix) => {
            const paths = new Set<string>()
            Object.keys(fieldErrors).forEach((k) => {
                if (!k.startsWith('sem:')) return
                const path = k.slice(4).replace(/:\d+:.*$/, '')
                if (isUnder(path, prefix)) paths.add(path)
            })
            return paths.size
        },
    }

    // Which beat the Degree Program flow is on. Drives the modal width and the
    // scroll container, both of which only change for the workbench.
    // The single degree this mapping covers — null until beat 1 is answered.
    // masterData['Degree'] is kept to exactly one entry by chooseDegree.
    const activeDegreeName = (masterData['Degree'] || [])[0] || ''
    const degreeView: DegreeView | null = activeDegreeName
        ? {
            name: activeDegreeName,
            startYear: startYearForDegree(activeDegreeName),
            endYear: endYearForDegree(activeDegreeName),
            durationKnown: Boolean(degreeDurationYears(activeDegreeName)),
            // Options are everything the degree has; `semesters` is the subset
            // the user put in scope. Conflating them is what made the old picker
            // unable to tell "not chosen" from "not offered".
            semesterOptions: semestersForDegree(activeDegreeName),
            semesters: groupedData['Semester']?.[activeDegreeName] ?? [],
            departments: groupedData['Department']?.[activeDegreeName] || [],
            // A checkbox list needs the FULL set so ticked rows render ticked —
            // not the not-yet-added remainder the old one-at-a-time picker used.
            departmentOptions: Array.from(new Set(
                (degreesList.find((d) => d.degreeName === activeDegreeName)?.departments || [])
                    .map((dep) => dep.departmentName)
                    .filter(Boolean)
            )),
            sectionsFor: (dept: string) => groupedData['Section']?.[`${activeDegreeName}${PATH_SEP}${dept}`] || [],
        }
        : null

    // "Save changes" from the confirm prompt: the same validated save the footer
    // runs (up to the current step), then close on success. A validation failure
    // just drops the prompt, leaving the errors on screen to be fixed.
    const saveAndClose = async () => {
        const ok = await handleSave(stepIndex)
        setConfirmClose(false)
        if (ok) onClose()
    }

    return (
        <>
        {/* Sibling of the AnimatePresence rather than a child of it: the tour
            renders into document.body, so mounting it inside `{open && …}` would
            delay teardown until the modal's exit animation finished and leave a
            popover floating over the listing. Out here `open` tears it down the
            moment the wizard closes, and it stays mounted across both steps so
            it can rebuild its beats when stepIndex changes. */}
        {/* `open` is ANDed with the form phase: the preview unmounts every
            anchor, and a tour left running there would strand its overlay over
            Modify and Done. Flipping open=false reuses the tour's own
            close-teardown; returning to the form does not restart it (the
            first-run flag has long been set). */}
        <WizardTour ref={tourRef} open={open && phase === 'form'} stepIndex={stepIndex} />
        <AnimatePresence>
            {open && (
                <motion.div
                    variants={overlayVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4"
                    onClick={(e) => { if (e.target === e.currentTarget && !isSaving) requestClose() }}
                >
                    <motion.div
                        variants={modalVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        // ONE width for the whole wizard — every step, every
                        // service. It used to widen only for the degree
                        // workbench, but any mid-flow resize reads as the form
                        // breaking under the user; inner containers cap their own
                        // content width where a step has little to show.
                        className="bg-surface rounded-xl border border-hairline shadow-xl w-full flex overflow-hidden max-h-[92vh] h-[700px] max-w-[90vw]"
                    >
                        {/* Left sidebar — vertical stepper on the sunken surface so
                            the form column reads as the raised working plane. */}
                        {/* Dimmed and inert while the preview is up: the saved
                            structure is the one thing on screen, and stepping
                            mid-preview would desync it from what was saved. */}
                        <aside className={`hidden sm:flex w-56 flex-shrink-0 flex-col border-r border-hairline bg-surface-sunken px-4 py-5 ${phase === 'preview' ? 'opacity-50 pointer-events-none' : ''}`}>
                            {/* Brand / title */}
                            <div className="flex items-center gap-2.5 mb-7">
                                <div className="w-8 h-8 rounded-tile bg-brand-wash border border-brand-200 text-brand-700 flex items-center justify-center flex-shrink-0">
                                    <Layers size={14} />
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-sm font-semibold text-heading truncate">{title}</h2>
                                    <p className="text-2xs text-faint">{steps.length} steps</p>
                                </div>
                            </div>

                            {/* Vertical steps — circle + connecting line */}
                            <nav className="flex flex-col" data-tour="sm-steps">
                                {steps.map((s, i) => {
                                    const StepIcon = s.icon
                                    const state = i === stepIndex ? 'active' : i < stepIndex ? 'done' : 'todo'
                                    const isLast = i === steps.length - 1
                                    return (
                                        <button
                                            key={s.key}
                                            type="button"
                                            onClick={() => goToStep(i)}
                                            aria-current={state === 'active' ? 'step' : undefined}
                                            className="flex gap-3 text-left group rounded-tile focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/25"
                                        >
                                            {/* Rail: numbered circle + line to the next step */}
                                            <div className="flex flex-col items-center self-stretch">
                                                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-2xs font-semibold flex-shrink-0 border-2 transition-colors ${
                                                    state === 'active'
                                                        ? 'bg-brand-700 border-brand-700 text-white shadow-sm'
                                                        : state === 'done'
                                                            ? 'bg-success-500 border-success-500 text-white'
                                                            : 'bg-surface border-ink-300 text-faint group-hover:border-ink-400'
                                                }`}>
                                                    {state === 'done' ? <Check size={13} strokeWidth={3} /> : i + 1}
                                                </span>
                                                {!isLast && (
                                                    <span className={`w-0.5 flex-1 min-h-[30px] my-1 rounded-full transition-colors ${
                                                        i < stepIndex ? 'bg-success-500' : 'bg-ink-200'
                                                    }`} />
                                                )}
                                            </div>
                                            {/* Label */}
                                            <div className={isLast ? 'pt-0.5' : 'pt-0.5 pb-5'}>
                                                <p className={`text-2xs font-semibold uppercase tracking-wide ${
                                                    state === 'active' ? 'text-brand-700' : state === 'done' ? 'text-success-700' : 'text-faint'
                                                }`}>
                                                    Step {i + 1}
                                                </p>
                                                <p className={`text-sm font-semibold flex items-center gap-1.5 ${
                                                    state === 'todo' ? 'text-subtle' : 'text-heading'
                                                }`}>
                                                    <StepIcon size={13} className={state === 'active' ? 'text-brand-700' : state === 'done' ? 'text-success-700' : 'text-faint'} />
                                                    {s.label}
                                                </p>
                                                {state === 'done' && (
                                                    <p className="text-2xs text-success-700 font-medium mt-0.5 flex items-center gap-1">
                                                        <Check size={10} strokeWidth={3} /> Completed
                                                    </p>
                                                )}
                                                {state === 'active' && (
                                                    <p className="text-2xs text-brand-700 font-medium mt-0.5">In progress</p>
                                                )}
                                            </div>
                                        </button>
                                    )
                                })}
                            </nav>
                        </aside>

                        {/* Right column — header, body, footer */}
                        <div className="flex-1 flex flex-col min-w-0">
                        {/* Header */}
                        <div className="px-5 py-3 border-b border-hairline flex items-center justify-between gap-3 flex-shrink-0 bg-surface">
                            <div className="min-w-0 flex-shrink-0">
                                <h2 className="text-base font-semibold text-heading truncate">
                                    <span className="sm:hidden">{title} · </span>{phase === 'preview' ? 'Preview' : steps[stepIndex].label}
                                </h2>
                                <p className="text-2xs text-faint truncate">{subtitle}</p>
                            </div>
                            {/* Context — who this mapping is for, as plain text */}
                            {(headerClientName || headerService) && (
                                <p className="hidden sm:block text-xs text-subtle min-w-0 flex-1 text-right truncate">
                                    {headerService && (
                                        <>Service offering <span className="font-semibold text-heading">{headerService}</span></>
                                    )}
                                    {headerService && headerClientName && ' for '}
                                    {!headerService && headerClientName && 'For '}
                                    {headerClientName && (
                                        <span className="font-semibold text-heading">{headerClientName}</span>
                                    )}
                                </p>
                            )}
                            {/* The tour anchors to form controls, none of which
                                render under the preview — offering it there
                                would open a tour with nothing to point at. */}
                            {phase === 'form' && (
                            <button
                                type="button"
                                onClick={() => tourRef.current?.runTour()}
                                className={`${ICON_BUTTON_CLASS} flex-shrink-0`}
                                aria-label="Guide"
                                title="Guide"
                            >
                                <HelpCircle size={14} />
                            </button>
                            )}
                            <button
                                type="button"
                                onClick={requestClose}
                                disabled={isSaving}
                                className="w-7 h-7 rounded-chip flex items-center justify-center text-subtle hover:bg-row-hover hover:text-heading transition-colors flex-shrink-0 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/25"
                                aria-label="Close"
                            >
                                <X size={15} />
                            </button>
                        </div>

                        {/* After a full save the preview replaces the body AND the
                            footer: it scrolls its own content and brings its own
                            Modify/Done bar. Modify returns to the form on the same
                            step with savedIds intact, so the next Save & Preview
                            updates the mapping just written; Done closes the wizard
                            (the save already toasted, so Done adds nothing). */}
                        {phase === 'preview' ? (
                            <div className="flex-1 min-h-0 bg-surface flex flex-col">
                                <MappingPreview
                                    clientName={headerClientName || ''}
                                    service={service}
                                    modelName={serviceModels.join(' · ')}
                                    year={year}
                                    {...(previewModel || buildPreviewModel())}
                                    onModify={() => setPhase('form')}
                                    onDone={onClose}
                                />
                            </div>
                        ) : (
                        <>
                        {/* Body — one step at a time. The center content scrolls here
                            (min-h-0 lets this flex child actually shrink so the overflow
                            scrolls instead of pushing the footer off); on Step 2 the
                            preview panel is sticky so it stays in view while it scrolls. */}
                        <div className="flex-1 min-h-0 px-5 py-4 bg-surface overflow-y-auto">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={steps[stepIndex].key}
                                    // Steps slide the way the wizard moves, and the
                                    // outgoing one leaves the opposite way, so
                                    // forward and back read as different actions.
                                    initial={{ opacity: 0, x: stepDir * 18 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: stepDir * -18 }}
                                    transition={{ duration: 0.2, ease: 'easeOut' }}
                                    className="h-full"
                                >
                                    {/* ── Step 1 — Client & service details ── */}
                                    {stepIndex === 0 && (
                                        <div className="space-y-4 max-w-xl">
                                            <div className="space-y-1" data-tour="sm-client">
                                                <FieldLabel required hint="Choose the college or company this mapping serves; it fixes the business model below">Client</FieldLabel>
                                                <ClientCombobox
                                                    clients={clients}
                                                    value={clientId}
                                                    onChange={(id) => { clearFieldError('client'); setClientId(id) }}
                                                    disabled={isEditing}
                                                />
                                                <FieldError message={fieldErrors.client} />
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div className="space-y-1" data-tour="sm-service">
                                                    <FieldLabel required hint="Comes from the client record; it decides which service models and later steps appear">Business model</FieldLabel>
                                                    {/* Read-only — comes from the selected client (set in Client management) */}
                                                    <div
                                                        className="w-full h-9 text-sm border border-hairline-strong rounded-control px-2.5 bg-surface-sunken flex items-center gap-1.5 cursor-not-allowed select-none"
                                                        title="Defined on the client in Client management"
                                                    >
                                                        <Lock size={11} className="text-faint flex-shrink-0" />
                                                        <span className={`truncate ${service ? 'text-heading' : 'text-faint'}`}>
                                                            {service
                                                                || (!clientId
                                                                    ? 'Select a client first'
                                                                    : isLoadingServices
                                                                        ? 'Loading…'
                                                                        : 'No business model on this client')}
                                                        </span>
                                                    </div>
                                                    {clientId && !service && !isLoadingServices && (
                                                        <p className="text-2xs text-warn-700">
                                                            This client has no business model — set it in the Clients tab first.
                                                        </p>
                                                    )}
                                                    <FieldError message={fieldErrors.service} />
                                                </div>
                                                <div className="space-y-1" data-tour="sm-year">
                                                    <FieldLabel required hint="The year this service runs for the client. Defaults to the current year — change it to map the same client again for a different year">Service providing year</FieldLabel>
                                                    {/* EDITABLE. It used to be a locked read-only chip pinned to
                                                        the creation year, which made a client's mapping a
                                                        once-per-year thing: the same client could not be mapped
                                                        for a different year, and a mapping entered late (or in
                                                        advance) was stamped with the wrong one.

                                                        Nothing on the server had to change for this — createMapping
                                                        already reads `year` from the payload, updateMapping already
                                                        writes it, and the {institution, client} index is NOT unique,
                                                        so several mappings per client were always allowed. The lock
                                                        was purely a UI decision. */}
                                                    <select
                                                        value={year}
                                                        onChange={(e) => { clearFieldError('year'); setYear(e.target.value) }}
                                                        className={`w-full h-9 text-sm border rounded-control px-2.5 bg-surface tabular-nums transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/15 focus:border-brand-500 ${
                                                            fieldErrors.year ? 'border-danger-500' : 'border-hairline-strong'
                                                        }`}
                                                        aria-label="Service providing year"
                                                    >
                                                        {(() => {
                                                            // Starts at the CURRENT year — a service cannot begin in a
                                                            // year that has already gone. Six forward for planning
                                                            // ahead. Same rule as the degree Start year picker, so the
                                                            // two never disagree about what a valid year is.
                                                            //
                                                            // A stored year outside the window is still prepended, or
                                                            // editing an older mapping would silently re-stamp it to
                                                            // the current year on the next save. A PAST stored year is
                                                            // shown DISABLED: visible as what was saved, not selectable.
                                                            const now = new Date().getFullYear()
                                                            const years = Array.from({ length: 6 }, (_, i) => String(now + i))
                                                            const stored = year && !years.includes(year) ? year : ''
                                                            const storedIsPast = Boolean(stored) && parseInt(stored, 10) < now
                                                            return (
                                                                <>
                                                                    {stored && (
                                                                        <option value={stored} disabled={storedIsPast}>
                                                                            {storedIsPast ? `${stored} — past year, pick again` : stored}
                                                                        </option>
                                                                    )}
                                                                    {years.map((y) => <option key={y} value={y}>{y}</option>)}
                                                                </>
                                                            )
                                                        })()}
                                                    </select>
                                                    <FieldError message={fieldErrors.year} />
                                                </div>
                                            </div>

                                            {/* Service models — CSR and COE are picked here (under B2B),
                                                alongside HTD/TD; picking either reveals the partner list. */}
                                            <div className="space-y-1.5" data-tour="sm-model">
                                                <FieldLabel required hint="Pick the offering — Degree Program and DIV open the semester workbench, CSR and COE ask for partners">Service model</FieldLabel>
                                                {!service ? (
                                                    <p className="text-xs text-subtle">Select a service to see its service models.</p>
                                                ) : availableModels.length === 0 && serviceModels.length === 0 ? (
                                                    <p className="text-xs text-subtle">No service models configured for this service.</p>
                                                ) : (
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                        {/* Keep already-selected models visible even if not in the master list */}
                                                        {serviceModels
                                                            .filter((m) => !availableModels.some((am) => am.name === m))
                                                            .map((m) => (
                                                                <button
                                                                    key={m}
                                                                    type="button"
                                                                    onClick={() => toggleModel(m)}
                                                                    disabled={modelLocked}
                                                                    className="flex items-center gap-2 rounded-tile border p-3 text-left text-xs font-medium transition-colors bg-brand-wash border-brand-300 text-brand-800 ring-2 ring-brand-500/10 disabled:cursor-not-allowed"
                                                                >
                                                                    {modelLocked
                                                                        ? <Lock size={13} className="text-brand-700 flex-shrink-0" />
                                                                        : <Check size={14} className="text-brand-700 flex-shrink-0" />}
                                                                    <span className="truncate">{m}</span>
                                                                </button>
                                                            ))}
                                                        {availableModels.map((modal) => {
                                                            const checked = serviceModels.includes(modal.name)
                                                            return (
                                                                <button
                                                                    key={modal.id}
                                                                    type="button"
                                                                    onClick={() => toggleModel(modal.name)}
                                                                    disabled={modelLocked}
                                                                    className={`flex items-center gap-2 rounded-tile border p-3 text-left text-xs font-medium transition-colors ${
                                                                        checked
                                                                            ? 'bg-brand-wash border-brand-300 text-brand-800 ring-2 ring-brand-500/10 disabled:cursor-not-allowed'
                                                                            : modelLocked
                                                                                ? 'border-hairline text-faint opacity-50 cursor-not-allowed'
                                                                                : 'border-hairline-strong text-body hover:border-line-hover hover:bg-row-hover'
                                                                    }`}
                                                                >
                                                                    {checked
                                                                        ? (modelLocked
                                                                            ? <Lock size={13} className="text-brand-700 flex-shrink-0" />
                                                                            : <Check size={14} className="text-brand-700 flex-shrink-0" />)
                                                                        : <Plus size={14} className="text-faint flex-shrink-0" />}
                                                                    <span className="truncate">{modal.name}</span>
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                                {/* The guidance line doubles as the error slot — showing both
                                                    would say the same thing twice in two colours. Locked, it
                                                    explains WHY the grid stopped responding; unlocked, it warns
                                                    the choice is permanent BEFORE the user commits to it. */}
                                                {fieldErrors.serviceModel
                                                    ? <FieldError message={fieldErrors.serviceModel} />
                                                    : modelLocked ? (
                                                        <p className="text-xs text-brand-700 bg-brand-wash border border-brand-300 rounded-tile px-2.5 py-1.5 flex items-start gap-1.5">
                                                            <Lock size={12} className="flex-shrink-0 mt-[1px]" />
                                                            <span>
                                                                The service model is locked once the mapping is saved — the whole
                                                                structure is built on it. To use a different model, map this
                                                                service again as a new mapping.
                                                            </span>
                                                        </p>
                                                    ) : (
                                                        <p className="text-xs text-subtle">
                                                            Pick one — the next steps depend on the selected service model,
                                                            and it cannot be changed after the mapping is saved.
                                                        </p>
                                                    )}
                                            </div>

                                            {/* Partner institutions — CSR (business model) or COE (service model
                                                under B2B). Always rendered AFTER the service model block, since COE
                                                only becomes active once picked there. One or more, from existing
                                                Client Management records. */}
                                            {isPartnerFlow && (
                                                <div className="space-y-1" data-tour="sm-partner">
                                                    <FieldLabel required hint="Name each college receiving this CSR or COE programme; add a row per institution">Partner institution</FieldLabel>
                                                    <div className="space-y-2">
                                                        {(partnerInstitutionIds.length ? partnerInstitutionIds : ['']).map((pid, idx) => {
                                                            const otherSelected = new Set(
                                                                partnerInstitutionIds.filter((_, i) => i !== idx).filter(Boolean)
                                                            )
                                                            // Partner institutions are B2I clients only — CSR/COE run inside
                                                            // colleges, so the picker must not offer B2B/B2C companies.
                                                            const rowClients = clients.filter(
                                                                (c) => isBusinessToInstitution(c.businessModel || '') && !otherSelected.has(c._id)
                                                            )
                                                            const showRemove = (partnerInstitutionIds.length ? partnerInstitutionIds : ['']).length > 1
                                                            return (
                                                                <div key={idx} className="flex items-center gap-2">
                                                                    <div className="flex-1 min-w-0">
                                                                        <ClientCombobox
                                                                            clients={rowClients}
                                                                            value={pid || null}
                                                                            onChange={(id) => setPartnerAt(idx, id)}
                                                                            placeholder="Select partner institution…"
                                                                        />
                                                                    </div>
                                                                    {showRemove && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => removePartnerAt(idx)}
                                                                            className="w-9 h-9 flex-shrink-0 rounded-control border border-hairline-strong flex items-center justify-center text-faint hover:text-danger-700 hover:border-danger-500/30 hover:bg-danger-50 transition-colors"
                                                                            aria-label="Remove partner institution"
                                                                        >
                                                                            <X size={14} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={addPartnerRow}
                                                        className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-800 transition-colors"
                                                    >
                                                        <Plus size={13} /> Add another partner institution
                                                    </button>
                                                    <FieldError message={fieldErrors.partner} />
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* ── Step 2 — Structure & course (fixed per service model) ── */}
                                    {stepIndex === 1 && (
                                        // Degree Program spreads across the wide modal: the hierarchy tree
                                        // gets its own column so it can breathe, with batches and courses
                                        // beside it. Every other flow — Placement Training's phase list
                                        // included, now that its workbench is retired — is a short form
                                        // and stays narrow.
                                        //
                                        // The degree flow deliberately does NOT pin itself to h-full any
                                        // more. It used to, because the old setup panel collapsed each
                                        // finished part to a single line and the workbench could own
                                        // whatever height was left. The accordion keeps its sections open,
                                        // so the setup is often taller than the modal — and a pinned
                                        // height meant the content could never exceed the pane, which
                                        // crushed the workbench to nothing AND gave the body's
                                        // overflow-y-auto nothing to scroll. Growing naturally lets that
                                        // existing scroll do its job.
                                        <div className={isDegreeFlow ? 'w-full' : 'max-w-2xl'}>
                                            <div className={isDegreeFlow ? 'space-y-2' : 'space-y-4'}>
                                                {/* DIV's mode switch lives HERE, above both layouts, so it
                                                    holds the same top position whether it is on (wide degree
                                                    workbench below) or off (narrow course form below) —
                                                    toggling must never make the control itself jump. */}
                                                {isDIVModel(serviceModels) && !isDegreeProgramModel(serviceModels) && (
                                                    // A labelled row like every other question in the wizard,
                                                    // rather than a bare pill floating above the form. The
                                                    // tooltip moves onto the label, which is where FieldRow
                                                    // puts it everywhere else. Inset to match the flat course
                                                    // form directly below — the state this mapping opens in.
                                                    <div className="px-1 md:ml-[70px]">
                                                        <FieldRow
                                                            label="Degree structure"
                                                            tooltip="Off, this DIV mapping is one course with its batches; on, it builds the full degree, department, section and semester hierarchy"
                                                        >
                                                            <label className="inline-flex items-center gap-2 text-sm font-semibold text-info-700 rounded-control px-2 h-8 cursor-pointer select-none hover:bg-info-50 w-fit flex-shrink-0">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={divDegreeEnabled}
                                                                    onChange={(e) => setDivDegreeEnabled(e.target.checked)}
                                                                    className="w-4 h-4 accent-info-700"
                                                                />
                                                                Degree based structure
                                                            </label>
                                                        </FieldRow>
                                                    </div>
                                                )}
                                                {/* The degree flow (Degree Program and DIV) — the whole step.
                                                    One degree, told as a
                                                    story: pick it, pick its departments, answer the sections
                                                    question, pick the semesters, then fill in the courses and
                                                    their batches. Each beat appears only once the one before
                                                    it is answered. All state lives here; the component only
                                                    decides which question is showing. */}
                                                {isDegreeFlow && (
                                                    <div>
                                                        <DegreeSetupForm
                                                            degree={degreeView}
                                                            degreeOptions={allDegreeOptions()}
                                                            degreesConfigured={degreesList.length > 0}
                                                            durationYears={degreeView ? degreeDurationYears(degreeView.name) : null}
                                                            onChooseDegree={chooseDegree}
                                                            onSetStartYear={(v) => degreeView && setDegreeStartYear(degreeView.name, v)}
                                                            onSetEndYear={(v) => degreeView && setDegreeEndYear(degreeView.name, v)}
                                                            onToggleDepartment={(dept) => {
                                                                if (!degreeView) return
                                                                clearFieldError('hierarchy')
                                                                if ((groupedData['Department']?.[degreeView.name] || []).includes(dept)) {
                                                                    removeGroupedValue('Department', degreeView.name, dept)
                                                                    removeCoursesUnder(`${degreeView.name}${PATH_SEP}${dept}`)
                                                                } else {
                                                                    addGroupedValue('Department', degreeView.name, dept)
                                                                    seedSemestersFor(`${degreeView.name}${PATH_SEP}${dept}`, degreeView.name)
                                                                }
                                                            }}
                                                            onAddSection={(dept, v) => {
                                                                if (!degreeView) return
                                                                const base = `${degreeView.name}${PATH_SEP}${dept}`
                                                                addGroupedValue('Section', base, v)
                                                                // Semesters lived directly under the department
                                                                // until now; they belong to the section instead.
                                                                removeCoursesUnder(base)
                                                                seedSemestersFor(`${base}${PATH_SEP}${v}`, degreeView.name)
                                                            }}
                                                            onRemoveSection={(dept, v) => {
                                                                if (!degreeView) return
                                                                const base = `${degreeView.name}${PATH_SEP}${dept}`
                                                                removeGroupedValue('Section', base, v)
                                                                removeCoursesUnder(`${base}${PATH_SEP}${v}`)
                                                                // Last section gone: the department becomes the
                                                                // leaf again and needs its own semesters back.
                                                                if ((groupedData['Section']?.[base] || []).length <= 1) {
                                                                    seedSemestersFor(base, degreeView.name)
                                                                }
                                                            }}
                                                            departmentDataCount={departmentDataCount(degreeView?.name || '')}
                                                            semesterDateFor={(sem) => (degreeView
                                                                ? semesterDates[semesterDateKey(degreeView.name, sem)] || { start: '', end: '' }
                                                                : { start: '', end: '' })}
                                                            onSemesterDate={(sem, field, iso) => {
                                                                if (degreeView) setSemesterDate(degreeView.name, sem, field, iso)
                                                            }}
                                                            semesterDateError={(sem, field) => (degreeView
                                                                ? fieldErrors[`semdate:${semesterDateKey(degreeView.name, sem)}:${field}`]
                                                                : undefined)}
                                                            academicBounds={degreeView ? academicBoundsFor(degreeView.name) : null}
                                                            semesterLock={(sem) => (degreeView
                                                                ? semesterLockFor(degreeView.name, sem)
                                                                : { state: 'available', canEditStart: true, canEditEnd: true })}
                                                            chosenSemesters={degreeView ? chosenSemesters(degreeView.name) : []}
                                                            semesterStatus={(sem) => (degreeView ? semesterStatusFor(degreeView.name, sem) : { status: 'blocked' })}
                                                            activeSemester={degreeView ? (chosenSemesters(degreeView.name).slice(-1)[0] || '') : ''}
                                                            onToggleSemester={(sem) => { if (degreeView) toggleSemester(degreeView.name, sem) }}
                                                            fieldErrors={fieldErrors}
                                                            revealErrorsRef={degreeRevealRef}
                                                        >
                                                            {degreeView && (
                                                                <Workbench
                                                                    degree={degreeView}
                                                                    scope={scope}
                                                                    onSelectScope={setScope}
                                                                    courseApi={courseApi}
                                                                    editableSemester={activeSemesterFor(degreeView.name)}
                                                                />
                                                            )}
                                                        </DegreeSetupForm>
                                                    </div>
                                                )}

                                                {/* Placement Training — phases, one course per phase, batches
                                                    on the course. The whole step is one accordion; every value
                                                    still lives here and arrives through props. */}
                                                {isPlacementCourses && (
                                                    <PlacementForm
                                                        phaseNames={phaseNames}
                                                        onSetPhaseCount={applyPhaseCount}
                                                        onSetPhaseName={setPhaseNameAt}
                                                        noPhaseCourseCount={noPhaseCourseCount}
                                                        onAddNoPhaseCourse={addNoPhaseCourse}
                                                        onRemoveNoPhaseCourse={removeNoPhaseCourse}
                                                        courseApi={courseApi}
                                                        fieldErrors={fieldErrors}
                                                        onClearFieldError={clearFieldError}
                                                        revealErrorsRef={placementRevealRef}
                                                    />
                                                )}

                                                {/* The flat models — DIV with degree structure off, plus
                                                    CSR/COE/HTD/TD: the course, then the batches sitting it. */}
                                                {!isPlacementCourses && !isDegreeFlow && (
                                                    <SimpleCourseForm
                                                        course={courses[0]}
                                                        categoryOptions={categoryOptions}
                                                        courseNamesFor={courseNamesFor}
                                                        onCourseChange={(patch) => setCourseAt(0, patch)}
                                                        batchCount={batchCount}
                                                        onBatchCount={applyBatchCount}
                                                        batchNames={batchNames}
                                                        onBatchName={setBatchName}
                                                        yearHint={year || ''}
                                                        // Phases are not passed: these models never run a
                                                        // batch in stages, so the form renders no phase
                                                        // field and has no section left to expand for one.
                                                        // Legacy phase data still round-trips through this
                                                        // component's own state and is written at save time.
                                                        fieldErrors={fieldErrors}
                                                        clearFieldError={clearFieldError}
                                                        revealErrorsRef={simpleRevealRef}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* ── Step 3 — Resources ──────────────────────────────
                                        Which of the institution's Resource Management I Do
                                        types this mapping's courses default to using. A
                                        course created under this mapping starts with these
                                        pre-checked in its own Resource Type step, instead
                                        of everything off. */}
                                    {stepIndex === 2 && (
                                        // Full width, like the degree flow's Step 2: the resource
                                        // rows put their toggles on the far right, and a narrow
                                        // column would strand them miles from their labels.
                                        <div className="w-full">
                                            <ResourceDefaultsStep
                                                value={resourceDefaults}
                                                onChange={setResourceDefaults}
                                            />
                                        </div>
                                    )}

                                </motion.div>
                            </AnimatePresence>
                        </div>

                        {/* Footer — Cancel sits alone on the far left (the "abandon"
                            action, kept away from the flow so it isn't hit by mistake
                            while stepping); Back and Next are paired on the right where
                            the eye naturally goes to navigate between steps. */}
                        <div className="px-5 py-3 border-t border-hairline flex items-center justify-between gap-2 flex-shrink-0 bg-surface">
                            <div>
                                <button
                                    type="button"
                                    onClick={requestClose}
                                    disabled={isSaving}
                                    className="h-9 text-sm font-medium text-subtle hover:text-heading px-4 rounded-control hover:bg-row-hover transition-colors disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                            </div>
                            <div className="flex items-center gap-2">
                                {stepIndex > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => { setStepDir(-1); setStepIndex((s) => s - 1) }}
                                        disabled={isSaving}
                                        className="flex items-center gap-1.5 h-9 text-sm font-medium text-ink-700 hover:text-heading border border-hairline-strong rounded-control px-4 hover:bg-row-hover transition-colors disabled:opacity-50"
                                    >
                                        <ArrowLeft size={14} /> Back
                                    </button>
                                )}
                                {/* Save & Next persists what's filled so far AND moves on —
                                    the mapping shows in the list either way and can be
                                    finished later via Edit. The last step's Save & Preview
                                    saves in full, then swaps the modal to a hierarchy
                                    preview of exactly what was written. Advancing only on a
                                    successful save keeps a failed validation on screen. */}
                                <button
                                    type="button"
                                    data-tour="sm-save"
                                    onClick={async () => {
                                        const ok = await handleSave(stepIndex)
                                        if (ok && !isLastStep) goToStep(stepIndex + 1)
                                    }}
                                    disabled={isSaving}
                                    className={`flex items-center gap-1.5 h-9 text-sm font-semibold px-5 rounded-control active:scale-[0.98] disabled:opacity-50 transition-colors ${
                                        isLastStep
                                            ? 'bg-brand-700 text-white hover:bg-brand-800 shadow-sm'
                                            : 'border border-brand-300 bg-brand-wash text-brand-700 hover:bg-brand-wash-hover'
                                    }`}
                                >
                                    {isSaving ? (
                                        <><Loader2 size={14} className="animate-spin" /> Saving…</>
                                    ) : isLastStep ? (
                                        <><Check size={14} /> Save & Preview</>
                                    ) : (
                                        <><Check size={14} /> Save & Next</>
                                    )}
                                </button>
                                {!isLastStep && (
                                    <button
                                        type="button"
                                        onClick={() => goToStep(stepIndex + 1)}
                                        className="flex items-center gap-1.5 h-9 text-sm font-semibold bg-brand-700 text-white px-5 rounded-control hover:bg-brand-800 active:scale-[0.98] shadow-sm transition-colors"
                                    >
                                        Next <ArrowRight size={14} />
                                    </button>
                                )}
                            </div>
                        </div>
                        </>
                        )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>

        {/* Unsaved-changes prompt — shown when a half-finished new mapping is being
            closed. Save runs the validated save (on a validation failure the errors
            stay on screen); Discard abandons the draft; Keep editing dismisses the
            prompt. Sits above the wizard and blocks it underneath. */}
        {open && confirmClose && (
            <div
                className="fixed inset-0 z-overlay flex items-center justify-center bg-ink-900/45 p-4"
                onClick={() => { if (!isSaving) setConfirmClose(false) }}
            >
                <div className="w-full max-w-sm rounded-xl bg-surface border border-hairline p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
                    <h3 className="text-base font-semibold text-heading">Save changes before closing?</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-subtle">
                        You have unsaved changes to this mapping. Save them now, or discard the draft and close.
                    </p>
                    <div className="mt-4 flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setConfirmClose(false)}
                            disabled={isSaving}
                            className="h-9 px-3.5 rounded-control text-sm font-medium text-subtle hover:bg-row-hover hover:text-heading transition-colors disabled:opacity-50"
                        >
                            Keep editing
                        </button>
                        <button
                            type="button"
                            onClick={() => { setConfirmClose(false); onClose() }}
                            disabled={isSaving}
                            className="h-9 px-3.5 rounded-control text-sm font-semibold text-white bg-danger-700 hover:bg-danger-700/90 transition-colors disabled:opacity-50"
                        >
                            Discard
                        </button>
                        <button
                            type="button"
                            onClick={saveAndClose}
                            disabled={isSaving}
                            className="h-9 px-4 rounded-control text-sm font-semibold text-white bg-brand-700 hover:bg-brand-800 active:scale-[0.98] shadow-sm transition-colors disabled:opacity-50"
                        >
                            {isSaving ? 'Saving…' : 'Save changes'}
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    )
}

// ─── Client mappings details modal (view / edit / delete per mapping) ─────────

// (MappingCard removed — ClientMappingsModal now renders services as a list
// table matching the L&D dashboard "Services offered" style.)
function _RemovedMappingCard_unused({
    mapping: m,
    onEdit,
    onDelete,
    canEdit = true,
    canDelete = true,
}: {
    mapping: ServiceMapping
    onEdit: () => void
    onDelete: () => void
    canEdit?: boolean
    canDelete?: boolean
}) {
    const [expanded, setExpanded] = useState(true)
    const enabled = (m.hierarchy || []).filter((h) => h.enabled)
    return (
        <div className="border border-hairline rounded-xl overflow-hidden bg-surface shadow-xs">
            <div className="px-3.5 py-2.5 flex items-center gap-2 flex-wrap">
                <button
                    type="button"
                    onClick={() => setExpanded((e) => !e)}
                    aria-expanded={expanded}
                    aria-label={expanded ? 'Collapse mapping details' : 'Expand mapping details'}
                    className="w-6 h-6 rounded-chip flex items-center justify-center text-faint hover:text-heading hover:bg-row-hover transition-colors flex-shrink-0"
                >
                    <ChevronDown size={14} className={`transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`} />
                </button>
                <Briefcase size={12} className="text-brand-500 flex-shrink-0" />
                <span className="text-sm font-semibold text-heading">{m.service}</span>
                {m.serviceCode && (
                    <span className="inline-flex items-center h-[20px] px-1.5 rounded-chip bg-ink-100 text-ink-700 text-2xs font-semibold tabular-nums tracking-tight" title={m.serviceCode}>
                        {m.serviceCode}
                    </span>
                )}
                {m.courseName && (
                    <span
                        className="text-2xs font-medium bg-info-50 text-info-700 border border-info-500/20 rounded-full px-2 py-0.5 truncate max-w-[160px]"
                        title={m.courseName}
                    >
                        <BookOpen size={9} className="inline mr-1" />
                        {m.courseName}
                    </span>
                )}
                {m.year && (
                    <span className="text-2xs font-medium bg-surface text-subtle border border-hairline-strong rounded-full px-2 py-0.5 tabular-nums">
                        {m.year}
                    </span>
                )}
                <span className={`text-2xs font-medium rounded-full px-2 py-0.5 border ${
                    m.status === 'active'
                        ? 'bg-success-50 text-success-700 border-success-500/20'
                        : 'bg-ink-100 text-ink-500 border-ink-200'
                }`}>
                    {m.status === 'active' ? 'Active' : 'Inactive'}
                </span>
                {(canEdit || canDelete) && (
                <div className="ml-auto flex items-center">
                    {/* Kebab: Edit + Delete for this service. Replaces the two
                        inline icon buttons so all row actions live in one
                        control, matching the primary table pattern. */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                aria-label="Service actions"
                                className="w-6 h-6 rounded-chip border border-hairline flex items-center justify-center text-faint hover:border-brand-300 hover:text-brand-700 hover:bg-brand-wash transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25 data-[state=open]:bg-ink-100 data-[state=open]:text-heading"
                            >
                                <MoreVertical size={12} />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" sideOffset={4}>
                            {canEdit && (
                            <DropdownMenuItem onClick={onEdit} className="text-xs cursor-pointer">
                                <Edit className="h-3.5 w-3.5" /> Edit service
                            </DropdownMenuItem>
                            )}
                            {canDelete && (
                            <DropdownMenuItem onClick={onDelete} className="text-xs cursor-pointer text-danger-700 focus:text-danger-700">
                                <Trash2 className="h-3.5 w-3.5" /> Delete service
                            </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                )}
            </div>
            <AnimatePresence initial={false}>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                        className="overflow-hidden"
                    >
                        <div className="px-3.5 py-2.5 space-y-2 border-t border-hairline">
                            {/* Partner institutions (CSR/COE) */}
                            {Array.isArray(m.partnerInstitutions) && m.partnerInstitutions.length > 0 && (
                                <div className="flex items-start gap-1.5 text-xs text-body">
                                    <Building size={11} className="text-brand-500 flex-shrink-0 mt-0.5" />
                                    <span className="text-faint flex-shrink-0">Partner{m.partnerInstitutions.length > 1 ? 's' : ''}:</span>
                                    <span className="font-medium text-body">
                                        {m.partnerInstitutions
                                            .map((p) => (typeof p === 'object' ? p?.clientCompany : ''))
                                            .filter(Boolean)
                                            .join(', ')}
                                    </span>
                                </div>
                            )}
                            {/* Service models */}
                            <div className="flex flex-wrap items-center gap-1">
                                <span className="text-2xs text-faint uppercase tracking-wide flex items-center gap-1">
                                    <Briefcase size={9} /> Service model
                                </span>
                                {m.serviceModels?.length ? (
                                    m.serviceModels.map((model, mi) => (
                                        <span key={mi} className="text-2xs font-medium bg-brand-wash text-brand-700 border border-brand-200 rounded-full px-2 py-0.5">
                                            {model}
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-2xs text-faint">None</span>
                                )}
                            </div>
                            {/* Enabled hierarchy */}
                            {enabled.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1">
                                    <span className="text-2xs text-faint uppercase tracking-wide flex items-center gap-1">
                                        <ListTree size={9} /> Hierarchy
                                    </span>
                                    {enabled.map((h) => (
                                        <span key={h.level} className="inline-flex items-center gap-1 text-2xs font-medium bg-surface-sunken text-body border border-hairline-strong rounded-full px-2 py-0.5">
                                            {h.level}
                                            {h.mandatory && <Lock size={8} className="text-brand-500" />}
                                        </span>
                                    ))}
                                </div>
                            )}
                            {/* Master data (grouped entries show their parent, e.g. "Department · BE") */}
                            {(m.masterData || []).map((md, mdi) => (
                                <div key={`${md.level}-${md.group || mdi}`} className="flex flex-wrap items-center gap-1">
                                    <span className="text-2xs text-faint uppercase tracking-wide min-w-[70px]">
                                        {md.level}{md.group ? ` · ${md.group}` : ''}
                                    </span>
                                    {md.values.map((v, vi) => (
                                        <span key={vi} className="text-2xs font-medium bg-surface text-brand-700 border border-brand-200 rounded-full px-2 py-0.5">
                                            {v}
                                        </span>
                                    ))}
                                </div>
                            ))}
                            <p className="text-2xs text-faint">Updated {fmtDate(m.updatedAt || m.createdAt)}</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// Two-letter initials for the header avatar — mirrors the L&D "Services
// offered" overlay's leading badge.
function clientInitials(name: string): string {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return '?'
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function ClientMappingsModal({
    open,
    row,
    onClose,
    onViewDetails,
    onEditMapping,
    onDeleteMapping,
    onDeleteSeveral,
    canEdit = true,
    canDelete = true,
}: {
    open: boolean
    row: ClientRow | null
    onClose: () => void
    // Opens the right-side MappingDetailPanel drawer for that service. The
    // modal typically closes first so the drawer has focus.
    onViewDetails: (mapping: ServiceMapping) => void
    onEditMapping: (mapping: ServiceMapping) => void
    onDeleteMapping: (mapping: ServiceMapping) => void
    // Opens the bulk-delete confirm (DeleteMappingsModal) scoped to THIS
    // client — the same picker the old row kebab used.
    onDeleteSeveral: () => void
    canEdit?: boolean
    canDelete?: boolean
}) {
    // Escape-to-close
    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open, onClose])

    // ── Filter state — mirrors ClientServicesOverlay in lddashboard/page.tsx ──
    const [q, setQ] = useState('')
    const [modelFilter, setModelFilter] = useState<string>('all')
    const [yearFilter, setYearFilter] = useState<string>('all')
    const [statusFilter, setStatusFilter] = useState<string>('all')
    // Reset filters + page whenever the modal opens for a different client, so
    // an old client's filter state never bleeds into a new one.
    const clientId = row?._id
    useEffect(() => {
        if (!open) return
        setQ(''); setModelFilter('all'); setYearFilter('all'); setStatusFilter('all'); setPage(1)
    }, [open, clientId])

    // Option lists derived from THIS client's mappings — a filter can't offer
    // a value that isn't in the data.
    const allModels = useMemo(() => {
        const set = new Set<string>()
        row?.mappings.forEach((m) => (m.serviceModels || []).forEach((sm) => sm && set.add(String(sm))))
        return Array.from(set).sort()
    }, [row])
    const allYears = useMemo(() => {
        const set = new Set<string>()
        row?.mappings.forEach((m) => { if (m.year) set.add(String(m.year)) })
        return Array.from(set).sort().reverse()
    }, [row])

    const matches = (text: string) => text.toLowerCase().includes(q.trim().toLowerCase())
    const shownMappings = useMemo(() => {
        if (!row) return []
        return row.mappings.filter((m) =>
            (modelFilter === 'all' || (m.serviceModels || []).map(String).includes(modelFilter)) &&
            (yearFilter === 'all' || String(m.year || '') === yearFilter) &&
            (statusFilter === 'all' || m.status === statusFilter) &&
            (!q.trim() || matches(`${m.service || ''} ${(m.serviceModels || []).join(' ')} ${m.year || ''} ${m.serviceCode || ''} ${m.courseName || ''}`))
        )
    }, [row, modelFilter, yearFilter, statusFilter, q])

    const isFiltering = q.trim() !== '' || modelFilter !== 'all' || yearFilter !== 'all' || statusFilter !== 'all'
    const clearAllFilters = () => { setQ(''); setModelFilter('all'); setYearFilter('all'); setStatusFilter('all') }

    // ── Pagination — fixed pageSize picker (5/10/25/50). Simpler than the
    // L&D auto-fit ResizeObserver but gives the same shape of controls. ──
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)
    useEffect(() => { setPage(1) }, [q, modelFilter, yearFilter, statusFilter, pageSize])
    const totalPages = Math.max(1, Math.ceil(shownMappings.length / pageSize))
    const currentPage = Math.min(page, totalPages)
    const pageStart = (currentPage - 1) * pageSize
    const pageEnd = pageStart + pageSize
    const pagedMappings = shownMappings.slice(pageStart, pageEnd)
    const rangeFrom = shownMappings.length === 0 ? 0 : pageStart + 1
    const rangeTo = Math.min(pageEnd, shownMappings.length)

    const overlayVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.15 } },
        exit: { opacity: 0, transition: { duration: 0.12 } },
    }
    const modalVariants = {
        hidden: { opacity: 0, scale: 0.97, y: 12 },
        visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' as const } },
        exit: { opacity: 0, scale: 0.97, y: 12, transition: { duration: 0.13 } },
    }

    // Small unified <select> styled to sit next to the search input like the
    // L&D FloatingPicker — kept inline because FloatingPicker isn't exported.
    const pickerClass = 'h-9 rounded-md border border-hairline bg-surface px-2.5 text-xs font-medium text-heading outline-none transition-colors hover:border-hairline-strong focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 cursor-pointer'

    return (
        <AnimatePresence>
            {open && row && (
                <motion.div
                    variants={overlayVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4"
                    onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
                >
                    <motion.div
                        variants={modalVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        // Fixed frame that matches the L&D "Services offered"
                        // overlay: pagination handles overflow instead of the
                        // dialog scrolling.
                        className="bg-surface rounded-tile border border-hairline-strong shadow-xl flex flex-col gap-0 overflow-hidden w-[96vw] sm:w-[1120px] sm:max-w-[1120px] h-[86vh] max-h-[820px]"
                    >
                        {/* ── Header: avatar + title + inline counts + red X ── */}
                        <div className="relative flex-shrink-0 border-b border-hairline px-6 py-3">
                            <div className="flex items-center gap-3 pr-12">
                                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-400">
                                    {clientInitials(row.client.clientCompany || '')}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <h2 className="truncate text-base font-semibold leading-tight tracking-[-0.01em] text-heading">
                                        Services offered
                                        <span className="mx-1.5 text-subtle">·</span>
                                        <span className="font-medium text-body">{row.client.clientCompany}</span>
                                    </h2>
                                </div>
                                <div className="hidden shrink-0 items-center gap-4 pr-2 text-xs sm:flex">
                                    <span className="whitespace-nowrap">
                                        <span className="font-medium uppercase tracking-wide text-subtle">Services:</span>
                                        <span className="ml-1 font-semibold tabular-nums text-heading">{row.mappings.length}</span>
                                    </span>
                                    <span className="whitespace-nowrap">
                                        <span className="font-medium uppercase tracking-wide text-subtle">Active:</span>
                                        <span className="ml-1 font-semibold tabular-nums text-heading">{row.mappings.filter((m) => m.status === 'active').length}</span>
                                    </span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                aria-label="Close"
                                className="absolute top-1/2 right-4 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-red-500 text-white shadow-sm transition-colors hover:bg-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
                            >
                                <X size={14} strokeWidth={2.5} />
                            </button>
                        </div>

                        {/* Content column — fills the fixed frame; the table
                            container inside claims the remaining vertical space. */}
                        <div className="flex min-h-0 flex-1 flex-col px-6 pt-3 pb-3">

                            {/* Toolbar — search + three filters + clear */}
                            <div className="mb-3 flex flex-shrink-0 flex-nowrap items-center gap-2">
                                <div className="relative min-w-0 flex-1">
                                    <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" aria-hidden />
                                    <input
                                        value={q}
                                        onChange={(e) => setQ(e.target.value)}
                                        placeholder="Search services..."
                                        aria-label="Search services"
                                        className="h-9 w-full rounded-md border border-hairline bg-surface pr-8 pl-8 text-xs text-heading outline-none transition-colors placeholder:text-faint hover:border-hairline-strong focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
                                    />
                                    {q && (
                                        <button
                                            type="button"
                                            onClick={() => setQ('')}
                                            aria-label="Clear search"
                                            className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-faint transition-colors hover:bg-row-hover hover:text-body"
                                        >
                                            <X size={13} />
                                        </button>
                                    )}
                                </div>
                                <select
                                    value={modelFilter}
                                    onChange={(e) => setModelFilter(e.target.value)}
                                    aria-label="Filter by service model"
                                    className={`${pickerClass} min-w-[160px]`}
                                >
                                    <option value="all">All models</option>
                                    {allModels.map((m) => <option key={m} value={m}>{m}</option>)}
                                </select>
                                <select
                                    value={yearFilter}
                                    onChange={(e) => setYearFilter(e.target.value)}
                                    aria-label="Filter by year"
                                    className={`${pickerClass} min-w-[120px]`}
                                >
                                    <option value="all">All years</option>
                                    {allYears.map((y) => <option key={y} value={y}>{y}</option>)}
                                </select>
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    aria-label="Filter by status"
                                    className={`${pickerClass} min-w-[120px]`}
                                >
                                    <option value="all">All status</option>
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                                <button
                                    type="button"
                                    onClick={clearAllFilters}
                                    disabled={!isFiltering}
                                    className="ml-1 inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-brand-700 transition-colors hover:text-brand-strong disabled:cursor-not-allowed disabled:text-faint disabled:hover:text-faint dark:text-brand-400"
                                >
                                    <X size={12} /> Clear filters
                                </button>
                            </div>

                            {/* Table area — fixed frame, sticky header, no scroll:
                                pagination controls the visible row set. */}
                            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-tile border border-hairline bg-surface">
                                <div className="min-h-0 flex-1 overflow-y-auto">
                                    {row.mappings.length === 0 ? (
                                        <p className="px-4 py-6 text-center text-sm text-subtle">No services mapped for this client yet.</p>
                                    ) : shownMappings.length === 0 ? (
                                        <p className="px-4 py-6 text-center text-sm text-subtle">
                                            No services match the current filters.{' '}
                                            <button type="button" className="text-brand-700 font-semibold hover:underline" onClick={clearAllFilters}>Clear all</button>
                                        </p>
                                    ) : (
                                        <table className="w-full border-collapse">
                                            <thead className="sticky top-0 z-10 bg-surface-sunken/60">
                                                <tr className="border-b border-hairline">
                                                    <th className="w-56 px-3 py-1.5 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">Service model</th>
                                                    <th className="px-3 py-1.5 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">Service</th>
                                                    <th className="w-40 px-3 py-1.5 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">Service code</th>
                                                    <th className="w-32 px-3 py-1.5 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">Offering year</th>
                                                    <th className="w-44 px-3 py-1.5 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">Status</th>
                                                    <th className="w-24 px-3 py-1.5 text-right text-2xs font-semibold uppercase tracking-wider text-subtle">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {pagedMappings.map((m) => {
                                                    const active = m.status === 'active'
                                                    return (
                                                        <tr key={m._id} className="border-b border-hairline last:border-0 transition-colors hover:bg-row-hover">
                                                            <td className="px-3 py-2 align-middle">
                                                                {m.serviceModels?.length ? (
                                                                    <span className="flex flex-wrap gap-1.5">
                                                                        {m.serviceModels.map((sm, si) => (
                                                                            <span key={si} className={`text-sm ${modelFilter === sm ? 'font-semibold text-brand-700 dark:text-brand-400' : 'text-body'}`}>
                                                                                {sm}
                                                                            </span>
                                                                        ))}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-xs text-faint">—</span>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2 align-middle">
                                                                <div className="min-w-0">
                                                                    <div className="truncate text-sm font-semibold text-heading">{m.service || '—'}</div>
                                                                    {m.courseName && (
                                                                        <div className="mt-0.5 flex items-center gap-1 text-2xs text-subtle truncate">
                                                                            <BookOpen size={9} className="flex-shrink-0" />
                                                                            <span className="truncate">{m.courseName}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-2 align-middle">
                                                                {m.serviceCode
                                                                    ? <span className="truncate text-xs tabular-nums text-body">{m.serviceCode}</span>
                                                                    : <span className="text-xs text-faint">—</span>}
                                                            </td>
                                                            <td className="px-3 py-2 align-middle">
                                                                {m.year
                                                                    ? <span className="text-sm tabular-nums text-body">{m.year}</span>
                                                                    : <span className="text-sm font-medium text-brand-700 dark:text-brand-400">Not configured</span>}
                                                            </td>
                                                            <td className="px-3 py-2 align-middle">
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`inline-block size-1.5 shrink-0 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                                                    <span className={`truncate text-sm font-semibold ${active ? 'text-emerald-700 dark:text-emerald-300' : 'text-subtle'}`}>
                                                                        {active ? 'Active' : 'Inactive'}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-2 text-right align-middle">
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <button
                                                                            type="button"
                                                                            aria-label="Service actions"
                                                                            className="inline-flex size-7 items-center justify-center rounded-chip text-subtle hover:bg-ink-100 hover:text-heading transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25 data-[state=open]:bg-ink-100 data-[state=open]:text-heading"
                                                                        >
                                                                            <MoreVertical size={14} />
                                                                        </button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end" sideOffset={4} className="w-48">
                                                                        <DropdownMenuItem onClick={() => onViewDetails(m)} className="text-xs cursor-pointer">
                                                                            <Eye className="h-3.5 w-3.5" /> View details
                                                                        </DropdownMenuItem>
                                                                        {canEdit && (
                                                                        <DropdownMenuItem onClick={() => onEditMapping(m)} className="text-xs cursor-pointer">
                                                                            <Edit className="h-3.5 w-3.5" /> Edit
                                                                        </DropdownMenuItem>
                                                                        )}
                                                                        {canDelete && (
                                                                        <>
                                                                        <DropdownMenuSeparator />
                                                                        <DropdownMenuItem onClick={() => onDeleteMapping(m)} className="text-xs cursor-pointer text-danger-700 focus:text-danger-700">
                                                                            <Trash2 className="h-3.5 w-3.5" /> Delete this service
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem onClick={() => onDeleteSeveral()} className="text-xs cursor-pointer text-danger-700 focus:text-danger-700">
                                                                            <Trash2 className="h-3.5 w-3.5" /> Delete several…
                                                                        </DropdownMenuItem>
                                                                        </>
                                                                        )}
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Pagination footer — matches the L&D overlay's shape:
                            range on the left, page-size picker + page buttons on
                            the right. Buttons hidden when everything fits on one page. */}
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline bg-surface-sunken/30 px-5 py-3">
                            <span className="text-xs tabular-nums text-subtle">
                                {shownMappings.length === 0
                                    ? 'No services to show'
                                    : <>Showing <b className="font-semibold text-heading">{rangeFrom}</b> to <b className="font-semibold text-heading">{rangeTo}</b> of <b className="font-semibold text-heading">{shownMappings.length}</b> service{shownMappings.length !== 1 ? 's' : ''}</>}
                            </span>
                            <div className="flex items-center gap-3">
                                <select
                                    value={String(pageSize)}
                                    onChange={(e) => setPageSize(Number(e.target.value))}
                                    aria-label="Rows per page"
                                    className={`${pickerClass} min-w-[128px]`}
                                >
                                    {[5, 10, 25, 50].map((n) => <option key={n} value={String(n)}>{n} per page</option>)}
                                </select>
                                {totalPages > 1 && (
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                                            disabled={currentPage <= 1}
                                            aria-label="Previous page"
                                            className="inline-flex h-8 w-8 items-center justify-center rounded-control border border-hairline-strong text-subtle transition-colors hover:bg-row-hover disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            <ChevronLeft size={14} />
                                        </button>
                                        {Array.from({ length: totalPages }, (_, idx) => idx + 1).slice(0, 5).map((p) => (
                                            <button
                                                key={p}
                                                type="button"
                                                onClick={() => setPage(p)}
                                                aria-current={currentPage === p ? 'page' : undefined}
                                                className={`inline-flex h-8 min-w-8 items-center justify-center rounded-control px-2 text-xs font-semibold tabular-nums transition-colors ${
                                                    currentPage === p
                                                        ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400'
                                                        : 'text-subtle hover:bg-row-hover hover:text-body'
                                                }`}
                                            >
                                                {p}
                                            </button>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                            disabled={currentPage >= totalPages}
                                            aria-label="Next page"
                                            className="inline-flex h-8 w-8 items-center justify-center rounded-control border border-hairline-strong text-subtle transition-colors hover:bg-row-hover disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            <ChevronRight size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

// ─── Delete confirmation modal ────────────────────────────────────────────────

function DeleteConfirmModal({
    open,
    label,
    isLoading,
    onConfirm,
    onCancel,
}: {
    open: boolean
    label: string
    isLoading: boolean
    onConfirm: () => void
    onCancel: () => void
}) {
    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !isLoading) onCancel() }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open, isLoading, onCancel])

    const overlayVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.15 } },
        exit: { opacity: 0, transition: { duration: 0.12 } },
    }
    const modalVariants = {
        hidden: { opacity: 0, scale: 0.94, y: 10 },
        visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.18, ease: 'easeOut' as const } },
        exit: { opacity: 0, scale: 0.94, y: 10, transition: { duration: 0.12 } },
    }

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    variants={overlayVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="fixed inset-0 bg-ink-900/40 flex items-center justify-center z-overlay p-4"
                    onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
                >
                    <motion.div
                        variants={modalVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="bg-surface rounded-xl border border-hairline shadow-xl w-full max-w-[380px] overflow-hidden"
                    >
                        <div className="px-6 pt-6 pb-4 flex flex-col items-center text-center">
                            <div className="w-11 h-11 rounded-full bg-danger-50 border border-danger-500/20 flex items-center justify-center mb-4">
                                <AlertTriangle size={20} className="text-danger-500" />
                            </div>
                            <h3 className="text-base font-semibold text-heading mb-1">Delete service mapping</h3>
                            <p className="text-xs text-subtle leading-relaxed">
                                Are you sure you want to delete{' '}
                                <span className="font-medium text-heading">{label}</span>?
                                <br />
                                {/* The server cascades now: the mapping's courses and all
                                    their content, calendars, exam history and enrolment data
                                    go with it (user accounts are kept). Say so — "cannot be
                                    undone" alone under-sells what is about to happen. */}
                                Its courses — with all their modules, exams, calendars and
                                enrolment data — are permanently deleted too. User accounts
                                are kept. This action cannot be undone.
                            </p>
                        </div>
                        <div className="h-px bg-hairline mx-6" />
                        <div className="px-6 py-4 flex gap-2">
                            <button
                                type="button"
                                onClick={onCancel}
                                disabled={isLoading}
                                className="flex-1 text-xs font-medium text-ink-700 border border-hairline-strong rounded-control px-4 py-2.5 hover:bg-row-hover transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={onConfirm}
                                disabled={isLoading}
                                className="flex-1 text-xs font-semibold bg-danger-700 text-white rounded-control px-4 py-2.5 hover:bg-danger-700/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                            >
                                {isLoading ? (
                                    <>
                                        <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                        Deleting…
                                    </>
                                ) : (
                                    <>
                                        <Trash2 size={12} />
                                        Delete
                                    </>
                                )}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

// Multi-select delete — lists a client's service mappings with checkboxes so the
// user can pick several and remove them together.
function DeleteMappingsModal({
    open,
    clientName,
    mappings,
    isLoading,
    onConfirm,
    onCancel,
}: {
    open: boolean
    clientName?: string
    mappings: ServiceMapping[]
    isLoading: boolean
    onConfirm: (ids: string[]) => void
    onCancel: () => void
}) {
    const [selected, setSelected] = useState<Set<string>>(new Set())

    // Fresh selection every time the modal opens
    useEffect(() => { if (open) setSelected(new Set()) }, [open])

    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !isLoading) onCancel() }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open, isLoading, onCancel])

    const allSelected = mappings.length > 0 && selected.size === mappings.length
    const toggle = (id: string) => setSelected((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id); else next.add(id)
        return next
    })
    const toggleAll = () => setSelected(allSelected ? new Set() : new Set(mappings.map((m) => m._id)))

    const labelFor = (m: ServiceMapping) =>
        [m.service, (m.serviceModels || []).join(', '), m.year].filter(Boolean).join(' · ')

    const overlayVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.15 } },
        exit: { opacity: 0, transition: { duration: 0.12 } },
    }
    const modalVariants = {
        hidden: { opacity: 0, scale: 0.94, y: 10 },
        visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.18, ease: 'easeOut' as const } },
        exit: { opacity: 0, scale: 0.94, y: 10, transition: { duration: 0.12 } },
    }

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    variants={overlayVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="fixed inset-0 bg-ink-900/40 flex items-center justify-center z-overlay p-4"
                    onClick={(e) => { if (e.target === e.currentTarget && !isLoading) onCancel() }}
                >
                    <motion.div
                        variants={modalVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="bg-surface rounded-xl border border-hairline shadow-xl w-full max-w-[440px] max-h-[80vh] flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="px-5 pt-5 pb-3 flex items-start gap-3 flex-shrink-0">
                            <div className="w-10 h-10 rounded-full bg-danger-50 border border-danger-500/20 flex items-center justify-center flex-shrink-0">
                                <Trash2 size={18} className="text-danger-500" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-base font-semibold text-heading">Delete services</h3>
                                <p className="text-xs text-subtle">
                                    Select the services to remove{clientName ? <> from <span className="font-medium text-body">{clientName}</span></> : null}.
                                </p>
                            </div>
                        </div>

                        {/* Select all */}
                        {mappings.length > 1 && (
                            <button
                                type="button"
                                onClick={toggleAll}
                                className="mx-5 mb-2 flex items-center gap-2 text-xs font-medium text-subtle hover:text-heading flex-shrink-0 transition-colors"
                            >
                                <span className={`w-4 h-4 rounded border flex items-center justify-center ${allSelected ? 'bg-brand-700 border-brand-700 text-white' : 'bg-surface border-ink-300'}`}>
                                    {allSelected && <Check size={11} strokeWidth={3} />}
                                </span>
                                {allSelected ? 'Clear all' : 'Select all'}
                            </button>
                        )}

                        {/* List */}
                        <div className="px-5 overflow-y-auto flex-1 min-h-0">
                            <div className="space-y-1.5">
                                {mappings.map((m) => {
                                    const checked = selected.has(m._id)
                                    return (
                                        <button
                                            key={m._id}
                                            type="button"
                                            onClick={() => toggle(m._id)}
                                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-tile border text-left transition-colors ${
                                                checked ? 'bg-danger-50 border-danger-500/30' : 'border-hairline-strong hover:bg-row-hover'
                                            }`}
                                        >
                                            <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${checked ? 'bg-danger-700 border-danger-700 text-white' : 'bg-surface border-ink-300'}`}>
                                                {checked && <Check size={11} strokeWidth={3} />}
                                            </span>
                                            <span className="flex-1 min-w-0 text-xs font-medium text-heading truncate">{labelFor(m)}</span>
                                            <span className={`text-2xs font-medium rounded-full px-2 py-0.5 border flex-shrink-0 ${
                                                m.status === 'active' ? 'bg-success-50 text-success-700 border-success-500/20' : 'bg-ink-100 text-ink-500 border-ink-200'
                                            }`}>
                                                {m.status === 'active' ? 'Active' : 'Inactive'}
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>
                            <p className="text-2xs text-faint mt-2 mb-1">Each mapping&apos;s courses and all their content and enrolment data are permanently deleted too (user accounts are kept). This action cannot be undone.</p>
                        </div>

                        {/* Footer */}
                        <div className="px-5 py-3.5 border-t border-hairline flex items-center justify-between gap-2 flex-shrink-0">
                            <span className="text-2xs text-subtle tabular-nums">{selected.size} selected</span>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={onCancel}
                                    disabled={isLoading}
                                    className="text-xs font-medium text-ink-700 border border-hairline-strong rounded-control px-4 py-2 hover:bg-row-hover transition-colors disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onConfirm(Array.from(selected))}
                                    disabled={isLoading || selected.size === 0}
                                    className="text-xs font-semibold bg-danger-700 text-white rounded-control px-4 py-2 hover:bg-danger-700/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                                >
                                    {isLoading ? (
                                        <>
                                            <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                            Deleting…
                                        </>
                                    ) : (
                                        <>
                                            <Trash2 size={12} />
                                            Delete{selected.size > 0 ? ` (${selected.size})` : ''}
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

// ─── Main page component ──────────────────────────────────────────────────────

// `embedded` — rendered inside another page (Business Management tabs) that
// already provides the DashboardLayout shell, so skip our own. Not exported:
// nothing imports it (the tabs became separate routes), and a named non-page
// export from a page file fails Next's generated page typing.
function ServiceMappingView({ embedded = false }: { embedded?: boolean }) {
    const Shell = embedded ? React.Fragment : DashboardLayout
    // Full-id permission checks — mirrors PermissionModal.PERMISSION_DATA
    // entries for admin-servicemapping. Each action button, kebab item and
    // drawer control below is gated (hidden entirely) when the signed-in user
    // was not granted that functionality.
    const { can } = usePermissions()
    const canMap = can(PERMISSION_IDS.ADMIN_SERVICE_MAPPING, 'Map Service')
    const canView = can(PERMISSION_IDS.ADMIN_SERVICE_MAPPING, 'View Full Details')
    const canEdit = can(PERMISSION_IDS.ADMIN_SERVICE_MAPPING, 'Edit')
    const canDelete = can(PERMISSION_IDS.ADMIN_SERVICE_MAPPING, 'Delete')
    // The list is fetched a page at a time, below — it needs the filter state,
    // which is declared further down, so the queries live there rather than here.
    const { data: clientList = [] } = useClients()
    const createMapping = useCreateServiceMapping()
    const updateMapping = useUpdateServiceMapping()
    const deleteMappingMut = useDeleteServiceMapping()
    const toggleStatusMut = useToggleServiceMappingStatus()
    // Row currently being toggled from the list (its switch shows a busy state).
    const [togglingRowId, setTogglingRowId] = useState<string | null>(null)

    // Service / service-modal dropdown data from course-structure-dynamic
    const institutionId = typeof window !== 'undefined' ? localStorage.getItem('smartcliff_institution') || '' : ''
    const token = typeof window !== 'undefined' ? getToken() || '' : ''
    const { data: servicesData = [], isLoading: isLoadingServices } = useServices(institutionId, token)
    // The master list carries every configured service; the wizard only offers the
    // four mappable ones (see ALLOWED_SERVICES).
    const servicesList = useMemo<ServiceOption[]>(() => {
        const fetched = servicesData as ServiceOption[]
        // One option per business model, in canonical order. Reuse the fetched
        // service (real id + service models) when its name matches; synthesise the
        // rest (e.g. CSR, which the API returns only as a model under B2B).
        return BUSINESS_MODELS.map((label, i) =>
            fetched.find((s) => ALLOWED_SERVICE_PATTERNS[i].test(s.name || ''))
            ?? { id: `bm-${label}`, name: label, serviceModals: [] }
        )
    }, [servicesData])

    // Degree / department masters for Step 3 suggestions
    const { data: degreesRes } = useQuery({
        queryKey: ['degrees'],
        queryFn: () => degreeService.getAllDegrees(),
        enabled: !!token,
        staleTime: 15 * 60 * 1000,
    })
    const degreesList = (degreesRes?.degrees || []) as Degree[]

    const [currentPage, setCurrentPage] = useState<number>(1)
    // pageSize is auto-computed to fit as many rows as the table area allows
    // without scrolling; overflow rows spill onto the next page.
    const [pageSize, setPageSize] = useState<number>(10)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'inactive'>('')
    const [yearFilter, setYearFilter] = useState('')
    const [clientFilter, setClientFilter] = useState('')
    const [serviceFilter, setServiceFilter] = useState('')
    const [serviceModelFilter, setServiceModelFilter] = useState('')
    const [sortKey, setSortKey] = useState<SortKey | null>(null)
    const [sortDir, setSortDir] = useState<SortDir>('asc')
    // Hierarchy filters (from the filter drawer) — derived from each mapping's
    // masterData at filter time; presentation-only, no new data source.
    const [degreeFilter, setDegreeFilter] = useState('')
    const [departmentFilter, setDepartmentFilter] = useState('')
    const [sectionFilter, setSectionFilter] = useState('')
    const [semesterFilter, setSemesterFilter] = useState('')
    // Workspace chrome: table vs hierarchy cards, the filter drawer, and the
    // mapping whose detail panel is open.
    const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
    const [showFilters, setShowFilters] = useState(false)
    const [selectedId, setSelectedId] = useState<string | null>(null)

    // ── The list, one page at a time ──────────────────────────────────────────
    // This page used to pull EVERY mapping in the institution and then filter,
    // sort, group and slice the array in the browser. The search, the ten
    // filters, the sort and the slice all run in Mongo now, and one page
    // crosses the wire.
    //
    // The two views paginate on DIFFERENT units — cards on mappings, the table
    // on clients — so they are two queries and exactly one of them is enabled.
    // Grouping is the server's job for the same reason the slice was: a page of
    // mappings is an unknown number of client rows.
    const [debouncedSearch, setDebouncedSearch] = useState('')
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 300)
        return () => clearTimeout(t)
    }, [search])

    const pageFilters = useMemo(() => ({
        search: debouncedSearch,
        status: statusFilter,
        year: yearFilter,
        client: clientFilter,
        service: serviceFilter,
        serviceModel: serviceModelFilter,
        degree: degreeFilter,
        department: departmentFilter,
        section: sectionFilter,
        semester: semesterFilter,
        // A cleared sort is a real state here — it returns the server's own
        // createdAt-desc order, which is otherwise unreachable.
        ...(sortKey ? { sortKey, sortDir } : {}),
    }), [debouncedSearch, statusFilter, yearFilter, clientFilter, serviceFilter,
        serviceModelFilter, degreeFilter, departmentFilter, sectionFilter,
        semesterFilter, sortKey, sortDir])

    // Any filter change goes back to page 1. Adjusting during render (rather
    // than in an effect) means the OLD page number never reaches a request:
    // changing a filter while on page 3 would otherwise fire for page 3 and
    // then immediately again for page 1.
    const filterSig = JSON.stringify(pageFilters)
    const [lastFilterSig, setLastFilterSig] = useState(filterSig)
    if (filterSig !== lastFilterSig) {
        setLastFilterSig(filterSig)
        setCurrentPage(1)
    }

    const mappingsPage = useServiceMappingsPage(
        pageFilters, currentPage, pageSize, {}, viewMode === 'cards',
    )
    const clientsPage = useClientGroupsPage(
        pageFilters, currentPage, pageSize, viewMode === 'table',
    )

    const mappings = mappingsPage.data?.data ?? []
    // Facets are the whole institution's values, not the page's — which is what
    // the filter dropdowns always showed, and could only show while the browser
    // held every mapping. Both responses carry them, so whichever view is live
    // supplies them and switching views never empties the drawer.
    const facets = viewMode === 'table' ? clientsPage.data?.facets : mappingsPage.data?.facets
    const isLoadingMappings = viewMode === 'table' ? clientsPage.isLoading : mappingsPage.isLoading

    // Ref to the table container so we can measure how many rows fit.

    // Wizard state — editing an existing mapping, or creating (optionally preset to a client)
    const [wizard, setWizard] = useState<{ open: boolean; mapping: ServiceMapping | null; clientId: string | null }>({
        open: false,
        mapping: null,
        clientId: null,
    })
    // Per-client details view
    const [detailsClientId, setDetailsClientId] = useState<string | null>(null)
    const [deleteModal, setDeleteModal] = useState<{ open: boolean; mapping: ServiceMapping | null }>({
        open: false,
        mapping: null,
    })
    // Multi-select delete (from the row's kebab) — scoped to one client's mappings
    const [deleteMappingsModal, setDeleteMappingsModal] = useState<{ open: boolean; clientId: string | null }>({
        open: false,
        clientId: null,
    })
    const [deletingMultiple, setDeletingMultiple] = useState(false)

    // ── One row per mapping ──
    const rows: MappingRow[] = useMemo(() => {
        return mappings
            .map((m) => {
                const client = typeof m.client === 'string' ? null : m.client
                return client?._id ? { _id: m._id, client, mapping: m } : null
            })
            .filter((r): r is MappingRow => r !== null)
    }, [mappings])

    // Filter options come from the data itself, so each list holds exactly the
    // values that exist rather than a hardcoded set that drifts. They describe
    // the WHOLE institution, not the page — so they come from the response's
    // facets, computed in the same aggregation that counted the rows, rather
    // than from an array the browser no longer holds.
    const availableYears = facets?.years ?? []
    const availableClients: [string, string][] = useMemo(
        () => (facets?.clients ?? []) as [string, string][],
        [facets]
    )
    const availableServices = facets?.services ?? []
    const availableServiceModels = facets?.serviceModels ?? []
    const hierarchyOptions = useMemo(() => ({
        degrees: facets?.hierarchy?.degrees ?? [],
        departments: facets?.hierarchy?.departments ?? [],
        sections: facets?.hierarchy?.sections ?? [],
        semesters: facets?.hierarchy?.semesters ?? [],
    }), [facets])

    // ── Search + filters ──
    // The server applied both, so `rows` IS the filtered page. The predicate
    // that used to live here — ten filters and the joined-haystack search — was
    // ported field-for-field into getMappingsPaginated rather than
    // reimplemented, and was deleted here rather than kept: re-filtering an
    // already-filtered page can only remove rows the server meant to return.
    const filteredRows = rows

    const hasActiveFilters = Boolean(
        search.trim() || statusFilter || yearFilter || clientFilter || serviceFilter || serviceModelFilter
        || degreeFilter || departmentFilter || sectionFilter || semesterFilter
    )
    // Drawer filters only (search has its own box) — badges the Filter button.
    const activeFilterCount =
        (clientFilter ? 1 : 0) + (serviceFilter ? 1 : 0) + (serviceModelFilter ? 1 : 0) +
        (yearFilter ? 1 : 0) + (statusFilter ? 1 : 0) + (degreeFilter ? 1 : 0) +
        (departmentFilter ? 1 : 0) + (sectionFilter ? 1 : 0) + (semesterFilter ? 1 : 0)

    // ── Sorting ──
    // Clicking the sorted column flips direction; clicking a third time clears it
    // and returns to the server's own order, which is a real state the user wants
    // back and is otherwise unreachable.
    // The key arrives as a string from DataTable; only the columns declared with a
    // sortKey can produce one, so narrowing to the union here is safe.
    const handleSort = (key: string) => {
        const next = key as SortKey
        if (sortKey !== next) { setSortKey(next); setSortDir('asc'); return }
        if (sortDir === 'asc') { setSortDir('desc'); return }
        setSortKey(null)
        setSortDir('asc')
    }

    // Sorted in Mongo, under a collation matching the comparator this used to
    // run (numeric, base sensitivity). Ties matter more than they look — sorting
    // by Year, where nearly every row carries the same value, is ALL tie-break
    // and alone decides which rows land on page one. The server's default
    // tie-break is this list's: equal values keep newest-first in BOTH
    // directions, which is what negating a comparator over a createdAt-desc
    // base did. (Course Setup reverses instead, and asks for `sortTies=reverse`.)
    const sortedRows = filteredRows

    // ── Summary tiles ──
    const stats = useMemo(() => {
        // Every tile counts the WHOLE book of work — not the filtered rows and
        // not the page — which is exactly what it showed before, and the reason
        // these come from the facets rather than from `mappings`.
        const counts = facets?.counts
        const byYear = facets?.byYear ?? []

        // The sparklines are cumulative counts by year, so the line shows the book
        // of work growing rather than an invented shape. Grouping by year is the
        // server's now; the running total stays here because it is presentation.
        const cumulative = (pick: (y: { total: number; active: number }) => number): number[] => {
            if (byYear.length < 2) return []
            let running = 0
            return byYear.map((y) => { running += pick(y); return running })
        }

        return {
            total: counts?.total ?? 0,
            active: counts?.active ?? 0,
            clients: counts?.clients ?? 0,
            models: counts?.models ?? 0,
            totalTrend: cumulative((y) => y.total),
            activeTrend: cumulative((y) => y.active),
        }
    }, [facets])


    // KPI cards removed per the workspace redesign — the same counts now render
    // as compact chips in the header (see `stats` above, used inline below).

    // Totals come from the server's own count of everything the filters select
    // — the page can no longer measure them, and measuring the page would have
    // reported "10 of 10" for any list at all.
    const totalRows = mappingsPage.data?.total ?? 0
    const totalPages = Math.max(1, mappingsPage.data?.totalPages ?? 1)
    const currentRows = sortedRows

    // Clamp against whichever total is currently visible: table view counts
    // clients, cards view counts mappings. Deleting the last row of the last
    // page (or switching to the view with fewer rows) can leave currentPage
    // past the end, and the server would answer that with an empty page.
    const activeTotalPages = viewMode === 'table'
        ? Math.max(1, clientsPage.data?.totalPages ?? 1)
        : totalPages
    useEffect(() => {
        setCurrentPage((p) => Math.min(p, activeTotalPages))
    }, [activeTotalPages])


    const clearFilters = () => {
        setSearch('')
        setStatusFilter('')
        setYearFilter('')
        setClientFilter('')
        setServiceFilter('')
        setServiceModelFilter('')
        setDegreeFilter('')
        setDepartmentFilter('')
        setSectionFilter('')
        setSemesterFilter('')
        setCurrentPage(1)
    }

    // The details and bulk-delete modals are per-CLIENT, but the table is per
    // mapping now, so a client view is assembled on demand from the rows that
    // share that client rather than looked up from a row.
    // Manage Services and the scoped bulk-delete picker both want ONE client's
    // real mappings. They used to slice them out of the full list; now they ask
    // for the client they are open on. Only one of the two can be open at a
    // time, so a single query serves both.
    const openClientId = detailsClientId || deleteMappingsModal.clientId
    const { data: openClientMappings = [] } = useMappingsByClient(openClientId)

    const clientRowFor = (clientId: string | null): ClientRow | null => {
        if (!clientId) return null
        // Prefer the fetched list; fall back to the page's own rows, which is
        // what cards view already has in hand.
        const own = clientId === openClientId && openClientMappings.length
            ? openClientMappings
            : rows.filter((r) => r.client._id === clientId).map((r) => r.mapping)
        if (!own.length) return null
        // getByClient returns the client populated, so the reference rides in
        // with the mappings; cards view can still answer from its own rows.
        const ref = (typeof own[0].client === 'string' ? null : own[0].client)
            || rows.find((r) => r.client._id === clientId)?.client
        if (!ref) return null
        return { _id: clientId, client: ref as MappedClientRef, mappings: own }
    }
    const detailsRow = clientRowFor(detailsClientId)
    // Course creation/update runs after the mapping mutation, so the wizard's
    // Save button stays busy for the whole sequence.
    const [isFinalizing, setIsFinalizing] = useState(false)
    const queryClient = useQueryClient()
    const isSaving = createMapping.isPending || updateMapping.isPending || isFinalizing

    // ── Actions ──
    const openCreate = (clientId: string | null = null) =>
        setWizard({ open: true, mapping: null, clientId })
    const openEdit = (mapping: ServiceMapping) =>
        setWizard({ open: true, mapping, clientId: null })
    const closeWizard = () => setWizard({ open: false, mapping: null, clientId: null })

    // Save the mapping — and, on a FULL save (coursePayload present), its course
    // with it. Partial saves (Step 1/2) store the mapping alone so it shows in
    // the list and can be completed later via Edit — the wizard stays open on
    // EVERY successful save (a full save shows its own preview, and its Done
    // button is what closes the modal). Full create:
    // mapping → course → link (course id written back onto the mapping); if the
    // course fails, the freshly created mapping is rolled back. Full edit:
    // mapping updated, then the linked course updated (or created, for mappings
    // saved partially or before course auto-creation).
    const handleSave = async (
        payload: ServiceMappingInput,
        coursePayload: Record<string, unknown> | null,
        mappingId?: string,
        existingCourseId?: string,
    ): Promise<{ mappingId: string; courseId: string } | null> => {
        setIsFinalizing(true)
        try {
            let savedMappingId = mappingId || ''
            let savedCourseId = existingCourseId || ''
            if (mappingId) {
                await updateMapping.mutateAsync({ id: mappingId, payload })
                if (coursePayload) {
                    if (existingCourseId) {
                        await updateCourseStructure(existingCourseId, { ...coursePayload, _id: existingCourseId })
                    } else {
                        const res = await createCourseStructure(coursePayload)
                        const newCourseId = res?.data?._id || res?.data?.id || res?.courseId || ''
                        if (newCourseId) {
                            await serviceMappingApi.update(mappingId, { courseId: String(newCourseId) })
                            savedCourseId = String(newCourseId)
                        }
                    }
                    notify.success('Service mapping and course updated successfully')
                } else {
                    notify.success('Service mapping updated successfully')
                }
            } else {
                const created = await createMapping.mutateAsync(payload)
                const newMappingId: string = (created as any)?.data?._id || ''
                savedMappingId = newMappingId
                if (coursePayload) {
                    try {
                        const res = await createCourseStructure(coursePayload)
                        const newCourseId = res?.data?._id || res?.data?.id || res?.courseId || ''
                        if (newMappingId && newCourseId) {
                            await serviceMappingApi.update(newMappingId, { courseId: String(newCourseId) })
                            savedCourseId = String(newCourseId)
                        }
                    } catch (courseError: any) {
                        // Roll the mapping back — a FULL save is all-or-nothing
                        if (newMappingId) {
                            try { await serviceMappingApi.remove(newMappingId) } catch { /* best effort */ }
                        }
                        throw new Error(
                            courseError?.response?.data?.error
                            || courseError?.response?.data?.message
                            || courseError?.message
                            || 'Failed to create the course'
                        )
                    }
                    notify.success('Service mapped — course created successfully')
                } else {
                    notify.success('Service mapping saved — finish the course setup anytime via Edit')
                }
            }
            // The mapping mutations' own onSuccess already invalidates
            // serviceMappingKeys.all + clientManagementKeys.all; the second
            // invalidation here is intentional to catch the raw
            // serviceMappingApi.update follow-up above that bypasses the hook.
            queryClient.invalidateQueries({ queryKey: serviceMappingKeys.all })
            queryClient.invalidateQueries({ queryKey: ['courseStructures'] })
            // Closing is the wizard's decision, never this handler's: a partial
            // save keeps stepping, and a full save shows the in-modal preview
            // whose Done button calls onClose (closeWizard). Closing from here
            // would tear the modal down before that preview could render.
            return { mappingId: savedMappingId, courseId: savedCourseId }
        } catch (e: any) {
            notify.error(e?.response?.data?.message || e?.message || 'Failed to save')
            return null
        } finally {
            setIsFinalizing(false)
        }
    }

    const confirmDelete = () => {
        if (!deleteModal.mapping?._id) return
        deleteMappingMut.mutate(deleteModal.mapping._id, {
            onSuccess: () => {
                notify.success('Service mapping deleted successfully')
                setDeleteModal({ open: false, mapping: null })
            },
            onError: (e: any) => notify.error(e?.message || 'Failed to delete service mapping'),
        })
    }

    // Delete several of a client's mappings at once (from the row kebab → modal).
    // Sequential so the backend's per-client sync doesn't race on the same client.
    // Uses the raw serviceMappingApi.remove so each iteration doesn't trigger
    // the hook's onSuccess invalidation — one invalidation after the loop
    // replaces N × 2 list refetches during a bulk delete.
    const invalidateMappingCaches = useInvalidateMappingCaches()
    const confirmDeleteMappings = async (ids: string[]) => {
        if (!ids.length) return
        setDeletingMultiple(true)
        try {
            for (const id of ids) {
                await serviceMappingApi.remove(id)
            }
            notify.success(ids.length === 1 ? 'Service deleted successfully' : `${ids.length} services deleted successfully`)
            setDeleteMappingsModal({ open: false, clientId: null })
        } catch (e: any) {
            notify.error(e?.message || 'Failed to delete services')
        } finally {
            invalidateMappingCaches()
            setDeletingMultiple(false)
        }
    }

    // A row is one mapping, so the switch flips that mapping alone — no more
    // aggregating a client's mappings into a single mixed state.
    const handleToggleRowStatus = async (row: MappingRow) => {
        if (togglingRowId) return
        setTogglingRowId(row._id)
        try {
            await toggleStatusMut.mutateAsync(row.mapping._id)
            notify.success(row.mapping.status === 'active'
                ? 'Service mapping deactivated'
                : 'Service mapping activated')
        } catch (e: any) {
            notify.error(e?.response?.data?.message || e?.message || 'Failed to update status')
        } finally {
            setTogglingRowId(null)
        }
    }

    // Filters now live in the right-side filter drawer (see the render below).
    // The available* memos above feed the drawer's option lists.

    // Numbering continues across pages rather than restarting at 1, so a row's
    // number identifies it within the whole filtered set.
    const startIndex = (currentPage - 1) * pageSize

    // ── Row view-models for the current page (presentation projection only) ──
    const currentVMs: MappingRowVM[] = useMemo(
        () => currentRows.map((r) => buildRowVM(r.mapping, r.client)),
        [currentRows]
    )

    // ── Per-client aggregation for the primary (table) view ──
    // The table view shows ONE row per client with a total-services count,
    // not one row per mapping. The list of services lives inside the Manage
    // Services modal instead. Cards view still uses per-mapping rows.
    // Aggregation runs off `sortedRows` (post-filter) so the primary listing
    // and its pagination always reflect the current filter state.
    // Grouped in Mongo, one page of clients at a time. Grouping in the browser
    // would have required every mapping to be here first, which is the fetch
    // this replaces — and the page count it produced was only ever right
    // because it could see the whole set.
    const currentClientAggregated: ClientRow[] = useMemo(
        () => (clientsPage.data?.data ?? []).map((g) => ({
            _id: String(g._id),
            client: (g.client ?? { _id: String(g._id) }) as MappedClientRef,
            // The client's own mappings are not shipped under the row; Manage
            // Services fetches them for the one client it opens on.
            mappings: [],
            services: g.services,
            activeCount: g.active,
            yearsList: g.years ?? [],
            lastUpdatedAt: g.lastUpdated,
        })),
        [clientsPage.data]
    )

    // Table view paginates on clients; cards view keeps per-mapping pagination.
    const clientTotal = clientsPage.data?.total ?? 0
    const clientTotalPages = Math.max(1, clientsPage.data?.totalPages ?? 1)

    // Helpers derived from a ClientRow — kept near the aggregation so any
    // column formatting change stays in one place.
    // Each helper prefers the aggregate the server computed and falls back to
    // the mappings array, so a summarised row and a fully-loaded one render the
    // same. Without the fallback these would read 0 for any row that still
    // carries its mappings (the modal's).
    const aggYearLabel = (row: ClientRow): string => {
        const years = (row.yearsList?.length
            ? row.yearsList
            : row.mappings.map((m) => m.year)).filter(Boolean) as (string | number)[]
        if (!years.length) return '—'
        const nums = years.map((y) => Number(y)).filter((n) => Number.isFinite(n)).sort((a, b) => a - b)
        if (!nums.length) return String(years[0])
        return nums[0] === nums[nums.length - 1] ? String(nums[0]) : `${nums[0]}–${nums[nums.length - 1]}`
    }
    const aggActiveCount = (row: ClientRow): number =>
        row.activeCount ?? row.mappings.reduce((n, m) => n + (m.status === 'active' ? 1 : 0), 0)
    /** Total services for the row, from the server's count where there is one. */
    const aggServiceCount = (row: ClientRow): number => row.services ?? row.mappings.length
    const aggLastUpdated = (row: ClientRow): string | undefined => {
        if (row.lastUpdatedAt) return row.lastUpdatedAt
        let latest = 0
        let src: string | undefined
        for (const m of row.mappings) {
            const t = m.updatedAt || m.createdAt
            if (!t) continue
            const iso = typeof t === 'string' ? t : new Date(t).toISOString()
            const ms = new Date(iso).getTime()
            if (Number.isFinite(ms) && ms > latest) { latest = ms; src = iso }
        }
        return src
    }
    // The selected mapping's detail (kept resolvable across pages/filters) plus
    // its client's other mappings, shown as "linked services" in the panel.
    const selectedVM = useMemo(() => {
        if (!selectedId) return null
        const r = rows.find((x) => x._id === selectedId)
        return r ? buildRowVM(r.mapping, r.client) : null
    }, [selectedId, rows])
    const selectedSiblings = useMemo(() => {
        if (!selectedVM) return []
        return rows
            .filter((r) => r.client._id === selectedVM.clientId && r._id !== selectedVM.id)
            .map((r) => buildRowVM(r.mapping, r.client))
    }, [selectedVM, rows])

    // Removable chips for the applied drawer filters (search has its own box).
    const filterChips: { key: string; label: string; onRemove: () => void }[] = [
        ...(clientFilter ? [{ key: 'client', label: availableClients.find(([v]) => v === clientFilter)?.[1] || 'Client', onRemove: () => setClientFilter('') }] : []),
        ...(degreeFilter ? [{ key: 'degree', label: degreeFilter, onRemove: () => setDegreeFilter('') }] : []),
        ...(departmentFilter ? [{ key: 'dept', label: departmentFilter, onRemove: () => setDepartmentFilter('') }] : []),
        ...(sectionFilter ? [{ key: 'section', label: sectionFilter, onRemove: () => setSectionFilter('') }] : []),
        ...(semesterFilter ? [{ key: 'semester', label: `Sem ${semesterFilter}`, onRemove: () => setSemesterFilter('') }] : []),
        ...(yearFilter ? [{ key: 'year', label: yearFilter, onRemove: () => setYearFilter('') }] : []),
        ...(serviceFilter ? [{ key: 'service', label: serviceFilter, onRemove: () => setServiceFilter('') }] : []),
        ...(serviceModelFilter ? [{ key: 'model', label: serviceModelFilter, onRemove: () => setServiceModelFilter('') }] : []),
        ...(statusFilter ? [{ key: 'status', label: statusFilter === 'active' ? 'Active' : 'Inactive', onRemove: () => setStatusFilter('') }] : []),
    ]

    // Export the filtered set (all pages) to CSV.
    const exportCsv = () => {
        const all = sortedRows.map((r) => buildRowVM(r.mapping, r.client))
        if (!all.length) { notify.error('Nothing to export'); return }
        const esc = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
        const header = ['Client', 'Service ID', 'Service', 'Service Models', 'Year', 'Status', 'Degrees', 'Departments', 'Sections', 'Semesters', 'Courses', 'Updated']
        const lines = [
            header.join(','),
            ...all.map((vm) => [
                vm.clientName, vm.serviceCode, vm.service, vm.models.join(' | '), vm.year, vm.status,
                vm.hierarchy.degrees.join(' | '), vm.hierarchy.departments.join(' | '),
                vm.hierarchy.sections.join(' | '), vm.hierarchy.semesters.join(' | '),
                vm.courseNames.join(' | '), fmtDate(vm.updatedAt || vm.createdAt),
            ].map(esc).join(',')),
        ]
        const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `service-mappings-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
        notify.success(`Exported ${all.length} mapping${all.length > 1 ? 's' : ''}`)
    }

    // Empty state for the table/cards.
    const workspaceEmpty = (
        <EmptyState
            icon={hasActiveFilters ? Search : Layers}
            title={hasActiveFilters ? 'No services match these filters' : 'No services mapped yet'}
            message={hasActiveFilters
                ? 'Try widening or clearing them to see more.'
                : 'Map a service to a client to see it listed here.'}
            primaryAction={
                // The empty-state CTA does whichever is useful: escape filters,
                // or start a new mapping — but only when the user is allowed to
                // create mappings (Map Service functionality).
                (hasActiveFilters || canMap) ? (
                    <button
                        type="button"
                        onClick={hasActiveFilters ? clearFilters : () => openCreate()}
                        className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-control bg-brand-strong text-white text-sm font-semibold shadow-xs hover:bg-brand-800 transition-colors duration-150"
                    >
                        {hasActiveFilters ? 'Clear filters' : '+ New Mapping'}
                    </button>
                ) : undefined
            }
        />
    )

    const tableMaxH = `calc(100dvh - ${18 + (filterChips.length > 0 ? 2.5 : 0) + (showFilters ? 16 : 0)}rem)`

    // (Row rendering now lives in MappingWorkspaceTable / MappingHierarchyCards,
    // driven by currentVMs; all row actions call back into the handlers above.)

    // ── Render ──
    return (
        <Shell>
            {/* Full-bleed console canvas on the sunken surface token — the cards
                and the table supply the raised planes. */}
            {/* flex-col + h-full + min-h-0 = the flex chain the shell needs so
                the table card below can `flex-1 min-h-0` and fill the remaining
                viewport instead of capping at a computed maxHeight. min-w-0
                stops flex children from pushing width past the workspace. */}
            <motion.div variants={pageEnter} initial="hidden" animate="visible" className="flex h-full flex-col min-h-0 min-w-0">
                <div className="flex flex-1 min-h-0 flex-col px-4 sm:px-6 md:px-8 pt-5 pb-4">
                    {/* ── Slim header + compact stat chips ──
                        flex-nowrap on md+ so the chip strip stays on the
                        right; left column shrinks (flex-1 min-w-0) and its
                        subtitle wraps within its own column. */}
                    <div className="flex items-start justify-between gap-4 flex-wrap md:flex-nowrap">
                        <div className="min-w-0 flex-1">
                            <h1 className="text-xl sm:text-2xl font-semibold text-heading tracking-[-0.01em]">Services</h1>
                        </div>
                        {/* Right-aligned stat strip via shared HeaderStats —
                            same primitive as Client Management + Course Setup. */}
                        <HeaderStats
                            loading={isLoadingMappings}
                            items={[
                                { label: 'Mappings', value: stats.total },
                                { label: 'Active', value: stats.active },
                                { label: 'Inactive', value: Math.max(0, stats.total - stats.active) },
                                { label: 'Clients', value: stats.clients },
                            ]}
                        />
                    </div>

                    {/* ── One toolbar: search · Filter · view toggle · overflow · New Mapping ── */}
                    {/* flex-wrap + min-w-0: search shrinks, trailing buttons
                        wrap onto a new row on narrow viewports instead of
                        pushing past the workspace width. */}
                    <div className="mt-4 flex items-center gap-2 flex-wrap min-w-0">
                        <div className="relative flex-1 min-w-0">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-faint pointer-events-none" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
                                placeholder="Search client, service, service model…"
                                className="w-full h-10 pl-10 pr-9 rounded-control border border-hairline-strong bg-surface text-sm text-body placeholder:text-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors duration-150"
                            />
                            {search && (
                                <button type="button" aria-label="Clear search" onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex size-6 items-center justify-center rounded-chip text-faint hover:bg-ink-100 hover:text-heading transition-colors duration-150"><X size={14} /></button>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowFilters((v) => !v)}
                            aria-expanded={showFilters}
                            className={`inline-flex items-center gap-1.5 h-10 px-3.5 rounded-control border text-sm font-medium shadow-xs transition-colors duration-150 relative ${activeFilterCount > 0 || showFilters ? 'border-brand text-brand-strong bg-brand-wash' : 'border-hairline-strong bg-surface text-body hover:bg-row-hover hover:text-heading'}`}
                        >
                            <SlidersHorizontal className="w-4 h-4" />
                            <span className="hidden sm:inline">Filter</span>
                            {activeFilterCount > 0 && <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-strong px-1 text-2xs font-bold text-white tabular-nums">{activeFilterCount}</span>}
                        </button>

                        <div className="hidden sm:flex items-center p-0.5 rounded-control border border-hairline-strong bg-surface h-10">
                            <button type="button" onClick={() => setViewMode('table')} title="Table view" aria-label="Table view" className={`h-8 w-8 rounded-chip flex items-center justify-center transition-colors duration-150 ${viewMode === 'table' ? 'bg-brand-wash text-brand-strong' : 'text-faint hover:text-heading'}`}><List className="w-4 h-4" /></button>
                            <button type="button" onClick={() => setViewMode('cards')} title="Hierarchy cards" aria-label="Hierarchy cards" className={`h-8 w-8 rounded-chip flex items-center justify-center transition-colors duration-150 ${viewMode === 'cards' ? 'bg-brand-wash text-brand-strong' : 'text-faint hover:text-heading'}`}><LayoutGrid className="w-4 h-4" /></button>
                        </div>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button type="button" aria-label="More actions" className="inline-flex items-center justify-center h-10 px-2.5 rounded-control border border-hairline-strong bg-surface text-body shadow-xs hover:bg-row-hover hover:text-heading transition-colors duration-150"><MoreHorizontal className="w-4 h-4" /></button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" sideOffset={6} className="w-52">
                                <DropdownMenuItem onClick={exportCsv} className="cursor-pointer"><Download className="h-4 w-4" /> Export list (CSV)</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {canMap && (
                            <button
                                type="button"
                                onClick={() => openCreate()}
                                className="inline-flex items-center gap-2 h-10 px-3.5 rounded-control bg-brand-strong text-white shadow-xs hover:bg-brand-800 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 flex-shrink-0"
                            >
                                <Plus size={16} strokeWidth={2.4} />
                                <span className="text-sm font-semibold hidden sm:inline">New Mapping</span>
                            </button>
                        )}
                    </div>

                    {/* ── Inline filter panel — expands on the same screen under the toolbar ── */}
                    <MappingWorkspaceFilterPanel
                        open={showFilters}
                        onClose={() => setShowFilters(false)}
                        current={{ client: clientFilter, service: serviceFilter, model: serviceModelFilter, year: yearFilter, status: statusFilter, degree: degreeFilter, department: departmentFilter, section: sectionFilter, semester: semesterFilter }}
                        clientOptions={availableClients.map(([value, label]) => ({ value, label }))}
                        serviceOptions={availableServices.map((s) => ({ value: s, label: s }))}
                        modelOptions={availableServiceModels.map((m) => ({ value: m, label: m }))}
                        yearOptions={availableYears.map((y) => ({ value: y, label: y }))}
                        degreeOptions={hierarchyOptions.degrees.map((v) => ({ value: v, label: v }))}
                        departmentOptions={hierarchyOptions.departments.map((v) => ({ value: v, label: v }))}
                        sectionOptions={hierarchyOptions.sections.map((v) => ({ value: v, label: v }))}
                        semesterOptions={hierarchyOptions.semesters.map((v) => ({ value: v, label: `Semester ${v}` }))}
                        onApply={(f) => {
                            setClientFilter(f.client); setServiceFilter(f.service); setServiceModelFilter(f.model)
                            setYearFilter(f.year); setStatusFilter(f.status as '' | 'active' | 'inactive')
                            setDegreeFilter(f.degree); setDepartmentFilter(f.department); setSectionFilter(f.section); setSemesterFilter(f.semester)
                            setCurrentPage(1)
                        }}
                        onReset={clearFilters}
                    />

                    {/* ── Active filter chips ── */}
                    {filterChips.length > 0 && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            {filterChips.map((chip) => (
                                <span key={chip.key} className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1.5 rounded-full border border-brand-500/30 bg-brand-wash text-xs font-medium text-brand-strong">
                                    {chip.label}
                                    <button type="button" aria-label={`Remove ${chip.label} filter`} onClick={() => { chip.onRemove(); setCurrentPage(1) }} className="inline-flex size-4 items-center justify-center rounded-full hover:bg-brand-500/20 transition-colors duration-150"><X size={11} /></button>
                                </span>
                            ))}
                            <button type="button" onClick={clearFilters} className="text-xs font-medium text-subtle hover:text-heading transition-colors duration-150 ml-0.5">Clear all</button>
                        </div>
                    )}

                    {/* ── Content: table (one row per CLIENT) or hierarchy cards ──
                        The table is the primary listing and is client-aggregated:
                        one row per client, with a services-count chip. The list
                        of individual mappings for that client lives inside the
                        Manage Services modal (opened via the row's kebab). The
                        cards view still shows per-mapping. */}
                    {viewMode === 'table' ? (
                        // flex-1 min-h-0 = fill remaining height; flex-col so
                        // the scroll region can flex-1 while the pagination
                        // footer keeps its natural height at the bottom.
                        <div className="mt-4 flex flex-1 min-h-0 flex-col bg-surface rounded-xl border border-hairline shadow-xs overflow-hidden">
                            <DataTable<ClientRow>
                                rows={currentClientAggregated}
                                rowKey={(row) => row._id}
                                sortKey={sortKey}
                                sortDir={sortDir}
                                onSort={handleSort}
                                isLoading={isLoadingMappings}
                                isFiltered={hasActiveFilters}
                                fillHeight
                                minWidth={720}
                                emptyTitle={hasActiveFilters ? 'No services match these filters' : 'No services mapped yet'}
                                emptyHint={hasActiveFilters
                                    ? 'Try widening or clearing them to see more.'
                                    : 'Map a service to a client to see it listed here.'}
                                emptyAction={(hasActiveFilters || canMap) ? (hasActiveFilters ? 'Clear filters' : '+ New Mapping') : undefined}
                                onEmptyAction={(hasActiveFilters || canMap) ? (hasActiveFilters ? clearFilters : () => openCreate()) : undefined}
                                columns={[
                                    {
                                        key: 'num',
                                        label: '#',
                                        className: 'w-[52px] pl-5 text-left text-xs text-faint tabular-nums',
                                        skeletonWidth: '20px',
                                        render: (_row, i) => (currentPage - 1) * pageSize + i + 1,
                                    },
                                    {
                                        key: 'client',
                                        label: 'Client',
                                        sortKey: 'client',
                                        className: 'px-3 text-left',
                                        skeletonWidth: '60%',
                                        render: (row) => (
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <ClientAvatar name={row.client.clientCompany || '—'} size="sm" />
                                                <div className="min-w-0">
                                                    <div className="font-semibold text-heading truncate">{row.client.clientCompany || '—'}</div>
                                                    <div className="text-2xs text-faint truncate">{row.client.type || 'business to institution'}</div>
                                                </div>
                                            </div>
                                        ),
                                    },
                                    {
                                        key: 'services',
                                        label: 'Services',
                                        sortKey: 'services',
                                        className: 'px-3 text-left',
                                        skeletonWidth: '80px',
                                        render: (row) => (
                                            <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full border border-brand-500/20 bg-brand-wash text-brand-strong text-2xs font-semibold">
                                                <Layers size={11} />
                                                {aggServiceCount(row)} {aggServiceCount(row) === 1 ? 'service' : 'services'}
                                            </span>
                                        ),
                                    },
                                    {
                                        key: 'year',
                                        label: 'Year',
                                        sortKey: 'year',
                                        className: 'px-3 text-left hidden md:table-cell',
                                        skeletonWidth: '60px',
                                        render: (row) => (
                                            <span className="text-sm text-body tabular-nums">{aggYearLabel(row)}</span>
                                        ),
                                    },
                                    {
                                        key: 'status',
                                        label: 'Status',
                                        // Right-aligned per the LMS pattern.
                                        className: 'px-3 text-right hidden lg:table-cell',
                                        skeletonWidth: '90px',
                                        render: (row) => {
                                            const active = aggActiveCount(row)
                                            const total = aggServiceCount(row)
                                            const allActive = active === total
                                            return (
                                                <span className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-full border text-2xs font-semibold ${
                                                    allActive
                                                        ? 'bg-success-50 text-success-700 border-success-500/20'
                                                        : active === 0
                                                            ? 'bg-ink-100 text-ink-500 border-ink-200'
                                                            : 'bg-warn-50 text-warn-700 border-warn-500/20'
                                                }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${allActive ? 'bg-success-500' : active === 0 ? 'bg-ink-400' : 'bg-warn-500'}`} />
                                                    {active}/{total} active
                                                </span>
                                            )
                                        },
                                    },
                                    {
                                        key: 'updated',
                                        label: 'Updated',
                                        sortKey: 'updated',
                                        className: 'px-3 text-left hidden xl:table-cell',
                                        skeletonWidth: '80px',
                                        render: (row) => (
                                            <span className="text-xs text-subtle">{fmtDate(aggLastUpdated(row))}</span>
                                        ),
                                    },
                                ]}
                                rowActions={(canView || canMap) ? ((row) => (
                                    <>
                                        {canView && (
                                        <DropdownMenuItem onClick={() => setDetailsClientId(row._id)} className="text-xs cursor-pointer">
                                            <Settings2 className="h-3.5 w-3.5" /> Manage Services
                                        </DropdownMenuItem>
                                        )}
                                        {canMap && (
                                        <DropdownMenuItem onClick={() => openCreate(row._id)} className="text-xs cursor-pointer">
                                            <Plus className="h-3.5 w-3.5" /> Map Services
                                        </DropdownMenuItem>
                                        )}
                                    </>
                                )) : undefined}
                            />
                            {!isLoadingMappings && clientTotal > 0 && (
                                <TableFooter
                                    from={clientTotal === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                                    to={Math.min(currentPage * pageSize, clientTotal)}
                                    total={clientTotal}
                                    pageSize={pageSize}
                                    onPageSize={(n) => { setPageSize(n); setCurrentPage(1) }}
                                    currentPage={currentPage}
                                    totalPages={clientTotalPages}
                                    onPage={setCurrentPage}
                                />
                            )}
                        </div>
                    ) : (
                        <div className="mt-4">
                            <MappingHierarchyCards
                                rows={currentVMs}
                                isLoading={isLoadingMappings}
                                skeletonCount={pageSize}
                                selectedId={selectedId}
                                onSelect={(vm) => { if (canView) setSelectedId(vm.id) }}
                                onToggleStatus={(vm) => handleToggleRowStatus({ _id: vm.id, client: vm.client, mapping: vm.mapping })}
                                togglingId={togglingRowId}
                                onEdit={(vm) => openEdit(vm.mapping)}
                                onMapService={(vm) => openCreate(vm.clientId)}
                                onDelete={(vm) => setDeleteModal({ open: true, mapping: vm.mapping })}
                                onViewClient={(vm) => setDetailsClientId(vm.clientId)}
                                canView={canView}
                                canEdit={canEdit}
                                canMap={canMap}
                                canDelete={canDelete}
                                emptyState={workspaceEmpty}
                            />
                            {!isLoadingMappings && totalRows > 0 && (
                                <div className="mt-3 bg-surface rounded-xl border border-hairline shadow-xs overflow-hidden">
                                    <TableFooter
                                        from={totalRows === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                                        to={Math.min(currentPage * pageSize, totalRows)}
                                        total={totalRows}
                                        pageSize={pageSize}
                                        onPageSize={(n) => { setPageSize(n); setCurrentPage(1) }}
                                        currentPage={currentPage}
                                        totalPages={totalPages}
                                        onPage={setCurrentPage}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </motion.div>

            {/* 3-step Map Service wizard */}
            <MapServiceWizard
                open={wizard.open}
                onClose={closeWizard}
                clients={clientList}
                servicesList={servicesList}
                isLoadingServices={isLoadingServices}
                degreesList={degreesList}
                editingMapping={wizard.mapping}
                presetClientId={wizard.clientId}
                isSaving={isSaving}
                onSave={handleSave}
            />

            {/* Per-client mappings details */}
            <ClientMappingsModal
                open={Boolean(detailsClientId && detailsRow)}
                row={detailsRow}
                onClose={() => setDetailsClientId(null)}
                // View details opens the right-side MappingDetailPanel — close
                // the modal first so the drawer has full focus, matching the
                // old row-kebab flow.
                onViewDetails={(m) => { setDetailsClientId(null); setSelectedId(m._id) }}
                onEditMapping={(m) => { setDetailsClientId(null); openEdit(m) }}
                onDeleteMapping={(m) => setDeleteModal({ open: true, mapping: m })}
                // Delete several… — same bulk-delete confirm the old kebab
                // used, scoped to whichever client the modal is showing.
                onDeleteSeveral={() => { if (detailsClientId) setDeleteMappingsModal({ open: true, clientId: detailsClientId }) }}
                canEdit={canEdit}
                canDelete={canDelete}
            />

            {/* Delete confirmation — single mapping (row trash / kebab / drawer).
                The label spells out service AND model: a client can hold the
                same service under several models, and the confirmation must
                leave no doubt about which row is about to go. */}
            <DeleteConfirmModal
                open={deleteModal.open}
                label={deleteModal.mapping
                    ? [
                        deleteModal.mapping.service,
                        (deleteModal.mapping.serviceModels || []).join(', '),
                        deleteModal.mapping.year ? `(${deleteModal.mapping.year})` : '',
                    ].filter(Boolean).join(' · ')
                    : ''}
                isLoading={deleteMappingMut.isPending}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteModal({ open: false, mapping: null })}
            />

            {/* Delete — multi-select (from the row kebab) */}
            <DeleteMappingsModal
                open={deleteMappingsModal.open}
                clientName={clientRowFor(deleteMappingsModal.clientId)?.client.clientCompany}
                mappings={clientRowFor(deleteMappingsModal.clientId)?.mappings || []}
                isLoading={deletingMultiple}
                onConfirm={confirmDeleteMappings}
                onCancel={() => setDeleteMappingsModal({ open: false, clientId: null })}
            />

            {/* Right-side detail panel — opens when a mapping is selected */}
            <MappingDetailPanel
                open={Boolean(selectedVM)}
                onClose={() => setSelectedId(null)}
                vm={selectedVM}
                siblings={selectedSiblings}
                onEdit={(vm) => { setSelectedId(null); openEdit(vm.mapping) }}
                onMapService={(vm) => { setSelectedId(null); openCreate(vm.clientId) }}
                onDelete={(vm) => setDeleteModal({ open: true, mapping: vm.mapping })}
                onViewClient={(vm) => { setSelectedId(null); setDetailsClientId(vm.clientId) }}
                onSelectSibling={(vm) => setSelectedId(vm.id)}
                canEdit={canEdit}
                canMap={canMap}
                canDelete={canDelete}
            />

        </Shell>
    )
}

export default function ServiceMappingPage() {
    return <ServiceMappingView />
}
