"use client"

import React, { useState } from 'react'
import { AlertCircle, Lock } from 'lucide-react'
import InfoTooltip from '@/components/ui/reusabletooltip'
import ScopeList from './ScopeList'
import SemesterEditor from './SemesterEditor'
import { allScopes, sameScope, scopeLabel, semesterPath, type Scope } from './scope'
import type { CourseApi, DegreeView } from './types'

// Where the courses get filled in. Two axes, so the layout uses two:
//   department (and section) picks the ROW     → the list down the left
//   semester picks the COLUMN                  → the tabs across the top
// One editor is on screen at a time, which keeps the deepest level — a course
// and its batches — at the top of the panel instead of buried under whichever
// semesters happen to sit above it.
function Workbench({
    degree,
    scope,
    onSelectScope,
    courseApi,
    editableSemester,
}: {
    degree: DegreeView
    scope: Scope | null
    onSelectScope: (s: Scope) => void
    courseApi: CourseApi
    // The one semester currently open for editing (the active one in the degree
    // flow). Every other tab is a past, ended semester and renders read-only.
    // Omitted (undefined) means no restriction — every semester stays editable,
    // the behaviour before per-semester locking and what non-degree callers want.
    editableSemester?: string
}) {
    const scopes = allScopes(degree)
    const active = scope && scopes.some((s) => sameScope(s, scope)) ? scope : scopes[0] || null

    // Which semester tab is open — kept as the semester's own value (not an index)
    // so it survives switching departments; the user is usually filling the same
    // semester across several of them. Starts unset so it follows the current
    // (editable) semester until the user opens a tab themselves.
    const [selectedTab, setSelectedTab] = useState<string>('')
    const current = degree.semesters.includes(selectedTab)
        ? selectedTab
        : editableSemester !== undefined && degree.semesters.includes(editableSemester)
            ? editableSemester
            : degree.semesters[0] || ''
    // Only the current (editable) semester accepts edits; a past, ended semester is
    // shown read-only so its committed courses can be seen but not changed. With no
    // editable semester supplied (undefined), nothing is restricted.
    const readOnly = editableSemester !== undefined && current !== editableSemester

    const degreeErrors = courseApi.errorCountUnder(degree.name)

    return (
        <div data-tour="sm-workbench" className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] h-full min-h-0 gap-0">
            <div className="lg:border-r border-hairline lg:pr-3 overflow-y-auto min-h-0 pb-2">
                <ScopeList
                    degree={degree}
                    scope={active}
                    onSelectScope={onSelectScope}
                    courseApi={courseApi}
                />
            </div>

            <div className="lg:pl-5 flex flex-col min-h-0 overflow-hidden">
                {degreeErrors > 0 && (
                    <div className="mb-2 flex items-center gap-2 rounded-tile border border-danger-500/30 bg-danger-50 px-3 py-2 text-xs text-danger-700 flex-shrink-0">
                        <AlertCircle size={13} className="flex-shrink-0" />
                        {degreeErrors} semester{degreeErrors !== 1 ? 's' : ''} need attention
                    </div>
                )}

                {!active ? (
                    <p className="text-sm text-faint">Pick a department on the left to start.</p>
                ) : (
                    <>
                        {/* The guidance rides on this heading rather than a FieldLabel because the
                            heading is what names the tab strip below it, and swapping it for a
                            FieldLabel would change its weight and colour. `align-middle` keeps the
                            inline icon off the baseline so the line box — and the panel height —
                            stays exactly as it was. */}
                        <p className="text-2xs font-semibold uppercase tracking-wider text-subtle mb-2 flex-shrink-0">
                            {scopeLabel(active)}
                            <InfoTooltip
                                content="Switch semesters here; each tab keeps its own course list for the department on the left"
                                iconClassName="text-faint hover:text-subtle cursor-pointer inline align-middle ml-1"
                            />
                        </p>

                        <div data-tour="sm-semtabs" className="flex items-end gap-1 border-b border-hairline-strong overflow-x-auto flex-shrink-0">
                            {degree.semesters.map((sem) => {
                                const p = semesterPath(degree.name, active, sem)
                                const count = courseApi.coursesAt(p).length
                                const errs = courseApi.errorCountUnder(p)
                                const isCurrent = sem === current
                                // A past, ended semester: its tab still opens, but the
                                // editor inside is read-only (see below).
                                const viewOnly = editableSemester !== undefined && sem !== editableSemester
                                return (
                                    <button
                                        key={sem}
                                        type="button"
                                        onClick={() => setSelectedTab(sem)}
                                        title={viewOnly ? `Semester ${sem} has ended — view only` : undefined}
                                        className={`h-9 px-3.5 rounded-t-lg text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors flex items-center gap-2 ${
                                            isCurrent
                                                ? 'border-brand-500 text-brand-700 bg-brand-50/60'
                                                : 'border-transparent text-subtle hover:text-heading hover:bg-row-hover'
                                        }`}
                                    >
                                        {viewOnly && <Lock size={11} className="flex-shrink-0 opacity-70" />}
                                        Sem {sem}
                                        {errs > 0 ? (
                                            <AlertCircle size={12} className="text-danger-500" />
                                        ) : count > 0 ? (
                                            <span className={`text-2xs tabular-nums px-1.5 rounded ${
                                                isCurrent ? 'bg-brand-700 text-white' : 'bg-ink-100 text-ink-600'
                                            }`}>
                                                {count}
                                            </span>
                                        ) : null}
                                    </button>
                                )
                            })}
                        </div>

                        <div className="flex-1 min-h-0 overflow-y-auto pt-3 pb-2">
                            {!current ? (
                                <p className="text-sm text-faint">No semesters in scope.</p>
                            ) : readOnly ? (
                                // A past, ended semester: a disabled fieldset makes every
                                // control inside read-only in one stroke, so its committed
                                // courses and batches can be seen but not edited.
                                <fieldset disabled className="min-w-0 m-0 border-0 p-0">
                                    <div className="mb-3 flex items-center gap-2 rounded-tile border border-warn-500/30 bg-warn-50 px-3 py-2 text-xs text-warn-700">
                                        <Lock size={13} className="flex-shrink-0" />
                                        Semester {current} has ended — view only. Only the current semester can be edited.
                                    </div>
                                    <SemesterEditor
                                        key={`${scopeLabel(active)}-${current}`}
                                        path={semesterPath(degree.name, active, current)}
                                        courseApi={courseApi}
                                    />
                                </fieldset>
                            ) : (
                                <SemesterEditor
                                    key={`${scopeLabel(active)}-${current}`}
                                    path={semesterPath(degree.name, active, current)}
                                    courseApi={courseApi}
                                />
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

export default React.memo(Workbench)
