"use client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import React from "react"
import { motion } from "framer-motion";
import {
    AlertTriangle,
    ChevronRight,
    Loader2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type {
  ExportSelections,
  
} from "./types"
import { popupVariants } from "./constants"
import LevelMultiSelect from "./LevelMultiSelect"
import PreviewTable from "./PreviewTable"
import PrintOptionsBar from "./PrintOptionsBar"

export interface PedagogyDialogsDeps {
    activateGlobalDeleteMode?: any;
    activityTypes?: any;
    addOnlyPedagogyLevel?: any;
    areAllModuleTopicsCompleted?: any;
    areAllSubModulesCompleted?: any;
    arraysEqual?: any;
    calculateSectionTotal?: any;
    calculateTotalHours?: any;
    clearLevelMergeSelections?: any;
    clearPedagogyMergeSelections?: any;
    confirmLevelMerge?: any;
    confirmMultipleDelete?: any;
    courseHours?: any;
    currentMergeActivity?: any;
    deleteLevelMutation?: any;
    deleteMode?: any;
    dialogType?: any;
    disableAddonlyMode?: any;
    editLevelMergeSelections?: any;
    editMode?: any;
    editPedagogyMergeSelections?: any;
    editingLevel?: any;
    editingMerge?: any;
    errorMessage?: any;
    expandedModules?: any;
    expandedSubModules?: any;
    expandedTopics?: any;
    exportSelections?: any;
    exportToExcel?: any;
    getCourseSkillSet?: any;
    getHeaderText?: any;
    getLevelMergeSelectionCount?: any;
    handleLevelSave?: any;
    handleModuleFormChange?: any;
    handleModuleSubmit?: any;
    handlePedagogySave?: any;
    handlePrint?: any;
    handleSkillSetChange?: any;
    handleSubModuleFormChange?: any;
    handleSubModuleSubmit?: any;
    handleSubTopicFormChange?: any;
    handleSubTopicSubmit?: any;
    handleTopicFormChange?: any;
    handleTopicSubmit?: any;
    hasActualMergeSelection?: any;
    hasPedagogyHoursGreaterThanZero?: any;
    isConfirmMultiDelete?: any;
    isCreatingModule?: any;
    isCreatingSubModule?: any;
    isCreatingSubTopic?: any;
    isCreatingTopic?: any;
    isLastHierarchy?: any;
    isLevelDelete?: any;
    isLevelMergeSave?: any;
    isLevelMerged?: any;
    isLevelSave?: any;
    isMergeSectionOpen?: any;
    isNewLevel?: any;
    levelToDelete?: any;
    levelsData?: any;
    mergeEditError?: any;
    mergeLevelValue?: any;
    mergedCells?: any;
    moduleFormData?: any;
    moduleSpans?: any;
    moduleTestConfig?: any;
    modules?: any;
    pedagogyFormData?: any;
    pedagogyHours?: any;
    pedagogyViews?: any;
    renderActivityCell?: any;
    resetAllFormStates?: any;
    saveLevelMergeSelections?: any;
    savePedagogyMergeSelections?: any;
    savedLevelMergeSelections?: any;
    savedPedagogyMergeSelections?: any;
    selected?: any;
    selectedCourse?: any;
    selectedLevel?: any;
    selectedLevelModulesForMerge?: any;
    selectedLevelSubModulesForMerge?: any;
    selectedLevelSubTopicsForMerge?: any;
    selectedLevelTopicsForMerge?: any;
    selectedModuleForSubModule?: any;
    selectedPedagogyActivities?: any;
    selectedPedagogyModulesForMerge?: any;
    selectedPedagogySubModulesForMerge?: any;
    selectedPedagogySubTopicsForMerge?: any;
    selectedPedagogyTopicsForMerge?: any;
    selectedPedagogyTypes?: any;
    selectedSubModuleForTopic?: any;
    setAddOnlyPedagogyLevel?: any;
    setCurrentMergeActivity?: any;
    setEditingLevel?: any;
    setEditingMerge?: any;
    setErrorMessage?: any;
    setExpandedModules?: any;
    setExpandedSubModules?: any;
    setExpandedTopics?: any;
    setExportSelections?: any;
    setIsLevelDelete?: any;
    setLevelToDelete?: any;
    setMergeEditError?: any;
    setMergeLevelValue?: any;
    setMergeSelectionMode?: any;
    setPedagogyFormData?: any;
    setPedagogyHours?: any;
    setPendingLevelMerge?: any;
    setSelectedLevel?: any;
    setSelectedLevelModulesForMerge?: any;
    setSelectedLevelSubModulesForMerge?: any;
    setSelectedLevelSubTopicsForMerge?: any;
    setSelectedLevelTopicsForMerge?: any;
    setSelectedMergeCells?: any;
    setSelectedPedagogyActivities?: any;
    setSelectedPedagogyModulesForMerge?: any;
    setSelectedPedagogySubModulesForMerge?: any;
    setSelectedPedagogySubTopicsForMerge?: any;
    setSelectedPedagogyTopicsForMerge?: any;
    setShowDeleteConfirmation?: any;
    setShowDialog?: any;
    setShowErrorDialog?: any;
    setShowFullPreviewDialog?: any;
    setShowInstructions?: any;
    setShowLevelDeleteConfirmation?: any;
    setShowLevelDialog?: any;
    setShowLevelSection?: any;
    setShowMergeLevelDialog?: any;
    setShowMergeLevelSection?: any;
    setShowMergePedagogySection?: any;
    setShowMultipleDeleteDialog?: any;
    setShowPedagogyDialog?: any;
    setShowPedagogySection?: any;
    setShowPreviewDialog?: any;
    setShowSummaryDialog?: any;
    shouldShowPedagogyLevelToggle?: any;
    showDeleteConfirmation?: any;
    showDialog?: any;
    showErrorDialog?: any;
    showFullPreviewDialog?: any;
    showInstructions?: any;
    showLevelDeleteConfirmation?: any;
    showLevelDialog?: any;
    showLevelSection?: any;
    showMergeLevelDialog?: any;
    showMergeLevelSection?: any;
    showMergePedagogySection?: any;
    showMultipleDeleteDialog?: any;
    showPedagogyDialog?: any;
    showPedagogySection?: any;
    showPreviewDialog?: any;
    showSummaryDialog?: any;
    sortedModules?: any;
    sortedSubModules?: any;
    sortedSubTopics?: any;
    sortedTopics?: any;
    subModuleFormData?: any;
    subModuleSpans?: any;
    subModules?: any;
    subTopicFormData?: any;
    subTopics?: any;
    tableRows?: any;
    toggleExpansion?: any;
    topicFormData?: any;
    topicSpans?: any;
    topicSubTopics?: any;
    topics?: any;
    updateMergedPedagogy?: any;
}

export function renderErrorDialog(deps: PedagogyDialogsDeps) {
    const { errorMessage, setMergeSelectionMode, setSelectedMergeCells, setShowErrorDialog, showErrorDialog } = deps
    return (
                <Dialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
                    <DialogContent className="sm:max-w-md">
                        <motion.div
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            variants={popupVariants}
                        >
                            <DialogHeader>
                                <DialogTitle className="text-red-600 flex items-center gap-2">
                                    <AlertTriangle className="w-5 h-5" />
                                    Error
                                </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                                <p className="text-sm text-gray-600">{errorMessage}</p>
                                <div className="flex justify-end">
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setShowErrorDialog(false)
                                            setMergeSelectionMode(null);
                                            setSelectedMergeCells(new Set());
                                        }}
                                    >
                                        OK
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    </DialogContent>
                </Dialog>
    )
}

