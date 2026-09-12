// SecuritySettings.tsx
import React, { useState, useCallback, useMemo } from 'react';
import {
  Shield, Copy, Move, MonitorSmartphone, Eye, Camera,
  AlertTriangle, Clock, Users, ChevronDown, ChevronUp, AlertCircle,
  Lock, MousePointer, Code2, RefreshCw, ArrowLeft, Printer, Settings2, Video,
} from 'lucide-react';
import { D } from './constants';
import { InfoTooltip, OToggle } from './UIComponents';

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

// ─── Section Components ───────────────────────────────────────────────────────
const Section: React.FC<{
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}> = ({ title, subtitle, icon, children, defaultExpanded = true }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: D.border, background: D.bg }}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
        style={{ borderBottom: expanded ? `1px solid ${D.border}` : 'none' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: D.orangeLight, color: D.orange }}>
            {icon}
          </div>
          <div className="text-left">
            <span className="text-sm font-bold block" style={{ color: D.textMain }}>{title}</span>
            {subtitle && <span className="text-xs" style={{ color: D.textMuted }}>{subtitle}</span>}
          </div>
        </div>
        <div className="text-gray-400">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>
      {expanded && (
        <div className="px-4 py-2" style={{ background: '#fafafa' }}>
          {children}
        </div>
      )}
    </div>
  );
};

