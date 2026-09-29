"use client"

// Course setup ▸ Degree Program: how a course's content and Program Calendar
// split across its student groups.
//
// A degree course runs for every section of its department + semester, and a
// section may be split into batches (see app/lms/shared/courseGroups.ts).
//
//   1. Is it the same for every section?          Yes → one shared set, done.
//   2. (content only) Which elements differ?       I Do / We Do / You Do
//   3. Which sections and batches share?           each picks a SET
//
// Groups on the same set share content (or a calendar): Sections A and B on
// Set 1, Section C on Set 2; inside C, Batch 1 and Batch 2 on Set 2 and Batch 3
// on Set 3. A section is either on one set as a whole, or — "Batches differ" —
// split so each of its batches picks its own. A course with ONE section skips
// question 1 and always lets its batches pick.
//
// Saved on the existing config: `sameForAllBatches` answers question 1 and
// `batchwiseElements` question 2, exactly as for every other service; `sets`
// lists every assignment. `perBatchSections` is the older per-section answer —
// a course saved with it opens here as the equivalent sets (see effectiveSets).
//
// A set's number is where its content is kept, so numbers are never reused:
// answering Yes keeps the assignments (No brings them back, content and all),
// and `lastSet` remembers the highest number ever saved, so a "New set" never
// reopens the content of one that was given up.

import React from 'react'
import { sectionKey, sectionLabel, type SectionGroup } from '@/app/lms/shared/courseGroups'
import { ValidationMessage } from './ValidationMessage'

/** One group's set. `batch` is "" when the whole section is on the set. */
export type SetAssignment = { section: string; batch: string; set: string }

export type BatchResourcesConfig = {
    sameForAllBatches: boolean
    batchwiseElements: string[]
    /** Older per-section answer: sections whose batches each got their own. */
    perBatchSections?: string[]
    /** Degree Program: which set each section (or batch) is on. */
    sets?: SetAssignment[]
    /** The highest set number ever saved. */
    lastSet?: number
}

export type ProgramCalendarConfig = {
    sameForAllBatches: boolean
    perBatchSections?: string[]
    sets?: SetAssignment[]
    lastSet?: number
}

type GroupConfig = { sameForAllBatches: boolean; perBatchSections?: string[]; sets?: SetAssignment[]; lastSet?: number }

const ELEMENTS = [
    { key: 'I_Do', label: 'I Do' },
    { key: 'We_Do', label: 'We Do' },
    { key: 'You_Do', label: 'You Do' },
] as const

/** How many groups the sections make — the questions only matter above one. */
export const degreeGroupCount = (sections: SectionGroup[]) =>
    sections.reduce((n, s) => n + Math.max(1, s.batches.length), 0)

/** Can this section's batches differ at all? Not with none, or just one. */
const hasBatches = (s: SectionGroup) => s.batches.length > 1

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** The highest set number in use, or ever saved. */
export const highestSet = (assignments: SetAssignment[], floor = 0) =>
    assignments.reduce((max, a) => Math.max(max, Number(a.set) || 0), floor)

const nextSetId = (assignments: SetAssignment[], floor = 0) => String(highestSet(assignments, floor) + 1)

/**
 * The complete, current set assignments for these sections: every section on
 * a set, or — when it is split — every one of its batches. Missing entries
 * (a section or batch added in Service Mapping since) get a set of their own;
 * entries for sections or batches that no longer exist are dropped. A config
 * with no `sets` yet is read from the older per-section answer: a section
 * whose batches differed has each batch on its own set, any other section is
 * on one set of its own.
 */
export function effectiveSets(sections: SectionGroup[], cfg: GroupConfig): SetAssignment[] {
    const stored = cfg.sets || []
    const single = sections.length === 1
    const out: SetAssignment[] = []
    const add = (section: string, batch: string, set?: string) =>
        out.push({ section, batch, set: set || nextSetId([...stored, ...out], cfg.lastSet || 0) })
    for (const s of sections) {
        const mine = stored.filter((a) => sectionKey(a.section) === sectionKey(s.section))
        const legacySplit = !stored.length && (single || (cfg.perBatchSections || []).some((n) => sectionKey(n) === sectionKey(s.section)))
        const split = hasBatches(s) && (single || legacySplit || mine.some((a) => a.batch.trim()))
        if (split) {
            const whole = mine.find((a) => !a.batch.trim())
            for (const b of s.batches) {
                const hit = mine.find((a) => same(a.batch, b))
                add(s.section, b, hit?.set || (stored.length ? whole?.set : undefined))
            }
        } else {
            const whole = mine.find((a) => !a.batch.trim()) || mine[0]
            add(s.section, '', whole?.set)
        }
    }
    return out
}

