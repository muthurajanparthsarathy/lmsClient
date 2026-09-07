import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://lmsserver-yeve.onrender.com';

// Define types for permission
interface ApiPermission {
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
interface UserData {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
    permissions: ApiPermission[];
    courses?: any[];
    role?: {
        _id: string;
        originalRole: string;
        renameRole: string;
        roleValue: string;
    };
    status?: string;
    profile?: string;
    phone?: string;
    institution?: string;
    gender?: string;
    notes?: any[];
    notifications?: any[];
    tokens?: any[];
    __v?: number;
    createdAt?: string;
    updatedAt?: string;
}
export const verifyToken = async (token: string) => {
  const response = await axios.post(`${API_BASE_URL}/user/verify-token`, {}, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.data;
};


export const getCurrentUser = async () => {
  const token = localStorage.getItem("smartcliff_token");
  if (!token) {
    throw new Error('No token found');
  }
  
  const response = await axios.post(`${API_BASE_URL}/user/verify-token`, {}, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.data;
};


export const fetchDashboardData = async (token: string) => {
  const response = await axios.get(`${API_BASE_URL}/dashboard`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.data;
};



export const logoutUser = async (token: string) => {
  const response = await axios.post(`${API_BASE_URL}/logout`, {}, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    withCredentials: true // Include cookies
  });
  return response.data;
};


const USER_DATA_KEY = "smartcliff_userData";

export const userPermission = (): { valid: boolean; user: UserData | null } => {
    try {
        const userDataString = localStorage.getItem(USER_DATA_KEY);
        if (!userDataString) {
            console.log("No user data found in localStorage");
            return { valid: false, user: null };
        }
        
        const userData: UserData = JSON.parse(userDataString);
        return { valid: true, user: userData };
    } catch (error) {
        console.error("Error getting user data from localStorage:", error);
        return { valid: false, user: null };
    }
};