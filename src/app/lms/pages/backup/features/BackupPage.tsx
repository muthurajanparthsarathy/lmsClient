"use client";

// Backup — System Settings.
//
// Sibling of Dynamic Field Settings: same shell (DashboardLayout), same page
// chrome (PageHeader + card stack), same three render branches (permissions not
// read yet → skeleton; no access → EmptyState; otherwise the page).
//
// Route access itself is handled upstream by AuthWrapper, which resolves
// /lms/pages/backup from the stored "backup" permission key. What this file
// gates is the four FUNCTIONS declared on the `admin-backup` tree node.

import * as React from "react";
import { motion } from "framer-motion";
import {
  Archive,
  CalendarClock,
  Database,
  DatabaseBackup,
  FileArchive,
  Info,
  Plus,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import DashboardLayout from "@/app/lms/component/layout";
import PageHeader from "@/app/lms/shared/listing/PageHeader";
import { EmptyState, Skeleton, SkeletonTable, pageEnter } from "@/app/lms/shared/ui";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSION_IDS_ALL } from "@/app/lms/pages/usermanagement/components/permissions/index";
import { Button } from "@/components/ui/button";
import {
  useBackupListQuery,
  useBackupScheduleQuery,
} from "@/app/lms/pages/backup/queries/backup";

import CreateBackupCard from "./CreateBackupCard";
import BackupHistoryCard from "./BackupHistoryCard";
import ScheduleModal from "./ScheduleModal";
import ReportModal from "./ReportModal";
import { TabCard } from "./ui";

const PAGE_SUBTITLE =
  "Capture a client, its users, a single course or your whole institution — as a downloadable archive or a copy in the backup database.";

function BackupPageHeader() {
  return (
    <div className="flex-shrink-0">
      <PageHeader section="System" title="Backup" subtitle={PAGE_SUBTITLE} />
    </div>
  );
}

