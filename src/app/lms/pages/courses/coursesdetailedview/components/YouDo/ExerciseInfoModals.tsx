"use client";
import React from "react";
import { FileText, Award, X } from "lucide-react";

const T = {
  orange: '#F27757',
  orangeLight: 'rgba(242,119,87,0.08)',
  amberLight: 'rgba(245,158,11,0.09)',
  amber: '#f59e0b',
  textMain: '#1a1a2e',
  textSub: '#6b6b7e',
  textMuted: '#9b9bae',
  textHint: '#bcbccc',
  border: '#eaeaef',
  borderLight: '#f4f4f7',
  bg: '#ffffff',
  pageBg: '#f9f9fb',
  green: '#22c55e',
  greenDark: '#16a34a',
  red: '#ef4444',
} as const;

const FONT = "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif";

interface ExerciseInfoModalsProps {
  exercise: any;
  showDetailsModal: boolean;
  setShowDetailsModal: (v: boolean) => void;
  showOverviewModal: boolean;
  setShowOverviewModal: (v: boolean) => void;
  solvedQuestions?: Set<number>;
}

export const ExerciseInfoButtons: React.FC<{
  onDetailsClick: () => void;
  onOverviewClick: () => void;
  isGraded?: boolean;
  detailsActive?: boolean;
  overviewActive?: boolean;
}> = ({ onDetailsClick, onOverviewClick, isGraded = true, detailsActive, overviewActive }) => {
  // Distinct accent colors so the two pills are visually different and easy to scan.
  const INFO = { solid: '#2563eb', soft: '#2563eb', border: '#bfdbfe', text: '#ffffff' };   // blue — Exercise Info
  const SCORE = { solid: '#F27757', soft: '#F27757', border: '#fcd9c8', text: '#ffffff' };  // orange — Score / Question Overview
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button
        onClick={onDetailsClick}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 12px", borderRadius: 8,
          fontSize: 12, fontWeight: 600, fontFamily: FONT,
          border: `1.5px solid ${detailsActive ? INFO.solid : INFO.border}`,
          background: detailsActive ? INFO.solid : INFO.soft,
          color: detailsActive ? "#fff" : INFO.text,
          cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.13s",
        }}
      >
        <FileText style={{ width: 13, height: 13 }} />
        Exercise Info
      </button>
      <button
        onClick={onOverviewClick}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 12px", borderRadius: 8,
          fontSize: 12, fontWeight: 600, fontFamily: FONT,
          border: `1.5px solid ${overviewActive ? SCORE.solid : SCORE.border}`,
          background: overviewActive ? SCORE.solid : SCORE.soft,
          color: overviewActive ? "#fff" : SCORE.text,
          cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.13s",
        }}
      >
        <Award style={{ width: 13, height: 13 }} />
        {isGraded ? "Score Overview" : "Question Overview"}
      </button>
    </div>
  );
};

const Overlay: React.FC<{ onClose: () => void; children: React.ReactNode }> = ({ onClose, children }) => (
  <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(26,26,46,0.45)", backdropFilter: "blur(3px)" }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    {children}
  </div>
);

const ModalShell: React.FC<{ width?: number; children: React.ReactNode }> = ({ width = 380, children }) => (
  <div style={{ background: T.bg, borderRadius: 14, boxShadow: "0 20px 56px rgba(0,0,0,0.16), 0 0 0 1px #eaeaef", width, maxHeight: "82vh", display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: FONT }}>
    {children}
  </div>
);

