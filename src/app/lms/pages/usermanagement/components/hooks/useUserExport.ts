"use client";

// CSV export.
//
// "Export all" means every row matching the filters, not just the visible page
// — but those rows no longer live in the browser, so it asks the server for
// them, sorted the same way, carrying only the thirteen CSV columns (~366 bytes
// a row against ~2.6 KB for a table row).
// "Export selected" needs no request at all: the rows are already in hand.

import { useState } from "react";
import { toast } from "sonner";
import { fetchUsersForExport } from "@/app/lms/pages/usermanagement/api/userService";
import { transformUser } from "@/app/lms/pages/usermanagement/queries/users";
import type { User } from "../types";
import { getApiErrorMessage, type SearchField } from "../userManagement.constants";

const CSV_HEADER = [
  "First Name", "Last Name", "Email", "Phone", "Gender", "Role", "Batch",
  "Degree", "Department", "Semester", "Section", "Client", "Status",
];

// Quote only when the value could break the row apart; doubling any embedded
// quote is what RFC 4180 asks for and what Excel expects.
const esc = (v: any) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Sort key → the comparable string, matching the server's collation. */
export const sortValue = (u: User, key: string): string => {
  if (key === 'name') return `${u.firstName} ${u.lastName}`.toLowerCase();
  return String((u as any)[key] ?? '').toLowerCase();
};

function downloadCsv(rows: User[]) {
  const lines = [
    CSV_HEADER.join(','),
    ...rows.map(u => [
      u.firstName, u.lastName, u.email, u.phone, u.gender, u.role, u.batch,
      u.degree, u.department, u.semester, u.section, u.clientName, u.status,
    ].map(esc).join(',')),
  ];
  // The BOM is what makes Excel read the file as UTF-8 rather than the
  // system codepage — without it, accented names arrive mangled.
  const blob = new Blob(["﻿" + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export interface ExportFilters {
  search: string;
  searchField: SearchField;
  roles: string[];
  status: string;
  degree: string;
  department: string;
  year: string;
  sortKey: string;
  sortDir: 'asc' | 'desc';
}

export function useUserExport(
  institutionId: string | null,
  token: string | null,
  filters: ExportFilters,
  visibleSelectedRows: User[],
) {
  const [isExporting, setIsExporting] = useState(false);

  const exportUsers = async (scope: 'selected' | 'all') => {
    if (isExporting) return;
    let rows: User[];

    if (scope === 'selected') {
      // Ordered by the active sort, as it was when the whole list was sorted
      // in memory and then filtered down to the selection.
      rows = [...visibleSelectedRows];
      if (filters.sortKey) {
        rows.sort((a, b) =>
          sortValue(a, filters.sortKey).localeCompare(sortValue(b, filters.sortKey), undefined, { numeric: true }));
        if (filters.sortDir === 'desc') rows.reverse();
      }
    } else {
      if (!institutionId || !token) return;
      setIsExporting(true);
      try {
        const raw = await fetchUsersForExport(institutionId, token, filters);
        rows = raw.map(transformUser);
      } catch (error) {
        toast.error(getApiErrorMessage(error, "Export failed"));
        return;
      } finally {
        setIsExporting(false);
      }
    }

    if (!rows.length) {
      toast.info("Nothing to export");
      return;
    }
    downloadCsv(rows);
    toast.success(`Exported ${rows.length} user${rows.length > 1 ? 's' : ''}`);
  };

  return { exportUsers, isExporting };
}
