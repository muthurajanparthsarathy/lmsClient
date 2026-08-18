"use client"

// MergeHelpers: function bodies moved verbatim out of page.tsx during the split.
// Each keeps a same-named thin wrapper in the page, so every call site is
// unchanged; the values they close over arrive in one loosely-typed `deps`
// object (state and setters still live in the page).

import type React from "react"
import { toast } from "sonner"
import { pedagogyViewApi } from "@/apiServices/pedagogyAndModuleAdd/pedagogy"
import type { MergedCell, MergedLevel } from "./types"

export interface MergeHelpersDeps {
    activityTypes?: any;
    cellToDelete?: any;
    courses?: any;
    deletePedagogyMutation?: any;
    getAffectedRowIds?: any;
    levelsData?: any;
    mergedCells?: any;
    modules?: any;
    pedagogyViews?: any;
    pendingUnmerge?: any;
    queryClient?: any;
    selectedCourse?: any;
    selectedPedagogyTypes?: any;
    setCellToDelete?: any;
    setCourseHours?: any;
    setErrorMessage?: any;
    setIsPedagogyDeleteConfirm?: any;
    setIsUnmergeConfirm?: any;
    setLevelToDelete?: any;
    setMergedCells?: any;
    setPendingUnmerge?: any;
    setShowDeleteCellDialog?: any;
    setShowErrorDialog?: any;
    setShowLevelDeleteConfirmation?: any;
    setShowSuccessMessage?: any;
    setShowUnmergeDialog?: any;
    subModules?: any;
    subTopics?: any;
    tableRows?: any;
    token?: any;
    topics?: any;
    unmergeLevel?: any;
}

