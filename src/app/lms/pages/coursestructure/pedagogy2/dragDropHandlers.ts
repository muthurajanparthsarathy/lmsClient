"use client"

// DragDrop: function bodies moved verbatim out of page.tsx during the split.
// Each keeps a same-named thin wrapper in the page, so every call site is
// unchanged; the values they close over arrive in one loosely-typed `deps`
// object (state and setters still live in the page).

import type React from "react"
import { moduleApi } from "@/app/lms/pages/coursestructure/pedagogy2/api/addmodule"
import { subModuleApi } from "@/app/lms/pages/coursestructure/pedagogy2/api/addsubmodule"
import { topicApi } from "@/app/lms/pages/coursestructure/pedagogy2/api/addtopic"
import { subTopicApi } from "@/app/lms/pages/coursestructure/pedagogy2/api/addsubtopic"
import type { Topic, SubTopic } from "./types"

export interface DragDropDeps {
    courses?: any;
    deleteLevelMutation?: any;
    deletePedagogyMerges?: any;
    deletePedagogyMutation?: any;
    levelViewId?: any;
    levelsData?: any;
    mergedCells?: any;
    mergedLevels?: any;
    modules?: any;
    pedagogyMutation?: any;
    pedagogyViews?: any;
    queryClient?: any;
    refetchModules?: any;
    refetchSubModules?: any;
    refetchSubTopics?: any;
    refetchTopicSubTopics?: any;
    refetchTopics?: any;
    selectedCourse?: any;
    selectedTopicForSubTopic?: any;
    setDragOverId?: any;
    setDraggingModuleId?: any;
    setDraggingSubModuleId?: any;
    setDraggingSubtopicId?: any;
    setDraggingTopicId?: any;
    setErrorMessage?: any;
    setMergedCells?: any;
    setMergedLevels?: any;
    setShowErrorDialog?: any;
    setShowSuccessMessage?: any;
    subModules?: any;
    subTopics?: any;
    tableRows?: any;
    token?: any;
    topics?: any;
    updateModuleMutation?: any;
    updateSubModuleMutation?: any;
    updateSubTopicMutation?: any;
    updateTopicMutation?: any;
}

export async function handleModuleDropImpl(e: React.DragEvent, targetModuleId: string, deps: DragDropDeps) {
    const { courses, deleteLevelMutation, deletePedagogyMutation, levelViewId, levelsData, mergedCells, mergedLevels, modules, pedagogyViews, queryClient, refetchModules, selectedCourse, setDragOverId, setDraggingModuleId, setErrorMessage, setMergedCells, setMergedLevels, setShowErrorDialog, setShowSuccessMessage, token, updateModuleMutation } = deps
        e.preventDefault();
        const draggedModuleId = e.dataTransfer.getData('text/plain');
        setDraggingModuleId(null);
        setDragOverId(null);

        if (draggedModuleId === targetModuleId || !token || !selectedCourse) return;

        try {
            // 1. Optimistically update local state first for instant UI response
            const currentModules = [...modules];
            const draggedModule = currentModules.find(m => m._id === draggedModuleId);
            const targetModule = currentModules.find(m => m._id === targetModuleId);

            if (!draggedModule || !targetModule) return;

            // Create new array with updated order
            const reorderedModules = [...modules];
            const draggedIndex = reorderedModules.findIndex(m => m._id === draggedModuleId);
            const targetIndex = reorderedModules.findIndex(m => m._id === targetModuleId);

            // Remove dragged module and insert at target position
            const [removed] = reorderedModules.splice(draggedIndex, 1);
            reorderedModules.splice(targetIndex, 0, removed);

            // Update indexes for all modules
            const updatedModules = reorderedModules.map((module, index) => ({
                ...module,
                index: index
            }));

            // Immediately update state for instant UI update
            // setModules(updatedModules);

            // 2. Clear any merged cells/pedagogy data containing this module
            const updatedMergedCells = { ...mergedCells };
            Object.keys(updatedMergedCells).forEach(key => {
                updatedMergedCells[key] = updatedMergedCells[key].filter((merge: any) =>
                    !merge.hierarchyIds?.modules.includes(draggedModuleId)
                );
            });
            setMergedCells(updatedMergedCells);

            const updatedMergedLevels = mergedLevels.filter((merge: any) =>
                !merge.hierarchyIds.modules.includes(draggedModuleId)
            );
            setMergedLevels(updatedMergedLevels);

            // 3. Delete backend pedagogy data for this module
            const pedagogyToUpdate = pedagogyViews?.[0];
            if (pedagogyToUpdate) {
                const pedagogiesToDelete = pedagogyToUpdate.pedagogies.filter((pedagogy: any) =>
                    pedagogy.module?.includes(draggedModuleId)
                );

                // Delete each pedagogy from backend
                for (const pedagogy of pedagogiesToDelete) {
                    // Delete I Do activities
                    for (const activity of pedagogy.iDo) {
                        await deletePedagogyMutation.mutateAsync({
                            activityType: "iDo",
                            itemId: activity._id
                        });
                    }
                    // Delete We Do activities
                    for (const activity of pedagogy.weDo) {
                        await deletePedagogyMutation.mutateAsync({
                            activityType: "weDo",
                            itemId: activity._id
                        });
                    }
                    // Delete You Do activities
                    for (const activity of pedagogy.youDo) {
                        await deletePedagogyMutation.mutateAsync({
                            activityType: "youDo",
                            itemId: activity._id
                        });
                    }
                }
            }

            // 4. Delete level data from backend for this module
            if (levelViewId) {
                const levelsToDelete = levelsData.filter((level: { module: string | string[]; }) =>
                    level.module?.includes(draggedModuleId)
                );

                for (const level of levelsToDelete) {
                    if (level._id) {
                        await deleteLevelMutation.mutateAsync(level._id);
                    }
                }


            }
            queryClient.setQueryData(moduleApi.getAll().queryKey, updatedModules);
            // 5. Update module order in backend
            const updates = updatedModules.map(module =>
                updateModuleMutation.mutateAsync({
                    id: module._id,
                    data: {
                        title: module.title,
                        description: module.description,
                        level: module.level,
                        courses: module.courses,
                        index: module.index,
                        duration: module.duration
                    }
                })
            );


            await Promise.all(updates);

            // 6. Refresh queries to ensure consistency
            queryClient.invalidateQueries({ queryKey: ['pedagogyViews'] });
            queryClient.invalidateQueries({ queryKey: ['levelViews'] });

            setShowSuccessMessage(true);
            setTimeout(() => setShowSuccessMessage(false), 2000);

        } catch (error) {
            console.error("Failed to reorder modules:", error);

            // Rollback on error - refetch original data
            try {
                refetchModules();


            } catch (fetchError) {
                console.error("Failed to rollback:", fetchError);
            }

            setErrorMessage(error instanceof Error ? error.message : "Failed to reorder modules");
            setShowErrorDialog(true);
        }
}

