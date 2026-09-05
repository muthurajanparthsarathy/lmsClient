// courseStructureService.ts - Updated version
import { http as apiClient } from "@/lib/http";
import { getToken as getCurrentToken } from "@/lib/session";

const objectToFormData = (obj: any, formData: FormData = new FormData(), parentKey?: string): FormData => {
  for (let key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      const formKey = parentKey ? `${parentKey}[${key}]` : key;
      
      if (value === null || value === undefined) {
        continue;
      }
      
      // Handle File objects
      if (value instanceof File) {
        formData.append(formKey, value);
        continue;
      }
      
      // Handle arrays
      if (Array.isArray(value)) {
        if (value.length === 0) {
          formData.append(formKey, '');
        } else {
          value.forEach((item, index) => {
            if (typeof item === 'object' && item !== null && !(item instanceof File)) {
              objectToFormData(item, formData, `${formKey}[${index}]`);
            } else {
              formData.append(`${formKey}[${index}]`, String(item));
            }
          });
        }
        continue;
      }
      
      // Handle nested objects
      if (typeof value === 'object' && value !== null) {
        // For empty objects, send empty string
        if (Object.keys(value).length === 0) {
          formData.append(formKey, '');
        } else {
          objectToFormData(value, formData, formKey);
        }
        continue;
      }
      
      // Handle primitive values
      formData.append(formKey, String(value));
    }
  }
  return formData;
};

// Helper to convert resourcesType to proper format
const formatResourcesType = (resourcesType: any) => {
    if (!resourcesType) return { iDo: [], weDo: [], youDo: [] };
    
    return {
        iDo: resourcesType.iDo || [],
        weDo: resourcesType.weDo || [],
        youDo: resourcesType.youDo || []
    };
};

// FULL payload — the shared ['courseStructures'] key feeds ELEVEN consumers,
// including pedagogy2's usePedagogyManagement, ProgramCalendarContent,
// PedagogyPage and the attendance pages, which resolve courses from this
// list and read courseHierarchy / testConfiguration / I_Do-We_Do-You_Do.
// Do NOT wire ?summary=1 into this fetcher: that projection omits those
// fields and crashes those pages (caught in review). Summary-safe listing
// consumers use fetchCourseStructuresSummary below instead.
export const fetchAllCourseStructures = async (): Promise<any> => {
    const response = await apiClient.get('/courses-structure/getAll');
    return response.data.data;
};

// ?summary=1: listing projection (scalars + moduleCount/participantCount/
// hasModuleHours), no populated rosters — a fraction of the full payload.
// Cached under its OWN ['courseStructures','summary'] key; the shared
// 'courseStructures' root prefix means invalidations of ['courseStructures']
// refresh both entries, and the persister exclusion covers both. An older
// server ignores the param and returns the full payload — a superset, so
// summary consumers work against both.
export const fetchCourseStructuresSummary = async (): Promise<any> => {
    const response = await apiClient.get('/courses-structure/getAll?summary=1');
    return response.data.data;
};

export const courseStructuresSummaryQuery = () => ({
    queryKey: ['courseStructures', 'summary'] as const,
    queryFn: fetchCourseStructuresSummary,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
});

export const fetchCourseStructureById = async (courseId: string): Promise<any> => {
    const response = await apiClient.get(`/courses-structure/getById/${courseId}`);
    return response.data;
};

export const createCourseStructure = async (courseData: any): Promise<any> => {
  const formData = new FormData();
  
  const preparedData = {
    clientId: courseData.clientId,
    // The ServiceMapping this setup was created from — it scopes the course's
    // identity, so dropping it here would silently break per-mapping setups.
    mappingId: courseData.mappingId,
    // WHERE in that mapping the course sits. Same course name under two
    // departments is two setups, and this is what tells them apart — without it
    // they collapse back into one shared record.
    coursePath: courseData.coursePath || '',
    clientName: courseData.clientName,
    serviceType: courseData.serviceType,
    serviceModal: courseData.serviceModal,
    category: courseData.category,
    courseCode: courseData.courseCode,
    courseName: courseData.courseName,
    courseDescription: courseData.courseDescription || '',
    courseDuration: courseData.courseDuration || '',
    courseLevel: courseData.courseLevel,
    I_Do: courseData.I_Do || [],
    We_Do: courseData.We_Do || [],
    You_Do: courseData.You_Do || [],
    aiChatGlobal: courseData.aiChatGlobal || false,
    courseHierarchy: courseData.courseHierarchy || [],
    resourcesType: courseData.resourcesType,
    testConfiguration: courseData.testConfiguration, // Add this line
    // Client-driven cascade values
    studentType: courseData.studentType || '',
    batch: courseData.batch || '',
    skillingBatches: courseData.skillingBatches || [],
    degree: courseData.degree || '',
    departmentSections: courseData.departmentSections || [],
    createdBy: courseData.createdBy,
    institution: courseData.institution
  };
  
  // Convert to FormData
  objectToFormData(preparedData, formData);

  // Multiple client-configuration blocks — sent as JSON (deeply nested)
  formData.append('clientConfigurations', JSON.stringify(courseData.clientConfigurations || []));

  // The course's own batch names from the mapping (Degree Program per-course
  // batches). JSON like clientConfigurations, so an empty list still reaches
  // the server as "explicitly none" rather than an absent field.
  formData.append('batches', JSON.stringify(courseData.batches || []));

  // Batch-wise content config (Resources by batch section) — an OBJECT, so it
  // rides as JSON like clientConfigurations; the bracket serializer would
  // mangle it into unusable keys.
  if (courseData.batchResources !== undefined) {
    formData.append('batchResources', JSON.stringify(courseData.batchResources));
  }

  // Handle image separately
  if (courseData.courseImage && courseData.courseImage instanceof File) {
    formData.append('courseImage', courseData.courseImage);
  }

  const response = await apiClient.post(
    '/courses-structure/create',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      }
    }
  );

  return response.data;
};

