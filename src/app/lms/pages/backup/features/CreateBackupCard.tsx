"use client";

// "Backup Now" — one form, then a review modal that also runs the backup.
//
//   The form   what to capture, the one filter that scope needs, where it goes
//   The modal  the counts-only PREVIEW, and — from the same dialog — the run
//              itself and its result
//
// It used to be a four-step wizard. Selecting a type and choosing a
// destination are two halves of one decision and never justified a page turn
// between them, and the two steps that DID matter — seeing the real counts,
// and watching the run — are exactly the ones worth interrupting for. So the
// choices live on one page and the modal carries review → run → result.
//
// Every control maps 1:1 onto something the server supports: the type dropdown
// is the five scopes in the API contract, and the filter is whichever target
// that scope requires. Nothing is rendered that would not change the request —
// a filter that looks live but is ignored is worse than no filter.
//
// The preview is cleared the moment any input changes, and opening the modal
// re-runs it, because a stale count beside a changed scope is worse than none.

import * as React from "react";
import {
  AlertTriangle,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Database,
  DatabaseBackup,
  FileArchive,
  FileText,
  HardDriveDownload,
  Info,
  Layers,
  List,
  Loader2,
  Lightbulb,
  RefreshCcw,
  Server,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/app/lms/shared/ui";
import RichSelect, { type RichOption } from "./RichSelect";
import { showErrorToast, showSuccessToast } from "@/components/ui/toastUtils";
import { cn } from "@/lib/utils";
import type {
  BackupDestination,
  BackupRecord,
  BackupScope,
} from "@/app/lms/pages/backup/api/backup";
import {
  useBackupListQuery,
  useBackupTargetsQuery,
  useCreateBackupMutation,
  usePreviewBackupMutation,
} from "@/app/lms/pages/backup/queries/backup";
import {
  formatBytes,
  formatCount,
  formatDateTime,
  SCOPE_OPTIONS,
  scopeOption,
} from "./ui";

// Compact table cells for the review preview. The shared TH_CLASS/TD_CLASS in
// ./ui are h-11/h-12 — right for the main listing tables, far too tall for a
// 40-row count breakdown that has to fit inside a dialog.
const TH_COMPACT =
  "h-8 bg-canvas border-b border-hairline px-3 text-left align-middle text-[10px] font-semibold uppercase tracking-wider text-subtle";
const TD_COMPACT = "h-8 px-3 align-middle text-[11px] text-body";

/** How long a completed run stays on screen before the dialog closes itself. */
const AUTO_CLOSE_MS = 5000;

/* ── Destinations ────────────────────────────────────────────────────────── */

const DESTINATIONS: {
  value: BackupDestination;
  label: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    value: "local",
    label: "Local file",
    description: "Writes a .zip archive you can download from the history list.",
    icon: HardDriveDownload,
  },
  {
    value: "db",
    label: "Backup database",
    description: "Copies the documents into the separate backup database.",
    icon: Server,
  },
];

/**
 * What each scope actually captures, for the "What will be included?" rail.
 * Deliberately derived from the real selection rules in
 * server/utils/backupScopes.js — this panel is read by someone deciding
 * whether a backup is safe to rely on, so it must not overstate.
 */
const INCLUDED_BY_SCOPE: Record<BackupScope, { label: string; detail: string }[]> = {
  client: [
    { label: "Client record", detail: "Profile, contacts and configuration" },
    { label: "Service mappings", detail: "Every engagement mapped to this client" },
  ],
  users: [
    { label: "User accounts", detail: "Profiles, roles and stored permissions" },
    {
      label: "Embedded progress",
      detail: "Course progress and final answers held on each user document",
    },
  ],
  course: [
    { label: "Course record", detail: "Structure, batches and participant roster" },
    { label: "Content tree", detail: "Modules, submodules, topics, subtopics and pedagogy" },
    { label: "I Do / We Do / You Do", detail: "Resources, assignments, assessments and their questions" },
    { label: "Assessment data", detail: "Exam sessions, responses, violations and drafts" },
    { label: "Learner data", detail: "Attendance, feedback, grades and workspaces" },
  ],
  "client-full": [
    { label: "Client record", detail: "Profile, contacts and service mappings" },
    { label: "Users", detail: "Everyone linked to the client, including course rosters" },
    { label: "All courses", detail: "Each course expanded completely, as above" },
    { label: "Holiday calendar", detail: "The client's own calendar overrides" },
  ],
  institution: [
    { label: "Everything", detail: "All clients, users, courses and roles" },
    { label: "Master data", detail: "Question banks, degrees, pedagogy and settings" },
    { label: "Assessment data", detail: "Every session, response and submission" },
  ],
};

