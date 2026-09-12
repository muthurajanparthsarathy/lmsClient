// assignmentState.ts
// ─────────────────────────────────────────────────────────────────────────────
// Pure state resolver for the student "We Do → Assignments" row.
//
// One source of truth for BOTH the Status chip and the Action column so they
// can never disagree. Fed by:
//   • the exercise itself (for `availabilityPeriod`),
//   • the student's `courses[i].answers` map (as delivered by
//     `/getAll/courses-data/:id`),
//   • the current time (defaulted, injectable for tests),
//   • an optional due-soon threshold (defaulted to 48 hours).
//
// Nothing here talks to `window` — the resolver is safe to import from
// tests and from server code. `localStorage` is polled by a separate helper
// that lives in exercises.tsx.
//
// Priority order (highest wins) — mirrors the spec's §"Status and action
// precedence":
//   1. graded
//   2. submitted
//   3. missed / closed  (past deadline, no valid final submission)
//   4. in-progress     (attempt exists, not yet finalised, still resumable)
//   5. due-soon        (available, within `dueSoonThresholdMs` of end)
//   6. active          (available, not due soon, no attempt yet)
//   7. upcoming        (window hasn't opened)
//
// A partially-attempted assignment that is ALSO within the due-soon window
// returns `in-progress` (rule 4 beats rule 5) so the row shows "Continue"
// rather than a green "Start" — deadline urgency stays visible in the Due
// date column instead.

'use client';

export type AssignmentStateKind =
  | 'upcoming'
  | 'active'
  | 'due-soon'
  | 'in-progress'
  | 'submitted'
  | 'graded'
  | 'missed'
  | 'closed';

export type StatusPillTone =
  | 'success' | 'warn' | 'danger' | 'info' | 'brand' | 'neutral';

export type ActionKind = 'primary' | 'secondary' | 'text' | 'disabled' | 'none';

export interface AvailabilityInfo {
  status: 'upcoming' | 'available' | 'expired' | 'grace-period' | 'late-attempt';
  canStart: boolean;
  startTime: Date | null;
  endTime: Date | null;
  graceTime: Date | null;
  cutOffTime: Date | null;
}

export interface AttemptInfo {
  /** A matching exerciseProgress row exists in the student's answers. */
  attemptExists: boolean;
  /** Final test submission completed (testSubmissions >= 1 OR progress.status === 'completed'). */
  isComplete: boolean;
  /** Number of full test submissions the student has recorded. */
  testSubmissions: number;
  /** Any question inside the progress row has been meaningfully answered. */
  hasProgressedQuestions: boolean;
  /** attempt exists AND not complete AND the availability window still allows continuation. */
  canResume: boolean;
  /** The student's most recent score, when carried. `null` when unknown. */
  score: number | null;
  /** True when a per-student grade signal is present. Reserved: the server
   *  doesn't (yet) expose this flag on this shape — the resolver keeps the
   *  path so a future field lights up "Graded · N%" without another edit. */
  isGraded: boolean;
}

export interface ResolvedState {
  kind: AssignmentStateKind;
  /** Status chip label — always human-readable, never empty. */
  label: string;
  /** Tone for the shared StatusPill primitive. */
  tone: StatusPillTone;
  /** Optional trailing bit for the chip, e.g. "· 92%" on Graded. */
  labelSuffix: string;
  /** Copy for the Action column. `null` renders nothing (still not a dash). */
  actionLabel: string | null;
  actionKind: ActionKind;
  /** Row should render with the pale-orange highlight + orange left border. */
  isUrgent: boolean;
  /** Availability + attempt snapshots the caller can render (e.g. Due date column). */
  availability: AvailabilityInfo;
  attempt: AttemptInfo;
}

export interface ResolveOpts {
  now?: number;
  /** How close to the deadline counts as "due soon". Defaults to 48h. */
  dueSoonThresholdMs?: number;
}

const DEFAULT_DUE_SOON_MS = 48 * 60 * 60 * 1000;

// ─── Availability ───────────────────────────────────────────────────────────

export function getAvailability(exercise: any, opts?: ResolveOpts): AvailabilityInfo {
  const now = new Date(opts?.now ?? Date.now());
  const ap = exercise?.availabilityPeriod || {};
  const startTime = ap.startDate ? new Date(ap.startDate) : null;
  const endTime = ap.endDate ? new Date(ap.endDate) : null;
  const graceTime = ap.gracePeriodAllowed && ap.gracePeriodDate
    ? new Date(ap.gracePeriodDate) : null;
  const cutOffTime = ap.cutOffEnabled && ap.cutOffDate
    ? new Date(ap.cutOffDate) : null;

  if (startTime && now < startTime) {
    return { status: 'upcoming', canStart: false, startTime, endTime, graceTime, cutOffTime };
  }
  if (graceTime && endTime && now > endTime && now <= graceTime) {
    return { status: 'grace-period', canStart: true, startTime, endTime, graceTime, cutOffTime };
  }
  if (endTime && now <= endTime) {
    return { status: 'available', canStart: true, startTime, endTime, graceTime, cutOffTime };
  }
  if (cutOffTime && endTime && now > endTime && now <= cutOffTime) {
    return { status: 'late-attempt', canStart: true, startTime, endTime, graceTime, cutOffTime };
  }
  return { status: 'expired', canStart: false, startTime, endTime, graceTime, cutOffTime };
}

