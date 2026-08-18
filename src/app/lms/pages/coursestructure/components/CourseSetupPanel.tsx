"use client"

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Pencil } from 'lucide-react'
import CourseSetupForm from './CourseSetupForm'
import { transformTestConfigurationForBackend, transformTestConfigurationForFrontend } from '../../../component/Addcoursestructure/Step2CourseDetails'
import { pedagogyStructureApi } from '@/apiServices/dynamicFields/pedagogyStructureService'
import { initialCourseFormData } from '../../../component/Addcoursestructure/utils/constants'
import { initializeResourcesType, generateNextCourseId, applyMappingResourceDefaults } from '../../../component/Addcoursestructure/utils/helpers'
import type { FormData as CourseFormData, ValidationErrors } from '../../../component/Addcoursestructure/types'
import { createCourseStructure, updateCourseStructure, fetchCourseStructureById } from '@/apiServices/createCourseStucture'
import type { ServiceMapping } from '@/apiServices/serviceMappingService'
import { batchPlacementLabel, placementLabel, type CourseGroup } from './mappingTree'
import { toast } from 'react-toastify'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSION_IDS } from '@/components/permissions'

// Stage 3: the course's own details. The client, category, course name and where
// it runs all come from the mapping and are shown read-only inside the form's
// General section — re-asking for them would let the two records drift apart.
//
// The form itself is CourseSetupForm (Moodle-style collapsible sections); this
// panel owns every piece of state, validation and the save payload, so the form
// stays a pure layout over props and the two cannot disagree about what is saved.
export default function CourseSetupPanel({
    mapping,
    course,
    existingCourseId,
    existingCourseIds,
    readOnly = false,
    onBack,
    onEdit,
    onSaved,
}: {
    mapping: ServiceMapping
    course: CourseGroup
    // Set when this course already has a setup, so we update instead of
    // creating a second record for the same course.
    existingCourseId: string | null
    existingCourseIds: Set<string>
    // View mode: the same form, but nothing can be changed and there is
    // nothing to save.
    readOnly?: boolean
    onBack: () => void
    // Offered only in the read-only preview: switches this same course back to
    // the editable form. Optional because plain View from the hierarchy may not
    // always want an edit affordance.
    onEdit?: () => void
    // The code rides along so the parent can treat it as taken immediately —
    // the refetch that would teach it the same thing lands after the user may
    // already have opened the next course's setup. The action says which save
    // button was used, because the two lead to different places: 'return' goes
    // back to the hierarchy, 'display' opens the saved course's structure.
    onSaved: (courseId: string, courseCode: string, action: 'return' | 'display') => void
}) {
    // Gate the read-only view's Edit affordance — the caller only mounts this
    // panel from the hierarchy's row action, but the button still shouldn't
    // appear for a user without Edit Course. Save buttons intentionally stay
    // ungated: reaching the editable form already required Add Course
    // (SetupButton) or Edit Course (menu), which is where the real gate lives.
    const { can } = usePermissions()
    const canEditCourse = can(PERMISSION_IDS.ADMIN_COURSE_MANAGEMENT, 'Edit Course')
    // A brand-new course starts with whatever the mapping's Step 3 (Resources)
    // pre-selected — the Super Admin's Resource Management enables a type for
    // the institution, the mapping narrows it to a default for its courses,
    // and this is where that default lands. An edit's load effect below
    // overwrites resourcesType wholesale from the saved record, so this only
    // ever matters for a fresh setup.
    const [formData, setFormData] = useState<CourseFormData>(() =>
        existingCourseId ? initialCourseFormData : applyMappingResourceDefaults(initialCourseFormData, mapping.resourceDefaults)
    )
    const [validationErrors, setValidationErrors] = useState<ValidationErrors>({})
    // Resources-by-batch: whether the course's content is shared across its
    // batches, and — when it isn't — which elements carry per-batch content.
    // Only meaningful when the mapping gave this course batches; defaults to
    // shared, which is today's behavior and needs no answer.
    const [batchResources, setBatchResources] = useState<{ sameForAllBatches: boolean; batchwiseElements: string[] }>({
        sameForAllBatches: true,
        batchwiseElements: [],
    })
    // Which save is in flight, not just whether one is: both buttons must show
    // the spinner only on themselves, while all actions stay disabled.
    const [savingAction, setSavingAction] = useState<'return' | 'display' | null>(null)
    const isSaving = savingAction !== null
    const [isLoading, setIsLoading] = useState(Boolean(existingCourseId))
    const fileInputRef = useRef<HTMLInputElement>(null)
    // Filled in by the form: expands every collapsed section that holds a
    // failing field and scrolls to the first one. A ref rather than state
    // because the panel needs to fire it imperatively from inside handleSave,
    // between validate() and the early return.
    const revealErrorsRef = useRef<(() => void) | null>(null)

    // Only the pedagogy structures are needed — the form extracts the activity
    // lists from them itself. This used to mount useCourseData, which dragged
    // in three additional queries this panel never read (services, categories,
    // all-courses) and ignited the categories service's permanent background
    // poll as a side effect.
    const { data: structures, isLoading: isLoadingStructures } = useQuery(pedagogyStructureApi.getAll())

    const clientName = typeof mapping.client === 'string' ? '' : mapping.client?.clientCompany || ''
    const modelName = (mapping.serviceModels || [])[0] || mapping.service || ''

    // Generated once per panel: regenerating on every render would hand a
    // different code to the save than the one the user was shown. Deliberately
    // NOT mapping.courseCode — that is the mapping-level legacy pointer, shared
    // by every course in the mapping, and reusing it would give sibling courses
    // identical codes.
    const generatedCode = useMemo(
        () => generateNextCourseId(clientName, mapping.service || '', modelName, existingCourseIds),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    )

    // A new setup takes the generated code; an edit must re-save the record's
    // own stored code, which only exists once the load below resolves — hence
    // state rather than a derived value, so what is shown is what is saved.
    const [courseCode, setCourseCode] = useState(existingCourseId ? '' : generatedCode)

    // Editing an existing setup loads it first, so Save updates rather than
    // silently replacing the saved values with defaults.
    useEffect(() => {
        let cancelled = false
        if (!existingCourseId) { setIsLoading(false); return }
        ;(async () => {
            try {
                const res = await fetchCourseStructureById(existingCourseId)
                const data = res?.data
                if (cancelled || !data) return
                // The stored code is this course's identity everywhere downstream,
                // so an edit re-saves it verbatim. Only records from before codes
                // were per-course have none and get a fresh one.
                setCourseCode(String(data.courseCode || '') || generatedCode)
                if (data.batchResources && typeof data.batchResources === 'object') {
                    const br = data.batchResources as { sameForAllBatches?: boolean; batchwiseElements?: string[] }
                    setBatchResources({
                        sameForAllBatches: br.sameForAllBatches !== false,
                        batchwiseElements: Array.isArray(br.batchwiseElements) ? br.batchwiseElements : [],
                    })
                }
                setFormData((prev) => ({
                    ...prev,
                    level: data.courseLevel || '',
                    courseDescription: data.courseDescription || '',
                    instructor: data.instructor || '',
                    image: data.courseImage || null,
                    aiChatGlobal: data.aiChatGlobal || false,
                    iDo: data.I_Do || [],
                    weDo: data.We_Do || [],
                    youDo: data.You_Do || [],
                    checkboxOptions: {
                        module: data.courseHierarchy?.includes('Module') || false,
                        submodule: data.courseHierarchy?.includes('Sub Module') || false,
                        topic: data.courseHierarchy?.includes('Topic') || false,
                        subtopic: data.courseHierarchy?.includes('Sub Topic') || false,
                    },
                    resourcesType: initializeResourcesType(data.resourcesType || {}),
                    testConfiguration: transformTestConfigurationForFrontend(data.testConfiguration),
                }))
                // Remembered so removing the image later can tell the server to
                // delete it — a null image in the payload is skipped by the API
                // layer, so removal has to travel as its own flag.
                imageWasStoredRef.current = Boolean(data.courseImage)
            } catch {
                // Without this the rejection is unhandled and the user is shown
                // a blank "edit" form whose save would overwrite the real record
                // with defaults — surfacing it here is what prevents that save.
                if (!cancelled) toast.error('Could not load this course\'s saved setup — go back and reopen it')
            } finally {
                if (!cancelled) setIsLoading(false)
            }
        })()
        return () => { cancelled = true }
        // generatedCode is memoised for the panel's lifetime, so listing it never
        // re-runs the fetch; it is here only to keep the dependency list honest.
    }, [existingCourseId, generatedCode])

    // Whether the loaded record HAD a stored image — see the load effect.
    const imageWasStoredRef = useRef(false)

    // FormData.image is a File — the form builds its own preview from it, so
    // converting to a data URL here would break its type contract. The limits
    // here are the ones the form's hint promises ("JPEG, JPG, PNG, WebP • Max
    // 3MB"); without them the promise was decorative.
    const handleFileSelect = (file: File) => {
        const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
        if (!allowed.includes(file.type)) {
            toast.error('Only JPEG, JPG, PNG or WebP images are allowed')
            return
        }
        if (file.size > 3 * 1024 * 1024) {
            toast.error('Image must be 3MB or smaller')
            return
        }
        setFormData((prev) => ({ ...prev, image: file }))
    }

    // The read-only identity rows shown in the form's General section. All of
    // this is decided by the mapping — the form renders it, but never edits it.
    const identityRows: Array<{ label: string; value: React.ReactNode }> = [
        { label: 'Client', value: clientName || '—' },
        { label: 'Category', value: course.category || '—' },
        {
            label: 'Course name',
            value: (
                <>
                    {course.courseName}
                    {/* Only a course that already has a record owns a code; while
                        the edit load is in flight courseCode is still empty, so
                        this also keeps a half-loaded code out of the row. */}
                    {existingCourseId && courseCode ? (
                        <span className="text-faint"> ({courseCode})</span>
                    ) : null}
                </>
            ),
        },
        {
            label: 'Runs in',
            value: course.placements.length
                ? course.placements.map(placementLabel).join(', ')
                : 'Not tied to a semester',
        },
        { label: 'Course code', value: courseCode || '—' },
    ]

    const validate = (): boolean => {
        // No code means the edit load never produced one — saving would strip the
        // course of its identity, so refuse outright. There is no form field for
        // the code (it is system-assigned), which is why this is a toast rather
        // than a ValidationErrors entry.
        if (!courseCode.trim()) {
            // Two different failures share this guard: an edit whose load never
            // produced a code (reopening genuinely helps), and a NEW course whose
            // mapping lacks the client/service details the generator needs — where
            // reopening would just regenerate '' forever.
            toast.error(existingCourseId
                ? 'Course code is missing — go back and reopen this course, then try again'
                : 'A course code could not be generated — this mapping is missing its client or service details')
            return false
        }
        const errors: ValidationErrors = {}
        if (!formData.level) errors.level = 'Please select a course level'
        if (!Object.values(formData.checkboxOptions).some(Boolean)) {
            errors.checkboxOptions = 'Please select at least one course hierarchy option'
        }
        const hasResources = (['iDo', 'weDo', 'youDo'] as const).some((section) =>
            (['video', 'ppt', 'pdf', 'image', 'zip', 'url', 'aiChat', 'aiSummary', 'notes', 'ai', 'autoQuestionGenerate'] as const).some(
                (type) => (formData.resourcesType[section] as Record<string, { enabled?: boolean }>)?.[type]?.enabled
            )
        )
        if (!hasResources) errors.resourceType = 'Please select at least one resource type'
        // Answering "No" and ticking nothing describes the same state as "Yes"
        // while claiming otherwise — force the answer to mean something.
        if (course.batches.length > 0 && !batchResources.sameForAllBatches
            && batchResources.batchwiseElements.length === 0) {
            errors.batchResources = 'Tick at least one element that differs per batch — or answer Yes'
        }
        setValidationErrors(errors)

        return Object.keys(errors).length === 0
    }

    // One save path for both buttons — only where the parent goes AFTER the
    // save differs, and that decision belongs to the parent, so the action is
    // simply passed through onSaved.
    const handleSave = async (action: 'return' | 'display') => {
        if (!validate()) {
            // An error inside a collapsed section is invisible, which reads as
            // "the button is broken" — the form opens those sections and scrolls
            // to the first failure before the user can wonder.
            revealErrorsRef.current?.()
            return
        }
        setSavingAction(action)
        try {
            const courseHierarchy: string[] = []
            if (formData.checkboxOptions.module) courseHierarchy.push('Module')
            if (formData.checkboxOptions.submodule) courseHierarchy.push('Sub Module')
            if (formData.checkboxOptions.topic) courseHierarchy.push('Topic')
            if (formData.checkboxOptions.subtopic) courseHierarchy.push('Sub Topic')

            // Every placement this course has in the mapping, so the course
            // record knows all the rows it serves — one setup, many placements.
            const clientConfigurations = course.placements.map((p) => ({
                batch: '',
                degree: p.degree,
                departmentSections: [{
                    department: p.department,
                    sections: p.section ? [p.section] : [],
                    semesters: [p.semester],
                }],
            }))
            const first = clientConfigurations[0]

            const payload: Record<string, unknown> = {
                clientId: typeof mapping.client === 'string' ? mapping.client : mapping.client?._id || '',
                // The mapping this setup came from. It scopes the course's
                // identity: without it, the same course name under a different
                // service would be mistaken for this record.
                //
                // Sent on UPDATE too, deliberately: editing a legacy record (one
                // with no stored mappingId) claims it for the mapping it was
                // edited from. Its content was already being overwritten with
                // this mapping's placements — last edit has always owned the
                // record — and claiming it means the OTHER same-named mappings
                // flip to "Not set up" and get their own fresh setups, which is
                // exactly the per-mapping separation the identity fix is for.
                mappingId: mapping._id,
                // WHERE in the mapping this course sits ("B.E ▸ CSE ▸ A ▸ 3", a
                // phase name, or '' for the flat flows). Together with the
                // mapping it is what makes the same course name under CSE and
                // under ECE two separate setups rather than one shared record.
                coursePath: course.path || '',
                clientName,
                serviceType: mapping.service || '',
                serviceModal: modelName,
                category: course.category,
                courseCode,
                courseName: course.courseName,
                // Resources-by-batch answer. A batchless course saves the
                // default (shared) — the section never rendered for it.
                batchResources,
                courseDescription: formData.courseDescription,
                courseDuration: '',
                courseLevel: formData.level,
                resourcesType: formData.resourcesType,
                courseHierarchy,
                I_Do: formData.iDo,
                We_Do: formData.weDo,
                You_Do: formData.youDo,
                courseImage: formData.image,
                // The API layer drops null values, so "image removed" cannot ride
                // on courseImage itself — the server's own removal path keys off
                // this flag (a string compare, hence 'true' rather than true).
                ...(existingCourseId && !formData.image && imageWasStoredRef.current
                    ? { removeImage: 'true' }
                    : {}),
                aiChatGlobal: formData.aiChatGlobal,
                institution: typeof window !== 'undefined' ? localStorage.getItem('smartcliff_institution') || '' : '',
                createdBy: typeof window !== 'undefined' ? localStorage.getItem('smartcliff_user_email') || '' : '',
                testConfiguration: transformTestConfigurationForBackend(formData.testConfiguration),
                studentType: course.placements.length ? 'degree-program' : 'skilling',
                batch: '',
                skillingBatches: [],
                // The course's own batch names from the mapping (b1, b2, …).
                // getCourseBatches materialises these into batchAndParticipants,
                // which is what renders the enrolment page's batch tabs — so a
                // course mapped with batches enrols per batch instead of the
                // "Default" fallback. Sent on update too: re-saving a setup after
                // the mapping's batches changed brings the record up to date.
                batches: course.batches,
                degree: first?.degree || '',
                departmentSections: first?.departmentSections || [],
                clientConfigurations,
            }

            if (existingCourseId) {
                await updateCourseStructure(existingCourseId, { ...payload, _id: existingCourseId })
                toast.success('Course setup updated')
                onSaved(existingCourseId, courseCode, action)
            } else {
                const res = await createCourseStructure(payload)
                const newId = res?.data?._id || res?.data?.id || res?.courseId || ''
                toast.success('Course setup saved')
                onSaved(String(newId), courseCode, action)
            }
        } catch (e: unknown) {
            const err = e as {
                response?: { data?: { message?: string | { value?: string }[] } }
                message?: string
            }
            // The duplicate-code rejection arrives as an ARRAY of {value} objects,
            // which toast.error cannot render — the one failure the user most
            // needs explained would otherwise show a blank toast.
            const m = err?.response?.data?.message
            const text = Array.isArray(m)
                ? m.map((x) => x?.value).filter(Boolean).join(', ')
                : m
            toast.error(text || err?.message || 'Failed to save course setup')
        } finally {
            setSavingAction(null)
        }
    }

    return (
        <div className="px-3 sm:px-5 lg:px-7 py-4 sm:py-5 space-y-4 max-w-[1600px] mx-auto">
            <div>
                <button
                    type="button"
                    onClick={onBack}
                    className="inline-flex items-center gap-1.5 text-[12px] text-subtle hover:text-heading transition-colors"
                >
                    <ArrowLeft size={14} /> Back to hierarchy
                </button>
                {/* Where the user is: client, then the service that mapped the
                    course, then the course itself — with the exact hierarchy
                    rows it runs in beneath, since three stages deep it is easy
                    to lose track of which mapping this setup belongs to. */}
                <nav aria-label="Breadcrumb" className="mt-1.5 flex items-center gap-1 text-[12px] text-subtle min-w-0 flex-wrap">
                    <span className="truncate max-w-[180px]">{clientName || 'Client'}</span>
                    <span className="text-ink-300">›</span>
                    <span className="truncate max-w-[220px]">
                        {mapping.service || 'Service'}{modelName && modelName !== mapping.service ? ` · ${modelName}` : ''}
                    </span>
                    <span className="text-ink-300">›</span>
                    <span className="text-heading font-medium truncate max-w-[240px]">{course.courseName}</span>
                </nav>
                <h1 className="mt-1 text-[22px] sm:text-[26px] leading-[30px] sm:leading-[34px] font-bold text-heading tracking-[-0.02em]">
                    {course.courseName}
                    {existingCourseId && courseCode ? (
                        <span className="ml-2 text-[15px] font-normal tracking-normal text-faint">({courseCode})</span>
                    ) : null}
                </h1>
                <p className="text-[12.5px] text-subtle mt-0.5">
                    {readOnly ? 'Viewing this course’s setup' : existingCourseId ? 'Edit this course’s setup' : 'Set up this course'}
                    {(() => {
                        // Whichever hierarchy the mapping used: degree placements
                        // or batch/phase placements — never both.
                        const spots = course.placements.length
                            ? course.placements.map(placementLabel)
                            : course.batchPlacements.map(batchPlacementLabel)
                        if (!spots.length) return null
                        const shown = spots.slice(0, 2).join(', ')
                        const more = spots.length - 2
                        return (
                            <span className="text-faint">
                                {' · '}Runs in {shown}{more > 0 ? ` +${more} more` : ''}
                            </span>
                        )
                    })()}
                </p>
            </div>

            {isLoading ? (
                <div className="space-y-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-9 rounded-lg bg-ink-100 animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
                    ))}
                </div>
            ) : (
                <>
                    {/* Not wrapped in a disabled fieldset here: the section
                        headers and Expand all live inside the form, and view
                        mode must still be able to open sections to read them.
                        The form scopes the disabling to the controls instead. */}
                    <CourseSetupForm
                        identity={identityRows}
                        formData={formData}
                        setFormData={setFormData}
                        validationErrors={validationErrors}
                        setValidationErrors={setValidationErrors}
                        batches={course.batches}
                        batchResources={batchResources}
                        onBatchResources={(next) => {
                            setBatchResources(next)
                            setValidationErrors((prev) => ({ ...prev, batchResources: undefined }))
                        }}
                        readOnly={readOnly}
                        fileInputRef={fileInputRef as React.RefObject<HTMLInputElement>}
                        onFileSelect={handleFileSelect}
                        onDescriptionChange={(v: string) => setFormData((prev) => ({ ...prev, courseDescription: v }))}
                        structures={structures}
                        structuresLoading={isLoadingStructures}
                        revealErrorsRef={revealErrorsRef}
                        // Narrows the Resource Type rows to the types this
                        // mapping picked in Step 3. The same config seeds a new
                        // course's selections above (applyMappingResourceDefaults),
                        // so what the mapping chose is both what is shown and
                        // what starts switched on.
                        mappingResources={mapping.resourceDefaults}
                    />

                    {/* Centred like Moodle's form-buttons row. Everything is
                        disabled while a save runs — including Cancel, because
                        leaving mid-save would drop the onSaved navigation. */}
                    <div className="pt-4 border-t border-hairline-strong flex flex-wrap items-center justify-center gap-2.5">
                        {readOnly ? (
                            <>
                                {onEdit && canEditCourse && (
                                    <button
                                        type="button"
                                        onClick={onEdit}
                                        className="inline-flex items-center gap-1.5 h-9 px-5 rounded-[10px] bg-gradient-to-b from-brand-400 to-brand-600 text-white text-[12.5px] font-semibold shadow-[0_4px_12px_rgba(240,112,31,0.28)] hover:brightness-105 active:scale-[0.98] transition-all"
                                    >
                                        <Pencil size={13} /> Edit
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={onBack}
                                    className="h-9 px-5 rounded-[10px] text-[12.5px] font-medium text-body bg-white border border-ink-200 hover:bg-row-hover transition-colors"
                                >
                                    Close
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={() => handleSave('display')}
                                    disabled={isSaving}
                                    className="inline-flex items-center gap-1.5 h-9 px-5 rounded-[10px] bg-gradient-to-b from-brand-400 to-brand-600 text-white text-[12.5px] font-semibold shadow-[0_4px_12px_rgba(240,112,31,0.28)] hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-50"
                                >
                                    {savingAction === 'display' && <Loader2 size={14} className="animate-spin" />}
                                    Save and display
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSave('return')}
                                    disabled={isSaving}
                                    className="inline-flex items-center gap-1.5 h-9 px-5 rounded-[10px] bg-white border border-ink-200 text-body text-[12.5px] font-semibold hover:bg-row-hover active:scale-[0.98] transition-all disabled:opacity-50"
                                >
                                    {savingAction === 'return' && <Loader2 size={14} className="animate-spin" />}
                                    Save and return
                                </button>
                                <button
                                    type="button"
                                    onClick={onBack}
                                    disabled={isSaving}
                                    className="h-9 px-4 rounded-[10px] text-[12.5px] font-medium text-subtle hover:text-heading hover:bg-row-hover transition-colors disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                            </>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
