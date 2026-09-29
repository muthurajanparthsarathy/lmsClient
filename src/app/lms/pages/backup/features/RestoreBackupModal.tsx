"use client";

// Restore confirmation.
//
// Restoring writes archived documents back into the LIVE database, so the
// dialog leads with the danger, defaults to the two safe choices (dry run ON,
// mode "skip") and makes the destructive combination — overwrite, for real —
// something the admin has to choose twice. The per-collection report from the
// server is rendered in place afterwards so a dry run can be read and then
// repeated for real without losing context.

import * as React from "react";
import { AlertTriangle, History, Loader2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox, Modal, RadioGroup, RadioItem } from "@/app/lms/shared/ui";
import type {
  BackupRecord,
  RestoreMode,
  RestoreReport,
} from "@/app/lms/pages/backup/api/backup";
import {
  formatCount,
  formatDateTime,
  ReportPanel,
  scopeLabel,
  TD_CLASS,
  TH_CLASS,
} from "./ui";

const DRY_RUN_ID = "backup-restore-dry-run";

export interface RestoreBackupModalProps {
  open: boolean;
  record: BackupRecord | null;
  isPending: boolean;
  report: RestoreReport | null;
  onRun: (input: { mode: RestoreMode; dryRun: boolean }) => void;
  onClose: () => void;
}

