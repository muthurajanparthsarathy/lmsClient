// Shared types for the Pedagogy Management screen.
// Moved verbatim out of page.tsx during the file split — no shape was changed;
// every interface is byte-for-byte what the page declared inline.

import type React from "react"
import type { JSX } from "react"


export interface Modules {
    _id: string
    id: string
    name?: string
    topics?: Topic[]
    title: string;
    description?: string;
    duration?: number;
    level?: string;
    courses: string[];

    index?: number;

}


export type MergeRange = { startRow: number; endRow: number };

export interface SubModuleCreateData {
    title: string;
    description?: string;
    level: string;
    moduleId: string;
    // courses: string;
    index?: number;
    duration?: number;
}

export interface PreviewTableProps {
    tableRows: any[];
    courseHours: CourseHours;
    mergedCells: { [key: string]: MergedCell[] };
    selectedCourse: Course | null;
    activityTypes: {
        iDo: string[];
        weDo: string[];
        youDo: string[];
        all: string[];
    };
    selectedPedagogyTypes: ("iDo" | "weDo" | "youDo" | "all")[];
    moduleSpans: { [key: string]: number };
    subModuleSpans: { [key: string]: number };
    topicSpans: { [key: string]: number };
    exportSelections: {
        summaryIncludeTotalHours?: JSX.Element;
        hoursOption?: string;
        includeTotalHours?: React.JSX.Element;
        printPedagogy: any;
        showSummary: any;
        hierarchy: {
            module: boolean;
            subModule: boolean;
            topic: boolean;
            subTopic: boolean;
            level: boolean;
        };
        pedagogy: {
            iDo: boolean | string[];
            weDo: boolean | string[];
            youDo: boolean | string[];
        };
    };
    onExport: () => void;
    setExportSelections: React.Dispatch<React.SetStateAction<ExportSelections>>;
    isPrinting?: boolean;
    // Closed over by PreviewTable before the split; now passed in so the
    // component can live in its own file. Same functions, still defined in
    // the page and handed down unchanged.
    // React-query result the page fetches; read-only here for the merge
    // lookups. Typed loosely to match the query's own inferred data.
    pedagogyViews: any;
    isLevelMerged: (rowIndex: number) => any;
    renderActivityCell: (
        type: "iDo" | "weDo" | "youDo",
        activity: string,
        row: any,
        index: number,
        mergeInfo: any,
        isPreview?: boolean
    ) => React.ReactNode;
}


export interface ModuleFormData {
    title: string;
    description?: string;
    level: string;
    duration?: number;
    index?: number;
}

// Add this to your existing interfaces
export interface Topic {
    _id: string;
    title: string;
    description?: string;
    level: string;
    moduleId: string;
    subModuleId: string;
    index?: number;
    duration?: number;
    courses: string;
}

export interface TopicCreateData {
    title: string;
    description?: string;
    level: string;
    moduleId: string;
    subModuleId: string;
    courses: string;
    duration?: number;
}

// Add these to your existing interfaces
export interface SubTopic {
    _id: string;
    title: string;
    description?: string;
    level: string;
    topicId: string;
    courses: string;
    index?: number;
    duration?: number;

}

export interface SubTopicCreateData {
    title: string;
    description?: string;
    level: string;
    topicId: string;
    courses: string;
    duration?: number;
}

export interface ExportSelections {
    includeTotalHours: any;
    hoursOption: string;
    printPedagogy: any;
    hierarchy: {
        module: boolean;
        subModule: boolean;
        topic: boolean;
        subTopic: boolean;
        level: boolean;
    };
    pedagogy: {
        iDo: boolean | string[];
        weDo: boolean | string[];
        youDo: boolean | string[];
    };
    showSummary: boolean;
}

export interface CourseHours {
    [moduleId: string]: {
        [topicId: string]: {
            [subtopicId: string]: {
                "iDo": {
                    [activityName: string]: number;
                }
                "weDo": {
                    [activityName: string]: number;
                }
                "youDo": {
                    [activityName: string]: number;
                }
            }
        }
    }
}

export interface MergedCell {
    startRow: number;
    endRow: number;
    value: number;
    type: "iDo" | "weDo" | "youDo";
    activity: string;
    rowIds: string[];
    hierarchyIds: {
        modules: string[];
        subModules: string[];
        topics: string[];
        subTopics: string[];
    };
}

export interface Course {
    title: any;
    category: string;
    courseCode: string;
    clientName: string | undefined;
    serviceType: string | undefined;
    serviceModal: string | undefined;
    courseLevel: string;
    _id: string
    courseName: string
    courseHierarchy: string[]
    I_Do: string[]
    We_Do: string[] | Record<string, string[]>
    You_Do: string[]
}

export interface MergedLevel {
    value: string;
    rowIds: string[];
    hierarchyIds: {
        modules: string[];
        subModules: string[];
        topics: string[];
        subTopics: string[];
    };
    startRow: number;
    endRow: number;
}
export type ActivityType = "iDo" | "weDo" | "youDo";
export type PedagogyType = "iDo" | "weDo" | "youDo";

export interface HierarchyMerges {
    module: Record<string, MergeRange>;
    subModule: Record<string, MergeRange>;
    topic: Record<string, MergeRange>;
}
