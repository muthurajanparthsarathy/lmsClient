// AddCourseSettingsPopup/types.ts
export interface AddCourseSettingsPopupProps {
    isOpen: boolean;
    onClose: () => void;
    courseId?: string;
    onSuccess?: () => void;
    totalCourses?: number;
}

export interface PedagogyElement {
    id: string;
    name: string;
    _id?: string;
}

export interface PedagogyActivity {
    id: string;
    name: string;
    title: string;
    icon: React.ReactNode;
    elements: PedagogyElement[];
}

export interface Category {
    _id: string;
    categoryName: string;
    categoryDescription: string;
    categoryCode: string;
    courseNames: string[];
    createdAt?: string;
    updatedAt?: string;
}

export interface CheckboxOptions {
    module: boolean;
    submodule: boolean;
    topic: boolean;
    subtopic: boolean;
}

export interface ServiceModal {
    id: string;
    name: string;
    description: string;
}

export interface Service {
    id: string;
    name: string;
    status: 'Active' | 'Inactive';
    description: string;
    serviceModals: ServiceModal[];
}

export type ContactPerson = {
    name: string;
    email: string;
    phoneNumber: string;
    isPrimary: boolean;
};

// Client Management shapes (standalone client management data)
// A department with its own sections + one or more semesters
export interface ClientDepartment {
    department?: string;
    sections?: string[];
    semesters?: string[];
}

// A batch block: batch + degree + departments (each with sections + semester)
export interface ClientDegreeProgram {
    batch?: string;
    degree?: string;
    departments?: ClientDepartment[];
}

export interface ClientServiceEntry {
    service?: string;
    serviceModals?: string[];
    // Company clients: batch-only
    batches?: string[];
    // College clients: batch blocks
    degreePrograms?: ClientDegreeProgram[];
}

export type Client = {
    _id: string;
    contactPersons?: ContactPerson[];
    clientCompany: string;
    description?: string;
    clientAddress?: string;
    status?: string;
    isActive?: boolean;
    // Client Management: type drives which fields show; services carry the data
    type?: ('college' | 'company')[];
    services?: ClientServiceEntry[];
};

// A department with the sections this course applies to + its semester
// (ME → [A, B] · Sem 2 ; ECE → [A, B, C] · Sem 3)
export interface CourseDepartmentSection {
    department: string;
    sections: string[];
    semesters?: string[];
}

// One full client configuration block for a course: a batch + degree and its
// departments/sections/semesters. A course can hold several of these.
export interface CourseClientConfig {
    batch: string;
    degree: string;
    departmentSections: CourseDepartmentSection[];
}

export interface FileResource {
    enabled: boolean;
    maxSize: number;
    allowedFormats: string[];
    aiChat?: boolean;
    aiSummary?: boolean;
    // Per-type Notes toggle (ppt/pdf/video/image) — this upload also carries
    // its own notes, separate from the standalone `notes` resource type.
    notes?: boolean;
}

export interface SimpleResource {
    enabled: boolean;
}

// Mirrors the Super Admin's Resource Management catalog. Which of these a
// course may actually turn on is decided at render time by the institution's
// saved settings (see Resourcetypesection).
export interface ResourceConfigType {
    video?: FileResource;
    ppt?: FileResource;
    pdf?: FileResource;
    image?: FileResource;
    zip?: FileResource;
    url?: SimpleResource;
    aiChat?: SimpleResource;
    aiSummary?: SimpleResource;
    notes?: SimpleResource;
    ai?: SimpleResource;
    // We Do / You Do only — pairs with aiChat ("AI Assistant").
    autoQuestionGenerate?: SimpleResource;
}

export interface PedagogyResources {
    iDo: ResourceConfigType;
    weDo: ResourceConfigType;
    youDo: ResourceConfigType;
}

export interface TestConfiguration {
  coreProgram: string[];
  frontend: string[];
  database: string[];
}

export interface FormData {
    client: string;           // This should store the client ObjectId
    clientName?: string;      // Optional: store client name for display
    modal: string;            // Service Type ID
    serviceTypeName?: string; // Service Type Name (for display and API)
    duration: string;         // Service Model ID
    serviceModelName?: string; // Service Model Name (for display and API)
    categoryName: string;     // Category ID
    categoryDisplayName?: string; // Category Name (for display and API)
    // ─── Client-driven cascade (same as User modal) ───
    studentType?: 'degree-program' | 'skilling' | '';
    batch?: string;           // single-select, used by the degree-program cascade
    skillingBatches?: string[]; // multi-select (checkboxes), used by company batches
    degree?: string;
    department?: string;      // kept for back-compat (first selected department)
    semester?: string;
    sections?: string[];      // kept for back-compat (flattened sections)
    // A course can span multiple departments, each with its own sections
    departmentSections?: CourseDepartmentSection[];
    // Multiple full client-configuration blocks (batch + degree + departments)
    clientConfigurations?: CourseClientConfig[];
    selectedCourseName: string;
    title: string;
    courseid: string;
    courseDescription: string;
    level: string;
    instructor: string;
    iDo: string[];
    weDo: string[];
    youDo: string[];
    image: File | null;
    checkboxOptions: CheckboxOptions;
    resourcesType: PedagogyResources;
    modules: Array<any>;
    aiChatGlobal: boolean;
    testConfiguration: TestConfiguration;
}

export interface ValidationErrors {
    client?: string;
    modal?: string;
    duration?: string;
    categoryName?: string;
    selectedCourseName?: string;
    level?: string;
    courseDescription?: string;
    checkboxOptions?: string;
    resourceType?: string;
    programmingConfiguration?: string;
    // Resources-by-batch: answered No but no element ticked.
    batchResources?: string;
}

export interface PreviewData {
    modules: Array<{
        name: string;
        topics: Array<{
            name: string;
            learningLevel: string;
            lectureHours: number;
            handsOnTraining: number;
            selfStudy: number;
        }>;
    }>;
    pedagogy: {
        iDo: string[];
        weDo: string[];
        youDo: string[];
    };
}