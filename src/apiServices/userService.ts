
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://lmsserver-yeve.onrender.com';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

apiClient.interceptors.request.use((config) => {
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    return Promise.reject(error);
  }
);

// Plain fetcher — caching, background polling and invalidation live in the
// React Query layer now (src/queries/users.ts). This module used to keep a
// 15-minute cache plus a 2-minute setInterval poller that dispatched
// 'usersDataUpdated' window events and never stopped after navigation; that
// second cache layer under React Query is exactly what made permission-save
// invalidations serve stale data.
export const fetchUsers = async (
  institutionId: string,
  token: string,
  // Kept for call-site compatibility; scoping happens server-side.
  _basedOn: string,
  _forceRefresh = false
) => {
  const response = await apiClient.get(`/getAll/userAccess/${institutionId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return { users: response.data.Users };
};

// ─────────────────────────────────────────────────────────────────────────────
// Paginated directory read.
//
// The call above returns EVERY user in the institution; at six figures that is
// neither shippable nor renderable. Passing `page` switches the SAME endpoint
// into a mode where the search, the six filters and the sort all run in Mongo
// and only one page crosses the wire. Callers that omit `page` are untouched.
// ─────────────────────────────────────────────────────────────────────────────

export type UsersPageParams = {
  page: number;
  limit: number;
  search?: string;
  roles?: string[];
  status?: string;
  degree?: string;
  department?: string;
  year?: string;
  batch?: string;
  sortKey?: string;
  sortDir?: "asc" | "desc";
};

export type UsersPageResponse = {
  Users: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  facets?: { batches?: string[] };
};

/** Only send what is actually set — an empty value means "no filter", and
 *  omitting it keeps the query string (and so the cache key) stable. */
const buildUsersPageParams = (p: UsersPageParams, isExport = false) => {
  const q: Record<string, string> = { page: String(p.page), limit: String(p.limit) };
  if (p.search?.trim()) q.search = p.search.trim();
  if (p.roles?.length) q.roles = p.roles.join(",");
  if (p.status && p.status !== "all") q.status = p.status;
  if (p.degree && p.degree !== "all") q.degree = p.degree;
  if (p.department && p.department !== "all") q.department = p.department;
  if (p.year && p.year !== "all") q.year = p.year;
  if (p.batch && p.batch !== "all") q.batch = p.batch;
  if (p.sortKey) {
    q.sortKey = p.sortKey;
    q.sortDir = p.sortDir || "asc";
  }
  if (isExport) q.export = "1";
  return q;
};

export const fetchUsersPage = async (
  institutionId: string,
  token: string,
  params: UsersPageParams
): Promise<UsersPageResponse> => {
  const response = await apiClient.get(`/getAll/userAccess/${institutionId}`, {
    headers: { Authorization: `Bearer ${token}` },
    params: buildUsersPageParams(params),
  });
  return response.data;
};

/**
 * Every row matching the current filters, for "Export all" — pulled in chunks
 * of the thirteen CSV columns only (~366 bytes a row against ~2.6 KB for a
 * table row). Deliberately NOT a React Query read: it answers a click, and
 * caching a whole-directory dump would undo the point of paginating.
 */
export const fetchUsersForExport = async (
  institutionId: string,
  token: string,
  params: Omit<UsersPageParams, "page" | "limit">,
  onProgress?: (loaded: number, total: number) => void
): Promise<any[]> => {
  const CHUNK = 5000;
  const rows: any[] = [];
  let page = 1;
  let total = Infinity;
  // The page ceiling guards against a server build that ignores `page` and
  // keeps returning the same chunk — without it this would never terminate.
  while (rows.length < total && page <= 1000) {
    const response = await apiClient.get(`/getAll/userAccess/${institutionId}`, {
      headers: { Authorization: `Bearer ${token}` },
      params: buildUsersPageParams({ ...params, page, limit: CHUNK }, true),
    });
    const batch: any[] = response.data?.Users || [];
    total = typeof response.data?.total === "number" ? response.data.total : batch.length;
    rows.push(...batch);
    onProgress?.(rows.length, total);
    if (!batch.length || batch.length < CHUNK) break;
    page += 1;
  }
  return rows;
};

// The institution's permission allow-list, set by the Super Admin (Clients →
// Permission Management). Self-service read so the LMS-side Permission Modal
// can limit what it offers to a user's own institution, instead of the full
// catalog. Same response shape as apiServices/superadmin/institutionService's
// getInstitutionPermissions.
export const getInstitutionPermissions = async (institutionId: string, token: string) => {
  const response = await apiClient.get(`/institution/permissions/${institutionId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data.permissions || [];
};

// The institution's Resource Management config, set by the Super Admin
// (I Do upload types + We Do / You Do AI features). Self-service read so the
// course-creation "Resource Type" step can show only what's enabled for this
// institution instead of every possible type.
export const getInstitutionResourceSettings = async (institutionId: string, token: string) => {
  const response = await apiClient.get(`/institution/resource-settings/${institutionId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data.resourcePedagogy;
};

export const addUser = async (userData: any, token: string) => {
  const formattedUserData: any = {
    email: userData.email,
    firstName: userData.firstName,
    lastName: userData.lastName,
    phone: userData.phone,
    role: userData.role,
    gender: userData.gender,
    status: userData.status || "active",
    ...(userData.password && { password: userData.password }),
  };

  // Only add clientName if provided
  if (userData.clientName) {
    formattedUserData.clientName = userData.clientName;
  }
if (userData.clientId) {
    formattedUserData.clientId = userData.clientId;
  }
  // Only add studentType if provided
  if (userData.studentType) {
    formattedUserData.studentType = userData.studentType;
  }

  // Add optional academic fields
  if (userData.degree) formattedUserData.degree = userData.degree;
  if (userData.department) formattedUserData.department = userData.department;
  if (userData.batch) formattedUserData.batch = userData.batch;
  if (userData.semester) formattedUserData.semester = userData.semester;
  if (userData.section) formattedUserData.section = userData.section;
  if (userData.year) formattedUserData.year = userData.year;
  if (userData.phase) formattedUserData.phase = userData.phase;
  if (userData.serviceModel) formattedUserData.serviceModel = userData.serviceModel;
  if (userData.serviceMappingId) formattedUserData.serviceMappingId = userData.serviceMappingId;

  // Include default permissions structure
  formattedUserData.permission = {
    courseManagement: {
      create: false,
      edit: false,
      delete: false,
      report: false,
    },
    userManagement: {
      create: false,
      edit: false,
      delete: false,
      report: false,
    },
    testAccess: {
      create: false,
      edit: false,
      delete: false,
      report: false,
    },
  };

  try {
    const response = await apiClient.post(
      '/add/users',
      formattedUserData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error adding user:', error);
    throw error;
  }
};

export const updateUser = async (userId: string, userData: any, token: string) => {
  try {
    // Prepare update data with all fields
    const updateData: any = {
      firstName: userData.firstName,
      lastName: userData.lastName,
      email: userData.email,
      phone: userData.phone,
      gender: userData.gender,
      status: userData.status,
      role: userData.role,
    };

    // Add optional fields only if they exist
    if (userData.degree !== undefined) updateData.degree = userData.degree;
    if (userData.department !== undefined) updateData.department = userData.department;
    if (userData.semester !== undefined) updateData.semester = userData.semester;
    if (userData.section !== undefined) updateData.section = userData.section;
    if (userData.year !== undefined) updateData.year = userData.year;
    if (userData.batch !== undefined) updateData.batch = userData.batch;
    if (userData.phase !== undefined) updateData.phase = userData.phase;
    if (userData.serviceModel !== undefined) updateData.serviceModel = userData.serviceModel;
    if (userData.studentType !== undefined) updateData.studentType = userData.studentType;
    if (userData.clientName !== undefined) updateData.clientName = userData.clientName;
       if (userData.clientId !== undefined) updateData.clientId = userData.clientId;

    if (userData.password) updateData.password = userData.password;

    const response = await apiClient.put(
      `/update/users/${userId}`,
      updateData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
};
export const deleteUser = async (userId: string, token: string) => {
  try {
    const response = await apiClient.delete(
      `/delete/users/${userId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
};

export const toggleUserStatus = async (userId: string, status?: 'active' | 'inactive', token?: string) => {
  try {
    const authToken = token;
    if (!authToken) {
      throw new Error('Authentication token not found');
    }

    const response = await apiClient.put(
      `/user/status/${userId}`,
      status ? { status } : {},
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error toggling user status:', error);
    throw error;
  }
};

// Activate/deactivate many users in one request (PUT /user/bulk-status)
export const bulkSetUserStatus = async (
  userIds: string[],
  status: 'active' | 'inactive',
  token: string
) => {
  try {
    if (!token) {
      throw new Error('Authentication token not found');
    }

    const response = await apiClient.put(
      `/user/bulk-status`,
      { userIds, status },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error bulk updating user status:', error);
    throw error;
  }
};

// CORRECTED Bulk Upload API
export const bulkUploadUsers = async (formData: FormData, token: string) => {
  try {
    // Use fetch instead of axios for FormData to properly handle file uploads
    const response = await fetch(`${API_BASE_URL}/user/bulk-upload-users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        // Don't set Content-Type - let browser set it with boundary for FormData
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message?.[0]?.value || 'Bulk upload failed');
    }

    const data = await response.json();

    return data;
  } catch (error) {
    console.error('Error in bulk upload:', error);
    throw error;
  }
};

// Alternative bulk upload using axios (if you prefer)
export const bulkUploadUsersAxios = async (formData: FormData, token: string) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/user/bulk-upload-users`,
      formData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000, // 30 seconds timeout for large files
      }
    );

    return response.data;
  } catch (error: any) {
    console.error('Error in bulk upload:', error);
    
    // Enhanced error handling
    if (error.response?.data?.message) {
      const errorMessages = error.response.data.message;
      if (Array.isArray(errorMessages)) {
        const errorMessage = errorMessages.map((msg: { value: string }) => msg.value).join(', ');
        throw new Error(errorMessage);
      } else {
        throw new Error(errorMessages);
      }
    }
    
    throw new Error(error.message || 'Bulk upload failed');
  }
};



export const addParticipantsToCourse = async (
  courseId: string,
  participantIds: string[],
  institutionId: string,
  token: string,
  enrollmentData: any = {},
  batchName?: string,
  hierarchy?: { degree?: string; department?: string; section?: string; semester?: string }
) => {
  try {
    const response = await fetch(`https://lmsserver-yeve.onrender.com/add-participants/${courseId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'institution': institutionId,
      },
      body: JSON.stringify({
        participantIds,
        // Participants are always stored inside a batch — the server matches
        // the batch by name and pushes the users into its `users` array.
        batchName,
        status: enrollmentData.status || 'active',
        // Hierarchy node the participants are being added at
        degree: hierarchy?.degree || '',
        department: hierarchy?.department || '',
        section: hierarchy?.section || '',
        semester: hierarchy?.semester || '',
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to add participants');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error adding participants:', error);
    throw error;
  }
};

export const updateParticipantEnrollment = async (courseId: string, userId: string, enrollmentData: any, institutionId: string, token: string) => {
  try {
    const response = await fetch(`https://lmsserver-yeve.onrender.com/update-enrollment/${courseId}/${userId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'institution': institutionId,
      },
      body: JSON.stringify(enrollmentData),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to update enrollment');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error updating enrollment:', error);
    throw error;
  }
};

export const removeParticipantFromCourse = async (
  courseId: string,
  userId: string,
  institutionId: string,
  token: string,
  batchId?: string
) => {
  try {
    const response = await fetch(
      `https://lmsserver-yeve.onrender.com/delete/participant/${courseId}/${userId}${batchId ? `?batchId=${batchId}` : ''}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'institution': institutionId,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to remove participant');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error removing participant:', error);
    throw error;
  }
};

export const removeMultipleParticipantsFromCourse = async (
  courseId: string,
  participantIds: string[],
  institutionId: string,
  token: string,
  batchId?: string
) => {
  try {
    console.log('Attempting to remove participants:', {
      courseId,
      participantIds,
      participantIdsCount: participantIds.length
    });

    // First, debug the course structure
    const debugResponse = await fetch(
      `https://lmsserver-yeve.onrender.com/api/debug/course/${courseId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'institution': institutionId,
        },
      }
    );

    if (debugResponse.ok) {
      const debugData = await debugResponse.json();
      console.log('Course debug info:', debugData.data);
    }

    // Now attempt to delete
    const response = await fetch(
      `https://lmsserver-yeve.onrender.com/delete-participants/multiple/${courseId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'institution': institutionId,
        },
        body: JSON.stringify({
          participantIds: participantIds.map(id => id.toString()),
          ...(batchId ? { batchId } : {})
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Delete error response:', errorData);
      throw new Error(errorData.message || 'Failed to remove participants');
    }

    const data = await response.json();
    console.log('Delete successful:', data);
    return data;
  } catch (error) {
    console.error('Error removing participants:', error);
    throw error;
  }
};


export const createGroup = async (courseId: string, groupName: string, groupDescription: string, institutionId: string, token: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'institution': institutionId,
      },
      body: JSON.stringify({
        courseId,
        groupName,
        groupDescription,
        institution: institutionId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to create group');
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating group:', error);
    throw error;
  }
};

// Get groups for a course
export const getGroupsByCourse = async (courseId: string, institutionId: string, token: string) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/course/${courseId}/institution/${institutionId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'institution': institutionId,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to fetch groups');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching groups:', error);
    throw error;
  }
};

// Add users to group
export const addUsersToGroup = async (groupId: string, participantIds: string[], institutionId: string, token: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/${groupId}/add-users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'institution': institutionId,
      },
      body: JSON.stringify({ participantIds, institution: institutionId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to add users to group');
    }

    return await response.json();
  } catch (error) {
    console.error('Error adding users to group:', error);
    throw error;
  }
};

// Remove users from group
export const removeUsersFromGroup = async (groupId: string, participantIds: string[], institutionId: string, token: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/${groupId}/remove-users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'institution': institutionId,
      },
      body: JSON.stringify({ participantIds, institution: institutionId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to remove users from group');
    }

    return await response.json();
  } catch (error) {
    console.error('Error removing users from group:', error);
    throw error;
  }
};

// Delete group
export const deleteGroup = async (groupId: string, institutionId: string, token: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/${groupId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'institution': institutionId,
      },
      body: JSON.stringify({ institution: institutionId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to delete group');
    }

    return await response.json();
  } catch (error) {
    console.error('Error deleting group:', error);
    throw error;
  }
};

// Set group leader
export const setGroupLeader = async (groupId: string, userId: string, institutionId: string, token: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/${groupId}/set-leader`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'institution': institutionId,
      },
      body: JSON.stringify({ userId, institution: institutionId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to set group leader');
    }

    return await response.json();
  } catch (error) {
    console.error('Error setting group leader:', error);
    throw error;
  }
};

// Get group details
export const getGroupDetails = async (groupId: any, institutionId: any, token: any) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/${groupId}/institution/${institutionId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'institution': institutionId,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to fetch group details');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching group details:', error);
    throw error;
  }
};


// Fetch course data with batch participants (flattened `participants` array)
export const fetchGroupsCourseData = async (courseId: string, institutionId: string, token: string) => {
  try {
    const response = await fetch(
      `https://lmsserver-yeve.onrender.com/getAll/groups/courses-data/${courseId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'institution': institutionId,
        },
      }
    );
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to fetch course data');
    }
    
    const data = await response.json();
    
    if (!data.success || !data.data) {
      throw new Error('Invalid course data response');
    }
    
    return data.data;
  } catch (error) {
    console.error('Error fetching course data:', error);
    throw error;
  }
};


interface RemoveGroupLeaderResponse {
  success: boolean;
  message?: string;
  data?: any;
}

export const removeGroupLeader = async (
  groupId: string,
  institution: string,
  token: string
): Promise<RemoveGroupLeaderResponse> => {
  const response = await fetch(
    `https://lmsserver-yeve.onrender.com/remove-group-leader/${groupId}/${institution}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.json();
};

// ============================================================================
// Approval Hierarchy
// ============================================================================
// A step now names ONE person. `userId`/`userName` are the actual approver;
// role is the filter that narrowed the picker. Legacy chains (saved before
// the person-specific rework) come back with userId null and are treated as
// role-only fallback by the server.
export type ApprovalStep = {
  order: number;
  roleId: string;
  roleName: string;
  userId?: string | null;
  userName?: string;
};
export type AvailableRole = { roleId: string; roleName: string };
export type AvailableUser = { userId: string; name: string; email?: string };

export const fetchApprovalHierarchy = async (
  courseId: string,
  institutionId: string,
  token: string
): Promise<{
  steps: ApprovalStep[];
  availableRoles: AvailableRole[];
  // { roleId: user[] } — the person picker filters by the picked role,
  // no extra fetch per role.
  availableUsersByRole: Record<string, AvailableUser[]>;
  updatedAt: string | null;
  // 'course' = chain saved on the course; 'default' = institution L&D
  // fallback (course has no chain of its own); 'none' = no chain possible.
  source?: 'course' | 'default' | 'none';
}> => {
  const response = await fetch(
    `https://lmsserver-yeve.onrender.com/courses/${courseId}/approval-hierarchy`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        institution: institutionId,
      },
    }
  );
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data?.message || 'Failed to fetch approval hierarchy');
  }
  return data.data;
};

