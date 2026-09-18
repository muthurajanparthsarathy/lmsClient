"use client"

// The pedagogy preview table. Moved verbatim out of page.tsx during the file
// split: it already took all its data through PreviewTableProps and only
// closed over isLevelMerged and renderActivityCell, which are now two more
// props. Same markup, same output — a pure relocation plus two passed callbacks.

import React from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FileText } from "lucide-react"
import type { PreviewTableProps } from "./types"

export default function PreviewTable({
    tableRows,
    courseHours,
    mergedCells,
    selectedCourse,
    activityTypes,
    selectedPedagogyTypes,
    moduleSpans,
    subModuleSpans,
    topicSpans,
    exportSelections,
    isPrinting = false,
    isLevelMerged,
    renderActivityCell,
    pedagogyViews,
}: PreviewTableProps) {
    const isCellMerged = (
        rowIndex: number,
        type: "iDo" | "weDo" | "youDo",
        activity: string
    ) => {
        const columnKey = `${type}-${activity}`;
        const merges = mergedCells[columnKey] || [];
        const row = tableRows[rowIndex];

        for (const merge of merges) {
            // Check if this row is part of the merge
            const rowIndices =
                merge.rowIds
                    ?.map((rid: string) =>
                        tableRows.findIndex((r: any) => r.rowId === rid)
                    )
                    .filter((idx: number) => idx !== -1)
                    .sort((a: number, b: number) => a - b) || [];

            if (rowIndices.includes(rowIndex)) {
                return {
                    isMerged: true,
                    isStart: rowIndex === rowIndices[0],
                    rowSpan: rowIndices.length,
                    value: merge.value,
                    mergeIndex: merges.indexOf(merge),
                    hierarchyIds: merge.hierarchyIds,
                    type: type,
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
            type: type,
        };
    };
    const calculateTotalHours = (
        type: "iDo" | "weDo" | "youDo",
        activity: string
    ) => {
        const columnKey = `${type}-${activity}`;

        // Calculate merged values
        const mergedValue =
            mergedCells[columnKey]?.reduce((sum, merge) => sum + merge.value, 0) ||
            0;

        // Calculate unmerged values
        const unmergedValue = Object.entries(courseHours).reduce(
            (sum, [moduleId, moduleData]) => {
                return (
                    sum +
                    Object.entries(moduleData).reduce(
                        (moduleSum, [topicId, topicData]) => {
                            return (
                                moduleSum +
                                Object.entries(topicData).reduce(
                                    (topicSum, [subtopicId, subtopicData]) => {
                                        // Check if this cell is part of any merge
                                        const isMerged = mergedCells[columnKey]?.some((merge) => {
                                            // Check hierarchy matches
                                            const matchesModule =
                                                !merge.hierarchyIds?.modules.length ||
                                                merge.hierarchyIds.modules.includes(moduleId);
                                            const matchesSubModule =
                                                !merge.hierarchyIds?.subModules.length ||
                                                !topicData.subModuleId ||
                                                merge.hierarchyIds.subModules.includes(
                                                    topicData?.subModuleId as any
                                                );
                                            const matchesTopic =
                                                !merge.hierarchyIds?.topics.length ||
                                                !topicId ||
                                                merge.hierarchyIds.topics.includes(topicId);
                                            const matchesSubTopic =
                                                !merge.hierarchyIds?.subTopics.length ||
                                                !subtopicId ||
                                                merge.hierarchyIds.subTopics.includes(subtopicId);

                                            return (
                                                matchesModule &&
                                                matchesSubModule &&
                                                matchesTopic &&
                                                matchesSubTopic
                                            );
                                        });

                                        // Only add if not part of a merge and has a value
                                        if (!isMerged && subtopicData[type]?.[activity]) {
                                            return topicSum + (subtopicData[type][activity] || 0);
                                        }
                                        return topicSum;
                                    },
                                    0
                                )
                            );
                        },
                        0
                    )
                );
            },
            0
        );

        return mergedValue + unmergedValue;
    };

    const getLevelColumnLeft = () => {
        if (!selectedCourse) return 0;

        // Calculate width based on hierarchy levels
        let left = 0;
        const hierarchyLevels = selectedCourse.courseHierarchy;

        // Add width for each hierarchy level (80px per column)
        left = hierarchyLevels.length * 0;

        // Add some extra spacing (20px) between last hierarchy and level column
        return left + 0;
    };

    const renderPreviewLevelCell = (row: any, rowIndex: number) => {
        const mergeInfo = isLevelMerged(rowIndex);

        // Skip rendering if this is part of a merged cell but not the first row
        if (mergeInfo.isMerged && !mergeInfo.isStart) return null;

        return (
            <td
                key={`level-${row.rowId}`}
                className={`border border-gray-400 text-center text-[10px] p-0.5 bg-[#FFF3EA] min-w-[80px] h-[32px]  bg-white z-0`}
                style={{
                    left: `${getLevelColumnLeft()}px`,
                }}
                rowSpan={mergeInfo.rowSpan}
            >
                <div
                    className={`min-h-[20px] flex items-center justify-center text-center leading-tight whitespace-normal break-words ${mergeInfo.isMerged ? "font-bold" : ""
                        }`}
                >
                    {mergeInfo.value || "-"}
                </div>
            </td>
        );
    };

    // Calculate total hours for a row
    const calculateRowTotal = (row: any) => {
        let total = 0;

        // Calculate for each selected activity type
        selectedIDoActivities.forEach((activity) => {
            const mergeInfo = isCellMerged(tableRows.indexOf(row), "iDo", activity);
            const cellValue = mergeInfo.isMerged
                ? mergeInfo.isStart
                    ? mergeInfo.value
                    : 0
                : getCellValueForRow(row, "iDo", activity);
            total += cellValue || 0;
        });

        selectedWeDoActivities.forEach((activity) => {
            const mergeInfo = isCellMerged(
                tableRows.indexOf(row),
                "weDo",
                activity
            );
            const cellValue = mergeInfo.isMerged
                ? mergeInfo.isStart
                    ? mergeInfo.value
                    : 0
                : getCellValueForRow(row, "weDo", activity);
            total += cellValue || 0;
        });

        selectedYouDoActivities.forEach((activity) => {
            const mergeInfo = isCellMerged(
                tableRows.indexOf(row),
                "youDo",
                activity
            );
            const cellValue = mergeInfo.isMerged
                ? mergeInfo.isStart
                    ? mergeInfo.value
                    : 0
                : getCellValueForRow(row, "youDo", activity);
            total += cellValue || 0;
        });

        return total;
    };

    // Get cell value for a specific row and activity
    const getCellValueForRow = (
        row: any,
        type: "iDo" | "weDo" | "youDo",
        activity: string
    ) => {
        // Determine effective IDs based on hierarchy
        const effectiveTopicId = row.topicId || `${row.moduleId}-default-topic`;
        const effectiveSubtopicId =
            row.subtopicId ||
            (row.topicId
                ? `${row.topicId}-default-subtopic`
                : `${row.moduleId}-default-subtopic`);

        // Check backend data first
        if (pedagogyViews && pedagogyViews.length > 0) {
            for (const view of pedagogyViews) {
                for (const pedagogy of view.pedagogies) {
                    const pedagogyModules = pedagogy.module || [];
                    const pedagogySubModules = pedagogy.subModule || [];
                    const pedagogyTopics = pedagogy.topic || [];
                    const pedagogySubTopics = pedagogy.subTopic || [];

                    // Skip merged pedagogies
                    const isMultiMerge =
                        pedagogyModules.length > 1 ||
                        pedagogySubModules.length > 1 ||
                        pedagogyTopics.length > 1 ||
                        pedagogySubTopics.length > 1;
                    if (isMultiMerge) continue;

                    // Check exact match for single cell
                    const moduleMatch =
                        pedagogyModules.length === 0 ||
                        (pedagogyModules.length === 1 &&
                            pedagogyModules[0] === row.moduleId);
                    const subModuleMatch =
                        pedagogySubModules.length === 0 ||
                        (pedagogySubModules.length === 1 &&
                            pedagogySubModules[0] === row.subModuleId);
                    const topicMatch =
                        pedagogyTopics.length === 0 ||
                        (pedagogyTopics.length === 1 &&
                            pedagogyTopics[0] === row.topicId);
                    const subtopicMatch =
                        pedagogySubTopics.length === 0 ||
                        (pedagogySubTopics.length === 1 &&
                            pedagogySubTopics[0] === row.subtopicId);

                    if (moduleMatch && subModuleMatch && topicMatch && subtopicMatch) {
                        const activityData = pedagogy[type]?.find(
                            (a: any) => a.type === activity
                        );
                        if (activityData) {
                            return activityData.duration;
                        }
                    }
                }
            }
        }

        // Fall back to frontend data
        return (
            courseHours[row.moduleId]?.[effectiveTopicId]?.[effectiveSubtopicId]?.[
            type
            ]?.[activity] || 0
        );
    };

    // Calculate merged totals for hierarchy levels

    const isFirstInMergedGroup = (
        row: {
            moduleId: string;
            subModuleId: string;
            topicId: string;
            subtopicId: string;
        },
        index: number
    ) => {
        // Find the highest priority hierarchy level that is selected
        let hierarchyKey = "";
        let hierarchyId = "";

        // Check in order of priority - use the first selected one
        if (exportSelections.hierarchy.module && row.moduleId) {
            hierarchyKey = "moduleId";
            hierarchyId = row.moduleId;
        } else if (exportSelections.hierarchy.subModule && row.subModuleId) {
            hierarchyKey = "subModuleId";
            hierarchyId = row.subModuleId;
        } else if (exportSelections.hierarchy.topic && row.topicId) {
            hierarchyKey = "topicId";
            hierarchyId = row.topicId;
        } else if (exportSelections.hierarchy.subTopic && row.subtopicId) {
            hierarchyKey = "subtopicId";
            hierarchyId = row.subtopicId;
        } else {
            // No hierarchy selected, treat each row individually
            return index === 0; // Only show total on first row
        }

        // Check if this is the first row with this hierarchy ID
        return (
            tableRows.findIndex((r) => r[hierarchyKey] === hierarchyId) === index
        );
    };

    const getTotalRowSpan = (row: {
        moduleId: string;
        subModuleId: string;
        topicId: string;
        subtopicId: string;
    }) => {
        let hierarchyKey = "";
        let hierarchyId = "";

        if (exportSelections.hierarchy.module && row.moduleId) {
            hierarchyKey = "moduleId";
            hierarchyId = row.moduleId;
        } else if (exportSelections.hierarchy.subModule && row.subModuleId) {
            hierarchyKey = "subModuleId";
            hierarchyId = row.subModuleId;
        } else if (exportSelections.hierarchy.topic && row.topicId) {
            hierarchyKey = "topicId";
            hierarchyId = row.topicId;
        } else if (exportSelections.hierarchy.subTopic && row.subtopicId) {
            hierarchyKey = "subtopicId";
            hierarchyId = row.subtopicId;
        } else {
            return tableRows.length; // Span all rows if no hierarchy
        }

        return tableRows.filter((r) => r[hierarchyKey] === hierarchyId).length;
    };

    // 4. Fix the merged total value calculation

    const getMergedTotalValue = (row: {
        moduleId: string;
        subModuleId: string;
        topicId: string;
        subtopicId: string;
    }) => {
        let hierarchyKey = "";
        let hierarchyId = "";

        if (exportSelections.hierarchy.module && row.moduleId) {
            hierarchyKey = "moduleId";
            hierarchyId = row.moduleId;
        } else if (exportSelections.hierarchy.subModule && row.subModuleId) {
            hierarchyKey = "subModuleId";
            hierarchyId = row.subModuleId;
        } else if (exportSelections.hierarchy.topic && row.topicId) {
            hierarchyKey = "topicId";
            hierarchyId = row.topicId;
        } else if (exportSelections.hierarchy.subTopic && row.subtopicId) {
            hierarchyKey = "subtopicId";
            hierarchyId = row.subtopicId;
        } else {
            // No hierarchy selected - calculate total for all rows
            return tableRows.reduce((total, r) => total + calculateRowTotal(r), 0);
        }

        // Get all rows in this hierarchy group
        const rowsInGroup = tableRows.filter(
            (r) => r[hierarchyKey] === hierarchyId
        );
        const rowIndicesInGroup = rowsInGroup.map((r) => tableRows.indexOf(r));

        // Check if any teaching elements are selected
        const hasSelectedTeachingElements =
            selectedIDoActivities.length > 0 ||
            selectedWeDoActivities.length > 0 ||
            selectedYouDoActivities.length > 0;

        let total = 0;
        const processedMerges = new Set();

        // Determine which activities to process
        const activitiesToProcess = hasSelectedTeachingElements
            ? {
                iDo: selectedIDoActivities,
                weDo: selectedWeDoActivities,
                youDo: selectedYouDoActivities,
            }
            : {
                iDo: activityTypes.iDo || [],
                weDo: activityTypes.weDo || [],
                youDo: activityTypes.youDo || [],
            };

        // Process each activity type
        ["iDo", "weDo", "youDo"].forEach((type) => {
            const activities =
                activitiesToProcess[type as keyof typeof activitiesToProcess];

            activities.forEach((activity) => {
                const columnKey = `${type}-${activity}`;
                const merges = mergedCells[columnKey] || [];

                // Check each merge for this column
                merges.forEach((merge, mergeIndex) => {
                    const mergeId = `${columnKey}-${mergeIndex}`;

                    if (!processedMerges.has(mergeId)) {
                        // Get row indices for this merge
                        const mergeRowIndices =
                            merge.rowIds
                                ?.map((rid: string) =>
                                    tableRows.findIndex((r: any) => r.rowId === rid)
                                )
                                .filter((idx: number) => idx !== -1) || [];

                        // Check if ANY row from this merge is in our hierarchy group
                        const hasMergeInGroup = mergeRowIndices.some((idx: number) =>
                            rowIndicesInGroup.includes(idx)
                        );

                        if (hasMergeInGroup) {
                            total += merge.value || 0;
                            processedMerges.add(mergeId);
                        }
                    }
                });

                // Process unmerged cells in this group
                rowsInGroup.forEach((r) => {
                    const rowIndex = tableRows.indexOf(r);
                    const mergeInfo = isCellMerged(
                        rowIndex,
                        type as "iDo" | "weDo" | "youDo",
                        activity
                    );

                    if (!mergeInfo.isMerged) {
                        // Only add unmerged cell values
                        const cellValue = getCellValueForRow(
                            r,
                            type as "iDo" | "weDo" | "youDo",
                            activity
                        );
                        total += cellValue || 0;
                    }
                });
            });
        });

        return total;
    };

    const getStickyLeftPositions = () => {
        const positions: { [key: string]: number } = {};
        let currentLeft = 0;

        if (
            exportSelections.hierarchy.module &&
            selectedCourse?.courseHierarchy.includes("Module")
        ) {
            positions["module"] = currentLeft;
            currentLeft += 80; // Fixed width for module column
        }

        if (
            exportSelections.hierarchy.subModule &&
            selectedCourse?.courseHierarchy.includes("Sub Module")
        ) {
            positions["subModule"] = currentLeft;
            currentLeft += 80; // Fixed width for submodule column
        }

        if (
            exportSelections.hierarchy.topic &&
            selectedCourse?.courseHierarchy.includes("Topic")
        ) {
            positions["topic"] = currentLeft;
            currentLeft += 80; // Fixed width for topic column
        }

        if (
            exportSelections.hierarchy.subTopic &&
            selectedCourse?.courseHierarchy.includes("Sub Topic")
        ) {
            positions["subTopic"] = currentLeft;
            currentLeft += 80; // Fixed width for subtopic column
        }

        if (exportSelections.hierarchy.level) {
            positions["level"] = currentLeft;
            currentLeft += 60; // Fixed width for level column
        }

        return positions;
    };

    const stickyPositions = getStickyLeftPositions();
    const getSelectedActivities = (type: "iDo" | "weDo" | "youDo") => {
        const exportKey = type as keyof typeof exportSelections.pedagogy;
        return selectedPedagogyTypes.includes(type) &&
            Array.isArray(exportSelections.pedagogy[exportKey])
            ? activityTypes[type].filter((activity) =>
                (exportSelections.pedagogy[exportKey] as string[]).includes(
                    activity
                )
            )
            : [];
    };

    const hasSelectedActivities = (type: "iDo" | "weDo" | "youDo") => {
        return getSelectedActivities(type).length > 0;
    };

    // Calculate selected activities for each type
    const selectedIDoActivities = getSelectedActivities("iDo");
    const selectedWeDoActivities = getSelectedActivities("weDo");
    const selectedYouDoActivities = getSelectedActivities("youDo");

    // Calculate if we should show teaching elements section
    const showTeachingElements =
        selectedPedagogyTypes.length > 0 &&
        (selectedIDoActivities.length > 0 ||
            selectedWeDoActivities.length > 0 ||
            selectedYouDoActivities.length > 0);

    // Calculate total selected activities count
    const totalSelectedActivities =
        selectedIDoActivities.length +
        selectedWeDoActivities.length +
        selectedYouDoActivities.length;
    // Count visible category headers (only those with selected activities)
    const visibleCategoryCount = [
        hasSelectedActivities("iDo"),
        hasSelectedActivities("weDo"),
        hasSelectedActivities("youDo"),
    ].filter(Boolean).length;

    // sarathi
    // Calculate summary activities
    const summaryActivities =
        exportSelections.showSummary && exportSelections.printPedagogy
            ? {
                iDo: Array.isArray(exportSelections.printPedagogy.iDo)
                    ? exportSelections.printPedagogy.iDo
                    : [],
                weDo: Array.isArray(exportSelections.printPedagogy.weDo)
                    ? exportSelections.printPedagogy.weDo
                    : [],
                youDo: Array.isArray(exportSelections.printPedagogy.youDo)
                    ? exportSelections.printPedagogy.youDo
                    : [],
            }
            : {
                iDo: [],
                weDo: [],
                youDo: [],
            };

    // Calculate merged value for a specific activity type
    const getMergedActivityValue = (
        row: any,
        type: "iDo" | "weDo" | "youDo",
        activity: string
    ) => {
        let hierarchyKey = "";
        let hierarchyId = "";

        if (exportSelections.hierarchy.module && row.moduleId) {
            hierarchyKey = "moduleId";
            hierarchyId = row.moduleId;
        } else if (exportSelections.hierarchy.subModule && row.subModuleId) {
            hierarchyKey = "subModuleId";
            hierarchyId = row.subModuleId;
        } else if (exportSelections.hierarchy.topic && row.topicId) {
            hierarchyKey = "topicId";
            hierarchyId = row.topicId;
        } else if (exportSelections.hierarchy.subTopic && row.subtopicId) {
            hierarchyKey = "subtopicId";
            hierarchyId = row.subtopicId;
        } else {
            // No hierarchy selected - calculate total for all rows
            return tableRows.reduce((total, r) => {
                const mergeInfo = isCellMerged(tableRows.indexOf(r), type, activity);
                const cellValue = mergeInfo.isMerged
                    ? mergeInfo.isStart
                        ? mergeInfo.value
                        : 0
                    : getCellValueForRow(r, type, activity);
                return total + (cellValue || 0);
            }, 0);
        }

        // Calculate total for all rows with the same hierarchy ID
        const rowsInGroup = tableRows.filter(
            (r) => r[hierarchyKey] === hierarchyId
        );
        return rowsInGroup.reduce((total, r) => {
            const mergeInfo = isCellMerged(tableRows.indexOf(r), type, activity);
            const cellValue = mergeInfo.isMerged
                ? mergeInfo.isStart
                    ? mergeInfo.value
                    : 0
                : getCellValueForRow(r, type, activity);
            return total + (cellValue || 0);
        }, 0);
    };

    // Calculate total hierarchy columns
    const totalHierarchyColumns =
        (selectedCourse?.courseHierarchy.includes("Module") &&
            exportSelections.hierarchy.module
            ? 1
            : 0) +
        (selectedCourse?.courseHierarchy.includes("Sub Module") &&
            exportSelections.hierarchy.subModule
            ? 1
            : 0) +
        (selectedCourse?.courseHierarchy.includes("Topic") &&
            exportSelections.hierarchy.topic
            ? 1
            : 0) +
        (selectedCourse?.courseHierarchy.includes("Sub Topic") &&
            exportSelections.hierarchy.subTopic
            ? 1
            : 0) +
        (exportSelections.hierarchy.level ? 1 : 0);

    return (
        <div className="overflow-x-auto">
            {showTeachingElements ||
                totalHierarchyColumns ||
                exportSelections.showSummary > 0 ? (
                <Table className="border-separate  border-spacing-0  w-full text-[8px]">
                    <TableHeader>
                        <TableRow className="bg-[#FFE4D0]">
                            {/* Dynamic hierarchy columns */}
                            {exportSelections.hierarchy.module &&
                                selectedCourse?.courseHierarchy.includes("Module") && (
                                    <TableHead
                                        className="border border-gray-400 text-center font-bold p-0.5 sticky bg-[#FFE4D0] z-10 min-w-[80px]"
                                        style={{ left: `${stickyPositions["module"]}px` }}
                                        rowSpan={3}
                                    >
                                        Module
                                    </TableHead>
                                )}
                            {exportSelections.hierarchy.subModule &&
                                selectedCourse?.courseHierarchy.includes("Sub Module") && (
                                    <TableHead
                                        className="border border-gray-400 text-center font-bold p-0.5  bg-[#FFE4D0] z-10 min-w-[80px]"
                                        style={{ left: `${stickyPositions["subModule"]}px` }}
                                        rowSpan={3}
                                    >
                                        Sub Module
                                    </TableHead>
                                )}
                            {exportSelections.hierarchy.topic &&
                                selectedCourse?.courseHierarchy.includes("Topic") && (
                                    <TableHead
                                        className="border border-gray-400 text-center font-bold p-0.5  bg-[#FFE4D0] z-10 min-w-[80px]"
                                        style={{ left: `${stickyPositions["topic"]}px` }}
                                        rowSpan={3}
                                    >
                                        Topic
                                    </TableHead>
                                )}
                            {exportSelections.hierarchy.subTopic &&
                                selectedCourse?.courseHierarchy.includes("Sub Topic") && (
                                    <TableHead
                                        className="border border-gray-400 text-center font-bold p-0.5  bg-[#FFE4D0] z-10 min-w-[80px]"
                                        style={{ left: `${stickyPositions["subTopic"]}px` }}
                                        rowSpan={3}
                                    >
                                        Sub Topic
                                    </TableHead>
                                )}
                            {exportSelections.hierarchy.level && (
                                <TableHead
                                    className="border border-gray-400 text-center font-bold p-0.5  bg-[#FFE4D0] z-10 min-w-[60px]"
                                    style={{ left: `${stickyPositions["level"]}px` }}
                                    rowSpan={3}
                                >
                                    Level
                                </TableHead>
                            )}

                            {/* Teaching Learning Elements header - only shown if any activities exist and are selected */}
                            {showTeachingElements && (
                                <TableHead
                                    className="border border-gray-400 text-center bg-[#FFE4D0] font-bold p-0.5"
                                    style={{ width: "40%" }}
                                    colSpan={totalSelectedActivities}
                                >
                                    {visibleCategoryCount === 3
                                        ? "All Teaching Elements"
                                        : [
                                            hasSelectedActivities("iDo")
                                                ? "I Do Activities"
                                                : null,
                                            hasSelectedActivities("weDo")
                                                ? "We Do Activities"
                                                : null,
                                            hasSelectedActivities("youDo")
                                                ? "You Do Activities"
                                                : null,
                                        ]
                                            .filter(Boolean)
                                            .join(" + ")}
                                </TableHead>
                            )}

                            {exportSelections.includeTotalHours && (
                                <TableHead
                                    className="border border-gray-400 text-center bg-[#FFE4D0] font-bold p-0.5"
                                    style={{ width: "10%" }}
                                    rowSpan={exportSelections.hierarchy.level ? 3 : 3}
                                >
                                    Total Hours
                                </TableHead>
                            )}
                        </TableRow>

                        {/* Activity Type Headers - only shown if multiple types are selected and have activities */}
                        {showTeachingElements && visibleCategoryCount > 1 && (
                            <TableRow className="bg-gray-100">
                                {hasSelectedActivities("iDo") && (
                                    <TableHead
                                        colSpan={selectedIDoActivities.length}
                                        className="border border-gray-400 text-center font-medium text-[9px] p-0.5 bg-yellow-100"
                                    >
                                        I Do Activities
                                    </TableHead>
                                )}
                                {hasSelectedActivities("weDo") && (
                                    <TableHead
                                        colSpan={selectedWeDoActivities.length}
                                        className="border border-gray-400 text-center font-medium text-[9px] p-0.5 bg-orange-100"
                                    >
                                        We Do Activities
                                    </TableHead>
                                )}
                                {hasSelectedActivities("youDo") && (
                                    <TableHead
                                        colSpan={selectedYouDoActivities.length}
                                        className="border border-gray-400 text-center font-medium text-[9px] p-0.5 bg-green-100"
                                    >
                                        You Do Activities
                                    </TableHead>
                                )}
                            </TableRow>
                        )}

                        {/* Activity Names - only shown if teaching elements are selected */}
                        {showTeachingElements &&
                            exportSelections.hoursOption !== "activity" && (
                                <TableRow className="bg-gray-100">
                                    {selectedIDoActivities.map((activity) => (
                                        <TableHead
                                            key={`iDo-${activity}`}
                                            className="border border-gray-400 text-center font-medium p-0.5 bg-yellow-100 min-w-[50px]"
                                            title={activity}
                                            style={{ width: `${40 / totalSelectedActivities}%` }}
                                        >
                                            <span className="truncate block">{activity}</span>
                                        </TableHead>
                                    ))}
                                    {selectedWeDoActivities.map((activity) => (
                                        <TableHead
                                            key={`weDo-${activity}`}
                                            className="border border-gray-400 text-center font-medium p-0.5 bg-orange-100 min-w-[50px]"
                                            title={activity}
                                            style={{ width: `${40 / totalSelectedActivities}%` }}
                                        >
                                            <span className="truncate block">{activity}</span>
                                        </TableHead>
                                    ))}
                                    {selectedYouDoActivities.map((activity) => (
                                        <TableHead
                                            key={`youDo-${activity}`}
                                            className="border border-gray-400 text-center font-medium p-0.5 bg-green-100 min-w-[50px]"
                                            title={activity}
                                            style={{ width: `${40 / totalSelectedActivities}%` }}
                                        >
                                            <span className="truncate block">{activity}</span>
                                        </TableHead>
                                    ))}
                                </TableRow>
                            )}
                    </TableHeader>

                    <TableBody>
                        {(() => {
                            const moduleRowTracker: { [key: string]: boolean } = {};
                            const subModuleRowTracker: { [key: string]: boolean } = {};
                            const topicRowTracker: { [key: string]: boolean } = {};
                            const subtopicRowTracker: { [key: string]: boolean } = {};

                            return tableRows.map((row, index) => {
                                const isFirstSubtopicInModule =
                                    !moduleRowTracker[row.moduleId];
                                const isFirstSubtopicInSubModule =
                                    !subModuleRowTracker[row.subModuleId];
                                const isFirstSubtopicInTopic = !topicRowTracker[row.topicId];
                                const isFirstSubtopicInSubtopic =
                                    !subtopicRowTracker[row.subtopicId];

                                if (isFirstSubtopicInModule)
                                    moduleRowTracker[row.moduleId] = true;
                                if (isFirstSubtopicInSubModule)
                                    subModuleRowTracker[row.subModuleId] = true;
                                if (isFirstSubtopicInTopic)
                                    topicRowTracker[row.topicId] = true;
                                if (isFirstSubtopicInSubtopic)
                                    subtopicRowTracker[row.subtopicId] = true;

                                return (
                                    <TableRow
                                        key={`preview-${row.rowId}`}
                                        className="hover:bg-gray-50 h-6 z-0"
                                    >
                                        {/* Module Cell */}
                                        {exportSelections.hierarchy.module &&
                                            selectedCourse?.courseHierarchy.includes("Module") &&
                                            isFirstSubtopicInModule && (
                                                <TableCell
                                                    rowSpan={moduleSpans[row.moduleId]}
                                                    className={`border border-gray-400 text-left text-[9px] font-medium p-0.5 bg-[#FFF3EA] text-center align-middle max-w-[80px] h-6 sticky`}
                                                    style={{ left: `${stickyPositions["module"]}px` }}
                                                >
                                                    <span
                                                        className="whitespace-normal break-words px-4 text-center flex-1"
                                                        title={
                                                            row.moduleName === "Default Module"
                                                                ? "-"
                                                                : row.moduleName
                                                        }
                                                    >
                                                        {row.moduleName === "Default Module"
                                                            ? "-"
                                                            : row.moduleName}
                                                    </span>
                                                </TableCell>
                                            )}

                                        {/* SubModule Cell */}
                                        {exportSelections.hierarchy.subModule &&
                                            selectedCourse?.courseHierarchy.includes(
                                                "Sub Module"
                                            ) &&
                                            isFirstSubtopicInSubModule && (
                                                <TableCell
                                                    rowSpan={subModuleSpans[row.subModuleId]}
                                                    className={`border border-gray-400 text-left p-0.5 bg-[#FFF3EA] text-[9px] font-medium text-center align-middle max-w-[80px] h-6  `}
                                                    style={{
                                                        left: `${stickyPositions["subModule"]}px`,
                                                    }}
                                                >
                                                    <span
                                                        className="whitespace-nowrap overflow-hidden text-ellipsis block px-1"
                                                        title={
                                                            row.subModuleName === "Default Submodule"
                                                                ? "-"
                                                                : row.subModuleName
                                                        }
                                                    >
                                                        {row.subModuleName === "Default Submodule"
                                                            ? "-"
                                                            : row.subModuleName}
                                                    </span>
                                                </TableCell>
                                            )}

                                        {/* Topic Cell */}
                                        {exportSelections.hierarchy.topic &&
                                            selectedCourse?.courseHierarchy.includes("Topic") &&
                                            isFirstSubtopicInTopic && (
                                                <TableCell
                                                    rowSpan={topicSpans[row.topicId]}
                                                    className={`border border-gray-400 text-left p-0.5 bg-[#FFF3EA] text-[9px] font-medium text-center align-middle max-w-[80px] h-6  `}
                                                    style={{ left: `${stickyPositions["topic"]}px` }}
                                                >
                                                    <span
                                                        className="whitespace-nowrap overflow-hidden text-ellipsis block px-1"
                                                        title={
                                                            row.topicName === "Default Topic"
                                                                ? "-"
                                                                : row.topicName
                                                        }
                                                    >
                                                        {row.topicName === "Default Topic"
                                                            ? "-"
                                                            : row.topicName}
                                                    </span>
                                                </TableCell>
                                            )}

                                        {/* Subtopic Cell */}
                                        {exportSelections.hierarchy.subTopic &&
                                            selectedCourse?.courseHierarchy.includes(
                                                "Sub Topic"
                                            ) && (
                                                <TableCell
                                                    className={`border border-gray-400 text-left p-0.5 bg-[#FFF3EA] text-[9px] font-medium text-center align-middle max-w-[80px] h-6 `}
                                                    style={{ left: `${stickyPositions["subTopic"]}px` }}
                                                >
                                                    <span
                                                        className="whitespace-nowrap overflow-hidden text-ellipsis block px-1"
                                                        title={
                                                            row.subtopicName === "Default Subtopic"
                                                                ? "-"
                                                                : row.subtopicName
                                                        }
                                                    >
                                                        {row.subtopicName === "Default Subtopic"
                                                            ? "-"
                                                            : row.subtopicName}
                                                    </span>
                                                </TableCell>
                                            )}

                                        {/* Learning Level Cell */}
                                        {exportSelections.hierarchy.level && (
                                            <>{renderPreviewLevelCell(row, index)}</>
                                        )}

                                        {/* Activity Hours */}
                                        {showTeachingElements &&
                                            exportSelections.hoursOption !== "element" &&
                                            exportSelections.hoursOption !== "activity" && (
                                                <>
                                                    {selectedIDoActivities.map((activity) => {
                                                        const mergeInfo = isCellMerged(
                                                            index,
                                                            "iDo",
                                                            activity
                                                        );
                                                        if (mergeInfo.isMerged && !mergeInfo.isStart)
                                                            return null;
                                                        return renderActivityCell(
                                                            "iDo",
                                                            activity,
                                                            row,
                                                            index,
                                                            mergeInfo,
                                                            true
                                                        );
                                                    })}
                                                    {selectedWeDoActivities.map((activity) => {
                                                        const mergeInfo = isCellMerged(
                                                            index,
                                                            "weDo",
                                                            activity
                                                        );
                                                        if (mergeInfo.isMerged && !mergeInfo.isStart)
                                                            return null;
                                                        return renderActivityCell(
                                                            "weDo",
                                                            activity,
                                                            row,
                                                            index,
                                                            mergeInfo,
                                                            true
                                                        );
                                                    })}
                                                    {selectedYouDoActivities.map((activity) => {
                                                        const mergeInfo = isCellMerged(
                                                            index,
                                                            "youDo",
                                                            activity
                                                        );
                                                        if (mergeInfo.isMerged && !mergeInfo.isStart)
                                                            return null;
                                                        return renderActivityCell(
                                                            "youDo",
                                                            activity,
                                                            row,
                                                            index,
                                                            mergeInfo,
                                                            true
                                                        );
                                                    })}
                                                </>
                                            )}

                                        {/* Activity Hours */}
                                        {showTeachingElements &&
                                            exportSelections.hoursOption === "element" &&
                                            isFirstInMergedGroup(row, index) && (
                                                <>
                                                    {/* Individual I Do Activities with hierarchy merging */}
                                                    {selectedIDoActivities.map((activity) => (
                                                        <TableCell
                                                            key={`element-ido-${activity}-${row.rowId}`}
                                                            className="border border-gray-400 text-center p-0.5 bg-yellow-100 min-w-[50px] h-6"
                                                            rowSpan={getTotalRowSpan(row)}
                                                        >
                                                            {getMergedActivityValue(row, "iDo", activity)}
                                                        </TableCell>
                                                    ))}

                                                    {/* Individual We Do Activities with hierarchy merging */}
                                                    {selectedWeDoActivities.map((activity) => (
                                                        <TableCell
                                                            key={`element-wedo-${activity}-${row.rowId}`}
                                                            className="border border-gray-400 text-center p-0.5 bg-orange-100 min-w-[50px] h-6"
                                                            rowSpan={getTotalRowSpan(row)}
                                                        >
                                                            {getMergedActivityValue(row, "weDo", activity)}
                                                        </TableCell>
                                                    ))}

                                                    {/* Individual You Do Activities with hierarchy merging */}
                                                    {selectedYouDoActivities.map((activity) => (
                                                        <TableCell
                                                            key={`element-youdo-${activity}-${row.rowId}`}
                                                            className="border border-gray-400 text-center p-0.5 bg-green-100 min-w-[50px] h-6"
                                                            rowSpan={getTotalRowSpan(row)}
                                                        >
                                                            {getMergedActivityValue(row, "youDo", activity)}
                                                        </TableCell>
                                                    ))}
                                                </>
                                            )}

                                        {/* Activity Hours Totals (Category view) */}
                                        {showTeachingElements &&
                                            exportSelections.hoursOption === "activity" &&
                                            isFirstInMergedGroup(row, index) && (
                                                <>
                                                    {/* I Do Total */}
                                                    {hasSelectedActivities("iDo") && (
                                                        <TableCell
                                                            className="border border-gray-400 text-center font-bold p-0.5 bg-yellow-100 min-w-[50px] h-6"
                                                            rowSpan={getTotalRowSpan(row)}
                                                            colSpan={selectedIDoActivities.length}
                                                        >
                                                            {selectedIDoActivities.reduce(
                                                                (sum, activity) =>
                                                                    sum +
                                                                    getMergedActivityValue(
                                                                        row,
                                                                        "iDo",
                                                                        activity
                                                                    ),
                                                                0
                                                            )}
                                                        </TableCell>
                                                    )}

                                                    {/* We Do Total */}
                                                    {hasSelectedActivities("weDo") && (
                                                        <TableCell
                                                            className="border border-gray-400 text-center font-bold p-0.5 bg-orange-100 min-w-[50px] h-6"
                                                            rowSpan={getTotalRowSpan(row)}
                                                            colSpan={selectedWeDoActivities.length}
                                                        >
                                                            {selectedWeDoActivities.reduce(
                                                                (sum, activity) =>
                                                                    sum +
                                                                    getMergedActivityValue(
                                                                        row,
                                                                        "weDo",
                                                                        activity
                                                                    ),
                                                                0
                                                            )}
                                                        </TableCell>
                                                    )}

                                                    {/* You Do Total */}
                                                    {hasSelectedActivities("youDo") && (
                                                        <TableCell
                                                            className="border border-gray-400 text-center font-bold p-0.5 bg-green-100 min-w-[50px] h-6"
                                                            rowSpan={getTotalRowSpan(row)}
                                                            colSpan={selectedYouDoActivities.length}
                                                        >
                                                            {selectedYouDoActivities.reduce(
                                                                (sum, activity) =>
                                                                    sum +
                                                                    getMergedActivityValue(
                                                                        row,
                                                                        "youDo",
                                                                        activity
                                                                    ),
                                                                0
                                                            )}
                                                        </TableCell>
                                                    )}
                                                </>
                                            )}

                                        {/* // In the table row rendering, after the activity cells, add: */}
                                        {exportSelections.includeTotalHours &&
                                            (isFirstInMergedGroup(row, index) ? (
                                                <TableCell
                                                    className="border border-gray-400 text-center font-bold p-0.5 bg-gray-100 min-w-[50px] h-6"
                                                    rowSpan={getTotalRowSpan(row)}
                                                >
                                                    {getMergedTotalValue(row)}
                                                </TableCell>
                                            ) : null)}
                                    </TableRow>
                                );
                            });
                        })()}

                        {/* Total Hours Row */}
                        {(exportSelections.includeTotalHours || showTeachingElements) && (
                            <TableRow className="bg-gray-200 font-bold">
                                {(() => {
                                    const totalHierarchyCols =
                                        (selectedCourse?.courseHierarchy.includes("Module") &&
                                            exportSelections.hierarchy.module
                                            ? 1
                                            : 0) +
                                        (selectedCourse?.courseHierarchy.includes("Sub Module") &&
                                            exportSelections.hierarchy.subModule
                                            ? 1
                                            : 0) +
                                        (selectedCourse?.courseHierarchy.includes("Topic") &&
                                            exportSelections.hierarchy.topic
                                            ? 1
                                            : 0) +
                                        (selectedCourse?.courseHierarchy.includes("Sub Topic") &&
                                            exportSelections.hierarchy.subTopic
                                            ? 1
                                            : 0) +
                                        (exportSelections.hierarchy.level ? 1 : 0);

                                    return totalHierarchyCols > 0 ? (
                                        <TableCell
                                            className={`border border-gray-400 text-center p-0.5 bg-gray-200 sticky z-10`}
                                            style={{ left: "0px" }}
                                            colSpan={totalHierarchyCols}
                                        >
                                            Total Hours
                                        </TableCell>
                                    ) : null;
                                })()}

                                {exportSelections.hoursOption === "element" ? (
                                    <>
                                        {selectedIDoActivities.map((activity) => (
                                            <TableCell
                                                key={`preview-total-iDo-${activity}`}
                                                className="border border-gray-400 text-center font-bold p-0.5 bg-yellow-100 min-w-[50px] h-6"
                                            >
                                                {calculateTotalHours("iDo", activity) || "0"}
                                            </TableCell>
                                        ))}
                                        {selectedWeDoActivities.map((activity) => (
                                            <TableCell
                                                key={`preview-total-weDo-${activity}`}
                                                className="border border-gray-400 text-center font-bold p-0.5 bg-orange-100 min-w-[50px] h-6"
                                            >
                                                {calculateTotalHours("weDo", activity) || "0"}
                                            </TableCell>
                                        ))}
                                        {selectedYouDoActivities.map((activity) => (
                                            <TableCell
                                                key={`preview-total-youDo-${activity}`}
                                                className="border border-gray-400 text-center font-bold p-0.5 bg-green-100 min-w-[50px] h-6"
                                            >
                                                {calculateTotalHours("youDo", activity) || "0"}
                                            </TableCell>
                                        ))}
                                    </>
                                ) : exportSelections.hoursOption === "activity" ? (
                                    <>
                                        {hasSelectedActivities("iDo") && (
                                            <TableCell
                                                className="border border-gray-400 text-center font-bold p-0.5 bg-yellow-100 min-w-[50px] h-6"
                                                colSpan={selectedIDoActivities.length}
                                            >
                                                {selectedIDoActivities.reduce(
                                                    (sum, activity) =>
                                                        sum + calculateTotalHours("iDo", activity),
                                                    0
                                                )}
                                            </TableCell>
                                        )}
                                        {hasSelectedActivities("weDo") && (
                                            <TableCell
                                                className="border border-gray-400 text-center font-bold p-0.5 bg-orange-100 min-w-[50px] h-6"
                                                colSpan={selectedWeDoActivities.length}
                                            >
                                                {selectedWeDoActivities.reduce(
                                                    (sum, activity) =>
                                                        sum + calculateTotalHours("weDo", activity),
                                                    0
                                                )}
                                            </TableCell>
                                        )}
                                        {hasSelectedActivities("youDo") && (
                                            <TableCell
                                                className="border border-gray-400 text-center font-bold p-0.5 bg-green-100 min-w-[50px] h-6"
                                                colSpan={selectedYouDoActivities.length}
                                            >
                                                {selectedYouDoActivities.reduce(
                                                    (sum, activity) =>
                                                        sum + calculateTotalHours("youDo", activity),
                                                    0
                                                )}
                                            </TableCell>
                                        )}
                                    </>
                                ) : (
                                    // )}
                                    // Case 3: default - one total for everything
                                    <>
                                        {selectedIDoActivities.map((activity) => (
                                            <TableCell
                                                key={`preview-total-iDo-${activity}`}
                                                className="border border-gray-400 text-center font-bold p-0.5 bg-yellow-100 min-w-[50px] h-6"
                                            >
                                                {calculateTotalHours("iDo", activity) || "0"}
                                            </TableCell>
                                        ))}
                                        {selectedWeDoActivities.map((activity) => (
                                            <TableCell
                                                key={`preview-total-weDo-${activity}`}
                                                className="border border-gray-400 text-center font-bold p-0.5 bg-orange-100 min-w-[50px] h-6"
                                            >
                                                {calculateTotalHours("weDo", activity) || "0"}
                                            </TableCell>
                                        ))}
                                        {selectedYouDoActivities.map((activity) => (
                                            <TableCell
                                                key={`preview-total-youDo-${activity}`}
                                                className="border border-gray-400 text-center font-bold p-0.5 bg-green-100 min-w-[50px] h-6"
                                            >
                                                {calculateTotalHours("youDo", activity) || "0"}
                                            </TableCell>
                                        ))}
                                    </>
                                )}

                                {((exportSelections.includeTotalHours &&
                                    showTeachingElements) ||
                                    exportSelections.includeTotalHours) && (
                                        <TableCell className="border border-gray-400 text-center font-bold p-0.5 bg-gray-100 min-w-[50px] h-6">
                                            {(() => {
                                                let grandTotal = 0;

                                                const calculateTypeTotal = (
                                                    type: "iDo" | "weDo" | "youDo",
                                                    activities: string[]
                                                ) => {
                                                    return activities.reduce((total, activity) => {
                                                        return (
                                                            total + (calculateTotalHours(type, activity) || 0)
                                                        );
                                                    }, 0);
                                                };

                                                grandTotal += calculateTypeTotal(
                                                    "iDo",
                                                    activityTypes.iDo || []
                                                );
                                                grandTotal += calculateTypeTotal(
                                                    "weDo",
                                                    activityTypes.weDo || []
                                                );
                                                grandTotal += calculateTypeTotal(
                                                    "youDo",
                                                    activityTypes.youDo || []
                                                );

                                                return grandTotal;
                                            })()}
                                        </TableCell>
                                    )}
                            </TableRow>
                        )}
                        {/* Summary Section */}
                        {exportSelections.showSummary &&
                            isPrinting &&
                            (summaryActivities.iDo.length > 0 ||
                                summaryActivities.weDo.length > 0 ||
                                summaryActivities.youDo.length > 0) && (
                                <TableRow>
                                    <TableCell
                                        colSpan={totalHierarchyColumns + totalSelectedActivities}
                                        className="p-2 bg-gray-50"
                                    >
                                        <div className="text-xs font-semibold text-center mb-2">
                                            Teaching Elements Summary
                                        </div>

                                        <div className="flex justify-center">
                                            <table className="w-full max-w-2xl border-collapse">
                                                <thead>
                                                    <tr>
                                                        <th className="border border-gray-300 bg-[#F97316] text-white p-1 text-xs">
                                                            Activity Type
                                                        </th>
                                                        <th className="border border-gray-300 bg-[#F97316] text-white p-1 text-xs">
                                                            Elements
                                                        </th>
                                                        <th className="border border-gray-300 bg-[#F97316] text-white p-1 text-xs">
                                                            Elements Total Hours
                                                        </th>
                                                        {exportSelections.summaryIncludeTotalHours && (
                                                            <th className="border border-gray-300 bg-[#F97316] text-white p-1 text-xs">
                                                                Activity Total Hours
                                                            </th>
                                                        )}

                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {/* I Do Summary */}
                                                    {summaryActivities.iDo.length > 0 &&
                                                        summaryActivities.iDo.map(
                                                            (
                                                                activity:
                                                                    | string
                                                                    | number
                                                                    | bigint
                                                                    | boolean
                                                                    | React.ReactElement<
                                                                        unknown,
                                                                        | string
                                                                        | React.JSXElementConstructor<any>
                                                                    >
                                                                    | Iterable<React.ReactNode>
                                                                    | Promise<
                                                                        | string
                                                                        | number
                                                                        | bigint
                                                                        | boolean
                                                                        | React.ReactPortal
                                                                        | React.ReactElement<
                                                                            unknown,
                                                                            | string
                                                                            | React.JSXElementConstructor<any>
                                                                        >
                                                                        | Iterable<React.ReactNode>
                                                                        | null
                                                                        | undefined
                                                                    >
                                                                    | null
                                                                    | undefined,
                                                                index: number
                                                            ) => (
                                                                <tr
                                                                    key={`summary-ido-${activity}`}
                                                                    className={
                                                                        index % 2 === 0
                                                                            ? "bg-yellow-50"
                                                                            : "bg-yellow-100"
                                                                    }
                                                                >
                                                                    {index === 0 && (
                                                                        <td
                                                                            rowSpan={summaryActivities.iDo.length}
                                                                            className="border border-gray-300 p-1 text-xs font-medium text-center align-middle bg-yellow-200"
                                                                        >
                                                                            I Do Activities
                                                                        </td>
                                                                    )}
                                                                    <td className="border border-gray-300 p-1 text-xs">
                                                                        {activity}
                                                                    </td>
                                                                    <td className="border border-gray-300 p-1 text-xs text-center">
                                                                        {calculateTotalHours(
                                                                            "iDo",
                                                                            String(activity)
                                                                        )}
                                                                    </td>
                                                                    {exportSelections.summaryIncludeTotalHours && index === 0 && (
                                                                        <td
                                                                            rowSpan={summaryActivities.iDo.length}
                                                                            className="border border-gray-300 p-1 text-xs text-center font-bold bg-yellow-200"
                                                                        >
                                                                            {summaryActivities.iDo.reduce(
                                                                                (sum: number, act: string) =>
                                                                                    sum + calculateTotalHours("iDo", act),
                                                                                0
                                                                            )}
                                                                        </td>
                                                                    )}
                                                                </tr>
                                                            )
                                                        )}

                                                    {/* We Do Summary */}
                                                    {summaryActivities.weDo.length > 0 &&
                                                        summaryActivities.weDo.map(
                                                            (
                                                                activity:
                                                                    | string
                                                                    | number
                                                                    | bigint
                                                                    | boolean
                                                                    | React.ReactElement<
                                                                        unknown,
                                                                        | string
                                                                        | React.JSXElementConstructor<any>
                                                                    >
                                                                    | Iterable<React.ReactNode>
                                                                    | Promise<
                                                                        | string
                                                                        | number
                                                                        | bigint
                                                                        | boolean
                                                                        | React.ReactPortal
                                                                        | React.ReactElement<
                                                                            unknown,
                                                                            | string
                                                                            | React.JSXElementConstructor<any>
                                                                        >
                                                                        | Iterable<React.ReactNode>
                                                                        | null
                                                                        | undefined
                                                                    >
                                                                    | null
                                                                    | undefined,
                                                                index: number
                                                            ) => (
                                                                <tr
                                                                    key={`summary-wedo-${activity}`}
                                                                    className={
                                                                        index % 2 === 0
                                                                            ? "bg-orange-50"
                                                                            : "bg-orange-100"
                                                                    }
                                                                >
                                                                    {index === 0 && (
                                                                        <td
                                                                            rowSpan={summaryActivities.weDo.length}
                                                                            className="border border-gray-300 p-1 text-xs font-medium text-center align-middle bg-orange-200"
                                                                        >
                                                                            We Do Activities
                                                                        </td>
                                                                    )}
                                                                    <td className="border border-gray-300 p-1 text-xs">
                                                                        {activity}
                                                                    </td>
                                                                    <td className="border border-gray-300 p-1 text-xs text-center">
                                                                        {calculateTotalHours(
                                                                            "weDo",
                                                                            String(activity)
                                                                        )}
                                                                    </td>
                                                                    {exportSelections.summaryIncludeTotalHours && index === 0 && (
                                                                        <td
                                                                            rowSpan={summaryActivities.weDo.length}
                                                                            className="border border-gray-300 p-1 text-xs text-center font-bold bg-orange-200"
                                                                        >
                                                                            {summaryActivities.weDo.reduce(
                                                                                (sum: number, act: string) =>
                                                                                    sum + calculateTotalHours("weDo", act),
                                                                                0
                                                                            )}
                                                                        </td>
                                                                    )}
                                                                </tr>
                                                            )
                                                        )}

                                                    {/* You Do Summary */}
                                                    {summaryActivities.youDo.length > 0 &&
                                                        summaryActivities.youDo.map(
                                                            (
                                                                activity:
                                                                    | string
                                                                    | number
                                                                    | bigint
                                                                    | boolean
                                                                    | React.ReactElement<
                                                                        unknown,
                                                                        | string
                                                                        | React.JSXElementConstructor<any>
                                                                    >
                                                                    | Iterable<React.ReactNode>
                                                                    | Promise<
                                                                        | string
                                                                        | number
                                                                        | bigint
                                                                        | boolean
                                                                        | React.ReactPortal
                                                                        | React.ReactElement<
                                                                            unknown,
                                                                            | string
                                                                            | React.JSXElementConstructor<any>
                                                                        >
                                                                        | Iterable<React.ReactNode>
                                                                        | null
                                                                        | undefined
                                                                    >
                                                                    | null
                                                                    | undefined,
                                                                index: number
                                                            ) => (
                                                                <tr
                                                                    key={`summary-youdo-${activity}`}
                                                                    className={
                                                                        index % 2 === 0
                                                                            ? "bg-green-50"
                                                                            : "bg-green-100"
                                                                    }
                                                                >
                                                                    {index === 0 && (
                                                                        <td
                                                                            rowSpan={summaryActivities.youDo.length}
                                                                            className="border border-gray-300 p-1 text-xs font-medium text-center align-middle bg-green-200"
                                                                        >
                                                                            You Do Activities
                                                                        </td>
                                                                    )}
                                                                    <td className="border border-gray-300 p-1 text-xs">
                                                                        {activity}
                                                                    </td>
                                                                    <td className="border border-gray-300 p-1 text-xs text-center">
                                                                        {calculateTotalHours(
                                                                            "youDo",
                                                                            String(activity)
                                                                        )}
                                                                    </td>
                                                                    {exportSelections.summaryIncludeTotalHours && index === 0 && (
                                                                        <td
                                                                            rowSpan={summaryActivities.youDo.length}
                                                                            className="border border-gray-300 p-1 text-xs text-center font-bold bg-green-200"
                                                                        >
                                                                            {summaryActivities.youDo.reduce(
                                                                                (sum: number, act: string) =>
                                                                                    sum + calculateTotalHours("youDo", act),
                                                                                0
                                                                            )}
                                                                        </td>
                                                                    )}
                                                                </tr>
                                                            )
                                                        )}

                                                    {/* Grand Total */}
                                                    <tr className="bg-[#FFE4D0] font-bold">
                                                        <td
                                                            colSpan={2}
                                                            className="border border-gray-300 p-1 text-xs text-right"
                                                        >
                                                            Total Hours
                                                        </td>
                                                        <td className="border border-gray-300 p-1 text-xs text-center">
                                                            {Object.entries(summaryActivities).reduce(
                                                                (sum, [type, activities]) => {
                                                                    return (
                                                                        sum +
                                                                        activities.reduce(
                                                                            (typeSum: number, activity: string) => {
                                                                                return (
                                                                                    typeSum +
                                                                                    calculateTotalHours(
                                                                                        type as "iDo" | "weDo" | "youDo",
                                                                                        String(activity)
                                                                                    )
                                                                                );
                                                                            },
                                                                            0
                                                                        )
                                                                    );
                                                                },
                                                                0
                                                            )}
                                                        </td>
                                                        {exportSelections.summaryIncludeTotalHours && (
                                                            <td className="border border-gray-300 p-1 text-xs text-center">
                                                                {Object.entries(summaryActivities).reduce(
                                                                    (sum, [type, activities]) => {
                                                                        return (
                                                                            sum +
                                                                            activities.reduce(
                                                                                (typeSum: number, activity: string) => {
                                                                                    return (
                                                                                        typeSum +
                                                                                        calculateTotalHours(
                                                                                            type as "iDo" | "weDo" | "youDo",
                                                                                            String(activity)
                                                                                        )
                                                                                    );
                                                                                },
                                                                                0
                                                                            )
                                                                        );
                                                                    },
                                                                    0
                                                                )}
                                                            </td>
                                                        )}
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                    </TableBody>
                </Table>
            ) : (
                // Show message when nothing is selected
                <div className="flex items-center justify-center p-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    <div className="text-center">
                        <div className="mx-auto h-12 w-12 text-gray-400">
                            <FileText className="h-12 w-12" />
                        </div>
                        <h3 className="mt-2 text-sm font-medium text-gray-900">
                            Nothing to display
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">
                            Please select at least one hierarchy column or teaching element
                            to see the preview.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
