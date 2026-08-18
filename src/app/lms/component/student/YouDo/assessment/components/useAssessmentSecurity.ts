'use client';

import { useEffect, useRef, useCallback } from 'react';

// ─── Canonical security config (matches backend securitySettings shape) ────────
export interface AssessmentSecurityConfig {
  // Content protection
  preventCopyPaste?: boolean;
  preventRightClick?: boolean;
  preventPrinting?: boolean;
  preventScreenshot?: boolean;
  preventScreenRecording?: boolean;

  // Navigation locks
  requireFullscreen?: boolean;
  preventTabSwitch?: boolean;
  preventBrowserClose?: boolean;
  preventDevTools?: boolean;
  preventBackNavigation?: boolean;
  preventRefresh?: boolean;
  preventUrlChange?: boolean;

  // Tab-switch budget
  maxTabSwitches?: number;

  // Timer / auto-submit
  sessionTimeoutMinutes?: number;
  autoSubmitOnTimeout?: boolean;
  warnBeforeTimeout?: boolean;
  warningSeconds?: number;

  // Question behaviour (read-only — consumed by the component, not enforced here)
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  randomizeQuestionOrder?: boolean;
  preventQuestionBacktrack?: boolean;

  // Attempt limits (consumed by the component)
  maxAttempts?: number;
  graceAttempts?: number;
  cooldownMinutes?: number;

  // ── Proctoring / verification ──────────────────────────────────────────────
  enableFaceVerification?: boolean;
  captureIntervalSeconds?: number;
  // Face-detection proctoring: warn on no-face / multiple persons, then auto-submit
  multipleFaceDetection?: boolean;
  faceWarningLimit?: number;
  faceMonitoringDetection?: boolean;
  faceMonitoringWarningLimit?: number;
  // ── Legacy field names used by older code-editor / frontendCompiler ────────
  timerEnabled?: boolean;
  timerDuration?: number;            // minutes
  cameraMicEnabled?: boolean;
  fullScreenMode?: boolean;
  tabSwitchAllowed?: boolean;
  disableClipboard?: boolean;
  screenRecordingEnabled?: boolean;  // proctoring screen recording (NOT student-prevention)
}

/**
 * Normalise the raw backend `securitySettings` object into canonical form so
 * every component can rely on a single consistent interface regardless of
 * whether the data comes from the new field names or the older legacy aliases.
 */
export function normalizeSecurityConfig(raw: Record<string, any> = {}): AssessmentSecurityConfig {
  // ── Resolve proctoring screen recording independently of student-prevention ─
  // `screenRecordingEnabled` = system records the student's screen for proctoring.
  //   This is the "Record Student Screen" toggle, and the recording it produces
  //   is what reviewSubmission plays back.
  // `preventScreenRecording` = legacy no-op that claimed to block the STUDENT
  //   from recording. Nothing enforces it and it is no longer surfaced.
  // These are two distinct concerns; do NOT conflate them.
  //
  // Default OFF: a missing field means "the teacher didn't ask for proctor
  // recording" — NOT "assume it's on". A previous default of `true` made every
  // student test show the browser's screen-share prompt even with all security
  // flags off.
  const proctoringRecordingEnabled: boolean = Boolean(raw.screenRecordingEnabled);

  return {
    // ── Student-restriction flags ──────────────────────────────────────────
    preventCopyPaste:         raw.preventCopyPaste         ?? raw.disableClipboard        ?? false,
    preventRightClick:        raw.preventRightClick        ?? false,
    preventPrinting:          raw.preventPrinting          ?? false,
    preventScreenshot:        raw.preventScreenshot        ?? false,
    preventScreenRecording:   raw.preventScreenRecording   ?? false,   // block student captures
    requireFullscreen:        raw.requireFullscreen        ?? raw.fullScreenMode           ?? false,
    preventTabSwitch:         raw.preventTabSwitch         ?? (raw.tabSwitchAllowed === false) ?? false,
    preventBrowserClose:      raw.preventBrowserClose      ?? false,
    preventDevTools:          raw.preventDevTools          ?? false,
    preventBackNavigation:    raw.preventBackNavigation    ?? false,
    preventRefresh:           raw.preventRefresh           ?? false,
    preventUrlChange:         raw.preventUrlChange         ?? false,
    maxTabSwitches:           raw.maxTabSwitches           ?? 3,
    // ── Timer ──────────────────────────────────────────────────────────────
    sessionTimeoutMinutes:    raw.sessionTimeoutMinutes    ?? (raw.timerEnabled ? (raw.timerDuration ?? 30) : undefined),
    autoSubmitOnTimeout:      raw.autoSubmitOnTimeout      ?? true,
    warnBeforeTimeout:        raw.warnBeforeTimeout        ?? true,
    warningSeconds:           raw.warningSeconds           ?? 30,
    // ── Question behaviour ─────────────────────────────────────────────────
    shuffleQuestions:         raw.shuffleQuestions         ?? false,
    shuffleOptions:           raw.shuffleOptions           ?? false,
    randomizeQuestionOrder:   raw.randomizeQuestionOrder   ?? false,
    preventQuestionBacktrack: raw.preventQuestionBacktrack ?? false,
    // ── Attempt limits ─────────────────────────────────────────────────────
    maxAttempts:              raw.maxAttempts              ?? 1,
    graceAttempts:            raw.graceAttempts            ?? 0,
    cooldownMinutes:          raw.cooldownMinutes          ?? 30,
    // ── Proctoring / verification ──────────────────────────────────────────
    enableFaceVerification:   raw.enableFaceVerification   ?? false,
    captureIntervalSeconds:   raw.captureIntervalSeconds   ?? 60,
    multipleFaceDetection:    raw.multipleFaceDetection    ?? false,
    faceWarningLimit:         raw.faceWarningLimit         ?? 3,
    faceMonitoringDetection:  raw.faceMonitoringDetection  ?? false,
    faceMonitoringWarningLimit: raw.faceMonitoringWarningLimit ?? 3,
    // ── Legacy aliases (consumed by code-editor / frontendCompiler internals)
    timerEnabled:             !!(raw.sessionTimeoutMinutes ?? raw.timerEnabled),
    timerDuration:            raw.sessionTimeoutMinutes    ?? raw.timerDuration ?? 30,
    cameraMicEnabled:         raw.cameraMicEnabled         ?? raw.enableFaceVerification ?? false,
    fullScreenMode:           raw.requireFullscreen        ?? raw.fullScreenMode ?? false,
    tabSwitchAllowed:         !(raw.preventTabSwitch       ?? (raw.tabSwitchAllowed === false)),
    disableClipboard:         raw.preventCopyPaste         ?? raw.disableClipboard        ?? false,
    screenRecordingEnabled:   proctoringRecordingEnabled,  // proctoring ON by default
  };
}

