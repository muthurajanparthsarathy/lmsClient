"use client"

// Submit: function bodies moved verbatim out of page.tsx during the split.
// Each keeps a same-named thin wrapper in the page, so every call site is
// unchanged; the values they close over arrive in one loosely-typed `deps`
// object (state and setters still live in the page).

import type React from "react"
import { moduleApi } from "@/app/lms/pages/coursestructure/pedagogy2/api/addmodule"
import { subModuleApi } from "@/app/lms/pages/coursestructure/pedagogy2/api/addsubmodule"
import { topicApi } from "@/app/lms/pages/coursestructure/pedagogy2/api/addtopic"
import { subTopicApi } from "@/app/lms/pages/coursestructure/pedagogy2/api/addsubtopic"
import { toast } from "sonner"
import type { Modules, Topic, SubTopic, ModuleFormData, SubModuleCreateData, TopicCreateData, SubTopicCreateData } from "./types"
import { isOwnPedagogyRow } from "./pedagogyRowIdentity"

export interface SubmitDeps {
    addOnlyPedagogyLevel?: any;
    checkAndDeleteExistingLevelData?: any;
    checkAndDeleteExistingMergedCells?: any;
    checkAndDeleteExistingPedagogyData?: any;
    checkAndDeleteExistingPedagogyDataForSelectedActivities?: any;
    collectPedagogyHierarchyIdsForDeletion?: any;
    courses?: any;
    createModuleMutation?: any;
    createSubModuleMutation?: any;
    createSubTopicMutation?: any;
    createTopicMutation?: any;
    deleteLevelMutation?: any;
    deleteOwnPedagogyRows?: any;
    deleteSingleCellValuesForMerge?: any;
    dialogType?: any;
    editMode?: any;
    editingExistingLevelData?: any;
    fetchModulesForCourse?: any;
    getAllSelectedHierarchyIds?: any;
    levelViewMutation?: any;
    levelsData?: any;
    mergedCells?: any;
    moduleFormData?: any;
    moduleTestConfig?: any;
    modules?: any;
    pedagogyHours?: any;
    pedagogyMutation?: any;
    pedagogyViews?: any;
    refetchSubModules?: any;
    refetchSubTopics?: any;
    refetchTopicSubTopics?: any;
    refetchTopics?: any;
    resetAllFormStates?: any;
    savedLevelMergeSelections?: any;
    savedPedagogyMergeSelections?: any;
    selectedCourse?: any;
    selectedLevel?: any;
    selectedLevelModulesForMerge?: any;
    selectedLevelSubModulesForMerge?: any;
    selectedLevelSubTopicsForMerge?: any;
    selectedLevelTopicsForMerge?: any;
    selectedModuleForSubModule?: any;
    selectedPedagogyActivities?: any;
    selectedSubModuleForTopic?: any;
    selectedTopicForSubTopic?: any;
    setEditMode?: any;
    setIsCreatingModule?: any;
    setIsCreatingSubModule?: any;
    setIsCreatingSubTopic?: any;
    setIsCreatingTopic?: any;
    setMergedCells?: any;
    setModuleFormData?: any;
    setShowDialog?: any;
    setShowSuccessMessage?: any;
    setSubModuleFormData?: any;
    setSubTopicFormData?: any;
    setTopicFormData?: any;
    showLevelSection?: any;
    showMergeLevelSection?: any;
    showPedagogySection?: any;
    subModuleFormData?: any;
    subModules?: any;
    subTopicFormData?: any;
    subTopics?: any;
    token?: any;
    topicFormData?: any;
    topics?: any;
    updateModuleMutation?: any;
    updateSubModuleMutation?: any;
    updateSubTopicMutation?: any;
    updateTopicMutation?: any;
}

