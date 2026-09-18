"use client";

// React Query bindings for the Backup console.
//
// These hooks own CACHE behaviour only — invalidation and staleness. Toasts and
// UI state stay in the components so the restore report can be rendered where
// the user is looking, which is the same split `useUserCrud` lands on for
// everything except its toasts.

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  createBackup,
  deleteBackup,
  downloadBackupArchive,
  fetchBackupSchedule,
  saveBackupSchedule,
  fetchBackupList,
  fetchBackupTargets,
  previewBackup,
  restoreBackup,
  type BackupCreateInput,
  type BackupListPage,
  type BackupPreview,
  type BackupPreviewInput,
  type BackupRecord,
  type BackupRestoreInput,
  type BackupSchedule,
  type BackupScheduleInput,
  type BackupTargets,
  type RestoreReport,
} from "@/app/lms/pages/backup/api/backup";

const ONE_MIN = 60 * 1000;
const FIVE_MIN = 5 * 60 * 1000;
const TEN_MIN = 10 * 60 * 1000;

export const BACKUP_PAGE_SIZE = 20;

/**
 * Local key factory. The shared `@/lib/queryKeys` factory has no "backup" root
 * yet and that file is not ours to edit, so the keys live here — same shape
 * (root string first) so a later move into the shared factory is a rename.
 */
export const backupKeys = {
  all: ["backup"] as const,
  targets: () => ["backup", "targets"] as const,
  schedule: () => [...backupKeys.all, "schedule"] as const,
  lists: () => ["backup", "list"] as const,
  list: (page: number, limit: number) =>
    ["backup", "list", { page, limit }] as const,
};

/* ── Queries ─────────────────────────────────────────────────────────────── */

/** Clients + courses that populate the scope pickers. */
export const useBackupTargetsQuery = (enabled: boolean = true) =>
  useQuery<BackupTargets>({
    queryKey: backupKeys.targets(),
    queryFn: fetchBackupTargets,
    enabled,
    staleTime: FIVE_MIN,
    gcTime: TEN_MIN,
  });

/** One page of backup history, newest first. */
export const useBackupListQuery = (
  page: number,
  limit: number = BACKUP_PAGE_SIZE,
  enabled: boolean = true
) =>
  useQuery<BackupListPage>({
    queryKey: backupKeys.list(page, limit),
    queryFn: () => fetchBackupList(page, limit),
    enabled,
    placeholderData: keepPreviousData,
    // The history is NOT cacheable for minutes at a time, because it changes
    // from OUTSIDE this page: cron/backupScheduler.js writes a row whenever a
    // schedule fires, and nothing in the browser is told. With a stale time
    // the list kept serving the pre-run cache, so a backup that had already
    // happened was simply missing from the top of the table — indistinguishable
    // from "the newest backup is not sorted first".
    //
    // A manual backup was always fine (createBackup invalidates this key); it
    // is the scheduled ones that went missing. Refetching on mount and focus
    // is cheap here — the payload is a few KB — and being right matters more.
    staleTime: 0,
    gcTime: FIVE_MIN,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    // Picks up a scheduled run while the tab is simply left open. React Query
    // does not poll a backgrounded tab by default, so this costs nothing when
    // the page is not being looked at.
    refetchInterval: ONE_MIN,
  });

/* ── Mutations ───────────────────────────────────────────────────────────── */

/**
 * Counts-only dry look at a scope. A mutation rather than a query: it is an
 * explicit user action with a POST body, and its result must not be re-fetched
 * behind the user's back after they have changed the form.
 */
export const usePreviewBackupMutation = () =>
  useMutation<BackupPreview, Error, BackupPreviewInput>({
    mutationFn: previewBackup,
  });

/** Runs the backup. Synchronous server-side, so this can take minutes. */
export const useCreateBackupMutation = () => {
  const queryClient = useQueryClient();
  return useMutation<BackupRecord, Error, BackupCreateInput>({
    mutationFn: createBackup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: backupKeys.lists() });
    },
  });
};

/**
 * Restore — dry run or real. A dry run changes nothing, so only a real run
 * invalidates anything; and what it invalidates is the WHOLE cache, because a
 * restore can rewrite users, courses and clients underneath every other page.
 */
export const useRestoreBackupMutation = () => {
  const queryClient = useQueryClient();
  return useMutation<
    RestoreReport,
    Error,
    { id: string } & BackupRestoreInput
  >({
    mutationFn: ({ id, mode, dryRun }) => restoreBackup(id, { mode, dryRun }),
    onSuccess: (report) => {
      if (!report.dryRun) queryClient.invalidateQueries();
    },
  });
};

export const useDeleteBackupMutation = () => {
  const queryClient = useQueryClient();
  return useMutation<string, Error, string>({
    mutationFn: deleteBackup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: backupKeys.lists() });
    },
  });
};

/** Streams the archive to the browser. No cache to touch — nothing changes. */
export const useDownloadBackupMutation = () =>
  useMutation<void, Error, { id: string; fileName?: string }>({
    mutationFn: ({ id, fileName }) => downloadBackupArchive(id, fileName),
  });


/* ── Schedule ────────────────────────────────────────────────────────────── */

export const useBackupScheduleQuery = (enabled = true) =>
  useQuery<BackupSchedule, Error>({
    queryKey: backupKeys.schedule(),
    queryFn: fetchBackupSchedule,
    enabled,
    staleTime: 30_000,
  });

export const useSaveBackupScheduleMutation = () => {
  const queryClient = useQueryClient();
  return useMutation<BackupSchedule, Error, BackupScheduleInput>({
    mutationFn: saveBackupSchedule,
    onSuccess: (schedule) => {
      // Seed the cache from the response rather than refetching: the server
      // returns the saved row, including the recomputed nextRunAt.
      queryClient.setQueryData(backupKeys.schedule(), schedule);
    },
  });
};