export default function BackupPage() {
  const { can, isReady } = usePermissions();

  // `can(id)` with no functionality is the page-level check; the four ids below
  // are the function nodes declared under `admin-backup` in the permission tree.
  const backupId = PERMISSION_IDS_ALL.ADMIN_BACKUP;
  const hasPage = isReady && can(backupId);
  const canCreate = hasPage && can(backupId, "Create Backup");
  const canRestore = hasPage && can(backupId, "Restore Backup");
  const canDownload = hasPage && can(backupId, "Download Backup");
  const canDelete = hasPage && can(backupId, "Delete Backup");
  const [showCreate, setShowCreate] = React.useState(false);
  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [reportOpen, setReportOpen] = React.useState(false);
  const scheduleQuery = useBackupScheduleQuery(hasPage);
  const schedule = scheduleQuery.data;

  // 50, not 5: the cards below report on local archives and database copies
  // separately, and the newest few rows can easily be all one kind.
  const listQuery = useBackupListQuery(1, 50, hasPage);
  const backups = React.useMemo(() => listQuery.data?.items ?? [], [listQuery.data]);
  const latestBackup = backups[0];

  const latestLocal = React.useMemo(
    () => backups.find((item) => item.destination === "local"),
    [backups]
  );
  const latestDb = React.useMemo(
    () => backups.find((item) => item.destination === "db"),
    [backups]
  );
  const localArchives = React.useMemo(
    () => backups.filter((item) => item.destination === "local"),
    [backups]
  );
  const archiveBytes = localArchives.reduce((sum, item) => sum + (item.sizeBytes || 0), 0);

  if (!isReady) {
    return (
      <DashboardLayout>
        <div className="h-full min-h-0 flex flex-col px-6 py-5 md:px-8 md:py-6">
          <BackupPageHeader />

          <div className="mt-5 flex flex-col gap-5">
            <TabCard>
              <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-tile" />
                  <div>
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="mt-1.5 h-3 w-56" />
                  </div>
                </div>
                <Skeleton className="h-9 w-28 rounded-control" />
              </div>
              <div className="grid gap-2.5 p-5 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-16 rounded-tile" />
                ))}
              </div>
            </TabCard>

            <TabCard>
              <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-tile" />
                  <div>
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="mt-1.5 h-3 w-56" />
                  </div>
                </div>
                <Skeleton className="h-9 w-28 rounded-control" />
              </div>
              <SkeletonTable rows={5} cols={9} />
            </TabCard>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!hasPage) {
    return (
      <DashboardLayout>
        <div className="h-full min-h-0 flex flex-col px-6 py-5 md:px-8 md:py-6">
          <BackupPageHeader />

          <div className="mt-5">
            <TabCard>
              <EmptyState
                icon={Database}
                title="No access"
                message="You don't have permission to access Backup features."
                className="py-16"
                secondaryAction={
                  <div className="rounded-tile border border-hairline bg-canvas px-4 py-3 text-left">
                    <p className="text-xs text-subtle">
                      Required permission:{" "}
                      <span className="font-medium text-heading">backup</span>
                    </p>
                    <p className="mt-1 text-xs text-faint">
                      Contact your administrator to request access.
                    </p>
                  </div>
                }
              />
            </TabCard>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <motion.div
        variants={pageEnter}
        initial="hidden"
        animate="visible"
        className="h-full min-h-0 flex flex-col"
      >
        {/* The shell owns no padding of its own — the header and the scroll
            area each set their own, so the two never stack into a double
            gutter down the left edge. */}
        <div className="flex items-start justify-between gap-4 border-b border-hairline px-5 py-3.5 md:px-6">
          <div>
            {showCreate ? (
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="mb-1.5 text-xs font-medium text-brand-strong hover:underline"
              >
                ‹ Back to Backup Overview
              </button>
            ) : null}
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-brand-wash text-brand-strong">
                {showCreate ? <DatabaseBackup className="size-4.5" /> : <Archive className="size-4.5" />}
              </span>
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-heading">
                  {showCreate ? "Backup Now" : "Backup & Restore"}
                </h1>
                <p className="mt-0.5 text-xs text-subtle">
                  {showCreate
                    ? "Select what you want to backup and apply filters."
                    : "Manage your data backups and restore when needed."}
                </p>
              </div>
            </div>
          </div>
          {!showCreate ? (
            <div className="flex shrink-0 items-center gap-2">
              {/* The schedule editor is an ACTION, so it lives with the other
                  page action rather than inside a card that otherwise only
                  reports numbers. */}
              <Button variant="outline" size="sm" onClick={() => setScheduleOpen(true)}>
                <CalendarClock className="size-4" />
                {schedule?.enabled ? "Edit schedule" : "Set a schedule"}
              </Button>
              {canCreate ? (
                <Button
                  size="sm"
                  onClick={() => setShowCreate(true)}
                  className="bg-gradient-to-r from-orange-400 to-brand-strong text-white shadow-sm"
                >
                  <Plus className="size-4" />
                  Backup Now
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 md:px-6">
          {showCreate ? (
            <CreateBackupCard canCreate={canCreate} />
          ) : (
            <div className="flex flex-col gap-4 pb-1">
              <div className="grid gap-3 xl:grid-cols-4 md:grid-cols-2">
                {/* NOTE ON LABELS: the second card is "Local Archives", not
                    "File Storage Backup". A backup stores the URL of an
                    uploaded video or PDF, never its bytes (see the fileUrl
                    field on a pedagogy resource) — so a card claiming file
                    storage is backed up would be false on the one screen
                    people consult before trusting a restore. */}
                <OverviewStat
                  icon={DatabaseBackup}
                  title="Database Backup"
                  value={latestDb ? "Success" : "None yet"}
                  detail={latestDb ? formatDate(latestDb.createdAt) : "No database copies"}
                  meta={
                    latestDb
                      ? { label: "Documents", value: formatCountShort(latestDb.totalDocuments) }
                      : undefined
                  }
                  footer="Last backup"
                  tone="orange"
                />
                <OverviewStat
                  icon={FileArchive}
                  title="Local Archives"
                  value={latestLocal ? "Success" : "None yet"}
                  detail={latestLocal ? formatDate(latestLocal.createdAt) : "No archives yet"}
                  meta={{ label: "Size", value: formatSize(archiveBytes) }}
                  footer="Last backup"
                  tone="violet"
                />
                <OverviewStat
                  icon={UsersRound}
                  title="Client Backups"
                  value={String(listQuery.data?.total ?? 0)}
                  detail="Total backups"
                  tone="violet"
                />

                {/* Information only — the action lives in the page header. */}
                <div
                  className={
                    schedule?.enabled
                      ? "rounded-xl border border-success-500/30 bg-success-50 p-3.5 shadow-xs"
                      : "rounded-xl border border-hairline bg-surface p-3.5 shadow-xs"
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        aria-hidden
                        className={
                          schedule?.enabled
                            ? "flex size-8 items-center justify-center rounded-tile bg-success-500/15 text-success-700"
                            : "flex size-8 items-center justify-center rounded-tile bg-ink-100 text-ink-400"
                        }
                      >
                        <CalendarClock className="size-4" />
                      </span>
                      <p className="min-w-0 truncate text-xs font-medium text-subtle">
                        Backup Schedule
                      </p>
                    </div>
                    <span
                      className={
                        schedule?.enabled
                          ? "rounded-full bg-success-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-success-700"
                          : "rounded-full bg-ink-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-600"
                      }
                    >
                      {scheduleQuery.isLoading ? "…" : schedule?.enabled ? "On" : "Off"}
                    </span>
                  </div>

                  <dl className="mt-2.5 grid grid-cols-2 gap-2">
                    <div className="min-w-0">
                      <dt className="text-[10px] uppercase tracking-wider text-faint">
                        Frequency
                      </dt>
                      <dd className="truncate text-xs font-medium text-heading">
                        {scheduleQuery.isLoading
                          ? "…"
                          : schedule?.enabled
                            ? schedule.summary
                            : "Not scheduled"}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[10px] uppercase tracking-wider text-faint">
                        Next run
                      </dt>
                      <dd className="truncate text-xs font-medium text-heading">
                        {schedule?.enabled && schedule.nextRunAt
                          ? formatDate(schedule.nextRunAt)
                          : "—"}
                      </dd>
                    </div>
                  </dl>

                  {schedule?.lastStatus === "failed" ? (
                    <p
                      className="mt-2 truncate text-[10px] text-danger-700"
                      title={schedule.lastError}
                    >
                      Last run failed
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
                <BackupHistoryCard
                  canDownload={canDownload}
                  canRestore={canRestore}
                  canDelete={canDelete}
                  onOpenReport={() => setReportOpen(true)}
                />

                <aside className="flex flex-col gap-3">
                  <div className="rounded-xl border border-hairline bg-surface p-3.5 shadow-xs">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-heading">
                      <Info aria-hidden className="size-3.5 shrink-0 text-brand-strong" />
                      Backup Information
                    </p>

                    <div className="mt-3 flex flex-col gap-2.5">
                      <RailRow
                        icon={CalendarClock}
                        label="Last backup"
                        value={
                          latestBackup ? formatDate(latestBackup.createdAt) : "No backups yet"
                        }
                      />
                      <RailRow
                        icon={FileArchive}
                        label="Archive size on disk"
                        value={formatSize(archiveBytes)}
                      />
                      <RailRow
                        icon={DatabaseBackup}
                        label="Local archives"
                        value={`${localArchives.length} file${
                          localArchives.length === 1 ? "" : "s"
                        }`}
                      />
                      <RailRow
                        icon={CalendarClock}
                        label="Next scheduled backup"
                        value={
                          schedule?.enabled && schedule.nextRunAt
                            ? formatDate(schedule.nextRunAt)
                            : "Not scheduled"
                        }
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-brand-300 bg-brand-wash p-3.5">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-heading">
                      <Info aria-hidden className="size-3.5 shrink-0 text-brand-strong" />
                      Tip
                    </p>
                    <p className="mt-1.5 text-[11px] leading-snug text-subtle">
                      A backup stores the structure and records of your courses —
                      uploaded videos and PDFs are referenced by URL, not copied
                      into the archive.
                    </p>
                  </div>
                </aside>
              </div>
            </div>
          )}
        </div>
        <ScheduleModal
          open={scheduleOpen}
          onClose={() => setScheduleOpen(false)}
          schedule={schedule}
          canEdit={canCreate}
        />
        <ReportModal
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          totalKnown={listQuery.data?.total}
        />
      </motion.div>
    </DashboardLayout>
  );
}

function RailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        aria-hidden
        className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-tile bg-canvas text-subtle"
      >
        <Icon className="size-3" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-faint">{label}</p>
        <p className="truncate text-xs font-medium text-heading">{value}</p>
      </div>
    </div>
  );
}

function formatCountShort(value?: number) {
  return typeof value === "number" ? value.toLocaleString() : "—";
}

function formatDate(value?: string) {
  if (!value) return "No backup yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "No backup yet"
    : date.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatSize(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** exponent).toFixed(exponent ? 1 : 0)} ${units[exponent]}`;
}

function OverviewStat({
  icon: Icon,
  title,
  value,
  detail,
  meta,
  footer,
  tone,
}: {
  icon: LucideIcon;
  title: string;
  value: string;
  detail: string;
  /** Right-aligned figure (size / documents), as in the mockup. */
  meta?: { label: string; value: string };
  footer?: string;
  tone: "violet" | "orange" | "green";
}) {
  const styles = {
    violet: "bg-violet-100 text-violet-600",
    orange: "bg-orange-100 text-orange-600",
    green: "bg-emerald-100 text-emerald-600",
  };
  const accents = {
    violet: "before:bg-violet-500",
    orange: "before:bg-orange-500",
    green: "before:bg-emerald-500",
  };
  const isSuccess = value === "Success";
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-hairline bg-surface p-3.5 shadow-xs before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-[''] ${accents[tone]}`}
    >
      <div className="flex items-center gap-2.5">
        <span className={`flex size-8 items-center justify-center rounded-tile ${styles[tone]}`}>
          <Icon className="size-4" />
        </span>
        <p className="min-w-0 flex-1 truncate text-xs font-medium text-subtle">{title}</p>
        {isSuccess ? (
          <span className="shrink-0 rounded-full bg-success-50 px-2 py-0.5 text-[10px] font-semibold text-success-700">
            Success
          </span>
        ) : null}
      </div>

      <div className="mt-2.5 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-heading">
            {isSuccess ? detail : value}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-subtle">
            {isSuccess ? footer || detail : detail}
          </p>
        </div>
        {meta ? (
          <div className="shrink-0 text-right">
            <p className="text-[10px] uppercase tracking-wider text-faint">{meta.label}</p>
            <p className="text-xs font-semibold text-heading">{meta.value}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