export async function handleModuleSubmitImpl(e: React.FormEvent, deps: SubmitDeps) {
    const { addOnlyPedagogyLevel, checkAndDeleteExistingLevelData, checkAndDeleteExistingMergedCells, checkAndDeleteExistingPedagogyData, checkAndDeleteExistingPedagogyDataForSelectedActivities, collectPedagogyHierarchyIdsForDeletion, courses, createModuleMutation, deleteLevelMutation, deleteOwnPedagogyRows, deleteSingleCellValuesForMerge, editMode, editingExistingLevelData, fetchModulesForCourse, levelViewMutation, levelsData, moduleFormData, moduleTestConfig, modules, pedagogyHours, pedagogyMutation, pedagogyViews, resetAllFormStates, savedLevelMergeSelections, savedPedagogyMergeSelections, selectedCourse, selectedLevel, selectedLevelModulesForMerge, selectedPedagogyActivities, setEditMode, setIsCreatingModule, setModuleFormData, setShowDialog, setShowSuccessMessage, showLevelSection, showMergeLevelSection, showPedagogySection, subModules, subTopics, token, topics, updateModuleMutation } = deps
        e.preventDefault();

        if (!selectedCourse || !token) return;

        setIsCreatingModule(true);
        const alreadyDeletedLevels = new Set<string>();
        const alreadyDeletedPedagogyItems = new Set<string>();
        try {
            let moduleIdToUnmerge = null;
            let newModule: any;
            if (!addOnlyPedagogyLevel) {
                if (editMode?.type === 'module') {
                    moduleIdToUnmerge = editMode.data._id;
                    await updateModuleMutation.mutateAsync({
                        id: editMode.data._id,
                        data: {
                            ...moduleFormData,
                            courses: selectedCourse._id,
                            testConfiguration: moduleTestConfig
                        }
                    });
                } else {
                    // Calculate next index based on existing modules
                    const nextIndex = modules.length > 0
                        ? Math.max(...modules.map((m: any) => m.index || 0)) + 1
                        : 0;

                    newModule = await createModuleMutation.mutateAsync({
                        ...moduleFormData,
                        index: nextIndex,
                        courses: selectedCourse._id,
                        institution: "",
                        testConfiguration: moduleTestConfig
                    });



                    moduleIdToUnmerge = newModule.module._id;
                }
            }

            if (showLevelSection && selectedLevel) {

                let levelData: any;

                if (editMode?.type === 'module' && editingExistingLevelData) {
                    // UPDATE EXISTING LEVEL DATA - Delete old and create new
                    // First delete the existing level
                    if (editingExistingLevelData._id) {
                        await deleteLevelMutation.mutateAsync(editingExistingLevelData._id);
                    }

                    // Then create new level data with updated values
                    levelData = {
                        level: selectedLevel,
                        module: savedLevelMergeSelections?.modules || [
                            editMode?.type === 'module' ? editMode.data._id : newModule.module._id
                        ],
                        subModule: savedLevelMergeSelections?.subModules || [],
                        topic: savedLevelMergeSelections?.topics || [],
                        subTopic: savedLevelMergeSelections?.subTopics || []
                    };

                    await levelViewMutation.mutateAsync({
                        courses: selectedCourse._id,
                        levels: [...levelsData.filter((l: any) => l._id !== editingExistingLevelData._id), levelData]
                    });
                } else {
                    // CREATE NEW LEVEL DATA (existing logic remains the same)
                    levelData = {
                        level: selectedLevel,
                        module: [editMode?.type === 'module' ? editMode.data._id : newModule.module._id]
                    };
                    // If merging with other modules, include their hierarchy too
                    if (savedLevelMergeSelections) {
                        levelData.module = [...levelData.module, ...savedLevelMergeSelections.modules];
                    }
                    // If merging with other modules manually, include their hierarchy too
                    else if (showMergeLevelSection && selectedLevelModulesForMerge.size > 0) {
                        const selectedModulesData = modules.filter((m: any) => selectedLevelModulesForMerge.has(m._id));

                        // Collect all hierarchy IDs from selected modules
                        const allModuleIds = new Set([newModule.module._id]);

                        selectedModulesData.forEach((module: any) => {
                            allModuleIds.add(module._id);
                        });

                        // Update level data with all hierarchy IDs
                        levelData.module = Array.from(allModuleIds);
                    }

                    await levelViewMutation.mutateAsync({
                        courses: selectedCourse._id,
                        levels: [...levelsData, levelData]
                    });
                }
            } else if (editMode?.type === 'module' && editingExistingLevelData) {
                // If level section is unchecked during edit, remove the level data
                if (editingExistingLevelData._id) {
                    await deleteLevelMutation.mutateAsync(editingExistingLevelData._id);
                }
            }

            // Process pedagogy data if needed
            const hasPedagogyData = Object.keys(pedagogyHours).some(type =>
                Object.keys(pedagogyHours[type as keyof typeof pedagogyHours]).some(
                    activity => (pedagogyHours[type as keyof typeof pedagogyHours][activity] || 0) > 0
                )
            );

            if (showPedagogySection && hasPedagogyData) {
                const hierarchyLevels = selectedCourse.courseHierarchy.map((l: any) => l.toLowerCase());

                // First, remove ALL pedagogy data containing the editing element ID
                if (editMode?.type === 'module') {
                    const hierarchyIdsForDeletion = {
                        modules: [editMode.data._id]
                    };

                    await checkAndDeleteExistingPedagogyDataForSelectedActivities(
                        hierarchyIdsForDeletion,
                        alreadyDeletedPedagogyItems,
                        false // Don't preserve - we want to replace the editing item's pedagogy
                    );
                }
                if (showPedagogySection && editMode) {
                    for (const activityType of ["iDo", "weDo", "youDo"] as const) {
                        for (const activity of selectedPedagogyActivities[activityType]) {
                            if (savedPedagogyMergeSelections[activityType]?.[activity]) {
                                await deleteSingleCellValuesForMerge(
                                    editMode.data._id,
                                    activityType,
                                    activity
                                );
                            }
                        }
                    }
                }
                // Now, save ALL pedagogy values from the current form
                const pedagogyDataFromForm: any[] = [];

                (["iDo", "weDo", "youDo"] as const).forEach(activityType => {
                    selectedPedagogyActivities[activityType]
                        .filter((activity: any) => (pedagogyHours[activityType][activity] || 0) > 0)
                        .forEach((activity: any) => {
                            const activityDuration = pedagogyHours[activityType][activity] || 0;
                            let baseHierarchy: any = {};

                            // Original logic
                            baseHierarchy = {
                                // Include parent hierarchy based on dialog type
                                ...(hierarchyLevels.includes('module') && {
                                    module: [editMode?.type === 'module' ? editMode.data._id : newModule?.module._id]
                                })
                            };

                            // Filter out empty arrays
                            Object.keys(baseHierarchy).forEach(key => {
                                if (Array.isArray(baseHierarchy[key]) && baseHierarchy[key].length === 0) {
                                    delete baseHierarchy[key];
                                }
                            });

                            // Check if this activity has specific merge selections
                            const activityMerge = savedPedagogyMergeSelections[activityType]?.[activity];

                            if (activityMerge) {
                                // Create a merged pedagogy entry with combined hierarchy
                                const mergedHierarchy: any = {
                                    [activityType]: [{ type: activity, duration: activityDuration }]
                                };

                                // Combine base hierarchy with merge hierarchy
                                if (baseHierarchy.module || activityMerge.modules.length > 0) {
                                    mergedHierarchy.module = [...new Set([
                                        ...(baseHierarchy.module || []),
                                        ...activityMerge.modules
                                    ])];
                                }

                                pedagogyDataFromForm.push(mergedHierarchy);
                            } else {
                                // Create a regular pedagogy entry with just the base hierarchy
                                const regularHierarchy: any = {
                                    ...baseHierarchy,
                                    [activityType]: [{ type: activity, duration: activityDuration }]
                                };

                                pedagogyDataFromForm.push(regularHierarchy);
                            }
                        });
                });

                // Save ALL pedagogy data from the form
                if (pedagogyDataFromForm.length > 0) {
                    // Get existing pedagogy data that doesn't contain the editing element
                    const existingPedagogyWithoutEditingItem = pedagogyViews?.[0]?.pedagogies?.filter((pedagogy: any) => {
                        // Own row only: a descendant's hours also carry this id.
                        const containsEditingItem = isOwnPedagogyRow(pedagogy, 'module', editMode?.data?._id);
                        return !containsEditingItem;
                    }) || [];

                    // Combine existing pedagogy (without editing item) with new form data
                    const allPedagogyData = [...existingPedagogyWithoutEditingItem, ...pedagogyDataFromForm];

                    await pedagogyMutation.mutateAsync({
                        courses: selectedCourse._id,
                        pedagogies: allPedagogyData
                    });
                } else {
                    // If no pedagogy data in form, remove all pedagogy containing the editing item
                    const existingPedagogyWithoutEditingItem = pedagogyViews?.[0]?.pedagogies?.filter((pedagogy: any) => {
                        // Own row only: a descendant's hours also carry this id.
                        const containsEditingItem = isOwnPedagogyRow(pedagogy, 'module', editMode?.data?._id);
                        return !containsEditingItem;
                    }) || [];

                    await pedagogyMutation.mutateAsync({
                        courses: selectedCourse._id,
                        pedagogies: existingPedagogyWithoutEditingItem
                    });
                }
            } else if (editMode?.type === 'module') {
                // Pedagogy unticked during edit = clear THIS module's hours.
                // Scoped to its own rows; the id-containment delete also
                // removed every descendant's hours.
                await deleteOwnPedagogyRows(
                    'module',
                    editMode.data._id,
                    alreadyDeletedPedagogyItems
                );

                // Remove from local state as well
                const existingPedagogyWithoutEditingItem = pedagogyViews?.[0]?.pedagogies?.filter((pedagogy: any) => {
                    // Own row only: a descendant's hours also carry this id.
                    const containsEditingItem = isOwnPedagogyRow(pedagogy, 'module', editMode?.data?._id);
                    return !containsEditingItem;
                }) || [];

                await pedagogyMutation.mutateAsync({
                    courses: selectedCourse._id,
                    pedagogies: existingPedagogyWithoutEditingItem
                });
            }

            const selectedLevelModulesData = modules.filter((m: any) => selectedLevelModulesForMerge.has(m._id));

            // Collect hierarchy IDs ONLY from selected merge modules (excluding the current module)
            const allModuleIds = new Set<string>();

            // Add the current module being edited/created
            if (editMode?.type === 'module') {
                allModuleIds.add(editMode.data._id);
            } else if (newModule) {
                allModuleIds.add(newModule.module._id);
            }

            // Add selected merge modules and their hierarchy
            selectedLevelModulesData.forEach((module: any) => {
                allModuleIds.add(module._id);
            });

            const hierarchyIds = {
                modules: Array.from(allModuleIds)
            };

            // Check and delete existing level data only for selected items
            await checkAndDeleteExistingLevelData(
                hierarchyIds,
                alreadyDeletedLevels,
                true, // preserve editing item
                editMode?.type === 'module' ? editMode.data._id : newModule?.module._id
            );

            // Check and delete existing pedagogy data only for selected activity types and items
            const pedagogyHierarchyIds = collectPedagogyHierarchyIdsForDeletion();

            await checkAndDeleteExistingPedagogyDataForSelectedActivities(
                pedagogyHierarchyIds,
                alreadyDeletedPedagogyItems,
                true, // preserve editing item
                editMode?.type === 'module' ? editMode.data._id : newModule?.module._id
            );

            // Check and delete existing merged cells
            checkAndDeleteExistingMergedCells(hierarchyIds);

            await fetchModulesForCourse();

            setShowDialog(false);
            setModuleFormData({
                title: '',
                description: '',
                level: 'Easy',
                duration: 0,
                index: 0
            });
            setEditMode(null);
            resetAllFormStates();
            setShowSuccessMessage(true);
            setTimeout(() => setShowSuccessMessage(false), 2000);
        } catch (error) {
            console.error("Failed to create/update module:", error);
        } finally {
            setIsCreatingModule(false);
        }
}