interface UseAssessmentSecurityOptions {
  config: AssessmentSecurityConfig;
  /** Only enforce security when this is true (i.e. assessment has started). */
  isActive: boolean;
  /**
   * Minutes the test runs for, taken from the assessment's own duration. When
   * set, the hook owns the countdown and fires onTimeWarning then onTimeUp.
   * Leave unset on pages that already run a countdown of their own.
   */
  durationMinutes?: number;
  /**
   * Seconds left on a countdown the PAGE owns. When provided the hook runs no
   * timer of its own and never calls onTimeUp — it only fires the warning, so
   * the page stays the single source of auto-submit and the two can't both
   * submit the same attempt.
   */
  externalSecondsLeft?: number | null;
  /** Called every time the tab-switch count increases. */
  onTabSwitchViolation?: (count: number, max: number) => void;
  /** Called when the hook-owned timer expires. */
  onTimeUp?: () => void;
  /** Called once, warningSeconds before the countdown expires. */
  onTimeWarning?: (secondsLeft: number) => void;
}

/**
 * Applies DOM-level security enforcement during an active assessment.
 * All listeners are attached only when `isActive` is true and cleaned
 * up automatically when it becomes false or the component unmounts.
 *
 * Uses the "latest-ref" pattern for callbacks so that passing inline arrow
 * functions as props does NOT restart effects / timers on every render.
 */
