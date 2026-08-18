"use client";

/**
 * Single source of truth for the account menu that sits at the right of every
 * shell's top bar: the signed-in user, the "preview as student" role switch and
 * the sign-out sequence.
 *
 * Before this hook each shell (admin navbar, staff navbar, student navbar,
 * course top bar, L&D console) carried its own copy of the same logic, and the
 * copies had already drifted — the admin one records the session duration via
 * postLogout() while the others do not. Anything that consumes this hook gets
 * the complete sequence.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { clearAllStorage, getToken } from "@/lib/session";
import { logoutUser } from "@/apiServices/tokenVerify";
import { postLogout } from "@/apiServices/activityLog";
import { useCurrentUserQuery } from "@/queries/auth";

/** Shape persisted under `smartcliff_roleSwitch` while previewing as a student. */
export interface RoleSwitchState {
  isDummyStudent: boolean;
  originalRole?: string;
  originalRenameRole?: string;
  switchTimestamp?: number;
}

export interface OriginalRoleInfo {
  roleName: string;
  renameRole: string;
}

const ROLE_SWITCH_KEY = "smartcliff_roleSwitch";
const DUMMY_STUDENT_KEY = "smartcliff_isDummyStudent";

/** Where "Switch to Student" lands when there is no course in context. */
const STUDENT_VIEW_ROUTE = "/lms/pages/courses";

/**
 * The course the user is currently looking at, if any — read off the URL so
 * every shell agrees without threading a prop through five component trees.
 *   /lms/pages/courses/coursesdetailedview/<id>
 *   /lms/pages/courses/uploadcourseresources?courseId=<id>
 */
