import { PATH_SEP, type DegreeView } from './types'

// A "scope" is one leaf of the WHERE column: a department, optionally narrowed to
// one of its sections. Semesters and their courses hang off scopes.
//
// This module is the ONLY place paths are constructed. Nothing anywhere splits a
// path back apart — names can contain anything, so parsing them is a bug waiting
// to happen. Keys are byte-identical to the ones the old tree produced
// ("B.E ▸ CSE ▸ 3", "B.E ▸ CSE ▸ A ▸ 3"), so stored data still round-trips.
export type Scope = { department: string; section: string | null }

export const scopePath = (degree: string, s: Scope): string =>
    s.section
        ? `${degree}${PATH_SEP}${s.department}${PATH_SEP}${s.section}`
        : `${degree}${PATH_SEP}${s.department}`

export const semesterPath = (degree: string, s: Scope, semester: string): string =>
    `${scopePath(degree, s)}${PATH_SEP}${semester}`

// The name of the level a section value sits under. Shown in labels so the
// hierarchy reads as "Civil ▸ Sections ▸ a" instead of "Civil ▸ a", where the
// two names look like peers and nothing says what the second one IS.
export const SECTION_LEVEL = 'Sections'

// "CSE" or "CSE ▸ Sections ▸ A" — what the WHERE column and the workbench
// heading show.
//
// This is LABEL ONLY and must never reach scopePath(). Paths are the stored keys
// for every course and batch ("B.E ▸ CSE ▸ A ▸ 3"); slipping an extra word into
// one would orphan every saved course under that scope, because nothing ever
// parses a path back apart to repair it. Label and path are two functions for
// precisely this reason — keep them that way.
export const scopeLabel = (s: Scope): string =>
    s.section
        ? `${s.department}${PATH_SEP}${SECTION_LEVEL}${PATH_SEP}${s.section}`
        : s.department

export const sameScope = (a: Scope | null, b: Scope | null): boolean =>
    !!a && !!b && a.department === b.department && a.section === b.section

// Every leaf of the degree, in display order: a department with sections
// contributes one scope per section, one without contributes itself.
export const allScopes = (degree: DegreeView | null): Scope[] => {
    if (!degree) return []
    return degree.departments.flatMap((department): Scope[] => {
        const sections = degree.sectionsFor(department)
        return sections.length
            ? sections.map((section) => ({ department, section }))
            : [{ department, section: null }]
    })
}

// Prefix matching for roll-ups. Never a bare startsWith — "CSE" must not match
// "CSE2"; only an exact hit or a true path descendant counts.
export const isUnder = (key: string, prefix: string): boolean =>
    key === prefix || key.startsWith(prefix + PATH_SEP)
