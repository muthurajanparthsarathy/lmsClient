"use client"

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
    ChevronRight, File, FileStack, Folder, FolderOpen, Image as ImageIcon, Upload, X,
} from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import InfoTooltip from '@/components/ui/reusabletooltip'
import TipTapEditor from '../../../component/tiptopEditor'
import ResourceTypeSection, { type MappingResources } from '../../../component/Resourcetypesection '
import TestConfigurationSection, { type TestConfiguration } from '../../../component/Addcoursestructure/TestConfigurationSection'
import { ValidationMessage } from '../../../component/Addcoursestructure/ValidationMessage'
import type { FormData as CourseFormData, ValidationErrors } from '../../../component/Addcoursestructure/types'

// Moodle-style settings form for the course setup panel: collapsible full-width
// sections, label-left field rows, and error reveal on failed saves. Layout
// only — every piece of state lives in the panel and arrives through props, so
// the panel keeps sole ownership of validation and saving. This is a FORK of
// what Step2CourseDetails composes, not a wrapper around it: that file is
// shared with the legacy add-course popup and must keep its card layout.

export type SetupFormProps = {
    // Already-resolved display strings decided by the mapping; rendered
    // verbatim as read-only rows so the two records cannot drift apart.
    identity: { label: string; value: React.ReactNode }[]
    formData: CourseFormData
    setFormData: React.Dispatch<React.SetStateAction<CourseFormData>>
    validationErrors: ValidationErrors
    setValidationErrors: React.Dispatch<React.SetStateAction<ValidationErrors>>
    // The course's batch names from the mapping. Empty → the Resources-by-batch
    // section does not render at all (a batchless course has nothing to split).
    batches: string[]
    batchResources: { sameForAllBatches: boolean; batchwiseElements: string[] }
    onBatchResources: (next: { sameForAllBatches: boolean; batchwiseElements: string[] }) => void
    readOnly: boolean
    fileInputRef: React.RefObject<HTMLInputElement>
    onFileSelect: (file: File) => void
    onDescriptionChange: (value: string) => void
    // The raw course-structure documents useCourseData fetched. The pedagogy
    // activity lists live in the first one; typed unknown because the shared
    // form receives it untyped and the shape is asserted where it is read.
    structures: unknown
    // True while the structures query is in flight, so the pedagogy pickers can
    // say "Loading…" instead of a false "No activities available".
    structuresLoading?: boolean
    // The panel calls this after a failed validation: expand every section
    // holding an error and scroll to the first offender.
    revealErrorsRef: React.MutableRefObject<(() => void) | null>
    // The mapping's Step 3 (Resources) selection, which narrows the Resource
    // Type rows to what that mapping picked. Forwarded untouched.
    mappingResources?: MappingResources | null
}

type SectionId = 'general' | 'hierarchy' | 'resources' | 'testconfig' | 'batchres'

// Which error keys live in which section, so a failed save knows exactly which
// collapsed sections to open.
const SECTION_ERROR_KEYS: Record<SectionId, string[]> = {
    general: ['level', 'courseDescription'],
    hierarchy: ['checkboxOptions'],
    resources: ['resourceType'],
    testconfig: ['programmingConfiguration'],
    batchres: ['batchResources'],
}

// Moodle's default: identity visible, the heavier sections folded.
const DEFAULT_OPEN: Record<SectionId, boolean> = {
    general: true,
    hierarchy: false,
    resources: false,
    testconfig: false,
    batchres: false,
}

// Controls sit in a capped column rather than stretching to the row's full
// width — a date or level select spanning the whole page reads as a text area.
const CONTROL_WIDTH = 'max-w-[340px]'

