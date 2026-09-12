// SecuritySettings.tsx
// Restyled 2026-09-01 to match the ExerciseSettings design system —
// the collapsible chevron accordion (`Section`) is replaced by flat
// `SectionHeading` groups, description subtitles under each row are removed
// (their information moved into the InfoTooltip where it wasn't already
// duplicated), and the whole step body is wrapped in `StepShell`.
//
// Behaviour is unchanged: every field key, callback, disabled gate, and score
// weight is preserved — this is a UI-only pass.
import React, { useCallback, useMemo } from 'react';
import {
  Shield, Copy, Move, MonitorSmartphone, Eye, Camera,
  AlertTriangle, Clock, Users, AlertCircle,
  MousePointer, Code2, RefreshCw, ArrowLeft, Printer, Video,
} from 'lucide-react';
import { D } from './constants';
import { InfoTooltip, OToggle, SectionHeading, StepShell } from './UIComponents';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface SecuritySettingsData {
  // ── Lockdown ───────────────────────────────────────────────────────────────
  preventTabSwitch: boolean;
  maxTabSwitches: number;
  preventCopyPaste: boolean;
  preventBrowserClose: boolean;

  // ── Proctoring & recording ─────────────────────────────────────────────────
  /** Records the student's screen; the URL is what reviewSubmission plays back. */
  screenRecordingEnabled: boolean;
  enableFaceVerification: boolean;
  multipleFaceDetection: boolean;
  faceWarningLimit: number;
  faceMonitoringDetection: boolean;
  faceMonitoringWarningLimit: number;

  // ── Timing ─────────────────────────────────────────────────────────────────
  // The countdown itself comes from the assessment's own duration, not from here.
  autoSubmitOnTimeout: boolean;
  warnBeforeTimeout: boolean;
  warningSeconds: number;

  // ── Extra restrictions (keyboard-level friction) ───────────────────────────
  preventRightClick: boolean;
  preventDevTools: boolean;
  preventPrinting: boolean;
  preventRefresh: boolean;
  requireFullscreen: boolean;
  preventBackNavigation: boolean;

  // ── Legacy fields ──────────────────────────────────────────────────────────
  // No longer surfaced in the UI and read by nothing at runtime. Kept on the
  // type + defaults so assessments saved before this cleanup still merge
  // cleanly and their stored values round-trip untouched.
  preventScreenshot?: boolean;
  preventScreenRecording?: boolean;
  preventUrlChange?: boolean;
  enableIdVerification?: boolean;
  enableVoiceVerification?: boolean;
  captureIntervalSeconds?: number;
  blockOtherIPs?: boolean;
  allowedIPs?: string[];
  singleDeviceOnly?: boolean;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  randomizeQuestionOrder?: boolean;
  preventQuestionBacktrack?: boolean;
  sessionTimeoutMinutes?: number;
  maxAttempts?: number;
  graceAttempts?: number;
  cooldownMinutes?: number;
}

interface SecuritySettingsProps {
  value: SecuritySettingsData;
  onChange: (data: SecuritySettingsData) => void;
  disabled?: boolean;
}

// ─── SettingRow ───────────────────────────────────────────────────────────────
// Flat icon-tile row: 36px pale tile + label + (i) tooltip on the left, toggle
// right-aligned. Description sentences were dropped from the design pass; the
// information sits in the tooltip. Optional `children` render inline below when
// the toggle is on (used for the numeric warning-limit inputs).
const SettingRow: React.FC<{
  label: string;
  icon?: React.ReactNode;
  enabled: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  info?: string;
  children?: React.ReactNode;
  isLast?: boolean;
}> = ({ label, icon, enabled, onChange, disabled, info, children, isLast }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      paddingTop: 14,
      paddingBottom: 14,
      borderBottom: isLast ? 'none' : `1px solid ${D.border}`,
      opacity: disabled ? 0.55 : 1,
    }}
  >
    <div className="flex items-center flex-wrap" style={{ gap: 12, minHeight: 40 }}>
      {icon && (
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{ width: 36, height: 36, background: D.orangeLight, color: D.orange, borderRadius: 8 }}
        >
          {icon}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', minWidth: 240, flex: 1, gap: 2 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#101828', fontFamily: 'inherit', lineHeight: 1.25 }}>
          {label}
        </span>
        {info && <InfoTooltip content={info} side="top" />}
      </div>
      <div className="flex items-center" style={{ gap: 8 }}>
        {/* OToggle takes no `disabled` prop — gate the callback instead. */}
        <OToggle enabled={enabled} onChange={(v) => { if (!disabled) onChange(v); }} inline />
      </div>
    </div>
    {children && <div style={{ paddingLeft: 48 }}>{children}</div>}
  </div>
);

