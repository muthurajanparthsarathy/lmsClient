"use client"

// Deletion of merged pedagogy/level cells when a hierarchy node is removed.
// Moved verbatim out of page.tsx during the split. It closed over eight values;
// they now arrive in one `deps` object and the page keeps a same-named wrapper,
// so all ten call sites are unchanged. Deps are typed loosely on purpose — the
// real state and setters still live in the page; this only relays them.

import type React from "react"
import type { Course, MergedCell, MergedLevel } from "./types"

export interface MergedCellsDeps {
    dialogType: any;
    editMode: any;
    isFirstChild: (dialogType: any, editMode: any) => boolean;
    mergedCells: { [key: string]: MergedCell[] };
    mergedLevels: MergedLevel[];
    selectedCourse: Course | null;
    setMergedCells: (value: any) => void;
    setMergedLevels: (value: any) => void;
    // The course's hierarchy lists (react-query data), read to resolve ids.
    modules: any[];
    subModules: any[];
    topics: any[];
    subTopics: any[];
}

export function checkAndDeleteExistingMergedCellsImpl(hierarchyIds: {
    modules?: string[];
    subModules?: string[];
    topics?: string[];
    subTopics?: string[];
}, deps: MergedCellsDeps) {
const {
        dialogType, editMode, isFirstChild, mergedCells, mergedLevels,
        selectedCourse, setMergedCells, setMergedLevels,
        modules, subModules, topics, subTopics,
    } = deps
    const updatedMergedCells = { ...mergedCells };

    // Determine if this is the first child
    const firstChild = isFirstChild(dialogType, editMode);
    const getModuleIndex = (moduleId: string) => {
        const module = modules.find(m => m._id === moduleId);
        return module?.index || 0;
    };
    const isMergedWithHigherIndexModules = (merge: any, currentModuleId: string) => {
        if (!merge.hierarchyIds?.modules || merge.hierarchyIds.modules.length <= 1) {
            return false;
        }

        const currentModuleIndex = getModuleIndex(currentModuleId);
        const hasHigherIndexModule = merge.hierarchyIds.modules.some((moduleId: string) => {
            if (moduleId === currentModuleId) return false;
            const otherModuleIndex = getModuleIndex(moduleId);
            return otherModuleIndex > currentModuleIndex;
        });

        return hasHigherIndexModule;
    };
    const isParentMergedWithHigherIndex = (merge: any, dialogType: string | null, hierarchyIds: any) => {
        if (!dialogType) return false;

        let currentParentId = '';
        let parentType: 'module' | 'submodule' | 'topic' = 'module';

        // Determine current parent ID and type based on dialog type
        switch (dialogType) {
            case 'submodule':
                currentParentId = hierarchyIds.modules?.[0] || '';
                parentType = 'module';
                break;
            case 'topic':
                const hierarchyLevels = selectedCourse?.courseHierarchy.map(l => l.toLowerCase()) || [];
                const hasSubModules = hierarchyLevels.includes('sub module');
                if (hasSubModules) {
                    currentParentId = hierarchyIds.subModules?.[0] || '';
                    parentType = 'submodule';
                } else {
                    currentParentId = hierarchyIds.modules?.[0] || '';
                    parentType = 'module';
                }
                break;
            case 'subtopic':
                currentParentId = hierarchyIds.topics?.[0] || '';
                parentType = 'topic';
                break;
            default:
                return false;
        }

        if (!currentParentId) return false;

        // Check if the parent type is merged in this merge
        const parentHierarchyField = parentType === 'module' ? 'modules' :
            parentType === 'submodule' ? 'subModules' : 'topics';

        if (!merge.hierarchyIds?.[parentHierarchyField] || merge.hierarchyIds[parentHierarchyField].length <= 1) {
            return false;
        }
        let currentParentIndex = 0;
        if (parentType === 'module') {
            currentParentIndex = getModuleIndex(currentParentId);
        } else if (parentType === 'submodule') {
            const subModule = subModules.find(sm => sm._id === currentParentId);
            currentParentIndex = subModule?.index || 0;
        } else if (parentType === 'topic') {
            const topic = topics.find(t => t._id === currentParentId);
            currentParentIndex = topic?.index || 0;
        }

        // Check if merged with higher index elements of the same parent type
        const hasHigherIndexParent = merge.hierarchyIds[parentHierarchyField].some((id: string) => {
            if (id === currentParentId) return false;

            let otherIndex = 0;
            if (parentType === 'module') {
                otherIndex = getModuleIndex(id);
            } else if (parentType === 'submodule') {
                const otherSubModule = subModules.find(sm => sm._id === id);
                otherIndex = otherSubModule?.index || 0;
            } else if (parentType === 'topic') {
                const otherTopic = topics.find(t => t._id === id);
                otherIndex = otherTopic?.index || 0;
            }

            return otherIndex > currentParentIndex;
        });

        return hasHigherIndexParent;
    };
    // For first child: use existing logic to delete all merged cells containing parent hierarchy
    if (firstChild) {
        Object.keys(updatedMergedCells).forEach(key => {
            updatedMergedCells[key] = updatedMergedCells[key].filter(merge => {
                const moduleConflict = hierarchyIds.modules?.some(id =>
                    merge.hierarchyIds?.modules.includes(id)
                );
                const subModuleConflict = hierarchyIds.subModules?.some(id =>
                    merge.hierarchyIds?.subModules.includes(id)
                );
                const topicConflict = hierarchyIds.topics?.some(id =>
                    merge.hierarchyIds?.topics.includes(id)
                );
                const subtopicConflict = hierarchyIds.subTopics?.some(id =>
                    merge.hierarchyIds?.subTopics.includes(id)
                );

                return !(moduleConflict || subModuleConflict || topicConflict || subtopicConflict);
            });
        });

        setMergedCells(updatedMergedCells);

        const updatedMergedLevels = mergedLevels.filter(merge => {
            const moduleConflict = hierarchyIds.modules?.some(id =>
                merge.hierarchyIds.modules.includes(id)
            );
            const subModuleConflict = hierarchyIds.subModules?.some(id =>
                merge.hierarchyIds.subModules.includes(id)
            );
            const topicConflict = hierarchyIds.topics?.some(id =>
                merge.hierarchyIds.topics.includes(id)
            );
            const subtopicConflict = hierarchyIds.subTopics?.some(id =>
                merge.hierarchyIds.subTopics.includes(id)
            );

            return !(moduleConflict || subModuleConflict || topicConflict || subtopicConflict);
        });

        setMergedLevels(updatedMergedLevels);
    }
    // For subsequent children: only remove merged cells containing the parent's last child element ID
    else {
        let currentElementId = null;
        let currentModuleId = null;
        let currentSubModuleId = null;
        let currentTopicId = null;

        // Get current element IDs based on dialog type
        if (dialogType === 'submodule') {
            currentElementId = hierarchyIds.subModules?.[0];
            currentModuleId = hierarchyIds.modules?.[0];
        } else if (dialogType === 'topic') {
            currentElementId = hierarchyIds.topics?.[0];
            currentModuleId = hierarchyIds.modules?.[0];
            currentSubModuleId = hierarchyIds.subModules?.[0];
        } else if (dialogType === 'subtopic') {
            currentElementId = hierarchyIds.subTopics?.[0];
            currentModuleId = hierarchyIds.modules?.[0];
            currentSubModuleId = hierarchyIds.subModules?.[0];
            currentTopicId = hierarchyIds.topics?.[0];
        }

        // Get current element's module index
        const currentModule = currentModuleId ? modules.find(m => m._id === currentModuleId) : null;
        const currentModuleIndex = currentModule?.index ?? 0;

        Object.keys(updatedMergedCells).forEach(key => {
            updatedMergedCells[key] = updatedMergedCells[key].filter(merge => {
                // Check if this merged cell contains the current element
                const containsCurrentElement =
                    (currentElementId && merge.hierarchyIds?.subTopics.includes(currentElementId)) ||
                    (currentTopicId && merge.hierarchyIds?.topics.includes(currentTopicId)) ||
                    (currentSubModuleId && merge.hierarchyIds?.subModules.includes(currentSubModuleId)) ||
                    (currentModuleId && merge.hierarchyIds?.modules.includes(currentModuleId));

                if (!containsCurrentElement) return true;

                // Condition 1: Check if current element's module is merged with other modules that have higher index
                if (merge.hierarchyIds?.modules && merge.hierarchyIds.modules.length > 1) {
                    const hasHigherIndexModule = merge.hierarchyIds.modules.some(moduleId => {
                        if (moduleId === currentModuleId) return false; // Skip current module
                        const otherModule = modules.find(m => m._id === moduleId);
                        return otherModule && (otherModule.index ?? 0) > currentModuleIndex;
                    });

                    if (hasHigherIndexModule) {
                        // Delete this merged cell as it contains modules with higher index
                        return false;
                    }
                }

                // Condition 2: Check if any parent hierarchy is merged with elements that have higher index
                let shouldDelete = false;

                // Check submodule merges with higher index
                if (merge.hierarchyIds?.subModules && merge.hierarchyIds.subModules.length > 1 && currentSubModuleId) {
                    const currentSubModule = subModules.find(sm => sm._id === currentSubModuleId);
                    const currentSubModuleIndex = currentSubModule?.index ?? 0;

                    const hasHigherIndexSubModule = merge.hierarchyIds.subModules.some(subModuleId => {
                        if (subModuleId === currentSubModuleId) return false;
                        const otherSubModule = subModules.find(sm => sm._id === subModuleId);
                        return otherSubModule && (otherSubModule.index ?? 0) > currentSubModuleIndex;
                    });

                    if (hasHigherIndexSubModule) {
                        shouldDelete = true;
                    }
                }

                // Check topic merges with higher index
                if (merge.hierarchyIds?.topics && merge.hierarchyIds.topics.length > 1 && currentTopicId) {
                    const currentTopic = topics.find(t => t._id === currentTopicId);
                    const currentTopicIndex = currentTopic?.index ?? 0;

                    const hasHigherIndexTopic = merge.hierarchyIds.topics.some(topicId => {
                        if (topicId === currentTopicId) return false;
                        const otherTopic = topics.find(t => t._id === topicId);
                        return otherTopic && (otherTopic.index ?? 0) > currentTopicIndex;
                    });

                    if (hasHigherIndexTopic) {
                        shouldDelete = true;
                    }
                }

                // Check subtopic merges with higher index
                if (merge.hierarchyIds?.subTopics && merge.hierarchyIds.subTopics.length > 1 && currentElementId) {
                    const currentSubtopic = subTopics.find(st => st._id === currentElementId);
                    const currentSubtopicIndex = currentSubtopic?.index ?? 0;

                    const hasHigherIndexSubtopic = merge.hierarchyIds.subTopics.some(subtopicId => {
                        if (subtopicId === currentElementId) return false;
                        const otherSubtopic = subTopics.find(st => st._id === subtopicId);
                        return otherSubtopic && (otherSubtopic.index ?? 0) > currentSubtopicIndex;
                    });

                    if (hasHigherIndexSubtopic) {
                        shouldDelete = true;
                    }
                }

                return !shouldDelete;
            });
        });

        setMergedCells(updatedMergedCells);

        // Apply same logic to mergedLevels
        const updatedMergedLevels = mergedLevels.filter(merge => {
            // Check if this merged level contains the current element
            const containsCurrentElement =
                (currentElementId && merge.hierarchyIds.subTopics.includes(currentElementId)) ||
                (currentTopicId && merge.hierarchyIds.topics.includes(currentTopicId)) ||
                (currentSubModuleId && merge.hierarchyIds.subModules.includes(currentSubModuleId)) ||
                (currentModuleId && merge.hierarchyIds.modules.includes(currentModuleId));

            if (!containsCurrentElement) return true;

            // Condition 1: Check if current element's module is merged with other modules that have higher index
            if (merge.hierarchyIds.modules && merge.hierarchyIds.modules.length > 1) {
                const hasHigherIndexModule = merge.hierarchyIds.modules.some(moduleId => {
                    if (moduleId === currentModuleId) return false;
                    const otherModule = modules.find(m => m._id === moduleId);
                    return otherModule && (otherModule.index ?? 0) > currentModuleIndex;
                });

                if (hasHigherIndexModule) {
                    return false;
                }
            }

            // Condition 2: Check if any parent hierarchy is merged with elements that have higher index
            let shouldDelete = false;

            // Check submodule merges with higher index
            if (merge.hierarchyIds.subModules && merge.hierarchyIds.subModules.length > 1 && currentSubModuleId) {
                const currentSubModule = subModules.find(sm => sm._id === currentSubModuleId);
                const currentSubModuleIndex = currentSubModule?.index ?? 0;

                const hasHigherIndexSubModule = merge.hierarchyIds.subModules.some(subModuleId => {
                    if (subModuleId === currentSubModuleId) return false;
                    const otherSubModule = subModules.find(sm => sm._id === subModuleId);
                    return otherSubModule && (otherSubModule.index ?? 0) > currentSubModuleIndex;
                });

                if (hasHigherIndexSubModule) {
                    shouldDelete = true;
                }
            }

            // Check topic merges with higher index
            if (merge.hierarchyIds.topics && merge.hierarchyIds.topics.length > 1 && currentTopicId) {
                const currentTopic = topics.find(t => t._id === currentTopicId);
                const currentTopicIndex = currentTopic?.index ?? 0;

                const hasHigherIndexTopic = merge.hierarchyIds.topics.some(topicId => {
                    if (topicId === currentTopicId) return false;
                    const otherTopic = topics.find(t => t._id === topicId);
                    return otherTopic && (otherTopic.index ?? 0) > currentTopicIndex;
                });

                if (hasHigherIndexTopic) {
                    shouldDelete = true;
                }
            }

            // Check subtopic merges with higher index
            if (merge.hierarchyIds.subTopics && merge.hierarchyIds.subTopics.length > 1 && currentElementId) {
                const currentSubtopic = subTopics.find(st => st._id === currentElementId);
                const currentSubtopicIndex = currentSubtopic?.index ?? 0;

                const hasHigherIndexSubtopic = merge.hierarchyIds.subTopics.some(subtopicId => {
                    if (subtopicId === currentElementId) return false;
                    const otherSubtopic = subTopics.find(st => st._id === subtopicId);
                    return otherSubtopic && (otherSubtopic.index ?? 0) > currentSubtopicIndex;
                });

                if (hasHigherIndexSubtopic) {
                    shouldDelete = true;
                }
            }

            return !shouldDelete;
        });

        setMergedLevels(updatedMergedLevels);
    }
}
