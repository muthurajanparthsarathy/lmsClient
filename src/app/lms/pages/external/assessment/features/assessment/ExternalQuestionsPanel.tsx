'use client';

/**
 * External Assessment → Questions.
 *
 * REUSES the shared authoring stack rather than reimplementing it: the list
 * below is External's own, but "Add Question" mounts the same
 * `component/questionforms/AddQuestionForm` the You_Do assessment uses, which
 * dispatches to MCQQuestionForm / ProgrammingQuestionForm / FrontendQuestionForm
 * / DatabaseQuestionForm / OthersAddQuestionForm exactly as it does there.
 *
 * Two adapters make that possible, and neither touches the forms:
 *   • `toExerciseData()` shapes the assessment into the exercise document the
 *     forms read for their config, quotas and source gating.
 *   • `apiServices/externalQuestionAdapter` receives every save/update/delete
 *     because `toExerciseData` tags the entity as EXTERNAL_ENTITY, which
 *     `questionApi` routes on.
 *
 * The form opened is decided by the assessment's Exercise Type, so MCQ goes
 * straight to the MCQ form and Programming straight to the programming form —
 * no intermediate chooser. Combined is the one exception: it holds both kinds,
 * so the type selector is genuinely the right question there.
 *
 * The entityType tag alone does not route every call: some child forms derive
 * their own entityType and ignore the one passed in (ProgrammingQuestionForm
 * falls back to a hardcoded 'topics'). So this panel also opens an EXTERNAL
 * AUTHORING SESSION for as long as the form is mounted — see
 * `setExternalAssessmentContext`. Every question API call in that window goes
 * to /api/admin/external, whatever the form thinks it is addressing.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Plus, Trash2, Pencil, ListChecks, AlertTriangle, Code2, Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { pageEnter } from '@/app/lms/shared/ui';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSION_IDS } from '@/app/lms/pages/usermanagement/components/permissions/index';
import AddQuestionForm from '@/app/lms/component/questionforms/AddQuestionForm';
import {
  externalAssessmentApi,
  externalAssessmentKeys,
  type ExternalAssessment,
  type ExternalQuestion,
} from '@/apiServices/externalAssessment';
import { setExternalAssessmentContext, toLmsQuestionShape } from '@/apiServices/externalQuestionAdapter';
import { toExerciseData, initialTypeFor } from './questions/toExerciseData';
import QuestionOverviewPanel from './questions/QuestionOverviewPanel';
import AddQuestionPicker, { routesForSources } from './questions/AddQuestionPicker';
import DifficultyPicker, { type Level } from './questions/DifficultyPicker';
import AssessmentDetailsModal from './AssessmentDetailsModal';
import { questionProgress, sourceQuotas, isLevelBased, levelSlots } from './questions/quota';
import type { ExternalQuestionOrigin } from '@/apiServices/externalAssessment';

// The picker's route keys → the `autoOpenSource` value AddQuestionForm reads
// to land the author on the right authoring surface instead of a blank editor.
// `document` has no dedicated surface, so it opens the manual one.
const AUTO_OPEN: Record<string, 'manual' | 'ai' | 'bank' | 'thirdParty'> = {
  scratch: 'manual',
  bank: 'bank',
  thirdParty: 'thirdParty',
  ai: 'ai',
  document: 'manual',
};

const TYPE_LABELS: Record<string, string> = {
  multiple_choice: 'Multiple Choice',
  multiple_select: 'Multiple Select',
  dropdown: 'Dropdown',
  checkboxes: 'Checkboxes',
  true_false: 'True / False',
  short_answer: 'Short Answer',
  essay: 'Essay',
  numeric: 'Numeric',
  matching: 'Matching',
  ordering: 'Ordering',
};

const LEVEL_META: Record<string, { color: string; bg: string }> = {
  easy: { color: '#059669', bg: 'rgba(5,150,105,0.10)' },
  medium: { color: '#b45309', bg: 'rgba(245,158,11,0.12)' },
  hard: { color: '#dc2626', bg: 'rgba(220,38,38,0.10)' },
};

export default function ExternalQuestionsPanel({
  assessment,
  onBack,
  onEditAssessment,
}: {
  assessment: ExternalAssessment;
  onBack: () => void;
  onEditAssessment?: () => void;
}) {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canEdit = can(PERMISSION_IDS.ADMIN_EXTERNAL_ASSESSMENT, 'Questions');

  // Add Question is a short funnel, not a single click:
  //   'source'     → which route (Manual / Bank / Other Platform / AI / Document)
  //   'difficulty' → which level, only when Step 2 configured by level
  //   'form'       → the shared authoring form, opened on the chosen surface
  // Editing an existing question skips straight to 'form' — its source and
  // level are already decided.
  const [stage, setStage] = useState<'idle' | 'source' | 'difficulty' | 'form'>('idle');
  const [pickedSource, setPickedSource] = useState<ExternalQuestionOrigin | null>(null);
  const [pickedLevel, setPickedLevel] = useState<Level | null>(null);
  const [editing, setEditing] = useState<ExternalQuestion | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ExternalQuestion | null>(null);
  // The rail's "Assessment Details" card opens a read-only view of the
  // configuration; the wizard is reachable from that view's footer.
  const [showDetails, setShowDetails] = useState(false);

  const authoring = stage === 'form';

  const closeFunnel = () => {
    setStage('idle');
    setPickedSource(null);
    setPickedLevel(null);
    setEditing(null);
  };

  const key = externalAssessmentKeys.questions(assessment._id);
  const { data, isLoading, error } = useQuery({
    queryKey: key,
    queryFn: () => externalAssessmentApi.listQuestions(assessment._id),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });

  // Prefer the freshly-fetched list; fall back to whatever the assessment
  // record carried so the quota panel is populated on first paint.
  const questions = data?.questions ?? assessment.questions ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: key });
    queryClient.invalidateQueries({ queryKey: externalAssessmentKeys.lists() });
    queryClient.invalidateQueries({ queryKey: externalAssessmentKeys.detail(assessment._id) });
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => externalAssessmentApi.deleteQuestion(assessment._id, id),
    onSuccess: () => {
      toast.success('Question deleted', { position: 'top-right', duration: 1800 });
      invalidate();
      setConfirmDelete(null);
    },
    onError: (err: any) =>
      toast.error(err?.message || 'Could not delete the question', { position: 'top-right', duration: 4000 }),
  });

  const progress = useMemo(
    () => questionProgress(assessment, questions),
    [assessment, questions],
  );

  /**
   * Open an External authoring session while the shared form is mounted.
   *
   * This is what actually guarantees "same UI, separate API": every question
   * call the form makes during this window is served by /api/admin/external,
   * even from a child form that derives its own entityType and never reads the
   * one we pass. Cleared on unmount so a later LMS authoring session is
   * unaffected — the cleanup runs on Back, on close, and if the component
   * unmounts for any other reason.
   */
  // Opened during RENDER, not in the effect below, and this ordering matters:
  // AddQuestionForm is a CHILD of this panel, and React runs child effects
  // before parent effects. An effect here would therefore still be pending
  // while the form's own mount effect fired its first
  // `exerciseApi.getExerciseById` — that call went out with no session open,
  // took the LMS path and 404'd on `/exercise/<assessmentId>`.
  //
  // It only showed up sometimes because the second open of the same assessment
  // is rescued by the id set: by then the id has been registered, so the late
  // call routes correctly. The FIRST open after a page load had nothing to fall
  // back on. Setting it here closes that window — the session is open before
  // the form exists to call anything.
  //
  // Safe to run on every render: assigning a module-level id is idempotent and
  // touches no React state, so a re-render (or StrictMode's double invoke)
  // cannot loop or tear.
  if (authoring) setExternalAssessmentContext(assessment._id);

  // Cleanup only — closes the session on Back, on close, and on any other
  // unmount, so a later LMS authoring session is unaffected.
  useEffect(() => {
    if (!authoring) return;
    return () => setExternalAssessmentContext(null);
  }, [authoring, assessment._id]);

  // MCQ → the MCQ form, Programming → the programming form, no chooser in
  // between. Combined returns null, which is what makes the form show its
  // type selector — the only case where that question is genuine.
  const initialType = initialTypeFor(assessment);

  // Which kind the funnel is authoring, for the level counts and the exercise
  // document below.
  const funnelKind: 'mcq' | 'programming' = initialType === 'programming' ? 'programming' : 'mcq';

  // The exercise document the shared form reads. Rebuilt whenever the written
  // questions change so its "remaining" counters stay honest mid-session.
  //
  // The KIND matters: `toExerciseData` counts only questions of the kind being
  // authored, so passing 'mcq' for a Programming paper counted zero of its
  // programming questions and the form's panel read "Created 0/5" next to a
  // list of four. Editing uses the question's own kind; adding uses the kind
  // the exercise type routes to.
  const exerciseData = useMemo(
    () => toExerciseData(
      assessment,
      questions,
      editing
        ? (editing.questionKind === 'programming' ? 'programming' : 'mcq')
        : funnelKind,
    ),
    [assessment, questions, editing, funnelKind],
  );

  // Routes Step 3 actually enabled, and how many each has left.
  const availableSources = useMemo(
    () => routesForSources(assessment.questionSources as string[] | undefined),
    [assessment.questionSources],
  );
  const quotas = useMemo(
    () => sourceQuotas(assessment, questions),
    [assessment, questions],
  );

  const levelMode = isLevelBased(assessment);
  const slots = useMemo(
    () => levelSlots(assessment, questions, funnelKind),
    [assessment, questions, funnelKind],
  );

  /** Source chosen → ask the level next, or go straight to the form. */
  const onSourcePicked = (source: ExternalQuestionOrigin) => {
    setPickedSource(source);
    setStage(levelMode ? 'difficulty' : 'form');
  };

  /**
   * Is the paper full?
   *
   * Only when a quota was actually configured — `total === 0` means the author
   * never said how many questions this assessment holds, which is "unlimited
   * so far", not "full". Getting that backwards would lock Add Question on a
   * brand-new assessment.
   */
  const quotaFull = progress.total > 0 && progress.remaining === 0;
  const addDisabled = !canEdit || quotaFull;

  // ── Authoring: hand the whole surface to the shared form ──
  if (authoring) {
    return (
      <AddQuestionForm
        exerciseData={exerciseData}
        tabType="You_Do"
        breadcrumbs={[{ name: assessment.assessmentName, type: 'assessment' }]}
        // Reopening an existing question puts the form in edit mode against
        // the same id the External API keys on.
        //
        // MAPPED, not raw: AddQuestionForm infers which form to open from
        // `initialData.questionType`, and falls back to an MCQ heuristic that
        // matches anything carrying `mcqQuestionScore`. External programming
        // questions carry that (one score field serves both kinds), so a raw
        // payload opened a programming question in the MCQ form — blank, with
        // the MCQ config's counters. The mapper sets questionType and moves the
        // code fields onto the names the editor reads.
        initialData={editing ? toLmsQuestionShape(editing) : undefined}
        isEditing={!!editing}
        initialQuestionId={editing?._id}
        // Combined shows the selector; every other type is already decided.
        showTypeSelector={assessment.exerciseType === 'Combined'}
        // Both already answered by the funnel, so the form does not ask again:
        // it opens on the chosen surface at the chosen level.
        autoOpenSource={pickedSource ? AUTO_OPEN[pickedSource] : undefined}
        initialDifficulty={(editing?.mcqQuestionLevel as any) || pickedLevel || undefined}
        onEditExercise={onEditAssessment}
        onClose={() => { closeFunnel(); invalidate(); }}
        onSave={() => { invalidate(); }}
      />
    );
  }

  return (
    <div className="min-h-full h-full flex">
      <div className="flex-1 min-w-0 flex flex-col">
        <motion.div
          variants={pageEnter} initial="hidden" animate="visible"
          className="flex flex-1 min-h-0 flex-col px-4 sm:px-6 lg:px-8 pt-3 pb-3 text-body"
        >
          {/* ── Header ── */}
          <header className="shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button" onClick={onBack} title="Back to assessments"
                className="inline-flex size-8 items-center justify-center rounded-control text-subtle hover:bg-row-hover hover:text-heading transition-colors shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="min-w-0">
                <h1 className="text-base font-semibold text-heading leading-tight truncate">
                  {assessment.assessmentName}
                </h1>
                <p className="text-[11px] text-subtle">
                  Questions · <span className="tabular-nums">{progress.created}</span>
                  {progress.total > 0 && <span className="text-faint">/{progress.total}</span>}
                  {' · '}
                  <span className="tabular-nums">{progress.marks.used}</span>
                  {progress.marks.total > 0 && <span className="text-faint">/{progress.marks.total}</span>} marks
                </p>
              </div>
              {canEdit && (
                <div className="ml-auto flex items-center gap-2 shrink-0">
                  {/* Say WHY the button is off rather than leaving a dead
                      control — "all 5 added" is the whole explanation. */}
                  {quotaFull && (
                    <span
                      className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] font-semibold"
                      style={{ background: 'rgba(16,185,129,0.12)', color: '#059669' }}
                    >
                      <Check size={12} strokeWidth={3} />
                      All {progress.total} added
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={addDisabled}
                    title={quotaFull
                      ? `This assessment is configured for ${progress.total} question${progress.total === 1 ? '' : 's'} — all of them are added. Raise the count on Step 2 to add more.`
                      : undefined}
                    onClick={() => {
                      if (addDisabled) return;
                      setEditing(null); setPickedSource(null); setPickedLevel(null); setStage('source');
                    }}
                    className={`inline-flex items-center gap-1.5 h-8 px-3.5 rounded-control text-white shadow-sm transition-colors ${
                      addDisabled
                        ? 'bg-ink-300 cursor-not-allowed opacity-60'
                        : 'bg-brand-strong hover:bg-brand-800'
                    }`}
                  >
                    <Plus size={14} strokeWidth={2.4} />
                    <span className="text-xs font-semibold">
                      {quotaFull ? 'Slots full' : 'Add Question'}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </header>

          {/* ── List ── */}
          <div className="mt-3 flex-1 min-h-0 overflow-y-auto">
            {error ? (
              <div className="m-4 p-4 rounded-tile border border-danger-500/20 bg-danger-50 text-center">
                <AlertTriangle className="mx-auto h-5 w-5 text-danger-700" />
                <p className="mt-2 text-sm font-medium text-danger-700">
                  {(error as any)?.message || 'Could not load questions'}
                </p>
              </div>
            ) : isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-tile bg-ink-100 animate-pulse" />
                ))}
              </div>
            ) : questions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-wash text-brand-strong border border-dashed border-brand-500/40">
                  {initialType === 'programming' ? <Code2 size={22} strokeWidth={1.5} /> : <ListChecks size={22} strokeWidth={1.5} />}
                </span>
                <p className="mt-4 text-sm font-bold text-heading">No questions yet</p>
                <p className="mt-1 text-[11px] text-subtle max-w-[280px] leading-relaxed">
                  {progress.total > 0
                    ? `This assessment is configured for ${progress.total} question${progress.total === 1 ? '' : 's'}. Add the first one to get started.`
                    : 'Add at least one question — an assessment cannot be published without one.'}
                </p>
                {canEdit && (
                  <button
                    onClick={() => { setEditing(null); setPickedSource(null); setPickedLevel(null); setStage('source'); }}
                    className="mt-4 inline-flex items-center gap-1.5 h-9 px-5 rounded-control bg-brand-strong text-white text-xs font-bold shadow-sm hover:bg-brand-800 transition-colors"
                  >
                    <Plus size={12} strokeWidth={2.5} /> Add Question
                  </button>
                )}
              </div>
            ) : (
              <ol className="space-y-2">
                {questions.map((q, i) => {
                  const isCode = q.questionKind === 'programming';
                  const lvl = LEVEL_META[q.mcqQuestionLevel || 'easy'] || LEVEL_META.easy;
                  const title = isCode
                    ? (q.title || q.mcqQuestionTitle)
                    : q.mcqQuestionTitle;
                  return (
                    <li
                      key={q._id || i}
                      className="group flex items-start gap-3 rounded-tile border border-hairline bg-surface px-3 py-2.5 hover:bg-row-hover transition-colors"
                    >
                      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-canvas text-[10px] font-bold text-subtle tabular-nums">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-heading break-words">
                          {title || <span className="text-faint italic">Untitled question</span>}
                        </p>
                        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                          <span
                            className="inline-flex items-center gap-1 h-5 rounded-full px-2 text-[10px] font-semibold"
                            style={isCode
                              ? { background: 'rgba(124,58,237,0.10)', color: '#7c3aed' }
                              : { background: '#f1f5f9', color: '#475569' }}
                          >
                            {isCode ? <><Code2 size={9} /> Programming</> : (TYPE_LABELS[q.mcqQuestionType] || q.mcqQuestionType)}
                          </span>
                          <span
                            className="inline-flex h-5 items-center rounded-full px-2 text-[10px] font-semibold capitalize"
                            style={{ background: lvl.bg, color: lvl.color }}
                          >
                            {q.mcqQuestionLevel || 'easy'}
                          </span>
                          <span className="inline-flex h-5 items-center rounded-full bg-canvas px-2 text-[10px] font-semibold text-subtle tabular-nums">
                            {q.mcqQuestionScore ?? 0} mark{(q.mcqQuestionScore ?? 0) === 1 ? '' : 's'}
                          </span>
                          {isCode && (q.testCases?.length ?? 0) > 0 && (
                            <span className="inline-flex h-5 items-center rounded-full bg-canvas px-2 text-[10px] font-semibold text-subtle tabular-nums">
                              {q.testCases!.length} test case{q.testCases!.length === 1 ? '' : 's'}
                            </span>
                          )}
                        </div>
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-1 shrink-0 transition-opacity">
                          <button
                            type="button" title="Edit question"
                            onClick={() => { setEditing(q); setStage('form'); }}
                            className="inline-flex size-7 items-center justify-center rounded-control text-subtle hover:bg-ink-100 hover:text-heading transition-colors"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button" title="Delete question" onClick={() => setConfirmDelete(q)}
                            className="inline-flex size-7 items-center justify-center rounded-control text-subtle hover:bg-danger-50 hover:text-danger-700 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </motion.div>
      </div>

      {/* ── Quota rail ── */}
      <QuestionOverviewPanel
        assessment={assessment}
        questions={questions}
        onOpenDetails={() => setShowDetails(true)}
      />

      {/* ── Assessment Details (read-only) ── */}
      <AssessmentDetailsModal
        open={showDetails}
        assessment={assessment}
        questions={questions}
        onClose={() => setShowDetails(false)}
        onEdit={onEditAssessment}
      />

      {/* ── Add Question funnel: source → (level) → form ── */}
      <AddQuestionPicker
        open={stage === 'source'}
        assessmentName={assessment.assessmentName}
        kindLabel={funnelKind === 'programming' ? 'Programming question' : 'MCQ'}
        quotas={quotas}
        availableSources={availableSources}
        onPick={onSourcePicked}
        onClose={closeFunnel}
      />

      <DifficultyPicker
        open={stage === 'difficulty'}
        assessmentName={assessment.assessmentName}
        slots={slots}
        onPick={(level) => { setPickedLevel(level); setStage('form'); }}
        // Back returns to the source list rather than closing — the author is
        // mid-funnel, not done with it.
        onBack={() => setStage('source')}
        onClose={closeFunnel}
      />


      {/* ── Delete confirmation ── */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
          style={{ background: 'rgba(30,41,59,0.55)', backdropFilter: 'blur(4px)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirmDelete(null); }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-2xl">
            <h3 className="text-sm font-bold text-heading">Delete this question?</h3>
            <p className="mt-1 text-xs text-subtle leading-relaxed break-words">
              {confirmDelete.title || confirmDelete.mcqQuestionTitle || 'Untitled question'}
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button" onClick={() => setConfirmDelete(null)}
                className="h-8 px-3 rounded-control border border-hairline-strong bg-surface text-xs font-medium text-body hover:bg-row-hover transition-colors"
              >
                Cancel
              </button>
              <button
                type="button" disabled={deleteMutation.isPending}
                onClick={() => confirmDelete._id && deleteMutation.mutate(confirmDelete._id)}
                className="h-8 px-3 rounded-control bg-danger-500 text-white text-xs font-semibold hover:bg-danger-700 disabled:opacity-60 transition-colors"
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
