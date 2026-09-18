"use client";

// Backup schedule configuration.
//
// The card this opens from used to be a hardcoded "Daily · 02:00 AM" with no
// scheduler behind it. Everything here is now real: the server stores one
// schedule per institution and cron/backupScheduler.js runs it.
//
// The extra field per frequency (weekday for weekly, day-of-month for monthly)
// is only rendered for the frequency that reads it — a day-of-month picker
// beside "Daily" implies the value matters when the server ignores it.

import * as React from "react";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Clock,
  Loader2,
  Power,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/app/lms/shared/ui";
import { showErrorToast, showSuccessToast } from "@/components/ui/toastUtils";
import { cn } from "@/lib/utils";
import type {
  BackupDestination,
  BackupFrequency,
  BackupSchedule,
  BackupScope,
} from "@/app/lms/pages/backup/api/backup";
import { useSaveBackupScheduleMutation } from "@/app/lms/pages/backup/queries/backup";
import { formatDateTime, SCOPE_OPTIONS } from "./ui";

const FREQUENCIES: { value: BackupFrequency; label: string; detail: string }[] = [
  { value: "daily", label: "Daily", detail: "Every day at the chosen time" },
  { value: "every2days", label: "Every 2 days", detail: "Two days after each run" },
  { value: "weekly", label: "Weekly", detail: "One chosen weekday" },
  { value: "monthly", label: "Monthly", detail: "One chosen day each month" },
];

const DESTINATION_OPTIONS: { value: BackupDestination; label: string }[] = [
  { value: "local", label: "Local file" },
  { value: "db", label: "Backup database" },
];

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const errorText = (error: unknown, fallback: string): string => {
  const message = (error as Error | null)?.message;
  return message && message.trim() ? message : fallback;
};

export interface ScheduleModalProps {
  open: boolean;
  onClose: () => void;
  schedule: BackupSchedule | undefined;
  canEdit: boolean;
}

