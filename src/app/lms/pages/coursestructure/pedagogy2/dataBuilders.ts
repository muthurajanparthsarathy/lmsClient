"use client"

// DataBuilders: function bodies moved verbatim out of page.tsx during the split.
// Each keeps a same-named thin wrapper in the page, so every call site is
// unchanged; the values they close over arrive in one loosely-typed `deps`
// object (state and setters still live in the page).

import type React from "react"
import { subModuleApi } from "@/apiServices/pedagogyAndModuleAdd/addsubmodule"
import { topicApi } from "@/apiServices/pedagogyAndModuleAdd/addtopic"
import { subTopicApi } from "@/apiServices/pedagogyAndModuleAdd/addsubtopic"
import type { Modules, Topic, SubTopic, ActivityType, MergedCell, CourseHours } from "./types"
import { isOwnPedagogyRow, type HierarchyType } from "./pedagogyRowIdentity"

export interface DataBuildersDeps {
    addOnlyPedagogyLevel?: any;
    dialogType?: any;
    duplicateModules?: any;
    duplicateSubModules?: any;
    duplicateSubTopics?: any;
    duplicateTopics?: any;
    editMode?: any;
    getAffectedRowIds?: any;
    initializeCourseHours?: any;
    modules?: any;
    pedagogyViews?: any;
    savedLevelMergeSelections?: any;
    savedPedagogyMergeSelections?: any;
    selectedCourse?: any;
    selectedDuplicateCourse?: any;
    selectedModuleForSubModule?: any;
    selectedSubModuleForTopic?: any;
    selectedTopicForSubTopic?: any;
    setPedagogyHours?: any;
    setSavedPedagogyMergeSelections?: any;
    setSelectedPedagogyActivities?: any;
    setShowPedagogySection?: any;
    subModules?: any;
    subTopics?: any;
    tableRows?: any;
    topics?: any;
}

