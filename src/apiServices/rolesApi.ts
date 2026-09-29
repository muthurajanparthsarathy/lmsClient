import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://lmsserver-yeve.onrender.com';

// Configure axios instance with auth token
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Plain fetcher — caching lives in the React Query layer (src/queries/users.ts).
// This module used to keep a 15-minute cache plus a 2-minute setInterval poll
// dispatching a 'RolesDataUpdated' event that NOTHING in the app listened to.
export const fetchRoles = async (token: string, _forceRefresh = false) => {
  const response = await apiClient.get(`/roles/getAll`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  // Check all possible locations for roles data
  const roles = response.data?.getAllRoles ||
                response.data?.Roles ||
                response.data?.roles ||
                response.data ||
                [];

  return { roles };
};

export const addRoles = async (roleData: any, token: string) => {
  const formattedRoleData = {
    ...roleData,
  };

  try {
    const response = await apiClient.post(
      '/roles/create',
      formattedRoleData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error adding role:', error);
    throw error;
  }
};

export const updateRole = async (roleId: string, roleData: any, token: string) => {
  try {
    const response = await apiClient.put(
      `/roles/update/${roleId}`,
      roleData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error updating role:', error);
    throw error;
  }
};

export const deleteRole = async (roleId: string, token: string) => {
  try {
    const response = await apiClient.delete(
      `/roles/delete/${roleId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error deleting role:', error);
    throw error;
  }
};