export type ApprovalWorkflowStep = {
  order: number;
  roleId: string;
  roleName: string;
  status: 'waiting' | 'pending' | 'approved' | 'rejected';
  decidedBy?: string | null;
  decidedAt?: string | null;
  comment?: string;
};
export type ApprovalWorkflow = {
  steps: ApprovalWorkflowStep[];
  currentStep: number;
  overallStatus: 'in_progress' | 'approved' | 'rejected';
  studentVisible: boolean;
  initiatedAt?: string | null;
  completedAt?: string | null;
  editedSinceReject?: boolean;
  // > 0 while in_progress means this run is a re-request after a reject.
  resubmissionCount?: number;
  lastResubmittedAt?: string | null;
};
export type CourseApprovalItem = {
  exerciseId: string;
  exerciseName: string;
  exerciseType: string;
  testType: string;
  totalDuration: number | null;
  totalMarks: number | null;
  schedule: any;
  entityType: 'modules' | 'submodules' | 'topics' | 'subtopics';
  entityId: string;
  entityName: string;
  subcategory: string;
  tabType: 'We_Do' | 'You_Do';
  approvalWorkflow: ApprovalWorkflow | null;
  canApprove: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  createdBy?: string | null;
  exercise: any; // full exercise blob — all settings
};

export const fetchCourseApprovalsOverview = async (
  courseId: string,
  tabType: 'We_Do' | 'You_Do',
  institutionId: string,
  token: string
): Promise<CourseApprovalItem[]> => {
  const response = await fetch(
    `https://lmsserver-yeve.onrender.com/courses/${courseId}/approvals/overview?tabType=${tabType}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        institution: institutionId,
      },
    }
  );
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data?.message || 'Failed to fetch approvals overview');
  }
  return data.data;
};

export type QuestionContext = {
  entityType: 'modules' | 'submodules' | 'topics' | 'subtopics';
  entityId: string;
  tabType: 'We_Do' | 'You_Do';
  subcategory: string;
  exerciseId: string;
  questionId: string;
};

const _qBody = async (path: string, body: any, token: string) => {
  const r = await fetch(`https://lmsserver-yeve.onrender.com${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const d = await r.json();
  if (!r.ok || !d.success) {
    throw new Error(d?.message?.[0]?.value || d?.message || 'Request failed');
  }
  return d;
};

export const approveQuestion = (ctx: QuestionContext, token: string) =>
  _qBody('/exercise/question/approve', ctx, token);

// Bulk companion — approves every still-pending question in one call.
// Queried / rejected questions are skipped server-side and reported back.
export const approveAllQuestions = (
  ctx: Omit<QuestionContext, 'questionId'>,
  token: string
) => _qBody('/exercise/question/approve-all', ctx, token);

export const rejectQuestion = (ctx: QuestionContext, text: string, token: string) =>
  _qBody('/exercise/question/reject', { ...ctx, text }, token);

export const raiseQuestionQuery = (ctx: QuestionContext, text: string, token: string) =>
  _qBody('/exercise/question/query', { ...ctx, text }, token);

export const resolveQuestionQuery = (ctx: QuestionContext, note: string | undefined, token: string) =>
  _qBody('/exercise/question/resolve-query', { ...ctx, note }, token);

export const approveExerciseStep = async (
  body: {
    entityType: 'modules' | 'submodules' | 'topics' | 'subtopics';
    entityId: string;
    tabType: 'We_Do' | 'You_Do';
    subcategory: string;
    exerciseId: string;
    comment?: string;
  },
  token: string
) => {
  const response = await fetch(`https://lmsserver-yeve.onrender.com/exercise/approve`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data?.message?.[0]?.value || data?.message || 'Failed to approve');
  }
  return data;
};

