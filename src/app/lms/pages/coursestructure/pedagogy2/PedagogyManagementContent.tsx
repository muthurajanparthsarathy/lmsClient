"use client"

"use client"
import { Table } from "@/components/ui/table"
import React from "react"
import { motion, AnimatePresence } from "framer-motion";
import {
    CheckCircle2,
    Merge,
    Split,
    HelpCircle,
    X,
    Plus,
    Pencil,
    Trash,
    AlertTriangle,
    ChevronDown,
    ZoomIn,
    ZoomOut,
    Move,
    Eye,
    FileText,
    SearchIcon,
    Check,
    Sliders,
    MoreVertical,
    Printer,
    BookOpen,
    User,
    Users,
    Presentation,
    FolderOpen,
    Info,
    MoreHorizontal,
    AlertCircle,
    CheckCircle,
    Layers,
    ChevronDownIcon,
    ChevronRightIcon,
    ChevronRight,
    ChevronUpCircle,
    ChevronUpIcon,
    Settings,
    Copy,
    RotateCcw,
    Loader2,
    CheckSquare,
    User2,
    Trash2,
    SquarePen,
    File,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog } from "@/components/ui/dialog"
import PrintComponent from "@/components/ui/PrintComponent";
import { Toaster } from 'sonner';

// Types, the zoom puck and the popup motion variants now live beside this file.
// They were moved verbatim during the split — same declarations, same shapes,
// only relocated so this file holds the screen's logic rather than everything.
import type {
    Modules, MergeRange, SubModuleCreateData, PreviewTableProps, ModuleFormData,
    Topic, TopicCreateData, SubTopic, SubTopicCreateData, ExportSelections,
    CourseHours, MergedCell, Course, MergedLevel, ActivityType, PedagogyType,
    HierarchyMerges,
} from "./types"
import PreviewTable from "./PreviewTable"
import {
    renderErrorDialog, renderSummaryDialog, renderInstructionsDialog,
    renderEditingMergeDialog, renderPreviewDialog, renderFullPreviewDialog, renderLevelDialog,
    renderLevelDeleteDialog, renderMergeLevelDialog, renderMultipleDeleteDialog,
    renderPedagogyDialog, renderDeleteConfirmationDialog,
} from "./pedagogyDialogs"
import { renderMainEditDialog } from "./pedagogyEditDialog"
import { renderMainContent } from "./pedagogyMainView"


import { usePedagogyManagement } from "./usePedagogyManagement"

/**
 * Renders bare — no DashboardLayout — which is what lets the L&D console host
 * it inside its own shell. `courseId` is for that host: the console is
 * hash-routed and carries no `?courseId=`, so it hands the id down instead.
 */
