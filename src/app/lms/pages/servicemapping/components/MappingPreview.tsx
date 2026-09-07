"use client"

import React, { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, ChevronRight, GraduationCap, Layers, Pencil } from 'lucide-react'

// Shown inside the Map Service wizard after a successful FULL save, in place of
// the form. It renders exactly what the wizard just sent — the wizard digests
// its own state into one of the three shapes below — so the reader confirms the
// hierarchy at a glance and either goes back to Modify or closes with Done.
//
// The visual language mirrors the Course Setup hierarchy picker: "Level : Value"
// labels, a type scale that steps down per DEPTH (not per level name), and no
// connector rails — indentation alone carries depth.
const SIZE = {
    depth1: 'text-lg',   // Degree / Batch / mapping-level Phase
    depth2: 'text-md',   // Department / batch-level Phase / course under a Phase
    depth3: 'text-base', // Section / Semester
    course: 'text-base',
}

export type MappingPreviewProps = {
    clientName: string
    service: string
    modelName: string
    year: string
    // one of the shapes below, pre-digested by the wizard:
    degree?: {
        name: string; startYear: string; endYear: string
        departments: Array<{
            name: string
            sections: Array<{
                name: string | null   // null = department has no sections
                semesters: Array<{
                    semester: string
                    courses: Array<{ category: string; courseName: string; batches: string[] }>
                }>
            }>
        }>
    }
    batches?: Array<{
        name: string
        // PRT department mode ties each batch to a degree and departments —
        // shown under the batch, since that assignment is the mode's whole point.
        degree?: string
        departments?: string[]
        phases: Array<{
            name: string | null      // null = batch has no phases
            courses: Array<{ category: string; courseName: string }>
        }>
    }>
    flatCourses?: Array<{ category: string; courseName: string }>
    // The new placement shape: mapping-level phases, each carrying exactly one
    // course, whose batches live on the course. A null name is the zero-phase
    // mapping — the course renders directly, with no invented "Phase" level.
    // When this is provided the wizard passes neither `batches` nor
    // `flatCourses` for the mapping; the render below enforces that anyway so a
    // mixed call can never draw the same mapping twice.
    phasesTree?: Array<{
        name: string | null
        course: { category: string; courseName: string } | null
        batches: string[]
    }>
    onModify: () => void
    onDone: () => void
}

// "Degree : B.E" — naming the level means the tree reads without the reader
// having to infer depth from indentation alone.
function LevelLabel({ label, value, className }: { label: string; value: string; className: string }) {
    return (
        <span className={`${className} font-bold text-heading truncate`}>
            <span className="text-faint font-semibold">{label} : </span>
            {value}
        </span>
    )
}

function CourseCount({ n }: { n: number }) {
    return (
        <span className="text-xs text-faint flex-shrink-0 tabular-nums">
            {n} course{n !== 1 ? 's' : ''}
        </span>
    )
}

// Post-validation a saved level always has children, but the preview must never
// crash on a shape it did not expect — an empty list renders as a quiet dash.
function EmptyRow({ text }: { text: string }) {
    return <p className="text-sm text-faint py-1.5 pl-1">— {text}</p>
}

