import axios from "axios";
// Resources by Batch — every request below carries the batch the Resources
// screens are working in, stamped in ONE place so no call site can be missed.
// With no batch selected nothing is added and the server uses the shared,
// course-level container. See apiServices/resourceBatch.ts.
import {
  stampBatch,
  withBatchBody,
  batchParams,
  getActiveBatchId,
  type ResourceBatchContext,
} from "./resourceBatch";
export interface PageBlock {
  type: string;
  content: string;
  metadata?: Record<string, any>;
}

export interface PageData {
  id: string;
  title: string;
  blocks: PageBlock[];
}

export interface PagePayloadItem {
  id: string;
  name: string;
  html: string;
  blocks: PageBlock[];
}

export interface PagesPayload {
  pages: PagePayloadItem[];
  combinedHtml: string;
  hierarchyInfo?: {
    courseId: string;
    courseName: string;
    moduleId?: string;
    moduleName?: string;
    topicId?: string;
    topicName?: string;
    tabType?: "I_Do" | "We_Do" | "You_Do";
    subcategory?: string;
    folderPath?: string[];
    folderId?: string;
    nodeType?: string;
    // Group context: when the page is being created inside a group row
    // (via the "Add" action on that group), this carries the group's id
    // so the backend can attach the page to that group.
    groupId?: string;
    groupName?: string;
  };
}

const modelMap = {
  module: { path: "modules" },
  submodule: { path: "submodules" },
  topic: { path: "topics" },
  subtopic: { path: "subtopics" },
};

const BASE_URL = "https://lmsserver-yeve.onrender.com";

// Helper function to get token
const getToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('smartcliff_token');
  }
  return null;
};