const NumberInput: React.FC<{
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
  unit?: string;
  disabled?: boolean;
}> = ({ value, onChange, min = 1, max = 60, label, unit, disabled }) => (
  <div className="flex items-center gap-2 flex-wrap">
    {label && <span className="text-xs font-medium" style={{ color: D.textSub }}>{label}</span>}
    <input
      type="number"
      value={Number.isFinite(value) ? value : min}
      onChange={(e) => onChange(Math.min(max, Math.max(min, parseInt(e.target.value) || min)))}
      disabled={disabled}
      className="w-20 px-2 py-1 text-sm rounded-lg border text-center"
      style={{ borderColor: D.border2, background: disabled ? D.surface : D.bg, color: D.textMain }}
      min={min}
      max={max}
    />
    {unit && <span className="text-xs" style={{ color: D.textMuted }}>{unit}</span>}
  </div>
);

// ─── Security score ───────────────────────────────────────────────────────────
// Weighted only by settings that are actually enforced during a test. Anything
// that does not change student-visible behaviour must not move this bar.
const SCORE_WEIGHTS: Array<{ key: keyof SecuritySettingsData; weight: number }> = [
  { key: 'preventTabSwitch',        weight: 10 },
  { key: 'screenRecordingEnabled',  weight: 8 },
  { key: 'enableFaceVerification',  weight: 8 },
  { key: 'preventCopyPaste',        weight: 6 },
  { key: 'multipleFaceDetection',   weight: 6 },
  { key: 'faceMonitoringDetection', weight: 6 },
  { key: 'requireFullscreen',       weight: 5 },
  { key: 'preventDevTools',         weight: 4 },
  { key: 'preventBrowserClose',     weight: 3 },
];

