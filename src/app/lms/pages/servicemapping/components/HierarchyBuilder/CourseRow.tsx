"use client"

import React from 'react'
import { Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import InfoTooltip from '@/components/ui/reusabletooltip'
import { cn } from '@/lib/utils'
import { inputCls, errorFieldCls } from '../shared/primitives'
import { ListSelect } from '../shared/ListSelect'
import {
    BatchNameField,
    StructureField,
    StructureRows,
    batchNameGridCls,
    structureCardCls,
    structureLabelCls,
} from '../shared/StructureLayout'
import { StructureCheckbox, StructureCountInput } from '../structure/StructureControls'
import type { CourseApi, CourseEntry } from './types'

const ordinal = (n: number): string =>
    n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`

// One course inside a semester: its name, and whether it splits into batches.
// Batches are opt-in — tick the box and it asks how many, then for a name per
// batch. Most courses aren't batched, so those fields stay hidden until the
// course says otherwise.
//
// There is NO category field: the name is picked from one flat catalogue of
// every course across every category. It used to be a pair — pick a category,
// then pick one of that category's courses, with an "Others (custom)" row
// escaping to a text box — which made choosing a course a two-step guess at
// which category somebody had filed it under. One list answers it in one step,
// and the search box in the picker is how you reach a distant course.
//
// `category` stays on the stored entry and is written back untouched, so
// re-saving a mapping made under the old shape does not wipe what it recorded.
// A stored name the catalogue no longer offers stays selectable — see
// `orphan` below.
//
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
    const nameErr = courseApi.errorAt(path, index, 'courseName')

    // A stored name the catalogue no longer offers — a course retired from
    // Course Management, or one typed in while this field was free text — is
    // offered anyway, at the top. Without it the picker matches no option and
    // renders blank, hiding a name that IS saved; the next person to fill the
    // apparently empty field would overwrite it.
    const stored = course.courseName.trim()
    const orphan = Boolean(stored) && !courseApi.allCourseNames.includes(stored)
    const nameOptions = (orphan ? [stored, ...courseApi.allCourseNames] : courseApi.allCourseNames)
        .map((n) => ({ value: n, label: n }))

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

    // Batches are shown when the course opted in, or always in the shape that
    // owns them by definition. One expression, used by both the count row and
    // the names below it.
    const batchesShown = forceBatches || (showBatches && course.batchesEnabled)

    return (
        // The step's shared container and arrangement: course on the left,
        // batches on the right, batch names under the batches column. Identical
        // to the placement and flat-model steps -- every field, option, handler
        // and validation surface below is exactly the one this row always had.
        <div
            className={cn(structureCardCls, 'space-y-3 p-3')}
            data-tour={isTourAnchor ? 'sm-course-row' : undefined}
        >
            {/* Which course in the semester, and the way to drop it. A slim
                header rather than a chip inline with the first field, which
                would push that label out of line with the one beneath it. */}
            <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-chip bg-ink-100 text-xs font-semibold text-ink-600 tabular-nums flex items-center justify-center flex-shrink-0">
                    {index + 1}
                </span>
                {removable && (
                    <button
                        type="button"
                        onClick={() => courseApi.removeAt(path, index)}
                        className="ml-auto w-8 h-8 rounded-control flex items-center justify-center text-danger-500 hover:text-danger-700 hover:bg-danger-50 transition-colors flex-shrink-0"
                        aria-label={`Delete course ${index + 1}`}
                        title={`Delete course ${index + 1}`}
                    >
                        <Trash2 size={15} />
                    </button>
                )}
            </div>

            <StructureRows
                course={
                    <>
                        <StructureField
                            label="Course name"
                            required
                            error={nameErr}
                            tooltip="Pick the course taught this semester — every course Course Management holds, whatever category it sits under"
                        >
                            <ListSelect
                                value={course.courseName}
                                options={nameOptions}
                                onChange={(next) => courseApi.update(path, index, { courseName: next })}
                                placeholder="Select a course…"
                                emptyLabel="No courses configured in Course Management."
                                ariaLabel="Course name"
                                searchPlaceholder="Search courses…"
                                invalid={Boolean(nameErr)}
                                // A short scrolling list: the catalogue spans every
                                // category, so an uncapped panel would cover the rows
                                // under it and still not show everything. Search is
                                // how you get to a distant course, not scrolling.
                                listMaxHeight={180}
                                className="w-full"
                            />
                        </StructureField>
                    </>
                }
                batches={
                    <>
                        {/* No checkbox under forceBatches - the course owns batches
                            by definition there, so offering an opt-out would be a
                            lie. */}
                        {showBatches && !forceBatches && (
                            <div
                                data-tour={isTourAnchor ? 'sm-course-batches' : undefined}
                                className="flex items-center gap-1.5"
                            >
                                <StructureCheckbox
                                    checked={course.batchesEnabled}
                                    onCheckedChange={(on) => {
                                        courseApi.update(path, index, { batchesEnabled: on })
                                        // Opting in with nothing set yet starts at one
                                        // batch - ticking the box and getting an empty
                                        // panel would just mean a second click to say
                                        // "at least one".
                                        if (on && course.batches.length === 0) courseApi.setBatchCount(path, index, 1)
                                    }}
                                    label="Batches"
                                    labelClass="text-sm font-semibold text-heading"
                                />
                                {/* Outside the checkbox's own label on purpose:
                                    anything inside it counts as part of the control,
                                    so tapping the tooltip would toggle Batches. */}
                                <InfoTooltip content="Optional - tick when this course runs as parallel batches, which reveals a name box per batch" />
                            </div>
                        )}
                        {batchesShown && (
                            <div className="flex flex-wrap items-center gap-3">
                                {showBatches && !forceBatches && (
                                    <span aria-hidden className="hidden h-5 w-px bg-hairline-strong sm:block" />
                                )}
                                <span className={structureLabelCls}>Number of batches</span>
                                <StructureCountInput
                                    label="Number of batches"
                                    value={Math.max(1, course.batches.length)}
                                    onChange={(n) => courseApi.setBatchCount(path, index, n)}
                                    max={20}
                                />
                                <InfoTooltip content="How many parallel groups take this course; each one gets its own name box below" />
                            </div>
                        )}
                    </>
                }
                // No fold animation here any more. The panel used to slide open
                // because it was a nested box appearing below the row; as the
                // second line of the batches column it simply belongs there, and
                // the placement and flat-model steps show the same fields with no
                // animation — three flows animating differently was part of what
                // made the step feel like three screens.
                batchNames={batchesShown && course.batches.length > 0 && (
                            <div className={batchNameGridCls}>
                                {course.batches.map((b, bi) => {
                                    const bErr = courseApi.batchErrorAt(path, index, bi)
                                    return (
                                        <BatchNameField
                                            key={bi}
                                            label={`Batch ${bi + 1} name`}
                                            error={bErr}
                                        >
                                            {/* The tooltip sits beside the field, the
                                                same input-plus-affordance row the custom
                                                course name above already uses. */}
                                            <div className="flex items-center gap-1.5">
                                                <Input
                                                    value={b}
                                                    onChange={(e) => courseApi.setBatchName(path, index, bi, e.target.value)}
                                                    placeholder={`${ordinal(bi + 1)} batch name`}
                                                    className={`${inputCls} flex-1 bg-white ${bErr ? errorFieldCls : ''}`}
                                                    aria-label={`${ordinal(bi + 1)} batch name`}
                                                />
                                                <InfoTooltip content="Give each batch a name staff will recognise later, such as Batch A or Morning" />
                                            </div>
                                        </BatchNameField>
                                    )
                                })}
                            </div>
                )}
            />
        </div>
    )
}

export default React.memo(CourseRow)
