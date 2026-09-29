import React, { useState } from 'react';
import { BarChart3, ChevronDown, ChevronRight, Clock3, FileText } from 'lucide-react';
import styles from '../QuestionAuthor.module.css';

// A section header that can collapse its own body. Used by Exercise details
// and Exercise overview so the panel stays compact until the trainer wants
// the full snapshot.
function CollapsibleHeader({ icon, title, sub, open, onToggle }: { icon: React.ReactNode; title: string; sub?: React.ReactNode; open: boolean; onToggle: () => void }) {
  return (
    <header
      role="button"
      tabIndex={0}
      aria-expanded={open}
      onClick={onToggle}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
      style={{ cursor: 'pointer', userSelect: 'none' }}
    >
      <span>{icon}</span>
      <div><h3>{title}</h3>{sub && <p>{sub}</p>}</div>
      <span style={{ marginLeft: 'auto', display: 'inline-flex', color: '#64748B' }} aria-hidden="true">
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </span>
    </header>
  );
}

export function QuestionAuthorOverview({
  exercise, difficulty, levelTotal, levelAdded, total, added,
  levelMarks, levelUsedMarks, totalMarks, usedMarks, marksPerQuestion, fixed,
  isGeneral, perLevel = [],
}: {
  exercise: any; difficulty: string; levelTotal: number; levelAdded: number; total: number; added: number;
  levelMarks: number; levelUsedMarks: number; totalMarks: number; usedMarks: number; marksPerQuestion: number;
  fixed: boolean; isGeneral: boolean;
  perLevel?: { level: string; total: number; added: number; perQuestion: number; fixed: boolean }[];
  // Accept and ignore old props from earlier render sites so callers do not
  // have to be updated in lock-step; keeps the interface backwards-compatible.
  sources?: { name: string; remaining: number }[];
  activeTab?: string; hasTitle?: boolean; hasDescription?: boolean; testCaseCount?: number; errors?: string[];
}) {
  const levelName = isGeneral ? 'Assignment' : difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
  const fmt = (n: number) => Number(n.toFixed(2));
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const graded = exercise.isGraded !== false;

  return <aside className={styles.overview} aria-label="Question overview">
    {/* 1. Exercise details — collapsible, closed by default. */}
    <section className={styles.overviewCard}>
      <CollapsibleHeader icon={<FileText size={20} />} title="Exercise details"
        sub="ID, type, duration and totals"
        open={detailsOpen} onToggle={() => setDetailsOpen(v => !v)} />
      {detailsOpen && (
        <dl>
          <div><dt>Exercise ID</dt><dd>{exercise.exerciseInformation?.exerciseId || '—'}</dd></div>
          <div><dt>Name</dt><dd>{exercise.exerciseInformation?.exerciseName || 'Untitled'}</dd></div>
          <div><dt>Type</dt><dd>{exercise.exerciseType || 'Programming'}</dd></div>
          <div><dt>Assessment</dt><dd>{graded ? 'Graded' : 'Non-graded'}</dd></div>
          <div><dt>Configuration</dt><dd>{isGeneral ? 'General' : 'Level based'}</dd></div>
          <div><dt>Duration</dt><dd><Clock3 size={12} /> {exercise.exerciseInformation?.totalDuration || '—'} minutes</dd></div>
          {graded && <div><dt>Total marks</dt><dd>{fmt(totalMarks)}</dd></div>}
          <div><dt>Total questions</dt><dd>{total}</dd></div>
        </dl>
      )}
    </section>

    {/* 2. Exercise overview — collapsible per-level breakdown. */}
    <section className={styles.overviewCard}>
      <CollapsibleHeader icon={<BarChart3 size={20} />} title="Overall questions overview"
        sub="Per-difficulty questions and marks"
        open={overviewOpen} onToggle={() => setOverviewOpen(v => !v)} />
      {overviewOpen && (
        isGeneral || perLevel.length === 0 ? (
          <dl>
            <div><dt>Total questions</dt><dd>{added} / {total}</dd></div>
            {graded && <>
              <div><dt>Total marks</dt><dd>{fmt(totalMarks)}</dd></div>
              <div><dt>Used marks</dt><dd>{fmt(usedMarks)}</dd></div>
              <div><dt>Remaining marks</dt><dd>{fmt(Math.max(0, totalMarks - usedMarks))}</dd></div>
            </>}
          </dl>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0' }}>
            {perLevel.map(row => {
              const rowMarks = row.total * row.perQuestion;
              return (
                <div key={row.level} className={styles.difficultyText} data-level={row.level}
                  style={{ border: '1px solid var(--lms-border, #E2E8F0)', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 700, textTransform: 'capitalize', marginBottom: 4 }}>
                    <span>{row.level}</span>
                    <span style={{ fontSize: 11, color: 'var(--lms-text-muted, #64748B)' }}>{row.added} / {row.total} created</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--lms-text-muted, #64748B)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span>Total questions: <b>{row.total}</b></span>
                    {graded && (
                      row.fixed
                        ? <span>Marks: <b>{fmt(rowMarks)}</b> total · <b>{fmt(row.perQuestion)}</b> per question (fixed)</span>
                        : <span>Marks: individual per question</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </section>

    {/* 3. Current difficulty — always visible, drives the trainer's focus.
        Progress bar on top so the completion state reads at a glance;
        compact rows below with the same numbers spelled out. */}
    {!isGeneral && (() => {
      const pct = levelTotal > 0 ? Math.min(100, Math.round((levelAdded / levelTotal) * 100)) : 0;
      const barColor = pct >= 100 ? '#0F9D58' : pct > 0 ? '#EE6A22' : '#CBD5E1';
      return (
        <section className={styles.overviewCard}>
          <header>
            <span><BarChart3 size={20} /></span>
            <div>
              <h3>Current difficulty</h3>
              <p className={styles.difficultyText} data-level={difficulty}>{levelName}</p>
            </div>
          </header>
          <div style={{ padding: '4px 0 8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, marginBottom: 5 }}>
              <span style={{ color: 'var(--lms-text-muted, #64748B)', fontWeight: 500 }}>Progress</span>
              <span style={{ color: 'var(--lms-text-main, #0F172A)', fontWeight: 700 }}>{pct}%</span>
            </div>
            <div role="progressbar" aria-valuemin={0} aria-valuemax={levelTotal} aria-valuenow={levelAdded}
              aria-label={`${levelAdded} of ${levelTotal} questions added at ${levelName} difficulty`}
              style={{ width: '100%', height: 8, background: '#F1F5F9', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{
                width: `${pct}%`, height: '100%', background: barColor,
                borderRadius: 999, transition: 'width 220ms ease, background 220ms ease',
              }} />
            </div>
          </div>
          <dl>
            <div><dt>Total questions</dt><dd>{levelTotal}</dd></div>
            <div><dt>Created</dt><dd>{levelAdded} / {levelTotal}</dd></div>
            {graded && <>
              <div><dt>Total marks</dt><dd>{fmt(levelMarks)}</dd></div>
              <div><dt>Per question</dt><dd>{fixed ? `${fmt(marksPerQuestion)} (fixed)` : 'Individual'}</dd></div>
            </>}
          </dl>
        </section>
      );
    })()}
  </aside>;
}