export async function confirmUnmergeImpl(deps: MergeHelpersDeps) {
    const { courses, deletePedagogyMutation, mergedCells, modules, pedagogyViews, pendingUnmerge, selectedCourse, setErrorMessage, setIsUnmergeConfirm, setMergedCells, setPendingUnmerge, setShowErrorDialog, setShowSuccessMessage, setShowUnmergeDialog, subModules, subTopics, token, topics } = deps
        if (!pendingUnmerge || !token || !selectedCourse) {
            setShowUnmergeDialog(false);
            return;
        }
        setIsUnmergeConfirm(true);

        try {
            const { type, activity, mergeIndex, hierarchyIds } = pendingUnmerge;
            const columnKey = `${type}-${activity}`;

            // For backend merges (mergeIndex = -2)
            if (mergeIndex === -2) {
                // Find the pedagogy item in the backend data that matches the hierarchy
                const pedagogyToUpdate = pedagogyViews?.[0];

                if (!pedagogyToUpdate) {
                    throw new Error("Pedagogy data not found");
                }

                // Find the matching pedagogy item
                const matchingPedagogyIndex = pedagogyToUpdate.pedagogies.findIndex((p: any) => {
                    const matchesType =
                        (type === "iDo" && p.iDo.some((i: any) => i.type === activity)) ||
                        (type === "weDo" && p.weDo.some((w: any) => w.type === activity)) ||
                        (type === "youDo" && p.youDo.some((y: any) => y.type === activity));

                    const matchesHierarchy =
                        JSON.stringify(p.module || []) === JSON.stringify(hierarchyIds?.modules || []) &&
                        JSON.stringify(p.subModule || []) === JSON.stringify(hierarchyIds?.subModules || []) &&
                        JSON.stringify(p.topic || []) === JSON.stringify(hierarchyIds?.topics || []) &&
                        JSON.stringify(p.subTopic || []) === JSON.stringify(hierarchyIds?.subTopics || []);

                    return matchesType && matchesHierarchy;
                });

                if (matchingPedagogyIndex !== -1) {
                    const matchingPedagogy = pedagogyToUpdate.pedagogies[matchingPedagogyIndex];

                    // Find the specific activity to delete
                    let activityToDelete;

                    if (type === "iDo") {
                        activityToDelete = matchingPedagogy.iDo.find((i: any) => i.type === activity);
                    } else if (type === "weDo") {
                        activityToDelete = matchingPedagogy.weDo.find((w: any) => w.type === activity);
                    } else {
                        activityToDelete = matchingPedagogy.youDo.find((y: any) => y.type === activity);
                    }

                    if (activityToDelete && activityToDelete._id) {
                        // Use deletePedagogyMutation to delete the specific activity
                        await deletePedagogyMutation.mutateAsync({
                            activityType: type,
                            itemId: activityToDelete._id
                        });
                    } else {
                        // If we can't find the specific activity, remove the entire pedagogy item
                        const updatedPedagogies = pedagogyToUpdate.pedagogies.filter((_: any, index: any) => index !== matchingPedagogyIndex);

                        await pedagogyViewApi.update(pedagogyViews[0]._id).mutationFn({
                            courses: selectedCourse._id,
                            pedagogies: updatedPedagogies
                        });
                    }
                }
            } else {
                // For frontend merges
                const mergeToRemove = mergedCells[columnKey]?.[mergeIndex];

                if (!mergeToRemove) {
                    throw new Error("Merge data not found");
                }

                // Find the pedagogy item in the backend data
                const pedagogyToUpdate = pedagogyViews?.[0];

                if (pedagogyToUpdate) {
                    // Find the matching pedagogy item
                    const matchingPedagogyIndex = pedagogyToUpdate.pedagogies.findIndex((p: any) => {
                        const matchesType =
                            (type === "iDo" && p.iDo.some((i: any) => i.type === activity)) ||
                            (type === "weDo" && p.weDo.some((w: any) => w.type === activity)) ||
                            (type === "youDo" && p.youDo.some((y: any) => y.type === activity));

                        const matchesHierarchy =
                            JSON.stringify(p.module || []) === JSON.stringify(mergeToRemove.hierarchyIds?.modules || []) &&
                            JSON.stringify(p.subModule || []) === JSON.stringify(mergeToRemove.hierarchyIds?.subModules || []) &&
                            JSON.stringify(p.topic || []) === JSON.stringify(mergeToRemove.hierarchyIds?.topics || []) &&
                            JSON.stringify(p.subTopic || []) === JSON.stringify(mergeToRemove.hierarchyIds?.subTopics || []);

                        return matchesType && matchesHierarchy;
                    });

                    if (matchingPedagogyIndex !== -1) {
                        const matchingPedagogy = pedagogyToUpdate.pedagogies[matchingPedagogyIndex];

                        // Find the specific activity to delete
                        let activityToDelete;

                        if (type === "iDo") {
                            activityToDelete = matchingPedagogy.iDo.find((i: any) => i.type === activity);
                        } else if (type === "weDo") {
                            activityToDelete = matchingPedagogy.weDo.find((w: any) => w.type === activity);
                        } else {
                            activityToDelete = matchingPedagogy.youDo.find((y: any) => y.type === activity);
                        }

                        if (activityToDelete && activityToDelete._id) {
                            // Use deletePedagogyMutation to delete the specific activity
                            await deletePedagogyMutation.mutateAsync({
                                activityType: type,
                                itemId: activityToDelete._id
                            });
                        } else {
                            // If we can't find the specific activity, remove the entire pedagogy item
                            const updatedPedagogies = pedagogyToUpdate.pedagogies.filter((_: any, index: any) => index !== matchingPedagogyIndex);

                            await pedagogyViewApi.update(pedagogyViews[0]._id).mutationFn({
                                courses: selectedCourse._id,
                                pedagogies: updatedPedagogies
                            });
                        }
                    }
                }

                // Update local state to remove the merge
                setMergedCells((prev: any) => ({
                    ...prev,
                    [columnKey]: prev[columnKey]?.filter((_: any, index: any) => index !== mergeIndex) || [],
                }));
            }

            setShowSuccessMessage(true);
            setTimeout(() => setShowSuccessMessage(false), 2000);
        } catch (error) {
            console.error("Error unmerging cells:", error);
            setErrorMessage(error instanceof Error ? error.message : "Failed to unmerge cells");
            setShowErrorDialog(true);
        } finally {
            setShowUnmergeDialog(false);
            setPendingUnmerge(null);
            setIsUnmergeConfirm(false);
        }
}

