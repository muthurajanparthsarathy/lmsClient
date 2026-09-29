"use client"

// The Map Service form's right-hand live preview, the counterpart of the
// assignment editor's SettingsPreview pane and drawn with the same
// classes (AssignmentSettings.module.css: previewPane / previewCard / …).
//
// It reads the SAME digest the post-save MappingPreview does
// (buildPreviewModel in the wizard), so the pane shows what Save would write:
// empty course names and unticked batches are already filtered out, and
// nothing here re-derives the structure a second way.

import React from 'react'
import { Building, GraduationCap, Layers, ListTree } from 'lucide-react'
import es from '@/app/lms/component/ExerciseSettings/AssignmentSettings.module.css'
import type { MappingPreviewProps } from './MappingPreview'

type Model = Pick<MappingPreviewProps, 'degree' | 'batches' | 'flatCourses' | 'phasesTree'>

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export default function LiveMappingPreview({
    clientName, businessModel, serviceModel, offeringDate, partners, model, ready,
}: {
    clientName: string
    businessModel: string
    serviceModel: string
    offeringDate: string
    partners: string[]
    model: Model
    /** False until a client and service are chosen: the structure has nothing to show yet. */
    ready: boolean
}) {
    // ── Headline numbers, per layout ──
    const degree = model.degree
    const phasesTree = model.phasesTree
    let stats: { value: number; label: string }[]
    if (degree) {
        const sems = degree.departments[0]?.semesters.length ?? 0
        const courses = degree.departments.reduce((n, d) => n + d.semesters.reduce((m, s) => m + s.courses.length, 0), 0)
        stats = [
            { value: degree.departments.length, label: 'Departments' },
            { value: sems, label: 'Semesters' },
            { value: courses, label: 'Courses' },
        ]
    } else if (phasesTree) {
        const phased = phasesTree.filter((p) => p.name).length
        stats = [
            { value: phasesTree.filter((p) => p.course).length ? 1 : 0, label: 'Course' },
            { value: phased, label: 'Phases' },
            { value: phasesTree.reduce((n, p) => n + p.batches.length, 0), label: 'Batches' },
        ]
    } else {
        stats = [
            { value: model.flatCourses?.length ?? 0, label: 'Courses' },
            { value: model.batches?.length ?? 0, label: 'Batches' },
            { value: partners.length, label: 'Partners' },
        ]
    }

    const tags = [businessModel, serviceModel].filter(Boolean)

    return (
        <aside className={`${es.previewPane} min-h-0 flex-1 !border-l-0`} aria-label="Live preview">
            <div className={es.previewCard}>
                <div className={es.previewEyebrow}>LIVE PREVIEW</div>
                <h2>{clientName || 'No client selected'}</h2>
                <p className={es.previewLocation}>Service Mapping{serviceModel ? ` › ${serviceModel}` : ''}</p>
                {tags.length > 0 && (
                    <div className={es.previewTags}>{tags.map((t) => <span key={t}>{t}</span>)}</div>
                )}

                <div className={es.previewStats}>
                    {stats.map((s) => (
                        <div key={s.label}><strong>{s.value}</strong><span>{s.label}</span></div>
                    ))}
                </div>

                <section className={es.previewSection}>
                    <h3><Building size={13} /> Details</h3>
                    <dl className={es.previewDetails}>
                        <div><dt>Business model</dt><dd>{businessModel || '—'}</dd></div>
                        <div><dt>Client</dt><dd>{clientName || '—'}</dd></div>
                        {serviceModel && <div><dt>Service model</dt><dd>{serviceModel}</dd></div>}
                        <div><dt>Offering date</dt><dd>{offeringDate || '—'}</dd></div>
                        {partners.length > 0 && <div><dt>Partners</dt><dd>{partners.join(', ')}</dd></div>}
                    </dl>
                </section>

                <section className={es.previewSection}>
                    <h3>{degree ? <GraduationCap size={13} /> : phasesTree ? <Layers size={13} /> : <ListTree size={13} />} Structure</h3>
                    {!ready ? (
                        <p className={es.previewPlaceholder}>Choose a client and service to see the layout take shape here.</p>
                    ) : degree ? (
                        degree.name ? (
                            <div className="space-y-2 text-[11.5px] leading-relaxed text-[#263746]">
                                <p className="font-semibold">
                                    {degree.name}
                                    {degree.startYear && <span className="font-normal text-[#7b8796]"> · {degree.startYear}{degree.endYear ? ` – ${degree.endYear}` : ''}</span>}
                                </p>
                                {degree.departments.length === 0 && <p className={es.previewPlaceholder}>No departments picked yet.</p>}
                                {degree.departments.map((dept) => (
                                    <div key={dept.name} className="border-l-2 border-[#FDF0E9] pl-2.5">
                                        <p className="font-medium">{dept.name}</p>
                                        {dept.semesters.map((sem) => (
                                            <p key={sem.semester} className="text-[#536578]">
                                                {sem.semester}
                                                <span className="text-[#7b8796]">
                                                    {' · '}{plural(sem.courses.length, 'course')}
                                                    {sem.studentGroups.length > 0 && ` · ${plural(sem.studentGroups.length, 'section')}`}
                                                </span>
                                            </p>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        ) : <p className={es.previewPlaceholder}>Pick a programme to start the degree layout.</p>
                    ) : phasesTree ? (
                        <div className="space-y-2 text-[11.5px] leading-relaxed text-[#263746]">
                            {phasesTree.map((p, i) => (
                                <div key={`${p.name}-${i}`} className={p.name ? 'border-l-2 border-[#FDF0E9] pl-2.5' : ''}>
                                    {p.name && <p className="font-medium">{p.name}</p>}
                                    <p className="text-[#536578]">{p.course?.courseName || <span className="text-[#929dad]">No course yet</span>}</p>
                                    {p.batches.length > 0 && <p className="text-[#7b8796]">{p.batches.join(' · ')}</p>}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-2 text-[11.5px] leading-relaxed text-[#263746]">
                            {(model.flatCourses?.length ?? 0) === 0
                                ? <p className={es.previewPlaceholder}>No course picked yet.</p>
                                : model.flatCourses!.map((c) => (
                                    <p key={`${c.category}-${c.courseName}`}>
                                        <span className="font-medium">{c.courseName}</span>
                                        {c.category && <span className="text-[#7b8796]"> · {c.category}</span>}
                                    </p>
                                ))}
                            {(model.batches?.length ?? 0) > 0 && (
                                <p className="text-[#7b8796]">{model.batches!.map((b) => b.name).join(' · ')}</p>
                            )}
                        </div>
                    )}
                </section>

                <p className={es.previewFootnote}>Updates as you fill the form. This is what Save will create.</p>
            </div>
        </aside>
    )
}
