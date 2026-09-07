'use client';

/**
 * Assessment Details — a READ-ONLY view of everything the wizard configured.
 *
 * Opened from the "Assessment Details" card on the authoring rail. That card
 * used to reopen the eight-step wizard, which is a heavy way to answer "when
 * does this run and what is it worth" — and it puts a form in front of someone
 * who only wanted to look. The wizard is still one click away, from the footer.
 *
 * Two rules shape what appears here:
 *
 *  1. Nothing is stored. Every figure is derived from the assessment document
 *     and the questions actually written (via `quota.ts`), so this panel can
 *     never drift from the list it describes.
 *
 *  2. Only what is SET is shown. The security group alone has seventeen
 *     toggles; rendering them all would bury the three that are on in fourteen
 *     rows of "No". Toggle groups collapse to chips of what is enabled, and a
 *     section with nothing to say does not render at all.
 */

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, FileText, CalendarClock, Hash, ShieldCheck, Bell, GraduationCap,
  Users, Settings2, Pencil, Clock,
} from 'lucide-react';
import { D } from './wizard/ui';
import type { ExternalAssessment, ExternalQuestion } from '@/apiServices/externalAssessment';
import { questionProgress } from './questions/quota';

// ── Formatting ─────────────────────────────────────────────────────────────

const DASH = '—';

/** A date+time, or DASH. Accepts the computed `startAt` ISO or a raw date part. */
function fmtDateTime(value?: string | null): string {
  if (!value) return DASH;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** Date only — used when the time half is shown in its own field. */
function fmtDate(value?: string | null): string {
  if (!value) return DASH;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

/** 90 to "1h 30m". Minutes are what the wizard stores; hours are what people read. */
function fmtDuration(mins?: number): string {
  const m = Number(mins || 0);
  if (!m) return DASH;
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r}m`;
  return r ? `${h}h ${r}m` : `${h}h`;
}

const titleCase = (s?: string) =>
  !s ? DASH : s.charAt(0).toUpperCase() + s.slice(1).replace(/([a-z])([A-Z])/g, '$1 $2');

const SOURCE_LABELS: Record<string, string> = {
  scratch: 'Manual',
  ai: 'AI Automation',
  thirdParty: 'Other Platform',
  bank: 'Question Bank',
  document: 'Document Import',
};

const EVAL_LABELS: Record<string, string> = {
  manual: 'Manual review',
  testcase: 'Test cases',
  ai: 'AI evaluation',
};

// Toggle to the phrase shown when it is ON. Absent keys are never surfaced.
const SECURITY_LABELS: Record<string, string> = {
  preventTabSwitch: 'Prevent tab switching',
  preventCopyPaste: 'Prevent copy / paste',
  preventBrowserClose: 'Prevent closing the browser',
  enableFaceVerification: 'Face verification',
  multipleFaceDetection: 'Multiple-face detection',
  recordScreen: 'Screen recording',
  autoSubmitOnTimeout: 'Auto-submit on timeout',
  warnBeforeTimeout: 'Warn before timeout',
  requireFullscreen: 'Require fullscreen',
  preventDevTools: 'Block developer tools',
  preventRightClick: 'Block right-click',
  preventPrinting: 'Block printing',
  preventPageRefresh: 'Block page refresh',
  preventBackNavigation: 'Block back navigation',
};

const NOTIFY_LABELS: Record<string, string> = {
  notifyOnInvite: 'On invitation',
  notifyBeforeStart: 'Before it starts',
  notifyOnSubmission: 'On submission',
  notifyOnResult: 'On result',
};

/**
 * Where the assessment sits against its own window, right now.
 *
 * The same three verdicts the participant gate serves
 * (`utils/external/assessmentAccess.js`), so what an admin reads here is what a
 * participant would hit on the link.
 */
function windowState(a: ExternalAssessment): { label: string; tone: string; bg: string } {
  const now = Date.now();
  const start = a.startAt ? new Date(a.startAt).getTime() : NaN;
  const end = a.endAt ? new Date(a.endAt).getTime() : NaN;

  if (Number.isNaN(start) && Number.isNaN(end)) {
    return { label: 'Not scheduled', tone: D.textMuted, bg: D.surface };
  }
  if (!Number.isNaN(end) && now > end) {
    return { label: 'Expired', tone: D.red, bg: 'rgba(239,68,68,0.10)' };
  }
  if (!Number.isNaN(start) && now < start) {
    return { label: 'Not started', tone: D.amber, bg: 'rgba(245,158,11,0.12)' };
  }
  return { label: 'Available now', tone: D.emerald, bg: 'rgba(16,185,129,0.12)' };
}

// ── Building blocks ────────────────────────────────────────────────────────

function Section({
  icon, title, children,
}: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-1.5 mb-2">
        <span style={{ color: D.orange }}>{icon}</span>
        <h4 className="text-[12.5px] font-bold" style={{ color: D.textMain }}>{title}</h4>
      </div>
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: D.border2 }}>
        {children}
      </div>
    </section>
  );
}

/** One label/value line. `full` spans both grid columns for long text. */
function Field({
  label, value, tone, full,
}: { label: string; value: React.ReactNode; tone?: string; full?: boolean }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 px-3 py-2 ${full ? 'sm:col-span-2' : ''}`}
      style={{ borderTop: `1px solid ${D.border}` }}
    >
      <span className="text-[11.5px] shrink-0" style={{ color: D.textMuted }}>{label}</span>
      <span
        className="text-[12.5px] font-semibold text-right break-words"
        style={{ color: tone || D.textMain }}
      >
        {value ?? DASH}
      </span>
    </div>
  );
}

