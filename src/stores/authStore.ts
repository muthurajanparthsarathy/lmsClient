import { create } from 'zustand';
import { jwtDecode } from 'jwt-decode';
import {
  getToken,
  setToken as persistToken,
  clearToken as clearStoredToken,
} from '@/lib/session';

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  user: any;
  setToken: (token: string) => void;
  clearToken: () => void;
  verifyToken: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  isAuthenticated: false,
  user: null,

  setToken: (token) => {
    persistToken(token);
    const decoded = jwtDecode(token);
    set({ token, isAuthenticated: true, user: decoded });
  },

  clearToken: () => {
    clearStoredToken();
    set({ token: null, isAuthenticated: false, user: null });
  },

  verifyToken: async () => {
    const token = getToken();
    if (!token) {
      get().clearToken();
      return false;
    }

    try {
      const { verifyToken } = await import('../apiServices/tokenVerify');
      await verifyToken(token);
      const decoded = jwtDecode(token);
      set({ token, isAuthenticated: true, user: decoded });
      return true;
    } catch (error) {
      get().clearToken();
      return false;
    }
  }
}));