export async function handleSubModuleSubmitImpl(e: React.FormEvent, deps: SubmitDeps) {
    const { addOnlyPedagogyLevel, checkAndDeleteExistingLevelData, checkAndDeleteExistingMergedCells, checkAndDeleteExistingPedagogyData, checkAndDeleteExistingPedagogyDataForSelectedActivities, collectPedagogyHierarchyIdsForDeletion, courses, createSubModuleMutation, deleteLevelMutation, deleteOwnPedagogyRows, deleteSingleCellValuesForMerge, editMode, editingExistingLevelData, fetchModulesForCourse, getAllSelectedHierarchyIds, levelViewMutation, levelsData, moduleTestConfig, modules, pedagogyHours, pedagogyMutation, pedagogyViews, refetchSubModules, resetAllFormStates, savedLevelMergeSelections, savedPedagogyMergeSelections, selectedCourse, selectedLevel, selectedLevelSubModulesForMerge, selectedModuleForSubModule, selectedPedagogyActivities, setEditMode, setIsCreatingSubModule, setShowDialog, setShowSuccessMessage, setSubModuleFormData, showLevelSection, showPedagogySection, subModuleFormData, subModules, subTopics, token, topics, updateSubModuleMutation } = deps
        e.preventDefault();
        if (!selectedModuleForSubModule || !selectedCourse || !token) return;
        setIsCreatingSubModule(true);
        const alreadyDeletedLevels = new Set<string>();
        const alreadyDeletedPedagogyItems = new Set<string>();
        try {
            let subModuleIdToUnmerge = null;
            let newSubModule: any;
            if (!addOnlyPedagogyLevel) {
                if (editMode?.type === 'submodule') {
                    const subModuleIdToUnmerge = editMode.data._id;
                    await updateSubModuleMutation.mutateAsync({
                        id: editMode.data._id,
                        data: {
                            ...subModuleFormData,
                            moduleId: selectedModuleForSubModule.id,
                            courses: selectedCourse._id,
                            index: editMode.data.index,
                            testConfiguration: moduleTestConfig
                        }
                    });

                } else {
                    const moduleSubModules = subModules.filter((sub: any) => sub.moduleId === selectedModuleForSubModule.id);
                    const nextIndex = moduleSubModules.length > 0
                        ? Math.max(...moduleSubModules.map((t: any) => t.index ?? 0)) + 1
                        : 0;

                    newSubModule = await createSubModuleMutation.mutateAsync({
                        ...subModuleFormData,
                        moduleId: selectedModuleForSubModule.id,
                        courses: selectedCourse._id,
                        index: nextIndex,
                        testConfiguration: moduleTestConfig
                    });

                    const moduleIdToUnmerge = selectedModuleForSubModule.id;

                }
            }

            if (showLevelSection && selectedLevel) {
                const hierarchyLevels = selectedCourse.courseHierarchy.map((l: any) => l.toLowerCase());
                const hasTopics = hierarchyLevels.includes('topic');
                const hasSubTopics = hierarchyLevels.includes('sub topic');

                let levelData: any;

                if (editMode?.type === 'submodule' && editingExistingLevelData) {
                    // UPDATE EXISTING LEVEL DATA
                    levelData = {
                        _id: editingExistingLevelData._id,
                        level: selectedLevel,
                        module: savedLevelMergeSelections?.modules || [],
                        subModule: savedLevelMergeSelections?.subModules || [],
                        topic: savedLevelMergeSelections?.topics || [],
                        subTopic: savedLevelMergeSelections?.subTopics || []
                    };

                    // Ensure the editing item is always included
                    if (!levelData.module?.includes(editMode.data._id)) {
                        levelData.module = [...(levelData.module || []), editMode.data._id];
                    }

                    // Update the level in the database - replace the entire entry
                    const updatedLevels = levelsData.map((level: any) =>
                        level._id === editingExistingLevelData._id ? levelData : level
                    );

                    await levelViewMutation.mutateAsync({
                        courses: selectedCourse._id,
                        levels: updatedLevels
                    });
                } else {
                    // CREATE NEW LEVEL DATA
                    levelData = {
                        level: selectedLevel,
                    };

                    if (addOnlyPedagogyLevel) {
                        // Use all selected hierarchy IDs from merge selections
                        const allIds = getAllSelectedHierarchyIds('level');
                        if (allIds.modules.length > 0) levelData.module = allIds.modules;
                        if (hierarchyLevels.includes('sub module') && allIds.subModules.length > 0) levelData.subModule = allIds.subModules;
                        if (hasTopics && allIds.topics.length > 0) levelData.topic = allIds.topics;
                        if (hasSubTopics && allIds.subTopics.length > 0) levelData.subTopic = allIds.subTopics;
                    } else {
                        // Original logic for creating with hierarchy
                        levelData = {
                            ...levelData,
                            // Include parent module and newly created submodule
                            ...(hierarchyLevels.includes('module') && {
                                module: [selectedModuleForSubModule.id]
                            }),
                            ...(hierarchyLevels.includes('sub module') && {
                                subModule: [editMode?.type === 'submodule' ? editMode.data._id : newSubModule?.subModule._id]
                            })
                        };
                    }

                    // If merging with other submodules, include their hierarchy too
                    if (savedLevelMergeSelections) {
                        levelData.module = [...levelData.module, ...savedLevelMergeSelections.modules];
                        levelData.subModule = [...levelData.subModule, ...savedLevelMergeSelections.subModules];

                        if (hasTopics && savedLevelMergeSelections.topics.length > 0) {
                            levelData.topic = savedLevelMergeSelections.topics;
                        }

                        if (hasSubTopics && savedLevelMergeSelections.subTopics.length > 0) {
                            levelData.subTopic = savedLevelMergeSelections.subTopics;
                        }
                    }

                    await levelViewMutation.mutateAsync({
                        courses: selectedCourse._id,
                        levels: [...levelsData, levelData]
                    });
                }
            } else if (editMode?.type === 'submodule' && editingExistingLevelData) {
                // If level section is unchecked during edit, remove the level data
                if (editingExistingLevelData._id) {
                    await deleteLevelMutation.mutateAsync(editingExistingLevelData._id);
                }
            }

            // Process pedagogy data if needed
            const hasPedagogyData = Object.keys(pedagogyHours).some(type =>
                Object.keys(pedagogyHours[type as keyof typeof pedagogyHours]).some(
                    activity => (pedagogyHours[type as keyof typeof pedagogyHours][activity] || 0) > 0
                )
            );

            if (showPedagogySection && hasPedagogyData) {
                const hierarchyLevels = selectedCourse.courseHierarchy.map((l: any) => l.toLowerCase());
                const hasSubModules = hierarchyLevels.includes('sub module');
                const hasTopics = hierarchyLevels.includes('topic');
                const hasSubTopics = hierarchyLevels.includes('sub topic');

                // First, remove ALL pedagogy data containing the editing element ID
                if (editMode?.type === 'submodule') {
                    const hierarchyIdsForDeletion = {
                        subModules: [editMode.data._id]
                    };

                    await checkAndDeleteExistingPedagogyData(
                        hierarchyIdsForDeletion,
                        alreadyDeletedPedagogyItems
                    );
                }
                if (showPedagogySection && editMode) {
                    for (const activityType of ["iDo", "weDo", "youDo"] as const) {
                        for (const activity of selectedPedagogyActivities[activityType]) {
                            if (savedPedagogyMergeSelections[activityType]?.[activity]) {
                                await deleteSingleCellValuesForMerge(
                                    editMode.data._id,
                                    activityType,
                                    activity
                                );
                            }
                        }
                    }
                }
                // Now, save ALL pedagogy values from the current form
                const pedagogyDataFromForm: any[] = [];

                (["iDo", "weDo", "youDo"] as const).forEach(activityType => {
                    selectedPedagogyActivities[activityType]
                        .filter((activity: any) => (pedagogyHours[activityType][activity] || 0) > 0)
                        .forEach((activity: any) => {
                            const activityDuration = pedagogyHours[activityType][activity] || 0;
                            let baseHierarchy: any = {};

                            if (addOnlyPedagogyLevel) {
                                // Use all selected hierarchy IDs from merge selections
                                const allIds = getAllSelectedHierarchyIds('pedagogy');
                                if (allIds.modules.length > 0) baseHierarchy.module = allIds.modules;
                                if (hasSubModules && allIds.subModules.length > 0) baseHierarchy.subModule = allIds.subModules;
                                if (hasTopics && allIds.topics.length > 0) baseHierarchy.topic = allIds.topics;
                                if (hasSubTopics && allIds.subTopics.length > 0) baseHierarchy.subTopic = allIds.subTopics;
                            } else {
                                // Original logic
                                baseHierarchy = {
                                    // Include parent hierarchy based on dialog type
                                    ...(hierarchyLevels.includes('module') && {
                                        module: [selectedModuleForSubModule?.id]
                                    }),
                                    ...(hasSubModules && {
                                        subModule: [editMode?.type === 'submodule' ? editMode.data._id : newSubModule?.subModule._id]
                                    })
                                };
                            }

                            // Filter out empty arrays
                            Object.keys(baseHierarchy).forEach(key => {
                                if (Array.isArray(baseHierarchy[key]) && baseHierarchy[key].length === 0) {
                                    delete baseHierarchy[key];
                                }
                            });

                            // Check if this activity has specific merge selections
                            const activityMerge = savedPedagogyMergeSelections[activityType]?.[activity];

                            if (activityMerge) {
                                // Create a merged pedagogy entry with combined hierarchy
                                const mergedHierarchy: any = {
                                    [activityType]: [{ type: activity, duration: activityDuration }]
                                };

                                // Combine base hierarchy with merge hierarchy
                                if (baseHierarchy.module || activityMerge.modules.length > 0) {
                                    mergedHierarchy.module = [...new Set([
                                        ...(baseHierarchy.module || []),
                                        ...activityMerge.modules
                                    ])];
                                }

                                if (hasSubModules && (baseHierarchy.subModule || activityMerge.subModules.length > 0)) {
                                    mergedHierarchy.subModule = [...new Set([
                                        ...(baseHierarchy.subModule || []),
                                        ...activityMerge.subModules
                                    ])];
                                }

                                if (hasTopics && (baseHierarchy.topic || activityMerge.topics.length > 0)) {
                                    mergedHierarchy.topic = [...new Set([
                                        ...(baseHierarchy.topic || []),
                                        ...activityMerge.topics
                                    ])];
                                }

                                if (hasSubTopics && (baseHierarchy.subTopic || activityMerge.subTopics.length > 0)) {
                                    mergedHierarchy.subTopic = [...new Set([
                                        ...(baseHierarchy.subTopic || []),
                                        ...activityMerge.subTopics
                                    ])];
                                }

                                pedagogyDataFromForm.push(mergedHierarchy);
                            } else {
                                // Create a regular pedagogy entry with just the base hierarchy
                                const regularHierarchy: any = {
                                    ...baseHierarchy,
                                    [activityType]: [{ type: activity, duration: activityDuration }]
                                };

                                pedagogyDataFromForm.push(regularHierarchy);
                            }
                        });
                });

                // Save ALL pedagogy data from the form
                if (pedagogyDataFromForm.length > 0) {
                    // Get existing pedagogy data that doesn't contain the editing element
                    const existingPedagogyWithoutEditingItem = pedagogyViews?.[0]?.pedagogies?.filter((pedagogy: any) => {
                        // Own row only: a descendant's hours also carry this id.
                        const containsEditingItem = isOwnPedagogyRow(pedagogy, 'submodule', editMode?.data?._id);
                        return !containsEditingItem;
                    }) || [];

                    // Combine existing pedagogy (without editing item) with new form data
                    const allPedagogyData = [...existingPedagogyWithoutEditingItem, ...pedagogyDataFromForm];

                    await pedagogyMutation.mutateAsync({
                        courses: selectedCourse._id,
                        pedagogies: allPedagogyData
                    });
                } else {
                    // If no pedagogy data in form, remove all pedagogy containing the editing item
                    const existingPedagogyWithoutEditingItem = pedagogyViews?.[0]?.pedagogies?.filter((pedagogy: any) => {
                        // Own row only: a descendant's hours also carry this id.
                        const containsEditingItem = isOwnPedagogyRow(pedagogy, 'submodule', editMode?.data?._id);
                        return !containsEditingItem;
                    }) || [];

                    await pedagogyMutation.mutateAsync({
                        courses: selectedCourse._id,
                        pedagogies: existingPedagogyWithoutEditingItem
                    });
                }
            } else if (editMode?.type === 'submodule') {
                // Pedagogy unticked during edit = clear THIS submodule's hours.
                // Scoped to its own rows; the id-containment delete also
                // removed every descendant's hours.
                await deleteOwnPedagogyRows(
                    'submodule',
                    editMode.data._id,
                    alreadyDeletedPedagogyItems
                );

                // Remove from local state as well
                const existingPedagogyWithoutEditingItem = pedagogyViews?.[0]?.pedagogies?.filter((pedagogy: any) => {
                    // Own row only: a descendant's hours also carry this id.
                    const containsEditingItem = isOwnPedagogyRow(pedagogy, 'submodule', editMode?.data?._id);
                    return !containsEditingItem;
                }) || [];

                await pedagogyMutation.mutateAsync({
                    courses: selectedCourse._id,
                    pedagogies: existingPedagogyWithoutEditingItem
                });
            }
            // Add this right after creating the submodule but BEFORE processing level/pedagogy data
            if (!addOnlyPedagogyLevel) {
                // Get all selected submodules for merging
                const selectedLevelSubModulesData = subModules.filter((sm: any) => selectedLevelSubModulesForMerge.has(sm._id));
                // Track already deleted items to prevent duplicate deletion


                const parentModuleIds = new Set([selectedModuleForSubModule.id]);

                const hierarchyIdsForModuleDeletion = {
                    modules: Array.from(parentModuleIds),
                    subModules: [],
                    topics: [],
                    subTopics: []
                };

                // Check and delete existing data for all selected items
                await checkAndDeleteExistingPedagogyData(
                    hierarchyIdsForModuleDeletion,
                    alreadyDeletedPedagogyItems,
                    editMode?.type === 'submodule', // preserve editing item if we're in edit mode
                    editMode?.data?._id // editing item ID
                );
                await checkAndDeleteExistingLevelData(
                    hierarchyIdsForModuleDeletion,
                    alreadyDeletedLevels,
                    editMode?.type === 'submodule', // preserve editing item if we're in edit mode
                    editMode?.data?._id // editing item ID
                );
                checkAndDeleteExistingMergedCells(hierarchyIdsForModuleDeletion);

                // Collect hierarchy IDs for LEVEL deletion (only from level selections)
                const levelHierarchyIds = {
                    modules: new Set([selectedModuleForSubModule.id]),
                    subModules: new Set([editMode?.type === 'submodule' ? editMode.data._id : newSubModule?.subModule._id]),
                    topics: new Set<string>(),
                    subTopics: new Set<string>()
                };

                selectedLevelSubModulesData.forEach((subModule: any) => {
                    levelHierarchyIds.modules.add(subModule.moduleId);
                    levelHierarchyIds.subModules.add(subModule._id);

                    // Get all topics under selected submodules for level deletion
                    const subModuleTopics = topics.filter((t: any) => t.subModuleId === subModule._id);
                    subModuleTopics.forEach((topic: any) => {
                        levelHierarchyIds.topics.add(topic._id);

                        // Get all subtopics under these topics
                        const topicSubTopics = subTopics.filter((st: any) => st.topicId === topic._id);
                        topicSubTopics.forEach((subTopic: any) => {
                            levelHierarchyIds.subTopics.add(subTopic._id);
                        });
                    });
                });

                // Collect hierarchy IDs for PEDAGOGY deletion (only from pedagogy selections)
                // Convert Sets to Arrays for the deletion functions
                const levelIdsForDeletion = {
                    modules: Array.from(levelHierarchyIds.modules),
                    subModules: Array.from(levelHierarchyIds.subModules),
                    topics: Array.from(levelHierarchyIds.topics),
                    subTopics: Array.from(levelHierarchyIds.subTopics)
                };



                // Check and delete existing LEVEL data for level selections only
                await checkAndDeleteExistingLevelData(levelIdsForDeletion, alreadyDeletedLevels, editMode?.type === 'submodule',
                    editMode?.data?._id);

                // Check and delete existing PEDAGOGY data for pedagogy selections only
                const pedagogyHierarchyIds = collectPedagogyHierarchyIdsForDeletion();

                await checkAndDeleteExistingPedagogyDataForSelectedActivities(
                    pedagogyHierarchyIds,
                    alreadyDeletedPedagogyItems,
                    editMode?.type === 'submodule', // preserve editing item if we're in edit mode
                    editMode?.data?._id // editing item ID
                );

                // Check and delete existing merged cells for BOTH level and pedagogy selections
                const mergedCellsHierarchyIds = {
                    modules: Array.from(new Set([...levelHierarchyIds.modules, ...pedagogyHierarchyIds.modules])),
                    subModules: Array.from(new Set([...levelHierarchyIds.subModules, ...pedagogyHierarchyIds.subModules])),
                    topics: Array.from(new Set([...levelHierarchyIds.topics, ...pedagogyHierarchyIds.topics])),
                    subTopics: Array.from(new Set([...levelHierarchyIds.subTopics, ...pedagogyHierarchyIds.subTopics]))
                };

                checkAndDeleteExistingMergedCells(mergedCellsHierarchyIds);
            } else {
                // DELETE LOGIC FOR ADD ONLY PEDAGOGY/LEVEL MODE
                // Get all selected hierarchy IDs for deletion
                const hierarchyIds = getAllSelectedHierarchyIds('pedagogy');

                // Track already deleted items to prevent duplicate deletion
                const alreadyDeletedLevels = new Set<string>();
                const alreadyDeletedPedagogyItems = new Set<string>();

                // Check and delete existing level data
                if (showLevelSection && selectedLevel) {
                    await checkAndDeleteExistingLevelData(hierarchyIds, alreadyDeletedLevels, false);
                }

                // Check and delete existing pedagogy data for selected activities
                await checkAndDeleteExistingPedagogyDataForSelectedActivities(
                    hierarchyIds,
                    alreadyDeletedPedagogyItems, false
                );

                // Check and delete existing merged cells
                checkAndDeleteExistingMergedCells(hierarchyIds);
            }

            await fetchModulesForCourse();
            await refetchSubModules();
            setShowDialog(false);
            setSubModuleFormData({
                title: '',
                description: '',
                level: 'Easy',
                duration: 0
            });

            setEditMode(null);
            resetAllFormStates();
            setShowSuccessMessage(true);
            setTimeout(() => setShowSuccessMessage(false), 2000);
        } catch (error) {
            console.error("Failed to create/update submodule:", error);
        } finally {
            setIsCreatingSubModule(false);
        }
}