export async function handleSubModuleDropImpl(e: React.DragEvent, targetSubModuleId: string, deps: DragDropDeps) {
    const { courses, deleteLevelMutation, deletePedagogyMutation, levelViewId, levelsData, mergedCells, mergedLevels, modules, pedagogyViews, queryClient, refetchSubModules, selectedCourse, setDragOverId, setDraggingSubModuleId, setErrorMessage, setMergedCells, setMergedLevels, setShowErrorDialog, setShowSuccessMessage, subModules, token, updateSubModuleMutation } = deps
        e.preventDefault();
        const dragData = JSON.parse(e.dataTransfer.getData('application/json'));
        const draggedSubModuleId = dragData.id;
        setDraggingSubModuleId(null);
        setDragOverId(null);

        if (!token || !selectedCourse) return;

        try {
            // 1. Optimistically update local state first (like handleModuleDrop)
            const currentSubModules = [...subModules];
            const draggedSubModule = subModules.find((sm: any) => sm._id === draggedSubModuleId);
            const targetSubModule = subModules?.find((sm: any) => sm._id === targetSubModuleId);
            const targetParentId = targetSubModule?.moduleId;
            if (!draggedSubModule) return;
            const isChangingModule = draggedSubModule.moduleId !== targetParentId;
            const isDroppingOnEmptyCell = targetSubModuleId.includes('placeholder') || targetSubModuleId.includes('none') || targetSubModuleId.includes('default');

            if (isDroppingOnEmptyCell) {
                // For empty cells, we need to find the parent module
                const moduleId = targetSubModuleId.split('-')[0]; // Extract module ID from empty cell ID

                if (!moduleId) {
                    setErrorMessage("Cannot determine parent module for this empty cell");
                    setShowErrorDialog(true);
                    return;
                }

                const targetModule = modules.find((m: any) => m._id === moduleId);
                if (!targetModule) {
                    setErrorMessage("Parent module not found for this empty cell");
                    setShowErrorDialog(true);
                    return;
                }

                // Get all submodules in the target module to calculate new index
                const targetModuleSubModules = subModules
                    .filter((sm: any) => sm.moduleId === moduleId)
                    .sort((a: any, b: any) => (a.index || 0) - (b.index || 0));

                const newIndex = targetModuleSubModules.length > 0
                    ? Math.max(...targetModuleSubModules.map((sm: any) => sm.index || 0)) + 1
                    : 0;

                const updatedSubModule = {
                    ...draggedSubModule,
                    moduleId: moduleId,
                    index: newIndex
                };

                // Update backend
                await updateSubModuleMutation.mutateAsync({
                    id: draggedSubModuleId,
                    data: updatedSubModule
                });

                // Clean up pedagogy and level data (same as before)
                // ... (rest of the cleanup code)
                const updatedMergedCells = { ...mergedCells };
                Object.keys(updatedMergedCells).forEach(key => {
                    updatedMergedCells[key] = updatedMergedCells[key].filter((merge: any) =>
                        !merge.hierarchyIds?.subModules.includes(draggedSubModuleId)
                    );
                });
                setMergedCells(updatedMergedCells);

                const updatedMergedLevels = mergedLevels.filter((merge: any) =>
                    !merge.hierarchyIds.subModules.includes(draggedSubModuleId)
                );
                setMergedLevels(updatedMergedLevels);

                // Delete backend pedagogy data
                const pedagogyToUpdate = pedagogyViews?.[0];
                if (pedagogyToUpdate) {
                    const pedagogiesToDelete = pedagogyToUpdate.pedagogies.filter((pedagogy: any) =>
                        pedagogy.subModule?.includes(draggedSubModuleId)
                    );

                    for (const pedagogy of pedagogiesToDelete) {
                        for (const activity of pedagogy.iDo) {
                            await deletePedagogyMutation.mutateAsync({
                                activityType: "iDo",
                                itemId: activity._id
                            });
                        }
                        for (const activity of pedagogy.weDo) {
                            await deletePedagogyMutation.mutateAsync({
                                activityType: "weDo",
                                itemId: activity._id
                            });
                        }
                        for (const activity of pedagogy.youDo) {
                            await deletePedagogyMutation.mutateAsync({
                                activityType: "youDo",
                                itemId: activity._id
                            });
                        }
                    }
                }

                // Delete level data from backend
                if (levelViewId) {
                    const levelsToDelete = levelsData.filter((level: { subModule: string | string[]; }) =>
                        level.subModule?.includes(draggedSubModuleId)
                    );

                    for (const level of levelsToDelete) {
                        if (level._id) {
                            await deleteLevelMutation.mutateAsync(level._id);
                        }
                    }
                }

                // Refresh data
                await refetchSubModules();

            } else {
                if (isChangingModule) {
                    // Moving to a different module - update the moduleId

                    // Get all submodules in the target module to calculate new index
                    const targetModuleSubModules = subModules
                        .filter((sm: any) => sm.moduleId === targetParentId)
                        .sort((a: any, b: any) => (a.index || 0) - (b.index || 0));

                    const newIndex = targetModuleSubModules.length > 0
                        ? Math.max(...targetModuleSubModules.map((sm: any) => sm.index || 0)) + 1
                        : 0;

                    const updatedSubModule = {
                        ...draggedSubModule,
                        moduleId: targetParentId,
                        index: newIndex
                    };

                    // Update backend
                    await updateSubModuleMutation.mutateAsync({
                        id: draggedSubModuleId,
                        data: updatedSubModule
                    });

                    // Clean up pedagogy and level data for the moved submodule
                    // (Same cleanup as in your original same-parent logic)
                    const updatedMergedCells = { ...mergedCells };
                    Object.keys(updatedMergedCells).forEach(key => {
                        updatedMergedCells[key] = updatedMergedCells[key].filter((merge: any) =>
                            !merge.hierarchyIds?.subModules.includes(draggedSubModuleId)
                        );
                    });
                    setMergedCells(updatedMergedCells);

                    const updatedMergedLevels = mergedLevels.filter((merge: any) =>
                        !merge.hierarchyIds.subModules.includes(draggedSubModuleId)
                    );
                    setMergedLevels(updatedMergedLevels);

                    // Delete backend pedagogy data
                    const pedagogyToUpdate = pedagogyViews?.[0];
                    if (pedagogyToUpdate) {
                        const pedagogiesToDelete = pedagogyToUpdate.pedagogies.filter((pedagogy: any) =>
                            pedagogy.subModule?.includes(draggedSubModuleId)
                        );

                        for (const pedagogy of pedagogiesToDelete) {
                            for (const activity of pedagogy.iDo) {
                                await deletePedagogyMutation.mutateAsync({
                                    activityType: "iDo",
                                    itemId: activity._id
                                });
                            }
                            for (const activity of pedagogy.weDo) {
                                await deletePedagogyMutation.mutateAsync({
                                    activityType: "weDo",
                                    itemId: activity._id
                                });
                            }
                            for (const activity of pedagogy.youDo) {
                                await deletePedagogyMutation.mutateAsync({
                                    activityType: "youDo",
                                    itemId: activity._id
                                });
                            }
                        }
                    }

                    // Delete level data from backend
                    if (levelViewId) {
                        const levelsToDelete = levelsData.filter((level: { subModule: string | string[]; }) =>
                            level.subModule?.includes(draggedSubModuleId)
                        );

                        for (const level of levelsToDelete) {
                            if (level._id) {
                                await deleteLevelMutation.mutateAsync(level._id);
                            }
                        }
                    }

                    // Refresh data
                    await refetchSubModules();
                } else {
                    // Reorder submodules (optimistic update)
                    const moduleSubModules = currentSubModules
                        .filter(sm => sm.moduleId === draggedSubModule.moduleId)
                        .sort((a, b) => (a.index || 0) - (b.index || 0));

                    const draggedIndex = moduleSubModules.findIndex(sm => sm._id === draggedSubModuleId);
                    const targetIndex = moduleSubModules.findIndex(sm => sm._id === targetSubModuleId);

                    const reorderedSubModules = [...moduleSubModules];
                    const [removed] = reorderedSubModules.splice(draggedIndex, 1);
                    reorderedSubModules.splice(targetIndex, 0, removed);

                    const updatedSubModules = reorderedSubModules.map((subModule, index) => ({
                        ...subModule,
                        index: index
                    }));

                    // Merge with existing submodules outside this module (if any)
                    const finalSubModules = currentSubModules.map(sm => {
                        const updated = updatedSubModules.find(usm => usm._id === sm._id);
                        return updated || sm;
                    });

                    // 2. Clean up merged cells & pedagogy data (now happens after UI update)
                    const updatedMergedCells = { ...mergedCells };
                    Object.keys(updatedMergedCells).forEach(key => {
                        updatedMergedCells[key] = updatedMergedCells[key].filter((merge: any) =>
                            !merge.hierarchyIds?.subModules.includes(draggedSubModuleId)
                        );
                    });
                    setMergedCells(updatedMergedCells);

                    const updatedMergedLevels = mergedLevels.filter((merge: any) =>
                        !merge.hierarchyIds.subModules.includes(draggedSubModuleId)
                    );
                    setMergedLevels(updatedMergedLevels);

                    // 3. Delete backend pedagogy data
                    const pedagogyToUpdate = pedagogyViews?.[0];
                    if (pedagogyToUpdate) {
                        const pedagogiesToDelete = pedagogyToUpdate.pedagogies.filter((pedagogy: any) =>
                            pedagogy.subModule?.includes(draggedSubModuleId)
                        );

                        for (const pedagogy of pedagogiesToDelete) {
                            for (const activity of pedagogy.iDo) {
                                await deletePedagogyMutation.mutateAsync({
                                    activityType: "iDo",
                                    itemId: activity._id
                                });
                            }
                            for (const activity of pedagogy.weDo) {
                                await deletePedagogyMutation.mutateAsync({
                                    activityType: "weDo",
                                    itemId: activity._id
                                });
                            }
                            for (const activity of pedagogy.youDo) {
                                await deletePedagogyMutation.mutateAsync({
                                    activityType: "youDo",
                                    itemId: activity._id
                                });
                            }
                        }
                    }

                    // 4. Delete level data from backend
                    if (levelViewId) {
                        const levelsToDelete = levelsData.filter((level: { subModule: string | string[]; }) =>
                            level.subModule?.includes(draggedSubModuleId)
                        );

                        for (const level of levelsToDelete) {
                            if (level._id) {
                                await deleteLevelMutation.mutateAsync(level._id);
                            }
                        }


                    }
                    queryClient.setQueryData(subModuleApi.getAll().queryKey, finalSubModules);
                    // 5. Update backend with new order
                    const updates = updatedSubModules.map(subModule =>
                        updateSubModuleMutation.mutateAsync({
                            id: subModule._id,
                            data: {
                                title: subModule.title,
                                description: subModule.description,
                                level: subModule.level,
                                moduleId: subModule.moduleId,
                                courses: subModule.courses,
                                index: subModule.index,
                                duration: subModule.duration
                            }
                        })
                    );

                    await Promise.all(updates);
                }
            }
            setShowSuccessMessage(true);
            setTimeout(() => setShowSuccessMessage(false), 2000);
        } catch (error) {
            console.error("Failed to reorder submodules:", error);
            setErrorMessage(error instanceof Error ? error.message : "Failed to reorder submodules");
            setShowErrorDialog(true);

            // Rollback: Refetch original data
            queryClient.invalidateQueries({ queryKey: subModuleApi.getAll().queryKey });
        }
}

