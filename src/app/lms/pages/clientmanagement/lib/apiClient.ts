import axios, { AxiosError, AxiosRequestConfig } from "axios";
import { API_BASE_URL } from "../../../../../lib/http";
import { getToken } from "../../../../../lib/session";

export { API_BASE_URL };

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
  err.retryable =
    status === undefined ||
    (status >= 500 && status < 600);
  return err;
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

export const api = {
  get: async <T>(path: string, config: AxiosRequestConfig = {}): Promise<T> => {
    try {
      const token = getToken();
      const res = await axios.get<T>(`${API_BASE_URL}${path}`, {
        ...config,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(config.headers || {}),
        },
      });
      return res.data;
    } catch (err) {
      throw toApiError(err);
    }
  },
  post: async <T>(
    path: string,
    body?: unknown,
    config: AxiosRequestConfig = {}
  ): Promise<T> => {
    try {
      const token = getToken();
      const res = await axios.post<T>(`${API_BASE_URL}${path}`, body, {
        ...config,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(config.headers || {}),
        },
      });
      return res.data;
    } catch (err) {
      throw toApiError(err);
    }
  },
  put: async <T>(
    path: string,
    body?: unknown,
    config: AxiosRequestConfig = {}
  ): Promise<T> => {
    try {
      const token = getToken();
      const res = await axios.put<T>(`${API_BASE_URL}${path}`, body, {
        ...config,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(config.headers || {}),
        },
      });
      return res.data;
    } catch (err) {
      throw toApiError(err);
    }
  },
  putForm: async <T>(
    path: string,
    formData: FormData,
    config: AxiosRequestConfig = {}
  ): Promise<T> => {
    try {
      const token = getToken();
      const res = await axios.put<T>(`${API_BASE_URL}${path}`, formData, {
        ...config,
        headers: {
          "Content-Type": "multipart/form-data",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(config.headers || {}),
        },
      });
      return res.data;
    } catch (err) {
      throw toApiError(err);
    }
  },
  postForm: async <T>(
    path: string,
    formData: FormData,
    config: AxiosRequestConfig = {}
  ): Promise<T> => {
    try {
      const token = getToken();
      const res = await axios.post<T>(`${API_BASE_URL}${path}`, formData, {
        ...config,
        headers: {
          "Content-Type": "multipart/form-data",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(config.headers || {}),
        },
      });
      return res.data;
    } catch (err) {
      throw toApiError(err);
    }
  },
  del: async <T>(path: string, config: AxiosRequestConfig = {}): Promise<T> => {
    try {
      const token = getToken();
      const res = await axios.delete<T>(`${API_BASE_URL}${path}`, {
        ...config,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(config.headers || {}),
        },
      });
      return res.data;
    } catch (err) {
      throw toApiError(err);
    }
  },
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
