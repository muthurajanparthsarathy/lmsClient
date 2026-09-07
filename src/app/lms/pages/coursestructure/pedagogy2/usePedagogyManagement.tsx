"use client"
import { getToken } from "@/lib/session";

// The entire PedagogyManagement logic — state, queries, mutations, memos,
// effects and every handler — moved verbatim out of page.tsx into a custom hook.
// page.tsx now just calls this and renders. Nothing changed but location: the
// body's scope and hook order are identical, and every value the view needs is
// returned below (tsc enforces completeness).

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { courseStructureApi, fetchCourseStructureById } from "@/app/lms/pages/coursestructure/api/createCourseStucture"
import { moduleApi } from "@/app/lms/pages/coursestructure/pedagogy2/api/addmodule"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { subModuleApi } from "@/app/lms/pages/coursestructure/pedagogy2/api/addsubmodule"
import { topicApi } from "@/app/lms/pages/coursestructure/pedagogy2/api/addtopic"
import { subTopicApi } from "@/app/lms/pages/coursestructure/pedagogy2/api/addsubtopic"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { pedagogyViewApi } from "@/app/lms/pages/coursestructure/pedagogy2/api/pedagogy"
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
import PreviewTable from "./PreviewTable"
import FullCoursePreviewTable from "./FullCoursePreviewTable"
import { exportToExcelImpl } from "./exportToExcel"
import { checkAndDeleteExistingMergedCellsImpl } from "./pedagogyDeletions"
import { handleModuleDropImpl, handleSubModuleDropImpl, handleTopicDropImpl, handleSubtopicDropImpl } from "./dragDropHandlers"
import { handleModuleSubmitImpl, handleSubModuleSubmitImpl, handleTopicSubmitImpl, handleSubTopicSubmitImpl } from "./submitHandlers"
import { createTableRowsImpl, createDuplicateTableRowsImpl, processPedagogyDataImpl, collectCompleteHierarchyIdsImpl, getAllSelectedHierarchyIdsImpl, fetchAndSetPedagogyDataImpl } from "./dataBuilders"
import { isOwnPedagogyRow, isOwnLevelRow, type HierarchyType } from "./pedagogyRowIdentity"
import { confirmUnmergeImpl, confirmCellDeleteImpl, handleDeleteLevelImpl, isCellMergedImpl, isLevelMergedImpl } from "./mergeHelpers"

/**
 * @param courseIdOverride the course to open, for hosts that have no
 * `?courseId=` of their own — the L&D console renders this screen inside its
 * own hash-routed shell and passes the id down instead.
 */