const errorText = (error: unknown, fallback: string): string => {
  const message = (error as Error | null)?.message;
  return message && message.trim() ? message : fallback;
};

/* ── Presentational pieces ───────────────────────────────────────────────── */

function DestinationCard({
  selected,
  onSelect,
  disabled,
  icon: Icon,
  label,
  description,
}: {
  selected: boolean;
  onSelect: () => void;
  disabled: boolean;
  icon: LucideIcon;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "relative flex h-full w-full items-start gap-2.5 rounded-tile border p-3 text-left transition-colors duration-150 ease-standard",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/30",
        selected
          ? "border-accent-500 bg-accent-50"
          : "border-hairline-strong bg-surface hover:border-line-hover hover:bg-row-hover",
        disabled && "cursor-not-allowed opacity-50 hover:border-hairline-strong hover:bg-surface"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-tile transition-colors",
          selected ? "bg-accent-600 text-white" : "bg-accent-50 text-accent-600"
        )}
      >
        <Icon className="size-4" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-heading">{label}</span>
        <span className="mt-0.5 block text-[11px] leading-snug text-subtle">
          {description}
        </span>
      </span>

      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border bg-surface transition-colors",
          selected ? "border-accent-600" : "border-line-muted"
        )}
      >
        {selected ? <span className="size-2 rounded-full bg-accent-600" /> : null}
      </span>
    </button>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="flex size-6 shrink-0 items-center justify-center rounded-tile bg-canvas text-subtle"
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

/* ── The card ────────────────────────────────────────────────────────────── */