export function isCellMergedImpl(rowIndex: number, type: "iDo" | "weDo" | "youDo", activity: string, deps: MergeHelpersDeps) {
    const { activityTypes, getAffectedRowIds, mergedCells, modules, pedagogyViews, selectedPedagogyTypes, subModules, subTopics, tableRows, topics } = deps
        const actualType = selectedPedagogyTypes.includes("all")
            ? activityTypes["iDo"].includes(activity) ? "iDo"
                : activityTypes["weDo"].includes(activity) ? "weDo"
                    : "youDo"
            : type;

        const columnKey = `${type}-${activity}`;
        const merges = mergedCells[columnKey] || [];
        const row = tableRows[rowIndex];

        // First check backend pedagogy data for merged cells
        if (pedagogyViews && pedagogyViews.length > 0) {
            for (const view of pedagogyViews) {
                for (const pedagogy of view.pedagogies) {
                    const pedagogyModules = pedagogy.module || [];
                    const pedagogySubModules = pedagogy.subModule || [];
                    const pedagogyTopics = pedagogy.topic || [];
                    const pedagogySubTopics = pedagogy.subTopic || [];

                    // Check if this is a merged pedagogy (multiple IDs at any level)
                    const isMultiMerge = pedagogyModules.length > 1 || pedagogySubModules.length > 1 ||
                        pedagogyTopics.length > 1 || pedagogySubTopics.length > 1;

                    if (!isMultiMerge) continue;

                    // Check if this row matches the pedagogy hierarchy
                    const moduleMatch = pedagogyModules.length === 0 || pedagogyModules.includes(row.moduleId);
                    const subModuleMatch = pedagogySubModules.length === 0 ||
                        (!row.subModuleId || row.subModuleId.includes('placeholder')) ||
                        pedagogySubModules.includes(row.subModuleId);
                    const topicMatch = pedagogyTopics.length === 0 ||
                        (!row.topicId || row.topicId.includes('placeholder')) ||
                        pedagogyTopics.includes(row.topicId);
                    const subtopicMatch = pedagogySubTopics.length === 0 ||
                        (!row.subtopicId || row.subtopicId.includes('placeholder')) ||
                        pedagogySubTopics.includes(row.subtopicId);

                    if (moduleMatch && subModuleMatch && topicMatch && subtopicMatch) {
                        // Check if this specific activity type has data
                        const activityData = pedagogy[actualType]?.find((a: any) => a.type === activity);
                        if (activityData) {
                            // Find all affected rows for this pedagogy merge
                            const affectedRowIds = getAffectedRowIds(
                                pedagogyModules,
                                pedagogySubModules,
                                pedagogyTopics,
                                pedagogySubTopics,
                            );

                            const rowIndices = affectedRowIds
                                .map((rid: any) => tableRows.findIndex((r: any) => r.rowId === rid))
                                .filter((idx: any) => idx !== -1)
                                .sort((a: any, b: any) => a - b);

                            if (rowIndices.length > 0) {
                                return {
                                    isMerged: true,
                                    isStart: rowIndex === rowIndices[0],
                                    rowSpan: rowIndices.length,
                                    value: activityData.duration,
                                    mergeIndex: -2, // Backend merge (different from frontend merge)
                                    hierarchyIds: { // Add this
                                        modules: pedagogyModules,
                                        subModules: pedagogySubModules,
                                        topics: pedagogyTopics,
                                        subTopics: pedagogySubTopics,
                                    },
                                    type: actualType
                                };
                            }
                        }
                    }
                }
            }
        }

        // Then check frontend merged cells (existing logic)
        for (const merge of merges) {
            const mergeModules = merge.hierarchyIds?.modules || [];
            const mergeSubModules = merge.hierarchyIds?.subModules || [];
            const mergeTopics = merge.hierarchyIds?.topics || [];
            const mergeSubTopics = merge.hierarchyIds?.subTopics || [];

            // Check module level
            if (mergeModules.length > 0 && !mergeModules.includes(row.moduleId)) {
                continue; // Module doesn't match
            }

            // Check submodule level with hierarchical logic
            if (mergeSubModules.length > 0) {
                // If row has a submodule, it must match one of the specified submodules
                if (row.subModuleId && !row.subModuleId.includes('placeholder')) {
                    if (!mergeSubModules.includes(row.subModuleId)) {
                        continue; // Submodule doesn't match
                    }
                }
                // If row has no submodule (module-level row), it's still valid
            } else {
                // If no submodules specified but row has a real submodule, skip
                if (row.subModuleId && !row.subModuleId.includes('placeholder')) {
                    continue;
                }
            }

            // Check topic level with hierarchical logic
            if (mergeTopics.length > 0) {
                // If row has a topic, it must match one of the specified topics
                if (row.topicId && !row.topicId.includes('placeholder')) {
                    if (!mergeTopics.includes(row.topicId)) {
                        continue; // Topic doesn't match
                    }
                }
                // If row has no topic (higher-level row), it's still valid
            } else {
                // If no topics specified but row has a real topic, skip
                if (row.topicId && !row.topicId.includes('placeholder')) {
                    continue;
                }
            }

            // Check subtopic level with hierarchical logic
            if (mergeSubTopics.length > 0) {
                // If row has a subtopic, it must match one of the specified subtopics
                if (row.subtopicId && !row.subtopicId.includes('placeholder')) {
                    if (!mergeSubTopics.includes(row.subtopicId)) {
                        continue; // Subtopic doesn't match
                    }
                }
                // If row has no subtopic (higher-level row), it's still valid
            } else {
                // If no subtopics specified but row has a real subtopic, skip
                if (row.subtopicId && !row.subtopicId.includes('placeholder')) {
                    continue;
                }
            }

            // If we reached here, the row matches the merge hierarchy
            const rowIndices = merge.rowIds
                .map((rid: any) => tableRows.findIndex((r: any) => r.rowId === rid))
                .filter((idx: any) => idx !== -1)
                .sort((a: any, b: any) => a - b);

            if (rowIndices.length > 0) {
                return {
                    isMerged: true,
                    isStart: rowIndex === rowIndices[0],
                    rowSpan: rowIndices.length,
                    value: merge.value,
                    mergeIndex: merges.indexOf(merge),
                    hierarchyIds: merge.hierarchyIds,
                    type: actualType
                };
            }
        }

        return {
            isMerged: false,
            isStart: false,
            rowSpan: 1,
            value: 0,
            mergeIndex: -1,
            hierarchyIds: null,
            type: actualType
        };
}

