import React, { useState } from 'react';
import { ArrowRight, Check, Circle, Database, FileText, Globe, PenLine, Sparkles } from 'lucide-react';
import { AddQuestionModalShell } from './AddQuestionChooserUI';
import { questionAllocation, AllocationLevel, AllocationSource } from './questionAllocation';
import styles from './QuestionAllocationChooser.module.css';

export default function QuestionAllocationChooser({ exercise, questions, part = 'programming', initialLevel = null, onChoose, onClose, allowDocument = false }: {
  exercise: any; questions: any[]; part?: 'mcq' | 'programming'; initialLevel?: AllocationLevel | null;
  onChoose: (source: AllocationSource, level: AllocationLevel | null) => void; onClose: () => void; allowDocument?: boolean;
}) {
  const allocation = questionAllocation(exercise, questions, part);
  const [selected, setSelected] = useState<AllocationLevel | null>(() => initialLevel || allocation.rows.find(row => row.remaining > 0 && row.buckets.some(bucket => bucket.remaining > 0))?.level || null);
  const [source, setSource] = useState<AllocationSource | null>(null);
  const row = allocation.rows.find(item => item.level === selected) || (!allocation.levelBased ? allocation.rows[0] : undefined);
  const total = allocation.rows.reduce((n, item) => n + item.total, 0);
  const added = allocation.rows.reduce((n, item) => n + item.added, 0);
  // Question bank is a sub-flow of Scratch (the manual authoring surface
  // exposes "pick from bank" inline), so we only expose three top-level
  // sources here: Scratch, AI generation, Other platform.
  const routes: { source: AllocationSource; bucket: string; title: string; sub: string; Icon: typeof PenLine; color: string }[] = [
    { source: 'manual', bucket: 'scratch', title: 'Scratch', sub: 'Create manually', Icon: PenLine, color: '#ff5a1f' },
    { source: 'ai', bucket: 'ai', title: 'AI generation', sub: 'Generate and review', Icon: Sparkles, color: '#087cf0' },
    { source: 'thirdParty', bucket: 'thirdParty', title: 'Other platform', sub: 'Import from elsewhere', Icon: Globe, color: '#078945' },
  ];
  const selectedRoute = routes.find(route => route.source === source);
  const canContinue = !!selectedRoute && !!row?.buckets.find(bucket => bucket.key === selectedRoute.bucket)?.remaining;
  return <AddQuestionModalShell title="Add Questions" subtitle="Choose difficulty and source" maxWidth={640}
    contextName={exercise.exerciseInformation?.exerciseName} onClose={onClose}
    footer={<div className={styles.chooserFooter}><button onClick={onClose}>Cancel</button><button disabled={!canContinue} onClick={() => source && onChoose(source, selected)} className={styles.continue}>Continue <ArrowRight size={15} /></button></div>}>
    <div className={styles.summary}><span>Configured <strong>{total}</strong></span><span>Added <strong>{added}</strong></span><span>Remaining <strong>{Math.max(0, total - added)}</strong></span></div>
    {allocation.levelBased && <><h3 className={styles.heading}>Choose difficulty</h3><div className={styles.difficultyGrid}>
      {allocation.rows.map(item => <button key={item.level} type="button" aria-pressed={selected === item.level}
        disabled={!item.remaining || !item.buckets.some(bucket => bucket.remaining > 0)}
        onClick={() => { setSelected(item.level); setSource(null); }} className={styles.difficultyCard}>
        <span className={styles.difficultyName}>{selected === item.level ? <Check size={17} /> : <Circle size={17} />}{item.level}</span>
        <span className={styles.difficultyCounts}>{item.added} / {item.total} added <strong>{item.total ? `${item.remaining} remaining` : 'Not configured'}</strong></span>
        {exercise.isGraded !== false && item.marks && <small>{item.marks}</small>}
      </button>)}
    </div></>}
    <div className={styles.sourceHeading}><div><h3 className={styles.heading}>Choose source</h3><p>Select how to add questions{selected ? ` at ${selected} difficulty` : ''}.</p></div><span>{row?.remaining || 0} question slots available</span></div>
    <div className={styles.sourceGrid}>{routes.map(route => {
      const bucket = row?.buckets.find(item => item.key === route.bucket);
      const remaining = bucket?.remaining || 0;
      return <button type="button" key={route.source} className={styles.sourceCard} aria-pressed={source === route.source} disabled={!remaining}
        style={{ '--source-color': route.color } as React.CSSProperties} onClick={() => setSource(route.source)}>
        <span className={styles.sourceIcon}><route.Icon size={24} /></span><span className={styles.sourceRadio}>{source === route.source ? <Check size={17} /> : <Circle size={17} />}</span>
        <strong>{route.title}</strong><span className={styles.sourceCount}>{remaining} available</span>
        <span>{!bucket?.enabled ? 'Not enabled in settings' : !bucket.configured ? 'No allocation for this level' : !remaining ? 'Allowance full' : route.sub}</span>
        {!!bucket?.configured && <small>{bucket.used} added / {bucket.configured} configured</small>}
      </button>;
    })}</div>
    {/* Hint about Scratch/Question-bank shared allowance removed — the two
        entry points are now folded into a single Scratch card, so the note
        no longer applies. */}
    {allowDocument && <button type="button" className={styles.documentLink} disabled={!row?.buckets[0]?.remaining} onClick={() => onChoose('document', selected)}><FileText size={14} /> Import from document · uses the Scratch allowance</button>}
  </AddQuestionModalShell>;
}
