"use client";

// Bulk activate / deactivate / delete, driven by the floating selection bar.
//
// Every one of these acts on `visibleSelectedIds` — the selection narrowed to
// rows that still match the active filters — so narrowing the filters can never
// leave an off-screen row queued for deletion.

import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { bulkSetUserStatus, deleteUser } from "@/app/lms/pages/usermanagement/api/userService";
import { queryKeys } from "@/lib/queryKeys";
import { getApiErrorMessage } from "../userManagement.constants";

export function useBulkUserActions(
  token: string | null,
  visibleSelectedIds: string[],
  clearSelection: () => void,
) {
  const queryClient = useQueryClient();
  const [bulkBusy, setBulkBusy] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  const handleBulkStatus = async (status: 'active' | 'inactive') => {
    if (!visibleSelectedIds.length || !token) return;
    setBulkBusy(true);
    try {
      await bulkSetUserStatus(visibleSelectedIds, status, token);
      toast.success(`${visibleSelectedIds.length} user${visibleSelectedIds.length > 1 ? 's' : ''} ${status === 'active' ? 'activated' : 'deactivated'}`);
      clearSelection();
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to update status"));
    } finally {
      setBulkBusy(false);
    }
  };

  // Deletes run independently rather than as one request, so a single failure
  // does not abandon the rest — the toast reports both halves of the outcome.
  const confirmBulkDelete = async () => {
    if (!visibleSelectedIds.length || !token) return;
    setBulkBusy(true);
    try {
      const results = await Promise.allSettled(visibleSelectedIds.map(id => deleteUser(id, token)));
      const ok = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.length - ok;
      if (ok) toast.success(`${ok} user${ok > 1 ? 's' : ''} deleted`);
      if (failed) toast.error(`${failed} user${failed > 1 ? 's' : ''} could not be deleted`);
      clearSelection();
      setShowBulkDeleteModal(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    } finally {
      setBulkBusy(false);
    }
  };

  return {
    bulkBusy,
    showBulkDeleteModal,
    setShowBulkDeleteModal,
    handleBulkStatus,
    confirmBulkDelete,
  };
}
