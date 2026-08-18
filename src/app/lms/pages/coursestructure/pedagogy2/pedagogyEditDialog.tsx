"use client"

// JSX render functions extracted verbatim from page.tsx's return. Each is a
// plain function returning the same subtree, called inline as {renderX(deps)} —
// no component boundary, so React renders it exactly as before. The values each
// closed over arrive in one loosely-typed deps object.

"use client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import React from "react"
import { useState, useRef, useEffect, useMemo, Fragment, JSX, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
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
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { courseStructureApi, fetchCourseStructureById } from "@/apiServices/createCourseStucture"
import { moduleApi } from "@/apiServices/pedagogyAndModuleAdd/addmodule"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { subModuleApi } from "@/apiServices/pedagogyAndModuleAdd/addsubmodule"
import { topicApi } from "@/apiServices/pedagogyAndModuleAdd/addtopic"
import { subTopicApi } from "@/apiServices/pedagogyAndModuleAdd/addsubtopic"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { pedagogyViewApi } from "@/apiServices/pedagogyAndModuleAdd/pedagogy"
import { levelViewApi } from "@/apiServices/levelsView";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import PrintComponent, { PrintComponentRef } from "@/components/ui/PrintComponent";
import DropdownSection from "@/components/ui/dropdownSection";
import { toast, Toaster } from 'sonner';
import { createPortal } from "react-dom";
import PedagogyTestConfigurationSection from "./components/pedagogyTestConfigurationSection";
// Types, the zoom puck and the popup motion variants now live beside this file.
// They were moved verbatim during the split — same declarations, same shapes,
// only relocated so this file holds the screen's logic rather than everything.
import type {
    Modules, MergeRange, SubModuleCreateData, PreviewTableProps, ModuleFormData,
    Topic, TopicCreateData, SubTopic, SubTopicCreateData, ExportSelections,
    CourseHours, MergedCell, Course, MergedLevel, ActivityType, PedagogyType,
    HierarchyMerges,
} from "./types"
import DraggableZoomControls from "./DraggableZoomControls"
import { popupVariants, popAnimation } from "./constants"
import LevelMultiSelect from "./LevelMultiSelect"
import PreviewTable from "./PreviewTable"
import FullCoursePreviewTable from "./FullCoursePreviewTable"
import { exportToExcelImpl } from "./exportToExcel"
import { checkAndDeleteExistingMergedCellsImpl } from "./pedagogyDeletions"
import { handleModuleDropImpl, handleSubModuleDropImpl, handleTopicDropImpl, handleSubtopicDropImpl } from "./dragDropHandlers"
import { handleModuleSubmitImpl, handleSubModuleSubmitImpl, handleTopicSubmitImpl, handleSubTopicSubmitImpl } from "./submitHandlers"
import { createTableRowsImpl, createDuplicateTableRowsImpl, processPedagogyDataImpl, collectCompleteHierarchyIdsImpl, getAllSelectedHierarchyIdsImpl, fetchAndSetPedagogyDataImpl } from "./dataBuilders"
import { confirmUnmergeImpl, confirmCellDeleteImpl, handleDeleteLevelImpl, isCellMergedImpl, isLevelMergedImpl } from "./mergeHelpers"


import type { PedagogyDialogsDeps } from "./pedagogyDialogs"

// Split out of pedagogyDialogs.tsx (the single largest render function, the
// module/level edit dialog) so no one file is oversized. Same function,
// same deps type — a pure relocation.

export function renderMainEditDialog(deps: PedagogyDialogsDeps) {
    const { activityTypes, addOnlyPedagogyLevel, areAllModuleTopicsCompleted, areAllSubModulesCompleted, clearLevelMergeSelections, clearPedagogyMergeSelections, currentMergeActivity, dialogType, disableAddonlyMode, editLevelMergeSelections, editMode, editPedagogyMergeSelections, errorMessage, expandedModules, expandedSubModules, expandedTopics, getCourseSkillSet, getHeaderText, getLevelMergeSelectionCount, handleModuleFormChange, handleModuleSubmit, handleSkillSetChange, handleSubModuleFormChange, handleSubModuleSubmit, handleSubTopicFormChange, handleSubTopicSubmit, handleTopicFormChange, handleTopicSubmit, hasActualMergeSelection, hasPedagogyHoursGreaterThanZero, isCreatingModule, isCreatingSubModule, isCreatingSubTopic, isCreatingTopic, isLastHierarchy, isMergeSectionOpen, moduleFormData, moduleTestConfig, pedagogyHours, resetAllFormStates, saveLevelMergeSelections, savePedagogyMergeSelections, savedLevelMergeSelections, savedPedagogyMergeSelections, selected, selectedCourse, selectedLevel, selectedLevelModulesForMerge, selectedLevelSubModulesForMerge, selectedLevelSubTopicsForMerge, selectedLevelTopicsForMerge, selectedModuleForSubModule, selectedPedagogyActivities, selectedPedagogyModulesForMerge, selectedPedagogySubModulesForMerge, selectedPedagogySubTopicsForMerge, selectedPedagogyTopicsForMerge, selectedSubModuleForTopic, setAddOnlyPedagogyLevel, setCurrentMergeActivity, setExpandedModules, setExpandedSubModules, setExpandedTopics, setPedagogyHours, setSelectedLevel, setSelectedLevelModulesForMerge, setSelectedLevelSubModulesForMerge, setSelectedLevelSubTopicsForMerge, setSelectedLevelTopicsForMerge, setSelectedPedagogyActivities, setSelectedPedagogyModulesForMerge, setSelectedPedagogySubModulesForMerge, setSelectedPedagogySubTopicsForMerge, setSelectedPedagogyTopicsForMerge, setShowDialog, setShowFullPreviewDialog, setShowLevelSection, setShowMergeLevelSection, setShowMergePedagogySection, setShowPedagogySection, shouldShowPedagogyLevelToggle, showDialog, showLevelSection, showMergeLevelSection, showMergePedagogySection, showPedagogySection, sortedModules, sortedSubModules, sortedSubTopics, sortedTopics, subModuleFormData, subTopicFormData, toggleExpansion, topicFormData, topicSubTopics } = deps
    return (
                <Dialog
                    open={showDialog}
                    onOpenChange={(open) => {
                        if (!open) {
                            setShowDialog(false);
                            setAddOnlyPedagogyLevel(false);
                            resetAllFormStates();

                        }
                    }}
                >
                    <DialogContent className={` sm:max-w-[97vw] max-w-[95vw] h-[97vh] ${(!isLastHierarchy()) ? 'w-[40vw]' : ''}  p-0  overflow-hidden bg-white border border-slate-200/60 shadow-xl rounded-xl`} onInteractOutside={(e) => e.preventDefault()}>
                        <motion.div
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            variants={popupVariants}
                            className="relative"
                        >
                            {/* Compact Header */}
                            <div className="px-6 py-2 bg-gradient-to-br from-[#FB8C3C] via-[#F0701F] to-[#C2540F] relative overflow-hidden">
                                <DialogHeader className="relative">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                                            {editMode ? (
                                                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                                </svg>
                                            ) : (
                                                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                                </svg>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <DialogTitle className="text-lg font-semibold text-white leading-tight">
                                                {editMode ? (
                                                    <>Edit {editMode.type}</>
                                                ) : dialogType === 'module' ? (
                                                    'New Module'
                                                ) : dialogType === 'submodule' ? (
                                                    'New Submodule'
                                                ) : dialogType === 'topic' ? (
                                                    'New Topic'
                                                ) : (
                                                    'New Subtopic'
                                                )}
                                            </DialogTitle>

                                            {/* Compact Context */}
                                            {((!editMode && dialogType !== 'module') || (editMode && editMode.type !== 'module')) && (
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <span className="text-white/70 text-sm">in</span>
                                                    <div className="flex items-center flex-wrap gap-1 max-w-md">
                                                        {getHeaderText().split(' → ').map((part: any, index: any, array: any) => (
                                                            <Fragment key={index}>
                                                                <span className={`
            inline-block items-center px-2 py-1 rounded-md cursor-context-menu text-xs  ${dialogType === 'topic' ? "max-w-[200px]" : dialogType === 'subtopic' ? "max-w-[150px]" : "max-w-[25vw]"} font-medium truncate
            ${index === array.length - 1
                                                                        ? (dialogType === 'submodule'
                                                                            ? 'bg-[#FB923C]/25 text-[#FFF3EA]'
                                                                            : dialogType === 'topic'
                                                                                ? 'bg-amber-400/25 text-amber-50'
                                                                                : 'bg-[#FB923C]/25 text-[#FFF3EA]')
                                                                        : 'bg-gray-400/25 text-gray-50'
                                                                    }
                                                                 `}
                                                                    title={part}
                                                                >
                                                                    {part}
                                                                </span>
                                                                {index < array.length - 1 && (
                                                                    <ChevronRight className="w-3 h-3 text-white/50" />
                                                                )}
                                                            </Fragment>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </DialogHeader>
                            </div>
                            {!editMode && isLastHierarchy() && shouldShowPedagogyLevelToggle(dialogType, editMode) && (
                                <div className={`px-6 py-1 bg-slate-50 border-b border-slate-200 ${disableAddonlyMode ? "opacity-50" : ""}`}>
                                    <div className="flex justify-end items-center gap-6">
                                        {/* Preview Link */}
                                        <button
                                            type="button"
                                            onClick={() => setShowFullPreviewDialog(true)}
                                            className="flex items-center gap-1.5 text-xs underline font-medium text-[#F97316] hover:text-[#9A3F0A] transition-colors cursor-pointer group"
                                        >
                                            <Eye className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                                            Preview Table
                                        </button>

                                        {/* Toggle Section */}
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-medium text-slate-700">Add Pedagogy/Level Only</span>
                                            <button
                                                type="button"
                                                onClick={() => setAddOnlyPedagogyLevel(!addOnlyPedagogyLevel)}
                                                className={`relative inline-flex h-5 w-11 items-center rounded-full transition-colors ${disableAddonlyMode ? "cursor-not-allowed" : "cursor-pointer"} ${addOnlyPedagogyLevel ? 'bg-amber-500' : 'bg-slate-300'
                                                    }`}
                                                disabled={disableAddonlyMode}
                                            >
                                                <span className="sr-only">Add Pedagogy/Level Only</span>
                                                <span
                                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${addOnlyPedagogyLevel ? 'translate-x-6' : 'translate-x-1'
                                                        }`}
                                                />
                                            </button>
                                            <span className="text-sm font-medium text-slate-700">
                                                {addOnlyPedagogyLevel ? 'ON' : 'OFF'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {isLastHierarchy() && !shouldShowPedagogyLevelToggle(dialogType, editMode) && (
                                <div className={`px-6 py-1 bg-slate-50 border-b border-slate-200 ${disableAddonlyMode ? "opacity-50" : ""}`}>
                                    <div className="flex justify-end items-center gap-6">
                                        {/* Preview Link */}
                                        <button
                                            type="button"
                                            onClick={() => setShowFullPreviewDialog(true)}
                                            className="flex items-center gap-1.5 text-xs underline font-medium text-[#F97316] hover:text-[#9A3F0A] transition-colors cursor-pointer group"
                                        >
                                            <Eye className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                                            Preview Table
                                        </button>
                                    </div>
                                </div>
                            )}
                            {/* Compact Form */}
                            <div className="py-1 px-4  thin-scrollbar" style={{
                                maxHeight: '75vh',
                                overflowY: 'auto',
                            }}>

                                {/* Add this at the very top inside the div */}
                                <style>{`
    .thin-scrollbar::-webkit-scrollbar {
      width: 6px;
    }
    .thin-scrollbar::-webkit-scrollbar-track {
      background: transparent;
    }
    .thin-scrollbar::-webkit-scrollbar-thumb {
      background-color: #475569;
      border-radius: 999px;
    }
    .thin-scrollbar::-webkit-scrollbar-thumb:hover {
      background-color: #1e293b;
    }
  `}</style>

                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        if (dialogType === 'module') handleModuleSubmit(e);
                                        else if (dialogType === 'submodule') handleSubModuleSubmit(e);
                                        else if (dialogType === 'topic') handleTopicSubmit(e);
                                        else if (dialogType === 'subtopic') handleSubTopicSubmit(e);
                                    }}
                                    className={`grid gap-6 ${(!isLastHierarchy()) ? 'grid-cols-1' : (addOnlyPedagogyLevel ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-3')}`}
                                >
                                    {/* Column 1: Basic Information - Always visible */}
                                    {!addOnlyPedagogyLevel && (
                                        <div className="space-y-4 md:col-span-1">
                                            <h3 className="text-sm font-semibold text-slate-700 border-b pb-2 flex items-center">
                                                <svg className="w-4 h-4 mr-2 text-[#F97316]" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                                </svg>
                                                Basic Information
                                            </h3>

                                            {/* Title */}
                                            <div className="space-y-2">
                                                <Label htmlFor="title" className="text-xs font-medium text-slate-700 flex items-center gap-1">
                                                    Title <span className="text-rose-500">*</span>
                                                </Label>
                                                <textarea
                                                    id="title"
                                                    name="title"
                                                    value={
                                                        dialogType === 'module' ? moduleFormData.title :
                                                            dialogType === 'submodule' ? subModuleFormData.title :
                                                                dialogType === 'topic' ? topicFormData.title :
                                                                    subTopicFormData.title
                                                    }
                                                    onChange={(e) => {
                                                        if (dialogType === 'module') handleModuleFormChange(e);
                                                        else if (dialogType === 'submodule') handleSubModuleFormChange(e);
                                                        else if (dialogType === 'topic') handleTopicFormChange(e);
                                                        else if (dialogType === 'subtopic') handleSubTopicFormChange(e);
                                                    }}
                                                    className="w-full h-20 px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#F97316] bg-slate-50/50 resize-none transition-colors"
                                                    placeholder="Enter title..."
                                                    required
                                                />
                                            </div>

                                            {/* Description */}
                                            <div className="space-y-2">
                                                <Label htmlFor="description" className="text-xs font-medium text-slate-700">
                                                    Description
                                                </Label>
                                                <textarea
                                                    id="description"
                                                    name="description"
                                                    value={
                                                        dialogType === 'module' ? moduleFormData.description :
                                                            dialogType === 'submodule' ? subModuleFormData.description :
                                                                dialogType === 'topic' ? topicFormData.description :
                                                                    subTopicFormData.description
                                                    }
                                                    onChange={(e) => {
                                                        if (dialogType === 'module') handleModuleFormChange(e);
                                                        else if (dialogType === 'submodule') handleSubModuleFormChange(e);
                                                        else if (dialogType === 'topic') handleTopicFormChange(e);
                                                        else if (dialogType === 'subtopic') handleSubTopicFormChange(e);
                                                    }}
                                                    className="w-full h-20 px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#F97316] bg-slate-50/50 resize-none transition-colors"
                                                    placeholder="Brief description ..."
                                                />
                                            </div>
                                            {(() => {
                                                const skillSet = getCourseSkillSet();
                                                const hasAny = skillSet.coreProgram.length > 0 || skillSet.frontend.length > 0 || skillSet.database.length > 0;

                                                if (!hasAny) return null;

                                                // Use moduleTestConfig directly - it already contains the edited values
                                                const currentTestConfig = moduleTestConfig;

                                                // Create a unique key that changes when editMode changes
                                                const componentKey = editMode ? `${editMode.type}-${editMode.data._id}-${Date.now()}` : 'new';

                                                return (
                                                    <div className="space-y-2 mt-2" key={componentKey}>
                                                        <h3 className="text-xs font-semibold text-slate-700 border-b pb-1 flex items-center">
                                                            <svg className="w-3.5 h-3.5 mr-1.5 text-[#F97316]" fill="currentColor" viewBox="0 0 20 20">
                                                                <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.5-.8l1.5-.75a.5.5 0 00.5-.4V10.5a.5.5 0 00-.5-.5h-5a.5.5 0 00-.5.5v1.55c0 .2.12.39.3.5l1.5.75c.292.154.485.46.5.8h1z" />
                                                            </svg>
                                                            Skill Set Configuration
                                                        </h3>
                                                        <PedagogyTestConfigurationSection
                                                            testConfiguration={currentTestConfig}
                                                            onChange={handleSkillSetChange}
                                                            availableLanguages={skillSet}
                                                        />
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    )}

                                    {/* Column 2: Options (Level & Pedagogy) - COMPACT DESIGN */}
                                    {isLastHierarchy() && (
                                        <div className="space-y-2 md:col-span-1">
                                            <h3 className="text-sm font-semibold text-slate-700 border-b pb-2 flex items-center">
                                                <svg className="w-4 h-4 mr-2 text-[#F97316]" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                                                </svg>
                                                Options
                                            </h3>

                                            <div className="space-y-2">
                                                {/* Level Section - Compact */}
                                                <div className={`p-3 rounded-lg border transition-all ${showLevelSection ? 'bg-[#FFF3EA] border-[#FDBA74] shadow-sm' : 'bg-slate-50 border-slate-200'}`}>
                                                    <div className="flex items-center space-x-3">
                                                        <Checkbox
                                                            id="add-level"
                                                            checked={showLevelSection}
                                                            onCheckedChange={(checked) => {
                                                                if (checked) {
                                                                    setShowLevelSection(true);
                                                                } else {
                                                                    clearLevelMergeSelections();
                                                                    setShowLevelSection(false);
                                                                    setShowMergeLevelSection(false);
                                                                }
                                                            }}
                                                            className="data-[state=checked]:bg-[#F97316] data-[state=checked]:border-[#F97316]"
                                                        />
                                                        <Label htmlFor="add-level" className="text-sm font-medium text-slate-800 cursor-pointer">
                                                            Add Level
                                                        </Label>
                                                    </div>

                                                    {showLevelSection && (
                                                        <motion.div
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: 'auto' }}
                                                            transition={{ duration: 0.2 }}
                                                            className="mt-2 space-y-1 pt-1 border-t border-[#FFE4D0]"
                                                        >
                                                            <div className="space-y-2">
                                                                <Label htmlFor="level" className="text-xs font-medium text-slate-700 flex items-center">
                                                                    Level
                                                                </Label>
                                                                <LevelMultiSelect
                                                                    value={selectedLevel}
                                                                    onChange={setSelectedLevel}
                                                                />
                                                            </div>
                                                            {!disableAddonlyMode && (
                                                                <>
                                                                    {savedLevelMergeSelections && getLevelMergeSelectionCount() > 0 ? (
                                                                        <div className="flex items-center justify-between p-1 mt-1 bg-green-50 rounded-md border border-green-200">
                                                                            <div className="flex items-center space-x-2">
                                                                                <SquarePen className="w-3 h-3 text-green-600" />
                                                                                <span className="text-xs text-slate-700 font-medium">
                                                                                    {dialogType === 'module' && ` Edit selected modules for merge`}
                                                                                    {dialogType === 'submodule' && ` Edit selected submodules for merge`}
                                                                                    {dialogType === 'topic' && ` Edit selected topics for merge`}
                                                                                    {dialogType === 'subtopic' && ` Edit selected subtopics for merge`}
                                                                                </span>
                                                                            </div>
                                                                            <Button
                                                                                type="button"
                                                                                variant="outline"
                                                                                size="sm"
                                                                                onClick={editLevelMergeSelections}
                                                                                className="h-7 text-xs"
                                                                                disabled={!selectedLevel || isMergeSectionOpen}
                                                                            >
                                                                                Edit Selection
                                                                            </Button>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex items-center space-x-3 p-2 bg-slate-50 rounded-lg border border-slate-200">
                                                                            <Checkbox
                                                                                id="merge-level"
                                                                                checked={showMergeLevelSection}
                                                                                disabled={!selectedLevel || isMergeSectionOpen}
                                                                                onCheckedChange={(checked) => {
                                                                                    setShowMergeLevelSection(!!checked);
                                                                                    if (!checked) {
                                                                                        setSelectedLevelModulesForMerge(new Set());
                                                                                        setSelectedLevelSubModulesForMerge(new Set());
                                                                                        setSelectedLevelTopicsForMerge(new Set());
                                                                                        setSelectedLevelSubTopicsForMerge(new Set());
                                                                                    }
                                                                                }}
                                                                                className="data-[state=checked]:bg-[#F97316] data-[state=checked]:border-[#F97316]"
                                                                            />
                                                                            <Label htmlFor="merge-level" className="text-xs text-slate-700 cursor-pointer flex-1">
                                                                                Merge with existing {" "}
                                                                                <span className="text-[#F97316] font-semibold">
                                                                                    {dialogType === "module"
                                                                                        ? "Module"
                                                                                        : dialogType === "submodule"
                                                                                            ? "Submodule"
                                                                                            : dialogType === "topic"
                                                                                                ? "Topic"
                                                                                                : "Subtopic"}
                                                                                </span>
                                                                            </Label>
                                                                            <Merge className="w-4 h-4 text-[#F97316]" />
                                                                        </div>
                                                                    )}
                                                                </>
                                                            )}
                                                        </motion.div>
                                                    )}
                                                </div>

                                                {/* Pedagogy Section - Compact */}
                                                <div className={`border rounded-lg transition-all ${showPedagogySection ? 'bg-[#FFF3EA] border-[#FFD9BC]' : 'bg-slate-50 border-slate-200'}`}>
                                                    <div className="flex items-center justify-between p-3">
                                                        <div className="flex items-center space-x-2">
                                                            <Checkbox
                                                                id="add-pedagogy"
                                                                checked={showPedagogySection}
                                                                onCheckedChange={(checked) => {
                                                                    if (checked) {
                                                                        setShowPedagogySection(true);
                                                                    } else {
                                                                        clearPedagogyMergeSelections();
                                                                        setShowPedagogySection(false);
                                                                    }
                                                                }}
                                                                className="data-[state=checked]:bg-[#F97316] data-[state=checked]:border-[#F97316]"
                                                            />
                                                            <Label htmlFor="add-pedagogy" className="text-sm font-medium text-slate-800 cursor-pointer">
                                                                Pedagogy
                                                            </Label>
                                                        </div>
                                                        {showPedagogySection && (
                                                            <span className="text-xs text-[#F97316] bg-[#FFE4D0] px-2 py-0.5 rounded-full font-medium">
                                                                {Object.values(selectedPedagogyActivities).flat().length} selected
                                                            </span>
                                                        )}
                                                    </div>

                                                    {showPedagogySection && (
                                                        <div className="px-3 pb-3 border-t border-[#FFE4D0] pt-1 space-y-2">
                                                            {/* Compact Activities List */}
                                                            <div className="max-h-40 overflow-y-auto bg-white border border-slate-200 rounded">
                                                                {/* I Do Activities - Compact */}
                                                                {activityTypes["iDo"].length > 0 && (
                                                                    <div className="border-b border-slate-100 last:border-b-0">
                                                                        <div className="sticky top-0 bg-[#FFF3EA] px-2 py-1 text-xs font-medium text-[#C2540F] flex items-center justify-between">
                                                                            <span className="flex items-center gap-1">
                                                                                <User2 size={13} />
                                                                                I Do
                                                                            </span>
                                                                            <span className="text-xs bg-[#FFE4D0] px-1.5 py-0.5 rounded-full">
                                                                                {selectedPedagogyActivities.iDo.length}
                                                                            </span>
                                                                        </div>
                                                                        <div className="p-1 space-y-1">
                                                                            {activityTypes["iDo"].map((activity: any) => {
                                                                                const mergeSelection = savedPedagogyMergeSelections?.iDo?.[activity];
                                                                                const hasMerge = hasActualMergeSelection(mergeSelection);

                                                                                return (
                                                                                    <div key={`iDo-${activity}`} className="flex items-center justify-between px-1 py-0.5 hover:bg-[#FFF3EA]/50 rounded text-xs group">
                                                                                        <div className="flex items-center space-x-1.5 flex-1 min-w-0">
                                                                                            <Checkbox
                                                                                                id={`iDo-${activity}`}
                                                                                                checked={selectedPedagogyActivities.iDo.includes(activity)}
                                                                                                onCheckedChange={(checked) => {
                                                                                                    const newActivities = { ...selectedPedagogyActivities };
                                                                                                    if (checked) {
                                                                                                        newActivities.iDo = [...newActivities.iDo, activity];
                                                                                                    } else {
                                                                                                        newActivities.iDo = newActivities.iDo.filter((a: any) => a !== activity);
                                                                                                        const newHours = { ...pedagogyHours };
                                                                                                        delete newHours.iDo[activity];
                                                                                                        setPedagogyHours(newHours);
                                                                                                        // Clear merge selection when activity is deselected
                                                                                                        clearPedagogyMergeSelections("iDo", activity);
                                                                                                    }
                                                                                                    setSelectedPedagogyActivities(newActivities);
                                                                                                }}
                                                                                                className="h-3 w-3 data-[state=checked]:bg-[#F97316] data-[state=checked]:border-[#F97316]"
                                                                                            />
                                                                                            <span className="text-slate-700 truncate flex-1">{activity}</span>
                                                                                        </div>

                                                                                        <div className="flex items-center space-x-1">
                                                                                            {selectedPedagogyActivities.iDo.includes(activity) && (
                                                                                                <div className="flex gap-3">
                                                                                                    <div className="flex items-center space-x-0.5">
                                                                                                        <Input
                                                                                                            type="number"
                                                                                                            value={pedagogyHours.iDo[activity] || ""}
                                                                                                            onChange={(e) => {
                                                                                                                const value = parseFloat(e.target.value) || 0;
                                                                                                                setPedagogyHours((prev: any) => ({
                                                                                                                    ...prev,
                                                                                                                    iDo: { ...prev.iDo, [activity]: value }
                                                                                                                }));
                                                                                                            }}
                                                                                                            className="h-5 w-10 text-xs text-center p-0 border-slate-300"
                                                                                                            placeholder="0"
                                                                                                        />
                                                                                                        <span className="text-xs text-slate-500">hrs</span>
                                                                                                    </div>

                                                                                                    {/* Merge button for this specific activity */}
                                                                                                    {!disableAddonlyMode && (
                                                                                                        <button
                                                                                                            type="button"
                                                                                                            onClick={() => {
                                                                                                                setCurrentMergeActivity(activity);
                                                                                                                setShowMergePedagogySection((prev: any) => ({
                                                                                                                    ...prev,
                                                                                                                    iDo: true
                                                                                                                }));
                                                                                                                // Load existing merge selection if it exists
                                                                                                                if (savedPedagogyMergeSelections.iDo[activity]) {
                                                                                                                    editPedagogyMergeSelections("iDo", activity);
                                                                                                                }
                                                                                                            }}
                                                                                                            className={`p-0.5 rounded text-xs ${hasMerge
                                                                                                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                                                                                : 'bg-[#FFE4D0] text-[#C2540F] hover:bg-[#FFD9BC]'
                                                                                                                } ${(!pedagogyHours.iDo[activity] || pedagogyHours.iDo[activity] <= 0 || isMergeSectionOpen) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                                                                                            title={hasMerge ? "Edit merge selection" : "Merge with existing items"}
                                                                                                            disabled={!pedagogyHours.iDo[activity] || pedagogyHours.iDo[activity] <= 0 || isMergeSectionOpen}
                                                                                                        >
                                                                                                            {hasMerge ? (<span className="flex gap-1 items-center">
                                                                                                                <SquarePen className="w-3 h-3" /> Edit
                                                                                                            </span>
                                                                                                            ) : (<span className="flex gap-1 items-center">
                                                                                                                <Merge className="w-3 h-3" /> Merge
                                                                                                            </span>
                                                                                                            )}
                                                                                                        </button>
                                                                                                    )}
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* We Do Activities - Compact */}
                                                                {activityTypes["weDo"].length > 0 && (
                                                                    <div className="border-b border-slate-100 last:border-b-0">
                                                                        <div className="sticky top-0 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 flex items-center justify-between">
                                                                            <span className="flex items-center">
                                                                                <Users className="h-3 w-3 mr-1" />
                                                                                We Do
                                                                            </span>
                                                                            <span className="text-xs bg-amber-100 px-1.5 py-0.5 rounded-full">
                                                                                {selectedPedagogyActivities.weDo.length}
                                                                            </span>
                                                                        </div>
                                                                        <div className="p-1 space-y-1">
                                                                            {activityTypes["weDo"].map((activity: any) => {
                                                                                const mergeSelection = savedPedagogyMergeSelections?.weDo?.[activity];
                                                                                const hasMerge = hasActualMergeSelection(mergeSelection);
                                                                                return (
                                                                                    <div key={`weDo-${activity}`} className="flex items-center justify-between px-1 py-0.5 hover:bg-amber-50/50 rounded text-xs group">
                                                                                        <div className="flex items-center space-x-1.5 flex-1 min-w-0">
                                                                                            <Checkbox
                                                                                                id={`weDo-${activity}`}
                                                                                                checked={selectedPedagogyActivities.weDo.includes(activity)}
                                                                                                onCheckedChange={(checked) => {
                                                                                                    const newActivities = { ...selectedPedagogyActivities };
                                                                                                    if (checked) {
                                                                                                        newActivities.weDo = [...newActivities.weDo, activity];
                                                                                                    } else {
                                                                                                        newActivities.weDo = newActivities.weDo.filter((a: any) => a !== activity);
                                                                                                        const newHours = { ...pedagogyHours };
                                                                                                        delete newHours.weDo[activity];
                                                                                                        setPedagogyHours(newHours);
                                                                                                        // Clear merge selection when activity is deselected
                                                                                                        clearPedagogyMergeSelections("weDo", activity);
                                                                                                    }
                                                                                                    setSelectedPedagogyActivities(newActivities);
                                                                                                }}
                                                                                                className="h-3 w-3 data-[state=checked]:bg-[#F97316] data-[state=checked]:border-[#F97316]"
                                                                                            />
                                                                                            <span className="text-slate-700 truncate flex-1">{activity}</span>
                                                                                        </div>

                                                                                        <div className="flex items-center space-x-1">
                                                                                            {selectedPedagogyActivities.weDo.includes(activity) && (
                                                                                                <div className="flex gap-3">
                                                                                                    <div className="flex items-center space-x-0.5">
                                                                                                        <Input
                                                                                                            type="number"
                                                                                                            value={pedagogyHours.weDo[activity] || ""}
                                                                                                            onChange={(e) => {
                                                                                                                const value = parseFloat(e.target.value) || 0;
                                                                                                                setPedagogyHours((prev: any) => ({
                                                                                                                    ...prev,
                                                                                                                    weDo: { ...prev.weDo, [activity]: value }
                                                                                                                }));
                                                                                                            }}
                                                                                                            className="h-5 w-10 text-xs text-center p-0 border-slate-300"
                                                                                                            placeholder="0"
                                                                                                        />
                                                                                                        <span className="text-xs text-slate-500">hrs</span>
                                                                                                    </div>

                                                                                                    {/* Merge button for this specific activity */}
                                                                                                    {!disableAddonlyMode && (
                                                                                                        <button
                                                                                                            type="button"
                                                                                                            onClick={() => {
                                                                                                                setCurrentMergeActivity(activity);
                                                                                                                setShowMergePedagogySection((prev: any) => ({
                                                                                                                    ...prev,
                                                                                                                    weDo: true
                                                                                                                }));
                                                                                                                // Load existing merge selection if it exists
                                                                                                                if (savedPedagogyMergeSelections.weDo[activity]) {
                                                                                                                    editPedagogyMergeSelections("weDo", activity);
                                                                                                                }
                                                                                                            }}
                                                                                                            className={`p-0.5 rounded text-xs ${hasMerge
                                                                                                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                                                                                : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                                                                                                } ${(!pedagogyHours.weDo[activity] || pedagogyHours.weDo[activity] <= 0 || isMergeSectionOpen) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                                                                                            title={hasMerge ? "Edit merge selection" : "Merge with existing items"}
                                                                                                            disabled={!pedagogyHours.weDo[activity] || pedagogyHours.weDo[activity] <= 0 || isMergeSectionOpen}
                                                                                                        >
                                                                                                            {hasMerge ? (<span className="flex gap-1 items-center">
                                                                                                                <SquarePen className="w-3 h-3" /> Edit
                                                                                                            </span>
                                                                                                            ) : (<span className="flex gap-1 items-center">
                                                                                                                <Merge className="w-3 h-3" /> Merge
                                                                                                            </span>
                                                                                                            )}
                                                                                                        </button>
                                                                                                    )}
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* You Do Activities - Compact */}
                                                                {activityTypes["youDo"].length > 0 && (
                                                                    <div className="border-b border-slate-100 last:border-b-0">
                                                                        <div className="sticky top-0 bg-green-50 px-2 py-1 text-xs font-medium text-green-700 flex items-center justify-between">
                                                                            <span className="flex items-center">
                                                                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                                                    <path fillRule="evenodd" d="M6.672 1.911a1 1 0 10-1.932.518l.259.966a1 1 0 001.932-.518l-.26-.966zM2.429 4.74a1 1 0 10-.517 1.932l.966.259a1 1 0 00.517-1.932l-.966-.26zm8.814-.569a1 1 0 00-1.415-1.414l-.707.707a1 1 0 101.415 1.415l.707-.708zm-7.071 7.072l.707-.707A1 1 0 003.465 9.12l-.708.707a1 1 0 001.415 1.415zm3.2-5.171a1 1 0 00-1.3 1.3l4 10a1 1 0 001.823.075l1.38-2.759 3.018 3.02a1 1 0 001.414-1.415l-3.019-3.02 2.76-1.379a1 1 0 00-.076-1.822l-10-4z" clipRule="evenodd" />
                                                                                </svg>
                                                                                You Do
                                                                            </span>
                                                                            <span className="text-xs bg-green-100 px-1.5 py-0.5 rounded-full">
                                                                                {selectedPedagogyActivities.youDo.length}
                                                                            </span>
                                                                        </div>
                                                                        <div className="p-1 space-y-1">
                                                                            {activityTypes["youDo"].map((activity: any) => {
                                                                                const mergeSelection = savedPedagogyMergeSelections?.youDo?.[activity];
                                                                                const hasMerge = hasActualMergeSelection(mergeSelection);

                                                                                return (
                                                                                    <div key={`youDo-${activity}`} className="flex items-center justify-between px-1 py-0.5 hover:bg-green-50/50 rounded text-xs group">
                                                                                        <div className="flex items-center space-x-1.5 flex-1 min-w-0">
                                                                                            <Checkbox
                                                                                                id={`youDo-${activity}`}
                                                                                                checked={selectedPedagogyActivities.youDo.includes(activity)}
                                                                                                onCheckedChange={(checked) => {
                                                                                                    const newActivities = { ...selectedPedagogyActivities };
                                                                                                    if (checked) {
                                                                                                        newActivities.youDo = [...newActivities.youDo, activity];
                                                                                                    } else {
                                                                                                        newActivities.youDo = newActivities.youDo.filter((a: any) => a !== activity);
                                                                                                        const newHours = { ...pedagogyHours };
                                                                                                        delete newHours.youDo[activity];
                                                                                                        setPedagogyHours(newHours);
                                                                                                        // Clear merge selection when activity is deselected
                                                                                                        clearPedagogyMergeSelections("youDo", activity);
                                                                                                    }
                                                                                                    setSelectedPedagogyActivities(newActivities);
                                                                                                }}
                                                                                                className="h-3 w-3 data-[state=checked]:bg-[#F97316] data-[state=checked]:border-[#F97316]"
                                                                                            />
                                                                                            <span className="text-slate-700 truncate flex-1">{activity}</span>
                                                                                        </div>

                                                                                        <div className="flex items-center space-x-1">
                                                                                            {selectedPedagogyActivities.youDo.includes(activity) && (
                                                                                                <div className="flex gap-3">
                                                                                                    <div className="flex items-center space-x-0.5">
                                                                                                        <Input
                                                                                                            type="number"
                                                                                                            value={pedagogyHours.youDo[activity] || ""}
                                                                                                            onChange={(e) => {
                                                                                                                const value = parseFloat(e.target.value) || 0;
                                                                                                                setPedagogyHours((prev: any) => ({
                                                                                                                    ...prev,
                                                                                                                    youDo: { ...prev.youDo, [activity]: value }
                                                                                                                }));
                                                                                                            }}
                                                                                                            className="h-5 w-10 text-xs text-center p-0 border-slate-300"
                                                                                                            placeholder="0"
                                                                                                        />
                                                                                                        <span className="text-xs text-slate-500">hrs</span>
                                                                                                    </div>

                                                                                                    {/* Merge button for this specific activity */}
                                                                                                    {!disableAddonlyMode && (
                                                                                                        <button
                                                                                                            type="button"
                                                                                                            onClick={() => {
                                                                                                                setCurrentMergeActivity(activity);
                                                                                                                setShowMergePedagogySection((prev: any) => ({
                                                                                                                    ...prev,
                                                                                                                    youDo: true
                                                                                                                }));
                                                                                                                // Load existing merge selection if it exists
                                                                                                                if (savedPedagogyMergeSelections.youDo[activity]) {
                                                                                                                    editPedagogyMergeSelections("youDo", activity);
                                                                                                                }
                                                                                                            }}
                                                                                                            className={`p-0.5 rounded text-xs ${hasMerge
                                                                                                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                                                                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                                                                                                                } ${(!pedagogyHours.youDo[activity] || pedagogyHours.youDo[activity] <= 0 || isMergeSectionOpen) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                                                                                            title={hasMerge ? "Edit merge selection" : "Merge with existing items"}
                                                                                                            disabled={!pedagogyHours.youDo[activity] || pedagogyHours.youDo[activity] <= 0 || isMergeSectionOpen}
                                                                                                        >
                                                                                                            {hasMerge ? (<span className="flex gap-1 items-center">
                                                                                                                <SquarePen className="w-3 h-3" /> Edit
                                                                                                            </span>
                                                                                                            ) : (<span className="flex gap-1 items-center">
                                                                                                                <Merge className="w-3 h-3" /> Merge
                                                                                                            </span>
                                                                                                            )}
                                                                                                        </button>
                                                                                                    )}
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Column 3: Merge Selection (shown when merge is checked) */}
                                    {(showMergeLevelSection || showMergePedagogySection.iDo || showMergePedagogySection.weDo || showMergePedagogySection.youDo) && (
                                        <div className="space-y-2 md:col-span-1">
                                            <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">
                                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                                    <div className="flex items-center flex-wrap gap-1">
                                                        <svg
                                                            className="w-4 h-4 text-[#F97316] shrink-0"
                                                            fill="currentColor"
                                                            viewBox="0 0 20 20"
                                                        >
                                                            <path
                                                                fillRule="evenodd"
                                                                d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z"
                                                                clipRule="evenodd"
                                                            />
                                                        </svg>
                                                        <span className="whitespace-nowrap">Merge With</span>
                                                        <span className="text-[#F97316] font-semibold whitespace-nowrap">
                                                            {dialogType === "module"
                                                                ? "Module"
                                                                : dialogType === "submodule"
                                                                    ? "Submodule"
                                                                    : dialogType === "topic"
                                                                        ? "Topic"
                                                                        : "Subtopic"}
                                                        </span>
                                                        <span className="whitespace-nowrap">for</span>
                                                        <span className="text-[#F97316] font-semibold whitespace-nowrap">
                                                            {showMergeLevelSection ? "Level" : currentMergeActivity}
                                                        </span>
                                                    </div>

                                                    {/* Right side: buttons */}
                                                    <div className="flex space-x-2 shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const allModuleIds = sortedModules.map((m: any) => m._id);
                                                                const allSubModuleIds = sortedSubModules.map((sm: any) => sm._id);
                                                                const allTopicIds = sortedTopics.map((t: any) => t._id);

                                                                setExpandedModules(new Set(allModuleIds));
                                                                setExpandedSubModules(new Set(allSubModuleIds));
                                                                setExpandedTopics(new Set(allTopicIds));
                                                            }}
                                                            className="text-xs cursor-pointer text-[#F97316] hover:text-[#9A3F0A] font-medium whitespace-nowrap"
                                                        >
                                                            Expand All
                                                        </button>
                                                        <span className="text-xs text-slate-400">|</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setExpandedModules(new Set());
                                                                setExpandedSubModules(new Set());
                                                                setExpandedTopics(new Set());
                                                            }}
                                                            className="text-xs cursor-pointer text-[#F97316] hover:text-[#9A3F0A] font-medium whitespace-nowrap"
                                                        >
                                                            Collapse All
                                                        </button>
                                                    </div>
                                                </div>
                                            </h3>

                                            <div className="max-h-74 overflow-y-auto space-y-4 p-1 border border-slate-100 rounded-lg bg-slate-50/30">
                                                {/* Module-level merging */}
                                                {dialogType === 'module' && (
                                                    <div className="space-y-2">
                                                        <p className="text-xs font-medium text-slate-700 px-2 py-1 bg-slate-100 rounded-md">Modules</p>

                                                        {sortedModules.map((module: any, index: any, arr: any) => {
                                                            const currentModuleId = (editMode as any)?.data?._id;
                                                            const isCurrentModule = module._id === currentModuleId;
                                                            const currentModuleIndex = sortedModules.findIndex((m: any) => m._id === currentModuleId);

                                                            // ✅ Enable modules one by one in sequence around the current module

                                                            const isEnabled = (() => {
                                                                if (isCurrentModule) return false; // Disable the current module itself

                                                                // If adding a new module (not in edit mode)
                                                                if (dialogType === 'module' && !editMode) {
                                                                    // Enable from LAST → FIRST
                                                                    if (index === arr.length - 1) {
                                                                        // Last module is always enabled when adding new
                                                                        return true;
                                                                    } else {
                                                                        // Enable if the NEXT module is selected
                                                                        const nextModule = arr[index + 1];
                                                                        return showMergeLevelSection
                                                                            ? selectedLevelModulesForMerge.has(nextModule?._id)
                                                                            : (selectedPedagogyModulesForMerge.iDo?.[currentMergeActivity]?.has(nextModule?._id) ||
                                                                                selectedPedagogyModulesForMerge.weDo?.[currentMergeActivity]?.has(nextModule?._id) ||
                                                                                selectedPedagogyModulesForMerge.youDo?.[currentMergeActivity]?.has(nextModule?._id));
                                                                    }
                                                                }

                                                                // 🔹 Existing logic for edit mode remains the same
                                                                const currentModuleIndex = sortedModules.findIndex((m: any) => m._id === currentModuleId);
                                                                const moduleIndex = sortedModules.findIndex((m: any) => m._id === module._id);
                                                                const distanceFromCurrent = moduleIndex - currentModuleIndex;

                                                                // For modules BEFORE the current module (negative distance)
                                                                if (distanceFromCurrent > 0) {
                                                                    if (distanceFromCurrent === 1) return true; // Immediate previous

                                                                    const nextModuleIndex = moduleIndex - 1;
                                                                    const nextModule = sortedModules[nextModuleIndex];
                                                                    return showMergeLevelSection
                                                                        ? selectedLevelModulesForMerge.has(nextModule?._id)
                                                                        : (selectedPedagogyModulesForMerge.iDo?.[currentMergeActivity]?.has(nextModule?._id) ||
                                                                            selectedPedagogyModulesForMerge.weDo?.[currentMergeActivity]?.has(nextModule?._id) ||
                                                                            selectedPedagogyModulesForMerge.youDo?.[currentMergeActivity]?.has(nextModule?._id));
                                                                }

                                                                // For modules AFTER the current- module (positive distance)
                                                                if (distanceFromCurrent < 0) {
                                                                    if (distanceFromCurrent === -1) return true; // Immediate next

                                                                    const prevModuleIndex = moduleIndex + 1;
                                                                    const prevModule = sortedModules[prevModuleIndex];
                                                                    return showMergeLevelSection
                                                                        ? selectedLevelModulesForMerge.has(prevModule?._id)
                                                                        : (selectedPedagogyModulesForMerge.iDo?.[currentMergeActivity]?.has(prevModule?._id) ||
                                                                            selectedPedagogyModulesForMerge.weDo?.[currentMergeActivity]?.has(prevModule?._id) ||
                                                                            selectedPedagogyModulesForMerge.youDo?.[currentMergeActivity]?.has(prevModule?._id));
                                                                }

                                                                return false;
                                                            })();

                                                            return (
                                                                <div key={module._id} className={`flex items-center space-x-2 ml-0 px-2 py-1.5 rounded-md transition-colors ${isCurrentModule ? 'bg-[#FFF3EA] border border-[#FFD9BC]' : 'hover:bg-slate-100/50'
                                                                    }`}>
                                                                    {isCurrentModule ? (
                                                                        <div className="w-4 h-4 flex items-center justify-center mr-1">
                                                                            <span className="text-[#F97316] text-lg">•</span>
                                                                        </div>
                                                                    ) : (
                                                                        <Checkbox
                                                                            id={`module-${module._id}`}
                                                                            checked={
                                                                                showMergeLevelSection
                                                                                    ? selectedLevelModulesForMerge.has(module._id)
                                                                                    : (showMergePedagogySection.iDo &&
                                                                                        selectedPedagogyModulesForMerge.iDo?.[currentMergeActivity]?.has(module._id)) ||
                                                                                    (showMergePedagogySection.weDo &&
                                                                                        selectedPedagogyModulesForMerge.weDo?.[currentMergeActivity]?.has(module._id)) ||
                                                                                    (showMergePedagogySection.youDo &&
                                                                                        selectedPedagogyModulesForMerge.youDo?.[currentMergeActivity]?.has(module._id))
                                                                            }
                                                                            disabled={!isEnabled}
                                                                            onCheckedChange={(checked) => {
                                                                                if (showMergeLevelSection) {
                                                                                    const newSet = new Set(selectedLevelModulesForMerge);
                                                                                    if (checked) {
                                                                                        newSet.add(module._id);
                                                                                    } else {
                                                                                        newSet.delete(module._id);
                                                                                    }
                                                                                    setSelectedLevelModulesForMerge(newSet);
                                                                                } else {
                                                                                    const activityType =
                                                                                        showMergePedagogySection.iDo ? "iDo" :
                                                                                            showMergePedagogySection.weDo ? "weDo" : "youDo";

                                                                                    if (!selectedPedagogyModulesForMerge[activityType]) {
                                                                                        selectedPedagogyModulesForMerge[activityType] = {};
                                                                                    }
                                                                                    if (!selectedPedagogyModulesForMerge[activityType][currentMergeActivity]) {
                                                                                        selectedPedagogyModulesForMerge[activityType][currentMergeActivity] = new Set();
                                                                                    }

                                                                                    const newSet = new Set(selectedPedagogyModulesForMerge[activityType][currentMergeActivity]);
                                                                                    if (checked) newSet.add(module._id);
                                                                                    else newSet.delete(module._id);

                                                                                    setSelectedPedagogyModulesForMerge({
                                                                                        ...selectedPedagogyModulesForMerge,
                                                                                        [activityType]: {
                                                                                            ...selectedPedagogyModulesForMerge[activityType],
                                                                                            [currentMergeActivity]: newSet
                                                                                        }
                                                                                    });
                                                                                }
                                                                            }}
                                                                        />
                                                                    )}
                                                                    <Label
                                                                        htmlFor={isCurrentModule ? undefined : `module-${module._id}`}
                                                                        className={`text-sm cursor-pointer flex-1 truncate ${isCurrentModule ? 'text-[#C2540F] font-medium' : 'text-slate-700'
                                                                            }`}
                                                                    >
                                                                        {module.title}
                                                                        {isCurrentModule && <span className="ml-2 text-xs text-[#F97316]">(Current)</span>}
                                                                    </Label>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}


                                                {/* Submodule-level merging with collapse/expand */}
                                                {dialogType === 'submodule' && (
                                                    <div className="space-y-3">

                                                        {sortedModules.map((module: any, moduleIndex: any) => {

                                                            const moduleSubModules = sortedSubModules.filter(
                                                                (sm: any) => sm.moduleId === module._id
                                                            );
                                                            const currentSubModuleId = (editMode as any)?.data?._id;
                                                            const currentSubModule = sortedSubModules.find((sm: any) => sm._id === currentSubModuleId);
                                                            const isCurrentModule = currentSubModule?.moduleId === module._id;

                                                            // const hasSubModules = moduleSubModules.length > 0;
                                                            const hasSubModules = sortedSubModules.filter(
                                                                (sm: any) => sm.moduleId === module._id
                                                            ).length > 0;
                                                            const selectedIndex = sortedModules.findIndex(
                                                                (m: any) => m?._id === selectedModuleForSubModule?.id

                                                            );

                                                            const selectedModuleHasSubModules = sortedSubModules.filter(
                                                                (sm: any) => sm.moduleId === selectedModuleForSubModule?.id
                                                                    && sm._id !== (editMode as any)?.data?._id
                                                            ).length > 0;

                                                            // 🔑 Utility function to check if a submodule is selected
                                                            const isSubModuleSelected = (subModuleId: string) => {
                                                                if (showMergeLevelSection) {
                                                                    return selectedLevelSubModulesForMerge.has(subModuleId);
                                                                } else {
                                                                    const activityType = showMergePedagogySection.iDo
                                                                        ? "iDo"
                                                                        : showMergePedagogySection.weDo
                                                                            ? "weDo"
                                                                            : "youDo";
                                                                    return (
                                                                        selectedPedagogySubModulesForMerge[activityType]?.[
                                                                            currentMergeActivity
                                                                        ]?.has(subModuleId) ?? false
                                                                    );
                                                                }
                                                            };

                                                            let isModuleEnabled = false;

                                                            if (moduleIndex === selectedIndex) {
                                                                isModuleEnabled = true;
                                                            } else if (!selectedModuleHasSubModules && selectedIndex !== -1) {
                                                                if (moduleIndex === selectedIndex - 1 || moduleIndex === selectedIndex + 1) {
                                                                    isModuleEnabled = hasSubModules;
                                                                } else {
                                                                    const leftAdjacent = sortedModules[selectedIndex - 1];
                                                                    const rightAdjacent = sortedModules[selectedIndex + 1];

                                                                    if (leftAdjacent && moduleIndex < selectedIndex - 1) {


                                                                        const nextModuleSubModules = sortedSubModules.filter(
                                                                            (sm: any) => sm.moduleId === sortedModules[moduleIndex + 1]?._id
                                                                                && sm._id !== (editMode as any)?.data?._id
                                                                        );
                                                                        isModuleEnabled =
                                                                            nextModuleSubModules.length > 0 &&
                                                                            nextModuleSubModules.every((sm: any) => isSubModuleSelected(sm._id));
                                                                    } else if (rightAdjacent && moduleIndex > selectedIndex + 1) {

                                                                        const prevModuleSubModules = sortedSubModules.filter(
                                                                            (sm: any) => sm.moduleId === sortedModules[moduleIndex - 1]?._id
                                                                                && sm._id !== (editMode as any)?.data?._id
                                                                        );
                                                                        isModuleEnabled =
                                                                            prevModuleSubModules.length > 0 &&
                                                                            prevModuleSubModules.every((sm: any) => isSubModuleSelected(sm._id));
                                                                    } else {
                                                                        isModuleEnabled = false;
                                                                    }
                                                                }
                                                            } else if (moduleIndex > selectedIndex) {
                                                                const prevModuleSubModules = sortedSubModules.filter(
                                                                    (sm: any) => sm.moduleId === sortedModules[moduleIndex - 1]?._id
                                                                        && sm._id !== (editMode as any)?.data?._id
                                                                );
                                                                isModuleEnabled =
                                                                    prevModuleSubModules.length > 0 &&
                                                                    prevModuleSubModules.every((sm: any) => isSubModuleSelected(sm._id));
                                                            } else if (moduleIndex < selectedIndex) {
                                                                const nextModuleSubModules = sortedSubModules.filter(
                                                                    (sm: any) => sm.moduleId === sortedModules[moduleIndex + 1]?._id
                                                                        && sm._id !== (editMode as any)?.data?._id
                                                                );
                                                                isModuleEnabled =
                                                                    nextModuleSubModules.length > 0 &&
                                                                    nextModuleSubModules.every((sm: any) => isSubModuleSelected(sm._id));
                                                            }

                                                            if (!hasSubModules && moduleIndex !== selectedIndex && selectedModuleHasSubModules) {
                                                                isModuleEnabled = false;
                                                            }

                                                            const isExpanded = expandedModules.has(module._id);

                                                            return (
                                                                <div key={module._id} className="space-y-1">
                                                                    <div
                                                                        className={`text-xs font-medium text-slate-700 px-2 py-1 rounded-md flex items-center transition-colors
              ${moduleIndex === selectedIndex ? "bg-[#FFD9BC] font-semibold" : "bg-[#FFF3EA]"}
              ${isModuleEnabled ? "cursor-pointer hover:bg-[#FFE4D0]" : "opacity-50 cursor-not-allowed"}`}
                                                                        onClick={() =>
                                                                            isModuleEnabled &&
                                                                            toggleExpansion(module._id, expandedModules, setExpandedModules)
                                                                        }
                                                                    >
                                                                        {isExpanded ? (
                                                                            <ChevronDownIcon className="w-3 h-3 mr-1 text-[#F97316]" />
                                                                        ) : (
                                                                            <ChevronRightIcon className="w-3 h-3 mr-1 text-[#F97316]" />
                                                                        )}
                                                                        <FolderOpen className="w-3 h-3 mr-1.5 text-[#F97316]" />
                                                                        <span className={isCurrentModule ? 'text-[#9A3F0A] font-semibold' : 'text-slate-700'}>
                                                                            {module.title}
                                                                        </span>
                                                                        {isCurrentModule && <span className="ml-2 text-xs text-[#F97316]">(Current Module)</span>}
                                                                        <span className="ml-auto text-xs text-slate-500">
                                                                            ({moduleSubModules.length})
                                                                        </span>
                                                                    </div>

                                                                    {isExpanded && hasSubModules && (
                                                                        <div className="space-y-1 ml-3 pl-2 border-l border-[#FFD9BC]">
                                                                            {moduleSubModules.map((subModule: any, subModuleIndex: any, arr: any) => {
                                                                                const isCurrentSubModule = subModule._id === currentSubModuleId;

                                                                                let isSubmoduleEnabled = false;

                                                                                if (moduleIndex < selectedIndex) {
                                                                                    // For modules BEFORE selected module: enable from LAST to FIRST
                                                                                    if (subModuleIndex === arr.length - 1) {
                                                                                        // Last submodule: enabled if module is enabled
                                                                                        isSubmoduleEnabled = isModuleEnabled;
                                                                                    } else {
                                                                                        // Other submodules: enabled if NEXT submodule is selected
                                                                                        const nextSubModule = arr[subModuleIndex + 1];
                                                                                        isSubmoduleEnabled = nextSubModule && isSubModuleSelected(nextSubModule._id);
                                                                                    }
                                                                                }
                                                                                else if (moduleIndex > selectedIndex) {
                                                                                    // For modules AFTER selected module: enable from FIRST to LAST
                                                                                    if (subModuleIndex === 0) {
                                                                                        // First submodule: enabled if module is enabled
                                                                                        isSubmoduleEnabled = isModuleEnabled;
                                                                                    } else {
                                                                                        // Other submodules: enabled if PREVIOUS submodule is selected
                                                                                        const prevSubModule = arr[subModuleIndex - 1];
                                                                                        isSubmoduleEnabled = prevSubModule && isSubModuleSelected(prevSubModule._id);
                                                                                    }
                                                                                }
                                                                                else if (moduleIndex === selectedIndex) {
                                                                                    // ✅ NEW LOGIC: If adding a new submodule in the current module
                                                                                    if (dialogType === 'submodule' && !editMode) {
                                                                                        // Enable from LAST → FIRST
                                                                                        if (subModuleIndex === arr.length - 1) {
                                                                                            // Last submodule enabled if module itself is enabled
                                                                                            isSubmoduleEnabled = isModuleEnabled;
                                                                                        } else {
                                                                                            // Others enabled if NEXT one is selected
                                                                                            const nextSubModule = arr[subModuleIndex + 1];
                                                                                            isSubmoduleEnabled = nextSubModule && isSubModuleSelected(nextSubModule._id);
                                                                                        }
                                                                                    }
                                                                                    // 🔹 Keep your OLD existing logic for edit mode
                                                                                    else {
                                                                                        const currentSubModuleIndex = arr.findIndex((sm: any) => sm._id === currentSubModuleId);

                                                                                        if (subModuleIndex < currentSubModuleIndex) {
                                                                                            if (subModuleIndex === currentSubModuleIndex - 1) {
                                                                                                isSubmoduleEnabled = isModuleEnabled;
                                                                                            } else {
                                                                                                const nextSubModule = arr[subModuleIndex + 1];
                                                                                                isSubmoduleEnabled = nextSubModule && isSubModuleSelected(nextSubModule._id);
                                                                                            }
                                                                                        } else {
                                                                                            if (subModuleIndex === currentSubModuleIndex + 1) {
                                                                                                isSubmoduleEnabled = isModuleEnabled;
                                                                                            } else {
                                                                                                const prevSubModule = arr[subModuleIndex - 1];
                                                                                                isSubmoduleEnabled = prevSubModule && isSubModuleSelected(prevSubModule._id);
                                                                                            }
                                                                                        }
                                                                                    }
                                                                                }


                                                                                return (
                                                                                    <div
                                                                                        key={subModule._id}
                                                                                        className={`flex items-center space-x-2 py-1.5 rounded-md transition-colors px-2
                                            ${isCurrentSubModule ? 'bg-[#FFF3EA] border border-[#FFD9BC]' : ''}
                                            ${isSubmoduleEnabled && !isCurrentSubModule ? "hover:bg-slate-100/50" : "opacity-50 cursor-not-allowed"}`}
                                                                                    >

                                                                                        {isCurrentSubModule ? (
                                                                                            <div className="w-4 h-4 flex items-center justify-center mr-1">
                                                                                                <span className="text-[#F97316] text-lg">•</span>
                                                                                            </div>
                                                                                        ) : (
                                                                                            <Checkbox
                                                                                                id={`submodule-${subModule._id}`}
                                                                                                disabled={!isSubmoduleEnabled}
                                                                                                checked={
                                                                                                    showMergeLevelSection
                                                                                                        ? selectedLevelSubModulesForMerge.has(subModule._id)
                                                                                                        : (showMergePedagogySection.iDo &&
                                                                                                            selectedPedagogySubModulesForMerge.iDo?.[currentMergeActivity]?.has(subModule._id)) ||
                                                                                                        (showMergePedagogySection.weDo &&
                                                                                                            selectedPedagogySubModulesForMerge.weDo?.[currentMergeActivity]?.has(subModule._id)) ||
                                                                                                        (showMergePedagogySection.youDo &&
                                                                                                            selectedPedagogySubModulesForMerge.youDo?.[currentMergeActivity]?.has(subModule._id))
                                                                                                }
                                                                                                onCheckedChange={(checked) => {
                                                                                                    if (showMergeLevelSection) {
                                                                                                        const newSet = new Set(selectedLevelSubModulesForMerge);
                                                                                                        if (checked) {
                                                                                                            newSet.add(subModule._id);
                                                                                                        } else {
                                                                                                            newSet.delete(subModule._id);
                                                                                                        }
                                                                                                        setSelectedLevelSubModulesForMerge(newSet);
                                                                                                    } else {
                                                                                                        const activityType =
                                                                                                            showMergePedagogySection.iDo ? "iDo" :
                                                                                                                showMergePedagogySection.weDo ? "weDo" : "youDo";

                                                                                                        if (!selectedPedagogySubModulesForMerge[activityType]) {
                                                                                                            selectedPedagogySubModulesForMerge[activityType] = {};
                                                                                                        }
                                                                                                        if (!selectedPedagogySubModulesForMerge[activityType][currentMergeActivity]) {
                                                                                                            selectedPedagogySubModulesForMerge[activityType][currentMergeActivity] = new Set();
                                                                                                        }

                                                                                                        const newSet = new Set(selectedPedagogySubModulesForMerge[activityType][currentMergeActivity]);
                                                                                                        if (checked) newSet.add(subModule._id);
                                                                                                        else newSet.delete(subModule._id);

                                                                                                        setSelectedPedagogySubModulesForMerge({
                                                                                                            ...selectedPedagogySubModulesForMerge,
                                                                                                            [activityType]: {
                                                                                                                ...selectedPedagogySubModulesForMerge[activityType],
                                                                                                                [currentMergeActivity]: newSet
                                                                                                            }
                                                                                                        });
                                                                                                    }
                                                                                                }}
                                                                                            />
                                                                                        )}
                                                                                        {/* // <Label htmlFor={`submodule-${subModule._id}`} className="text-sm text-slate-700 cursor-pointer flex-1 truncate">
                                                                                        //     {subModule.title}
                                                                                        // </Label> */}
                                                                                        <Label
                                                                                            htmlFor={isCurrentSubModule ? undefined : `submodule-${subModule._id}`}
                                                                                            className={`text-sm cursor-pointer flex-1 truncate ${isCurrentSubModule ? 'text-[#C2540F] font-medium' : 'text-slate-700'}`}
                                                                                        >
                                                                                            {subModule.title}
                                                                                            {isCurrentSubModule && <span className="ml-2 text-xs text-[#F97316]">(Current Submodule)</span>}
                                                                                        </Label>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}



                                                {/* Topic-level merging with nested collapse/expand */}
                                                {dialogType === 'topic' && (
                                                    <div className="space-y-3">
                                                        {sortedModules.map((module: any, moduleIndex: any) => {

                                                            const currentTopicId = (editMode as any)?.data?._id;
                                                            const currentTopic = sortedTopics.find((t: any) => t._id === currentTopicId);
                                                            const currentModule = currentTopic ? sortedModules.find((m: any) => m._id === currentTopic.moduleId) : null;
                                                            const currentSubModule = currentTopic?.subModuleId ?
                                                                sortedSubModules.find((sm: any) => sm._id === currentTopic.subModuleId) : null;

                                                            const isCurrentModule = currentModule?._id === module._id;


                                                            const hierarchyLevels = selectedCourse?.courseHierarchy.map((level: any) => level.toLowerCase()) || [];
                                                            const hasSubModules = hierarchyLevels.includes('sub module');



                                                            const moduleTopics = sortedTopics.filter((t: any) => {
                                                                const isCurrentTopic = t._id === (editMode as any)?.data?._id;
                                                                return t.moduleId === module._id &&
                                                                    (!hasSubModules || !t.subModuleId) &&
                                                                    !isCurrentTopic; // Explicitly exclude current topic
                                                            });

                                                            const moduleSubModules = hasSubModules ?
                                                                sortedSubModules.filter((sm: any) => sm.moduleId === module._id) : [];

                                                            let hasAnyTopics = moduleTopics.length > 0;
                                                            let totalTopicsCount = moduleTopics.length;

                                                            if (hasSubModules) {
                                                                for (const subModule of moduleSubModules) {

                                                                    const subModuleTopics = sortedTopics.filter((t: any) => {
                                                                        const isCurrentTopic = t._id === (editMode as any)?.data?._id;
                                                                        return t.subModuleId === subModule._id && !isCurrentTopic;
                                                                    });
                                                                    totalTopicsCount += subModuleTopics.length;
                                                                    if (subModuleTopics.length > 0) {
                                                                        hasAnyTopics = true;
                                                                    }
                                                                }
                                                            }


                                                            // Determine if module should be enabled
                                                            const selectedModuleIndex = sortedModules.findIndex(
                                                                (m: any) => m._id === selectedSubModuleForTopic?.moduleId
                                                            );

                                                            let isModuleEnabled = false;
                                                            const direction = moduleIndex > selectedModuleIndex ? 'after' : moduleIndex < selectedModuleIndex ? 'before' : 'current';

                                                            // Use the appropriate selected topics set based on merge type
                                                            const selectedTopicsForMerge = showMergeLevelSection
                                                                ? selectedLevelTopicsForMerge
                                                                : (showMergePedagogySection.iDo ? selectedPedagogyTopicsForMerge.iDo?.[currentMergeActivity] :
                                                                    showMergePedagogySection.weDo ? selectedPedagogyTopicsForMerge.weDo?.[currentMergeActivity] :
                                                                        selectedPedagogyTopicsForMerge.youDo?.[currentMergeActivity]) || new Set();

                                                            if (direction === 'current') {
                                                                isModuleEnabled = true;
                                                            } else if (direction === 'after') {
                                                                if (hasSubModules) {
                                                                    if (moduleIndex === selectedModuleIndex + 1) {
                                                                        const prevModule = sortedModules[moduleIndex - 1];
                                                                        const isPrevModuleCompleted = areAllSubModulesCompleted(
                                                                            prevModule,
                                                                            sortedSubModules,
                                                                            sortedTopics,
                                                                            selectedTopicsForMerge,
                                                                            selectedSubModuleForTopic?.id,
                                                                            (editMode as any)?.data?._id // Add this parameter

                                                                        );

                                                                        const currentModuleSubModules = sortedSubModules.filter((sm: any) => sm.moduleId === selectedSubModuleForTopic?.moduleId);
                                                                        const currentSubModuleIndex = currentModuleSubModules.findIndex((sm: any) => sm._id === selectedSubModuleForTopic?.id);
                                                                        const lastSubModuleIndex = currentModuleSubModules.length - 1;
                                                                        let isCurrentToLastCompleted = false;

                                                                        if (currentSubModuleIndex !== -1 && currentSubModuleIndex === lastSubModuleIndex) {
                                                                            // const currentSubModuleTopics = sortedTopics.filter(t => t.subModuleId === selectedSubModuleForTopic?.id);
                                                                            const currentSubModuleTopics = sortedTopics.filter((t: any) => {
                                                                                const isCurrentTopic = t._id === (editMode as any)?.data?._id;
                                                                                return t.subModuleId === selectedSubModuleForTopic?.id && !isCurrentTopic;
                                                                            });
                                                                            isCurrentToLastCompleted = currentSubModuleTopics.every((t: any) => selectedTopicsForMerge.has(t._id));
                                                                        } else if (currentSubModuleIndex !== -1) {
                                                                            isCurrentToLastCompleted = true;
                                                                            for (let i = currentSubModuleIndex; i <= lastSubModuleIndex; i++) {
                                                                                const subModuleTopics = sortedTopics.filter((t: any) => t.subModuleId === currentModuleSubModules[i]._id);
                                                                                if (!subModuleTopics.every((t: any) => selectedTopicsForMerge.has(t._id))) {
                                                                                    isCurrentToLastCompleted = false;
                                                                                    break;
                                                                                }
                                                                            }
                                                                        }

                                                                        isModuleEnabled = isPrevModuleCompleted || isCurrentToLastCompleted;
                                                                    } else {
                                                                        const prevModule = sortedModules[moduleIndex - 1];
                                                                        isModuleEnabled = areAllSubModulesCompleted(
                                                                            prevModule,
                                                                            sortedSubModules,
                                                                            sortedTopics,
                                                                            selectedTopicsForMerge,
                                                                            selectedSubModuleForTopic?.id,
                                                                            (editMode as any)?.data?._id // Add this parameter
                                                                        );
                                                                    }
                                                                } else {
                                                                    if (moduleIndex === selectedModuleIndex + 1) {
                                                                        const prevModule = sortedModules[moduleIndex - 1];
                                                                        const isPrevModuleCompleted = areAllModuleTopicsCompleted(
                                                                            prevModule,
                                                                            sortedTopics,
                                                                            selectedTopicsForMerge,
                                                                            (editMode as any)?.data?._id
                                                                        );

                                                                        const currentModuleTopics = sortedTopics.filter((t: any) => t.moduleId === selectedSubModuleForTopic?.moduleId && t._id !== (editMode as any)?.data?._id);
                                                                        const currentTopicIndex = currentModuleTopics.findIndex((t: any) => t._id === (editMode as any)?.data?._id);
                                                                        const lastTopicIndex = currentModuleTopics.length - 1;
                                                                        let isCurrentToLastCompleted = true;

                                                                        if (currentTopicIndex !== -1 && currentTopicIndex === lastTopicIndex) {
                                                                            isCurrentToLastCompleted = true;
                                                                        } else if (currentTopicIndex !== -1) {
                                                                            for (let i = currentTopicIndex + 1; i <= lastTopicIndex; i++) {
                                                                                if (!selectedTopicsForMerge.has(currentModuleTopics[i]._id)) {
                                                                                    isCurrentToLastCompleted = false;
                                                                                    break;
                                                                                }
                                                                            }
                                                                        }

                                                                        isModuleEnabled = isPrevModuleCompleted || isCurrentToLastCompleted;
                                                                    } else {
                                                                        const prevModule = sortedModules[moduleIndex - 1];
                                                                        isModuleEnabled = areAllModuleTopicsCompleted(
                                                                            prevModule,
                                                                            sortedTopics,
                                                                            selectedTopicsForMerge,
                                                                            (editMode as any)?.data?._id
                                                                        );
                                                                    }
                                                                }
                                                            } else if (direction === 'before') {
                                                                if (hasSubModules) {
                                                                    if (moduleIndex === selectedModuleIndex - 1) {
                                                                        const nextModule = sortedModules[moduleIndex + 1];
                                                                        const isNextModuleCompleted = areAllSubModulesCompleted(
                                                                            nextModule,
                                                                            sortedSubModules,
                                                                            sortedTopics,
                                                                            selectedTopicsForMerge,
                                                                            selectedSubModuleForTopic?.id,
                                                                            (editMode as any)?.data?._id // Add this parameter
                                                                        );

                                                                        const currentModuleSubModules = sortedSubModules.filter((sm: any) => sm.moduleId === selectedSubModuleForTopic?.moduleId);
                                                                        const currentSubModuleIndex = currentModuleSubModules.findIndex((sm: any) => sm._id === selectedSubModuleForTopic?.id);
                                                                        let isCurrentToFirstCompleted = false;

                                                                        if (currentSubModuleIndex !== -1 && currentSubModuleIndex === 0) {
                                                                            const currentSubModuleTopics = sortedTopics.filter((t: any) => {
                                                                                const isCurrentTopic = t._id === (editMode as any)?.data?._id;
                                                                                return t.subModuleId === selectedSubModuleForTopic?.id && !isCurrentTopic;
                                                                            });
                                                                            isCurrentToFirstCompleted = currentSubModuleTopics.every((t: any) => selectedTopicsForMerge.has(t._id));
                                                                        } else if (currentSubModuleIndex !== -1) {
                                                                            isCurrentToFirstCompleted = true;
                                                                            for (let i = currentSubModuleIndex; i >= 0; i--) {
                                                                                const subModuleTopics = sortedTopics.filter((t: any) => t.subModuleId === currentModuleSubModules[i]._id);
                                                                                if (!subModuleTopics.every((t: any) => selectedTopicsForMerge.has(t._id))) {
                                                                                    isCurrentToFirstCompleted = false;
                                                                                    break;
                                                                                }
                                                                            }
                                                                        }

                                                                        isModuleEnabled = isNextModuleCompleted || isCurrentToFirstCompleted;
                                                                    } else {
                                                                        const nextModule = sortedModules[moduleIndex + 1];
                                                                        isModuleEnabled = areAllSubModulesCompleted(
                                                                            nextModule,
                                                                            sortedSubModules,
                                                                            sortedTopics,
                                                                            selectedTopicsForMerge,
                                                                            selectedSubModuleForTopic?.id,
                                                                            (editMode as any)?.data?._id // Add this parameter
                                                                        );
                                                                    }
                                                                } else {
                                                                    if (moduleIndex === selectedModuleIndex - 1) {
                                                                        const nextModule = sortedModules[moduleIndex + 1];
                                                                        const isNextModuleCompleted = areAllModuleTopicsCompleted(
                                                                            nextModule,
                                                                            sortedTopics,
                                                                            selectedTopicsForMerge,
                                                                            (editMode as any)?.data?._id
                                                                        );

                                                                        const currentModuleTopics = sortedTopics.filter((t: any) => t.moduleId === selectedSubModuleForTopic?.moduleId && t._id !== (editMode as any)?.data?._id);
                                                                        const currentTopicIndex = currentModuleTopics.findIndex((t: any) => t._id === (editMode as any)?.data?._id);
                                                                        let isCurrentToFirstCompleted = true;

                                                                        if (currentTopicIndex !== -1 && currentTopicIndex === 0) {
                                                                            isCurrentToFirstCompleted = true;
                                                                        } else if (currentTopicIndex !== -1) {
                                                                            for (let i = currentTopicIndex - 1; i >= 0; i--) {
                                                                                if (!selectedTopicsForMerge.has(currentModuleTopics[i]._id)) {
                                                                                    isCurrentToFirstCompleted = false;
                                                                                    break;
                                                                                }
                                                                            }
                                                                        }

                                                                        isModuleEnabled = isNextModuleCompleted || isCurrentToFirstCompleted;
                                                                    } else {
                                                                        const nextModule = sortedModules[moduleIndex + 1];
                                                                        isModuleEnabled = areAllModuleTopicsCompleted(
                                                                            nextModule,
                                                                            sortedTopics,
                                                                            selectedTopicsForMerge,
                                                                            (editMode as any)?.data?._id
                                                                        );
                                                                    }
                                                                }
                                                            }

                                                            const isModuleExpanded = expandedModules.has(module._id);

                                                            return (
                                                                <div key={module._id} className="space-y-2">

                                                                    <div
                                                                        className={`text-xs font-medium text-slate-700 px-2 py-1 rounded-md flex items-center cursor-pointer transition-colors
    ${moduleIndex === selectedModuleIndex ? "bg-[#FFD9BC] font-semibold" : "bg-[#FFF3EA]"}
    ${isModuleEnabled ? "hover:bg-[#FFE4D0]" : "opacity-50 cursor-not-allowed"}
    ${isCurrentModule ? 'border border-[#FDBA74]' : ''}`} // Add border for current module
                                                                        onClick={() => isModuleEnabled && toggleExpansion(module._id, expandedModules, setExpandedModules)}
                                                                    >
                                                                        {isModuleExpanded ? (
                                                                            <ChevronDownIcon className="w-3 h-3 mr-1 text-[#F97316]" />
                                                                        ) : (
                                                                            <ChevronRightIcon className="w-3 h-3 mr-1 text-[#F97316]" />
                                                                        )}
                                                                        <FolderOpen className="w-3 h-3 mr-1.5 text-[#F97316]" />

                                                                        <span className={isCurrentModule ? 'text-[#9A3F0A] font-semibold' : 'text-slate-700'}>
                                                                            {module.title}
                                                                        </span>
                                                                        {isCurrentModule && <span className="ml-2 text-xs text-[#F97316]">(Current Module)</span>}
                                                                        <span className="ml-auto text-xs text-slate-500">({totalTopicsCount})</span>
                                                                    </div>

                                                                    {isModuleExpanded && (
                                                                        <>
                                                                            {!hasSubModules && moduleTopics.length > 0 && (
                                                                                <div className="space-y-1 ml-3 pl-2 border-l border-[#FFD9BC]">
                                                                                    {moduleTopics.map((topic: any, topicIndex: any, arr: any) => {
                                                                                        const isCurrentTopic = (editMode as any)?.data?._id === topic._id;
                                                                                        const prevTopic = direction === 'after' ? arr[topicIndex - 1] : arr[topicIndex + 1];
                                                                                        const isTopicEnabled = isModuleEnabled && (isCurrentTopic || !prevTopic || selectedTopicsForMerge.has(prevTopic._id));

                                                                                        return (

                                                                                            <div key={topic._id} className={`flex items-center space-x-2 py-1.5 rounded-md transition-colors px-2
          ${isTopicEnabled ? "hover:bg-slate-100/50" : "opacity-50 cursor-not-allowed"}
          ${isCurrentTopic ? "bg-green-50 border border-green-200" : ""}`}>

                                                                                                {isCurrentTopic ? (
                                                                                                    <div className="w-4 h-4 flex items-center justify-center mr-1">
                                                                                                        <span className="text-green-500 text-lg">•</span>
                                                                                                    </div>
                                                                                                ) : (
                                                                                                    <Checkbox
                                                                                                        id={`topic-${topic._id}`}
                                                                                                        checked={selectedTopicsForMerge.has(topic._id) || isCurrentTopic}
                                                                                                        disabled={!isTopicEnabled || isCurrentTopic}
                                                                                                        onCheckedChange={(checked) => {
                                                                                                            if (isCurrentTopic) return;

                                                                                                            const newSelectedTopics = new Set(selectedTopicsForMerge);

                                                                                                            if (checked) {
                                                                                                                newSelectedTopics.add(topic._id);
                                                                                                            } else {
                                                                                                                // Get all topics in order
                                                                                                                const allTopics: any = [];
                                                                                                                sortedModules.forEach((mod: any) => {
                                                                                                                    const hasSubMods = selectedCourse?.courseHierarchy.map((l: any) => l.toLowerCase()).includes('sub module');
                                                                                                                    if (hasSubMods) {
                                                                                                                        sortedSubModules.filter((sm: any) => sm.moduleId === mod._id).forEach((sm: any) => {
                                                                                                                            sortedTopics.filter((t: any) => t.subModuleId === sm._id).forEach((t: any) => allTopics.push(t._id));
                                                                                                                        });
                                                                                                                    } else {
                                                                                                                        sortedTopics.filter((t: any) => t.moduleId === mod._id).forEach((t: any) => allTopics.push(t._id));
                                                                                                                    }
                                                                                                                });

                                                                                                                const currentIndex = allTopics.indexOf(topic._id);
                                                                                                                newSelectedTopics.delete(topic._id);

                                                                                                                if (direction === 'after' || direction === 'current') {
                                                                                                                    // Remove all topics after this one
                                                                                                                    for (let i = currentIndex + 1; i < allTopics.length; i++) {
                                                                                                                        newSelectedTopics.delete(allTopics[i]);
                                                                                                                    }
                                                                                                                } else {
                                                                                                                    // Remove all topics before this one
                                                                                                                    for (let i = currentIndex - 1; i >= 0; i--) {
                                                                                                                        newSelectedTopics.delete(allTopics[i]);
                                                                                                                    }
                                                                                                                }
                                                                                                            }

                                                                                                            // Update the appropriate state based on merge type
                                                                                                            if (showMergeLevelSection) {
                                                                                                                setSelectedLevelTopicsForMerge(newSelectedTopics);
                                                                                                            } else {
                                                                                                                const activityType = showMergePedagogySection.iDo ? "iDo" :
                                                                                                                    showMergePedagogySection.weDo ? "weDo" : "youDo";

                                                                                                                setSelectedPedagogyTopicsForMerge({
                                                                                                                    ...selectedPedagogyTopicsForMerge,
                                                                                                                    [activityType]: {
                                                                                                                        ...selectedPedagogyTopicsForMerge[activityType],
                                                                                                                        [currentMergeActivity]: newSelectedTopics
                                                                                                                    }
                                                                                                                });
                                                                                                            }
                                                                                                        }}
                                                                                                    />
                                                                                                )}

                                                                                                <Label
                                                                                                    htmlFor={isCurrentTopic ? undefined : `topic-${topic._id}`}
                                                                                                    className={`text-sm flex-1 truncate ${isTopicEnabled ? "cursor-pointer" : "cursor-not-allowed"} 
              ${isCurrentTopic ? "text-green-700 font-medium" : "text-slate-700"}`}
                                                                                                >
                                                                                                    {topic.title}
                                                                                                    {isCurrentTopic && <span className="ml-2 text-xs text-green-600">(Current Topic)</span>}
                                                                                                </Label>
                                                                                            </div>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            )}

                                                                            {hasSubModules && moduleSubModules.map((subModule: any, subIndex: any) => {


                                                                                const subModuleTopics = sortedTopics.filter((t: any) => t.subModuleId === subModule._id && t._id !== (editMode as any)?.data?._id);



                                                                                const isCurrentSubModule = selectedSubModuleForTopic?.id === subModule._id;
                                                                                const isSubModuleExpanded = expandedSubModules.has(subModule._id);


                                                                                // Determine if submodule should be enabled
                                                                                let isSubModuleEnabled = false;



                                                                                const currentSubModuleIndex = moduleSubModules.findIndex((sm: any) => sm._id === selectedSubModuleForTopic?.id);
                                                                                const direction = subIndex > currentSubModuleIndex ? 'after' :
                                                                                    subIndex < currentSubModuleIndex ? 'before' : 'current';




                                                                                if (isModuleEnabled) {
                                                                                    if (direction === 'current') {
                                                                                        // ✅ Current submodule is always enabled
                                                                                        isSubModuleEnabled = true;

                                                                                        // If it has no topics, mark it as "completed" for enablement of neighbors
                                                                                        const currentSubModuleTopics = sortedTopics.filter((t: any) => t.subModuleId === subModule._id);
                                                                                        const isCurrentEmpty = currentSubModuleTopics.length === 0;
                                                                                        if (isCurrentEmpty) {
                                                                                            // Add its topics to selectedTopicsForMerge so neighbors see it as completed
                                                                                            currentSubModuleTopics.forEach((t: any) => selectedTopicsForMerge.add(t._id));
                                                                                        }



                                                                                    } else if (direction === 'after') {
                                                                                        const prevSubModule = moduleSubModules[subIndex - 1];

                                                                                        // Check if this is the first submodule right after current
                                                                                        const isImmediatelyAfterCurrent = subIndex === currentSubModuleIndex + 1;

                                                                                        if (isImmediatelyAfterCurrent) {
                                                                                            // Enable immediately - no need to check if all topics are selected
                                                                                            isSubModuleEnabled = true;
                                                                                        } else {
                                                                                            // For subsequent submodules, check if previous is complete
                                                                                            const prevSubModuleTopics = sortedTopics.filter((t: any) =>
                                                                                                t.subModuleId === prevSubModule._id &&
                                                                                                t._id !== (editMode as any)?.data?._id
                                                                                            );

                                                                                            isSubModuleEnabled = prevSubModuleTopics.length > 0 &&
                                                                                                prevSubModuleTopics.every((t: any) => selectedTopicsForMerge.has(t._id));
                                                                                        }
                                                                                    }


                                                                                    else if (direction === 'before') {
                                                                                        if (subIndex === moduleSubModules.length - 1) {
                                                                                            isSubModuleEnabled = true;
                                                                                        } else {
                                                                                            const nextSubModule = moduleSubModules[subIndex + 1];
                                                                                            const nextSubModuleTopics = sortedTopics.filter((t: any) => t.subModuleId === nextSubModule._id);

                                                                                            isSubModuleEnabled =
                                                                                                nextSubModuleTopics.length === 0
                                                                                                    ? nextSubModule._id === selectedSubModuleForTopic?.id // only enable if next is current
                                                                                                    : nextSubModuleTopics.every((t: any) => selectedTopicsForMerge.has(t._id));
                                                                                        }
                                                                                    }
                                                                                }


                                                                                return (
                                                                                    <div key={subModule._id} className="space-y-1 ml-3 pl-2 border-l border-[#FFD9BC]">
                                                                                        <div
                                                                                            className={`text-xs font-medium text-slate-600 px-2 py-1 rounded-md flex items-center cursor-pointer transition-colors
                                                ${isCurrentSubModule ? "bg-amber-200 font-semibold" : "bg-amber-50"}
                                                ${isSubModuleEnabled ? "hover:bg-amber-100" : "opacity-50 cursor-not-allowed"}`}
                                                                                            onClick={() => isSubModuleEnabled && toggleExpansion(subModule._id, expandedSubModules, setExpandedSubModules)}
                                                                                        >
                                                                                            {isSubModuleExpanded ? (
                                                                                                <ChevronDownIcon className="w-3 h-3 mr-1 text-amber-500" />
                                                                                            ) : (
                                                                                                <ChevronRightIcon className="w-3 h-3 mr-1 text-amber-500" />
                                                                                            )}
                                                                                            <Layers className="w-3 h-3 mr-1.5 text-amber-500" />
                                                                                            {/* {subModule.title} */}
                                                                                            <span className={isCurrentSubModule ? 'text-amber-800 font-semibold' : 'text-slate-600'}>
                                                                                                {subModule.title}
                                                                                            </span>
                                                                                            {isCurrentSubModule && <span className="ml-2 text-xs text-amber-600">(Current Submodule)</span>}
                                                                                            <span className="ml-auto text-xs text-slate-500">({subModuleTopics.length})</span>
                                                                                        </div>
                                                                                        {isSubModuleExpanded && (
                                                                                            <div className="space-y-1 ml-3 pl-2 border-l border-amber-200">
                                                                                                {subModuleTopics.map((topic: any, topicIndex: any, arr: any) => {
                                                                                                    const isCurrentTopic = (editMode as any)?.data?._id === topic._id;
                                                                                                    const prevTopic = direction === 'after' ? arr[topicIndex - 1] : arr[topicIndex + 1];
                                                                                                    const isTopicEnabled = isSubModuleEnabled && (isCurrentTopic || !prevTopic || selectedTopicsForMerge.has(prevTopic._id));

                                                                                                    return (
                                                                                                        <div key={topic._id} className={`flex items-center space-x-2 py-1.5 rounded-md transition-colors px-2
                                                            ${isTopicEnabled ? "hover:bg-slate-100/50" : "opacity-50 cursor-not-allowed"}
                                                            ${isCurrentTopic ? "bg-green-50" : ""}`}>
                                                                                                            <Checkbox
                                                                                                                id={`topic-${topic._id}`}
                                                                                                                checked={selectedTopicsForMerge.has(topic._id) || isCurrentTopic}
                                                                                                                disabled={!isTopicEnabled || isCurrentTopic}
                                                                                                                // Replace the existing onCheckedChange logic in both module topics and submodule topics sections

                                                                                                                onCheckedChange={(checked) => {
                                                                                                                    if (isCurrentTopic) return;

                                                                                                                    const newSelectedTopics = new Set(selectedTopicsForMerge);

                                                                                                                    if (checked) {
                                                                                                                        newSelectedTopics.add(topic._id);
                                                                                                                    } else {
                                                                                                                        // Get all topics in order
                                                                                                                        const allTopics: any = [];
                                                                                                                        sortedModules.forEach((mod: any) => {
                                                                                                                            const hasSubMods = selectedCourse?.courseHierarchy.map((l: any) => l.toLowerCase()).includes('sub module');
                                                                                                                            if (hasSubMods) {
                                                                                                                                sortedSubModules.filter((sm: any) => sm.moduleId === mod._id).forEach((sm: any) => {
                                                                                                                                    sortedTopics.filter((t: any) => t.subModuleId === sm._id).forEach((t: any) => allTopics.push(t._id));
                                                                                                                                });
                                                                                                                            } else {
                                                                                                                                sortedTopics.filter((t: any) => t.moduleId === mod._id).forEach((t: any) => allTopics.push(t._id));
                                                                                                                            }
                                                                                                                        });

                                                                                                                        const currentIndex = allTopics.indexOf(topic._id);
                                                                                                                        const currentTopicId = (editMode as any)?.data?._id;
                                                                                                                        const currentTopicIndex = allTopics.indexOf(currentTopicId);

                                                                                                                        newSelectedTopics.delete(topic._id);

                                                                                                                        // Determine if we're deselecting above or below the current topic
                                                                                                                        if (currentIndex < currentTopicIndex) {
                                                                                                                            // Deselecting above current topic - remove all topics below the deselected one (towards current)
                                                                                                                            for (let i = currentIndex + 1; i < allTopics.length; i++) {
                                                                                                                                newSelectedTopics.delete(allTopics[i]);
                                                                                                                            }
                                                                                                                        } else if (currentIndex > currentTopicIndex) {
                                                                                                                            // Deselecting below current topic - remove all topics above the deselected one (towards current)
                                                                                                                            for (let i = 0; i < currentIndex; i++) {
                                                                                                                                newSelectedTopics.delete(allTopics[i]);
                                                                                                                            }
                                                                                                                        }
                                                                                                                    }

                                                                                                                    // Update the appropriate state based on merge type
                                                                                                                    if (showMergeLevelSection) {
                                                                                                                        setSelectedLevelTopicsForMerge(newSelectedTopics);
                                                                                                                    } else {
                                                                                                                        const activityType = showMergePedagogySection.iDo ? "iDo" :
                                                                                                                            showMergePedagogySection.weDo ? "weDo" : "youDo";

                                                                                                                        setSelectedPedagogyTopicsForMerge({
                                                                                                                            ...selectedPedagogyTopicsForMerge,
                                                                                                                            [activityType]: {
                                                                                                                                ...selectedPedagogyTopicsForMerge[activityType],
                                                                                                                                [currentMergeActivity]: newSelectedTopics
                                                                                                                            }
                                                                                                                        });
                                                                                                                    }
                                                                                                                }}
                                                                                                            />
                                                                                                            <Label htmlFor={`topic-${topic._id}`} className={`text-sm text-slate-700 flex-1 truncate ${isTopicEnabled ? "cursor-pointer" : "cursor-not-allowed"} ${isCurrentTopic ? "font-medium" : ""}`}>
                                                                                                                {topic.title} {isCurrentTopic && "(Current)"}
                                                                                                            </Label>
                                                                                                        </div>
                                                                                                    );
                                                                                                })}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                {/* Subtopic-level merging with multi-level collapse/expand */}
                                                {dialogType === 'subtopic' && (
                                                    <div className="space-y-3">
                                                        {sortedModules.map((module: any) => {
                                                            const hierarchyLevels = selectedCourse?.courseHierarchy.map((level: any) => level.toLowerCase()) || [];
                                                            const hasSubModules = hierarchyLevels.includes('sub module');

                                                            const moduleTopics = sortedTopics.filter((t: any) =>
                                                                t.moduleId === module._id &&
                                                                (!hasSubModules || !t.subModuleId)
                                                            );

                                                            const moduleSubModules = hasSubModules ?
                                                                sortedSubModules.filter((sm: any) => sm.moduleId === module._id) : [];

                                                            let hasAnySubtopics = false;
                                                            let totalSubtopicsCount = 0;

                                                            for (const topic of moduleTopics) {
                                                                const topicSubTopics = sortedSubTopics.filter((st: any) =>
                                                                    st.topicId === topic._id &&
                                                                    st._id !== (editMode as any)?.data?._id
                                                                );
                                                                totalSubtopicsCount += topicSubTopics.length;
                                                                if (topicSubTopics.length > 0) {
                                                                    hasAnySubtopics = true;
                                                                }
                                                            }

                                                            if (hasSubModules && !hasAnySubtopics) {
                                                                for (const subModule of moduleSubModules) {
                                                                    const subModuleTopics = sortedTopics.filter((t: any) => t.subModuleId === subModule._id);
                                                                    for (const topic of subModuleTopics) {
                                                                        const topicSubTopics = sortedSubTopics.filter((st: any) =>
                                                                            st.topicId === topic._id &&
                                                                            st._id !== (editMode as any)?.data?._id
                                                                        );
                                                                        totalSubtopicsCount += topicSubTopics.length;
                                                                        if (topicSubTopics.length > 0) {
                                                                            hasAnySubtopics = true;
                                                                        }
                                                                    }
                                                                }
                                                            }

                                                            if (!hasAnySubtopics) return null;

                                                            const isModuleExpanded = expandedModules.has(module._id);

                                                            return (
                                                                <div key={module._id} className="space-y-3">
                                                                    <div
                                                                        className="text-xs font-medium text-slate-700 px-2 py-1 bg-[#FFF3EA] rounded-md flex items-center cursor-pointer hover:bg-[#FFE4D0] transition-colors"
                                                                        onClick={() => toggleExpansion(module._id, expandedModules, setExpandedModules)}
                                                                    >
                                                                        {isModuleExpanded ? (
                                                                            <ChevronDownIcon className="w-3 h-3 mr-1 text-[#F97316]" />
                                                                        ) : (
                                                                            <ChevronRightIcon className="w-3 h-3 mr-1 text-[#F97316]" />
                                                                        )}
                                                                        <FolderOpen className="w-3 h-3 mr-1.5 text-[#F97316]" />
                                                                        {module.title}
                                                                        <span className="ml-auto text-xs text-slate-500">({totalSubtopicsCount})</span>
                                                                    </div>

                                                                    {isModuleExpanded && (
                                                                        <>
                                                                            {!hasSubModules && moduleTopics.map((topic: any) => {
                                                                                const topicSubTopics = sortedSubTopics.filter((st: any) =>
                                                                                    st.topicId === topic._id &&
                                                                                    st._id !== (editMode as any)?.data?._id
                                                                                );

                                                                                if (topicSubTopics.length === 0) return null;

                                                                                const isTopicExpanded = expandedTopics.has(topic._id);

                                                                                return (
                                                                                    <div key={topic._id} className="space-y-1 ml-3 pl-2 border-l border-[#FFD9BC]">
                                                                                        <div
                                                                                            className="text-xs font-medium text-slate-600 px-2 py-1 bg-amber-50 rounded-md flex items-center cursor-pointer hover:bg-amber-100 transition-colors"
                                                                                            onClick={() => toggleExpansion(topic._id, expandedTopics, setExpandedTopics)}
                                                                                        >
                                                                                            {isTopicExpanded ? (
                                                                                                <ChevronDownIcon className="w-3 h-3 mr-1 text-amber-500" />
                                                                                            ) : (
                                                                                                <ChevronRightIcon className="w-3 h-3 mr-1 text-amber-500" />
                                                                                            )}
                                                                                            <Layers className="w-3 h-3 mr-1.5 text-amber-500" />
                                                                                            {topic.title}
                                                                                            <span className="ml-auto text-xs text-slate-500">({topicSubTopics.length})</span>
                                                                                        </div>
                                                                                        {isTopicExpanded && (
                                                                                            <div className="space-y-1 ml-3 pl-2 border-l border-amber-200">
                                                                                                {topicSubTopics.map((subTopic: any) => (
                                                                                                    <div key={subTopic._id} className="flex items-center space-x-2 py-1.5 hover:bg-slate-100/50 rounded-md transition-colors px-2">
                                                                                                        <Checkbox
                                                                                                            id={`subtopic-${subTopic._id}`}
                                                                                                            checked={
                                                                                                                showMergeLevelSection
                                                                                                                    ? selectedLevelSubTopicsForMerge.has(subTopic._id)
                                                                                                                    : (showMergePedagogySection.iDo &&
                                                                                                                        selectedPedagogySubTopicsForMerge.iDo?.[currentMergeActivity]?.has(subTopic._id)) ||
                                                                                                                    (showMergePedagogySection.weDo &&
                                                                                                                        selectedPedagogySubTopicsForMerge.weDo?.[currentMergeActivity]?.has(subTopic._id)) ||
                                                                                                                    (showMergePedagogySection.youDo &&
                                                                                                                        selectedPedagogySubTopicsForMerge.youDo?.[currentMergeActivity]?.has(subTopic._id))
                                                                                                            }
                                                                                                            onCheckedChange={(checked) => {
                                                                                                                if (showMergeLevelSection) {
                                                                                                                    const newSet = new Set(selectedLevelSubTopicsForMerge);
                                                                                                                    if (checked) {
                                                                                                                        newSet.add(subTopic._id);
                                                                                                                    } else {
                                                                                                                        newSet.delete(subTopic._id);
                                                                                                                    }
                                                                                                                    setSelectedLevelSubTopicsForMerge(newSet);
                                                                                                                } else {
                                                                                                                    const activityType =
                                                                                                                        showMergePedagogySection.iDo ? "iDo" :
                                                                                                                            showMergePedagogySection.weDo ? "weDo" : "youDo";

                                                                                                                    // Initialize if not exists
                                                                                                                    if (!selectedPedagogySubTopicsForMerge[activityType]) {
                                                                                                                        selectedPedagogySubTopicsForMerge[activityType] = {};
                                                                                                                    }
                                                                                                                    if (!selectedPedagogySubTopicsForMerge[activityType][currentMergeActivity]) {
                                                                                                                        selectedPedagogySubTopicsForMerge[activityType][currentMergeActivity] = new Set();
                                                                                                                    }

                                                                                                                    const newSet = new Set(selectedPedagogySubTopicsForMerge[activityType][currentMergeActivity]);
                                                                                                                    if (checked) newSet.add(subTopic._id);
                                                                                                                    else newSet.delete(subTopic._id);

                                                                                                                    setSelectedPedagogySubTopicsForMerge({
                                                                                                                        ...selectedPedagogySubTopicsForMerge,
                                                                                                                        [activityType]: {
                                                                                                                            ...selectedPedagogySubTopicsForMerge[activityType],
                                                                                                                            [currentMergeActivity]: newSet
                                                                                                                        }
                                                                                                                    });
                                                                                                                }
                                                                                                            }}
                                                                                                        />
                                                                                                        <Label htmlFor={`subtopic-${subTopic._id}`} className="text-sm text-slate-700 cursor-pointer flex-1 truncate">
                                                                                                            {subTopic.title}
                                                                                                        </Label>
                                                                                                    </div>
                                                                                                ))}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                );
                                                                            })}

                                                                            {hasSubModules && moduleSubModules.map((subModule: any) => {
                                                                                const subModuleTopics = sortedTopics.filter((t: any) => t.subModuleId === subModule._id);

                                                                                let subModuleHasSubtopics = false;
                                                                                let subModuleSubtopicsCount = 0;
                                                                                for (const topic of subModuleTopics) {
                                                                                    const topicSubTopics = sortedSubTopics.filter((st: any) =>
                                                                                        st.topicId === topic._id &&
                                                                                        st._id !== (editMode as any)?.data?._id
                                                                                    );
                                                                                    subModuleSubtopicsCount += topicSubTopics.length;
                                                                                    if (topicSubTopics.length > 0) {
                                                                                        subModuleHasSubtopics = true;
                                                                                    }
                                                                                }

                                                                                if (!subModuleHasSubtopics) return null;

                                                                                const isSubModuleExpanded = expandedSubModules.has(subModule._id);

                                                                                return (
                                                                                    <div key={subModule._id} className="space-y-2 ml-3 pl-2 border-l border-[#FFD9BC]">
                                                                                        <div
                                                                                            className="text-xs font-medium text-slate-600 px-2 py-1 bg-amber-50 rounded-md flex items-center cursor-pointer hover:bg-amber-100 transition-colors"
                                                                                            onClick={() => toggleExpansion(subModule._id, expandedSubModules, setExpandedSubModules)}
                                                                                        >
                                                                                            {isSubModuleExpanded ? (
                                                                                                <ChevronDownIcon className="w-3 h-3 mr-1 text-amber-500" />
                                                                                            ) : (
                                                                                                <ChevronRightIcon className="w-3 h-3 mr-1 text-amber-500" />
                                                                                            )}
                                                                                            <Layers className="w-3 h-3 mr-1.5 text-amber-500" />
                                                                                            {subModule.title}
                                                                                            <span className="ml-auto text-xs text-slate-500">({subModuleSubtopicsCount})</span>
                                                                                        </div>

                                                                                        {isSubModuleExpanded && subModuleTopics.map((topic: any) => {
                                                                                            const topicSubTopics = sortedSubTopics.filter((st: any) =>
                                                                                                st.topicId === topic._id &&
                                                                                                st._id !== (editMode as any)?.data?._id
                                                                                            );

                                                                                            if (topicSubTopics.length === 0) return null;

                                                                                            const isTopicExpanded = expandedTopics.has(topic._id);

                                                                                            return (
                                                                                                <div key={topic._id} className="space-y-1 ml-3 pl-2 border-l border-amber-200">
                                                                                                    <div
                                                                                                        className="text-xs text-slate-600 px-2 py-1 bg-green-50 rounded-md flex items-center cursor-pointer hover:bg-green-100 transition-colors"
                                                                                                        onClick={() => toggleExpansion(topic._id, expandedTopics, setExpandedTopics)}
                                                                                                    >
                                                                                                        {isTopicExpanded ? (
                                                                                                            <ChevronDownIcon className="w-3 h-3 mr-1 text-green-500" />
                                                                                                        ) : (
                                                                                                            <ChevronRightIcon className="w-3 h-3 mr-1 text-green-500" />
                                                                                                        )}
                                                                                                        <FileText className="w-3 h-3 mr-1.5 text-green-500" />
                                                                                                        {topic.title}
                                                                                                        <span className="ml-auto text-xs text-slate-500">({topicSubTopics.length})</span>
                                                                                                    </div>
                                                                                                    {isTopicExpanded && (
                                                                                                        <div className="space-y-1 ml-3 pl-2 border-l border-green-200">
                                                                                                            {topicSubTopics.map((subTopic: any) => (
                                                                                                                <div key={subTopic._id} className="flex items-center space-x-2 py-1.5 hover:bg-slate-100/50 rounded-md transition-colors px-2">
                                                                                                                    <Checkbox
                                                                                                                        id={`subtopic-${subTopic._id}`}
                                                                                                                        checked={
                                                                                                                            showMergeLevelSection
                                                                                                                                ? selectedLevelSubTopicsForMerge.has(subTopic._id)
                                                                                                                                : (showMergePedagogySection.iDo &&
                                                                                                                                    selectedPedagogySubTopicsForMerge.iDo?.[currentMergeActivity]?.has(subTopic._id)) ||
                                                                                                                                (showMergePedagogySection.weDo &&
                                                                                                                                    selectedPedagogySubTopicsForMerge.weDo?.[currentMergeActivity]?.has(subTopic._id)) ||
                                                                                                                                (showMergePedagogySection.youDo &&
                                                                                                                                    selectedPedagogySubTopicsForMerge.youDo?.[currentMergeActivity]?.has(subTopic._id))
                                                                                                                        }
                                                                                                                        onCheckedChange={(checked) => {
                                                                                                                            if (showMergeLevelSection) {
                                                                                                                                const newSet = new Set(selectedLevelSubTopicsForMerge);
                                                                                                                                if (checked) {
                                                                                                                                    newSet.add(subTopic._id);
                                                                                                                                } else {
                                                                                                                                    newSet.delete(subTopic._id);
                                                                                                                                }
                                                                                                                                setSelectedLevelSubTopicsForMerge(newSet);
                                                                                                                            } else {
                                                                                                                                const activityType =
                                                                                                                                    showMergePedagogySection.iDo ? "iDo" :
                                                                                                                                        showMergePedagogySection.weDo ? "weDo" : "youDo";

                                                                                                                                // Initialize if not exists
                                                                                                                                if (!selectedPedagogySubTopicsForMerge[activityType]) {
                                                                                                                                    selectedPedagogySubTopicsForMerge[activityType] = {};
                                                                                                                                }
                                                                                                                                if (!selectedPedagogySubTopicsForMerge[activityType][currentMergeActivity]) {
                                                                                                                                    selectedPedagogySubTopicsForMerge[activityType][currentMergeActivity] = new Set();
                                                                                                                                }

                                                                                                                                const newSet = new Set(selectedPedagogySubTopicsForMerge[activityType][currentMergeActivity]);
                                                                                                                                if (checked) newSet.add(subTopic._id);
                                                                                                                                else newSet.delete(subTopic._id);

                                                                                                                                setSelectedPedagogySubTopicsForMerge({
                                                                                                                                    ...selectedPedagogySubTopicsForMerge,
                                                                                                                                    [activityType]: {
                                                                                                                                        ...selectedPedagogySubTopicsForMerge[activityType],
                                                                                                                                        [currentMergeActivity]: newSet
                                                                                                                                    }
                                                                                                                                });
                                                                                                                            }
                                                                                                                        }}
                                                                                                                    />
                                                                                                                    <Label htmlFor={`subtopic-${subTopic._id}`} className="text-sm text-slate-700 cursor-pointer flex-1 truncate">
                                                                                                                        {subTopic.title}
                                                                                                                    </Label>
                                                                                                                </div>
                                                                                                            ))}
                                                                                                        </div>
                                                                                                    )}
                                                                                                </div>
                                                                                            );
                                                                                        })}
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Save button for merge selections */}
                                            <div className="flex justify-end gap-2 pt-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        if (showMergeLevelSection) {
                                                            setShowMergeLevelSection(false);
                                                            // Clear level selections
                                                            setSelectedLevelModulesForMerge(new Set());
                                                            setSelectedLevelSubModulesForMerge(new Set());
                                                            setSelectedLevelTopicsForMerge(new Set());
                                                            setSelectedLevelSubTopicsForMerge(new Set());
                                                        }
                                                        if (showMergePedagogySection.iDo) {
                                                            setShowMergePedagogySection((prev: any) => ({ ...prev, iDo: false }));
                                                            setSelectedPedagogyModulesForMerge((prev: any) => ({
                                                                ...prev,
                                                                iDo: {
                                                                    ...prev.iDo,
                                                                    [currentMergeActivity]: new Set()
                                                                }
                                                            }));
                                                            setSelectedPedagogySubModulesForMerge((prev: any) => ({
                                                                ...prev,
                                                                iDo: {
                                                                    ...prev.iDo,
                                                                    [currentMergeActivity]: new Set()
                                                                }
                                                            }));
                                                            setSelectedPedagogyTopicsForMerge((prev: any) => ({
                                                                ...prev,
                                                                iDo: {
                                                                    ...prev.iDo,
                                                                    [currentMergeActivity]: new Set()
                                                                }
                                                            }));
                                                            setSelectedPedagogySubTopicsForMerge((prev: any) => ({
                                                                ...prev,
                                                                iDo: {
                                                                    ...prev.iDo,
                                                                    [currentMergeActivity]: new Set()
                                                                }
                                                            }));
                                                        }
                                                        if (showMergePedagogySection.weDo) {
                                                            setShowMergePedagogySection((prev: any) => ({ ...prev, weDo: false }));
                                                            setSelectedPedagogyModulesForMerge((prev: any) => ({
                                                                ...prev,
                                                                weDo: {
                                                                    ...prev.weDo,
                                                                    [currentMergeActivity]: new Set()
                                                                }
                                                            }));
                                                            setSelectedPedagogySubModulesForMerge((prev: any) => ({
                                                                ...prev,
                                                                weDo: {
                                                                    ...prev.weDo,
                                                                    [currentMergeActivity]: new Set()
                                                                }
                                                            }));
                                                            setSelectedPedagogyTopicsForMerge((prev: any) => ({
                                                                ...prev,
                                                                weDo: {
                                                                    ...prev.weDo,
                                                                    [currentMergeActivity]: new Set()
                                                                }
                                                            }));
                                                            setSelectedPedagogySubTopicsForMerge((prev: any) => ({
                                                                ...prev,
                                                                weDo: {
                                                                    ...prev.weDo,
                                                                    [currentMergeActivity]: new Set()
                                                                }
                                                            }));
                                                        }
                                                        if (showMergePedagogySection.youDo) {
                                                            setShowMergePedagogySection((prev: any) => ({ ...prev, youDo: false }));
                                                            setSelectedPedagogyModulesForMerge((prev: any) => ({
                                                                ...prev,
                                                                youDo: {
                                                                    ...prev.youDo,
                                                                    [currentMergeActivity]: new Set()
                                                                }
                                                            }));
                                                            setSelectedPedagogySubModulesForMerge((prev: any) => ({
                                                                ...prev,
                                                                youDo: {
                                                                    ...prev.youDo,
                                                                    [currentMergeActivity]: new Set()
                                                                }
                                                            }));
                                                            setSelectedPedagogyTopicsForMerge((prev: any) => ({
                                                                ...prev,
                                                                youDo: {
                                                                    ...prev.youDo,
                                                                    [currentMergeActivity]: new Set()
                                                                }
                                                            }));
                                                            setSelectedPedagogySubTopicsForMerge((prev: any) => ({
                                                                ...prev,
                                                                youDo: {
                                                                    ...prev.youDo,
                                                                    [currentMergeActivity]: new Set()
                                                                }
                                                            }));
                                                        }
                                                    }}
                                                    className="h-8 text-xs"
                                                >
                                                    Cancel
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    onClick={() => {
                                                        if (showMergeLevelSection) {
                                                            saveLevelMergeSelections();
                                                        }
                                                        if (showMergePedagogySection.iDo) {
                                                            savePedagogyMergeSelections("iDo", currentMergeActivity);
                                                        }
                                                        if (showMergePedagogySection.weDo) {
                                                            savePedagogyMergeSelections("weDo", currentMergeActivity);
                                                        }
                                                        if (showMergePedagogySection.youDo) {
                                                            savePedagogyMergeSelections("youDo", currentMergeActivity);
                                                        }
                                                    }}
                                                    className="h-8 text-xs bg-[#F97316] hover:bg-[#C2540F]"
                                                >
                                                    Save Merge Selection
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Action buttons - span all columns */}
                                    <div className="absolute bottom-0 right-0 left-0 bg-white border-t border-slate-100 px-6 py-3 rounded-b-xl">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="h-8 px-5 text-sm font-medium text-slate-600 cursor-pointer border-slate-200 hover:bg-slate-100 rounded-lg"
                                                onClick={() => {
                                                    setShowDialog(false);
                                                    resetAllFormStates();
                                                }}
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                type="submit"
                                                size="sm"
                                                className="h-8 px-5 text-sm font-medium bg-gradient-to-br from-[#FB8C3C] via-[#F0701F] to-[#C2540F] hover:from-[#F0701F] hover:via-[#C2540F] hover:to-[#9A3F0A] text-white shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg backdrop-blur-sm border border-white/20"
                                                // disabled={
                                                //     isMergeSectionOpen || (addOnlyPedagogyLevel ? (!selectedLevel) &&
                                                //         (!hasPedagogyHoursGreaterThanZero()) :
                                                //         dialogType === 'module' ? (isCreatingModule || !moduleFormData.title) :
                                                //             dialogType === 'submodule' ? (isCreatingSubModule || !subModuleFormData.title) :
                                                //                 dialogType === 'topic' ? (isCreatingTopic || !topicFormData.title) :
                                                //                     (isCreatingSubTopic || !subTopicFormData.title))
                                                // }
                                                onClick={(e) => {
                                                    // Check conditions and show toast if invalid
                                                    if (isMergeSectionOpen) {
                                                        e.preventDefault();
                                                        toast.error("Please complete the merge selection first", {
                                                            duration: 3000,
                                                            position: 'top-right',
                                                        });
                                                        return;
                                                    }

                                                    if (addOnlyPedagogyLevel) {
                                                        if (!selectedLevel && !hasPedagogyHoursGreaterThanZero()) {
                                                            e.preventDefault();
                                                            toast.error("Please add at least one pedagogy activity with hours or select a level", {
                                                                duration: 3000,
                                                                position: 'top-right',
                                                            });
                                                            return;
                                                        }
                                                    } else {
                                                        let isValid = true;
                                                        let errorMessage = "";

                                                        if (dialogType === 'module' && !moduleFormData.title) {
                                                            isValid = false;
                                                            errorMessage = "Title is required for module";
                                                        } else if (dialogType === 'submodule' && !subModuleFormData.title) {
                                                            isValid = false;
                                                            errorMessage = "Title is required for submodule";
                                                        } else if (dialogType === 'topic' && !topicFormData.title) {
                                                            isValid = false;
                                                            errorMessage = "Title is required for topic";
                                                        } else if (dialogType === 'subtopic' && !subTopicFormData.title) {
                                                            isValid = false;
                                                            errorMessage = "Title is required for subtopic";
                                                        }

                                                        if (!isValid) {
                                                            e.preventDefault();
                                                            toast.error(errorMessage, {
                                                                duration: 3000,
                                                                position: 'top-right',
                                                            });
                                                            return;
                                                        }
                                                    }

                                                    // If all validations pass, let the form submit normally
                                                }}
                                            >
                                                {editMode ? (
                                                    <>
                                                        {(isCreatingModule || isCreatingSubModule || isCreatingTopic || isCreatingSubTopic) ? (
                                                            <>
                                                                <svg className="animate-spin -ml-1 mr-1.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                </svg>
                                                                Saving
                                                            </>
                                                        ) : (
                                                            <>
                                                                <svg className="w-3.5 h-3.5 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                </svg>
                                                                Save Changes
                                                            </>
                                                        )}
                                                    </>
                                                ) : addOnlyPedagogyLevel ? (
                                                    // Pedagogy/Level Only Mode - Always show "Save"
                                                    isCreatingModule || isCreatingSubModule || isCreatingTopic || isCreatingSubTopic ? (
                                                        <>
                                                            <svg className="animate-spin -ml-1 mr-1.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                            </svg>
                                                            Saving
                                                        </>
                                                    ) : (
                                                        <>
                                                            <svg className="w-3.5 h-3.5 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                            </svg>
                                                            Save
                                                        </>
                                                    )
                                                ) : (
                                                    <>
                                                        {dialogType === 'module' && (
                                                            isCreatingModule ? (
                                                                <>
                                                                    <svg className="animate-spin -ml-1 mr-1.5 h-3 w-3" fill="none" viewBox="0 0 24 24">
                                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                    </svg>
                                                                    {isLastHierarchy() ? ("Saving") : ("Adding")}
                                                                </>
                                                            ) : (
                                                                <>
                                                                    {isLastHierarchy() ? (
                                                                        <>
                                                                            <File />
                                                                            Save</>
                                                                    ) : (
                                                                        <>
                                                                            <svg className="w-3 h-3 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                                                                                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                                                            </svg>
                                                                            Add Module</>
                                                                    )}
                                                                </>
                                                            )
                                                        )}
                                                        {dialogType === 'submodule' && (
                                                            isCreatingSubModule ? (
                                                                <>
                                                                    <svg className="animate-spin -ml-1 mr-1.5 h-3 w-3" fill="none" viewBox="0 0 24 24">
                                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                    </svg>
                                                                    {isLastHierarchy() ? ("Saving") : ("Adding")}
                                                                </>
                                                            ) : (
                                                                <>
                                                                    {isLastHierarchy() ? (
                                                                        <>
                                                                            <File />
                                                                            Save</>
                                                                    ) : (
                                                                        <>
                                                                            <svg className="w-3 h-3 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                                                                                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                                                            </svg>
                                                                            Add Submodule</>
                                                                    )}
                                                                </>
                                                            )
                                                        )}
                                                        {dialogType === 'topic' && (
                                                            isCreatingTopic ? (
                                                                <>
                                                                    <svg className="animate-spin -ml-1 mr-1.5 h-3 w-3" fill="none" viewBox="0 0 24 24">
                                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                    </svg>
                                                                    {isLastHierarchy() ? ("Saving") : ("Adding")}
                                                                </>
                                                            ) : (
                                                                <>
                                                                    {isLastHierarchy() ? (
                                                                        <>
                                                                            <File />
                                                                            Save</>
                                                                    ) : (
                                                                        <>
                                                                            <svg className="w-3 h-3 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                                                                                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                                                            </svg>
                                                                            Add Topic</>
                                                                    )}
                                                                </>
                                                            )
                                                        )}
                                                        {dialogType === 'subtopic' && (
                                                            isCreatingSubTopic ? (
                                                                <>
                                                                    <svg className="animate-spin -ml-1 mr-1.5 h-3 w-3" fill="none" viewBox="0 0 24 24">
                                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                    </svg>
                                                                    Saving
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <File />
                                                                    Save
                                                                </>
                                                            )
                                                        )}
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        </motion.div>
                    </DialogContent>
                </Dialog>
    )
}

