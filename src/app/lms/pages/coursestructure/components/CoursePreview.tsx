"use client"

import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
    Bot, ChevronRight, Eye, FileText,
    GraduationCap, Link2, Pencil, Presentation, Sparkles, StickyNote,
    User, UserCheck, Users, Video, X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { fetchCourseStructureById } from '@/app/lms/pages/coursestructure/api/createCourseStucture'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSION_IDS } from '@/app/lms/pages/usermanagement/components/permissions/index'

// "Save and display" lands here: the SAVED record rendered the way a student
// will meet it — hero, schedule, description, pedagogy — instead of the
// read-only settings form. It refetches by id rather than trusting form state,
// because the stored document is the truth the student will actually see.

export type CoursePreviewProps = {
    courseId: string
    fallbackName: string
    onEdit: () => void
    onClose: () => void
}

// The API returns an untyped Mongo document, so every field is read through a
// narrowing helper — a missing or mistyped field renders as absent, never throws.
type Rec = { [k: string]: unknown }

const asRecord = (v: unknown): Rec | null =>
    v && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : null
const asString = (v: unknown): string => (typeof v === 'string' ? v : '')
const asStringArray = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : []

const RESOURCE_META: Array<{ key: string; label: string; Icon: LucideIcon }> = [
    { key: 'video', label: 'Video', Icon: Video },
    { key: 'ppt', label: 'PPT', Icon: Presentation },
    { key: 'pdf', label: 'PDF', Icon: FileText },
    { key: 'url', label: 'URL', Icon: Link2 },
    { key: 'aiChat', label: 'AI Chat', Icon: Bot },
    { key: 'aiSummary', label: 'AI Summary', Icon: Sparkles },
    { key: 'notes', label: 'Notes', Icon: StickyNote },
]

const enabledResources = (resourcesType: Rec | null, stageKey: string) => {
    const stage = asRecord(resourcesType?.[stageKey])
    if (!stage) return []
    return RESOURCE_META.filter((meta) => asRecord(stage[meta.key])?.enabled === true)
}

const STAGES: Array<{ stageKey: string; field: string; title: string; blurb: string; Icon: LucideIcon }> = [
    { stageKey: 'iDo', field: 'I_Do', title: 'I Do', blurb: 'Your instructor shows the way', Icon: User },
    { stageKey: 'weDo', field: 'We_Do', title: 'We Do', blurb: 'Practise it together', Icon: Users },
    { stageKey: 'youDo', field: 'You_Do', title: 'You Do', blurb: 'Prove it on your own', Icon: UserCheck },
]

// The languages arrive already backend-flattened, but records from before the
// flat format nest them under programming.languages — read both.
const testLanguages = (rec: Rec): Array<{ group: string; items: string[] }> => {
    const cfg = asRecord(rec.testConfiguration)
    if (!cfg) return []
    const legacy = asRecord(asRecord(cfg.programming)?.languages)
    const source = legacy ?? cfg
    return [
        { group: 'Core', items: asStringArray(source.coreProgram) },
        { group: 'Frontend', items: asStringArray(source.frontend) },
        { group: 'Database', items: asStringArray(source.database) },
    ].filter((g) => g.items.length > 0)
}

const Chip = ({ children }: { children: React.ReactNode }) => (
    <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-brand-100 border border-brand-300 text-brand-700 text-[11.5px] font-semibold">
        {children}
    </span>
)

const SectionCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="bg-white rounded-2xl border border-hairline p-5 sm:p-6">
        <h2 className="text-[15px] font-semibold text-heading mb-4">{title}</h2>
        {children}
    </section>
)

const Skeleton = () => (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5 animate-pulse">
        <div className="bg-white rounded-2xl border border-hairline overflow-hidden">
            <div className="h-52 bg-surface-sunken" />
            <div className="p-6 space-y-3">
                <div className="h-7 w-2/3 rounded-lg bg-surface-sunken" />
                <div className="h-5 w-1/3 rounded-lg bg-surface-sunken" />
            </div>
        </div>
        <div className="bg-white rounded-2xl border border-hairline p-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-10 rounded-lg bg-surface-sunken" />)}
        </div>
        <div className="bg-white rounded-2xl border border-hairline p-6 space-y-3">
            <div className="h-5 w-40 rounded-lg bg-surface-sunken" />
            <div className="h-4 w-full rounded bg-surface-sunken" />
            <div className="h-4 w-5/6 rounded bg-surface-sunken" />
            <div className="h-4 w-3/4 rounded bg-surface-sunken" />
        </div>
    </div>
)

