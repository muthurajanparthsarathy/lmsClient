// Turn a User model's `profile` field into an addressable image URL.
//
// The user schema stores the profile picture as a plain string on
// `User.profile` (see Server/models/UserModel.js). Historically this string
// has taken several shapes depending on where the upload originated:
//
//   • Absolute https / data / blob URL      → use as-is
//   • Protocol-relative "//host/path"       → prefix with https:
//   • Bare Supabase filename ("abc.png")    → resolve against the app's
//                                              Supabase Storage bucket
//                                              (smartlms/users/profile)
//   • Backend-served relative path          → resolve against the API host
//   • Sentinels "default" / "null" / ""     → treated as no photo
//
// Everything that displays a student's avatar — the Live Dashboard learner
// row, the Review Submission header, the picker inside it — goes through
// this one function so a schema change is a single edit, not seven.
//
// Extracted 2026-09-10 from the inline copy that lived in
// reviewSubmission/page.tsx.

import { API_BASE_URL } from './http';

const SUPABASE_PROFILE_BASE = (() => {
  const root = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
  return root ? `${root}/storage/v1/object/public/smartlms/users/profile` : '';
})();

export function resolveAvatarUrl(profile?: string | null): string | undefined {
  const value = (profile || '').trim();
  if (!value) return undefined;

  const lowered = value.toLowerCase();
  if (lowered === 'default' || lowered === 'null' || lowered === 'undefined') return undefined;

  // Already addressable.
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;

  // Storage-relative ("users/profile/x.png") or a bare filename. Prefer the
  // Supabase bucket for bare filenames; anything with a slash goes to the
  // backend so a stored path like "uploads/2026/a.png" still resolves.
  const cleaned = value.replace(/^\/+/, '');
  if (SUPABASE_PROFILE_BASE && !cleaned.includes('/')) {
    return `${SUPABASE_PROFILE_BASE}/${cleaned}`;
  }
  return `${API_BASE_URL.replace(/\/+$/, '')}/${cleaned}`;
}

// Cheap initials from a full name. Two-letter for two-plus-word names, a
// single letter for single names, "?" for empty. Purely a fallback for the
// avatar circle — real display uses whatever the caller passes as name.
export function initialsOfName(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return (first + last).toUpperCase() || '?';
}
