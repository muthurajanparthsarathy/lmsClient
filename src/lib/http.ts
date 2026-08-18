// Canonical HTTP transport.
//
// One axios instance for the whole app, replacing the ~23 per-service
// `axios.create()` clones. Its configuration and interceptors replicate those
// clones EXACTLY so migrating a service to this instance is behavior-neutral:
//   - baseURL from NEXT_PUBLIC_API_URL (falls back to the historical
//     http://localhost:5533 when unset, so nothing changes by default),
//   - JSON content-type, 10s timeout,
//   - request interceptor attaches `Authorization: Bearer <token>`,
//   - response interceptor drops the token on 401 (no redirect — the redirect
//     lives only in the React Query layer, unchanged).
//
// Services with non-standard config (different timeout, multipart defaults,
// withCredentials, etc.) must NOT be pointed at this instance blindly.

import axios from "axios";
import { getToken, clearToken } from "./session";

// Single source of truth for the API host.
export const API_BASE_URL: string =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5533";

export const http = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 10000,
});

http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      clearToken();
    }
    return Promise.reject(error);
  }
);
