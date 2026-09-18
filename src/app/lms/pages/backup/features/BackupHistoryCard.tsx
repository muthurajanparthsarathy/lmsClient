"use client";

// Section 2 — "Backup History".
//
// One page of records at a time, OLDEST first, with the three row actions each
// gated on its own permission: Download (local archives only), Restore and
// Delete. The row action group is deliberately identical in shape to the other
// System Settings tables — icon buttons, danger tint on delete only.

import * as React from "react";
import {
  Archive,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  FolderArchive,
  History,
  Loader2,
  RotateCcw,
  Search,
  Table2,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState, SkeletonTable } from "@/app/lms/shared/ui";
import { cn } from "@/lib/utils";
import { showErrorToast, showSuccessToast } from "@/components/ui/toastUtils";
import type {
  BackupRecord,
  BackupScope,
  RestoreMode,
} from "@/app/lms/pages/backup/api/backup";
import {
  useBackupListQuery,
  useDeleteBackupMutation,
  useDownloadBackupMutation,
  useRestoreBackupMutation,
} from "@/app/lms/pages/backup/queries/backup";
import RestoreBackupModal from "./RestoreBackupModal";
import {
  BackupStatusPill,
  ConfirmDeleteModal,
  CountPill,
  destinationLabel,
  formatBytes,
  formatCount,
  formatDateTime,
  RowIconButton,
  ScopePill,
  scopeLabel,
  SCOPE_OPTIONS,
  TabCard,
  TabCardHeader,
  TD_CLASS,
  TH_CLASS,
} from "./ui";

/** One wide fetch backs the client-side search; see the query comment below. */
const HISTORY_FETCH_LIMIT = 500;

const PAGE_SIZES = [10, 25, 50, 100];

/** Initials for the Created-by avatar. Falls back to the email's first letter,
 *  and to "S" for the scheduler, which has a name but no person behind it. */
const initialsOf = (record: BackupRecord): string => {
  const name = (record.createdByName || "").trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
  }
  const email = (record.createdByEmail || "").trim();
  return email ? email[0].toUpperCase() : "—";
};

const errorText = (error: unknown, fallback: string): string => {
  const message = (error as Error | null)?.message;
  return message && message.trim() ? message : fallback;
};

export interface BackupHistoryCardProps {
  canDownload: boolean;
  canRestore: boolean;
  canDelete: boolean;
  /** Opens the column-picker → format report dialog. */
  onOpenReport?: () => void;
}

