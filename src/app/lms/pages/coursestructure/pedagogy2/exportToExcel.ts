"use client"

// The Excel export routine. Moved verbatim out of page.tsx during the split:
// its 1200-plus lines were the single largest thing in the component. It closed
// over eleven values, which now arrive in one `deps` object; the page keeps a
// one-line wrapper named exportToExcel so every call site is unchanged.

import ExcelJS from "exceljs"
import { saveAs } from "file-saver"
import type React from "react"
import type { Course, CourseHours, MergedCell, ExportSelections, PedagogyType, HierarchyMerges } from "./types"

export interface ExportDeps {
    tableRows: any[];
    courseHours: CourseHours;
    mergedCells: { [key: string]: MergedCell[] };
    selectedCourse: Course | null;
    activityTypes: { iDo: string[]; weDo: string[]; youDo: string[]; all: string[] };
    selectedPedagogyTypes: ("iDo" | "weDo" | "youDo" | "all")[];
    exportSelections: ExportSelections;
    setExportSelections: React.Dispatch<React.SetStateAction<ExportSelections>>;
    setShowPreviewDialog: React.Dispatch<React.SetStateAction<boolean>>;
    isLevelMerged: (rowIndex: number) => any;
    mergeCells: (type: "iDo" | "weDo" | "youDo", activity: string, selectedRowsArray?: number[]) => any;
    pedagogyViews: any;
}