export function createDuplicateTableRowsImpl(deps: DataBuildersDeps) {
    const { duplicateModules, duplicateSubModules, duplicateSubTopics, duplicateTopics, selectedDuplicateCourse } = deps
        const rows: any[] = [];
        let rowIndex = 0;

        // Ensure we have modules before proceeding
        if (!duplicateModules.length || !selectedDuplicateCourse) return rows;

        // Get the hierarchy levels that exist in the course
        const hierarchyLevels = selectedDuplicateCourse.courseHierarchy.map((level: any) => level.toLowerCase());
        const hasSubModules = hierarchyLevels.includes('sub module');
        const hasTopics = hierarchyLevels.includes('topic');
        const hasSubTopics = hierarchyLevels.includes('sub topic');

        const sortedModules = [...duplicateModules].sort((a, b) => (a.index || 0) - (b.index || 0));

        sortedModules.forEach((module) => {
            if (hasSubModules) {
                const moduleSubModules = duplicateSubModules.filter((sub: any) => sub.moduleId === module._id)
                    .sort((a: any, b: any) => (a.index || 0) - (b.index || 0));

                if (moduleSubModules.length > 0) {
                    moduleSubModules.forEach((subModule: any) => {
                        const subModuleTopics = duplicateTopics.filter((topic: any) => topic.subModuleId === subModule._id)
                            .sort((a: any, b: any) => (a.index || 0) - (b.index || 0));

                        if (subModuleTopics.length > 0) {
                            subModuleTopics.forEach((topic: any) => {
                                const topicSubTopics = duplicateSubTopics.filter((subTopic: any) => subTopic.topicId === topic._id)
                                    .sort((a: any, b: any) => (a.index || 0) - (b.index || 0));

                                if (topicSubTopics.length > 0) {
                                    topicSubTopics.forEach((subTopic: any) => {
                                        rows.push({
                                            moduleId: module._id,
                                            moduleName: module.title,
                                            subModuleId: subModule._id,
                                            subModuleName: subModule.title,
                                            topicId: topic._id,
                                            topicName: topic.title,
                                            subtopicId: subTopic._id,
                                            subtopicName: subTopic.title,
                                            rowIndex: rowIndex++,
                                            rowId: `${module._id}-${subModule._id}-${topic._id}-${subTopic._id}`,
                                        });
                                    });
                                } else {
                                    // Topic exists but no subtopics (or subtopics not in hierarchy)
                                    rows.push({
                                        moduleId: module._id,
                                        moduleName: module.title,
                                        subModuleId: subModule._id,
                                        subModuleName: subModule.title,
                                        topicId: topic._id,
                                        topicName: topic.title,
                                        subtopicId: `${topic._id}-placeholder`,
                                        subtopicName: "-",
                                        rowIndex: rowIndex++,
                                        rowId: `${module._id}-${subModule._id}-${topic._id}-placeholder`,
                                    });
                                }
                            });
                        } else {
                            // Submodule exists but no topics (or topics not in hierarchy)
                            rows.push({
                                moduleId: module._id,
                                moduleName: module.title,
                                subModuleId: subModule._id,
                                subModuleName: subModule.title,
                                topicId: `${subModule._id}-placeholder`,
                                topicName: "-",
                                subtopicId: `${subModule._id}-placeholder-sub`,
                                subtopicName: "-",
                                rowIndex: rowIndex++,
                                rowId: `${module._id}-${subModule._id}-placeholder`,
                            });
                        }
                    });
                } else {
                    // Module exists but no submodules (but submodules are in hierarchy)
                    rows.push({
                        moduleId: module._id,
                        moduleName: module.title,
                        subModuleId: `${module._id}-placeholder`,
                        subModuleName: "-",
                        topicId: `${module._id}-placeholder-topic`,
                        topicName: "-",
                        subtopicId: `${module._id}-placeholder-sub`,
                        subtopicName: "-",
                        rowIndex: rowIndex++,
                        rowId: `${module._id}-placeholder`,
                    });
                }
            } else if (hasTopics) {
                const moduleTopics = duplicateTopics.filter((topic: any) => topic.moduleId === module._id)
                    .sort((a: any, b: any) => (a.index || 0) - (b.index || 0));

                if (moduleTopics.length > 0) {
                    moduleTopics.forEach((topic: any) => {
                        const topicSubTopics = duplicateSubTopics.filter((subTopic: any) => subTopic.topicId === topic._id)
                            .sort((a: any, b: any) => (a.index || 0) - (b.index || 0));

                        if (topicSubTopics.length > 0) {
                            topicSubTopics.forEach((subTopic: any) => {
                                rows.push({
                                    moduleId: module._id,
                                    moduleName: module.title,
                                    subModuleId: null,
                                    subModuleName: "",
                                    topicId: topic._id,
                                    topicName: topic.title,
                                    subtopicId: subTopic._id,
                                    subtopicName: subTopic.title,
                                    rowIndex: rowIndex++,
                                    rowId: `${module._id}-${topic._id}-${subTopic._id}`,
                                });
                            });
                        } else {
                            // Create row with topic but no subtopics
                            rows.push({
                                moduleId: module._id,
                                moduleName: module.title,
                                subModuleId: null,
                                subModuleName: "",
                                topicId: topic._id,
                                topicName: topic.title,
                                subtopicId: `${topic._id}-placeholder`,
                                subtopicName: "-",
                                rowIndex: rowIndex++,
                                rowId: `${module._id}-${topic._id}-placeholder`,
                            });
                        }
                    });
                } else {
                    // Create row with module but no topics
                    rows.push({
                        moduleId: module._id,
                        moduleName: module.title,
                        subModuleId: null,
                        subModuleName: "",
                        topicId: `${module._id}-placeholder`,
                        topicName: "-",
                        subtopicId: `${module._id}-placeholder-sub`,
                        subtopicName: "-",
                        rowIndex: rowIndex++,
                        rowId: `${module._id}-placeholder`,
                    });
                }
            } else {
                // Only module level exists
                rows.push({
                    moduleId: module._id,
                    moduleName: module.title,
                    subModuleId: null,
                    subModuleName: "",
                    topicId: null,
                    topicName: "",
                    subtopicId: `${module._id}-placeholder`,
                    subtopicName: "-",
                    rowIndex: rowIndex++,
                    rowId: `${module._id}-placeholder`,
                });
            }
        });

        return rows;
}