export const rejectExerciseStep = async (
  body: {
    entityType: 'modules' | 'submodules' | 'topics' | 'subtopics';
    entityId: string;
    tabType: 'We_Do' | 'You_Do';
    subcategory: string;
    exerciseId: string;
    comment: string; // rejection message, required
  },
  token: string
) => {
  const response = await fetch(`https://lmsserver-yeve.onrender.com/exercise/reject`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data?.message?.[0]?.value || data?.message || 'Failed to reject');
  }
  return data;
};

export const resubmitExerciseForApproval = async (
  body: {
    entityType: 'modules' | 'submodules' | 'topics' | 'subtopics';
    entityId: string;
    tabType: 'We_Do' | 'You_Do';
    subcategory: string;
    exerciseId: string;
  },
  token: string
) => {
  const response = await fetch(`https://lmsserver-yeve.onrender.com/exercise/resubmit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data?.message?.[0]?.value || data?.message || 'Failed to resubmit');
  }
  return data;
};

export const saveApprovalHierarchy = async (
  courseId: string,
  // Person-specific: each step must carry the picked user's id, not just a role.
  steps: { roleId: string; userId: string }[],
  institutionId: string,
  token: string
) => {
  const response = await fetch(
    `https://lmsserver-yeve.onrender.com/courses/${courseId}/approval-hierarchy`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        institution: institutionId,
      },
      body: JSON.stringify({ steps }),
    }
  );
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data?.message || 'Failed to save approval hierarchy');
  }
  return data;
};