export function usePedagogyManagement(courseIdOverride?: string) {
    const fullscreenContainerRef = useRef<HTMLDivElement>(null)
    // "Full View": the table alone as a fixed overlay filling the viewport.
    // Esc exits; body scroll is locked so only the table scrolls.
    const [isTableFullView, setIsTableFullView] = useState(false)
    useEffect(() => {
        if (!isTableFullView) return
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") setIsTableFullView(false)
        }
        window.addEventListener("keydown", onKeyDown)
        const prevOverflow = document.body.style.overflow
        document.body.style.overflow = "hidden"
        return () => {
            window.removeEventListener("keydown", onKeyDown)
            document.body.style.overflow = prevOverflow
        }
    }, [isTableFullView])
    const [token, setToken] = useState<string | null>(null)
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
    const {
        data: courses = [],
        isLoading: isCoursesLoading,
        error: coursesError
    } = useQuery(courseStructureApi.getAll());
    const queryClient = useQueryClient();
    // Add to your state declarations
    const [contentHeight, setContentHeight] = useState(0);
    const scaledContentRef = useRef<HTMLDivElement | null>(null);
    const [showUnmergeDialog, setShowUnmergeDialog] = useState(false);
    const [movableCell, setMovableCell] = useState<{
        type: 'module' | 'submodule' | 'topic' | 'subtopic';
        id: string;
    } | null>(null);
    const [pendingUnmerge, setPendingUnmerge] = useState<{
        type: "iDo" | "weDo" | "youDo" | "all";
        activity: string;
        mergeIndex: number;
        hierarchyIds?: any;
    } | null>(null);
    const [showDeleteCellDialog, setShowDeleteCellDialog] = useState(false);
    const [cellToDelete, setCellToDelete] = useState<{
        moduleId: string;
        topicId: string;
        subtopicId: string;
        subModuleId: string;
        type: "iDo" | "weDo" | "youDo";
        activity: string;
    } | null>(null);
    const [mergeEditError, setMergeEditError] = useState("");
    const [selectedSubModuleForTopic, setSelectedSubModuleForTopic] = useState<{
        id: string | any;
        moduleId: string;
        name: string;
    } | null>(null);
    const [topicFormData, setTopicFormData] = useState<Omit<TopicCreateData, 'moduleId' | 'subModuleId' | 'courses'>>({
        title: '',
        description: '',
        level: '',
        duration: 0
    });
    const printRef = useRef<PrintComponentRef>(null);
    const [isMergeSectionOpen, setIsMergeSectionOpen] = useState(false);
    const [editMode, setEditMode] = useState<{
        type: 'module' | 'submodule' | 'topic' | 'subtopic',
        data: any
    } | null>(null);
    const [actionsEnabled, setActionsEnabled] = useState(false)
    const [directActionsEnabled, setDirectActionsEnabled] = useState(false)
    const [isOpen, setIsOpen] = useState(false);
    const [duplicateChecked, setDuplicateChecked] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<{
        type: 'module' | 'submodule' | 'topic' | 'subtopic',
        id: string
    } | null>(null);
    const [showDialog, setShowDialog] = useState(false);
    const [dialogType, setDialogType] = useState<'module' | 'submodule' | 'topic' | 'subtopic' | null>(null);
    const [editingMerge, setEditingMerge] = useState<{
        type: "iDo" | "weDo" | "youDo";
        activity: string;
        mergeIndex: number;
        value: number;
        hierarchyIds?: any;
    } | null>(null);
    const [mergedLevels, setMergedLevels] = useState<MergedLevel[]>([]);
    const [pendingLevelMerge, setPendingLevelMerge] = useState<{
        selectedRows: number[];
        hierarchyIds?: {
            modules: string[];
            subModules: string[];
            topics: string[];
            subTopics: string[];
        };
    } | null>(null);
    // Replace selectedRows state with selectedCells
    const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set()); // Store as "rowIndex-type-activity"
    const [mergeLevelValue, setMergeLevelValue] = useState("");
    const [showMergeLevelDialog, setShowMergeLevelDialog] = useState(false);
    const [showPreviewDialog, setShowPreviewDialog] = useState(false);
    // Update the pedagogy views query to include modules dependency
    const [isSelectingCells, setIsSelectingCells] = useState(false);
    const [dragOverId, setDragOverId] = useState<string | null>(null);
    const [moduleTestConfig, setModuleTestConfig] = useState<{
        coreProgram: string[];
        frontend: string[];
        database: string[];
    }>({
        coreProgram: [],
        frontend: [],
        database: []
    });
    const {
        data: modules = [],
        isLoading: isModulesLoading,
        error: modulesError,
        refetch: refetchModules
    } = useQuery({
        ...moduleApi.getAll(),
        enabled: !!selectedCourse, // Only fetch when a course is selected
        select: (data) => {
            if (!selectedCourse) return [];
            // Filter modules to only include those that belong to the selected course
            return data.filter(module => module.courses.includes(selectedCourse._id));
        }
    });
    const createModuleMutation = useMutation(moduleApi.create());
    const updateModuleMutation = useMutation(moduleApi.update());
    const [showPedagogySection, setShowPedagogySection] = useState(false);
    const [selectedPedagogyActivities, setSelectedPedagogyActivities] = useState<{
        iDo: string[];
        weDo: string[];
        youDo: string[];
    }>({
        iDo: [],
        weDo: [],
        youDo: []
    });
    const [pedagogyHours, setPedagogyHours] = useState<{
        iDo: { [activity: string]: number };
        weDo: { [activity: string]: number };
        youDo: { [activity: string]: number };
    }>({
        iDo: {},
        weDo: {},
        youDo: {}
    });
    const [editingExistingLevelData, setEditingExistingLevelData] = useState<any>(null);
    const [showUnmergeLevelDialog, setShowUnmergeLevelDialog] = useState(false);
    const [pendingLevelUnmerge, setPendingLevelUnmerge] = useState<{
        mergeIndex: number;
        levelData?: any;
    } | null>(null);
    const pedagogyMutation = useMutation({
        mutationFn: (data: any) => {
            if (pedagogyViews?.length) {
                return pedagogyViewApi.update(pedagogyViews[0]._id).mutationFn(data);
            } else {
                return pedagogyViewApi.create().mutationFn({
                    courses: data.courses,
                    pedagogies: data.pedagogies
                });
            }
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['pedagogyViews'] });
            await queryClient.refetchQueries({
                queryKey: ['pedagogyViews', selectedCourse?._id, modules.length]
            });
            setShowSuccessMessage(true);
            setTimeout(() => setShowSuccessMessage(false), 2000);
        }
    });
    const deletePedagogyMutation = useMutation({
        mutationFn: ({ activityType, itemId }: { activityType: string, itemId: string }) =>
            pedagogyViewApi.delete(activityType, itemId).mutationFn(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pedagogyViews'] });
            queryClient.invalidateQueries({ queryKey: ['courseStructure'] });
        }
    });
    const deleteDocumentMutation = useMutation({
        mutationFn: ({ model, id }: { model: 'Module1' | 'SubModule1' | 'Topic1' | 'SubTopic1' | 'PedagogyView1', id: any }) =>
            pedagogyViewApi.deleteDocument(model, id).mutationFn(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pedagogyViews'] });
        }
    });
    // Add to your component state
    const [draggingModuleId, setDraggingModuleId] = useState<string | null>(null);
    const [draggingSubModuleId, setDraggingSubModuleId] = useState<string | null>(null);
    const [draggingTopicId, setDraggingTopicId] = useState<string | null>(null);
    const [draggingSubtopicId, setDraggingSubtopicId] = useState<string | null>(null);
    const [selectedDuplicateCourse, setSelectedDuplicateCourse] = useState<Course | null>(null);

    const [selectedTopicForSubTopic, setSelectedTopicForSubTopic] = useState<{
        id: string | any;
        moduleId: string;
        subModuleId: string | any;
        name: string;
    } | null>(null);
    const [subTopicFormData, setSubTopicFormData] = useState<Omit<SubTopicCreateData, 'topicId' | 'courses'>>({
        title: '',
        description: '',
        level: 'Easy',
        duration: 0
    });
    const [moduleFormData, setModuleFormData] = useState<ModuleFormData>({
        title: '',
        description: '',
        level: 'Easy',
        duration: 0,
        index: 0
    });
    const [showDuplicatePopup, setShowDuplicatePopup] = useState(false);

    const [selectedModuleForSubModule, setSelectedModuleForSubModule] = useState<{ id: string, name: string } | null>(null);
    const [subModuleFormData, setSubModuleFormData] = useState<Omit<SubModuleCreateData, 'moduleId' | 'courseId'>>({
        title: '',
        description: '',
        level: 'Easy',
        duration: 0
    });
    const {
        data: subModules = [],
        isLoading: isSubModulesLoading,
        error: subModulesError,
        refetch: refetchSubModules
    } = useQuery({
        ...subModuleApi.getAll(),
        enabled: !!selectedCourse,
        select: (data) => {
            if (!selectedCourse) return [];
            return data.filter(subModule => subModule.courses.includes(selectedCourse._id));
        }
    });
    const createSubModuleMutation = useMutation(subModuleApi.create());
    const updateSubModuleMutation = useMutation(subModuleApi.update());
    const {
        data: topics = [],
        isLoading: isTopicsLoading,
        error: topicsError,
        refetch: refetchTopics
    } = useQuery({
        ...topicApi.getAll(),
        enabled: !!selectedCourse,
        select: (data) => {
            if (!selectedCourse) return [];
            return data.filter(topic => topic.courses.includes(selectedCourse._id));
        }
    });
    const {
        data: subTopics = [],
        isLoading: isSubTopicsLoading,
        error: subTopicsError,
        refetch: refetchSubTopics
    } = useQuery({
        ...subTopicApi.getAll(),
        enabled: !!selectedCourse,
        select: (data) => {
            if (!selectedCourse) return [];
            return data.filter(subTopic => subTopic.courses === selectedCourse._id);
        }
    });
    const hasModules = modules.length > 0;
    const hasTopics = topics.length > 0;
    const hasModuleHierarchy = selectedCourse?.courseHierarchy.includes('Module') || false;
    const hasTopicHierarchy = selectedCourse?.courseHierarchy.includes('Topic') || false;
    const [mergeSelectionMode, setMergeSelectionMode] = useState<'level' | 'pedagogy' | null>(null);
    const [selectedMergeCells, setSelectedMergeCells] = useState<Set<string>>(new Set());
    const [expandedModules, setExpandedModules] = useState(new Set());
    const [expandedSubModules, setExpandedSubModules] = useState(new Set());
    const [expandedTopics, setExpandedTopics] = useState(new Set());
    const showAddModuleFirst = hasModuleHierarchy && !hasModules;
    const showAddTopicFirst = hasTopicHierarchy && !hasTopics && !hasModuleHierarchy;
    const shouldDisableControls = showAddModuleFirst || showAddTopicFirst;
    const [addOnlyPedagogyLevel, setAddOnlyPedagogyLevel] = useState(false);
    let nameOfMessage = "";
    if (showAddModuleFirst) {
        nameOfMessage = "Module";
    } else if (showAddTopicFirst) {
        nameOfMessage = "Topic";
    }
    const hasSubModule2 = () => {
        const hierarchyLevels = selectedCourse?.courseHierarchy.map(level => level.toLowerCase()) || [];
        return hierarchyLevels.includes("sub module");
    };
    const getHeaderText = () => {
        if (dialogType === "submodule") {
            return selectedModuleForSubModule ? `Module: ${selectedModuleForSubModule.name}` : "Module";
        }
        if (dialogType === "topic") {
            let text = "";
            if (selectedSubModuleForTopic) {
                const parentModule = modules.find(m => m._id === selectedSubModuleForTopic.moduleId);
                text = parentModule ? `Module: ${parentModule.title} → ` : "";
                text += `Submodule: ${selectedSubModuleForTopic.name}`;
            }
            return text || (hasSubModule2() ? "Submodule" : "Module");
        }
        if (dialogType === "subtopic") {
            let text = "";
            if (selectedTopicForSubTopic) {
                // Get module
                const parentModule = modules.find(m => m._id === selectedTopicForSubTopic.moduleId);
                if (parentModule) {
                    text += `Module: ${parentModule.title} → `;
                }
                // Get submodule if exists
                if (selectedTopicForSubTopic.subModuleId) {
                    const parentSubModule = subModules.find(sm => sm._id === selectedTopicForSubTopic.subModuleId);
                    if (parentSubModule) {
                        text += `Submodule: ${parentSubModule.title} → `;
                    }
                }
                // Get topic
                const parentTopic = topics.find(t => t._id === selectedTopicForSubTopic.id);
                if (parentTopic) {
                    text += `Topic: ${parentTopic.title}`;
                }
            }
            return text || "Topic";
        }
        return "";
    };

    const createSubTopicMutation = useMutation(subTopicApi.create());
    const updateSubTopicMutation = useMutation(subTopicApi.update());
    const {
        data: topicSubTopics = [],
        refetch: refetchTopicSubTopics
    } = useQuery({
        ...subTopicApi.getByTopicId(selectedTopicForSubTopic?.id || ''),
        enabled: !!selectedTopicForSubTopic?.id
    });
    const createTopicMutation = useMutation(topicApi.create());
    const updateTopicMutation = useMutation(topicApi.update());
    const [isCreatingModule, setIsCreatingModule] = useState(false);
    const [isCreatingSubModule, setIsCreatingSubModule] = useState(false);
    const [isCreatingTopic, setIsCreatingTopic] = useState(false);
    const [isCreatingSubTopic, setIsCreatingSubTopic] = useState(false);
    const [isConfirmDelete, setIsConfirmDelete] = useState(false);
    const [isConfirmMultiDelete, setIsConfirmMultiDelete] = useState(false);
    const [isLevelSave, setIsLevelSave] = useState(false);
    const [isLevelMergeSave, setIsLevelMergeSave] = useState(false);
    const [isLevelUnmergeConfirm, setIsLevelUnmergeConfirm] = useState(false);
    const [isPedagogyDeleteConfirm, setIsPedagogyDeleteConfirm] = useState(false);
    const [isUnmergeConfirm, setIsUnmergeConfirm] = useState(false);
    const [isMergeConfirm, setIsMergeConfirm] = useState(false);
    const [showLevelDeleteConfirmation, setShowLevelDeleteConfirmation] = useState(false);
    const [isLevelDelete, setIsLevelDelete] = useState(false);
    const [levelToDelete, setLevelToDelete] = useState<{ id: string; level?: string; hierarchy: any } | null>(null);
    const [courseStructure, setCourseStructure] = useState<Modules[]>([]);
    const [selected, setSelected] = useState(selectedCourse?._id || "")
    const [showSummaryDialog, setShowSummaryDialog] = useState(false);
    const [showFullPreviewDialog, setShowFullPreviewDialog] = useState(false);
    const [showMainFullPreviewDialog, setShowMainFullPreviewDialog] = useState(false);
    const [showSuccessMessage, setShowSuccessMessage] = useState(false)
    const [mergedCells, setMergedCells] = useState<{ [key: string]: MergedCell[] }>({})
    const [showInstructions, setShowInstructions] = useState(false)
    const [showMergeDialog, setShowMergeDialog] = useState(false)
    const [mergeHours, setMergeHours] = useState<string>("")
    const [pendingMerge, setPendingMerge] = useState<{
        type: "iDo" | "weDo" | "youDo"
        activity: string
        selectedRows: number[]
        hierarchyIds?: {
            modules: string[]
            subModules: string[]
            topics: string[]
            subTopics: string[]
        }
    } | null>(null);
    const [showLevelSection, setShowLevelSection] = useState(false);
    const [showMergeLevelSection, setShowMergeLevelSection] = useState(false);
    const [selectedLevel, setSelectedLevel] = useState('');
    const [selectedPedagogyTypes, setSelectedPedagogyTypes] = useState<("iDo" | "weDo" | "youDo" | "all")[]>([]);
    const [showErrorDialog, setShowErrorDialog] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [showMultipleDeleteDialog, setShowMultipleDeleteDialog] = useState(false);
    const [deleteMode, setDeleteMode] = useState<{
        type: 'module' | 'submodule' | 'topic' | 'subtopic' | null;
        selectedItems: Set<string>;
    }>({
        type: null,
        selectedItems: new Set()
    });
    // Add to your state declarations
    const [hierarchicalDeleteMode, setHierarchicalDeleteMode] = useState<{
        parentType: 'module' | 'submodule' | 'topic';
        parentId: string;
        childType: 'submodule' | 'topic' | 'subtopic';
    } | null>(null);
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
    const showError = (message: string) => {
        setErrorMessage(message);
        setShowErrorDialog(true);
    };
    const [selectedDuplicateOptions, setSelectedDuplicateOptions] = useState<{
        hierarchy: ('Module' | 'SubModule' | 'Topic' | 'SubTopic')[];
    }>({
        hierarchy: [],
    });
    const [duplicateSelectionMode, setDuplicateSelectionMode] = useState<'all' | 'hierarchy'>('hierarchy');
    const duplicateCourseHierarchyMutation = useMutation({
        ...pedagogyViewApi.duplicateCourseHierarchy(),
        onSuccess: (data) => {
            console.log('Duplicate success:', data);
            setShowSuccessMessage(true);
            setTimeout(() => setShowSuccessMessage(false), 3000);
            queryClient.invalidateQueries({ queryKey: ['modules'] });
            queryClient.invalidateQueries({ queryKey: ['subModules'] });
            queryClient.invalidateQueries({ queryKey: ['topics'] });
            queryClient.invalidateQueries({ queryKey: ['subTopics'] });
            queryClient.invalidateQueries({ queryKey: ['pedagogyViews'] });
            queryClient.invalidateQueries({ queryKey: ['levelViews'] });
            setShowDuplicatePopup(false);
            setSelectedDuplicateCourse(null);
            setDuplicateChecked(false);
            setIsOpen(false);
            setSelectedDuplicateOptions({ hierarchy: [] });
        },
        onError: (error) => {
            console.error('Failed to duplicate course hierarchy:', error);
            showError("Failed to duplicate course structure");
            setDuplicateChecked(false);
            setIsOpen(false);
        }
    });
    const [selectedModuleToHighlight, setSelectedModuleToHighlight] = useState<string | null>(null);
    const [moduleSearchQuery, setModuleSearchQuery] = useState("");
    const {
        data: duplicateModules = [],
        isLoading: isDuplicateModulesLoading,
    } = useQuery({
        ...moduleApi.getAll(),
        enabled: !!selectedDuplicateCourse,
        select: (data) => {
            if (!selectedDuplicateCourse) return [];
            return data.filter(module => module.courses.includes(selectedDuplicateCourse._id));
        }
    });

    const {
        data: duplicateSubModules = [],
        isLoading: isDuplicateSubModulesLoading,
    } = useQuery({
        ...subModuleApi.getAll(),
        enabled: !!selectedDuplicateCourse,
        select: (data) => {
            if (!selectedDuplicateCourse) return [];
            return data.filter(subModule => subModule.courses.includes(selectedDuplicateCourse._id));
        }
    });
    const {
        data: duplicateTopics = [],
        isLoading: isDuplicateTopicsLoading,
    } = useQuery({
        ...topicApi.getAll(),
        enabled: !!selectedDuplicateCourse,
        select: (data) => {
            if (!selectedDuplicateCourse) return [];
            return data.filter(topic => topic.courses.includes(selectedDuplicateCourse._id));
        }
    });

    const {
        data: duplicateSubTopics = [],
        isLoading: isDuplicateSubTopicsLoading,
    } = useQuery({
        ...subTopicApi.getAll(),
        enabled: !!selectedDuplicateCourse,
        select: (data) => {
            if (!selectedDuplicateCourse) return [];
            return data.filter(subTopic => subTopic.courses === selectedDuplicateCourse._id);
        }
    });
    const [selectedLevelModulesForMerge, setSelectedLevelModulesForMerge] = useState<Set<string>>(new Set());
    const [selectedLevelSubModulesForMerge, setSelectedLevelSubModulesForMerge] = useState<Set<string>>(new Set());
    const [selectedLevelTopicsForMerge, setSelectedLevelTopicsForMerge] = useState<Set<string>>(new Set());
    const [selectedLevelSubTopicsForMerge, setSelectedLevelSubTopicsForMerge] = useState<Set<string>>(new Set());
    const [savedLevelMergeSelections, setSavedLevelMergeSelections] = useState<{
        modules: string[] | any[];
        subModules: string[] | any[];
        topics: string[] | any[];
        subTopics: string[] | any[];
    } | null>(null);
    const [savedPedagogyMergeSelections, setSavedPedagogyMergeSelections] = useState<{
        iDo: { [activity: string]: { modules: string[]; subModules: string[]; topics: string[]; subTopics: string[] } };
        weDo: { [activity: string]: { modules: string[]; subModules: string[]; topics: string[]; subTopics: string[] } };
        youDo: { [activity: string]: { modules: string[]; subModules: string[]; topics: string[]; subTopics: string[] } };
    }>({
        iDo: {},
        weDo: {},
        youDo: {}
    });
    const [selectedPedagogyModulesForMerge, setSelectedPedagogyModulesForMerge] = useState<{
        [activityType: string]: { [activity: string]: Set<string> };
    }>({});
    const [selectedPedagogySubModulesForMerge, setSelectedPedagogySubModulesForMerge] = useState<{
        [activityType: string]: { [activity: string]: Set<string> };
    }>({});
    const [selectedPedagogyTopicsForMerge, setSelectedPedagogyTopicsForMerge] = useState<{
        [activityType: string]: { [activity: string]: Set<string> };
    }>({});
    const [selectedPedagogySubTopicsForMerge, setSelectedPedagogySubTopicsForMerge] = useState<{
        [activityType: string]: { [activity: string]: Set<string> };
    }>({});
    const [showMergePedagogySection, setShowMergePedagogySection] = useState<{
        iDo: boolean;
        weDo: boolean;
        youDo: boolean;
    }>({ iDo: false, weDo: false, youDo: false });
    const [enableModuleSelection, setEnableModuleSelection] = useState(false);
    const [selectedModulesForDuplication, setSelectedModulesForDuplication] = useState<Set<string>>(new Set());
    const [currentMergeActivity, setCurrentMergeActivity] = useState<string>('');
    const [disableAddonlyMode, setDisableAddonlyMode] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [showCoursePreview, setShowCoursePreview] = useState(false);
    const [previewCourse, setPreviewCourse] = useState<Course | null>(null);
    const [showDuplicateConfirmation, setShowDuplicateConfirmation] = useState(false);
    const clearLevelMergeSelections = () => {
        setSavedLevelMergeSelections(null);
        setSelectedLevel('');
        setSelectedLevelModulesForMerge(new Set());
        setSelectedLevelSubModulesForMerge(new Set());
        setSelectedLevelTopicsForMerge(new Set());
        setSelectedLevelSubTopicsForMerge(new Set());
        setShowMergeLevelSection(false);
    };
    useEffect(() => {
        if (selectedCourse && !selectedCourse.testConfiguration) {
            toast.warning('This course does not have test configuration. Module creation is disabled.', {
                duration: 5000,
                position: 'top-right',
            });
        }
    }, [selectedCourse]);
    const clearPedagogyMergeSelections = (activityType?: "iDo" | "weDo" | "youDo", activity?: string) => {
        if (activityType && activity) {
            setSavedPedagogyMergeSelections(prev => ({
                ...prev,
                [activityType]: {
                    ...prev[activityType],
                    [activity]: undefined
                }
            }));
            setSelectedPedagogyModulesForMerge(prev => ({
                ...prev,
                [activityType]: {
                    ...prev[activityType],
                    [activity]: new Set()
                }
            }));
            setSelectedPedagogySubModulesForMerge(prev => ({
                ...prev,
                [activityType]: {
                    ...prev[activityType],
                    [activity]: new Set()
                }
            }));
            setSelectedPedagogyTopicsForMerge(prev => ({
                ...prev,
                [activityType]: {
                    ...prev[activityType],
                    [activity]: new Set()
                }
            }));
            setSelectedPedagogySubTopicsForMerge(prev => ({
                ...prev,
                [activityType]: {
                    ...prev[activityType],
                    [activity]: new Set()
                }
            }));
            setShowMergePedagogySection(prev => ({
                ...prev,
                [activityType]: false
            }));
        } else {
            setSavedPedagogyMergeSelections({ iDo: {}, weDo: {}, youDo: {} });
            setSelectedPedagogyModulesForMerge({});
            setSelectedPedagogySubModulesForMerge({});
            setSelectedPedagogyTopicsForMerge({});
            setSelectedPedagogySubTopicsForMerge({});
            setShowMergePedagogySection({ iDo: false, weDo: false, youDo: false });
        }
        setSelectedPedagogyActivities({
            iDo: [],
            weDo: [],
            youDo: []
        });
    };

    const [showPedagogyDialog, setShowPedagogyDialog] = useState(false);
    const [pedagogyFormData, setPedagogyFormData] = useState<{
        moduleId: string;
        topicId: string;
        subtopicId: string;
        subModuleId?: string;
        type: "iDo" | "weDo" | "youDo";
        activity: string;
        value: string;
        isEditing: boolean;
    } | null>(null);
    const [isNewLevel, setIsNewLevel] = useState(false);
    const [tableZoomLevel, setTableZoomLevel] = useState(1)
    const [isMoveModeActive, setIsMoveModeActive] = useState(false);
    const [editingLevel, setEditingLevel] = useState<{
        id?: string | null;
        level: string;
        hierarchy: {
            module?: string[];
            subModule?: string[];
            topic?: string[];
            subTopic?: string[];
        };
    } | null>(null);
    const [showLevelDialog, setShowLevelDialog] = useState(false);
    const { data: pedagogyViews, isLoading: isPedagogyLoading } = useQuery({
        ...pedagogyViewApi.getAll(),
        queryKey: ['pedagogyViews', selectedCourse?._id, modules.length],
        select: (data) => {
            if (!selectedCourse) return [];
            return data.filter(view => view.courses === selectedCourse._id);
        },
        enabled: !!token && !!selectedCourse && modules.length > 0,
    });
    const { data: levelViews } = useQuery(levelViewApi.getAll());
    const courseLevelView = useMemo(() => {
        if (!selectedCourse || !levelViews) return null;
        return levelViews.find((view: { courses: string; }) => view.courses === selectedCourse._id);
    }, [selectedCourse, levelViews]);
    const levelViewId = courseLevelView?._id || null;
    const levelsData = courseLevelView?.levels || [];
    const levelViewMutation = useMutation({
        mutationFn: (data: {
            courses: string;
            levels: Array<{
                module?: string[];
                subModule?: string[];
                topic?: string[];
                subTopic?: string[];
                level: string;
            }>;
        }) => {
            if (levelViewId) {
                return levelViewApi.update(levelViewId).mutationFn(data);
            } else {
                return levelViewApi.create().mutationFn(data);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['levelViews'] });
            setShowSuccessMessage(true);
            setTimeout(() => setShowSuccessMessage(false), 2000);
        }
    });
    const deleteLevelMutation = useMutation({
        mutationFn: (levelId: string) =>
            levelViewApi.delete(levelId).mutationFn(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['levelViews'] });
            setShowSuccessMessage(true);
            setTimeout(() => setShowSuccessMessage(false), 2000);
        }
    });
    const sortByIndex = (a: { index?: number }, b: { index?: number }) => {
        const aIndex = a.index ?? 0;
        const bIndex = b.index ?? 0;
        return aIndex - bIndex;
    };
    const sortedModules = useMemo(() => [...modules].sort(sortByIndex), [modules]);
    const sortedSubModules = useMemo(() => [...subModules].sort(sortByIndex), [subModules]);
    const sortedTopics = useMemo(() => [...topics].sort(sortByIndex), [topics]);
    const sortedSubTopics = useMemo(() => [...subTopics].sort(sortByIndex), [subTopics]);

    useEffect(() => {
        if (selected && courses.length > 0) {
            const course = courses.find((c: { _id: string; }) => c._id === selected);
            if (course) {
                setSelectedCourse(course);
                setCourseHours({});
                setMergedCells({});

            }
        }
    }, [selected, courses]);
    useEffect(() => {
        if (shouldDisableControls) {
            setActionsEnabled(false);
            setDirectActionsEnabled(false);
            setSelectedPedagogyTypes([]);
        }
    }, [shouldDisableControls]);
    // Resolve ?courseId= into the selected course. Course Setup links straight
    // here for a specific course, so failing to resolve it leaves the user on
    // "No course selected" with no way to tell what went wrong.
    //
    // The list is tried first, but it is not authoritative: it can still be
    // loading, and a course created moments ago may not be in the cached copy
    // yet. So a miss falls back to fetching that one course by id rather than
    // giving up — which is what made arriving from Course Setup fail.
    useEffect(() => {
        if (selectedCourse) return;
        const courseId = courseIdOverride || new URLSearchParams(window.location.search).get('courseId');
        if (!courseId) return;

        const fromList = courses.find((c: { _id: string }) => c._id === courseId);
        if (fromList) {
            setSelected(courseId);
            setSelectedCourse(fromList);
            return;
        }

        let cancelled = false;
        (async () => {
            try {
                const res = await fetchCourseStructureById(courseId);
                const course = res?.data?.data || res?.data;
                if (!cancelled && course && course._id) {
                    setSelected(courseId);
                    setSelectedCourse(course);
                }
            } catch {
                // Leave the empty state in place — a bad id is indistinguishable
                // from no id, and both mean "pick a course".
            }
        })();
        return () => { cancelled = true };
    }, [courses, selectedCourse, courseIdOverride]);

    useEffect(() => {
        if (!selectedCourse || !token) return;
        const fetchCourseData = async () => {
            try {
                await fetchModulesForCourse();
            } catch (error) {
                console.error("Failed to fetch course data:", error);
            }
        };

        fetchCourseData();
    }, [selectedCourse, token]);

    useEffect(() => {
        if (modules.length > 0 && selectedCourse) {
            const newStructure = modules.map(module => ({
                id: module._id,
                name: module.title,
                topics: [{
                    id: `${module._id}-default-topic`,
                    name: "Default Topic",
                    subtopics: subModules
                        .filter(sub => sub.moduleId === module._id)
                        .map(sub => ({
                            id: sub._id,
                            name: sub.title,
                            topics: topics
                                .filter(topic => topic.subModuleId === sub._id)
                                .map(topic => ({
                                    id: topic._id,
                                    name: topic.title
                                }))
                        }))
                }]
            }));

            setCourseStructure(newStructure as any);
            if ((pedagogyViews?.length ?? 0) > 0) {
                const { newCourseHours, newMergedCells } = processPedagogyData(pedagogyViews as any);
                setCourseHours(newCourseHours);
                setMergedCells(newMergedCells);
            } else {
                setCourseHours(prev => Object.keys(prev).length === 0 ? initializeCourseHours(modules as any) : prev);
            }
        } else {
            setCourseStructure([]);
            setCourseHours({});
        }
    }, [selectedCourse, pedagogyViews]);

    useEffect(() => {
        if ((pedagogyViews || Object.keys(savedPedagogyMergeSelections).length > 0) && modules.length > 0 && selectedCourse) {
            const { newCourseHours, newMergedCells } = processPedagogyData(pedagogyViews || []);
            setCourseHours(newCourseHours);
            setMergedCells(newMergedCells);
        }
    }, [pedagogyViews, savedPedagogyMergeSelections, modules.length, selectedCourse?._id]); // More specific dependencies

    useEffect(() => {
        const storedToken = getToken()
        setToken(storedToken)
    }, [])

    useEffect(() => {
        setExportSelections((prev: any) => ({
            ...prev,
            pedagogy: {
                iDo: selectedPedagogyTypes.includes("iDo") ? activityTypes["iDo"] : [],
                weDo: selectedPedagogyTypes.includes("weDo") ? activityTypes["weDo"] : [],
                youDo: selectedPedagogyTypes.includes("youDo") ? activityTypes["youDo"] : [],
            }
        }));
    }, [selectedPedagogyTypes]);
    useEffect(() => {
        const isOpen = showMergeLevelSection ||
            showMergePedagogySection.iDo ||
            showMergePedagogySection.weDo ||
            showMergePedagogySection.youDo;
        setIsMergeSectionOpen(isOpen);
    }, [showMergeLevelSection, showMergePedagogySection.iDo, showMergePedagogySection.weDo, showMergePedagogySection.youDo]);
    useEffect(() => {
        if (!actionsEnabled || directActionsEnabled) {
            setMovableCell(null);
            cancelSelection();
        }
    }, [actionsEnabled, directActionsEnabled]);

    const cancelSelection = () => {
        setSelectedMergeCells(new Set());
        setMergeSelectionMode(null);
        setIsSelectingCells(false);

    };
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isMoveModeActive && movableCell) {
                const target = event.target as HTMLElement;
                const isDraggableCell = target.closest('[draggable="true"]');
                if (!isDraggableCell) {
                    setMovableCell(null);
                    setIsMoveModeActive(false);
                }
            }
        };
        if (isMoveModeActive) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isMoveModeActive, movableCell]);
    useEffect(() => {
        if ((pedagogyViews || Object.keys(savedPedagogyMergeSelections).length > 0) && modules.length > 0 && selectedCourse) {
            const { newCourseHours, newMergedCells } = processPedagogyData(pedagogyViews || []);
            setCourseHours(newCourseHours);
            setMergedCells(newMergedCells);
        }
    }, [pedagogyViews, savedPedagogyMergeSelections]);
    useEffect(() => {
        if (selectedDuplicateOptions.hierarchy.length === 0) {
            setEnableModuleSelection(false);
        }
    }, [selectedDuplicateOptions]);
    const getWeDoActivities = (): string[] => {
        if (!selectedCourse?.We_Do) return [];
        if (Array.isArray(selectedCourse.We_Do)) {
            return selectedCourse.We_Do;
        }
        return Object.keys(selectedCourse.We_Do);
    };

    const activityTypes = {
        "iDo": selectedCourse?.I_Do || [],
        "weDo": getWeDoActivities(),
        "youDo": selectedCourse?.You_Do || [],
        "all": [...(selectedCourse?.I_Do || []), ...getWeDoActivities(), ...(selectedCourse?.You_Do || [])]
    }
    const [exportSelections, setExportSelections] = useState<ExportSelections | any>({
        printPedagogy: null,
        hierarchy: {
            module: true,
            subModule: true,
            topic: true,
            subTopic: true,
            level: true,
        },
        pedagogy: {
            iDo: selectedPedagogyTypes.includes("iDo") ? activityTypes["iDo"] : [],
            weDo: selectedPedagogyTypes.includes("weDo") ? activityTypes["weDo"] : [],
            youDo: selectedPedagogyTypes.includes("youDo") ? activityTypes["youDo"] : [],
        },
        showSummary: false,
    });

    const getAvailableDuplicateCourses = () => {
        if (!selectedCourse) return [];
        let filteredCourses = courses.filter((course: Course) => course._id !== selectedCourse._id);
        if (selectedCategory !== 'all') {
            filteredCourses = filteredCourses.filter((course: Course) =>
                course.category === selectedCategory
            );
        }
        if (duplicateSelectionMode === 'all') {
            return filteredCourses;
        } else {
            return filteredCourses.filter((course: Course) =>
                course.courseHierarchy.join(',') === selectedCourse.courseHierarchy.join(',')
            );
        }
    };
    const getAvailableCategories = () => {
        const categories = new Set<string>();
        categories.add('all'); // Add "all" option
        courses.forEach((course: Course) => {
            if (course.category && course._id !== selectedCourse?._id) {
                categories.add(course.category);
            }
        });
        return Array.from(categories);
    };
    const getCommonHierarchyLevels = (currentCourse: any, selectedCourse: any) => {
        const currentHierarchy = currentCourse.courseHierarchy.map((level: string) =>
            level === 'Sub Module' ? 'SubModule' : level === 'Sub Topic' ? 'SubTopic' : level
        );
        const selectedHierarchy = selectedCourse.courseHierarchy.map((level: string) =>
            level === 'Sub Module' ? 'SubModule' : level === 'Sub Topic' ? 'SubTopic' : level
        );
        const commonLevels = [];
        for (let i = 0; i < Math.min(currentHierarchy.length, selectedHierarchy.length); i++) {
            if (currentHierarchy[i] === selectedHierarchy[i]) {
                commonLevels.push(currentHierarchy[i]);
            } else {
                break;
            }
        }

        return commonLevels;
    };
    const handleDuplicateConfirm = async () => {
        if (!selectedDuplicateCourse || !selectedCourse) return;
        const institutionId = localStorage.getItem('smartcliff_institution');
        const createdBy = localStorage.getItem('smartcliff_userId'); // or however you store user ID
        const duplicateItems = [
            ...selectedDuplicateOptions.hierarchy
        ];
        if (duplicateItems.length === 0) {
            showError("Please select at least one item to duplicate");
            return;
        }
        const selectedModuleIds = enableModuleSelection && selectedModulesForDuplication.size > 0
            ? Array.from(selectedModulesForDuplication)
            : undefined;
        try {
            await duplicateCourseHierarchyMutation.mutateAsync({
                duplicateCourseId: selectedDuplicateCourse._id,
                newCourseId: selectedCourse._id,
                institutionId: institutionId || undefined,
                createdBy: createdBy || undefined,
                duplicate: duplicateItems,
                selectedModules: selectedModuleIds
            });
            setDuplicateSelectionMode('hierarchy');
            setEnableModuleSelection(false);
            setSelectedModulesForDuplication(new Set());
        } catch (error) {
            setErrorMessage(`error: ${error}`)
        }
    };
    const ModuleSelectionToggle = () => {
        const isToggleDisabled = selectedDuplicateOptions.hierarchy.length === 0;

        return (
            <div className={`flex items-center justify-between p-3 sm:p-2 border rounded-xl shadow-sm transition-all duration-300 ${isToggleDisabled
                ? "bg-gray-100 border-gray-300 cursor-not-allowed"
                : "bg-gradient-to-r from-[#FFF3EA] via-white to-pink-50 border-gray-200 hover:shadow-md"
                }`}>
                {/* Left Icon + Text */}
                <div className="flex items-center gap-3">
                    <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm ${enableModuleSelection
                            ? "bg-gradient-to-r from-green-400 to-emerald-500 text-white"
                            : isToggleDisabled
                                ? "bg-gray-300 text-gray-400"
                                : "bg-gray-200 text-gray-500"
                            }`}
                    >
                        <CheckSquare className="w-4 h-4" />
                    </div>
                    <div className="leading-tight">
                        <label
                            htmlFor="module-selection"
                            className={`text-sm font-semibold ${isToggleDisabled ? "text-gray-500 cursor-not-allowed" : "text-gray-800 cursor-pointer"
                                }`}
                        >
                            Select module rows to duplicate
                        </label>
                        <p className={`text-xs ${isToggleDisabled ? "text-gray-400" : "text-gray-500"
                            }`}>
                            {isToggleDisabled
                                ? "Select hierarchy levels first to enable module selection"
                                : "Toggle to choose specific hierarchy rows"
                            }
                        </p>
                    </div>
                </div>
                {/* Compact Gradient Toggle */}
                <button
                    type="button"
                    disabled={isToggleDisabled}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 ${isToggleDisabled
                        ? "bg-gray-300 cursor-not-allowed"
                        : enableModuleSelection
                            ? "bg-gradient-to-r from-green-400 to-emerald-500 focus:ring-green-400"
                            : "bg-gray-300 focus:ring-[#FB923C]"
                        }`}
                    role="switch"
                    aria-checked={enableModuleSelection}
                    aria-disabled={isToggleDisabled}
                    onClick={() => {
                        if (!isToggleDisabled) {
                            const newValue = !enableModuleSelection;
                            setEnableModuleSelection(newValue);
                            if (!newValue) {
                                setSelectedModulesForDuplication(new Set()); // Clear selection
                            }
                        }
                    }}
                >
                    <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-300 ease-in-out ${enableModuleSelection ? "translate-x-5" : "translate-x-0"
                            } ${isToggleDisabled ? "opacity-60" : ""}`}
                    />
                </button>
            </div>
        );
    };

    const SearchableCourseSelect = ({
        courses,
        selectedCourse,
        onCourseSelect,
        placeholder = "Search courses..."
    }: {
        courses: Course[];
        selectedCourse: Course | null;
        onCourseSelect: (course: Course | null) => void;
        placeholder?: string;
    }) => {
        const [searchQuery, setSearchQuery] = useState("");
        const [isOpen, setIsOpen] = useState(false);
        const filteredCourses = useMemo(() => {
            if (!searchQuery.trim()) return courses;
            const query = searchQuery.toLowerCase();
            return courses.filter(course =>
                course.courseName.toLowerCase().includes(query) ||
                (course.category && course.category.toLowerCase().includes(query)) ||
                course.courseHierarchy.some(level => level.toLowerCase().includes(query))
            );
        }, [courses, searchQuery]);

        const handleCourseSelect = (course: Course) => {
            onCourseSelect(course);
            setIsOpen(false);
            setSearchQuery("");
        };

        const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            setSearchQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
        };

        const handleInputFocus = () => {
            setIsOpen(true);
        };

        const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
            if (e.key === 'Enter' && filteredCourses.length > 0) {
                handleCourseSelect(filteredCourses[0]);
            }
        };

        return (
            <div className="relative flex-1">
                {/* Input Field */}
                <div className="relative">
                    <input
                        type="text"
                        value={isOpen ? searchQuery : (selectedCourse?.courseName || "")}
                        onChange={handleInputChange}
                        onFocus={handleInputFocus}
                        onKeyDown={handleInputKeyDown}
                        placeholder={placeholder}
                        className="w-full h-9 px-3 py-2 bg-gray-50 border text-xs border-gray-300 rounded-md focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] transition-colors"
                    />
                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery("")}
                                className="p-1 hover:bg-gray-200 rounded cursor-pointer transition-colors"
                            >
                                <X className="w-3 h-3 text-gray-500" />
                            </button>
                        )}
                        <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                    </div>
                </div>

                {/* Dropdown Menu */}
                {isOpen && (
                    <>
                        <div
                            className="fixed inset-0 z-40"
                            onClick={() => setIsOpen(false)}
                        />
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                            {filteredCourses.length === 0 ? (
                                <div className="px-3 py-2 text-sm text-gray-500">
                                    No courses found matching "{searchQuery}"
                                </div>
                            ) : (
                                <div className="py-1">
                                    {filteredCourses.map((course) => (
                                        <div
                                            key={course._id}
                                            onClick={() => handleCourseSelect(course)}
                                            className={`px-3 py-2 text-sm cursor-pointer transition-colors hover:bg-[#FFF3EA] ${selectedCourse?._id === course._id ? 'bg-[#FFE4D0]' : ''
                                                }`}
                                        >
                                            <div className="font-medium text-xs text-gray-900">
                                                {course.courseName}
                                            </div>
                                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                                                <span>Hierarchy: {course.courseHierarchy.join(' → ')}</span>
                                                {course.category && (
                                                    <span className="bg-gray-100 px-1.5 text-[10px] rounded">
                                                        {course.category}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        );
    };

    const getHierarchyOrder = () => {
        const hierarchyMap: any = {
            'Module': 0,
            'SubModule': 1,
            'Topic': 2,
            'SubTopic': 3
        };

        return selectedCourse?.courseHierarchy
            .map(level => level === 'Sub Module' ? 'SubModule' :
                level === 'Sub Topic' ? 'SubTopic' : level)
            .sort((a, b) => (hierarchyMap[a] || 0) - (hierarchyMap[b] || 0)) || [];
    };
    const isHierarchyLevelEnabled = (level: string) => {
        if (!selectedDuplicateCourse) return false;

        const commonLevels = getCommonHierarchyLevels(selectedCourse, selectedDuplicateCourse);
        const currentIndex = commonLevels.indexOf(level);
        if (currentIndex === 0) return true;
        for (let i = 0; i < currentIndex; i++) {
            if (!selectedDuplicateOptions.hierarchy.includes(commonLevels[i])) {
                return false;
            }
        }
        return true;
    };

    // 2. Replace your existing handleSelectAllHierarchy function with this:
    const handleSelectAllHierarchy = (checked: boolean) => {
        if (checked && selectedDuplicateCourse) {
            const commonLevels = getCommonHierarchyLevels(selectedCourse, selectedDuplicateCourse);
            setSelectedDuplicateOptions(prev => ({
                ...prev,
                hierarchy: commonLevels
            }));
        } else {
            setSelectedDuplicateOptions(prev => ({
                ...prev,
                hierarchy: []
            }));
        }
    };

    const handleHierarchyCheckboxChange = (checkboxValue: any, checked: string | boolean) => {
        const hierarchyOrder = getHierarchyOrder();
        const currentIndex = hierarchyOrder.indexOf(checkboxValue);

        if (checked) {
            setSelectedDuplicateOptions(prev => ({
                ...prev,
                hierarchy: [...prev.hierarchy, checkboxValue]
            }));
        } else {
            const itemsToRemove = hierarchyOrder.slice(currentIndex);
            setSelectedDuplicateOptions(prev => ({
                ...prev,
                hierarchy: prev.hierarchy.filter(item => !itemsToRemove.includes(item))
            }));
        }
    };

    const fetchModulesForCourse = async () => {
        if (!selectedCourse) return;
        await refetchModules();
    };
    const initializeCourseHours = (modules: Modules[]) => {
        const initialHours: CourseHours = {};
        const hierarchyLevels = selectedCourse?.courseHierarchy.map(l => l.toLowerCase()) || [];
        const hasSubModules = hierarchyLevels.includes('sub module');

        modules.forEach((module) => {
            initialHours[module.id] = initialHours[module.id] || {};

            // Find all submodules for this module
            const moduleSubModules = hasSubModules
                ? subModules.filter(sub => sub.moduleId === module.id)
                : [];

            if (hasSubModules && moduleSubModules.length > 0) {
                // Use actual submodules
                moduleSubModules.forEach((subModule) => {
                    const topicId = `${module.id}-default-topic`;
                    const subtopicId = subModule._id;

                    initialHours[module.id][topicId] = initialHours[module.id][topicId] || {};
                    initialHours[module.id][topicId][subtopicId] = {
                        "iDo": {
                            Lecture: 0,
                            Demonstration: 0,
                            "Video Tutorial": 0,
                            "Live Coding": 0,
                            Presentation: 0,
                            ...(selectedCourse?.I_Do?.reduce((acc, activity) => {
                                acc[activity] = 0;
                                return acc;
                            }, {} as Record<string, number>) || {})
                        },
                        "weDo": {
                            "Interactive Session": 0,
                            "Guided Workshop": 0,
                            "Group Discussion": 0,
                            "Collaborative Coding": 0,
                            "Q&A Session": 0,
                            ...(getWeDoActivities()?.reduce((acc: Record<string, number>, activity: string) => {
                                acc[activity] = 0;
                                return acc;
                            }, {}) || {})
                        },
                        "youDo": {
                            Assignment: 0,
                            Quiz: 0,
                            Project: 0,
                            Assessment: 0,
                            "Practice Exercise": 0,
                            "Lab Work": 0,
                            ...(selectedCourse?.You_Do?.reduce((acc, activity) => {
                                acc[activity] = 0;
                                return acc;
                            }, {} as Record<string, number>) || {})
                        }
                    };
                });
            } else {
                // Fallback to default subtopic
                const topicId = `${module.id}-default-topic`;
                const subtopicId = `${module.id}-default-subtopic`;

                initialHours[module.id][topicId] = initialHours[module.id][topicId] || {};
                initialHours[module.id][topicId][subtopicId] = {
                    "iDo": {
                        Lecture: 0,
                        Demonstration: 0,
                        "Video Tutorial": 0,
                        "Live Coding": 0,
                        Presentation: 0,
                        ...(selectedCourse?.I_Do?.reduce((acc, activity) => {
                            acc[activity] = 0;
                            return acc;
                        }, {} as Record<string, number>) || {})
                    },
                    "weDo": {
                        "Interactive Session": 0,
                        "Guided Workshop": 0,
                        "Group Discussion": 0,
                        "Collaborative Coding": 0,
                        "Q&A Session": 0,
                        ...(getWeDoActivities()?.reduce((acc: Record<string, number>, activity: string) => {
                            acc[activity] = 0;
                            return acc;
                        }, {} as Record<string, number>) || {})
                    },
                    "youDo": {
                        Assignment: 0,
                        Quiz: 0,
                        Project: 0,
                        Assessment: 0,
                        "Practice Exercise": 0,
                        "Lab Work": 0,
                        ...(selectedCourse?.You_Do?.reduce((acc, activity) => {
                            acc[activity] = 0;
                            return acc;
                        }, {} as Record<string, number>) || {})
                    }
                };
            }
        });

        return initialHours;
    };
    const [courseHours, setCourseHours] = useState<CourseHours>(initializeCourseHours([]));

    const createDuplicateTableRows = () => createDuplicateTableRowsImpl({ duplicateModules, duplicateSubModules, duplicateSubTopics, duplicateTopics, selectedDuplicateCourse })

    const getDuplicateSpans = () => {
        const moduleSpans: { [key: string]: number } = {};
        const subModuleSpans: { [key: string]: number } = {};
        const topicSpans: { [key: string]: number } = {};
        const subtopicSpans: { [key: string]: number } = {};

        const hasSubModules = selectedDuplicateCourse?.courseHierarchy.includes('Sub Module') || false;
        const hasTopics = selectedDuplicateCourse?.courseHierarchy.includes('Topic') || false;
        const hasSubTopics = selectedDuplicateCourse?.courseHierarchy.includes('Sub Topic') || false;

        duplicateModules.forEach((module) => {
            let moduleRowCount = 0;
            const moduleSubModules = duplicateSubModules.filter(sub => sub.moduleId === module._id);

            if (hasSubModules && moduleSubModules.length > 0) {
                moduleSubModules.forEach((subModule) => {
                    let subModuleRowCount = 0;
                    const subModuleTopics = duplicateTopics.filter(topic => topic.subModuleId === subModule._id);

                    if (hasTopics && subModuleTopics.length > 0) {
                        subModuleTopics.forEach(topic => {
                            const topicSubTopics = hasSubTopics
                                ? duplicateSubTopics.filter(subTopic => subTopic.topicId === topic._id)
                                : [];
                            const topicRowCount = hasSubTopics && topicSubTopics.length > 0
                                ? topicSubTopics.length
                                : 1;

                            if (hasSubTopics) {
                                subtopicSpans[topic._id] = topicRowCount;
                            }
                            topicSpans[topic._id] = topicRowCount;
                            subModuleRowCount += topicRowCount;
                        });
                    } else {
                        subModuleRowCount = 1;
                    }

                    subModuleSpans[subModule._id] = subModuleRowCount;
                    moduleRowCount += subModuleRowCount;
                });
            } else {
                // No submodules in hierarchy or no submodules exist
                const moduleTopics = duplicateTopics.filter(topic => topic.moduleId === module._id);

                if (hasTopics && moduleTopics.length > 0) {
                    moduleTopics.forEach(topic => {
                        const topicSubTopics = hasSubTopics
                            ? duplicateSubTopics.filter(subTopic => subTopic.topicId === topic._id)
                            : [];
                        const topicRowCount = hasSubTopics && topicSubTopics.length > 0
                            ? topicSubTopics.length
                            : 1;

                        if (hasSubTopics) {
                            subtopicSpans[topic._id] = topicRowCount;
                        }
                        topicSpans[topic._id] = topicRowCount;
                        moduleRowCount += topicRowCount;
                    });
                } else {
                    moduleRowCount = 1;
                }
            }

            moduleSpans[module._id] = moduleRowCount;
        });

        return {
            moduleSpans,
            subModuleSpans: hasSubModules ? subModuleSpans : {},
            topicSpans: hasTopics ? topicSpans : {},
            subtopicSpans: hasSubTopics ? subtopicSpans : {}
        };
    };

    const handleClosePopup = () => {
        setShowDuplicatePopup(false);
        setSelectedDuplicateCourse(null);
        setDuplicateChecked(false);
        setIsOpen(false);
        setSelectedDuplicateOptions({ hierarchy: [] });
        setEnableModuleSelection(false); // Reset module selection toggle
        setSelectedModulesForDuplication(new Set()); // Clear selected modules
        setDuplicateSelectionMode('hierarchy');
        setSelectedCategory('all');
        setShowCoursePreview(false); // Close preview popup if open
        setPreviewCourse(null);
        setShowDuplicateConfirmation(false);
        setEnableModuleSelection(false);
    };

    const processPedagogyData = (pedagogyViews: any[]) => processPedagogyDataImpl(pedagogyViews, { getAffectedRowIds, initializeCourseHours, modules, pedagogyViews, selectedCourse, subModules, subTopics, tableRows, topics })
    const getAffectedRowIds = (
        modules: string[],
        subModules: string[],
        topics: string[],
        subTopics: string[]
    ) => {
        const rowIds = new Set<string>();

        // For each row, check if it matches the hierarchical pattern
        tableRows.forEach(row => {
            let matches = false;

            // Check module level first
            if (modules.length > 0 && !modules.includes(row.moduleId)) {
                return; // Skip if module doesn't match
            }

            // Check submodule level with hierarchical logic
            if (subModules.length > 0) {
                // If row has a submodule, it must match one of the specified submodules
                if (row.subModuleId && !row.subModuleId.includes('placeholder')) {
                    if (!subModules.includes(row.subModuleId)) {
                        return; // Submodule doesn't match
                    }
                }
                // If row has no submodule (module-level row), it's still valid
            } else {
                // If no submodules specified but row has a real submodule, skip
                if (row.subModuleId && !row.subModuleId.includes('placeholder')) {
                    return;
                }
            }

            // Check topic level with hierarchical logic
            if (topics.length > 0) {
                // If row has a topic, it must match one of the specified topics
                if (row.topicId && !row.topicId.includes('placeholder')) {
                    if (!topics.includes(row.topicId)) {
                        return; // Topic doesn't match
                    }
                }
                // If row has no topic (module/submodule-level row), it's still valid
            } else {
                // If no topics specified but row has a real topic, skip
                if (row.topicId && !row.topicId.includes('placeholder')) {
                    return;
                }
            }

            // Check subtopic level with hierarchical logic
            if (subTopics.length > 0) {
                // If row has a subtopic, it must match one of the specified subtopics
                if (row.subtopicId && !row.subtopicId.includes('placeholder')) {
                    if (!subTopics.includes(row.subtopicId)) {
                        return; // Subtopic doesn't match
                    }
                }
                // If row has no subtopic (higher-level row), it's still valid
            } else {
                // If no subtopics specified but row has a real subtopic, skip
                if (row.subtopicId && !row.subtopicId.includes('placeholder')) {
                    return;
                }
            }

            // If we reached here, the row matches the hierarchical pattern
            rowIds.add(row.rowId);
        });

        return Array.from(rowIds);
    };
    // Helper function to toggle expansion state
    const toggleExpansion = (id: unknown, expandedSet: Iterable<unknown> | null | undefined, setExpandedSet: { (value: React.SetStateAction<Set<unknown>>): void; (value: React.SetStateAction<Set<unknown>>): void; (value: React.SetStateAction<Set<unknown>>): void; (value: React.SetStateAction<Set<unknown>>): void; (value: React.SetStateAction<Set<unknown>>): void; (value: React.SetStateAction<Set<unknown>>): void; (value: React.SetStateAction<Set<unknown>>): void; (arg0: Set<unknown>): void; }) => {
        const newSet = new Set(expandedSet);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setExpandedSet(newSet);
    };
    // Normalize testConfiguration from backend (handles both flat and legacy nested formats)
    const getCourseSkillSet = () => {
        const tc = selectedCourse?.testConfiguration;
        if (!tc) return { coreProgram: [], frontend: [], database: [] };
        if (Array.isArray(tc.coreProgram) || Array.isArray(tc.frontend) || Array.isArray(tc.database)) {
            return { coreProgram: tc.coreProgram || [], frontend: tc.frontend || [], database: tc.database || [] };
        }
        // Legacy nested format
        const languages = tc?.programming?.languages || {};
        return { coreProgram: languages.coreProgram || [], frontend: languages.frontend || [], database: languages.database || [] };
    };

    const isLastHierarchy = () => {
        if (!selectedCourse || !dialogType) return false;

        // Normalize hierarchy (all lowercase, no spaces)
        const hierarchyLevels = selectedCourse.courseHierarchy.map(level =>
            level.toLowerCase().replace(/\s+/g, "")
        );

        // Normalize current dialog type
        const currentLevel = dialogType.toLowerCase().replace(/\s+/g, "");

        const currentLevelIndex = hierarchyLevels.findIndex(level => level === currentLevel);

        if (currentLevelIndex === -1) return false;

        // It's the last if its index is the last one in the hierarchy array
        return currentLevelIndex === hierarchyLevels.length - 1;
    };
    const isLastHierarchy2 = (dialogType2: any) => {
        if (!selectedCourse || !dialogType2) return false;

        // Normalize hierarchy (all lowercase, no spaces)
        const hierarchyLevels = selectedCourse.courseHierarchy.map(level =>
            level.toLowerCase().replace(/\s+/g, "")
        );

        // Normalize current dialog type
        const currentLevel = dialogType2.toLowerCase().replace(/\s+/g, "");

        const currentLevelIndex = hierarchyLevels.findIndex(level => level === currentLevel);

        if (currentLevelIndex === -1) return false;

        // It's the last if its index is the last one in the hierarchy array
        return currentLevelIndex === hierarchyLevels.length - 1;
    };

    const filterPlaceholders2 = (id: string | null): string | null => {
        if (id && id.includes("placeholder")) {
            return null;
        }
        return id;
    };

    // Add these helper functions near your other utility functions

    const doesParentHaveOtherChildren = (dialogType: string | null, editMode: any) => {
        if (!dialogType || editMode) return false;

        switch (dialogType) {
            case 'module':
                return true;
            case 'submodule':
                // Check if the parent module has other submodules
                const parentModuleId = selectedModuleForSubModule?.id;
                if (!parentModuleId) return false;
                const otherSubModules = subModules.filter(sm =>
                    sm.moduleId === parentModuleId && sm._id !== (editMode?.data?._id)
                );
                return otherSubModules.length > 0;

            case 'topic':
                // Check if the parent (submodule or module) has other topics
                const parentId = selectedSubModuleForTopic?.id;
                if (!parentId) return false;

                if (hasSubModule2()) {
                    // Parent is submodule
                    const otherTopics = topics.filter(t =>
                        t.subModuleId === parentId && t._id !== (editMode?.data?._id)
                    );
                    return otherTopics.length > 0;
                } else {
                    // Parent is module
                    const otherTopics = topics.filter(t =>
                        t.moduleId === parentId && t._id !== (editMode?.data?._id)
                    );
                    return otherTopics.length > 0;
                }

            case 'subtopic':
                // Check if the parent topic has other subtopics
                const parentTopicId = selectedTopicForSubTopic?.id;
                if (!parentTopicId) return false;
                const otherSubTopics = subTopics.filter(st =>
                    st.topicId === parentTopicId && st._id !== (editMode?.data?._id)
                );
                return otherSubTopics.length > 0;

            default:
                return false;
        }
    };
    // Add this helper function to check if any pedagogy has hours > 0
    const hasPedagogyHoursGreaterThanZero = () => {
        // Check I Do activities
        const iDoHasHours = Object.values(pedagogyHours.iDo).some(hours => hours > 0);

        // Check We Do activities
        const weDoHasHours = Object.values(pedagogyHours.weDo).some(hours => hours > 0);

        // Check You Do activities
        const youDoHasHours = Object.values(pedagogyHours.youDo).some(hours => hours > 0);

        return iDoHasHours || weDoHasHours || youDoHasHours;
    };
    // Combined function to determine if toggle should be shown
    const shouldShowPedagogyLevelToggle = (dialogType: string | null, editMode: any) => {
        if (!isLastHierarchy()) return false;
        if (editMode) return false;

        // Check if parent has other children
        const parentHasOtherChildren = doesParentHaveOtherChildren(dialogType, editMode);

        // Only show toggle if parent has NO other children (this is the first child)
        return !parentHasOtherChildren;
    };

    const getStickyLeftPosition = (index: number) => {
        return `${120 * index}px`
    }
    const hierarchyLevelsCount = selectedCourse?.courseHierarchy.length || 0;
    const hierarchyWidthPercentage = selectedPedagogyTypes.length > 0
        ? 55 / hierarchyLevelsCount // Distribute 60% among hierarchy levels
        : undefined; // Auto width when no pedagogy selected

    const createTableRows = () => createTableRowsImpl({ modules, selectedCourse, subModules, subTopics, topics })
    const tableRows = createTableRows()
    useEffect(() => {
        if (scaledContentRef.current) {
            const measureHeight = () => {
                const height = scaledContentRef.current!.scrollHeight;
                setContentHeight(height);
            };

            measureHeight();

            // Re-measure when content changes
            const resizeObserver = new ResizeObserver(measureHeight);
            resizeObserver.observe(scaledContentRef.current);

            return () => resizeObserver.disconnect();
        }
    }, [selectedCourse, tableRows, selectedPedagogyTypes]);
    const calculateNegativeMargin = () => {
        if (!contentHeight || tableZoomLevel >= 1) return 0;

        // Calculate the actual height difference after scaling
        const scaledHeight = contentHeight * tableZoomLevel;
        const heightDifference = contentHeight - scaledHeight;

        return -heightDifference;
    };
    const handleCellClick = (
        moduleId: string,
        topicId: string,
        subtopicId: string,
        type: "iDo" | "weDo" | "youDo",
        activity: string,
        subModuleId?: string
    ) => {
        const hierarchyLevels = selectedCourse?.courseHierarchy.map(l => l.toLowerCase()) || [];

        // Get the actual value from courseHours using the provided IDs
        const effectiveTopicId = topicId || `${moduleId}-default-topic`;
        const effectiveSubtopicId = subtopicId ||
            (topicId ? `${topicId}-default-subtopic` : `${moduleId}-default-subtopic`);

        const value = courseHours[moduleId]?.[effectiveTopicId]?.[effectiveSubtopicId]?.[type]?.[activity] || 0;
        const isEditing = value > 0;
        // Set up the form data for the popup
        setPedagogyFormData({
            moduleId,
            topicId: effectiveTopicId,
            subtopicId: effectiveSubtopicId,
            type,
            activity,
            value: value.toString(),
            isEditing,
            ...(hierarchyLevels.includes('sub module') && { subModuleId })
        });

        // Open the popup dialog
        setShowPedagogyDialog(true);
    };
    const handlePedagogySave = async () => {
        if (!pedagogyFormData || !selectedCourse) return;

        const value = Number.parseFloat(pedagogyFormData.value) || 0;
        const { moduleId, topicId, subtopicId, type, activity, subModuleId } = pedagogyFormData;
        if (value <= 0) {
            setErrorMessage("Hours value must be greater than 0");
            setShowErrorDialog(true);
            return;
        }
        // Update local state
        setCourseHours(prev => ({
            ...prev,
            [moduleId]: {
                ...prev[moduleId],
                [topicId]: {
                    ...prev[moduleId]?.[topicId],
                    [subtopicId]: {
                        ...prev[moduleId]?.[topicId]?.[subtopicId],
                        [type]: {
                            ...prev[moduleId]?.[topicId]?.[subtopicId]?.[type],
                            [activity]: value,
                        },
                    },
                },
            },
        }));

        // Prepare payload for API call
        const hierarchyLevels = selectedCourse.courseHierarchy.map(level => level.toLowerCase());

        // Helper function to filter out empty strings and undefined values
        const filterPlaceholders = (id: string | undefined) => {
            return id && !id.includes('placeholder') ? [id] : [];
        };

        const pedagogyData = {
            iDo: type === "iDo" ? [{ type: activity, duration: value }] : [],
            weDo: type === "weDo" ? [{ type: activity, duration: value }] : [],
            youDo: type === "youDo" ? [{ type: activity, duration: value }] : [],
            ...(hierarchyLevels.includes('module') && { module: filterPlaceholders(moduleId) }),
            ...(hierarchyLevels.includes('sub module') && { subModule: filterPlaceholders(subModuleId) }),
            ...(hierarchyLevels.includes('topic') && { topic: filterPlaceholders(topicId) }),
            ...(hierarchyLevels.includes('sub topic') && { subTopic: filterPlaceholders(subtopicId) }),
        };

        try {
            // API call to save the data
            await pedagogyMutation.mutateAsync({
                courses: selectedCourse._id,
                pedagogies: pedagogyViews?.[0]?.pedagogies
                    ? [...pedagogyViews[0].pedagogies, pedagogyData]
                    : [pedagogyData],
            });

            setShowSuccessMessage(true);
            setTimeout(() => setShowSuccessMessage(false), 2000);
        } catch (error) {
            console.error("Failed to save pedagogy:", error);
            // Revert optimistic update on error
            setCourseHours(prev => ({ ...prev }));
        } finally {
            setShowPedagogyDialog(false);
            setPedagogyFormData(null);
        }
    };
    const resetAllFormStates = () => {
        // Reset form data
        setModuleFormData({ title: '', description: '', level: 'Easy', duration: 0, index: 0 });
        setSubModuleFormData({ title: '', description: '', level: 'Easy', duration: 0 });
        setTopicFormData({ title: '', description: '', level: 'Easy', duration: 0 });
        setSubTopicFormData({ title: '', description: '', level: 'Easy', duration: 0 });
        // Only reset skill set configuration if NOT in edit mode
        if (!editMode) {
            setModuleTestConfig({ coreProgram: [], frontend: [], database: [] });
        }

        setAddOnlyPedagogyLevel(false);
        // Reset level and pedagogy sections
        setShowLevelSection(false);
        setShowPedagogySection(false);
        setShowMergeLevelSection(false);
        setShowMergePedagogySection({
            iDo: false,
            weDo: false,
            youDo: false
        });
        setSelectedLevelModulesForMerge(new Set());
        setSelectedLevelSubModulesForMerge(new Set());
        setSelectedLevelTopicsForMerge(new Set());
        setSelectedLevelSubTopicsForMerge(new Set());

        setSelectedPedagogyModulesForMerge({});
        setSelectedPedagogySubModulesForMerge({});
        setSelectedPedagogyTopicsForMerge({});
        setSelectedPedagogySubTopicsForMerge({});
        // Reset pedagogy activities and hours
        setSelectedPedagogyActivities({
            iDo: [],
            weDo: [],
            youDo: []
        });
        setPedagogyHours({
            iDo: {},
            weDo: {},
            youDo: {}
        });

        // Reset saved merge selections
        setSavedLevelMergeSelections(null);
        setSavedPedagogyMergeSelections({
            iDo: {},
            weDo: {},
            youDo: {}
        });

        // Reset expanded states
        setExpandedModules(new Set());
        setExpandedSubModules(new Set());
        setExpandedTopics(new Set());

        // Reset selected level
        setSelectedLevel('');
        setDisableAddonlyMode(false);
        // Reset dialog and edit mode
        setDialogType(null);
        // Don't reset editMode here if we're in the middle of editing
    };

    const isFirstChild = (dialogType: string | null, editMode: any) => {
        if (!dialogType || editMode) return false;

        switch (dialogType) {
            case 'module':
                // Always first child for modules since they're top-level
                return modules.length === 0;

            case 'submodule':
                // Check if parent module has other submodules
                const parentModuleId = selectedModuleForSubModule?.id;
                if (!parentModuleId) return false;
                const otherSubModules = subModules.filter(sm =>
                    sm.moduleId === parentModuleId && sm._id !== (editMode?.data?._id)
                );
                return otherSubModules.length === 0;

            case 'topic':
                // Check if parent (submodule or module) has other topics
                const parentId = selectedSubModuleForTopic?.id;
                if (!parentId) return false;

                if (hasSubModule2()) {
                    // Parent is submodule
                    const otherTopics = topics.filter(t =>
                        t.subModuleId === parentId && t._id !== (editMode?.data?._id)
                    );
                    return otherTopics.length === 0;
                } else {
                    // Parent is module
                    const otherTopics = topics.filter(t =>
                        t.moduleId === parentId && t._id !== (editMode?.data?._id)
                    );
                    return otherTopics.length === 0;
                }

            case 'subtopic':
                // Check if parent topic has other subtopics
                const parentTopicId = selectedTopicForSubTopic?.id;
                if (!parentTopicId) return false;
                const otherSubTopics = subTopics.filter(st =>
                    st.topicId === parentTopicId && st._id !== (editMode?.data?._id)
                );
                return otherSubTopics.length === 0;

            default:
                return false;
        }
    };

    // Add this function to get the last child ID of a parent
    const getLastChildId = (parentId: string, type: 'module' | 'submodule' | 'topic' | 'subtopic') => {
        switch (type) {
            case 'module':
                // For module, get the last subtopic under it
                const moduleSubModules = subModules.filter(sm => sm.moduleId === parentId);
                let lastSubtopicId = null;

                // Get all subtopics in this module and find the last one
                const allModuleSubTopics: any[] = [];

                for (const subModule of moduleSubModules) {
                    const subModuleTopics = topics.filter(t => t.subModuleId === subModule._id);
                    for (const topic of subModuleTopics) {
                        const topicSubTopics = subTopics.filter(st => st.topicId === topic._id);
                        allModuleSubTopics.push(...topicSubTopics);
                    }
                }

                // Sort by index to get the actual last child
                if (allModuleSubTopics.length > 0) {
                    const sortedSubTopics = [...allModuleSubTopics].sort((a, b) => (a.index || 0) - (b.index || 0));
                    lastSubtopicId = sortedSubTopics[sortedSubTopics.length - 1]?._id || null;
                }

                return lastSubtopicId;

            case 'submodule':
                // For submodule, get the last subtopic under it
                const subModuleTopics = topics.filter(t => t.subModuleId === parentId);
                let lastSubtopicIdSubModule = null;

                const allSubModuleSubTopics: any[] = [];
                for (const topic of subModuleTopics) {
                    const topicSubTopics = subTopics.filter(st => st.topicId === topic._id);
                    allSubModuleSubTopics.push(...topicSubTopics);
                }

                if (allSubModuleSubTopics.length > 0) {
                    const sortedSubTopics = [...allSubModuleSubTopics].sort((a, b) => (a.index || 0) - (b.index || 0));
                    lastSubtopicIdSubModule = sortedSubTopics[sortedSubTopics.length - 1]?._id || null;
                }

                return lastSubtopicIdSubModule;

            case 'topic':
                // For topic, get the last subtopic
                const topicSubTopics = subTopics.filter(st => st.topicId === parentId);
                if (topicSubTopics.length > 0) {
                    const sortedSubTopics = [...topicSubTopics].sort((a, b) => (a.index || 0) - (b.index || 0));
                    return sortedSubTopics[sortedSubTopics.length - 1]?._id || null;
                }
                return null;

            case 'subtopic':
                // For subtopic, it's the leaf node, so return itself
                return parentId;

            default:
                return null;
        }
    };

    // Add these helper functions to check and delete existing pedagogy/level data
    const checkAndDeleteExistingPedagogyData = async (
        hierarchyIds: {
            modules?: string[];
            subModules?: string[];
            topics?: string[];
            subTopics?: string[];
        },
        alreadyDeletedPedagogyItems: Set<string> = new Set(),
        preserveEditingItem: boolean = false,
        editingItemId?: string
    ) => {
        const pedagogyToUpdate = pedagogyViews?.[0];
        if (!pedagogyToUpdate) return;

        // Get current element indices for comparison
        let currentModuleIndex = 0;
        let currentSubModuleIndex = 0;
        let currentTopicIndex = 0;

        if (hierarchyIds.modules?.[0]) {
            const currentModule = modules.find(m => m._id === hierarchyIds.modules[0]);
            currentModuleIndex = currentModule?.index ?? 0;
        }
        if (hierarchyIds.subModules?.[0]) {
            const currentSubModule = subModules.find(sm => sm._id === hierarchyIds.subModules[0]);
            currentSubModuleIndex = currentSubModule?.index ?? 0;
        }
        if (hierarchyIds.topics?.[0]) {
            const currentTopic = topics.find(t => t._id === hierarchyIds.topics[0]);
            currentTopicIndex = currentTopic?.index ?? 0;
        }


        // Determine if this is the first child
        const firstChild = isFirstChild(dialogType, editMode);

        // Helper function to get module index
        const getModuleIndex = (moduleId: string) => {
            const module = modules.find(m => m._id === moduleId);
            return module?.index || 0;
        };

        // Helper function to get element index
        const getElementIndex = (type: 'module' | 'submodule' | 'topic' | 'subtopic', id: string) => {
            switch (type) {
                case 'module':
                    return getModuleIndex(id);
                case 'submodule':
                    const subModule = subModules.find(sm => sm._id === id);
                    return subModule?.index || 0;
                case 'topic':
                    const topic = topics.find(t => t._id === id);
                    return topic?.index || 0;
                case 'subtopic':
                    const subtopic = subTopics.find(st => st._id === id);
                    return subtopic?.index || 0;
                default:
                    return 0;
            }
        };

        // Helper function to check if pedagogy is merged with higher index elements
        const isPedagogyMergedWithHigherIndex = (pedagogy: any, currentModuleId: string, dialogType: string | null) => {
            // Check if module is merged with higher index modules
            if (pedagogy.module && pedagogy.module.length > 1) {
                const currentModuleIndex = getModuleIndex(currentModuleId);
                const hasHigherIndexModule = pedagogy.module.some((moduleId: string) => {
                    if (moduleId === currentModuleId) return false;
                    const otherModuleIndex = getModuleIndex(moduleId);
                    return otherModuleIndex > currentModuleIndex;
                });
                if (hasHigherIndexModule) return true;
            }

            // Check if parent hierarchy is merged with higher index elements
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

            // Check the appropriate parent hierarchy field
            const parentHierarchyField = parentType === 'module' ? 'module' :
                parentType === 'submodule' ? 'subModule' : 'topic';

            if (!pedagogy[parentHierarchyField] || pedagogy[parentHierarchyField].length <= 1) {
                return false;
            }

            // Get current parent index
            const currentParentIndex = getElementIndex(parentType, currentParentId);

            // Check if merged with higher index elements of the same parent type
            const hasHigherIndexParent = pedagogy[parentHierarchyField].some((id: string) => {
                if (id === currentParentId) return false;
                const otherIndex = getElementIndex(parentType, id);
                return otherIndex > currentParentIndex;
            });

            return hasHigherIndexParent;
        };

        // Determine current module ID and element ID
        let currentModuleId = '';
        let currentElementId = '';

        if (dialogType === 'module') {
            currentModuleId = hierarchyIds.modules?.[0] || '';
            currentElementId = hierarchyIds.modules?.[0] || '';
        } else if (dialogType === 'submodule') {
            currentModuleId = hierarchyIds.modules?.[0] || '';
            currentElementId = hierarchyIds.subModules?.[0] || '';
        } else if (dialogType === 'topic') {
            const hierarchyLevels = selectedCourse?.courseHierarchy.map(l => l.toLowerCase()) || [];
            const hasSubModules = hierarchyLevels.includes('sub module');
            if (hasSubModules) {
                const parentSubModule = subModules.find(sm => sm._id === hierarchyIds.subModules?.[0]);
                currentModuleId = parentSubModule?.moduleId || '';
            } else {
                currentModuleId = hierarchyIds.modules?.[0] || '';
            }
            currentElementId = hierarchyIds.topics?.[0] || '';
        } else if (dialogType === 'subtopic') {
            const parentTopic = topics.find(t => t._id === hierarchyIds.topics?.[0]);
            currentModuleId = parentTopic?.moduleId || '';
            currentElementId = hierarchyIds.subTopics?.[0] || '';
        }

        const pedagogiesToDelete = pedagogyToUpdate.pedagogies.filter((pedagogy: any) => {
            if (pedagogy._id && alreadyDeletedPedagogyItems.has(pedagogy._id)) {
                return false;
            }

            // If we're preserving the editing item, don't delete pedagogies that contain it
            if (preserveEditingItem && editingItemId) {
                if (pedagogy.module?.includes(editingItemId) ||
                    pedagogy.subModule?.includes(editingItemId) ||
                    pedagogy.topic?.includes(editingItemId) ||
                    pedagogy.subTopic?.includes(editingItemId)) {
                    return false;
                }
            }

            // For first child: delete ALL pedagogy containing the parent ID (both single and merged)
            if (firstChild) {
                if (dialogType === 'submodule' && hierarchyIds.modules?.some(id =>
                    pedagogy.module?.includes(id))) {
                    return true;
                }
                if (dialogType === 'topic') {
                    const hierarchyLevels = selectedCourse?.courseHierarchy.map(l => l.toLowerCase()) || [];
                    const hasSubModules = hierarchyLevels.includes('sub module');

                    if (hasSubModules && hierarchyIds.subModules?.some(id =>
                        pedagogy.subModule?.includes(id))) {
                        return true;
                    }
                    if (!hasSubModules && hierarchyIds.modules?.some(id =>
                        pedagogy.module?.includes(id))) {
                        return true;
                    }
                }
                if (dialogType === 'subtopic' && hierarchyIds.topics?.some(id =>
                    pedagogy.topic?.includes(id))) {
                    return true;
                }
            }
            // For subsequent children: only delete MERGED pedagogy containing the last child ID
            else if (!editMode) {
                let shouldDelete = false;

                // Check module-level merging with higher index
                if (hierarchyIds.modules?.[0] && checkIfMergedWithHigherIndexModule(pedagogy, hierarchyIds.modules[0], currentModuleIndex)) {
                    shouldDelete = true;
                }
                // Check submodule-level merging with higher index
                else if (hierarchyIds.subModules?.[0] && checkIfMergedWithHigherIndexSubModule(pedagogy, hierarchyIds.subModules[0], currentSubModuleIndex)) {
                    shouldDelete = true;
                }
                // Check topic-level merging with higher index
                else if (hierarchyIds.topics?.[0] && checkIfMergedWithHigherIndexTopic(pedagogy, hierarchyIds.topics[0], currentTopicIndex)) {
                    shouldDelete = true;
                }

                return shouldDelete;
            }

            return false;
        });

        for (const pedagogy of pedagogiesToDelete) {
            if (pedagogy._id) {
                alreadyDeletedPedagogyItems.add((pedagogy as any)._id);
            }

            // Delete ALL activities for the filtered pedagogies
            if (pedagogy.iDo && pedagogy.iDo.length > 0) {
                for (const activity of pedagogy.iDo) {
                    try {
                        await deletePedagogyMutation.mutateAsync({
                            activityType: "iDo",
                            itemId: activity._id
                        });
                    } catch (error: any) {
                        if (error.response?.status !== 404) {
                            throw error;
                        }
                    }
                }
            }

            if (pedagogy.weDo && pedagogy.weDo.length > 0) {
                for (const activity of pedagogy.weDo) {
                    try {
                        await deletePedagogyMutation.mutateAsync({
                            activityType: "weDo",
                            itemId: activity._id
                        });
                    } catch (error: any) {
                        if (error.response?.status !== 404) {
                            throw error;
                        }
                    }
                }
            }

            if (pedagogy.youDo && pedagogy.youDo.length > 0) {
                for (const activity of pedagogy.youDo) {
                    try {
                        await deletePedagogyMutation.mutateAsync({
                            activityType: "youDo",
                            itemId: activity._id
                        });
                    } catch (error: any) {
                        if (error.response?.status !== 404) {
                            throw error;
                        }
                    }
                }
            }

            // Clean up empty pedagogy entries
            const hasRemainingActivities =
                (pedagogy.iDo && pedagogy.iDo.length > 0) ||
                (pedagogy.weDo && pedagogy.weDo.length > 0) ||
                (pedagogy.youDo && pedagogy.youDo.length > 0);

            if (!hasRemainingActivities && pedagogy._id) {
                try {
                    await deleteDocumentMutation.mutateAsync({
                        model: 'PedagogyView1' as const,
                        id: pedagogy._id
                    });
                } catch (error: any) {
                    if (error.response?.status !== 404) {
                        throw error;
                    }
                }
            }
        }
    };

    /**
     * Delete the hours belonging to ONE node — used when the Pedagogy section is
     * unticked while editing, which means "clear this item's hours".
     * checkAndDeleteExistingPedagogyData matches by id containment, so asking it
     * to clear a module also cleared every topic and subtopic beneath it.
     */
    const deleteOwnPedagogyRows = async (
        type: HierarchyType,
        id: string,
        alreadyDeletedPedagogyItems: Set<string> = new Set()
    ) => {
        const pedagogyToUpdate = pedagogyViews?.[0];
        if (!pedagogyToUpdate || !id) return;

        const ownRows = pedagogyToUpdate.pedagogies.filter((pedagogy: any) =>
            !(pedagogy._id && alreadyDeletedPedagogyItems.has(pedagogy._id)) &&
            isOwnPedagogyRow(pedagogy, type, id)
        );

        for (const pedagogy of ownRows) {
            if ((pedagogy as any)._id) {
                alreadyDeletedPedagogyItems.add((pedagogy as any)._id);
            }

            for (const activityType of ["iDo", "weDo", "youDo"] as const) {
                for (const activity of ((pedagogy as any)[activityType] || [])) {
                    if (!activity?._id) continue;
                    try {
                        await deletePedagogyMutation.mutateAsync({
                            activityType,
                            itemId: activity._id
                        });
                    } catch (error: any) {
                        if (error.response?.status !== 404) {
                            throw error;
                        }
                    }
                }
            }

            if ((pedagogy as any)._id) {
                try {
                    await deleteDocumentMutation.mutateAsync({
                        model: 'PedagogyView1' as const,
                        id: (pedagogy as any)._id
                    });
                } catch (error: any) {
                    if (error.response?.status !== 404) {
                        throw error;
                    }
                }
            }
        }
    };


    const checkAndDeleteExistingLevelData = async (
        hierarchyIds: {
            modules?: string[];
            subModules?: string[];
            topics?: string[];
            subTopics?: string[];
        },
        alreadyDeletedLevels: Set<string> = new Set(),
        preserveEditingItem: boolean = false,
        editingItemId?: string
    ) => {
        if (!levelViewId) return;

        // Determine if this is the first child
        const firstChild = isFirstChild(dialogType, editMode);
        // Helper function to get module index
        const getModuleIndex = (moduleId: string) => {
            const module = modules.find(m => m._id === moduleId);
            return module?.index || 0;
        };

        // Helper function to get element index
        const getElementIndex = (type: 'module' | 'submodule' | 'topic' | 'subtopic', id: string) => {
            switch (type) {
                case 'module':
                    return getModuleIndex(id);
                case 'submodule':
                    const subModule = subModules.find(sm => sm._id === id);
                    return subModule?.index || 0;
                case 'topic':
                    const topic = topics.find(t => t._id === id);
                    return topic?.index || 0;
                case 'subtopic':
                    const subtopic = subTopics.find(st => st._id === id);
                    return subtopic?.index || 0;
                default:
                    return 0;
            }
        };

        // Helper function to check if level is merged with higher index elements
        const isLevelMergedWithHigherIndex = (level: any, currentModuleId: string, dialogType: string | null) => {
            // Check if module is merged with higher index modules
            if (level.module && level.module.length > 1) {
                const currentModuleIndex = getModuleIndex(currentModuleId);
                const hasHigherIndexModule = level.module.some((moduleId: string) => {
                    if (moduleId === currentModuleId) return false;
                    const otherModuleIndex = getModuleIndex(moduleId);
                    return otherModuleIndex > currentModuleIndex;
                });
                if (hasHigherIndexModule) return true;
            }

            // Check if parent hierarchy is merged with higher index elements
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

            // Check the appropriate parent hierarchy field
            const parentHierarchyField = parentType === 'module' ? 'module' :
                parentType === 'submodule' ? 'subModule' : 'topic';

            if (!level[parentHierarchyField] || level[parentHierarchyField].length <= 1) {
                return false;
            }

            // Get current parent index
            const currentParentIndex = getElementIndex(parentType, currentParentId);

            // Check if merged with higher index elements of the same parent type
            const hasHigherIndexParent = level[parentHierarchyField].some((id: string) => {
                if (id === currentParentId) return false;
                const otherIndex = getElementIndex(parentType, id);
                return otherIndex > currentParentIndex;
            });

            return hasHigherIndexParent;
        };

        // Determine current module ID
        let currentModuleId = '';

        if (dialogType === 'module') {
            currentModuleId = hierarchyIds.modules?.[0] || '';
        } else if (dialogType === 'submodule') {
            currentModuleId = hierarchyIds.modules?.[0] || '';
        } else if (dialogType === 'topic') {
            const hierarchyLevels = selectedCourse?.courseHierarchy.map(l => l.toLowerCase()) || [];
            const hasSubModules = hierarchyLevels.includes('sub module');
            if (hasSubModules) {
                const parentSubModule = subModules.find(sm => sm._id === hierarchyIds.subModules?.[0]);
                currentModuleId = parentSubModule?.moduleId || '';
            } else {
                currentModuleId = hierarchyIds.modules?.[0] || '';
            }
        } else if (dialogType === 'subtopic') {
            const parentTopic = topics.find(t => t._id === hierarchyIds.topics?.[0]);
            currentModuleId = parentTopic?.moduleId || '';
        }

        // Determine if this is the first child
        // Check if we have merge selections (meaning we're merging with other elements)
        const hasMergeSelections =
            (savedLevelMergeSelections &&
                (savedLevelMergeSelections.modules.length > 0 ||
                    savedLevelMergeSelections.subModules.length > 0 ||
                    savedLevelMergeSelections.topics.length > 0 ||
                    savedLevelMergeSelections.subTopics.length > 0)) ||
            (showMergeLevelSection &&
                (selectedLevelModulesForMerge.size > 0 ||
                    selectedLevelSubModulesForMerge.size > 0 ||
                    selectedLevelTopicsForMerge.size > 0 ||
                    selectedLevelSubTopicsForMerge.size > 0));

        const levelsToDelete = levelsData.filter((level: any) => {
            if (level._id && alreadyDeletedLevels.has(level._id)) {
                return false;
            }

            if (preserveEditingItem && editingItemId) {
                if (level.module?.includes(editingItemId) ||
                    level.subModule?.includes(editingItemId) ||
                    level.topic?.includes(editingItemId) ||
                    level.subTopic?.includes(editingItemId)) {
                    return false;
                }
            }

            // CASE 1: First child - delete level containing the parent ID
            if (firstChild) {
                if (dialogType === 'submodule' && hierarchyIds.modules?.some(id =>
                    level.module?.includes(id))) {
                    return true;
                }
                if (dialogType === 'topic') {
                    const hierarchyLevels = selectedCourse?.courseHierarchy.map(l => l.toLowerCase()) || [];
                    const hasSubModules = hierarchyLevels.includes('sub module');

                    if (hasSubModules && hierarchyIds.subModules?.some(id =>
                        level.subModule?.includes(id))) {
                        return true;
                    }
                    if (!hasSubModules && hierarchyIds.modules?.some(id =>
                        level.module?.includes(id))) {
                        return true;
                    }
                }
                if (dialogType === 'subtopic' && hierarchyIds.topics?.some(id =>
                    level.topic?.includes(id))) {
                    return true;
                }
            }
            // CASE 2: Subsequent children with merge selections - delete current element's level data
            else if (hasMergeSelections) {
                // Delete level data containing the current element ID
                if (dialogType === 'submodule' && hierarchyIds.subModules?.some(id =>
                    level.subModule?.includes(id))) {
                    return true;
                }
                if (dialogType === 'topic' && hierarchyIds.topics?.some(id =>
                    level.topic?.includes(id))) {
                    return true;
                }
                if (dialogType === 'subtopic' && hierarchyIds.subTopics?.some(id =>
                    level.subTopic?.includes(id))) {
                    return true;
                }
            }
            // CASE 3: Subsequent children without merge selections - only delete if parent's last child has merged level
            else if (!editMode) {
                const mergedWithHigherIndex = isLevelMergedWithHigherIndex(level, currentModuleId, dialogType);
                if (mergedWithHigherIndex) {
                    return true;
                }
                let lastChildId = null;
                let parentId = null;

                // Get parent ID and last child ID based on dialog type
                if (dialogType === 'submodule') {
                    parentId = hierarchyIds.modules?.[0];
                    lastChildId = getLastChildId(parentId || '', 'module');
                } else if (dialogType === 'topic') {
                    const hierarchyLevels = selectedCourse?.courseHierarchy.map(l => l.toLowerCase()) || [];
                    const hasSubModules = hierarchyLevels.includes('sub module');

                    if (hasSubModules) {
                        parentId = hierarchyIds.subModules?.[0];
                        lastChildId = getLastChildId(parentId || '', 'submodule');
                    } else {
                        parentId = hierarchyIds.modules?.[0];
                        lastChildId = getLastChildId(parentId || '', 'module');
                    }
                } else if (dialogType === 'subtopic') {
                    parentId = hierarchyIds.topics?.[0];
                    lastChildId = getLastChildId(parentId || '', 'topic');
                }

                // Check if the last child has a merged level (multiple hierarchy items)
                if (lastChildId && parentId && level.subTopic?.includes(lastChildId)) {
                    const isMergedLevel =
                        (level.module && level.module.length > 1) ||
                        (level.subModule && level.subModule.length > 1) ||
                        (level.topic && level.topic.length > 1) ||
                        (level.subTopic && level.subTopic.length > 1);
                    const isMergedWithAnotherParent = checkIfLevelMergedWithAnotherParent(level, parentId, dialogType);
                    return isMergedLevel && isMergedWithAnotherParent;
                }
            }

            return false;
        });

        for (const level of levelsToDelete) {
            if (level._id) {
                await deleteLevelMutation.mutateAsync(level._id);
                alreadyDeletedLevels.add(level._id);
            }
        }
    };


    // Update the checkAndDeleteExistingMergedCells function
    // Thin wrapper over the extracted implementation (pedagogyDeletions.ts);
    // every call site still calls checkAndDeleteExistingMergedCells(hierarchyIds).
    const checkAndDeleteExistingMergedCells = (hierarchyIds: {
        modules?: string[];
        subModules?: string[];
        topics?: string[];
        subTopics?: string[];
    }) => checkAndDeleteExistingMergedCellsImpl(hierarchyIds, {
        dialogType, editMode, isFirstChild, mergedCells, mergedLevels,
        selectedCourse, setMergedCells, setMergedLevels,
        modules, subModules, topics, subTopics,
    })
    // Also update the helper functions to check for higher index elements
    const checkIfMergedWithHigherIndexModule = (pedagogy: any, currentModuleId: string, currentModuleIndex: number): boolean => {
        if (!pedagogy.module || pedagogy.module.length <= 1) return false;

        return pedagogy.module.some((moduleId: string) => {
            if (moduleId === currentModuleId) return false;
            const otherModule = modules.find(m => m._id === moduleId);
            return otherModule && (otherModule.index ?? 0) > currentModuleIndex;
        });
    };

    const checkIfMergedWithHigherIndexSubModule = (pedagogy: any, currentSubModuleId: string, currentSubModuleIndex: number): boolean => {
        if (!pedagogy.subModule || pedagogy.subModule.length <= 1) return false;

        return pedagogy.subModule.some((subModuleId: string) => {
            if (subModuleId === currentSubModuleId) return false;
            const otherSubModule = subModules.find(sm => sm._id === subModuleId);
            return otherSubModule && (otherSubModule.index ?? 0) > currentSubModuleIndex;
        });
    };

    const checkIfMergedWithHigherIndexTopic = (pedagogy: any, currentTopicId: string, currentTopicIndex: number): boolean => {
        if (!pedagogy.topic || pedagogy.topic.length <= 1) return false;

        return pedagogy.topic.some((topicId: string) => {
            if (topicId === currentTopicId) return false;
            const otherTopic = topics.find(t => t._id === topicId);
            return otherTopic && (otherTopic.index ?? 0) > currentTopicIndex;
        });
    };

    // Update the getLastChildId function to ensure it returns the correct last child
    const isPedagogyMerged = (pedagogy: any): boolean => {
        return (
            (pedagogy.module && pedagogy.module.length > 1) ||
            (pedagogy.subModule && pedagogy.subModule.length > 1) ||
            (pedagogy.topic && pedagogy.topic.length > 1) ||
            (pedagogy.subTopic && pedagogy.subTopic.length > 1)
        );
    };

    const checkAndDeleteExistingPedagogyDataForSelectedActivities = async (
        hierarchyIds: {
            modules?: string[];
            subModules?: string[];
            topics?: string[];
            subTopics?: string[];
        },
        alreadyDeletedPedagogyItems: Set<string> = new Set(),
        preserveEditingItem: boolean = false,
        editingItemId?: string
    ) => {
        const pedagogyToUpdate = pedagogyViews?.[0];
        if (!pedagogyToUpdate) return;

        // Get selected activity types
        const selectedActivityTypes = {
            iDo: selectedPedagogyActivities.iDo,
            weDo: selectedPedagogyActivities.weDo,
            youDo: selectedPedagogyActivities.youDo
        };

        // Get current merge selections for the specific activity
        const currentMergeSelections = savedPedagogyMergeSelections;

        const pedagogiesToDelete = pedagogyToUpdate.pedagogies.filter((pedagogy: any) => {
            if (pedagogy._id && alreadyDeletedPedagogyItems.has(pedagogy._id)) {
                return false;
            }

            // If we're preserving the editing item, don't delete pedagogies that contain it
            if (preserveEditingItem && editingItemId) {
                if (pedagogy.module?.includes(editingItemId) ||
                    pedagogy.subModule?.includes(editingItemId) ||
                    pedagogy.topic?.includes(editingItemId) ||
                    pedagogy.subTopic?.includes(editingItemId)) {
                    return false;
                }
            }

            // Check if this pedagogy contains ANY of the selected merge element IDs
            const containsSelectedElements =
                (hierarchyIds.modules?.some(id => pedagogy.module?.includes(id))) ||
                (hierarchyIds.subModules?.some(id => pedagogy.subModule?.includes(id))) ||
                (hierarchyIds.topics?.some(id => pedagogy.topic?.includes(id))) ||
                (hierarchyIds.subTopics?.some(id => pedagogy.subTopic?.includes(id)));

            if (!containsSelectedElements) return false;

            // For MERGE operations: Delete pedagogy that contains selected merge elements
            // Check if we have any merge selections (meaning we're in merge mode)
            const hasMergeSelections =
                (currentMergeSelections?.iDo && Object.keys(currentMergeSelections.iDo).length > 0) ||
                (currentMergeSelections?.weDo && Object.keys(currentMergeSelections.weDo).length > 0) ||
                (currentMergeSelections?.youDo && Object.keys(currentMergeSelections.youDo).length > 0);

            if (hasMergeSelections && containsSelectedElements) {
                // In merge mode: Only delete if pedagogy contains EXACTLY the selected merge elements
                // This prevents deleting parent's last child single cell values

                // Check if this pedagogy ONLY contains elements from our merge selection (not parent's last child)
                const containsOnlyMergeElements =
                    (!pedagogy.module || pedagogy.module.every((id: string) => hierarchyIds.modules?.includes(id))) &&
                    (!pedagogy.subModule || pedagogy.subModule.every((id: string) => hierarchyIds.subModules?.includes(id))) &&
                    (!pedagogy.topic || pedagogy.topic.every((id: string) => hierarchyIds.topics?.includes(id))) &&
                    (!pedagogy.subTopic || pedagogy.subTopic.every((id: string) => hierarchyIds.subTopics?.includes(id)));

                // Only delete if it contains ONLY our selected merge elements (not mixed with parent's last child)
                return containsOnlyMergeElements;
            }

            // For NON-MERGE operations: Use the original first-child logic
            const firstChild = isFirstChild(dialogType, editMode);

            if (firstChild) {
                // First child logic remains the same
                if (dialogType === 'submodule' && hierarchyIds.modules?.some(id =>
                    pedagogy.module?.includes(id))) {
                    return true;
                }
                if (dialogType === 'topic') {
                    const hierarchyLevels = selectedCourse?.courseHierarchy.map(l => l.toLowerCase()) || [];
                    const hasSubModules = hierarchyLevels.includes('sub module');

                    if (hasSubModules && hierarchyIds.subModules?.some(id =>
                        pedagogy.subModule?.includes(id))) {
                        return true;
                    }
                    if (!hasSubModules && hierarchyIds.modules?.some(id =>
                        pedagogy.module?.includes(id))) {
                        return true;
                    }
                }
                if (dialogType === 'subtopic' && hierarchyIds.topics?.some(id =>
                    pedagogy.topic?.includes(id))) {
                    return true;
                }
            } // For subsequent children: only delete MERGED pedagogy containing the last child ID
            else if (!editMode) {
                let lastChildId = null;

                if (dialogType === 'submodule') {
                    lastChildId = getLastChildId(hierarchyIds.modules?.[0] || '', 'module');
                } else if (dialogType === 'topic') {
                    const hierarchyLevels = selectedCourse?.courseHierarchy.map(l => l.toLowerCase()) || [];
                    const hasSubModules = hierarchyLevels.includes('sub module');

                    if (hasSubModules) {
                        lastChildId = getLastChildId(hierarchyIds.subModules?.[0] || '', 'submodule');
                    } else {
                        lastChildId = getLastChildId(hierarchyIds.modules?.[0] || '', 'module');
                    }
                } else if (dialogType === 'subtopic') {
                    lastChildId = getLastChildId(hierarchyIds.topics?.[0] || '', 'topic');
                }

                // Only delete if it's a MERGED cell (has multiple hierarchy items) AND contains the last child
                if (lastChildId && pedagogy.subTopic?.includes(lastChildId)) {
                    const isMergedCell = isPedagogyMerged(pedagogy);
                    return isMergedCell;
                }

                // DO NOT delete single cell values for subsequent children
                return false;
            }

            return false;
        });

        // Delete the filtered pedagogies
        for (const pedagogy of pedagogiesToDelete) {
            if (pedagogy._id) {
                alreadyDeletedPedagogyItems.add((pedagogy as any)._id);
            }

            // Delete activities based on selection
            if (selectedActivityTypes.iDo.length > 0 && pedagogy.iDo) {
                for (const activity of pedagogy.iDo) {
                    if (selectedActivityTypes.iDo.includes(activity.type)) {
                        try {
                            await deletePedagogyMutation.mutateAsync({
                                activityType: "iDo",
                                itemId: activity._id
                            });
                        } catch (error: any) {
                            if (error.response?.status !== 404) {
                                throw error;
                            }
                        }
                    }
                }
            }

            if (selectedActivityTypes.weDo.length > 0 && pedagogy.weDo) {
                for (const activity of pedagogy.weDo) {
                    if (selectedActivityTypes.weDo.includes(activity.type)) {
                        try {
                            await deletePedagogyMutation.mutateAsync({
                                activityType: "weDo",
                                itemId: activity._id
                            });
                        } catch (error: any) {
                            if (error.response?.status !== 404) {
                                throw error;
                            }
                        }
                    }
                }
            }

            if (selectedActivityTypes.youDo.length > 0 && pedagogy.youDo) {
                for (const activity of pedagogy.youDo) {
                    if (selectedActivityTypes.youDo.includes(activity.type)) {
                        try {
                            await deletePedagogyMutation.mutateAsync({
                                activityType: "youDo",
                                itemId: activity._id
                            });
                        } catch (error: any) {
                            if (error.response?.status !== 404) {
                                throw error;
                            }
                        }
                    }
                }
            }

            // Clean up empty pedagogy entries
            const hasRemainingActivities =
                (pedagogy.iDo && pedagogy.iDo.length > 0) ||
                (pedagogy.weDo && pedagogy.weDo.length > 0) ||
                (pedagogy.youDo && pedagogy.youDo.length > 0);

            if (!hasRemainingActivities && pedagogy._id) {
                try {
                    await deleteDocumentMutation.mutateAsync({
                        model: 'PedagogyView1' as const,
                        id: pedagogy._id
                    });
                } catch (error: any) {
                    if (error.response?.status !== 404) {
                        throw error;
                    }
                }
            }
        }
    };

    const deleteSingleCellValuesForMerge = async (
        editingItemId: string,
        activityType: "iDo" | "weDo" | "youDo",
        activity: string
    ) => {
        const pedagogyToUpdate = pedagogyViews?.[0];
        if (!pedagogyToUpdate) return;

        const pedagogiesToUpdate = pedagogyToUpdate.pedagogies.filter((pedagogy: any) => {
            const hasEditingItem =
                (pedagogy.module?.includes(editingItemId)) ||
                (pedagogy.subModule?.includes(editingItemId)) ||
                (pedagogy.topic?.includes(editingItemId)) ||
                (pedagogy.subTopic?.includes(editingItemId));

            if (!hasEditingItem) return false;

            // Check if this is a single cell value for the specific activity
            const hasTargetActivity = pedagogy[activityType]?.some(
                (act: any) => act.type === activity
            );

            const isSingleCell =
                (!pedagogy.module || pedagogy.module.length <= 1) &&
                (!pedagogy.subModule || pedagogy.subModule.length <= 1) &&
                (!pedagogy.topic || pedagogy.topic.length <= 1) &&
                (!pedagogy.subTopic || pedagogy.subTopic.length <= 1);

            return hasTargetActivity && isSingleCell;
        });

        for (const pedagogy of pedagogiesToUpdate) {
            // Find the specific activity to delete
            const targetActivity = pedagogy[activityType]?.find(
                (act: any) => act.type === activity
            );

            if (targetActivity && targetActivity._id) {
                try {
                    // Delete only the specific activity using deletePedagogyMutation
                    await deletePedagogyMutation.mutateAsync({
                        activityType: activityType,
                        itemId: targetActivity._id
                    });
                } catch (error: any) {
                    if (error.response?.status !== 404) {
                        console.error(`Failed to delete ${activityType} activity:`, error);
                    }
                    // Continue with other deletions even if one fails
                }
            }
        }
    };

    // Add this helper function to check if a pedagogy is merged with another parent
    const checkIfMergedWithAnotherParent = (pedagogy: any, currentParentId: string, dialogType: string | null): boolean => {
        if (!dialogType) return false;

        switch (dialogType) {
            case 'submodule':
                // For submodule, check if merged with modules other than the current parent
                if (pedagogy.module && pedagogy.module.length > 1) {
                    return pedagogy.module.some((moduleId: string) => moduleId !== currentParentId);
                }
                break;

            case 'topic':
                const hierarchyLevels = selectedCourse?.courseHierarchy.map(l => l.toLowerCase()) || [];
                const hasSubModules = hierarchyLevels.includes('sub module');

                if (hasSubModules) {
                    // For topic with submodules, check if merged with submodules other than current parent
                    if (pedagogy.subModule && pedagogy.subModule.length > 1) {
                        return pedagogy.subModule.some((subModuleId: string) => subModuleId !== currentParentId);
                    }
                } else {
                    // For topic without submodules, check if merged with modules other than current parent
                    if (pedagogy.module && pedagogy.module.length > 1) {
                        return pedagogy.module.some((moduleId: string) => moduleId !== currentParentId);
                    }
                }
                break;

            case 'subtopic':
                // For subtopic, check if merged with topics other than current parent
                if (pedagogy.topic && pedagogy.topic.length > 1) {
                    return pedagogy.topic.some((topicId: string) => topicId !== currentParentId);
                }
                break;
        }

        return false;
    };
    // Add this helper function to check if a level is merged with another parent
    const checkIfLevelMergedWithAnotherParent = (level: any, currentParentId: string, dialogType: string | null): boolean => {
        if (!dialogType) return false;

        switch (dialogType) {
            case 'submodule':
                // For submodule, check if merged with modules other than the current parent
                if (level.module && level.module.length > 1) {
                    return level.module.some((moduleId: string) => moduleId !== currentParentId);
                }
                break;

            case 'topic':
                const hierarchyLevels = selectedCourse?.courseHierarchy.map(l => l.toLowerCase()) || [];
                const hasSubModules = hierarchyLevels.includes('sub module');

                if (hasSubModules) {
                    // For topic with submodules, check if merged with submodules other than current parent
                    if (level.subModule && level.subModule.length > 1) {
                        return level.subModule.some((subModuleId: string) => subModuleId !== currentParentId);
                    }
                } else {
                    // For topic without submodules, check if merged with modules other than current parent
                    if (level.module && level.module.length > 1) {
                        return level.module.some((moduleId: string) => moduleId !== currentParentId);
                    }
                }
                break;

            case 'subtopic':
                // For subtopic, check if merged with topics other than current parent
                if (level.topic && level.topic.length > 1) {
                    return level.topic.some((topicId: string) => topicId !== currentParentId);
                }
                break;
        }

        return false;
    };
    // Add these helper functions to collect complete hierarchy IDs
    const collectCompleteHierarchyIds = (selectedIds: Set<string>, type: 'module' | 'submodule' | 'topic' | 'subtopic') => collectCompleteHierarchyIdsImpl(selectedIds, type, { modules, subModules, subTopics, topics })
    // Add this function to collect hierarchy IDs for pedagogy deletion
    const collectPedagogyHierarchyIdsForDeletion = () => {
        const allModuleIds = new Set<string>();
        const allSubModuleIds = new Set<string>();
        const allTopicIds = new Set<string>();
        const allSubTopicIds = new Set<string>();

        // Add the hierarchy of the item being created/edited
        if (dialogType === 'module' && selectedModuleForSubModule) {
            allModuleIds.add(selectedModuleForSubModule.id);
        } else if (dialogType === 'submodule' && selectedModuleForSubModule) {
            allModuleIds.add(selectedModuleForSubModule.id);
            // Add submodule ID if it's being edited
            if (editMode?.type === 'submodule') {
                allSubModuleIds.add(editMode.data._id);
            }
        } else if (dialogType === 'topic' && selectedSubModuleForTopic) {
            allModuleIds.add(selectedSubModuleForTopic.moduleId);
            if (selectedSubModuleForTopic.id !== null) {
                allSubModuleIds.add(selectedSubModuleForTopic.id);
            }
            // Add topic ID if it's being edited
            if (editMode?.type === 'topic') {
                allTopicIds.add(editMode.data._id);
            }
        } else if (dialogType === 'subtopic' && selectedTopicForSubTopic) {
            allModuleIds.add(selectedTopicForSubTopic.moduleId);
            if (selectedTopicForSubTopic.subModuleId) {
                allSubModuleIds.add(selectedTopicForSubTopic.subModuleId);
            }
            if (selectedTopicForSubTopic.id !== null) {
                allTopicIds.add(selectedTopicForSubTopic.id);
            }
            // Add subtopic ID if it's being edited
            if (editMode?.type === 'subtopic') {
                allSubTopicIds.add(editMode.data._id);
            }
        }

        // Add merge selections for each activity type
        if (savedPedagogyMergeSelections && typeof savedPedagogyMergeSelections === "object") {
            Object?.entries(savedPedagogyMergeSelections).forEach(([activityType, activities]) => {
                Object.entries(activities).forEach(([activity, hierarchy]) => {
                    if (hierarchy) {
                        hierarchy.modules?.forEach(id => allModuleIds.add(id));
                        hierarchy.subModules?.forEach(id => allSubModuleIds.add(id));
                        hierarchy.topics?.forEach(id => allTopicIds.add(id));
                        hierarchy.subTopics?.forEach(id => allSubTopicIds.add(id));
                    }
                });
            });
        }

        return {
            modules: Array.from(allModuleIds),
            subModules: Array.from(allSubModuleIds),
            topics: Array.from(allTopicIds),
            subTopics: Array.from(allSubTopicIds)
        };
    };
    // Helper function to get element names for toast message
    const getElementNamesForToast = (dialogType: string, selectedIds: Set<string>) => {
        if (selectedIds.size === 0) return '';

        const elementNames: string[] = [];

        if (dialogType === 'module') {
            sortedModules.forEach(module => {
                if (selectedIds.has(module._id)) {
                    elementNames.push(module.title);
                }
            });
        } else if (dialogType === 'submodule') {
            sortedSubModules.forEach(subModule => {
                if (selectedIds.has(subModule._id)) {
                    elementNames.push(subModule.title);
                }
            });
        } else if (dialogType === 'topic') {
            sortedTopics.forEach(topic => {
                if (selectedIds.has(topic._id)) {
                    elementNames.push(topic.title);
                }
            });
        } else if (dialogType === 'subtopic') {
            sortedSubTopics.forEach(subTopic => {
                if (selectedIds.has(subTopic._id)) {
                    elementNames.push(subTopic.title);
                }
            });
        }

        // Return first 3 names + count if more
        if (elementNames.length <= 3) {
            return elementNames.join(', ');
        } else {
            return `${elementNames.slice(0, 3).join(', ')} and ${elementNames.length - 3} more`;
        }
    };
    // Update the save functions to use the hierarchy collection
    const saveLevelMergeSelections = () => {
        let hierarchyIds;

        if (dialogType === 'module') {
            hierarchyIds = collectCompleteHierarchyIds(selectedLevelModulesForMerge, 'module');
        } else if (dialogType === 'submodule') {
            hierarchyIds = collectCompleteHierarchyIds(selectedLevelSubModulesForMerge, 'submodule');
        } else if (dialogType === 'topic') {
            hierarchyIds = collectCompleteHierarchyIds(selectedLevelTopicsForMerge, 'topic');
        } else if (dialogType === 'subtopic') {
            hierarchyIds = collectCompleteHierarchyIds(selectedLevelSubTopicsForMerge, 'subtopic');
        }

        if (hierarchyIds) {
            setSavedLevelMergeSelections(hierarchyIds);
            setShowMergeLevelSection(false);
            // Show toast for level merge
            let selectedElementNames = '';
            let elementType = '';

            if (dialogType === 'module') {
                selectedElementNames = getElementNamesForToast('module', selectedLevelModulesForMerge);
                elementType = 'modules';
            } else if (dialogType === 'submodule') {
                selectedElementNames = getElementNamesForToast('submodule', selectedLevelSubModulesForMerge);
                elementType = 'submodules';
            } else if (dialogType === 'topic') {
                selectedElementNames = getElementNamesForToast('topic', selectedLevelTopicsForMerge);
                elementType = 'topics';
            } else if (dialogType === 'subtopic') {
                selectedElementNames = getElementNamesForToast('subtopic', selectedLevelSubTopicsForMerge);
                elementType = 'subtopics';
            }

            const message = selectedElementNames
                ? `Level saved with ${elementType}: ${selectedElementNames}`
                : `Level merge selection saved for ${elementType}`;

            toast.success(message, {
                duration: 4000,
                position: 'top-right',
            });
        }
    };

    const savePedagogyMergeSelections = (activityType: "iDo" | "weDo" | "youDo", activity: string) => {
        let hierarchyIds;
        const modulesForThisActivity = selectedPedagogyModulesForMerge[activityType]?.[activity] || new Set();
        const subModulesForThisActivity = selectedPedagogySubModulesForMerge[activityType]?.[activity] || new Set();
        const topicsForThisActivity = selectedPedagogyTopicsForMerge[activityType]?.[activity] || new Set();
        const subTopicsForThisActivity = selectedPedagogySubTopicsForMerge[activityType]?.[activity] || new Set();
        if (dialogType === 'module') {
            hierarchyIds = collectCompleteHierarchyIds(modulesForThisActivity, 'module');
        } else if (dialogType === 'submodule') {
            hierarchyIds = collectCompleteHierarchyIds(subModulesForThisActivity, 'submodule');
        } else if (dialogType === 'topic') {
            hierarchyIds = collectCompleteHierarchyIds(topicsForThisActivity, 'topic');
        } else if (dialogType === 'subtopic') {
            hierarchyIds = collectCompleteHierarchyIds(subTopicsForThisActivity, 'subtopic');
        }

        if (hierarchyIds) {
            setSavedPedagogyMergeSelections(prev => ({
                ...prev,
                [activityType]: {
                    ...prev[activityType],
                    [activity]: hierarchyIds
                }
            }));

            setShowMergePedagogySection(prev => ({
                ...prev,
                [activityType]: false
            }));
            // Show toast for pedagogy merge
            let selectedElementNames = '';
            let elementType = '';

            if (dialogType === 'module') {
                selectedElementNames = getElementNamesForToast('module', modulesForThisActivity);
                elementType = 'modules';
            } else if (dialogType === 'submodule') {
                selectedElementNames = getElementNamesForToast('submodule', subModulesForThisActivity);
                elementType = 'submodules';
            } else if (dialogType === 'topic') {
                selectedElementNames = getElementNamesForToast('topic', topicsForThisActivity);
                elementType = 'topics';
            } else if (dialogType === 'subtopic') {
                selectedElementNames = getElementNamesForToast('subtopic', subTopicsForThisActivity);
                elementType = 'subtopics';
            }

            const activityTypeDisplay = activityType === 'iDo' ? 'I Do' :
                activityType === 'weDo' ? 'We Do' : 'You Do';

            const message = selectedElementNames
                ? `${activityTypeDisplay} - ${activity} saved with ${elementType}: ${selectedElementNames}`
                : `${activityTypeDisplay} - ${activity} merge selection saved for ${elementType}`;

            toast.success(message, {
                duration: 4000,
                position: 'top-right',
            });
        }
    };
    const hasActualMergeSelection = (mergeSelection: any) => {
        if (!mergeSelection) return false;

        return (
            (mergeSelection.modules && mergeSelection.modules.length > 0) ||
            (mergeSelection.subModules && mergeSelection.subModules.length > 0) ||
            (mergeSelection.topics && mergeSelection.topics.length > 0) ||
            (mergeSelection.subTopics && mergeSelection.subTopics.length > 0)
        );
    };
    // Add this helper function to calculate level merge selection count excluding current element
    const getLevelMergeSelectionCount = () => {
        if (!savedLevelMergeSelections) return 0;

        const currentElementId = editMode?.data?._id;
        if (!currentElementId) {
            // For new elements (not edit mode), count all selections
            return savedLevelMergeSelections.modules.length +
                savedLevelMergeSelections.subModules.length +
                savedLevelMergeSelections.topics.length +
                savedLevelMergeSelections.subTopics.length;
        }

        // For edit mode, exclude the current element from the count
        let count = 0;

        if (dialogType === 'module') {
            count = savedLevelMergeSelections.modules.filter(id => id !== currentElementId).length;
        } else if (dialogType === 'submodule') {
            count = savedLevelMergeSelections.subModules.filter(id => id !== currentElementId).length;
        } else if (dialogType === 'topic') {
            count = savedLevelMergeSelections.topics.filter(id => id !== currentElementId).length;
        } else if (dialogType === 'subtopic') {
            count = savedLevelMergeSelections.subTopics.filter(id => id !== currentElementId).length;
        }

        return count;
    };
    // Update the edit functions to select the right items based on dialog type
    const editLevelMergeSelections = () => {
        if (savedLevelMergeSelections) {
            // Select the appropriate items based on dialog type AND pre-populate from saved data
            if (dialogType === 'module') {
                setSelectedLevelModulesForMerge(new Set(savedLevelMergeSelections.modules));
                // Also set other hierarchy levels if they exist in saved data
                setSelectedLevelSubModulesForMerge(new Set(savedLevelMergeSelections.subModules || []));
                setSelectedLevelTopicsForMerge(new Set(savedLevelMergeSelections.topics || []));
                setSelectedLevelSubTopicsForMerge(new Set(savedLevelMergeSelections.subTopics || []));
            } else if (dialogType === 'submodule') {
                setSelectedLevelSubModulesForMerge(new Set(savedLevelMergeSelections.subModules));
                setSelectedLevelModulesForMerge(new Set(savedLevelMergeSelections.modules || []));
                setSelectedLevelTopicsForMerge(new Set(savedLevelMergeSelections.topics || []));
                setSelectedLevelSubTopicsForMerge(new Set(savedLevelMergeSelections.subTopics || []));
            } else if (dialogType === 'topic') {
                setSelectedLevelTopicsForMerge(new Set(savedLevelMergeSelections.topics));
                setSelectedLevelModulesForMerge(new Set(savedLevelMergeSelections.modules || []));
                setSelectedLevelSubModulesForMerge(new Set(savedLevelMergeSelections.subModules || []));
                setSelectedLevelSubTopicsForMerge(new Set(savedLevelMergeSelections.subTopics || []));
            } else if (dialogType === 'subtopic') {
                setSelectedLevelSubTopicsForMerge(new Set(savedLevelMergeSelections.subTopics));
                setSelectedLevelModulesForMerge(new Set(savedLevelMergeSelections.modules || []));
                setSelectedLevelSubModulesForMerge(new Set(savedLevelMergeSelections.subModules || []));
                setSelectedLevelTopicsForMerge(new Set(savedLevelMergeSelections.topics || []));
            }

            setShowMergeLevelSection(true);
        }
    };

    const editPedagogyMergeSelections = (activityType: "iDo" | "weDo" | "youDo", activity: string) => {
        const savedSelections = savedPedagogyMergeSelections[activityType]?.[activity];

        if (savedSelections) {
            // Load the saved selections for this specific activity
            if (dialogType === 'module') {
                setSelectedPedagogyModulesForMerge(prev => ({
                    ...prev,
                    [activityType]: {
                        ...prev[activityType],
                        [activity]: new Set(savedSelections.modules)
                    }
                }));
            } else if (dialogType === 'submodule') {
                setSelectedPedagogySubModulesForMerge(prev => ({
                    ...prev,
                    [activityType]: {
                        ...prev[activityType],
                        [activity]: new Set(savedSelections.subModules)
                    }
                }));
            } else if (dialogType === 'topic') {
                setSelectedPedagogyTopicsForMerge(prev => ({
                    ...prev,
                    [activityType]: {
                        ...prev[activityType],
                        [activity]: new Set(savedSelections.topics)
                    }
                }));
            } else if (dialogType === 'subtopic') {
                setSelectedPedagogySubTopicsForMerge(prev => ({
                    ...prev,
                    [activityType]: {
                        ...prev[activityType],
                        [activity]: new Set(savedSelections.subTopics)
                    }
                }));
            }

            setShowMergePedagogySection(prev => ({
                ...prev,
                [activityType]: true
            }));

            setCurrentMergeActivity(activity);
        }
    };

    const calculateSectionTotal = (type: "iDo" | "weDo" | "youDo", activities: any) => {
        return activities.reduce((sum: number, activity: string) => {
            return sum + calculateTotalHours(type, activity);
        }, 0);
    };
    const calculateTotalHours = (type: "iDo" | "weDo" | "youDo", activity: string) => {
        // Calculate merged values
        const columnKey = `${type}-${activity}`;
        const mergedValue = mergedCells[columnKey]?.reduce((sum, merge) => sum + merge.value, 0) || 0;

        // Calculate unmerged values
        const unmergedValue = Object.values(courseHours).reduce((sum, module) => {
            return sum + Object.values(module).reduce((moduleSum, topic) => {
                return moduleSum + Object.values(topic).reduce((topicSum, subtopic) => {
                    // Skip if this subtopic is in any merged cell for this activity
                    const isMerged = mergedCells[columnKey]?.some(merge =>
                        merge.hierarchyIds?.subTopics?.includes((subtopic as any)?.subtopicId) ||
                        merge.hierarchyIds?.topics?.includes((topic as any)?.topicId) ||
                        merge.hierarchyIds?.subModules?.includes((topic as any)?.subModuleId) ||
                        merge.hierarchyIds?.modules?.includes((module as any)?.moduleId)
                    );

                    if (!isMerged && subtopic[type]?.[activity]) {
                        return topicSum + (subtopic[type][activity] || 0);
                    }
                    return topicSum;
                }, 0);
            }, 0);
        }, 0);

        return mergedValue + unmergedValue;
    };

    // Replace your current form change handlers with these:
    const handleModuleFormChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setModuleFormData(prev => ({
            ...prev,
            [name]: name === 'duration' ? Number(value) : value
        }));
    }, []);

    // Skill set handler for last hierarchy dialog
    // Skill set handler
    const handleSkillSetChange = useCallback((config: { coreProgram: string[]; frontend: string[]; database: string[] }) => {
        console.log('Skill set changed:', config);
        setModuleTestConfig(config);
    }, []);

    const handleSubModuleFormChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setSubModuleFormData(prev => ({
            ...prev,
            [name]: name === 'duration' ? Number(value) : value
        }));
    }, []);

    const handleTopicFormChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setTopicFormData(prev => ({
            ...prev,
            [name]: name === 'duration' ? Number(value) : value
        }));
    }, []);

    const handleSubTopicFormChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setSubTopicFormData(prev => ({
            ...prev,
            [name]: name === 'duration' ? Number(value) : value
        }));
    }, []);

    const handleModuleSubmit = async (e: React.FormEvent) => handleModuleSubmitImpl(e, { addOnlyPedagogyLevel, checkAndDeleteExistingLevelData, checkAndDeleteExistingMergedCells, checkAndDeleteExistingPedagogyData, checkAndDeleteExistingPedagogyDataForSelectedActivities, collectPedagogyHierarchyIdsForDeletion, courses, createModuleMutation, deleteLevelMutation, deleteOwnPedagogyRows, deleteSingleCellValuesForMerge, editMode, editingExistingLevelData, fetchModulesForCourse, levelViewMutation, levelsData, moduleFormData, moduleTestConfig, modules, pedagogyHours, pedagogyMutation, pedagogyViews, resetAllFormStates, savedLevelMergeSelections, savedPedagogyMergeSelections, selectedCourse, selectedLevel, selectedLevelModulesForMerge, selectedPedagogyActivities, setEditMode, setIsCreatingModule, setModuleFormData, setShowDialog, setShowSuccessMessage, showLevelSection, showMergeLevelSection, showPedagogySection, subModules, subTopics, token, topics, updateModuleMutation })

    const handleSubModuleSubmit = async (e: React.FormEvent) => handleSubModuleSubmitImpl(e, { addOnlyPedagogyLevel, checkAndDeleteExistingLevelData, checkAndDeleteExistingMergedCells, checkAndDeleteExistingPedagogyData, checkAndDeleteExistingPedagogyDataForSelectedActivities, collectPedagogyHierarchyIdsForDeletion, courses, createSubModuleMutation, deleteLevelMutation, deleteOwnPedagogyRows, deleteSingleCellValuesForMerge, editMode, editingExistingLevelData, fetchModulesForCourse, getAllSelectedHierarchyIds, levelViewMutation, levelsData, moduleTestConfig, modules, pedagogyHours, pedagogyMutation, pedagogyViews, refetchSubModules, resetAllFormStates, savedLevelMergeSelections, savedPedagogyMergeSelections, selectedCourse, selectedLevel, selectedLevelSubModulesForMerge, selectedModuleForSubModule, selectedPedagogyActivities, setEditMode, setIsCreatingSubModule, setShowDialog, setShowSuccessMessage, setSubModuleFormData, showLevelSection, showPedagogySection, subModuleFormData, subModules, subTopics, token, topics, updateSubModuleMutation })

    const handleTopicSubmit = async (e: React.FormEvent) => handleTopicSubmitImpl(e, { addOnlyPedagogyLevel, checkAndDeleteExistingLevelData, checkAndDeleteExistingMergedCells, checkAndDeleteExistingPedagogyData, checkAndDeleteExistingPedagogyDataForSelectedActivities, collectPedagogyHierarchyIdsForDeletion, courses, createTopicMutation, deleteLevelMutation, deleteOwnPedagogyRows, deleteSingleCellValuesForMerge, editMode, editingExistingLevelData, getAllSelectedHierarchyIds, levelViewMutation, levelsData, moduleTestConfig, modules, pedagogyHours, pedagogyMutation, pedagogyViews, refetchTopics, resetAllFormStates, savedLevelMergeSelections, savedPedagogyMergeSelections, selectedCourse, selectedLevel, selectedLevelTopicsForMerge, selectedPedagogyActivities, selectedSubModuleForTopic, setEditMode, setIsCreatingTopic, setShowDialog, setShowSuccessMessage, setTopicFormData, showLevelSection, showPedagogySection, subModules, subTopics, token, topicFormData, topics, updateTopicMutation })

    const handleSubTopicSubmit = async (e: React.FormEvent) => handleSubTopicSubmitImpl(e, { addOnlyPedagogyLevel, checkAndDeleteExistingLevelData, checkAndDeleteExistingMergedCells, checkAndDeleteExistingPedagogyData, checkAndDeleteExistingPedagogyDataForSelectedActivities, collectPedagogyHierarchyIdsForDeletion, courses, createSubTopicMutation, deleteLevelMutation, deleteOwnPedagogyRows, deleteSingleCellValuesForMerge, dialogType, editMode, editingExistingLevelData, getAllSelectedHierarchyIds, levelViewMutation, levelsData, mergedCells, moduleTestConfig, modules, pedagogyHours, pedagogyMutation, pedagogyViews, refetchSubTopics, refetchTopicSubTopics, resetAllFormStates, savedLevelMergeSelections, savedPedagogyMergeSelections, selectedCourse, selectedLevel, selectedLevelSubTopicsForMerge, selectedPedagogyActivities, selectedTopicForSubTopic, setEditMode, setIsCreatingSubTopic, setMergedCells, setShowDialog, setShowSuccessMessage, setSubTopicFormData, showLevelSection, showPedagogySection, subModules, subTopicFormData, subTopics, token, topics, updateSubTopicMutation })

    const preserveLevelDataForEditing = (type: string, id: string) => {
        if (!levelViews || !selectedCourse) return null;

        // This item's OWN level row. Saving deletes and recreates whatever this
        // returns, so matching by id containment let editing a module delete a
        // topic's level and re-create it at module level.
        const existingLevelData = levelsData.find((level: any) =>
            isOwnLevelRow(level, type as HierarchyType, id)
        );

        return existingLevelData || null;
    };

    const getAllSelectedHierarchyIds = (type: 'level' | 'pedagogy' = 'level', activityType?: string, activity?: string) => getAllSelectedHierarchyIdsImpl(type, activityType, activity, { addOnlyPedagogyLevel, dialogType, editMode, modules, savedLevelMergeSelections, savedPedagogyMergeSelections, selectedModuleForSubModule, selectedSubModuleForTopic, selectedTopicForSubTopic, subModules, subTopics, topics })
    // for topic
    const areAllSubModulesCompleted = (
        module: any,
        sortedSubModules: any[],
        sortedTopics: any[],
        selectedTopicsForMerge: Set<string>,
        currentSubModuleId: string | undefined,
        currentTopicId: string | undefined // Add this parameter
    ) => {
        const moduleSubModules = sortedSubModules.filter((sm: { moduleId: any; }) => sm.moduleId === module._id);


        if (moduleSubModules.length === 0) return false; // no submodules → not complete

        return moduleSubModules.every((sm: { _id: any; }) => {
            // const subTopics = sortedTopics.filter((t: { subModuleId: any; }) => t.subModuleId === sm._id);
            const subTopics = sortedTopics.filter((t: { subModuleId: any; _id: any; }) =>
                t.subModuleId === sm._id && t._id !== currentTopicId // Exclude current topic
            );

            // ❌ If submodule has no topics → incomplete (unless it's the current editing submodule)
            if (subTopics.length === 0 && sm._id !== currentSubModuleId) {
                return false;
            }

            // ✅ All topics in this submodule must be selected
            return subTopics.every((t: { _id: any; }) => selectedTopicsForMerge.has(t._id));
        });
    };

    const areAllModuleTopicsCompleted = (
        module: any,
        sortedTopics: any,
        selectedTopicsForMerge: any,
        currentTopicId: any
    ) => {
        const moduleTopics = sortedTopics.filter((t: { moduleId: any; _id: any; }) => t.moduleId === module._id && t._id !== currentTopicId);

        if (moduleTopics.length === 0) return false; // no topics → not complete

        // All topics in this module must be selected
        return moduleTopics.every((t: { _id: any; }) => selectedTopicsForMerge.has(t._id));
    };

    const PreviewButton = ({ course }: { course: Course | null }) => {
        const handlePreviewClick = () => {
            if (course) {
                setPreviewCourse(course);
                setShowCoursePreview(true);
            }
        };

        return (
            <button
                onClick={handlePreviewClick}
                disabled={!course}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${course
                    ? "bg-[#FFF3EA] text-[#C2540F] border border-[#FFD9BC] hover:bg-[#FFE4D0] hover:border-[#FDBA74] cursor-pointer"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                    }`}
                title={course ? `Preview ${course.courseName}` : "Select a course to preview"}
            >
                <Eye className="w-3.5 h-3.5" />
                Preview
            </button>
        );
    };
    const calculateConfirmationStats = () => {
        if (!selectedDuplicateCourse) return { modules: 0, subModules: 0, topics: 0, subTopics: 0, total: 0 };

        const allTableRows = createDuplicateTableRows();

        // Filter rows based on selection (same logic as ConfirmationPreviewTable)
        const filteredRows = enableModuleSelection && selectedModulesForDuplication.size > 0
            ? allTableRows.filter(row => selectedModulesForDuplication.has(row.moduleId))
            : allTableRows;

        // Get the selected hierarchy levels for display
        const selectedHierarchy = selectedDuplicateOptions.hierarchy.map(level =>
            level === 'SubModule' ? 'Sub Module' :
                level === 'SubTopic' ? 'Sub Topic' : level
        );

        // Count only items that are in the selected hierarchy and not placeholders
        const uniqueModules = new Set();
        const uniqueSubModules = new Set();
        const uniqueTopics = new Set();
        const uniqueSubTopics = new Set();

        filteredRows.forEach(row => {
            // Only count if the hierarchy level is selected
            if (selectedHierarchy.includes('Module') && row.moduleId && !row.moduleId.includes('placeholder') && row.moduleName !== "Default Module") {
                uniqueModules.add(row.moduleId);
            }
            if (selectedHierarchy.includes('Sub Module') && row.subModuleId && !row.subModuleId.includes('placeholder') && row.subModuleName !== "Default Submodule") {
                uniqueSubModules.add(row.subModuleId);
            }
            if (selectedHierarchy.includes('Topic') && row.topicId && !row.topicId.includes('placeholder') && row.topicName !== "Default Topic") {
                uniqueTopics.add(row.topicId);
            }
            if (selectedHierarchy.includes('Sub Topic') && row.subtopicId && !row.subtopicId.includes('placeholder') && row.subtopicName !== "Default Subtopic") {
                uniqueSubTopics.add(row.subtopicId);
            }
        });

        const modulesCount = uniqueModules.size;
        const subModulesCount = uniqueSubModules.size;
        const topicsCount = uniqueTopics.size;
        const subTopicsCount = uniqueSubTopics.size;
        const totalCount = modulesCount + subModulesCount + topicsCount + subTopicsCount;

        return {
            modules: modulesCount,
            subModules: subModulesCount,
            topics: topicsCount,
            subTopics: subTopicsCount,
            total: totalCount
        };
    };
    const ConfirmationPreviewTable = ({
        selectedDuplicateCourse,
        selectedHierarchy,
        selectedModules,
        enableModuleSelection
    }: {
        selectedDuplicateCourse: Course | null;
        selectedHierarchy: string[];
        selectedModules: Set<string>;
        enableModuleSelection: boolean;
    }) => {
        if (!selectedDuplicateCourse) return null;

        // Get all table rows
        const allTableRows = createDuplicateTableRows();

        // Filter rows based on selection
        const filteredRows = enableModuleSelection && selectedModules.size > 0
            ? allTableRows.filter(row => selectedModules.has(row.moduleId))
            : allTableRows;

        // Get spans for the filtered rows
        const spans = getDuplicateSpans();

        // Convert hierarchy for display
        const displayHierarchy = selectedHierarchy.map(level =>
            level === 'SubModule' ? 'Sub Module' :
                level === 'SubTopic' ? 'Sub Topic' : level
        );

        const getStickyLeftPositions = () => {
            const positions: { [key: string]: number } = {};
            let currentLeft = 0;

            if (displayHierarchy.includes('Module')) {
                positions['module'] = currentLeft;
                currentLeft += 80;
            }

            if (displayHierarchy.includes('Sub Module')) {
                positions['subModule'] = currentLeft;
                currentLeft += 80;
            }

            if (displayHierarchy.includes('Topic')) {
                positions['topic'] = currentLeft;
                currentLeft += 80;
            }

            if (displayHierarchy.includes('Sub Topic')) {
                positions['subTopic'] = currentLeft;
                currentLeft += 80;
            }

            return positions;
        };

        const stickyPositions = getStickyLeftPositions();

        if (filteredRows.length === 0) {
            return (
                <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
                    No items selected for duplication
                </div>
            );
        }

        return (
            <div className="overflow-x-auto">
                <Table className="border-separate border-spacing-0 w-full text-xs">
                    <TableHeader>
                        <TableRow className="bg-green-100">
                            {displayHierarchy.includes('Module') && (
                                <TableHead
                                    className="border-r border-b border-gray-400 text-center font-bold p-0.5 sticky bg-green-100 z-10 min-w-[80px]"
                                    style={{ left: `${stickyPositions['module']}px` }}
                                >
                                    Module
                                </TableHead>
                            )}
                            {displayHierarchy.includes('Sub Module') && (
                                <TableHead
                                    className="border-r border-b border-gray-400 text-center font-bold p-0.5 sticky bg-green-100 z-10 min-w-[80px]"
                                    style={{ left: `${stickyPositions['subModule']}px` }}
                                >
                                    Sub Module
                                </TableHead>
                            )}
                            {displayHierarchy.includes('Topic') && (
                                <TableHead
                                    className="border-r border-b border-gray-400 text-center font-bold p-0.5 sticky bg-green-100 z-10 min-w-[80px]"
                                    style={{ left: `${stickyPositions['topic']}px` }}
                                >
                                    Topic
                                </TableHead>
                            )}
                            {displayHierarchy.includes('Sub Topic') && (
                                <TableHead
                                    className="border-r border-b border-gray-400 text-center font-bold p-0.5 sticky bg-green-100 z-10 min-w-[80px]"
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

                            return filteredRows.map((row, index) => {
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
                                        key={`confirmation-${row.rowId}`}
                                        className={`hover:bg-green-50 h-6`}
                                    >
                                        {displayHierarchy.includes('Module') && isFirstSubtopicInModule && (
                                            <TableCell
                                                rowSpan={spans.moduleSpans[row.moduleId]}
                                                className="border-r border-b border-gray-400 text-left text-[10px] font-medium p-0.5 bg-green-50 text-center align-middle max-w-[80px] h-6 sticky z-10"
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
                                        {displayHierarchy.includes('Sub Module') && isFirstSubtopicInSubModule && (
                                            <TableCell
                                                rowSpan={spans.subModuleSpans[row.subModuleId]}
                                                className="border-r border-b border-gray-400 text-left p-0.5 bg-green-50 text-[10px] font-medium text-center align-middle max-w-[80px] h-6 sticky z-10"
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
                                        {displayHierarchy.includes('Topic') && isFirstSubtopicInTopic && (
                                            <TableCell
                                                rowSpan={spans.topicSpans[row.topicId]}
                                                className="border-r border-b border-gray-400 text-left p-0.5 bg-green-50 text-[10px] font-medium text-center align-middle max-w-[80px] h-6 sticky z-10"
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
                                        {displayHierarchy.includes('Sub Topic') && (
                                            <TableCell
                                                className="border-r border-b border-gray-400 text-left p-0.5 bg-green-50 text-[10px] font-medium text-center align-middle max-w-[80px] h-6 sticky z-10"
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
    };
    const CoursePreviewPopup = () => {
        if (!previewCourse) return null;

        const previewTableRows = createDuplicateTableRows();
        const spans = getDuplicateSpans();

        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="bg-white rounded-xl shadow-lg w-full max-w-7xl max-h-[95vh] flex flex-col overflow-hidden border border-gray-200"
                >
                    {/* Header */}
                    <div className="flex justify-between items-center px-4 py-2 bg-gradient-to-r from-[#FB8C3C] to-[#C2540F] text-white">
                        <div className="flex items-center gap-1.5">
                            <Eye className="w-4 h-4" />
                            <h2 className="text-base font-semibold">Course Preview - {previewCourse.courseName}</h2>
                        </div>
                        <button
                            onClick={() => setShowCoursePreview(false)}
                            className="p-1.5 cursor-pointer hover:bg-red-600/80 bg-red-500 rounded-md transition"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-auto thin-scrollbar p-4 space-y-3">

                        {/* Course Info */}
                        <div className="grid grid-cols-3 gap-3 text-xs">
                            <div className="bg-gray-50 p-2 rounded-md">
                                <span className="font-medium text-gray-700">Course Name:</span>
                                <p className="text-gray-900">{previewCourse.courseName}</p>
                            </div>
                            <div className="bg-gray-50 p-2 rounded-md">
                                <span className="font-medium text-gray-700">Hierarchy:</span>
                                <p className="text-gray-900">{previewCourse.courseHierarchy.join(' → ')}</p>
                            </div>
                            {previewCourse.category && (
                                <div className="bg-gray-50 p-2 rounded-md">
                                    <span className="font-medium text-gray-700">Category:</span>
                                    <p className="text-gray-900">{previewCourse.category}</p>
                                </div>
                            )}
                        </div>

                        {/* Preview Table - Show ALL hierarchy levels without checkboxes */}
                        <div className="border border-gray-200 overflow-hidden">
                            <div className="max-h-96 overflow-auto thin-scrollbar">
                                <FullCoursePreviewTable
                                    tableRows={previewTableRows}
                                    selectedCourse={previewCourse}
                                    moduleSpans={spans.moduleSpans}
                                    subModuleSpans={spans.subModuleSpans}
                                    topicSpans={spans.topicSpans}
                                    subtopicSpans={spans.subtopicSpans}
                                />
                            </div>
                        </div>

                        {/* Statistics */}
                        <div className="grid grid-cols-4 gap-2 text-[11px]">
                            {[
                                {
                                    label: "Modules",
                                    color: "blue",
                                    count: duplicateModules.filter(m => m.courses.includes(previewCourse._id)).length,
                                },
                                {
                                    label: "Sub Modules",
                                    color: "green",
                                    count: duplicateSubModules.filter(sm => sm.courses.includes(previewCourse._id)).length,
                                },
                                {
                                    label: "Topics",
                                    color: "orange",
                                    count: duplicateTopics.filter(t => t.courses.includes(previewCourse._id)).length,
                                },
                                {
                                    label: "Sub Topics",
                                    color: "purple",
                                    count: duplicateSubTopics.filter(st => st.courses === previewCourse._id).length,
                                },
                            ].map((item, index) => (
                                <div
                                    key={index}
                                    className={`flex flex-col items-center justify-center rounded-full border border-${item.color}-200 bg-${item.color}-50 text-${item.color}-700 py-2 px-1 shadow-sm`}
                                >
                                    <span className={`text-${item.color}-600 font-semibold text-[13px]`}>
                                        {item.count}
                                    </span>
                                    <span className="text-[10px] font-medium">{item.label}</span>
                                </div>
                            ))}
                        </div>


                    </div>
                </motion.div>
            </motion.div>
        );
    };

    const hasValuesInSelectedCells = (type: "iDo" | "weDo" | "youDo", activity: string, selectedRows: number[]) => {
        return selectedRows.some(rowIndex => {
            const row = tableRows[rowIndex];
            const hierarchyLevels = selectedCourse?.courseHierarchy.map(l => l.toLowerCase()) || [];

            // Get effective IDs based on hierarchy
            const effectiveTopicId = hierarchyLevels.includes('topic')
                ? row.topicId
                : `${row.moduleId}-default-topic`;
            const effectiveSubtopicId = hierarchyLevels.includes('sub topic')
                ? row.subtopicId
                : hierarchyLevels.includes('topic')
                    ? `${row.topicId}-default-subtopic`
                    : `${row.moduleId}-default-subtopic`;

            // Check for merged cells first
            const mergeInfo = isCellMerged(rowIndex, type, activity);
            if (mergeInfo.isMerged && mergeInfo.value > 0) {
                return true;
            }

            // Check individual cell value
            const cellValue = courseHours[row.moduleId]?.[effectiveTopicId]?.[effectiveSubtopicId]?.[type]?.[activity] || 0;
            return cellValue > 0;
        });
    };
    const mergeCells = (type: "iDo" | "weDo" | "youDo", activity: string, selectedRowsArray?: number[]) => {
        // Use provided selectedRowsArray or get from selectedCells state
        const rowsToMerge = selectedRowsArray || Array.from(selectedCells)
            .filter(key => key.endsWith(`::${type}::${activity}`))
            .map(key => parseInt(key.split('::')[0]))
            .sort((a, b) => a - b);

        if (rowsToMerge.length < 2) {
            showError("Please select at least 2 rows to merge!");
            return;
        }

        // Check if selected rows are consecutive
        let canMerge = true;
        for (let i = 1; i < rowsToMerge.length; i++) {
            if (rowsToMerge[i] !== rowsToMerge[i - 1] + 1) {
                canMerge = false;
                break;
            }
        }

        if (!canMerge) {
            showError("Selected rows must be consecutive to merge!");
            return;
        }

        // Check hierarchy validity for all selected rows


        // Check if any selected cell already has a value
        const hasValues = hasValuesInSelectedCells(type, activity, rowsToMerge);

        if (hasValues) {
            showError(`Cannot merge - one or more selected cells already have values for ${activity} (${type}).`);
            return;
        }
        const mergeStatuses = rowsToMerge.map(rowIndex => {
            const mergeInfo = isCellMerged(rowIndex, type, activity);
            return mergeInfo.isMerged;
        });

        const hasMixedMergeStatus = new Set(mergeStatuses).size > 1;
        if (hasMixedMergeStatus) {
            showError("Cannot merge already merged cells with individual cells!");
            return;
        }
        // Collect all hierarchy IDs from selected rows
        const modules = new Set<string>();
        const subModules = new Set<string>();
        const topics = new Set<string>();
        const subTopics = new Set<string>();
        const rowIds: string[] = [];

        rowsToMerge.forEach(rowIndex => {
            const row = tableRows[rowIndex];
            if (row.moduleId) modules.add(row.moduleId);
            if (row.subModuleId) subModules.add(row.subModuleId);
            if (row.topicId) topics.add(row.topicId);
            if (row.subtopicId) subTopics.add(row.subtopicId);
            rowIds.push(row.rowId);
        });

        // Set up pending merge and show dialog
        setPendingMerge({
            type: type,
            activity,
            selectedRows: rowsToMerge,
            hierarchyIds: {
                modules: Array.from(modules),
                subModules: Array.from(subModules),
                topics: Array.from(topics),
                subTopics: Array.from(subTopics)
            }
        });
        setMergeHours("");
        setShowMergeDialog(true);
    };
    const confirmMerge = async () => {
        if (!pendingMerge || !selectedCourse) return;
        setIsMergeConfirm(true);
        const hours = Number.parseFloat(mergeHours) || 0;
        const { type, activity, selectedRows: selectedRowsArray, hierarchyIds } = pendingMerge;
        if (hasValuesInSelectedCells(type, activity, selectedRowsArray)) {
            setErrorMessage(`Cannot merge - one or more selected cells already have values for ${activity} (${type}).`);
            setShowErrorDialog(true);
            setShowMergeDialog(false);
            return;
        }

        try {
            const columnKey = `${type}-${activity}`;
            const rowIds = selectedRowsArray.map((rowIndex) => tableRows[rowIndex].rowId);

            const newMerge: MergedCell = {
                startRow: selectedRowsArray[0],
                endRow: selectedRowsArray[selectedRowsArray.length - 1],
                value: hours,
                type,
                activity,
                rowIds,
                hierarchyIds: hierarchyIds || {
                    modules: [],
                    subModules: [],
                    topics: [],
                    subTopics: []
                }
            };

            setMergedCells((prev) => ({
                ...prev,
                [columnKey]: [...(prev[columnKey] || []), newMerge],
            }));

            // Prepare pedagogy data based on course hierarchy
            const hierarchyLevels = selectedCourse.courseHierarchy.map(l => l.toLowerCase());
            const pedagogies = [{
                iDo: type === "iDo" ? [{ type: activity, duration: hours }] : [],
                weDo: type === "weDo" ? [{ type: activity, duration: hours }] : [],
                youDo: type === "youDo" ? [{ type: activity, duration: hours }] : [],
                // Only include hierarchy levels that exist in the course
                ...(hierarchyIds?.modules && hierarchyIds.modules.filter(id => !id.includes('placeholder') && !id.includes('none')).length > 0 && {
                    module: hierarchyIds.modules.filter(id => !id.includes('placeholder') && !id.includes('none'))
                }),
                ...(hierarchyIds?.subModules && hierarchyIds.subModules.filter(id => !id.includes('placeholder') && !id.includes('none')).length > 0 && {
                    subModule: hierarchyIds.subModules.filter(id => !id.includes('placeholder') && !id.includes('none'))
                }),
                ...(hierarchyIds?.topics && hierarchyIds.topics.filter(id => !id.includes('placeholder') && !id.includes('none')).length > 0 && {
                    topic: hierarchyIds.topics.filter(id => !id.includes('placeholder') && !id.includes('none'))
                }),
                ...(hierarchyIds?.subTopics && hierarchyIds.subTopics.filter(id => !id.includes('placeholder') && !id.includes('none')).length > 0 && {
                    subTopic: hierarchyIds.subTopics.filter(id => !id.includes('placeholder') && !id.includes('none'))
                })
            }];

            const payload = {
                courses: selectedCourse._id,
                pedagogies: pedagogyViews?.[0]?.pedagogies
                    ? [...pedagogyViews[0].pedagogies, ...pedagogies]
                    : pedagogies,
            };

            // Save to backend
            await pedagogyMutation.mutateAsync(payload);



            setShowSuccessMessage(true);
            setTimeout(() => setShowSuccessMessage(false), 2000);
        } catch (error) {
            console.error("Failed to merge cells:", error);
            alert("Failed to merge cells. Please try again.");
        } finally {

            setIsMergeConfirm(false);
            setShowMergeDialog(false);
            setPendingMerge(null);
            setMergeHours("");
        }
    };
    const unmergeCell = (type: "iDo" | "weDo" | "youDo" | "all", activity: string, mergeIndex: number, hierarchyIds?: any) => {
        // Determine the actual type when "all" is selected
        const actualType = selectedPedagogyTypes.includes("all")
            ? activityTypes["iDo"].includes(activity) ? "iDo"
                : activityTypes["weDo"].includes(activity) ? "weDo"
                    : "youDo"
            : type;

        setPendingUnmerge({
            type: actualType,
            activity,
            mergeIndex,
            hierarchyIds // Add hierarchyIds to pendingUnmerge
        });
        setShowUnmergeDialog(true);
    };
    const confirmUnmerge = async () => confirmUnmergeImpl({ courses, deletePedagogyMutation, mergedCells, modules, pedagogyViews, pendingUnmerge, selectedCourse, setErrorMessage, setIsUnmergeConfirm, setMergedCells, setPendingUnmerge, setShowErrorDialog, setShowSuccessMessage, setShowUnmergeDialog, subModules, subTopics, token, topics })
    const isCellMerged = (rowIndex: number, type: "iDo" | "weDo" | "youDo", activity: string) => isCellMergedImpl(rowIndex, type, activity, { activityTypes, getAffectedRowIds, mergedCells, modules, pedagogyViews, selectedPedagogyTypes, subModules, subTopics, tableRows, topics })
    const getSpans = () => {
        const moduleSpans: { [key: string]: number } = {};
        const subModuleSpans: { [key: string]: number } = {};
        const topicSpans: { [key: string]: number } = {};
        const subtopicSpans: { [key: string]: number } = {};

        const hasSubModules = selectedCourse?.courseHierarchy.includes('Sub Module') || false;
        const hasTopics = selectedCourse?.courseHierarchy.includes('Topic') || false;
        const hasSubTopics = selectedCourse?.courseHierarchy.includes('Sub Topic') || false;

        courseStructure.forEach((module) => {
            let moduleRowCount = 0;
            const moduleSubModules = subModules.filter(sub => sub.moduleId === module.id);

            if (hasSubModules && moduleSubModules.length > 0) {
                moduleSubModules.forEach((subModule) => {
                    let subModuleRowCount = 0;
                    const subModuleTopics = topics.filter(topic => topic.subModuleId === subModule._id);

                    if (hasTopics && subModuleTopics.length > 0) {
                        subModuleTopics.forEach(topic => {
                            const topicSubTopics = hasSubTopics
                                ? subTopics.filter(subTopic => subTopic.topicId === topic._id)
                                : [];
                            const topicRowCount = hasSubTopics && topicSubTopics.length > 0
                                ? topicSubTopics.length
                                : 1;

                            if (hasSubTopics) {
                                subtopicSpans[topic._id] = topicRowCount;
                            }
                            topicSpans[topic._id] = topicRowCount;
                            subModuleRowCount += topicRowCount;
                        });
                    } else {
                        subModuleRowCount = 1;
                    }

                    subModuleSpans[subModule._id] = subModuleRowCount;
                    moduleRowCount += subModuleRowCount;
                });
            } else {
                // No submodules in hierarchy or no submodules exist
                const moduleTopics = topics.filter(topic => topic.moduleId === module.id);

                if (hasTopics && moduleTopics.length > 0) {
                    moduleTopics.forEach(topic => {
                        const topicSubTopics = hasSubTopics
                            ? subTopics.filter(subTopic => subTopic.topicId === topic._id)
                            : [];
                        const topicRowCount = hasSubTopics && topicSubTopics.length > 0
                            ? topicSubTopics.length
                            : 1;

                        if (hasSubTopics) {
                            subtopicSpans[topic._id] = topicRowCount;
                        }
                        topicSpans[topic._id] = topicRowCount;
                        moduleRowCount += topicRowCount;
                    });
                } else {
                    moduleRowCount = 1;
                }
            }

            moduleSpans[module.id] = moduleRowCount;
        });

        return {
            moduleSpans,
            subModuleSpans: hasSubModules ? subModuleSpans : {},
            topicSpans: hasTopics ? topicSpans : {},
            subtopicSpans: hasSubTopics ? subtopicSpans : {}
        };
    };
    const { moduleSpans, subModuleSpans, topicSpans } = getSpans()

    const ValidationFeedback = () => {
        if (!mergeSelectionMode || selectedMergeCells.size === 0) return null;

        const selectedRows = Array.from(selectedMergeCells)
            .map(cellKey => {
                if (mergeSelectionMode === 'level') {
                    const rowId = cellKey.replace('level::', '');
                    return tableRows.findIndex(row => row.rowId === rowId);
                } else {
                    const parts = cellKey.split('::');
                    const rowId = parts.slice(2).join('::');
                    return tableRows.findIndex(row => row.rowId === rowId);
                }
            })
            .filter(idx => idx !== -1)
            .sort((a, b) => a - b);

        // Check if at least 2 rows are selected
        if (selectedRows.length < 2) {
            return (
                <div className="fixed top-40 right-4 z-[60] bg-yellow-900 p-3 rounded-lg shadow-lg border border-yellow-700">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-300" />
                        <span className="text-sm text-yellow-100">Please select at least 2 rows to merge!</span>
                    </div>
                </div>
            );
        }

        // Check if selected rows are consecutive
        let isConsecutive = true;
        for (let i = 1; i < selectedRows.length; i++) {
            if (selectedRows[i] !== selectedRows[i - 1] + 1) {
                isConsecutive = false;
                break;
            }
        }



        // Check hierarchy validity for all selected rows


        if (mergeSelectionMode === 'level') {
            // Check if any selected row already has a level value
            const hasLevelValues = selectedRows.some(rowIndex => {
                const row = tableRows[rowIndex];
                const levelInfo = isLevelMerged(rowIndex);
                return levelInfo.value && levelInfo.value !== "-";
            });

            if (hasLevelValues) {
                return (
                    <div className="fixed top-40 right-4 z-[60] bg-red-900 p-3 rounded-lg shadow-lg border border-red-700">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-red-300" />
                            <span className="text-sm text-red-100">Cannot merge - one or more selected rows already have level values!</span>
                        </div>
                    </div>
                );
            }
            if (!isConsecutive) {
                return (
                    <div className="fixed top-40 right-4 z-[60] bg-yellow-900 p-3 rounded-lg shadow-lg border border-yellow-700">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-yellow-300" />
                            <span className="text-sm text-yellow-100">Selected rows must be consecutive to merge!</span>
                        </div>
                    </div>
                );
            }
        } else {
            // For pedagogy, check if we have a consistent type and activity
            const cellTypes = new Set();
            const cellActivities = new Set();

            Array.from(selectedMergeCells).forEach(cellKey => {
                const parts = cellKey.split('::');
                cellTypes.add(parts[0]);
                cellActivities.add(parts[1]);
            });

            if (cellTypes.size > 1 || cellActivities.size > 1) {
                return (
                    <div className="fixed top-40 right-4 z-[60] bg-red-900 p-3 rounded-lg shadow-lg border border-red-700">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-red-300" />
                            <span className="text-sm text-red-100">Cannot merge different types of activities!</span>
                        </div>
                    </div>
                );
            }

            // Check if any selected cell already has a value (including merged cells)
            const firstCellKey = Array.from(selectedMergeCells)[0];
            const [type, activity] = firstCellKey.split('::').slice(0, 2);

            const hasValues = selectedRows.some(rowIndex => {
                const row = tableRows[rowIndex];
                const hierarchyLevels = selectedCourse?.courseHierarchy.map(l => l.toLowerCase()) || [];
                const effectiveTopicId = hierarchyLevels.includes('topic')
                    ? row.topicId
                    : `${row.moduleId}-default-topic`;
                const effectiveSubtopicId = hierarchyLevels.includes('sub topic')
                    ? row.subtopicId
                    : hierarchyLevels.includes('topic')
                        ? `${row.topicId}-default-subtopic`
                        : `${row.moduleId}-default-subtopic`;

                // Check for merged cells first
                const mergeInfo = isCellMerged(rowIndex, type as "iDo" | "weDo" | "youDo", activity);
                if (mergeInfo.isMerged && mergeInfo.value > 0) {
                    return true;
                }

                // Check individual cell value
                const cellValue = courseHours[row.moduleId]?.[effectiveTopicId]?.[effectiveSubtopicId]?.[type as "iDo" | "weDo" | "youDo"]?.[activity] || 0;
                return cellValue > 0;
            });

            if (hasValues) {
                return (
                    <div className="fixed top-40 right-4 z-[60] bg-red-900 p-3 rounded-lg shadow-lg border border-red-700">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-red-300" />
                            <span className="text-sm text-red-100">Cannot merge - one or more selected cells already have values!</span>
                        </div>
                    </div>
                );
            }

            // Check if we're trying to merge a mix of merged and unmerged cells
            const mergeStatuses = selectedRows.map(rowIndex => {
                const mergeInfo = isCellMerged(rowIndex, type as "iDo" | "weDo" | "youDo", activity);
                return mergeInfo.isMerged;
            });

            const hasMixedMergeStatus = new Set(mergeStatuses).size > 1;
            if (hasMixedMergeStatus) {
                return (
                    <div className="fixed top-40 right-4 z-[60] bg-red-900 p-3 rounded-lg shadow-lg border border-red-700">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-red-300" />
                            <span className="text-sm text-red-100">Cannot merge already merged cells with individual cells!</span>
                        </div>
                    </div>
                );
            }
            if (!isConsecutive) {
                return (
                    <div className="fixed top-40 right-4 z-[60] bg-yellow-900 p-3 rounded-lg shadow-lg border border-yellow-700">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-yellow-300" />
                            <span className="text-sm text-yellow-100">Selected rows must be consecutive to merge!</span>
                        </div>
                    </div>
                );
            }
        }

        return (
            <div className="fixed top-40 right-4 z-[60] bg-green-900 p-3 rounded-lg shadow-lg border border-green-700">
                <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-300" />
                    <span className="text-sm text-green-100">Selection valid for merging</span>
                </div>
            </div>
        );
    };
    const handleLevelSave = async () => {
        if (!editingLevel || !selectedCourse) return;
        setIsLevelSave(true);

        try {
            const hierarchyLevels = selectedCourse.courseHierarchy.map(l => l.toLowerCase());
            const filterPlaceholders = (ids: string[] = []) => {
                return ids.filter(id => id && !id.includes('placeholder'));
            };
            const levelData = {
                // Only include non-placeholder hierarchy levels
                ...(hierarchyLevels.includes("module") && editingLevel.hierarchy.module && {
                    module: filterPlaceholders(editingLevel.hierarchy.module)
                }),
                ...(hierarchyLevels.includes("sub module") && editingLevel.hierarchy.subModule && {
                    subModule: filterPlaceholders(editingLevel.hierarchy.subModule)
                }),
                ...(hierarchyLevels.includes("topic") && editingLevel.hierarchy.topic && {
                    topic: filterPlaceholders(editingLevel.hierarchy.topic)
                }),
                ...(hierarchyLevels.includes("sub topic") && editingLevel.hierarchy.subTopic && {
                    subTopic: filterPlaceholders(editingLevel.hierarchy.subTopic)
                }),
                level: editingLevel.level,
            };

            await levelViewMutation.mutateAsync({
                courses: selectedCourse._id,
                levels: [...levelsData.filter((l: { module: any; subModule: any; topic: any; subTopic: any; }) =>
                    !(JSON.stringify(l.module || []) === JSON.stringify(levelData.module || []) &&
                        JSON.stringify(l.subModule || []) === JSON.stringify(levelData.subModule || []) &&
                        JSON.stringify(l.topic || []) === JSON.stringify(levelData.topic || []) &&
                        JSON.stringify(l.subTopic || []) === JSON.stringify(levelData.subTopic || []))
                ), levelData]
            });

            setShowLevelDialog(false);
            setEditingLevel(null);
        } catch (error) {
            console.error("Failed to save level:", error);
            setErrorMessage(error instanceof Error ? error.message : "Failed to save level");
            setShowErrorDialog(true);
        } finally {
            setIsLevelSave(false);
        }
    };
    const confirmLevelMerge = async () => {
        if (!pendingLevelMerge || !selectedCourse) return;
        setIsLevelMergeSave(true);

        try {
            const { selectedRows: selectedRowsArray, hierarchyIds } = pendingLevelMerge;
            const filterPlaceholders = (ids: string[] = []) => {
                return ids.filter(id => id && !id.includes('placeholder'));
            };
            const filteredHierarchyIds = {
                modules: filterPlaceholders(hierarchyIds?.modules),
                subModules: filterPlaceholders(hierarchyIds?.subModules),
                topics: filterPlaceholders(hierarchyIds?.topics),
                subTopics: filterPlaceholders(hierarchyIds?.subTopics)
            };
            const levelData = {
                // Only include non-placeholder hierarchy levels
                ...(filteredHierarchyIds.modules.length > 0 && { module: filteredHierarchyIds.modules }),
                ...(filteredHierarchyIds.subModules.length > 0 && { subModule: filteredHierarchyIds.subModules }),
                ...(filteredHierarchyIds.topics.length > 0 && { topic: filteredHierarchyIds.topics }),
                ...(filteredHierarchyIds.subTopics.length > 0 && { subTopic: filteredHierarchyIds.subTopics }),
                level: mergeLevelValue,
            };

            await levelViewMutation.mutateAsync({
                courses: selectedCourse._id,
                levels: [...levelsData, levelData]
            });


            setShowMergeLevelDialog(false);
            setPendingLevelMerge(null);
            setMergeLevelValue("");
        } catch (error) {
            console.error("Failed to merge levels:", error);
            setErrorMessage(error instanceof Error ? error.message : "Failed to merge levels");
            setShowErrorDialog(true);
        } finally {
            setIsLevelMergeSave(false);
        }
    };
    const isLevelMerged = (rowIndex: number) => isLevelMergedImpl(rowIndex, { getAffectedRowIds, levelsData, modules, subModules, subTopics, tableRows, topics })
    const handleDeleteLevel = (row: any, mergeInfo: any) => handleDeleteLevelImpl(row, mergeInfo, { levelsData, setErrorMessage, setLevelToDelete, setShowErrorDialog, setShowLevelDeleteConfirmation, unmergeLevel })

    // Helper function to compare arrays
    const arraysEqual = (a: any[], b: any[]) => {
        if (a.length !== b.length) return false;
        const sortedA = [...a].sort();
        const sortedB = [...b].sort();
        return sortedA.every((val, index) => val === sortedB[index]);
    };
    const renderLevelCell = (row: any, rowIndex: number) => {
        const mergeInfo = isLevelMerged(rowIndex);

        const isSelected = selectedMergeCells.has(`level::${row.rowId}`);
        const disabledClass = "cursor-pointer";
        const showCheckbox = mergeSelectionMode === 'level' && selectedMergeCells.size > 0;
        const hasValue = mergeInfo.value && mergeInfo.value !== "-";
        // Skip rendering if this is part of a merged cell but not the first row
        if (mergeInfo.isMerged && !mergeInfo.isStart) return null;

        const openLevelAdd = () => {
            // Handle add level for empty cell
            setIsNewLevel(true);
            setEditingLevel({
                id: null,
                level: '',
                hierarchy: {
                    module: [row.moduleId],
                    subModule: row.subModuleId ? [row.subModuleId] : [],
                    topic: row.topicId ? [row.topicId] : [],
                    subTopic: row.subtopicId ? [row.subtopicId] : []
                }
            });
            setShowLevelDialog(true);
        };

        const openLevelEdit = () => {
            // For merged cells, use the hierarchy IDs from the merge info
            setIsNewLevel(false);

            // For merged cells, use the hierarchy IDs from the merge info
            // For single cells, use the row's hierarchy
            const hierarchyData: any = mergeInfo.isMerged
                ? mergeInfo.hierarchyIds
                : {
                    modules: [row.moduleId],
                    subModules: row.subModuleId ? [row.subModuleId] : [],
                    topics: row.topicId ? [row.topicId] : [],
                    subTopics: row.subtopicId ? [row.subtopicId] : []
                };

            // Find the existing level data for editing
            let existingLevelId = null;
            if (!mergeInfo.isMerged) {
                const existingLevel = levelsData.find((l: any) =>
                    l.level === mergeInfo.value &&
                    JSON.stringify(l.module || []) === JSON.stringify(hierarchyData.modules) &&
                    JSON.stringify(l.subModule || []) === JSON.stringify(hierarchyData.subModules) &&
                    JSON.stringify(l.topic || []) === JSON.stringify(hierarchyData.topics) &&
                    JSON.stringify(l.subTopic || []) === JSON.stringify(hierarchyData.subTopics)
                );
                existingLevelId = existingLevel?._id || null;
            }

            setEditingLevel({
                id: mergeInfo.isMerged ? 'merged' : existingLevelId,
                level: mergeInfo.value,
                hierarchy: {
                    ...(selectedCourse?.courseHierarchy.includes("Module") && {
                        module: hierarchyData.modules
                    }),
                    ...(selectedCourse?.courseHierarchy.includes("Sub Module") && {
                        subModule: hierarchyData.subModules
                    }),
                    ...(selectedCourse?.courseHierarchy.includes("Topic") && {
                        topic: hierarchyData.topics
                    }),
                    ...(selectedCourse?.courseHierarchy.includes("Sub Topic") && {
                        subTopic: hierarchyData.subTopics
                    }),
                }
            });
            setShowLevelDialog(true);
        };

        // Double-click opens the same dialog the ⋮ menu does: Add on an empty
        // cell, Edit once it has a value. Suppressed while picking cells to
        // merge, where a stray double-click would fight the selection.
        const handleLevelDoubleClick = () => {
            if (mergeSelectionMode) return;
            if (hasValue) openLevelEdit(); else openLevelAdd();
        };

        return (
            <motion.td
                key={`level-${row.rowId}`}
                onDoubleClick={handleLevelDoubleClick}
                title={hasValue ? "Double-click to edit level" : "Double-click to add level"}
                className={`border-r border-b border-gray-400 text-center align-middle text-[10px] p-0.5 transition-colors select-none
        ${mergeInfo.isMerged ? "bg-[#FFD9BC] hover:bg-[#FDBA74]" : "bg-[#FFF3EA] hover:bg-[#FFE4D0]"}
        ${mergeInfo.isMerged ? "font-bold" : ""}
        min-w-[80px] h-[32px]
        ${disabledClass}
        sticky bg-white z-20
        ${isSelected ? "bg-[#FFD9BC] border-2 border-[#F97316] shadow-[0_0_0_2px_#F97316_inset]" : ""}`}
                style={{
                    left: getStickyLeftPosition(selectedCourse?.courseHierarchy.length || 0),
                }}
                rowSpan={mergeInfo.rowSpan}

            >
                {/* Value centers across the full merged area via the cell's own
                    text-center + align-middle (immune to rowSpan/% quirks).
                    pr-4 keeps a multi-level value ("Easy & Medium") clear of the
                    ⋮ menu pinned to the right edge; it wraps rather than clipping. */}
                <span className="block px-1 pr-4 leading-tight whitespace-normal break-words">
                    {mergeInfo.value || "-"}
                </span>

                {/* Right End - Action Menu or Checkbox (td is sticky-positioned,
                    so it is the containing block for this overlay) */}
                <div className="absolute right-0 top-1/2 transform -translate-y-1/2 z-10">
                        {showCheckbox ? (
                            <Checkbox
                                checked={selectedMergeCells.has(`level::${row.rowId}`)}
                                onCheckedChange={() => {


                                    setSelectedMergeCells(prev => {
                                        const newSelection = new Set(prev);
                                        if (newSelection.has(`level::${row.rowId}`)) {
                                            newSelection.delete(`level::${row.rowId}`);
                                        } else {
                                            newSelection.add(`level::${row.rowId}`);
                                        }
                                        return newSelection;
                                    });
                                }}

                                className="mr-1 h-5 w-5 rounded-sm border-1 border-gray-500
             data-[state=checked]:bg-gray-900 data-[state=checked]:border-gray-900
             data-[state=checked]:text-white shadow-sm transition-colors
             hover:border-gray-600 focus:outline-none"
                            />
                        ) : (
                            directActionsEnabled && (
                                <CellActionMenu
                                    cellType="level"
                                    cellKey={`level-${row.rowId}`}
                                    hasValue={hasValue}
                                    isMerged={mergeInfo.isMerged}

                                    onAdd={openLevelAdd}
                                    onEdit={openLevelEdit}
                                    onDelete={() => {
                                        handleDeleteLevel(row, mergeInfo);
                                    }}
                                    onMerge={() => {
                                        setMergeSelectionMode('level');
                                        setSelectedMergeCells(new Set([`level::${row.rowId}`]));
                                    }}
                                    onUnmerge={mergeInfo.isMerged ? () => {
                                        if (mergeInfo.mergeIndex !== -1) {
                                            unmergeLevel(mergeInfo.mergeIndex);
                                        } else {
                                            // Find backend level data using the same logic as isLevelMerged
                                            const backendLevel = levelsData.find((l: any) => {
                                                const levelModules = l.module || [];
                                                const levelSubModules = l.subModule || [];
                                                const levelTopics = l.topic || [];
                                                const levelSubTopics = l.subTopic || [];

                                                // Check module level
                                                if (levelModules.length > 0 && !levelModules.includes(row.moduleId)) {
                                                    return false; // Module doesn't match
                                                }

                                                // Check submodule level with hierarchical logic
                                                if (levelSubModules.length > 0) {
                                                    // If row has a submodule, it must match one of the specified submodules
                                                    if (row.subModuleId && !row.subModuleId.includes('placeholder')) {
                                                        if (!levelSubModules.includes(row.subModuleId)) {
                                                            return false; // Submodule doesn't match
                                                        }
                                                    }
                                                    // If row has no submodule (module-level row), it's still valid
                                                } else {
                                                    // If no submodules specified but row has a real submodule, skip
                                                    if (row.subModuleId && !row.subModuleId.includes('placeholder')) {
                                                        return false;
                                                    }
                                                }

                                                // Check topic level with hierarchical logic
                                                if (levelTopics.length > 0) {
                                                    // If row has a topic, it must match one of the specified topics
                                                    if (row.topicId && !row.topicId.includes('placeholder')) {
                                                        if (!levelTopics.includes(row.topicId)) {
                                                            return false; // Topic doesn't match
                                                        }
                                                    }
                                                    // If row has no topic (higher-level row), it's still valid
                                                } else {
                                                    // If no topics specified but row has a real topic, skip
                                                    if (row.topicId && !row.topicId.includes('placeholder')) {
                                                        return false;
                                                    }
                                                }

                                                // Check subtopic level with hierarchical logic
                                                if (levelSubTopics.length > 0) {
                                                    // If row has a subtopic, it must match one of the specified subtopics
                                                    if (row.subtopicId && !row.subtopicId.includes('placeholder')) {
                                                        if (!levelSubTopics.includes(row.subtopicId)) {
                                                            return false; // Subtopic doesn't match
                                                        }
                                                    }
                                                    // If row has no subtopic (higher-level row), it's still valid
                                                } else {
                                                    // If no subtopics specified but row has a real subtopic, skip
                                                    if (row.subtopicId && !row.subtopicId.includes('placeholder')) {
                                                        return false;
                                                    }
                                                }

                                                return true;
                                            });

                                            if (backendLevel) {
                                                unmergeLevel(-1, backendLevel);
                                            } else {
                                                setErrorMessage("Could not find level data to unmerge");
                                                setShowErrorDialog(true);
                                            }
                                        }
                                    } : undefined}

                                />
                            )
                        )}
                </div>
            </motion.td>
        );
    };
    const unmergeLevel = async (mergeIndex: number, levelData?: any) => {
        if (mergeIndex === -1 && levelData) {
            // This is a backend level deletion (unmerge)
            // Set up pending unmerge and show confirmation dialog
            setPendingLevelUnmerge({
                mergeIndex,
                levelData
            });
            setShowUnmergeLevelDialog(true);
        } else {
            // For frontend merged levels
            setPendingLevelUnmerge({ mergeIndex, levelData });
            setShowUnmergeLevelDialog(true);
        }
    };
    const confirmLevelUnmerge = async () => {
        if (!pendingLevelUnmerge) {
            setShowUnmergeLevelDialog(false);
            return;
        }
        setIsLevelUnmergeConfirm(true);

        try {
            const { mergeIndex, levelData } = pendingLevelUnmerge;

            if (mergeIndex === -1 && levelData) {
                // Handle backend level unmerge
                try {
                    // Filter placeholder IDs before deletion
                    const filterPlaceholders = (ids: string[] = []) => {
                        return ids.filter(id => id && !id.includes('placeholder'));
                    };

                    const filteredHierarchy = {
                        module: filterPlaceholders(levelData.module),
                        subModule: filterPlaceholders(levelData.subModule),
                        topic: filterPlaceholders(levelData.topic),
                        subTopic: filterPlaceholders(levelData.subTopic)
                    };

                    // Find the exact level to delete using filtered hierarchy
                    const exactLevelData = levelsData.find((l: any) => {
                        const levelModules = filterPlaceholders(l.module || []);
                        const levelSubModules = filterPlaceholders(l.subModule || []);
                        const levelTopics = filterPlaceholders(l.topic || []);
                        const levelSubTopics = filterPlaceholders(l.subTopic || []);

                        return (
                            arraysEqual(levelModules, filteredHierarchy.module) &&
                            arraysEqual(levelSubModules, filteredHierarchy.subModule) &&
                            arraysEqual(levelTopics, filteredHierarchy.topic) &&
                            arraysEqual(levelSubTopics, filteredHierarchy.subTopic) &&
                            l.level === levelData.level
                        );
                    });

                    if (exactLevelData?._id) {
                        await deleteLevelMutation.mutateAsync(exactLevelData._id);
                        setShowSuccessMessage(true);
                        setTimeout(() => setShowSuccessMessage(false), 2000);
                    } else {
                        setErrorMessage("Level not found for unmerge");
                        setShowErrorDialog(true);
                    }
                } catch (error) {
                    console.error("Failed to unmerge level:", error);
                    setErrorMessage(error instanceof Error ? error.message : "Failed to unmerge level");
                    setShowErrorDialog(true);
                }
            } else if (mergeIndex !== -1) {
                // Handle local merged levels
                setMergedLevels(prev => prev.filter((_, i) => i !== mergeIndex));
            }

            setShowSuccessMessage(true);
            setTimeout(() => setShowSuccessMessage(false), 2000);
        } catch (error) {
            console.error("Failed to unmerge level:", error);
            setErrorMessage(error instanceof Error ? error.message : "Failed to unmerge level");
            setShowErrorDialog(true);
        } finally {
            setShowUnmergeLevelDialog(false);
            setPendingLevelUnmerge(null);
            setIsLevelUnmergeConfirm(false);
        }
    };
    const handleEdit = useCallback(async (type: 'module' | 'submodule' | 'topic' | 'subtopic', data: any) => {
        setEditMode({ type, data });

        const existingLevelData = preserveLevelDataForEditing(type, data._id);
        setEditingExistingLevelData(existingLevelData);

        // Reset form data first
        if (type === 'module') {
            setModuleFormData({
                title: data.title,
                description: data.description || '',
                level: data.level || 'Easy',
                duration: data.duration || 0,
                index: data.index || 0
            });

            // CRITICAL: Set test configuration with a new object reference
            const testConfig = {
                coreProgram: data.testConfiguration?.coreProgram ? [...data.testConfiguration.coreProgram] : [],
                frontend: data.testConfiguration?.frontend ? [...data.testConfiguration.frontend] : [],
                database: data.testConfiguration?.database ? [...data.testConfiguration.database] : []
            };
            console.log('Setting test config for edit:', testConfig);
            setModuleTestConfig(testConfig);

            setDialogType('module');
        } else if (type === 'submodule') {
            setSubModuleFormData({
                title: data.title,
                description: data.description || '',
                level: data.level || 'Easy',
                duration: data.duration || 0
            });

            const testConfig = {
                coreProgram: data.testConfiguration?.coreProgram ? [...data.testConfiguration.coreProgram] : [],
                frontend: data.testConfiguration?.frontend ? [...data.testConfiguration.frontend] : [],
                database: data.testConfiguration?.database ? [...data.testConfiguration.database] : []
            };
            setModuleTestConfig(testConfig);

            const parentModule = modules.find(m => m._id === data.moduleId);
            if (parentModule) {
                setSelectedModuleForSubModule({
                    id: parentModule._id,
                    name: parentModule.title
                });
            }
            setDialogType('submodule');
        } else if (type === 'topic') {
            setTopicFormData({
                title: data.title,
                description: data.description || '',
                level: data.level || 'Easy',
                duration: data.duration || 0
            });

            const testConfig = {
                coreProgram: data.testConfiguration?.coreProgram ? [...data.testConfiguration.coreProgram] : [],
                frontend: data.testConfiguration?.frontend ? [...data.testConfiguration.frontend] : [],
                database: data.testConfiguration?.database ? [...data.testConfiguration.database] : []
            };
            setModuleTestConfig(testConfig);

            const parentModule = modules.find(m => m._id === data.moduleId);
            const hierarchyLevels = selectedCourse?.courseHierarchy.map(level => level.toLowerCase()) || [];
            if (hierarchyLevels.includes('sub module')) {
                const parentSubModule = subModules.find(sm => sm._id === data.subModuleId);
                if (parentSubModule) {
                    setSelectedSubModuleForTopic({
                        id: parentSubModule._id,
                        moduleId: parentSubModule.moduleId,
                        name: parentSubModule.title
                    });
                }
            } else {
                if (parentModule) {
                    setSelectedSubModuleForTopic({
                        id: parentModule._id,
                        moduleId: parentModule._id,
                        name: parentModule.title
                    });
                }
            }
            setDialogType('topic');
        } else if (type === 'subtopic') {
            setSubTopicFormData({
                title: data.title,
                description: data.description || '',
                level: data.level || 'Easy',
                duration: data.duration || 0
            });

            const testConfig = {
                coreProgram: data.testConfiguration?.coreProgram ? [...data.testConfiguration.coreProgram] : [],
                frontend: data.testConfiguration?.frontend ? [...data.testConfiguration.frontend] : [],
                database: data.testConfiguration?.database ? [...data.testConfiguration.database] : []
            };
            setModuleTestConfig(testConfig);

            const parentTopic = topics.find(t => t._id === data.topicId);
            if (parentTopic) {
                setSelectedTopicForSubTopic({
                    id: parentTopic._id,
                    moduleId: parentTopic.moduleId,
                    subModuleId: parentTopic.subModuleId,
                    name: parentTopic.title
                });
            }
            setDialogType('subtopic');
        }

        await fetchAndSetLevelData(type, data._id);
        await fetchAndSetPedagogyData(type, data._id);
        setShowDialog(true);
    }, [modules, subModules, topics, selectedCourse]);

    const fetchAndSetLevelData = async (type: string, id: string) => {
        if (!levelViews || !selectedCourse) return;

        // This item's OWN level row only — a descendant's level row also carries
        // this id, and prefilling from it would rewrite that row on save.
        const levelData = levelsData.find((level: any) =>
            isOwnLevelRow(level, type as HierarchyType, id)
        );

        if (levelData) {
            setShowLevelSection(true);
            setSelectedLevel(levelData.level);

            // Collect ALL hierarchy IDs from the existing level data
            const allModuleIds = new Set(levelData.module || []);
            const allSubModuleIds = new Set(levelData.subModule || []);
            const allTopicIds = new Set(levelData.topic || []);
            const allSubTopicIds = new Set(levelData.subTopic || []);

            // Set saved merge selections with ALL hierarchy IDs
            setSavedLevelMergeSelections({
                modules: Array?.from(allModuleIds),
                subModules: Array.from(allSubModuleIds),
                topics: Array.from(allTopicIds),
                subTopics: Array.from(allSubTopicIds)
            });

            // Also set the selection sets for editing
            setSelectedLevelModulesForMerge(new Set(levelData.module || []));
            setSelectedLevelSubModulesForMerge(new Set(levelData.subModule || []));
            setSelectedLevelTopicsForMerge(new Set(levelData.topic || []));
            setSelectedLevelSubTopicsForMerge(new Set(levelData.subTopic || []));

            // Enable merge section for editing
            // setShowMergeLevelSection(true);
        } else {
            // No level data found, clear everything
            setShowLevelSection(false);
            setSelectedLevel('');
            setSavedLevelMergeSelections(null);
            setSelectedLevelModulesForMerge(new Set());
            setSelectedLevelSubModulesForMerge(new Set());
            setSelectedLevelTopicsForMerge(new Set());
            setSelectedLevelSubTopicsForMerge(new Set());
            setShowMergeLevelSection(false);
        }
    };

    const fetchAndSetPedagogyData = async (type: string, id: string) => fetchAndSetPedagogyDataImpl(type, id, { modules, pedagogyViews, selectedCourse, setPedagogyHours, setSavedPedagogyMergeSelections, setSelectedPedagogyActivities, setShowPedagogySection, subModules, subTopics, topics })

    const handleDeleteClick = (type: 'module' | 'submodule' | 'topic' | 'subtopic', id: string) => {
        setItemToDelete({ type, id });
        setShowDeleteDialog(true);
    };
    const confirmDelete = async () => {
        if (!itemToDelete || !token) return;
        setIsConfirmDelete(true);
        try {
            let model: 'Module1' | 'SubModule1' | 'Topic1' | 'SubTopic1';

            // Map the item type to the corresponding model
            switch (itemToDelete.type) {
                case 'module':
                    model = 'Module1';
                    break;
                case 'submodule':
                    model = 'SubModule1';
                    break;
                case 'topic':
                    model = 'Topic1';
                    break;
                case 'subtopic':
                    model = 'SubTopic1';
                    break;
                default:
                    throw new Error('Invalid item type');
            }

            await deleteDocumentMutation.mutateAsync({
                model,
                id: itemToDelete.id
            });

            // Refresh data
            if (selectedCourse) {
                await fetchModulesForCourse();
                await refetchModules();

                await refetchSubModules();

                await refetchTopics();
                queryClient.invalidateQueries({ queryKey: ['levelViews'] });
                await refetchSubTopics();
                if (selectedTopicForSubTopic?.id) {
                    await refetchTopicSubTopics();
                }
            }

            setShowSuccessMessage(true);
            setTimeout(() => setShowSuccessMessage(false), 2000);
        } catch (error) {
            console.error("Failed to delete:", error);
            setErrorMessage(error instanceof Error ? error.message : "Failed to delete item");
            setShowErrorDialog(true);
        } finally {
            setShowDeleteDialog(false);
            setItemToDelete(null);
            setIsConfirmDelete(false);
        }
    };

    // Helper function to get immediate children for a specific parent
    const getImmediateChildrenForParent = (parentType: 'module' | 'submodule' | 'topic', parentId: string) => {
        switch (parentType) {
            case 'module':
                // For module, show submodules if they exist, otherwise show topics
                if (selectedCourse?.courseHierarchy.includes('Sub Module')) {
                    return sortedSubModules.filter(sub => sub.moduleId === parentId);
                } else if (selectedCourse?.courseHierarchy.includes('Topic')) {
                    return sortedTopics.filter(topic => topic.moduleId === parentId);
                }
                return [];

            case 'submodule':
                // For submodule, show topics
                return sortedTopics.filter(topic => topic.subModuleId === parentId);

            case 'topic':
                // For topic, show subtopics
                return sortedSubTopics.filter(subtopic => subtopic.topicId === parentId);

            default:
                return [];
        }
    };

    // Function to activate hierarchical delete mode from CellActionsMenu
    const activateHierarchicalDeleteMode = (parentType: 'module' | 'submodule' | 'topic', parentId: string) => {
        const children = getImmediateChildrenForParent(parentType, parentId);

        if (children.length === 0) {
            setErrorMessage(`No ${getChildType(parentType)} found for this ${parentType}`);
            setShowErrorDialog(true);
            return;
        }

        const childType = getChildType(parentType);

        // Set hierarchical delete mode
        setHierarchicalDeleteMode({
            parentType,
            parentId,
            childType
        });

        // Also set the regular delete mode for the floating actions
        setDeleteMode({
            type: childType,
            selectedItems: new Set()
        });
    };

    // Helper to get child type name
    const getChildType = (parentType: 'module' | 'submodule' | 'topic'): 'submodule' | 'topic' | 'subtopic' => {
        switch (parentType) {
            case 'module':
                return selectedCourse?.courseHierarchy.includes('Sub Module') ? 'submodule' : 'topic';
            case 'submodule':
                return 'topic';
            case 'topic':
                return 'subtopic';
            default:
                return 'subtopic';
        }
    };

    // Check if item should show checkbox in hierarchical delete mode
    const shouldShowHierarchicalCheckbox = (itemType: 'submodule' | 'topic' | 'subtopic', itemId: string) => {
        if (!hierarchicalDeleteMode || hierarchicalDeleteMode.childType !== itemType) return false;

        const children = getImmediateChildrenForParent(hierarchicalDeleteMode.parentType, hierarchicalDeleteMode.parentId);
        return children.some(child => child._id === itemId);
    };

    // Helper function to get immediate children based on hierarchy
    const getImmediateChildren = (parentType: 'module' | 'submodule' | 'topic', parentId: string) => {
        switch (parentType) {
            case 'module':
                // For module, show submodules if they exist, otherwise show topics
                if (selectedCourse?.courseHierarchy.includes('Sub Module')) {
                    return sortedSubModules.filter(sub => sub.moduleId === parentId);
                } else if (selectedCourse?.courseHierarchy.includes('Topic')) {
                    return sortedTopics.filter(topic => topic.moduleId === parentId);
                }
                return [];

            case 'submodule':
                // For submodule, show topics
                return sortedTopics.filter(topic => topic.subModuleId === parentId);

            case 'topic':
                // For topic, show subtopics
                return sortedSubTopics.filter(subtopic => subtopic.topicId === parentId);

            default:
                return [];
        }
    };


    // Helper function to check if item should show checkbox in hierarchical delete mode
    const shouldShowCheckbox = (itemType: 'module' | 'submodule' | 'topic' | 'subtopic', itemId: string) => {
        if (!deleteMode.type || deleteMode.type !== itemType) return false;

        // Get all items of the current delete mode type
        const items = getItemsForDeletion(deleteMode.type);

        // Check if this item exists in the available items for deletion
        return items.some(item => item._id === itemId);
    };

    const handleMultipleDeleteClick = () => {
        setShowMultipleDeleteDialog(true);
    };


    const activateGlobalDeleteMode = (type: 'module' | 'submodule' | 'topic' | 'subtopic') => {
        setDeleteMode({
            type,
            selectedItems: new Set()
        });
        setHierarchicalDeleteMode(null); // Ensure no hierarchical mode
        setShowMultipleDeleteDialog(false);
    };
    // Function to cancel delete mode
    // Function to cancel delete mode
    const cancelDeleteMode = () => {
        setDeleteMode({
            type: null,
            selectedItems: new Set()
        });
        setHierarchicalDeleteMode(null); // Reset hierarchical mode
        setShowDeleteConfirmation(false);
    };

    // Function to handle item selection in delete mode
    const handleDeleteModeSelection = (id: string, checked: boolean) => {
        setDeleteMode(prev => ({
            ...prev,
            selectedItems: new Set(checked ? [...prev.selectedItems, id] : [...prev.selectedItems].filter(item => item !== id))
        }));
    };

    // Function to handle select all in delete mode
    const handleDeleteModeSelectAll = (checked: boolean, items: any[]) => {
        setDeleteMode(prev => ({
            ...prev,
            selectedItems: checked ? new Set(items.filter(item => !isDefaultItem(item.title)).map(item => item._id)) : new Set()
        }));
    };

    const confirmMultipleDelete = async () => {
        if (!deleteMode.type || deleteMode.selectedItems.size === 0 || !token) return;
        setIsConfirmMultiDelete(true);
        try {
            let model: 'Module1' | 'SubModule1' | 'Topic1' | 'SubTopic1';

            // Map the item type to the corresponding model
            switch (deleteMode.type) {
                case 'module':
                    model = 'Module1';
                    break;
                case 'submodule':
                    model = 'SubModule1';
                    break;
                case 'topic':
                    model = 'Topic1';
                    break;
                case 'subtopic':
                    model = 'SubTopic1';
                    break;
                default:
                    throw new Error('Invalid item type');
            }

            // Convert Set to comma-separated string
            const idsToDelete = Array.from(deleteMode.selectedItems).join(',');

            await deleteDocumentMutation.mutateAsync({
                model,
                id: idsToDelete
            });

            // Refresh data
            if (selectedCourse) {
                await fetchModulesForCourse();
                await refetchModules();
                await refetchSubModules();
                await refetchTopics();
                queryClient.invalidateQueries({ queryKey: ['levelViews'] });
                await refetchSubTopics();
                if (selectedTopicForSubTopic?.id) {
                    await refetchTopicSubTopics();
                }
            }

            setShowSuccessMessage(true);
            setTimeout(() => setShowSuccessMessage(false), 2000);
            setShowDeleteConfirmation(false);
            // Close delete mode
            cancelDeleteMode();
        } catch (error) {
            console.error("Failed to delete items:", error);
            setErrorMessage(error instanceof Error ? error.message : "Failed to delete items");
            setShowErrorDialog(true);
        } finally {
            setIsConfirmMultiDelete(false);
        }
    };
    // Helper functions for multiple delete
    const getItemsForDeletion = (type: 'module' | 'submodule' | 'topic' | 'subtopic') => {
        switch (type) {
            case 'module':
                return sortedModules.filter(module => !isDefaultItem(module.title));
            case 'submodule':
                return sortedSubModules.filter(subModule => !isDefaultItem(subModule.title));
            case 'topic':
                return sortedTopics.filter(topic => !isDefaultItem(topic.title));
            case 'subtopic':
                return sortedSubTopics.filter(subTopic => !isDefaultItem(subTopic.title));
            default:
                return [];
        }
    };

    const zoomTableIn = () => {
        setTableZoomLevel((prev) => Math.min(prev + 0.1, 1))
    }
    const zoomTableOut = () => {
        setTableZoomLevel((prev) => Math.max(prev - 0.1, 0.5))
    }
    const resetTableZoom = () => {
        setTableZoomLevel(1)
    }
    const isDefaultItem = (name: string) => {
        return name.includes("Default") || name === "-" || name === "" || name.includes("placeholder");
    };
    const MergeButton = () => {
        if (selectedMergeCells.size < 2 || !mergeSelectionMode) return null;

        const handleMerge = () => {
            const selectedRows = Array.from(selectedMergeCells)
                .map(cellKey => {
                    if (mergeSelectionMode === 'level') {
                        const rowId = cellKey.replace('level::', '');
                        return tableRows.findIndex(row => row.rowId === rowId);
                    } else {
                        const parts = cellKey.split('::');
                        const type = parts[0] as "iDo" | "weDo" | "youDo";
                        const activity = parts[1];
                        const rowId = parts.slice(2).join('::');
                        const rowIndex = tableRows.findIndex(row => row.rowId === rowId);
                        return { rowIndex, type, activity };
                    }
                })
                .filter((item: any) => {
                    if (mergeSelectionMode === 'level') {
                        return item !== -1;
                    } else {
                        return item?.rowIndex !== -1;
                    }
                })
                .sort((a: any, b: any) => {
                    if (mergeSelectionMode === 'level') {
                        return a - b;
                    } else {
                        return a.rowIndex - b.rowIndex;
                    }
                });

            // Check if at least 2 rows are selected
            if (selectedRows.length < 2) {
                showError("Please select at least 2 rows to merge!");
                return;
            }

            // Extract row indices for validation
            const rowIndices = mergeSelectionMode === 'level'
                ? selectedRows as number[]
                : (selectedRows as { rowIndex: number; type: string; activity: string }[]).map(item => item.rowIndex);

            // Check if selected rows are consecutive
            let canMerge = true;
            for (let i = 1; i < rowIndices.length; i++) {
                if (rowIndices[i] !== rowIndices[i - 1] + 1) {
                    canMerge = false;
                    break;
                }
            }

            if (!canMerge) {
                showError("Selected rows must be consecutive to merge!");
                return;
            }

            // Check hierarchy validity for all selected rows


            if (mergeSelectionMode === 'level') {
                // Check if any selected row already has a level value
                const hasLevelValues = (selectedRows as number[]).some(rowIndex => {
                    const row = tableRows[rowIndex];
                    const levelInfo = isLevelMerged(rowIndex);
                    return levelInfo.value && levelInfo.value !== "-";
                });

                if (hasLevelValues) {
                    showError("Cannot merge - one or more selected rows already have level values!");
                    return;
                }

                // Collect hierarchy IDs based on course structure
                const hierarchyLevels = selectedCourse?.courseHierarchy.map(l => l.toLowerCase()) || [];
                const hierarchyIds = {
                    modules: new Set<string>(),
                    subModules: new Set<string>(),
                    topics: new Set<string>(),
                    subTopics: new Set<string>()
                };

                (selectedRows as number[]).forEach(rowIndex => {
                    const row = tableRows[rowIndex];
                    if (hierarchyLevels.includes('module')) hierarchyIds.modules.add(row.moduleId);
                    if (hierarchyLevels.includes('sub module')) hierarchyIds.subModules.add(row.subModuleId);
                    if (hierarchyLevels.includes('topic')) hierarchyIds.topics.add(row.topicId);
                    if (hierarchyLevels.includes('sub topic')) hierarchyIds.subTopics.add(row.subtopicId);
                });

                // Call handleMergeLevelsClick with the selected rows
                setPendingLevelMerge({
                    selectedRows: selectedRows as number[],
                    hierarchyIds: {
                        modules: Array.from(hierarchyIds.modules),
                        subModules: Array.from(hierarchyIds.subModules),
                        topics: Array.from(hierarchyIds.topics),
                        subTopics: Array.from(hierarchyIds.subTopics)
                    }
                });
                setMergeLevelValue("");
                setShowMergeLevelDialog(true);
            } else {
                // For pedagogy merging, extract type and activity from first cell
                const firstCell = selectedRows[0] as { rowIndex: number; type: string; activity: string };
                const type = firstCell.type as "iDo" | "weDo" | "youDo";
                const activity = firstCell.activity;

                const selectedRowsArray = (selectedRows as { rowIndex: number; type: string; activity: string }[])
                    .map(item => item.rowIndex);

                // Check if any selected cell already has a value
                const hasValues = selectedRowsArray.some(rowIndex => {
                    const row = tableRows[rowIndex];
                    const hierarchyLevels = selectedCourse?.courseHierarchy.map(l => l.toLowerCase()) || [];
                    const effectiveTopicId = hierarchyLevels.includes('topic')
                        ? row.topicId
                        : `${row.moduleId}-default-topic`;
                    const effectiveSubtopicId = hierarchyLevels.includes('sub topic')
                        ? row.subtopicId
                        : hierarchyLevels.includes('topic')
                            ? `${row.topicId}-default-subtopic`
                            : `${row.moduleId}-default-subtopic`;

                    // Check for merged cells
                    const mergeInfo = isCellMerged(rowIndex, type, activity);
                    if (mergeInfo.isMerged && mergeInfo.value > 0) {
                        return true;
                    }

                    // Check individual cell value
                    const cellValue = courseHours[row.moduleId]?.[effectiveTopicId]?.[effectiveSubtopicId]?.[type]?.[activity] || 0;
                    return cellValue > 0;
                });

                if (hasValues) {
                    showError(`Cannot merge - one or more selected cells already have values for ${activity} (${type}).`);
                    return;
                }

                // Check if we're trying to merge a mix of merged and unmerged cells
                const mergeStatuses = selectedRowsArray.map(rowIndex => {
                    const mergeInfo = isCellMerged(rowIndex, type, activity);
                    return mergeInfo.isMerged;
                });

                const hasMixedMergeStatus = new Set(mergeStatuses).size > 1;
                if (hasMixedMergeStatus) {
                    showError("Cannot merge already merged cells with individual cells!");
                    return;
                }

                // Call mergeCells function
                mergeCells(type, activity, selectedRowsArray);
            }

            // Reset selection mode
            setMergeSelectionMode(null);
            setSelectedMergeCells(new Set());
        };

        const handleCancel = () => {
            setMergeSelectionMode(null);
            setSelectedMergeCells(new Set());
        };

        const getMergeTypeColor = () => {
            return mergeSelectionMode === 'level'
                ? 'from-[#FB8C3C] to-[#F0701F]'
                : 'from-emerald-500 to-teal-600';
        };

        const getMergeIcon = () => {
            return mergeSelectionMode === 'level' ? Layers : BookOpen;
        };

        const MergeIcon = getMergeIcon();

        return (
            <div className="fixed bottom-4 right-6 z-[60]">
                <div className="bg-white/95 backdrop-blur-md border border-gray-200/50 rounded-2xl shadow-xl px-4 py-1 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1">
                    <div className="flex items-center gap-4">
                        {/* Icon with gradient background */}
                        <div className={`p-1.5 bg-gradient-to-br ${getMergeTypeColor()} rounded-lg text-white shadow-lg`}>
                            <MergeIcon className="h-3.5 w-3.5" />
                        </div>

                        {/* Selection info */}
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center justify-center w-6 h-6 text-xs font-bold text-white bg-gradient-to-r ${getMergeTypeColor()} rounded-full shadow-md`}>
                                    {selectedMergeCells.size}
                                </span>
                                <span className="text-gray-700 font-medium text-xs">
                                    cells selected for
                                </span>
                                <span className={`px-3 py-1 text-xs font-semibold bg-gradient-to-r ${getMergeTypeColor()} text-white rounded-full shadow-sm`}>
                                    {mergeSelectionMode === 'level' ? 'LEVEL' : 'PEDAGOGY'}
                                </span>
                                <span className="text-gray-700 font-medium text-xs">merging</span>
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 ml-4 pl-4 border-l border-gray-200">
                            <button
                                onClick={handleMerge}
                                className={`inline-flex items-center text-sm gap-2 px-4 py-1 bg-gradient-to-r ${getMergeTypeColor()} hover:shadow-lg text-white font-semibold rounded-xl transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 group`}
                            >
                                <Merge className="h-3.5 w-3.5 group-hover:rotate-12 transition-transform duration-200" />
                                Merge
                            </button>

                            <button
                                onClick={handleCancel}
                                className="inline-flex items-center gap-1 px-3 py-2 bg-red-100 hover:bg-red-200 text-red-600 font-semibold rounded-xl transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 group"
                            >
                                <X className="h-3.5 w-3.5 group-hover:rotate-90 transition-transform duration-200" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };
    const updateMergedPedagogy = useMutation({
        mutationFn: (data: {
            type: "iDo" | "weDo" | "youDo";
            activity: string;
            value: number;
            mergeIndex: number;
            hierarchyIds?: any;
        }) => {
            // Handle backend merges (mergeIndex = -2)
            if (data.mergeIndex === -2) {
                // Find the backend pedagogy item that matches the hierarchy
                const matchingPedagogy = pedagogyViews?.[0]?.pedagogies.find(p => {
                    const levelModules = p.module || [];
                    const levelSubModules = p.subModule || [];
                    const levelTopics = p.topic || [];
                    const levelSubTopics = p.subTopic || [];

                    // Check if this matches the hierarchy pattern
                    return arraysEqual(levelModules, data.hierarchyIds?.modules || []) &&
                        arraysEqual(levelSubModules, data.hierarchyIds?.subModules || []) &&
                        arraysEqual(levelTopics, data.hierarchyIds?.topics || []) &&
                        arraysEqual(levelSubTopics, data.hierarchyIds?.subTopics || []);
                });

                if (matchingPedagogy && pedagogyViews?.length) {
                    // Update the specific activity in the matching pedagogy
                    const updatedPedagogies = pedagogyViews[0].pedagogies.map(p => {
                        if (p === matchingPedagogy) {
                            return {
                                ...p,
                                [data.type]: p[data.type].map((act: any) =>
                                    act.type === data.activity ? { ...act, duration: data.value } : act
                                )
                            };
                        }
                        return p;
                    });

                    return pedagogyViewApi.update(pedagogyViews[0]._id).mutationFn({
                        courses: selectedCourse?._id || '',
                        pedagogies: updatedPedagogies
                    });
                }
                throw new Error("Matching pedagogy not found");
            }

            // Handle frontend merges (existing logic)
            const columnKey = `${data.type}-${data.activity}`;
            const mergeData = mergedCells[columnKey][data.mergeIndex];

            const hierarchyLevels = selectedCourse?.courseHierarchy.map(l => l.toLowerCase()) || [];
            const pedagogyData: any = {
                iDo: data.type === "iDo" ? [{ type: data.activity, duration: data.value }] : [],
                weDo: data.type === "weDo" ? [{ type: data.activity, duration: data.value }] : [],
                youDo: data.type === "youDo" ? [{ type: data.activity, duration: data.value }] : [],
                ...(hierarchyLevels.includes('module') && { module: mergeData.hierarchyIds?.modules || [] }),
                ...(hierarchyLevels.includes('sub module') && { subModule: mergeData.hierarchyIds?.subModules || [] }),
                ...(hierarchyLevels.includes('topic') && { topic: mergeData.hierarchyIds?.topics || [] }),
                ...(hierarchyLevels.includes('sub topic') && { subTopic: mergeData.hierarchyIds?.subTopics || [] })
            };

            const existingPedagogyIndex = pedagogyViews?.[0]?.pedagogies.findIndex(p =>
                JSON.stringify(p.module) === JSON.stringify(pedagogyData.module) &&
                JSON.stringify(p.subModule) === JSON.stringify(pedagogyData.subModule) &&
                JSON.stringify(p.topic) === JSON.stringify(pedagogyData.topic) &&
                JSON.stringify(p.subTopic) === JSON.stringify(pedagogyData.subTopic)
            );

            let updatedPedagogies = pedagogyViews?.[0]?.pedagogies ? [...pedagogyViews[0].pedagogies] : [];

            if (existingPedagogyIndex !== undefined && existingPedagogyIndex !== -1) {
                updatedPedagogies[existingPedagogyIndex] = pedagogyData;
            } else {
                updatedPedagogies.push(pedagogyData);
            }

            if (pedagogyViews?.[0]?._id) {
                return pedagogyViewApi.update(pedagogyViews[0]._id).mutationFn({
                    courses: selectedCourse?._id || '',
                    pedagogies: updatedPedagogies
                });
            } else {
                return pedagogyViewApi.create().mutationFn({
                    courses: selectedCourse?._id || '',
                    pedagogies: updatedPedagogies
                });
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pedagogyViews'] });
            setShowSuccessMessage(true);
            setTimeout(() => setShowSuccessMessage(false), 2000);
        }
    });
    // Inside the PreviewTable component, add this function:
    const renderActivityCell = (
        type: "iDo" | "weDo" | "youDo",
        activity: string,
        row: any,
        index: number,
        mergeInfo: any,
        isPreview: boolean = false
    ) => {

        // Determine effective IDs based on hierarchy
        const effectiveTopicId = row.topicId || `${row.moduleId}-default-topic`;
        const effectiveSubtopicId = row.subtopicId ||
            (row.topicId ? `${row.topicId}-default-subtopic` : `${row.moduleId}-default-subtopic`);

        const hasValue = mergeInfo.isMerged ? mergeInfo.value > 0 :
            courseHours[row.moduleId]?.[effectiveTopicId]?.[effectiveSubtopicId]?.[type]?.[activity] > 0;

        const getCellValue = () => {
            // First check if this is a merged cell (backend or frontend)
            if (mergeInfo.isMerged) {
                return mergeInfo.value;
            }
            // Then check backend single cell data
            const hierarchyLevels = selectedCourse?.courseHierarchy.map(l => l.toLowerCase()) || [];

            // Find matching pedagogy data in backend
            if (pedagogyViews && pedagogyViews.length > 0) {
                for (const view of pedagogyViews) {
                    for (const pedagogy of view.pedagogies) {
                        const pedagogyModules = pedagogy.module || [];
                        const pedagogySubModules = pedagogy.subModule || [];
                        const pedagogyTopics = pedagogy.topic || [];
                        const pedagogySubTopics = pedagogy.subTopic || [];

                        // Skip merged pedagogies (already handled above)
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

            // Finally check frontend single cell data
            return courseHours[row.moduleId]?.[effectiveTopicId]?.[effectiveSubtopicId]?.[type]?.[activity] || 0;
        };

        const cellValue = getCellValue();
        const displayValue = cellValue === 0 ? "" : cellValue.toString();

        // Background colors based on type and merge state
        const bgColor = type === "iDo"
            ? mergeInfo.isMerged ? "bg-yellow-200" : "bg-yellow-50"
            : type === "weDo"
                ? mergeInfo.isMerged ? "bg-orange-200" : "bg-orange-50"
                : mergeInfo.isMerged ? "bg-green-200" : "bg-green-50";

        const hoverColor = type === "iDo"
            ? mergeInfo.isMerged ? "hover:bg-yellow-300" : "hover:bg-yellow-100"
            : type === "weDo"
                ? mergeInfo.isMerged ? "hover:bg-orange-300" : "hover:bg-orange-100"
                : mergeInfo.isMerged ? "hover:bg-green-300" : "hover:bg-green-100";

        const disabledClass = "cursor-pointer";
        const showCheckbox = mergeSelectionMode === 'pedagogy' && selectedMergeCells.size > 0;

        const selectionClass =
            (isSelectingCells && selectedCells.has(`${index}::${type}::${activity}`))
                ? "bg-[#FFE4D0] !border-[#F97316] border-2 shadow-[0_0_0_2px_#F97316_inset]"
                : "";

        const handleDeleteCell = (row: any, type: "iDo" | "weDo" | "youDo", activity: string, mergeInfo: any) => {
            if (mergeInfo.isMerged) {
                unmergeCell(type, activity, mergeInfo.mergeIndex);
            } else {
                const hierarchyLevels = selectedCourse?.courseHierarchy.map(l => l.toLowerCase()) || [];

                // Determine effective IDs based on hierarchy
                const effectiveSubtopicId = hierarchyLevels.includes('sub topic')
                    ? row.subtopicId
                    : hierarchyLevels.includes('topic')
                        ? `${row.topicId}-default-subtopic`
                        : `${row.moduleId}-default-subtopic`;

                const effectiveTopicId = hierarchyLevels.includes('topic')
                    ? row.topicId
                    : `${row.moduleId}-default-topic`;

                // Set the cell to delete and show confirmation dialog
                setCellToDelete({
                    moduleId: row.moduleId,
                    topicId: effectiveTopicId,
                    subtopicId: effectiveSubtopicId,
                    subModuleId: row.subModuleId,
                    type,
                    activity
                });
                setShowDeleteCellDialog(true);
            }
        };

        // Opens the hours dialog for this cell — Add when empty, Edit when it
        // already holds a value (a merged block edits the whole merge).
        const openCellEditor = () => {
            if (mergeInfo.isMerged && mergeInfo.isStart) {
                setEditingMerge({
                    type,
                    activity,
                    mergeIndex: mergeInfo.mergeIndex,
                    value: mergeInfo.value,
                    hierarchyIds: mergeInfo.hierarchyIds
                });
            } else {
                handleCellClick(
                    row.moduleId,
                    effectiveTopicId,
                    effectiveSubtopicId,
                    type,
                    activity,
                    row.subModuleId
                );
            }
        };

        // Double-click is the shortcut for the ⋮ menu's Add/Edit. Not in the
        // read-only preview, and not while picking cells to merge.
        const handleCellDoubleClick = () => {
            if (isPreview || mergeSelectionMode) return;
            openCellEditor();
        };

        if (mergeInfo.isMerged && !mergeInfo.isStart) return null;
        return (
            <motion.td
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                exit={{ y: -20 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                key={`${row.subtopicId}-${type}-${activity}`}
                onDoubleClick={handleCellDoubleClick}
                title={isPreview ? undefined : (hasValue ? "Double-click to edit hours" : "Double-click to add hours")}
                className={`
                    relative border-r border-b border-gray-400 text-center align-middle text-[10px] p-0.5 transition-colors
                    ${bgColor} ${hoverColor} ${mergeInfo.isMerged ? "font-bold" : ""}
                    min-w-[70px] h-[32px] ${disabledClass} ${selectionClass}
                    ${isPreview ? "" : "select-none"}
                `}

                rowSpan={mergeInfo.rowSpan}

            >
                {/* Value centers across the full merged area via the cell's own
                    text-center + align-middle (immune to rowSpan/% quirks) */}
                <span>{displayValue}</span>

                {/* Right End - Action Menu or Checkbox */}
                {!isPreview && (
                    <div className="absolute right-0 top-1/2 transform -translate-y-1/2 z-10">
                        {showCheckbox ? (
                                <Checkbox
                                    checked={selectedMergeCells.has(`${type}::${activity}::${row.rowId}`)}
                                    onCheckedChange={() => {


                                        setSelectedMergeCells(prev => {
                                            const newSelection = new Set(prev);
                                            if (newSelection.has(`${type}::${activity}::${row.rowId}`)) {
                                                newSelection.delete(`${type}::${activity}::${row.rowId}`);
                                            } else {
                                                newSelection.add(`${type}::${activity}::${row.rowId}`);
                                            }
                                            return newSelection;
                                        });
                                    }}

                                    className="mr-1 h-5 w-5 rounded-sm border-1 border-gray-500
             data-[state=checked]:bg-gray-900 data-[state=checked]:border-gray-900
             data-[state=checked]:text-white shadow-sm transition-colors
             hover:border-gray-600 focus:outline-none"
                                />
                            ) : (
                                directActionsEnabled && (
                                    <CellActionMenu
                                        cellType="pedagogy"
                                        cellKey={`${type}-${activity}-${row.rowId}`}
                                        hasValue={hasValue}
                                        isMerged={mergeInfo.isMerged}

                                        onAdd={() => {
                                            handleCellClick(
                                                row.moduleId,
                                                effectiveTopicId,
                                                effectiveSubtopicId,
                                                type,
                                                activity,
                                                row.subModuleId, // Add subModuleId
                                            );
                                        }}
                                        onEdit={openCellEditor}
                                        onDelete={() => handleDeleteCell(row, type, activity, mergeInfo)}
                                        onMerge={() => {
                                            setMergeSelectionMode('pedagogy');
                                            setSelectedMergeCells(new Set([`${type}::${activity}::${row.rowId}`]));
                                        }}
                                        onUnmerge={mergeInfo.isMerged ? () =>
                                            unmergeCell(
                                                type,
                                                activity,
                                                mergeInfo.mergeIndex,
                                                mergeInfo.hierarchyIds
                                            )
                                            : undefined}
                                    />
                                )
                            )}
                    </div>
                )}
            </motion.td>
        );
    };
    const DuplicationPreviewTable = ({
        tableRows,
        selectedCourse,
        moduleSpans,
        subModuleSpans,
        topicSpans,
    }: {
        tableRows: any[];
        selectedCourse: Course | null;
        moduleSpans: { [key: string]: number };
        subModuleSpans: { [key: string]: number };
        topicSpans: { [key: string]: number };
    }) => {
        const getStickyLeftPositions = () => {
            const positions: { [key: string]: number } = {};
            let currentLeft = enableModuleSelection ? 40 : 0;

            // Only show hierarchy levels that are selected for duplication
            const selectedHierarchy = selectedDuplicateOptions.hierarchy.map(level =>
                level === 'SubModule' ? 'Sub Module' :
                    level === 'SubTopic' ? 'Sub Topic' : level
            );

            if (selectedHierarchy.includes('Module')) {
                positions['module'] = currentLeft;
                currentLeft += 80;
            }

            if (selectedHierarchy.includes('Sub Module')) {
                positions['subModule'] = currentLeft;
                currentLeft += 80;
            }

            if (selectedHierarchy.includes('Topic')) {
                positions['topic'] = currentLeft;
                currentLeft += 80;
            }

            if (selectedHierarchy.includes('Sub Topic')) {
                positions['subTopic'] = currentLeft;
                currentLeft += 80;
            }

            return positions;
        };

        const stickyPositions = getStickyLeftPositions();

        // Get the selected hierarchy levels for display
        const selectedHierarchy = selectedDuplicateOptions.hierarchy.map(level =>
            level === 'SubModule' ? 'Sub Module' :
                level === 'SubTopic' ? 'Sub Topic' : level
        );

        // Get unique modules for checkbox handling
        const uniqueModules = useMemo(() => {
            const modulesMap = new Map();
            tableRows.forEach(row => {
                if (!modulesMap.has(row.moduleId) && row.moduleId) {
                    modulesMap.set(row.moduleId, {
                        id: row.moduleId,
                        name: row.moduleName,
                        rowIndex: row.rowIndex
                    });
                }
            });
            return Array.from(modulesMap.values());
        }, [tableRows]);

        const handleModuleSelect = (moduleId: string, checked: boolean) => {
            setSelectedModulesForDuplication(prev => {
                const newSet = new Set(prev);
                if (checked) {
                    newSet.add(moduleId);
                } else {
                    newSet.delete(moduleId);
                }
                return newSet;
            });
        };

        const handleSelectAllModules = (checked: boolean) => {
            if (checked) {
                const allModuleIds = uniqueModules.map(module => module.id);
                setSelectedModulesForDuplication(new Set(allModuleIds));
            } else {
                setSelectedModulesForDuplication(new Set());
            }
        };

        const allModulesSelected = uniqueModules.length > 0 &&
            selectedModulesForDuplication.size === uniqueModules.length;

        return (
            <div className="overflow-x-auto">
                <Table className="border-separate border-spacing-0 w-full text-[8px]">
                    <TableHeader>
                        <TableRow className="bg-[#FFE4D0]">
                            {/* Checkbox column header - only show if module selection is enabled AND Module is in selected hierarchy */}
                            {enableModuleSelection && selectedHierarchy.includes('Module') && (
                                <TableHead className="border-r border-b border-gray-400 text-center font-bold p-0.5 sticky bg-[#FFE4D0] z-20 left-0">
                                    <div className="flex items-center justify-center">
                                        <Checkbox
                                            checked={allModulesSelected}
                                            onCheckedChange={handleSelectAllModules}
                                            className="h-3 border-r border-b border-gray-400 w-3"
                                        />
                                    </div>
                                </TableHead>
                            )}

                            {/* Only show columns for selected hierarchy levels */}
                            {selectedHierarchy.includes('Module') && (
                                <TableHead
                                    className="border-r border-b border-gray-400 text-center font-bold p-0.5 sticky bg-[#FFE4D0] z-10 min-w-[80px]"
                                    style={{ left: `${stickyPositions['module']}px` }}
                                >
                                    Module
                                </TableHead>
                            )}
                            {selectedHierarchy.includes('Sub Module') && (
                                <TableHead
                                    className="border-r border-b border-gray-400 text-center font-bold p-0.5 sticky bg-[#FFE4D0] z-10 min-w-[80px]"
                                    style={{ left: `${stickyPositions['subModule']}px` }}
                                >
                                    Sub Module
                                </TableHead>
                            )}
                            {selectedHierarchy.includes('Topic') && (
                                <TableHead
                                    className="border-r border-b border-gray-400 text-center font-bold p-0.5 sticky bg-[#FFE4D0] z-10 min-w-[80px]"
                                    style={{ left: `${stickyPositions['topic']}px` }}
                                >
                                    Topic
                                </TableHead>
                            )}
                            {selectedHierarchy.includes('Sub Topic') && (
                                <TableHead
                                    className="border-r border-b border-gray-400 text-center font-bold p-0.5 sticky bg-[#FFE4D0] z-10 min-w-[80px]"
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

                                const isModuleSelected = selectedModulesForDuplication.has(row.moduleId);

                                return (
                                    <TableRow
                                        key={`preview-${row.rowId}`}
                                        className={`hover:bg-gray-50 h-6`}
                                    >
                                        {/* Checkbox Cell - only show if module selection is enabled AND Module is in selected hierarchy */}
                                        {enableModuleSelection && selectedHierarchy.includes('Module') && isFirstSubtopicInModule && (
                                            <TableCell
                                                rowSpan={moduleSpans[row.moduleId]}
                                                className="border-r border-b border-gray-400 text-center p-0.5 bg-[#FFF3EA] sticky z-20 left-0"
                                            >
                                                <div className="flex items-center justify-center">
                                                    <Checkbox
                                                        checked={isModuleSelected}
                                                        onCheckedChange={(checked) =>
                                                            handleModuleSelect(row.moduleId, checked as boolean)
                                                        }
                                                        className="h-3 border-r border-b border-gray-400 w-3"
                                                    />
                                                </div>
                                            </TableCell>
                                        )}

                                        {/* Module Cell - only show if Module is in selected hierarchy */}
                                        {selectedHierarchy.includes('Module') && isFirstSubtopicInModule && (
                                            <TableCell
                                                rowSpan={moduleSpans[row.moduleId]}
                                                className="border-r border-b border-gray-400 text-left text-[9px] font-medium p-0.5 bg-[#FFF3EA] text-center align-middle max-w-[80px] h-6 sticky z-10"
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

                                        {/* SubModule Cell - only show if Sub Module is in selected hierarchy */}
                                        {selectedHierarchy.includes('Sub Module') && isFirstSubtopicInSubModule && (
                                            <TableCell
                                                rowSpan={subModuleSpans[row.subModuleId]}
                                                className="border-r border-b border-gray-400 text-left p-0.5 bg-[#FFF3EA] text-[9px] font-medium text-center align-middle max-w-[80px] h-6 sticky z-10"
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

                                        {/* Topic Cell - only show if Topic is in selected hierarchy */}
                                        {selectedHierarchy.includes("Topic") && isFirstSubtopicInTopic && (
                                            <TableCell
                                                rowSpan={topicSpans[row.topicId]}
                                                className="border-r border-b border-gray-400 text-left p-0.5 bg-[#FFF3EA] text-[9px] font-medium text-center align-middle max-w-[80px] h-6 sticky z-10"
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

                                        {/* Subtopic Cell - only show if Sub Topic is in selected hierarchy */}
                                        {selectedHierarchy.includes("Sub Topic") && (
                                            <TableCell
                                                className="border-r border-b border-gray-400 text-left p-0.5 bg-[#FFF3EA] text-[9px] font-medium text-center align-middle max-w-[80px] h-6 sticky z-10"
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
    };
    // Thin wrapper over the extracted implementation (see exportToExcel.ts).
    // Keeps this name and signature so every call site stays exactly as it was;
    // the eleven values it used to close over are handed across in one object.
    const exportToExcel = async () => exportToExcelImpl({
        activityTypes, courseHours, exportSelections, isLevelMerged, mergeCells,
        mergedCells, selectedCourse, selectedPedagogyTypes, setExportSelections,
        setShowPreviewDialog, tableRows, pedagogyViews,
    })

    const deletePedagogyMerges = async (hierarchyIds: {
        modules?: string[],
        subModules?: string[],
        topics?: string[],
        subTopics?: string[]
    }) => {
        if (!pedagogyViews?.[0] || !token) return;

        try {
            // Filter out pedagogies that match any of the hierarchy IDs
            const updatedPedagogies = pedagogyViews[0].pedagogies.filter(pedagogy => {
                const moduleMatch = hierarchyIds.modules && pedagogy.module?.some(m => hierarchyIds.modules?.includes(m));
                const subModuleMatch = hierarchyIds.subModules && pedagogy.subModule?.some(sm => hierarchyIds.subModules?.includes(sm));
                const topicMatch = hierarchyIds.topics && pedagogy.topic?.some(t => hierarchyIds.topics?.includes(t));
                const subTopicMatch = hierarchyIds.subTopics && pedagogy.subTopic?.some(st => hierarchyIds.subTopics?.includes(st));

                // Keep if doesn't match any of the hierarchy IDs
                return !(moduleMatch || subModuleMatch || topicMatch || subTopicMatch);
            });

            // Update backend if changes were made
            if (updatedPedagogies.length !== pedagogyViews[0].pedagogies.length) {
                await pedagogyMutation.mutateAsync({
                    courses: selectedCourse?._id || '',
                    pedagogies: updatedPedagogies
                });
                queryClient.invalidateQueries({ queryKey: ['pedagogyViews'] });
            }
        } catch (error) {
            console.error("Failed to delete pedagogy merges:", error);
            throw error;
        }
    };

    const confirmCellDelete = async () => confirmCellDeleteImpl({ cellToDelete, deletePedagogyMutation, pedagogyViews, queryClient, selectedCourse, setCellToDelete, setCourseHours, setErrorMessage, setIsPedagogyDeleteConfirm, setShowDeleteCellDialog, setShowErrorDialog, setShowSuccessMessage })

    const isCellMovable = (type: string, id: string) => {
        return movableCell?.type === type && movableCell?.id === id;
    };
    const getTargetParentId = (targetId: string, type: string) => {
        switch (type) {
            case 'submodule':
                const subModule = subModules.find(sm => sm._id === targetId);
                return subModule?.moduleId;
            case 'topic':
                const topic = topics.find(t => t._id === targetId);
                const hierarchyLevels = selectedCourse?.courseHierarchy.map(l => l.toLowerCase()) || [];
                const hasSubModules = hierarchyLevels.includes('sub module');
                return hasSubModules ? topic?.subModuleId : topic?.moduleId;
            case 'subtopic':
                const subtopic = subTopics.find(st => st._id === targetId);
                return subtopic?.topicId;
            default:
                return null;
        }
    };
    // Module drag handlers
    const handleModuleDragStart = (e: React.DragEvent, moduleId: string) => {

        if (!isCellMovable('module', moduleId)) {
            e.preventDefault();
            return;
        }

        e.dataTransfer.setData('text/plain', moduleId);
        setDraggingModuleId(moduleId);
        e.dataTransfer.effectAllowed = 'move';

    };
    const handleModuleDragEnd = () => {
        setDraggingModuleId(null);
        setDragOverId(null);
        setMovableCell(null);
        setIsMoveModeActive(false);
    };
    const handleModuleDrop = async (e: React.DragEvent, targetModuleId: string) => handleModuleDropImpl(e, targetModuleId, { courses, deleteLevelMutation, deletePedagogyMutation, levelViewId, levelsData, mergedCells, mergedLevels, modules, pedagogyViews, queryClient, refetchModules, selectedCourse, setDragOverId, setDraggingModuleId, setErrorMessage, setMergedCells, setMergedLevels, setShowErrorDialog, setShowSuccessMessage, token, updateModuleMutation })
    // SubModule drag handlers
    const handleSubModuleDragStart = (e: React.DragEvent, subModuleId: string) => {
        if (!isCellMovable('submodule', subModuleId)) {
            e.preventDefault();
            return;
        }

        const subModule = subModules.find(sm => sm._id === subModuleId);
        e.dataTransfer.setData('application/json', JSON.stringify({
            id: subModuleId,
            type: 'submodule',
            currentIndex: subModule?.index || 0,
            currentParent: subModule?.moduleId // Current parent module
        }));
        setDraggingSubModuleId(subModuleId);
        e.dataTransfer.effectAllowed = 'move';
    };
    const handleSubModuleDragEnd = () => {
        setDraggingSubModuleId(null);
        setDragOverId(null);
        setMovableCell(null);
        setIsMoveModeActive(false);
    };
    const handleSubModuleDrop = async (e: React.DragEvent, targetSubModuleId: string) => handleSubModuleDropImpl(e, targetSubModuleId, { courses, deleteLevelMutation, deletePedagogyMutation, levelViewId, levelsData, mergedCells, mergedLevels, modules, pedagogyViews, queryClient, refetchSubModules, selectedCourse, setDragOverId, setDraggingSubModuleId, setErrorMessage, setMergedCells, setMergedLevels, setShowErrorDialog, setShowSuccessMessage, subModules, token, updateSubModuleMutation })
    // Topic drag handlers (similar to SubModule)
    const handleTopicDragStart = (e: React.DragEvent, topicId: string) => {
        if (!isCellMovable('topic', topicId)) {
            e.preventDefault();
            return;
        }

        const topic = topics.find(t => t._id === topicId);
        e.dataTransfer.setData('application/json', JSON.stringify({
            id: topicId,
            type: 'topic',
            currentIndex: topic?.index || 0,
            currentParent: topic?.subModuleId || topic?.moduleId // Current parent
        }));
        setDraggingTopicId(topicId);
        e.dataTransfer.effectAllowed = 'move';
    };
    const handleTopicDragEnd = () => {
        setDraggingTopicId(null);
        setDragOverId(null);
        setMovableCell(null);
        setIsMoveModeActive(false);
    };
    const handleTopicDrop = async (e: React.DragEvent, targetTopicId: string) => handleTopicDropImpl(e, targetTopicId, { courses, deleteLevelMutation, deletePedagogyMerges, deletePedagogyMutation, levelViewId, levelsData, mergedCells, mergedLevels, modules, pedagogyViews, queryClient, refetchTopics, selectedCourse, setDragOverId, setDraggingTopicId, setErrorMessage, setMergedCells, setMergedLevels, setShowErrorDialog, setShowSuccessMessage, subModules, tableRows, token, topics, updateTopicMutation })
    // Subtopic drag handlers (existing implementation)
    const handleSubtopicDragStart = (e: React.DragEvent, subtopicId: string) => {
        if (!isCellMovable('subtopic', subtopicId)) {
            e.preventDefault();
            return;
        }

        const subtopic = subTopics.find(st => st._id === subtopicId);
        e.dataTransfer.setData('application/json', JSON.stringify({
            id: subtopicId,
            type: 'subtopic',
            currentIndex: subtopic?.index || 0,
            currentParent: subtopic?.topicId // Current parent topic
        }));
        setDraggingSubtopicId(subtopicId);
        e.dataTransfer.effectAllowed = 'move';
    };
    const handleSubtopicDragEnd = () => {
        setDraggingSubtopicId(null);
        setDragOverId(null);
        setMovableCell(null);
        setIsMoveModeActive(false);
    };
    const handleSubtopicDrop = async (e: React.DragEvent, targetSubtopicId: string) => handleSubtopicDropImpl(e, targetSubtopicId, { courses, deleteLevelMutation, deletePedagogyMutation, levelViewId, levelsData, mergedCells, mergedLevels, pedagogyMutation, pedagogyViews, queryClient, refetchSubTopics, refetchTopicSubTopics, selectedCourse, selectedTopicForSubTopic, setDragOverId, setDraggingSubtopicId, setErrorMessage, setMergedCells, setMergedLevels, setShowErrorDialog, setShowSuccessMessage, subTopics, token, topics, updateSubTopicMutation })
    const handleDragOver = (e: React.DragEvent, id: string, type: string) => {
        e.preventDefault();

        try {
            const dragData = JSON.parse(e.dataTransfer.getData('application/json'));

            // Check if this is a cross-parent drag operation
            const isCrossParent = dragData.currentParent &&
                dragData.currentParent !== getTargetParentId(id, type);

            // Provide visual feedback for cross-parent drag operations
            if (isCrossParent) {
                // Highlight with a different style for cross-parent moves
                setDragOverId(id);
                e.dataTransfer.dropEffect = 'copy'; // Visual indicator for cross-parent move
            } else {
                // Regular same-parent move
                setDragOverId(id);
                e.dataTransfer.dropEffect = 'move';
            }
        } catch (error) {
            // Fallback for legacy drag events
            setDragOverId(id);
        }
    };

    const CellActionsMenu = React.memo(
        ({
            row,
            type,
            onEdit,
            onAdd,
            onDelete,
            onEnableDrag,
            onMultipleDelete,
            addLabel
        }: {
            row: any;
            type: "module" | "submodule" | "topic" | "subtopic";
            onEdit: () => void;
            onAdd?: () => void;
            onDelete: () => void;
            onEnableDrag: () => void;
            onMultipleDelete?: () => void;
            addLabel?: string;
        }) => {
            const [isOpen, setIsOpen] = useState(false);
            const btnRef = useRef<HTMLButtonElement | null>(null);
            const [pos, setPos] = useState({ top: 0, left: 0 });

            // Close when clicking outside
            useEffect(() => {
                const handleClose = (e: MouseEvent) => {
                    const menu = document.getElementById(`action-menu-${row?.id}`);
                    if (
                        menu &&
                        menu.contains(e.target as Node)
                    )
                        return;

                    if (btnRef.current && btnRef.current.contains(e.target as Node))
                        return;

                    setIsOpen(false);
                };

                document.addEventListener("mousedown", handleClose);
                return () => document.removeEventListener("mousedown", handleClose);
            }, []);

            const openMenu = () => {
                if (!btnRef.current) return;

                const rect = btnRef.current.getBoundingClientRect();
                const menuHeight = 210; // estimated menu height
                const viewportHeight = window.innerHeight;

                // Default: open below
                let top = rect.bottom + 6;

                // If not enough space below → open upward
                if (rect.bottom + menuHeight > viewportHeight) {
                    top = rect.top - menuHeight - 6;
                }

                // Horizontal placement same as before
                setPos({ top, left: rect.right - 190 });
                setIsOpen((x) => !x);
            };


            return (
                <>
                    {/* Trigger Button */}
                    <button
                        ref={btnRef}
                        onClick={(e) => {
                            e.stopPropagation();
                            openMenu();
                        }}
                        className="p-1 rounded-full cursor-pointer hover:bg-[#FFE4D0] hover:shadow-md transition-all duration-200 ease-in-out transform hover:scale-110"
                    >
                        <MoreVertical className="w-4 h-4 text-[#F97316]" />
                    </button>

                    {/* Portal Dropdown */}
                    {isOpen &&
                        createPortal(
                            <div
                                id={`action-menu-${row?.id}`}
                                style={{ top: pos.top, left: pos.left }}
                                className="
                fixed z-[99999]
                w-48 bg-white border border-gray-200
                shadow-xl rounded-lg p-1
                origin-top-right
                animate-[fadeScale_0.15s_ease-out]
              "
                            >
                                {/* Add */}
                                {onAdd && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            setIsOpen(false);
                                            onAdd();
                                        }}
                                        className="flex text-sm items-center w-full px-3 py-2.5 rounded-md cursor-pointer transition-all duration-150 hover:bg-[#FFF3EA] hover:text-[#C2540F] group"
                                    >
                                        <Plus className="mr-3 h-3.5 w-3.5 text-[#F97316] group-hover:text-[#EA6A1F] transition-colors duration-150 flex-shrink-0" />
                                        <div className="flex flex-col text-left">
                                            <span className="font-medium">
                                                Add{" "}
                                                <span className="text-[10px] text-[#F97316]">({addLabel})</span>
                                            </span>
                                        </div>
                                    </button>
                                )}

                                {/* Edit */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        setIsOpen(false);
                                        onEdit();
                                    }}
                                    className="flex text-sm items-center w-full px-3 py-2.5 rounded-md cursor-pointer transition-all duration-150 hover:bg-[#FFF3EA] hover:text-[#C2540F]"
                                >
                                    <Pencil className="mr-3 h-3.5 w-3.5 text-[#F97316] hover:text-[#EA6A1F] transition-colors duration-150 flex-shrink-0" />
                                    <span className="font-medium">Edit</span>
                                </button>

                                {/* Delete */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        setIsOpen(false);
                                        onDelete();
                                    }}
                                    className="flex text-sm items-center w-full px-3 py-2.5 rounded-md cursor-pointer transition-all duration-150 hover:bg-red-50 hover:text-red-700"
                                >
                                    <Trash className="mr-3 h-3.5 w-3.5 text-red-500 hover:text-red-600 flex-shrink-0" />
                                    <span className="font-medium">Delete</span>
                                </button>

                                {/* Multiple Delete */}
                                {onMultipleDelete && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            setIsOpen(false);
                                            onMultipleDelete();
                                        }}
                                        className="flex text-sm items-center w-full px-3 py-2.5 rounded-md cursor-pointer transition-all duration-150 hover:bg-orange-50 hover:text-orange-700"
                                    >
                                        <Trash2 className="mr-3 h-3.5 w-3.5 text-orange-500 hover:text-orange-600 flex-shrink-0" />
                                        <span className="font-medium">Multiple Delete</span>
                                    </button>
                                )}

                                {/* Move */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        setIsOpen(false);
                                        onEnableDrag();
                                    }}
                                    className="flex text-sm items-center w-full px-3 py-2.5 rounded-md cursor-pointer transition-all duration-150 hover:bg-green-100 hover:text-green-700"
                                >
                                    <Move className="mr-3 h-3.5 w-3.5 text-green-500 hover:text-green-600 flex-shrink-0" />
                                    <span className="font-medium">Move</span>
                                </button>
                            </div>,
                            document.body
                        )}
                </>
            );
        }
    );
    CellActionsMenu.displayName = 'CellActionsMenu';

    const CellActionMenu = React.memo(
        ({
            cellType,
            cellKey,
            hasValue,
            isMerged,
            onAdd,
            onEdit,
            onDelete,
            onMerge,
            onUnmerge
        }: {
            cellType: "level" | "pedagogy";
            cellKey: string;
            hasValue: boolean;
            isMerged: boolean;
            onAdd: () => void;
            onEdit: () => void;
            onDelete: () => void;
            onMerge: () => void;
            onUnmerge?: () => void;
        }) => {
            const [isOpen, setIsOpen] = useState(false);
            const [pos, setPos] = useState({ top: 0, left: 0 });
            const btnRef = useRef<HTMLButtonElement | null>(null);

            useEffect(() => {
                const handleClose = (e: MouseEvent) => {
                    // If clicking the menu itself → DO NOT CLOSE
                    const menu = document.getElementById(`menu-${cellKey}`);
                    if (menu && menu.contains(e.target as Node)) return;

                    // If clicking the trigger button → DO NOT CLOSE
                    if (btnRef.current && btnRef.current.contains(e.target as Node)) return;

                    setIsOpen(false);
                };

                document.addEventListener("mousedown", handleClose);
                return () => document.removeEventListener("mousedown", handleClose);
            }, []);


            const openMenu = () => {
                const rect = btnRef.current!.getBoundingClientRect();
                setPos({ top: rect.bottom + 4, left: rect.right - 140 });
                setIsOpen((x) => !x);
            };

            return (
                <>
                    <Button
                        ref={btnRef}
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 flex items-center justify-center"
                        onClick={openMenu}
                    >
                        <MoreVertical className="h-4 w-4" />
                    </Button>

                    {isOpen &&
                        createPortal(
                            <div
                                id={`menu-${cellKey}`}
                                style={{ top: pos.top, left: pos.left }}
                                className="fixed z-[99999] w-40 bg-white border border-gray-200 rounded-xl shadow-xl py-1
             origin-top-right animate-[fadeScale_0.15s_ease-out]"
                            >

                                {/* Add */}
                                {!hasValue && !isMerged && (
                                    <button
                                        onClick={() => {
                                            setIsOpen(false);
                                            onAdd();
                                        }}
                                        className="flex items-center w-full px-3 py-1.5 text-sm hover:bg-[#FFF3EA] rounded-sm"
                                    >
                                        <Plus className="mr-2 h-4 w-4 text-[#F97316]" />
                                        Add
                                    </button>
                                )}

                                {/* Edit */}
                                {(hasValue || isMerged) && (
                                    <button
                                        onClick={() => {
                                            setIsOpen(false);
                                            onEdit();
                                        }}
                                        className="flex items-center w-full px-3 py-1.5 text-sm hover:bg-[#FFF3EA] rounded-sm"
                                    >
                                        <Pencil className="mr-2 h-4 w-4 text-[#F97316]" />
                                        {isMerged ? "Edit Merged" : "Edit"}
                                    </button>
                                )}

                                {/* Delete / Unmerge */}
                                {(hasValue || isMerged) && (
                                    <button
                                        onClick={() => {
                                            setIsOpen(false);
                                            isMerged ? onUnmerge?.() : onDelete();
                                        }}
                                        className="flex items-center w-full px-3 py-1.5 text-sm hover:bg-red-50 text-red-600 rounded-sm"
                                    >
                                        {isMerged ? (
                                            <>
                                                <Split className="mr-2 h-4 w-4 text-red-500" />
                                                Unmerge
                                            </>
                                        ) : (
                                            <>
                                                <Trash className="mr-2 h-4 w-4 text-red-500" />
                                                Delete
                                            </>
                                        )}
                                    </button>
                                )}

                                {/* Merge */}
                                {!hasValue && !isMerged && (
                                    <button
                                        onClick={() => {
                                            setIsOpen(false);
                                            onMerge();
                                        }}
                                        className="flex items-center w-full px-3 py-1.5 text-sm hover:bg-green-50 rounded-sm"
                                    >
                                        <Merge className="mr-2 h-4 w-4 text-green-500" />
                                        Merge
                                    </button>
                                )}
                            </div>,
                            document.body
                        )}
                </>
            );
        }
    );
    CellActionMenu.displayName = 'CellActionMenu';
    const AddCellButton = ({
        onClick,
        label
    }: {
        onClick: () => void,
        label: string
    }) => {
        return (
            <button
                onClick={onClick}
                className="flex items-center cursor-pointer justify-center w-full h-full p-1.5 rounded-md bg-transparent hover:bg-[#FFF3EA] transition-colors duration-150 group"
                title={`Add New ${label}`}
            >
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#FFE4D0] text-[#F97316] group-hover:bg-[#FFD9BC] group-hover:text-[#C2540F] transition-colors duration-150">
                    <Plus className="w-3.5 h-3.5" />
                </div>
                <span className="ml-2 text-xs font-medium text-[#F97316]">Add New {label}</span>
            </button>
        );
    };

    const handlePrint = () => {
        if (printRef.current) {
            printRef.current.handlePrint();
        }
    };

    const renderAddFirstMessages = () => {
        if (!selectedCourse) return null;

        return (
            <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
                <div className="text-gray-600 mb-4">
                    <Info className="w-12 h-12 mx-auto text-[#F97316] mb-2" />
                    <h3 className="text-lg font-medium mb-2">Add Content to Get Started</h3>
                    <p className="text-sm">
                        Please add content to the{" "}
                        <span className="font-semibold text-[#F97316]">
                            {nameOfMessage.toLowerCase()}
                        </span>{" "}
                        first
                    </p>
                </div>
            </div>
        );
    };

    // No DashboardLayout on purpose: this is the densest builder in the app,
    // and the sidebar + navbar cost it ~250px of working width. The breadcrumb
    // (Dashboard / Course Structure links) is the way back.

    return {
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
    }
}
