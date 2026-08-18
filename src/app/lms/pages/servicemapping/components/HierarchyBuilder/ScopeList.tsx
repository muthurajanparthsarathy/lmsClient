"use client"

import React from 'react'
import { AlertCircle, Check } from 'lucide-react'
import { SECTION_LEVEL, allScopes, sameScope, scopeLabel, scopePath, type Scope } from './scope'
import type { CourseApi, DegreeView } from './types'

// The WHERE column: every leaf the courses can hang off, flattened from
// departments × their sections. Selecting a row swaps what the workbench shows.
//
// Each row carries its own filled/total counter and error badge, so the user can
// see at a glance which rows still need work without opening them — that read is
// the whole reason this column exists rather than a set of nested accordions.
function ScopeList({
    degree,
    scope,
    onSelectScope,
    courseApi,
}: {
    degree: DegreeView
    scope: Scope | null
    onSelectScope: (s: Scope) => void
    courseApi: CourseApi
}) {
    const scopes = allScopes(degree)

    return (
        <div className="space-y-0.5">
            <p className="text-2xs font-semibold uppercase tracking-wider text-faint px-2 pb-2">
                Department
            </p>

            {degree.departments.map((department) => {
                const sections = degree.sectionsFor(department)
                // A department with sections is a heading; without them it is
                // itself a selectable row.
                if (!sections.length) {
                    return (
                        <ScopeRow
                            key={department}
                            label={department}
                            scope={{ department, section: null }}
                            active={sameScope(scope, { department, section: null })}
                            degree={degree}
                            onSelectScope={onSelectScope}
                            courseApi={courseApi}
                        />
                    )
                }
                return (
                    <div key={department}>
                        <p className="h-[30px] flex items-center px-2 text-sm font-semibold text-heading truncate">
                            {department}
                        </p>
                        {/* Names the level the rows beneath belong to, so the
                            column reads Civil → Sections → a. Without it the
                            section values hang directly off the department and
                            look like sub-departments rather than sections. Not a
                            selectable row — there is nothing to scope to at the
                            level itself, only at the values under it. */}
                        <p className="pl-4 pb-0.5 text-2xs font-semibold uppercase tracking-wider text-faint select-none">
                            {SECTION_LEVEL}
                        </p>
                        {sections.map((section, si) => {
                            // The rail must STOP at the last row's tick — a
                            // full-height bar on every row left a dangling line
                            // below the final section, which is what made the
                            // tree read as badly connected.
                            const isLast = si === sections.length - 1
                            return (
                                <div key={section} className="relative pl-4">
                                    <span
                                        className={`absolute left-[5px] w-px bg-ink-300 ${isLast ? 'top-0 h-[15px]' : 'top-0 bottom-0'}`}
                                        aria-hidden
                                    />
                                    <span className="absolute left-[5px] top-[15px] w-[9px] h-px bg-ink-300" aria-hidden />
                                    <ScopeRow
                                        label={section}
                                        scope={{ department, section }}
                                        active={sameScope(scope, { department, section })}
                                        degree={degree}
                                        onSelectScope={onSelectScope}
                                        courseApi={courseApi}
                                    />
                                </div>
                            )
                        })}
                    </div>
                )
            })}

            {scopes.length === 0 && (
                <p className="px-2 text-2xs text-faint italic">No departments picked yet.</p>
            )}
        </div>
    )
}

function ScopeRow({
    label,
    scope,
    active,
    degree,
    onSelectScope,
    courseApi,
}: {
    label: string
    scope: Scope
    active: boolean
    degree: DegreeView
    onSelectScope: (s: Scope) => void
    courseApi: CourseApi
}) {
    const prefix = scopePath(degree.name, scope)
    const { filled, total } = courseApi.filledCountUnder(prefix)
    const errors = courseApi.errorCountUnder(prefix)
    const complete = total > 0 && filled === total

    return (
        <button
            type="button"
            onClick={() => onSelectScope(scope)}
            title={scopeLabel(scope)}
            className={`relative w-full h-[30px] flex items-center gap-2 rounded-chip pl-2 pr-2 text-sm transition-colors ${
                active ? 'bg-info-50' : 'hover:bg-row-hover'
            }`}
        >
            {active && (
                <span className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r bg-info-700" aria-hidden />
            )}
            {/* Blue, not the app orange: these rows are NAVIGATION — picking one
                swaps the editor — and blue is the codebase's established colour
                for "this text takes you somewhere". Orange stays for actions
                that change data. */}
            <span className={`truncate ${active ? 'font-semibold text-info-700' : 'text-info-700'}`}>
                {label}
            </span>
            <span
                className={`ml-auto flex items-center gap-1 text-2xs tabular-nums ${
                    errors ? 'text-danger-700 font-semibold' : complete ? 'text-success-700' : 'text-faint'
                }`}
            >
                {errors ? (
                    <>
                        <AlertCircle size={11} />
                        {errors} issue{errors !== 1 ? 's' : ''}
                    </>
                ) : (
                    <>
                        {complete && <Check size={11} />}
                        {filled}/{total}
                    </>
                )}
            </span>
        </button>
    )
}

export default React.memo(ScopeList)
