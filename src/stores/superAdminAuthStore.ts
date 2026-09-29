import { create } from 'zustand';

// Mirrors stores/authStore.ts but is a fully separate store/key so the
// LMS session and the Super Admin session never share state.
interface SuperAdmin {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  status: string;
}

interface SuperAdminAuthState {
  token: string | null;
  isAuthenticated: boolean;
  superAdmin: SuperAdmin | null;
  setSession: (token: string, superAdmin: SuperAdmin) => void;
  clearSession: () => void;
  verifySession: () => Promise<boolean>;
}

export const useSuperAdminAuthStore = create<SuperAdminAuthState>((set, get) => ({
  token: null,
  isAuthenticated: false,
  superAdmin: null,

  setSession: (token, superAdmin) => {
    localStorage.setItem('superadmin_token', token);
    set({ token, isAuthenticated: true, superAdmin });
  },

  clearSession: () => {
    localStorage.removeItem('superadmin_token');
    set({ token: null, isAuthenticated: false, superAdmin: null });
  },

  verifySession: async () => {
    const token = localStorage.getItem('superadmin_token');
    if (!token) {
      get().clearSession();
      return false;
    }

    try {
      const { superAdminApi } = await import('../lib/superAdminApiClient');
      const res = await superAdminApi.get<{ superAdmin: SuperAdmin }>('/superadmin/auth/me');
      set({ token, isAuthenticated: true, superAdmin: res.superAdmin });
      return true;
    } catch (error) {
      get().clearSession();
      return false;
    }
  },
}));