// ─── Attempt detection (server-authoritative) ───────────────────────────────

const asId = (v: any) => (v == null ? '' : String(v));

const METHOD_KEYS: Record<string, string[]> = {
  ido:   ['I_Do', 'i_do', 'IDo', 'i-do', 'ido'],
  wedo:  ['We_Do', 'we_do', 'WeDo', 'we-do', 'wedo'],
  youdo: ['You_Do', 'you_do', 'YouDo', 'you-do', 'youdo'],
};

// Find the matching exerciseProgress row for a given exercise+method+subcategory
// in the student's answers Map. We search the natural key path first, then
// fall back to a deep scan so oddly-cased persisted keys still resolve.
function findExerciseProgress(
  studentAnswers: Record<string, any> | undefined,
  exerciseId: string,
  method?: string,
): any | null {
  if (!studentAnswers || !exerciseId) return null;
  const matchId = (row: any) =>
    row && (asId(row.exerciseId) === exerciseId || asId(row._id) === exerciseId);

  const ml = (method || '').toLowerCase().replace(/[-_\s]/g, '');
  const stageCandidates: string[] = [];
  if (ml.includes('ido')) stageCandidates.push(...METHOD_KEYS.ido);
  if (ml.includes('wedo')) stageCandidates.push(...METHOD_KEYS.wedo);
  if (ml.includes('youdo')) stageCandidates.push(...METHOD_KEYS.youdo);
  if (method) {
    stageCandidates.push(method, method.replace(/-/g, '_'), method.replace(/_/g, '-'));
  }
  // The Map-of-Map answers shape ships as plain nested objects after .lean().
  const tried = new Set<string>();
  const stages: any[] = [];
  for (const key of stageCandidates) {
    if (tried.has(key)) continue;
    tried.add(key);
    if (studentAnswers[key]) stages.push(studentAnswers[key]);
  }
  // Fall back to every top-level stage — the caller may not have named a
  // method (Overview screens re-use this resolver).
  if (stages.length === 0) {
    for (const key of Object.keys(studentAnswers)) stages.push(studentAnswers[key]);
  }

  const walk = (node: any): any | null => {
    if (!node) return null;
    if (Array.isArray(node)) {
      for (const item of node) {
        if (matchId(item)) return item;
      }
      for (const item of node) {
        const found = walk(item);
        if (found) return found;
      }
      return null;
    }
    if (typeof node !== 'object') return null;
    for (const key of Object.keys(node)) {
      const val = node[key];
      if (Array.isArray(val)) {
        for (const item of val) if (matchId(item)) return item;
      }
    }
    for (const key of Object.keys(node)) {
      const val = node[key];
      if (val && typeof val === 'object') {
        const found = walk(val);
        if (found) return found;
      }
    }
    return null;
  };

  for (const stage of stages) {
    const found = walk(stage);
    if (found) return found;
  }
  return null;
}

// A questionAnswer counts as "progressed" once it's beyond a bare attempted
// placeholder — i.e. the student meaningfully saved or submitted work on it.
function isMeaningfulQuestion(q: any): boolean {
  if (!q) return false;
  if (q.status === 'solved' || q.status === 'submitted' || q.status === 'evaluated') return true;
  if (q.codeAnswer && String(q.codeAnswer).trim() !== '') return true;
  if (Array.isArray(q.files) && q.files.length > 0) return true;
  if (Array.isArray(q.othersFiles) && q.othersFiles.length > 0) return true;
  if (q.notionPages != null) return true;
  // 'attempted' with no captured work is the schema default when the exercise
  // is first opened — don't count it as progress on its own.
  return false;
}

