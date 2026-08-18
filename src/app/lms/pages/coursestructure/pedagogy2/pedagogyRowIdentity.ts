"use client"

// Which hierarchy node a pedagogy (hours) row actually belongs to.
//
// A row stores an id for EVERY level of the course hierarchy, not just its own:
// hours typed into a topic's cell are saved as
// { module: [m], subModule: [sm], topic: [t], iDo: [...] }.
// So "pedagogy.module.includes(moduleId)" is true for every row in the module —
// every topic and subtopic under it — not just the module's own hours.
//
// Editing an item used that containment test to decide which rows were "its own"
// and therefore safe to replace or delete. Editing a module's title consequently
// collapsed every descendant row into one, wiping the course's hours.
//
// A row belongs to exactly one node: the DEEPEST level it populates. That is the
// same identity rule the server uses to match rows in updatePedagogyView.

export type HierarchyType = "module" | "submodule" | "topic" | "subtopic"

const LEVEL_FIELD: Record<HierarchyType, "module" | "subModule" | "topic" | "subTopic"> = {
    module: "module",
    submodule: "subModule",
    topic: "topic",
    subtopic: "subTopic",
}

/** Real ids only — placeholder rows stand in for absent hierarchy levels. */
function realIds(value: any): string[] {
    if (!Array.isArray(value)) return []
    return value.filter((id: any) => typeof id === "string" && id && !id.includes("placeholder"))
}

/** The deepest hierarchy level this row populates, i.e. the node that owns it. */
export function deepestLevelOf(pedagogy: any): HierarchyType | "none" {
    if (!pedagogy) return "none"
    if (realIds(pedagogy.subTopic).length) return "subtopic"
    if (realIds(pedagogy.topic).length) return "topic"
    if (realIds(pedagogy.subModule).length) return "submodule"
    if (realIds(pedagogy.module).length) return "module"
    return "none"
}

/**
 * True when `pedagogy` holds this exact node's own hours — its deepest level is
 * `type` and names `id`. Descendant rows (a topic's hours while editing the
 * module) and unrelated rows both return false.
 */
export function isOwnPedagogyRow(pedagogy: any, type?: HierarchyType | null, id?: string | null): boolean {
    if (!pedagogy || !type || !id) return false
    if (deepestLevelOf(pedagogy) !== type) return false
    return realIds(pedagogy[LEVEL_FIELD[type]]).includes(id)
}

/** Same rule for level rows, which carry the identical hierarchy id arrays. */
export function isOwnLevelRow(level: any, type?: HierarchyType | null, id?: string | null): boolean {
    return isOwnPedagogyRow(level, type, id)
}