export async function exportToExcelImpl(deps: ExportDeps) {
const {
        activityTypes, courseHours, exportSelections, isLevelMerged, mergeCells,
        mergedCells, selectedCourse, selectedPedagogyTypes, setExportSelections,
        setShowPreviewDialog, tableRows, pedagogyViews,
    } = deps
    if (!selectedCourse) return;

    // Helper functions (same as preview table)
    const getMergedActivityValue = (row: { moduleId: string; subModuleId: string; topicId: string; subtopicId: string; }, type: PedagogyType, activity: string) => {
        let hierarchyKey = '';
        let hierarchyId = '';

        if (exportSelections.hierarchy.module && row.moduleId) {
            hierarchyKey = 'moduleId';
            hierarchyId = row.moduleId;
        } else if (exportSelections.hierarchy.subModule && row.subModuleId) {
            hierarchyKey = 'subModuleId';
            hierarchyId = row.subModuleId;
        } else if (exportSelections.hierarchy.topic && row.topicId) {
            hierarchyKey = 'topicId';
            hierarchyId = row.topicId;
        } else if (exportSelections.hierarchy.subTopic && row.subtopicId) {
            hierarchyKey = 'subtopicId';
            hierarchyId = row.subtopicId;
        } else {
            // No hierarchy selected - calculate total for all rows
            return tableRows.reduce((total, r) => {
                const mergeInfo = isCellMerged(tableRows.indexOf(r), type, activity);
                const cellValue = mergeInfo.isMerged ? (mergeInfo.isStart ? mergeInfo.value : 0) : getCellValueForRow(r, type, activity);
                return total + (cellValue || 0);
            }, 0);
        }

        // Calculate total for all rows with the same hierarchy ID
        const rowsInGroup = tableRows.filter(r => r[hierarchyKey] === hierarchyId);
        return rowsInGroup.reduce((total, r) => {
            const mergeInfo = isCellMerged(tableRows.indexOf(r), type, activity);
            const cellValue = mergeInfo.isMerged ? (mergeInfo.isStart ? mergeInfo.value : 0) : getCellValueForRow(r, type, activity);
            return total + (cellValue || 0);
        }, 0);
    };

    const isCellMerged = (rowIndex: number, type: string, activity: string) => {
        const columnKey = `${type}-${activity}`;
        const merges = mergedCells[columnKey] || [];
        const row = tableRows[rowIndex];

        for (const merge of merges) {
            const rowIndices = merge.rowIds
                ?.map((rid) => tableRows.findIndex((r) => r.rowId === rid))
                .filter((idx) => idx !== -1)
                .sort((a, b) => a - b) || [];

            if (rowIndices.includes(rowIndex)) {
                return {
                    isMerged: true,
                    isStart: rowIndex === rowIndices[0],
                    rowSpan: rowIndices.length,
                    value: merge.value,
                    mergeIndex: merges.indexOf(merge),
                    hierarchyIds: merge.hierarchyIds,
                    type: type
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
            type: type
        };
    };

    const calculateTotalHours = (type: "iDo" | "weDo" | "youDo", activity: string) => {
        const columnKey = `${type}-${activity}`;

        // Calculate merged values
        const mergedValue = mergedCells[columnKey]?.reduce((sum, merge) => sum + merge.value, 0) || 0;

        // Calculate unmerged values
        const unmergedValue = Object.entries(courseHours).reduce((sum, [moduleId, moduleData]) => {
            return sum + Object.entries(moduleData).reduce((moduleSum, [topicId, topicData]) => {
                return moduleSum + Object.entries(topicData).reduce((topicSum, [subtopicId, subtopicData]) => {
                    // Check if this cell is part of any merge
                    const isMerged = mergedCells[columnKey]?.some(merge => {
                        // Check hierarchy matches
                        const matchesModule = !merge.hierarchyIds?.modules.length ||
                            merge.hierarchyIds.modules.includes(moduleId);
                        const matchesSubModule = !merge.hierarchyIds?.subModules.length ||
                            (!topicData.subModuleId || merge.hierarchyIds.subModules.includes(topicData.subModuleId as any));
                        const matchesTopic = !merge.hierarchyIds?.topics.length ||
                            (!topicId || merge.hierarchyIds.topics.includes(topicId));
                        const matchesSubTopic = !merge.hierarchyIds?.subTopics.length ||
                            (!subtopicId || merge.hierarchyIds.subTopics.includes(subtopicId));

                        return matchesModule && matchesSubModule && matchesTopic && matchesSubTopic;
                    });

                    // Only add if not part of a merge and has a value
                    if (!isMerged && subtopicData[type]?.[activity]) {
                        return topicSum + (subtopicData[type][activity] || 0);
                    }
                    return topicSum;
                }, 0);
            }, 0);
        }, 0);

        return mergedValue + unmergedValue;
    };

    const getSelectedActivities = (type: "iDo" | "weDo" | "youDo") => {
        const exportKey = type;

        return selectedPedagogyTypes.includes(type) &&
            Array.isArray(exportSelections.pedagogy[exportKey])
            ? activityTypes[type].filter(activity =>
                Array.isArray(exportSelections.pedagogy[exportKey]) &&
                exportSelections.pedagogy[exportKey].includes(activity)
            )
            : [];

    };

    const selectedIDoActivities = getSelectedActivities("iDo");
    const selectedWeDoActivities = getSelectedActivities("weDo");
    const selectedYouDoActivities = getSelectedActivities("youDo");

    // Calculate total hours for a row
    const calculateRowTotal = (row: any) => {
        let total = 0;

        // Calculate for each selected activity type
        selectedIDoActivities.forEach((activity: string) => {
            const mergeInfo = isCellMerged(tableRows.indexOf(row), "iDo", activity);
            const cellValue = mergeInfo.isMerged ? (mergeInfo.isStart ? mergeInfo.value : 0) : getCellValueForRow(row, "iDo", activity);
            total += cellValue || 0;
        });

        selectedWeDoActivities.forEach((activity: string) => {
            const mergeInfo = isCellMerged(tableRows.indexOf(row), "weDo", activity);
            const cellValue = mergeInfo.isMerged ? (mergeInfo.isStart ? mergeInfo.value : 0) : getCellValueForRow(row, "weDo", activity);
            total += cellValue || 0;
        });

        selectedYouDoActivities.forEach((activity: string) => {
            const mergeInfo = isCellMerged(tableRows.indexOf(row), "youDo", activity);
            const cellValue = mergeInfo.isMerged ? (mergeInfo.isStart ? mergeInfo.value : 0) : getCellValueForRow(row, "youDo", activity);
            total += cellValue || 0;
        });

        return total;
    };

    // Get cell value for a specific row and activity
    const getCellValueForRow = (row: any, type: "iDo" | "weDo" | "youDo", activity: any) => {
        // Determine effective IDs based on hierarchy
        const effectiveTopicId = row.topicId || `${row.moduleId}-default-topic`;
        const effectiveSubtopicId = row.subtopicId ||
            (row.topicId ? `${row.topicId}-default-subtopic` : `${row.moduleId}-default-subtopic`);

        // Check backend data first
        if (pedagogyViews && pedagogyViews.length > 0) {
            for (const view of pedagogyViews) {
                for (const pedagogy of view.pedagogies) {
                    const pedagogyModules = pedagogy.module || [];
                    const pedagogySubModules = pedagogy.subModule || [];
                    const pedagogyTopics = pedagogy.topic || [];
                    const pedagogySubTopics = pedagogy.subTopic || [];

                    // Skip merged pedagogies
                    const isMultiMerge = pedagogyModules.length > 1 || pedagogySubModules.length > 1 ||
                        pedagogyTopics.length > 1 || pedagogySubTopics.length > 1;
                    if (isMultiMerge) continue;

                    // Check exact match for single cell
                    const moduleMatch = pedagogyModules.length === 0 ||
                        (pedagogyModules.length === 1 && pedagogyModules[0] === row.moduleId);
                    const subModuleMatch = pedagogySubModules.length === 0 ||
                        (pedagogySubModules.length === 1 && pedagogySubModules[0] === row.subModuleId);
                    const topicMatch = pedagogyTopics.length === 0 ||
                        (pedagogyTopics.length === 1 && pedagogyTopics[0] === row.topicId);
                    const subtopicMatch = pedagogySubTopics.length === 0 ||
                        (pedagogySubTopics.length === 1 && pedagogySubTopics[0] === row.subtopicId);

                    if (moduleMatch && subModuleMatch && topicMatch && subtopicMatch) {
                        const activityData = pedagogy[type]?.find((a: any) => a.type === activity);
                        if (activityData) {
                            return activityData.duration;
                        }
                    }
                }
            }
        }

        // Fall back to frontend data
        return courseHours[row.moduleId]?.[effectiveTopicId]?.[effectiveSubtopicId]?.[type]?.[activity] || 0;
    };

    const isFirstInMergedGroup = (row: any, index: any) => {
        // Find the highest priority hierarchy level that is selected
        let hierarchyKey = '';
        let hierarchyId = '';

        // Check in order of priority - use the first selected one
        if (exportSelections.hierarchy.module && row.moduleId) {
            hierarchyKey = 'moduleId';
            hierarchyId = row.moduleId;
        } else if (exportSelections.hierarchy.subModule && row.subModuleId) {
            hierarchyKey = 'subModuleId';
            hierarchyId = row.subModuleId;
        } else if (exportSelections.hierarchy.topic && row.topicId) {
            hierarchyKey = 'topicId';
            hierarchyId = row.topicId;
        } else if (exportSelections.hierarchy.subTopic && row.subtopicId) {
            hierarchyKey = 'subtopicId';
            hierarchyId = row.subtopicId;
        } else {
            // No hierarchy selected, treat each row individually
            return index === 0; // Only show total on first row
        }

        // Check if this is the first row with this hierarchy ID
        return tableRows.findIndex(r => r[hierarchyKey] === hierarchyId) === index;
    };


    const getMergedTotalValue = (row: any) => {
        let hierarchyKey = '';
        let hierarchyId = '';

        if (exportSelections.hierarchy.module && row.moduleId) {
            hierarchyKey = 'moduleId';
            hierarchyId = row.moduleId;
        } else if (exportSelections.hierarchy.subModule && row.subModuleId) {
            hierarchyKey = 'subModuleId';
            hierarchyId = row.subModuleId;
        } else if (exportSelections.hierarchy.topic && row.topicId) {
            hierarchyKey = 'topicId';
            hierarchyId = row.topicId;
        } else if (exportSelections.hierarchy.subTopic && row.subtopicId) {
            hierarchyKey = 'subtopicId';
            hierarchyId = row.subtopicId;
        } else {
            // No hierarchy selected - calculate total for all rows
            return tableRows.reduce((total, r) => total + calculateRowTotal(r), 0);
        }

        // Calculate total for all rows with the same hierarchy ID
        const rowsInGroup = tableRows.filter(r => r[hierarchyKey] === hierarchyId);
        return rowsInGroup.reduce((total, r) => total + calculateRowTotal(r), 0);
    };




    // Filter activities based on selections (for main table)
    const filteredActivities = {
        iDo: Array.isArray(exportSelections.pedagogy.iDo) ? exportSelections.pedagogy.iDo : [],
        weDo: Array.isArray(exportSelections.pedagogy.weDo) ? exportSelections.pedagogy.weDo : [],
        youDo: Array.isArray(exportSelections.pedagogy.youDo) ? exportSelections.pedagogy.youDo : [],
    };
    // sarathi
    const summaryActivities = exportSelections.showSummary && exportSelections.printPedagogy
        ? {
            iDo: Array.isArray(exportSelections.printPedagogy.iDo) ? exportSelections.printPedagogy.iDo : [],
            weDo: Array.isArray(exportSelections.printPedagogy.weDo) ? exportSelections.printPedagogy.weDo : [],
            youDo: Array.isArray(exportSelections.printPedagogy.youDo) ? exportSelections.printPedagogy.youDo : [],
        }
        : {
            iDo: [],
            weDo: [],
            youDo: [],
        };
    // Calculate if we should show teaching elements section
    const showTeachingElements = selectedPedagogyTypes.length > 0 &&
        (filteredActivities.iDo.length > 0 || filteredActivities.weDo.length > 0 || filteredActivities.youDo.length > 0);

    // Calculate total selected activities count
    const totalSelectedActivities = filteredActivities.iDo.length + filteredActivities.weDo.length + filteredActivities.youDo.length;

    // Count visible category headers (only those with selected activities)
    const visibleCategoryCount = [
        filteredActivities.iDo.length > 0,
        filteredActivities.weDo.length > 0,
        filteredActivities.youDo.length > 0
    ].filter(Boolean).length;

    // DEFAULT BEHAVIOR: If hoursOption is empty or not set, default to 'element' (individual activities)
    const effectiveHoursOption = exportSelections.hoursOption || 'element';

    // Create a new workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Pedagogy");

    // Calculate hierarchy columns count
    const hierarchyColumns = [
        exportSelections.hierarchy.module && selectedCourse.courseHierarchy.includes('Module'),
        exportSelections.hierarchy.subModule && selectedCourse.courseHierarchy.includes('Sub Module'),
        exportSelections.hierarchy.topic && selectedCourse.courseHierarchy.includes('Topic'),
        exportSelections.hierarchy.subTopic && selectedCourse.courseHierarchy.includes('Sub Topic'),
    ].filter(Boolean).length;

    const levelColumnIncluded = exportSelections.hierarchy.level;
    const totalHierarchyColumns = hierarchyColumns + (levelColumnIncluded ? 1 : 0);

    // Add headers based on effectiveHoursOption (uses default if not set)
    const header1 = [];
    const header2 = [];
    const header3 = [];

    // Add hierarchy headers
    if (exportSelections.hierarchy.module && selectedCourse.courseHierarchy.includes('Module')) {
        header1.push('Module');
        header2.push('');
        header3.push('');
    }
    if (exportSelections.hierarchy.subModule && selectedCourse.courseHierarchy.includes('Sub Module')) {
        header1.push('Sub Module');
        header2.push('');
        header3.push('');
    }
    if (exportSelections.hierarchy.topic && selectedCourse.courseHierarchy.includes('Topic')) {
        header1.push('Topic');
        header2.push('');
        header3.push('');
    }
    if (exportSelections.hierarchy.subTopic && selectedCourse.courseHierarchy.includes('Sub Topic')) {
        header1.push('Sub Topic');
        header2.push('');
        header3.push('');
    }
    if (exportSelections.hierarchy.level) {
        header1.push('Level');
        header2.push('');
        header3.push('');
    }

    // Add teaching elements headers based on effectiveHoursOption
    if (showTeachingElements) {
        if (effectiveHoursOption === 'element') {
            // Individual activities view (DEFAULT)
            header1.push('Teaching Learning Elements');
            header1.push(...Array(totalSelectedActivities - 1).fill(''));

            // Second row - activity type headers (only if multiple types)
            if (visibleCategoryCount > 1) {
                if (filteredActivities.iDo.length > 0) {
                    header2.push('I Do');
                    header2.push(...Array(filteredActivities.iDo.length - 1).fill(''));
                }
                if (filteredActivities.weDo.length > 0) {
                    header2.push('We Do');
                    header2.push(...Array(filteredActivities.weDo.length - 1).fill(''));
                }
                if (filteredActivities.youDo.length > 0) {
                    header2.push('You Do');
                    header2.push(...Array(filteredActivities.youDo.length - 1).fill(''));
                }
            } else {
                header2.push(...Array(totalSelectedActivities).fill(''));
            }

            // Third row - individual activity names
            filteredActivities.iDo.forEach((activity: any) => header3.push(activity));
            filteredActivities.weDo.forEach((activity: any) => header3.push(activity));
            filteredActivities.youDo.forEach((activity: any) => header3.push(activity));

        } else if (effectiveHoursOption === 'activity') {
            // Activity type totals view
            const activeTypes = visibleCategoryCount;

            header1.push('Teaching Learning Elements');
            header1.push(...Array(activeTypes - 1).fill(''));

            // Second row - just activity type names
            if (filteredActivities.iDo.length > 0) {
                header2.push('I Do');
            }
            if (filteredActivities.weDo.length > 0) {
                header2.push('We Do');
            }
            if (filteredActivities.youDo.length > 0) {
                header2.push('You Do');
            }

            // Third row - empty for activity totals
            header3.push(...Array(activeTypes).fill(''));
        }
    }

    // Add Total Hours column if included
    if (showTeachingElements || exportSelections.includeTotalHours) {
        header1.push('Total Hours');
        header2.push('');
        header3.push('');
    }

    // Add headers to worksheet
    worksheet.addRow(header1);
    worksheet.addRow(header2);
    worksheet.addRow(header3);

    // Apply header styling and merging
    const applyHeaderStyling = () => {
        // First row styling and merging
        const headerRow1 = worksheet.getRow(1);
        headerRow1.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = {
                top: { style: 'thin' }, left: { style: 'thin' },
                bottom: { style: 'thin' }, right: { style: 'thin' }
            };
        });

        // Merge hierarchy columns (rows 1-3)
        let colIndex = 1;
        if (exportSelections.hierarchy.module && selectedCourse.courseHierarchy.includes('Module')) {
            worksheet.mergeCells(1, colIndex, 3, colIndex);
            colIndex++;
        }
        if (exportSelections.hierarchy.subModule && selectedCourse.courseHierarchy.includes('Sub Module')) {
            worksheet.mergeCells(1, colIndex, 3, colIndex);
            colIndex++;
        }
        if (exportSelections.hierarchy.topic && selectedCourse.courseHierarchy.includes('Topic')) {
            worksheet.mergeCells(1, colIndex, 3, colIndex);
            colIndex++;
        }
        if (exportSelections.hierarchy.subTopic && selectedCourse.courseHierarchy.includes('Sub Topic')) {
            worksheet.mergeCells(1, colIndex, 3, colIndex);
            colIndex++;
        }
        if (exportSelections.hierarchy.level) {
            worksheet.mergeCells(1, colIndex, 3, colIndex);
            colIndex++;
        }

        // Merge Teaching Learning Elements header
        if (showTeachingElements) {
            const teachingElementsSpan = effectiveHoursOption === 'activity'
                ? visibleCategoryCount
                : totalSelectedActivities;

            if (teachingElementsSpan > 1) {
                worksheet.mergeCells(1, colIndex, 1, colIndex + teachingElementsSpan - 1);
            }

            // Merge activity type headers for element view
            if (effectiveHoursOption === 'element' && visibleCategoryCount > 1) {
                if (filteredActivities.iDo.length > 1) {
                    worksheet.mergeCells(2, colIndex, 2, colIndex + filteredActivities.iDo.length - 1);
                }
                colIndex += filteredActivities.iDo.length;

                if (filteredActivities.weDo.length > 1) {
                    worksheet.mergeCells(2, colIndex, 2, colIndex + filteredActivities.weDo.length - 1);
                }
                colIndex += filteredActivities.weDo.length;

                if (filteredActivities.youDo.length > 1) {
                    worksheet.mergeCells(2, colIndex, 2, colIndex + filteredActivities.youDo.length - 1);
                }
            }
        }

        // Merge Total Hours header if included
        if (showTeachingElements || exportSelections.includeTotalHours) {
            const totalHoursCol = totalHierarchyColumns + 1 + (effectiveHoursOption === 'activity' ? visibleCategoryCount : totalSelectedActivities);
            worksheet.mergeCells(1, totalHoursCol, 3, totalHoursCol);
        }

        // Second and third row styling
        [2, 3].forEach(rowNum => {
            const row = worksheet.getRow(rowNum);
            row.eachCell((cell) => {
                if (cell.value === 'I Do' || cell.value === 'We Do' || cell.value === 'You Do') {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF70AD47' } };
                } else {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
                }
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                cell.border = {
                    top: { style: 'thin' }, left: { style: 'thin' },
                    bottom: { style: 'thin' }, right: { style: 'thin' }
                };
            });
        });
    };

    applyHeaderStyling();


    // Add data rows with hierarchy merging logic - FIXED VERSION
    const addDataRows = () => {


        const moduleRowTracker: Record<string, boolean> = {};
        const subModuleRowTracker: Record<string, boolean> = {};
        const topicRowTracker: Record<string, boolean> = {};
        const subtopicRowTracker: Record<string, boolean> = {};


        // Track hierarchy-based merges for activities
        const hierarchyMerges = {};
        const activityMergeTracker = {};

        tableRows.forEach((row, rowIndex) => {
            const dataRow = [];

            // Add hierarchy data
            const isFirstInModule = !moduleRowTracker[row.moduleId];
            const isFirstInSubModule = !subModuleRowTracker[row.subModuleId];
            const isFirstInTopic = !topicRowTracker[row.topicId];
            const isFirstInSubtopic = !subtopicRowTracker[row.subtopicId];

            if (isFirstInModule) moduleRowTracker[row.moduleId] = true;
            if (isFirstInSubModule) subModuleRowTracker[row.subModuleId] = true;
            if (isFirstInTopic) topicRowTracker[row.topicId] = true;
            if (isFirstInSubtopic) subtopicRowTracker[row.subtopicId] = true;

            // Add hierarchy columns based on selection
            if (exportSelections.hierarchy.module && selectedCourse.courseHierarchy.includes('Module')) {
                dataRow.push(isFirstInModule ? (row.moduleName === "Default Module" ? "-" : row.moduleName) : '');
            }
            if (exportSelections.hierarchy.subModule && selectedCourse.courseHierarchy.includes('Sub Module')) {
                dataRow.push(isFirstInSubModule ? (row.subModuleName === "Default Submodule" ? "-" : row.subModuleName) : '');
            }
            if (exportSelections.hierarchy.topic && selectedCourse.courseHierarchy.includes('Topic')) {
                dataRow.push(isFirstInTopic ? (row.topicName === "Default Topic" ? "-" : row.topicName) : '');
            }
            if (exportSelections.hierarchy.subTopic && selectedCourse.courseHierarchy.includes('Sub Topic')) {
                dataRow.push(row.subtopicName === "Default Subtopic" ? "-" : row.subtopicName);
            }

            // Add level data
            if (exportSelections.hierarchy.level) {
                const levelInfo = isLevelMerged(rowIndex);
                if (levelInfo.isMerged && !levelInfo.isStart) {
                    dataRow.push('');
                } else {
                    dataRow.push(levelInfo.value || '-');
                }
            }



            // Add activity data based on effectiveHoursOption - FIXED VERSION
            if (showTeachingElements) {
                if (effectiveHoursOption === 'element') {
                    // Individual activities view - use same logic as preview table
                    filteredActivities.iDo.forEach((activity: string) => {
                        const mergeInfo = isCellMerged(rowIndex, "iDo", activity);
                        if (mergeInfo.isMerged && !mergeInfo.isStart) {
                            dataRow.push('');
                        } else {
                            const value = mergeInfo.isMerged ? mergeInfo.value : getCellValueForRow(row, "iDo", activity);
                            dataRow.push(value || 0);
                        }
                    });

                    filteredActivities.weDo.forEach((activity: string) => {
                        const mergeInfo = isCellMerged(rowIndex, "weDo", activity);
                        if (mergeInfo.isMerged && !mergeInfo.isStart) {
                            dataRow.push('');
                        } else {
                            const value = mergeInfo.isMerged ? mergeInfo.value : getCellValueForRow(row, "weDo", activity);
                            dataRow.push(value || 0);
                        }
                    });

                    filteredActivities.youDo.forEach((activity: string) => {
                        const mergeInfo = isCellMerged(rowIndex, "youDo", activity);
                        if (mergeInfo.isMerged && !mergeInfo.isStart) {
                            dataRow.push('');
                        } else {
                            const value = mergeInfo.isMerged ? mergeInfo.value : getCellValueForRow(row, "youDo", activity);
                            dataRow.push(value || 0);
                        }
                    });

                } else if (effectiveHoursOption === 'activity') {
                    // Activity type totals view - check if this is the first row in merged group
                    const isFirstInGroup = isFirstInMergedGroup(row, rowIndex);

                    if (filteredActivities.iDo.length > 0) {
                        if (isFirstInGroup) {
                            const total = filteredActivities.iDo.reduce((sum: any, activity: string) =>
                                sum + getMergedActivityValue(row, "iDo", activity), 0);
                            dataRow.push(total);
                        } else {
                            dataRow.push('');
                        }
                    }

                    if (filteredActivities.weDo.length > 0) {
                        if (isFirstInGroup) {
                            const total = filteredActivities.weDo.reduce((sum: any, activity: string) =>
                                sum + getMergedActivityValue(row, "weDo", activity), 0);
                            dataRow.push(total);
                        } else {
                            dataRow.push('');
                        }
                    }

                    if (filteredActivities.youDo.length > 0) {
                        if (isFirstInGroup) {
                            const total = filteredActivities.youDo.reduce((sum: any, activity: string) =>
                                sum + getMergedActivityValue(row, "youDo", activity), 0);
                            dataRow.push(total);
                        } else {
                            dataRow.push('');
                        }
                    }
                }

                // Add total hours column if included
                if (exportSelections.includeTotalHours) {
                    const isFirstInGroup = isFirstInMergedGroup(row, rowIndex);
                    if (isFirstInGroup) {
                        dataRow.push(getMergedTotalValue(row));
                    } else {
                        dataRow.push('');
                    }
                }
            }

            const excelRow = worksheet.addRow(dataRow);

            // Apply styling to data rows
            excelRow.eachCell((cell, colNumber) => {
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                cell.border = {
                    top: { style: 'thin' }, left: { style: 'thin' },
                    bottom: { style: 'thin' }, right: { style: 'thin' }
                };

                // Style hierarchy columns
                if (colNumber <= hierarchyColumns) {
                    // cell.alignment.horizontal = 'left';
                    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'eff6ff' } };
                } else if (colNumber === hierarchyColumns + 1 && levelColumnIncluded) {
                    // Level column
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'eff6ff' } };
                } else if (showTeachingElements && colNumber > totalHierarchyColumns) {
                    // Activity columns - apply colors based on activity type
                    const activityColIndex = colNumber - totalHierarchyColumns - 1;

                    if (effectiveHoursOption === 'activity') {
                        // Color based on activity type position
                        if (filteredActivities.iDo.length > 0 && activityColIndex === 0) {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFCC' } }; // Light yellow
                        } else if (filteredActivities.weDo.length > 0 &&
                            activityColIndex === (filteredActivities.iDo.length > 0 ? 1 : 0)) {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE5CC' } }; // Light orange
                        } else if (filteredActivities.youDo.length > 0) {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6FFCC' } }; // Light green
                        }
                    } else {
                        // Individual activity colors
                        if (activityColIndex < filteredActivities.iDo.length) {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFCC' } }; // Light yellow
                        } else if (activityColIndex < filteredActivities.iDo.length + filteredActivities.weDo.length) {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE5CC' } }; // Light orange
                        } else {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6FFCC' } }; // Light green
                        }
                    }
                }
            });
        });
    };

    addDataRows();

    // FIXED: Process merged cells for Excel - Updated to match preview table logic
    const processMergedCells = () => {
        // const mergedRanges = [];
        const mergedRanges: any[] = [];

        // Process pedagogy merged cells for 'element' view
        if (effectiveHoursOption === 'element') {
            Object.entries(mergedCells).forEach(([columnKey, merges]) => {
                const [type, activity] = columnKey.split('-');

                // Check if this activity type is selected for export
                if (!selectedPedagogyTypes.includes(type as "iDo" | "weDo" | "youDo" | "all")) return;

                // Check if this specific activity is selected
                const selectedActivities = exportSelections.pedagogy[type as PedagogyType];
                if (!Array.isArray(selectedActivities) || !selectedActivities.includes(activity)) return;

                merges.forEach(merge => {
                    const firstRowIndex = tableRows.findIndex(row => row.rowId === merge.rowIds[0]);
                    const lastRowIndex = tableRows.findIndex(row => row.rowId === merge.rowIds[merge.rowIds.length - 1]);

                    if (firstRowIndex !== -1 && lastRowIndex !== -1) {
                        // Calculate the column index for this activity
                        let activityCol = totalHierarchyColumns + 1; // Start after hierarchy columns

                        // Find the specific activity column
                        if (type === 'iDo') {
                            const activityIndex = filteredActivities.iDo.indexOf(activity);
                            if (activityIndex !== -1) {
                                activityCol += activityIndex;
                            }
                        } else if (type === 'weDo') {
                            activityCol += filteredActivities.iDo.length;
                            const activityIndex = filteredActivities.weDo.indexOf(activity);
                            if (activityIndex !== -1) {
                                activityCol += activityIndex;
                            }
                        } else if (type === 'youDo') {
                            activityCol += filteredActivities.iDo.length + filteredActivities.weDo.length;
                            const activityIndex = filteredActivities.youDo.indexOf(activity);
                            if (activityIndex !== -1) {
                                activityCol += activityIndex;
                            }
                        }

                        // Add to Excel row numbers (add 4 for headers)
                        mergedRanges.push({
                            start: firstRowIndex + 4,
                            end: lastRowIndex + 4,
                            col: activityCol
                        });
                    }
                });
            });
        }

        // Process hierarchy-based merges for 'activity' view and total hours
        if (effectiveHoursOption === 'activity' || exportSelections.includeTotalHours) {
            // Group rows by hierarchy
            // const hierarchyGroups = {};
            const hierarchyGroups: Record<string, number[]> = {};

            tableRows.forEach((row, index) => {
                let hierarchyKey = '';
                let hierarchyId = '';

                // Determine hierarchy key/id (same logic as isFirstInMergedGroup)
                if (exportSelections.hierarchy.module && row.moduleId) {
                    hierarchyKey = 'moduleId';
                    hierarchyId = row.moduleId;
                } else if (exportSelections.hierarchy.subModule && row.subModuleId) {
                    hierarchyKey = 'subModuleId';
                    hierarchyId = row.subModuleId;
                } else if (exportSelections.hierarchy.topic && row.topicId) {
                    hierarchyKey = 'topicId';
                    hierarchyId = row.topicId;
                } else if (exportSelections.hierarchy.subTopic && row.subtopicId) {
                    hierarchyKey = 'subtopicId';
                    hierarchyId = row.subtopicId;
                } else {
                    hierarchyKey = 'all';
                    hierarchyId = 'all';
                }

                const groupKey = `${hierarchyKey}-${hierarchyId}`;
                if (!hierarchyGroups[groupKey]) {
                    hierarchyGroups[groupKey] = [];
                }
                hierarchyGroups[groupKey].push(index);
            });

            // Create merges for each hierarchy group
            Object.values(hierarchyGroups).forEach(rowIndices => {
                if (rowIndices.length > 1) {
                    const startRow = Math.min(...rowIndices) + 4; // +4 for headers
                    const endRow = Math.max(...rowIndices) + 4;

                    if (effectiveHoursOption === 'activity') {
                        // Merge activity type columns
                        let colIndex = totalHierarchyColumns + 1;

                        if (filteredActivities.iDo.length > 0) {
                            mergedRanges.push({ start: startRow, end: endRow, col: colIndex });
                            colIndex++;
                        }
                        if (filteredActivities.weDo.length > 0) {
                            mergedRanges.push({ start: startRow, end: endRow, col: colIndex });
                            colIndex++;
                        }
                        if (filteredActivities.youDo.length > 0) {
                            mergedRanges.push({ start: startRow, end: endRow, col: colIndex });
                            colIndex++;
                        }
                    }

                    // Merge total hours column if included
                    if (exportSelections.includeTotalHours) {
                        const totalHoursCol = totalHierarchyColumns + 1 +
                            (effectiveHoursOption === 'activity' ? visibleCategoryCount : totalSelectedActivities);
                        mergedRanges.push({ start: startRow, end: endRow, col: totalHoursCol });
                    }
                }
            });
        }

        // Process hierarchy merges (existing code for Module, Sub Module, Topic)
        const processHierarchyMerges = () => {
            const hierarchyMerges: HierarchyMerges = { module: {}, subModule: {}, topic: {} };

            tableRows.forEach((row, rowIndex) => {
                if (!hierarchyMerges.module[row.moduleId]) {
                    hierarchyMerges.module[row.moduleId] = { startRow: rowIndex + 4, endRow: rowIndex + 4 };
                } else {
                    hierarchyMerges.module[row.moduleId].endRow = rowIndex + 4;
                }

                if (row.subModuleId && !hierarchyMerges.subModule[row.subModuleId]) {
                    hierarchyMerges.subModule[row.subModuleId] = { startRow: rowIndex + 4, endRow: rowIndex + 4 };
                } else if (row.subModuleId) {
                    hierarchyMerges.subModule[row.subModuleId].endRow = rowIndex + 4;
                }

                if (row.topicId && !hierarchyMerges.topic[row.topicId]) {
                    hierarchyMerges.topic[row.topicId] = { startRow: rowIndex + 4, endRow: rowIndex + 4 };
                } else if (row.topicId) {
                    hierarchyMerges.topic[row.topicId].endRow = rowIndex + 4;
                }
            });

            let colIndex = 1;
            if (exportSelections.hierarchy.module && selectedCourse?.courseHierarchy.includes('Module')) {
                Object.values(hierarchyMerges.module).forEach(({ startRow, endRow }) => {
                    if (endRow > startRow) {
                        mergedRanges.push({ start: startRow, end: endRow, col: colIndex });
                    }
                });
                colIndex++;
            }

            if (exportSelections.hierarchy.subModule && selectedCourse?.courseHierarchy.includes('Sub Module')) {
                Object.values(hierarchyMerges.subModule).forEach(({ startRow, endRow }) => {
                    if (endRow > startRow) {
                        mergedRanges.push({ start: startRow, end: endRow, col: colIndex });
                    }
                });
                colIndex++;
            }

            if (exportSelections.hierarchy.topic && selectedCourse?.courseHierarchy.includes('Topic')) {
                Object.values(hierarchyMerges.topic).forEach(({ startRow, endRow }) => {
                    if (endRow > startRow) {
                        mergedRanges.push({ start: startRow, end: endRow, col: colIndex });
                    }
                });
            }

            // Process level merges if level column is included
            if (exportSelections.hierarchy.level) {
                const levelCol = totalHierarchyColumns; // Level is the last hierarchy column

                // Check for level merges in mergedCells object
                Object.entries(mergedCells).forEach(([columnKey, merges]) => {
                    if (columnKey === 'level' || columnKey.includes('level')) {
                        merges.forEach(merge => {
                            if (merge.rowIds && merge.rowIds.length > 1) {
                                const rowIndices = merge.rowIds
                                    .map(rowId => tableRows.findIndex(row => row.rowId === rowId))
                                    .filter(idx => idx !== -1)
                                    .sort((a, b) => a - b);

                                if (rowIndices.length > 1) {
                                    mergedRanges.push({
                                        start: rowIndices[0] + 4, // +4 for headers
                                        end: rowIndices[rowIndices.length - 1] + 4,
                                        col: levelCol
                                    });
                                }
                            }
                        });
                    }
                });

                // Also check for level merges using the isLevelMerged function pattern
                const levelMergeGroups: Record<string, number[]> = {};
                tableRows.forEach((row, index) => {
                    const levelInfo = isLevelMerged(index);
                    if (levelInfo.isMerged) {
                        const mergeKey = `${levelInfo.value}-${levelInfo.mergeIndex}`;
                        if (!levelMergeGroups[mergeKey]) {
                            levelMergeGroups[mergeKey] = [];
                        }
                        levelMergeGroups[mergeKey].push(index);
                    }
                });

                // Process level merge groups
                Object.values(levelMergeGroups).forEach(rowIndices => {
                    if (rowIndices.length > 1) {
                        const sortedIndices = rowIndices.sort((a, b) => a - b);
                        mergedRanges.push({
                            start: sortedIndices[0] + 4,
                            end: sortedIndices[sortedIndices.length - 1] + 4,
                            col: levelCol
                        });
                    }
                });
            }
        };

        processHierarchyMerges();
        return mergedRanges;
    };

    const mergedRanges = processMergedCells();
    mergedRanges.forEach(({ start, end, col }) => {
        try {
            worksheet.mergeCells(start, col, end, col);

            // Center the value in merged cells
            const cell = worksheet.getCell(start, col);
            cell.alignment = cell.alignment || {};
            cell.alignment.vertical = 'middle';
            cell.alignment.horizontal = 'center';
        } catch (error) {
            console.warn('Failed to merge cells:', error);
        }
    });

    // Add Total Hours Row
    if (showTeachingElements) {
        const totalRow = [];

        // Add hierarchy columns
        totalRow.push(...Array(hierarchyColumns).fill(''));

        if (exportSelections.hierarchy.level) {
            totalRow.push('Total Hours');
        } else if (hierarchyColumns > 0) {
            totalRow[totalRow.length - 1] = 'Total Hours';
        } else {
            totalRow.push('Total Hours');
        }

        // Add activity totals based on effectiveHoursOption
        if (effectiveHoursOption === 'element') {
            // Individual activity totals (DEFAULT)
            filteredActivities.iDo.forEach((activity: string) => {
                totalRow.push(calculateTotalHours("iDo", activity));
            });
            filteredActivities.weDo.forEach((activity: string) => {
                totalRow.push(calculateTotalHours("weDo", activity));
            });
            filteredActivities.youDo.forEach((activity: string) => {
                totalRow.push(calculateTotalHours("youDo", activity));
            });
        } else if (effectiveHoursOption === 'activity') {
            // Activity type totals
            if (filteredActivities.iDo.length > 0) {
                const iDoTotal = filteredActivities.iDo.reduce((sum: number, activity: string) =>
                    sum + calculateTotalHours("iDo", activity), 0);
                totalRow.push(iDoTotal);
            }
            if (filteredActivities.weDo.length > 0) {
                const weDoTotal = filteredActivities.weDo.reduce((sum: number, activity: string) =>
                    sum + calculateTotalHours("weDo", activity), 0);
                totalRow.push(weDoTotal);
            }
            if (filteredActivities.youDo.length > 0) {
                const youDoTotal = filteredActivities.youDo.reduce((sum: number, activity: string) =>
                    sum + calculateTotalHours("youDo", activity), 0);
                totalRow.push(youDoTotal);
            }
        }

        // Add grand total if includeTotalHours is enabled
        if (exportSelections.includeTotalHours) {
            const grandTotal =
                filteredActivities.iDo.reduce((sum: number, activity: string) => sum + calculateTotalHours("iDo", activity), 0) +
                filteredActivities.weDo.reduce((sum: number, activity: string) => sum + calculateTotalHours("weDo", activity), 0) +
                filteredActivities.youDo.reduce((sum: number, activity: string) => sum + calculateTotalHours("youDo", activity), 0);
            totalRow.push(grandTotal);
        }

        const totalExcelRow = worksheet.addRow(totalRow);

        // Style total row
        totalExcelRow.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE699' } };
            cell.font = { bold: true };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = {
                top: { style: 'medium' }, bottom: { style: 'medium' },
                left: { style: 'thin' }, right: { style: 'thin' }
            };
        });

        // Left-align the "Total Hours" label
        const labelColNumber = hierarchyColumns + (exportSelections.hierarchy.level ? 1 : 0);
        if (labelColNumber > 0) {
            totalExcelRow.getCell(labelColNumber).alignment = {
                vertical: 'middle', horizontal: 'center'
            };
        }
    }

    // Add Summary Section (rest of the code remains the same)
    // sarathi
    if (exportSelections.showSummary && exportSelections.printPedagogy) {
        // Add empty row before summary
        worksheet.addRow([]);

        // Calculate total columns for centering
        const totalColumns = totalHierarchyColumns +
            (effectiveHoursOption === 'activity' ? visibleCategoryCount : totalSelectedActivities) +
            (exportSelections.includeTotalHours ? 1 : 0);

        const summaryStartCol = Math.floor((totalColumns - 3) / 2) + 1;

        // Set column widths for summary
        worksheet.getColumn(summaryStartCol).width = 20;
        worksheet.getColumn(summaryStartCol + 1).width = 25;
        worksheet.getColumn(summaryStartCol + 2).width = 15;

        // Add summary header
        const summaryHeaderRow = worksheet.addRow([]);
        summaryHeaderRow.getCell(summaryStartCol).value = 'Teaching Elements Summary';

        // Style and merge header
        for (let col = summaryStartCol; col <= summaryStartCol + 2; col++) {
            const cell = summaryHeaderRow.getCell(col);
            cell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = {
                top: { style: 'thin' }, left: { style: 'thin' },
                bottom: { style: 'thin' }, right: { style: 'thin' }
            };
        }

        worksheet.mergeCells(summaryHeaderRow.number, summaryStartCol, summaryHeaderRow.number, summaryStartCol + 2);

        // Add column headers
        const summaryColumns = worksheet.addRow([]);
        const columnHeaders = ['Activity Type', 'Elements', 'Hours'];

        columnHeaders.forEach((header, index) => {
            const cell = summaryColumns.getCell(summaryStartCol + index);
            cell.value = header;
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF70AD47' } };
            cell.border = {
                top: { style: 'thin' }, left: { style: 'thin' },
                bottom: { style: 'thin' }, right: { style: 'thin' }
            };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        });

        // Add activity sections
        const addActivitySection = (activityType: PedagogyType, backgroundColor: string) => {
            const activities = summaryActivities[activityType];
            if (!activities || activities.length === 0) return;

            const displayName = activityType === 'iDo' ? 'I Do' : activityType === 'weDo' ? 'We Do' : 'You Do';
            const sectionStartRow = worksheet.rowCount + 1;

            activities.forEach((activity: any, index: any) => {
                const activityRow = worksheet.addRow([]);

                if (index === 0) {
                    activityRow.getCell(summaryStartCol).value = displayName;
                }

                activityRow.getCell(summaryStartCol + 1).value = activity;
                const total = calculateTotalHours(activityType, activity);
                activityRow.getCell(summaryStartCol + 2).value = total;

                // Style cells
                for (let col = summaryStartCol; col <= summaryStartCol + 2; col++) {
                    const cell = activityRow.getCell(col);
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: backgroundColor } };
                    cell.border = {
                        top: { style: 'thin' }, left: { style: 'thin' },
                        bottom: { style: 'thin' }, right: { style: 'thin' }
                    };
                    cell.alignment = {
                        vertical: 'middle',
                        horizontal: 'center',
                        wrapText: false
                    };

                    if (col === summaryStartCol && index === 0) {
                        cell.font = { bold: true };
                    }
                }
            });

            // Merge activity type column
            if (activities.length > 1) {
                const sectionEndRow = worksheet.rowCount;
                try {
                    worksheet.mergeCells(sectionStartRow, summaryStartCol, sectionEndRow, summaryStartCol);
                } catch (error) {
                    console.warn('Failed to merge activity section cells:', error);
                }
            }
        };

        // Add sections for each activity type
        if (summaryActivities.iDo.length > 0) {
            addActivitySection("iDo", "FFFFFFCC"); // Light yellow
        }
        if (summaryActivities.weDo.length > 0) {
            addActivitySection("weDo", "FFFFE5CC"); // Light orange
        }
        if (summaryActivities.youDo.length > 0) {
            addActivitySection("youDo", "FFE6FFCC"); // Light green
        }

        // Add Grand Total row
        const grandTotalRow = worksheet.addRow([]);
        grandTotalRow.getCell(summaryStartCol).value = 'Total Hours';

        const grandTotal = Object.entries(summaryActivities).reduce((sum, [type, activities]) => {
            return sum + (activities || []).reduce((typeSum: any, activity: any) => {
                return typeSum + calculateTotalHours(type as PedagogyType, activity);
            }, 0);
        }, 0);

        grandTotalRow.getCell(summaryStartCol + 2).value = grandTotal;

        // Style grand total row
        for (let col = summaryStartCol; col <= summaryStartCol + 2; col++) {
            const cell = grandTotalRow.getCell(col);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE699' } };
            cell.font = { bold: true, color: { argb: 'FF000000' } };
            cell.border = {
                top: { style: 'medium' }, bottom: { style: 'medium' },
                left: { style: 'thin' }, right: { style: 'thin' }
            };
            cell.alignment = {
                vertical: 'middle',
                horizontal: 'center',
                wrapText: true
            };
        }

        // Merge first two cells of grand total row
        worksheet.mergeCells(grandTotalRow.number, summaryStartCol, grandTotalRow.number, summaryStartCol + 1);
    }

    // Set column widths
    let colIndex = 1;
    if (exportSelections.hierarchy.module && selectedCourse.courseHierarchy.includes('Module')) {
        worksheet.getColumn(colIndex).width = 25;
        colIndex++;
    }
    if (exportSelections.hierarchy.subModule && selectedCourse.courseHierarchy.includes('Sub Module')) {
        worksheet.getColumn(colIndex).width = 25;
        colIndex++;
    }
    if (exportSelections.hierarchy.topic && selectedCourse.courseHierarchy.includes('Topic')) {
        worksheet.getColumn(colIndex).width = 25;
        colIndex++;
    }
    if (exportSelections.hierarchy.subTopic && selectedCourse.courseHierarchy.includes('Sub Topic')) {
        worksheet.getColumn(colIndex).width = 25;
        colIndex++;
    }
    if (exportSelections.hierarchy.level) {
        worksheet.getColumn(colIndex).width = 12;
        colIndex++;
    }

    // Set activity column widths
    const totalActivityCols = effectiveHoursOption === 'activity' ? visibleCategoryCount : totalSelectedActivities;
    for (let i = 0; i < totalActivityCols; i++) {
        worksheet.getColumn(colIndex).width = 20;
        colIndex++;
    }

    // Set total hours column width
    if (exportSelections.includeTotalHours) {
        worksheet.getColumn(colIndex).width = 15;
    }

    // Set row heights
    worksheet.getRow(1).height = 30;
    worksheet.getRow(2).height = 25;
    worksheet.getRow(3).height = 25;

    for (let i = 4; i <= worksheet.rowCount; i++) {
        worksheet.getRow(i).height = 20;
    }

    // Generate and save Excel file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    saveAs(blob, `${selectedCourse.courseName.replace(/[^a-z0-9]/gi, '_')}_pedagogy_${new Date().toISOString().slice(0, 10)}.xlsx`);

    // Reset export selections
    setExportSelections({
        printPedagogy: null,
        hierarchy: {
            module: true,
            subModule: true,
            topic: true,
            subTopic: true,
            level: true
        },
        pedagogy: {
            iDo: selectedPedagogyTypes.includes("iDo") ? activityTypes["iDo"] : [],
            weDo: selectedPedagogyTypes.includes("weDo") ? activityTypes["weDo"] : [],
            youDo: selectedPedagogyTypes.includes("youDo") ? activityTypes["youDo"] : [],
        },
        showSummary: false,
        includeTotalHours: false,
        hoursOption: ''
    });
    setShowPreviewDialog(false);
}