export default function CoursePreview({ courseId, fallbackName, onEdit, onClose }: CoursePreviewProps) {
    const [record, setRecord] = useState<Rec | null>(null)
    const [loading, setLoading] = useState(true)
    const [failed, setFailed] = useState(false)
    // The student preview reaches Edit through the top-bar button — same
    // functionality as the row's Edit Course, gated the same way.
    const { can } = usePermissions()
    const canEditCourse = can(PERMISSION_IDS.ADMIN_COURSE_MANAGEMENT, 'Edit Course')

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        setFailed(false)
        ;(async () => {
            try {
                const res: unknown = await fetchCourseStructureById(courseId)
                if (cancelled) return
                // Some endpoints wrap the document once ({data}) and some twice
                // ({data:{data}}); unwrap until a courseName-bearing object
                // appears. The name check is what stops an envelope-only body
                // (e.g. {message}) from being installed as a "record" and
                // rendering a successful page whose every section is empty.
                const outer = asRecord(res)
                const inner = asRecord(outer?.data)
                const doc = [asRecord(inner?.data), inner, outer]
                    .find((r) => r && typeof r.courseName === 'string') ?? null
                if (doc) setRecord(doc)
                else setFailed(true)
            } catch {
                if (!cancelled) setFailed(true)
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return () => { cancelled = true }
    }, [courseId])

    const rec = record ?? {}
    const name = asString(rec.courseName) || fallbackName
    const code = asString(rec.courseCode)
    const category = asString(rec.category)
    const level = asString(rec.courseLevel)
    const image = asString(rec.courseImage)
    const description = asString(rec.courseDescription)
    // TipTap leaves an empty paragraph behind when the admin typed nothing, so
    // "has a description" means text survives once the markup is stripped — OR
    // the markup itself is media: the editor can insert inline images, and an
    // image-only description is authored content a student page must show.
    // &nbsp; entities are collapsed first so a description of only them does
    // not render a near-empty About card.
    const hasDescription = /<(img|iframe|video)\b/i.test(description)
        || description.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim() !== ''
    const hierarchy = asStringArray(rec.courseHierarchy)
    const resourcesType = asRecord(rec.resourcesType)
    const languages = testLanguages(rec)

    // min-h-full, not min-h-screen: this renders inside the layout's scroll
    // pane, which is already viewport-minus-chrome — a 100vh floor would
    // overflow it by the header height and show a scrollbar on every preview,
    // even a short one.
    return (
        <div className="min-h-full w-full">
            {/* The bar stays outside the loading/error branches so Close (and Edit)
                keep working even when the fetch never comes back. */}
            <div className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-hairline">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-700 bg-brand-100 border border-brand-300 rounded-full h-7 px-3">
                        <Eye size={13} />
                        Student preview
                    </span>
                    <span className="text-[13px] text-subtle truncate hidden sm:block">{name}</span>
                    <div className="ml-auto flex items-center gap-2">
                        {canEditCourse && (
                            <button
                                type="button"
                                onClick={onEdit}
                                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[10px] bg-gradient-to-r from-brand-500 to-brand-400 text-white text-[13px] font-semibold shadow-sm hover:opacity-90 transition-opacity duration-200"
                            >
                                <Pencil size={14} />
                                Edit
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close preview"
                            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[10px] border border-hairline-strong bg-white text-body text-[13px] font-semibold hover:bg-row-hover transition-colors duration-200"
                        >
                            <X size={14} />
                            Close
                        </button>
                    </div>
                </div>
            </div>

            {loading ? (
                <Skeleton />
            ) : failed ? (
                <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
                    <div className="bg-white rounded-2xl border border-hairline p-8 text-center">
                        <p className="text-[15px] font-semibold text-heading">{fallbackName}</p>
                        <p className="text-[13px] text-subtle mt-1.5">
                            The saved course couldn&apos;t be loaded right now. Close the preview and try again.
                        </p>
                    </div>
                </div>
            ) : (
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22 }}
                    className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5"
                >
                    {/* HERO — the first thing a student sees on their course page. */}
                    <section className="bg-white rounded-2xl border border-hairline overflow-hidden">
                        {image ? (
                            <div
                                className="h-52 sm:h-64 bg-cover bg-center"
                                style={{ backgroundImage: `url(${JSON.stringify(image)})` }}
                                role="img"
                                aria-label={`${name} cover image`}
                            />
                        ) : (
                            <div className="h-40 sm:h-48 bg-gradient-to-br from-brand-100 via-brand-200 to-brand-300 flex items-center justify-center">
                                <GraduationCap size={56} className="text-brand-500 opacity-40" />
                            </div>
                        )}
                        <div className="p-5 sm:p-7">
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                                {category && <Chip>{category}</Chip>}
                                {level && <Chip>{level}</Chip>}
                            </div>
                            <h1 className="text-[24px] sm:text-[28px] font-semibold text-heading leading-tight">
                                {name}
                            </h1>
                            {code && <p className="text-[12.5px] text-faint mt-1.5">{code}</p>}
                        </div>
                    </section>

                    {hasDescription && (
                        <SectionCard title="About this course">
                            {/* The description is TipTap HTML the admin authored, so it is
                                rendered as-is; the cp-prose scope keeps its markup from
                                restyling anything outside this box. */}
                            <div className="cp-prose" dangerouslySetInnerHTML={{ __html: description }} />
                            <style>{`
                                .cp-prose { color: var(--body); font-size: 14px; line-height: 1.7; }
                                .cp-prose p { margin: 0 0 0.75em; }
                                .cp-prose p:last-child { margin-bottom: 0; }
                                .cp-prose h1, .cp-prose h2, .cp-prose h3, .cp-prose h4 {
                                    color: var(--heading); font-weight: 600; line-height: 1.35; margin: 1.1em 0 0.45em;
                                }
                                .cp-prose h1 { font-size: 20px; }
                                .cp-prose h2 { font-size: 17px; }
                                .cp-prose h3 { font-size: 15px; }
                                .cp-prose h4 { font-size: 14px; }
                                .cp-prose ul, .cp-prose ol { margin: 0 0 0.75em; padding-left: 1.4em; }
                                .cp-prose ul { list-style: disc; }
                                .cp-prose ol { list-style: decimal; }
                                .cp-prose li { margin: 0.2em 0; }
                                .cp-prose a { color: var(--color-brand-700); text-decoration: underline; }
                                .cp-prose strong { color: var(--heading); font-weight: 600; }
                                .cp-prose blockquote {
                                    border-left: 3px solid var(--color-brand-300); padding-left: 0.9em;
                                    color: var(--subtle); margin: 0.75em 0;
                                }
                                .cp-prose code {
                                    background: var(--surface-sunken); border-radius: 5px;
                                    padding: 0.1em 0.35em; font-size: 0.9em;
                                }
                                .cp-prose img { max-width: 100%; border-radius: 12px; }
                            `}</style>
                        </SectionCard>
                    )}

                    <SectionCard title="What's inside">
                        {hierarchy.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 mb-5">
                                {hierarchy.map((levelName, i) => (
                                    <React.Fragment key={levelName}>
                                        {i > 0 && <ChevronRight size={14} className="text-faint" />}
                                        <span className="inline-flex items-center h-7 px-3 rounded-lg bg-surface-sunken border border-hairline text-[12.5px] font-medium text-body">
                                            {levelName}
                                        </span>
                                    </React.Fragment>
                                ))}
                            </div>
                        )}
                        <div className="grid sm:grid-cols-3 gap-4">
                            {STAGES.map(({ stageKey, field, title, blurb, Icon }) => {
                                const activities = asStringArray(rec[field])
                                const resources = enabledResources(resourcesType, stageKey)
                                return (
                                    <div key={stageKey} className="rounded-xl border border-hairline bg-surface-sunken p-4">
                                        <div className="flex items-center gap-2.5 mb-1">
                                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-brand-100 text-brand-700">
                                                <Icon size={15} />
                                            </span>
                                            <h3 className="text-[14px] font-semibold text-heading">{title}</h3>
                                        </div>
                                        <p className="text-[11.5px] text-faint mb-3">{blurb}</p>
                                        {activities.length > 0 ? (
                                            <ul className="space-y-1.5 mb-3">
                                                {/* Keyed with the index: legacy records can hold the
                                                    same activity name twice, and the list never
                                                    reorders, so index keys are safe here. */}
                                                {activities.map((a, ai) => (
                                                    <li key={`${ai}-${a}`} className="flex items-start gap-2 text-[12.5px] text-body">
                                                        <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-brand-500 flex-shrink-0" />
                                                        {a}
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="text-[12px] text-faint mb-3">No activities configured</p>
                                        )}
                                        {resources.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 pt-2.5 border-t border-hairline">
                                                {resources.map(({ key, label, Icon: ResIcon }) => (
                                                    <span
                                                        key={key}
                                                        title={label}
                                                        className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-white border border-hairline text-subtle text-[11px]"
                                                    >
                                                        <ResIcon size={12} />
                                                        {label}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </SectionCard>

                    {languages.length > 0 && (
                        <SectionCard title="Test configuration">
                            <div className="space-y-3">
                                {languages.map(({ group, items }) => (
                                    <div key={group} className="flex flex-wrap items-center gap-2">
                                        <span className="text-[12px] font-medium text-subtle w-20 flex-shrink-0">{group}</span>
                                        {items.map((lang) => <Chip key={lang}>{lang}</Chip>)}
                                    </div>
                                ))}
                            </div>
                        </SectionCard>
                    )}
                </motion.div>
            )}
        </div>
    )
}
