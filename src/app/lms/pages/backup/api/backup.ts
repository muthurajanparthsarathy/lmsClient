// Backup API — typed client for the `/backup/*` router (mounted at `/` on the
// Express server, so every path here is absolute and starts with `/backup`).
//
// Tenancy is NOT sent from the browser: every route is `userAuth` + admin-role
// guarded server-side and scopes itself from `req.user.institution`. The only
// thing this module attaches is the bearer token, which `@/lib/apiClient`
// already does for us.

import { api, type ApiError } from "@/lib/apiClient";

/* ── Contract types ──────────────────────────────────────────────────────── */

/**
 * What a backup covers.
 *  - `client`       the client document + its service mappings ONLY
 *  - `users`        users only (of one client, or of the whole institution)
 *  - `course`       one course and every collection hanging off it
 *  - `client-full`  the client + mappings + users + all courses, fully expanded
 *  - `institution`  everything belonging to the caller's institution
 */
export type BackupScope =
  | "client"
  | "users"
  | "course"
  | "client-full"
  | "institution";

/** Where the archive lands: a downloadable `.zip` or the separate backup cluster. */
export type BackupDestination = "local" | "db";

export type BackupStatus = "running" | "completed" | "failed";

/** How a restore treats documents that already exist in the live database. */
export type RestoreMode = "skip" | "overwrite";

export interface BackupCollectionCount {
  collection: string;
  count: number;
}

export interface BackupTargetClient {
  _id: string;
  clientCompany: string;
  status?: string;
}

export interface BackupTargetCourse {
  _id: string;
  courseName: string;
  courseCode?: string;
  clientId?: string;
  clientName?: string;
}

/** `GET /backup/targets` — everything the scope pickers need, institution-scoped. */
export interface BackupTargets {
  clients: BackupTargetClient[];
  courses: BackupTargetCourse[];
}

/** `POST /backup/preview` — counts only; the server never loads the documents. */
export interface BackupPreview {
  scope: BackupScope;
  targetName: string;
  collections: BackupCollectionCount[];
  totalDocuments: number;
}

