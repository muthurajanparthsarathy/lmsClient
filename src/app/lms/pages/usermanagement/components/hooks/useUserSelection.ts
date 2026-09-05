"use client";

// Row selection for the directory.
//
// Selection keeps the ROW, not just the id: it spans pages, and with the
// directory paginated the rows for other pages are no longer in memory —
// bulk actions and "Export selected" both need the user objects themselves.
//
// `visibleSelected*` is the selection narrowed to rows that still match the
// active filters, which is what every bulk action operates on: filtering the
// list must not leave an invisible row queued for deletion.

import { useState, useMemo } from "react";
import type { User } from "../types";

export function useUserSelection(
  currentUsers: User[],
  matchesCurrentFilters: (user: User) => boolean,
) {
  const [selectedRows, setSelectedRows] = useState<Record<string, User>>({});
  const selectedIds = useMemo(() => Object.keys(selectedRows), [selectedRows]);

  const visibleSelectedRows = useMemo(
    () => Object.values(selectedRows).filter(matchesCurrentFilters),
    [selectedRows, matchesCurrentFilters],
  );

  const visibleSelectedIds = useMemo(
    () => visibleSelectedRows.map(u => u.id),
    [visibleSelectedRows],
  );

  const pageIds = currentUsers.map(u => u.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.includes(id));
  const somePageSelected = pageIds.some(id => selectedIds.includes(id));
  // (The header checkbox's indeterminate state is owned by UsersTable, which
  // receives somePageSelected/allPageSelected as props.)

  const toggleSelectAllPage = () => {
    setSelectedRows(prev => {
      const next = { ...prev };
      if (allPageSelected) {
        pageIds.forEach(id => { delete next[id]; });
      } else {
        currentUsers.forEach(u => { next[u.id] = u; });
      }
      return next;
    });
  };

  const toggleSelectOne = (id: string) => {
    setSelectedRows(prev => {
      if (prev[id]) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      const row = currentUsers.find(u => u.id === id);
      return row ? { ...prev, [id]: row } : prev;
    });
  };

  const clearSelection = () => setSelectedRows({});

  return {
    selectedIds,
    visibleSelectedRows,
    visibleSelectedIds,
    allPageSelected,
    somePageSelected,
    toggleSelectAllPage,
    toggleSelectOne,
    clearSelection,
  };
}