export default function RestoreBackupModal({
  open,
  record,
  isPending,
  report,
  onRun,
  onClose,
}: RestoreBackupModalProps) {
  const [mode, setMode] = React.useState<RestoreMode>("skip");
  const [dryRun, setDryRun] = React.useState(true);

  // Every open starts from the safe defaults — a previous run's choices must
  // not carry into the next backup the admin clicks.
  React.useEffect(() => {
    if (open) {
      setMode("skip");
      setDryRun(true);
    }
  }, [open, record?._id]);

  const isDestructive = !dryRun && mode === "overwrite";

  // The footer buttons already disable while a restore is in flight, but the
  // server writes synchronously (backupController.js awaits the whole
  // restore before responding) — Escape or an overlay click otherwise still
  // dismisses the dialog through Modal's onOpenChange while the live
  // database is still being rewritten underneath it. hideClose additionally
  // drops the header's X for the same reason.
  const blockDismiss = isPending ? () => {} : onClose;

  return (
    <Modal
      open={open}
      onClose={blockDismiss}
      hideClose={isPending}
      size="lg"
      title="Restore backup"
      description={
        record
          ? `${scopeLabel(record.scope)} · ${record.targetName || "—"} · ${formatDateTime(
              record.createdAt
            )}`
          : undefined
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            {report && !report.dryRun ? "Close" : "Cancel"}
          </Button>
          <Button
            variant={isDestructive ? "destructive" : "default"}
            onClick={() => onRun({ mode, dryRun })}
            disabled={isPending || !record}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {dryRun ? "Simulating…" : "Restoring…"}
              </>
            ) : (
              <>
                {dryRun ? (
                  <History className="h-4 w-4" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                {dryRun ? "Run dry run" : "Restore for real"}
              </>
            )}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Danger notice — first thing read, and it changes with the choices. */}
        <div className="flex items-start gap-3 rounded-tile border border-danger-500/25 bg-danger-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-danger-700" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-danger-700">
              This writes archived data back into the live database.
            </p>
            <p className="mt-1 text-xs leading-relaxed text-danger-700/90">
              {dryRun
                ? "A dry run changes nothing — it reports exactly what a real restore would insert, update and skip."
                : mode === "overwrite"
                  ? "Overwrite mode REPLACES matching live documents with the archived versions. Current values are lost and this cannot be undone."
                  : "Skip mode leaves every existing document untouched and only inserts what is missing."}
            </p>
            {record?.destination === "db" ? (
              <p className="mt-1.5 text-xs leading-relaxed text-danger-700/90">
                Read from the backup database
                {record.targetDatabase ? ` "${record.targetDatabase}"` : ""}. That
                database accumulates across runs, so a restore can bring back
                documents deleted since — including older copies of records that
                now exist with a different id.
              </p>
            ) : null}
          </div>
        </div>

        {/* Mode */}
        <div>
          <p className="mb-2 text-sm font-medium text-body">
            When a document already exists
          </p>
          <RadioGroup
            value={mode}
            onChange={(next) => setMode(next as RestoreMode)}
            disabled={isPending}
          >
            <RadioItem
              value="skip"
              label="Skip existing (recommended)"
              description="Insert only the documents that are missing. Nothing already in the database is touched."
            />
            <RadioItem
              value="overwrite"
              label="Overwrite existing"
              description="Replace matching live documents with the archived versions. Destructive and irreversible."
            />
          </RadioGroup>
        </div>

        {/* Dry run */}
        <div className="flex items-start gap-2.5">
          <Checkbox
            id={DRY_RUN_ID}
            checked={dryRun}
            onCheckedChange={(next) => setDryRun(next === true)}
            disabled={isPending}
            className="mt-0.5"
          />
          <label htmlFor={DRY_RUN_ID} className="min-w-0 cursor-pointer">
            <span className="block text-sm font-medium text-body">Dry run first</span>
            <span className="mt-0.5 block text-xs text-subtle">
              Report what would change without writing anything. Uncheck only once
              the numbers look right.
            </span>
          </label>
        </div>

        {/* Report */}
        {report ? (
          <ReportPanel
            title={report.dryRun ? "Dry run report" : "Restore report"}
            subtitle={
              <>
                {formatCount(report.totalInserted)} inserted ·{" "}
                {formatCount(report.totalUpdated)} updated ·{" "}
                {formatCount(report.totalSkipped)} skipped
                {report.totalFailed ? (
                  <>
                    {" · "}
                    <span className="font-medium text-danger-700">
                      {formatCount(report.totalFailed)} failed
                    </span>
                  </>
                ) : null}
              </>
            }
          >
            {report.collections.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-subtle">
                Nothing in this archive matched anything to restore.
              </p>
            ) : (
              <div className="max-h-64 overflow-x-auto overflow-y-auto">
                <table className="w-full min-w-[520px] border-collapse">
                  <thead>
                    <tr>
                      <th className={TH_CLASS}>Collection</th>
                      <th className={`${TH_CLASS} text-right`}>Matched</th>
                      <th className={`${TH_CLASS} text-right`}>Inserted</th>
                      <th className={`${TH_CLASS} text-right`}>Updated</th>
                      <th className={`${TH_CLASS} text-right`}>Skipped</th>
                      <th className={`${TH_CLASS} text-right`}>Failed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.collections.map((row) => (
                      <tr
                        key={row.collection}
                        className="border-b border-hairline last:border-b-0"
                        title={
                          row.failures?.length
                            ? row.failures.map((f) => f.message).join("\n")
                            : undefined
                        }
                      >
                        <td className={TD_CLASS}>{row.collection}</td>
                        <td className={`${TD_CLASS} text-right tabular-nums`}>
                          {formatCount(row.matched)}
                        </td>
                        <td className={`${TD_CLASS} text-right tabular-nums`}>
                          {formatCount(row.inserted)}
                        </td>
                        <td className={`${TD_CLASS} text-right tabular-nums`}>
                          {formatCount(row.updated)}
                        </td>
                        <td className={`${TD_CLASS} text-right tabular-nums`}>
                          {formatCount(row.skipped)}
                        </td>
                        <td
                          className={`${TD_CLASS} text-right tabular-nums ${
                            row.failed ? "font-medium text-danger-700" : ""
                          }`}
                        >
                          {formatCount(row.failed || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {report.dryRun ? (
              <p className="border-t border-hairline px-4 py-2.5 text-xs text-subtle">
                Nothing was written. Uncheck “Dry run first” and run again to apply
                these changes.
              </p>
            ) : null}
          </ReportPanel>
        ) : null}
      </div>
    </Modal>
  );
}
