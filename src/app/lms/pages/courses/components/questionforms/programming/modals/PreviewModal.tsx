// Saved-questions preview — a right-side panel that lets the teacher scroll
// through every saved question with in-line jump, edit, and delete actions.
// Extracted 2026-08-30.
import React, { useState } from 'react';
import {
  X, Award, BarChart3, Check, ChevronRight, ChevronDown, ChevronUp,
  Edit2, Eye, FileText, Hash, Trash2,
} from 'lucide-react';
import type { FlowQuestion, Diff } from '../types';
import { DS } from '../constants';
import { fmtMark, getTitleText } from '../utils/blocksHelpers';
import { QuestionFormBreadcrumb } from '../components/Breadcrumb';
import { DeleteConfirmDialog } from './Dialogs';

// ─── PREVIEW MODAL ─────────────────────────────────────────────────────────────

export const PreviewModal: React.FC<{
  questions: FlowQuestion[]; currentIndex: number; isGeneral: boolean; exerciseData: any;
  onJump: (idx: number) => void; onDelete: (localId: string) => void;
  onClose: () => void; onDone: () => void;
  hierarchyData: any; tabType: string; subcategory?: string; subcategoryLabel?: string;
  exerciseName: string; actionLabel: string; questionLabel: string;
  currentDiff: Diff; score: number; generalMPQ: number;
  totalSlots: number; createdCount: number; remainingSlots: number;
  isScoreEditable: (d: Diff) => boolean; getFixedScore: (d: Diff) => number;
  getConfiguredDiffs: () => Diff[]; getRemainingSlots: (d?: Diff, withFlow?: FlowQuestion[]) => number;
  getDbQuestionsForDiff: (d?: Diff) => any[]; getQuotaForDiff: (d: Diff) => number;
  getCreatedCount: (d?: Diff) => number;
  getTotalMarksForDiff: (d: Diff) => number; usedMarks: number;
  onDiffRowClick: (d: Diff) => void; cfgType: string;
  totalMarksAll: number; usedMarksAll: number; displayScore: number;
  remainingMarks: number; totalMarksForDiff: number;
  totalSlotsAll: number; createdCountAll: number; remainingSlotsAll: number;
}> = ({
  questions, currentIndex, isGeneral, exerciseData,
  onJump, onDelete, onClose, onDone,
  hierarchyData, tabType, subcategory, subcategoryLabel,
  exerciseName, actionLabel, questionLabel,
  currentDiff, score, generalMPQ, totalSlots, createdCount, remainingSlots,
  isScoreEditable, getFixedScore,
  cfgType, getConfiguredDiffs, getRemainingSlots, getQuotaForDiff,
  getCreatedCount, getTotalMarksForDiff, usedMarks,
  totalMarksAll, usedMarksAll, displayScore, remainingMarks, totalMarksForDiff,
  totalSlotsAll, createdCountAll, remainingSlotsAll,
}) => {
    const [expandedSet, setExpandedSet] = useState<Set<number>>(new Set());
    const [deleteTarget, setDeleteTarget] = useState<{ localId: string; title: string } | null>(null);
    const [filterDiff, setFilterDiff] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');
    const [sidebarTab, setSidebarTab] = useState<'details' | 'overview' | null>(null);

    const s = DS[currentDiff] || DS.medium;
    const subIsSelectionLevel = cfgType === 'selectionLevel';
    const subExerciseIsGraded = !subIsSelectionLevel && (exerciseData?.fullExerciseData?.isGraded !== false);

    // Get unique difficulties present in saved questions
    const savedQuestions = questions.filter(q => !!(q._id || q.isSaved || q.isPreExisting));
    const availableDiffs = (['easy', 'medium', 'hard'] as const).filter(d =>
      savedQuestions.some(q => q.difficulty === d)
    );

    // Apply filter + group by difficulty. When filter is "all" and the exercise
    // is level-based (not General), display Easy → Medium → Hard so a card
    // added later still surfaces with its siblings — otherwise a bank pick or
    // manual add that happens after a different-difficulty entry sits in
    // insertion order (e.g. E1, E2, M1, E3) instead of grouped (E1, E2, E3, M1).
    // Insertion order is preserved WITHIN each difficulty via Array#sort's
    // stability guarantee. General mode keeps insertion order since it has no
    // meaningful difficulty grouping.
    const DIFF_ORDER: Record<string, number> = { easy: 0, medium: 1, hard: 2 };
    const filteredSavedQuestions = savedQuestions
      .filter(q => filterDiff === 'all' ? true : q.difficulty === filterDiff)
      .slice()
      .sort((a, b) => {
        if (isGeneral || filterDiff !== 'all') return 0; // preserve incoming order
        const ai = DIFF_ORDER[a.difficulty ?? 'medium'] ?? 1;
        const bi = DIFF_ORDER[b.difficulty ?? 'medium'] ?? 1;
        return ai - bi;
      });

    return (
      <>
        {/* Exercise Details Modal */}
        {sidebarTab === 'details' && (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,15,30,0.45)', backdropFilter: 'blur(2px)' }}
            onClick={e => { if (e.target === e.currentTarget) setSidebarTab(null as any); }}>
            <div style={{ background: 'var(--lms-bg-white)', borderRadius: 'var(--lms-radius-lg)', boxShadow: '0 20px 56px rgba(0,0,0,0.20)', width: 360, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '13px 16px', borderBottom: '1.5px solid var(--lms-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--lms-bg-surface)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <FileText size={14} style={{ color: 'var(--lms-text-sec)' }} />
                  <span style={{ fontFamily: 'var(--lms-font)', fontSize: 13, fontWeight: 700, color: 'var(--lms-text-main)' }}>Exercise Details</span>
                </div>
                <button type="button" onClick={() => setSidebarTab(null as any)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--lms-text-muted)', display: 'flex', padding: 4, borderRadius: 6 }}>
                  <X size={15} />
                </button>
              </div>
              <div className="lms-sidebar-scroll" style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
                {exerciseData?.fullExerciseData?.exerciseInformation?.exerciseId && (
                  <div className="lms-detail-row" style={{ padding: '8px 16px' }}>
                    <span className="lms-detail-label">Exercise ID</span>
                    <span className="lms-detail-value" style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--lms-violet)', fontSize: 11 }}>
                      {exerciseData.fullExerciseData.exerciseInformation.exerciseId}
                    </span>
                  </div>
                )}
                <div className="lms-detail-row" style={{ padding: '8px 16px' }}>
                  <span className="lms-detail-label">Exercise Name</span>
                  <span className="lms-detail-value" style={{ color: 'var(--lms-orange)', fontSize: 11, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {exerciseName || 'Untitled'}
                  </span>
                </div>
                <div className="lms-detail-row" style={{ padding: '8px 16px' }}>
                  <span className="lms-detail-label">Exercise Type</span>
                  <span className="lms-detail-value" style={{ fontSize: 11, textTransform: 'capitalize' }}>
                    {exerciseData?.fullExerciseData?.exerciseType || 'programming'}
                  </span>
                </div>
                <div className="lms-detail-row" style={{ padding: '8px 16px' }}>
                  <span className="lms-detail-label">Configuration</span>
                  <span className="lms-detail-value" style={{ fontSize: 11 }}>
                    {isGeneral ? 'General' : cfgType === 'levelBased' ? 'Level Based' : 'Selection Level'}
                  </span>
                </div>
                <div className="lms-detail-row" style={{ padding: '8px 16px' }}>
                  <span className="lms-detail-label">Assessment Type</span>
                  <span className="lms-detail-value" style={{ fontSize: 11, fontWeight: 700, color: subExerciseIsGraded ? 'var(--lms-success)' : 'var(--lms-warning)' }}>
                    {subExerciseIsGraded ? 'Graded' : 'Non-Graded'}
                  </span>
                </div>
                {(exerciseData?.fullExerciseData?.exerciseInformation?.totalDuration || exerciseData?.fullExerciseData?.exerciseInformation?.duration) && (
                  <div className="lms-detail-row" style={{ padding: '8px 16px' }}>
                    <span className="lms-detail-label">Duration</span>
                    <span className="lms-detail-value" style={{ fontSize: 11 }}>
                      {exerciseData?.fullExerciseData?.exerciseInformation?.totalDuration || exerciseData?.fullExerciseData?.exerciseInformation?.duration} mins
                    </span>
                  </div>
                )}
              </div>
              <div style={{ padding: '10px 16px', borderTop: '1.5px solid var(--lms-border)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
                <button type="button" onClick={() => setSidebarTab(null as any)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 16px', borderRadius: 'var(--lms-radius-md)', fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 600, border: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-surface)', color: 'var(--lms-text-sec)', cursor: 'pointer' }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Exercise Overview Modal */}
        {sidebarTab === 'overview' && (() => {
          const configuredDiffs = getConfiguredDiffs();
          return (
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,15,30,0.45)', backdropFilter: 'blur(2px)' }}
              onClick={e => { if (e.target === e.currentTarget) setSidebarTab(null as any); }}>
              <div style={{ background: 'var(--lms-bg-white)', borderRadius: 'var(--lms-radius-lg)', boxShadow: '0 20px 56px rgba(0,0,0,0.20)', width: 400, maxHeight: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '13px 16px', borderBottom: '1.5px solid var(--lms-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--lms-info-bg)', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <BarChart3 size={14} style={{ color: 'var(--lms-info)' }} />
                    <span style={{ fontFamily: 'var(--lms-font)', fontSize: 13, fontWeight: 700, color: 'var(--lms-text-main)' }}>Exercise Overview</span>
                  </div>
                  <button type="button" onClick={() => setSidebarTab(null as any)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--lms-text-muted)', display: 'flex', padding: 4, borderRadius: 6 }}>
                    <X size={15} />
                  </button>
                </div>
                <div className="lms-sidebar-scroll" style={{ flex: 1, overflowY: 'auto' }}>
                  {/* Overall Questions */}
                  <div style={{ padding: '12px 16px', borderBottom: '1.5px solid var(--lms-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <Hash size={12} style={{ color: 'var(--lms-orange)' }} />
                      <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 700, color: 'var(--lms-orange)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Overall Questions</span>
                    </div>
                    <div className="lms-marks-row">
                      <span className="lms-marks-label">Total Questions</span>
                      <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12 }}>{totalSlotsAll}</span>
                    </div>
                    <div className="lms-marks-row">
                      <span className="lms-marks-label">Created</span>
                      <span className="lms-marks-value" style={{ color: 'var(--lms-violet)', fontSize: 12 }}>
                        {createdCountAll}<span style={{ color: 'var(--lms-text-hint)', fontWeight: 400, fontSize: 10 }}>/{totalSlotsAll}</span>
                      </span>
                    </div>
                    <div className="lms-marks-row">
                      <span className="lms-marks-label">Remaining Marks</span>
                      <span className="lms-marks-value" style={{ color: remainingSlotsAll === 0 ? 'var(--lms-success)' : 'var(--lms-warning)', fontSize: 12 }}>{remainingSlotsAll}</span>
                    </div>
                    {totalSlotsAll > 0 && (
                      <div className="lms-progress-bar" style={{ marginTop: 8 }}>
                        <div className="lms-progress-fill" style={{ width: `${Math.min(100, (createdCountAll / totalSlotsAll) * 100)}%`, background: remainingSlotsAll === 0 ? 'var(--lms-success)' : 'var(--lms-orange)' }} />
                      </div>
                    )}
                    {/* {!isGeneral && configuredDiffs.length > 0 && (
                      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 0 }}>
                        {configuredDiffs.map(d => {
                          const quota = getQuotaForDiff(d);
                          const created = getCreatedCount(d);
                          const rem = quota - created;
                          const diffColor = d === 'easy' ? 'var(--lms-success)' : d === 'medium' ? 'var(--lms-warning)' : 'var(--lms-danger)';
                          return (
                            <div key={d} className="lms-marks-row" style={{ paddingLeft: 8, borderLeft: `2px solid ${diffColor}`, marginBottom: 2 }}>
                              <span className="lms-marks-label" style={{ textTransform: 'capitalize', color: diffColor }}>{d}</span>
                              <span className="lms-marks-value" style={{ fontSize: 11 }}>
                                <span style={{ color: 'var(--lms-violet)' }}>{created}</span>
                                <span style={{ color: 'var(--lms-text-hint)', fontWeight: 400 }}>/{quota}</span>
                                <span style={{ color: rem <= 0 ? 'var(--lms-success)' : 'var(--lms-text-muted)', fontSize: 10, marginLeft: 6, fontWeight: 500 }}>
                                  {rem <= 0 ? '✓' : `${rem} left`}
                                </span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )} */}
                  </div>
                  {/* Overall Marks */}
                  {subExerciseIsGraded && totalMarksAll > 0 && (
                    <div style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <Award size={12} style={{ color: 'var(--lms-violet)' }} />
                        <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 700, color: 'var(--lms-violet)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Overall Marks</span>
                      </div>
                      <div className="lms-marks-row">
                        <span className="lms-marks-label">Total Marks</span>
                        <span className="lms-marks-value" style={{ color: 'var(--lms-violet)', fontSize: 12 }}>{totalMarksAll}</span>
                      </div>
                      <div className="lms-marks-row">
                        <span className="lms-marks-label">Marks Used</span>
                        <span className="lms-marks-value" style={{ color: 'var(--lms-warning)', fontSize: 12 }}>
                          {fmtMark(usedMarksAll)}<span style={{ color: 'var(--lms-text-hint)', fontWeight: 400, fontSize: 10 }}>/{totalMarksAll}</span>
                        </span>
                      </div>
                      <div className="lms-marks-row">
                        <span className="lms-marks-label">Remaining Marks</span>
                        <span className="lms-marks-value" style={{ color: (totalMarksAll - usedMarksAll) <= 0 ? 'var(--lms-success)' : 'var(--lms-text-main)', fontSize: 12 }}>
                          {fmtMark(Math.max(0, totalMarksAll - usedMarksAll))}
                        </span>
                      </div>
                      {totalMarksAll > 0 && (
                        <div className="lms-progress-bar" style={{ marginTop: 8 }}>
                          <div className="lms-progress-fill" style={{ width: `${Math.min(100, (usedMarksAll / totalMarksAll) * 100)}%`, background: usedMarksAll >= totalMarksAll ? 'var(--lms-success)' : 'var(--lms-orange)' }} />
                        </div>
                      )}
                      {configuredDiffs.length > 0 && (
                        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 0 }}>
                          {configuredDiffs.filter(d => d === currentDiff).map(d => {
                            const levelMarks = getTotalMarksForDiff(d);
                            const usedD = savedQuestions.filter(q => q.difficulty === d).reduce((acc, q) => acc + (q.score || 0), 0);
                            const perQ = getFixedScore(d);
                            const diffColor = d === 'easy' ? 'var(--lms-success)' : d === 'medium' ? 'var(--lms-warning)' : 'var(--lms-danger)';
                            return (
                              <div key={d} className="lms-marks-row" style={{ paddingLeft: 8, borderLeft: `2px solid ${diffColor}`, marginBottom: 2 }}>
                                <span className="lms-marks-label" style={{ textTransform: 'capitalize', color: diffColor }}>{d}</span>
                                <span className="lms-marks-value" style={{ fontSize: 11 }}>
                                  <span style={{ color: 'var(--lms-warning)' }}>{fmtMark(usedD)}</span>
                                  <span style={{ color: 'var(--lms-text-hint)', fontWeight: 400 }}>/{levelMarks || '?'}</span>
                                  {perQ > 0 && <span style={{ color: 'var(--lms-text-muted)', fontSize: 10, marginLeft: 6, fontWeight: 500 }}>{perQ} mark per question</span>}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ padding: '10px 16px', borderTop: '1.5px solid var(--lms-border)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
                  <button type="button" onClick={() => setSidebarTab(null as any)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 16px', borderRadius: 'var(--lms-radius-md)', fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 600, border: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-surface)', color: 'var(--lms-text-sec)', cursor: 'pointer' }}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,26,46,0.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 150, padding: 12 }}>
          <div style={{ width: '96vw', maxWidth: 1400, height: '96vh', display: 'flex', flexDirection: 'column', background: 'var(--lms-bg-white)', borderRadius: 'var(--lms-radius-lg)', border: '1.5px solid var(--lms-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-white)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--lms-violet)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Eye size={16} style={{ color: 'white' }} />
                </div>
                <div style={{ width: 1, height: 20, background: 'var(--lms-border)', flexShrink: 0 }} />
                <QuestionFormBreadcrumb hierarchyData={hierarchyData} tabType={tabType} subcategory={subcategory} subcategoryLabel={subcategoryLabel} exerciseName={exerciseName} actionLabel="Preview" questionLabel={questionLabel} />
              </div>

              {/* Right side: filter + count + close */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 16 }}>
                {/* Question count pill */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, background: 'var(--lms-bg-surface)', border: '1.5px solid var(--lms-border)' }}>
                  <Hash size={11} style={{ color: 'var(--lms-text-hint)' }} />
                  <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 700, color: 'var(--lms-text-main)' }}>
                    {filteredSavedQuestions.length}{filterDiff !== 'all' ? `/${savedQuestions.length}` : ''} question{savedQuestions.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Difficulty filter — always visible for level-based */}
                {!isGeneral && (
                  <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                    <select
                      value={filterDiff}
                      onChange={e => setFilterDiff(e.target.value as any)}
                      style={{
                        fontFamily: 'var(--lms-font)',
                        fontSize: 12,
                        fontWeight: 600,
                        border: `1.5px solid ${filterDiff !== 'all' ? (DS[filterDiff]?.border || 'var(--lms-border)') : 'var(--lms-border)'}`,
                        borderRadius: 20,
                        padding: '5px 28px 5px 12px',
                        cursor: 'pointer',
                        outline: 'none',
                        background: filterDiff !== 'all' ? (DS[filterDiff]?.bg || 'var(--lms-bg-surface)') : 'var(--lms-bg-surface)',
                        color: filterDiff !== 'all' ? (DS[filterDiff]?.text || 'var(--lms-text-sec)') : 'var(--lms-text-sec)',
                        appearance: 'none',
                        WebkitAppearance: 'none',
                        minWidth: 140,
                      }}
                    >
                      <option value="all">All difficulties</option>
                      {(['easy', 'medium', 'hard'] as const).map(d => (
                        <option key={d} value={d}>
                          {d.charAt(0).toUpperCase() + d.slice(1)} ({savedQuestions.filter(q => q.difficulty === d).length})
                        </option>
                      ))}
                    </select>
                    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8"
                      style={{ position: 'absolute', right: 9, pointerEvents: 'none', width: 11, height: 11, color: filterDiff !== 'all' ? DS[filterDiff]?.text : 'var(--lms-text-sec)' }}>
                      <path d="M2 4l4 4 4-4" />
                    </svg>
                  </div>
                )}

                {/* Close */}
                <button onClick={onClose} style={{ padding: 8, borderRadius: 8, border: '1.5px solid var(--lms-danger-bdr)', background: 'var(--lms-danger-bg)', cursor: 'pointer' }}>
                  <X size={15} style={{ color: 'var(--lms-danger)' }} />
                </button>
              </div>
            </div>

            {/* Preview banner */}
            <div style={{ padding: '5px 20px', background: 'var(--lms-info-bg)', borderBottom: '1.5px solid var(--lms-info-bdr)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <Eye size={11} style={{ color: 'var(--lms-info)' }} />
              <span style={{ fontFamily: 'var(--lms-font)', fontSize: 10.5, fontWeight: 700, color: 'var(--lms-info)', letterSpacing: 0.4, textTransform: 'uppercase' }}>Preview</span>
              {filterDiff !== 'all' && (
                <span style={{ ...DS[filterDiff]?.pill, fontSize: 10, fontWeight: 700, padding: '1px 8px', borderRadius: 20, textTransform: 'capitalize', marginLeft: 4 }}>
                  Filtered: {filterDiff}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

              {/* Questions list */}
              <div className="lms-sidebar-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(() => {
                  if (filteredSavedQuestions.length === 0) return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--lms-text-hint)', gap: 12, paddingTop: 60 }}>
                      <Eye size={40} style={{ opacity: 0.15 }} />
                      <p style={{ fontFamily: 'var(--lms-font)', fontSize: 14, fontWeight: 600 }}>
                        {filterDiff !== 'all' ? `No ${filterDiff} questions saved yet` : 'No saved questions yet'}
                      </p>
                      {filterDiff !== 'all' && (
                        <button onClick={() => setFilterDiff('all')}
                          style={{ fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 600, color: 'var(--lms-violet)', background: 'var(--lms-violet-bg)', border: '1.5px solid var(--lms-violet-bdr)', borderRadius: 20, padding: '4px 14px', cursor: 'pointer' }}>
                          Show all difficulties
                        </button>
                      )}
                    </div>
                  );

                  return filteredSavedQuestions.map((q, filteredIdx) => {
                    const originalIdx = questions.findIndex(x => x.__localId === q.__localId);
                    const ds = DS[q.difficulty] || DS.medium;
                    const isActive = originalIdx === currentIndex;
                    const isExpanded = expandedSet.has(filteredIdx);
                    const titleText = Array.isArray(q.title) ? getTitleText(q.title as any) || 'Untitled' : (q.title as string) || 'Untitled';
                    const qNum = (() => {
                      if (isGeneral) return filteredIdx + 1;
                      const sameD = filteredSavedQuestions.filter(x => x.difficulty === q.difficulty);
                      return sameD.findIndex(x => x.__localId === q.__localId) + 1;
                    })();

                    const tBlocks: any[] = [{ type: 'text', value: titleText }];
                    const dBlocks: any[] = Array.isArray(q.description) && (q.description as any[]).length > 0
                      ? (q.description as any[])
                      : (() => { const dObj: any = typeof q.description === 'object' && !Array.isArray(q.description) ? q.description : { text: '' }; return dObj?.contentBlocks || (dObj?.text?.trim() ? [{ type: 'text', value: dObj.text }] : []); })();
                    const hasRichTitle = tBlocks.some((b: any) => b.type === 'image' || b.type === 'code');
                    const hasDesc = dBlocks.some((b: any) => b.type !== 'text' || b.value?.trim());

                    const renderBlock = (b: any, bi: number) => {
                      if (b.type === 'text' && b.value?.trim())
                        return <p key={bi} style={{ fontFamily: 'var(--lms-font)', fontSize: 12.5, fontWeight: 400, color: 'var(--lms-text-main)', margin: 0, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{b.value}</p>;
                      if (b.type === 'image')
                        return (
                          <div key={bi} style={{ display: 'flex', justifyContent: b.alignment === 'right' ? 'flex-end' : b.alignment === 'center' ? 'center' : 'flex-start' }}>
                            <img src={b.url} alt="" style={{ width: `${b.sizePercent || 70}%`, maxWidth: '100%', borderRadius: 6, border: '1px solid var(--lms-border)' }} />
                          </div>
                        );
                      if (b.type === 'code') {
                        const isDk = ['#1e1e1e', '#282a36', '#272822'].includes(b.bgColor);
                        return <pre key={bi} style={{ background: b.bgColor || '#f5f5f5', color: isDk ? '#d4d4d4' : '#1a1a2e', fontFamily: 'ui-monospace,monospace', fontSize: 11.5, padding: '10px 14px', borderRadius: 8, margin: 0, overflowX: 'auto', lineHeight: 1.6 }}>{b.value}</pre>;
                      }
                      return null;
                    };

                    return (
                      <div key={q.__localId} style={{
                        border: isActive ? `2px solid var(--lms-orange)` : '1.5px solid var(--lms-border)',
                        borderRadius: 12,
                        boxShadow: isActive ? '0 0 0 3px var(--lms-orange-light)' : '0 1px 4px rgba(0,0,0,0.05)',
                        transition: 'border-color 0.15s, box-shadow 0.15s',
                        flexShrink: 0,
                        overflow: 'visible',
                      }}>
                        <div style={{ padding: '12px 14px', background: isActive ? 'var(--lms-orange-50)' : 'var(--lms-bg-white)', borderRadius: isExpanded ? '10px 10px 0 0' : 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{
                              width: 30, height: 30, borderRadius: 9, fontSize: 12, fontWeight: 800,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                              fontFamily: 'var(--lms-font)',
                              background: isActive ? 'var(--lms-orange)' : ds.bg,
                              color: isActive ? 'white' : ds.text,
                              border: `2px solid ${isActive ? 'transparent' : ds.border}`,
                            }}>{qNum}</span>
                            <p style={{ flex: 1, minWidth: 0, fontFamily: 'var(--lms-font)', fontSize: 13.5, fontWeight: 700, color: 'var(--lms-text-main)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titleText}</p>
                            {q._id && (
                              <span style={{ fontFamily: 'var(--lms-font)', fontSize: 9, fontWeight: 700, color: 'var(--lms-success)', background: 'var(--lms-success-bg)', border: '1px solid var(--lms-success-bdr)', padding: '2px 7px', borderRadius: 20, flexShrink: 0 }}>SAVED</span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                            {!isGeneral && (
                              <span style={{ ...ds.pill, fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20, textTransform: 'capitalize' as const, flexShrink: 0 }}>{q.difficulty}</span>
                            )}
                            {subExerciseIsGraded && (
                              <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-muted)', flexShrink: 0 }}>{q.score} marks</span>
                            )}
                            {subExerciseIsGraded && <span style={{ color: 'var(--lms-border)', fontSize: 11, flexShrink: 0 }}>·</span>}
                            <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-muted)', flexShrink: 0 }}>{q.testCases?.length || 0} test case{(q.testCases?.length || 0) !== 1 ? 's' : ''}</span>
                            {q.isSaved && !q.isDirty && <span style={{ fontFamily: 'var(--lms-font)', fontSize: 10, color: 'var(--lms-success)', fontWeight: 600, flexShrink: 0 }}>✓ Saved</span>}
                            {q.isDirty && <span style={{ fontFamily: 'var(--lms-font)', fontSize: 10, color: 'var(--lms-warning)', fontWeight: 600, flexShrink: 0 }}>✎ Modified</span>}
                            <div style={{ flex: 1 }} />
                            <button onClick={() => { onJump(originalIdx); onClose(); }}
                              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', background: 'var(--lms-warning-bg)', color: 'var(--lms-warning)', fontSize: 11, fontWeight: 700, border: '1.5px solid var(--lms-warning-bdr)', borderRadius: 7, cursor: 'pointer', fontFamily: 'var(--lms-font)', flexShrink: 0 }}>
                              <Edit2 size={11} /> Edit
                            </button>
                            <button onClick={() => setDeleteTarget({ localId: q.__localId, title: titleText })}
                              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', background: 'var(--lms-danger-bg)', color: 'var(--lms-danger)', fontSize: 11, fontWeight: 700, border: '1.5px solid var(--lms-danger-bdr)', borderRadius: 7, cursor: 'pointer', fontFamily: 'var(--lms-font)', flexShrink: 0 }}>
                              <Trash2 size={11} /> Delete
                            </button>
                            <button onClick={() => setExpandedSet(prev => { const n = new Set(prev); n.has(filteredIdx) ? n.delete(filteredIdx) : n.add(filteredIdx); return n; })}
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, border: `1.5px solid ${isExpanded ? 'var(--lms-violet-bdr)' : 'var(--lms-border)'}`, background: isExpanded ? 'var(--lms-violet-bg)' : 'var(--lms-bg-surface)', cursor: 'pointer', color: isExpanded ? 'var(--lms-violet)' : 'var(--lms-text-muted)', flexShrink: 0, transition: 'all 0.15s' }}>
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div style={{ borderTop: '1.5px solid var(--lms-border)', borderRadius: '0 0 10px 10px', padding: '10px 16px', display: 'flex', flexDirection: 'column' }}>
                            {hasRichTitle && (
                              <div>
                                <p className="lms-section-label">Problem Title</p>
                                <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--lms-bg-white)', padding: '0px 12px', borderRadius: 8, border: '1.5px solid var(--lms-border)' }}>
                                  {tBlocks.map(renderBlock)}
                                </div>
                              </div>
                            )}
                            {hasDesc && (
                              <div>
                                <p className="lms-section-label" style={{ marginBottom: 6 }}>Description</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--lms-bg-white)', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--lms-border)' }}>
                                  {dBlocks.map(renderBlock)}
                                </div>
                              </div>
                            )}
                            {(q.testCases?.length || 0) > 0 && (
                              <div>
                                <p className="lms-section-label mt-5">Test Cases ({q.testCases.length})</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  {q.testCases.map((tc: any, ti: number) => (
                                    <div key={ti} style={{ background: 'var(--lms-bg-white)', borderRadius: 8, border: '1.5px solid var(--lms-border)', overflow: 'hidden' }}>
                                      <div style={{ padding: '6px 10px', background: ti === 0 ? 'var(--lms-orange-50)' : 'var(--lms-bg-surface)', borderBottom: '1px solid var(--lms-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontFamily: 'var(--lms-font)', fontSize: 10.5, fontWeight: 700, color: ti === 0 ? '#c85a30' : 'var(--lms-text-sec)' }}>
                                          Test Case {ti + 1}{ti === 0 ? ' · Sample' : ''}
                                        </span>
                                        {tc.isHidden && <span style={{ fontFamily: 'var(--lms-font)', fontSize: 10, padding: '1px 7px', borderRadius: 20, background: 'var(--lms-bg-surface2)', color: 'var(--lms-text-muted)' }}>Hidden</span>}
                                      </div>
                                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                                        <div style={{ padding: '8px 12px', borderRight: '1px solid var(--lms-border)' }}>
                                          <span style={{ fontFamily: 'var(--lms-font)', fontSize: 9.5, fontWeight: 700, color: 'var(--lms-text-hint)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Input</span>
                                          <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'var(--lms-text-main)', wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>{tc.input || <span style={{ color: 'var(--lms-text-hint)', fontStyle: 'italic' }}>empty</span>}</code>
                                        </div>
                                        <div style={{ padding: '8px 12px' }}>
                                          <span style={{ fontFamily: 'var(--lms-font)', fontSize: 9.5, fontWeight: 700, color: 'var(--lms-text-hint)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Expected Output</span>
                                          <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'var(--lms-text-main)', wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>{tc.expectedOutput || <span style={{ color: 'var(--lms-text-hint)', fontStyle: 'italic' }}>empty</span>}</code>
                                        </div>
                                      </div>
                                      {tc.explanation && (
                                        <div style={{ padding: '6px 12px', borderTop: '1px solid var(--lms-border)', background: 'var(--lms-bg-surface)' }}>
                                          <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-muted)' }}>{tc.explanation}</span>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {(q.constraints?.filter((c: string) => c?.trim()).length || 0) > 0 && (
                              <div>
                                <p className="lms-section-label mt-5">Constraints</p>
                                <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  {q.constraints.filter((c: string) => c?.trim()).map((c: string, ci: number) => (
                                    <li key={ci} style={{ fontFamily: 'var(--lms-font)', fontSize: 12, color: 'var(--lms-text-main)' }}>{c}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Right Sidebar */}
              <div style={{ width: 280, flexShrink: 0, borderLeft: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-white)', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

                {/* Two action buttons */}
                <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 8, borderBottom: '1.5px solid var(--lms-border)', flexShrink: 0, background: 'var(--lms-bg-surface)' }}>
                  <button
                    onClick={() => setSidebarTab('details')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      width: '100%', padding: '10px 14px', borderRadius: 'var(--lms-radius-md)',
                      fontFamily: 'var(--lms-font)', fontSize: 12.5, fontWeight: 600,
                      border: '1.5px solid var(--lms-border)',
                      background: 'var(--lms-bg-white)', color: 'var(--lms-text-sec)',
                      cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
                    }}
                    onMouseEnter={e => { const b = e.currentTarget; b.style.borderColor = 'var(--lms-orange)'; b.style.background = 'var(--lms-orange-50)'; b.style.color = '#c85a30'; }}
                    onMouseLeave={e => { const b = e.currentTarget; b.style.borderColor = 'var(--lms-border)'; b.style.background = 'var(--lms-bg-white)'; b.style.color = 'var(--lms-text-sec)'; }}
                  >
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--lms-orange-50)', border: '1.5px solid var(--lms-orange-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FileText size={14} style={{ color: 'var(--lms-orange)' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--lms-font)', fontSize: 12.5, fontWeight: 700, color: 'inherit' }}>Exercise Details</div>
                      <div style={{ fontFamily: 'var(--lms-font)', fontSize: 10.5, color: 'var(--lms-text-muted)', marginTop: 1 }}>ID, type, config, duration</div>
                    </div>
                    <ChevronRight size={13} style={{ color: 'var(--lms-text-hint)', flexShrink: 0 }} />
                  </button>

                  <button
                    onClick={() => setSidebarTab('overview')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      width: '100%', padding: '10px 14px', borderRadius: 'var(--lms-radius-md)',
                      fontFamily: 'var(--lms-font)', fontSize: 12.5, fontWeight: 600,
                      border: '1.5px solid var(--lms-border)',
                      background: 'var(--lms-bg-white)', color: 'var(--lms-text-sec)',
                      cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
                    }}
                    onMouseEnter={e => { const b = e.currentTarget; b.style.borderColor = 'var(--lms-info-bdr)'; b.style.background = 'var(--lms-info-bg)'; b.style.color = 'var(--lms-info)'; }}
                    onMouseLeave={e => { const b = e.currentTarget; b.style.borderColor = 'var(--lms-border)'; b.style.background = 'var(--lms-bg-white)'; b.style.color = 'var(--lms-text-sec)'; }}
                  >
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--lms-info-bg)', border: '1.5px solid var(--lms-info-bdr)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <BarChart3 size={14} style={{ color: 'var(--lms-info)' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--lms-font)', fontSize: 12.5, fontWeight: 700, color: 'inherit' }}>Exercise Overview</div>
                      <div style={{ fontFamily: 'var(--lms-font)', fontSize: 10.5, color: 'var(--lms-text-muted)', marginTop: 1 }}>Quota, marks, progress</div>
                    </div>
                    <ChevronRight size={13} style={{ color: 'var(--lms-text-hint)', flexShrink: 0 }} />
                  </button>
                </div>

                {/* Stats */}
                <div className="lms-sidebar-scroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 14px' }}>

                  {(() => {
                    const activeDiff = filterDiff === 'all' ? null : filterDiff as Diff;

                    // Per-difficulty computed values
                    const diffSlots = activeDiff ? getQuotaForDiff(activeDiff) : 0;
                    const diffCreated = activeDiff ? getCreatedCount(activeDiff) : 0;
                    const diffRemaining = activeDiff ? getRemainingSlots(activeDiff) : 0;
                    const diffMarksTotal = activeDiff ? getTotalMarksForDiff(activeDiff) : 0;
                    const diffMarksUsed = activeDiff ? savedQuestions.filter(q => q.difficulty === activeDiff).reduce((acc, q) => acc + (q.score || 0), 0) : 0;
                    const diffMarksRemaining = Math.max(0, diffMarksTotal - diffMarksUsed);
                    const diffFixedScore = activeDiff ? getFixedScore(activeDiff) : 0;
                    const diffDS = activeDiff ? (DS[activeDiff] || DS.medium) : null;

                    return (
                      <>
                        {/* ── Difficulty Questions (when a diff is selected) ── */}
                        {activeDiff && (
                          <div style={{ marginBottom: 14 }}>
                            <div className="lms-sidebar-section-title" style={{ fontSize: 11 }}>
                              <Hash size={12} style={{ color: diffDS.text }} />
                              <span style={{ textTransform: 'capitalize', color: diffDS.text }}>{activeDiff} Questions</span>
                            </div>
                            <div className="lms-marks-row">
                              <span className="lms-marks-label">Total</span>
                              <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12 }}>{diffSlots}</span>
                            </div>
                            <div className="lms-marks-row">
                              <span className="lms-marks-label">Created</span>
                              <span className="lms-marks-value" style={{ color: 'var(--lms-violet)', fontSize: 12 }}>
                                {diffCreated}<span style={{ color: 'var(--lms-text-hint)', fontWeight: 400, fontSize: 10 }}>/{diffSlots}</span>
                              </span>
                            </div>
                            <div className="lms-marks-row">
                              <span className="lms-marks-label">Remaining</span>
                              <span className="lms-marks-value" style={{ color: diffRemaining === 0 ? 'var(--lms-success)' : 'var(--lms-warning)', fontSize: 12 }}>{diffRemaining}</span>
                            </div>
                            {diffSlots > 0 && (
                              <div className="lms-progress-bar" style={{ marginTop: 6 }}>
                                <div className="lms-progress-fill" style={{
                                  width: `${Math.min(100, (diffCreated / diffSlots) * 100)}%`,
                                  background: diffRemaining === 0 ? 'var(--lms-success)' : diffDS.bar
                                }} />
                              </div>
                            )}
                          </div>
                        )}

                        {/* ── Difficulty Marks (when a diff is selected + graded) ── */}
                        {activeDiff && subExerciseIsGraded && diffMarksTotal > 0 && (
                          <div style={{ borderTop: '1.5px solid var(--lms-border)', paddingTop: 14, marginBottom: 14 }}>
                            <div className="lms-sidebar-section-title" style={{ fontSize: 11 }}>
                              <Award size={12} style={{ color: diffDS.text }} />
                              <span style={{ textTransform: 'capitalize', color: diffDS.text }}>{activeDiff} Marks</span>
                            </div>
                            <div className="lms-marks-row">
                              <span className="lms-marks-label">Total Mark</span>
                              <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12 }}>{diffMarksTotal}</span>
                            </div>
                            <div className="lms-marks-row">
                              <span className="lms-marks-label">Mark Per Question</span>
                              <span className="lms-marks-value" style={{ color: 'var(--lms-orange)', fontSize: 12 }}>
                                {diffFixedScore}
                                {isScoreEditable(activeDiff)
                                  ? <span className="lms-badge lms-badge-violet" style={{ fontSize: '9px', padding: '1px 5px', marginLeft: 3 }}>Custom</span>
                                  : <span className="lms-badge" style={{ fontSize: '9px', padding: '1px 5px', marginLeft: 3, background: 'var(--lms-bg-surface)', color: 'var(--lms-text-muted)', borderColor: 'var(--lms-border)' }}>Fixed</span>}
                              </span>
                            </div>
                            <div className="lms-marks-row">
                              <span className="lms-marks-label">Used Marks</span>
                              <span className="lms-marks-value" style={{ color: 'var(--lms-warning)', fontSize: 12 }}>
                                {fmtMark(diffMarksUsed)}<span style={{ color: 'var(--lms-text-hint)', fontWeight: 400, fontSize: 10 }}>/{diffMarksTotal}</span>
                              </span>
                            </div>
                            <div className="lms-marks-row">
                              <span className="lms-marks-label">Remaining Marks</span>
                              <span className="lms-marks-value" style={{ color: diffMarksRemaining <= 0 ? 'var(--lms-success)' : 'var(--lms-violet)', fontSize: 12 }}>{fmtMark(diffMarksRemaining)}</span>
                            </div>
                            <div className="lms-progress-bar" style={{ marginTop: 6 }}>
                              <div className="lms-progress-fill" style={{
                                width: `${Math.min(100, (diffMarksUsed / diffMarksTotal) * 100)}%`,
                                background: diffMarksUsed >= diffMarksTotal ? 'var(--lms-success)' : diffDS.bar
                              }} />
                            </div>
                          </div>
                        )}

                        {/* ── Overall Questions (always visible) ── */}
                        <div style={{
                          borderTop: activeDiff ? '1.5px solid var(--lms-border)' : 'none',
                          paddingTop: activeDiff ? 14 : 0,
                          marginBottom: 14
                        }}>
                          <div className="lms-sidebar-section-title" style={{ fontSize: 11 }}>
                            <Hash size={12} style={{ color: 'var(--lms-orange)' }} />
                            <span>Overall Questions</span>
                          </div>
                          <div className="lms-marks-row">
                            <span className="lms-marks-label">Total Questions</span>
                            <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12 }}>{totalSlotsAll}</span>
                          </div>
                          <div className="lms-marks-row">
                            <span className="lms-marks-label">Created</span>
                            <span className="lms-marks-value" style={{ color: 'var(--lms-violet)', fontSize: 12 }}>
                              {createdCountAll}<span style={{ color: 'var(--lms-text-hint)', fontWeight: 400, fontSize: 10 }}>/{totalSlotsAll}</span>
                            </span>
                          </div>
                          <div className="lms-marks-row">
                            <span className="lms-marks-label">Remaining</span>
                            <span className="lms-marks-value" style={{ color: remainingSlotsAll === 0 ? 'var(--lms-success)' : 'var(--lms-warning)', fontSize: 12 }}>{remainingSlotsAll}</span>
                          </div>
                          {totalSlotsAll > 0 && (
                            <div className="lms-progress-bar" style={{ marginTop: 6 }}>
                              <div className="lms-progress-fill" style={{
                                width: `${Math.min(100, (createdCountAll / totalSlotsAll) * 100)}%`,
                                background: remainingSlotsAll === 0 ? 'var(--lms-success)' : 'var(--lms-orange)'
                              }} />
                            </div>
                          )}
                        </div>

                        {/* ── Overall Marks (always visible when graded) ── */}
                        {subExerciseIsGraded && totalMarksAll > 0 && (
                          <div style={{ borderTop: '1.5px solid var(--lms-border)', paddingTop: 14 }}>
                            <div className="lms-sidebar-section-title" style={{ fontSize: 11 }}>
                              <Award size={12} style={{ color: 'var(--lms-orange)' }} />
                              <span>Overall Marks</span>
                            </div>
                            <div className="lms-marks-row">
                              <span className="lms-marks-label">Marks Per Question</span>
                              <span className="lms-marks-value" style={{ color: 'var(--lms-orange)', fontSize: 12 }}>{isGeneral ? generalMPQ : displayScore}</span>
                            </div>
                            <div className="lms-marks-row">
                              <span className="lms-marks-label">Total Questions</span>
                              <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12 }}>{totalSlotsAll}</span>
                            </div>
                            <div className="lms-marks-row">
                              <span className="lms-marks-label">Total Marks</span>
                              <span className="lms-marks-value" style={{ color: 'var(--lms-violet)', fontSize: 12 }}>{totalMarksAll}</span>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}

                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '12px 20px', borderTop: '1.5px solid var(--lms-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: 'var(--lms-bg-white)' }}>
              <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-muted)' }}>
                {questions.filter(q => q.isSaved).length} saved · {questions.filter(q => !q.isSaved).length} unsaved
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={onClose} className="lms-cancel-btn">Continue Editing</button>
                <button onClick={onDone} className="lms-btn lms-btn-orange">
                  <Check size={13} /> Done
                </button>
              </div>
            </div>
          </div>
        </div>

        {deleteTarget && (
          <DeleteConfirmDialog questionTitle={deleteTarget.title}
            onConfirm={() => { onDelete(deleteTarget.localId); setDeleteTarget(null); }}
            onCancel={() => setDeleteTarget(null)} />
        )}
      </>
    );
  };