export function useAssessmentSecurity({
  config,
  isActive,
  durationMinutes,
  externalSecondsLeft,
  onTabSwitchViolation,
  onTimeUp,
  onTimeWarning,
}: UseAssessmentSecurityOptions) {
  const tabCountRef  = useRef(0);
  const timerRef     = useRef<NodeJS.Timeout | null>(null);
  const warnedRef    = useRef(false);

  // Latest-value refs for callbacks — keep deps stable so effects don't restart
  const onTabSwitchRef  = useRef(onTabSwitchViolation);
  const onTimeUpRef     = useRef(onTimeUp);
  const onTimeWarnRef   = useRef(onTimeWarning);
  useEffect(() => { onTabSwitchRef.current  = onTabSwitchViolation; }, [onTabSwitchViolation]);
  useEffect(() => { onTimeUpRef.current     = onTimeUp; },           [onTimeUp]);
  useEffect(() => { onTimeWarnRef.current   = onTimeWarning; },      [onTimeWarning]);

  // ── Copy / Cut / Paste ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive || !config.preventCopyPaste) return;
    const block = (e: ClipboardEvent) => { e.preventDefault(); };
    document.addEventListener('copy',  block);
    document.addEventListener('cut',   block);
    document.addEventListener('paste', block);
    return () => {
      document.removeEventListener('copy',  block);
      document.removeEventListener('cut',   block);
      document.removeEventListener('paste', block);
    };
  }, [isActive, config.preventCopyPaste]);

  // ── Right-click ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive || !config.preventRightClick) return;
    const block = (e: MouseEvent) => { e.preventDefault(); };
    document.addEventListener('contextmenu', block);
    return () => document.removeEventListener('contextmenu', block);
  }, [isActive, config.preventRightClick]);

  // ── Keyboard guards (print / refresh / devtools / screenshot) ─────────────
  useEffect(() => {
    if (!isActive) return;
    const onKey = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;

      if (config.preventPrinting && ctrl && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (config.preventRefresh && (
        e.key === 'F5' ||
        (ctrl && (e.key === 'r' || e.key === 'R'))
      )) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (config.preventDevTools && (
        e.key === 'F12' ||
        (ctrl && e.shiftKey && ['i','I','j','J','c','C'].includes(e.key)) ||
        (ctrl && (e.key === 'u' || e.key === 'U'))
      )) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (config.preventScreenshot && e.key === 'PrintScreen') {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey, true); // capture phase
    return () => window.removeEventListener('keydown', onKey, true);
  }, [
    isActive,
    config.preventPrinting,
    config.preventRefresh,
    config.preventDevTools,
    config.preventScreenshot,
  ]);

  // ── Before-unload warning ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive || !config.preventBrowserClose) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Assessment in progress — are you sure you want to leave?';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isActive, config.preventBrowserClose]);

  // ── Back-navigation lock ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive || !config.preventBackNavigation) return;
    window.history.pushState(null, '', window.location.href);
    const handler = () => window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [isActive, config.preventBackNavigation]);

  // ── Fullscreen enforcement ────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive || !config.requireFullscreen) return;

    const requestFs = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    };
    requestFs();

    const onChange = () => {
      if (!document.fullscreenElement) {
        setTimeout(requestFs, 800);
      }
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      // Exit fullscreen when assessment ends
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, [isActive, config.requireFullscreen]);

  // ── Tab-switch detection ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive || !config.preventTabSwitch) return;
    const max = config.maxTabSwitches ?? 3;

    const handler = () => {
      if (!document.hidden) return;
      tabCountRef.current += 1;
      onTabSwitchRef.current?.(tabCountRef.current, max);
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, config.preventTabSwitch, config.maxTabSwitches]);

  // ── Countdown, mode A: the hook owns it ───────────────────────────────────
  // Only for pages with no timer of their own (currently the SQL/DB editor).
  // The duration is the assessment's own duration — there is no separate
  // security timeout that could drift out of sync with it.
  useEffect(() => {
    if (!isActive) return;
    if (externalSecondsLeft !== undefined) return;      // page owns the countdown
    if (!durationMinutes || durationMinutes <= 0) return;

    let secs = durationMinutes * 60;
    warnedRef.current = false;

    timerRef.current = setInterval(() => {
      secs -= 1;
      if (
        config.warnBeforeTimeout &&
        !warnedRef.current &&
        secs > 0 &&
        secs <= (config.warningSeconds ?? 30)
      ) {
        warnedRef.current = true;
        onTimeWarnRef.current?.(secs);
      }
      if (secs <= 0) {
        clearInterval(timerRef.current!);
        if (config.autoSubmitOnTimeout !== false) {
          onTimeUpRef.current?.();
        }
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isActive,
    durationMinutes,
    externalSecondsLeft === undefined,
    config.autoSubmitOnTimeout,
    config.warnBeforeTimeout,
    config.warningSeconds,
  ]);

  // ── Countdown, mode B: the page owns it ───────────────────────────────────
  // MCQ / coding / frontend / section tests already run their own countdown and
  // their own auto-submit. Here we only fire the warning, once, so "Warning
  // Before Timeout" behaves identically on every test type without ever
  // producing a second submit.
  useEffect(() => {
    if (!isActive) return;
    if (externalSecondsLeft === undefined || externalSecondsLeft === null) return;
    if (!config.warnBeforeTimeout || warnedRef.current) return;
    if (externalSecondsLeft > 0 && externalSecondsLeft <= (config.warningSeconds ?? 30)) {
      warnedRef.current = true;
      onTimeWarnRef.current?.(externalSecondsLeft);
    }
  }, [isActive, externalSecondsLeft, config.warnBeforeTimeout, config.warningSeconds]);

  // Re-arm the one-shot warning whenever enforcement stops (next attempt, or a
  // section test moving to a fresh section with its own countdown).
  useEffect(() => {
    if (!isActive) warnedRef.current = false;
  }, [isActive]);

  return { tabSwitchCount: tabCountRef };
}
