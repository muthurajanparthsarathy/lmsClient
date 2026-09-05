// AddCourseSettingsPopup/utils/helpers.ts
import { Client, FormData as CourseFormData, PedagogyResources, Service, ServiceModal } from "../components/types";

export const safeGet = (obj: any, path: string, defaultValue: any = null) => {
    const keys = path.split('.');
    let result = obj;
    for (const key of keys) {
        if (result === null || result === undefined) {
            return defaultValue;
        }
        result = result[key];
    }
    return result !== undefined ? result : defaultValue;
};

export const generateCourseId = (
    client: string,
    modal: string,
    duration: string,
    clientList: Client[],
    services: Service[],
    totalCourses: number
): string => {
    if (!client || !modal || !duration) return '';
    if (!clientList.length || !services.length) return ''; // Add check

    const selectedClient = clientList.find(c => c._id === client);
    const clientName = selectedClient?.clientCompany || 'Client';

    const service = services.find((s: Service) => s.id === modal);
    const serviceType = service?.name || 'Service';

    const serviceModel = service?.serviceModals?.find((m: ServiceModal) => m.id === duration)?.name || 'Model';

    const clientAbbr = clientName.split(' ').map(word => word[0]?.toUpperCase() || '').join('').slice(0, 3);
    const serviceTypeAbbr = serviceType.split(' ').map((word: string) => word[0]?.toUpperCase() || '').join('').slice(0, 3);
    const serviceModelAbbr = serviceModel.split(' ').map((word: string) => word[0]?.toUpperCase() || '').join('').slice(0, 3);

    const nextNumber = totalCourses + 1;
    const formattedNumber = nextNumber.toString().padStart(3, '0');
    
    return `${clientAbbr}-${serviceTypeAbbr}-${serviceModelAbbr}-${formattedNumber}`;
};

export const initializeResourcesType = (existingResources: any): PedagogyResources => {
    const defaultFileConfig = {
        enabled: false,
        maxSize: 50,
        allowedFormats: []
    };

    return {
        iDo: {
            video: { ...defaultFileConfig, ...safeGet(existingResources, 'iDo.video', {}), maxSize: safeGet(existingResources, 'iDo.video.maxSize', 50) },
            ppt: { ...defaultFileConfig, ...safeGet(existingResources, 'iDo.ppt', {}), maxSize: safeGet(existingResources, 'iDo.ppt.maxSize', 20) },
            pdf: { ...defaultFileConfig, ...safeGet(existingResources, 'iDo.pdf', {}), maxSize: safeGet(existingResources, 'iDo.pdf.maxSize', 10) },
            image: { ...defaultFileConfig, ...safeGet(existingResources, 'iDo.image', {}), maxSize: safeGet(existingResources, 'iDo.image.maxSize', 10) },
            zip: { ...defaultFileConfig, ...safeGet(existingResources, 'iDo.zip', {}), maxSize: safeGet(existingResources, 'iDo.zip.maxSize', 100) },
            url: { enabled: safeGet(existingResources, 'iDo.url.enabled', false) },
            aiChat: { enabled: safeGet(existingResources, 'iDo.aiChat.enabled', false) },
            aiSummary: { enabled: safeGet(existingResources, 'iDo.aiSummary.enabled', false) },
            notes: { enabled: safeGet(existingResources, 'iDo.notes.enabled', false) },
            ai: { enabled: safeGet(existingResources, 'iDo.ai.enabled', false) }
        },
        weDo: {
            video: { enabled: false, maxSize: 50, allowedFormats: [] },
            ppt: { enabled: false, maxSize: 20, allowedFormats: [] },
            pdf: { enabled: false, maxSize: 10, allowedFormats: [] },
            image: { enabled: false, maxSize: 10, allowedFormats: [] },
            zip: { enabled: false, maxSize: 100, allowedFormats: [] },
            url: { enabled: false },
            aiChat: { enabled: safeGet(existingResources, 'weDo.aiChat.enabled', false) },
            aiSummary: { enabled: safeGet(existingResources, 'weDo.aiSummary.enabled', false) },
            notes: { enabled: safeGet(existingResources, 'weDo.notes.enabled', false) },
            ai: { enabled: safeGet(existingResources, 'weDo.ai.enabled', false) },
            autoQuestionGenerate: { enabled: safeGet(existingResources, 'weDo.autoQuestionGenerate.enabled', false) }
        },
        youDo: {
            video: { enabled: false, maxSize: 50, allowedFormats: [] },
            ppt: { enabled: false, maxSize: 20, allowedFormats: [] },
            pdf: { enabled: false, maxSize: 10, allowedFormats: [] },
            image: { enabled: false, maxSize: 10, allowedFormats: [] },
            zip: { enabled: false, maxSize: 100, allowedFormats: [] },
            url: { enabled: false },
            aiChat: { enabled: safeGet(existingResources, 'youDo.aiChat.enabled', false) },
            aiSummary: { enabled: safeGet(existingResources, 'youDo.aiSummary.enabled', false) },
            notes: { enabled: safeGet(existingResources, 'youDo.notes.enabled', false) },
            ai: { enabled: safeGet(existingResources, 'youDo.ai.enabled', false) },
            autoQuestionGenerate: { enabled: safeGet(existingResources, 'youDo.autoQuestionGenerate.enabled', false) }
        }
    };
};