export function isLevelMergedImpl(rowIndex: number, deps: MergeHelpersDeps) {
    const { getAffectedRowIds, levelsData, modules, subModules, subTopics, tableRows, topics } = deps
        const row = tableRows[rowIndex];

        // Check for backend level data
        const matchingLevel = levelsData.find((level: any) => {
            const levelModules = level.module || [];
            const levelSubModules = level.subModule || [];
            const levelTopics = level.topic || [];
            const levelSubTopics = level.subTopic || [];

            // Check module level
            if (levelModules.length > 0 && !levelModules.includes(row.moduleId)) {
                return false; // Module doesn't match
            }

            // Check submodule level with hierarchical logic
            if (levelSubModules.length > 0) {
                // If row has a submodule, it must match one of the specified submodules
                if (row.subModuleId && !row.subModuleId.includes('placeholder')) {
                    if (!levelSubModules.includes(row.subModuleId)) {
                        return false; // Submodule doesn't match
                    }
                }
                // If row has no submodule (module-level row), it's still valid
            } else {
                // If no submodules specified but row has a real submodule, skip
                if (row.subModuleId && !row.subModuleId.includes('placeholder')) {
                    return false;
                }
            }

            // Check topic level with hierarchical logic
            if (levelTopics.length > 0) {
                // If row has a topic, it must match one of the specified topics
                if (row.topicId && !row.topicId.includes('placeholder')) {
                    if (!levelTopics.includes(row.topicId)) {
                        return false; // Topic doesn't match
                    }
                }
                // If row has no topic (higher-level row), it's still valid
            } else {
                // If no topics specified but row has a real topic, skip
                if (row.topicId && !row.topicId.includes('placeholder')) {
                    return false;
                }
            }

            // Check subtopic level with hierarchical logic
            if (levelSubTopics.length > 0) {
                // If row has a subtopic, it must match one of the specified subtopics
                if (row.subtopicId && !row.subtopicId.includes('placeholder')) {
                    if (!levelSubTopics.includes(row.subtopicId)) {
                        return false; // Subtopic doesn't match
                    }
                }
                // If row has no subtopic (higher-level row), it's still valid
            } else {
                // If no subtopics specified but row has a real subtopic, skip
                if (row.subtopicId && !row.subtopicId.includes('placeholder')) {
                    return false;
                }
            }

            return true;
        });

        if (matchingLevel) {
            // Check if this is a merged level (multiple IDs at any level)
            const isMultiMerge = (matchingLevel.module && matchingLevel.module.length > 1) ||
                (matchingLevel.subModule && matchingLevel.subModule.length > 1) ||
                (matchingLevel.topic && matchingLevel.topic.length > 1) ||
                (matchingLevel.subTopic && matchingLevel.subTopic.length > 1);

            if (isMultiMerge) {
                // This is a merged level - find all affected rows
                const affectedRowIds = getAffectedRowIds(
                    matchingLevel.module || [],
                    matchingLevel.subModule || [],
                    matchingLevel.topic || [],
                    matchingLevel.subTopic || [],
                );

                const mergeRowIndices = affectedRowIds
                    .map((rid: any) => tableRows.findIndex((r: any) => r.rowId === rid))
                    .filter((idx: any) => idx !== -1)
                    .sort((a: any, b: any) => a - b);

                if (mergeRowIndices.length > 0) {
                    return {
                        isMerged: true,
                        isStart: rowIndex === mergeRowIndices[0],
                        rowSpan: mergeRowIndices.length,
                        value: matchingLevel.level,
                        mergeIndex: -1, // Backend merge
                        hierarchyIds: {
                            modules: matchingLevel.module || [],
                            subModules: matchingLevel.subModule || [],
                            topics: matchingLevel.topic || [],
                            subTopics: matchingLevel.subTopic || [],
                        },
                    };
                }
            } else {
                // This is a single level
                return {
                    isMerged: false,
                    isStart: false,
                    rowSpan: 1,
                    value: matchingLevel.level,
                    mergeIndex: -1,
                    hierarchyIds: null,
                };
            }
        }

        // If no level found in database, check individual item level
        return {
            isMerged: false,
            isStart: false,
            rowSpan: 1,

            mergeIndex: -1,
            hierarchyIds: null,
        };
}