export function processPedagogyDataImpl(pedagogyViews: any[], deps: DataBuildersDeps) {
    const { getAffectedRowIds, initializeCourseHours, modules, selectedCourse, subModules, subTopics, tableRows, topics } = deps
        const newCourseHours: CourseHours = {};
        const newMergedCells: { [key: string]: MergedCell[] } = {};
        const hierarchyLevels = selectedCourse?.courseHierarchy.map((l: any) => l.toLowerCase()) || [];

        // Initialize empty course hours structure first
        const initialHours = initializeCourseHours(modules as any);
        Object.keys(initialHours).forEach(moduleId => {
            newCourseHours[moduleId] = { ...initialHours[moduleId] };
        });

        pedagogyViews.forEach(view => {
            view.pedagogies.forEach((pedagogy: any) => {
                // Extract hierarchy IDs from pedagogy data
                const moduleIds = pedagogy.module || [];
                const subModuleIds = pedagogy.subModule || [];
                const topicIds = pedagogy.topic || [];
                const subTopicIds = pedagogy.subTopic || [];

                // Check if this is a merged cell (multiple IDs at any level)
                const isMultiMerge = moduleIds.length > 1 || subModuleIds.length > 1 ||
                    topicIds.length > 1 || subTopicIds.length > 1;

                if (isMultiMerge) {
                    // Handle merged cells with hierarchical matching
                    const rowIds = getAffectedRowIds(moduleIds, subModuleIds, topicIds, subTopicIds);

                    // Only create merge if we found matching rows
                    if (rowIds.length > 0) {
                        // Process I Do activities
                        pedagogy?.iDo?.forEach((activity: { type: string; duration: number }) => {
                            const columnKey = `iDo-${activity.type}`;
                            const mergedCell: MergedCell = {
                                startRow: -1,
                                endRow: -1,
                                value: activity.duration,
                                type: "iDo",
                                activity: activity.type,
                                rowIds,
                                hierarchyIds: {
                                    modules: moduleIds,
                                    subModules: subModuleIds,
                                    topics: topicIds,
                                    subTopics: subTopicIds
                                }
                            };
                            newMergedCells[columnKey] = [...(newMergedCells[columnKey] || []), mergedCell];
                        });

                        // Process We Do activities
                        pedagogy?.weDo?.forEach((activity: { type: string; duration: number }) => {
                            const columnKey = `weDo-${activity.type}`;
                            const mergedCell: MergedCell = {
                                startRow: -1,
                                endRow: -1,
                                value: activity.duration,
                                type: "weDo",
                                activity: activity.type,
                                rowIds,
                                hierarchyIds: {
                                    modules: moduleIds,
                                    subModules: subModuleIds,
                                    topics: topicIds,
                                    subTopics: subTopicIds
                                }
                            };
                            newMergedCells[columnKey] = [...(newMergedCells[columnKey] || []), mergedCell];
                        });

                        // Process You Do activities
                        pedagogy?.youDo?.forEach((activity: { type: string; duration: number }) => {
                            const columnKey = `youDo-${activity.type}`;
                            const mergedCell: MergedCell = {
                                startRow: -1,
                                endRow: -1,
                                value: activity.duration,
                                type: "youDo",
                                activity: activity.type,
                                rowIds,
                                hierarchyIds: {
                                    modules: moduleIds,
                                    subModules: subModuleIds,
                                    topics: topicIds,
                                    subTopics: subTopicIds
                                }
                            };
                            newMergedCells[columnKey] = [...(newMergedCells[columnKey] || []), mergedCell];
                        });
                    }
                } else {
                    // Handle single cell values - find the exact row that matches
                    const moduleId = moduleIds[0] || '';
                    const subModuleId = subModuleIds[0] || '';
                    const topicId = topicIds[0] || '';
                    const subtopicId = subTopicIds[0] || '';

                    if (!moduleId) return; // Skip if no module ID

                    // Find the exact row that matches all provided hierarchy IDs
                    const matchingRowIndex = tableRows.findIndex((row: any) => {
                        const moduleMatch = row.moduleId === moduleId;
                        const subModuleMatch = !subModuleId || row.subModuleId === subModuleId;
                        const topicMatch = !topicId || row.topicId === topicId;
                        const subtopicMatch = !subtopicId || row.subtopicId === subtopicId;

                        return moduleMatch && subModuleMatch && topicMatch && subtopicMatch;
                    });

                    if (matchingRowIndex !== -1) {
                        const row = tableRows[matchingRowIndex];

                        // Use the actual IDs from the row, not the defaults
                        const effectiveTopicId = row.topicId || `${row.moduleId}-default-topic`;
                        const effectiveSubtopicId = row.subtopicId ||
                            (row.topicId ? `${row.topicId}-default-subtopic` : `${row.moduleId}-default-subtopic`);

                        // Initialize nested objects if they don't exist
                        if (!newCourseHours[row.moduleId]) newCourseHours[row.moduleId] = {};
                        if (!newCourseHours[row.moduleId][effectiveTopicId]) {
                            newCourseHours[row.moduleId][effectiveTopicId] = {};
                        }
                        if (!newCourseHours[row.moduleId][effectiveTopicId][effectiveSubtopicId]) {
                            newCourseHours[row.moduleId][effectiveTopicId][effectiveSubtopicId] = {
                                "iDo": {},
                                "weDo": {},
                                "youDo": {}
                            };
                        }

                        // Assign activity values
                        pedagogy.iDo?.forEach((activity: { type: string; duration: number }) => {
                            newCourseHours[row.moduleId][effectiveTopicId][effectiveSubtopicId]["iDo"][activity.type] = activity.duration;
                        });

                        pedagogy.weDo?.forEach((activity: { type: string; duration: number }) => {
                            newCourseHours[row.moduleId][effectiveTopicId][effectiveSubtopicId]["weDo"][activity.type] = activity.duration;
                        });

                        pedagogy.youDo?.forEach((activity: { type: string; duration: number }) => {
                            newCourseHours[row.moduleId][effectiveTopicId][effectiveSubtopicId]["youDo"][activity.type] = activity.duration;
                        });
                    }
                }
            });
        });

        // Update row indices in merged cells
        Object.keys(newMergedCells).forEach(columnKey => {
            newMergedCells[columnKey].forEach(merge => {
                const rowIndices = merge.rowIds.map(rid =>
                    tableRows.findIndex((row: any) => row.rowId === rid))
                    .filter(idx => idx !== -1)
                    .sort((a, b) => a - b);

                if (rowIndices.length > 0) {
                    merge.startRow = rowIndices[0];
                    merge.endRow = rowIndices[rowIndices.length - 1];
                }
            });
        });

        return { newCourseHours, newMergedCells };
}