export async function handleTopicSubmitImpl(e: React.FormEvent, deps: SubmitDeps) {
    const { addOnlyPedagogyLevel, checkAndDeleteExistingLevelData, checkAndDeleteExistingMergedCells, checkAndDeleteExistingPedagogyData, checkAndDeleteExistingPedagogyDataForSelectedActivities, collectPedagogyHierarchyIdsForDeletion, courses, createTopicMutation, deleteLevelMutation, deleteOwnPedagogyRows, deleteSingleCellValuesForMerge, editMode, editingExistingLevelData, getAllSelectedHierarchyIds, levelViewMutation, levelsData, moduleTestConfig, modules, pedagogyHours, pedagogyMutation, pedagogyViews, refetchTopics, resetAllFormStates, savedLevelMergeSelections, savedPedagogyMergeSelections, selectedCourse, selectedLevel, selectedLevelTopicsForMerge, selectedPedagogyActivities, selectedSubModuleForTopic, setEditMode, setIsCreatingTopic, setShowDialog, setShowSuccessMessage, setTopicFormData, showLevelSection, showPedagogySection, subModules, subTopics, token, topicFormData, topics, updateTopicMutation } = deps
        e.preventDefault();
        if (!selectedSubModuleForTopic || !selectedCourse || !token) return;
        setIsCreatingTopic(true);
        const alreadyDeletedLevels = new Set<string>();
        const alreadyDeletedPedagogyItems = new Set<string>();
        try {
            // Check if submodule is in course hierarchy
            const hierarchyLevels = selectedCourse.courseHierarchy.map((level: any) => level.toLowerCase());
            const hasSubModules = hierarchyLevels.includes('sub module');
            const hasSubTopics = hierarchyLevels.includes('sub topic');

            const topicData: any = {
                ...topicFormData,
                moduleId: selectedSubModuleForTopic.moduleId,
                courses: selectedCourse._id,
                testConfiguration: moduleTestConfig,
                // Only include subModuleId if submodules are in the hierarchy
                ...(hasSubModules && { subModuleId: selectedSubModuleForTopic.id })
            };

            let topicIdToUnmerge: any = null;
            let newTopic: any;
            if (!addOnlyPedagogyLevel) {
                if (editMode?.type === 'topic') {
                    topicIdToUnmerge = editMode.data._id;
                    await updateTopicMutation.mutateAsync({
                        id: editMode.data._id,
                        data: {
                            ...topicData,
                            index: editMode.data.index
                        }
                    });

                } else {
                    const subModuleTopics = topics.filter((topic: any) => topic.subModuleId === selectedSubModuleForTopic.id);
                    const nextIndex = subModuleTopics.length > 0
                        ? Math.max(...subModuleTopics.map((t: any) => t.index ?? 0)) + 1
                        : 0;

                    newTopic = await createTopicMutation.mutateAsync({
                        ...topicData,
                        subModuleId: selectedSubModuleForTopic.id,
                        moduleId: selectedSubModuleForTopic.moduleId,
                        index: nextIndex
                    });
                    topicIdToUnmerge = newTopic.topic._id;
                }
            }

            // Save level data if level section is shown
            if (showLevelSection && selectedLevel) {
                let levelData: any;

                if (editMode?.type === 'topic' && editingExistingLevelData) {
                    // UPDATE EXISTING LEVEL DATA
                    levelData = {
                        _id: editingExistingLevelData._id,
                        level: selectedLevel,
                        module: savedLevelMergeSelections?.modules || [],
                        subModule: savedLevelMergeSelections?.subModules || [],
                        topic: savedLevelMergeSelections?.topics || [],
                        subTopic: savedLevelMergeSelections?.subTopics || []
                    };

                    // Ensure the editing item is always included
                    if (!levelData.module?.includes(editMode.data._id)) {
                        levelData.module = [...(levelData.module || []), editMode.data._id];
                    }

                    // Update the level in the database - replace the entire entry
                    const updatedLevels = levelsData.map((level: any) =>
                        level._id === editingExistingLevelData._id ? levelData : level
                    );

                    await levelViewMutation.mutateAsync({
                        courses: selectedCourse._id,
                        levels: updatedLevels
                    });
                } else {
                    // CREATE NEW LEVEL DATA
                    levelData = {
                        level: selectedLevel,
                    };

                    if (addOnlyPedagogyLevel) {
                        // Use all selected hierarchy IDs from merge selections
                        const allIds = getAllSelectedHierarchyIds('level');
                        if (allIds.modules.length > 0) levelData.module = allIds.modules;
                        if (hasSubModules && allIds.subModules.length > 0) levelData.subModule = allIds.subModules;
                        if (hierarchyLevels.includes('topic') && allIds.topics.length > 0) levelData.topic = allIds.topics;
                        if (hasSubTopics && allIds.subTopics.length > 0) levelData.subTopic = allIds.subTopics;
                    } else {
                        // Original logic for creating with hierarchy
                        levelData = {
                            ...levelData,
                            // Include parent module
                            ...(hierarchyLevels.includes('module') && {
                                module: [selectedSubModuleForTopic.moduleId]
                            }),
                            // Include parent submodule if it exists in hierarchy
                            ...(hasSubModules && {
                                subModule: [selectedSubModuleForTopic.id]
                            }),
                            // Include newly created topic
                            ...(hierarchyLevels.includes('topic') && {
                                topic: [editMode?.type === 'topic' ? editMode.data._id : newTopic.topic._id]
                            })
                        };

                        // If merging with other topics, include their complete hierarchy
                        if (savedLevelMergeSelections) {
                            levelData.module = [...levelData.module, ...savedLevelMergeSelections.modules];

                            if (hasSubModules) {
                                levelData.subModule = [...levelData.subModule, ...savedLevelMergeSelections.subModules];
                            }

                            levelData.topic = [...levelData.topic, ...savedLevelMergeSelections.topics];

                            if (hasSubTopics && savedLevelMergeSelections.subTopics.length > 0) {
                                levelData.subTopic = savedLevelMergeSelections.subTopics;
                            }
                        }
                    }

                    await levelViewMutation.mutateAsync({
                        courses: selectedCourse._id,
                        levels: [...levelsData, levelData]
                    });
                }
            } else if (editMode?.type === 'topic' && editingExistingLevelData) {
                // If level section is unchecked during edit, remove the level data
                if (editingExistingLevelData._id) {
                    await deleteLevelMutation.mutateAsync(editingExistingLevelData._id);
                }
            }

            // Process pedagogy data if needed
            const hasPedagogyData = Object.keys(pedagogyHours).some(type =>
                Object.keys(pedagogyHours[type as keyof typeof pedagogyHours]).some(
                    activity => (pedagogyHours[type as keyof typeof pedagogyHours][activity] || 0) > 0
                )
            );

            if (showPedagogySection && hasPedagogyData) {
                const hierarchyLevels = selectedCourse.courseHierarchy.map((l: any) => l.toLowerCase());
                const hasSubModules = hierarchyLevels.includes('sub module');
                const hasTopics = hierarchyLevels.includes('topic');
                const hasSubTopics = hierarchyLevels.includes('sub topic');

                // First, remove ALL pedagogy data containing the editing element ID
                if (editMode?.type === 'topic') {
                    const hierarchyIdsForDeletion = {
                        topics: [editMode.data._id]
                    };

                    await checkAndDeleteExistingPedagogyData(
                        hierarchyIdsForDeletion,
                        alreadyDeletedPedagogyItems
                    );
                }
                if (showPedagogySection && editMode) {
                    for (const activityType of ["iDo", "weDo", "youDo"] as const) {
                        for (const activity of selectedPedagogyActivities[activityType]) {
                            if (savedPedagogyMergeSelections[activityType]?.[activity]) {
                                await deleteSingleCellValuesForMerge(
                                    editMode.data._id,
                                    activityType,
                                    activity
                                );
                            }
                        }
                    }
                }
                // Now, save ALL pedagogy values from the current form
                const pedagogyDataFromForm: any[] = [];

                (["iDo", "weDo", "youDo"] as const).forEach(activityType => {
                    selectedPedagogyActivities[activityType]
                        .filter((activity: any) => (pedagogyHours[activityType][activity] || 0) > 0)
                        .forEach((activity: any) => {
                            const activityDuration = pedagogyHours[activityType][activity] || 0;
                            let baseHierarchy: any = {};

                            if (addOnlyPedagogyLevel) {
                                // Use all selected hierarchy IDs from merge selections
                                const allIds = getAllSelectedHierarchyIds('pedagogy');
                                if (allIds.modules.length > 0) baseHierarchy.module = allIds.modules;
                                if (hasSubModules && allIds.subModules.length > 0) baseHierarchy.subModule = allIds.subModules;
                                if (hasTopics && allIds.topics.length > 0) baseHierarchy.topic = allIds.topics;
                                if (hasSubTopics && allIds.subTopics.length > 0) baseHierarchy.subTopic = allIds.subTopics;
                            } else {
                                // Original logic
                                baseHierarchy = {
                                    // Include parent hierarchy based on dialog type
                                    ...(hierarchyLevels.includes('module') && {
                                        module: [selectedSubModuleForTopic?.moduleId]
                                    }),
                                    ...(hasSubModules && {
                                        subModule: [selectedSubModuleForTopic?.id]
                                    }),
                                    ...(hasTopics && {
                                        topic: [editMode?.type === 'topic' ? editMode.data._id : newTopic?.topic._id]
                                    })
                                };
                            }

                            // Filter out empty arrays
                            Object.keys(baseHierarchy).forEach(key => {
                                if (Array.isArray(baseHierarchy[key]) && baseHierarchy[key].length === 0) {
                                    delete baseHierarchy[key];
                                }
                            });

                            // Check if this activity has specific merge selections
                            const activityMerge = savedPedagogyMergeSelections[activityType]?.[activity];

                            if (activityMerge) {
                                // Create a merged pedagogy entry with combined hierarchy
                                const mergedHierarchy: any = {
                                    [activityType]: [{ type: activity, duration: activityDuration }]
                                };

                                // Combine base hierarchy with merge hierarchy
                                if (baseHierarchy.module || activityMerge.modules.length > 0) {
                                    mergedHierarchy.module = [...new Set([
                                        ...(baseHierarchy.module || []),
                                        ...activityMerge.modules
                                    ])];
                                }

                                if (hasSubModules && (baseHierarchy.subModule || activityMerge.subModules.length > 0)) {
                                    mergedHierarchy.subModule = [...new Set([
                                        ...(baseHierarchy.subModule || []),
                                        ...activityMerge.subModules
                                    ])];
                                }

                                if (hasTopics && (baseHierarchy.topic || activityMerge.topics.length > 0)) {
                                    mergedHierarchy.topic = [...new Set([
                                        ...(baseHierarchy.topic || []),
                                        ...activityMerge.topics
                                    ])];
                                }

                                if (hasSubTopics && (baseHierarchy.subTopic || activityMerge.subTopics.length > 0)) {
                                    mergedHierarchy.subTopic = [...new Set([
                                        ...(baseHierarchy.subTopic || []),
                                        ...activityMerge.subTopics
                                    ])];
                                }

                                pedagogyDataFromForm.push(mergedHierarchy);
                            } else {
                                // Create a regular pedagogy entry with just the base hierarchy
                                const regularHierarchy: any = {
                                    ...baseHierarchy,
                                    [activityType]: [{ type: activity, duration: activityDuration }]
                                };

                                pedagogyDataFromForm.push(regularHierarchy);
                            }
                        });
                });

                // Save ALL pedagogy data from the form
                if (pedagogyDataFromForm.length > 0) {
                    // Get existing pedagogy data that doesn't contain the editing element
                    const existingPedagogyWithoutEditingItem = pedagogyViews?.[0]?.pedagogies?.filter((pedagogy: any) => {
                        // Own row only: a descendant's hours also carry this id.
                        const containsEditingItem = isOwnPedagogyRow(pedagogy, 'topic', editMode?.data?._id);
                        return !containsEditingItem;
                    }) || [];

                    // Combine existing pedagogy (without editing item) with new form data
                    const allPedagogyData = [...existingPedagogyWithoutEditingItem, ...pedagogyDataFromForm];

                    await pedagogyMutation.mutateAsync({
                        courses: selectedCourse._id,
                        pedagogies: allPedagogyData
                    });
                } else {
                    // If no pedagogy data in form, remove all pedagogy containing the editing item
                    const existingPedagogyWithoutEditingItem = pedagogyViews?.[0]?.pedagogies?.filter((pedagogy: any) => {
                        // Own row only: a descendant's hours also carry this id.
                        const containsEditingItem = isOwnPedagogyRow(pedagogy, 'topic', editMode?.data?._id);
                        return !containsEditingItem;
                    }) || [];

                    await pedagogyMutation.mutateAsync({
                        courses: selectedCourse._id,
                        pedagogies: existingPedagogyWithoutEditingItem
                    });
                }
            } else if (editMode?.type === 'topic') {
                // Pedagogy unticked during edit = clear THIS topic's hours.
                // Scoped to its own rows; the id-containment delete also
                // removed every descendant's hours.
                await deleteOwnPedagogyRows(
                    'topic',
                    editMode.data._id,
                    alreadyDeletedPedagogyItems
                );

                // Remove from local state as well
                const existingPedagogyWithoutEditingItem = pedagogyViews?.[0]?.pedagogies?.filter((pedagogy: any) => {
                    // Own row only: a descendant's hours also carry this id.
                    const containsEditingItem = isOwnPedagogyRow(pedagogy, 'topic', editMode?.data?._id);
                    return !containsEditingItem;
                }) || [];

                await pedagogyMutation.mutateAsync({
                    courses: selectedCourse._id,
                    pedagogies: existingPedagogyWithoutEditingItem
                });
            }
            // Add this right after creating the topic but BEFORE processing level/pedagogy data
            if (!addOnlyPedagogyLevel) {
                // Get all selected topics for merging
                const selectedLevelTopicsData = topics.filter((t: any) => selectedLevelTopicsForMerge.has(t._id));

                // Combine both selections for deletion

                const alreadyDeletedLevels = new Set<string>();
                const alreadyDeletedPedagogyItems = new Set<string>();

                // Collect all hierarchy IDs from selected topics
                const parentModuleIds = new Set([selectedSubModuleForTopic.moduleId]);
                const parentSubModuleIds = new Set([selectedSubModuleForTopic.id]);


                const hierarchyIdsForModuleDeletion = {
                    modules: Array.from(parentModuleIds),
                    subModules: Array.from(parentSubModuleIds),
                    topics: [],
                    subTopics: []
                };

                // Check and delete existing data for all selected items
                await checkAndDeleteExistingPedagogyData(
                    hierarchyIdsForModuleDeletion,
                    alreadyDeletedPedagogyItems,
                    editMode?.type === 'topic', // preserve editing item if we're in edit mode
                    editMode?.data?._id // editing item ID
                );
                await checkAndDeleteExistingLevelData(
                    hierarchyIdsForModuleDeletion,
                    alreadyDeletedLevels,
                    editMode?.type === 'topic', // preserve editing item if we're in edit mode
                    editMode?.data?._id // editing item ID
                );
                checkAndDeleteExistingMergedCells(hierarchyIdsForModuleDeletion);

                // Collect hierarchy IDs for LEVEL deletion
                const levelHierarchyIds = {
                    modules: new Set([selectedSubModuleForTopic.moduleId]),
                    subModules: new Set<string>(),
                    topics: new Set([editMode?.type === 'topic' ? editMode.data._id : newTopic.topic._id]),
                    subTopics: new Set<string>()
                };

                if (selectedSubModuleForTopic.id && !selectedSubModuleForTopic.id.includes('placeholder')) {
                    levelHierarchyIds.subModules.add(selectedSubModuleForTopic.id);
                }

                selectedLevelTopicsData.forEach((topic: any) => {
                    levelHierarchyIds.modules.add(topic.moduleId);
                    if (topic.subModuleId) levelHierarchyIds.subModules.add(topic.subModuleId);
                    levelHierarchyIds.topics.add(topic._id);

                    // Get all subtopics under selected topics for level deletion
                    const topicSubTopics = subTopics.filter((st: any) => st.topicId === topic._id);
                    topicSubTopics.forEach((subTopic: any) => {
                        levelHierarchyIds.subTopics.add(subTopic._id);
                    });
                });

                // Convert to arrays
                const levelIdsForDeletion = {
                    modules: Array.from(levelHierarchyIds.modules),
                    subModules: Array.from(levelHierarchyIds.subModules),
                    topics: Array.from(levelHierarchyIds.topics),
                    subTopics: Array.from(levelHierarchyIds.subTopics)
                };

                // Delete level data for level selections only
                await checkAndDeleteExistingLevelData(levelIdsForDeletion, alreadyDeletedLevels, editMode?.type === 'topic', editMode?.data?._id);

                // Delete pedagogy data for pedagogy selections only
                const pedagogyHierarchyIds = collectPedagogyHierarchyIdsForDeletion();

                await checkAndDeleteExistingPedagogyDataForSelectedActivities(
                    pedagogyHierarchyIds,
                    alreadyDeletedPedagogyItems,
                    editMode?.type === 'topic', // preserve editing item if we're in edit mode
                    editMode?.data?._id // editing item ID
                );

                // Delete merged cells for both
                const mergedCellsHierarchyIds = {
                    modules: Array.from(new Set([...levelHierarchyIds.modules, ...pedagogyHierarchyIds.modules])),
                    subModules: Array.from(new Set([...levelHierarchyIds.subModules, ...pedagogyHierarchyIds.subModules])),
                    topics: Array.from(new Set([...levelHierarchyIds.topics, ...pedagogyHierarchyIds.topics])),
                    subTopics: Array.from(new Set([...levelHierarchyIds.subTopics, ...pedagogyHierarchyIds.subTopics]))
                };

                checkAndDeleteExistingMergedCells(mergedCellsHierarchyIds);

            } else {
                // DELETE LOGIC FOR ADD ONLY PEDAGOGY/LEVEL MODE
                // Get all selected hierarchy IDs for deletion
                const hierarchyIds = getAllSelectedHierarchyIds('pedagogy');

                // Track already deleted items to prevent duplicate deletion
                const alreadyDeletedLevels = new Set<string>();
                const alreadyDeletedPedagogyItems = new Set<string>();

                // Check and delete existing level data
                if (showLevelSection && selectedLevel) {
                    await checkAndDeleteExistingLevelData(hierarchyIds, alreadyDeletedLevels, false);
                }

                // Check and delete existing pedagogy data for selected activities
                await checkAndDeleteExistingPedagogyDataForSelectedActivities(
                    hierarchyIds,
                    alreadyDeletedPedagogyItems,
                    false
                );

                // Check and delete existing merged cells
                checkAndDeleteExistingMergedCells(hierarchyIds);
            }
            await refetchTopics();

            setShowDialog(false);
            setTopicFormData({
                title: '',
                description: '',
                level: 'Easy',
                duration: 0
            });
            setEditMode(null);
            resetAllFormStates();
            setShowSuccessMessage(true);
            setTimeout(() => setShowSuccessMessage(false), 2000);
        } catch (error) {
            console.error("Failed to create/update topic:", error);
        } finally {
            setIsCreatingTopic(false);
        }
}

