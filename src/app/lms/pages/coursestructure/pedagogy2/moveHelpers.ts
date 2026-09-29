"use client"

// Move up / move down for a hierarchy item (the ▲ ▼ that appear on a cell once
// Move is picked from its ⋮ menu, alongside drag-and-drop).
//
// Deliberately NOT a reuse of the drop handlers in dragDropHandlers.ts: those
// delete the moved item's I Do / We Do / You Do hours and its levels before
// saving the new order. A one-step swap keeps every hour. The only thing it
// can break is a MERGED cell, a pedagogy or level row whose hierarchy
// arrays span several table rows, because a merge must cover consecutive rows.
// So the swap is simulated first: the table is rebuilt with the new indexes,
// and only the merges whose rows stop being consecutive are removed.

import { createTableRowsImpl } from "./dataBuilders"

export type MoveLevel = "module" | "submodule" | "topic" | "subtopic"

export interface MoveDeps {
    modules: any[]
    subModules: any[]
    topics: any[]
    subTopics: any[]
    selectedCourse: any
    pedagogyViews: any[] | undefined
    levelsData: any[]
    updateModuleMutation: any
    updateSubModuleMutation: any
    updateTopicMutation: any
    updateSubTopicMutation: any
    deletePedagogyMutation: any
    deleteLevelMutation: any
    queryClient: any
    refetchModules: () => unknown
    refetchSubModules: () => unknown
    refetchTopics: () => unknown
    refetchSubTopics: () => unknown
}

export type MoveResult = { moved: boolean; unmerged: number; error?: string }

const byIndex = (a: any, b: any) => (a.index || 0) - (b.index || 0)

const listFor = (level: MoveLevel, deps: MoveDeps): any[] =>
    level === "module" ? deps.modules
        : level === "submodule" ? deps.subModules
            : level === "topic" ? deps.topics
                : deps.subTopics

/** The item's siblings in display order, the same grouping and sort
 *  createTableRowsImpl uses to lay the table out. */
export function siblingsOf(level: MoveLevel, id: string, deps: MoveDeps): any[] {
    const item = listFor(level, deps).find((x: any) => x._id === id)
    if (!item) return []
    const hasSubModules = (deps.selectedCourse?.courseHierarchy || [])
        .map((l: string) => l.toLowerCase()).includes("sub module")
    const sibs = level === "module" ? deps.modules
        : level === "submodule" ? deps.subModules.filter((s: any) => s.moduleId === item.moduleId)
            : level === "topic"
                ? deps.topics.filter((t: any) => hasSubModules ? t.subModuleId === item.subModuleId : t.moduleId === item.moduleId)
                : deps.subTopics.filter((s: any) => s.topicId === item.topicId)
    return [...sibs].sort(byIndex)
}

export function canMoveItem(level: MoveLevel, id: string, dir: -1 | 1, deps: MoveDeps): boolean {
    const sibs = siblingsOf(level, id, deps)
    const pos = sibs.findIndex((s: any) => s._id === id)
    return pos !== -1 && pos + dir >= 0 && pos + dir < sibs.length
}

/** Rows a merge covers, using the same matching rule as getAffectedRowIds
 *  in usePedagogyManagement: every listed level must contain the row's real
 *  id; placeholder ids pass through. */
function rowsCovered(rows: any[], ids: { module?: string[]; subModule?: string[]; topic?: string[]; subTopic?: string[] }): number[] {
    const real = (id: any) => id && !String(id).includes("placeholder")
    const out: number[] = []
    rows.forEach((row, i) => {
        const m = ids.module || [], sm = ids.subModule || [], t = ids.topic || [], st = ids.subTopic || []
        if (m.length && !m.includes(row.moduleId)) return
        if (sm.length) { if (real(row.subModuleId) && !sm.includes(row.subModuleId)) return }
        else if (real(row.subModuleId)) return
        if (t.length) { if (real(row.topicId) && !t.includes(row.topicId)) return }
        else if (real(row.topicId)) return
        if (st.length) { if (real(row.subtopicId) && !st.includes(row.subtopicId)) return }
        else if (real(row.subtopicId)) return
        out.push(i)
    })
    return out
}

const isMulti = (p: any) =>
    (p.module?.length || 0) > 1 || (p.subModule?.length || 0) > 1 ||
    (p.topic?.length || 0) > 1 || (p.subTopic?.length || 0) > 1

const consecutive = (idx: number[]) => idx.every((v, i) => i === 0 || v === idx[i - 1] + 1)