export default function PedagogyManagementContent(
    { courseId, embedded = false }: { courseId?: string; embedded?: boolean } = {}
) {
    const {
    AddCellButton, CellActionsMenu, ConfirmationPreviewTable, CoursePreviewPopup, DuplicationPreviewTable, MergeButton, ModuleSelectionToggle, PreviewButton,
    SearchableCourseSelect, ValidationFeedback, actionsEnabled, activateGlobalDeleteMode, activateHierarchicalDeleteMode, activityTypes, addOnlyPedagogyLevel, areAllModuleTopicsCompleted,
    areAllSubModulesCompleted, arraysEqual, calculateConfirmationStats, calculateNegativeMargin, calculateSectionTotal, calculateTotalHours, cancelDeleteMode, cellToDelete,
    clearLevelMergeSelections, clearPedagogyMergeSelections, confirmCellDelete, confirmDelete, confirmLevelMerge, confirmLevelUnmerge, confirmMerge, confirmMultipleDelete,
    confirmUnmerge, contentHeight, courseHours, courses, createDuplicateTableRows, currentMergeActivity, deleteLevelMutation, deleteMode,
    dialogType, directActionsEnabled, disableAddonlyMode, dragOverId, draggingModuleId, draggingSubModuleId, draggingSubtopicId, draggingTopicId,
    duplicateChecked, duplicateCourseHierarchyMutation, duplicateSelectionMode, editLevelMergeSelections, editMode, editPedagogyMergeSelections, editingLevel, editingMerge,
    enableModuleSelection, errorMessage, expandedModules, expandedSubModules, expandedTopics, exportSelections, exportToExcel, filterPlaceholders2,
    fullscreenContainerRef, getAvailableCategories, getAvailableDuplicateCourses, getCommonHierarchyLevels, getCourseSkillSet, getDuplicateSpans, getHeaderText, getImmediateChildrenForParent,
    getItemsForDeletion, getLevelMergeSelectionCount, handleClosePopup, handleDeleteClick, handleDeleteModeSelectAll, handleDeleteModeSelection, handleDragOver, handleDuplicateConfirm,
    handleEdit, handleHierarchyCheckboxChange, handleLevelSave, handleModuleDragEnd, handleModuleDragStart, handleModuleDrop, handleModuleFormChange, handleModuleSubmit,
    handleMultipleDeleteClick, handlePedagogySave, handlePrint, handleSelectAllHierarchy, handleSkillSetChange, handleSubModuleDragEnd, handleSubModuleDragStart, handleSubModuleDrop,
    handleSubModuleFormChange, handleSubModuleSubmit, handleSubTopicFormChange, handleSubTopicSubmit, handleSubtopicDragEnd, handleSubtopicDragStart, handleSubtopicDrop, handleTopicDragEnd,
    handleTopicDragStart, handleTopicDrop, handleTopicFormChange, handleTopicSubmit, hasActualMergeSelection, hasPedagogyHoursGreaterThanZero, hierarchicalDeleteMode, hierarchyWidthPercentage,
    isCellMerged, isCellMovable, isConfirmDelete, isConfirmMultiDelete, isCreatingModule, isCreatingSubModule, isCreatingSubTopic, isCreatingTopic,
    isDefaultItem, isDuplicateModulesLoading, isDuplicateSubModulesLoading, isDuplicateSubTopicsLoading, isDuplicateTopicsLoading, isHierarchyLevelEnabled, isLastHierarchy, isLastHierarchy2,
    isLevelDelete, isLevelMergeSave, isLevelMerged, isLevelSave, isLevelUnmergeConfirm, isMergeConfirm, isMergeSectionOpen, isNewLevel,
    isOpen, isPedagogyDeleteConfirm, isTableFullView, isUnmergeConfirm, itemToDelete, levelToDelete, levelsData, mergeEditError, mergeHours,
    mergeLevelValue, mergedCells, moduleFormData, moduleSearchQuery, moduleSpans, moduleTestConfig, modules, movableCell,
    pedagogyFormData, pedagogyHours, pedagogyViews, pendingMerge, pendingUnmerge, printRef, renderActivityCell, renderAddFirstMessages,
    renderLevelCell, resetAllFormStates, resetTableZoom, saveLevelMergeSelections, savePedagogyMergeSelections, savedLevelMergeSelections, savedPedagogyMergeSelections, scaledContentRef,
    selected, selectedCategory, selectedCourse, selectedDuplicateCourse, selectedDuplicateOptions, selectedLevel, selectedLevelModulesForMerge, selectedLevelSubModulesForMerge,
    selectedLevelSubTopicsForMerge, selectedLevelTopicsForMerge, selectedModuleForSubModule, selectedModuleToHighlight, selectedModulesForDuplication, selectedPedagogyActivities, selectedPedagogyModulesForMerge, selectedPedagogySubModulesForMerge,
    selectedPedagogySubTopicsForMerge, selectedPedagogyTopicsForMerge, selectedPedagogyTypes, selectedSubModuleForTopic, setActionsEnabled, setAddOnlyPedagogyLevel, setCellToDelete, setCurrentMergeActivity,
    setDialogType, setDirectActionsEnabled, setDisableAddonlyMode, setDuplicateChecked, setDuplicateSelectionMode, setEditingLevel, setEditingMerge, setErrorMessage,
    setExpandedModules, setExpandedSubModules, setExpandedTopics, setExportSelections, setIsLevelDelete, setIsMoveModeActive, setIsOpen, setIsTableFullView, setItemToDelete,
    setLevelToDelete, setMergeEditError, setMergeHours, setMergeLevelValue, setMergeSelectionMode, setModuleSearchQuery, setMovableCell, setPedagogyFormData,
    setPedagogyHours, setPendingLevelMerge, setPendingLevelUnmerge, setPendingMerge, setPendingUnmerge, setSelectedCategory, setSelectedDuplicateCourse, setSelectedDuplicateOptions,
    setSelectedLevel, setSelectedLevelModulesForMerge, setSelectedLevelSubModulesForMerge, setSelectedLevelSubTopicsForMerge, setSelectedLevelTopicsForMerge, setSelectedMergeCells, setSelectedModuleForSubModule, setSelectedModuleToHighlight,
    setSelectedPedagogyActivities, setSelectedPedagogyModulesForMerge, setSelectedPedagogySubModulesForMerge, setSelectedPedagogySubTopicsForMerge, setSelectedPedagogyTopicsForMerge, setSelectedPedagogyTypes, setSelectedSubModuleForTopic, setSelectedTopicForSubTopic,
    setShowDeleteCellDialog, setShowDeleteConfirmation, setShowDeleteDialog, setShowDialog, setShowDuplicateConfirmation, setShowDuplicatePopup, setShowErrorDialog, setShowFullPreviewDialog,
    setShowInstructions, setShowLevelDeleteConfirmation, setShowLevelDialog, setShowLevelSection, setShowMainFullPreviewDialog, setShowMergeDialog, setShowMergeLevelDialog, setShowMergeLevelSection,
    setShowMergePedagogySection, setShowMultipleDeleteDialog, setShowPedagogyDialog, setShowPedagogySection, setShowPreviewDialog, setShowSummaryDialog, setShowUnmergeDialog, setShowUnmergeLevelDialog,
    shouldDisableControls, shouldShowHierarchicalCheckbox, shouldShowPedagogyLevelToggle, showAddModuleFirst, showAddTopicFirst, showCoursePreview, showDeleteCellDialog, showDeleteConfirmation,
    showDeleteDialog, showDialog, showDuplicateConfirmation, showDuplicatePopup, showErrorDialog, showFullPreviewDialog, showInstructions, showLevelDeleteConfirmation,
    showLevelDialog, showLevelSection, showMainFullPreviewDialog, showMergeDialog, showMergeLevelDialog, showMergeLevelSection, showMergePedagogySection, showMultipleDeleteDialog,
    showPedagogyDialog, showPedagogySection, showPreviewDialog, showSuccessMessage, showSummaryDialog, showUnmergeDialog, showUnmergeLevelDialog, sortedModules,
    sortedSubModules, sortedSubTopics, sortedTopics, subModuleFormData, subModuleSpans, subModules, subTopicFormData, subTopics,
    tableRows, tableZoomLevel, toggleExpansion, topicFormData, topicSpans, topicSubTopics, topics, updateMergedPedagogy,
    zoomTableIn, zoomTableOut,
    } = usePedagogyManagement(courseId)

    return (
        <div className={embedded ? "w-full" : "min-h-screen w-full"}>
            {/* The shell used to supply the page gutters; with it gone the
                content needs its own, or everything sits flush to the glass. */}
            {renderMainContent({ embedded, AddCellButton, CellActionsMenu, MergeButton, ValidationFeedback, actionsEnabled, activateHierarchicalDeleteMode, activityTypes, calculateTotalHours, cancelDeleteMode, confirmMerge, contentHeight, deleteMode, directActionsEnabled, duplicateChecked, filterPlaceholders2, fullscreenContainerRef, getImmediateChildrenForParent, getItemsForDeletion, handleDeleteClick, handleDeleteModeSelectAll, handleDeleteModeSelection, handleDragOver, handleEdit, handleModuleDragEnd, handleModuleDragStart, handleModuleDrop, handleMultipleDeleteClick, handleSubModuleDragEnd, handleSubModuleDragStart, handleSubModuleDrop, handleSubtopicDragEnd, handleSubtopicDragStart, handleSubtopicDrop, handleTopicDragEnd, handleTopicDragStart, handleTopicDrop, hierarchicalDeleteMode, hierarchyWidthPercentage, isCellMerged, isDefaultItem, isLastHierarchy2, isMergeConfirm, isOpen, isTableFullView, mergeHours, moduleSearchQuery, moduleSpans, modules, pendingMerge, renderActivityCell, renderAddFirstMessages, renderLevelCell, resetTableZoom, scaledContentRef, selected, selectedCourse, selectedModuleToHighlight, selectedPedagogyTypes, setActionsEnabled, setAddOnlyPedagogyLevel, setDialogType, setDirectActionsEnabled, setDisableAddonlyMode, setDuplicateChecked, setIsMoveModeActive, setIsOpen, setIsTableFullView, setMergeHours, setModuleSearchQuery, setMovableCell, setPendingMerge, setSelectedModuleForSubModule, setSelectedModuleToHighlight, setSelectedPedagogyTypes, setSelectedSubModuleForTopic, setSelectedTopicForSubTopic, setShowDeleteConfirmation, setShowDialog, setShowDuplicatePopup, setShowInstructions, setShowMainFullPreviewDialog, setShowMergeDialog, setShowPreviewDialog, setShowSummaryDialog, shouldDisableControls, shouldShowHierarchicalCheckbox, showAddModuleFirst, showAddTopicFirst, showInstructions, showMergeDialog, showSuccessMessage, sortedModules, subModuleSpans, subModules, subTopics, tableRows, tableZoomLevel, topicSpans, topics, zoomTableIn, zoomTableOut, calculateNegativeMargin, dragOverId, draggingModuleId, draggingSubModuleId, draggingSubtopicId, draggingTopicId, isCellMovable, movableCell, ondragover })}
            {/* Consolidated Dialog */}
            <AnimatePresence>
                {renderMainEditDialog({ activityTypes, addOnlyPedagogyLevel, areAllModuleTopicsCompleted, areAllSubModulesCompleted, clearLevelMergeSelections, clearPedagogyMergeSelections, currentMergeActivity, dialogType, disableAddonlyMode, editLevelMergeSelections, editMode, editPedagogyMergeSelections, errorMessage, expandedModules, expandedSubModules, expandedTopics, getCourseSkillSet, getHeaderText, getLevelMergeSelectionCount, handleModuleFormChange, handleModuleSubmit, handleSkillSetChange, handleSubModuleFormChange, handleSubModuleSubmit, handleSubTopicFormChange, handleSubTopicSubmit, handleTopicFormChange, handleTopicSubmit, hasActualMergeSelection, hasPedagogyHoursGreaterThanZero, isCreatingModule, isCreatingSubModule, isCreatingSubTopic, isCreatingTopic, isLastHierarchy, isMergeSectionOpen, moduleFormData, moduleTestConfig, pedagogyHours, resetAllFormStates, saveLevelMergeSelections, savePedagogyMergeSelections, savedLevelMergeSelections, savedPedagogyMergeSelections, selected, selectedCourse, selectedLevel, selectedLevelModulesForMerge, selectedLevelSubModulesForMerge, selectedLevelSubTopicsForMerge, selectedLevelTopicsForMerge, selectedModuleForSubModule, selectedPedagogyActivities, selectedPedagogyModulesForMerge, selectedPedagogySubModulesForMerge, selectedPedagogySubTopicsForMerge, selectedPedagogyTopicsForMerge, selectedSubModuleForTopic, setAddOnlyPedagogyLevel, setCurrentMergeActivity, setExpandedModules, setExpandedSubModules, setExpandedTopics, setPedagogyHours, setSelectedLevel, setSelectedLevelModulesForMerge, setSelectedLevelSubModulesForMerge, setSelectedLevelSubTopicsForMerge, setSelectedLevelTopicsForMerge, setSelectedPedagogyActivities, setSelectedPedagogyModulesForMerge, setSelectedPedagogySubModulesForMerge, setSelectedPedagogySubTopicsForMerge, setSelectedPedagogyTopicsForMerge, setShowDialog, setShowFullPreviewDialog, setShowLevelSection, setShowMergeLevelSection, setShowMergePedagogySection, setShowPedagogySection, shouldShowPedagogyLevelToggle, showDialog, showLevelSection, showMergeLevelSection, showMergePedagogySection, showPedagogySection, sortedModules, sortedSubModules, sortedSubTopics, sortedTopics, subModuleFormData, subTopicFormData, toggleExpansion, topicFormData, topicSubTopics })}
            </AnimatePresence>
            <style>
                {`
  .thin-scrollbar::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  .thin-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .thin-scrollbar::-webkit-scrollbar-thumb {
    border-radius: 9999px;
    background: linear-gradient(to bottom, #FB8C3C, #C2540F);
  }
  .thin-scrollbar::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(to bottom, #F0701F, #9A3F0A);
  }
  /* Firefox */
  .thin-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: #F97316 transparent;
  }
`}
            </style>

            <AnimatePresence>
                {showDeleteDialog && (
                    <motion.div
                        className="fixed inset-0 bg-gray-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        >
                            <div className="text-center">
                                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                                    <AlertTriangle className="h-6 w-6 text-red-600" />
                                </div>
                                <h3 className="mt-5 text-lg font-medium text-gray-900">Delete {itemToDelete?.type}</h3>
                                <div className="mt-2 text-sm text-gray-500">
                                    <p className="text-sm">Are you sure you want to delete this {itemToDelete?.type}?</p>
                                    <p className="font-semibold text-red-500">This action cannot be undone.</p>
                                </div>
                            </div>
                            <div className="mt-6 grid grid-cols-2 gap-3">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="cursor-pointer"
                                    onClick={() => {
                                        setShowDeleteDialog(false);
                                        setItemToDelete(null);
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={confirmDelete}
                                    className="cursor-pointer"
                                >
                                    {(isConfirmDelete ? "Deleting..." : "Delete")}
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Error Dialog */}
            <AnimatePresence>
                {renderErrorDialog({ errorMessage, setMergeSelectionMode, setSelectedMergeCells, setShowErrorDialog, showErrorDialog })}
            </AnimatePresence>
            {/* Summary Dialog */}
            <AnimatePresence>
                {renderSummaryDialog({ activityTypes, calculateSectionTotal, calculateTotalHours, setShowSummaryDialog, showSummaryDialog })}
            </AnimatePresence>
            {/* Instructions Dialog */}
            <AnimatePresence>
                {renderInstructionsDialog({ modules, selected, setShowInstructions, showInstructions })}
            </AnimatePresence>
            {/* Edit Merge Dialog */}
            <AnimatePresence>
                {renderEditingMergeDialog({ editingMerge, mergeEditError, setEditingMerge, setMergeEditError, updateMergedPedagogy })}
            </AnimatePresence>
            {/* Preview Dialog */}
            <AnimatePresence>
                {renderPreviewDialog({ activityTypes, courseHours, exportSelections, exportToExcel, handlePrint, isLevelMerged, mergedCells, moduleSpans, pedagogyViews, renderActivityCell, selected, selectedCourse, selectedPedagogyTypes, setExportSelections, setShowPreviewDialog, showPreviewDialog, subModuleSpans, tableRows, topicSpans })}
            </AnimatePresence>
            {/* Full Preview Dialog - Shows all details by default */}
            <AnimatePresence>
                {renderFullPreviewDialog({ activityTypes, courseHours, exportSelections, isLevelMerged, mergedCells, moduleSpans, pedagogyViews, renderActivityCell, selectedCourse, selectedPedagogyTypes, setExportSelections, setShowFullPreviewDialog, showFullPreviewDialog, subModuleSpans, tableRows, topicSpans })}
            </AnimatePresence>
            {/* Print Dialog */}
            <div style={{
                display: 'none',
            }}>
                <PrintComponent
                    ref={printRef}
                    leftLogo="/KIOT 1.png"
                    logo="/KIOT 1.png"
                    logoPosition="both"
                    rightLogo="/KIOT 1.png"
                    heading={`${selectedCourse?.courseName || 'Course'} Course Report`}
                    tableComponent={
                        <PreviewTable
                                    pedagogyViews={pedagogyViews}
                                    isLevelMerged={isLevelMerged}
                                    renderActivityCell={renderActivityCell}
                            tableRows={tableRows}
                            courseHours={courseHours}
                            mergedCells={mergedCells}
                            selectedCourse={selectedCourse}
                            activityTypes={activityTypes}
                            selectedPedagogyTypes={selectedPedagogyTypes}
                            moduleSpans={moduleSpans}
                            subModuleSpans={subModuleSpans}
                            topicSpans={topicSpans}
                            exportSelections={exportSelections}
                            setExportSelections={setExportSelections}
                            onExport={exportToExcel}
                            isPrinting={false}
                        />
                    }
                    signature="Prepared by Your Name"
                    landscape={true}
                    watermarkText=''
                    watermarkImage='/KIOT 1.png'
                    showSummary={exportSelections.showSummary}
                    summaryData={{
                        selectedPedagogyTypes,
                        activityTypes,
                        exportSelections: exportSelections.showSummary
                            ? {
                                ...exportSelections,
                                pedagogy: exportSelections.printPedagogy || { iDo: [], weDo: [], youDo: [] }
                            }
                            : {
                                ...exportSelections,
                                pedagogy: exportSelections.pedagogy || { iDo: [], weDo: [], youDo: [] }
                            },

                        calculateTotalHours: (type: "iDo" | "weDo" | "youDo", activity: string) => {
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
                                                (!topicData.subModuleId || merge.hierarchyIds.subModules.includes(topicData?.subModuleId as any));
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
                        }
                    }}
                    courseDetails={selectedCourse ? {
                        courseName: selectedCourse.courseName || "",
                        courseCode: selectedCourse.courseCode || "",
                        clientName: selectedCourse.clientName || "",
                        serviceType: selectedCourse.serviceType || "",
                        serviceModal: selectedCourse.serviceModal || "",
                        category: selectedCourse.category || "",
                        courseLevel: selectedCourse.courseLevel || ""
                    } : undefined}
                />
            </div>
            {/* Unmerge Confirmation Dialog */}
            <AnimatePresence>
                {showUnmergeDialog && (
                    <motion.div
                        className="fixed inset-0 bg-gray-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        >
                            <div className="text-center">
                                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                                    <AlertTriangle className="h-6 w-6 text-red-600" />
                                </div>
                                <h3 className="mt-5 text-lg font-medium text-gray-900">Confirm Unmerge</h3>
                                <div className="mt-2 text-sm text-gray-500">
                                    <p className="text-sm">
                                        Are you sure you want to delete this value?
                                    </p>
                                    <p className="text-sm">
                                        Are you sure you want to unmerge {pendingUnmerge?.activity} ({pendingUnmerge?.type})?
                                    </p>
                                </div>
                            </div>
                            <div className="mt-6 grid grid-cols-2 gap-3">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="cursor-pointer"
                                    onClick={() => {
                                        setShowUnmergeDialog(false);
                                        setPendingUnmerge(null);
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    className="cursor-pointer"
                                    onClick={confirmUnmerge}
                                >
                                    {(isUnmergeConfirm ? "Unmerging..." : "Unmerge")}
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {renderLevelDialog({ arraysEqual, editingLevel, handleLevelSave, isLevelSave, isNewLevel, levelsData, setEditingLevel, setLevelToDelete, setShowLevelDeleteConfirmation, setShowLevelDialog, showLevelDialog })}
            {renderLevelDeleteDialog({ arraysEqual, deleteLevelMutation, editingLevel, isLevelDelete, levelToDelete, levelsData, selectedCourse, setErrorMessage, setIsLevelDelete, setLevelToDelete, setShowErrorDialog, setShowLevelDeleteConfirmation, setShowLevelDialog, showLevelDeleteConfirmation })}
            {/* Merge Level Dialog */}
            {renderMergeLevelDialog({ confirmLevelMerge, isLevelMergeSave, mergeLevelValue, setMergeLevelValue, setPendingLevelMerge, setShowMergeLevelDialog, showMergeLevelDialog })}
            {/* Level Unmerge Confirmation Dialog */}
            <AnimatePresence>
                {showUnmergeLevelDialog && (
                    <motion.div
                        className="fixed inset-0 bg-gray-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        >
                            <div className="text-center">
                                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                                    <AlertTriangle className="h-6 w-6 text-red-600" />
                                </div>
                                <h3 className="mt-5 text-lg font-medium text-gray-900">Confirm Unmerge</h3>
                                <div className="mt-2 text-sm text-gray-500">
                                    <p className="text-sm">
                                        Are you sure you want to delete this value?
                                    </p>
                                    <p className="text-sm">
                                        Are you sure you want to unmerge this level?
                                    </p>
                                </div>
                            </div>
                            <div className="mt-6 grid grid-cols-2 gap-3">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setShowUnmergeLevelDialog(false);
                                        setPendingLevelUnmerge(null);
                                    }}
                                    className="cursor-pointer"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={confirmLevelUnmerge}
                                    className="cursor-pointer"
                                >
                                    {(isLevelUnmergeConfirm ? "Unmerging..." : "Unmerge")}
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            {/* Delete Cell Confirmation Dialog */}
            <AnimatePresence>
                {showDeleteCellDialog && (
                    <motion.div
                        className="fixed inset-0 bg-gray-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        >
                            <div className="text-center">
                                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                                    <AlertTriangle className="h-6 w-6 text-red-600" />
                                </div>
                                <h3 className="mt-5 text-lg font-medium text-gray-900">Delete Confirmation</h3>
                                <div className="mt-2 text-sm text-gray-500">
                                    <p className="text-sm">
                                        Are you sure you want to delete this value?
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        This will remove the hours value for {cellToDelete?.activity} ({cellToDelete?.type}).
                                    </p>
                                </div>
                            </div>
                            <div className="mt-6 grid grid-cols-2 gap-3">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setShowDeleteCellDialog(false);
                                        setCellToDelete(null);
                                    }}
                                    className="cursor-pointer"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={confirmCellDelete}
                                    className="cursor-pointer"
                                >
                                    {isPedagogyDeleteConfirm ? "Deleting..." : "Delete"}
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Multiple Delete Type Selection Dialog */}
            <AnimatePresence>
                {renderMultipleDeleteDialog({ activateGlobalDeleteMode, selectedCourse, setShowMultipleDeleteDialog, showMultipleDeleteDialog, sortedModules, sortedSubModules, sortedSubTopics, sortedTopics })}
            </AnimatePresence>

            {showDuplicatePopup && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="bg-white rounded-2xl shadow-xl w-full max-w-6xl max-h-[98vh] flex flex-col overflow-hidden border border-gray-200"
                    >

                        {/* Header */}
                        <div className="flex justify-between items-center px-6 py-4 bg-gradient-to-r from-[#FB8C3C] to-[#C2540F] text-white">
                            <div className="flex items-center gap-2">
                                <Copy className="w-5 h-5" />
                                <h2 className="text-lg font-semibold">Duplicate Course</h2>
                            </div>
                            <button
                                onClick={handleClosePopup}
                                className="p-2 cursor-pointer hover:bg-red-600/80 bg-red-500 rounded-lg transition"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-auto thin-scrollbar p-4">
                            <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
                                {/* Left Column - Course Selection and Options */}
                                <div className="space-y-6">
                                    {/* Course Selection */}
                                    <div className="space-y-3">
                                        {/* Selection Mode Toggle */}
                                        <div className="flex items-center justify-between">
                                            <label className="block text-sm font-medium text-gray-700">
                                                Select course to duplicate:
                                            </label>
                                            <div className="flex items-center gap-2 text-xs">
                                                <span className="text-gray-600">Mode:</span>
                                                <div className="flex bg-gray-100 rounded-lg p-0.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setDuplicateSelectionMode('hierarchy')
                                                            setSelectedDuplicateCourse(null);
                                                            setSelectedDuplicateOptions({ hierarchy: [] });
                                                        }}
                                                        className={`px-2 py-1 rounded-md text-xs font-medium cursor-pointer transition-all ${duplicateSelectionMode === 'hierarchy'
                                                            ? 'bg-white shadow-sm text-[#F97316]'
                                                            : 'text-gray-600 hover:text-gray-800'
                                                            }`}
                                                    >
                                                        Hierarchy Based
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setDuplicateSelectionMode('all')
                                                            setSelectedDuplicateCourse(null);
                                                            setSelectedDuplicateOptions({ hierarchy: [] });
                                                        }}
                                                        className={`px-2 py-1 rounded-md text-xs font-medium cursor-pointer transition-all ${duplicateSelectionMode === 'all'
                                                            ? 'bg-white shadow-sm text-[#F97316]'
                                                            : 'text-gray-600 hover:text-gray-800'
                                                            }`}
                                                    >
                                                        All Courses
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Filters and Course Selection Row */}
                                        <div className="flex flex-col sm:flex-row gap-3">
                                            {/* Category Filter */}
                                            <div className="flex-1 sm:flex-none sm:w-48">
                                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                                    Filter by Category:
                                                </label>
                                                <Select
                                                    value={selectedCategory}
                                                    onValueChange={setSelectedCategory}
                                                >
                                                    <SelectTrigger className="w-full h-9 text-xs bg-gray-50 border-gray-300">
                                                        <SelectValue placeholder="Select category" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {getAvailableCategories().map((category) => (
                                                            <SelectItem key={category} value={category} className="text-xs">
                                                                {category === 'all' ? 'All Categories' : category}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {/* Course Dropdown */}
                                            <div className="flex-1">
                                                {getAvailableDuplicateCourses().length === 0 ? (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3"
                                                    >
                                                        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                                                        <div>
                                                            <p className="text-amber-800 font-medium text-sm">
                                                                {duplicateSelectionMode === 'hierarchy'
                                                                    ? "No courses found with matching hierarchy structure."
                                                                    : "No other courses available for duplication."
                                                                }
                                                                {selectedCategory !== 'all' && ` in the "${selectedCategory}" category.`}
                                                            </p>
                                                            <p className="text-amber-700 text-xs mt-1">
                                                                {duplicateSelectionMode === 'hierarchy'
                                                                    ? "Try switching to 'All Courses' mode to see all available courses."
                                                                    : "Only the current course exists in the system."
                                                                }
                                                            </p>
                                                        </div>
                                                    </motion.div>
                                                ) : (
                                                    <>
                                                        <label className="block text-xs font-medium text-gray-600 mb-1">
                                                            Select Course:
                                                        </label>
                                                        <div className="flex gap-2">
                                                            <SearchableCourseSelect
                                                                courses={getAvailableDuplicateCourses()}
                                                                selectedCourse={selectedDuplicateCourse}
                                                                onCourseSelect={setSelectedDuplicateCourse}
                                                                placeholder={
                                                                    duplicateSelectionMode === 'hierarchy'
                                                                        ? "Search for a course with matching hierarchy..."
                                                                        : "Search for any course..."
                                                                }
                                                            />
                                                            <PreviewButton course={selectedDuplicateCourse} />
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Duplication Options */}
                                    {selectedDuplicateCourse && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="space-y-3"
                                        >
                                            {duplicateSelectionMode === 'all' && (
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.95 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    className="bg-amber-50 border border-amber-200 rounded-lg p-3"
                                                >
                                                    <div className="flex items-start gap-2">
                                                        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                                                        <div className="text-amber-800 text-xs">
                                                            <strong>Note:</strong> Selected course has different hierarchy structure.
                                                            Only common consecutive levels will be available for duplication.
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                            <div className="bg-white border rounded-xl shadow-sm p-3">
                                                <div className="flex items-center justify-between gap-3 mb-2">
                                                    <h4 className="font-medium text-gray-800 text-sm flex items-center gap-1 flex-shrink-0">
                                                        <Layers className="w-4 h-4 text-[#F97316]" />
                                                        Available Hierarchy Levels
                                                    </h4>

                                                    {/* Single line layout for checkboxes */}
                                                    <div className="flex items-center gap-3 flex-wrap">
                                                        {/* Individual hierarchy checkboxes */}
                                                        {getCommonHierarchyLevels(selectedCourse, selectedDuplicateCourse).map((level) => {
                                                            const isEnabled = isHierarchyLevelEnabled(level);
                                                            const isChecked = selectedDuplicateOptions.hierarchy.includes(level);

                                                            // Convert back to display format
                                                            const displayLevel = level === 'SubModule' ? 'Sub Module' :
                                                                level === 'SubTopic' ? 'Sub Topic' : level;

                                                            return (
                                                                <div
                                                                    key={level}
                                                                    className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition ${isEnabled
                                                                        ? "hover:bg-[#FFF3EA]"
                                                                        : "opacity-50 cursor-not-allowed"
                                                                        }`}
                                                                >
                                                                    <Checkbox
                                                                        id={`hierarchy-${level}`}
                                                                        checked={isChecked}
                                                                        disabled={!isEnabled}
                                                                        onCheckedChange={(checked) =>
                                                                            handleHierarchyCheckboxChange(level, checked)
                                                                        }
                                                                        className="scale-90"
                                                                    />
                                                                    <label
                                                                        htmlFor={`hierarchy-${level}`}
                                                                        className={`text-xs font-medium whitespace-nowrap cursor-pointer ${isEnabled ? "text-gray-700" : "text-gray-400"
                                                                            }`}
                                                                    >
                                                                        {displayLevel}
                                                                        {level === "Module" && "s"}
                                                                        {level === "SubModule" && "s"}
                                                                        {level === "Topic" && "s"}
                                                                        {level === "SubTopic" && "s"}
                                                                    </label>
                                                                </div>
                                                            );
                                                        })}

                                                        {/* Select All at the end with separator */}
                                                        {getCommonHierarchyLevels(selectedCourse, selectedDuplicateCourse).length > 0 && (
                                                            <>
                                                                <div className="h-5 w-px bg-gray-300" />
                                                                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-[#FFF3EA] transition">
                                                                    <Checkbox
                                                                        id="select-all-hierarchy"
                                                                        checked={
                                                                            selectedDuplicateOptions.hierarchy.length > 0 &&
                                                                            getCommonHierarchyLevels(selectedCourse, selectedDuplicateCourse)
                                                                                .every(level => selectedDuplicateOptions.hierarchy.includes(level))
                                                                        }
                                                                        onCheckedChange={handleSelectAllHierarchy}
                                                                        className="scale-90"
                                                                    />
                                                                    <label
                                                                        htmlFor="select-all-hierarchy"
                                                                        className="text-xs font-medium text-[#F97316] cursor-pointer hover:text-[#C2540F] whitespace-nowrap"
                                                                    >
                                                                        Select All
                                                                    </label>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Show message if no common levels */}
                                                {getCommonHierarchyLevels(selectedCourse, selectedDuplicateCourse).length === 0 && (
                                                    <div className="text-center py-3 text-gray-500 text-xs">
                                                        No common hierarchy levels available for duplication.
                                                    </div>
                                                )}

                                                {/* Inline Info */}
                                                <p className="mt-2 text-[11px] text-gray-500 flex items-center gap-1">
                                                    <Info className="w-3 h-3 text-gray-400" />
                                                    {duplicateSelectionMode === 'hierarchy'
                                                        ? "Select levels in order. Later levels unlock automatically."
                                                        : "Only common consecutive hierarchy levels are available."
                                                    }
                                                </p>
                                            </div>

                                            {/* Selection Summary (Compact Pills) */}
                                            {selectedDuplicateOptions.hierarchy.length > 0 && (
                                                <div className="flex flex-wrap gap-2 text-xs bg-[#FFF3EA] border border-[#FFD9BC] rounded-lg p-2">
                                                    <span className="text-[#9A3F0A] font-medium">Selected:</span>
                                                    {selectedDuplicateOptions.hierarchy.map((item) => {
                                                        const displayItem = item === 'SubModule' ? 'Sub Module' :
                                                            item === 'SubTopic' ? 'Sub Topic' : item;
                                                        return (
                                                            <span
                                                                key={item}
                                                                className="px-2 py-0.5 bg-[#FFE4D0] text-[#C2540F] rounded-full"
                                                            >
                                                                {displayItem}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            <ModuleSelectionToggle />
                                        </motion.div>
                                    )}

                                </div>

                                {/* Right Column - Preview */}
                                {(enableModuleSelection || !selectedDuplicateCourse) && (
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Preview</h3>
                                        {selectedDuplicateCourse ? (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.1 }}
                                                className="border border-gray-200 overflow-hidden shadow-lg"
                                            >
                                                <div className="max-h-96 overflow-auto thin-scrollbar">
                                                    {isDuplicateModulesLoading || isDuplicateSubModulesLoading ||
                                                        isDuplicateTopicsLoading || isDuplicateSubTopicsLoading ? (
                                                        <div className="flex items-center justify-center h-32">
                                                            <Loader2 className="w-6 h-6 animate-spin mr-2" />
                                                            Loading course data...
                                                        </div>
                                                    ) : (
                                                        <DuplicationPreviewTable
                                                            tableRows={createDuplicateTableRows()}
                                                            selectedCourse={selectedDuplicateCourse}
                                                            moduleSpans={getDuplicateSpans().moduleSpans}
                                                            subModuleSpans={getDuplicateSpans().subModuleSpans}
                                                            topicSpans={getDuplicateSpans().topicSpans}
                                                        />
                                                    )}
                                                </div>
                                            </motion.div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center text-center p-10 bg-gradient-to-br from-[#FFF3EA] via-white to-[#FFF3EA] rounded-xl border border-gray-200 shadow-sm">
                                                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-[#FFE4D0] text-[#F97316] mb-4 shadow-inner">
                                                    <BookOpen className="w-8 h-8" />
                                                </div>
                                                <h3 className="text-gray-800 font-semibold text-lg">
                                                    No Course Selected
                                                </h3>
                                                <p className="text-gray-500 text-sm mt-1 max-w-sm">
                                                    Please <span className="text-[#F97316] font-medium">select a course</span> to preview its structure and hierarchy details here.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex justify-between items-center p-5 bg-gray-50 border-t border-gray-200">
                            <div className="text-sm text-gray-600">
                                Duplicating to: <span className="font-medium">{selectedCourse?.courseName}</span>
                            </div>
                            <div className="flex gap-3">
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleClosePopup}
                                    className="px-5 py-2.5 cursor-pointer text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors text-gray-700"
                                >
                                    Cancel
                                </motion.button>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => {
                                        // Show confirmation dialog instead of directly calling handleDuplicateConfirm
                                        if (selectedDuplicateCourse && selectedDuplicateOptions.hierarchy.length > 0) {
                                            setShowDuplicateConfirmation(true);
                                        }
                                    }}
                                    disabled={!selectedDuplicateCourse ||
                                        (selectedDuplicateOptions.hierarchy.length === 0) ||
                                        duplicateCourseHierarchyMutation.isPending}
                                    className="px-5 py-2.5 cursor-pointer text-sm font-medium bg-gradient-to-r from-[#FB8C3C] to-[#C2540F] text-white rounded-lg hover:from-[#C2540F] hover:to-[#9A3F0A] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md disabled:shadow-none"
                                >
                                    <div className="flex items-center gap-2">
                                        {duplicateCourseHierarchyMutation.isPending ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Copy className="w-4 h-4" />
                                        )}
                                        {duplicateCourseHierarchyMutation.isPending ? 'Duplicating...' : enableModuleSelection && selectedModulesForDuplication.size > 0
                                            ? `Duplicate ${selectedModulesForDuplication.size} Selected Modules`
                                            : 'Duplicate Structure'}
                                    </div>
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
            {showCoursePreview && <CoursePreviewPopup />}

            {/* Pedagogy Value Dialog */}
            {renderPedagogyDialog({ handlePedagogySave, pedagogyFormData, setPedagogyFormData, setShowPedagogyDialog, showPedagogyDialog })}

            {/* Duplicate Confirmation Dialog */}
            <AnimatePresence>
                {showDuplicateConfirmation && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-white rounded-xl shadow-xl w-full max-w-7xl max-h-[95vh] flex flex-col"
                        >
                            <div className="bg-gradient-to-r from-[#FB8C3C] via-[#F0701F] to-[#C2540F] rounded-t-xl shadow-sm">
                                <div className="p-3 sm:p-5 flex items-center gap-4 text-white">
                                    {/* Icon section with animated pulse */}
                                    <div className="relative">
                                        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm shadow-inner">
                                            <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-white animate-pulse" />
                                        </div>
                                        <div className="absolute inset-0 rounded-full bg-white/10 blur-md animate-ping opacity-40" />
                                    </div>

                                    {/* Text section */}
                                    <div className="flex-1">
                                        <h3 className="text-base sm:text-md font-semibold tracking-wide">
                                            Confirm Duplication
                                        </h3>
                                        <p className="text-sm sm:text-sm text-[#FFE4D0] mt-1">
                                            Review the selected items before duplication
                                        </p>
                                    </div>

                                </div>
                            </div>

                            <div className="p-4 flex-1 overflow-auto thin-scrollbar">


                                <div className="space-y-3">
                                    <div className="flex flex-col lg:flex-row gap-2">
                                        {/* Source Course */}
                                        <div className="flex-1 bg-gray-50 rounded-lg p-3 border border-gray-100 text-xs">
                                            <span className="font-medium text-gray-700 block mb-1">Source Course:</span>
                                            <p className="text-gray-900 truncate">{selectedDuplicateCourse?.courseName}</p>
                                        </div>

                                        {/* Target Course */}
                                        <div className="flex-1 bg-gray-50 rounded-lg p-3 border border-gray-100 text-xs">
                                            <span className="font-medium text-gray-700 block mb-1">Target Course:</span>
                                            <p className="text-gray-900 truncate">{selectedCourse?.courseName}</p>
                                        </div>

                                        {/* Selected for Duplication */}
                                        <div className="flex-1.5 bg-[#FFF3EA] border border-[#FFD9BC] rounded-lg p-3 text-xs">
                                            <h4 className="font-medium text-[#9A3F0A] mb-1">Selected for Duplication:</h4>
                                            <div className="flex flex-wrap gap-1.5">
                                                {selectedDuplicateOptions.hierarchy.map((item) => {
                                                    const displayItem =
                                                        item === 'SubModule'
                                                            ? 'Sub Module'
                                                            : item === 'SubTopic'
                                                                ? 'Sub Topic'
                                                                : item;

                                                    // get count from your calculateConfirmationStats()
                                                    const stats = calculateConfirmationStats();
                                                    const count =
                                                        item === 'Module'
                                                            ? stats.modules
                                                            : item === 'SubModule'
                                                                ? stats.subModules
                                                                : item === 'Topic'
                                                                    ? stats.topics
                                                                    : item === 'SubTopic'
                                                                        ? stats.subTopics
                                                                        : 0;

                                                    return (
                                                        <span
                                                            key={item}
                                                            className="px-2.5 py-0.5 bg-[#FFE4D0] text-[#C2540F] rounded-full text-xs font-medium"
                                                        >
                                                            {displayItem}s ({count})
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>


                                    {/* Preview Table */}
                                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                                        <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
                                            <h4 className="font-medium text-gray-800 text-sm">
                                                Preview of Items to be Duplicated
                                            </h4>
                                        </div>
                                        <div className="max-h-64 overflow-auto thin-scrollbar">
                                            <ConfirmationPreviewTable
                                                selectedDuplicateCourse={selectedDuplicateCourse}
                                                selectedHierarchy={selectedDuplicateOptions.hierarchy}
                                                selectedModules={selectedModulesForDuplication}
                                                enableModuleSelection={enableModuleSelection}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between items-center p-4 bg-gray-50 border-t border-gray-200">
                                <div className="text-sm text-gray-600">
                                    Total items: <span className="font-medium text-[#F97316]">{calculateConfirmationStats().total}</span>
                                </div>
                                <div className="flex gap-3">
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => setShowDuplicateConfirmation(false)}
                                        className="px-6 py-2 cursor-pointer text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors text-gray-700"
                                    >
                                        Cancel
                                    </motion.button>
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => {
                                            setShowDuplicateConfirmation(false);
                                            handleDuplicateConfirm();
                                        }}
                                        disabled={duplicateCourseHierarchyMutation.isPending}
                                        className="px-6 py-2 cursor-pointer text-sm font-medium bg-gradient-to-r from-[#FB8C3C] to-[#C2540F] text-white rounded-lg hover:from-[#C2540F] hover:to-[#9A3F0A] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
                                    >
                                        <div className="flex items-center gap-2">
                                            {duplicateCourseHierarchyMutation.isPending ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Copy className="w-4 h-4" />
                                            )}
                                            {duplicateCourseHierarchyMutation.isPending ? 'Duplicating...' : 'Confirm Duplicate'}
                                        </div>
                                    </motion.button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Delete Confirmation Dialog */}
            <AnimatePresence>
                {renderDeleteConfirmationDialog({ confirmMultipleDelete, deleteMode, isConfirmMultiDelete, modules, selected, setShowDeleteConfirmation, showDeleteConfirmation, subModules, subTopics, topics })}
            </AnimatePresence>
            {/* Full Course Preview Dialog */}
            {showMainFullPreviewDialog && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-[#FFF3EA] to-[#FFF3EA] rounded-t-xl">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Course Structure Preview</h2>
                                <p className="text-sm text-gray-600 mt-1">
                                    {selectedCourse?.courseName} - Complete hierarchy view
                                </p>
                            </div>
                            <button
                                onClick={() => setShowMainFullPreviewDialog(false)}
                                className="p-2 bg-red-500 hover:bg-red-600 rounded-md cursor-pointer transition-colors"
                                title="Close preview"
                            >
                                <X className="w-5 h-5 text-white" />
                            </button>
                        </div>

                        {/* Preview Content */}
                        <div className="flex-1 overflow-auto p-6">
                            {selectedCourse && (
                                <PreviewTable
                                    pedagogyViews={pedagogyViews}
                                    isLevelMerged={isLevelMerged}
                                    renderActivityCell={renderActivityCell}
                                    tableRows={tableRows}
                                    courseHours={courseHours}
                                    mergedCells={mergedCells}
                                    selectedCourse={selectedCourse}
                                    activityTypes={activityTypes}
                                    selectedPedagogyTypes={["iDo", "weDo", "youDo"]} // Show all pedagogy types
                                    moduleSpans={moduleSpans}
                                    subModuleSpans={subModuleSpans}
                                    topicSpans={topicSpans}
                                    exportSelections={{
                                        printPedagogy: null,
                                        hierarchy: {
                                            module: true,
                                            subModule: true,
                                            topic: true,
                                            subTopic: true,
                                            level: true,
                                        },
                                        pedagogy: {
                                            iDo: activityTypes["iDo"],
                                            weDo: activityTypes["weDo"],
                                            youDo: activityTypes["youDo"],
                                        },
                                        showSummary: false,
                                    }}
                                    isPrinting={false} onExport={function (): void {
                                        throw new Error("Function not implemented.");
                                    }} setExportSelections={function (value: React.SetStateAction<ExportSelections>): void {
                                        throw new Error("Function not implemented.");
                                    }} />
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex justify-between items-center p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
                            <div className="text-sm text-gray-600">
                                Showing all hierarchy levels for {selectedCourse?.courseName}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowMainFullPreviewDialog(false)}
                                    className="px-4 py-2 cursor-pointer text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                                >
                                    Close
                                </button>

                            </div>
                        </div>
                    </div>
                </div>
            )}
            <Toaster
                position="top-right"
                duration={4000}
                expand={false}
                richColors
                closeButton
            />
        </div>
    )
}