export function renderSummaryDialog(deps: PedagogyDialogsDeps) {
    const { activityTypes, calculateSectionTotal, calculateTotalHours, setShowSummaryDialog, showSummaryDialog } = deps
    return (
                <Dialog open={showSummaryDialog} onOpenChange={setShowSummaryDialog}>
                    <DialogContent className="sm:max-w-2xl" onInteractOutside={(e) => e.preventDefault()}>
                        <motion.div
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            variants={popupVariants}
                        >
                            <DialogHeader>
                                <DialogTitle className="text-lg font-semibold text-gray-800">Pedagogy Hours Summary</DialogTitle>
                            </DialogHeader>
                            <div className="max-h-[70vh] overflow-auto">
                                <Table className="border">
                                    <TableHeader>
                                        <TableRow className="bg-gray-100 hover:bg-gray-100">
                                            <TableHead className="w-[200px] border font-medium text-gray-700">Activity Type</TableHead>
                                            <TableHead className="w-[200px] border font-medium text-gray-700">Elements</TableHead>
                                            <TableHead className="border font-medium text-gray-700">Hours</TableHead>
                                            <TableHead className="w-[150px] border font-medium text-gray-700">Section Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {/* I Do Section */}
                                        {activityTypes["iDo"].map((activity: any, index: any) => (
                                            <TableRow key={`summary-iDo-${activity}`} className="hover:bg-yellow-50">
                                                {index === 0 && (
                                                    <TableCell className="font-semibold border bg-yellow-100 text-yellow-800" rowSpan={activityTypes["iDo"].length}>
                                                        I Do
                                                    </TableCell>
                                                )}
                                                <TableCell className="border pl-8 text-gray-700">{activity}</TableCell>
                                                <TableCell className="border text-gray-700">
                                                    {calculateTotalHours("iDo", activity)}
                                                </TableCell>
                                                {index === 0 && (
                                                    <TableCell className="font-semibold border bg-yellow-100 text-yellow-800" rowSpan={activityTypes["iDo"].length}>
                                                        {calculateSectionTotal("iDo", activityTypes["iDo"])}
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        ))}

                                        {/* We Do Section */}
                                        {activityTypes["weDo"].map((activity: any, index: any) => (
                                            <TableRow key={`summary-weDo-${activity}`} className="hover:bg-orange-50">
                                                {index === 0 && (
                                                    <TableCell className="font-semibold border bg-orange-100 text-orange-800" rowSpan={activityTypes["weDo"].length}>
                                                        We Do
                                                    </TableCell>
                                                )}
                                                <TableCell className="border pl-8 text-gray-700">{activity}</TableCell>
                                                <TableCell className="border text-gray-700">
                                                    {calculateTotalHours("weDo", activity)}
                                                </TableCell>
                                                {index === 0 && (
                                                    <TableCell className="font-semibold border bg-orange-100 text-orange-800" rowSpan={activityTypes["weDo"].length}>
                                                        {calculateSectionTotal("weDo", activityTypes["weDo"])}
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        ))}

                                        {/* You Do Section */}
                                        {activityTypes["youDo"].map((activity: any, index: any) => (
                                            <TableRow key={`summary-youDo-${activity}`} className="hover:bg-green-50">
                                                {index === 0 && (
                                                    <TableCell className="font-semibold border bg-green-100 text-green-800" rowSpan={activityTypes["youDo"].length}>
                                                        You Do
                                                    </TableCell>
                                                )}
                                                <TableCell className="border pl-8 text-gray-700">{activity}</TableCell>
                                                <TableCell className="border text-gray-700">
                                                    {calculateTotalHours("youDo", activity)}
                                                </TableCell>
                                                {index === 0 && (
                                                    <TableCell className="font-semibold border bg-green-100 text-green-800" rowSpan={activityTypes["youDo"].length}>
                                                        {calculateSectionTotal("youDo", activityTypes["youDo"])}
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        ))}

                                        {/* Grand Total */}
                                        <TableRow className="bg-gray-100 hover:bg-gray-100">
                                            <TableCell className="font-semibold border text-gray-800" colSpan={3}>Total Hours</TableCell>
                                            <TableCell className="font-semibold border text-gray-800">
                                                {Object.entries(activityTypes).reduce((sum: number, [type, activities]: [string, any]) => {
                                                    return sum + activities.reduce((typeSum: any, activity: any) => {
                                                        return typeSum + calculateTotalHours(type as "iDo" | "weDo" | "youDo", activity);
                                                    }, 0);
                                                }, 0)}
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                        </motion.div>
                    </DialogContent>
                </Dialog>
    )
}

export function renderInstructionsDialog(deps: PedagogyDialogsDeps) {
    const { modules, selected, setShowInstructions, showInstructions } = deps
    return (
                <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
                    <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
                        <motion.div
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            variants={popupVariants}
                        >
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 mb-2">
                                    <div className="p-1.5 bg-[#FFE4D0] rounded-full">
                                        <svg className="w-4 h-4 text-[#F97316]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <circle cx="12" cy="12" r="10" />
                                            <circle cx="12" cy="12" r="6" />
                                            <circle cx="12" cy="12" r="2" />
                                        </svg>
                                    </div>
                                    How to use Pedagogy Management
                                </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-3">
                                <div className="bg-[#FFF3EA] border border-[#FFD9BC] rounded-lg p-4">
                                    <div className="flex items-start gap-3">
                                        <div className="text-sm">
                                            <ul className="text-gray-700 space-y-2 list-disc list-inside">
                                                <li>Click any cell to edit individual hours (Enter to save, Escape to cancel)</li>
                                                <li>Select multiple consecutive rows to merge cells</li>
                                                <li>When merging, enter the total hours for all selected items</li>
                                                <li>Merged cells count only once in totals (no double counting)</li>
                                                <li>Use "Full View" for table fullscreen and drag zoom controls to reposition</li>
                                                <li>Enable "Actions" to add/edit/delete modules and their contents</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end pt-2">
                                    <Button
                                        size="sm"
                                        onClick={() => setShowInstructions(false)}
                                    >
                                        Got it!
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    </DialogContent>
                </Dialog>
    )
}

export function renderEditingMergeDialog(deps: PedagogyDialogsDeps) {
    const { editingMerge, mergeEditError, setEditingMerge, setMergeEditError, updateMergedPedagogy } = deps
    return (
                <Dialog open={!!editingMerge} onOpenChange={(open) => {
                    if (!open) {
                        setEditingMerge(null);
                        setMergeEditError("");
                    }
                }}>
                    <DialogContent className="w-[95vw] max-w-md mx-auto sm:w-full sm:max-w-md md:max-w-lg lg:max-w-xl">
                        <motion.div
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            variants={popupVariants}
                        >
                            <DialogHeader className="pb-4">
                                <DialogTitle className="text-base sm:text-lg md:text-lg text-left">
                                    Edit Merged Hours
                                </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 sm:space-y-6">
                                <div className="space-y-2 sm:space-y-3">
                                    <Label
                                        htmlFor="mergeHours"
                                        className="text-sm sm:text-sm font-medium block"
                                    >
                                        Total hours for {editingMerge?.activity} ({editingMerge?.type})
                                    </Label>
                                    <Input
                                        id="mergeHours"
                                        type="number"
                                        value={editingMerge?.value ?? ""}
                                        onChange={(e) => {
                                            if (editingMerge) {
                                                setEditingMerge({
                                                    ...editingMerge,
                                                    value: Number(e.target.value) || 0
                                                });
                                                setMergeEditError(""); // Clear error when user types
                                            }
                                        }}
                                        step="0.5"
                                        min="0"
                                        autoFocus
                                        className="w-full h-10 sm:h-11 md:h-10 text-sm sm:text-base px-3 sm:px-4"
                                    />
                                    {mergeEditError && (
                                        <p className="text-xs sm:text-sm text-red-500 mt-1">
                                            {mergeEditError}
                                        </p>
                                    )}
                                </div>
                                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setEditingMerge(null);
                                            setMergeEditError("");
                                        }}
                                        className="w-full sm:w-auto h-9 sm:h-9 text-sm sm:text-base px-4 sm:px-6"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={() => {
                                            if (editingMerge) {
                                                updateMergedPedagogy.mutate({
                                                    type: editingMerge.type,
                                                    activity: editingMerge.activity,
                                                    value: editingMerge.value,
                                                    mergeIndex: editingMerge.mergeIndex,
                                                    hierarchyIds: editingMerge.hierarchyIds
                                                });
                                                setEditingMerge(null);
                                            }
                                        }}
                                        disabled={updateMergedPedagogy.isPending}
                                        className="w-full sm:w-auto h-9 sm:h-9 text-sm sm:text-base px-4 sm:px-6"
                                    >
                                        {updateMergedPedagogy.isPending ? "Saving..." : "Save Changes"}
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    </DialogContent>
                </Dialog>
    )
}

export function renderPreviewDialog(deps: PedagogyDialogsDeps) {
    const { activityTypes, courseHours, exportSelections, exportToExcel, handlePrint, isLevelMerged, mergedCells, moduleSpans, pedagogyViews, renderActivityCell, selected, selectedCourse, selectedPedagogyTypes, setExportSelections, setShowPreviewDialog, showPreviewDialog, subModuleSpans, tableRows, topicSpans } = deps
    return (
                <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
                    <DialogContent className="max-w-[98vw] max-h-[98vh] p-0 flex flex-col" onInteractOutside={(e) => e.preventDefault()}>
                        <motion.div
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            variants={popupVariants}
                            className="max-w-[98vw] max-h-[98vh] p-0 flex flex-col"
                        >
                            <DialogHeader className="p-4 pb-2 shrink-0">
                                <DialogTitle className="text-sm font-semibold">
                                    Pedagogy Preview - {selectedCourse?.courseName}
                                </DialogTitle>
                            </DialogHeader>

                            {/* Print / export options: one row of dropdowns (PrintOptionsBar).
                                relative z-40: backdrop-blur makes this its own stacking
                                context, so its open panels must out-rank the table's
                                sticky header (z-30) below. */}
                            <div className="relative z-40 px-4 py-2 border-b bg-slate-50/80 backdrop-blur-sm">
                                <PrintOptionsBar
                                    exportSelections={exportSelections}
                                    setExportSelections={setExportSelections}
                                    activityTypes={activityTypes}
                                    selectedPedagogyTypes={selectedPedagogyTypes}
                                    selectedCourse={selectedCourse}
                                    handlePrint={handlePrint}
                                    exportToExcel={exportToExcel}
                                />
                            </div>

                            <div className="overflow-auto p-4 pt-2">
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
                                    setExportSelections={setExportSelections as React.Dispatch<
                                        React.SetStateAction<ExportSelections>
                                    >}
                                    onExport={exportToExcel}
                                    isPrinting={true}
                                />
                            </div>
                        </motion.div>
                    </DialogContent>
                </Dialog>
    )
}

export function renderFullPreviewDialog(deps: PedagogyDialogsDeps) {
    const { activityTypes, courseHours, exportSelections, isLevelMerged, mergedCells, moduleSpans, pedagogyViews, renderActivityCell, selectedCourse, selectedPedagogyTypes, setExportSelections, setShowFullPreviewDialog, showFullPreviewDialog, subModuleSpans, tableRows, topicSpans } = deps
    return (
                <Dialog open={showFullPreviewDialog} onOpenChange={setShowFullPreviewDialog}>
                    <DialogContent className="max-w-[98vw] max-h-[98vh] p-0 flex flex-col" onInteractOutside={(e) => e.preventDefault()}>
                        <motion.div
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            variants={popupVariants}
                            className="max-w-[98vw] max-h-[98vh] p-0 flex flex-col"
                        >
                            <DialogHeader className="p-4 pb-2 shrink-0 flex justify-between items-center">
                                <DialogTitle className="text-sm font-semibold">
                                    Full Table Preview - {selectedCourse?.courseName}
                                </DialogTitle>
                            </DialogHeader>

                            <div className="overflow-auto p-4 pt-2">
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
                            </div>
                        </motion.div>
                    </DialogContent>
                </Dialog>
    )
}

export function renderLevelDialog(deps: PedagogyDialogsDeps) {
    const { arraysEqual, editingLevel, handleLevelSave, isLevelSave, isNewLevel, levelsData, setEditingLevel, setLevelToDelete, setShowLevelDeleteConfirmation, setShowLevelDialog, showLevelDialog } = deps
    return (
            <Dialog open={showLevelDialog} onOpenChange={setShowLevelDialog}>
                <DialogContent className="sm:max-w-[425px]" onInteractOutside={(e) => e.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle>
                            {editingLevel?.id === 'merged'
                                ? "Edit Merged Level"
                                : isNewLevel
                                    ? "Add Level"
                                    : "Edit Level"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="level" className="text-xs font-medium">
                                Level*
                            </Label>
                            <LevelMultiSelect
                                value={editingLevel?.level || ''}
                                onChange={(value) => {
                                    if (editingLevel) {
                                        setEditingLevel({
                                            ...editingLevel,
                                            level: value
                                        });
                                    }
                                }}
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-4">
                            {/* Show delete button only if there's an existing value (not for new entries) */}
                            {!isNewLevel && editingLevel?.level && (
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => {
                                        // For merged levels, use the editingLevel data directly
                                        if (editingLevel?.id === 'merged') {
                                            setLevelToDelete({
                                                id: 'merged',
                                                level: editingLevel.level,
                                                hierarchy: editingLevel.hierarchy
                                            });
                                        } else {
                                            // For individual levels, find the exact level data from levelsData
                                            const foundLevel = levelsData.find((l: any) =>
                                                l._id === editingLevel?.id ||
                                                (arraysEqual(l.module || [], editingLevel?.hierarchy.module || []) &&
                                                    arraysEqual(l.subModule || [], editingLevel?.hierarchy.subModule || []) &&
                                                    arraysEqual(l.topic || [], editingLevel?.hierarchy.topic || []) &&
                                                    arraysEqual(l.subTopic || [], editingLevel?.hierarchy.subTopic || []) &&
                                                    l.level === editingLevel?.level)
                                            );

                                            if (foundLevel) {
                                                setLevelToDelete({
                                                    id: foundLevel._id,
                                                    level: foundLevel.level,
                                                    hierarchy: {
                                                        module: foundLevel.module || [],
                                                        subModule: foundLevel.subModule || [],
                                                        topic: foundLevel.topic || [],
                                                        subTopic: foundLevel.subTopic || []
                                                    }
                                                });
                                            } else {
                                                // Fallback - use editingLevel data
                                                setLevelToDelete({
                                                    id: editingLevel?.id || '',
                                                    level: editingLevel?.level || '',
                                                    hierarchy: editingLevel?.hierarchy || {}
                                                });
                                            }
                                        }
                                        setShowLevelDeleteConfirmation(true);
                                    }}
                                    className="text-xs h-8 cursor-pointer"
                                >
                                    Delete
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setShowLevelDialog(false)
                                }}
                                className="text-xs h-8 cursor-pointer"
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="default"
                                size="sm"
                                onClick={handleLevelSave}
                                disabled={!editingLevel?.level}
                                className="text-xs h-8 cursor-pointer"
                            >
                                {isLevelSave ? (isNewLevel ? "Adding..." : "Saving...") : (isNewLevel ? "Add" : "Save")}

                            </Button>

                        </div>
                    </div>
                </DialogContent>
            </Dialog>
    )
}

export function renderLevelDeleteDialog(deps: PedagogyDialogsDeps) {
    const { arraysEqual, deleteLevelMutation, editingLevel, isLevelDelete, levelToDelete, levelsData, selectedCourse, setErrorMessage, setIsLevelDelete, setLevelToDelete, setShowErrorDialog, setShowLevelDeleteConfirmation, setShowLevelDialog, showLevelDeleteConfirmation } = deps
    return (
            <Dialog open={showLevelDeleteConfirmation} onOpenChange={setShowLevelDeleteConfirmation}>
                <DialogContent className="sm:max-w-md min-h-[40vh]" onInteractOutside={(e) => e.preventDefault()}>
                    <motion.div
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        variants={popupVariants}
                    >
                        <DialogHeader className="space-y-3 pb-4">
                            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-red-500" />
                                Confirm Level Deletion
                            </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-6">
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-amber-800">
                                            Are you sure you want to delete this level?
                                        </p>
                                        <p className="text-xs text-amber-700">
                                            This action cannot be undone and will permanently remove the level assignment.
                                        </p>
                                    </div>
                                </div>
                            </div>


                            {levelToDelete && (
                                <div className="grid gap-2">
                                    {/* Level Value */}
                                    <div className="flex items-center justify-between py-2 px-3 bg-white rounded border">
                                        <span className="text-xs font-medium text-gray-600">Level:</span>
                                        <span className="text-xs font-semibold text-gray-900 bg-[#FFE4D0] text-[#9A3F0A] px-2 py-1 rounded-full">
                                            {levelToDelete?.level || editingLevel?.level || 'Not Set'}
                                        </span>
                                    </div>


                                </div>
                            )}

                            <div className="flex justify-end gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowLevelDeleteConfirmation(false)}
                                    className="cursor-pointer"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={async () => {
                                        if (!levelToDelete || !selectedCourse) return;
                                        setIsLevelDelete(true);
                                        try {
                                            // Filter placeholder IDs from the level to delete
                                            const filterPlaceholders = (ids: string[] = []) => {
                                                return ids.filter(id => id && !id.includes('placeholder'));
                                            };

                                            const filteredHierarchy = {
                                                module: filterPlaceholders(levelToDelete.hierarchy.module),
                                                subModule: filterPlaceholders(levelToDelete.hierarchy.subModule),
                                                topic: filterPlaceholders(levelToDelete.hierarchy.topic),
                                                subTopic: filterPlaceholders(levelToDelete.hierarchy.subTopic)
                                            };

                                            // Find the exact level to delete using filtered hierarchy
                                            const levelData = levelsData.find((l: any) => {
                                                const levelModules = filterPlaceholders(l.module || []);
                                                const levelSubModules = filterPlaceholders(l.subModule || []);
                                                const levelTopics = filterPlaceholders(l.topic || []);
                                                const levelSubTopics = filterPlaceholders(l.subTopic || []);

                                                return (
                                                    arraysEqual(levelModules, filteredHierarchy.module) &&
                                                    arraysEqual(levelSubModules, filteredHierarchy.subModule) &&
                                                    arraysEqual(levelTopics, filteredHierarchy.topic) &&
                                                    arraysEqual(levelSubTopics, filteredHierarchy.subTopic) &&
                                                    l.level === levelToDelete.level
                                                );
                                            });

                                            if (levelData?._id) {
                                                await deleteLevelMutation.mutateAsync(levelData._id);
                                                setShowLevelDeleteConfirmation(false);
                                                setShowLevelDialog(false);
                                                setLevelToDelete(null);
                                            } else {
                                                setErrorMessage("Level not found for deletion");
                                                setShowErrorDialog(true);
                                            }
                                        } catch (error) {
                                            console.error("Failed to delete level:", error);
                                            setErrorMessage(error instanceof Error ? error.message : "Failed to delete level");
                                            setShowErrorDialog(true);
                                        } finally {
                                            setIsLevelDelete(false);
                                        }
                                    }}
                                    className="cursor-pointer"
                                >
                                    {isLevelDelete ? "Deleting..." : "Delete Level"}
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                </DialogContent>
            </Dialog>
    )
}

export function renderMergeLevelDialog(deps: PedagogyDialogsDeps) {
    const { confirmLevelMerge, isLevelMergeSave, mergeLevelValue, setMergeLevelValue, setPendingLevelMerge, setShowMergeLevelDialog, showMergeLevelDialog } = deps
    return (
            <Dialog open={showMergeLevelDialog} onOpenChange={(open) => {
                if (!open) {
                    setShowMergeLevelDialog(false);
                    setPendingLevelMerge(null);
                    setMergeLevelValue("");
                }
            }}>
                <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle>Merge Levels</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="level" className="text-sm font-medium">
                                Select Level for Merged Cells
                            </Label>
                            <LevelMultiSelect
                                value={mergeLevelValue}
                                onChange={setMergeLevelValue}
                                placeholder="Select a level"
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-4">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setShowMergeLevelDialog(false);
                                    setPendingLevelMerge(null);
                                    setMergeLevelValue("");
                                }}
                                className="cursor-pointer"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={confirmLevelMerge}
                                disabled={!mergeLevelValue}
                                className="cursor-pointer"
                            >
                                {(isLevelMergeSave ? "Merging..." : "Merge Levels")}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
    )
}

export function renderMultipleDeleteDialog(deps: PedagogyDialogsDeps) {
    const { activateGlobalDeleteMode, selectedCourse, setShowMultipleDeleteDialog, showMultipleDeleteDialog, sortedModules, sortedSubModules, sortedSubTopics, sortedTopics } = deps
    return (
                <Dialog open={showMultipleDeleteDialog} onOpenChange={setShowMultipleDeleteDialog}>
                    <DialogContent className="sm:max-w-md max-w-[95vw] rounded-xl shadow-lg border border-gray-200" onInteractOutside={(e) => e.preventDefault()}>
                        <motion.div
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            variants={popupVariants}
                        >
                            {/* Header */}
                            <DialogHeader className="border-b pb-3">
                                <DialogTitle className="text-lg font-semibold text-gray-800">
                                    Multiple Delete
                                </DialogTitle>
                                <DialogDescription className="text-sm text-gray-500">
                                    Select the type of items you want to delete
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4 p-4">
                                {/* Type Selection */}
                                <div className="space-y-3">
                                    <h4 className="text-sm font-medium text-gray-700">Select Item Type:</h4>
                                    <div className="grid grid-cols-1 gap-2">
                                        {selectedCourse?.courseHierarchy.map((level: any) => {
                                            const normalizedLevel = level
                                                .toLowerCase()
                                                .replace(" ", "") as "module" | "submodule" | "topic" | "subtopic";
                                            const items = {
                                                module: sortedModules,
                                                submodule: sortedSubModules,
                                                topic: sortedTopics,
                                                subtopic: sortedSubTopics
                                            }[normalizedLevel];

                                            if (!items || items.length === 0) return null;

                                            return (
                                                <button
                                                    key={level}
                                                    onClick={() => activateGlobalDeleteMode(normalizedLevel)}
                                                    className="flex items-center justify-between p-3 border rounded-lg cursor-pointer transition hover:bg-[#FFF3EA] hover:border-[#FDBA74] bg-white"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-medium text-gray-700">
                                                            {level}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-gray-500">{items.length} items</span>
                                                        <ChevronRight className="w-4 h-4 text-gray-400" />
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex justify-end pt-2">
                                    <Button
                                        variant="ghost"
                                        onClick={() => setShowMultipleDeleteDialog(false)}
                                        className="text-sm"
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    </DialogContent>
                </Dialog>
    )
}

export function renderPedagogyDialog(deps: PedagogyDialogsDeps) {
    const { handlePedagogySave, pedagogyFormData, setPedagogyFormData, setShowPedagogyDialog, showPedagogyDialog } = deps
    return (
            <Dialog open={showPedagogyDialog} onOpenChange={(open) => {
                if (!open) {
                    setShowPedagogyDialog(false);
                    setPedagogyFormData(null);
                }
            }}>
                <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle>
                            {pedagogyFormData?.isEditing ? "Edit Pedagogy Hours" : "Add Pedagogy Hours"}
                        </DialogTitle>
                        <DialogDescription>
                            {pedagogyFormData?.activity} ({pedagogyFormData?.type})
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="hours" className="text-sm font-medium">
                                Hours
                            </Label>
                            <Input
                                type="number"
                                id="hours"
                                value={pedagogyFormData?.value || ""}
                                onChange={(e) => setPedagogyFormData((prev: any) => prev ? { ...prev, value: e.target.value } : null)}
                                placeholder="Enter hours (e.g., 2.5)"
                                step="0.5"
                                min="0"
                                className="w-full"
                                autoFocus
                            />
                            <p className="text-xs text-gray-500">
                                Enter the number of hours for this activity (must be greater than 0)
                            </p>
                        </div>

                        <div className="flex justify-between items-center">
                            <div className="flex justify-end gap-2 ml-auto">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setShowPedagogyDialog(false);
                                        setPedagogyFormData(null);
                                    }}
                                    className="cursor-pointer"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handlePedagogySave}
                                    disabled={!pedagogyFormData?.value || parseFloat(pedagogyFormData.value) <= 0}
                                    className="disabled:cursor-not-allowed cursor-pointer"
                                >
                                    {pedagogyFormData?.isEditing ? "Update" : "Add"}
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
    )
}

export function renderDeleteConfirmationDialog(deps: PedagogyDialogsDeps) {
    const { confirmMultipleDelete, deleteMode, isConfirmMultiDelete, modules, selected, setShowDeleteConfirmation, showDeleteConfirmation, subModules, subTopics, topics } = deps
    return (
                <Dialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
                    <DialogContent className="sm:max-w-md max-w-[95vw] rounded-xl shadow-lg border border-gray-200">
                        <motion.div
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            variants={popupVariants}
                        >
                            {/* Header */}
                            <DialogHeader className="border-b pb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                                        <AlertTriangle className="w-5 h-5 text-red-600" />
                                    </div>
                                    <div>
                                        <DialogTitle className="text-lg font-semibold text-gray-800">
                                            Confirm Deletion
                                        </DialogTitle>
                                        <DialogDescription className="text-sm text-gray-500">
                                            This action cannot be undone
                                        </DialogDescription>
                                    </div>
                                </div>
                            </DialogHeader>

                            <div className="space-y-4 p-4">
                                {/* Warning Message */}
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <p className="text-sm font-medium text-red-800">
                                                You are about to delete {deleteMode.selectedItems.size} {deleteMode.type}(s)
                                            </p>
                                            <p className="text-xs text-red-600 mt-1">
                                                This will permanently remove the selected items and all associated data.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Selected Items Preview (if few items) */}
                                {deleteMode.selectedItems.size <= 5 && (
                                    <div className="bg-gray-50 rounded-lg p-3">
                                        <p className="text-xs font-medium text-gray-700 mb-2">Selected items:</p>
                                        <div className="space-y-1 max-h-20 overflow-y-auto">
                                            {Array.from(deleteMode.selectedItems).map((itemId, index) => {
                                                let itemName = "";
                                                switch (deleteMode.type) {
                                                    case 'module':
                                                        const module = modules.find((m: any) => m._id === itemId);
                                                        itemName = module?.title || "Unknown Module";
                                                        break;
                                                    case 'submodule':
                                                        const subModule = subModules.find((sm: any) => sm._id === itemId);
                                                        itemName = subModule?.title || "Unknown SubModule";
                                                        break;
                                                    case 'topic':
                                                        const topic = topics.find((t: any) => t._id === itemId);
                                                        itemName = topic?.title || "Unknown Topic";
                                                        break;
                                                    case 'subtopic':
                                                        const subtopic = subTopics.find((st: any) => st._id === itemId);
                                                        itemName = subtopic?.title || "Unknown Subtopic";
                                                        break;
                                                }
                                                return (
                                                    <div key={itemId as any} className="flex items-center gap-2 text-xs text-gray-600">
                                                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                                                        <span className="truncate">{itemName}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex gap-3 pt-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => setShowDeleteConfirmation(false)}
                                        className="flex-1 text-sm border-gray-300 hover:bg-gray-50"
                                        disabled={isConfirmMultiDelete}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        onClick={confirmMultipleDelete}
                                        disabled={isConfirmMultiDelete}
                                        className="flex-1 text-sm bg-red-600 hover:bg-red-700 transition-all"
                                    >
                                        {isConfirmMultiDelete ? (
                                            <div className="flex items-center gap-2">
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Deleting...
                                            </div>
                                        ) : (
                                            `Yes, Delete ${deleteMode.selectedItems.size} Items`
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    </DialogContent>
                </Dialog>
    )
}
