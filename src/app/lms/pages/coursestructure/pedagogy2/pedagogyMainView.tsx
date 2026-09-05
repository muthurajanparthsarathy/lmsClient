"use client"

// Main-content JSX extracted verbatim from page.tsx's return as an inline render
// function — called {renderMainContent(deps)}, so React renders it exactly as before.

"use client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import React from "react"
import { motion, AnimatePresence } from "framer-motion";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import {
    CheckCircle2,
    HelpCircle,
    X,
    Plus,
    Eye,
    Check,
    Sliders,
    ChevronDownIcon,
    Settings,
    Copy,
    Trash2,
    Maximize2,
    Minimize2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import DraggableZoomControls from "./DraggableZoomControls"
import { popupVariants, popAnimation } from "./constants"


export interface PedagogyMainViewDeps {
    /** Hosted inside another shell (the L&D console), which supplies its own
     *  breadcrumb — this screen's own trail would navigate the user out of it. */
    embedded?: boolean;
    calculateNegativeMargin?: any;
    dragOverId?: any;
    draggingModuleId?: any;
    draggingSubModuleId?: any;
    draggingSubtopicId?: any;
    draggingTopicId?: any;
    isCellMovable?: any;
    movableCell?: any;
    ondragover?: any;
    AddCellButton?: any;
    CellActionsMenu?: any;
    MergeButton?: any;
    ValidationFeedback?: any;
    actionsEnabled?: any;
    activateHierarchicalDeleteMode?: any;
    activityTypes?: any;
    calculateTotalHours?: any;
    cancelDeleteMode?: any;
    confirmMerge?: any;
    contentHeight?: any;
    deleteMode?: any;
    directActionsEnabled?: any;
    duplicateChecked?: any;
    filterPlaceholders2?: any;
    fullscreenContainerRef?: any;
    isTableFullView?: any;
    setIsTableFullView?: any;
    getImmediateChildrenForParent?: any;
    getItemsForDeletion?: any;
    handleDeleteClick?: any;
    handleDeleteModeSelectAll?: any;
    handleDeleteModeSelection?: any;
    handleDragOver?: any;
    handleEdit?: any;
    handleModuleDragEnd?: any;
    handleModuleDragStart?: any;
    handleModuleDrop?: any;
    handleMultipleDeleteClick?: any;
    handleSubModuleDragEnd?: any;
    handleSubModuleDragStart?: any;
    handleSubModuleDrop?: any;
    handleSubtopicDragEnd?: any;
    handleSubtopicDragStart?: any;
    handleSubtopicDrop?: any;
    handleTopicDragEnd?: any;
    handleTopicDragStart?: any;
    handleTopicDrop?: any;
    hierarchicalDeleteMode?: any;
    hierarchyWidthPercentage?: any;
    isCellMerged?: any;
    isDefaultItem?: any;
    isLastHierarchy2?: any;
    isMergeConfirm?: any;
    isOpen?: any;
    mergeHours?: any;
    moduleSearchQuery?: any;
    moduleSpans?: any;
    modules?: any;
    pendingMerge?: any;
    renderActivityCell?: any;
    renderAddFirstMessages?: any;
    renderLevelCell?: any;
    resetTableZoom?: any;
    scaledContentRef?: any;
    selected?: any;
    selectedCourse?: any;
    selectedModuleToHighlight?: any;
    selectedPedagogyTypes?: any;
    setActionsEnabled?: any;
    setAddOnlyPedagogyLevel?: any;
    setDialogType?: any;
    setDirectActionsEnabled?: any;
    setDisableAddonlyMode?: any;
    setDuplicateChecked?: any;
    setIsMoveModeActive?: any;
    setIsOpen?: any;
    setMergeHours?: any;
    setModuleSearchQuery?: any;
    setMovableCell?: any;
    setPendingMerge?: any;
    setSelectedModuleForSubModule?: any;
    setSelectedModuleToHighlight?: any;
    setSelectedPedagogyTypes?: any;
    setSelectedSubModuleForTopic?: any;
    setSelectedTopicForSubTopic?: any;
    setShowDeleteConfirmation?: any;
    setShowDialog?: any;
    setShowDuplicatePopup?: any;
    setShowInstructions?: any;
    setShowMainFullPreviewDialog?: any;
    setShowMergeDialog?: any;
    setShowPreviewDialog?: any;
    setShowSummaryDialog?: any;
    shouldDisableControls?: any;
    shouldShowHierarchicalCheckbox?: any;
    showAddModuleFirst?: any;
    showAddTopicFirst?: any;
    showInstructions?: any;
    showMergeDialog?: any;
    showSuccessMessage?: any;
    sortedModules?: any;
    subModuleSpans?: any;
    subModules?: any;
    subTopics?: any;
    tableRows?: any;
    tableZoomLevel?: any;
    topicSpans?: any;
    topics?: any;
    zoomTableIn?: any;
    zoomTableOut?: any;
}

export function renderMainContent(deps: PedagogyMainViewDeps) {
    const { embedded, AddCellButton, CellActionsMenu, MergeButton, ValidationFeedback, actionsEnabled, activateHierarchicalDeleteMode, activityTypes, calculateTotalHours, cancelDeleteMode, confirmMerge, contentHeight, deleteMode, directActionsEnabled, duplicateChecked, filterPlaceholders2, fullscreenContainerRef, getImmediateChildrenForParent, getItemsForDeletion, handleDeleteClick, handleDeleteModeSelectAll, handleDeleteModeSelection, handleDragOver, handleEdit, handleModuleDragEnd, handleModuleDragStart, handleModuleDrop, handleMultipleDeleteClick, handleSubModuleDragEnd, handleSubModuleDragStart, handleSubModuleDrop, handleSubtopicDragEnd, handleSubtopicDragStart, handleSubtopicDrop, handleTopicDragEnd, handleTopicDragStart, handleTopicDrop, hierarchicalDeleteMode, hierarchyWidthPercentage, isCellMerged, isDefaultItem, isLastHierarchy2, isMergeConfirm, isOpen, isTableFullView, setIsTableFullView, mergeHours, moduleSearchQuery, moduleSpans, modules, pendingMerge, renderActivityCell, renderAddFirstMessages, renderLevelCell, resetTableZoom, scaledContentRef, selected, selectedCourse, selectedModuleToHighlight, selectedPedagogyTypes, setActionsEnabled, setAddOnlyPedagogyLevel, setDialogType, setDirectActionsEnabled, setDisableAddonlyMode, setDuplicateChecked, setIsMoveModeActive, setIsOpen, setMergeHours, setModuleSearchQuery, setMovableCell, setPendingMerge, setSelectedModuleForSubModule, setSelectedModuleToHighlight, setSelectedPedagogyTypes, setSelectedSubModuleForTopic, setSelectedTopicForSubTopic, setShowDeleteConfirmation, setShowDialog, setShowDuplicatePopup, setShowInstructions, setShowMainFullPreviewDialog, setShowMergeDialog, setShowPreviewDialog, setShowSummaryDialog, shouldDisableControls, shouldShowHierarchicalCheckbox, showAddModuleFirst, showAddTopicFirst, showInstructions, showMergeDialog, showSuccessMessage, sortedModules, subModuleSpans, subModules, subTopics, tableRows, tableZoomLevel, topicSpans, topics, zoomTableIn, zoomTableOut, calculateNegativeMargin, dragOverId, draggingModuleId, draggingSubModuleId, draggingSubtopicId, draggingTopicId, isCellMovable, movableCell, ondragover } = deps
    return (
            <div className={embedded ? "bg-gray-50 px-2 py-2" : "bg-gray-50 px-4 sm:px-6 py-4"}>
                <div className="space-y-2">
                    {/* Success Message */}
                    {showSuccessMessage && (
                        <div className="fixed top-4 right-4 z-[60] bg-green-500 text-white px-3 py-1.5 rounded-md shadow flex items-center gap-1 text-xs">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Operation completed successfully!</span>
                        </div>
                    )}
                    {selectedCourse && (
                        <DraggableZoomControls
                            zoomLevel={tableZoomLevel}
                            onZoomIn={zoomTableIn}
                            onZoomOut={zoomTableOut}
                            onResetZoom={resetTableZoom}
                            elevated={isTableFullView}
                        />
                    )}
                    {/* Breadcrumbs — in a card of their own: this line is now the
                        page's only chrome, so it gets the app's card treatment
                        rather than floating bare over the gray wash. */}
                    <div className={`mt-2.5 bg-white rounded-xl border border-[#F0EFEE] shadow-[0_1px_2px_rgba(16,24,40,0.04)] px-4 py-2.5${embedded ? ' hidden' : ''}`}>
                    <Breadcrumb>
                        <BreadcrumbList className="text-xs">
                            <BreadcrumbItem>
                                <BreadcrumbLink
                                    href="/lms/pages/admindashboard"
                                    className="text-[#0b5ed7] hover:text-[#EA6A1F] transition-colors"
                                >
                                    Dashboard
                                </BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator className="text-slate-400" />
                            <BreadcrumbItem>
                                <BreadcrumbLink
                                    href="/lms/pages/coursestructure"
                                    className="text-[#0b5ed7] hover:text-[#EA6A1F] transition-colors"
                                >
                                    Course Management
                                </BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator className="text-slate-400" />
                            <BreadcrumbItem>
                                <BreadcrumbLink
                                    href="/lms/pages/pedagogy"
                                    className="text-[#0b5ed7] hover:text-[#EA6A1F] transition-colors"
                                >
                                    Pedagogy
                                </BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator className="text-slate-400" />
                            {selectedCourse && (
                                <>
                                    <BreadcrumbItem>
                                        <span
                                            className="text-slate-500 truncate max-w-[140px]"
                                            title={selectedCourse.clientName}
                                        >
                                            {selectedCourse.clientName || "N/A"}
                                        </span>
                                    </BreadcrumbItem>
                                    <BreadcrumbSeparator className="text-slate-400" />
                                </>
                            )}
                            <BreadcrumbItem>
                                <BreadcrumbPage className="text-[#111827] font-bold">{selectedCourse?.courseName}</BreadcrumbPage>
                            </BreadcrumbItem>
                            {selectedCourse && (
                                <BreadcrumbItem className="gap-1.5">
                                    <span className="text-[#9CA3AF]">
                                        ({selectedCourse.courseCode || "N/A"})
                                    </span>
                                    <span className="bg-[#FFF3EA] text-[#C2540F] border border-[#FFD9BC] rounded-full px-2 py-0.5 text-[10px] font-medium leading-none">
                                        {selectedCourse.courseLevel || "N/A"}
                                    </span>
                                </BreadcrumbItem>
                            )}
                        </BreadcrumbList>
                    </Breadcrumb>
                    </div>

                    {selectedCourse ? (
                        <div className="flex flex-col gap-2 min-h-fit">

                            {/* Fullscreen Container - includes controls card and table */}
                            <div
                                ref={fullscreenContainerRef}
                                className={`flex flex-col gap-2`}
                                style={{
                                    height: 'auto',
                                    minHeight: 'fit-content'
                                }}
                            >
                                {/* Custom Merge Hours Modal - positioned inside fullscreen container */}
                                {showMergeDialog && (
                                    <div
                                        className="fixed inset-0 flex items-center justify-center z-[9999]"
                                        style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }}
                                    >
                                        {/* Backdrop */}
                                        <div
                                            className="absolute inset-0 bg-black/50 bg-opacity-50"
                                            onClick={() => {
                                                setShowMergeDialog(false)
                                                setPendingMerge(null)
                                                setMergeHours("")
                                            }}
                                        />

                                        {/* Modal Content */}
                                        <motion.div
                                            initial="hidden"
                                            animate="visible"
                                            exit="exit"
                                            variants={popupVariants}
                                            className="relative bg-white rounded-lg shadow-xl border max-w-md w-full mx-4 p-6 z-[10000]">
                                            <div className="mb-4">
                                                <h3 className="text-lg font-semibold text-gray-900">Set Merge Hours</h3>
                                            </div>

                                            <div className="space-y-4">
                                                <div>
                                                    <p className="text-sm text-gray-600 mb-2">
                                                        You are merging {pendingMerge?.selectedRows.length} rows for{" "}
                                                        <strong>{pendingMerge?.activity}</strong> in <strong>{pendingMerge?.type.toUpperCase()}</strong>.
                                                    </p>
                                                    <p className="text-sm text-gray-600 mb-4">Enter the total hours for all merged items:</p>
                                                    <Input
                                                        type="number"
                                                        value={mergeHours}
                                                        onChange={(e) => setMergeHours(e.target.value)}
                                                        placeholder="Enter total hours (e.g., 2)"
                                                        step="0.5"
                                                        min="0"
                                                        className="w-full"
                                                        autoFocus
                                                    />
                                                </div>

                                                <div className="flex justify-end gap-2 pt-4">
                                                    <Button
                                                        variant="outline"
                                                        onClick={() => {
                                                            setShowMergeDialog(false)

                                                            setPendingMerge(null)
                                                            setMergeHours("")

                                                        }}
                                                    >
                                                        Cancel
                                                    </Button>
                                                    <Button onClick={confirmMerge} disabled={!mergeHours}>
                                                        {(isMergeConfirm ? "Merging..." : 'Merge Cells')}
                                                    </Button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    </div>
                                )}

                                {/* Controls Card */}
                                <div className="bg-white rounded-lg border border-gray-200 p-2 sm:p-3">
                                    <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                                        {/* Always visible controls - First Row Priority */}
                                        <div className="flex flex-wrap items-center gap-1 sm:gap-2 flex-1 min-w-0">
                                            {/* Help button */}
                                            <button
                                                onClick={() => setShowInstructions(!showInstructions)}
                                                className="p-1 hover:bg-gray-100 cursor-pointer rounded flex-shrink-0"
                                                title="Click to view instructions"
                                            >
                                                <HelpCircle className="w-3 sm:w-4 h-3 sm:h-4 text-gray-600" />
                                            </button>
                                            <MergeButton />
                                            <ValidationFeedback />

                                            <div className="relative inline-block text-left sm:pl-2">
                                                {/* Dropdown Trigger */}
                                                <button
                                                    onClick={() => setIsOpen(!isOpen)}
                                                    disabled={shouldDisableControls}
                                                    className={`group relative inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] sm:text-xs rounded-xl transition-all duration-200 ease-out
    ${shouldDisableControls ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
    ${isOpen
                                                            ? "bg-gradient-to-r from-[#FB8C3C] via-[#F0701F] to-[#C2540F] text-white shadow-[0_0_6px_rgba(240,112,31,0.3)] ring-1 ring-[#FB923C]/40"
                                                            : "bg-gradient-to-r from-[#FB8C3C] to-[#F0701F] text-white hover:shadow-[0_0_8px_rgba(240,112,31,0.25)] focus:ring-1 focus:ring-[#FDBA74]"
                                                        }`}
                                                >
                                                    {/* Soft Border Pulse */}
                                                    <div
                                                        className="absolute inset-0 rounded-lg p-[1px] bg-gradient-to-r from-[#FB8C3C]/40 to-[#F0701F]/40 opacity-0 group-hover:opacity-100 blur-[1px] transition-all duration-300"
                                                    />

                                                    {/* Inner Soft Glow */}
                                                    <div className="absolute inset-0 rounded-lg bg-[#FB923C]/5 group-hover:bg-[#F97316]/10 transition-all duration-200" />

                                                    {/* Content */}
                                                    <div className="relative flex items-center gap-1.5 z-10">
                                                        <Settings
                                                            className={`w-3.5 h-3.5 transition-transform duration-300 ${isOpen ? "rotate-[20deg]" : "rotate-0"
                                                                }`}
                                                        />
                                                        <span className="hidden sm:inline tracking-tight">More</span>
                                                        <div
                                                            className={`transition-transform duration-200 ${isOpen ? "rotate-180" : "rotate-0"
                                                                }`}
                                                        >
                                                            <ChevronDownIcon size={12} className="sm:size-3.5" />
                                                        </div>
                                                    </div>
                                                </button>



                                                {/* Dropdown Menu */}
                                                {isOpen && (
                                                    <div className="absolute mt-2 w-56 sm:w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-30 overflow-hidden text-sm">
                                                        {/* Header */}
                                                        <div className="bg-gradient-to-r from-[#FFF3EA] to-white px-3 py-2 border-b border-gray-200">
                                                            <div className="flex items-center gap-1.5">
                                                                <Settings className="w-3.5 h-3.5 text-[#F97316]" />
                                                                <h3 className="text-xs font-semibold text-[#9A3F0A]">Action Settings</h3>
                                                            </div>
                                                        </div>

                                                        {/* Menu Items */}
                                                        <div className="p-1.5 space-y-1">

                                                            {/* Actions Toggle */}
                                                            <div className={`group p-2 rounded-md hover:bg-green-50 transition-colors duration-150 ${shouldDisableControls ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} `}>
                                                                <label className={`flex items-center justify-between ${shouldDisableControls ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} `}>
                                                                    <div className="flex items-center gap-2">
                                                                        <div
                                                                            className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors duration-200 ${actionsEnabled
                                                                                ? "bg-green-100 text-green-600"
                                                                                : "bg-gray-100 text-gray-500"
                                                                                }`}
                                                                        >
                                                                            {actionsEnabled ? (
                                                                                <Check className="w-3.5 h-3.5" />
                                                                            ) : (
                                                                                <Sliders className="w-3.5 h-3.5" />
                                                                            )}
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-xs font-medium text-gray-900">
                                                                                Hierarchy Actions
                                                                            </span>
                                                                            <p className="text-[10px] text-gray-500">Enable all actions</p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="relative">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={actionsEnabled}
                                                                            disabled={shouldDisableControls}
                                                                            onChange={() => setActionsEnabled(!actionsEnabled)}
                                                                            className="sr-only"
                                                                        />
                                                                        <div
                                                                            className={`w-9 h-4 rounded-full transition-all duration-300 ${actionsEnabled ? "bg-green-500" : "bg-gray-300"
                                                                                } shadow-inner`}
                                                                        >
                                                                            <div
                                                                                className={`w-4 h-4 bg-white rounded-full shadow transition-transform duration-300 transform ${actionsEnabled ? "translate-x-5" : "translate-x-0"
                                                                                    }`}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </label>
                                                            </div>

                                                            {/* Divider */}
                                                            <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
                                                            {/* Direct Actions */}
                                                            <div className={`group p-2 rounded-md hover:bg-[#FFF3EA] transition-colors duration-150 ${shouldDisableControls ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} `}>
                                                                <label className={`flex items-center justify-between ${shouldDisableControls ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} `}>
                                                                    <div className="flex items-center gap-2">
                                                                        <div
                                                                            className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors duration-200 ${directActionsEnabled
                                                                                ? "bg-emerald-100 text-emerald-600"
                                                                                : "bg-gray-100 text-gray-500"
                                                                                }`}
                                                                        >
                                                                            {directActionsEnabled ? (
                                                                                <Check className="w-3.5 h-3.5" />
                                                                            ) : (
                                                                                <Sliders className="w-3.5 h-3.5" />
                                                                            )}
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-xs font-medium text-gray-900">
                                                                                Direct Actions
                                                                            </span>
                                                                            <p className="text-[10px] text-gray-500">Enable quick controls</p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="relative">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={directActionsEnabled}
                                                                            disabled={shouldDisableControls}
                                                                            onChange={() => setDirectActionsEnabled(!directActionsEnabled)}
                                                                            className="sr-only"
                                                                        />
                                                                        <div
                                                                            className={`w-9 h-4 rounded-full transition-all duration-300 ${directActionsEnabled ? "bg-emerald-500" : "bg-gray-300"
                                                                                } shadow-inner`}
                                                                        >
                                                                            <div
                                                                                className={`w-4 h-4 bg-white rounded-full shadow transition-transform duration-300 transform ${directActionsEnabled ? "translate-x-5" : "translate-x-0"
                                                                                    }`}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </label>
                                                            </div>

                                                            {/* Divider */}
                                                            <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

                                                            {/* Multiple Delete */}
                                                            <div className="group p-2 rounded-md hover:bg-red-50 transition-colors duration-150 cursor-pointer">
                                                                <button
                                                                    onClick={() => {
                                                                        setIsOpen(false); // Close dropdown
                                                                        handleMultipleDeleteClick();
                                                                    }}
                                                                    disabled={shouldDisableControls}
                                                                    className={`flex items-center justify-between w-full ${shouldDisableControls ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                                                >
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-7 h-7 rounded-md flex items-center justify-center bg-red-100 text-red-600">
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-xs font-medium text-gray-900">
                                                                                Multiple Delete
                                                                            </span>
                                                                            <p className="text-[10px] text-gray-500">Delete multiple items</p>
                                                                        </div>
                                                                    </div>
                                                                    <div className={`px-2 py-1 text-[10px] font-medium rounded-full transition-colors ${shouldDisableControls
                                                                        ? 'bg-gray-200 text-gray-400'
                                                                        : 'bg-red-100 text-red-600 hover:bg-red-200'
                                                                        }`}>
                                                                        Enable
                                                                    </div>
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Footer */}
                                                        <div className="bg-gray-50 px-3 py-1.5 border-t border-gray-200">
                                                            <p className="text-[10px] text-gray-500 text-center">
                                                                Configure your preferences
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Click outside to close */}
                                                {isOpen && (
                                                    <div
                                                        className="fixed inset-0 z-20"
                                                        onClick={() => setIsOpen(false)}
                                                        aria-hidden="true"
                                                    />
                                                )}
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setDuplicateChecked(!duplicateChecked);
                                                    if (!duplicateChecked) {
                                                        setShowDuplicatePopup(true);
                                                    }
                                                }}
                                                className={`group relative inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm rounded-xl transition-all duration-200 ease-out 
                    shadow-sm cursor-pointer hover:shadow-md focus:outline-none focus:ring-1 focus:ring-offset-1
                    ${duplicateChecked
                                                        ? "bg-gradient-to-r from-[#FB8C3C] to-[#C2540F] text-white ring-1 ring-[#FB923C]"
                                                        : "bg-gradient-to-r from-[#FB8C3C] to-[#F0701F] text-white hover:from-[#F0701F] hover:to-[#C2540F] focus:ring-[#FDBA74]"
                                                    }`}
                                            >
                                                {/* Glow */}
                                                <div className="absolute inset-0 rounded-md bg-[#FB923C] opacity-0 group-hover:opacity-10 transition-opacity duration-200" />

                                                {/* Content */}
                                                <div className="relative flex text-xs items-center gap-1.5">
                                                    <Copy className="w-3 h-3 sm:w-4 sm:h-4" />
                                                    <span className="hidden sm:inline">Similar Courses</span>
                                                    <span className="sm:hidden">Similar</span>
                                                </div>
                                            </button>
                                            {/* Module Selection Dropdown */}
                                            <div className="flex items-center gap-1 sm:gap-2">
                                                <div className="relative w-full sm:w-[180px]">
                                                    <Select
                                                        value={selectedModuleToHighlight || ""}
                                                        onValueChange={(value) => {
                                                            setSelectedModuleToHighlight(value);
                                                            // Scroll to the module
                                                            setTimeout(() => {
                                                                const moduleElement = document.querySelector(`[data-module-id="${value}"]`);
                                                                if (moduleElement) {
                                                                    moduleElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                                }
                                                            }, 100);
                                                        }}
                                                        disabled={shouldDisableControls}
                                                    >
                                                        <SelectTrigger className="w-full h-6 sm:h-7 text-[9px] sm:text-xs">
                                                            <SelectValue placeholder="Select module" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {/* Search input */}
                                                            <div className="p-2 border-b">
                                                                <input
                                                                    type="text"
                                                                    placeholder="Search modules..."
                                                                    value={moduleSearchQuery}
                                                                    onChange={(e) => setModuleSearchQuery(e.target.value)}
                                                                    className="w-full p-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                />
                                                            </div>

                                                            {/* Module list */}
                                                            <div className="max-h-60 overflow-auto">
                                                                {sortedModules
                                                                    .filter((module: any) =>
                                                                        module.title.toLowerCase().includes(moduleSearchQuery.toLowerCase())
                                                                    )
                                                                    .map((module: any) => (
                                                                        <SelectItem
                                                                            key={module._id}
                                                                            value={module._id}
                                                                            className="text-xs"
                                                                        >
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="w-2 h-2 rounded-full bg-[#F97316] flex-shrink-0"></div>
                                                                                <span className="truncate">{module.title}</span>
                                                                            </div>
                                                                        </SelectItem>
                                                                    ))
                                                                }
                                                                {sortedModules.filter((module: any) =>
                                                                    module.title.toLowerCase().includes(moduleSearchQuery.toLowerCase())
                                                                ).length === 0 && (
                                                                        <div className="px-3 py-2 text-xs text-gray-500 text-center">
                                                                            No modules found
                                                                        </div>
                                                                    )}
                                                            </div>

                                                            {/* Clear selection */}
                                                            {selectedModuleToHighlight && (
                                                                <>
                                                                    <div className="border-t mt-1"></div>
                                                                    <div
                                                                        className="px-3 py-2 text-xs text-red-600 hover:bg-red-50 cursor-pointer"
                                                                        onClick={() => setSelectedModuleToHighlight(null)}
                                                                    >
                                                                        Clear selection
                                                                    </div>
                                                                </>
                                                            )}
                                                        </SelectContent>
                                                    </Select>

                                                    {/* Clear button (shown when module is selected) */}
                                                    {selectedModuleToHighlight && (
                                                        <button
                                                            onClick={() => setSelectedModuleToHighlight(null)}
                                                            className="absolute right-6 top-1/2 transform -translate-y-1/2 p-0.5 hover:bg-gray-200 rounded"
                                                            title="Clear module selection"
                                                        >
                                                            <X className="w-3 h-3 text-gray-500" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Teaching Elements dropdown - Right side on larger screens, new line on smaller */}
                                        <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto sm:ml-auto min-w-0 mt-1 sm:mt-0">

                                            <Label htmlFor="pedagogy-type" className={`text-[9px] sm:text-xs font-medium whitespace-nowrap flex-shrink-0  ${shouldDisableControls ? "opacity-50 cursor-not-allowed" : ""}`}>
                                                <span className="hidden md:inline">Teaching Elements:</span>
                                                <span className="md:hidden">Elements:</span>
                                            </Label>
                                            <Select
                                                value=""
                                                onValueChange={() => { }}
                                                disabled={shouldDisableControls}
                                            >
                                                <SelectTrigger className="w-full sm:w-[160px] md:w-[200px] h-6 sm:h-7 text-[9px] sm:text-xs min-w-0" disabled={shouldDisableControls}>
                                                    <SelectValue placeholder={
                                                        selectedPedagogyTypes.length === 0
                                                            ? "Select elements"
                                                            : selectedPedagogyTypes.includes("iDo") &&
                                                                selectedPedagogyTypes.includes("weDo") &&
                                                                selectedPedagogyTypes.includes("youDo")
                                                                ? "All Elements"
                                                                : `${selectedPedagogyTypes.length} selected`
                                                    } />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <div
                                                        className="flex items-center space-x-2 p-2 hover:bg-gray-100"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <Checkbox
                                                            id="pedagogy-all"
                                                            checked={
                                                                selectedPedagogyTypes.includes("iDo") &&
                                                                selectedPedagogyTypes.includes("weDo") &&
                                                                selectedPedagogyTypes.includes("youDo")
                                                            }
                                                            onCheckedChange={(checked) => {
                                                                setSelectedPedagogyTypes(checked ? ["iDo", "weDo", "youDo"] : []);
                                                            }}
                                                        />
                                                        <label
                                                            htmlFor="pedagogy-all"
                                                            className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                                        >
                                                            All Teaching Elements
                                                        </label>
                                                    </div>
                                                    {["iDo", "weDo", "youDo"].map((type) => (
                                                        <div
                                                            key={type}
                                                            className="flex items-center space-x-2 p-2 hover:bg-gray-100"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <Checkbox
                                                                id={`pedagogy-${type}`}
                                                                checked={selectedPedagogyTypes.includes(type as any)}
                                                                onCheckedChange={(checked) => {
                                                                    setSelectedPedagogyTypes((prev: any) =>
                                                                        checked
                                                                            ? [...prev.filter((t: any) => t !== "all"), type as "iDo" | "weDo" | "youDo"]
                                                                            : prev.filter((t: any) => t !== type)
                                                                    );
                                                                }}
                                                            />
                                                            <label
                                                                htmlFor={`pedagogy-${type}`}
                                                                className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                                            >
                                                                {type === "iDo" ? "I Do Activities" :
                                                                    type === "weDo" ? "We Do Activities" : "You Do Activities"}
                                                            </label>
                                                        </div>
                                                    ))}
                                                </SelectContent>
                                            </Select>

                                        </div>
                                        {/* Utility Buttons */}

                                        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                                            <button
                                                className={`flex  items-center gap-1 text-[9px] sm:text-[10px] h-6 sm:h-7 px-1 sm:px-2 whitespace-nowrap
 ${selectedCourse && !shouldDisableControls
                                                        ? "bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 cursor-pointer text-white hover:brightness-110 hover:text-white shadow"
                                                        : "bg-gray-200 text-gray-400 cursor-not-allowed"
                                                    }
  rounded-full transition-colors duration-300`}

                                                title={selectedCourse ? "Click to view summary" : "Select a course to view summary"}
                                                onClick={() => setShowSummaryDialog(true)}
                                                disabled={!selectedCourse || shouldDisableControls}
                                            >
                                                <Eye className="w-3 h-3 flex-shrink-0" />
                                                <span className="hidden sm:inline">View Summary</span>
                                                <span className="sm:hidden">Summary</span>
                                            </button>

                                        </div>
                                        <button
                                            className={`flex items-center gap-1 text-[9px] sm:text-[10px] h-6 sm:h-7 px-2 sm:px-3 whitespace-nowrap
            ${selectedCourse && !shouldDisableControls
                                                    ? "bg-gradient-to-r from-[#FB8C3C] to-[#F0701F] cursor-pointer text-white hover:from-[#F0701F] hover:to-[#C2540F] shadow-md"
                                                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                                                }
            rounded-full transition-all duration-200 ease-in-out transform hover:scale-[1.02]`}
                                            title={selectedCourse ? "Click to preview course structure" : "Select a course to preview"}
                                            onClick={() => setShowMainFullPreviewDialog(true)}
                                            disabled={!selectedCourse || shouldDisableControls}
                                        >
                                            <Eye className="w-3 h-3 flex-shrink-0" />
                                            <span className="hidden sm:inline">Preview</span>
                                            <span className="sm:hidden">Preview</span>
                                        </button>

                                        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                                            <button
                                                className={`flex  items-center gap-1 text-[9px] sm:text-[10px] h-6 sm:h-7 px-2 sm:px-3 whitespace-nowrap
    ${selected && !shouldDisableControls
                                                        ? "bg-gradient-to-r from-[#FB8C3C] to-[#F0701F] cursor-pointer text-white hover:from-[#F0701F] hover:to-[#C2540F] shadow-md"
                                                        : "bg-gray-100 text-gray-400 cursor-not-allowed"
                                                    }
      rounded-full transition-all duration-200 ease-in-out transform hover:scale-[1.02]`}
                                                title={selected ? "Click to preview" : "Select an item to preview"}
                                                onClick={() => setShowPreviewDialog(true)}
                                                disabled={!selected || shouldDisableControls}
                                            >
                                                <Eye className="w-3 h-3 flex-shrink-0" />
                                                <span className="hidden sm:inline">Print</span>
                                                <span className="sm:hidden">Print</span>
                                            </button>
                                        </div>

                                        {/* Full View - the table alone, fullscreen, still editable */}
                                        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                                            <button
                                                className={`flex items-center gap-1 text-[9px] sm:text-[10px] h-6 sm:h-7 px-2 sm:px-3 whitespace-nowrap
    ${selectedCourse && !shouldDisableControls
                                                        ? "bg-gradient-to-r from-[#FB8C3C] to-[#F0701F] cursor-pointer text-white hover:from-[#F0701F] hover:to-[#C2540F] shadow-md"
                                                        : "bg-gray-100 text-gray-400 cursor-not-allowed"
                                                    }
      rounded-full transition-all duration-200 ease-in-out transform hover:scale-[1.02]`}
                                                title={selectedCourse ? "Open the table in full screen (Esc to exit)" : "Select a course first"}
                                                onClick={() => setIsTableFullView(true)}
                                                disabled={!selectedCourse || shouldDisableControls}
                                            >
                                                <Maximize2 className="w-3 h-3 flex-shrink-0" />
                                                <span className="hidden sm:inline">Full View</span>
                                                <span className="sm:hidden">Full</span>
                                            </button>
                                        </div>

                                    </div>
                                </div>

                                {/* Main Course Structure Table.
                                    Full View swaps this wrapper to a fixed overlay covering the
                                    viewport (a CSS overlay, not the native Fullscreen API, so the
                                    portaled dialogs/menus for add/edit/delete/merge stay visible). */}
                                <div
                                    className={isTableFullView
                                        ? "fixed inset-0 z-50 bg-gray-50 overflow-auto p-2"
                                        : "relative overflow-hidden"}
                                    style={isTableFullView ? {} : {
                                        // Dynamic height based on scaled content
                                        height: contentHeight ? `${contentHeight * tableZoomLevel}px` : 'auto',
                                        minHeight: 'fit-content'
                                    }}
                                >
                                    {isTableFullView && (
                                        <button
                                            onClick={() => setIsTableFullView(false)}
                                            title="Exit full view (Esc)"
                                            className="fixed top-2 right-2 z-40 flex items-center gap-1 text-[10px] sm:text-xs h-7 px-3 whitespace-nowrap
                                                bg-gradient-to-r from-[#FB8C3C] to-[#F0701F] cursor-pointer text-white hover:from-[#F0701F] hover:to-[#C2540F]
                                                shadow-md rounded-full transition-all duration-200 ease-in-out"
                                        >
                                            <Minimize2 className="w-3 h-3 flex-shrink-0" />
                                            <span>Exit</span>
                                        </button>
                                    )}
                                    <div
                                        ref={scaledContentRef}
                                        className="origin-top-left"
                                        style={{
                                            transform: `scale(${tableZoomLevel})`,
                                            transformOrigin: "top left",
                                            width: `${100 / tableZoomLevel}%`,
                                            // Dynamic negative margin based on actual content height and zoom
                                            marginBottom: isTableFullView ? 0 : `${calculateNegativeMargin()}px`
                                        }}
                                    >
                                        <div
                                            className={`bg-white rounded-xl shadow-sm border border-gray-200 relative flex flex-col`}
                                            style={{
                                                // Full View: fill the viewport (minus the overlay's p-2 padding).
                                                // Divided by the zoom for the same reason the wrapper above
                                                // multiplies its width by it: this box is laid out inside the
                                                // scaled space, so an uncompensated 70vh paints as 70vh * zoom and
                                                // the table frame itself shrinks on zoom out. Compensating keeps
                                                // the frame the same size on screen and lets the smaller content
                                                // inside it fit more rows -- which is the point of zooming out.
                                                maxHeight: isTableFullView
                                                    ? `calc((100vh - 16px) / ${tableZoomLevel})`
                                                    : `calc(70vh / ${tableZoomLevel})`,
                                            }}
                                        >
                                            <div className="flex-none">
                                                <div className="sticky top-0 z-30 bg-white border-b border-gray-200">
                                                    <div className="overflow-x-auto">
                                                        <Table className="border-separate border-spacing-0 min-w-full border-t border-l border-gray-400" style={{ tableLayout: 'fixed' }}>
                                                            <TableHeader className="bg-white">
                                                                {/* Main Headers */}
                                                                <TableRow className="bg-[#FFE4D0]">


                                                                    {/* Dynamic hierarchy columns */}
                                                                    {selectedCourse.courseHierarchy.map((level: any, index: any) => (
                                                                        <TableHead
                                                                            key={level}
                                                                            className={`border-r border-b border-gray-400 overflow-hidden text-center font-bold text-xs p-1 bg-[#FFE4D0] z-10`}
                                                                            style={{
                                                                                ...(hierarchyWidthPercentage ? { width: `${hierarchyWidthPercentage}%` } : {})
                                                                            }}
                                                                            rowSpan={3}
                                                                        >
                                                                            <div className="flex items-center justify-center gap-1 group">
                                                                                {level}
                                                                                {/* Add Module button - only show if course has testConfiguration */}
                                                                                {level === 'Module' && selectedCourse.testConfiguration && (
                                                                                    <div className="relative">
                                                                                        <button
                                                                                            onClick={() => {
                                                                                                setDialogType('module');
                                                                                                setShowDialog(true);
                                                                                            }}
                                                                                            className="flex items-center justify-center p-1 cursor-pointer rounded-full bg-[#F97316] hover:bg-[#EA6A1F] transition-all duration-200 shadow-lg relative z-10"
                                                                                            title="Add module"
                                                                                        >
                                                                                            <Plus className="w-4 h-4 text-white" />
                                                                                        </button>
                                                                                        <div className="absolute inset-0 rounded-full border-2 border-[#FDBA74] animate-ping"></div>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </TableHead>
                                                                    ))}
                                                                    <TableHead
                                                                        className={`border-r border-b border-gray-400 text-center font-bold text-xs p-1 bg-[#FFE4D0] z-10 min-w-[120px]`}
                                                                        rowSpan={3}
                                                                    >
                                                                        Skills
                                                                    </TableHead>
                                                                    <AnimatePresence>
                                                                        <motion.th
                                                                            key="level-header"
                                                                            variants={popAnimation}
                                                                            initial="initial"
                                                                            className={`border-r border-b border-gray-400 text-center font-bold text-xs p-1 bg-[#FFE4D0] z-10 min-w-[80px]`}

                                                                            rowSpan={3}
                                                                        >
                                                                            Level
                                                                        </motion.th>
                                                                    </AnimatePresence>
                                                                    {/* Teaching Learning Elements header - only shown if any activities exist */}
                                                                    {selectedPedagogyTypes.length > 0 && (activityTypes["iDo"].length > 0 || activityTypes["weDo"].length > 0 || activityTypes["youDo"].length > 0) && (
                                                                        <TableHead
                                                                            className={`border-r border-b border-gray-400 text-center bg-[#FFE4D0] font-bold text-xs p-1 min-w-[900px] transition-all duration-300 `}
                                                                            colSpan={
                                                                                (selectedPedagogyTypes.includes("iDo") ? activityTypes["iDo"].length : 0) +
                                                                                (selectedPedagogyTypes.includes("weDo") ? activityTypes["weDo"].length : 0) +
                                                                                (selectedPedagogyTypes.includes("youDo") ? activityTypes["youDo"].length : 0)
                                                                            }
                                                                        >
                                                                            {selectedPedagogyTypes.includes("iDo") && selectedPedagogyTypes.includes("weDo") && selectedPedagogyTypes.includes("youDo") &&
                                                                                activityTypes["iDo"].length > 0 && activityTypes["weDo"].length > 0 && activityTypes["youDo"].length > 0
                                                                                ? "All Teaching Elements"
                                                                                : selectedPedagogyTypes.map((type: any) => {
                                                                                    // Only show the pedagogy type if it has activities
                                                                                    if (activityTypes[type] && activityTypes[type].length > 0) {
                                                                                        return type === "iDo" ? "I Do Activities" :
                                                                                            type === "weDo" ? "We Do Activities" : "You Do Activities";
                                                                                    }
                                                                                    return null;
                                                                                }).filter(Boolean).join(" + ") // Filter out null values and join with "+"
                                                                            }
                                                                        </TableHead>
                                                                    )}
                                                                </TableRow>
                                                                {/* Activity Type Headers - only shown if activities exist */}
                                                                {selectedPedagogyTypes.length > 1 && (
                                                                    <TableRow className="bg-gray-100">
                                                                        {selectedPedagogyTypes.includes("iDo") && activityTypes["iDo"].length > 0 && (
                                                                            <TableHead
                                                                                colSpan={activityTypes["iDo"].length}
                                                                                className={`border-r border-b border-gray-400 text-center font-medium text-[9px] p-0.5 bg-yellow-100 transition-all duration-300 `}
                                                                            >
                                                                                I Do Activities
                                                                            </TableHead>
                                                                        )}
                                                                        {selectedPedagogyTypes.includes("weDo") && activityTypes["weDo"].length > 0 && (
                                                                            <TableHead
                                                                                colSpan={activityTypes["weDo"].length}
                                                                                className={`border-r border-b border-gray-400 text-center font-medium text-[9px] p-0.5 bg-orange-100 transition-all duration-300 `}
                                                                            >
                                                                                We Do Activities
                                                                            </TableHead>
                                                                        )}
                                                                        {selectedPedagogyTypes.includes("youDo") && activityTypes["youDo"].length > 0 && (
                                                                            <TableHead
                                                                                colSpan={activityTypes["youDo"].length}
                                                                                className={`border-r border-b border-gray-400 text-center font-medium text-[9px] p-0.5 bg-green-100 transition-all duration-300 `}
                                                                            >
                                                                                You Do Activities
                                                                            </TableHead>
                                                                        )}
                                                                    </TableRow>
                                                                )}

                                                                {/* Replace the activity type headers with: */}
                                                                {selectedPedagogyTypes.length > 0 && (
                                                                    <TableRow className="bg-gray-100">
                                                                        {selectedPedagogyTypes.includes("iDo") && activityTypes["iDo"].map((activity: any) => (
                                                                            <TableHead
                                                                                key={`iDo-${activity}`}
                                                                                className={`
      border-r border-b border-gray-400 text-center font-medium text-[9px] p-0.5 bg-yellow-100 
      transition-all duration-300 
      truncate hover:overflow-visible hover:whitespace-normal hover:z-50 hover:min-w-[120px]
    `}
                                                                                title={activity}
                                                                            >
                                                                                {activity}
                                                                            </TableHead>
                                                                        ))}
                                                                        {selectedPedagogyTypes.includes("weDo") && activityTypes["weDo"].map((activity: any) => (
                                                                            <TableHead
                                                                                key={`weDo-${activity}`}
                                                                                className={`
      border-r border-b border-gray-400 text-center font-medium text-[9px] p-0.5 bg-orange-100 
      transition-all duration-300 
      truncate hover:overflow-visible hover:whitespace-normal hover:z-50 hover:min-w-[120px]
    `}
                                                                                title={activity}
                                                                            >
                                                                                {activity}
                                                                            </TableHead>
                                                                        ))}
                                                                        {selectedPedagogyTypes.includes("youDo") && activityTypes["youDo"].map((activity: any) => (
                                                                            <TableHead
                                                                                key={`youDo-${activity}`}
                                                                                className={`
      border-r border-b border-gray-400 text-center font-medium text-[9px] p-0.5 bg-green-100 
      transition-all duration-300 
      truncate hover:overflow-visible hover:whitespace-normal hover:z-50 hover:min-w-[120px]
    `}
                                                                                title={activity}
                                                                            >
                                                                                {activity}
                                                                            </TableHead>
                                                                        ))}
                                                                    </TableRow>
                                                                )}

                                                            </TableHeader>
                                                        </Table>
                                                    </div>
                                                </div>
                                            </div>
                                            {/* [scrollbar-width:none] is required alongside the webkit rule: the
                                                global `* { scrollbar-width: thin }` makes Chromium/Edge ignore
                                                ::-webkit-scrollbar styling, so without it a real scrollbar
                                                appears here, steals ~11px from this container, and shifts every
                                                body column out of line with the header/footer tables. */}
                                            <div className="flex-1 overflow-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                                <Table className="border-separate border-spacing-0 min-w-full border-l border-gray-400" style={{ tableLayout: 'fixed' }}>
                                                    {/* Hidden header for column alignment */}
                                                    <TableHeader className="invisible" style={{ height: '0px', lineHeight: '0px' }}>
                                                        <TableRow style={{ height: '0px' }}>
                                                            {selectedCourse.courseHierarchy.map((level: any, index: any) => (
                                                                <TableHead
                                                                    key={`hidden-${level}`}
                                                                    className="border-0 p-0"
                                                                    style={{
                                                                        height: '0px',
                                                                        lineHeight: '0px',
                                                                        ...(hierarchyWidthPercentage ? { width: `${hierarchyWidthPercentage}%` } : { minWidth: '120px' })
                                                                    }}
                                                                />
                                                            ))}
                                                            <TableHead className="border-0 p-0" style={{
                                                                height: '0px',
                                                                lineHeight: '0px',
                                                                minWidth: '120px'
                                                            }} />
                                                            <TableHead className="border-0 p-0" style={{
                                                                height: '0px',
                                                                lineHeight: '0px',
                                                                minWidth: '80px'
                                                            }} />
                                                            {selectedPedagogyTypes.length > 0 && (
                                                                <>
                                                                    {selectedPedagogyTypes.includes("iDo") && activityTypes["iDo"].map((activity: any) => (
                                                                        <TableHead key={`hidden-iDo-${activity}`} className="border-0 p-0" style={{
                                                                            height: '0px',
                                                                            lineHeight: '0px',
                                                                            minWidth: '70px'
                                                                        }} />
                                                                    ))}
                                                                    {selectedPedagogyTypes.includes("weDo") && activityTypes["weDo"].map((activity: any) => (
                                                                        <TableHead key={`hidden-weDo-${activity}`} className="border-0 p-0" style={{
                                                                            height: '0px',
                                                                            lineHeight: '0px',
                                                                            minWidth: '70px'
                                                                        }} />
                                                                    ))}
                                                                    {selectedPedagogyTypes.includes("youDo") && activityTypes["youDo"].map((activity: any) => (
                                                                        <TableHead key={`hidden-youDo-${activity}`} className="border-0 p-0" style={{
                                                                            height: '0px',
                                                                            lineHeight: '0px',
                                                                            minWidth: '70px'
                                                                        }} />
                                                                    ))}
                                                                </>
                                                            )}
                                                        </TableRow>
                                                    </TableHeader>

                                                    <TableBody>
                                                        {(() => {
                                                            const moduleRowTracker: { [key: string]: boolean } = {};
                                                            const subModuleRowTracker: { [key: string]: boolean } = {};
                                                            const topicRowTracker: { [key: string]: boolean } = {};
                                                            const subtopicRowTracker: { [key: string]: boolean } = {};

                                                            return tableRows.map((row: any, index: any) => {
                                                                const isFirstSubtopicInModule = !moduleRowTracker[row.moduleId]
                                                                const isFirstSubtopicInSubModule = !subModuleRowTracker[row.subModuleId];
                                                                const isFirstSubtopicInTopic = !topicRowTracker[row.topicId]
                                                                const isFirstSubtopicInSubtopic = !subtopicRowTracker[row.subtopicId];

                                                                if (isFirstSubtopicInModule) {
                                                                    moduleRowTracker[row.moduleId] = true
                                                                }
                                                                if (isFirstSubtopicInSubModule) subModuleRowTracker[row.subModuleId] = true;
                                                                if (isFirstSubtopicInTopic) {
                                                                    topicRowTracker[row.topicId] = true
                                                                }
                                                                if (isFirstSubtopicInSubtopic) subtopicRowTracker[row.subtopicId] = true;


                                                                return (
                                                                    <motion.tr
                                                                        key={`${row.moduleId}-${row.topicId}-${row.subtopicId}`}
                                                                        className="hover:bg-gray-50 h-6"
                                                                        initial={{ opacity: 0, y: 10 }}
                                                                        animate={{ opacity: 1, y: 0 }}
                                                                        transition={{ duration: 0.2, delay: index * 0.01 }}
                                                                        layout // This enables smooth layout animations when rows change
                                                                    >

                                                                        {/* Module Cell */}
                                                                        {/* Module Cell */}
                                                                        {selectedCourse.courseHierarchy.includes('Module') && isFirstSubtopicInModule && (
                                                                            <TableCell
                                                                                data-module-id={row.moduleId} // Add this data attribute for scrolling
                                                                                rowSpan={moduleSpans[row.moduleId]}
                                                                                draggable={!isDefaultItem(row.moduleName)}
                                                                                onDragStart={(e) => handleModuleDragStart(e, row.moduleId)}
                                                                                onDragOver={(e) => handleDragOver(e, row.moduleId, 'module')}
                                                                                onDragEnd={handleModuleDragEnd}
                                                                                title={`Enable actions to edit, delete, or change the position of "${row.moduleName}"`}
                                                                                onDrop={(e) => handleModuleDrop(e, row.moduleId)}
                                                                                className={`border-r border-b border-gray-400 p-1.5 bg-[#FFF3EA] align-middle
     z-10 
    text-[12px] font-medium text-gray-800 tracking-wide
      ${draggingModuleId === row.moduleId ? 'opacity-30 bg-gray-200' : ''} 
      ${dragOverId === row.moduleId ? 'border-t-2 border-[#F97316]' : ''}
      ${movableCell && !isCellMovable('module', row.moduleId) ? 'opacity-50' : ''}
      ${isCellMovable('module', row.moduleId) ? 'border-2 border-[#F97316] cursor-grab hover:bg-[#FFE4D0]' : ''}
      ${selectedModuleToHighlight === row.moduleId ? 'bg-[#FFE4D0] shadow-lg' : ''} // Highlight style
    `}
                                                                            >
                                                                                <div
                                                                                    className={`relative flex items-center justify-center w-full ${actionsEnabled && !isDefaultItem(row.moduleName) ? 'py-1.5' : ''}`}
                                                                                >
                                                                                    {/* Highlight indicator */}
                                                                                    {selectedModuleToHighlight === row.moduleId && (
                                                                                        <div className="absolute -left-1 top-1/2 transform -translate-y-1/2">
                                                                                            <div className="w-2 h-2 rounded-full bg-[#F97316] animate-pulse"></div>
                                                                                        </div>
                                                                                    )}

                                                                                    {deleteMode.type === 'module' && !isDefaultItem(row.moduleName) && (
                                                                                        <div className="flex-[0.1] flex justify-start mr-1">
                                                                                            <input
                                                                                                type="checkbox"
                                                                                                checked={deleteMode.selectedItems.has(row.moduleId)}
                                                                                                onChange={(e) => handleDeleteModeSelection(row.moduleId, e.target.checked)}
                                                                                                className="w-3.5 h-3.5 cursor-pointer accent-red-500"
                                                                                            />
                                                                                        </div>
                                                                                    )}
                                                                                    <span
                                                                                        className="flex-[0.8] text-center px-2 break-words whitespace-normal overflow-hidden text-ellipsis"
                                                                                    >
                                                                                        {row.moduleName === "Default Module" ? "-" : row.moduleName}
                                                                                    </span>

                                                                                    {actionsEnabled && !isDefaultItem(row.moduleName) && deleteMode.type !== 'module' && (
                                                                                        <div className="flex-[0.2] flex justify-end">
                                                                                            <CellActionsMenu
                                                                                                row={row}
                                                                                                type="module"
                                                                                                onEdit={() => {
                                                                                                    const module = modules.find((m: any) => m._id === row.moduleId);
                                                                                                    if (module) handleEdit('module', module);
                                                                                                }}
                                                                                                onDelete={() => handleDeleteClick('module', row.moduleId)}
                                                                                                onEnableDrag={() => {
                                                                                                    setMovableCell({ type: 'module', id: row.moduleId })
                                                                                                    setIsMoveModeActive(true)
                                                                                                }}
                                                                                                onMultipleDelete={() => activateHierarchicalDeleteMode('module', row.moduleId)}
                                                                                            />
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </TableCell>
                                                                        )}
                                                                        {/* SubModule Cell */}
                                                                        {selectedCourse.courseHierarchy.includes('Sub Module') && isFirstSubtopicInSubModule && (
                                                                            <TableCell
                                                                                rowSpan={subModuleSpans[row.subModuleId]}
                                                                                draggable={!isDefaultItem(row.subModuleName)}
                                                                                onDragStart={(e) => handleSubModuleDragStart(e, row.subModuleId)}
                                                                                onDragOver={(e) => handleDragOver(e, row.subModuleId, 'submodule')}
                                                                                onDragEnd={handleSubModuleDragEnd}
                                                                                onDrop={(e) => handleSubModuleDrop(e, row.subModuleId)}
                                                                                title={`Enable actions to edit, delete, or change the position of "${row.subModuleName}"`}

                                                                                className={`border-r border-b border-gray-400 p-1.5 bg-[#FFF3EA] align-middle
     z-10 left-[120px]
    text-[12px] font-medium text-gray-800 tracking-wide
                                                                                    
                                                                                   
                                                                                       ${draggingSubModuleId === row.subModuleId ? 'opacity-30 bg-gray-200' : ''} 
            ${dragOverId === row.subModuleId ? 'border-t-2 border-[#F97316]' : ''}
            ${movableCell && !isCellMovable('submodule', row.subModuleId) ? 'opacity-50' : ''}
  ${isCellMovable('submodule', row.subModuleId) ? 'border-2 border-[#F97316] cursor-grab hover:bg-[#FFE4D0]' : ''}
                                                                                    `}
                                                                            >
                                                                                <div className={`relative flex items-center justify-center w-full ${actionsEnabled && !isDefaultItem(row.subModuleName) ? 'py-1.5' : ''}`}>
                                                                                    {/* Checkbox for delete mode */}
                                                                                    {(deleteMode.type === 'submodule' && !hierarchicalDeleteMode && !isDefaultItem(row.subModuleName)) ||
                                                                                        (shouldShowHierarchicalCheckbox('submodule', row.subModuleId) && !isDefaultItem(row.subModuleName)) ? (
                                                                                        <div className="flex-[0.1] flex justify-start mr-1">
                                                                                            <input
                                                                                                type="checkbox"
                                                                                                checked={deleteMode.selectedItems.has(row.subModuleId)}
                                                                                                onChange={(e) => handleDeleteModeSelection(row.subModuleId, e.target.checked)}
                                                                                                className="w-3.5 h-3.5 cursor-pointer accent-red-500"
                                                                                            />
                                                                                        </div>
                                                                                    ) : null}
                                                                                    {actionsEnabled && isDefaultItem(row.subModuleName) ? (
                                                                                        <AddCellButton
                                                                                            onClick={() => {
                                                                                                const parentModule = modules.find((m: any) => m._id === row.moduleId);
                                                                                                if (parentModule) {
                                                                                                    setSelectedModuleForSubModule({
                                                                                                        id: parentModule._id,
                                                                                                        name: parentModule.title
                                                                                                    });
                                                                                                    setDialogType('submodule');
                                                                                                    setShowDialog(true);
                                                                                                }
                                                                                            }}
                                                                                            label="Sub Module"
                                                                                        />
                                                                                    ) : (
                                                                                        <>
                                                                                            <span className="flex-[0.8] text-center px-2 break-words whitespace-normal overflow-hidden text-ellipsis">
                                                                                                {row.subModuleName}
                                                                                            </span>
                                                                                            {actionsEnabled && !isDefaultItem(row.subModuleName) && deleteMode.type !== 'submodule' && (
                                                                                                <div className="flex-[0.2] flex justify-end">
                                                                                                    <CellActionsMenu
                                                                                                        row={row}
                                                                                                        type="submodule"
                                                                                                        onAdd={() => {
                                                                                                            const hierarchyLevels = selectedCourse?.courseHierarchy.map((l: any) => l.toLowerCase()) || [];
                                                                                                            const hasSubModules = hierarchyLevels.includes('sub module');

                                                                                                            if (hasSubModules) {
                                                                                                                const parentModule = modules.find((m: any) => m._id === row.moduleId);
                                                                                                                if (parentModule) {
                                                                                                                    setSelectedModuleForSubModule({
                                                                                                                        id: parentModule._id,
                                                                                                                        name: parentModule.title
                                                                                                                    });
                                                                                                                    setDialogType('submodule');
                                                                                                                    setShowDialog(true);
                                                                                                                }
                                                                                                            } else {
                                                                                                                const parentModule = modules.find((m: any) => m._id === row.moduleId);
                                                                                                                if (parentModule) {
                                                                                                                    setSelectedSubModuleForTopic({
                                                                                                                        id: parentModule._id,
                                                                                                                        moduleId: parentModule._id,
                                                                                                                        name: parentModule.title
                                                                                                                    });
                                                                                                                    setDialogType('topic');
                                                                                                                    setShowDialog(true);
                                                                                                                }
                                                                                                            }
                                                                                                        }}
                                                                                                        onEdit={() => {
                                                                                                            const subModule = subModules.find((sm: any) => sm._id === row.subModuleId);
                                                                                                            if (subModule) handleEdit("submodule", subModule);
                                                                                                        }}
                                                                                                        onDelete={() => handleDeleteClick("submodule", row.subModuleId)}
                                                                                                        onEnableDrag={() => {
                                                                                                            setMovableCell({ type: 'submodule', id: row.subModuleId });
                                                                                                            setIsMoveModeActive(true);
                                                                                                        }}
                                                                                                        onMultipleDelete={() => activateHierarchicalDeleteMode('submodule', row.subModuleId)}
                                                                                                        addLabel={selectedCourse?.courseHierarchy.includes('Sub Module') ? 'New Sub Module' : 'New Topic'}
                                                                                                    />
                                                                                                </div>
                                                                                            )}
                                                                                        </>
                                                                                    )}
                                                                                </div>
                                                                            </TableCell>
                                                                        )}
                                                                        {/* Topic Cell */}
                                                                        {selectedCourse.courseHierarchy.includes("Topic") && isFirstSubtopicInTopic && (
                                                                            <TableCell
                                                                                rowSpan={topicSpans[row.topicId]}
                                                                                draggable={!isDefaultItem(row.topicName)}
                                                                                title={`Enable actions to edit, delete, or change the position of "${row.topicName}"`}

                                                                                onDragStart={(e) => handleTopicDragStart(e, row.topicId)}
                                                                                onDragOver={(e) => handleDragOver(e, row.topicId, 'topic')}
                                                                                onDragEnd={handleTopicDragEnd}
                                                                                onDrop={(e) => handleTopicDrop(e, row.topicId)}
                                                                                className={`border-r border-b border-gray-400 text-center font-medium text-gray-800 tracking-wide p-1.5 bg-[#FFF3EA] align-middle text-[12px]  z-10 ${selectedCourse.courseHierarchy.includes("Sub Module") ? "left-[120px] " : "left-[120px] "
                                                                                    }
                                                                                     ${draggingTopicId === row.topicId ? 'opacity-30 bg-gray-200' : ''} 
            ${dragOverId === row.topicId ? 'border-t-2 border-[#F97316]' : ''}
           ${movableCell && !isCellMovable('topic', row.topicId) ? 'opacity-50' : ''}
  ${isCellMovable('topic', row.topicId) ? 'border-2 border-[#F97316] cursor-grab hover:bg-[#FFE4D0]' : ''}
                                                                                    `}
                                                                            >

                                                                                <div className={`relative flex items-center justify-center w-full ${actionsEnabled && !isDefaultItem(row.topicName) ? 'py-1.5' : ''}`}>
                                                                                    {/* Checkbox for delete mode */}
                                                                                    {(deleteMode.type === 'topic' && !hierarchicalDeleteMode && !isDefaultItem(row.topicName)) ||
                                                                                        (shouldShowHierarchicalCheckbox('topic', row.topicId) && !isDefaultItem(row.topicName)) ? (
                                                                                        <div className="flex-[0.1] flex justify-start mr-1">
                                                                                            <input
                                                                                                type="checkbox"
                                                                                                checked={deleteMode.selectedItems.has(row.topicId)}
                                                                                                onChange={(e) => handleDeleteModeSelection(row.topicId, e.target.checked)}
                                                                                                className="w-3.5 h-3.5 cursor-pointer accent-red-500"
                                                                                            />
                                                                                        </div>
                                                                                    ) : null}
                                                                                    {actionsEnabled && isDefaultItem(row.topicName) ? (
                                                                                        <AddCellButton
                                                                                            onClick={() => {
                                                                                                const hierarchyLevels = selectedCourse?.courseHierarchy.map((l: any) => l.toLowerCase()) || [];
                                                                                                const hasSubModules = hierarchyLevels.includes('sub module');

                                                                                                if (hasSubModules) {
                                                                                                    // Parent is submodule
                                                                                                    const parentSubModule = subModules.find((sm: any) => sm._id === row.subModuleId);
                                                                                                    if (parentSubModule) {
                                                                                                        setSelectedSubModuleForTopic({
                                                                                                            id: parentSubModule._id,
                                                                                                            moduleId: parentSubModule.moduleId,
                                                                                                            name: parentSubModule.title
                                                                                                        });
                                                                                                        setDialogType('topic');
                                                                                                        setDisableAddonlyMode(false);
                                                                                                        setShowDialog(true);
                                                                                                    } else if (isLastHierarchy2("topic")) {
                                                                                                        setSelectedSubModuleForTopic({
                                                                                                            id: null,
                                                                                                            moduleId: row.moduleId || 'orphaned',
                                                                                                            name: '-'
                                                                                                        });
                                                                                                        setDialogType('topic');
                                                                                                        setShowDialog(true);
                                                                                                        setDisableAddonlyMode(true);
                                                                                                        setAddOnlyPedagogyLevel(true); // Force pedagogy/level mode
                                                                                                    }
                                                                                                } else {
                                                                                                    // Parent is module
                                                                                                    const parentModule = modules.find((m: any) => m._id === row.moduleId);
                                                                                                    if (parentModule) {
                                                                                                        setSelectedSubModuleForTopic({
                                                                                                            id: parentModule._id, // Using module ID as subModuleId
                                                                                                            moduleId: parentModule._id,
                                                                                                            name: parentModule.title
                                                                                                        });
                                                                                                        setDialogType('topic');
                                                                                                        setShowDialog(true);
                                                                                                    }
                                                                                                }
                                                                                            }}
                                                                                            label="Topic"
                                                                                        />
                                                                                    ) : (
                                                                                        <>
                                                                                            <span className="flex-[0.8] text-center px-2 break-words whitespace-normal overflow-hidden text-ellipsis">
                                                                                                {row.topicName}
                                                                                            </span>
                                                                                            {actionsEnabled && !isDefaultItem(row.topicName) && deleteMode.type !== 'topic' && (
                                                                                                <div className="flex-[0.2] flex justify-end">
                                                                                                    <CellActionsMenu
                                                                                                        row={row}
                                                                                                        type="topic"
                                                                                                        onAdd={() => {
                                                                                                            const hierarchyLevels = selectedCourse?.courseHierarchy.map((l: any) => l.toLowerCase()) || [];
                                                                                                            const hasSubModules = hierarchyLevels.includes('sub module');

                                                                                                            if (hasSubModules) {
                                                                                                                // If course has submodules, the parent is the current submodule
                                                                                                                const currentSubModule = subModules.find((sm: any) => sm._id === row.subModuleId);
                                                                                                                if (currentSubModule) {
                                                                                                                    setSelectedSubModuleForTopic({
                                                                                                                        id: currentSubModule._id,
                                                                                                                        moduleId: currentSubModule.moduleId,
                                                                                                                        name: currentSubModule.title
                                                                                                                    });
                                                                                                                    setDialogType('topic');
                                                                                                                    setShowDialog(true);
                                                                                                                }
                                                                                                            } else {
                                                                                                                // If course doesn't have submodules, the parent is the current module
                                                                                                                const currentModule = modules.find((m: any) => m._id === row.moduleId);
                                                                                                                if (currentModule) {
                                                                                                                    setSelectedSubModuleForTopic({
                                                                                                                        id: currentModule._id, // Using module ID as subModuleId for topics
                                                                                                                        moduleId: currentModule._id,
                                                                                                                        name: currentModule.title
                                                                                                                    });
                                                                                                                    setDialogType('topic');
                                                                                                                    setShowDialog(true);
                                                                                                                }
                                                                                                            }
                                                                                                        }}
                                                                                                        onEdit={() => {
                                                                                                            const topic = topics.find((t: any) => t._id === row.topicId);
                                                                                                            if (topic) handleEdit("topic", topic);
                                                                                                        }}
                                                                                                        onDelete={() => handleDeleteClick("topic", row.topicId)}
                                                                                                        onMultipleDelete={() => activateHierarchicalDeleteMode('topic', row.topicId)}
                                                                                                        onEnableDrag={() => {
                                                                                                            setMovableCell({ type: 'topic', id: row.topicId })
                                                                                                            setIsMoveModeActive(true);
                                                                                                        }}
                                                                                                        addLabel="New Topic"
                                                                                                    />
                                                                                                </div>
                                                                                            )}
                                                                                        </>
                                                                                    )}
                                                                                </div>
                                                                            </TableCell>
                                                                        )}
                                                                        {/* Subtopic Cell */}
                                                                        {selectedCourse.courseHierarchy.includes("Sub Topic") && (
                                                                            <TableCell
                                                                                draggable={!isDefaultItem(row.subtopicName)}
                                                                                onDragStart={(e) => handleSubtopicDragStart(e, row.subtopicId)}
                                                                                title={`Enable actions to edit, delete, or change the position of "${row.subtopicName}"`}
                                                                                onDragOver={(e) => handleDragOver(e, row.subtopicId, 'subtopic')}
                                                                                onDragEnd={handleSubtopicDragEnd}
                                                                                onDrop={(e) => handleSubtopicDrop(e, row.subtopicId)}
                                                                                className={`border-r border-b border-gray-400 text-center text-[12px] font-medium text-gray-800 tracking-wide p-1.5 bg-[#FFF3EA] align-middle h-[32px]  z-10
                                                                                   
                                                                                     ${selectedCourse.courseHierarchy.includes("Sub Module") && selectedCourse.courseHierarchy.includes("Topic")
                                                                                        ? "left-[360px] "
                                                                                        : selectedCourse.courseHierarchy.includes("Sub Module") || selectedCourse.courseHierarchy.includes("Topic")
                                                                                            ? "left-[120px]"
                                                                                            : "left-[120px]"
                                                                                    }
                                                                                     ${draggingSubtopicId === row.subtopicId ? 'opacity-30 bg-gray-200' : ''} 
            ${dragOverId === row.subtopicId ? 'border-t-2 border-[#F97316]' : ''}
           ${movableCell && !isCellMovable('subtopic', row.subtopicId) ? 'opacity-50' : ''}
  ${isCellMovable('subtopic', row.subtopicId) ? 'border-2 border-[#F97316] cursor-grab hover:bg-[#FFE4D0]' : ''} `}
                                                                            >
                                                                                <div className={`relative flex items-center justify-center w-full ${actionsEnabled && !isDefaultItem(row.subtopicName) ? 'py-1.5' : ''}`}>
                                                                                    {/* Checkbox for delete mode */}
                                                                                    {(deleteMode.type === 'subtopic' && !hierarchicalDeleteMode && !isDefaultItem(row.subtopicName)) ||
                                                                                        (shouldShowHierarchicalCheckbox('subtopic', row.subtopicId) && !isDefaultItem(row.subtopicName)) ? (
                                                                                        <div className="flex-[0.1] flex justify-start mr-1">
                                                                                            <input
                                                                                                type="checkbox"
                                                                                                checked={deleteMode.selectedItems.has(row.subtopicId)}
                                                                                                onChange={(e) => handleDeleteModeSelection(row.subtopicId, e.target.checked)}
                                                                                                className="w-3.5 h-3.5 cursor-pointer accent-red-500"
                                                                                            />
                                                                                        </div>
                                                                                    ) : null}
                                                                                    {actionsEnabled && isDefaultItem(row.subtopicName) ? (
                                                                                        <AddCellButton
                                                                                            onClick={() => {
                                                                                                const parentTopic = topics.find((t: any) => t._id === row.topicId);
                                                                                                if (parentTopic) {
                                                                                                    setSelectedTopicForSubTopic({
                                                                                                        id: parentTopic._id,
                                                                                                        moduleId: parentTopic.moduleId,
                                                                                                        subModuleId: parentTopic.subModuleId,
                                                                                                        name: parentTopic.title
                                                                                                    });
                                                                                                    setDisableAddonlyMode(false);
                                                                                                    setDialogType('subtopic');
                                                                                                    setShowDialog(true);
                                                                                                } else if (isLastHierarchy2("subtopic")) {

                                                                                                    setSelectedTopicForSubTopic({
                                                                                                        id: null,
                                                                                                        moduleId: row.moduleId || null,
                                                                                                        subModuleId: filterPlaceholders2(row.subModuleId) || null,
                                                                                                        name: '-'
                                                                                                    });
                                                                                                    setDialogType('subtopic');
                                                                                                    setDisableAddonlyMode(true);
                                                                                                    setShowDialog(true);
                                                                                                    setAddOnlyPedagogyLevel(true); // Force pedagogy/level mode
                                                                                                }

                                                                                            }}
                                                                                            label="Sub Topic"
                                                                                        />
                                                                                    ) : (
                                                                                        <>
                                                                                            <span className="flex-[0.8] text-center px-2 break-words whitespace-normal overflow-hidden text-ellipsis">
                                                                                                {row.subtopicName}
                                                                                            </span>
                                                                                            {actionsEnabled && !isDefaultItem(row.subtopicName) && deleteMode.type !== 'subtopic' && (
                                                                                                <div className="flex-[0.2] flex justify-end">
                                                                                                    <CellActionsMenu
                                                                                                        row={row}
                                                                                                        type="subtopic"
                                                                                                        onAdd={() => {
                                                                                                            const parentTopic = topics.find((t: any) => t._id === row.topicId);
                                                                                                            if (parentTopic) {
                                                                                                                setSelectedTopicForSubTopic({
                                                                                                                    id: parentTopic._id,
                                                                                                                    moduleId: parentTopic.moduleId,
                                                                                                                    subModuleId: parentTopic.subModuleId,
                                                                                                                    name: parentTopic.title
                                                                                                                });
                                                                                                                setDialogType('subtopic');
                                                                                                                setShowDialog(true);
                                                                                                            }
                                                                                                        }}
                                                                                                        onEdit={() => {
                                                                                                            const subtopic = subTopics.find((st: any) => st._id === row.subtopicId);
                                                                                                            if (subtopic) handleEdit("subtopic", subtopic);
                                                                                                        }}
                                                                                                        onDelete={() => handleDeleteClick("subtopic", row.subtopicId)}
                                                                                                        onEnableDrag={() => {
                                                                                                            setMovableCell({ type: 'subtopic', id: row.subtopicId })
                                                                                                            setIsMoveModeActive(true);
                                                                                                        }}
                                                                                                        addLabel="New Sub Topic"
                                                                                                    />
                                                                                                </div>
                                                                                            )}
                                                                                        </>
                                                                                    )}
                                                                                </div>
                                                                            </TableCell>
                                                                        )}
                                                                        {/* Languages Cell - renders every row for correct column alignment */}
                                                                        {/* Languages Cell - reads from last hierarchy level */}
                                                                        {(() => {
                                                                            const hierarchyLevels = selectedCourse.courseHierarchy;

                                                                            // Walk down from deepest to shallowest to find the last hierarchy object
                                                                            let testConfig: { coreProgram: string[]; frontend: string[]; database: string[] } = {
                                                                                coreProgram: [],
                                                                                frontend: [],
                                                                                database: [],
                                                                            };

                                                                            if (hierarchyLevels.includes('Sub Topic') && !isDefaultItem(row.subtopicName)) {
                                                                                const obj = subTopics.find((st: any) => st._id === row.subtopicId);
                                                                                const config = (obj as any)?.testConfiguration;
                                                                                const hasAny = config && (config.coreProgram?.length > 0 || config.frontend?.length > 0 || config.database?.length > 0);
                                                                                if (hasAny) testConfig = config;
                                                                            } else if (hierarchyLevels.includes('Topic') && !isDefaultItem(row.topicName)) {
                                                                                const obj = topics.find((t: any) => t._id === row.topicId);
                                                                                const config = (obj as any)?.testConfiguration;
                                                                                const hasAny = config && (config.coreProgram?.length > 0 || config.frontend?.length > 0 || config.database?.length > 0);
                                                                                if (hasAny) testConfig = config;
                                                                            } else if (hierarchyLevels.includes('Sub Module') && !isDefaultItem(row.subModuleName)) {
                                                                                const obj = subModules.find((sm: any) => sm._id === row.subModuleId);
                                                                                const config = (obj as any)?.testConfiguration;
                                                                                const hasAny = config && (config.coreProgram?.length > 0 || config.frontend?.length > 0 || config.database?.length > 0);
                                                                                if (hasAny) testConfig = config;
                                                                            }

                                                                            // Always fall back to module if nothing found above
                                                                            if (testConfig.coreProgram.length === 0 && testConfig.frontend.length === 0 && testConfig.database.length === 0) {
                                                                                const moduleObj = modules.find((m: any) => m._id === row.moduleId);
                                                                                testConfig = (moduleObj as any)?.testConfiguration ?? testConfig;
                                                                            }
                                                                            const { coreProgram, frontend, database } = testConfig;
                                                                            const hasAny = coreProgram.length > 0 || frontend.length > 0 || database.length > 0;

                                                                            return (
                                                                                <TableCell className="border-r border-b border-gray-400 text-gray-700 p-2 bg-[#FFF3EA] align-middle min-w-[120px] max-w-[150px]">
                                                                                    {hasAny ? (
                                                                                        <div className="flex flex-col gap-2 items-center w-full">
                                                                                            {coreProgram.length > 0 && (
                                                                                                <div className="flex flex-col items-center w-full">
                                                                                                    <span className="font-bold text-[#C2540F] text-[11px] uppercase tracking-wide mb-1">Core</span>
                                                                                                    <div className="flex flex-wrap gap-1 justify-center">
                                                                                                        {coreProgram.map((lang: string) => (
                                                                                                            <span key={lang} className="bg-[#FFE4D0] text-[#9A3F0A] rounded-md px-1.5 py-0.5 text-[13px] font-medium text-center">
                                                                                                                {lang}
                                                                                                            </span>
                                                                                                        ))}
                                                                                                    </div>
                                                                                                </div>
                                                                                            )}
                                                                                            {frontend.length > 0 && (
                                                                                                <div className="flex flex-col items-center w-full">
                                                                                                    <span className="font-bold text-[#C2540F] text-[11px] uppercase tracking-wide mb-1">Frontend</span>
                                                                                                    <div className="flex flex-wrap gap-1 justify-center">
                                                                                                        {frontend.map((lang: string) => (
                                                                                                            <span key={lang} className="bg-[#FFE4D0] text-[#9A3F0A] rounded-md px-1.5 py-0.5 text-[13px] font-medium text-center">
                                                                                                                {lang}
                                                                                                            </span>
                                                                                                        ))}
                                                                                                    </div>
                                                                                                </div>
                                                                                            )}
                                                                                            {database.length > 0 && (
                                                                                                <div className="flex flex-col items-center w-full">
                                                                                                    <span className="font-bold text-green-700 text-[11px] uppercase tracking-wide mb-1">Database</span>
                                                                                                    <div className="flex flex-wrap gap-1 justify-center">
                                                                                                        {database.map((lang: string) => (
                                                                                                            <span key={lang} className="bg-green-100 text-green-800 rounded-md px-1.5 py-0.5 text-[13px] font-medium text-center">
                                                                                                                {lang}
                                                                                                            </span>
                                                                                                        ))}
                                                                                                    </div>
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    ) : (
                                                                                        <div className="text-center text-gray-400 text-[12px]">-</div>
                                                                                    )}
                                                                                </TableCell>
                                                                            );
                                                                        })()}
                                                                        {/* Learning Level Cell */}
                                                                        {renderLevelCell(row, index)}
                                                                        {/* Replace the activity cells rendering with: */}
                                                                        {selectedPedagogyTypes.length > 0 && (
                                                                            <>
                                                                                {selectedPedagogyTypes.includes("iDo") && activityTypes["iDo"].map((activity: any) => {
                                                                                    const mergeInfo = isCellMerged(index, "iDo", activity);
                                                                                    if (mergeInfo.isMerged && !mergeInfo.isStart) return null;
                                                                                    return renderActivityCell("iDo", activity, {
                                                                                        ...row,
                                                                                        subModuleId: row.subModuleId // Ensure subModuleId is passed
                                                                                    }, index, mergeInfo)
                                                                                })}
                                                                                {selectedPedagogyTypes.includes("weDo") && activityTypes["weDo"].map((activity: any) => {
                                                                                    const mergeInfo = isCellMerged(index, "weDo", activity);
                                                                                    if (mergeInfo.isMerged && !mergeInfo.isStart) return null;
                                                                                    return renderActivityCell("weDo", activity, {
                                                                                        ...row,
                                                                                        subModuleId: row.subModuleId // Ensure subModuleId is passed
                                                                                    }, index, mergeInfo)
                                                                                })}
                                                                                {selectedPedagogyTypes.includes("youDo") && activityTypes["youDo"].map((activity: any) => {
                                                                                    const mergeInfo = isCellMerged(index, "youDo", activity);
                                                                                    if (mergeInfo.isMerged && !mergeInfo.isStart) return null;
                                                                                    return renderActivityCell("youDo", activity, {
                                                                                        ...row,
                                                                                        subModuleId: row.subModuleId // Ensure subModuleId is passed
                                                                                    }, index, mergeInfo)
                                                                                })}
                                                                            </>
                                                                        )}
                                                                    </motion.tr>
                                                                )
                                                            })
                                                        })()}

                                                    </TableBody>
                                                </Table>
                                            </div>
                                            <div className="flex-none">
                                                <div className="sticky bottom-0 z-30 bg-white border-t border-gray-200">
                                                    <div className="overflow-x-auto">
                                                        <Table className="border-separate border-spacing-0 min-w-full border-l border-gray-400" style={{ tableLayout: 'fixed' }}>
                                                            {/* Hidden header to match column widths - MUST BE IDENTICAL TO ABOVE */}
                                                            <TableHeader className="invisible" style={{ height: '0px', lineHeight: '0px' }}>
                                                                <TableRow style={{ height: '0px' }}>
                                                                    {selectedCourse.courseHierarchy.map((level: any, index: any) => (
                                                                        <TableHead
                                                                            key={`hidden-${level}`}
                                                                            className="border-0 p-0"
                                                                            style={{
                                                                                height: '0px',
                                                                                lineHeight: '0px',
                                                                                ...(hierarchyWidthPercentage ? { width: `${hierarchyWidthPercentage}%` } : { minWidth: '120px' })
                                                                            }}
                                                                        />
                                                                    ))}
                                                                    <TableHead className="border-0 p-0" style={{
                                                                        height: '0px',
                                                                        lineHeight: '0px',
                                                                        minWidth: '120px'
                                                                    }} />
                                                                    <TableHead className="border-0 p-0" style={{
                                                                        height: '0px',
                                                                        lineHeight: '0px',
                                                                        minWidth: '80px'
                                                                    }} />
                                                                    {selectedPedagogyTypes.length > 0 && (
                                                                        <>
                                                                            {selectedPedagogyTypes.includes("iDo") && activityTypes["iDo"].map((activity: any) => (
                                                                                <TableHead key={`hidden-iDo-${activity}`} className="border-0 p-0" style={{
                                                                                    height: '0px',
                                                                                    lineHeight: '0px',
                                                                                    minWidth: '70px'
                                                                                }} />
                                                                            ))}
                                                                            {selectedPedagogyTypes.includes("weDo") && activityTypes["weDo"].map((activity: any) => (
                                                                                <TableHead key={`hidden-weDo-${activity}`} className="border-0 p-0" style={{
                                                                                    height: '0px',
                                                                                    lineHeight: '0px',
                                                                                    minWidth: '70px'
                                                                                }} />
                                                                            ))}
                                                                            {selectedPedagogyTypes.includes("youDo") && activityTypes["youDo"].map((activity: any) => (
                                                                                <TableHead key={`hidden-youDo-${activity}`} className="border-0 p-0" style={{
                                                                                    height: '0px',
                                                                                    lineHeight: '0px',
                                                                                    minWidth: '70px'
                                                                                }} />
                                                                            ))}
                                                                        </>
                                                                    )}
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {selectedPedagogyTypes.length > 0 && (
                                                                    <TableRow className="bg-gray-200 font-bold sticky bottom-0">


                                                                        <TableCell
                                                                            className={`border-r border-b border-gray-400 text-center p-1 text-[10px] bg-gray-200 z-10 left-0`}
                                                                            colSpan={selectedCourse.courseHierarchy.length + 2}
                                                                        >
                                                                            Total Hours
                                                                        </TableCell>

                                                                        {selectedPedagogyTypes.includes("iDo") && activityTypes["iDo"].map((activity: any) => (
                                                                            <TableCell
                                                                                key={`total-iDo-${activity}`}
                                                                                className="border-r border-b border-gray-400 text-center font-bold p-0.5 text-[10px] bg-yellow-100 min-w-[70px] h-[32px]"
                                                                            >
                                                                                {calculateTotalHours("iDo", activity) || "0"}
                                                                            </TableCell>
                                                                        ))}
                                                                        {selectedPedagogyTypes.includes("weDo") && activityTypes["weDo"].map((activity: any) => (
                                                                            <TableCell
                                                                                key={`total-weDo-${activity}`}
                                                                                className="border-r border-b border-gray-400 text-center font-bold p-0.5 text-[10px] bg-orange-100 min-w-[70px] h-[32px]"
                                                                            >
                                                                                {calculateTotalHours("weDo", activity) || "0"}
                                                                            </TableCell>
                                                                        ))}
                                                                        {selectedPedagogyTypes.includes("youDo") && activityTypes["youDo"].map((activity: any) => (
                                                                            <TableCell
                                                                                key={`total-youDo-${activity}`}
                                                                                className="border-r border-b border-gray-400 text-center font-bold p-0.5 text-[10px] bg-green-100 min-w-[70px] h-[32px]"
                                                                            >
                                                                                {calculateTotalHours("youDo", activity) || "0"}
                                                                            </TableCell>
                                                                        ))}
                                                                    </TableRow>
                                                                )}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        {/* Total Hours Display in Action Button Area */}

                                        <div className="flex justify-between items-center mt-5 px-3">
                                            <div className="text-sm text-gray-600">
                                                <span className="font-medium">Double-click a cell to add or edit • Select rows to merge</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {/* Enhanced Floating Delete Mode Actions */}
                            {(deleteMode.type && (deleteMode || hierarchicalDeleteMode)) && (
                                <motion.div
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 15 }}
                                    className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 w-[95%] sm:w-auto"
                                >
                                    <div
                                        className="backdrop-blur-md bg-orange-100/90 dark:bg-orange-950/90
  border border-orange-200 dark:border-orange-800
  rounded-2xl shadow-lg px-3.5 py-2.5 sm:px-4 sm:py-2
  flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 sm:gap-4
  transition-all duration-300 ease-in-out"
                                    >
                                        {/* Select All Checkbox - Show different text for hierarchical mode */}
                                        <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-start">
                                            <input
                                                type="checkbox"
                                                onChange={(e) => {
                                                    if (hierarchicalDeleteMode) {
                                                        // For hierarchical mode, select only children of the specific parent
                                                        const children = getImmediateChildrenForParent(
                                                            hierarchicalDeleteMode.parentType,
                                                            hierarchicalDeleteMode.parentId
                                                        );
                                                        const childIds = children.map((child: any) => child._id);
                                                        handleDeleteModeSelectAll(e.target.checked, children);
                                                    } else {
                                                        // For global mode, select all items of the type
                                                        const items = getItemsForDeletion(deleteMode.type!);
                                                        handleDeleteModeSelectAll(e.target.checked, items);
                                                    }
                                                }}
                                                checked={
                                                    hierarchicalDeleteMode
                                                        ? deleteMode.selectedItems.size === getImmediateChildrenForParent(
                                                            hierarchicalDeleteMode.parentType,
                                                            hierarchicalDeleteMode.parentId
                                                        ).length
                                                        : deleteMode.selectedItems.size === getItemsForDeletion(deleteMode.type!).length
                                                }
                                                className="w-4 h-4 cursor-pointer accent-orange-500 rounded"
                                            />
                                            <span className="text-xs font-medium text-orange-900 dark:text-orange-200">
                                                {hierarchicalDeleteMode
                                                    ? `Select All Children (${getImmediateChildrenForParent(
                                                        hierarchicalDeleteMode.parentType,
                                                        hierarchicalDeleteMode.parentId
                                                    ).length})`
                                                    : `Select All (${getItemsForDeletion(deleteMode.type!).length})`
                                                }
                                            </span>
                                        </div>

                                        {/* Selection Count */}
                                        <div className="flex-1 text-center">
                                            <span className="text-xs font-semibold text-orange-800 dark:text-orange-100">
                                                {deleteMode.selectedItems.size} {deleteMode.type}(s) selected
                                                {hierarchicalDeleteMode && " (from this parent)"}
                                            </span>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex gap-2 justify-center sm:justify-end w-full sm:w-auto">
                                            <Button
                                                variant="outline"
                                                onClick={cancelDeleteMode}
                                                className="text-[11px] px-3 py-1.5 h-7 rounded-md
      border-orange-300 dark:border-orange-700
      text-orange-800 dark:text-orange-200
      hover:bg-orange-100 dark:hover:bg-orange-800
      transition-all duration-200"
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                onClick={() => setShowDeleteConfirmation(true)}
                                                disabled={deleteMode.selectedItems.size === 0}
                                                className={`text-[11px] px-3 py-1.5 h-7 rounded-md font-semibold transition-all duration-200 ${deleteMode.selectedItems.size === 0
                                                    ? "opacity-50 cursor-not-allowed bg-orange-300"
                                                    : "bg-orange-600 hover:bg-orange-700 hover:scale-[1.03]"
                                                    } text-white shadow-sm`}
                                            >
                                                Delete ({deleteMode.selectedItems.size})
                                            </Button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                        </div>
                    ) : (
                        <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-6 shadow-sm">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div className="ml-3">
                                    <h3 className="text-sm font-medium text-yellow-800">No course selected</h3>
                                    <div className="mt-2 text-sm text-yellow-700">
                                        <p>Please select a course from the list to continue.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    {(showAddModuleFirst || showAddTopicFirst) && (
                        renderAddFirstMessages()
                    )}
                </div>
            </div>
    )
}
