import axios, { AxiosError, AxiosRequestConfig } from "axios";

// Mirrors lib/apiClient.ts but reads/writes a separate token key
// (superadmin_token) so an LMS session and a Super Admin session can
// coexist in the same browser without colliding.
export const API_BASE_URL = "https://lmsserver-yeve.onrender.com";

export interface ApiError extends Error {
  status?: number;
  code?: string;
  retryable?: boolean;
  raw?: unknown;
}

const buildApiError = (
  message: string,
  status?: number,
  code?: string,
  raw?: unknown
): ApiError => {
  const err = new Error(message) as ApiError;
  err.name = "ApiError";
  err.status = status;
  err.code = code;
  err.raw = raw;
  err.retryable = status === undefined || (status >= 500 && status < 600);
  return err;
};

const getToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("superadmin_token");
};

const extractMessage = (data: unknown, fallback: string): string => {
  if (!data || typeof data !== "object") return fallback;
  const anyData = data as Record<string, unknown>;
  const msg = anyData.message;
  if (typeof msg === "string") return msg;
  if (Array.isArray(msg) && msg.length > 0) {
    const first = msg[0] as { value?: string } | string;
    if (typeof first === "string") return first;
    if (first && typeof first.value === "string") return first.value;
  }
  if (typeof anyData.error === "string") return anyData.error as string;
  return fallback;
};

export const toApiError = (err: unknown): ApiError => {
  if (axios.isAxiosError(err)) {
    const axErr = err as AxiosError;
    const status = axErr.response?.status;
    const data = axErr.response?.data;
    const message = extractMessage(data, axErr.message || "Request failed");
    return buildApiError(message, status, axErr.code, data);
  }
  if (err instanceof Error) {
    return buildApiError(err.message, undefined, undefined, err);
  }
  return buildApiError("Unknown error", undefined, undefined, err);
};

const authHeaders = (config: AxiosRequestConfig = {}) => {
  const token = getToken();
  return {
    ...config,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(config.headers || {}),
    },
  };
};

export const superAdminApi = {
  get: async <T>(path: string, config: AxiosRequestConfig = {}): Promise<T> => {
    try {
      const res = await axios.get<T>(`${API_BASE_URL}${path}`, authHeaders(config));
      return res.data;
    } catch (err) {
      throw toApiError(err);
    }
  },
  post: async <T>(path: string, body?: unknown, config: AxiosRequestConfig = {}): Promise<T> => {
    try {
      const res = await axios.post<T>(`${API_BASE_URL}${path}`, body, authHeaders(config));
      return res.data;
    } catch (err) {
      throw toApiError(err);
    }
  },
  put: async <T>(path: string, body?: unknown, config: AxiosRequestConfig = {}): Promise<T> => {
    try {
      const res = await axios.put<T>(`${API_BASE_URL}${path}`, body, authHeaders(config));
      return res.data;
    } catch (err) {
      throw toApiError(err);
    }
  },
  del: async <T>(path: string, config: AxiosRequestConfig = {}): Promise<T> => {
    try {
      const res = await axios.delete<T>(`${API_BASE_URL}${path}`, authHeaders(config));
      return res.data;
    } catch (err) {
      throw toApiError(err);
    }
  },
};