export default function ScheduleModal({
  open,
  onClose,
  schedule,
  canEdit,
}: ScheduleModalProps) {
  const save = useSaveBackupScheduleMutation();

  const [enabled, setEnabled] = React.useState(false);
  const [frequency, setFrequency] = React.useState<BackupFrequency>("daily");
  const [time, setTime] = React.useState("02:00");
  const [dayOfWeek, setDayOfWeek] = React.useState(1);
  const [dayOfMonth, setDayOfMonth] = React.useState(1);
  const [scope, setScope] = React.useState<BackupScope>("institution");
  const [destinations, setDestinations] = React.useState<BackupDestination[]>(["local"]);

  // Re-seed from the server every time the dialog opens, so a cancelled edit
  // never leaks into the next one.
  React.useEffect(() => {
    if (!open || !schedule) return;
    setEnabled(schedule.enabled);
    setFrequency(schedule.frequency);
    setTime(schedule.time);
    setDayOfWeek(schedule.dayOfWeek);
    setDayOfMonth(schedule.dayOfMonth);
    setScope(schedule.scope);
    // Tolerates a schedule saved before this became a list.
    setDestinations(
      schedule.destinations?.length ? schedule.destinations : [schedule.destination || "local"]
    );
  }, [open, schedule]);

  // Only the scopes that need no target can be scheduled from here: a
  // client/course scope would need a picker AND would silently break the night
  // its target is deleted.
  const scheduleableScopes = React.useMemo(
    () => SCOPE_OPTIONS.filter((item) => !item.targetRequired),
    []
  );

  const toggleDestination = (value: BackupDestination) =>
    setDestinations((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    );

  const submit = () => {
    save.mutate(
      { enabled, frequency, time, dayOfWeek, dayOfMonth, scope, destinations },
      {
        onSuccess: (next) => {
          showSuccessToast(
            next.enabled ? `Schedule saved — ${next.summary}` : "Schedule turned off"
          );
          onClose();
        },
        onError: (error) =>
          showErrorToast(errorText(error, "Could not save the schedule")),
      }
    );
  };

  return (
    <Modal
      open={open}
      onClose={save.isPending ? () => {} : onClose}
      hideClose={save.isPending}
      size="lg"
      title="Backup schedule"
      description="Run a backup automatically, on a cadence you choose."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!canEdit || save.isPending || (enabled && destinations.length === 0)}
            className="bg-accent-600 text-white hover:bg-accent-700"
          >
            {save.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <CalendarClock className="size-4" />
                Save schedule
              </>
            )}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* On/off */}
        <button
          type="button"
          onClick={() => setEnabled((value) => !value)}
          disabled={!canEdit}
          className={cn(
            "flex items-center justify-between gap-3 rounded-tile border px-3 py-2.5 text-left transition-colors",
            enabled
              ? "border-success-500/30 bg-success-50"
              : "border-hairline-strong bg-surface",
            !canEdit && "cursor-not-allowed opacity-60"
          )}
        >
          <span className="flex items-center gap-2.5">
            <span
              aria-hidden
              className={cn(
                "flex size-8 items-center justify-center rounded-tile",
                enabled ? "bg-success-500/15 text-success-700" : "bg-ink-100 text-ink-400"
              )}
            >
              <Power className="size-4" />
            </span>
            <span>
              <span className="block text-sm font-medium text-heading">
                {enabled ? "Scheduled backups are on" : "Scheduled backups are off"}
              </span>
              <span className="block text-[11px] text-subtle">
                {enabled
                  ? "The server runs this automatically."
                  : "Nothing runs automatically until this is on."}
              </span>
            </span>
          </span>
          <span
            aria-hidden
            className={cn(
              "relative h-5 w-9 shrink-0 rounded-full transition-colors",
              enabled ? "bg-success-500" : "bg-ink-300"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 size-4 rounded-full bg-white transition-all",
                enabled ? "left-[18px]" : "left-0.5"
              )}
            />
          </span>
        </button>

        {/* Frequency */}
        <div>
          <p className="mb-1.5 text-sm font-medium text-heading">How often</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {FREQUENCIES.map((item) => (
              <button
                key={item.value}
                type="button"
                role="radio"
                aria-checked={frequency === item.value}
                disabled={!canEdit}
                onClick={() => setFrequency(item.value)}
                className={cn(
                  "rounded-tile border px-3 py-2 text-left transition-colors",
                  frequency === item.value
                    ? "border-accent-500 bg-accent-50"
                    : "border-hairline-strong bg-surface hover:border-line-hover",
                  !canEdit && "cursor-not-allowed opacity-60"
                )}
              >
                <span className="block text-sm font-medium text-heading">
                  {item.label}
                </span>
                <span className="block text-[11px] text-subtle">{item.detail}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Time + the one extra field this frequency actually reads */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-heading">
              <Clock aria-hidden className="size-3.5 text-ink-400" />
              Time
            </p>
            <input
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              disabled={!canEdit}
              className="h-10 w-full rounded-control border border-hairline-strong bg-surface px-3 text-sm text-body outline-none transition-colors focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 disabled:cursor-not-allowed disabled:bg-ink-50"
            />
            <p className="mt-1 text-[11px] text-subtle">Server time, 24-hour.</p>
          </div>

          {frequency === "weekly" ? (
            <div>
              <p className="mb-1.5 text-sm font-medium text-heading">Day of week</p>
              <select
                value={dayOfWeek}
                onChange={(event) => setDayOfWeek(Number(event.target.value))}
                disabled={!canEdit}
                className="h-10 w-full rounded-control border border-hairline-strong bg-surface px-3 text-sm text-body outline-none transition-colors focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 disabled:cursor-not-allowed disabled:bg-ink-50"
              >
                {WEEKDAYS.map((day, index) => (
                  <option key={day} value={index}>
                    {day}
                  </option>
                ))}
              </select>
            </div>
          ) : frequency === "monthly" ? (
            <div>
              <p className="mb-1.5 text-sm font-medium text-heading">Day of month</p>
              <select
                value={dayOfMonth}
                onChange={(event) => setDayOfMonth(Number(event.target.value))}
                disabled={!canEdit}
                className="h-10 w-full rounded-control border border-hairline-strong bg-surface px-3 text-sm text-body outline-none transition-colors focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 disabled:cursor-not-allowed disabled:bg-ink-50"
              >
                {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-subtle">
                29–31 fall back to the month&apos;s last day.
              </p>
            </div>
          ) : null}
        </div>

        {/* What to back up */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-sm font-medium text-heading">What to back up</p>
            <select
              value={scope}
              onChange={(event) => setScope(event.target.value as BackupScope)}
              disabled={!canEdit}
              className="h-10 w-full rounded-control border border-hairline-strong bg-surface px-3 text-sm text-body outline-none transition-colors focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 disabled:cursor-not-allowed disabled:bg-ink-50"
            >
              {scheduleableScopes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-subtle">
              Only scopes that need no target can run unattended.
            </p>
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-heading">Where it goes</p>
            {/* Checkboxes, not a select: a schedule can write BOTH a local
                .zip and a copy in the backup database, and each destination
                produces its own backup record. */}
            <div className="flex flex-col gap-1.5">
              {DESTINATION_OPTIONS.map((item) => {
                const isOn = destinations.includes(item.value);
                return (
                  <button
                    key={item.value}
                    type="button"
                    role="checkbox"
                    aria-checked={isOn}
                    disabled={!canEdit}
                    onClick={() => toggleDestination(item.value)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-control border px-3 py-2 text-left transition-colors",
                      isOn
                        ? "border-accent-500 bg-accent-50"
                        : "border-hairline-strong bg-surface hover:border-line-hover",
                      !canEdit && "cursor-not-allowed opacity-60"
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
                        isOn
                          ? "border-accent-600 bg-accent-600 text-white"
                          : "border-line-muted"
                      )}
                    >
                      {isOn ? <Check className="size-3" /> : null}
                    </span>
                    <span className="text-sm text-heading">{item.label}</span>
                  </button>
                );
              })}
            </div>
            {destinations.length === 0 ? (
              <p className="mt-1 text-[11px] text-danger-700">
                Choose at least one destination.
              </p>
            ) : destinations.length > 1 ? (
              <p className="mt-1 text-[11px] text-subtle">
                Each run writes both, as two separate backups.
              </p>
            ) : null}
          </div>
        </div>

        {/* Status of the last automatic run — the only place a silent 2am
            failure ever becomes visible. */}
        {schedule && schedule.lastStatus !== "never" ? (
          <div
            className={cn(
              "rounded-tile border px-3 py-2.5",
              schedule.lastStatus === "failed"
                ? "border-danger-500/25 bg-danger-50"
                : "border-hairline bg-canvas"
            )}
          >
            <p className="flex items-center gap-1.5 text-xs font-medium text-heading">
              {schedule.lastStatus === "failed" ? (
                <AlertTriangle aria-hidden className="size-3.5 text-danger-700" />
              ) : null}
              Last automatic run
              {schedule.lastRunAt ? ` · ${formatDateTime(schedule.lastRunAt)}` : ""}
            </p>
            <p
              className={cn(
                "mt-0.5 text-[11px]",
                schedule.lastStatus === "failed" ? "text-danger-700" : "text-subtle"
              )}
            >
              {schedule.lastStatus === "failed"
                ? schedule.lastError || "Failed"
                : "Completed successfully."}
            </p>
          </div>
        ) : null}

        {schedule?.nextRunAt && enabled ? (
          <p className="text-[11px] text-subtle">
            Next run: <span className="font-medium text-heading">
              {formatDateTime(schedule.nextRunAt)}
            </span>{" "}
            — saving recalculates this from the settings above.
          </p>
        ) : null}

        {!canEdit ? (
          <p className="text-[11px] text-danger-700">
            You don&apos;t have permission to change the schedule.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
