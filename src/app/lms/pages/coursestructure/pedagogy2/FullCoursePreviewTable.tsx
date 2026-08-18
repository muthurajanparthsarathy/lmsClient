"use client"

// The full-course preview table. Moved verbatim out of page.tsx during the
// split: it is fully prop-driven (no closed-over state), so this is a pure
// relocation with the same inline prop shape it always had.

import React from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { Course } from "./types"

export default function FullCoursePreviewTable({
    tableRows,
    selectedCourse,
    moduleSpans,
    subModuleSpans,
    topicSpans,
    subtopicSpans,
}: {
    tableRows: any[];
    selectedCourse: Course | null;
    moduleSpans: { [key: string]: number };
    subModuleSpans: { [key: string]: number };
    topicSpans: { [key: string]: number };
    subtopicSpans: { [key: string]: number };
}) {
    const getStickyLeftPositions = () => {
        const positions: { [key: string]: number } = {};
        let currentLeft = 0;

        // Show ALL hierarchy levels from the course
        if (selectedCourse?.courseHierarchy.includes('Module')) {
            positions['module'] = currentLeft;
            currentLeft += 80;
        }

        if (selectedCourse?.courseHierarchy.includes('Sub Module')) {
            positions['subModule'] = currentLeft;
            currentLeft += 80;
        }

        if (selectedCourse?.courseHierarchy.includes('Topic')) {
            positions['topic'] = currentLeft;
            currentLeft += 80;
        }

        if (selectedCourse?.courseHierarchy.includes('Sub Topic')) {
            positions['subTopic'] = currentLeft;
            currentLeft += 80;
        }

        return positions;
    };

    const stickyPositions = getStickyLeftPositions();

    return (
        <div className="overflow-x-auto">
            <Table className="border-separate border-spacing-0 w-full text-[8px]">
                <TableHeader>
                    <TableRow className="bg-[#FFE4D0]">
                        {/* Show ALL hierarchy columns without checkboxes */}
                        {selectedCourse?.courseHierarchy.includes('Module') && (
                            <TableHead
                                className="border border-gray-400 text-center font-bold p-0.5 sticky bg-[#FFE4D0] z-10 min-w-[80px]"
                                style={{ left: `${stickyPositions['module']}px` }}
                            >
                                Module
                            </TableHead>
                        )}
                        {selectedCourse?.courseHierarchy.includes('Sub Module') && (
                            <TableHead
                                className="border border-gray-400 text-center font-bold p-0.5 sticky bg-[#FFE4D0] z-10 min-w-[80px]"
                                style={{ left: `${stickyPositions['subModule']}px` }}
                            >
                                Sub Module
                            </TableHead>
                        )}
                        {selectedCourse?.courseHierarchy.includes('Topic') && (
                            <TableHead
                                className="border border-gray-400 text-center font-bold p-0.5 sticky bg-[#FFE4D0] z-10 min-w-[80px]"
                                style={{ left: `${stickyPositions['topic']}px` }}
                            >
                                Topic
                            </TableHead>
                        )}
                        {selectedCourse?.courseHierarchy.includes('Sub Topic') && (
                            <TableHead
                                className="border border-gray-400 text-center font-bold p-0.5 sticky bg-[#FFE4D0] z-10 min-w-[80px]"
                                style={{ left: `${stickyPositions['subTopic']}px` }}
                            >
                                Sub Topic
                            </TableHead>
                        )}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {(() => {
                        const moduleRowTracker: { [key: string]: boolean } = {};
                        const subModuleRowTracker: { [key: string]: boolean } = {};
                        const topicRowTracker: { [key: string]: boolean } = {};
                        const subtopicRowTracker: { [key: string]: boolean } = {};

                        return tableRows.map((row, index) => {
                            const isFirstSubtopicInModule = !moduleRowTracker[row.moduleId];
                            const isFirstSubtopicInSubModule = !subModuleRowTracker[row.subModuleId];
                            const isFirstSubtopicInTopic = !topicRowTracker[row.topicId];
                            const isFirstSubtopicInSubtopic = !subtopicRowTracker[row.subtopicId];

                            if (isFirstSubtopicInModule) moduleRowTracker[row.moduleId] = true;
                            if (isFirstSubtopicInSubModule) subModuleRowTracker[row.subModuleId] = true;
                            if (isFirstSubtopicInTopic) topicRowTracker[row.topicId] = true;
                            if (isFirstSubtopicInSubtopic) subtopicRowTracker[row.subtopicId] = true;

                            return (
                                <TableRow
                                    key={`preview-${row.rowId}`}
                                    className={`hover:bg-gray-50 h-6`}
                                >
                                    {/* Module Cell - Show for all modules */}
                                    {selectedCourse?.courseHierarchy.includes('Module') && isFirstSubtopicInModule && (
                                        <TableCell
                                            rowSpan={moduleSpans[row.moduleId]}
                                            className="border border-gray-400 text-left text-[9px] font-medium p-0.5 bg-[#FFF3EA] text-center align-middle max-w-[80px] h-6 sticky z-10"
                                            style={{ left: `${stickyPositions['module']}px` }}
                                        >
                                            <span
                                                className="whitespace-normal break-words px-4 text-center flex-1"
                                                title={row.moduleName === "Default Module" ? "-" : row.moduleName}
                                            >
                                                {row.moduleName === "Default Module" ? "-" : row.moduleName}
                                            </span>
                                        </TableCell>
                                    )}

                                    {/* SubModule Cell - Show for all submodules */}
                                    {selectedCourse?.courseHierarchy.includes('Sub Module') && isFirstSubtopicInSubModule && (
                                        <TableCell
                                            rowSpan={subModuleSpans[row.subModuleId]}
                                            className="border border-gray-400 text-left p-0.5 bg-[#FFF3EA] text-[9px] font-medium text-center align-middle max-w-[80px] h-6 sticky z-10"
                                            style={{ left: `${stickyPositions['subModule']}px` }}
                                        >
                                            <span
                                                className="whitespace-nowrap overflow-hidden text-ellipsis block px-1"
                                                title={row.subModuleName === "Default Submodule" ? "-" : row.subModuleName}
                                            >
                                                {row.subModuleName === "Default Submodule" ? "-" : row.subModuleName}
                                            </span>
                                        </TableCell>
                                    )}

                                    {/* Topic Cell - Show for all topics */}
                                    {selectedCourse?.courseHierarchy.includes("Topic") && isFirstSubtopicInTopic && (
                                        <TableCell
                                            rowSpan={topicSpans[row.topicId]}
                                            className="border border-gray-400 text-left p-0.5 bg-[#FFF3EA] text-[9px] font-medium text-center align-middle max-w-[80px] h-6 sticky z-10"
                                            style={{ left: `${stickyPositions['topic']}px` }}
                                        >
                                            <span
                                                className="whitespace-nowrap overflow-hidden text-ellipsis block px-1"
                                                title={row.topicName === "Default Topic" ? "-" : row.topicName}
                                            >
                                                {row.topicName === "Default Topic" ? "-" : row.topicName}
                                            </span>
                                        </TableCell>
                                    )}

                                    {/* Subtopic Cell - Show for all subtopics */}
                                    {selectedCourse?.courseHierarchy.includes("Sub Topic") && (
                                        <TableCell
                                            className="border border-gray-400 text-left p-0.5 bg-[#FFF3EA] text-[9px] font-medium text-center align-middle max-w-[80px] h-6 sticky z-10"
                                            style={{ left: `${stickyPositions['subTopic']}px` }}
                                        >
                                            <span
                                                className="whitespace-nowrap overflow-hidden text-ellipsis block px-1"
                                                title={row.subtopicName === "Default Subtopic" ? "-" : row.subtopicName}
                                            >
                                                {row.subtopicName === "Default Subtopic" ? "-" : row.subtopicName}
                                            </span>
                                        </TableCell>
                                    )}
                                </TableRow>
                            );
                        });
                    })()}
                </TableBody>
            </Table>
        </div>
    );
}