function Collapsible({
    header,
    children,
}: {
    header: React.ReactNode
    children: React.ReactNode
}) {
    // Default OPEN: this is a confirmation glance, not an editor — the reader
    // should see the whole structure without clicking anything.
    const [open, setOpen] = useState(true)
    return (
        <div>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="flex items-center gap-2 h-9 text-left min-w-0 w-full"
                aria-expanded={open}
            >
                <ChevronRight
                    size={17}
                    strokeWidth={3}
                    className={`text-brand-500 flex-shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
                />
                {header}
            </button>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.16 }}
                        className="overflow-hidden"
                    >
                        <div className="pl-5">{children}</div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

function CourseRow({ category, courseName, batches }: { category: string; courseName: string; batches?: string[] }) {
    return (
        <div className="py-2 pl-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
                <span className={`${SIZE.course} font-semibold text-heading truncate`}>
                    {courseName || '—'}
                </span>
                {category && (
                    <span className="inline-flex items-center h-[22px] px-2 rounded-chip bg-ink-100 text-ink-500 text-xs font-medium">
                        {category}
                    </span>
                )}
            </div>
            {/* Only when the course runs batch-wise inside a semester — named
                inline rather than becoming an extra tree level. */}
            {batches && batches.length > 0 && (
                <p className="text-xs text-faint mt-0.5 truncate">
                    Batches: {batches.join(', ')}
                </p>
            )}
        </div>
    )
}

// The new placement shape's leaf: one course, its category muted beside it,
// and its batch names as chips. Chips rather than a comma list because in this
// shape the batches ARE the structure being confirmed, not a footnote.
function PhaseCourse({
    course,
    batches,
    size,
}: {
    course: { category: string; courseName: string } | null
    batches: string[]
    size: string
}) {
    if (!course) return <EmptyRow text="No course" />
    return (
        <div className="py-2 pl-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
                <LevelLabel label="Course" value={course.courseName || '—'} className={size} />
                {course.category && (
                    <span className="inline-flex items-center h-[22px] px-2 rounded-chip bg-ink-100 text-ink-500 text-xs font-medium">
                        {course.category}
                    </span>
                )}
            </div>
            {batches.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                    <span className="text-xs text-faint font-semibold">Batches :</span>
                    {batches.map((b, bi) => (
                        <span
                            key={`${b}-${bi}`}
                            className="inline-flex items-center h-[22px] px-2 rounded-chip bg-brand-50 text-brand-700 text-xs font-medium"
                        >
                            {b || '—'}
                        </span>
                    ))}
                </div>
            )}
        </div>
    )
}

export default function MappingPreview({
    clientName,
    service,
    modelName,
    year,
    degree,
    batches,
    flatCourses,
    phasesTree,
    onModify,
    onDone,
}: MappingPreviewProps) {
    const contextLine = [clientName, service, modelName, year].filter(Boolean).join(' · ')
    const yearRange = degree && (degree.startYear || degree.endYear)
        ? [degree.startYear, degree.endYear].filter(Boolean).join(' – ')
        : ''
    // The same context, as labelled chips — a confirmation screen names its
    // subject rather than running it into one dotted line.
    const metaChips: Array<{ label: string; value: string }> = [
        { label: 'Client', value: clientName },
        { label: 'Service', value: service },
        { label: 'Model', value: modelName },
        { label: 'Year', value: year },
    ].filter((c) => Boolean(c.value))

    return (
        <div className="flex flex-col h-full min-h-0">
            {/* Confirmation header: the green check says "it saved"; the chips
                name exactly which mapping the tree below belongs to. */}
            <div className="px-5 sm:px-6 py-4 border-b border-hairline flex-shrink-0 bg-surface">
                <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-full bg-success-50 border border-success-500/20 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 size={20} className="text-success-700" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-lg font-semibold text-heading leading-tight truncate">
                            Saved — review the structure
                        </h2>
                        {metaChips.length > 0 ? (
                            <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                                {metaChips.map((c) => (
                                    <span
                                        key={c.label}
                                        className="inline-flex items-center gap-1 h-[22px] px-2 rounded-chip bg-surface-sunken border border-hairline text-xs text-body"
                                        title={`${c.label}: ${c.value}`}
                                    >
                                        <span className="text-faint font-medium">{c.label}</span>
                                        <span className="font-semibold text-heading truncate max-w-[180px]">{c.value}</span>
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-subtle mt-0.5 truncate">{contextLine || '—'}</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-4 bg-surface-sunken">
                <div className="bg-surface rounded-xl border border-hairline shadow-xs px-4 py-3">
                    {degree && (
                        <Collapsible
                            header={
                                <span className="flex items-center gap-2 min-w-0">
                                    <GraduationCap size={18} className="text-brand-500 flex-shrink-0" />
                                    <LevelLabel label="Degree" value={degree.name || '—'} className={SIZE.depth1} />
                                    {yearRange && (
                                        <span className="text-xs text-faint flex-shrink-0 tabular-nums">{yearRange}</span>
                                    )}
                                </span>
                            }
                        >
                            {degree.departments.length === 0 && <EmptyRow text="No departments" />}
                            {degree.departments.map((dept, di) => (
                                <Collapsible
                                    key={`${dept.name}-${di}`}
                                    header={<LevelLabel label="Department" value={dept.name || '—'} className={SIZE.depth2} />}
                                >
                                    {dept.sections.length === 0 && <EmptyRow text="No semesters" />}
                                    {dept.sections.map((sec, si) => {
                                        const semesters = sec.semesters.length === 0
                                            ? <EmptyRow key="empty" text="No semesters" />
                                            : sec.semesters.map((sem, mi) => (
                                                <Collapsible
                                                    key={`${sem.semester}-${mi}`}
                                                    header={
                                                        <span className="flex items-baseline gap-2 min-w-0">
                                                            <LevelLabel label="Semester" value={sem.semester || '—'} className={SIZE.depth3} />
                                                            <CourseCount n={sem.courses.length} />
                                                        </span>
                                                    }
                                                >
                                                    {sem.courses.length === 0 && <EmptyRow text="No courses" />}
                                                    {sem.courses.map((c, ci) => (
                                                        <CourseRow key={`${c.courseName}-${ci}`} {...c} />
                                                    ))}
                                                </Collapsible>
                                            ))
                                        // A department without sections shows its semesters
                                        // directly — an empty "Section" level would
                                        // misrepresent what was saved.
                                        return sec.name ? (
                                            <Collapsible
                                                key={`${sec.name}-${si}`}
                                                header={<LevelLabel label="Section" value={sec.name} className={SIZE.depth3} />}
                                            >
                                                {semesters}
                                            </Collapsible>
                                        ) : (
                                            <React.Fragment key={`no-section-${si}`}>{semesters}</React.Fragment>
                                        )
                                    })}
                                </Collapsible>
                            ))}
                        </Collapsible>
                    )}

                    {/* The new placement shape. Phase headers reuse the batch
                        header's visual weight — both are the depth-1 grouping of
                        their flow — and a zero-phase mapping shows its single
                        course directly, the same "no empty levels" rule the
                        degree and batch trees follow. */}
                    {phasesTree && phasesTree.map((p, pi) => (
                        p.name ? (
                            <Collapsible
                                key={`${p.name}-${pi}`}
                                header={
                                    <span className="flex items-center gap-2 min-w-0">
                                        <Layers size={17} className="text-brand-500 flex-shrink-0" />
                                        <LevelLabel label="Phase" value={p.name} className={SIZE.depth1} />
                                    </span>
                                }
                            >
                                {/* The phase name IS the course name in this shape,
                                    so repeating it as a "Course :" line said the
                                    same thing twice — only the batches remain to
                                    confirm under the phase. */}
                                {p.course && p.course.courseName.trim().toLowerCase() === p.name.trim().toLowerCase() ? (
                                    p.batches.length > 0 ? (
                                        <div className="flex items-center gap-1.5 flex-wrap py-2 pl-1">
                                            <span className="text-xs text-faint font-semibold">Batches :</span>
                                            {p.batches.map((b, bi) => (
                                                <span
                                                    key={`${b}-${bi}`}
                                                    className="inline-flex items-center h-[22px] px-2 rounded-chip bg-brand-50 text-brand-700 border border-brand-200 text-xs font-medium"
                                                >
                                                    {b}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <EmptyRow text="No batches" />
                                    )
                                ) : (
                                    <PhaseCourse course={p.course} batches={p.batches} size={SIZE.depth2} />
                                )}
                            </Collapsible>
                        ) : (
                            <PhaseCourse
                                key={`no-phase-${pi}`}
                                course={p.course}
                                batches={p.batches}
                                size={SIZE.depth1}
                            />
                        )
                    ))}

                    {/* Never alongside phasesTree: both read from the same saved
                        mapping, so drawing both would show it twice. */}
                    {!phasesTree && batches && batches.map((b, bi) => (
                        <Collapsible
                            key={`${b.name}-${bi}`}
                            header={
                                <span className="flex items-center gap-2 min-w-0">
                                    <Layers size={17} className="text-brand-500 flex-shrink-0" />
                                    <LevelLabel label="Batch" value={b.name || '—'} className={SIZE.depth1} />
                                    {/* A phase-less batch is itself the leaf, so it
                                        carries the count a phase would otherwise.
                                        Only when courses actually live on batches —
                                        in the flat flows they deliberately don't,
                                        and "0 courses" there would read as data
                                        loss on a mapping that saved fine. */}
                                    {flatCourses === undefined && b.phases.length === 1 && b.phases[0].name === null && (
                                        <CourseCount n={b.phases[0].courses.length} />
                                    )}
                                </span>
                            }
                        >
                            {(b.degree || b.departments?.length) && (
                                <p className="text-sm text-subtle mb-1.5">
                                    <span className="text-faint font-semibold">Degree : </span>
                                    {b.degree || '—'}
                                    {b.departments?.length ? (
                                        <span className="text-faint"> · {b.departments.join(', ')}</span>
                                    ) : null}
                                </p>
                            )}
                            {flatCourses === undefined && b.phases.length === 0 && <EmptyRow text="No courses" />}
                            {b.phases.map((p, pi) => {
                                const rows = p.courses.length === 0
                                    ? (flatCourses === undefined ? <EmptyRow key="empty" text="No courses" /> : null)
                                    : p.courses.map((c, ci) => (
                                        <CourseRow key={`${c.courseName}-${ci}`} {...c} />
                                    ))
                                return p.name ? (
                                    <Collapsible
                                        key={`${p.name}-${pi}`}
                                        header={
                                            <span className="flex items-baseline gap-2 min-w-0">
                                                <LevelLabel label="Phase" value={p.name} className={SIZE.depth2} />
                                                {flatCourses === undefined && <CourseCount n={p.courses.length} />}
                                            </span>
                                        }
                                    >
                                        {rows}
                                    </Collapsible>
                                ) : (
                                    // A batch with no phases shows its courses directly —
                                    // an empty "Phase" level would invent structure the
                                    // mapping doesn't have.
                                    <React.Fragment key={`no-phase-${pi}`}>{rows}</React.Fragment>
                                )
                            })}
                        </Collapsible>
                    ))}

                    {/* CSR/COE-style flows keep a flat course list alongside (or
                        instead of) batches; a divider separates the two readings
                        only when both are present. */}
                    {!phasesTree && flatCourses && flatCourses.length > 0 && (
                        <div className={batches && batches.length > 0 ? 'pt-3 mt-2 border-t border-hairline' : ''}>
                            <p className="text-2xs font-semibold uppercase tracking-wider text-faint pb-1">
                                Courses
                            </p>
                            {flatCourses.map((c, ci) => (
                                <CourseRow key={`${c.courseName}-${ci}`} {...c} />
                            ))}
                        </div>
                    )}

                    {!degree
                        && (!batches || batches.length === 0)
                        && (!flatCourses || flatCourses.length === 0)
                        && (!phasesTree || phasesTree.length === 0)
                        && <EmptyRow text="Nothing to show" />}
                </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 px-5 sm:px-6 py-3.5 border-t border-hairline flex-shrink-0 bg-surface">
                <button
                    type="button"
                    onClick={onModify}
                    className="inline-flex items-center gap-1.5 h-9 px-4 rounded-control bg-surface border border-hairline-strong text-ink-700 text-sm font-semibold hover:bg-row-hover transition-colors"
                >
                    <Pencil size={14} /> Modify
                </button>
                <button
                    type="button"
                    onClick={onDone}
                    className="inline-flex items-center gap-1.5 h-9 px-5 rounded-control bg-brand-700 text-white text-sm font-semibold shadow-sm hover:bg-brand-800 transition-colors"
                >
                    <CheckCircle2 size={15} /> Done
                </button>
            </div>
        </div>
    )
}
