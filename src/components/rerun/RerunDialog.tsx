'use client';

// RerunDialog — pops when the teacher clicks Rerun. Asks whether to rerun
// against ALL programming questions in this exercise or only the "recently
// edited" subset (questions edited after at least one student had submitted).
//
// While a rerun is executing, this same dialog shows live progress and a
// summary at the end.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Loader2, Check, AlertCircle, Zap, ListChecks } from 'lucide-react';
import { rerunApi, RerunContext, RerunBatchRequest } from '@/apiServices/rerunApi';
import { runRerunBatch, RerunProgress } from './rerunExecutor';
import { toast } from 'react-hot-toast';

type Mode = 'idle' | 'loading-context' | 'choose' | 'running' | 'submitting' | 'done';

export interface RerunDialogProps {
  open: boolean;
  onClose: () => void;
  // Identifiers required to fetch context + submit results.
  courseId: string;
  exerciseId: string;
  category: 'I_Do' | 'We_Do' | 'You_Do';
  subcategory: string;
  nodeId: string;
  nodeType: string;
  // Optional: constrain the rerun to a single student.
  singleUserId?: string;
  singleUserName?: string;
  onCompleted?: () => void;
}

export function RerunDialog(props: RerunDialogProps) {
  const {
    open, onClose,
    courseId, exerciseId, category, subcategory, nodeId, nodeType,
    singleUserId, singleUserName, onCompleted,
  } = props;

  const [mode, setMode] = useState<Mode>('idle');
  const [ctx, setCtx] = useState<RerunContext | null>(null);
  const [choice, setChoice] = useState<'all' | 'recentlyEdited'>('all');
  const [progress, setProgress] = useState<RerunProgress | null>(null);
  const [summary, setSummary] = useState<{ updated: number; failed: number; flagsCleared: number; skipped: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Fetch context when dialog opens.
  useEffect(() => {
    if (!open) return;
    setMode('loading-context');
    setSummary(null);
    setProgress(null);
    rerunApi.getContext({ exerciseId, courseId, category, subcategory, nodeId, nodeType })
      .then(c => {
        setCtx(c);
        setMode('choose');
      })
      .catch(err => {
        toast.error(err?.response?.data?.message || 'Failed to load rerun context');
        onClose();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const recentlyEditedQuestions = useMemo(() =>
    (ctx?.questions ?? []).filter(q => !!q.lastEditedAfterSubmissionAt),
  [ctx]);

  const allEligibleQuestions = useMemo(() =>
    (ctx?.questions ?? []).filter(q => (q.submissionCount ?? 0) > 0),
  [ctx]);

  const questionsToRun = choice === 'recentlyEdited' ? recentlyEditedQuestions : allEligibleQuestions;
  const submissionsToRun = useMemo(() => {
    if (!ctx) return [];
    const qSet = new Set(questionsToRun.map(q => String(q._id)));
    // Defensive: guard against a malformed server response where `submissions`
    // is missing or not an array — .filter would blow up otherwise.
    const list = Array.isArray(ctx.submissions) ? ctx.submissions : [];
    return list.filter(s =>
      qSet.has(String(s.questionId)) &&
      (singleUserId ? String(s.userId) === String(singleUserId) : true)
    );
  }, [ctx, questionsToRun, singleUserId]);

  const evaluationMethod = ctx?.evaluationMethod?.method ?? null;

  const canRun = ctx && questionsToRun.length > 0 && submissionsToRun.length > 0
    && (evaluationMethod === 'testcase' || evaluationMethod === 'ai');

  const startRerun = async () => {
    if (!ctx || !canRun) return;
    setMode('running');
    abortRef.current = new AbortController();
    try {
      const batch = await runRerunBatch({
        context: ctx,
        questionIds: questionsToRun.map(q => String(q._id)),
        userIds: singleUserId ? [singleUserId] : undefined,
        onProgress: p => setProgress({ ...p }),
        signal: abortRef.current.signal,
      });

      if (batch.updates.length === 0) {
        toast(`Nothing to update — ${batch.progress.skipped} skipped, ${batch.progress.errored} errored`, { icon: 'ℹ️' });
        setSummary({ updated: 0, failed: 0, flagsCleared: 0, skipped: batch.progress.skipped });
        setMode('done');
        return;
      }

      setMode('submitting');
      const req: RerunBatchRequest = {
        courseId, exerciseId, category, subcategory, nodeId, nodeType,
        updates: batch.updates,
        // Only clear flags when rerunning "recently edited" for ALL students —
        // a single-student rerun doesn't fully sync the question.
        clearFlagsForQuestionIds: (!singleUserId && choice === 'recentlyEdited')
          ? recentlyEditedQuestions.map(q => String(q._id))
          : undefined,
      };
      const resp = await rerunApi.submit(req);
      setSummary({
        updated: resp.updated,
        failed: resp.failed?.length ?? 0,
        flagsCleared: resp.flagsCleared ?? 0,
        skipped: batch.progress.skipped,
      });
      setMode('done');
      toast.success(`Rerun done — ${resp.updated} scores updated`);
      onCompleted?.();
    } catch (err: any) {
      if (err?.message === 'aborted') {
        toast('Rerun cancelled', { icon: '⏹️' });
        setMode('choose');
        return;
      }
      toast.error(err?.response?.data?.message || err?.message || 'Rerun failed');
      setMode('choose');
    }
  };

  const cancelRunning = () => {
    abortRef.current?.abort();
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(3px)',
      }}
    >
      <div style={{
        background: '#fff', borderRadius: 16, width: 'min(560px, 92vw)',
        boxShadow: '0 24px 48px rgba(15,23,42,0.28)', overflow: 'hidden',
        fontFamily: "'Poppins','Inter',sans-serif",
      }}>
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #eef0f4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: '#E8640C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={16} style={{ color: '#fff' }} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>Rerun scoring</div>
              <div style={{ fontSize: 11.5, color: '#64748b' }}>
                {singleUserName ? `For ${singleUserName}` : 'For all students in this exercise'}
              </div>
            </div>
          </div>
          {mode !== 'running' && mode !== 'submitting' && (
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
              <X size={18} />
            </button>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: '18px 22px', minHeight: 200 }}>
          {mode === 'loading-context' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '40px 0', color: '#64748b' }}>
              <Loader2 size={22} className="animate-spin" style={{ color: '#E8640C' }} />
              <div style={{ fontSize: 12.5 }}>Fetching submissions and current test cases…</div>
            </div>
          )}

          {mode === 'choose' && ctx && (
            <div>
              {evaluationMethod === 'manual' && (
                <div style={{ padding: 12, borderRadius: 10, background: '#fef3c7', color: '#92400e', fontSize: 12, display: 'flex', gap: 8 }}>
                  <AlertCircle size={14} /> This exercise uses <strong>Manual</strong> evaluation — nothing to rerun. Scores must be entered by hand.
                </div>
              )}
              {evaluationMethod !== 'manual' && (
                <>
                  <div style={{ fontSize: 12.5, color: '#334155', marginBottom: 12 }}>
                    Choose what to rerun. Rerun re-executes each student's stored code against the question's <strong>current</strong> test cases and overwrites the stored score. Previous scores are kept in an audit history.
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={choiceRowStyle(choice === 'all')} onClick={() => setChoice('all')}>
                      <input type="radio" checked={choice === 'all'} onChange={() => setChoice('all')} style={{ accentColor: '#E8640C' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>Rerun all questions</div>
                        <div style={{ fontSize: 11.5, color: '#64748b' }}>
                          {allEligibleQuestions.length} question{allEligibleQuestions.length === 1 ? '' : 's'} × {singleUserId ? '1 student' : `${new Set((Array.isArray(ctx.submissions) ? ctx.submissions : []).map(s => s.userId)).size} students`}
                        </div>
                      </div>
                    </label>
                    <label style={choiceRowStyle(choice === 'recentlyEdited', recentlyEditedQuestions.length === 0)}
                      onClick={() => recentlyEditedQuestions.length > 0 && setChoice('recentlyEdited')}>
                      <input
                        type="radio"
                        checked={choice === 'recentlyEdited'}
                        onChange={() => setChoice('recentlyEdited')}
                        disabled={recentlyEditedQuestions.length === 0}
                        style={{ accentColor: '#E8640C' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: recentlyEditedQuestions.length === 0 ? '#94a3b8' : '#0F172A' }}>
                          Rerun recently edited questions
                          {recentlyEditedQuestions.length > 0 && (
                            <span style={{ marginLeft: 8, background: '#E8640C', color: '#fff', fontSize: 10, padding: '2px 6px', borderRadius: 10 }}>
                              {recentlyEditedQuestions.length}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11.5, color: '#64748b' }}>
                          {recentlyEditedQuestions.length === 0
                            ? 'No questions have been edited after submissions existed.'
                            : 'Only questions whose test cases changed after students submitted.'}
                        </div>
                      </div>
                    </label>
                  </div>
                </>
              )}
            </div>
          )}

          {(mode === 'running' || mode === 'submitting') && progress && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <Loader2 size={18} className="animate-spin" style={{ color: '#E8640C' }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>
                  {mode === 'running' ? 'Executing code…' : 'Saving scores…'}
                </div>
              </div>
              <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{
                  height: '100%',
                  width: `${progress.total ? Math.round((progress.completed / progress.total) * 100) : 0}%`,
                  background: 'linear-gradient(90deg, #E8640C, #f59e0b)',
                  transition: 'width 120ms',
                }} />
              </div>
              <div style={{ fontSize: 11.5, color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                <span>{progress.completed} / {progress.total} submissions processed</span>
                <span>{progress.scored} scored · {progress.skipped} skipped · {progress.errored} errored</span>
              </div>
              {progress.currentUserName && (
                <div style={{ marginTop: 8, fontSize: 11, color: '#94a3b8', display: 'flex', gap: 6, alignItems: 'center' }}>
                  <ListChecks size={12} /> Currently: <strong style={{ color: '#334155' }}>{progress.currentUserName}</strong>
                </div>
              )}
            </div>
          )}

          {mode === 'done' && summary && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={16} strokeWidth={3} style={{ color: '#16a34a' }} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Rerun complete</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Scores are updated and old values are in the audit history.</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                <StatBox label="Scores updated" value={summary.updated} tone="success" />
                <StatBox label="Skipped" value={summary.skipped} tone="muted" />
                <StatBox label="Failed to save" value={summary.failed} tone={summary.failed > 0 ? 'error' : 'muted'} />
                <StatBox label="Flags cleared" value={summary.flagsCleared} tone="muted" />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid #eef0f4', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {mode === 'choose' && (
            <>
              <button onClick={onClose} style={ghostBtn}>Cancel</button>
              <button onClick={startRerun} disabled={!canRun} style={primaryBtn(!canRun)}>
                <Zap size={13} /> Run
              </button>
            </>
          )}
          {(mode === 'running' || mode === 'submitting') && (
            <button onClick={cancelRunning} style={ghostBtn}>Cancel</button>
          )}
          {mode === 'done' && (
            <button onClick={onClose} style={primaryBtn(false)}>Close</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── styles ────────────────────────────────────────────────────────────────
function choiceRowStyle(active: boolean, disabled = false): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    padding: 12, borderRadius: 10,
    border: `1px solid ${active ? '#E8640C' : '#e5e7eb'}`,
    background: active ? 'rgba(232,100,12,0.06)' : '#fff',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
  };
}
const ghostBtn: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb',
  background: '#fff', color: '#334155', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
};
function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: '8px 14px', borderRadius: 8, border: 'none',
    background: disabled ? '#e5e7eb' : 'linear-gradient(135deg, #E8640C, #C8520A)',
    color: disabled ? '#94a3b8' : '#fff',
    fontSize: 12.5, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 6,
    boxShadow: disabled ? 'none' : '0 4px 12px rgba(232,100,12,0.28)',
  };
}
function StatBox({ label, value, tone }: { label: string; value: number; tone: 'success' | 'error' | 'muted' }) {
  const bg = tone === 'success' ? '#dcfce7' : tone === 'error' ? '#fee2e2' : '#f1f5f9';
  const fg = tone === 'success' ? '#166534' : tone === 'error' ? '#991b1b' : '#475569';
  return (
    <div style={{ background: bg, padding: '10px 12px', borderRadius: 8 }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: fg, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: fg }}>{value}</div>
    </div>
  );
}