export function handleDeleteLevelImpl(row: any, mergeInfo: any, deps: MergeHelpersDeps) {
    const { levelsData, setErrorMessage, setLevelToDelete, setShowErrorDialog, setShowLevelDeleteConfirmation, unmergeLevel } = deps
        if (mergeInfo.isMerged) {
            // Handle merged level deletion
            if (mergeInfo.mergeIndex !== -1) {
                unmergeLevel(mergeInfo.mergeIndex);
            } else {
                // Find backend level data using the same logic as isLevelMerged
                const backendLevel = levelsData.find((l: any) => {
                    const levelModules = l.module || [];
                    const levelSubModules = l.subModule || [];
                    const levelTopics = l.topic || [];
                    const levelSubTopics = l.subTopic || [];

                    // Check module level
                    if (levelModules.length > 0 && !levelModules.includes(row.moduleId)) {
                        return false; // Module doesn't match
                    }

                    // Check submodule level with hierarchical logic
                    if (levelSubModules.length > 0) {
                        // If row has a submodule, it must match one of the specified submodules
                        if (row.subModuleId && !row.subModuleId.includes('placeholder')) {
                            if (!levelSubModules.includes(row.subModuleId)) {
                                return false; // Submodule doesn't match
                            }
                        }
                        // If row has no submodule (module-level row), it's still valid
                    } else {
                        // If no submodules specified but row has a real submodule, skip
                        if (row.subModuleId && !row.subModuleId.includes('placeholder')) {
                            return false;
                        }
                    }

                    // Check topic level with hierarchical logic
                    if (levelTopics.length > 0) {
                        // If row has a topic, it must match one of the specified topics
                        if (row.topicId && !row.topicId.includes('placeholder')) {
                            if (!levelTopics.includes(row.topicId)) {
                                return false; // Topic doesn't match
                            }
                        }
                        // If row has no topic (higher-level row), it's still valid
                    } else {
                        // If no topics specified but row has a real topic, skip
                        if (row.topicId && !row.topicId.includes('placeholder')) {
                            return false;
                        }
                    }

                    // Check subtopic level with hierarchical logic
                    if (levelSubTopics.length > 0) {
                        // If row has a subtopic, it must match one of the specified subtopics
                        if (row.subtopicId && !row.subtopicId.includes('placeholder')) {
                            if (!levelSubTopics.includes(row.subtopicId)) {
                                return false; // Subtopic doesn't match
                            }
                        }
                        // If row has no subtopic (higher-level row), it's still valid
                    } else {
                        // If no subtopics specified but row has a real subtopic, skip
                        if (row.subtopicId && !row.subtopicId.includes('placeholder')) {
                            return false;
                        }
                    }

                    return true;
                });

                if (backendLevel) {
                    unmergeLevel(-1, backendLevel);
                } else {
                    setErrorMessage("Could not find level data to delete");
                    setShowErrorDialog(true);
                }
            }
        } else {
            // Handle single level deletion with filtered hierarchy
            const filterPlaceholders = (ids: string[] = []) => {
                return ids.filter(id => id && !id.includes('placeholder'));
            };

            setLevelToDelete({
                id: row.rowId,
                level: mergeInfo.value,
                hierarchy: {
                    module: filterPlaceholders([row.moduleId]),
                    subModule: filterPlaceholders(row.subModuleId ? [row.subModuleId] : []),
                    topic: filterPlaceholders(row.topicId ? [row.topicId] : []),
                    subTopic: filterPlaceholders(row.subtopicId ? [row.subtopicId] : [])
                }
            });
            setShowLevelDeleteConfirmation(true);
        }
}