/** Merged pedagogy activities and merged levels that would no longer sit on
 *  consecutive rows in `rows`. */
export function brokenMerges(rows: any[], pedagogyViews: any[] | undefined, levelsData: any[]) {
    const activities: { activityType: "iDo" | "weDo" | "youDo"; itemId: string }[] = []
    for (const p of pedagogyViews?.[0]?.pedagogies || []) {
        if (!isMulti(p)) continue
        const covered = rowsCovered(rows, p)
        if (covered.length && consecutive(covered)) continue
        for (const t of ["iDo", "weDo", "youDo"] as const) {
            for (const a of p[t] || []) if (a?._id) activities.push({ activityType: t, itemId: a._id })
        }
    }
    const levels: string[] = []
    for (const l of levelsData || []) {
        if (!isMulti(l) || !l._id) continue
        const covered = rowsCovered(rows, l)
        if (!(covered.length && consecutive(covered))) levels.push(l._id)
    }
    return { activities, levels }
}

export async function moveItemImpl(level: MoveLevel, id: string, dir: -1 | 1, deps: MoveDeps): Promise<MoveResult> {
    const sibs = siblingsOf(level, id, deps)
    const pos = sibs.findIndex((s: any) => s._id === id)
    if (pos === -1 || pos + dir < 0 || pos + dir >= sibs.length) return { moved: false, unmerged: 0 }

    // Swap, then renumber the siblings 0..n-1. Siblings can share or skip
    // index values (legacy data, or the create path's max+1 guess), and a
    // plain swap of two equal indexes would move nothing.
    const order = [...sibs]
    ;[order[pos], order[pos + dir]] = [order[pos + dir], order[pos]]
    const newIndex = new Map(order.map((s: any, i: number) => [s._id, i]))
    const changed = order.filter((s: any) => (s.index || 0) !== newIndex.get(s._id))

    // Simulate the new layout to see which merges the swap would split.
    const patch = (list: any[]) => list.map((x: any) => (newIndex.has(x._id) ? { ...x, index: newIndex.get(x._id) } : x))
    const sim = {
        modules: level === "module" ? patch(deps.modules) : deps.modules,
        subModules: level === "submodule" ? patch(deps.subModules) : deps.subModules,
        topics: level === "topic" ? patch(deps.topics) : deps.topics,
        subTopics: level === "subtopic" ? patch(deps.subTopics) : deps.subTopics,
    }
    const newRows = createTableRowsImpl({ ...sim, selectedCourse: deps.selectedCourse })
    const broken = brokenMerges(newRows, deps.pedagogyViews, deps.levelsData)

    try {
        // Same payload shape the drop handlers send, so the update endpoints
        // see nothing new, only `index` differs.
        await Promise.all(changed.map((s: any) => {
            const index = newIndex.get(s._id)
            const base = { title: s.title, description: s.description, level: s.level, courses: s.courses, index, duration: s.duration }
            if (level === "module") return deps.updateModuleMutation.mutateAsync({ id: s._id, data: base })
            if (level === "submodule") return deps.updateSubModuleMutation.mutateAsync({ id: s._id, data: { ...base, moduleId: s.moduleId } })
            if (level === "topic") return deps.updateTopicMutation.mutateAsync({ id: s._id, data: { ...base, moduleId: s.moduleId, subModuleId: s.subModuleId } })
            return deps.updateSubTopicMutation.mutateAsync({ id: s._id, data: { ...base, topicId: s.topicId } })
        }))

        for (const a of broken.activities) await deps.deletePedagogyMutation.mutateAsync(a)
        for (const levelId of broken.levels) await deps.deleteLevelMutation.mutateAsync(levelId)

        await Promise.all([
            level === "module" ? deps.refetchModules()
                : level === "submodule" ? deps.refetchSubModules()
                    : level === "topic" ? deps.refetchTopics()
                        : deps.refetchSubTopics(),
        ])
        if (broken.activities.length || broken.levels.length) {
            deps.queryClient.invalidateQueries({ queryKey: ["pedagogyViews"] })
            deps.queryClient.invalidateQueries({ queryKey: ["levelViews"] })
        }
        return { moved: true, unmerged: broken.activities.length + broken.levels.length }
    } catch (error) {
        // A half-applied renumber is corrected by refetching the server's truth.
        deps.refetchModules(); deps.refetchSubModules(); deps.refetchTopics(); deps.refetchSubTopics()
        return { moved: false, unmerged: 0, error: error instanceof Error ? error.message : "Could not move the item" }
    }
}