export function getAttemptInfo(
  exercise: any,
  studentAnswers: Record<string, any> | undefined,
  method?: string,
  _subcategory?: string,
  opts?: ResolveOpts,
): AttemptInfo {
  const empty: AttemptInfo = {
    attemptExists: false,
    isComplete: false,
    testSubmissions: 0,
    hasProgressedQuestions: false,
    canResume: false,
    score: null,
    isGraded: false,
  };
  if (!exercise) return empty;
  const id = asId(exercise._id);
  const progress = findExerciseProgress(studentAnswers, id, method);
  if (!progress) return empty;

  const testSubmissions = Number(progress.testSubmissions || 0);
  const status = progress.status;
  const isComplete = status === 'completed' || testSubmissions >= 1;
  const hasProgressedQuestions =
    Array.isArray(progress.questions) && progress.questions.some(isMeaningfulQuestion);

  const availability = getAvailability(exercise, opts);
  // Student can continue when: attempt exists, hasn't been finalised, and the
  // window still lets them submit — that includes grace-period and
  // late-attempt when configured.
  const canResume = !isComplete && (
    availability.status === 'available' ||
    availability.status === 'grace-period' ||
    availability.status === 'late-attempt'
  );

  // Look for a numeric grade on the progress row. The server doesn't ship a
  // dedicated per-student `graded` flag yet, so treat presence of an explicit
  // score as the only reliable graded signal.
  let score: number | null = null;
  if (typeof progress.score === 'number' && progress.score > 0) score = progress.score;
  else if (typeof progress.totalScore === 'number' && progress.totalScore > 0) score = progress.totalScore;
  const isGraded = isComplete && score != null;

  return {
    attemptExists: true,
    isComplete,
    testSubmissions,
    hasProgressedQuestions,
    canResume,
    score,
    isGraded,
  };
}

// ─── Resolver ───────────────────────────────────────────────────────────────

const CHIP: Record<AssignmentStateKind, { label: string; tone: StatusPillTone }> = {
  upcoming:     { label: 'Pending',     tone: 'neutral' },
  active:       { label: 'Active',      tone: 'success' },
  'due-soon':   { label: 'Due soon',    tone: 'warn' },
  'in-progress':{ label: 'In progress', tone: 'info' },
  submitted:    { label: 'Submitted',   tone: 'success' },
  graded:       { label: 'Graded',      tone: 'success' },
  missed:       { label: 'Missed',      tone: 'danger' },
  closed:       { label: 'Closed',      tone: 'neutral' },
};

function actionFor(kind: AssignmentStateKind, attempt: AttemptInfo): { label: string | null; kind: ActionKind } {
  switch (kind) {
    case 'graded':      return { label: 'View feedback', kind: 'text' };
    case 'submitted':   return { label: 'View submission', kind: 'text' };
    case 'missed':
    case 'closed':      return { label: 'Closed', kind: 'disabled' };
    case 'in-progress': return { label: 'Continue', kind: 'primary' };
    case 'due-soon':
    case 'active':      return { label: 'Start', kind: 'secondary' };
    case 'upcoming':    return { label: 'Not available', kind: 'disabled' };
    default:            return { label: null, kind: 'none' };
  }
}

export function resolveAssignmentState(
  exercise: any,
  studentAnswers: Record<string, any> | undefined,
  method?: string,
  subcategory?: string,
  opts?: ResolveOpts,
): ResolvedState {
  const now = opts?.now ?? Date.now();
  const dueSoonMs = opts?.dueSoonThresholdMs ?? DEFAULT_DUE_SOON_MS;
  const availability = getAvailability(exercise, { now });
  const attempt = getAttemptInfo(exercise, studentAnswers, method, subcategory, { now });

  // Highest priority: graded, then submitted. Both mean "final submission
  // is in" — the student's work is done regardless of the availability window.
  if (attempt.isGraded) {
    const state: ResolvedState = {
      kind: 'graded',
      label: CHIP.graded.label,
      tone: CHIP.graded.tone,
      labelSuffix: attempt.score != null ? ` · ${attempt.score}%` : '',
      actionLabel: 'View feedback',
      actionKind: 'text',
      isUrgent: false,
      availability,
      attempt,
    };
    return state;
  }
  if (attempt.isComplete) {
    return {
      kind: 'submitted',
      label: CHIP.submitted.label,
      tone: CHIP.submitted.tone,
      labelSuffix: '',
      actionLabel: 'View submission',
      actionKind: 'text',
      isUrgent: false,
      availability,
      attempt,
    };
  }

  // Past deadline with no valid final submission. Distinguish "missed" (no
  // attempt at all) from "closed" (attempt exists but never finalised); both
  // land on the same disabled "Closed" action so the row doesn't dead-end
  // into an em-dash.
  if (availability.status === 'expired' && !attempt.canResume) {
    const kind: AssignmentStateKind = attempt.attemptExists ? 'closed' : 'missed';
    const act = actionFor(kind, attempt);
    return {
      kind,
      label: CHIP[kind].label,
      tone: CHIP[kind].tone,
      labelSuffix: '',
      actionLabel: act.label,
      actionKind: act.kind,
      isUrgent: false,
      availability,
      attempt,
    };
  }

  // Attempted, resumable, not yet final → In Progress (Continue). This wins
  // over Due Soon so a partially-done row never shows "Start" while an
  // unfinished draft is on the server.
  if (attempt.canResume && (attempt.attemptExists || attempt.hasProgressedQuestions)) {
    return {
      kind: 'in-progress',
      label: CHIP['in-progress'].label,
      tone: CHIP['in-progress'].tone,
      labelSuffix: '',
      actionLabel: 'Continue',
      actionKind: 'primary',
      isUrgent: true,
      availability,
      attempt,
    };
  }

  // Available but not started — split active vs due-soon on whether the
  // deadline is inside the threshold. Only relevant when no attempt exists.
  if (availability.canStart) {
    const ends = availability.endTime ? availability.endTime.getTime() : null;
    if (ends != null && ends - now <= dueSoonMs && ends - now > 0) {
      return {
        kind: 'due-soon',
        label: CHIP['due-soon'].label,
        tone: CHIP['due-soon'].tone,
        labelSuffix: '',
        actionLabel: 'Start',
        actionKind: 'secondary',
        isUrgent: false,
        availability,
        attempt,
      };
    }
    return {
      kind: 'active',
      label: CHIP.active.label,
      tone: CHIP.active.tone,
      labelSuffix: '',
      actionLabel: 'Start',
      actionKind: 'secondary',
      isUrgent: false,
      availability,
      attempt,
    };
  }

  // Window hasn't opened yet.
  return {
    kind: 'upcoming',
    label: CHIP.upcoming.label,
    tone: CHIP.upcoming.tone,
    labelSuffix: '',
    actionLabel: 'Not available',
    actionKind: 'disabled',
    isUrgent: false,
    availability,
    attempt,
  };
}