export const updateCourseStructure = async (courseId: string, courseData: any): Promise<any> => {
    const formData = new FormData();
    
    // Format resourcesType properly. clientConfigurations, batches and
    // batchResources are sent as JSON separately, so keep them out of the
    // bracket serializer — the server parses each as a JSON string.
    const { clientConfigurations, batches, batchResources, ...rest } = courseData;
    const formattedData = {
        ...rest,
        resourcesType: formatResourcesType(courseData.resourcesType)
    };

    // Convert the entire formattedData object to FormData
    objectToFormData(formattedData, formData);

    // Multiple client-configuration blocks — sent as JSON
    formData.append('clientConfigurations', JSON.stringify(clientConfigurations || []));

    // Only when the caller actually passed the field: callers that predate it
    // (the legacy Add Course Structure popup) must not wipe stored batches.
    if (batches !== undefined) {
        formData.append('batches', JSON.stringify(batches || []));
    }

    // Same only-when-sent rule for the batch-content config.
    if (batchResources !== undefined) {
        formData.append('batchResources', JSON.stringify(batchResources));
    }

    // Ensure courseImage is properly handled if it's a File object
    if (courseData.courseImage && courseData.courseImage instanceof File) {
        formData.append('courseImage', courseData.courseImage);
    }
    
    // Append removeImage flag if needed
    if (courseData.removeImage) {
        formData.append('removeImage', 'true');
    }

    const response = await apiClient.put(
        `/courses-structure/update/${courseId}`,
        formData,
        {
            headers: {
                'Content-Type': 'multipart/form-data',
            }
        }
    );

    return response.data;
};

export const deleteCourseStructure = async (courseId: string): Promise<any> => {
    const response = await apiClient.delete(
        `/courses-structure/delete/${courseId}`
    );
    return response.data;
};

// WebSocket connection for real-time updates
let socket: WebSocket | null = null;

export const setupCourseStructuresWebSocket = (
    onUpdate: (updatedCourse: any) => void,
    onDelete: (deletedCourseId: string) => void,
    onCreate: (newCourse: any) => void
) => {
    if (socket) return socket;

    const token = getCurrentToken();
    if (!token) {
        throw new Error('No authentication token available');
    }

    socket = new WebSocket(`ws://localhost:5533/courses-structure/updates?token=${token}`);

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        switch (data.type) {
            case 'course_structure_updated':
                onUpdate(data.course);
                break;
            case 'course_structure_deleted':
                onDelete(data.courseId);
                break;
            case 'course_structure_created':
                onCreate(data.course);
                break;
        }
    };

    socket.onclose = () => {
        console.log('Course structures WebSocket disconnected');
        socket = null;
    };

    return socket;
};

export const closeCourseStructuresWebSocket = () => {
    if (socket) {
        socket.close();
        socket = null;
    }
};

// React Query API configuration.
// The single canonical key for GET /courses-structure/getAll is
// ['courseStructures'] — the service-mapping wizard used to keep a private
// ['course-structures','all'] copy and useCourseData a ['allCourseStructures']
// copy, so a save that invalidated one didn't reach the other. Use this key
// everywhere. Polling replaced by a normal cache: this endpoint's payload is
// large (deep populate + pedagogy) and course changes come from THIS app's
// own mutations, which already invalidate this key.
export const courseStructureApi = {
    getAll: () => ({
        queryKey: ['courseStructures'],
        queryFn: fetchAllCourseStructures,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    }),
    getById: (courseId: string) => ({
        queryKey: ['courseStructure', courseId],
        queryFn: () => fetchCourseStructureById(courseId),
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    }),
    create: () => ({
        mutationFn: createCourseStructure,
    }),
    update: (courseId: string) => ({
        mutationFn: (data: any) => updateCourseStructure(courseId, data),
    }),
    delete: (courseId: string) => ({
        mutationFn: () => deleteCourseStructure(courseId),
    }),
};