export function currentCourseId(): string | null {
  if (typeof window === "undefined") return null;
  const fromPath = window.location.pathname.match(/\/coursesdetailedview\/([^/?#]+)/);
  if (fromPath) return decodeURIComponent(fromPath[1]);
  return new URLSearchParams(window.location.search).get("courseId");
}

/**
 * Switching roles should not lose your place. If a course is in context the
 * switch lands on that course's screen for the new role; otherwise it falls
 * back to the plain course list, which is the old behaviour.
 */
export function studentRouteForCurrentCourse(): string {
  const id = currentCourseId();
  return id ? `/lms/pages/courses/coursesdetailedview/${id}` : STUDENT_VIEW_ROUTE;
}

/** The staff-side counterpart: the authoring screen for the course in context. */
export function staffRouteForCurrentCourse(): string | null {
  const id = currentCourseId();
  return id
    ? `/lms/pages/courses/uploadcourseresources?${new URLSearchParams({ courseId: id }).toString()}`
    : null;
}

/**
 * Just the "am I previewing as a student right now" flag, for the places that
 * need to route by it without pulling in the whole account menu. Stays in sync
 * with the menu because every switch dispatches a `storage` event.
 */
export function useIsPreviewingAsStudent(): boolean {
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    const read = () => {
      try {
        setPreviewing(localStorage.getItem(DUMMY_STUDENT_KEY) === "true");
      } catch {
        setPreviewing(false);
      }
    };
    read();
    window.addEventListener("storage", read);
    return () => window.removeEventListener("storage", read);
  }, []);

  return previewing;
}

export interface UseAccountMenuOptions {
  /**
   * Where "Back to <role>" returns to. Shells that live at their own console
   * (the L&D head console, for instance) pass their own route; without it the
   * original role name decides, exactly as the staff and student navbars do.
   */
  returnTo?: string;
  /**
   * Keep the user where they are when the role changes instead of navigating.
   * The L&D console uses this: its own views already re-route by role (a
   * Learning Content card opens the authoring screen for L&D and the learner
   * view for a previewing student), so leaving the console would hide the very
   * change the switch just made.
   */
  stayOnSwitch?: boolean;
}

export function useAccountMenu(options: UseAccountMenuOptions = {}) {
  const { returnTo, stayOnSwitch = false } = options;
  const router = useRouter();
  const queryClient = useQueryClient();

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDummyStudent, setIsDummyStudent] = useState(false);
  const [originalRoleInfo, setOriginalRoleInfo] = useState<OriginalRoleInfo | null>(null);

  // Shared ["currentUser"] entry — same key, options and fetcher the inline
  // query here used, now served by the one app-wide current-user query so the
  // boot-time verify-token call is made once, not once per consumer.
  const {
    data: userData,
    isLoading: userLoading,
    refetch,
  } = useCurrentUserQuery();

  const user = userData?.user || null;

  // Read the persisted role-switch state, and keep it in sync with the other
  // shells — each one fires a `storage` event after writing.
  const readRoleSwitch = useCallback(() => {
    try {
      const raw = localStorage.getItem(ROLE_SWITCH_KEY);
      if (!raw) {
        setIsDummyStudent(false);
        setOriginalRoleInfo(null);
        return;
      }
      const state: RoleSwitchState = JSON.parse(raw);
      setIsDummyStudent(state.isDummyStudent || false);
      if (state.originalRole || state.originalRenameRole) {
        setOriginalRoleInfo({
          roleName: state.originalRole || "",
          renameRole: state.originalRenameRole || "",
        });
      }
    } catch {
      /* malformed entry — treat as "not previewing" */
    }
  }, []);

  useEffect(() => {
    readRoleSwitch();
    const handler = () => readRoleSwitch();
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [readRoleSwitch]);

  // Re-read the user when the token disappears in another tab.
  useEffect(() => {
    const handleStorageChange = () => {
      if (!getToken()) refetch();
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [refetch]);

  /**
   * Sign-out wipe. This used to remove a hand-maintained list of `smartcliff_*`
   * and React-Query keys, which left everything outside that namespace behind —
   * `lms_student_selected_*`, `mcq_question_form_draft`,
   * `qb:programming-workspace:v1` and so on survived into the next session.
   */
  const clearLocalStorage = useCallback(() => {
    clearAllStorage();
  }, []);

  const clearReactQueryCache = useCallback(() => {
    try {
      queryClient.clear();

      const reactQueryKeys = [
        "smartcliff:rq-cache:v1",
        "rq-cache:v1",
        "react-query:cache",
        "tanstack:cache",
      ];
      reactQueryKeys.forEach((key) => localStorage.removeItem(key));

      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          (key.includes("rq-cache") ||
            key.includes("react-query") ||
            key.includes("tanstack") ||
            key.includes("smartcliff:rq"))
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch (error) {
      console.error("Error clearing React Query cache:", error);
    }
  }, [queryClient]);

  /**
   * Order matters: postLogout() has to run while the token is still in place,
   * otherwise the ActivityLog row that carries the session duration is never
   * written.
   */
  const handleLogout = useCallback(async () => {
    try {
      setIsLoggingOut(true);
      const token = getToken();

      clearReactQueryCache();

      // Record logout time / session duration while the token is still present.
      await postLogout();

      clearLocalStorage();

      if (!token) {
        toast.info("Logged out successfully");
        window.location.href = "/login";
        return;
      }

      const response = await logoutUser(token);
      toast.success(response.message?.[0]?.value || "Logged out successfully");

      // Ensure cache is cleared again after API call
      clearReactQueryCache();
      clearLocalStorage();

      window.location.href = "/login";
    } catch (error: any) {
      console.error("Logout error:", error);
      // Ensure all data is cleared even on error
      clearReactQueryCache();
      clearLocalStorage();

      toast.error(error.response?.data?.message?.[0]?.value || "Logout failed");
      window.location.href = "/login";
    } finally {
      setIsLoggingOut(false);
    }
  }, [clearLocalStorage, clearReactQueryCache]);

  const switchToStudent = useCallback(() => {
    try {
      const state: RoleSwitchState = {
        isDummyStudent: true,
        originalRole: user?.role?.roleName || "",
        originalRenameRole: user?.role?.renameRole || "",
        switchTimestamp: Date.now(),
      };
      localStorage.setItem(ROLE_SWITCH_KEY, JSON.stringify(state));
      localStorage.setItem(DUMMY_STUDENT_KEY, "true");
      setIsDummyStudent(true);
      setOriginalRoleInfo({
        roleName: state.originalRole || "",
        renameRole: state.originalRenameRole || "",
      });
      toast.success("Switched to Student View");
      if (!stayOnSwitch) router.push(studentRouteForCurrentCourse());
      // Let the other mounted shells pick the change up.
      setTimeout(() => window.dispatchEvent(new Event("storage")), 100);
    } catch {
      toast.error("Failed to switch role");
    }
  }, [router, stayOnSwitch, user]);

  const switchBackToOriginal = useCallback(() => {
    try {
      localStorage.removeItem(ROLE_SWITCH_KEY);
      localStorage.removeItem(DUMMY_STUDENT_KEY);
      setIsDummyStudent(false);
      setOriginalRoleInfo(null);
      toast.success(`Switched back to ${originalRoleInfo?.renameRole || "your original role"}`);

      const backToCourse = staffRouteForCurrentCourse();
      if (stayOnSwitch) {
        /* nothing to do — the current view re-renders in the original role */
      } else if (backToCourse) {
        router.push(backToCourse);
      } else if (returnTo) {
        router.push(returnTo);
      } else {
        const role = originalRoleInfo?.renameRole?.toLowerCase() || "";
        if (role.includes("poc")) router.push("/lms/pages/poc/dashboard");
        else if (role.includes("admin")) router.push("/lms/pages/admin/dashboard");
        else router.push("/lms/pages/dashboard");
      }
      setTimeout(() => window.dispatchEvent(new Event("storage")), 100);
    } catch {
      toast.error("Failed to switch role");
    }
  }, [originalRoleInfo, returnTo, router, stayOnSwitch]);

  const getUserInitials = useCallback(() => {
    if (!user) return "US";
    const first = user.firstName?.charAt(0) || "";
    const last = user.lastName?.charAt(0) || "";
    return `${first}${last}`.toUpperCase() || "US";
  }, [user]);

  const getFullName = useCallback(() => {
    if (!user) return "User";
    return `${user.firstName} ${user.lastName}`.trim();
  }, [user]);

  /** A real student never sees "Switch to Student". */
  const isActualStudent = Boolean(
    user?.role?.roleName?.toLowerCase().includes("student") ||
      user?.role?.renameRole?.toLowerCase().includes("student")
  );

  return {
    user,
    userLoading,
    refetch,
    getUserInitials,
    getFullName,
    isLoggingOut,
    handleLogout,
    isDummyStudent,
    originalRoleInfo,
    isActualStudent,
    switchToStudent,
    switchBackToOriginal,
  };
}