export function createTableRowsImpl(deps: DataBuildersDeps) {
    const { modules, selectedCourse, subModules, subTopics, topics } = deps
        const rows: any[] = [];
        let rowIndex = 0;

        // Ensure we have modules before proceeding
        if (!modules.length || !selectedCourse) return rows;

        // Get the hierarchy levels that exist in the course
        const hierarchyLevels = selectedCourse.courseHierarchy.map((level: any) => level.toLowerCase());
        const hasSubModules = hierarchyLevels.includes('sub module');
        const hasTopics = hierarchyLevels.includes('topic');
        const hasSubTopics = hierarchyLevels.includes('sub topic');

        const sortedModules = [...modules].sort((a, b) => (a.index || 0) - (b.index || 0));

        sortedModules.forEach((module) => {
            if (hasSubModules) {
                const moduleSubModules = subModules.filter((sub: any) => sub.moduleId === module._id)
                    .sort((a: any, b: any) => (a.index || 0) - (b.index || 0));

                if (moduleSubModules.length > 0) {
                    moduleSubModules.forEach((subModule: any) => {
                        const subModuleTopics = topics.filter((topic: any) => topic.subModuleId === subModule._id)
                            .sort((a: any, b: any) => (a.index || 0) - (b.index || 0));

                        if (subModuleTopics.length > 0) {
                            subModuleTopics.forEach((topic: any) => {
                                const topicSubTopics = subTopics.filter((subTopic: any) => subTopic.topicId === topic._id)
                                    .sort((a: any, b: any) => (a.index || 0) - (b.index || 0));

                                if (topicSubTopics.length > 0) {
                                    topicSubTopics.forEach((subTopic: any) => {
                                        rows.push({
                                            moduleId: module._id,
                                            moduleName: module.title,
                                            subModuleId: subModule._id,
                                            subModuleName: subModule.title,
                                            topicId: topic._id,
                                            topicName: topic.title,
                                            subtopicId: subTopic._id,
                                            subtopicName: subTopic.title,
                                            rowIndex: rowIndex++,
                                            rowId: `${module._id}-${subModule._id}-${topic._id}-${subTopic._id}`,
                                        });
                                    });
                                } else {
                                    // Topic exists but no subtopics (or subtopics not in hierarchy)
                                    rows.push({
                                        moduleId: module._id,
                                        moduleName: module.title,
                                        subModuleId: subModule._id,
                                        subModuleName: subModule.title,
                                        topicId: topic._id,
                                        topicName: topic.title,
                                        subtopicId: `${topic._id}-placeholder`,
                                        subtopicName: "-",
                                        rowIndex: rowIndex++,
                                        rowId: `${module._id}-${subModule._id}-${topic._id}-placeholder`,
                                    });
                                }
                            });
                        } else {
                            // Submodule exists but no topics (or topics not in hierarchy)
                            rows.push({
                                moduleId: module._id,
                                moduleName: module.title,
                                subModuleId: subModule._id,
                                subModuleName: subModule.title,
                                topicId: `${subModule._id}-placeholder`,
                                topicName: "-",
                                subtopicId: `${subModule._id}-placeholder-sub`,
                                subtopicName: "-",
                                rowIndex: rowIndex++,
                                rowId: `${module._id}-${subModule._id}-placeholder`,
                            });
                        }
                    });
                } else {
                    // Module exists but no submodules (but submodules are in hierarchy)
                    rows.push({
                        moduleId: module._id,
                        moduleName: module.title,
                        subModuleId: `${module._id}-placeholder`,
                        subModuleName: "-",
                        topicId: `${module._id}-placeholder-topic`,
                        topicName: "-",
                        subtopicId: `${module._id}-placeholder-sub`,
                        subtopicName: "-",
                        rowIndex: rowIndex++,
                        rowId: `${module._id}-placeholder`,
                    });
                }
            } else if (hasTopics) {
                const moduleTopics = topics.filter((topic: any) => topic.moduleId === module._id)
                    .sort((a: any, b: any) => (a.index || 0) - (b.index || 0));

                if (moduleTopics.length > 0) {
                    moduleTopics.forEach((topic: any) => {
                        const topicSubTopics = subTopics.filter((subTopic: any) => subTopic.topicId === topic._id)
                            .sort((a: any, b: any) => (a.index || 0) - (b.index || 0));

                        if (topicSubTopics.length > 0) {
                            topicSubTopics.forEach((subTopic: any) => {
                                rows.push({
                                    moduleId: module._id,
                                    moduleName: module.title,
                                    subModuleId: null,
                                    subModuleName: "",
                                    topicId: topic._id,
                                    topicName: topic.title,
                                    subtopicId: subTopic._id,
                                    subtopicName: subTopic.title,
                                    rowIndex: rowIndex++,
                                    rowId: `${module._id}-${topic._id}-${subTopic._id}`,
                                });
                            });
                        } else {
                            // Create row with topic but no subtopics
                            rows.push({
                                moduleId: module._id,
                                moduleName: module.title,
                                subModuleId: null,
                                subModuleName: "",
                                topicId: topic._id,
                                topicName: topic.title,
                                subtopicId: `${topic._id}-placeholder`,
                                subtopicName: "-",
                                rowIndex: rowIndex++,
                                rowId: `${module._id}-${topic._id}-placeholder`,
                            });
                        }
                    });
                } else {
                    // Create row with module but no topics
                    rows.push({
                        moduleId: module._id,
                        moduleName: module.title,
                        subModuleId: null,
                        subModuleName: "",
                        topicId: `${module._id}-placeholder`,
                        topicName: "-",
                        subtopicId: `${module._id}-placeholder-sub`,
                        subtopicName: "-",
                        rowIndex: rowIndex++,
                        rowId: `${module._id}-placeholder`,
                    });
                }
            } else {
                // Only module level exists
                rows.push({
                    moduleId: module._id,
                    moduleName: module.title,
                    subModuleId: null,
                    subModuleName: "",
                    topicId: null,
                    topicName: "",
                    subtopicId: `${module._id}-placeholder`,
                    subtopicName: "-",
                    rowIndex: rowIndex++,
                    rowId: `${module._id}-placeholder`,
                });
            }
        });

        return rows;
}