/** One row of `BackupModel`. */
export interface BackupRecord {
  _id: string;
  institution?: string;
  scope: BackupScope;
  targetId?: string | null;
  targetName?: string;
  destination: BackupDestination;
  status: BackupStatus;
  collections: BackupCollectionCount[];
  totalDocuments: number;
  sizeBytes: number;
  /** Local destination only. */
  fileName?: string;
  /** Local destination only — server-side path, never used by the browser. */
  filePath?: string;
  /** DB destination only: the database NAME (never a connection URI). */
  targetDatabase?: string;
  note?: string;
  error?: string;
  createdBy?: string;
  createdByName?: string;
  createdByEmail?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

/** `GET /backup/list` — newest first. */
export interface BackupListPage {
  items: BackupRecord[];
  total: number;
  page: number;
  totalPages: number;
}

export interface RestoreWriteFailure {
  code?: number;
  message: string;
}

export interface RestoreCollectionReport {
  collection: string;
  matched: number;
  inserted: number;
  updated: number;
  skipped: number;
  /** Documents this collection failed to write — most commonly a collision
   *  on a non-_id unique index (e.g. lms-users.email). A restore continues
   *  past these rather than aborting, so the count can be > 0 alongside real
   *  inserted/updated numbers for the same collection. */
  failed?: number;
  /** Up to 20 example failures; `failed` above is the exact total. */
  failures?: RestoreWriteFailure[];
}

/** `POST /backup/:id/restore` — the per-collection outcome of a run (or dry run). */
export interface RestoreReport {
  dryRun: boolean;
  mode: RestoreMode;
  /** Where the documents were read back from. */
  source?: "archive" | "database";
  collections: RestoreCollectionReport[];
  totalInserted: number;
  totalUpdated: number;
  totalSkipped: number;
  totalFailed?: number;
}

/* ── Request payloads ────────────────────────────────────────────────────── */

export interface BackupPreviewInput {
  scope: BackupScope;
  targetId?: string;
}

export interface BackupCreateInput {
  scope: BackupScope;
  targetId?: string;
  destination: BackupDestination;
  note?: string;
}

export interface BackupRestoreInput {
  mode: RestoreMode;
  dryRun: boolean;
}

/* ── Envelope handling ───────────────────────────────────────────────────── */

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface MessageEnvelope {
  success: boolean;
  message?: string;
}

const asApiError = (message: string, status?: number): ApiError => {
  const err = new Error(message) as ApiError;
  err.name = "ApiError";
  err.status = status;
  err.retryable = status === undefined || (status >= 500 && status < 600);
  return err;
};

/**
 * Non-2xx responses are already thrown as `ApiError` by `@/lib/apiClient`;
 * this only guards the (contract-violating) `200 { success: false }` case so a
 * failure can never be painted as data.
 */
const unwrap = <T>(res: ApiEnvelope<T>): T => {
  if (!res || res.success !== true) {
    throw asApiError(res?.message || "Request failed");
  }
  return res.data;
};

/* Long-running endpoints. `api` inherits axios' default (no timeout) unless we
   pass one, but being explicit documents the expectation: a full-institution
   archive is minutes of work, not seconds. */
const LONG_TIMEOUT_MS = 15 * 60 * 1000;
const DOWNLOAD_TIMEOUT_MS = 10 * 60 * 1000;

/* ── Calls ───────────────────────────────────────────────────────────────── */

/** Clients + courses for the scope pickers. */
export const fetchBackupTargets = async (): Promise<BackupTargets> =>
  unwrap(await api.get<ApiEnvelope<BackupTargets>>("/backup/targets"));

/** Per-collection document counts for a scope, before anything is written. */
export const previewBackup = async (
  input: BackupPreviewInput
): Promise<BackupPreview> =>
  unwrap(
    await api.post<ApiEnvelope<BackupPreview>>("/backup/preview", input, {
      timeout: LONG_TIMEOUT_MS,
    })
  );

/** Runs the backup synchronously; resolves with the completed record. */
export const createBackup = async (
  input: BackupCreateInput
): Promise<BackupRecord> =>
  unwrap(
    await api.post<ApiEnvelope<BackupRecord>>("/backup/create", input, {
      timeout: LONG_TIMEOUT_MS,
    })
  );

export const fetchBackupList = async (
  page: number,
  limit: number
): Promise<BackupListPage> =>
  unwrap(
    await api.get<ApiEnvelope<BackupListPage>>("/backup/list", {
      params: { page, limit },
    })
  );

export const fetchBackup = async (id: string): Promise<BackupRecord> =>
  unwrap(await api.get<ApiEnvelope<BackupRecord>>(`/backup/${id}`));

export const restoreBackup = async (
  id: string,
  input: BackupRestoreInput
): Promise<RestoreReport> =>
  unwrap(
    await api.post<ApiEnvelope<RestoreReport>>(`/backup/${id}/restore`, input, {
      timeout: LONG_TIMEOUT_MS,
    })
  );

export const deleteBackup = async (id: string): Promise<string> => {
  const res = await api.del<MessageEnvelope>(`/backup/${id}`);
  if (!res || res.success !== true) {
    throw asApiError(res?.message || "Failed to delete backup");
  }
  return res.message || "Backup deleted";
};

/**
 * `GET /backup/:id/download` returns the archive itself, so the error body on a
 * 404 is a Blob rather than JSON — `toApiError` can't read it and falls back to
 * axios' generic text. Re-read it here so the user sees the server's reason
 * ("file is missing on disk") instead of "Request failed with status code 404".
 */
const readBlobError = async (err: unknown): Promise<never> => {
  const apiErr = err as ApiError;
  const raw = apiErr?.raw;
  if (raw instanceof Blob) {
    const message = await raw
      .text()
      .then((text) => (JSON.parse(text) as { message?: string })?.message)
      .catch(() => undefined);
    if (message) throw asApiError(message, apiErr.status);
  }
  throw apiErr;
};

/**
 * Downloads the `.zip` and hands it to the browser. Follows the house Blob
 * pattern (createObjectURL → anchor → click → revokeObjectURL); the filename
 * comes from the record because a cross-origin `Content-Disposition` is not
 * readable from JS here.
 */
export const downloadBackupArchive = async (
  id: string,
  fileName?: string
): Promise<void> => {
  const blob = await api
    .get<Blob>(`/backup/${id}/download`, {
      responseType: "blob",
      timeout: DOWNLOAD_TIMEOUT_MS,
    })
    .catch(readBlobError);

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName?.trim() || `backup-${id}.zip`;
  anchor.click();
  URL.revokeObjectURL(url);
};

/* ── Schedule ────────────────────────────────────────────────────────────── */

export type BackupFrequency = "daily" | "every2days" | "weekly" | "monthly";
export type BackupScheduleStatus = "never" | "completed" | "failed";

export interface BackupSchedule {
  _id: string;
  enabled: boolean;
  frequency: BackupFrequency;
  /** Wall-clock "HH:mm", 24h, in the SERVER's timezone. */
  time: string;
  /** 0 = Sunday … 6 = Saturday. Only meaningful when frequency is "weekly". */
  dayOfWeek: number;
  /** 1-31, clamped to the month's last day. Only for "monthly". */
  dayOfMonth: number;
  scope: BackupScope;
  targetId: string;
  /** A schedule can write to BOTH a local .zip and the backup database; each
   *  destination produces its own backup record. */
  destinations: BackupDestination[];
  /** Legacy singular field, kept in step with `destinations[0]` by the server. */
  destination: BackupDestination;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastStatus: BackupScheduleStatus;
  lastError: string;
  lastBackupId: string | null;
  /** Server-rendered summary, e.g. "Weekly · Monday · 02:00". */
  summary: string;
  updatedAt: string;
}

export type BackupScheduleInput = Partial<
  Pick<
    BackupSchedule,
    | "enabled"
    | "frequency"
    | "time"
    | "dayOfWeek"
    | "dayOfMonth"
    | "scope"
    | "targetId"
    | "destinations"
  >
>;

export const fetchBackupSchedule = async (): Promise<BackupSchedule> =>
  unwrap(await api.get<ApiEnvelope<BackupSchedule>>("/backup/schedule"));

export const saveBackupSchedule = async (
  input: BackupScheduleInput
): Promise<BackupSchedule> =>
  unwrap(await api.put<ApiEnvelope<BackupSchedule>>("/backup/schedule", input));