/** A two-column field grid. The border-top on each Field draws the rules. */
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2">{children}</div>;
}

/** Enabled toggles, as chips. Renders nothing when none are on. */
function Chips({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 px-3 py-2.5" style={{ borderTop: `1px solid ${D.border}` }}>
      {items.map((t) => (
        <span
          key={t}
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{ background: D.orangeLight, color: D.orangeDark }}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

/**
 * Keys of `obj` that are truthy, mapped through `labels`.
 *
 * Generic over the settings interface rather than taking a Record: the settings
 * groups are plain interfaces with no index signature, so they do not satisfy
 * `Record<string, unknown>` on the way in. The widening happens inside, where
 * the key set is known to come from `labels`.
 */
function enabledLabels<T extends object>(
  obj: T | null | undefined,
  labels: Record<string, string>,
): string[] {
  if (!obj) return [];
  const bag = obj as Record<string, unknown>;
  return Object.keys(labels).filter((k) => !!bag[k]).map((k) => labels[k]);
}

// ── The modal ──────────────────────────────────────────────────────────────

export default function AssessmentDetailsModal({
  open, assessment, questions = [], onClose, onEdit,
}: {
  open: boolean;
  assessment: ExternalAssessment;
  questions?: ExternalQuestion[];
  onClose: () => void;
  /** Opens the wizard. Omitted when the viewer may not edit. */
  onEdit?: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Escape closes, as it does on every other modal in this feature.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const a = assessment;
  const p = questionProgress(a, questions);
  const win = windowState(a);
  const isCombined = a.exerciseType === 'Combined';

  const sec = a.securitySettings;
  const notif = a.notificationSettings;
  const grade = a.gradeSettings;
  const extras = a.scheduleExtras;
  const qc = a.questionConfiguration;

  const securityOn = enabledLabels(sec, SECURITY_LABELS);
  const notifyOn = enabledLabels(notif, NOTIFY_LABELS);
  const sources = (a.questionSources || []).map((s) => SOURCE_LABELS[s] || s);
  const aiCriteria = a.evaluationMethod?.ai?.criteria || [];
  const bands = grade?.gradeBandsEnabled ? (grade.gradeBands || []) : [];

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
        style={{ background: 'rgba(30,41,59,0.55)', backdropFilter: 'blur(6px)' }}
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 8 }}
          transition={{ duration: 0.18 }}
          className="w-full max-w-3xl bg-white overflow-hidden flex flex-col"
          style={{ maxHeight: '92vh', borderRadius: 20, boxShadow: '0 24px 64px rgba(0,0,0,0.28)' }}
          role="dialog"
          aria-modal="true"
          aria-label="Assessment details"
        >
          {/* ── Header ── */}
          <div
            className="flex items-start gap-3 px-5 py-4 shrink-0"
            style={{ borderBottom: `1px solid ${D.border2}` }}
          >
            <span
              className="flex size-9 items-center justify-center rounded-xl shrink-0"
              style={{ background: D.orangeLight, color: D.orange }}
            >
              <FileText size={17} />
            </span>
            <div className="flex-1 min-w-0">
              <h2 className="text-[15px] font-extrabold truncate" style={{ color: D.textMain }}>
                {a.assessmentName || 'Untitled assessment'}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {a.assessmentCode && (
                  <span
                    className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums"
                    style={{ background: D.surface, color: D.textSub }}
                  >
                    {a.assessmentCode}
                  </span>
                )}
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold"
                  style={{ background: win.bg, color: win.tone }}
                >
                  {win.label}
                </span>
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                  style={{ background: D.surface, color: D.textMuted }}
                >
                  {titleCase(a.status)}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex size-8 items-center justify-center rounded-lg shrink-0 transition-colors hover:bg-slate-100"
              style={{ color: D.textMuted }}
            >
              <X size={16} />
            </button>
          </div>

          {/* ── Body ── */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* Basic details */}
            <Section icon={<FileText size={13} />} title="Basic Details">
              <Grid>
                <Field label="Assessment ID" value={a.assessmentCode || DASH} />
                <Field label="Test type" value={titleCase(a.testType)} />
                <Field label="Exercise type" value={a.exerciseType || DASH} />
                <Field label="Level" value={titleCase(a.exerciseLevel)} />
                {a.selectedModule && <Field label="Module" value={a.selectedModule} />}
                {!!a.selectedLanguages?.length && (
                  <Field label="Languages" value={a.selectedLanguages.join(', ')} />
                )}
                {a.description && <Field label="Description" value={a.description} full />}
                {a.instructions && <Field label="Instructions" value={a.instructions} full />}
              </Grid>
            </Section>

            {/* Schedule — the reason most people open this panel */}
            <Section icon={<CalendarClock size={13} />} title="Schedule">
              <Grid>
                <Field label="Start date" value={fmtDate(a.startDate)} />
                <Field label="Start time" value={a.startTime || DASH} />
                <Field label="End date" value={fmtDate(a.endDate)} />
                <Field label="End time" value={a.endTime || DASH} />
                <Field label="Starts at" value={fmtDateTime(a.startAt)} full />
                <Field label="Ends at" value={fmtDateTime(a.endAt)} full />
                <Field label="Duration" value={fmtDuration(a.durationMinutes)} />
                <Field label="Window" value={win.label} tone={win.tone} />
                {extras?.cutOffEnabled && (
                  <Field
                    label="Cut-off"
                    value={`${fmtDate(extras.cutOffDate)}${extras.cutOffTime ? ` · ${extras.cutOffTime}` : ''}`}
                  />
                )}
                {extras?.gracePeriodEnabled && (
                  <Field label="Grace period" value={`${extras.gracePeriodMinutes || 0} min`} />
                )}
              </Grid>
            </Section>

            {/* Questions & marks */}
            <Section icon={<Hash size={13} />} title="Questions & Marks">
              <Grid>
                <Field label="Total questions" value={p.total} />
                <Field
                  label="Created"
                  value={<>{p.created}<span style={{ color: D.textHint }}>/{p.total}</span></>}
                  tone={p.remaining === 0 ? D.emerald : D.textMain}
                />
                <Field label="Total marks" value={p.marks.total} />
                <Field
                  label="Marks used"
                  value={<>{p.marks.used}<span style={{ color: D.textHint }}>/{p.marks.total}</span></>}
                  tone={p.marks.remaining < 0 ? D.red : p.marks.remaining === 0 ? D.emerald : D.textMain}
                />
                {!!a.passingMarks && <Field label="Passing marks" value={a.passingMarks} />}
                {p.marks.perQuestion > 0 && (
                  <Field label="Marks / question" value={p.marks.perQuestion} />
                )}
                {isCombined && (
                  <>
                    <Field label="MCQ" value={`${p.mcq.created}/${p.mcq.total} · ${a.totalMarksMCQ || 0} marks`} />
                    <Field
                      label="Programming"
                      value={`${p.programming.created}/${p.programming.total} · ${a.totalMarksProgramming || 0} marks`}
                    />
                  </>
                )}
                {qc?.scoringType && <Field label="Scoring" value={titleCase(qc.scoringType)} />}
                {qc?.questionFlow && <Field label="Question flow" value={titleCase(qc.questionFlow)} />}
                {qc?.attemptLimitEnabled && (
                  <Field label="Submission attempts" value={qc.submissionAttempts ?? 1} />
                )}
              </Grid>
              {sources.length > 0 && <Chips items={sources} />}
            </Section>

            {/* Evaluation */}
            {(a.evaluationMethod?.method || aiCriteria.length > 0) && (
              <Section icon={<Settings2 size={13} />} title="Evaluation">
                <Grid>
                  <Field
                    label="Method"
                    value={EVAL_LABELS[a.evaluationMethod?.method || ''] || titleCase(a.evaluationMethod?.method)}
                  />
                  {a.evaluationMethod?.ai?.testCasesCount != null && (
                    <Field label="Test cases" value={a.evaluationMethod.ai.testCasesCount} />
                  )}
                </Grid>
                <Chips items={aiCriteria} />
              </Section>
            )}

            {/* Security — chips of what is ON, nothing when all are off */}
            {(securityOn.length > 0 || sec?.maxTabSwitches != null) && (
              <Section icon={<ShieldCheck size={13} />} title="Security & Proctoring">
                <Chips items={securityOn} />
                {(sec?.maxTabSwitches != null || sec?.faceWarningLimit != null || sec?.warningSeconds != null) && (
                  <Grid>
                    {sec?.preventTabSwitch && sec?.maxTabSwitches != null && (
                      <Field label="Max tab switches" value={sec.maxTabSwitches} />
                    )}
                    {sec?.enableFaceVerification && sec?.faceWarningLimit != null && (
                      <Field label="Face warning limit" value={sec.faceWarningLimit} />
                    )}
                    {sec?.warnBeforeTimeout && sec?.warningSeconds != null && (
                      <Field label="Timeout warning" value={`${sec.warningSeconds}s before`} />
                    )}
                  </Grid>
                )}
              </Section>
            )}

            {/* Notifications */}
            {notifyOn.length > 0 && (
              <Section icon={<Bell size={13} />} title="Notifications">
                <Chips items={notifyOn} />
                {notif?.notifyBeforeStart && notif?.reminderHoursBefore != null && (
                  <Grid>
                    <Field label="Reminder" value={`${notif.reminderHoursBefore}h before`} />
                  </Grid>
                )}
              </Section>
            )}

            {/* Grading */}
            {(grade?.enablePassMark || bands.length > 0) && (
              <Section icon={<GraduationCap size={13} />} title="Grading">
                <Grid>
                  {grade?.enablePassMark && (
                    <Field label="Pass mark" value={a.passingMarks ?? DASH} />
                  )}
                  {bands.map((b, i) => (
                    <Field
                      key={b.label || i}
                      label={b.label || `Band ${i + 1}`}
                      value={`${b.fromPercent ?? 0}% – ${b.toPercent ?? 0}%`}
                    />
                  ))}
                </Grid>
              </Section>
            )}

            {/* Participants & audit trail */}
            <Section icon={<Users size={13} />} title="Participants & Record">
              <Grid>
                <Field label="Participants" value={a.participantCount ?? 0} />
                <Field label="Sections" value={a.sections?.length || 0} />
                <Field label="Created" value={fmtDateTime(a.createdAt)} />
                <Field label="Last updated" value={fmtDateTime(a.updatedAt)} />
              </Grid>
            </Section>
          </div>

          {/* ── Footer ── */}
          <div
            className="flex items-center justify-between gap-3 px-5 py-3 shrink-0"
            style={{ borderTop: `1px solid ${D.border2}`, background: D.surface }}
          >
            <span className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: D.textMuted }}>
              <Clock size={12} />
              {fmtDuration(a.durationMinutes)} · {p.total} question{p.total === 1 ? '' : 's'} · {p.marks.total} marks
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-8 px-3.5 rounded-lg border text-[12.5px] font-semibold transition-colors hover:bg-white"
                style={{ borderColor: D.border2, color: D.textSub, background: '#fff' }}
              >
                Close
              </button>
              {onEdit && (
                <button
                  type="button"
                  onClick={() => { onClose(); onEdit(); }}
                  className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-[12.5px] font-semibold text-white transition-colors"
                  style={{ background: D.orange }}
                >
                  <Pencil size={13} /> Edit assessment
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