export function collectCompleteHierarchyIdsImpl(selectedIds: Set<string>, type: 'module' | 'submodule' | 'topic' | 'subtopic', deps: DataBuildersDeps) {
    const { modules, subModules, subTopics, topics } = deps
        const allModuleIds = new Set<string>();
        const allSubModuleIds = new Set<string>();
        const allTopicIds = new Set<string>();
        const allSubTopicIds = new Set<string>();

        if (type === 'module') {
            // For modules, get all hierarchy under each selected module
            selectedIds.forEach(moduleId => {
                allModuleIds.add(moduleId);

                // Get all submodules under this module
                const moduleSubModules = subModules.filter((sm: any) => sm.moduleId === moduleId);
                moduleSubModules.forEach((subModule: any) => {
                    allSubModuleIds.add(subModule._id);

                    // Get all topics under this submodule
                    const subModuleTopics = topics.filter((t: any) => t.subModuleId === subModule._id);
                    subModuleTopics.forEach((topic: any) => {
                        allTopicIds.add(topic._id);

                        // Get all subtopics under this topic
                        const topicSubTopics = subTopics.filter((st: any) => st.topicId === topic._id);
                        topicSubTopics.forEach((subTopic: any) => {
                            allSubTopicIds.add(subTopic._id);
                        });
                    });
                });

                // Get all topics directly under this module (without submodule)
                const moduleTopics = topics.filter((t: any) => t.moduleId === moduleId && !t.subModuleId);
                moduleTopics.forEach((topic: any) => {
                    allTopicIds.add(topic._id);

                    // Get all subtopics under this topic
                    const topicSubTopics = subTopics.filter((st: any) => st.topicId === topic._id);
                    topicSubTopics.forEach((subTopic: any) => {
                        allSubTopicIds.add(subTopic._id);
                    });
                });
            });
        } else if (type === 'submodule') {
            // For submodules, get all hierarchy under each selected submodule
            selectedIds.forEach(subModuleId => {
                const subModule = subModules.find((sm: any) => sm._id === subModuleId);
                if (subModule) {
                    allModuleIds.add(subModule.moduleId);
                    allSubModuleIds.add(subModuleId);

                    // Get all topics under this submodule
                    const subModuleTopics = topics.filter((t: any) => t.subModuleId === subModuleId);
                    subModuleTopics.forEach((topic: any) => {
                        allTopicIds.add(topic._id);

                        // Get all subtopics under this topic
                        const topicSubTopics = subTopics.filter((st: any) => st.topicId === topic._id);
                        topicSubTopics.forEach((subTopic: any) => {
                            allSubTopicIds.add(subTopic._id);
                        });
                    });
                }
            });
        } else if (type === 'topic') {
            // For topics, get all hierarchy for each selected topic
            selectedIds.forEach(topicId => {
                const topic = topics.find((t: any) => t._id === topicId);
                if (topic) {
                    allModuleIds.add(topic.moduleId);
                    if (topic.subModuleId) allSubModuleIds.add(topic.subModuleId);
                    allTopicIds.add(topicId);

                    // Get all subtopics under this topic
                    const topicSubTopics = subTopics.filter((st: any) => st.topicId === topicId);
                    topicSubTopics.forEach((subTopic: any) => {
                        allSubTopicIds.add(subTopic._id);
                    });
                }
            });
        } else if (type === 'subtopic') {
            // For subtopics, get all hierarchy for each selected subtopic
            selectedIds.forEach(subTopicId => {
                const subTopic = subTopics.find((st: any) => st._id === subTopicId);
                if (subTopic) {
                    // allModuleIds.add(subTopic.moduleId);

                    // Add submodule ID if it exists (this was missing)
                    if (subTopic.subModuleId && !subTopic.subModuleId.includes('placeholder') &&
                        !subTopic.subModuleId.includes('none') && subTopic.subModuleId.trim() !== '') {
                        allSubModuleIds.add(subTopic.subModuleId);
                    }

                    allTopicIds.add(subTopic.topicId);
                    allSubTopicIds.add(subTopicId);

                    // Also get the complete hierarchy from the parent topic
                    const parentTopic = topics.find((t: any) => t._id === subTopic.topicId);
                    if (parentTopic) {
                        // Add parent topic's module ID
                        allModuleIds.add(parentTopic.moduleId);

                        // Add parent topic's submodule ID if it exists
                        if (parentTopic.subModuleId && !parentTopic.subModuleId.includes('placeholder') &&
                            !parentTopic.subModuleId.includes('none') && parentTopic.subModuleId.trim() !== '') {
                            allSubModuleIds.add(parentTopic.subModuleId);
                        }
                    }
                }
            });
        }
        return {
            modules: Array.from(allModuleIds),
            subModules: Array.from(allSubModuleIds),
            topics: Array.from(allTopicIds),
            subTopics: Array.from(allSubTopicIds)
        };
}