/** Each set with the groups on it, in order — what the result box lists. */
const setMembers = (assignments: SetAssignment[]) => {
    const bySet = new Map<string, string[]>()
    for (const a of assignments) {
        const label = a.batch ? `${sectionLabel(a.section)} · ${a.batch}` : sectionLabel(a.section)
        bySet.set(a.set, [...(bySet.get(a.set) || []), label])
    }
    return [...bySet.entries()].sort((x, y) => (Number(x[0]) || 0) - (Number(y[0]) || 0))
}

// Set chips cycle through a few tints so neighbouring sets read apart.
const SET_TONES = [
    'bg-brand-50 border-brand-200 text-brand-700',
    'bg-info-50 border-info-500/20 text-info-700',
    'bg-success-50 border-success-500/20 text-success-700',
    'bg-warn-50 border-warn-500/20 text-warn-700',
    'bg-ink-100 border-ink-300 text-ink-700',
]
const toneOf = (set: string) => SET_TONES[((Number(set) || 1) - 1) % SET_TONES.length]

function SetChip({ set }: { set: string }) {
    return (
        <span className={`inline-flex items-center h-[20px] px-2 rounded-chip border text-2xs font-semibold ${toneOf(set)}`}>
            Set {set}
        </span>
    )
}

// ─── Small controls ─────────────────────────────────────────────────────────

