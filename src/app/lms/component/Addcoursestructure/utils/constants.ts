// AddCourseSettingsPopup/utils/constants.ts
import { FormData as CourseFormDataType, PedagogyResources } from "../types";

export const steps = [
    { number: 1, title: 'Course Basic Configuration', description: 'Basic configuration' },
    { number: 2, title: 'Course Hierarchy and Layout', description: 'Structure your course' },
];

export const popupVariants = {
    hidden: {
        opacity: 0,
        y: 20,
        transition: { duration: 0.1 }
    },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.3, ease: "easeOut" }
    },
    exit: {
        opacity: 0,
        y: -20,
        transition: { duration: 0.1 }
    }
} as const;

export const toastConfig = {
    position: "top-right" as const,
    autoClose: 3000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    className: '!p-0 !m-0 !bg-transparent !shadow-none !border-0',
    progressClassName: '!bg-white/30 !h-1',
};

export const defaultResourcesType: PedagogyResources = {
    iDo: {
        video: { enabled: false, maxSize: 50, allowedFormats: [] },
        ppt: { enabled: false, maxSize: 20, allowedFormats: [] },
        pdf: { enabled: false, maxSize: 10, allowedFormats: [] },
        image: { enabled: false, maxSize: 10, allowedFormats: [] },
        zip: { enabled: false, maxSize: 100, allowedFormats: [] },
        url: { enabled: false },
        aiChat: { enabled: false },
        aiSummary: { enabled: false },
        notes: { enabled: false },
        ai: { enabled: false }
    },
    weDo: {
        video: { enabled: false, maxSize: 50, allowedFormats: [] },
        ppt: { enabled: false, maxSize: 20, allowedFormats: [] },
        pdf: { enabled: false, maxSize: 10, allowedFormats: [] },
        image: { enabled: false, maxSize: 10, allowedFormats: [] },
        zip: { enabled: false, maxSize: 100, allowedFormats: [] },
        url: { enabled: false },
        aiChat: { enabled: false },
        aiSummary: { enabled: false },
        notes: { enabled: false },
        ai: { enabled: false },
        autoQuestionGenerate: { enabled: false }
    },
    youDo: {
        video: { enabled: false, maxSize: 50, allowedFormats: [] },
        ppt: { enabled: false, maxSize: 20, allowedFormats: [] },
        pdf: { enabled: false, maxSize: 10, allowedFormats: [] },
        image: { enabled: false, maxSize: 10, allowedFormats: [] },
        zip: { enabled: false, maxSize: 100, allowedFormats: [] },
        url: { enabled: false },
        aiChat: { enabled: false },
        aiSummary: { enabled: false },
        notes: { enabled: false },
        ai: { enabled: false },
        autoQuestionGenerate: { enabled: false }
    }
};

// Renamed to avoid conflict with global FormData
export const initialCourseFormData: CourseFormDataType = {
    client: '',
    clientName: '',
    modal: '',
    serviceTypeName: '',
    duration: '',
    serviceModelName: '',
    categoryName: '',
    categoryDisplayName: '',
    studentType: '',
    batch: '',
    skillingBatches: [],
    degree: '',
    department: '',
    semester: '',
    sections: [],
    selectedCourseName: '',
    title: '',
    courseid: '',
    courseDescription: '',
    level: '',
    instructor: '',
    iDo: [],
    weDo: [],
    youDo: [],
    image: null,
    checkboxOptions: {
        module: false,
        submodule: false,
        topic: false,
        subtopic: false
    },
    resourcesType: defaultResourcesType,
    modules: [{
        name: '',
        contentOptions: { ppt: false, pdf: false, video: false },
        submodules: [{
            name: '',
            contentOptions: { ppt: false, pdf: false, video: false },
            topics: [{
                name: '',
                contentOptions: { ppt: false, pdf: false, video: false },
                subtopics: ['']
            }]
        }]
    }],
    aiChatGlobal: false,
    testConfiguration: {
        coreProgram: [],
        frontend: [],
        database: []
    }
};