export function getAllSelectedHierarchyIdsImpl(type: 'level' | 'pedagogy' = 'level', activityType?: string, activity?: string, deps: DataBuildersDeps = {}) {
    const { addOnlyPedagogyLevel, dialogType, editMode, modules, savedLevelMergeSelections, savedPedagogyMergeSelections, selectedModuleForSubModule, selectedSubModuleForTopic, selectedTopicForSubTopic, subModules, subTopics, topics } = deps
        const allModuleIds = new Set<string>();
        const allSubModuleIds = new Set<string>();
        const allTopicIds = new Set<string>();
        const allSubTopicIds = new Set<string>();

        // Get IDs based on dialog type and current selections
        if (dialogType === 'module') {
            // For modules, include the module being edited and any merged modules
            if (!addOnlyPedagogyLevel && editMode?.data?._id) {
                allModuleIds.add(editMode.data._id);
            }

            // Add merged modules based on type
            if (type === 'level' && savedLevelMergeSelections?.modules) {
                savedLevelMergeSelections.modules.forEach((id: any) => allModuleIds.add(id));
            }

            // Also add from pedagogy merge selections if type is pedagogy
            if (type === 'pedagogy' && activityType && activity && savedPedagogyMergeSelections[activityType as ActivityType]?.[activity]?.modules) {
                savedPedagogyMergeSelections[activityType as ActivityType][activity].modules.forEach((id: string) => allModuleIds.add(id));
            }
        }
        // ... similar logic for other dialog types (submodule, topic, subtopic)
        else if (dialogType === 'submodule') {
            // For submodules, include parent module and the submodule being edited
            if (selectedModuleForSubModule?.id) {
                allModuleIds.add(selectedModuleForSubModule.id);
            }
            if (!addOnlyPedagogyLevel && editMode?.data?._id) {
                allSubModuleIds.add(editMode.data._id);
            }

            // Add merged items based on type
            if (type === 'level' && savedLevelMergeSelections) {
                savedLevelMergeSelections.modules.forEach((id: any) => allModuleIds.add(id));
                savedLevelMergeSelections.subModules.forEach((id: any) => allSubModuleIds.add(id));
            }

            // Add from pedagogy merge selections if type is pedagogy
            if (type === 'pedagogy' && activityType && activity && savedPedagogyMergeSelections[activityType as ActivityType]?.[activity]) {
                const pedagogySelection = savedPedagogyMergeSelections[activityType as ActivityType][activity];
                if (pedagogySelection.modules) pedagogySelection.modules.forEach((id: string) => allModuleIds.add(id));
                if (pedagogySelection.subModules) pedagogySelection.subModules.forEach((id: string) => allSubModuleIds.add(id));
            }
        }
        else if (dialogType === 'topic') {
            // For topics, include parent hierarchy and the topic being edited
            if (selectedSubModuleForTopic) {
                allModuleIds.add(selectedSubModuleForTopic.moduleId);
                if (selectedSubModuleForTopic.id !== null) {
                    allSubModuleIds.add(selectedSubModuleForTopic.id);
                }
            }
            if (!addOnlyPedagogyLevel && editMode?.data?._id) {
                allTopicIds.add(editMode.data._id);
            }

            // Add merged items based on type
            if (type === 'level' && savedLevelMergeSelections) {
                savedLevelMergeSelections.modules.forEach((id: any) => allModuleIds.add(id));
                savedLevelMergeSelections.subModules.forEach((id: any) => allSubModuleIds.add(id));
                savedLevelMergeSelections.topics.forEach((id: any) => allTopicIds.add(id));
            }

            // Add from pedagogy merge selections if type is pedagogy
            if (type === 'pedagogy' && activityType && activity && savedPedagogyMergeSelections[activityType as ActivityType]?.[activity]) {
                const pedagogySelection = savedPedagogyMergeSelections[activityType as ActivityType][activity];
                if (pedagogySelection.modules) pedagogySelection.modules.forEach((id: string) => allModuleIds.add(id));
                if (pedagogySelection.subModules) pedagogySelection.subModules.forEach((id: string) => allSubModuleIds.add(id));
                if (pedagogySelection.topics) pedagogySelection.topics.forEach((id: string) => allTopicIds.add(id));
            }
        }
        else if (dialogType === 'subtopic') {
            // For subtopics, include full parent hierarchy and the subtopic being edited
            if (selectedTopicForSubTopic) {
                allModuleIds.add(selectedTopicForSubTopic.moduleId);
                if (selectedTopicForSubTopic.subModuleId) {
                    allSubModuleIds.add(selectedTopicForSubTopic.subModuleId);
                }
                if (selectedTopicForSubTopic.id !== null) {
                    allTopicIds.add(selectedTopicForSubTopic.id);
                }
            }
            if (!addOnlyPedagogyLevel && editMode?.data?._id) {
                allSubTopicIds.add(editMode.data._id);
            }

            // Add merged items based on type
            if (type === 'level' && savedLevelMergeSelections) {
                savedLevelMergeSelections.modules.forEach((id: any) => allModuleIds.add(id));
                savedLevelMergeSelections.subModules.forEach((id: any) => allSubModuleIds.add(id));
                savedLevelMergeSelections.topics.forEach((id: any) => allTopicIds.add(id));
                savedLevelMergeSelections.subTopics.forEach((id: any) => allSubTopicIds.add(id));
            }

            // Add from pedagogy merge selections if type is pedagogy
            if (type === 'pedagogy' && activityType && activity && savedPedagogyMergeSelections[activityType as ActivityType]?.[activity]) {
                const pedagogySelection = savedPedagogyMergeSelections[activityType as ActivityType][activity];
                if (pedagogySelection.modules) pedagogySelection.modules.forEach((id: string) => allModuleIds.add(id));
                if (pedagogySelection.subModules) pedagogySelection.subModules.forEach((id: string) => allSubModuleIds.add(id));
                if (pedagogySelection.topics) pedagogySelection.topics.forEach((id: string) => allTopicIds.add(id));
                if (pedagogySelection.subTopics) pedagogySelection.subTopics.forEach((id: string) => allSubTopicIds.add(id));
            }
        }

        return {
            modules: Array.from(allModuleIds),
            subModules: Array.from(allSubModuleIds),
            topics: Array.from(allTopicIds),
            subTopics: Array.from(allSubTopicIds)
        };
}