export default function BackupHistoryCard({
  canDownload,
  canRestore,
  canDelete,
  onOpenReport,
}: BackupHistoryCardProps) {
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [query, setQuery] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<"all" | BackupScope>("all");
  const [restoreTarget, setRestoreTarget] = React.useState<BackupRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<BackupRecord | null>(null);
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);

  // One wide fetch, then filter and paginate here. Server-side /backup/list
  // takes no search or scope parameter, so filtering a single server page
  // would only ever search the rows already on screen — a search box that
  // silently ignores everything else is worse than no search box.
  const listQuery = useBackupListQuery(1, HISTORY_FETCH_LIMIT);
  const downloadMutation = useDownloadBackupMutation();
  const restoreMutation = useRestoreBackupMutation();
  const deleteMutation = useDeleteBackupMutation();

  const allItems = React.useMemo(() => listQuery.data?.items ?? [], [listQuery.data]);
  const total = listQuery.data?.total ?? 0;
  const truncated = total > HISTORY_FETCH_LIMIT;

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return allItems.filter((record) => {
      if (typeFilter !== "all" && record.scope !== typeFilter) return false;
      if (!needle) return true;
      return [
        formatDateTime(record.createdAt),
        scopeLabel(record.scope),
        record.targetName,
        destinationLabel(record.destination),
        record.targetDatabase,
        record.status,
        record.createdByName,
        record.createdByEmail,
        record.note,
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle));
    });
  }, [allItems, query, typeFilter]);

  // OLDEST FIRST in this table, by explicit request. Sorted here rather than
  // in the query, because the overview cards share that cache and read
  // items[0] as the LATEST backup — flipping it there would make them report
  // the oldest. toSorted-style copy, never an in-place reverse on the memo.
  const ordered = React.useMemo(
    () =>
      [...filtered].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ),
    [filtered]
  );

  const filteredTotal = ordered.length;
  const totalPages = Math.max(Math.ceil(filteredTotal / pageSize), 1);
  const items = React.useMemo(
    () => ordered.slice((page - 1) * pageSize, page * pageSize),
    [ordered, page, pageSize]
  );

  // Deleting the last row of a page — or narrowing the filter — would
  // otherwise strand the user on a page that no longer exists.
  React.useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  // Any change to what is being filtered has to reset the position, or page 3
  // of the old result set silently becomes page 3 of the new one.
  React.useEffect(() => {
    setPage(1);
  }, [query, typeFilter, pageSize]);

  const from = filteredTotal === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = filteredTotal === 0 ? 0 : Math.min(page * pageSize, filteredTotal);

  const handleDownload = (record: BackupRecord) => {
    setDownloadingId(record._id);
    downloadMutation.mutate(
      { id: record._id, fileName: record.fileName },
      {
        onSuccess: () => showSuccessToast("Backup archive downloaded"),
        onError: (error) => showErrorToast(errorText(error, "Download failed")),
        onSettled: () => setDownloadingId(null),
      }
    );
  };

  const openRestore = (record: BackupRecord) => {
    restoreMutation.reset();
    setRestoreTarget(record);
  };

  const closeRestore = () => {
    setRestoreTarget(null);
    restoreMutation.reset();
  };

  const runRestore = ({ mode, dryRun }: { mode: RestoreMode; dryRun: boolean }) => {
    if (!restoreTarget) return;
    restoreMutation.mutate(
      { id: restoreTarget._id, mode, dryRun },
      {
        onSuccess: (report) =>
          showSuccessToast(
            report.dryRun
              ? "Dry run finished — nothing was written."
              : `Restore complete — ${formatCount(report.totalInserted)} inserted, ${formatCount(
                  report.totalUpdated
                )} updated.`
          ),
        onError: (error) => showErrorToast(errorText(error, "Restore failed")),
      }
    );
  };

  const runDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget._id, {
      onSuccess: (message) => {
        showSuccessToast(message);
        setDeleteTarget(null);
      },
      onError: (error) => showErrorToast(errorText(error, "Failed to delete backup")),
    });
  };

  return (
    <>
      <TabCard>
        <TabCardHeader
          icon={History}
          title="Backup history"
          subtitle="Every backup taken for this institution, oldest first."
          actions={
            <>
              <CountPill value={total} label={total === 1 ? "backup" : "backups"} />
              {onOpenReport ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onOpenReport}
                  disabled={total === 0}
                >
                  <Table2 className="h-4 w-4" />
                  Report
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                onClick={() => listQuery.refetch()}
                disabled={listQuery.isFetching}
              >
                {listQuery.isFetching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <History className="h-4 w-4" />
                )}
                Refresh
              </Button>
            </>
          }
        />

        {/* Filters live on their own row rather than in the header's action
            slot: TabCardHeader pins that slot with flex-shrink-0, so a search
            box next to the buttons pushed Refresh off the card's right edge
            instead of shrinking. Here the search flexes and the row wraps. */}
        <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-5 py-2.5">
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as "all" | BackupScope)}
            aria-label="Filter by scope"
            className="h-9 shrink-0 rounded-control border border-hairline-strong bg-surface px-2.5 text-xs text-body outline-none transition-colors focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
          >
            <option value="all">All Types</option>
            {SCOPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <div className="flex h-9 min-w-0 max-w-md flex-1 items-center gap-2 rounded-control border border-hairline-strong bg-surface px-2.5">
            <Search aria-hidden className="size-3.5 shrink-0 text-ink-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by date, type or status…"
              className="min-w-0 flex-1 bg-transparent text-xs text-body outline-none placeholder:text-faint"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="shrink-0 text-[11px] font-medium text-subtle hover:text-heading"
              >
                Clear
              </button>
            ) : null}
          </div>

          {query || typeFilter !== "all" ? (
            <span className="shrink-0 text-[11px] text-subtle">
              {formatCount(filteredTotal)} match{filteredTotal === 1 ? "" : "es"}
            </span>
          ) : null}
        </div>

        {/* Search and the scope filter run over the rows fetched above. Past
            that limit they would silently cover only part of the history, so
            say so rather than quietly narrowing what "All Types" means. */}
        {truncated ? (
          <p className="border-b border-hairline bg-warn-50 px-4 py-2 text-[11px] text-warn-700">
            Showing the most recent {formatCount(HISTORY_FETCH_LIMIT)} of{" "}
            {formatCount(total)} backups — search and filters cover these rows only.
          </p>
        ) : null}

        {listQuery.isLoading ? (
          <SkeletonTable rows={5} cols={9} />
        ) : listQuery.isError ? (
          <EmptyState
            icon={Archive}
            title="Couldn't load backup history"
            message={errorText(listQuery.error, "Please try again in a moment.")}
            className="py-16"
            primaryAction={
              <Button variant="outline" onClick={() => listQuery.refetch()}>
                Try again
              </Button>
            }
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Archive}
            title="No backups yet"
            message="Backups you create will appear here with their contents, size and status."
            className="py-16"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse">
                <thead>
                  <tr>
                    <th className={TH_CLASS}>Created</th>
                    <th className={TH_CLASS}>Scope</th>
                    <th className={TH_CLASS}>Target</th>
                    <th className={TH_CLASS}>Destination</th>
                    <th className={`${TH_CLASS} text-right`}>Documents</th>
                    <th className={`${TH_CLASS} text-right`}>Size</th>
                    <th className={TH_CLASS}>Status</th>
                    <th className={TH_CLASS}>Created by</th>
                    <th className={`${TH_CLASS} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((record) => {
                    const isLocalArchive =
                      record.destination === "local" && record.status === "completed";
                    const isRestorable = record.status === "completed";
                    const isDownloading = downloadingId === record._id;

                    return (
                      <tr
                        key={record._id}
                        className="border-b border-hairline transition-colors last:border-b-0 hover:bg-row-hover"
                      >
                        <td className={`${TD_CLASS} whitespace-nowrap`}>
                          <span className="flex items-center gap-2">
                            <CalendarDays
                              aria-hidden
                              className="size-3.5 shrink-0 text-brand-strong"
                            />
                            {formatDateTime(record.createdAt)}
                          </span>
                        </td>
                        <td className={TD_CLASS}>
                          <ScopePill scope={record.scope} />
                        </td>
                        <td className={TD_CLASS}>
                          <span className="block max-w-56 truncate" title={record.targetName}>
                            {record.targetName || "—"}
                          </span>
                        </td>
                        <td className={`${TD_CLASS} whitespace-nowrap`}>
                          <span className="flex items-center gap-2 text-subtle">
                            {record.destination === "local" ? (
                              <FolderArchive aria-hidden className="size-3.5 shrink-0" />
                            ) : (
                              <Database aria-hidden className="size-3.5 shrink-0" />
                            )}
                            {destinationLabel(record.destination)}
                          </span>
                          {record.destination === "db" && record.targetDatabase ? (
                            <span
                              className="block truncate text-2xs text-faint"
                              title={record.targetDatabase}
                            >
                              {record.targetDatabase}
                            </span>
                          ) : null}
                        </td>
                        <td className={`${TD_CLASS} text-right tabular-nums`}>
                          {formatCount(record.totalDocuments)}
                        </td>
                        <td className={`${TD_CLASS} text-right tabular-nums`}>
                          {record.destination === "local"
                            ? formatBytes(record.sizeBytes)
                            : "—"}
                        </td>
                        <td className={TD_CLASS}>
                          <BackupStatusPill status={record.status} />
                          {record.status === "failed" && record.error ? (
                            <span
                              className="mt-0.5 block max-w-48 truncate text-2xs text-danger-700"
                              title={record.error}
                            >
                              {record.error}
                            </span>
                          ) : null}
                        </td>
                        <td className={TD_CLASS}>
                          <span
                            className="flex items-center gap-2"
                            title={record.createdByEmail || record.createdByName}
                          >
                            <span
                              aria-hidden
                              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-wash text-[10px] font-semibold uppercase text-brand-strong"
                            >
                              {initialsOf(record)}
                            </span>
                            <span className="block max-w-36 truncate">
                              {record.createdByName || record.createdByEmail || "—"}
                            </span>
                          </span>
                        </td>
                        <td className={`${TD_CLASS} text-right`}>
                          <div className="flex items-center justify-end gap-1">
                            {canDownload ? (
                              <RowIconButton
                                label={
                                  isLocalArchive
                                    ? "Download archive"
                                    : "Only local backups can be downloaded"
                                }
                                disabled={!isLocalArchive || isDownloading}
                                onClick={() => handleDownload(record)}
                              >
                                {isDownloading ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Download className="h-4 w-4" />
                                )}
                              </RowIconButton>
                            ) : null}

                            {canRestore ? (
                              <RowIconButton
                                label={
                                  isRestorable
                                    ? "Restore this backup"
                                    : "Only completed backups can be restored"
                                }
                                disabled={!isRestorable}
                                onClick={() => openRestore(record)}
                              >
                                <RotateCcw className="h-4 w-4" />
                              </RowIconButton>
                            ) : null}

                            {canDelete ? (
                              <RowIconButton
                                label="Delete backup"
                                danger
                                onClick={() => setDeleteTarget(record)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </RowIconButton>
                            ) : null}

                            {!canDownload && !canRestore && !canDelete ? (
                              <span className="text-xs text-faint">—</span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex-shrink-0 border-t border-hairline">
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-subtle">
                  <span>Show</span>
                  <select
                    value={pageSize}
                    onChange={(event) => setPageSize(Number(event.target.value))}
                    aria-label="Rows per page"
                    className="h-8 rounded-control border border-hairline-strong bg-surface px-2 text-xs text-body outline-none focus:border-accent-500"
                  >
                    {PAGE_SIZES.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                  <span>entries</span>
                  <span className="ml-1 text-faint">
                    ({formatCount(from)}–{formatCount(to)} of {formatCount(filteredTotal)})
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page <= 1}
                    aria-label="Previous page"
                    className="flex size-8 items-center justify-center rounded-control border border-hairline-strong bg-surface text-ink-500 transition-colors hover:bg-row-hover disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="size-4" />
                  </button>

                  {/* A sliding window, so a long history does not print fifty
                      page buttons across the footer. */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, index) => {
                    const start = Math.max(
                      1,
                      Math.min(page - 2, Math.max(1, totalPages - 4))
                    );
                    return start + index;
                  })
                    .filter((number) => number <= totalPages)
                    .map((number) => (
                      <button
                        key={number}
                        type="button"
                        onClick={() => setPage(number)}
                        aria-current={number === page ? "page" : undefined}
                        className={cn(
                          "flex size-8 items-center justify-center rounded-control border text-xs font-medium transition-colors",
                          number === page
                            ? "border-brand-strong bg-brand-strong text-white"
                            : "border-hairline-strong bg-surface text-ink-600 hover:bg-row-hover"
                        )}
                      >
                        {number}
                      </button>
                    ))}

                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    disabled={page >= totalPages}
                    aria-label="Next page"
                    className="flex size-8 items-center justify-center rounded-control border border-hairline-strong bg-surface text-ink-500 transition-colors hover:bg-row-hover disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </TabCard>

      <RestoreBackupModal
        open={Boolean(restoreTarget)}
        record={restoreTarget}
        isPending={restoreMutation.isPending}
        report={restoreMutation.data ?? null}
        onRun={runRestore}
        onClose={closeRestore}
      />

      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={runDelete}
        isPending={deleteMutation.isPending}
        title="Delete this backup?"
        message={
          deleteTarget
            ? `The ${formatDateTime(deleteTarget.createdAt)} backup record${
                deleteTarget.destination === "local"
                  ? " and its archive file on disk"
                  : ""
              } will be removed.`
            : undefined
        }
      />
    </>
  );
}
