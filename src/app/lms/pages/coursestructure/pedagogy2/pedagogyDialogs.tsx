"use client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import React from "react"
import { motion } from "framer-motion";
import {
    X,
    AlertTriangle,
    ChevronDown,
    FileText,
    Printer,
    User,
    Users,
    Presentation,
    ChevronRight,
    Loader2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import DropdownSection from "@/components/ui/dropdownSection";
import type {
  ExportSelections,
  
} from "./types"
import { popupVariants } from "./constants"
import LevelMultiSelect from "./LevelMultiSelect"
import PreviewTable from "./PreviewTable"

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

                            {/* Export Controls - Reorganized Layout */}
                            <div className="px-4 py-2 border-b bg-slate-50/80 backdrop-blur-sm">
                                <div className="flex items-start justify-between gap-4">
                                    {/* Conditional Layout Based on Teaching Elements */}
                                    {(selectedPedagogyTypes.includes("iDo") || selectedPedagogyTypes.includes("weDo") || selectedPedagogyTypes.includes("youDo")) ? (
                                        <>
                                            {/* Left Side - Course Hierarchy & Export Options when Teaching Elements exist */}
                                            <div className="flex flex-col gap-2 min-w-[30vw]">
                                                <div className="flex gap-4">
                                                    {/* Course Hierarchy Card */}
                                                    <div className="bg-white rounded-md p-3 shadow-sm border border-slate-200 flex-1">
                                                        {/* Top row with heading + include total hours on the right */}
                                                        <div className="flex items-center mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-[#F97316]"></div>
                                                                <h3 className="text-xs font-semibold text-slate-700">Course Hierarchy</h3>
                                                            </div>

                                                            {/* ✅ Include Total Hours pill on right */}
                                                            <label
                                                                // className="ml-auto flex items-center gap-1 px-2 py-1 text-xs rounded border border-[#FFD9BC] bg-[#FFF3EA] hover:bg-[#FFE4D0] hover:border-[#FB923C] cursor-pointer transition-colors"
                                                                className={`ml-auto flex items-center gap-1 px-2 py-1 text-xs rounded border transition-colors
                  ${(Array.isArray(exportSelections.pedagogy.iDo) &&
                                                                        exportSelections.pedagogy.iDo.length === activityTypes["iDo"].length ||
                                                                        !selectedPedagogyTypes.includes("iDo")) &&
                                                                        (Array.isArray(exportSelections.pedagogy.weDo) &&
                                                                            exportSelections.pedagogy.weDo.length === activityTypes["weDo"].length ||
                                                                            !selectedPedagogyTypes.includes("weDo")) &&
                                                                        (Array.isArray(exportSelections.pedagogy.youDo) &&
                                                                            exportSelections.pedagogy.youDo.length === activityTypes["youDo"].length ||
                                                                            !selectedPedagogyTypes.includes("youDo"))
                                                                        ? "border-[#FFD9BC] bg-[#FFF3EA] hover:bg-[#FFE4D0] hover:border-[#FB923C] cursor-pointer text-[#F97316]"
                                                                        : "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
                                                                    }`}
                                                            >
                                                                <Checkbox
                                                                    checked={exportSelections.includeTotalHours}

                                                                    onCheckedChange={(checked) => {
                                                                        setExportSelections((prev: any) => ({
                                                                            ...prev,
                                                                            includeTotalHours: !!checked,
                                                                        }));
                                                                    }}
                                                                    className="h-3 w-3 rounded border transition-colors"
                                                                />
                                                                <span className=" font-medium">Include Total Hours</span>
                                                            </label>
                                                        </div>

                                                        {/* Checkboxes below */}
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {/* All checkbox */}
                                                            <label className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-slate-200 hover:bg-[#FFF3EA] hover:border-[#FDBA74] cursor-pointer transition-colors">
                                                                <Checkbox
                                                                    id="export-all"
                                                                    checked={
                                                                        (!selectedCourse?.courseHierarchy.includes("Module") ||
                                                                            exportSelections.hierarchy.module) &&
                                                                        (!selectedCourse?.courseHierarchy.includes("Sub Module") ||
                                                                            exportSelections.hierarchy.subModule) &&
                                                                        (!selectedCourse?.courseHierarchy.includes("Topic") ||
                                                                            exportSelections.hierarchy.topic) &&
                                                                        (!selectedCourse?.courseHierarchy.includes("Sub Topic") ||
                                                                            exportSelections.hierarchy.subTopic)
                                                                    }
                                                                    onCheckedChange={(checked) => {
                                                                        const allChecked = !!checked;
                                                                        setExportSelections((prev: { hierarchy: { module: any; subModule: any; topic: any; subTopic: any; level: any; }; }) => ({
                                                                            ...prev,
                                                                            hierarchy: {
                                                                                module: selectedCourse?.courseHierarchy.includes("Module")
                                                                                    ? allChecked
                                                                                    : prev.hierarchy.module,
                                                                                subModule: selectedCourse?.courseHierarchy.includes("Sub Module")
                                                                                    ? allChecked
                                                                                    : prev.hierarchy.subModule,
                                                                                topic: selectedCourse?.courseHierarchy.includes("Topic")
                                                                                    ? allChecked
                                                                                    : prev.hierarchy.topic,
                                                                                subTopic: selectedCourse?.courseHierarchy.includes("Sub Topic")
                                                                                    ? allChecked
                                                                                    : prev.hierarchy.subTopic,
                                                                                level: prev.hierarchy.level,
                                                                            },
                                                                        }));
                                                                    }}
                                                                    className="h-3 w-3"
                                                                />
                                                                <span className="text-slate-600">All</span>
                                                            </label>

                                                            {/* Module */}
                                                            {selectedCourse?.courseHierarchy.includes("Module") && (
                                                                <label className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-slate-200 hover:bg-[#FFF3EA] hover:border-[#FDBA74] cursor-pointer transition-colors">
                                                                    <Checkbox
                                                                        id="export-module"
                                                                        checked={exportSelections.hierarchy.module}
                                                                        onCheckedChange={(checked) =>
                                                                            setExportSelections((prev: { hierarchy: any; }) => ({
                                                                                ...prev,
                                                                                hierarchy: { ...prev.hierarchy, module: !!checked },
                                                                            }))
                                                                        }
                                                                        className="h-3 w-3"
                                                                    />
                                                                    <span className="text-slate-600">Module</span>
                                                                </label>
                                                            )}

                                                            {/* Sub Module */}
                                                            {selectedCourse?.courseHierarchy.includes("Sub Module") && (
                                                                <label className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-slate-200 hover:bg-[#FFF3EA] hover:border-[#FDBA74] cursor-pointer transition-colors">
                                                                    <Checkbox
                                                                        id="export-submodule"
                                                                        checked={exportSelections.hierarchy.subModule}
                                                                        onCheckedChange={(checked) =>
                                                                            setExportSelections((prev: { hierarchy: any; }) => ({
                                                                                ...prev,
                                                                                hierarchy: { ...prev.hierarchy, subModule: !!checked },
                                                                            }))
                                                                        }
                                                                        className="h-3 w-3"
                                                                    />
                                                                    <span className="text-slate-600">Sub Module</span>
                                                                </label>
                                                            )}

                                                            {/* Topic */}
                                                            {selectedCourse?.courseHierarchy.includes("Topic") && (
                                                                <label className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-slate-200 hover:bg-[#FFF3EA] hover:border-[#FDBA74] cursor-pointer transition-colors">
                                                                    <Checkbox
                                                                        id="export-topic"
                                                                        checked={exportSelections.hierarchy.topic}
                                                                        onCheckedChange={(checked) =>
                                                                            setExportSelections((prev: { hierarchy: any; }) => ({
                                                                                ...prev,
                                                                                hierarchy: { ...prev.hierarchy, topic: !!checked },
                                                                            }))
                                                                        }
                                                                        className="h-3 w-3"
                                                                    />
                                                                    <span className="text-slate-600">Topic</span>
                                                                </label>
                                                            )}

                                                            {/* Sub Topic */}
                                                            {selectedCourse?.courseHierarchy.includes("Sub Topic") && (
                                                                <label className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-slate-200 hover:bg-[#FFF3EA] hover:border-[#FDBA74] cursor-pointer transition-colors">
                                                                    <Checkbox
                                                                        id="export-subtopic"
                                                                        checked={exportSelections.hierarchy.subTopic}
                                                                        onCheckedChange={(checked) =>
                                                                            setExportSelections((prev: { hierarchy: any; }) => ({
                                                                                ...prev,
                                                                                hierarchy: { ...prev.hierarchy, subTopic: !!checked },
                                                                            }))
                                                                        }
                                                                        className="h-3 w-3"
                                                                    />
                                                                    <span className="text-slate-600">Sub Topic</span>
                                                                </label>
                                                            )}
                                                        </div>
                                                    </div>


                                                    {/* Level Card */}
                                                    <div className="bg-white rounded-md p-3 shadow-sm border border-slate-200 w-40">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                                                            <h3 className="text-xs font-semibold text-slate-700">Level</h3>
                                                        </div>

                                                        <label className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-slate-200 hover:bg-green-50 hover:border-green-300 cursor-pointer transition-colors">
                                                            <Checkbox
                                                                id="export-level"
                                                                checked={exportSelections.hierarchy.level}
                                                                onCheckedChange={(checked) =>
                                                                    setExportSelections((prev: { hierarchy: any; }) => ({
                                                                        ...prev,
                                                                        hierarchy: { ...prev.hierarchy, level: !!checked }
                                                                    }))
                                                                }
                                                                className="h-3 w-3"
                                                            />
                                                            <span className="text-slate-600">Level</span>
                                                        </label>
                                                    </div>
                                                </div>


                                                {/* Export Options Card */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {/* Left Card */}
                                                    <div className="bg-white rounded-md p-3 shadow-sm border border-slate-200">
                                                        <div className="flex items-center justify-between mb-2">
                                                            {/* Left section */}
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                                                                <h3 className="text-xs font-semibold text-slate-700">Options</h3>
                                                            </div>

                                                            {/* Right section (Clear button) */}
                                                            <motion.button
                                                                onClick={() => {
                                                                    setExportSelections((prev: any) => ({
                                                                        ...prev,
                                                                        hoursOption: '', // Reset to default option
                                                                    }));
                                                                }}
                                                                whileHover={{ scale: 1.05, backgroundColor: "#fee2e2" }} // light red hover
                                                                whileTap={{ scale: 0.9 }} // shrink on click
                                                                className="flex items-center gap-1 h-6 px-2 cursor-pointer text-xs font-semibold text-red-600 rounded border border-red-200 bg-red-50 transition-colors"
                                                            >
                                                                <X className="h-3 w-3" />
                                                                Clear
                                                            </motion.button>
                                                        </div>

                                                        <div className="flex flex-col gap-2 text-xs text-slate-600">

                                                            <label className="flex items-center gap-2 ">
                                                                <input
                                                                    type="radio"
                                                                    name="hoursOption"
                                                                    value="activity"
                                                                    className="h-3 w-3 cursor-pointer"
                                                                    checked={exportSelections.hoursOption === 'activity'}
                                                                    onChange={() => {
                                                                        setExportSelections((prev: any) => ({
                                                                            ...prev,
                                                                            hoursOption: 'activity'
                                                                        }));
                                                                    }}
                                                                />
                                                                <span className="font-medium cursor-pointer">Activity Hours</span>
                                                                <span className="text-xs text-slate-400">(Show category totals)</span>
                                                            </label>

                                                            <label className="flex items-center gap-2 ">
                                                                <input
                                                                    type="radio"
                                                                    name="hoursOption"
                                                                    value="element"
                                                                    className="h-3 w-3 cursor-pointer"
                                                                    checked={exportSelections.hoursOption === 'element'}
                                                                    onChange={() => {
                                                                        setExportSelections((prev: any) => ({
                                                                            ...prev,
                                                                            hoursOption: 'element'
                                                                        }));
                                                                    }}
                                                                />
                                                                <span className="font-medium cursor-pointer">Element Hours</span>
                                                                <span className="text-xs text-slate-400">(Show individual activities)</span>
                                                            </label>
                                                        </div>
                                                    </div>

                                                    {/* Right Card (Export Options) */}
                                                    <div className="bg-white rounded-md p-3 shadow-sm border border-slate-200">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-[#F97316]"></div>
                                                            <h3 className="text-xs font-semibold text-slate-700">Export Options</h3>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={handlePrint}
                                                                className="flex-1 text-xs h-7 px-2.5 border-slate-300 text-slate-600 hover:bg-slate-100 hover:border-slate-400"
                                                            >
                                                                <Printer className="h-3 w-3 mr-1" />
                                                                Print
                                                            </Button>
                                                            <Button
                                                                variant="default"
                                                                size="sm"
                                                                onClick={() => exportToExcel()}
                                                                className="flex-1 text-xs h-7 px-2.5 bg-[#F97316] hover:bg-[#C2540F] text-white"
                                                            >
                                                                <FileText className="h-3 w-3 mr-1" />
                                                                Excel
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>

                                            </div>
                                            {/* Right Side - Teaching Elements */}
                                            <div className="flex-1">
                                                <div className="bg-white rounded-md p-2 shadow-sm border mb-2 border-slate-200">
                                                    <div className="flex items-center gap-2 mb-1.5">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                                        <h3 className="text-xs font-semibold text-slate-700">Teaching Elements</h3>

                                                        <div className="flex items-center gap-2">
                                                            <Checkbox
                                                                id="teaching-elements-select-all "
                                                                checked={
                                                                    // Check if all available teaching element activities are selected
                                                                    (selectedPedagogyTypes.includes("iDo") ?
                                                                        Array.isArray(exportSelections.pedagogy.iDo) &&
                                                                        exportSelections.pedagogy.iDo.length === activityTypes["iDo"].length : true) &&
                                                                    (selectedPedagogyTypes.includes("weDo") ?
                                                                        Array.isArray(exportSelections.pedagogy.weDo) &&
                                                                        exportSelections.pedagogy.weDo.length === activityTypes["weDo"].length : true) &&
                                                                    (selectedPedagogyTypes.includes("youDo") ?
                                                                        Array.isArray(exportSelections.pedagogy.youDo) &&
                                                                        exportSelections.pedagogy.youDo.length === activityTypes["youDo"].length : true)
                                                                }
                                                                onCheckedChange={(checked) => {
                                                                    const allChecked = !!checked;
                                                                    setExportSelections((prev: { pedagogy: { iDo: any; weDo: any; youDo: any; }; }) => ({
                                                                        ...prev,
                                                                        pedagogy: {
                                                                            ...prev.pedagogy,
                                                                            iDo: selectedPedagogyTypes.includes("iDo")
                                                                                ? (allChecked ? [...activityTypes["iDo"]] : [])
                                                                                : prev.pedagogy.iDo,
                                                                            weDo: selectedPedagogyTypes.includes("weDo")
                                                                                ? (allChecked ? [...activityTypes["weDo"]] : [])
                                                                                : prev.pedagogy.weDo,
                                                                            youDo: selectedPedagogyTypes.includes("youDo")
                                                                                ? (allChecked ? [...activityTypes["youDo"]] : [])
                                                                                : prev.pedagogy.youDo,
                                                                        },
                                                                    }));
                                                                }}
                                                                className="h-3.5 w-3.5 cursor-pointer"
                                                            />
                                                            <label htmlFor="teaching-elements-select-all" className="text-xs text-slate-600 cursor-pointer font-medium">
                                                                Select All
                                                            </label>
                                                        </div>
                                                    </div>

                                                    <div className="flex gap-4">
                                                        {/* I Do Section */}
                                                        {selectedPedagogyTypes.includes("iDo") && (
                                                            <div className="flex-1 relative">
                                                                <details className="group">
                                                                    <summary className="flex items-center justify-between px-3 py-2 text-xs cursor-pointer bg-amber-50 hover:bg-amber-100 rounded-md transition-colors border border-amber-200 list-none">
                                                                        <div className="flex items-center gap-2">
                                                                            <Presentation className="h-3.5 w-3.5 text-amber-600" />
                                                                            <span className="font-medium text-amber-700">I Do</span>
                                                                            {Array.isArray(exportSelections.pedagogy.iDo) && exportSelections.pedagogy.iDo.length > 0 && (
                                                                                <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded-full">
                                                                                    {exportSelections.pedagogy.iDo.length}/{activityTypes["iDo"].length}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <ChevronDown className="h-3 w-3 text-amber-500 group-open:rotate-180 transition-transform" />
                                                                    </summary>

                                                                    <div className="absolute z-10 mt-1 w-full p-2 bg-white border border-amber-100 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                                                        <div className="flex items-center gap-2 px-2 py-1 mb-1 border-b border-amber-50">
                                                                            <Checkbox
                                                                                id="export-ido-all"
                                                                                checked={
                                                                                    Array.isArray(exportSelections.pedagogy.iDo) &&
                                                                                    exportSelections.pedagogy.iDo.length === activityTypes["iDo"].length
                                                                                }
                                                                                onCheckedChange={(checked) =>
                                                                                    setExportSelections((prev: { pedagogy: any; }) => ({
                                                                                        ...prev,
                                                                                        pedagogy: {
                                                                                            ...prev.pedagogy,
                                                                                            iDo: checked ? [...activityTypes["iDo"]] : [],
                                                                                        },
                                                                                    }))
                                                                                }
                                                                                className="h-3 w-3"
                                                                            />
                                                                            <label htmlFor="export-ido-all" className="text-xs text-amber-600 font-medium cursor-pointer">
                                                                                Select All
                                                                            </label>
                                                                        </div>
                                                                        {activityTypes["iDo"].map((activity: any) => (
                                                                            <label
                                                                                key={`iDo-${activity}`}
                                                                                className="flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-amber-50 cursor-pointer transition-colors"
                                                                            >
                                                                                <Checkbox
                                                                                    id={`export-ido-${activity}`}
                                                                                    checked={
                                                                                        Array.isArray(exportSelections.pedagogy.iDo) &&
                                                                                        exportSelections.pedagogy.iDo.includes(activity)
                                                                                    }
                                                                                    onCheckedChange={(checked) => {
                                                                                        setExportSelections((prev: { pedagogy: { iDo: any; }; }) => {
                                                                                            const current = Array.isArray(prev.pedagogy.iDo)
                                                                                                ? prev.pedagogy.iDo
                                                                                                : [];
                                                                                            return {
                                                                                                ...prev,
                                                                                                pedagogy: {
                                                                                                    ...prev.pedagogy,
                                                                                                    iDo: checked
                                                                                                        ? [...current, activity]
                                                                                                        : current.filter((a: string) => a !== activity),
                                                                                                },
                                                                                            };
                                                                                        });
                                                                                    }}
                                                                                    className="h-3 w-3"
                                                                                />
                                                                                <span className="text-slate-600">{activity}</span>
                                                                            </label>
                                                                        ))}
                                                                    </div>
                                                                </details>
                                                            </div>
                                                        )}

                                                        {/* We Do Section */}
                                                        {selectedPedagogyTypes.includes("weDo") && (
                                                            <div className="flex-1 relative">
                                                                <details className="group">
                                                                    <summary className="flex items-center justify-between px-3 py-2 text-xs cursor-pointer bg-rose-50 hover:bg-rose-100 rounded-md transition-colors border border-rose-200 list-none">
                                                                        <div className="flex items-center gap-2">
                                                                            <Users className="h-3.5 w-3.5 text-rose-600" />
                                                                            <span className="font-medium text-rose-700">We Do</span>
                                                                            {Array.isArray(exportSelections.pedagogy.weDo) && exportSelections.pedagogy.weDo.length > 0 && (
                                                                                <span className="bg-rose-100 text-rose-800 text-[10px] px-1.5 py-0.5 rounded-full">
                                                                                    {exportSelections.pedagogy.weDo.length}/{activityTypes["weDo"].length}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <ChevronDown className="h-3 w-3 text-rose-500 group-open:rotate-180 transition-transform" />
                                                                    </summary>

                                                                    <div className="absolute z-10 mt-1 w-full p-2 bg-white border border-rose-100 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                                                        <div className="flex items-center gap-2 px-2 py-1 mb-1 border-b border-rose-50">
                                                                            <Checkbox
                                                                                id="export-wedo-all"
                                                                                checked={
                                                                                    Array.isArray(exportSelections.pedagogy.weDo) &&
                                                                                    exportSelections.pedagogy.weDo.length === activityTypes["weDo"].length
                                                                                }
                                                                                onCheckedChange={(checked) =>
                                                                                    setExportSelections((prev: { pedagogy: any; }) => ({
                                                                                        ...prev,
                                                                                        pedagogy: {
                                                                                            ...prev.pedagogy,
                                                                                            weDo: checked ? [...activityTypes["weDo"]] : [],
                                                                                        },
                                                                                    }))
                                                                                }
                                                                                className="h-3 w-3"
                                                                            />
                                                                            <label htmlFor="export-wedo-all" className="text-xs text-rose-600 font-medium cursor-pointer">
                                                                                Select All
                                                                            </label>
                                                                        </div>
                                                                        {activityTypes["weDo"].map((activity: any) => (
                                                                            <label
                                                                                key={`weDo-${activity}`}
                                                                                className="flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-rose-50 cursor-pointer transition-colors"
                                                                            >
                                                                                <Checkbox
                                                                                    id={`export-wedo-${activity}`}
                                                                                    checked={
                                                                                        Array.isArray(exportSelections.pedagogy.weDo) &&
                                                                                        exportSelections.pedagogy.weDo.includes(activity)
                                                                                    }
                                                                                    onCheckedChange={(checked) => {
                                                                                        setExportSelections((prev: { pedagogy: { weDo: any; }; }) => {
                                                                                            const current = Array.isArray(prev.pedagogy.weDo)
                                                                                                ? prev.pedagogy.weDo
                                                                                                : [];
                                                                                            return {
                                                                                                ...prev,
                                                                                                pedagogy: {
                                                                                                    ...prev.pedagogy,
                                                                                                    weDo: checked
                                                                                                        ? [...current, activity]
                                                                                                        : current.filter((a: string) => a !== activity),
                                                                                                },
                                                                                            };
                                                                                        });
                                                                                    }}
                                                                                    className="h-3 w-3"
                                                                                />
                                                                                <span className="text-slate-600">{activity}</span>
                                                                            </label>
                                                                        ))}
                                                                    </div>
                                                                </details>
                                                            </div>
                                                        )}

                                                        {/* You Do Section */}
                                                        {selectedPedagogyTypes.includes("youDo") && (
                                                            <div className="flex-1 relative">
                                                                <details className="group">
                                                                    <summary className="flex items-center justify-between px-3 py-2 text-xs cursor-pointer bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors border border-emerald-200 list-none">
                                                                        <div className="flex items-center gap-2">
                                                                            <User className="h-3.5 w-3.5 text-emerald-600" />
                                                                            <span className="font-medium text-emerald-700">You Do</span>
                                                                            {Array.isArray(exportSelections.pedagogy.youDo) && exportSelections.pedagogy.youDo.length > 0 && (
                                                                                <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.5 rounded-full">
                                                                                    {exportSelections.pedagogy.youDo.length}/{activityTypes["youDo"].length}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <ChevronDown className="h-3 w-3 text-emerald-500 group-open:rotate-180 transition-transform" />
                                                                    </summary>

                                                                    <div className="absolute z-10 mt-1 w-full p-2 bg-white border border-emerald-100 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                                                        <div className="flex items-center gap-2 px-2 py-1 mb-1 border-b border-emerald-50">
                                                                            <Checkbox
                                                                                id="export-youdo-all"
                                                                                checked={
                                                                                    Array.isArray(exportSelections.pedagogy.youDo) &&
                                                                                    exportSelections.pedagogy.youDo.length === activityTypes["youDo"].length
                                                                                }
                                                                                onCheckedChange={(checked) =>
                                                                                    setExportSelections((prev: { pedagogy: any; }) => ({
                                                                                        ...prev,
                                                                                        pedagogy: {
                                                                                            ...prev.pedagogy,
                                                                                            youDo: checked ? [...activityTypes["youDo"]] : [],
                                                                                        },
                                                                                    }))
                                                                                }
                                                                                className="h-3 w-3"
                                                                            />
                                                                            <label htmlFor="export-youdo-all" className="text-xs text-emerald-600 font-medium cursor-pointer">
                                                                                Select All
                                                                            </label>
                                                                        </div>
                                                                        {activityTypes["youDo"].map((activity: any) => (
                                                                            <label
                                                                                key={`youDo-${activity}`}
                                                                                className="flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-emerald-50 cursor-pointer transition-colors"
                                                                            >
                                                                                <Checkbox
                                                                                    id={`export-youdo-${activity}`}
                                                                                    checked={
                                                                                        Array.isArray(exportSelections.pedagogy.youDo) &&
                                                                                        exportSelections.pedagogy.youDo.includes(activity)
                                                                                    }
                                                                                    onCheckedChange={(checked) => {
                                                                                        setExportSelections((prev: { pedagogy: { youDo: any; }; }) => {
                                                                                            const current = Array.isArray(prev.pedagogy.youDo)
                                                                                                ? prev.pedagogy.youDo
                                                                                                : [];
                                                                                            return {
                                                                                                ...prev,
                                                                                                pedagogy: {
                                                                                                    ...prev.pedagogy,
                                                                                                    youDo: checked
                                                                                                        ? [...current, activity]
                                                                                                        : current.filter((a: string) => a !== activity),
                                                                                                },
                                                                                            };
                                                                                        });
                                                                                    }}
                                                                                    className="h-3 w-3"
                                                                                />
                                                                                <span className="text-slate-600">{activity}</span>
                                                                            </label>
                                                                        ))}
                                                                    </div>
                                                                </details>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                {/* Customized Summary Section (for print only) */}
                                                <div className="bg-white rounded-md p-2 shadow-sm border border-slate-200">
                                                    <div className="flex items-center gap-2 mb-1.5">
                                                        <div className="flex items-center gap-2 mb-1.5">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-[#F97316]"></div>
                                                            <h3 className="text-xs font-semibold text-slate-700">Customized Print Summary</h3>


                                                        </div>

                                                        {/* Enable Summary Checkbox */}
                                                        <div className="flex  gap-2 ">
                                                            <Checkbox
                                                                id="enable-summary"
                                                                checked={exportSelections.showSummary}
                                                                onCheckedChange={(checked) => {
                                                                    setExportSelections((prev: any) => ({
                                                                        ...prev,
                                                                        showSummary: !!checked,
                                                                    }));
                                                                }}
                                                                className="h-3.5 w-3.5 cursor-pointer"
                                                            />
                                                            <label htmlFor="enable-summary" className="text-xs text-slate-600 cursor-pointer">
                                                                Include customized summary in print
                                                            </label>
                                                        </div>

                                                        {exportSelections.showSummary && (
                                                            <div className="flex items-center gap-2">
                                                                <Checkbox
                                                                    id="print-summary-select-all "
                                                                    checked={
                                                                        // Check if all available print pedagogy activities are selected
                                                                        (selectedPedagogyTypes.includes("iDo") ?
                                                                            Array.isArray(exportSelections.printPedagogy?.iDo) &&
                                                                            exportSelections.printPedagogy.iDo.length === activityTypes["iDo"].length : true) &&
                                                                        (selectedPedagogyTypes.includes("weDo") ?
                                                                            Array.isArray(exportSelections.printPedagogy?.weDo) &&
                                                                            exportSelections.printPedagogy.weDo.length === activityTypes["weDo"].length : true) &&
                                                                        (selectedPedagogyTypes.includes("youDo") ?
                                                                            Array.isArray(exportSelections.printPedagogy?.youDo) &&
                                                                            exportSelections.printPedagogy.youDo.length === activityTypes["youDo"].length : true)
                                                                    }
                                                                    onCheckedChange={(checked) => {
                                                                        const allChecked = !!checked;
                                                                        setExportSelections((prev: { printPedagogy: { iDo: any; weDo: any; youDo: any; }; }) => ({
                                                                            ...prev,
                                                                            printPedagogy: {
                                                                                ...prev.printPedagogy,
                                                                                iDo: selectedPedagogyTypes.includes("iDo")
                                                                                    ? (allChecked ? [...activityTypes["iDo"]] : [])
                                                                                    : (prev.printPedagogy?.iDo || []),
                                                                                weDo: selectedPedagogyTypes.includes("weDo")
                                                                                    ? (allChecked ? [...activityTypes["weDo"]] : [])
                                                                                    : (prev.printPedagogy?.weDo || []),
                                                                                youDo: selectedPedagogyTypes.includes("youDo")
                                                                                    ? (allChecked ? [...activityTypes["youDo"]] : [])
                                                                                    : (prev.printPedagogy?.youDo || []),
                                                                            },
                                                                        }));
                                                                    }}
                                                                    className="h-3.5 w-3.5 cursor-pointer"
                                                                />
                                                                <label htmlFor="print-summary-select-all" className="text-xs text-[#F97316] cursor-pointer font-medium">
                                                                    Select All
                                                                </label>
                                                            </div>
                                                        )}

                                                        {exportSelections.showSummary && (
                                                            <label
                                                                className="ml-auto flex items-center gap-1 px-2 py-1 text-xs rounded border transition-colors border-[#FFD9BC] bg-[#FFF3EA] hover:bg-[#FFE4D0] hover:border-[#FB923C] cursor-pointer text-[#F97316]"
                                                            >
                                                                <Checkbox
                                                                    checked={exportSelections.summaryIncludeTotalHours || false}
                                                                    onCheckedChange={(checked) => {
                                                                        setExportSelections((prev: any) => ({
                                                                            ...prev,
                                                                            summaryIncludeTotalHours: !!checked,
                                                                        }));
                                                                    }}
                                                                    className="h-3 w-3 rounded border transition-colors"
                                                                />
                                                                <span className="font-medium">
                                                                    Include Total Hours
                                                                </span>
                                                            </label>
                                                        )}

                                                    </div>

                                                    {/* Summary Teaching Elements - Similar structure but separate state */}
                                                    <div className={`flex gap-4 ${!exportSelections.showSummary ? 'opacity-50 pointer-events-none' : ''}`}>
                                                        {/* I Do Section */}
                                                        {selectedPedagogyTypes.includes("iDo") && (
                                                            <div className="flex-1 relative " >

                                                                <DropdownSection
                                                                    type="iDo"
                                                                    icon={Presentation}
                                                                    title="I Do (Print)"
                                                                    activityTypes={activityTypes["iDo"]}
                                                                    selectedActivities={exportSelections.printPedagogy?.iDo || []}
                                                                    onSelectionChange={(selected: any) => {
                                                                        setExportSelections((prev: { printPedagogy: any; }) => ({
                                                                            ...prev,
                                                                            printPedagogy: {
                                                                                ...prev.printPedagogy,
                                                                                iDo: selected,
                                                                            },
                                                                        }));
                                                                    }}
                                                                    onSelectAll={(selectAll: any) => {
                                                                        setExportSelections((prev: { printPedagogy: any; }) => ({
                                                                            ...prev,
                                                                            printPedagogy: {
                                                                                ...prev.printPedagogy,
                                                                                iDo: selectAll ? [...activityTypes["iDo"]] : [],
                                                                            },
                                                                        }));
                                                                    }}
                                                                />

                                                            </div>
                                                        )}

                                                        {/* We Do Section */}
                                                        {selectedPedagogyTypes.includes("weDo") && (
                                                            <div className="flex-1 relative ">

                                                                <DropdownSection
                                                                    type="weDo"
                                                                    icon={Users}
                                                                    title="We Do (Print)"
                                                                    activityTypes={activityTypes["weDo"]}
                                                                    selectedActivities={exportSelections.printPedagogy?.weDo || []}
                                                                    onSelectionChange={(selected: any) => {
                                                                        setExportSelections((prev: { printPedagogy: any }) => ({
                                                                            ...prev,
                                                                            printPedagogy: {
                                                                                ...prev.printPedagogy,
                                                                                weDo: selected,
                                                                            },
                                                                        }));
                                                                    }}
                                                                    onSelectAll={(selectAll: boolean) => {
                                                                        setExportSelections((prev: { printPedagogy: any }) => ({
                                                                            ...prev,
                                                                            printPedagogy: {
                                                                                ...prev.printPedagogy,
                                                                                weDo: selectAll ? [...activityTypes["weDo"]] : [],
                                                                            },
                                                                        }));
                                                                    }}
                                                                />
                                                            </div>
                                                        )}

                                                        {/* You Do Section */}
                                                        {selectedPedagogyTypes.includes("youDo") && (
                                                            <div className="flex-1 relative">

                                                                <DropdownSection
                                                                    type="youDo"
                                                                    icon={User}
                                                                    title="You Do (Print)"
                                                                    activityTypes={activityTypes["youDo"]}
                                                                    selectedActivities={exportSelections.printPedagogy?.youDo || []}
                                                                    onSelectionChange={(selected: any) => {
                                                                        setExportSelections((prev: { printPedagogy: any }) => ({
                                                                            ...prev,
                                                                            printPedagogy: {
                                                                                ...prev.printPedagogy,
                                                                                youDo: selected,
                                                                            },
                                                                        }));
                                                                    }}
                                                                    onSelectAll={(selectAll: boolean) => {
                                                                        setExportSelections((prev: { printPedagogy: any }) => ({
                                                                            ...prev,
                                                                            printPedagogy: {
                                                                                ...prev.printPedagogy,
                                                                                youDo: selectAll ? [...activityTypes["youDo"]] : [],
                                                                            },
                                                                        }));
                                                                    }}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>

                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        /* Full Width Layout when NO Teaching Elements are selected  */
                                        <div className="flex items-start gap-4 w-full">
                                            {/* Course Hierarchy Card */}
                                            <div className="flex-1 bg-white rounded-md p-3 shadow-sm border border-slate-200">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-[#F97316]"></div>
                                                    <h3 className="text-xs font-semibold text-slate-700">Course Hierarchy</h3>
                                                </div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {/* All checkbox with perfect state management */}
                                                    <label className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-slate-200 hover:bg-[#FFF3EA] hover:border-[#FDBA74] cursor-pointer transition-colors">
                                                        <Checkbox
                                                            id="export-all"
                                                            checked={
                                                                // Check if all available options are selected
                                                                (selectedCourse?.courseHierarchy.includes('Module') ? exportSelections.hierarchy.module : true) &&
                                                                (selectedCourse?.courseHierarchy.includes('Sub Module') ? exportSelections.hierarchy.subModule : true) &&
                                                                (selectedCourse?.courseHierarchy.includes('Topic') ? exportSelections.hierarchy.topic : true) &&
                                                                (selectedCourse?.courseHierarchy.includes('Sub Topic') ? exportSelections.hierarchy.subTopic : true) &&
                                                                exportSelections.hierarchy.level
                                                            }
                                                            onCheckedChange={(checked) => {
                                                                const allChecked = !!checked;
                                                                setExportSelections((prev: { hierarchy: { module: any; subModule: any; topic: any; subTopic: any; }; }) => ({
                                                                    ...prev,
                                                                    hierarchy: {
                                                                        module: selectedCourse?.courseHierarchy.includes('Module') ? allChecked : prev.hierarchy.module,
                                                                        subModule: selectedCourse?.courseHierarchy.includes('Sub Module') ? allChecked : prev.hierarchy.subModule,
                                                                        topic: selectedCourse?.courseHierarchy.includes('Topic') ? allChecked : prev.hierarchy.topic,
                                                                        subTopic: selectedCourse?.courseHierarchy.includes('Sub Topic') ? allChecked : prev.hierarchy.subTopic,
                                                                        level: allChecked
                                                                    }
                                                                }));
                                                            }}
                                                            className="h-3 w-3"
                                                        />
                                                        <span className="text-slate-600">All</span>
                                                    </label>

                                                    {/* Individual checkboxes */}
                                                    {selectedCourse?.courseHierarchy.includes('Module') && (
                                                        <label className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-slate-200 hover:bg-[#FFF3EA] hover:border-[#FDBA74] cursor-pointer transition-colors">
                                                            <Checkbox
                                                                id="export-module"
                                                                checked={exportSelections.hierarchy.module}
                                                                onCheckedChange={(checked) => {
                                                                    setExportSelections((prev: { hierarchy: any; }) => ({
                                                                        ...prev,
                                                                        hierarchy: { ...prev.hierarchy, module: !!checked }
                                                                    }));
                                                                }}
                                                                className="h-3 w-3"
                                                            />
                                                            <span className="text-slate-600">Module</span>
                                                        </label>
                                                    )}

                                                    {selectedCourse?.courseHierarchy.includes('Sub Module') && (
                                                        <label className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-slate-200 hover:bg-[#FFF3EA] hover:border-[#FDBA74] cursor-pointer transition-colors">
                                                            <Checkbox
                                                                id="export-submodule"
                                                                checked={exportSelections.hierarchy.subModule}
                                                                onCheckedChange={(checked) => {
                                                                    setExportSelections((prev: { hierarchy: any; }) => ({
                                                                        ...prev,
                                                                        hierarchy: { ...prev.hierarchy, subModule: !!checked }
                                                                    }));
                                                                }}
                                                                className="h-3 w-3"
                                                            />
                                                            <span className="text-slate-600">Sub Module</span>
                                                        </label>
                                                    )}

                                                    {selectedCourse?.courseHierarchy.includes('Topic') && (
                                                        <label className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-slate-200 hover:bg-[#FFF3EA] hover:border-[#FDBA74] cursor-pointer transition-colors">
                                                            <Checkbox
                                                                id="export-topic"
                                                                checked={exportSelections.hierarchy.topic}
                                                                onCheckedChange={(checked) => {
                                                                    setExportSelections((prev: { hierarchy: any; }) => ({
                                                                        ...prev,
                                                                        hierarchy: { ...prev.hierarchy, topic: !!checked }
                                                                    }));
                                                                }}
                                                                className="h-3 w-3"
                                                            />
                                                            <span className="text-slate-600">Topic</span>
                                                        </label>
                                                    )}

                                                    {selectedCourse?.courseHierarchy.includes('Sub Topic') && (
                                                        <label className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-slate-200 hover:bg-[#FFF3EA] hover:border-[#FDBA74] cursor-pointer transition-colors">
                                                            <Checkbox
                                                                id="export-subtopic"
                                                                checked={exportSelections.hierarchy.subTopic}
                                                                onCheckedChange={(checked) => {
                                                                    setExportSelections((prev: { hierarchy: any; }) => ({
                                                                        ...prev,
                                                                        hierarchy: { ...prev.hierarchy, subTopic: !!checked }
                                                                    }));
                                                                }}
                                                                className="h-3 w-3"
                                                            />
                                                            <span className="text-slate-600">Sub Topic</span>
                                                        </label>
                                                    )}

                                                    <label className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-slate-200 hover:bg-[#FFF3EA] hover:border-[#FDBA74] cursor-pointer transition-colors">
                                                        <Checkbox
                                                            id="export-level"
                                                            checked={exportSelections.hierarchy.level}
                                                            onCheckedChange={(checked) => {
                                                                setExportSelections((prev: { hierarchy: any; }) => ({
                                                                    ...prev,
                                                                    hierarchy: { ...prev.hierarchy, level: !!checked }
                                                                }));
                                                            }}
                                                            className="h-3 w-3"
                                                        />
                                                        <span className="text-slate-600">Level</span>
                                                    </label>
                                                </div>
                                            </div>

                                            {/* Export Options Card */}
                                            <div className="bg-white rounded-md p-3 shadow-sm border border-slate-200 w-[35vw]">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-[#F97316]"></div>
                                                    <h3 className="text-xs font-semibold text-slate-700">Export Options</h3>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={handlePrint}
                                                        className="flex-1 text-xs h-7 px-2.5 border-slate-300 text-slate-600 hover:bg-slate-100 hover:border-slate-400"
                                                    >
                                                        <Printer className="h-3 w-3 mr-1" />
                                                        Print
                                                    </Button>
                                                    <Button
                                                        variant="default"
                                                        size="sm"
                                                        onClick={() => exportToExcel()}
                                                        className="flex-1 text-xs h-7 px-2.5 bg-[#F97316] hover:bg-[#C2540F] text-white"
                                                    >
                                                        <FileText className="h-3 w-3 mr-1" />
                                                        Excel
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
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