// ─── Filter grouping (spec §"Search and filters") ───────────────────────────

export type FilterChip = 'all' | 'active' | 'submitted' | 'pending' | 'missed';

export function matchesChip(kind: AssignmentStateKind, chip: FilterChip): boolean {
  if (chip === 'all') return true;
  if (chip === 'active') return kind === 'active' || kind === 'due-soon' || kind === 'in-progress';
  if (chip === 'submitted') return kind === 'submitted' || kind === 'graded';
  if (chip === 'pending') return kind === 'upcoming';
  if (chip === 'missed') return kind === 'missed' || kind === 'closed';
  return true;
}

// ─── Date formatting (spec §"Due-date presentation") ────────────────────────

export interface FormattedDeadline {
  headline: string;              // "Due today" / "Due tomorrow" / "Due Sep 7, 2026" / "Submitted Aug 29, 2026" / "Closed Aug 8, 2026"
  timeLine: string;              // "6:00 PM"
  variant: 'today' | 'tomorrow' | 'future' | 'submitted' | 'closed' | 'none';
}

function sameLocalDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
}

function addDaysLocal(d: Date, n: number): Date {
  const c = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  c.setDate(c.getDate() + n);
  return c;
}

/**
 * The Due date column's two-line copy for one row. Uses LOCAL calendar dates
 * to decide "today" vs "tomorrow" (never simply "< 24h from now"). The
 * variant drives colour so the caller doesn't have to inspect the string.
 */
export function formatDeadline(state: ResolvedState, opts?: ResolveOpts): FormattedDeadline {
  const nowMs = opts?.now ?? Date.now();
  const now = new Date(nowMs);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = addDaysLocal(today, 1);
  const time = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const shortDate = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  // Submitted / graded — headline shows when the student submitted.
  if (state.kind === 'submitted' || state.kind === 'graded') {
    // We don't currently carry `submittedAt` on the exercise row shape used
    // here; fall back to the end date so the second line is never blank.
    const end = state.availability.endTime;
    if (end) {
      return { headline: `Submitted ${shortDate(end)}`, timeLine: time(end), variant: 'submitted' };
    }
    return { headline: 'Submitted', timeLine: '', variant: 'submitted' };
  }

  // Missed / closed — headline shows when the window closed.
  if (state.kind === 'missed' || state.kind === 'closed') {
    const end = state.availability.endTime;
    if (end) {
      return { headline: `Closed ${shortDate(end)}`, timeLine: time(end), variant: 'closed' };
    }
    return { headline: 'Closed', timeLine: '', variant: 'closed' };
  }

  const end = state.availability.endTime;
  if (!end) return { headline: 'No deadline', timeLine: '', variant: 'none' };

  if (sameLocalDate(end, today))    return { headline: 'Due today',    timeLine: time(end), variant: 'today' };
  if (sameLocalDate(end, tomorrow)) return { headline: 'Due tomorrow', timeLine: time(end), variant: 'tomorrow' };
  return { headline: `Due ${shortDate(end)}`, timeLine: time(end), variant: 'future' };
}
