"use client"

import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import InfoTooltip from '@/components/ui/reusabletooltip'
import { FieldError, inputCls, selectCls, errorFieldCls } from '../shared/primitives'
import type { CourseApi, CourseEntry } from './types'

const ordinal = (n: number): string =>
    n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`

// One course inside a semester: category, name, and whether it splits into
// batches. Batches are opt-in — tick the box and it asks how many, then for a
// name per batch. Most courses aren't batched, so those fields stay hidden
// until the course says otherwise.
//
// The name control swaps to free text via the `__custom` sentinel. Its select
// value is guarded against a stale name: a <select> whose value matches no
// option renders blank rather than falling back, which would hide what's stored.
// `showBatches` defaults to true so the degree flow, which is every existing
// call site, is untouched. Flows where a course must not split (a course that
// already sits inside a batch) pass false. `forceBatches` is the third mode,
// for the new placement shape where the course OWNS its batches by definition:
// the opt-in checkbox disappears and the count-plus-names panel is always on,
// with the same validation surfaces. showBatches=false and forceBatches are
// mutually exclusive by construction; if a call site ever passes both,
// forceBatches wins — hiding the batches a shape requires would silently drop
// data, while showing an unwanted panel is merely noisy.
function CourseRow({
    course,
    index,
    path,
    courseApi,
    showBatches = true,
    forceBatches = false,
    removable = true,
    tourAnchors = true,
}: {
    course: CourseEntry
    index: number
    path: string
    courseApi: CourseApi
    showBatches?: boolean
    forceBatches?: boolean
    // False where the row is a fixed singleton (one course per phase in the
    // placement flow): deleting it there left an empty store slot that
    // swallowed every edit — a delete that cannot mean anything must not exist.
    removable?: boolean
    // False outside the degree flow: these anchors carry degree-specific
    // wording, and the placement flow has its own sm-prt-courses beat.
    tourAnchors?: boolean
}) {
    const names = courseApi.namesFor(course.category)
    const catErr = courseApi.errorAt(path, index, 'category')
    const nameErr = courseApi.errorAt(path, index, 'courseName')

    // The guided-tour anchors sit on the first row only. Every row renders the
    // same markup, so tagging them all would leave the walkthrough pointing at
    // whichever copy the DOM happens to hand back first.
    //
    // They are also degree-flow only. `showBatches` is false in flows that hide
    // batches entirely, and `forceBatches` is true exactly when this row renders
    // inside the placement flow, which carries its own `sm-prt-courses` beat —
    // emitting these there would both duplicate that beat and fire
    // degree-specific wording ("this semester") in a flow that has no semesters.
    const isTourAnchor = index === 0 && showBatches && !forceBatches && tourAnchors

    return (
        <div
            className="rounded-tile border border-hairline bg-surface shadow-xs p-3 space-y-2"
            data-tour={isTourAnchor ? 'sm-course-row' : undefined}
        >
            <div className="flex items-center gap-2.5 flex-wrap">
                <span className="w-6 h-6 rounded-chip bg-ink-100 text-xs font-semibold text-ink-600 tabular-nums flex items-center justify-center flex-shrink-0">
                    {index + 1}
                </span>

                <select
                    value={course.category}
                    onChange={(e) => courseApi.update(path, index, {
                        category: e.target.value, courseName: '', custom: false,
                    })}
                    className={`${selectCls} w-full sm:w-[200px] sm:shrink-0 ${catErr ? errorFieldCls : ''}`}
                    aria-label="Course category"
                >
                    <option value="">Select a category…</option>
                    {courseApi.categories.map((opt) => (
                        <option key={opt.id} value={opt.name}>{opt.name}</option>
                    ))}
                </select>
                <InfoTooltip content="Choose the category first — it decides which courses the name list beside it offers" />

                {!course.custom ? (
                    <select
                        value={names.includes(course.courseName) ? course.courseName : ''}
                        onChange={(e) => {
                            if (e.target.value === '__custom') {
                                courseApi.update(path, index, { custom: true, courseName: '' })
                            } else {
                                courseApi.update(path, index, { courseName: e.target.value })
                            }
                        }}
                        disabled={!course.category}
                        className={`${selectCls} w-full sm:flex-1 sm:min-w-[220px] disabled:bg-surface-sunken disabled:text-faint ${nameErr ? errorFieldCls : ''}`}
                        aria-label="Course name"
                    >
                        <option value="">{course.category ? 'Select a course…' : 'Pick a category first'}</option>
                        {names.map((n) => (
                            <option key={n} value={n}>{n}</option>
                        ))}
                        <option value="__custom">Others (custom)</option>
                    </select>
                ) : (
                    <div className="flex items-center gap-2 w-full sm:flex-1 sm:min-w-[220px]">
                        <Input
                            value={course.courseName}
                            onChange={(e) => courseApi.update(path, index, { courseName: e.target.value })}
                            placeholder="Type the course name"
                            className={`${inputCls} bg-white flex-1 ${nameErr ? errorFieldCls : ''}`}
                        />
                        <button
                            type="button"
                            onClick={() => courseApi.update(path, index, { custom: false, courseName: '' })}
                            className="text-xs font-medium text-brand-700 hover:text-brand-800 whitespace-nowrap transition-colors"
                        >
                            Back to list
                        </button>
                    </div>
                )}
                <InfoTooltip content="Name the course taught this semester, or pick Others to type one outside the master list" />

                {/* No checkbox under forceBatches — the course owns batches by
                    definition there, so offering an opt-out would be a lie. */}
                {showBatches && !forceBatches && (
                <>
                <label
                    data-tour={isTourAnchor ? 'sm-course-batches' : undefined}
                    className={`flex items-center gap-2 h-9 px-2.5 rounded-control border cursor-pointer select-none flex-shrink-0 transition-colors ${
                    course.batchesEnabled
                        ? 'border-brand-300 bg-brand-wash text-brand-700'
                        : 'border-hairline-strong text-ink-600 hover:border-line-hover'
                }`}>
                    <input
                        type="checkbox"
                        checked={course.batchesEnabled}
                        onChange={(e) => {
                            const on = e.target.checked
                            courseApi.update(path, index, { batchesEnabled: on })
                            // Opting in with nothing set yet starts at one batch —
                            // ticking the box and getting an empty panel would
                            // just mean a second click to say "at least one".
                            if (on && course.batches.length === 0) courseApi.setBatchCount(path, index, 1)
                        }}
                        className="w-4 h-4 accent-brand-500"
                    />
                    <span className="text-sm font-medium">Batches</span>
                </label>
                {/* Outside the <label> on purpose: anything inside it counts as
                    part of the checkbox, so tapping the ⓘ would toggle Batches. */}
                <InfoTooltip content="Optional — tick when this course runs as parallel batches, which reveals a name box per batch" />
                </>
                )}

                {removable && (
                    <button
                        type="button"
                        onClick={() => courseApi.removeAt(path, index)}
                        className="w-8 h-8 rounded-control flex items-center justify-center text-danger-500 hover:text-danger-700 hover:bg-danger-50 transition-colors flex-shrink-0"
                        aria-label={`Delete course ${index + 1}`}
                        title={`Delete course ${index + 1}`}
                    >
                        <Trash2 size={15} />
                    </button>
                )}
            </div>

            {(catErr || nameErr) && (
                <div className="pl-8 flex gap-4 flex-wrap">
                    <FieldError message={catErr} />
                    <FieldError message={nameErr} />
                </div>
            )}

            <AnimatePresence initial={false}>
                {(forceBatches || (showBatches && course.batchesEnabled)) && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.16 }}
                        className="overflow-hidden"
                    >
                        <div className="ml-8 rounded-tile border border-hairline bg-surface-sunken p-3 space-y-2.5">
                            <div className="flex items-center gap-2.5">
                                <span className="text-2xs font-semibold text-subtle uppercase tracking-wider">
                                    No. of batches
                                </span>
                                <InfoTooltip content="How many parallel groups take this course; each one gets its own name box below" />
                                <Input
                                    type="number"
                                    min={1}
                                    max={20}
                                    value={course.batches.length}
                                    onChange={(e) => courseApi.setBatchCount(path, index, parseInt(e.target.value, 10))}
                                    className={`${inputCls} !w-20 text-center bg-white`}
                                    aria-label="Number of batches"
                                />
                            </div>

                            {course.batches.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                                    {course.batches.map((b, bi) => {
                                        const bErr = courseApi.batchErrorAt(path, index, bi)
                                        return (
                                            <div key={bi} className="space-y-1">
                                                {/* These inputs carry only a placeholder, so the ⓘ sits
                                                    beside the field itself — the same input-plus-affordance
                                                    row the custom course name above already uses. */}
                                                <div className="flex items-center gap-1.5">
                                                    <Input
                                                        value={b}
                                                        onChange={(e) => courseApi.setBatchName(path, index, bi, e.target.value)}
                                                        placeholder={`${ordinal(bi + 1)} batch name`}
                                                        className={`${inputCls} flex-1 bg-white ${bErr ? errorFieldCls : ''}`}
                                                    />
                                                    <InfoTooltip content="Give each batch a name staff will recognise later, such as Batch A or Morning" />
                                                </div>
                                                <FieldError message={bErr} />
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export default React.memo(CourseRow)