function SectionHeader({
    title,
    required,
    open,
    onToggle,
}: {
    title: string
    required?: boolean
    open: boolean
    onToggle: () => void
}) {
    return (
        <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className="flex w-full items-center gap-3 py-4 px-1 text-left group bg-white border-b border-ink-200"
        >
            <span className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-info-50 group-hover:bg-info-50 transition-colors">
                <ChevronRight
                    size={16}
                    strokeWidth={2.5}
                    className={`text-info-700 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
                />
            </span>
            <span className="text-xl font-normal text-ink-800 group-hover:text-info-700 transition-colors">
                {title}
            </span>
            {required && <span className="text-danger-700 text-lg font-normal" title="Required">*</span>}
        </button>
    )
}

function Section({
    title,
    required,
    open,
    onToggle,
    readOnly,
    plain,
    children,
}: {
    title: string
    required?: boolean
    open: boolean
    onToggle: () => void
    readOnly: boolean
    plain?: boolean
    children: React.ReactNode
}) {
    return (
        <section>
            <SectionHeader title={title} required={required} open={open} onToggle={onToggle} />
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        // Clipping is what makes the height animation read as a
                        // fold; nothing inside needs to escape this box (the
                        // date pickers portal their popups to the body).
                        className="overflow-hidden"
                    >
                        {/* The fieldset wraps only the CONTENT, never the header
                            button above — view mode must still let the reader
                            open and close sections. min-w-0 defeats the
                            fieldset's native min-content width, which would
                            otherwise let wide children break the page.
                            `plain` skips the fieldset entirely: a disabled
                            fieldset kills EVERY button inside, including pure
                            navigation like the resources I Do/We Do/You Do tab
                            switcher — a viewer must still be able to look at all
                            three tabs, so that section guards its own inputs
                            instead. */}
                        {plain ? (
                            <div className={`min-w-0 pl-6 pb-5 ${readOnly ? 'opacity-90' : ''}`}>
                                {children}
                            </div>
                        ) : (
                            <fieldset disabled={readOnly} className={`min-w-0 pl-6 pb-5 ${readOnly ? 'opacity-90' : ''}`}>
                                {children}
                            </fieldset>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </section>
    )
}

// One Moodle row: label in a fixed left column (right-aligned on desktop,
// stacked above the control on small screens), control on the right. The
// data-error-anchor attribute is present only while the row is failing, so the
// reveal can find the FIRST offender with a single DOM-order query.
function FieldRow({
    label,
    required,
    tooltip,
    error,
    hint,
    children,
}: {
    label: string
    required?: boolean
    tooltip?: string
    error?: string
    hint?: string
    children: React.ReactNode
}) {
    return (
        <div
            data-error-anchor={error ? 'true' : undefined}
            className="py-2.5 md:grid md:grid-cols-[200px_minmax(0,1fr)] md:gap-x-6 md:items-start"
        >
            {/* Label text left-aligned (first letters line up), while the required
                mark, help icon and the colon are pushed to the right edge of the
                label column by the label's flex-1 — so the colons form one vertical
                line at the label/value boundary, Moodle-style. */}
            <div className="flex items-center gap-1.5 mb-1.5 md:mb-0 md:pt-2">
                <span className="text-[15px] font-medium text-heading md:text-left md:flex-1">{label}</span>
                {required && <span className="text-danger-700 font-semibold" title="Required">*</span>}
                {tooltip && <InfoTooltip content={tooltip} />}
                <span className="text-[15px] font-medium text-heading">:</span>
            </div>
            <div className="min-w-0">
                {children}
                {hint && <p className="text-xs text-faint mt-1">{hint}</p>}
                {error && <ValidationMessage message={error} />}
            </div>
        </div>
    )
}

// The pedagogy multi-select from the old PedagogyCard, kept as a value-less
// Radix Select whose content is a checkbox list — the trigger only summarises
// the count, selection lives in the checkboxes.
function PedagogyActivityRow({
    label,
    tooltip,
    selected,
    elements,
    loading,
    onToggle,
}: {
    label: string
    tooltip: string
    selected: string[]
    elements: { id: string; name: string }[]
    // While the structures query is in flight the list is empty for a different
    // reason than "none configured" — showing the empty message then reads as a
    // permanent state and sends the user away before the data lands.
    loading?: boolean
    onToggle: (name: string) => void
}) {
    return (
        <FieldRow label={label} tooltip={tooltip}>
            <div className={CONTROL_WIDTH}>
                <Select>
                    <SelectTrigger className="w-full h-9 px-3 text-[13px] font-medium rounded-lg border-hairline-strong">
                        <SelectValue placeholder={selected.length > 0 ? `${selected.length} selected` : 'Select activities'} />
                    </SelectTrigger>
                    <SelectContent className="text-sm max-h-60 rounded-lg">
                        {elements.length === 0 ? (
                            <div className="px-2 py-1.5 text-xs font-medium text-subtle">
                                {loading ? 'Loading…' : 'No activities available'}
                            </div>
                        ) : (
                            elements.map((el) => (
                                <div key={el.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-row-hover rounded-md">
                                    <input
                                        type="checkbox"
                                        id={el.id}
                                        checked={selected.includes(el.name)}
                                        onChange={() => onToggle(el.name)}
                                        className="h-3.5 w-3.5 rounded accent-brand-500"
                                    />
                                    <label htmlFor={el.id} className="text-xs font-medium cursor-pointer flex-1">{el.name}</label>
                                </div>
                            ))
                        )}
                    </SelectContent>
                </Select>
                {selected.length > 0 && (
                    <div className="mt-1.5 space-y-1 max-h-32 overflow-y-auto">
                        {selected.map((item, index) => (
                            <div
                                key={item}
                                className="px-2 py-1.5 bg-ink-50 border border-hairline-strong text-heading text-xs rounded-lg flex items-center justify-between"
                            >
                                <span className="font-medium">{index + 1}. {item}</span>
                                <button type="button" onClick={() => onToggle(item)} className="hover:bg-danger-50 rounded p-0.5">
                                    <X className="h-3 w-3 text-danger-700" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </FieldRow>
    )
}

export default function CourseSetupForm({
    identity,
    formData,
    setFormData,
    validationErrors,
    setValidationErrors,
    batches,
    batchResources,
    onBatchResources,
    readOnly,
    fileInputRef,
    onFileSelect,
    onDescriptionChange,
    structures,
    structuresLoading,
    revealErrorsRef,
    mappingResources,
}: SetupFormProps) {
    const [open, setOpen] = useState<Record<SectionId, boolean>>(DEFAULT_OPEN)
    // A counter rather than calling the reveal directly: the panel invokes
    // revealErrorsRef in the same event that SETS the errors, so this render
    // hasn't seen them yet. Bumping state defers the work to the next render,
    // where the error props and the tick land together in one batch.
    const [revealTick, setRevealTick] = useState(0)
    const rootRef = useRef<HTMLDivElement>(null)

    // A freshly-picked File needs an object URL for its preview. Minting one in
    // render leaked a blob URL per re-render for the tab's lifetime — so it is
    // created once per file and revoked when the file changes or on unmount.
    const imagePreviewUrl = useMemo(
        () => (formData.image && typeof formData.image !== 'string'
            ? URL.createObjectURL(formData.image)
            : null),
        [formData.image]
    )
    useEffect(() => () => { if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl) }, [imagePreviewUrl])

    useEffect(() => {
        revealErrorsRef.current = () => setRevealTick((t) => t + 1)
        return () => { revealErrorsRef.current = null }
    }, [revealErrorsRef])

    useEffect(() => {
        if (revealTick === 0) return
        const active = new Set<string>()
        for (const [k, v] of Object.entries(validationErrors)) if (v) active.add(k)
        if (active.size === 0) return
        setOpen((prev) => {
            const next = { ...prev }
            for (const id of Object.keys(SECTION_ERROR_KEYS) as SectionId[]) {
                if (SECTION_ERROR_KEYS[id].some((k) => active.has(k))) next[id] = true
            }
            return next
        })
        // The scroll waits out the 0.2s fold animation: scrolling to a child of
        // a container still animating from height 0 lands on a stale position.
        const timer = setTimeout(() => {
            const anchor = rootRef.current?.querySelector<HTMLElement>('[data-error-anchor]')
            if (!anchor) return
            anchor.scrollIntoView({ behavior: 'smooth', block: 'center' })
            anchor.querySelector<HTMLElement>('input, select, textarea, button, [tabindex]')?.focus({ preventScroll: true })
        }, 240)
        return () => clearTimeout(timer)
        // Errors are deliberately absent from the deps: the reveal must run
        // once per failed save, not every time the user fixes a field.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [revealTick])

    const allOpen = Object.values(open).every(Boolean)
    const toggleAll = () => {
        const to = !allOpen
        setOpen({ general: to, hierarchy: to, resources: to, testconfig: to, batchres: to })
    }
    const toggle = (id: SectionId) => () => setOpen((prev) => ({ ...prev, [id]: !prev[id] }))

    // The pedagogy activity lists ride in the first structure document — the
    // same read useCourseData's transform performs, minus the icon dressing
    // this layout doesn't use.
    const pedagogyElements = useMemo(() => {
        const src = (Array.isArray(structures) && structures.length > 0 ? structures[0] : {}) as {
            I_Do?: string[]; We_Do?: string[]; You_Do?: string[]
        }
        return {
            iDo: (src.I_Do ?? []).map((name, i) => ({ id: `i_do_${i}`, name })),
            weDo: (src.We_Do ?? []).map((name, i) => ({ id: `we_do_${i}`, name })),
            youDo: (src.You_Do ?? []).map((name, i) => ({ id: `you_do_${i}`, name })),
        }
    }, [structures])

    const togglePedagogy = (key: 'iDo' | 'weDo' | 'youDo') => (name: string) =>
        setFormData((prev) => ({
            ...prev,
            [key]: prev[key].includes(name) ? prev[key].filter((n) => n !== name) : [...prev[key], name],
        }))

    const handleTestConfigChange = (config: TestConfiguration) => {
        setFormData((prev) => ({ ...prev, testConfiguration: config }))
        setValidationErrors((prev) => ({ ...prev, programmingConfiguration: undefined }))
    }

    // Same cascade as the shared form: unticking a parent unticks everything
    // that depends on it, so a save can never claim a subtopic without a topic.
    const setHierarchy = (id: 'module' | 'submodule' | 'topic' | 'subtopic', on: boolean) => {
        setFormData((prev) => ({
            ...prev,
            checkboxOptions: {
                ...prev.checkboxOptions,
                ...(id === 'module' && { module: on, ...(!on && { submodule: false, topic: false, subtopic: false }) }),
                ...(id === 'submodule' && { submodule: on }),
                ...(id === 'topic' && { topic: on, ...(!on && { subtopic: false }) }),
                ...(id === 'subtopic' && { subtopic: on }),
            },
        }))
        setValidationErrors((prev) => ({ ...prev, checkboxOptions: undefined }))
    }

    const hierarchyItems = [
        { id: 'module', label: 'Module', icon: Folder, disabled: false },
        { id: 'submodule', label: 'Submodule', icon: FolderOpen, disabled: !formData.checkboxOptions.module },
        { id: 'topic', label: 'Topic', icon: File, disabled: !formData.checkboxOptions.module },
        { id: 'subtopic', label: 'Subtopic', icon: FileStack, disabled: !formData.checkboxOptions.topic },
    ] as const

    return (
        <div ref={rootRef} className="font-sans bg-white">
            <div className="flex justify-end">
                <button
                    type="button"
                    onClick={toggleAll}
                    className="text-[12.5px] font-medium text-brand-500 hover:text-brand-600 transition-colors"
                >
                    {allOpen ? 'Collapse all' : 'Expand all'}
                </button>
            </div>

            {/* Separators now live on each SectionHeader (border-b), Moodle-style,
                so the wrapper no longer draws its own divide-y (that would double
                the line under a collapsed header). */}
            <div>
                {/* ── General ─────────────────────────────────────────────── */}
                <Section title="General" open={open.general} onToggle={toggle('general')} readOnly={readOnly}>
                    {identity.map((row) => (
                        <FieldRow key={row.label} label={row.label}>
                            <div className="text-[15px] text-heading pt-2 min-w-0 break-words">{row.value}</div>
                        </FieldRow>
                    ))}
                    <FieldRow
                        label="Course level"
                        required
                        tooltip="Select difficulty level"
                        error={validationErrors.level}
                    >
                        <div className={CONTROL_WIDTH}>
                            <Select
                                value={formData.level}
                                onValueChange={(value) => {
                                    setFormData((prev) => ({ ...prev, level: value }))
                                    setValidationErrors((prev) => ({ ...prev, level: undefined }))
                                }}
                            >
                                <SelectTrigger
                                    className={`w-full h-9 px-3 text-[13px] font-medium rounded-lg ${validationErrors.level ? 'border-danger-500' : 'border-hairline-strong'}`}
                                >
                                    <SelectValue placeholder="Select Level" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Beginner">Beginner</SelectItem>
                                    <SelectItem value="Intermediate">Intermediate</SelectItem>
                                    <SelectItem value="Advanced">Advanced</SelectItem>
                                    <SelectItem value="Expert">Expert</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </FieldRow>
                    {/* Description and image stay in General — they are part of
                        what the course IS, and splitting them into their own
                        section made the most-edited fields the easiest to miss. */}
                    <FieldRow
                        label="Course description"
                        tooltip="Shown to learners on the course page. Optional."
                        error={validationErrors.courseDescription}
                    >
                        {/* editable, not the fieldset, is what disables TipTap:
                            contenteditable ignores a disabled ancestor. */}
                        <TipTapEditor
                            value={formData.courseDescription}
                            onChange={onDescriptionChange}
                            placeholder="Type your course description..."
                            minHeight="150px"
                            maxHeight="200px"
                            showToolbar={!readOnly}
                            editable={!readOnly}
                        />
                    </FieldRow>
                    <FieldRow
                        label="Course image"
                        tooltip="Cover image shown on the course card."
                        hint="JPEG, JPG, PNG, WebP • Max 3MB"
                    >
                        <div className="flex items-start gap-4">
                            <div
                                onClick={() => { if (!readOnly) fileInputRef.current?.click() }}
                                className={`h-9 flex-1 ${CONTROL_WIDTH} border-2 border-dashed border-hairline-strong rounded-lg flex items-center justify-center bg-white transition-all ${readOnly ? 'opacity-60' : 'cursor-pointer hover:border-brand-500'}`}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/jpg,image/png,image/webp"
                                    className="hidden"
                                    onChange={(e) => { if (e.target.files?.[0]) onFileSelect(e.target.files[0]) }}
                                />
                                <Upload className="w-4 h-4 text-ink-600 mr-2" />
                                <span className="text-[13px] font-medium text-ink-600">Choose Image</span>
                            </div>
                            {formData.image ? (
                                <div className="relative flex-shrink-0">
                                    <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-hairline-strong shadow-sm">
                                        {/* A just-picked File only exists as a blob URL,
                                            which next/image cannot optimise anyway. */}
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={typeof formData.image === 'string' ? formData.image : imagePreviewUrl || ''}
                                            alt="Course preview"
                                            className="h-full w-full object-cover"
                                        />
                                    </div>
                                    {!readOnly && (
                                        <button
                                            type="button"
                                            onClick={() => setFormData((prev) => ({ ...prev, image: null }))}
                                            className="absolute -top-1 -right-1 bg-danger-500 hover:bg-danger-700 text-white rounded-full p-1 shadow-md"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="w-16 h-16 flex-shrink-0 rounded-lg border-2 border-dashed border-hairline-strong flex items-center justify-center bg-white">
                                    <ImageIcon className="h-6 w-6 text-faint" />
                                </div>
                            )}
                        </div>
                    </FieldRow>
                </Section>

                {/* ── Course hierarchy ────────────────────────────────────── */}
                <Section title="Course hierarchy" required open={open.hierarchy} onToggle={toggle('hierarchy')} readOnly={readOnly}>
                    <FieldRow
                        label="Levels"
                        required
                        tooltip="Organize hierarchically — Modules → Submodules → Topics → Subtopics"
                        hint="Submodules and topics need a module; subtopics need a topic."
                        error={validationErrors.checkboxOptions}
                    >
                        <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2">
                            {hierarchyItems.map(({ id, label, icon: Icon, disabled }) => (
                                <label
                                    key={id}
                                    htmlFor={`${id}-checkbox`}
                                    className={`flex items-center gap-2 text-[13px] font-medium ${disabled ? 'text-faint cursor-not-allowed' : 'text-heading cursor-pointer'}`}
                                >
                                    <input
                                        type="checkbox"
                                        id={`${id}-checkbox`}
                                        checked={formData.checkboxOptions[id]}
                                        onChange={(e) => setHierarchy(id, e.target.checked)}
                                        disabled={disabled}
                                        className={`h-4 w-4 accent-brand-500 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                    />
                                    {label} <Icon className={`h-4 w-4 ${disabled ? 'text-ink-300' : 'text-brand-500'}`} />
                                </label>
                            ))}
                        </div>
                    </FieldRow>
                </Section>

                {/* ── Resources ───────────────────────────────────────────── */}
                {/* `plain` in view mode: a disabled fieldset would also kill the
                    I Do / We Do / You Do TAB buttons inside ResourceTypeSection,
                    leaving two of the three stages unreadable in the preview.
                    Interactivity is guarded by no-op setters instead — the tabs
                    still switch (local state), the inputs cannot change anything. */}
                <Section title="Resources" required open={open.resources} onToggle={toggle('resources')} readOnly={readOnly} plain={readOnly}>
                    {/* The activity pickers come first: they say WHAT happens in
                        each pedagogy stage, the resource grid below says what
                        material each stage carries. */}
                    <PedagogyActivityRow
                        label="I Do"
                        tooltip="Teacher demonstrates concepts and skills"
                        selected={formData.iDo}
                        elements={pedagogyElements.iDo}
                        loading={structuresLoading}
                        onToggle={readOnly ? () => {} : togglePedagogy('iDo')}
                    />
                    <PedagogyActivityRow
                        label="We Do"
                        tooltip="Guided practice with instructor support"
                        selected={formData.weDo}
                        elements={pedagogyElements.weDo}
                        loading={structuresLoading}
                        onToggle={readOnly ? () => {} : togglePedagogy('weDo')}
                    />
                    <PedagogyActivityRow
                        label="You Do"
                        tooltip="Independent practice and application"
                        selected={formData.youDo}
                        elements={pedagogyElements.youDo}
                        loading={structuresLoading}
                        onToggle={readOnly ? () => {} : togglePedagogy('youDo')}
                    />
                    {/* ResourceTypeSection renders its own resourceType error, so
                        only the scroll anchor lives out here. */}
                    <div className="pt-2" data-error-anchor={validationErrors.resourceType ? 'true' : undefined}>
                        <ResourceTypeSection
                            formData={formData}
                            setFormData={readOnly ? () => {} : setFormData}
                            validationErrors={validationErrors}
                            setValidationErrors={readOnly ? () => {} : setValidationErrors}
                            mappingResources={mappingResources}
                        />
                    </div>
                </Section>

                {/* ── Test configuration ──────────────────────────────────── */}
                <Section title="Test configuration" open={open.testconfig} onToggle={toggle('testconfig')} readOnly={readOnly}>
                    <div data-error-anchor={validationErrors.programmingConfiguration ? 'true' : undefined}>
                        <TestConfigurationSection
                            testConfiguration={formData.testConfiguration}
                            onChange={handleTestConfigChange}
                        />
                        {validationErrors.programmingConfiguration && (
                            <ValidationMessage message={validationErrors.programmingConfiguration} />
                        )}
                    </div>
                </Section>

                {/* ── Resources by batch ───────────────────────────────────
                    Whether this course's CONTENT is shared across its batches.
                    Question-first: Yes ends the section (one shared set,
                    today's behavior); No reveals the element ticks, and the
                    preview table states the consequence — including what a
                    student of one batch will actually see. Structure only:
                    the material itself is uploaded later in course resources.
                    Renders only when the course runs in MORE THAN ONE batch —
                    with a single batch there is nothing to differ from, so
                    "are resources the same for all batches?" has no meaning. */}
                {batches.length > 1 && (
                    <Section title="Resources by batch" open={open.batchres} onToggle={toggle('batchres')} readOnly={readOnly}>
                        <div data-error-anchor={validationErrors.batchResources ? 'true' : undefined} className="space-y-4">
                            <div className="flex items-center gap-3 flex-wrap mt-2">
                                <span className="text-[13px] font-medium text-heading">
                                    Are course resources the same for all batches?
                                </span>
                                <div className="inline-flex rounded-control border border-hairline-strong bg-surface overflow-hidden shadow-xs">
                                    {([
                                        { value: true, label: 'Yes' },
                                        { value: false, label: 'No' },
                                    ] as const).map((opt) => (
                                        <button
                                            key={opt.label}
                                            type="button"
                                            disabled={readOnly}
                                            aria-pressed={batchResources.sameForAllBatches === opt.value}
                                            onClick={() => onBatchResources({
                                                sameForAllBatches: opt.value,
                                                // Flipping back to Yes clears the ticks —
                                                // a stale hidden list must not resurface
                                                // as batch-wise on the next No.
                                                batchwiseElements: opt.value ? [] : batchResources.batchwiseElements,
                                            })}
                                            className={`h-8 px-4 text-xs font-semibold transition-colors ${
                                                batchResources.sameForAllBatches === opt.value
                                                    ? 'bg-gradient-to-b from-brand-400 to-brand-600 text-white'
                                                    : 'text-subtle hover:bg-row-hover'
                                            } ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                                <span className="text-2xs text-faint">
                                    {batchResources.sameForAllBatches
                                        ? 'One shared content set — every batch sees it'
                                        : 'Ticked elements below get their own content per batch'}
                                </span>
                            </div>

                            {!batchResources.sameForAllBatches && (
                                <div className="flex items-center gap-4 flex-wrap">
                                    <span className="text-xs text-subtle">Which elements differ per batch?</span>
                                    {([
                                        { key: 'I_Do', label: 'I Do', hint: 'live classes' },
                                        { key: 'We_Do', label: 'We Do', hint: 'practical' },
                                        { key: 'You_Do', label: 'You Do', hint: 'assessment' },
                                    ] as const).map((el) => {
                                        const on = batchResources.batchwiseElements.includes(el.key)
                                        return (
                                            <label
                                                key={el.key}
                                                className={`inline-flex items-center gap-2 text-[13px] font-medium text-heading ${readOnly ? 'opacity-60' : 'cursor-pointer'}`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={on}
                                                    disabled={readOnly}
                                                    onChange={() => onBatchResources({
                                                        ...batchResources,
                                                        batchwiseElements: on
                                                            ? batchResources.batchwiseElements.filter((k) => k !== el.key)
                                                            : [...batchResources.batchwiseElements, el.key],
                                                    })}
                                                    className="w-4 h-4 accent-brand-500"
                                                />
                                                {el.label}
                                                <span className="text-2xs text-faint font-normal">— {el.hint}</span>
                                            </label>
                                        )
                                    })}
                                </div>
                            )}

                            {/* The consequence, stated before saving: which
                                elements stay shared, which split per batch. */}
                            <div className="rounded-tile border border-hairline overflow-hidden">
                                {([
                                    { key: 'I_Do', label: 'I Do' },
                                    { key: 'We_Do', label: 'We Do' },
                                    { key: 'You_Do', label: 'You Do' },
                                ] as const).map((el, i) => {
                                    const batchwise = !batchResources.sameForAllBatches
                                        && batchResources.batchwiseElements.includes(el.key)
                                    return (
                                        <div
                                            key={el.key}
                                            className={`grid grid-cols-[110px_1fr] ${i < 2 ? 'border-b border-hairline' : ''}`}
                                        >
                                            <div className="px-3 py-2 text-xs font-medium text-heading bg-surface-sunken">
                                                {el.label}
                                            </div>
                                            <div className="px-3 py-2 flex items-center gap-1.5 flex-wrap">
                                                {batchwise ? (
                                                    <>
                                                        <span className="inline-flex items-center h-[20px] px-2 rounded-chip bg-brand-50 border border-brand-200 text-brand-700 text-2xs font-medium">
                                                            Batch-wise
                                                        </span>
                                                        {batches.map((b) => (
                                                            <span
                                                                key={b}
                                                                className="inline-flex items-center h-[20px] px-2 rounded-chip border border-brand-200 text-brand-700 text-2xs"
                                                            >
                                                                {b} · own content
                                                            </span>
                                                        ))}
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="inline-flex items-center h-[20px] px-2 rounded-chip bg-ink-100 text-ink-500 text-2xs font-medium">
                                                            Shared
                                                        </span>
                                                        <span className="text-2xs text-faint">one set, every batch</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            <p className="text-xs text-subtle">
                                A <span className="font-semibold text-heading">{batches[0]}</span> student will see:{' '}
                                {([
                                    { key: 'I_Do', label: 'I Do' },
                                    { key: 'We_Do', label: 'We Do' },
                                    { key: 'You_Do', label: 'You Do' },
                                ] as const).map((el, i) => {
                                    const batchwise = !batchResources.sameForAllBatches
                                        && batchResources.batchwiseElements.includes(el.key)
                                    return (
                                        <span key={el.key}>
                                            {i > 0 && ' + '}
                                            {batchwise
                                                ? <span className="text-brand-700 font-medium">{batches[0]}&apos;s {el.label}</span>
                                                : `shared ${el.label}`}
                                        </span>
                                    )
                                })}
                                .
                            </p>

                            {validationErrors.batchResources && (
                                <ValidationMessage message={validationErrors.batchResources} />
                            )}
                        </div>
                    </Section>
                )}
            </div>
        </div>
    )
}