export async function handleSubTopicSubmitImpl(e: React.FormEvent, deps: SubmitDeps) {
    const { addOnlyPedagogyLevel, checkAndDeleteExistingLevelData, checkAndDeleteExistingMergedCells, checkAndDeleteExistingPedagogyData, checkAndDeleteExistingPedagogyDataForSelectedActivities, collectPedagogyHierarchyIdsForDeletion, courses, createSubTopicMutation, deleteLevelMutation, deleteOwnPedagogyRows, deleteSingleCellValuesForMerge, dialogType, editMode, editingExistingLevelData, getAllSelectedHierarchyIds, levelViewMutation, levelsData, mergedCells, moduleTestConfig, modules, pedagogyHours, pedagogyMutation, pedagogyViews, refetchSubTopics, refetchTopicSubTopics, resetAllFormStates, savedLevelMergeSelections, savedPedagogyMergeSelections, selectedCourse, selectedLevel, selectedLevelSubTopicsForMerge, selectedPedagogyActivities, selectedTopicForSubTopic, setEditMode, setIsCreatingSubTopic, setMergedCells, setShowDialog, setShowSuccessMessage, setSubTopicFormData, showLevelSection, showPedagogySection, subModules, subTopicFormData, subTopics, token, topics, updateSubTopicMutation } = deps
        e.preventDefault();
        if (!selectedTopicForSubTopic || !selectedCourse || !token) return;
        setIsCreatingSubTopic(true);

        // Track already deleted items to prevent duplicate deletion
        const alreadyDeletedLevels = new Set<string>();
        const alreadyDeletedPedagogyItems = new Set<string>();

        try {
            // Check if submodules are in course hierarchy
            const hierarchyLevels = selectedCourse.courseHierarchy.map((level: any) => level.toLowerCase());
            const hasSubModules = hierarchyLevels.includes('sub module');
            const hasSubTopics = hierarchyLevels.includes('sub topic');

            const subTopicData: any = {
                ...subTopicFormData,
                topicId: selectedTopicForSubTopic.id,
                courses: selectedCourse._id,
                testConfiguration: moduleTestConfig,
                // Include parent hierarchy references
                moduleId: selectedTopicForSubTopic.moduleId,
                ...(hasSubModules && { subModuleId: selectedTopicForSubTopic.subModuleId })
            };

            let subTopicIdToUnmerge: any = null;
            let newSubTopic: any;

            if (!addOnlyPedagogyLevel) {
                if (editMode?.type === 'subtopic') {
                    subTopicIdToUnmerge = editMode.data._id;
                    await updateSubTopicMutation.mutateAsync({
                        id: editMode.data._id,
                        data: {
                            ...subTopicData,
                            index: editMode.data.index
                        }
                    });
                } else {
                    const topicSubTopics = subTopics.filter((subTopic: any) => subTopic.topicId === selectedTopicForSubTopic.id);
                    const nextIndex = topicSubTopics.length > 0
                        ? Math.max(...topicSubTopics.map((t: any) => t.index ?? 0)) + 1
                        : 0;

                    newSubTopic = await createSubTopicMutation.mutateAsync({
                        ...subTopicData,
                        index: nextIndex
                    });
                    subTopicIdToUnmerge = newSubTopic.subTopic._id;
                }
            }

            // Save level data if level section is shown
            if (showLevelSection && selectedLevel) {
                let levelData: any;

                if (editMode?.type === 'subtopic' && editingExistingLevelData) {
                    // UPDATE EXISTING LEVEL DATA
                    levelData = {
                        _id: editingExistingLevelData._id,
                        level: selectedLevel,
                        module: savedLevelMergeSelections?.modules || [],
                        subModule: savedLevelMergeSelections?.subModules || [],
                        topic: savedLevelMergeSelections?.topics || [],
                        subTopic: savedLevelMergeSelections?.subTopics || []
                    };

                    // Ensure the editing item is always included
                    if (!levelData.subTopic?.includes(editMode.data._id)) {
                        levelData.subTopic = [...(levelData.subTopic || []), editMode.data._id];
                    }

                    // Update the level in the database - replace the entire entry
                    const updatedLevels = levelsData.map((level: any) =>
                        level._id === editingExistingLevelData._id ? levelData : level
                    );

                    await levelViewMutation.mutateAsync({
                        courses: selectedCourse._id,
                        levels: updatedLevels
                    });
                } else {
                    // CREATE NEW LEVEL DATA
                    levelData = {
                        level: selectedLevel,
                    };

                    if (addOnlyPedagogyLevel) {
                        // Use all selected hierarchy IDs from merge selections
                        const allIds = getAllSelectedHierarchyIds('level');
                        if (allIds.modules.length > 0) levelData.module = allIds.modules;
                        if (hasSubModules && allIds.subModules.length > 0) levelData.subModule = allIds.subModules;
                        if (hierarchyLevels.includes('topic') && allIds.topics.length > 0) levelData.topic = allIds.topics;
                        if (hasSubTopics && allIds.subTopics.length > 0) levelData.subTopic = allIds.subTopics;
                    } else {
                        // Original logic for creating with hierarchy
                        levelData = {
                            ...levelData,
                            // Include parent module
                            ...(hierarchyLevels.includes('module') && {
                                module: [selectedTopicForSubTopic.moduleId]
                            }),
                            // Include parent submodule if it exists in hierarchy
                            ...(hasSubModules && selectedTopicForSubTopic.subModuleId && {
                                subModule: [selectedTopicForSubTopic.subModuleId]
                            }),
                            // Include parent topic
                            ...(hierarchyLevels.includes('topic') && {
                                topic: [selectedTopicForSubTopic.id]
                            }),
                            // Include newly created subtopic
                            ...(hierarchyLevels.includes('sub topic') && {
                                subTopic: [editMode?.type === 'subtopic' ? editMode.data._id : newSubTopic.subTopic._id]
                            })
                        };

                        // If merging with other subtopics, include their complete hierarchy
                        if (savedLevelMergeSelections) {
                            levelData.module = [...levelData.module, ...savedLevelMergeSelections.modules];

                            if (hasSubModules) {
                                levelData.subModule = [...levelData.subModule, ...savedLevelMergeSelections.subModules];
                            }

                            levelData.topic = [...levelData.topic, ...savedLevelMergeSelections.topics];
                            levelData.subTopic = [...levelData.subTopic, ...savedLevelMergeSelections.subTopics];
                        }
                    }

                    await levelViewMutation.mutateAsync({
                        courses: selectedCourse._id,
                        levels: [...levelsData, levelData]
                    });
                }
            } else if (editMode?.type === 'subtopic' && editingExistingLevelData) {
                // If level section is unchecked during edit, remove the level data
                if (editingExistingLevelData._id) {
                    await deleteLevelMutation.mutateAsync(editingExistingLevelData._id);
                }
            }

            // Process pedagogy data if needed
            const hasPedagogyData = Object.keys(pedagogyHours).some(type =>
                Object.keys(pedagogyHours[type as keyof typeof pedagogyHours]).some(
                    activity => (pedagogyHours[type as keyof typeof pedagogyHours][activity] || 0) > 0
                )
            );

            if (showPedagogySection && hasPedagogyData) {
                const hierarchyLevels = selectedCourse.courseHierarchy.map((l: any) => l.toLowerCase());
                const hasSubModules = hierarchyLevels.includes('sub module');
                const hasTopics = hierarchyLevels.includes('topic');
                const hasSubTopics = hierarchyLevels.includes('sub topic');

                // First, remove ALL pedagogy data containing the editing element ID
                if (editMode?.type === 'subtopic') {
                    const hierarchyIdsForDeletion = {
                        subTopics: [editMode.data._id]
                    };

                    await checkAndDeleteExistingPedagogyData(
                        hierarchyIdsForDeletion,
                        alreadyDeletedPedagogyItems
                    );
                }
                if (showPedagogySection && editMode) {
                    for (const activityType of ["iDo", "weDo", "youDo"] as const) {
                        for (const activity of selectedPedagogyActivities[activityType]) {
                            if (savedPedagogyMergeSelections[activityType]?.[activity]) {
                                await deleteSingleCellValuesForMerge(
                                    editMode.data._id,
                                    activityType,
                                    activity
                                );
                            }
                        }
                    }
                }
                // Now, save ALL pedagogy values from the current form
                const pedagogyDataFromForm: any[] = [];

                (["iDo", "weDo", "youDo"] as const).forEach(activityType => {
                    selectedPedagogyActivities[activityType]
                        .filter((activity: any) => (pedagogyHours[activityType][activity] || 0) > 0)
                        .forEach((activity: any) => {
                            const activityDuration = pedagogyHours[activityType][activity] || 0;
                            let baseHierarchy: any = {};

                            if (addOnlyPedagogyLevel) {
                                // Use all selected hierarchy IDs from merge selections
                                const allIds = getAllSelectedHierarchyIds('pedagogy');
                                if (allIds.modules.length > 0) baseHierarchy.module = allIds.modules;
                                if (hasSubModules && allIds.subModules.length > 0) baseHierarchy.subModule = allIds.subModules;
                                if (hasTopics && allIds.topics.length > 0) baseHierarchy.topic = allIds.topics;
                                if (hasSubTopics && allIds.subTopics.length > 0) baseHierarchy.subTopic = allIds.subTopics;
                            } else {
                                // Original logic
                                baseHierarchy = {
                                    // Include parent hierarchy based on dialog type
                                    ...(hierarchyLevels.includes('module') && {
                                        module: [selectedTopicForSubTopic?.moduleId]
                                    }),
                                    ...(hasSubModules && {
                                        subModule: dialogType === 'subtopic' ? [selectedTopicForSubTopic?.subModuleId] : []
                                    }),
                                    ...(hasTopics && {
                                        topic: dialogType === 'subtopic' ? [selectedTopicForSubTopic?.id] : []
                                    }),
                                    ...(hasSubTopics && dialogType === 'subtopic' && {
                                        subTopic: [editMode?.type === 'subtopic' ? editMode.data._id : newSubTopic?.subTopic._id]
                                    })
                                };
                            }

                            // Filter out empty arrays
                            Object.keys(baseHierarchy).forEach(key => {
                                if (Array.isArray(baseHierarchy[key]) && baseHierarchy[key].length === 0) {
                                    delete baseHierarchy[key];
                                }
                            });

                            // Check if this activity has specific merge selections
                            const activityMerge = savedPedagogyMergeSelections[activityType]?.[activity];

                            if (activityMerge) {
                                // Create a merged pedagogy entry with combined hierarchy
                                const mergedHierarchy: any = {
                                    [activityType]: [{ type: activity, duration: activityDuration }]
                                };

                                // Combine base hierarchy with merge hierarchy
                                if (baseHierarchy.module || activityMerge.modules.length > 0) {
                                    mergedHierarchy.module = [...new Set([
                                        ...(baseHierarchy.module || []),
                                        ...activityMerge.modules
                                    ])];
                                }

                                if (hasSubModules && (baseHierarchy.subModule || activityMerge.subModules.length > 0)) {
                                    mergedHierarchy.subModule = [...new Set([
                                        ...(baseHierarchy.subModule || []),
                                        ...activityMerge.subModules
                                    ])];
                                }

                                if (hasTopics && (baseHierarchy.topic || activityMerge.topics.length > 0)) {
                                    mergedHierarchy.topic = [...new Set([
                                        ...(baseHierarchy.topic || []),
                                        ...activityMerge.topics
                                    ])];
                                }

                                if (hasSubTopics && (baseHierarchy.subTopic || activityMerge.subTopics.length > 0)) {
                                    mergedHierarchy.subTopic = [...new Set([
                                        ...(baseHierarchy.subTopic || []),
                                        ...activityMerge.subTopics
                                    ])];
                                }

                                pedagogyDataFromForm.push(mergedHierarchy);
                            } else {
                                // Create a regular pedagogy entry with just the base hierarchy
                                const regularHierarchy: any = {
                                    ...baseHierarchy,
                                    [activityType]: [{ type: activity, duration: activityDuration }]
                                };

                                pedagogyDataFromForm.push(regularHierarchy);
                            }
                        });
                });

                // Save ALL pedagogy data from the form
                if (pedagogyDataFromForm.length > 0) {
                    // Get existing pedagogy data that doesn't contain the editing element
                    const existingPedagogyWithoutEditingItem = pedagogyViews?.[0]?.pedagogies?.filter((pedagogy: any) => {
                        // Own row only: a descendant's hours also carry this id.
                        const containsEditingItem = isOwnPedagogyRow(pedagogy, 'subtopic', editMode?.data?._id);
                        return !containsEditingItem;
                    }) || [];

                    // Combine existing pedagogy (without editing item) with new form data
                    const allPedagogyData = [...existingPedagogyWithoutEditingItem, ...pedagogyDataFromForm];

                    await pedagogyMutation.mutateAsync({
                        courses: selectedCourse._id,
                        pedagogies: allPedagogyData
                    });
                } else {
                    // If no pedagogy data in form, remove all pedagogy containing the editing item
                    const existingPedagogyWithoutEditingItem = pedagogyViews?.[0]?.pedagogies?.filter((pedagogy: any) => {
                        // Own row only: a descendant's hours also carry this id.
                        const containsEditingItem = isOwnPedagogyRow(pedagogy, 'subtopic', editMode?.data?._id);
                        return !containsEditingItem;
                    }) || [];

                    await pedagogyMutation.mutateAsync({
                        courses: selectedCourse._id,
                        pedagogies: existingPedagogyWithoutEditingItem
                    });
                }
            } else if (editMode?.type === 'subtopic') {
                // Pedagogy unticked during edit = clear THIS subtopic's hours.
                // Scoped to its own rows; the id-containment delete also
                // removed every descendant's hours.
                await deleteOwnPedagogyRows(
                    'subtopic',
                    editMode.data._id,
                    alreadyDeletedPedagogyItems
                );

                // Remove from local state as well
                const existingPedagogyWithoutEditingItem = pedagogyViews?.[0]?.pedagogies?.filter((pedagogy: any) => {
                    // Own row only: a descendant's hours also carry this id.
                    const containsEditingItem = isOwnPedagogyRow(pedagogy, 'subtopic', editMode?.data?._id);
                    return !containsEditingItem;
                }) || [];

                await pedagogyMutation.mutateAsync({
                    courses: selectedCourse._id,
                    pedagogies: existingPedagogyWithoutEditingItem
                });
            }

            // Add this right after creating the subtopic but BEFORE processing level/pedagogy data
            if (!addOnlyPedagogyLevel) {
                // Get all selected subtopics for merging
                const selectedLevelSubTopicsData = subTopics.filter((st: any) => selectedLevelSubTopicsForMerge.has(st._id));

                // Collect all hierarchy IDs from selected subtopics
                const parentModuleIds = new Set([selectedTopicForSubTopic.moduleId]);
                const parentSubModuleIds = new Set([selectedTopicForSubTopic.subModuleId || '']);
                const parentTopicIds = new Set([selectedTopicForSubTopic.id]);

                const hierarchyIdsForParentDeletion = {
                    modules: Array.from(parentModuleIds),
                    subModules: Array.from(parentSubModuleIds),
                    topics: Array.from(parentTopicIds),
                    subTopics: []
                };

                // Check and delete existing data for all parent items
                await checkAndDeleteExistingPedagogyData(
                    hierarchyIdsForParentDeletion,
                    alreadyDeletedPedagogyItems,
                    editMode?.type === 'subtopic', // preserve editing item if we're in edit mode
                    editMode?.data?._id // editing item ID
                );
                await checkAndDeleteExistingLevelData(
                    hierarchyIdsForParentDeletion,
                    alreadyDeletedLevels,
                    editMode?.type === 'subtopic', // preserve editing item if we're in edit mode
                    editMode?.data?._id // editing item ID
                );
                checkAndDeleteExistingMergedCells(hierarchyIdsForParentDeletion);

                // Collect hierarchy IDs for LEVEL deletion
                const levelHierarchyIds = {
                    modules: new Set<string>(),
                    subModules: new Set<string>(),
                    topics: new Set([selectedTopicForSubTopic.id]),
                    subTopics: new Set([editMode?.type === 'subtopic' ? editMode.data._id : newSubTopic?.subTopic._id])
                };

                // Add parent hierarchy for the new subtopic
                levelHierarchyIds.modules.add(selectedTopicForSubTopic.moduleId);
                if (selectedTopicForSubTopic.subModuleId) {
                    levelHierarchyIds.subModules.add(selectedTopicForSubTopic.subModuleId);
                }

                selectedLevelSubTopicsData.forEach((subTopic: any) => {
                    const parentTopic = topics.find((t: any) => t._id === subTopic.topicId);
                    if (parentTopic) {
                        levelHierarchyIds.modules.add(parentTopic.moduleId);
                        if (parentTopic.subModuleId) levelHierarchyIds.subModules.add(parentTopic.subModuleId);
                        levelHierarchyIds.topics.add(parentTopic._id);
                    }
                    levelHierarchyIds.subTopics.add(subTopic._id);
                });

                // Convert to arrays
                const levelIdsForDeletion = {
                    modules: Array.from(levelHierarchyIds.modules),
                    subModules: Array.from(levelHierarchyIds.subModules),
                    topics: Array.from(levelHierarchyIds.topics),
                    subTopics: Array.from(levelHierarchyIds.subTopics)
                };

                // Delete level data for level selections only
                await checkAndDeleteExistingLevelData(levelIdsForDeletion, alreadyDeletedLevels, editMode?.type === 'subtopic', // preserve editing item if we're in edit mode
                    editMode?.data?._id);

                // Delete pedagogy data for pedagogy selections only
                const pedagogyHierarchyIds = collectPedagogyHierarchyIdsForDeletion();

                await checkAndDeleteExistingPedagogyDataForSelectedActivities(
                    pedagogyHierarchyIds,
                    alreadyDeletedPedagogyItems,
                    editMode?.type === 'subtopic', // preserve editing item if we're in edit mode
                    editMode?.data?._id // editing item ID
                );

                // Delete merged cells for both
                const mergedCellsHierarchyIds = {
                    modules: Array.from(new Set([...levelHierarchyIds.modules, ...pedagogyHierarchyIds.modules])),
                    subModules: Array.from(new Set([...levelHierarchyIds.subModules, ...pedagogyHierarchyIds.subModules])),
                    topics: Array.from(new Set([...levelHierarchyIds.topics, ...pedagogyHierarchyIds.topics])),
                    subTopics: Array.from(new Set([...levelHierarchyIds.subTopics, ...pedagogyHierarchyIds.subTopics]))
                };

                checkAndDeleteExistingMergedCells(mergedCellsHierarchyIds);
            } else {
                // DELETE LOGIC FOR ADD ONLY PEDAGOGY/LEVEL MODE
                // Get all selected hierarchy IDs for deletion
                const hierarchyIds = getAllSelectedHierarchyIds('pedagogy');
                const alreadyDeletedLevels = new Set<string>();
                const alreadyDeletedPedagogyItems = new Set<string>();
                // Check and delete existing level data
                if (showLevelSection && selectedLevel) {
                    await checkAndDeleteExistingLevelData(hierarchyIds, alreadyDeletedLevels, false);
                }

                // Check and delete existing pedagogy data for selected activities
                await checkAndDeleteExistingPedagogyDataForSelectedActivities(
                    hierarchyIds,
                    alreadyDeletedPedagogyItems, false
                );

                // Check and delete existing merged cells
                checkAndDeleteExistingMergedCells(hierarchyIds);
            }

            // Clear local merged cells that contain the editing item
            if (editMode?.type === 'subtopic') {
                const updatedMergedCells = { ...mergedCells };
                Object.keys(updatedMergedCells).forEach(key => {
                    updatedMergedCells[key] = updatedMergedCells[key].filter((merge: any) => {
                        const containsEditingItem =
                            merge.hierarchyIds?.subTopics.includes(editMode.data._id);

                        return !containsEditingItem;
                    });
                });
                setMergedCells(updatedMergedCells);
            }

            await refetchSubTopics();
            if (selectedTopicForSubTopic.id) {
                await refetchTopicSubTopics();
            }

            setShowDialog(false);
            setSubTopicFormData({
                title: '',
                description: '',
                level: 'Easy',
                duration: 0
            });
            setEditMode(null);
            resetAllFormStates();
            setShowSuccessMessage(true);
            setTimeout(() => setShowSuccessMessage(false), 2000);
        } catch (error) {
            console.error("Failed to create/update subtopic:", error);
        } finally {
            setIsCreatingSubTopic(false);
        }
}