export async function handleTopicDropImpl(e: React.DragEvent, targetTopicId: string, deps: DragDropDeps) {
    const { courses, deleteLevelMutation, deletePedagogyMerges, deletePedagogyMutation, levelViewId, levelsData, mergedCells, mergedLevels, modules, pedagogyViews, queryClient, refetchTopics, selectedCourse, setDragOverId, setDraggingTopicId, setErrorMessage, setMergedCells, setMergedLevels, setShowErrorDialog, setShowSuccessMessage, subModules, tableRows, token, topics, updateTopicMutation } = deps
        e.preventDefault();
        const dragData = JSON.parse(e.dataTransfer.getData('application/json'));
        const draggedTopicId = dragData.id;
        setDraggingTopicId(null);
        setDragOverId(null);

        if (!token || !selectedCourse) return;

        try {
            // 1. Optimistically update local state first (like handleSubModuleDrop)
            const currentTopics = queryClient.getQueryData(topicApi.getAll().queryKey) || [];
            const draggedTopic = topics.find((t: any) => t._id === draggedTopicId);
            const targetTopic = topics.find((t: any) => t._id === targetTopicId);

            if (!draggedTopic) return;

            // Can only reorder within same submodule (or module if no submodules)
            const hierarchyLevels = selectedCourse.courseHierarchy.map((l: any) => l.toLowerCase());
            const hasSubModules = hierarchyLevels.includes('sub module');

            const isDroppingOnEmptyCell = targetTopicId.includes('default') || targetTopicId.includes('none') || !targetTopic;
            const targetParentId = hasSubModules ? targetTopic?.subModuleId : targetTopic?.moduleId;

            // Determine current parent ID
            const currentParentId = hasSubModules ? draggedTopic.subModuleId : draggedTopic.moduleId;

            // Check if we're moving to a different parent
            const isChangingParent = currentParentId !== targetParentId;
            if (isDroppingOnEmptyCell) {
                // For empty cells, we need to find the parent module or submodule
                let parentId: string | undefined;
                let parentType: 'module' | 'submodule' = 'module';
                const row = tableRows.find((r: any) =>
                    r.topicId === targetTopicId ||
                    (r.subModuleId && r.subModuleId === targetTopicId.replace('-default', '')) ||
                    (r.moduleId && r.moduleId === targetTopicId.replace('-default', ''))
                );

                if (!row) {
                    setErrorMessage("Cannot determine parent for this empty cell");
                    setShowErrorDialog(true);
                    return;
                }
                if (hasSubModules) {
                    // If submodule is in course hierarchy, use submodule as parent
                    if (row.subModuleId && !row.subModuleId.includes('none') && !row.subModuleId.includes('default')) {
                        parentId = row.subModuleId;
                        parentType = 'submodule';

                        // Validate submodule exists
                        const parentSubModule = subModules.find((sm: any) => sm._id === parentId);
                        if (!parentSubModule) {
                            setErrorMessage("Parent submodule not found for this empty cell");
                            setShowErrorDialog(true);
                            return;
                        }
                    } else {
                        setErrorMessage("Cannot add topic here - no submodule available in this hierarchy position");
                        setShowErrorDialog(true);
                        return;
                    }
                } else {
                    // If submodule is NOT in course hierarchy, use module as parent
                    if (row.moduleId && !row.moduleId.includes('none') && !row.moduleId.includes('default')) {
                        parentId = row.moduleId;
                        parentType = 'module';

                        // Validate module exists
                        const parentModule = modules.find((m: any) => m._id === parentId);
                        if (!parentModule) {
                            setErrorMessage("Parent module not found for this empty cell");
                            setShowErrorDialog(true);
                            return;
                        }
                    } else {
                        setErrorMessage("Cannot add topic here - no module available in this hierarchy position");
                        setShowErrorDialog(true);
                        return;
                    }
                }


                // Get all topics in the target parent to calculate new index
                const targetParentTopics = topics
                    .filter((t: any) =>
                        parentType === 'submodule'
                            ? t.subModuleId === parentId
                            : t.moduleId === parentId
                    )
                    .sort((a: any, b: any) => (a.index || 0) - (b.index || 0));

                const newIndex = targetParentTopics.length > 0
                    ? Math.max(...targetParentTopics.map((t: any) => t.index || 0)) + 1
                    : 0;

                const updatedTopic = {
                    ...draggedTopic,
                    moduleId: parentType === 'submodule' ? draggedTopic.moduleId : parentId,
                    subModuleId: parentType === 'submodule' ? parentId : undefined,
                    index: newIndex
                };

                // Update backend
                await updateTopicMutation.mutateAsync({
                    id: draggedTopicId,
                    data: updatedTopic
                });

                const updatedMergedCells = { ...mergedCells };
                Object.keys(updatedMergedCells).forEach(key => {
                    updatedMergedCells[key] = updatedMergedCells[key].filter((merge: any) =>
                        !merge.hierarchyIds?.topics.includes(draggedTopicId)
                    );
                });
                setMergedCells(updatedMergedCells);

                const updatedMergedLevels = mergedLevels.filter((merge: any) =>
                    !merge.hierarchyIds.topics.includes(draggedTopicId)
                );
                setMergedLevels(updatedMergedLevels);

                // Delete backend pedagogy data
                const pedagogyToUpdate = pedagogyViews?.[0];
                if (pedagogyToUpdate) {
                    const pedagogiesToDelete = pedagogyToUpdate.pedagogies.filter((pedagogy: any) =>
                        pedagogy.topic?.includes(draggedTopicId)
                    );

                    for (const pedagogy of pedagogiesToDelete) {
                        for (const activity of pedagogy.iDo) {
                            await deletePedagogyMutation.mutateAsync({
                                activityType: "iDo",
                                itemId: activity._id
                            });
                        }
                        for (const activity of pedagogy.weDo) {
                            await deletePedagogyMutation.mutateAsync({
                                activityType: "weDo",
                                itemId: activity._id
                            });
                        }
                        for (const activity of pedagogy.youDo) {
                            await deletePedagogyMutation.mutateAsync({
                                activityType: "youDo",
                                itemId: activity._id
                            });
                        }
                    }
                }

                // Delete level data from backend
                if (levelViewId) {
                    const levelsToDelete = levelsData.filter((level: { topic: string | string[]; }) =>
                        level.topic?.includes(draggedTopicId)
                    );

                    for (const level of levelsToDelete) {
                        if (level._id) {
                            await deleteLevelMutation.mutateAsync(level._id);
                        }
                    }
                }

                // Refresh data
                await refetchTopics();

            } else {
                if (isChangingParent) {
                    // Moving to a different parent - update parent references

                    // Get all topics in the target parent to calculate new index
                    const targetParentTopics = topics
                        .filter((t: any) =>
                            hasSubModules
                                ? t.subModuleId === targetParentId
                                : t.moduleId === targetParentId
                        )
                        .sort((a: any, b: any) => (a.index || 0) - (b.index || 0));

                    const newIndex = targetParentTopics.length > 0
                        ? Math.max(...targetParentTopics.map((t: any) => t.index || 0)) + 1
                        : 0;

                    const updatedTopic = {
                        ...draggedTopic,
                        moduleId: hasSubModules ? targetTopic?.moduleId : targetParentId,
                        subModuleId: hasSubModules ? targetParentId : undefined,
                        index: newIndex
                    };

                    // Update backend
                    await updateTopicMutation.mutateAsync({
                        id: draggedTopicId,
                        data: updatedTopic
                    });

                    // Clean up pedagogy and level data for the moved topic
                    // (Same cleanup as in your original same-parent logic)
                    const updatedMergedCells = { ...mergedCells };
                    Object.keys(updatedMergedCells).forEach(key => {
                        updatedMergedCells[key] = updatedMergedCells[key].filter((merge: any) =>
                            !merge.hierarchyIds?.topics.includes(draggedTopicId)
                        );
                    });
                    setMergedCells(updatedMergedCells);

                    const updatedMergedLevels = mergedLevels.filter((merge: any) =>
                        !merge.hierarchyIds.topics.includes(draggedTopicId)
                    );
                    setMergedLevels(updatedMergedLevels);

                    // Delete backend pedagogy data
                    const pedagogyToUpdate = pedagogyViews?.[0];
                    if (pedagogyToUpdate) {
                        const pedagogiesToDelete = pedagogyToUpdate.pedagogies.filter((pedagogy: any) =>
                            pedagogy.topic?.includes(draggedTopicId)
                        );

                        for (const pedagogy of pedagogiesToDelete) {
                            for (const activity of pedagogy.iDo) {
                                await deletePedagogyMutation.mutateAsync({
                                    activityType: "iDo",
                                    itemId: activity._id
                                });
                            }
                            for (const activity of pedagogy.weDo) {
                                await deletePedagogyMutation.mutateAsync({
                                    activityType: "weDo",
                                    itemId: activity._id
                                });
                            }
                            for (const activity of pedagogy.youDo) {
                                await deletePedagogyMutation.mutateAsync({
                                    activityType: "youDo",
                                    itemId: activity._id
                                });
                            }
                        }
                    }

                    // Delete level data from backend
                    if (levelViewId) {
                        const levelsToDelete = levelsData.filter((level: { topic: string | string[]; }) =>
                            level.topic?.includes(draggedTopicId)
                        );

                        for (const level of levelsToDelete) {
                            if (level._id) {
                                await deleteLevelMutation.mutateAsync(level._id);
                            }
                        }
                    }

                    // Refresh data
                    await refetchTopics();
                } else {
                    const parentId = hasSubModules ? draggedTopic.subModuleId : draggedTopic.moduleId;
                    const moduleTopics = currentTopics
                        .filter((t: any) => hasSubModules ? t.subModuleId === parentId : t.moduleId === parentId)
                        .sort((a: any, b: any) => (a.index || 0) - (b.index || 0));

                    const draggedIndex = moduleTopics.findIndex((t: any) => t._id === draggedTopicId);
                    const targetIndex = moduleTopics.findIndex((t: any) => t._id === targetTopicId);

                    const reorderedTopics = [...moduleTopics];
                    const [removed] = reorderedTopics.splice(draggedIndex, 1);
                    reorderedTopics.splice(targetIndex, 0, removed);

                    const updatedTopics = reorderedTopics.map((topic, index) => ({
                        ...topic,
                        index: index
                    }));

                    // Merge with existing topics outside this module/submodule (if any)
                    const finalTopics = currentTopics.map((t: any) => {
                        const updated = updatedTopics.find(ut => ut._id === t._id);
                        return updated || t;
                    });

                    // 2. Clean up merged cells & pedagogy data (now happens after UI update)
                    const updatedMergedCells = { ...mergedCells };
                    Object.keys(updatedMergedCells).forEach(key => {
                        updatedMergedCells[key] = updatedMergedCells[key].filter((merge: any) =>
                            !merge.hierarchyIds?.topics.includes(draggedTopicId)
                        );
                    });
                    setMergedCells(updatedMergedCells);

                    const updatedMergedLevels = mergedLevels.filter((merge: any) =>
                        !merge.hierarchyIds.topics.includes(draggedTopicId)
                    );
                    setMergedLevels(updatedMergedLevels);

                    // 3. Delete pedagogy data from backend
                    const pedagogyToUpdate = pedagogyViews?.[0];
                    if (pedagogyToUpdate) {
                        const pedagogiesToDelete = pedagogyToUpdate.pedagogies.filter((pedagogy: any) =>
                            pedagogy.topic?.includes(draggedTopicId)
                        );

                        for (const pedagogy of pedagogiesToDelete) {
                            for (const activity of pedagogy.iDo) {
                                await deletePedagogyMutation.mutateAsync({
                                    activityType: "iDo",
                                    itemId: activity._id
                                });
                            }
                            for (const activity of pedagogy.weDo) {
                                await deletePedagogyMutation.mutateAsync({
                                    activityType: "weDo",
                                    itemId: activity._id
                                });
                            }
                            for (const activity of pedagogy.youDo) {
                                await deletePedagogyMutation.mutateAsync({
                                    activityType: "youDo",
                                    itemId: activity._id
                                });
                            }
                        }
                    }

                    // 4. Delete level data from backend
                    if (levelViewId) {
                        const levelsToDelete = levelsData.filter((level: { topic: string | string[]; }) =>
                            level.topic?.includes(draggedTopicId)
                        );

                        for (const level of levelsToDelete) {
                            if (level._id) {
                                await deleteLevelMutation.mutateAsync(level._id);
                            }
                        }


                    }

                    // 5. Delete pedagogy merges specifically for topics
                    await deletePedagogyMerges({
                        topics: [draggedTopicId]
                    });

                    // 6. Update backend with new order
                    await Promise.all(
                        updatedTopics.map(topic =>
                            updateTopicMutation.mutateAsync({
                                id: topic._id,
                                data: {
                                    title: topic.title,
                                    description: topic.description,
                                    level: topic.level,
                                    moduleId: topic.moduleId,
                                    subModuleId: topic.subModuleId,
                                    courses: topic.courses,
                                    index: topic.index,
                                    duration: topic.duration
                                }
                            })
                        )
                    );

                    refetchTopics();
                }
            }
            setShowSuccessMessage(true);
            setTimeout(() => setShowSuccessMessage(false), 2000);
        } catch (error) {
            console.error("Failed to reorder topics:", error);
            setErrorMessage(error instanceof Error ? error.message : "Failed to reorder topics");
            setShowErrorDialog(true);

            // Rollback: Refetch original data
            refetchTopics();
        }
}