export async function confirmCellDeleteImpl(deps: MergeHelpersDeps) {
    const { cellToDelete, deletePedagogyMutation, pedagogyViews, queryClient, selectedCourse, setCellToDelete, setCourseHours, setErrorMessage, setIsPedagogyDeleteConfirm, setShowDeleteCellDialog, setShowErrorDialog, setShowSuccessMessage } = deps
        if (!cellToDelete) return;

        const { moduleId, topicId, subtopicId, subModuleId, type, activity } = cellToDelete;
        setIsPedagogyDeleteConfirm(true);
        try {


            // Find the pedagogy item to delete
            const pedagogyToUpdate = pedagogyViews?.[0];
            if (!pedagogyToUpdate) {
                throw new Error("Pedagogy data not found");
            }

            // Find the matching pedagogy item
            const matchingPedagogy = pedagogyToUpdate.pedagogies.find((p: any) => {
                const hierarchyLevels = selectedCourse?.courseHierarchy.map((l: any) => l.toLowerCase()) || [];

                // Determine effective IDs based on hierarchy
                const effectiveSubtopicId = hierarchyLevels.includes('sub topic')
                    ? subtopicId
                    : hierarchyLevels.includes('topic')
                        ? `${topicId}-default-subtopic`
                        : `${moduleId}-default-subtopic`;

                const effectiveTopicId = hierarchyLevels.includes('topic')
                    ? topicId
                    : `${moduleId}-default-topic`;

                // Check if this pedagogy matches the hierarchy
                const matchesModule = !p.module?.length || p.module.includes(moduleId);
                const matchesSubModule = !p.subModule?.length ||
                    (hierarchyLevels.includes('sub module') && p.subModule.includes(subModuleId));
                const matchesTopic = !p.topic?.length ||
                    (!topicId || p.topic.includes(effectiveTopicId));
                const matchesSubTopic = !p.subTopic?.length ||
                    (!subtopicId || p.subTopic.includes(effectiveSubtopicId));

                // Check if it matches the activity type
                const matchesType =
                    (type === "iDo" && p.iDo.some((i: any) => i.type === activity)) ||
                    (type === "weDo" && p.weDo.some((w: any) => w.type === activity)) ||
                    (type === "youDo" && p.youDo.some((y: any) => y.type === activity));

                return matchesModule && matchesSubModule && matchesTopic && matchesSubTopic && matchesType;
            });

            if (matchingPedagogy) {
                // Find the specific activity to delete
                let activityToDelete;

                if (type === "iDo") {
                    activityToDelete = matchingPedagogy.iDo.find((i: any) => i.type === activity);
                } else if (type === "weDo") {
                    activityToDelete = matchingPedagogy.weDo.find((w: any) => w.type === activity);
                } else {
                    activityToDelete = matchingPedagogy.youDo.find((y: any) => y.type === activity);
                }

                if (activityToDelete && activityToDelete._id) {
                    // Call the delete API
                    await deletePedagogyMutation.mutateAsync({
                        activityType: type,
                        itemId: activityToDelete._id
                    });
                    queryClient.invalidateQueries({ queryKey: ['pedagogyViews'] });
                    // Update local state after successful deletion
                    setCourseHours((prev: any) => ({
                        ...prev,
                        [moduleId]: {
                            ...prev[moduleId],
                            [topicId]: {
                                ...prev[moduleId]?.[topicId],
                                [subtopicId]: {
                                    ...prev[moduleId]?.[topicId]?.[subtopicId],
                                    [type]: {
                                        ...prev[moduleId]?.[topicId]?.[subtopicId]?.[type],
                                        [activity]: 0
                                    }
                                }
                            }
                        }
                    }));
                }
            }
            setShowSuccessMessage(true);
        } catch (error) {
            console.error("Error deleting cell value:", error);
            setErrorMessage(error instanceof Error ? error.message : "Failed to delete cell value");
            setShowErrorDialog(true);
        } finally {
            setShowDeleteCellDialog(false);
            setIsPedagogyDeleteConfirm(false);
            setCellToDelete(null);
        }
}
