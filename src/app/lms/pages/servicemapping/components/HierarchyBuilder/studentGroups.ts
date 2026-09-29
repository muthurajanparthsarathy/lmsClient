import type { SemesterStudentGroups, ServiceMapping } from '../../api/serviceMappingService'
import { PATH_SEP } from './types'

export type StudentSection = SemesterStudentGroups['sections'][number]
export type StudentGroupStore = Record<string, StudentSection[]>

export const departmentSemesterPath = (degree: string, department: string, semester: string) =>
    [degree, department, semester].join(PATH_SEP)

export function restoreStudentGroups(mapping: ServiceMapping | null): StudentGroupStore {
    if (!mapping) return {}
    const groups: StudentGroupStore = Object.fromEntries((mapping.studentGroups || []).map((group) => [group.path,
        group.sections.map((section) => ({ name: section.name, batches: [...section.batches] })),
    ]))
    const values = (level: string, group?: string) => mapping.masterData.find((entry) => entry.level === level && entry.group === group)?.values || []
    values('Degree').forEach((degree) => values('Department', degree).forEach((department) => {
        const base = [degree, department].join(PATH_SEP)
        values('Semester', degree).forEach((semester) => {
            const path = departmentSemesterPath(degree, department, semester)
            if (groups[path] !== undefined) return
            groups[path] = values('Section', base).map((name) => ({ name, batches: [] }))
        })
    }))
    return groups
}

export function studentGroupErrors(groups: StudentGroupStore): Record<string, string> {
    const errors: Record<string, string> = {}
    Object.entries(groups).forEach(([path, sections]) => {
        const names = new Set<string>()
        sections.forEach((section, i) => {
            const key = `groups:${path}:${i}`
            const name = section.name.trim().toLowerCase().replace(/^section\s+/, '')
            if (!name) errors[`${key}:name`] = 'Enter a section name'
            else if (names.has(name)) errors[`${key}:name`] = 'Section already added'
            names.add(name)
            const batches = new Set<string>()
            section.batches.forEach((batch, bi) => {
                const value = batch.trim().toLowerCase()
                if (!value) errors[`${key}:batch:${bi}`] = 'Enter a batch name'
                else if (batches.has(value)) errors[`${key}:batch:${bi}`] = 'Batch already added in this section'
                batches.add(value)
            })
        })
    })
    return errors
}

export const sectionLabel = (name: string) => /^section\s/i.test(name) ? name : `Section ${name}`

export function nextSectionName(sections: StudentSection[]): string {
    const taken = new Set(sections.map((s) => sectionLabel(s.name).toLowerCase()))
    let index = 0
    while (taken.has(sectionLabel(index < 26 ? String.fromCharCode(65 + index) : String(index + 1)).toLowerCase())) index++
    return index < 26 ? String.fromCharCode(65 + index) : String(index + 1)
}