export async function handleSubtopicDropImpl(e: React.DragEvent, targetSubtopicId: string, deps: DragDropDeps) {
    const { courses, deleteLevelMutation, deletePedagogyMutation, levelViewId, levelsData, mergedCells, mergedLevels, pedagogyMutation, pedagogyViews, queryClient, refetchSubTopics, refetchTopicSubTopics, selectedCourse, selectedTopicForSubTopic, setDragOverId, setDraggingSubtopicId, setErrorMessage, setMergedCells, setMergedLevels, setShowErrorDialog, setShowSuccessMessage, subTopics, token, topics, updateSubTopicMutation } = deps
        e.preventDefault();
        const dragData = JSON.parse(e.dataTransfer.getData('application/json'));
        const draggedSubtopicId = dragData.id;
        setDraggingSubtopicId(null);
        setDragOverId(null);

        if (!token || !selectedCourse) return;

        try {
            // 1. Optimistically update local state first
            const currentSubTopics = queryClient.getQueryData(subTopicApi.getAll().queryKey) || [];
            const draggedSubtopic = subTopics.find((st: any) => st._id === draggedSubtopicId);
            const targetSubtopic = subTopics.find((st: any) => st._id === targetSubtopicId);

            if (!draggedSubtopic) return;
            const isChangingTopic = draggedSubtopic.topicId !== targetSubtopic?.topicId;

            const isDroppingOnEmptyCell = targetSubtopicId.includes('placeholder') || targetSubtopicId.includes('default') || targetSubtopicId.includes('none');

            if (isDroppingOnEmptyCell) {
                // For empty cells, we need to find the parent topic
                // Extract topic ID from empty cell ID (format: "topicId-placeholder" or "topicId-placeholder-sub")
                let topicId = targetSubtopicId.split('-')[0];

                // Handle different empty cell ID formats
                if (topicId === 'placeholder' && targetSubtopicId.includes('-placeholder-topic')) {
                    // Format: "moduleId-placeholder-topic-placeholder-sub"
                    const parts = targetSubtopicId.split('-');
                    topicId = parts[0]; // This should be the module ID, but we need to find the actual topic

                    // For this case, we need to find or create the actual topic
                    const moduleId = parts[0];
                    const moduleTopics = topics.filter((t: any) => t.moduleId === moduleId);

                    if (moduleTopics.length > 0) {
                        topicId = moduleTopics[0]._id; // Use first topic in module
                    } else {
                        setErrorMessage("No topics found in this module to attach the subtopic to");
                        setShowErrorDialog(true);
                        return;
                    }
                }

                if (!topicId || topicId === 'placeholder') {
                    setErrorMessage("Cannot determine parent topic for this empty cell");
                    setShowErrorDialog(true);
                    return;
                }

                const targetTopic = topics.find((t: any) => t._id === topicId);
                if (!targetTopic) {
                    setErrorMessage("Parent topic not found for this empty cell");
                    setShowErrorDialog(true);
                    return;
                }

                // Get all subtopics in the target topic to calculate new index
                const targetTopicSubTopics = subTopics
                    .filter((st: any) => st.topicId === topicId)
                    .sort((a: any, b: any) => (a.index || 0) - (b.index || 0));

                const newIndex = targetTopicSubTopics.length > 0
                    ? Math.max(...targetTopicSubTopics.map((st: any) => st.index || 0)) + 1
                    : 0;

                // Update the subtopic with new parent topic and index
                const updatedSubtopic = {
                    ...draggedSubtopic,
                    topicId: topicId, // Change parent topic
                    index: newIndex
                };

                // Update backend
                await updateSubTopicMutation.mutateAsync({
                    id: draggedSubtopicId,
                    data: updatedSubtopic
                });

                // Clean up pedagogy and level data from old position
                const updatedMergedCells = { ...mergedCells };
                Object.keys(updatedMergedCells).forEach(key => {
                    updatedMergedCells[key] = updatedMergedCells[key].filter((merge: any) =>
                        !merge.hierarchyIds?.subTopics.includes(draggedSubtopicId)
                    );
                });
                setMergedCells(updatedMergedCells);

                const updatedMergedLevels = mergedLevels.filter((merge: any) =>
                    !merge.hierarchyIds.subTopics.includes(draggedSubtopicId)
                );
                setMergedLevels(updatedMergedLevels);

                // Delete backend pedagogy data from old position
                const pedagogyToUpdate = pedagogyViews?.[0];
                if (pedagogyToUpdate) {
                    const pedagogiesToDelete = pedagogyToUpdate.pedagogies.filter((pedagogy: any) =>
                        pedagogy.subTopic?.includes(draggedSubtopicId)
                    );

                    for (const pedagogy of pedagogiesToDelete) {
                        for (const activity of pedagogy.iDo) {
                            await deletePedagogyMutation.mutateAsync({
                                activityType: "iDo",
                                itemId: activity._id
                            });
                        }
                        for (const activity of pedagogy.weDo) {
                            await deletePedagogyMutation.mutateAsync({
                                activityType: "weDo",
                                itemId: activity._id
                            });
                        }
                        for (const activity of pedagogy.youDo) {
                            await deletePedagogyMutation.mutateAsync({
                                activityType: "youDo",
                                itemId: activity._id
                            });
                        }
                    }

                    // Update pedagogy view
                    const updatedPedagogies = pedagogyToUpdate.pedagogies.filter((pedagogy: any) =>
                        !pedagogy.subTopic?.includes(draggedSubtopicId)
                    );

                    await pedagogyMutation.mutateAsync({
                        courses: selectedCourse?._id || '',
                        pedagogies: updatedPedagogies
                    });
                }

                // Delete level data from backend from old position
                if (levelViewId) {
                    const levelsToDelete = levelsData.filter((level: { subTopic: string | string[]; }) =>
                        level.subTopic?.includes(draggedSubtopicId)
                    );

                    for (const level of levelsToDelete) {
                        if (level._id) {
                            await deleteLevelMutation.mutateAsync(level._id);
                        }
                    }
                }

                // Refresh data
                await refetchSubTopics();
                if (targetTopic._id) {
                    await refetchTopicSubTopics();
                }

                setShowSuccessMessage(true);
                setTimeout(() => setShowSuccessMessage(false), 2000);

            } else {
                if (isChangingTopic) {
                    // Moving to a different topic - update the topicId
                    const targetTopicSubTopics = subTopics
                        .filter((st: any) => st.topicId === targetSubtopic?.topicId)
                        .sort((a: any, b: any) => (a.index || 0) - (b.index || 0));

                    const newIndex = targetTopicSubTopics.length > 0
                        ? Math.max(...targetTopicSubTopics.map((st: any) => st.index || 0)) + 1
                        : 0;

                    const updatedSubtopic = {
                        ...draggedSubtopic,
                        topicId: targetSubtopic?.topicId,
                        index: newIndex
                    };

                    // Update backend
                    await updateSubTopicMutation.mutateAsync({
                        id: draggedSubtopicId,
                        data: updatedSubtopic
                    });

                    // Clean up pedagogy and level data for the moved subtopic
                    // (Same cleanup as in your original same-parent logic)
                    const updatedMergedCells = { ...mergedCells };
                    Object.keys(updatedMergedCells).forEach(key => {
                        updatedMergedCells[key] = updatedMergedCells[key].filter((merge: any) =>
                            !merge.hierarchyIds?.subTopics.includes(draggedSubtopicId)
                        );
                    });
                    setMergedCells(updatedMergedCells);

                    const updatedMergedLevels = mergedLevels.filter((merge: any) =>
                        !merge.hierarchyIds.subTopics.includes(draggedSubtopicId)
                    );
                    setMergedLevels(updatedMergedLevels);

                    // Delete backend pedagogy data
                    const pedagogyToUpdate = pedagogyViews?.[0];
                    if (pedagogyToUpdate) {
                        const pedagogiesToDelete = pedagogyToUpdate.pedagogies.filter((pedagogy: any) =>
                            pedagogy.subTopic?.includes(draggedSubtopicId)
                        );

                        for (const pedagogy of pedagogiesToDelete) {
                            for (const activity of pedagogy.iDo) {
                                await deletePedagogyMutation.mutateAsync({
                                    activityType: "iDo",
                                    itemId: activity._id
                                });
                            }
                            for (const activity of pedagogy.weDo) {
                                await deletePedagogyMutation.mutateAsync({
                                    activityType: "weDo",
                                    itemId: activity._id
                                });
                            }
                            for (const activity of pedagogy.youDo) {
                                await deletePedagogyMutation.mutateAsync({
                                    activityType: "youDo",
                                    itemId: activity._id
                                });
                            }
                        }

                        // Update pedagogy view
                        const updatedPedagogies = pedagogyToUpdate.pedagogies.filter((pedagogy: any) =>
                            !pedagogy.subTopic?.includes(draggedSubtopicId)
                        );

                        await pedagogyMutation.mutateAsync({
                            courses: selectedCourse?._id || '',
                            pedagogies: updatedPedagogies
                        });
                    }

                    // Delete level data from backend
                    if (levelViewId) {
                        const levelsToDelete = levelsData.filter((level: { subTopic: string | string[]; }) =>
                            level.subTopic?.includes(draggedSubtopicId)
                        );

                        for (const level of levelsToDelete) {
                            if (level._id) {
                                await deleteLevelMutation.mutateAsync(level._id);
                            }
                        }
                    }

                    // Refresh data
                    await refetchSubTopics();
                    if (targetSubtopic?.topicId) {
                        await refetchTopicSubTopics();
                    }
                } else {

                    // Get all subtopics for this topic and sort by index
                    const topicSubTopics = currentSubTopics
                        .filter((st: any) => st.topicId === draggedSubtopic.topicId)
                        .sort((a: any, b: any) => (a.index || 0) - (b.index || 0));

                    // Find positions of dragged and target subtopics
                    const draggedIndex = topicSubTopics.findIndex((st: any) => st._id === draggedSubtopicId);
                    const targetIndex = topicSubTopics.findIndex((st: any) => st._id === targetSubtopicId);

                    // Reorder the array
                    const reorderedSubTopics = [...topicSubTopics];
                    const [removed] = reorderedSubTopics.splice(draggedIndex, 1);
                    reorderedSubTopics.splice(targetIndex, 0, removed);

                    // Update indexes
                    const updatedSubTopics = reorderedSubTopics.map((subtopic, index) => ({
                        ...subtopic,
                        index: index
                    }));

                    // Merge with existing subtopics outside this topic (if any)
                    const finalSubTopics = currentSubTopics.map((st: any) => {
                        const updated = updatedSubTopics.find(ust => ust._id === st._id);
                        return updated || st;
                    });


                    queryClient.setQueryData(subTopicApi.getAll().queryKey, finalSubTopics);
                    // 2. Clean up merged cells & pedagogy data
                    const updatedMergedCells = { ...mergedCells };
                    Object.keys(updatedMergedCells).forEach(key => {
                        updatedMergedCells[key] = updatedMergedCells[key].filter((merge: any) =>
                            !merge.hierarchyIds?.subTopics.includes(draggedSubtopicId)
                        );
                    });
                    setMergedCells(updatedMergedCells);

                    const updatedMergedLevels = mergedLevels.filter((merge: any) =>
                        !merge.hierarchyIds.subTopics.includes(draggedSubtopicId)
                    );
                    setMergedLevels(updatedMergedLevels);

                    // 3. Delete pedagogy data from backend
                    const pedagogyToUpdate = pedagogyViews?.[0];
                    if (pedagogyToUpdate) {
                        const pedagogiesToDelete = pedagogyToUpdate.pedagogies.filter((pedagogy: any) =>
                            pedagogy.subTopic?.includes(draggedSubtopicId)
                        );

                        for (const pedagogy of pedagogiesToDelete) {
                            for (const activity of pedagogy.iDo) {
                                await deletePedagogyMutation.mutateAsync({
                                    activityType: "iDo",
                                    itemId: activity._id
                                });
                            }
                            for (const activity of pedagogy.weDo) {
                                await deletePedagogyMutation.mutateAsync({
                                    activityType: "weDo",
                                    itemId: activity._id
                                });
                            }
                            for (const activity of pedagogy.youDo) {
                                await deletePedagogyMutation.mutateAsync({
                                    activityType: "youDo",
                                    itemId: activity._id
                                });
                            }
                        }

                        // Update pedagogy view
                        const updatedPedagogies = pedagogyToUpdate.pedagogies.filter((pedagogy: any) =>
                            !pedagogy.subTopic?.includes(draggedSubtopicId)
                        );

                        await pedagogyMutation.mutateAsync({
                            courses: selectedCourse?._id || '',
                            pedagogies: updatedPedagogies
                        });
                    }

                    // 4. Delete level data from backend
                    if (levelViewId) {
                        const levelsToDelete = levelsData.filter((level: { subTopic: string | string[]; }) =>
                            level.subTopic?.includes(draggedSubtopicId)
                        );

                        for (const level of levelsToDelete) {
                            if (level._id) {
                                await deleteLevelMutation.mutateAsync(level._id);
                            }
                        }


                    }

                    // 5. Update backend with new order
                    await Promise.all(
                        updatedSubTopics.map(subtopic =>
                            updateSubTopicMutation.mutateAsync({
                                id: subtopic._id,
                                data: {
                                    title: subtopic.title,
                                    description: subtopic.description,
                                    level: subtopic.level,
                                    topicId: subtopic.topicId,
                                    courses: subtopic.courses,
                                    index: subtopic.index,
                                    duration: subtopic.duration
                                }
                            })
                        )
                    );
                    await refetchSubTopics();
                    if (draggedSubtopic.topicId) {
                        await refetchTopicSubTopics();
                    }
                }
            }

            setShowSuccessMessage(true);
            setTimeout(() => setShowSuccessMessage(false), 2000);
        } catch (error) {
            console.error("Failed to reorder subtopics:", error);
            setErrorMessage(error instanceof Error ? error.message : "Failed to reorder subtopics");
            setShowErrorDialog(true);

            // Rollback: Refetch original data
            queryClient.invalidateQueries({ queryKey: subTopicApi.getAll().queryKey });
            if (selectedTopicForSubTopic?.id) {
                queryClient.invalidateQueries({
                    queryKey: subTopicApi.getByTopicId(selectedTopicForSubTopic.id).queryKey
                });
            }
        }
}