export const entityApi = {
  updateEntity: async (
    entityType: "module" | "submodule" | "topic" | "subtopic",
    entityId: string,
    formData: FormData,
    onUploadProgress?: (progressEvent: { loaded: number; total?: number }) => void
  ) => {
    const token = getToken();
    const response = await axios.put(
      `${BASE_URL}/uploadResourses/${modelMap[entityType].path}/${entityId}`,
      stampBatch(formData),
      {
        headers: {
          "Content-Type": "multipart/form-data",
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        timeout: 20000000,
        onUploadProgress,
      }
    );
    return response.data;
  },

  createFolder: async (
    entityType: "module" | "submodule" | "topic" | "subtopic",
    entityId: string,
    folderData: {
      tabType: "I_Do" | "We_Do" | "You_Do";
      subcategory: string;
      folderName: string;
      folderPath: string;
      courses?: string;
      topicId?: string;
      index?: number;
      title?: string;
      description?: string;
      duration?: string;
      level?: string;
      tags?: Array<{ tagName: string; tagColor: string }>;
      createdAt?: string;
      updatedAt?: string;
      parentGroupId?: string;
      groupName?: string;
      groupDescription?: string;
    }
  ) => {
    const token = getToken();
    const formData = new FormData();

    // Add basic entity data
    if (folderData.courses) formData.append("courses", folderData.courses);
    if (folderData.topicId) formData.append("topicId", folderData.topicId);
    if (folderData.index !== undefined) formData.append("index", folderData.index.toString());
    if (folderData.title) formData.append("title", folderData.title);
    if (folderData.description) formData.append("description", folderData.description);
    if (folderData.duration) formData.append("duration", folderData.duration);
    if (folderData.level) formData.append("level", folderData.level);

    // Add folder-specific data
    formData.append("tabType", folderData.tabType);
    formData.append("subcategory", folderData.subcategory);
    formData.append("folderName", folderData.folderName);
    formData.append("folderPath", folderData.folderPath);
    formData.append("action", "createFolder");
    if (folderData.createdAt) formData.append("createdAt", folderData.createdAt);
    if (folderData.updatedAt) formData.append("updatedAt", folderData.updatedAt);
    if (folderData.parentGroupId) formData.append("parentGroupId", folderData.parentGroupId);
    if (folderData.groupName) formData.append("groupName", folderData.groupName);
    if (folderData.groupDescription) formData.append("groupDescription", folderData.groupDescription);

    // Add tags if any
    if (folderData.tags && folderData.tags.length > 0) {
      formData.append("tags", JSON.stringify(folderData.tags));
    }

    const response = await axios.put(
      `${BASE_URL}/uploadResourses/${modelMap[entityType].path}/${entityId}`,
      stampBatch(formData),
      {
        headers: {
          "Content-Type": "multipart/form-data",
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
      }
    );

    return response.data;
  },

updateFolder: async (
  entityType: "module" | "submodule" | "topic" | "subtopic",
  entityId: string,
  folderData: {
    tabType: "I_Do" | "We_Do" | "You_Do";
    subcategory: string;
    folderName: string;
    folderPath: string;
    courses?: string;
    topicId?: string;
    index?: number;
    title?: string;
    description?: string;
    duration?: string;
    level?: string;
    originalFolderName?: string;
    tags?: Array<{ tagName: string; tagColor: string }>; // ← ADD THIS
  }
) => {
  const token = getToken();
  const formData = new FormData();

  // Add basic entity data
  if (folderData.courses) formData.append("courses", folderData.courses);
  if (folderData.topicId) formData.append("topicId", folderData.topicId);
  if (folderData.index !== undefined) formData.append("index", folderData.index.toString());
  if (folderData.title) formData.append("title", folderData.title);
  if (folderData.description) formData.append("description", folderData.description);
  if (folderData.duration) formData.append("duration", folderData.duration);
  if (folderData.level) formData.append("level", folderData.level);

  // Add folder-specific data
  formData.append("tabType", folderData.tabType);
  formData.append("subcategory", folderData.subcategory);
  formData.append("folderName", folderData.folderName);
  formData.append("folderPath", folderData.folderPath);
  formData.append("action", "updateFolder");

  // ✅ ADD TAGS HERE
  if (folderData.tags && folderData.tags.length > 0) {
    formData.append("tags", JSON.stringify(folderData.tags));
  }

  // ✅ CRITICAL: Add the original folder name
  if (folderData.originalFolderName) {
    formData.append("originalFolderName", folderData.originalFolderName);
  }

  const response = await axios.put(
    `${BASE_URL}/uploadResourses/${modelMap[entityType].path}/${entityId}`,
    stampBatch(formData),
    {
      headers: {
        "Content-Type": "multipart/form-data",
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
    }
  );

  return response.data;
},

  deleteFolder: async (
    entityType: "module" | "submodule" | "topic" | "subtopic",
    entityId: string,
    folderData: {
      tabType: "I_Do" | "We_Do" | "You_Do";
      subcategory: string;
      folderName: string;
      folderPath: string;
      courses?: string;
      topicId?: string;
      index?: number;
      title?: string;
      description?: string;
      duration?: string;
      level?: string;
    }
  ) => {
    const token = getToken();
    const formData = new FormData();

    // Add basic entity data
    if (folderData.courses) formData.append("courses", folderData.courses);
    if (folderData.topicId) formData.append("topicId", folderData.topicId);
    if (folderData.index !== undefined) formData.append("index", folderData.index.toString());
    if (folderData.title) formData.append("title", folderData.title);
    if (folderData.description) formData.append("description", folderData.description);
    if (folderData.duration) formData.append("duration", folderData.duration);
    if (folderData.level) formData.append("level", folderData.level);

    // Add folder-specific data
    formData.append("tabType", folderData.tabType);
    formData.append("subcategory", folderData.subcategory);
    formData.append("folderName", folderData.folderName);
    formData.append("folderPath", folderData.folderPath);
    formData.append("action", "deleteFolder");

    const response = await axios.put(
      `${BASE_URL}/uploadResourses/${modelMap[entityType].path}/${entityId}`,
      stampBatch(formData),
      {
        headers: {
          "Content-Type": "multipart/form-data",
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
      }
    );

    return response.data;
  },

  deleteFile: async (
    entityType: "module" | "submodule" | "topic" | "subtopic",
    entityId: string,
    fileData: {
      tabType: "I_Do" | "We_Do" | "You_Do";
      subcategory: string;
      folderPath: string;
      courses?: string;
      topicId?: string;
      index?: number;
      title?: string;
      description?: string;
      duration?: string;
      level?: string;
      action: string;
      updateFileId: string;
    }
  ) => {
    const token = getToken();
    const formData = new FormData();

    // Add basic entity data
    if (fileData.courses) formData.append("courses", fileData.courses);
    if (fileData.topicId) formData.append("topicId", fileData.topicId);
    if (fileData.index !== undefined) formData.append("index", fileData.index.toString());
    if (fileData.title) formData.append("title", fileData.title);
    if (fileData.description) formData.append("description", fileData.description);
    if (fileData.duration) formData.append("duration", fileData.duration);
    if (fileData.level) formData.append("level", fileData.level);

    // Add file deletion data
    formData.append("tabType", fileData.tabType);
    formData.append("subcategory", fileData.subcategory);
    formData.append("folderPath", fileData.folderPath);
    formData.append("action", fileData.action);
    formData.append("updateFileId", fileData.updateFileId);

    const response = await axios.put(
      `${BASE_URL}/uploadResourses/${modelMap[entityType].path}/${entityId}`,
      stampBatch(formData),
      {
        headers: {
          "Content-Type": "multipart/form-data",
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
      }
    );

    return response.data;
  },

 createPage: async (
    entityType: "module" | "submodule" | "topic" | "subtopic",
    entityId: string,
    payload: PagesPayload  // Changed from pageData to accept the full payload
  ) => {
    const token = getToken();

    try {
      console.log('Creating page with payload:', {
        entityType,
        entityId,
        pageCount: payload.pages.length,
        hasCombinedHtml: !!payload.combinedHtml,
        hierarchyInfo: payload.hierarchyInfo
      });

      // Normalise the folder path into BOTH formats so the backend can
      // pick whichever one it stores against. Other page APIs in this file
      // are split: getPages/deletePage expect a string, updatePage expects
      // an array. We send both to be safe.
      // Root → "" / [], inside FolderA → "FolderA" / ["FolderA"].
      const fpArr = payload.hierarchyInfo?.folderPath;
      const folderPathArr = Array.isArray(fpArr)
        ? fpArr
        : (typeof fpArr === "string" && fpArr ? fpArr.split("/").filter(Boolean) : []);
      const folderPathStr = folderPathArr.join("/");

      const response = await axios.post(
        `${BASE_URL}/pages/${entityType}/${entityId}/pages`,
        withBatchBody({
          // Send the full PagesPayload structure
          pages: payload.pages,
          combinedCode: payload.combinedHtml, // Map combinedHtml to combinedCode for backend
          hierarchyInfo: payload.hierarchyInfo,
          // Also include individual fields for backward compatibility
          title: payload.pages[0]?.name || 'Untitled',
          blocks: payload.pages[0]?.blocks || [],
          tabType: payload.hierarchyInfo?.tabType,
          subcategory: payload.hierarchyInfo?.subcategory,
          // Send the array as `folderPath` (matches the previous shape this
          // endpoint received) and ALSO send the slash-joined string under
          // `folderPathString` so the backend can match either convention.
          folderPath: folderPathArr,
          folderPathString: folderPathStr,
          folderId: payload.hierarchyInfo?.folderId,
          // Group context — lets the backend attach the page to a group row
          groupId: payload.hierarchyInfo?.groupId,
          groupName: payload.hierarchyInfo?.groupName,
        }),
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Create page API error:', error);
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(error.response.data?.message?.[0]?.value || 'Failed to create page');
      }
      throw error;
    }
  },

  getPages: async (
    entityType: "module" | "submodule" | "topic" | "subtopic",
    entityId: string,
    params: {
      tabType: "I_Do" | "We_Do" | "You_Do";
      subcategory: string;
      folderPath?: string;
    }
  ) => {
    const token = getToken();
    const response = await axios.get(
      `${BASE_URL}/pages/${entityType}/${entityId}/pages`,
      { 
        params: { ...params, ...batchParams() },
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );
    return response.data;
  },

  getPageById: async (
    entityType: "module" | "submodule" | "topic" | "subtopic",
    entityId: string,
    pageId: string,
    params: {
      tabType: "I_Do" | "We_Do" | "You_Do";
      subcategory: string;
      folderPath?: string;
    }
  ) => {
    const token = getToken();
    const response = await axios.get(
      `${BASE_URL}/pages/${entityType}/${entityId}/pages/${pageId}`,
      { 
        params: { ...params, ...batchParams() },
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );
    return response.data;
  },
updatePage: async (
  entityType: "module" | "submodule" | "topic" | "subtopic",
  entityId: string,
  pageId: string,
  pageData: {
    title?: string;
    blocks?: any[];
    htmlContent?: string;
    pages?: Array<{ id: string; name: string; html: string; blocks: any[] }>; // ← ADD
    tabType: "I_Do" | "We_Do" | "You_Do";
    subcategory: string;
    folderPath?: string[];
  }
) => {
  const token = getToken();
  const response = await axios.put(
    `${BASE_URL}/pages/${entityType}/${entityId}/pages/${pageId}`,
    withBatchBody(pageData),
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );
  return response.data;
},

  deletePage: async (
    entityType: "module" | "submodule" | "topic" | "subtopic",
    entityId: string,
    pageId: string,
    data: {
      tabType: "I_Do" | "We_Do" | "You_Do";
      subcategory: string;
      folderPath?: string;
    }
  ) => {
    const token = getToken();
    const response = await axios.delete(
      `${BASE_URL}/pages/${entityType}/${entityId}/pages/${pageId}`,
      {
        data: withBatchBody(data),
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  },

  movePage: async (
    entityType: "module" | "submodule" | "topic" | "subtopic",
    entityId: string,
    pageId: string,
    data: {
      tabType: "I_Do" | "We_Do" | "You_Do";
      subcategory: string;
      sourceFolderPath?: string;
      destinationFolderPath: string;
    }
  ) => {
    const token = getToken();
    const response = await axios.post(
      `${BASE_URL}/pages/${entityType}/${entityId}/pages/${pageId}/move`,
      withBatchBody(data),
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  },
};

// File Settings API
export const fileSettingsApi = {
  updateFileSettings: async (
    entityType: "module" | "submodule" | "topic" | "subtopic",
    entityId: string,
    data: {
      tabType: "I_Do" | "We_Do" | "You_Do";
      subcategory: string;
      updateFileId: string;
      showToStudents: boolean;
      allowDownload: boolean;
      folderPath?: string;
      courses?: string;
      topicId?: string;
      index?: number;
      title?: string;
      description?: string;
      duration?: string;
      level?: string;
    }
  ) => {
    const token = getToken();
    const formData = new FormData();

    // Add basic entity data if provided
    if (data.courses) formData.append("courses", data.courses);
    if (data.topicId) formData.append("topicId", data.topicId);
    if (data.index !== undefined) formData.append("index", data.index.toString());
    if (data.title) formData.append("title", data.title);
    if (data.description) formData.append("description", data.description);
    if (data.duration) formData.append("duration", data.duration);
    if (data.level) formData.append("level", data.level);

    // Add file settings specific data
    formData.append("tabType", data.tabType);
    formData.append("subcategory", data.subcategory);
    formData.append("updateFileId", data.updateFileId);
    formData.append("showToStudents", data.showToStudents.toString());
    formData.append("allowDownload", data.allowDownload.toString());
    formData.append("action", "updateFileSettings");
    
    if (data.folderPath) {
      formData.append("folderPath", data.folderPath);
    }

    const response = await axios.put(
      `${BASE_URL}/uploadResourses/${modelMap[entityType].path}/${entityId}/settings`,
      stampBatch(formData),
      {
        headers: {
          "Content-Type": "multipart/form-data",
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
      }
    );

    return response.data;
  },
};

// Export types
export type CourseStructureData = {
  _id: string;
  courseName: string;
  courseDescription: string;
  I_Do: string[];
  We_Do: string[];
  You_Do: string[];
  resourcesType: string[];
  modules: Module[];
};

export type Module = {
  _id: string;
  title: string;
  description: string;
  duration: number;
  index: number;
  level: string;
  topics: Topic[];
  subModules: SubModule[];
  pedagogy?: any;
  testConfiguration?: { coreProgram: string[]; frontend: string[]; database: string[] };
};

export type SubModule = {
  _id: string;
  title: string;
  description: string;
  duration: number;
  index: number;
  level: string;
  topics: Topic[];
  pedagogy?: any;
  testConfiguration?: { coreProgram: string[]; frontend: string[]; database: string[] };
};

export type Topic = {
  _id: string;
  title: string;
  description: string;
  duration: number;
  index: number;
  level: string;
  subTopics: SubTopic[];
  pedagogy?: any;
  testConfiguration?: { coreProgram: string[]; frontend: string[]; database: string[] };
};

export type SubTopic = {
  _id: string;
  title: string;
  description: string;
  duration: number;
  index: number;
  level: string;
  pedagogy?: any;
  testConfiguration?: { coreProgram: string[]; frontend: string[]; database: string[] };
};

export const courseDataApi = {
  // ── Resources by Batch and the query keys below ──
  //
  // The active batch is part of every key. It has to be: React Query would
  // otherwise serve Batch A's cached pedagogy after the user switches the
  // strip to Batch B, and the switch would silently do nothing. `batchParams()`
  // returns {} when no batch is selected, so courses without batches (and
  // students, who never select) keep exactly the keys they had before.
  getById: (id: string) => ({
    queryKey: ["course", id, getActiveBatchId()],
    queryFn: async (): Promise<{ data: CourseStructureData }> => {
      const token = getToken();
      const response = await axios.get(`${BASE_URL}/getAll/courses-data/${id}`, {
        params: batchParams(),
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });
      return response.data;
    },
  }),

  // ── Lightweight variants used by `uploadcourseresources` ──
  //
  // `getById` above returns the FULL payload (batchAndParticipants + every
  // node's pedagogy). The Resources page only renders the sidebar tree +
  // selected-node pedagogy, so it would otherwise download ~95% wasted data
  // on every cold load. These two backed-by-projection endpoints give it
  // exactly what it needs:
  //
  //   • `getLight(id)`         — tree skeleton (id + title at each level)
  //                              plus course-level fields (courseName,
  //                              resourcesType, testConfiguration). No
  //                              pedagogy, no batchAndParticipants.
  //   • `getNodePedagogy(...)` — pedagogy + a couple of small siblings for
  //                              ONE specific module/submodule/topic/subtopic.
  //                              Used in place of the second full
  //                              `/getAll/courses-data` fetch the page
  //                              previously did inside `fetchAndRefresh`.
  //
  // Cache keys are namespaced under `["course-light", id]` and
  // `["course-node-pedagogy", type, id]` so they don't clash with the heavy
  // `["course", id]` query that other pages (reviewSubmission, etc.) still
  // rely on. The heavy `getById` is intentionally left intact.
  getLight: (id: string) => ({
    queryKey: ["course-light", id, getActiveBatchId()],
    queryFn: async (): Promise<{ data: CourseStructureData }> => {
      const token = getToken();
      const response = await axios.get(`${BASE_URL}/getAll/courses-data/light/${id}`, {
        params: batchParams(),
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
      });
      return response.data;
    },
  }),

  getNodePedagogy: (
    type: "module" | "submodule" | "topic" | "subtopic",
    id: string,
  ) => ({
    queryKey: ["course-node-pedagogy", type, id, getActiveBatchId()],
    queryFn: async (): Promise<{
      data: {
        _id: string;
        title: string;
        pedagogy?: any;
        testConfiguration?: any;
        resourceBatchContext?: ResourceBatchContext;
      };
    }> => {
      const token = getToken();
      const response = await axios.get(
        `${BASE_URL}/getAll/courses-data/node-pedagogy/${type}/${id}`,
        {
          params: batchParams(),
          headers: {
            ...(token && { 'Authorization': `Bearer ${token}` }),
          },
        },
      );
      return response.data;
    },
  }),

  // Resources-by-Batch context on its own — mode, batch list, the caller's own
  // batch. Cheap enough to fetch before the course payload, so the page knows
  // whether to render the batch strip on its first paint instead of flashing
  // the wrong shape and correcting itself.
  getResourceBatchContext: (courseId: string) => ({
    queryKey: ["resource-batch-context", courseId],
    queryFn: async (): Promise<{ data: ResourceBatchContext & { courseName: string } }> => {
      const token = getToken();
      const response = await axios.get(`${BASE_URL}/resource-batches/${courseId}`, {
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
      });
      return response.data;
    },
  }),
};

// Helper function to use file settings API from component
export const updateFileSettingsInComponent = async (
  entityType: "module" | "submodule" | "topic" | "subtopic",
  entityId: string,
  settingsData: {
    tabType: "I_Do" | "We_Do" | "You_Do";
    subcategory: string;
    fileId: string;
    studentShow: boolean;
    downloadAllow: boolean;
    folderPath?: string;
    originalData?: any;
  }
) => {
  const data = {
    tabType: settingsData.tabType,
    subcategory: settingsData.subcategory,
    updateFileId: settingsData.fileId,
    showToStudents: settingsData.studentShow,
    allowDownload: settingsData.downloadAllow,
    folderPath: settingsData.folderPath || "",
    courses: settingsData.originalData?.courses || "",
    topicId: settingsData.originalData?.topicId || "",
    index: settingsData.originalData?.index || 0,
    title: settingsData.originalData?.title || "",
    description: settingsData.originalData?.description || "",
    duration: settingsData.originalData?.duration || "",
    level: settingsData.originalData?.level || "",
  };

  return await fileSettingsApi.updateFileSettings(entityType, entityId, data);
};