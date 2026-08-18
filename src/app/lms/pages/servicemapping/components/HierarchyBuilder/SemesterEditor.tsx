"use client"

import React from 'react'
import { Input } from '@/components/ui/input'
import InfoTooltip from '@/components/ui/reusabletooltip'
import { inputCls } from '../shared/primitives'
import CourseRow from './CourseRow'
import type { CourseApi } from './types'

// The body of one semester tab: how many courses run in it, then a card per
// course. No header — the tab above already names the semester, so repeating it
// here would just be noise.
//
// The Placement Training workbench renders this same editor for a batch or one
// phase of a batch, so the wording and the per-course batch split are props. They
// all default to the degree flow's behaviour, which is why that flow passes none
// of them and renders exactly as it did before placement reused this component.
function SemesterEditor({
    path,
    courseApi,
    showBatches = true,
    countLabel = 'No. of courses',
    countHint = 'How many courses run this semester; each adds a row, and lowering it removes the last rows',
    emptyLabel = 'Set how many courses run this semester.',
}: {
    path: string
    courseApi: CourseApi
    showBatches?: boolean
    countLabel?: string
    countHint?: string
    emptyLabel?: string
}) {
    const courses = courseApi.coursesAt(path)
    // Without the per-course batch split there is nothing that can ever set
    // `batchesEnabled` here, so the summary would be a permanent "0 with
    // batches" — hidden rather than shown as a zero.
    const batched = showBatches ? courses.filter((c) => c.batchesEnabled).length : 0

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2.5 flex-wrap">
                {/* The tooltip sits beside this label rather than coming from
                    FieldLabel: this row's heading is a heavier, darker span than
                    the primitive renders, and swapping it would restyle the
                    counter that every semester tab opens on. */}
                <span className="text-2xs font-semibold text-subtle uppercase tracking-wider">
                    {countLabel}
                </span>
                <InfoTooltip content={countHint} />
                <Input
                    type="number"
                    min={0}
                    max={20}
                    value={courses.length}
                    onChange={(e) => courseApi.setCount(path, parseInt(e.target.value, 10))}
                    className={`${inputCls} !w-20 text-center`}
                    aria-label="Number of courses"
                />
                {batched > 0 && (
                    <span className="text-xs text-subtle tabular-nums">{batched} with batches</span>
                )}
            </div>

            {courses.length === 0 ? (
                <p className="text-sm text-faint">
                    {emptyLabel}
                </p>
            ) : (
                <div className="space-y-2.5">
                    {courses.map((c, i) => (
                        <CourseRow
                            key={i}
                            course={c}
                            index={i}
                            path={path}
                            courseApi={courseApi}
                            showBatches={showBatches}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

export default React.memo(SemesterEditor)