const ModalHeader: React.FC<{ icon: React.ReactNode; title: string; onClose: () => void }> = ({ icon, title, onClose }) => (
  <div style={{ padding: "13px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: T.pageBg, flexShrink: 0 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      {icon}
      <span style={{ fontSize: 13, fontWeight: 700, color: T.textMain, fontFamily: FONT }}>{title}</span>
    </div>
    <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: T.textMuted, display: "flex", padding: 4, borderRadius: 6 }}>
      <X size={14} />
    </button>
  </div>
);

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "9px 0", borderBottom: `1px solid ${T.borderLight}` }}>
    <span style={{ fontSize: 12, fontWeight: 500, color: T.textSub, fontFamily: FONT, flexShrink: 0 }}>{label}</span>
    <span style={{ fontSize: 12, fontWeight: 600, color: T.textMain, fontFamily: FONT, textAlign: "right", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
  </div>
);

const ModalFooter: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div style={{ padding: "10px 18px", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "flex-end", flexShrink: 0 }}>
    <button onClick={onClose} style={{ padding: "6px 18px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1.5px solid ${T.border}`, background: T.pageBg, color: T.textSub, cursor: "pointer", fontFamily: FONT }}>
      Close
    </button>
  </div>
);

const DIFF_STYLE = {
  easy:   { dot: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', badgeBg: '#dcfce7' },
  medium: { dot: '#d97706', bg: '#fffbeb', border: '#fde68a', text: '#92400e', badgeBg: '#fef3c7' },
  hard:   { dot: '#dc2626', bg: '#fff1f2', border: '#fecaca', text: '#991b1b', badgeBg: '#fee2e2' },
} as const;

const ExerciseInfoModals: React.FC<ExerciseInfoModalsProps> = ({
  exercise, showDetailsModal, setShowDetailsModal, showOverviewModal, setShowOverviewModal, solvedQuestions = new Set(),
}) => {
  const questions = exercise?.questions || [];
  const exerciseInfo = exercise?.exerciseInformation || {};
  const isGraded = exercise?.isGraded !== false;

  // Programming exercises may store marks in scoreSettings rather than exerciseInformation
  const _progSS = exercise?.questionConfiguration?.programmingQuestionConfiguration?.scoreSettings;
  const _progCalc = _progSS
    ? _progSS.scoreType === 'evenMarks' && _progSS.evenMarks
      ? _progSS.evenMarks * (questions.length || 1)
      : (['easy', 'medium', 'hard'] as const).reduce(
          (s, d) => s + ((_progSS.levelScoringConfiguration as any)?.[d]?.totalMarks || 0), 0
        )
    : 0;

  const totalMarks =
    exerciseInfo.totalMarksProgramming || exerciseInfo.totalMarks ||
    exerciseInfo.totalPoints ||
    exercise?.questionConfiguration?.mcqQuestionConfiguration?.mcqTotalMarks ||
    _progCalc || 0;
  const marksPerQ = exercise?.questionConfiguration?.mcqQuestionConfiguration?.marksPerQuestion
    ?? _progSS?.evenMarks ?? null;
  const totalQ = questions.length;
  const answered = solvedQuestions.size;
  const remaining = Math.max(0, totalQ - answered);

  // Per-difficulty stats (used when exercise is level-based or selection-level)
  const diffStats: Record<string, { count: number; totalMarks: number; marksPerQ: number | null }> = {};
  questions.forEach((q: any) => {
    const d = (q?.difficulty || '').toLowerCase() as 'easy' | 'medium' | 'hard';
    if (!d || !(d in DIFF_STYLE)) return;
    if (!diffStats[d]) diffStats[d] = { count: 0, totalMarks: 0, marksPerQ: null };
    diffStats[d].count += 1;
    const m = q.score ?? q.points ?? 0;
    diffStats[d].totalMarks += m;
    // Track per-question mark (null = mixed)
    if (diffStats[d].marksPerQ === null) diffStats[d].marksPerQ = m;
    else if (diffStats[d].marksPerQ !== m) diffStats[d].marksPerQ = -1;
  });
  const diffBreakdown = (['easy', 'medium', 'hard'] as const).filter(
    d => diffStats[d]?.count > 0
  );
  const hasDiffBreakdown = isGraded && diffBreakdown.length > 1;

  return (
    <>
      {/* Exercise Info */}
      {showDetailsModal && (
        <Overlay onClose={() => setShowDetailsModal(false)}>
          <ModalShell>
            <ModalHeader icon={<FileText size={13} style={{ color: T.textSub }} />} title="Exercise Info" onClose={() => setShowDetailsModal(false)} />
            <div style={{ flex: 1, overflowY: "auto", padding: "4px 18px 12px" }}>
              {exerciseInfo.exerciseName   && <Row label="Exercise Name"  value={exerciseInfo.exerciseName} />}
              {exerciseInfo.exerciseLevel  && <Row label="Level"          value={exerciseInfo.exerciseLevel.charAt(0).toUpperCase() + exerciseInfo.exerciseLevel.slice(1)} />}
              {exercise?.exerciseType      && <Row label="Exercise Type"  value={exercise.exerciseType} />}
              <Row label="Total Questions" value={totalQ} />
              {exerciseInfo.totalDuration != null && <Row label="Duration" value={`${exerciseInfo.totalDuration} min`} />}
              {isGraded && totalMarks ? <Row label="Total Marks" value={totalMarks} /> : null}
              {exercise?.evaluationSettings?.passingScore != null && (
                <Row label="Passing Score" value={`${exercise.evaluationSettings.passingScore}%`} />
              )}
              {exercise?.availabilityPeriod?.startDate && (
                <Row label="Available From" value={new Date(exercise.availabilityPeriod.startDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} />
              )}
              {exercise?.availabilityPeriod?.endDate && (
                <Row label="Available Until" value={new Date(exercise.availabilityPeriod.endDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} />
              )}
            </div>
            <ModalFooter onClose={() => setShowDetailsModal(false)} />
          </ModalShell>
        </Overlay>
      )}

      {/* Score Overview */}
      {showOverviewModal && (
        <Overlay onClose={() => setShowOverviewModal(false)}>
          <ModalShell>
            <ModalHeader icon={<Award size={13} style={{ color: T.textSub }} />} title={isGraded ? "Score Overview" : "Question Overview"} onClose={() => setShowOverviewModal(false)} />
            <div style={{ flex: 1, overflowY: "auto", padding: "4px 18px 12px" }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: T.textHint, textTransform: "uppercase", letterSpacing: "0.07em", margin: "12px 0 4px", fontFamily: FONT }}>Questions</p>
              <Row label="Total"     value={totalQ} />
              <Row label="Answered"  value={answered} />
              <Row label="Remaining" value={remaining} />
              {/* progress bar */}
              <div style={{ height: 4, borderRadius: 99, background: T.borderLight, overflow: "hidden", margin: "10px 0 14px" }}>
                <div style={{ height: "100%", borderRadius: 99, background: remaining === 0 ? T.green : T.orange, width: `${totalQ > 0 ? Math.min(100, (answered / totalQ) * 100) : 0}%`, transition: "width 0.4s" }} />
              </div>
              {isGraded && totalMarks ? (
                <>
                  <p style={{ fontSize: 10, fontWeight: 700, color: T.textHint, textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 4px", fontFamily: FONT }}>Marks</p>
                  <Row label="Total Marks" value={totalMarks} />
                  {!hasDiffBreakdown && marksPerQ != null && <Row label="Marks per Question" value={marksPerQ} />}
                  {hasDiffBreakdown && (
                    <>
                      <p style={{ fontSize: 10, fontWeight: 700, color: T.textHint, textTransform: "uppercase", letterSpacing: "0.07em", margin: "14px 0 8px", fontFamily: FONT }}>Marks by Difficulty</p>
                      {diffBreakdown.map(d => {
                        const stat = diffStats[d];
                        const ds = DIFF_STYLE[d];
                        const perQ = stat.marksPerQ !== null && stat.marksPerQ >= 0 ? stat.marksPerQ : null;
                        return (
                          <div key={d} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", borderRadius: 8, background: ds.bg, border: `1px solid ${ds.border}`, marginBottom: 6 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                              <span style={{ width: 8, height: 8, borderRadius: "50%", background: ds.dot, flexShrink: 0, display: "inline-block" }} />
                              <span style={{ fontSize: 12, fontWeight: 700, color: ds.text, textTransform: "capitalize", fontFamily: FONT }}>
                                {d.charAt(0).toUpperCase() + d.slice(1)}
                              </span>
                              <span style={{ fontSize: 11, color: ds.text, fontFamily: FONT, opacity: 0.7 }}>
                                {stat.count} {stat.count === 1 ? "question" : "questions"}
                              </span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {perQ != null && (
                                <span style={{ fontSize: 10, color: ds.text, fontFamily: FONT, opacity: 0.8 }}>
                                  {perQ}/Q ×
                                </span>
                              )}
                              <span style={{ fontSize: 12, fontWeight: 700, color: ds.text, fontFamily: FONT, background: ds.badgeBg, padding: "1px 8px", borderRadius: 99, border: `1px solid ${ds.border}` }}>
                                {stat.totalMarks} marks
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </>
              ) : null}
            </div>
            <ModalFooter onClose={() => setShowOverviewModal(false)} />
          </ModalShell>
        </Overlay>
      )}
    </>
  );
};

export default ExerciseInfoModals;
