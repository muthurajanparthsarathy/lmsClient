// Module-level constants and pure helpers for User Management.
//
// Everything here is stateless and depends on nothing from the page, which is
// exactly why it lives outside it: the page file is the composition root, and
// lookup tables padding it out made the wiring harder to see.

import {
  Briefcase,
  UserCheck,
  Handshake,
  ClipboardList,
  ShieldCheck,
  GraduationCap,
} from "lucide-react";
import type { UserFormData } from "./types";

// Pull the human-readable message out of a backend error response. The API
// returns { message: [{ key, value }] } (or sometimes a plain string), so try
// those shapes before falling back to a generic message.
export const getApiErrorMessage = (error: any, fallback: string): string => {
  const data = error?.response?.data;
  const msg = data?.message;
  if (Array.isArray(msg) && msg[0]?.value) return msg[0].value;
  if (typeof msg === 'string' && msg.trim()) return msg;
  if (typeof data?.error === 'string' && data.error.trim()) return data.error;
  return fallback;
};

export function getRoleIcon(roleName: string) {
  const lowerRole = roleName.toLowerCase();
  if (lowerRole.includes('lms')) return ShieldCheck;
  if (lowerRole.includes('manager')) return Briefcase;
  if (lowerRole.includes('hr')) return UserCheck;
  if (lowerRole.includes('poc')) return Handshake;
  if (lowerRole.includes('coordinator')) return ClipboardList;
  if (lowerRole.includes('student')) return GraduationCap;
  return ShieldCheck;
}

// Icon tint per role for the advanced-filter MultiSelect options (token colors).
export function getRoleColor(roleName: string) {
  const lowerRole = roleName.toLowerCase();
  if (lowerRole.includes('lms')) return "text-brand-strong";
  if (lowerRole.includes('manager')) return "text-info-700";
  if (lowerRole.includes('hr')) return "text-danger-700";
  if (lowerRole.includes('poc')) return "text-warn-700";
  if (lowerRole.includes('coordinator')) return "text-warn-700";
  if (lowerRole.includes('student')) return "text-success-700";
  return "text-subtle";
}

// Constants - All fields available for all users
export const degreeOptions = ["B.Tech", "B.E", "B.Sc", "B.Com", "B.A", "M.Tech", "M.Sc", "MBA", "PhD"];
export const departmentOptions = ["Computer Science", "Electrical", "Mechanical", "Civil", "Electronics", "Information Technology", "Mathematics", "Physics", "Chemistry"];
export const yearOptions = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year"];

// Search scope — the picker to the right of the search box. "All fields" is the
// default and is what the box did before the picker existed; the other four name
// the table's own columns, so what you pick is what you see. Values travel to
// getUserAccessPaginated as `searchField`, which narrows the Mongo $or.
export type SearchField = "all" | "user" | "email" | "phone" | "role";

export const SEARCH_FIELD_OPTIONS: { value: SearchField; label: string; placeholder: string }[] = [
  { value: "all", label: "All fields", placeholder: "Search users…" },
  { value: "user", label: "User", placeholder: "Search by name…" },
  { value: "email", label: "Email", placeholder: "Search by email…" },
  { value: "phone", label: "Phone", placeholder: "Search by phone…" },
  { value: "role", label: "Role", placeholder: "Search by role…" },
];

const BULK_BTN_BASE =
  "h-7 px-2.5 rounded-full text-xs font-medium disabled:opacity-40 disabled:hover:bg-transparent " +
  "disabled:cursor-not-allowed transition-colors duration-150";
export const BULK_BAR_BTN = `${BULK_BTN_BASE} text-white/90 hover:bg-white/10 hover:text-white`;
export const BULK_BAR_BTN_DANGER = `${BULK_BTN_BASE} text-danger-500 hover:bg-danger-500/15`;

// The blank Add User form. A function rather than a shared object literal so
// each reset gets its own instance — handing out one frozen-in-place object
// would let a later edit leak into the next "new user".
export const emptyUserForm = (): UserFormData => ({
  id: "", firstName: "", lastName: "", email: "", phone: "", password: "",
  role: "Student", roleId: "", status: "active", gender: "Male",
  degree: "", department: "", semester: "", year: "", batch: "",
  phase: "", serviceModel: "", rollNumber: "",
  studentType: "",
  clientId: "",
  clientName: "",
});
