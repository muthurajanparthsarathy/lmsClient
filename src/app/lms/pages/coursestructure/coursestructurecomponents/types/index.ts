export interface Permission {
    permissionName: string;
    permissionKey: string;
    permissionFunctionality: string[];
    icon: string;
    color: string;
    description: string;
    isActive: boolean;
    order: number;
    _id: string;
    createdAt: string;
    updatedAt: string;
}

export interface UserData {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: {
        _id: string;
        originalRole: string;
        renameRole: string;
        roleValue: string;
    };
    permissions: Permission[];
}

// Updated ResourceType interface
export interface ResourceTypeConfig {
    enabled: boolean;
    maxSize?: number;
    aiChat?: boolean;
    aiSummary?: boolean;
    allowedFormats?: string[];
}

export interface PedagogyResources {
    video?: ResourceTypeConfig;
    ppt?: ResourceTypeConfig;
    pdf?: ResourceTypeConfig;
    url?: { enabled: boolean };
    aiChat?: { enabled: boolean };
    aiSummary?: { enabled: boolean };
    notes?: { enabled: boolean };
}

export interface ResourcesType {
    iDo: PedagogyResources;
    weDo: PedagogyResources;
    youDo: PedagogyResources;
}

export type CourseStructure = {
    _id: string;
    clientName: string | { $oid: string };
    clientData?: {
        clientCompany: string;
        clientAddress: string;
        contactPersons: Array<{
            name: string;
            email: string;
            phoneNumber: string;
            isPrimary: boolean;
        }>;
        description: string;
        status: string;
    };
    serviceType: string;
    serviceModal: string;
    category: string;
    courseCode: string;
    courseName: string;
    courseDescription: string;
    courseDuration: string;
    courseLevel: string;
    updatedAt: string;
    createdAt: string;
    resourcesType: string[] | ResourcesType; // Can be array OR object
    courseHierarchy: string[];
    I_Do: string[];
    We_Do: string[];
    You_Do: string[];
    courseImage?: string;
    status: 'Published' | 'Draft' | 'Unpublished';
    isActive: boolean;
    // Number of Module1 docs linked to this course (from /courses-structure/getAll).
    // 0 → fresh course with no structure: structure-dependent actions are disabled.
    moduleCount?: number;
    // Distinct enrolled users across the course's batches (same endpoint). Used to
    // ungate the Program Calendar once a cohort exists, even before any modules do.
    participantCount?: number;
};


export interface Statistics {
    total: number;
    recent: number;
    active: number;
}