function Choice<T extends string | boolean>({
    value, options, onChange, readOnly, label,
}: {
    value: T
    options: { value: T; label: string }[]
    onChange: (v: T) => void
    readOnly: boolean
    label: string
}) {
    return (
        <div role="radiogroup" aria-label={label} className="inline-flex rounded-control border border-hairline-strong bg-surface overflow-hidden shadow-xs">
            {options.map((opt) => (
                <button
                    key={String(opt.value)}
                    type="button"
                    role="radio"
                    aria-checked={value === opt.value}
                    disabled={readOnly}
                    onClick={() => onChange(opt.value)}
                    className={`h-8 px-3.5 text-xs font-semibold transition-colors ${
                        value === opt.value
                            ? 'bg-gradient-to-b from-brand-400 to-brand-600 text-white'
                            : 'text-subtle hover:bg-row-hover'
                    } ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    )
}

const YES_NO = [{ value: true, label: 'Yes' }, { value: false, label: 'No' }]

function Question({ n, text, children }: { n?: number; text: React.ReactNode; children?: React.ReactNode }) {
    return (
        <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[13px] font-medium text-heading">{n ? `${n}. ` : ''}{text}</span>
            {children}
        </div>
    )
}

const NEW_SET = '__new'

/** The set picker: every set in use, plus a new one. */
function SetSelect({
    value, used, fresh, onChange, readOnly, label,
}: {
    value: string
    used: string[]
    fresh: string
    onChange: (set: string) => void
    readOnly: boolean
    label: string
}) {
    return (
        <select
            aria-label={label}
            value={value}
            disabled={readOnly}
            onChange={(e) => onChange(e.target.value === NEW_SET ? fresh : e.target.value)}
            className="h-8 w-[130px] rounded-control border border-hairline-strong bg-surface px-2 text-xs font-medium text-body focus:border-brand focus:outline-none disabled:opacity-60"
        >
            {used.map((s) => <option key={s} value={s}>Set {s}</option>)}
            <option value={NEW_SET}>+ New set (Set {fresh})</option>
        </select>
    )
}

/**
 * Question 3's rows: each section on a set, or split so each batch picks one.
 * Always hands back the full, normalised assignment list.
 */
function SetsEditor({
    sections, assignments, floor, onChange, readOnly,
}: {
    sections: SectionGroup[]
    assignments: SetAssignment[]
    /** Set numbers up to here were used before — a new set starts above. */
    floor: number
    onChange: (next: SetAssignment[]) => void
    readOnly: boolean
}) {
    const single = sections.length === 1
    const used = [...new Set(assignments.map((a) => a.set))].sort((a, b) => (Number(a) || 0) - (Number(b) || 0))
    const fresh = nextSetId(assignments, floor)
    const setAt = (section: string, batch: string, set: string) =>
        onChange(assignments.map((a) => (sectionKey(a.section) === sectionKey(section) && same(a.batch, batch) ? { ...a, set } : a)))
    const splitSection = (s: SectionGroup, split: boolean) => {
        const others = assignments.filter((a) => sectionKey(a.section) !== sectionKey(s.section))
        const mine = assignments.filter((a) => sectionKey(a.section) === sectionKey(s.section))
        const current = mine[0]?.set || fresh
        // Splitting starts every batch on the section's set, so nothing moves
        // until a batch is given another one; joining puts the section on its
        // first batch's set.
        const next = split
            ? s.batches.map((b) => ({ section: s.section, batch: b, set: current }))
            : [{ section: s.section, batch: '', set: current }]
        const order = sections.map((x) => sectionKey(x.section))
        onChange([...others, ...next].sort((a, b) => order.indexOf(sectionKey(a.section)) - order.indexOf(sectionKey(b.section))))
    }

    return (
        <div className="max-w-[760px] border-t border-hairline">
            {sections.map((s) => {
                const mine = assignments.filter((a) => sectionKey(a.section) === sectionKey(s.section))
                const split = mine.some((a) => a.batch)
                return (
                    <div key={s.section} className="border-b border-hairline py-2">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                            <span className="w-[150px] shrink-0 text-[13px] font-medium text-heading">
                                {sectionLabel(s.section)}
                                <span className="block text-2xs font-normal text-faint">
                                    {s.batches.length ? s.batches.join(', ') : 'No batches'}
                                </span>
                            </span>
                            {split ? (
                                <span className="w-[130px] text-2xs text-faint">Each batch below</span>
                            ) : (
                                <SetSelect
                                    label={`${sectionLabel(s.section)} set`}
                                    value={mine[0]?.set || ''}
                                    used={used}
                                    fresh={fresh}
                                    readOnly={readOnly}
                                    onChange={(set) => setAt(s.section, '', set)}
                                />
                            )}
                            {hasBatches(s) && !single ? (
                                <label className={`inline-flex items-center gap-2 text-xs text-body ${readOnly ? 'opacity-60' : 'cursor-pointer'}`}>
                                    <input
                                        type="checkbox"
                                        checked={split}
                                        disabled={readOnly}
                                        onChange={(e) => splitSection(s, e.target.checked)}
                                        className="w-4 h-4 accent-brand-500"
                                    />
                                    Batches differ
                                </label>
                            ) : null}
                        </div>
                        {split && s.batches.map((b) => {
                            const a = mine.find((x) => same(x.batch, b))
                            return (
                                <div key={b} className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                                    <span className="w-[150px] shrink-0 pl-4 text-xs text-body">{b}</span>
                                    <SetSelect
                                        label={`${sectionLabel(s.section)} ${b} set`}
                                        value={a?.set || ''}
                                        used={used}
                                        fresh={fresh}
                                        readOnly={readOnly}
                                        onChange={(set) => setAt(s.section, b, set)}
                                    />
                                </div>
                            )
                        })}
                    </div>
                )
            })}
        </div>
    )
}

/** Who is on which set, stated before saving. */
function SetsResult({ assignments, heading }: { assignments: SetAssignment[]; heading: string }) {
    const members = setMembers(assignments)
    return (
        <div className="max-w-[900px] rounded-tile border border-hairline px-3 py-2.5">
            <p className="text-2xs text-subtle mb-1.5">{heading}</p>
            <div className="space-y-1">
                {members.map(([set, labels]) => (
                    <div key={set} className="flex items-center gap-2 flex-wrap">
                        <SetChip set={set} />
                        <span className="text-xs text-body">{labels.join(', ')}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ─── Resources ──────────────────────────────────────────────────────────────

export function DegreeResourcesSettings({
    sections, value, onChange, readOnly, error,
}: {
    sections: SectionGroup[]
    value: BatchResourcesConfig
    onChange: (next: BatchResourcesConfig) => void
    readOnly: boolean
    error?: string
}) {
    const single = sections.length === 1
    const isSame = value.sameForAllBatches
    const assignments = isSame ? [] : effectiveSets(sections, value)
    const differs = ELEMENTS.filter((el) => !isSame && value.batchwiseElements.includes(el.key))
    const sharedEls = ELEMENTS.filter((el) => !differs.includes(el))
    const first = assignments[0]
    const firstWho = first ? (first.batch ? `${sectionLabel(first.section)} · ${first.batch}` : sectionLabel(first.section)) : ''

    return (
        <div data-error-anchor={error ? 'true' : undefined} className="space-y-4 mt-2">
            <Question
                n={single ? undefined : 1}
                text={single
                    ? <>Are course resources the same for every batch of {sectionLabel(sections[0].section)}?</>
                    : 'Are course resources the same for every section?'}
            >
                <Choice
                    label="Resources the same"
                    value={isSame}
                    options={YES_NO}
                    readOnly={readOnly}
                    onChange={(v) => onChange(v
                        // Back to Yes clears the ticks, as for every other
                        // service — a stale hidden list must not resurface.
                        // The sets stay, for a later No.
                        ? { ...value, sameForAllBatches: true, batchwiseElements: [] }
                        : { ...value, sameForAllBatches: false, perBatchSections: [], sets: effectiveSets(sections, value) })}
                />
                <span className="text-2xs text-faint">{isSame ? 'One shared content set for everyone' : 'Ticked elements below get their own content per set'}</span>
            </Question>

            {!isSame && (
                <Question n={single ? undefined : 2} text="Which elements differ?">
                    <span className="flex items-center gap-4 flex-wrap">
                        {ELEMENTS.map((el) => {
                            const on = value.batchwiseElements.includes(el.key)
                            return (
                                <label key={el.key} className={`inline-flex items-center gap-2 text-[13px] font-medium text-heading ${readOnly ? 'opacity-60' : 'cursor-pointer'}`}>
                                    <input
                                        type="checkbox"
                                        checked={on}
                                        disabled={readOnly}
                                        onChange={() => onChange({
                                            ...value,
                                            batchwiseElements: on
                                                ? value.batchwiseElements.filter((k) => k !== el.key)
                                                : [...value.batchwiseElements, el.key],
                                        })}
                                        className="w-4 h-4 accent-brand-500"
                                    />
                                    {el.label}
                                </label>
                            )
                        })}
                    </span>
                </Question>
            )}

            {!isSame && (
                <div className="space-y-2">
                    <Question n={single ? undefined : 3} text={single ? 'Which batches share the same content?' : 'Which sections and batches share the same content?'} />
                    <p className="text-2xs text-faint -mt-1">Give groups that share content the same set.{single ? '' : ' Tick "Batches differ" to let each batch of a section pick its own set.'}</p>
                    <SetsEditor
                        sections={sections}
                        assignments={assignments}
                        floor={value.lastSet || 0}
                        readOnly={readOnly}
                        onChange={(sets) => onChange({ ...value, perBatchSections: [], sets })}
                    />
                    <SetsResult
                        assignments={assignments}
                        heading={differs.length
                            ? `Each set has its own ${differs.map((el) => el.label).join(', ')}${sharedEls.length ? `; ${sharedEls.map((el) => el.label).join(', ')} shared by everyone` : ''}.`
                            : 'Tick at least one element above, or nothing differs between the sets.'}
                    />
                    {first && differs.length > 0 && (
                        <p className="text-xs text-subtle">
                            A <span className="font-semibold text-heading">{firstWho}</span> student will see:{' '}
                            {ELEMENTS.map((el, i) => (
                                <span key={el.key}>
                                    {i > 0 && ' + '}
                                    {differs.includes(el)
                                        ? <span className="text-brand-700 font-medium">Set {first.set}&apos;s {el.label}</span>
                                        : `shared ${el.label}`}
                                </span>
                            ))}
                            .
                        </p>
                    )}
                </div>
            )}

            {error && <ValidationMessage message={error} />}
        </div>
    )
}

// ─── Program Calendar ───────────────────────────────────────────────────────

export function DegreeCalendarSettings({
    sections, value, onChange, readOnly,
}: {
    sections: SectionGroup[]
    value: ProgramCalendarConfig
    onChange: (next: ProgramCalendarConfig) => void
    readOnly: boolean
}) {
    const single = sections.length === 1
    const isSame = value.sameForAllBatches
    const assignments = isSame ? [] : effectiveSets(sections, value)
    const count = new Set(assignments.map((a) => a.set)).size

    return (
        <div className="space-y-4 mt-2">
            <Question
                n={single ? undefined : 1}
                text={single
                    ? <>Is the Program Calendar the same for every batch of {sectionLabel(sections[0].section)}?</>
                    : 'Is the Program Calendar the same for every section?'}
            >
                <Choice
                    label="Calendar the same"
                    value={isSame}
                    options={YES_NO}
                    readOnly={readOnly}
                    onChange={(v) => onChange(v
                        ? { ...value, sameForAllBatches: true }
                        : { ...value, sameForAllBatches: false, perBatchSections: [], sets: effectiveSets(sections, value) })}
                />
            </Question>

            {isSame ? (
                <p className="text-2xs text-faint">One shared Program Calendar: every section and batch follows the same schedule.</p>
            ) : (
                <div className="space-y-2">
                    <Question n={single ? undefined : 2} text={single ? 'Which batches share a calendar?' : 'Which sections and batches share a calendar?'} />
                    <p className="text-2xs text-faint -mt-1">Groups on the same set follow one calendar.{single ? '' : ' Tick "Batches differ" to let each batch of a section pick its own set.'}</p>
                    <SetsEditor
                        sections={sections}
                        assignments={assignments}
                        floor={value.lastSet || 0}
                        readOnly={readOnly}
                        onChange={(sets) => onChange({ ...value, perBatchSections: [], sets })}
                    />
                    <SetsResult
                        assignments={assignments}
                        heading={`${count} calendar${count === 1 ? '' : 's'}. Pick the set on the Program Calendar page to author or view it.`}
                    />
                </div>
            )}
        </div>
    )
}
