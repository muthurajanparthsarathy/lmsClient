"use client"

// Degree Program ▸ Courses & Student Groups: one department at a time, read top
// to bottom, with no boxes inside boxes.
//
//   [CSE ✓] [ECE] [Mechanical]                          Semester [3 ▾]
//   ────────────────────────────────────────────────────────────────────
//   Courses for CSE                                          ← row 1
//     1 [Data Structures ▾]  🗑        common to every section below
//     + Add course
//   ────────────────────────────────────────────────────────────────────
//   Sections & batches in CSE  (optional)                    ← row 2
//     Section   Batches
//     [A]       [Batch 1 ×] [Batch 2 ×]  + Add batch    🗑
//     + Add section
//   ────────────────────────────────────────────────────────────────────
//   ✓ Section A · Batch 1, Section A · Batch 2 each take 1 course…
//
// Courses belong to the DEPARTMENT (per semester) and every section and batch
// takes all of them, so the course list comes first and the student groups sit
// under it rather than beside it. Data flow, validation keys, the view-only
// lock and the jump-to-first-error behaviour are unchanged.

import React, { useEffect, useState } from 'react'
import { CircleAlert, Check, Lock, Plus, Trash2, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ListSelect } from '../shared/ListSelect'
import { FieldError, inputCls } from '../shared/primitives'
import SemesterEditor from './SemesterEditor'
import { SettingsHelp } from '@/app/lms/component/ExerciseSettings/SettingsHelp'
import { PATH_SEP, type CourseApi, type DegreeView } from './types'
import { departmentSemesterPath, nextSectionName, sectionLabel, type StudentGroupStore, type StudentSection } from './studentGroups'

type Props = {
    degree: DegreeView
    courseApi: CourseApi
    editableSemester: string | null
    groups: StudentGroupStore
    onChangeGroups: (path: string, sections: StudentSection[]) => void
    onRemoveLegacySection: (path: string) => void
    fieldErrors: Record<string, string>
}

const addLink = 'inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#C2540F] hover:underline disabled:opacity-50 disabled:no-underline'
const trash = 'p-1.5 rounded-md text-[#98a2b3] hover:text-danger-700 hover:bg-danger-50 disabled:opacity-50'
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const countPill = 'rounded-full bg-[#f2f4f7] px-2 py-0.5 text-[11px] font-semibold text-[#475467]'
const colHead = 'text-[11.5px] font-semibold uppercase tracking-wide text-[#667085]'

/** A row's title line: heading, ⓘ, an optional tag, and a count on the right. */
function RowHeading({ title, help, tag, count }: { title: string; help: string; tag?: string; count: string }) {
    return (
        <div className="flex items-center gap-1.5">
            <h4 className="text-[14px] font-semibold text-heading">{title}</h4>
            <SettingsHelp content={help} />
            {tag && <span className="text-[12px] font-medium text-[#98a2b3]">{tag}</span>}
            <span className={`ml-auto ${countPill}`}>{count}</span>
        </div>
    )
}