// ─── Main Component ───────────────────────────────────────────────────────────
export const SecuritySettings: React.FC<SecuritySettingsProps> = ({ value, onChange, disabled = false }) => {
  const updateField = useCallback(<K extends keyof SecuritySettingsData>(field: K, newValue: SecuritySettingsData[K]) => {
    onChange({ ...value, [field]: newValue });
  }, [value, onChange]);

  // Face detection needs the webcam, so it can only run when Camera Proctoring
  // is on. Switching the camera off clears both detectors in the same update —
  // otherwise the saved config claims detection that can never run.
  const setCameraProctoring = useCallback((on: boolean) => {
    onChange(on
      ? { ...value, enableFaceVerification: true }
      : { ...value, enableFaceVerification: false, multipleFaceDetection: false, faceMonitoringDetection: false });
  }, [value, onChange]);

  const faceDisabled = disabled || !value.enableFaceVerification;

  const scorePct = useMemo(() => {
    const total = SCORE_WEIGHTS.reduce((sum, w) => sum + w.weight, 0);
    const score = SCORE_WEIGHTS.reduce((sum, w) => sum + (value[w.key] ? w.weight : 0), 0);
    return total > 0 ? Math.round((score / total) * 100) : 0;
  }, [value]);

  const scoreColor = scorePct >= 70 ? D.emerald : scorePct >= 40 ? D.amber : D.red;

  return (
    <StepShell>
      {/* ── Security score ────────────────────────────────────────────────── */}
      <SectionHeading>Security Score</SectionHeading>
      <div className="flex items-center gap-3" style={{ paddingBottom: 4 }}>
        <Shield size={14} style={{ color: D.orange, flexShrink: 0 }} />
        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: D.border }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${scorePct}%`, background: scoreColor }} />
        </div>
        <span className="text-xs font-bold" style={{ color: D.textMain }}>{scorePct}%</span>
      </div>

      {/* ── Lockdown ─────────────────────────────────────────────────────── */}
      <div style={{ marginTop: 20 }}>
        <SectionHeading>Lockdown</SectionHeading>
        <div>
          <SettingRow
            label="Prevent Tab Switching"
            icon={<Move size={16} />}
            enabled={value.preventTabSwitch}
            onChange={(v) => updateField('preventTabSwitch', v)}
            disabled={disabled}
            info="Uses the Page Visibility API — warns on every switch, then auto-submits once the limit is reached. Strongest control here — catches the student looking up answers in another tab."
          >
            {value.preventTabSwitch && (
              <NumberInput
                value={value.maxTabSwitches}
                onChange={(v) => updateField('maxTabSwitches', v)}
                min={1}
                max={10}
                label="Allow up to:"
                unit="switches, then auto-submit"
                disabled={disabled}
              />
            )}
          </SettingRow>

          <SettingRow
            label="Prevent Copy & Paste"
            icon={<Copy size={16} />}
            enabled={value.preventCopyPaste}
            onChange={(v) => updateField('preventCopyPaste', v)}
            disabled={disabled}
            info="Blocks the copy, cut and paste events for the whole test page — stops answers being pasted in or questions copied out."
          />

          <SettingRow
            label="Prevent Browser Close"
            icon={<AlertTriangle size={16} />}
            enabled={value.preventBrowserClose}
            onChange={(v) => updateField('preventBrowserClose', v)}
            disabled={disabled}
            info="Warns before the student closes or reloads the test window."
            isLast
          />
        </div>
      </div>

      {/* ── Proctoring & recording ───────────────────────────────────────── */}
      <div style={{ marginTop: 20 }}>
        <SectionHeading>Proctoring &amp; Recording</SectionHeading>
        <div>
          <SettingRow
            label="Record Student Screen"
            icon={<Video size={16} />}
            enabled={value.screenRecordingEnabled}
            onChange={(v) => updateField('screenRecordingEnabled', v)}
            disabled={disabled}
            info="Records the screen for the whole test; plays back in Review Submission. The student is asked to share their screen before the test starts. If Camera Proctoring is also on, the webcam is overlaid on the recording."
          />

          <SettingRow
            label="Camera Proctoring"
            icon={<Camera size={16} />}
            enabled={value.enableFaceVerification}
            onChange={setCameraProctoring}
            disabled={disabled}
            info="Requires the webcam and records it during the test. Turning this off also switches off both face detectors below, since they need the webcam feed."
          />

          <SettingRow
            label="Multiple Face Detection"
            icon={<Users size={16} />}
            enabled={value.multipleFaceDetection}
            onChange={(v) => updateField('multipleFaceDetection', v)}
            disabled={faceDisabled}
            info={value.enableFaceVerification
              ? 'The student is warned each time more than one person is detected. At the limit the test auto-submits and closes.'
              : 'Switch on Camera Proctoring first — this needs the webcam feed.'}
          >
            {value.multipleFaceDetection && (
              <NumberInput
                value={value.faceWarningLimit}
                onChange={(v) => updateField('faceWarningLimit', v)}
                min={1}
                max={10}
                label="Warning limit:"
                unit="warnings, then auto-submit"
                disabled={faceDisabled}
              />
            )}
          </SettingRow>

          <SettingRow
            label="Face Monitoring Detection"
            icon={<Eye size={16} />}
            enabled={value.faceMonitoringDetection}
            onChange={(v) => updateField('faceMonitoringDetection', v)}
            disabled={faceDisabled}
            info={value.enableFaceVerification
              ? 'The student is warned each time no face is detected. At the limit the test auto-submits and closes.'
              : 'Switch on Camera Proctoring first — this needs the webcam feed.'}
            isLast
          >
            {value.faceMonitoringDetection && (
              <NumberInput
                value={value.faceMonitoringWarningLimit}
                onChange={(v) => updateField('faceMonitoringWarningLimit', v)}
                min={1}
                max={10}
                label="Warning limit:"
                unit="warnings, then auto-submit"
                disabled={faceDisabled}
              />
            )}
          </SettingRow>
        </div>
      </div>

      {/* ── Timing ───────────────────────────────────────────────────────── */}
      <div style={{ marginTop: 20 }}>
        <SectionHeading>Timing</SectionHeading>
        <div>
          <SettingRow
            label="Auto-submit on Timeout"
            icon={<Clock size={16} />}
            enabled={value.autoSubmitOnTimeout}
            onChange={(v) => updateField('autoSubmitOnTimeout', v)}
            disabled={disabled}
            info="Submits automatically when the assessment duration runs out. The countdown comes from this assessment's own duration — there is no separate timer here to keep in sync."
          />

          <SettingRow
            label="Warning Before Timeout"
            icon={<AlertCircle size={16} />}
            enabled={value.warnBeforeTimeout}
            onChange={(v) => updateField('warnBeforeTimeout', v)}
            disabled={disabled}
            info="Shows a warning shortly before time expires."
            isLast
          >
            {value.warnBeforeTimeout && (
              <NumberInput
                value={value.warningSeconds}
                onChange={(v) => updateField('warningSeconds', v)}
                min={10}
                max={300}
                label="Warn at:"
                unit="seconds before the end"
                disabled={disabled}
              />
            )}
          </SettingRow>
        </div>
      </div>

      {/* ── Extra restrictions ───────────────────────────────────────────── */}
      <div style={{ marginTop: 20 }}>
        <SectionHeading>Extra Restrictions</SectionHeading>
        <div>
          <SettingRow
            label="Require Fullscreen Mode"
            icon={<MonitorSmartphone size={16} />}
            enabled={value.requireFullscreen}
            onChange={(v) => updateField('requireFullscreen', v)}
            disabled={disabled}
            info="Puts the test into fullscreen and tries to restore it if the student exits. Browsers only allow fullscreen to be re-entered from a user action, so a student who exits may stay out. Pair this with Prevent Tab Switching."
          />
          <SettingRow
            label="Prevent Developer Tools"
            icon={<Code2 size={16} />}
            enabled={value.preventDevTools}
            onChange={(v) => updateField('preventDevTools', v)}
            disabled={disabled}
            info="Blocks F12, Ctrl+Shift+I / J / C and Ctrl+U. Keyboard shortcuts only — the browser menu can still open DevTools."
          />
          <SettingRow
            label="Prevent Right Click"
            icon={<MousePointer size={16} />}
            enabled={value.preventRightClick}
            onChange={(v) => updateField('preventRightClick', v)}
            disabled={disabled}
            info="Disables the context menu."
          />
          <SettingRow
            label="Prevent Printing"
            icon={<Printer size={16} />}
            enabled={value.preventPrinting}
            onChange={(v) => updateField('preventPrinting', v)}
            disabled={disabled}
            info="Blocks Ctrl+P."
          />
          <SettingRow
            label="Prevent Page Refresh"
            icon={<RefreshCw size={16} />}
            enabled={value.preventRefresh}
            onChange={(v) => updateField('preventRefresh', v)}
            disabled={disabled}
            info="Blocks F5 and Ctrl+R."
          />
          <SettingRow
            label="Prevent Back Navigation"
            icon={<ArrowLeft size={16} />}
            enabled={value.preventBackNavigation}
            onChange={(v) => updateField('preventBackNavigation', v)}
            disabled={disabled}
            info="Disables the browser back button during the test."
            isLast
          />
        </div>
      </div>
    </StepShell>
  );
};

// Default values
export const defaultSecuritySettings: SecuritySettingsData = {
  // Lockdown
  preventTabSwitch: false,
  maxTabSwitches: 3,
  preventCopyPaste: false,
  preventBrowserClose: false,

  // Proctoring & recording
  screenRecordingEnabled: false,
  enableFaceVerification: false,
  multipleFaceDetection: false,
  faceWarningLimit: 3,
  faceMonitoringDetection: false,
  faceMonitoringWarningLimit: 3,

  // Timing
  autoSubmitOnTimeout: true,
  warnBeforeTimeout: true,
  warningSeconds: 30,

  // Extra restrictions
  preventRightClick: false,
  preventDevTools: false,
  preventPrinting: false,
  preventRefresh: false,
  requireFullscreen: false,
  preventBackNavigation: false,

  // Legacy — retained so older assessments merge without undefined fields
  preventScreenshot: false,
  preventScreenRecording: false,
  preventUrlChange: false,
  enableIdVerification: false,
  enableVoiceVerification: false,
  captureIntervalSeconds: 60,
  blockOtherIPs: false,
  allowedIPs: [],
  singleDeviceOnly: false,
  shuffleQuestions: false,
  shuffleOptions: false,
  randomizeQuestionOrder: false,
  preventQuestionBacktrack: false,
  sessionTimeoutMinutes: 0,
  maxAttempts: 1,
  graceAttempts: 0,
  cooldownMinutes: 30,
};