// Seeds a brand-new course's resource configuration from the mapping's Step 3
// (Resources) defaults — see ServiceMappingModel.resourceDefaults. The two
// carry the SAME shape, so this is a normalise-and-copy rather than a
// translation. Only ever applied to a fresh course: an edit loads its own saved
// resourcesType, which always wins.
export const applyMappingResourceDefaults = (
    formData: CourseFormData,
    resourceDefaults: unknown
): CourseFormData => {
    if (!resourceDefaults || typeof resourceDefaults !== 'object') return formData;

    return {
        ...formData,
        resourcesType: initializeResourcesType(resourceDefaults),
    };
};

// Client-Management based course ID: built purely from the client / service /
// modal NAMES (no id lookups), and works even when there are no existing
// courses yet (first course → …-001).
export const generateNextCourseId = (
    clientName: string,
    serviceTypeName: string,
    serviceModelName: string,
    existingCourseIds: Set<string>
): string => {
    if (!clientName || !serviceTypeName || !serviceModelName) return '';

    const abbr = (s: string) => {
        const words = (s || '').trim().split(/\s+/).filter(Boolean);
        if (words.length === 0) return '';
        // Single word → first 3 letters (e.g. "STC" → "STC"); multi-word →
        // initials (e.g. "business to institution" → "BTI")
        if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
        return words.map(w => w[0]?.toUpperCase() || '').join('').slice(0, 3);
    };

    const clientAbbr = abbr(clientName) || 'CLI';
    const serviceAbbr = abbr(serviceTypeName) || 'SRV';
    const modelAbbr = abbr(serviceModelName) || 'MDL';

    const prefix = `${clientAbbr}-${serviceAbbr}-${modelAbbr}`;

    let counter = 1;
    let courseId = `${prefix}-${String(counter).padStart(3, '0')}`;
    let attempts = 0;
    while (existingCourseIds.has(courseId) && attempts < 1000) {
        counter++;
        courseId = `${prefix}-${String(counter).padStart(3, '0')}`;
        attempts++;
    }
    return courseId;
};

export const generateUniqueCourseId = (
    clientId: string,
    serviceId: string,
    modelId: string,
    clientList: Client[],
    services: Service[],
    serviceModels: ServiceModal[],
    existingCourseIds: Set<string>
): string => {
    // Early return if required data is not available
    if (!clientId || !serviceId || !modelId) return '';
    if (!clientList.length || !services.length || !serviceModels.length) return '';
    if (!existingCourseIds.size) return '';

    const client = clientList.find(c => c._id === clientId);
    const service = services.find(s => s.id === serviceId);
    const model = serviceModels.find(m => String(m.id) === String(modelId));

    if (!client || !service || !model) return '';

    // Get abbreviations (max 3 characters each)
    const clientAbbr = (client.clientCompany || '')
        .split(' ').map(w => w[0]?.toUpperCase() || '').join('').slice(0, 3);
    const serviceAbbr = (service.name || '')
        .split(' ').map(w => w[0]?.toUpperCase() || '').join('').slice(0, 3);
    const modelAbbr = (model.name || '')
        .split(' ').map(w => w[0]?.toUpperCase() || '').join('').slice(0, 3);

    // If any abbreviation is empty, use default
    const finalClientAbbr = clientAbbr || 'CLI';
    const finalServiceAbbr = serviceAbbr || 'SRV';
    const finalModelAbbr = modelAbbr || 'MDL';

    const prefix = `${finalClientAbbr}-${finalServiceAbbr}-${finalModelAbbr}`;

    let counter = 1;
    let courseId = `${prefix}-${String(counter).padStart(3, '0')}`;

    // Keep incrementing until we find a unique ID (limit to 1000 attempts)
    let attempts = 0;
    const maxAttempts = 1000;
    
    while (existingCourseIds.has(courseId) && attempts < maxAttempts) {
        counter++;
        courseId = `${prefix}-${String(counter).padStart(3, '0')}`;
        attempts++;
    }

    return courseId;
};