export default function DegreeWorkbench({ degree, courseApi, editableSemester, groups, onChangeGroups, onRemoveLegacySection, fieldErrors }: Props) {
    const [selection, setSelection] = useState({ department: '', semester: '' })
    const department = degree.departments.includes(selection.department) ? selection.department : degree.departments[0] || ''
    // Opens on the semester that can actually be edited; any other one is
    // view only, so landing there first would only show a lock.
    const semester = degree.semesters.includes(selection.semester)
        ? selection.semester
        : editableSemester && degree.semesters.includes(editableSemester) ? editableSemester : degree.semesters.at(-1) || ''
    const path = departmentSemesterPath(degree.name, department, semester)
    const sections = groups[path] || []
    const courses = courseApi.coursesAt(path)
    const readOnly = semester !== editableSemester
    const legacyPath = (section: string) => [degree.name, department, section, semester].join(PATH_SEP)
    const pathHasError = (dept: string, sem: string) => {
        const p = departmentSemesterPath(degree.name, dept, sem)
        return Object.keys(fieldErrors).some((key) => key.startsWith(`groups:${p}:`) || key.startsWith(`sem:${p}:`)
            || degree.sectionsFor(dept).some((section) => key.startsWith(`sem:${[degree.name, dept, section, sem].join(PATH_SEP)}:`)))
    }
    const invalidPath = degree.departments.flatMap((dept) => degree.semesters.map((sem) => ({ department: dept, semester: sem })))
        .find((item) => pathHasError(item.department, item.semester))
    const errorSelection = invalidPath ? JSON.stringify([invalidPath.department, invalidPath.semester]) : ''
    useEffect(() => {
        if (errorSelection) {
            const [department, semester] = JSON.parse(errorSelection) as string[]
            setSelection({ department, semester })
        }
    }, [errorSelection])
    const updateSection = (index: number, patch: Partial<StudentSection>) =>
        onChangeGroups(path, sections.map((section, i) => i === index ? { ...section, ...patch } : section))

    if (!department || !semester) return <div className="rounded-lg border border-dashed border-hairline-strong bg-surface-sunken p-8 text-center text-sm text-subtle">Choose a department and semester above to build the service layout.</div>

    const namedCourses = courses.filter((c) => c.courseName).length
    const groupNames = sections.length === 0
        ? ['All students']
        : sections.flatMap((s) => s.batches.length
            ? s.batches.map((b) => `${sectionLabel(s.name || '…')} · ${b || 'batch'}`)
            : [sectionLabel(s.name || '…')])

    // The semester picker's rows say, in words, what each semester is: the one
    // being set up, a view-only earlier one, or one that needs attention.
    const semesterOptions = degree.semesters.map((sem) => {
        const done = courseApi.coursesAt(departmentSemesterPath(degree.name, department, sem)).some((c) => c.courseName)
        const state = pathHasError(department, sem)
            ? 'Needs attention'
            : sem === editableSemester ? 'Current · editable' : 'View only'
        return {
            value: sem,
            label: `Semester ${sem}`,
            description: done ? `${state} · courses added` : state,
        }
    })

    return (
        <div data-tour="sm-workbench">
            {/* ── Department tabs, with the semester on the same line ── */}
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-[#eaecf0]">
                <div role="tablist" aria-label="Departments" className="flex flex-wrap gap-1">
                    {degree.departments.map((dept) => {
                        const active = department === dept
                        const deptError = degree.semesters.some((sem) => pathHasError(dept, sem))
                        const deptDone = degree.semesters.every((sem) => courseApi.coursesAt(departmentSemesterPath(degree.name, dept, sem)).some((c) => c.courseName))
                        return (
                            <button key={dept} type="button" role="tab" aria-selected={active}
                                onClick={() => setSelection({ department: dept, semester: degree.semesters.includes(semester) ? semester : '' })}
                                className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-[13.5px] font-semibold transition-colors ${active
                                    ? 'border-[#EE6A22] text-[#C2540F]'
                                    : 'border-transparent text-[#667085] hover:border-[#d0d5dd] hover:text-[#344054]'}`}>
                                {dept}
                                {deptError ? <CircleAlert size={14} className="text-danger-700" aria-label="Has errors" />
                                    : deptDone ? <Check size={14} strokeWidth={3} className="text-success-700" aria-label="Set up" /> : null}
                            </button>
                        )
                    })}
                </div>
                <div className="flex items-center gap-2 pb-1.5">
                    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#475467]">
                        Semester
                        <SettingsHelp content="Semesters are set up one at a time. The current one can be edited; earlier ones are view only (🔒)." />
                    </span>
                    <div className="w-[170px]">
                        <ListSelect
                            value={semester}
                            options={semesterOptions}
                            onChange={(sem) => { if (sem) setSelection({ department, semester: sem }) }}
                            placeholder="Semester…"
                            emptyLabel="No semesters chosen yet."
                            ariaLabel={`${department} semester`}
                            className="w-full"
                        />
                    </div>
                </div>
            </div>

            {readOnly && (
                <p className="mt-3 flex items-center gap-1.5 rounded-md bg-warn-50 px-3 py-2 text-[12.5px] font-medium text-warn-700">
                    <Lock size={13} className="shrink-0" />
                    Semester {semester} is view only.{editableSemester ? ` Only Semester ${editableSemester}, the current one, can be edited.` : ''}
                </p>
            )}

            <fieldset disabled={readOnly} className="m-0 min-w-0 border-0 p-0">
                {/* ── Row 1: the department's courses ── */}
                <section aria-label="Courses for this semester" className="py-4">
                    <RowHeading
                        title={`Courses for ${department}`}
                        help="Pick the courses this department teaches in the semester. They are common to the whole department: every section and batch below studies all of them."
                        tag={`Semester ${semester}`}
                        count={plural(namedCourses, 'course')}
                    />
                    <p className="mt-0.5 text-[12px] text-[#667085]">
                        Common to every section and batch in {department}. There are no separate courses per section.
                    </p>
                    <div className="mt-3 max-w-[640px] space-y-2">
                        {courses.map((course, i) => {
                            const options = Array.from(new Set([course.courseName, ...courseApi.allCourseNames].filter(Boolean)))
                            return <div key={i} data-tour={i === 0 ? 'sm-course-row' : undefined}>
                                <div className="flex items-center gap-2">
                                    <span className="w-5 shrink-0 text-right text-[12px] tabular-nums text-[#98a2b3]">{i + 1}</span>
                                    <div className="min-w-0 flex-1"><ListSelect value={course.courseName} options={options.map((name) => ({ value: name, label: name }))}
                                        onChange={(courseName) => courseApi.update(path, i, { courseName })} disabled={readOnly}
                                        placeholder="Choose a course…" ariaLabel={`Course ${i + 1}`} searchPlaceholder="Search courses…"
                                        emptyLabel="No courses configured in Course Management." invalid={Boolean(courseApi.errorAt(path, i, 'courseName'))} /></div>
                                    <button type="button" aria-label={`Remove course ${i + 1}`} title="Remove" onClick={() => courseApi.removeAt(path, i)} className={trash}><Trash2 size={15} /></button>
                                </div>
                                <div className="pl-7"><FieldError message={courseApi.errorAt(path, i, 'courseName')} /></div>
                                {course.batchesEnabled && <details className="mt-2 pl-7"><summary className="cursor-pointer text-xs text-subtle">Existing course batches</summary>
                                    {course.batches.map((batch, bi) => <div key={bi} className="mt-2"><Input value={batch} className={inputCls} aria-label={`Course ${i + 1} batch ${bi + 1}`} onChange={(e) => courseApi.setBatchName(path, i, bi, e.target.value)} /><FieldError message={courseApi.batchErrorAt(path, i, bi)} /></div>)}
                                </details>}
                            </div>
                        })}
                        {!courses.length && <p className="pl-7 text-[12.5px] text-[#667085]">No courses yet. Add the first one.</p>}
                        <div className="pl-7">
                            <button type="button" disabled={courses.length >= 20} onClick={() => courseApi.setCount(path, courses.length + 1)} className={addLink} title={`Add another course to ${department}`}><Plus size={14} />Add course</button>
                        </div>
                    </div>
                </section>

                {/* ── Row 2: how the department's students are split ── */}
                <section aria-label="Sections and batches" data-tour="sm-sections" className="border-t border-[#eaecf0] py-4">
                    <RowHeading
                        title={`Sections & batches in ${department}`}
                        help="Optional. Add a section (A, B…) for each class group, and batches inside a section to split it further, e.g. for labs. Leave empty if everyone studies together."
                        tag="Optional"
                        count={plural(sections.length, 'section')}
                    />
                    <p className="mt-0.5 text-[12px] text-[#667085]">How {department} students are grouped in Semester {semester}. Each group takes all the courses above.</p>

                    {sections.length > 0 && (
                        <div className="mt-3 max-w-[860px]">
                            <div className="grid grid-cols-[112px_minmax(0,1fr)_32px] items-center gap-3 border-b border-[#eaecf0] pb-1.5">
                                <span className={colHead}>Section</span>
                                <span className={colHead}>Batches</span>
                                <span />
                            </div>
                            {sections.map((section, i) => {
                                const key = `groups:${path}:${i}`
                                const existingCourses = courseApi.coursesAt(legacyPath(section.name))
                                const batchErrors = section.batches.map((_, bi) => fieldErrors[`${key}:batch:${bi}`]).filter(Boolean)
                                return <div key={i} className="border-b border-[#f2f4f7] py-2.5">
                                    <div className="grid grid-cols-[112px_minmax(0,1fr)_32px] items-start gap-3">
                                        <Input id={`section-${i}`} value={section.name} aria-label={`Section ${i + 1} name`} readOnly={existingCourses.length > 0}
                                            title="A short name such as A, B or Morning" placeholder="A"
                                            onChange={(e) => updateSection(i, { name: e.target.value })} className={inputCls} aria-invalid={Boolean(fieldErrors[`${key}:name`])} />
                                        <div className="flex min-h-9 flex-wrap items-center gap-2">
                                            {section.batches.map((batch, bi) => (
                                                <span key={bi} className="inline-flex items-center gap-0.5">
                                                    <Input value={batch} aria-label={`${sectionLabel(section.name)} batch ${bi + 1}`} className={`${inputCls} !w-28`} aria-invalid={Boolean(fieldErrors[`${key}:batch:${bi}`])}
                                                        onChange={(e) => updateSection(i, { batches: section.batches.map((b, n) => n === bi ? e.target.value : b) })} />
                                                    <button type="button" aria-label={`Remove batch ${bi + 1} from ${sectionLabel(section.name)}`} title="Remove batch"
                                                        onClick={() => updateSection(i, { batches: section.batches.filter((_, n) => n !== bi) })}
                                                        className="flex h-6 w-6 items-center justify-center rounded-full text-[#98a2b3] hover:bg-danger-50 hover:text-danger-700"><X size={13} /></button>
                                                </span>
                                            ))}
                                            {!section.batches.length && <span className="text-[12.5px] text-[#98a2b3]">No batches: the whole section studies together.</span>}
                                            <button type="button" disabled={section.batches.length >= 20} onClick={() => {
                                                let n = 1
                                                while (section.batches.some((b) => b.trim().toLowerCase() === `batch ${n}`)) n++
                                                updateSection(i, { batches: [...section.batches, `Batch ${n}`] })
                                            }} className={addLink} title={`Add a batch inside ${sectionLabel(section.name || '…')}`}><Plus size={13} />Add batch</button>
                                        </div>
                                        <button type="button" aria-label={`Remove ${sectionLabel(section.name)}`} title={`Remove ${sectionLabel(section.name)} and its batches`} onClick={() => { onChangeGroups(path, sections.filter((_, si) => si !== i)); onRemoveLegacySection(legacyPath(section.name)) }} className={`${trash} mt-1`}><Trash2 size={15} /></button>
                                    </div>
                                    <FieldError message={fieldErrors[`${key}:name`]} />
                                    {batchErrors.length > 0 && <FieldError message={batchErrors[0]} />}
                                    {/* Mappings saved before courses moved up to the
                                        department could hold courses on a section.
                                        They still load, save and validate here; new
                                        courses go in the department list above. */}
                                    {existingCourses.length > 0 && <details className="mt-2" open={Object.keys(fieldErrors).some((k) => k.startsWith(`sem:${legacyPath(section.name)}:`)) || undefined}>
                                        <summary className="cursor-pointer text-xs font-medium text-subtle">Older courses saved on {sectionLabel(section.name)} ({existingCourses.length})</summary>
                                        <p className="mt-1 text-[11.5px] text-[#98a2b3]">Saved before courses were set per department. Add new courses in the list above.</p>
                                        <div className="mt-3"><SemesterEditor path={legacyPath(section.name)} courseApi={courseApi} /></div>
                                    </details>}
                                </div>
                            })}
                        </div>
                    )}
                    {!sections.length && <p className="mt-3 text-[12.5px] text-[#667085]">No sections: everyone in {department} studies together.</p>}
                    <div className="mt-3">
                        <button type="button" disabled={sections.length >= 26} onClick={() => onChangeGroups(path, [...sections, { name: nextSectionName(sections), batches: [] }])} className={addLink} title="Add a section such as A, B, C"><Plus size={14} />Add section</button>
                    </div>
                </section>
            </fieldset>

            {/* ── The result, in one sentence ── */}
            <p className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-[12.5px] ${namedCourses ? 'bg-success-50 text-success-700' : 'bg-[#f2f4f7] text-[#667085]'}`}>
                {namedCourses ? <Check size={15} strokeWidth={3} className="mt-px shrink-0" /> : <CircleAlert size={15} className="mt-px shrink-0" />}
                <span>
                    {namedCourses
                        ? <><b>{groupNames.join(', ')}</b> {sections.length === 0 ? 'take' : groupNames.length === 1 ? 'takes' : 'each take'} {plural(namedCourses, 'course')} in {department} · Semester {semester}.</>
                        : <>Add at least one course for {department} · Semester {semester}.</>}
                </span>
            </p>
        </div>
    )
}