const SettingRow: React.FC<{
  label: string;
  description?: string;
  icon?: React.ReactNode;
  enabled: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  info?: string;
  children?: React.ReactNode;
}> = ({ label, description, icon, enabled, onChange, disabled, info, children }) => (
  <div className="flex items-start gap-3 py-2.5 border-b last:border-b-0" style={{ borderColor: D.border, opacity: disabled ? 0.55 : 1 }}>
    {icon && (
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: D.orangeLight, color: D.orange }}>
        {icon}
      </div>
    )}
    <div className="flex-1">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5" style={{ width: 350 }}>
          <span className="text-sm font-semibold" style={{ color: D.textMain }}>{label}</span>
          {info && <InfoTooltip content={info} side="top" />}
        </div>
        {/* OToggle takes no `disabled` prop — passing one did nothing, so a
            dimmed row stayed clickable. Gate the callback instead. */}
        <OToggle enabled={enabled} onChange={(v) => { if (!disabled) onChange(v); }} />
      </div>
      {description && <p className="text-xs mt-0.5" style={{ color: D.textMuted }}>{description}</p>}
      {children && <div className="mt-2">{children}</div>}
    </div>
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
  <div className="flex items-center gap-2">
    {label && <span className="text-xs font-medium" style={{ color: D.textSub }}>{label}</span>}
    <input
      type="number"
      value={Number.isFinite(value) ? value : min}
      onChange={(e) => onChange(Math.min(max, Math.max(min, parseInt(e.target.value) || min)))}
      disabled={disabled}
      className="w-20 px-2 py-1 text-sm rounded-lg border text-center"
      style={{ borderColor: D.border, background: disabled ? D.surface : D.bg, color: D.textMain }}
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
    <div className="px-10 pt-4 pb-6 space-y-3">
      {/* ── Lockdown ─────────────────────────────────────────────────────── */}
      <Section title="Lockdown" subtitle="Stops the student leaving the test or moving content out of it" icon={<Lock size={14} />}>
        <SettingRow
          label="Prevent Tab Switching"
          description="Warns on every switch, then auto-submits once the limit is reached"
          icon={<Move size={16} />}
          enabled={value.preventTabSwitch}
          onChange={(v) => updateField('preventTabSwitch', v)}
          disabled={disabled}
          info="Uses the Page Visibility API. This is the strongest control here — it catches the student looking up answers in another tab."
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
          description="Blocks copying questions out and pasting answers in"
          icon={<Copy size={16} />}
          enabled={value.preventCopyPaste}
          onChange={(v) => updateField('preventCopyPaste', v)}
          disabled={disabled}
          info="Blocks the copy, cut and paste events for the whole test page."
        />

        <SettingRow
          label="Prevent Browser Close"
          description="Warns before the student closes or reloads the test window"
          icon={<AlertTriangle size={16} />}
          enabled={value.preventBrowserClose}
          onChange={(v) => updateField('preventBrowserClose', v)}
          disabled={disabled}
        />
      </Section>

      {/* ── Proctoring & recording ───────────────────────────────────────── */}
      <Section title="Proctoring & Recording" subtitle="What gets captured and reviewed afterwards" icon={<Camera size={14} />}>
        <SettingRow
          label="Record Student Screen"
          description="Records the screen for the whole test; plays back in Review Submission"
          icon={<Video size={16} />}
          enabled={value.screenRecordingEnabled}
          onChange={(v) => updateField('screenRecordingEnabled', v)}
          disabled={disabled}
          info="The student is asked to share their screen before the test starts. If Camera Proctoring is also on, the webcam is overlaid on the recording."
        />

        <SettingRow
          label="Camera Proctoring"
          description="Requires the webcam and records it during the test"
          icon={<Camera size={16} />}
          enabled={value.enableFaceVerification}
          onChange={setCameraProctoring}
          disabled={disabled}
          info="Turning this off also switches off both face detectors below, since they need the webcam feed."
        />

        <SettingRow
          label="Multiple Face Detection"
          description="Warns when a second person appears, then auto-submits"
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
          description="Warns when the student leaves the frame, then auto-submits"
          icon={<Eye size={16} />}
          enabled={value.faceMonitoringDetection}
          onChange={(v) => updateField('faceMonitoringDetection', v)}
          disabled={faceDisabled}
          info={value.enableFaceVerification
            ? 'The student is warned each time no face is detected. At the limit the test auto-submits and closes.'
            : 'Switch on Camera Proctoring first — this needs the webcam feed.'}
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
      </Section>

      {/* ── Timing ───────────────────────────────────────────────────────── */}
      <Section title="Timing" subtitle="Counts down from the duration set on this assessment" icon={<Clock size={14} />}>
        <SettingRow
          label="Auto-submit on Timeout"
          description="Submits automatically when the assessment duration runs out"
          icon={<Clock size={16} />}
          enabled={value.autoSubmitOnTimeout}
          onChange={(v) => updateField('autoSubmitOnTimeout', v)}
          disabled={disabled}
          info="The countdown comes from this assessment's own duration — there is no separate timer here to keep in sync."
        />

        <SettingRow
          label="Warning Before Timeout"
          description="Shows a warning shortly before time expires"
          icon={<AlertCircle size={16} />}
          enabled={value.warnBeforeTimeout}
          onChange={(v) => updateField('warnBeforeTimeout', v)}
          disabled={disabled}
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
      </Section>

      {/* ── Extra restrictions ───────────────────────────────────────────── */}
      <Section
        title="Extra Restrictions"
        subtitle="Keyboard-level friction — slows a student down, does not stop a determined one"
        icon={<Settings2 size={14} />}
        defaultExpanded={false}
      >
        <SettingRow
          label="Require Fullscreen Mode"
          description="Puts the test into fullscreen and tries to restore it if the student exits"
          icon={<MonitorSmartphone size={16} />}
          enabled={value.requireFullscreen}
          onChange={(v) => updateField('requireFullscreen', v)}
          disabled={disabled}
          info="Browsers only allow fullscreen to be re-entered from a user action, so a student who exits may stay out. Pair this with Prevent Tab Switching."
        />
        <SettingRow
          label="Prevent Developer Tools"
          description="Blocks F12, Ctrl+Shift+I / J / C and Ctrl+U"
          icon={<Code2 size={16} />}
          enabled={value.preventDevTools}
          onChange={(v) => updateField('preventDevTools', v)}
          disabled={disabled}
          info="Keyboard shortcuts only — the browser menu can still open DevTools."
        />
        <SettingRow
          label="Prevent Right Click"
          description="Disables the context menu"
          icon={<MousePointer size={16} />}
          enabled={value.preventRightClick}
          onChange={(v) => updateField('preventRightClick', v)}
          disabled={disabled}
        />
        <SettingRow
          label="Prevent Printing"
          description="Blocks Ctrl+P"
          icon={<Printer size={16} />}
          enabled={value.preventPrinting}
          onChange={(v) => updateField('preventPrinting', v)}
          disabled={disabled}
        />
        <SettingRow
          label="Prevent Page Refresh"
          description="Blocks F5 and Ctrl+R"
          icon={<RefreshCw size={16} />}
          enabled={value.preventRefresh}
          onChange={(v) => updateField('preventRefresh', v)}
          disabled={disabled}
        />
        <SettingRow
          label="Prevent Back Navigation"
          description="Disables the browser back button during the test"
          icon={<ArrowLeft size={16} />}
          enabled={value.preventBackNavigation}
          onChange={(v) => updateField('preventBackNavigation', v)}
          disabled={disabled}
        />
      </Section>

      {/* ── Security score ───────────────────────────────────────────────── */}
      <div className="mt-4 p-3 rounded-lg" style={{ background: D.orangeLight, border: `1px solid ${D.orange}25` }}>
        <div className="flex items-center gap-2 mb-2">
          <Shield size={14} style={{ color: D.orange }} />
          <span className="text-xs font-bold" style={{ color: D.orange }}>Security Score</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: D.border }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${scorePct}%`, background: scoreColor }} />
          </div>
          <span className="text-xs font-bold" style={{ color: D.textMain }}>{scorePct}%</span>
        </div>
      </div>
    </div>
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