export default function CreateBackupCard({ canCreate }: { canCreate: boolean }) {
  const [scope, setScope] = React.useState<BackupScope>("client-full");
  const [targetId, setTargetId] = React.useState<string>("");
  const [destination, setDestination] = React.useState<BackupDestination>("local");
  const [note, setNote] = React.useState<string>("");
  const [result, setResult] = React.useState<BackupRecord | null>(null);
  const [reviewOpen, setReviewOpen] = React.useState(false);

  const targetsQuery = useBackupTargetsQuery(canCreate);
  const previewMutation = usePreviewBackupMutation();
  const createMutation = useCreateBackupMutation();
  // Powers the sidebar's "Backup Information" from REAL history — never a
  // placeholder schedule or retention policy, neither of which exists yet.
  const historyQuery = useBackupListQuery(1, 5, canCreate);

  const option = scopeOption(scope);
  const targetKind = option?.target ?? null;
  const targetRequired = option?.targetRequired ?? false;

  const scopeOptions: RichOption[] = React.useMemo(
    () =>
      SCOPE_OPTIONS.map((item) => ({
        value: item.value,
        label: item.label,
        meta: item.recommended ? `${item.summary} · Recommended` : item.summary,
        icon: item.icon,
      })),
    []
  );

  // Second lines are REAL fields off the record — the client's own id and
  // status. Nothing here is a decorative stat: a count the screen cannot
  // actually source would be a lie sitting next to a backup button.
  const clientOptions: RichOption[] = React.useMemo(
    () =>
      (targetsQuery.data?.clients ?? []).map((client) => ({
        value: client._id,
        label: client.clientCompany,
        meta: [
          `Client ID: ${String(client._id).slice(-6).toUpperCase()}`,
          client.status,
        ]
          .filter(Boolean)
          .join("  ·  "),
        icon: Building2,
      })),
    [targetsQuery.data]
  );

  const courseOptions: RichOption[] = React.useMemo(
    () =>
      (targetsQuery.data?.courses ?? []).map((course) => ({
        value: course._id,
        label: course.courseName,
        meta: [course.courseCode, course.clientName].filter(Boolean).join("  ·  "),
        icon: Layers,
      })),
    [targetsQuery.data]
  );

  const targetOptions = targetKind === "course" ? courseOptions : clientOptions;
  const targetLabel = React.useMemo(
    () => targetOptions.find((item) => item.value === targetId)?.label ?? "",
    [targetOptions, targetId]
  );

  // Any change to what would be captured invalidates the counts on screen.
  const resetPreview = previewMutation.reset;
  const changeScope = (next: string) => {
    setScope(next as BackupScope);
    setTargetId("");
    resetPreview();
  };
  const changeTarget = (next: string) => {
    setTargetId(next);
    resetPreview();
  };
  const changeDestination = (next: BackupDestination) => {
    setDestination(next);
    resetPreview();
  };

  const missingTarget = targetRequired && !targetId;
  const preview = previewMutation.data;
  const isRunning = createMutation.isPending;

  const runPreview = React.useCallback(() => {
    previewMutation.mutate(
      { scope, ...(targetKind && targetId ? { targetId } : {}) },
      {
        onError: (error) =>
          showErrorToast(errorText(error, "Could not preview this backup")),
      }
    );
    // previewMutation is stable across renders in react-query v5.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, targetId, targetKind]);

  const openReview = () => {
    createMutation.reset();
    setResult(null);
    setReviewOpen(true);
    runPreview();
  };

  const closeReview = React.useCallback(() => {
    setReviewOpen(false);
    // Leave `result` intact: the form's footer keeps showing the outcome of the
    // last run after the dialog is gone.
    previewMutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runCreate = () => {
    createMutation.mutate(
      {
        scope,
        ...(targetKind && targetId ? { targetId } : {}),
        destination,
        ...(note.trim() ? { note: note.trim() } : {}),
      },
      {
        onSuccess: (record: BackupRecord) => {
          setResult(record);
          showSuccessToast(
            `Backup completed — ${formatCount(record.totalDocuments)} document${
              record.totalDocuments === 1 ? "" : "s"
            } captured.`
          );
        },
        onError: (error) => showErrorToast(errorText(error, "Backup failed")),
      }
    );
  };

  // Close the dialog on its own once a run has succeeded. Only a SUCCESS
  // auto-closes: a failure has to stay put, because its message is the only
  // place the reason is shown and yanking it away after five seconds would
  // lose it. Cleared on unmount and whenever the dialog is closed by hand, so
  // a timer can never fire against a dialog that is already gone.
  React.useEffect(() => {
    if (!reviewOpen || !result || isRunning) return;
    const timer = setTimeout(() => setReviewOpen(false), AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [reviewOpen, result, isRunning]);

  const backups = historyQuery.data?.items ?? [];
  const latest = backups[0];

  const canReview = canCreate && !missingTarget && !targetsQuery.isLoading;
  const canRun =
    canCreate && !isRunning && !!preview && preview.totalDocuments > 0 && !result;

  /* ── The form ──────────────────────────────────────────────────────────── */

  const FieldLabel = ({
    icon: Icon,
    children,
    required,
    hint,
  }: {
    icon?: LucideIcon;
    children: React.ReactNode;
    required?: boolean;
    hint?: string;
  }) => (
    <div className="mb-1.5 flex items-center gap-1.5">
      {Icon ? <Icon aria-hidden className="size-3.5 text-ink-400" /> : null}
      <span className="text-sm font-medium text-heading">{children}</span>
      {required ? <span className="text-danger-500">*</span> : null}
      {hint ? (
        <span title={hint}>
          <Info aria-hidden className="size-3.5 cursor-help text-ink-400" />
        </span>
      ) : null}
    </div>
  );

  const form = (
    <div className="flex flex-col gap-4">
      <div>
        <FieldLabel required hint="Determines how much of your data is captured.">
          Type
        </FieldLabel>
        <RichSelect
          value={scope}
          onChange={changeScope}
          options={scopeOptions}
          disabled={!canCreate}
          icon={Layers}
          placeholder="Select a backup type…"
        />
      </div>

      {targetKind ? (
        <div>
          <FieldLabel required={targetRequired} icon={Building2}>
            {targetKind === "course" ? "Course" : "Client"}
          </FieldLabel>
          <RichSelect
            value={targetId}
            onChange={changeTarget}
            options={targetOptions}
            searchable
            searchPlaceholder={
              targetKind === "course" ? "Search course…" : "Search client…"
            }
            emptyText={
              targetsQuery.isLoading
                ? "Loading…"
                : targetKind === "course"
                  ? "No courses found"
                  : "No clients found"
            }
            disabled={!canCreate || targetsQuery.isLoading}
            icon={targetKind === "course" ? Layers : Building2}
            placeholder={
              targetsQuery.isLoading
                ? "Loading…"
                : targetKind === "course"
                  ? "Select course"
                  : targetRequired
                    ? "Select client"
                    : "All users"
            }
            footer={
              <div className="flex items-start gap-2">
                <Info
                  aria-hidden
                  className="mt-0.5 size-3.5 shrink-0 text-accent-600"
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-accent-700">
                    Where should it go?
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-subtle">
                    Choose the destination below — a downloadable archive, or a
                    copy in the backup database.
                  </p>
                </div>
              </div>
            }
          />
          {!targetRequired ? (
            <p className="mt-1 text-[11px] text-subtle">
              Leave empty to back up every user in the institution.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="rounded-control border border-hairline bg-canvas px-3 py-2.5 text-xs text-subtle">
          This type has no filters — it captures everything in your institution.
        </p>
      )}

      {targetsQuery.isError ? (
        <p className="flex items-center gap-1.5 text-xs text-danger-700">
          <AlertTriangle className="size-3.5 shrink-0" />
          {errorText(targetsQuery.error, "Could not load clients and courses.")}
        </p>
      ) : null}

      <div>
        <FieldLabel icon={Database}>Where should it go?</FieldLabel>
        <div
          role="radiogroup"
          aria-label="Backup destination"
          className="grid gap-2 sm:grid-cols-2"
        >
          {DESTINATIONS.map((item) => (
            <DestinationCard
              key={item.value}
              selected={destination === item.value}
              onSelect={() => changeDestination(item.value)}
              disabled={!canCreate}
              icon={item.icon}
              label={item.label}
              description={item.description}
            />
          ))}
        </div>
      </div>

      <div>
        <FieldLabel icon={FileText}>Note</FieldLabel>
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          disabled={!canCreate}
          maxLength={200}
          placeholder="e.g. Before the Q3 course migration"
          className="h-11 w-full rounded-control border border-hairline-strong bg-surface px-3 text-sm text-body outline-none transition-colors placeholder:text-faint hover:border-line-hover focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 disabled:cursor-not-allowed disabled:bg-ink-50"
        />
        <p className="mt-1 text-[11px] text-subtle">
          Optional — why this backup was taken.
        </p>
      </div>
    </div>
  );


  const footerHint = !canCreate
    ? "You don't have permission to create backups."
    : missingTarget
      ? `Select a ${targetKind === "course" ? "course" : "client"} to continue.`
      : result
        ? `Last run captured ${formatCount(result.totalDocuments)} document${
            result.totalDocuments === 1 ? "" : "s"
          }.`
        : "Review runs a live count before anything is written.";

  /* ── Review dialog: preview → run → result ─────────────────────────────── */

  const summaryTiles = [
    { label: "Type", value: option?.label ?? scope },
    { label: "Target", value: targetLabel || preview?.targetName || "—" },
    {
      label: "Destination",
      value: destination === "local" ? "Local file" : "Backup database",
    },
    {
      label: "Documents",
      value: preview ? formatCount(preview.totalDocuments) : "—",
    },
  ];

  const reviewBody = (
    <div className="flex flex-col gap-3">
      <dl className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {summaryTiles.map((item) => (
          <div
            key={item.label}
            className="rounded-tile border border-hairline bg-canvas px-3 py-2"
          >
            <dt className="text-[10px] uppercase tracking-wider text-faint">
              {item.label}
            </dt>
            <dd className="mt-0.5 truncate text-xs font-medium text-heading">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>

      {previewMutation.isPending ? (
        <div className="flex items-center justify-center gap-2 rounded-tile border border-hairline bg-canvas py-8 text-xs text-subtle">
          <Loader2 className="size-3.5 animate-spin" />
          Counting documents…
        </div>
      ) : previewMutation.isError ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-tile border border-danger-500/25 bg-danger-50 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-xs text-danger-700">
            <AlertTriangle className="size-3.5 shrink-0" />
            {errorText(previewMutation.error, "Could not preview this backup")}
          </p>
          <Button variant="outline" size="sm" onClick={runPreview}>
            <RefreshCcw className="size-4" />
            Retry
          </Button>
        </div>
      ) : preview ? (
        <div className="overflow-hidden rounded-tile border border-hairline bg-canvas">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-subtle">
              Collections
            </p>
            <p className="text-[11px] text-subtle">
              {formatCount(preview.collections.length)} collection
              {preview.collections.length === 1 ? "" : "s"}
            </p>
          </div>

          {preview.collections.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-subtle">
              Nothing matches this selection — there is nothing to back up.
            </p>
          ) : (
            <div className="max-h-56 overflow-y-auto">
              <table className="w-full border-collapse">
                <thead className="sticky top-0">
                  <tr>
                    <th className={TH_COMPACT}>Collection</th>
                    <th className={`${TH_COMPACT} text-right`}>Documents</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.collections.map((row) => (
                    <tr
                      key={row.collection}
                      className="border-b border-hairline last:border-b-0"
                    >
                      <td className={TD_COMPACT}>{row.collection}</td>
                      <td className={`${TD_COMPACT} text-right tabular-nums`}>
                        {formatCount(row.count)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-surface">
                    <td className={`${TD_COMPACT} font-semibold text-heading`}>Total</td>
                    <td
                      className={`${TD_COMPACT} text-right font-semibold tabular-nums text-heading`}
                    >
                      {formatCount(preview.totalDocuments)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );

  const runBody = (
    <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
      {isRunning ? (
        <>
          <span className="flex size-11 items-center justify-center rounded-full bg-accent-50 text-accent-600">
            <Loader2 className="size-5 animate-spin" />
          </span>
          <div>
            <p className="text-sm font-semibold text-heading">Backing up…</p>
            <p className="mt-0.5 text-xs text-subtle">
              This can take a few minutes on a large scope. Keep this dialog open.
            </p>
          </div>
        </>
      ) : createMutation.isError ? (
        <>
          <span className="flex size-11 items-center justify-center rounded-full bg-danger-50 text-danger-700">
            <AlertTriangle className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-heading">Backup failed</p>
            <p className="mt-0.5 max-w-md text-xs text-danger-700">
              {errorText(createMutation.error, "Backup failed")}
            </p>
          </div>
          <Button size="sm" onClick={runCreate}>
            <RefreshCcw className="size-4" />
            Try again
          </Button>
        </>
      ) : result ? (
        <>
          <span className="flex size-11 items-center justify-center rounded-full bg-success-50 text-success-700">
            <Check className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-heading">Backup complete</p>
            <p className="mt-0.5 text-xs text-subtle">
              {formatCount(result.totalDocuments)} document
              {result.totalDocuments === 1 ? "" : "s"} captured
              {result.destination === "local"
                ? ` · ${formatBytes(result.sizeBytes)}`
                : result.targetDatabase
                  ? ` · copied to "${result.targetDatabase}"`
                  : ""}
              .
            </p>
          </div>
          <p className="rounded-tile border border-hairline bg-canvas px-3 py-2 text-[11px] text-subtle">
            {result.destination === "local"
              ? "Download it from the backup history on the overview page."
              : "The documents now live in the backup database."}
          </p>
          <p className="text-[11px] text-faint">Closing automatically…</p>
        </>
      ) : null}
    </div>
  );

  const showRunState = isRunning || createMutation.isError || !!result;

  const reviewModal = (
    <Modal
      open={reviewOpen}
      // A run in flight must not be dismissable: the request is synchronous on
      // the server, so closing the dialog would hide a write that is still
      // happening.
      onClose={isRunning ? () => {} : closeReview}
      hideClose={isRunning}
      size="lg"
      title={showRunState ? "Backup" : "Review your selection"}
      description={
        showRunState
          ? undefined
          : "These are live counts — exactly what will be written."
      }
      footer={
        <>
          <Button variant="outline" onClick={closeReview} disabled={isRunning}>
            {result ? "Close" : "Cancel"}
          </Button>
          {!result ? (
            <Button
              onClick={runCreate}
              disabled={!canRun}
              className="bg-accent-600 text-white hover:bg-accent-700"
            >
              {isRunning ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Backing up…
                </>
              ) : (
                <>
                  <DatabaseBackup className="size-4" />
                  Backup
                </>
              )}
            </Button>
          ) : null}
        </>
      }
    >
      {showRunState ? runBody : reviewBody}
    </Modal>
  );

  /* ── Layout: form + information rail ───────────────────────────────────── */

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_272px]">
      <div className="flex flex-col overflow-hidden rounded-xl border border-hairline bg-surface shadow-xs">
        <div className="p-4">{form}</div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline px-4 py-3">
          <p className="flex min-w-0 items-center gap-2 rounded-control border border-hairline bg-canvas px-3 py-2 text-[11px] text-subtle">
            <Info aria-hidden className="size-3.5 shrink-0 text-accent-600" />
            {footerHint}
          </p>
          <button
            type="button"
            onClick={openReview}
            disabled={!canReview}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-control bg-accent-600 px-4 text-sm font-medium text-white shadow-xs transition-colors hover:bg-accent-700 focus:outline-none focus:ring-2 focus:ring-accent-500/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileArchive aria-hidden className="size-4" />
            Review
            <ChevronRight aria-hidden className="size-4" />
          </button>
        </div>
      </div>

      {/* Information rail — the guidance panel tracks the type dropdown, so the
          instructions beside the form always describe the selected type. */}
      <aside className="flex flex-col gap-3">
        <div className="overflow-hidden rounded-xl border border-success-500/25 bg-surface shadow-xs">
          <div className="border-b border-success-500/20 bg-success-50 px-3.5 py-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-heading">
              <CheckCircle2
                aria-hidden
                className="size-4 shrink-0 text-success-700"
              />
              {option?.label ?? "Selected type"}
            </p>
            <p className="mt-1 text-[11px] leading-snug text-subtle">
              {option?.description}
            </p>
          </div>

          <div className="p-3.5">
            <p className="text-xs font-semibold text-heading">
              What will be included?
            </p>
            <ul className="mt-2 flex flex-col gap-2">
              {(INCLUDED_BY_SCOPE[scope] ?? []).map((item) => (
                <li key={item.label} className="flex items-start gap-2">
                  <Check
                    aria-hidden
                    className="mt-0.5 size-3.5 shrink-0 text-success-700"
                  />
                  <span className="min-w-0 text-[11px] leading-snug">
                    <span className="font-medium text-heading">{item.label}</span>
                    <span className="text-subtle"> — {item.detail}</span>
                  </span>
                </li>
              ))}
            </ul>

            {scope !== "institution" ? (
              <p className="mt-3 border-t border-hairline pt-2.5 text-[11px] leading-snug text-subtle">
                Institution-wide master data (question banks, degrees, settings)
                is only captured by{" "}
                <span className="font-medium">Entire institution</span>.
              </p>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-hairline bg-surface p-3.5 shadow-xs">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-heading">
            <Clock className="size-3.5 shrink-0 text-accent-600" aria-hidden />
            Backup Information
          </p>

          <div className="mt-3 flex flex-col gap-2.5">
            <InfoRow
              icon={Clock}
              label="Last backup"
              value={latest ? formatDateTime(latest.createdAt) : "No backups yet"}
            />
            <InfoRow
              icon={FileArchive}
              label="Last backup size"
              value={
                latest
                  ? latest.destination === "local"
                    ? formatBytes(latest.sizeBytes)
                    : `${formatCount(latest.totalDocuments)} documents`
                  : "—"
              }
            />
            <InfoRow
              icon={List}
              label="Total backups"
              value={formatCount(historyQuery.data?.total ?? 0)}
            />
          </div>
        </div>

        <div className="rounded-xl border border-accent-200 bg-accent-50 p-3.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-heading">
            <Lightbulb className="size-3.5 shrink-0 text-accent-600" aria-hidden />
            Tip
          </p>
          <p className="mt-1.5 text-[11px] leading-snug text-subtle">
            Review runs a live count first, so you see exactly what will be captured
            before anything is written.
          </p>
        </div>
      </aside>

      {reviewModal}
    </div>
  );
}
