import { QueryClient } from "@tanstack/react-query";
import { clearSession } from "./session";

const STALE_5_MIN = 5 * 60 * 1000;
const GC_10_MIN = 10 * 60 * 1000;

export interface NormalizedError {
  message: string;
  status?: number;
  code?: string;
  retryable: boolean;
  raw?: unknown;
}

export const isAuthError = (err: unknown): boolean => {
  const s = (err as { status?: number } | null)?.status;
  return s === 401;
};

export const isPermissionError = (err: unknown): boolean => {
  const s = (err as { status?: number } | null)?.status;
  return s === 403;
};

export const isNotFoundError = (err: unknown): boolean => {
  const s = (err as { status?: number } | null)?.status;
  return s === 404;
};

const clearAuthAndRedirect = () => {
  if (typeof window === "undefined") return;
  clearSession();
  const currentHref = encodeURIComponent(window.location.href);
  window.location.href = `/login?redirect=${currentHref}`;
};

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_5_MIN,
        gcTime: GC_10_MIN,
        retry: (failureCount, error) => {
          if (isAuthError(error)) {
            clearAuthAndRedirect();
            return false;
          }
          if (isPermissionError(error) || isNotFoundError(error)) return false;
          return failureCount < 2;
        },
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        refetchOnMount: false,
      },
      mutations: {
        retry: (failureCount, error) => {
          if (isAuthError(error)) {
            clearAuthAndRedirect();
            return false;
          }
          if (isPermissionError(error) || isNotFoundError(error)) return false;
          return failureCount < 1;
        },
      },
    },
  });