export async function fetchAndSetPedagogyDataImpl(type: string, id: string, deps: DataBuildersDeps) {
    const { modules, pedagogyViews, selectedCourse, setPedagogyHours, setSavedPedagogyMergeSelections, setSelectedPedagogyActivities, setShowPedagogySection, subModules, subTopics, topics } = deps
        if (!pedagogyViews || !selectedCourse) return;

        // Only this node's OWN rows. Containment ("pedagogy.module includes id")
        // would also match every descendant's hours, and the form flattens what
        // it loads into one row per activity — so loading a module's topics here
        // is what collapsed a whole course's hours on save.
        const allPedagogyData = pedagogyViews[0]?.pedagogies.filter((pedagogy: any) =>
            isOwnPedagogyRow(pedagogy, type as HierarchyType, id)
        );

        if (allPedagogyData && allPedagogyData.length > 0) {
            setShowPedagogySection(true);

            // Initialize arrays to collect all activities
            const allIDoActivities: string[] = [];
            const allWeDoActivities: string[] = [];
            const allYouDoActivities: string[] = [];

            // Initialize objects to collect all hours
            const allIDoHours: { [key: string]: number } = {};
            const allWeDoHours: { [key: string]: number } = {};
            const allYouDoHours: { [key: string]: number } = {};

            // Initialize objects to collect merge selections
            const allIDoMergeSelections: { [activity: string]: any } = {};
            const allWeDoMergeSelections: { [activity: string]: any } = {};
            const allYouDoMergeSelections: { [activity: string]: any } = {};

            // Process each pedagogy entry
            allPedagogyData.forEach((pedagogy: any) => {
                // Process I Do activities
                if (pedagogy.iDo && pedagogy.iDo.length > 0) {
                    pedagogy.iDo.forEach((activity: any) => {
                        if (!allIDoActivities.includes(activity.type)) {
                            allIDoActivities.push(activity.type);
                        }
                        allIDoHours[activity.type] = activity.duration;

                        // Check for merged items
                        if (pedagogy.module && pedagogy.module.length > 1 ||
                            pedagogy.subModule && pedagogy.subModule.length > 1 ||
                            pedagogy.topic && pedagogy.topic.length > 1 ||
                            pedagogy.subTopic && pedagogy.subTopic.length > 1) {

                            allIDoMergeSelections[activity.type] = {
                                modules: pedagogy.module || [],
                                subModules: pedagogy.subModule || [],
                                topics: pedagogy.topic || [],
                                subTopics: pedagogy.subTopic || []
                            };
                        }
                    });
                }

                // Process We Do activities
                if (pedagogy.weDo && pedagogy.weDo.length > 0) {
                    pedagogy.weDo.forEach((activity: any) => {
                        if (!allWeDoActivities.includes(activity.type)) {
                            allWeDoActivities.push(activity.type);
                        }
                        allWeDoHours[activity.type] = activity.duration;

                        // Check for merged items
                        if (pedagogy.module && pedagogy.module.length > 1 ||
                            pedagogy.subModule && pedagogy.subModule.length > 1 ||
                            pedagogy.topic && pedagogy.topic.length > 1 ||
                            pedagogy.subTopic && pedagogy.subTopic.length > 1) {

                            allWeDoMergeSelections[activity.type] = {
                                modules: pedagogy.module || [],
                                subModules: pedagogy.subModule || [],
                                topics: pedagogy.topic || [],
                                subTopics: pedagogy.subTopic || []
                            };
                        }
                    });
                }

                // Process You Do activities
                if (pedagogy.youDo && pedagogy.youDo.length > 0) {
                    pedagogy.youDo.forEach((activity: any) => {
                        if (!allYouDoActivities.includes(activity.type)) {
                            allYouDoActivities.push(activity.type);
                        }
                        allYouDoHours[activity.type] = activity.duration;

                        // Check for merged items
                        if (pedagogy.module && pedagogy.module.length > 1 ||
                            pedagogy.subModule && pedagogy.subModule.length > 1 ||
                            pedagogy.topic && pedagogy.topic.length > 1 ||
                            pedagogy.subTopic && pedagogy.subTopic.length > 1) {

                            allYouDoMergeSelections[activity.type] = {
                                modules: pedagogy.module || [],
                                subModules: pedagogy.subModule || [],
                                topics: pedagogy.topic || [],
                                subTopics: pedagogy.subTopic || []
                            };
                        }
                    });
                }
            });

            // Set the collected activities
            setSelectedPedagogyActivities({
                iDo: allIDoActivities,
                weDo: allWeDoActivities,
                youDo: allYouDoActivities
            });

            // Set the collected hours
            setPedagogyHours({
                iDo: allIDoHours,
                weDo: allWeDoHours,
                youDo: allYouDoHours
            });

            // Set the collected merge selections
            setSavedPedagogyMergeSelections((prev: any) => ({
                ...prev,
                iDo: { ...prev.iDo, ...allIDoMergeSelections },
                weDo: { ...prev.weDo, ...allWeDoMergeSelections },
                youDo: { ...prev.youDo, ...allYouDoMergeSelections }
            }));
        }
}
