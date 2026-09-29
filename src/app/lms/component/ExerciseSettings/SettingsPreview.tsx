import React from 'react';
import { Award, CalendarDays, Clock3, FileQuestion, Radio, CircleCheck, CircleAlert } from 'lucide-react';
import DOMPurify from 'dompurify';
import styles from './AssignmentSettings.module.css';

type PreviewProps = {
  formData: any;
  questionSource: string;
  customSources: string[];
  questionCount: number;
  location: string;
  issues: string[];
  allocatedMarks: number;
  onIssueClick?: (issue: string) => void;
  /** What is being set up — drives every label. Defaults to 'assignment'
   *  (We Do); the You Do assessment form passes 'assessment'. */
  noun?: 'assignment' | 'assessment';
};

const sourceNames: Record<string, string> = { scratch: 'Manual', ai: 'AI automation', thirdParty: 'Other platform', custom: 'Combined sources' };
function hasDate(value: any): boolean {
  return !!(value?.day && value?.month && value?.year);
}
function displayDate(value: any) {
  if (!hasDate(value)) return 'Not set';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
    .format(new Date(value.year, value.month - 1, value.day, value.hour || 0, value.minute || 0));
}
// Any value the trainer has not supplied yet renders in the danger colour so
// an unfinished assignment is obvious at a glance in the preview.
function Missing({ children }: { children: React.ReactNode }) {
  return <span className={styles.previewMissing}>{children}</span>;
}
function displayDateCell(value: any) {
  const text = displayDate(value);
  return text === "Not set" ? <Missing>Not set</Missing> : text;
}

function RichText({ value, placeholder }: { value?: string; placeholder: string }) {
  if (!value || !value.replace(/<[^>]*>/g, '').trim()) return <p className={`${styles.previewPlaceholder} ${styles.previewMissing}`}>{placeholder}</p>;
  return <div className={styles.previewRichText} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(value) }} />;
}

export function SettingsPreview({ formData: data, questionSource, customSources, questionCount, location, issues, allocatedMarks, onIssueClick, noun = 'assignment' }: PreviewProps) {
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1);
  const graded = data.isGraded !== false;
  const combined = data.exerciseType === 'Combined';
  const config = data.exerciseType === 'MCQ' ? data.mcqConfig : data.exerciseType === 'Other' ? data.othersConfig : data.programmingConfig;
  const marks = combined ? Number(data.totalMarksMCQ || 0) + Number(data.totalMarksProgramming || 0) : data.totalMarks;
  const pass = combined ? data.grades.combinedGradeToPass : data.exerciseType === 'MCQ' ? data.grades.mcqGradeToPass : data.grades.programmingGradeToPass;
  const channels = data.notifications?.notifyStudentChannels || {};
  const enabledChannels = Object.entries(channels).filter(([, enabled]) => enabled).map(([name]) => name === 'gmail' ? 'Email' : name === 'whatsapp' ? 'WhatsApp' : 'Dashboard');
  const difference = Math.round((Number(marks || 0) - allocatedMarks) * 100) / 100;
  const number = (value: number) => Number(value.toFixed(2)).toLocaleString();
  // Only surface the Easy/Medium/Hard breakdown when the trainer has picked a
  // level-based strategy. An empty questionConfigType (the default before
  // Question Configuration is opened) used to fall through to
  // `levelBasedCounts`, which meant a fresh graded exercise showed E/M/H rows
  // full of zeros before the user had chosen anything.
  const levelStrategy = config?.questionConfigType === 'selectionLevel' || config?.questionConfigType === 'levelBased';
  const levelCounts = levelStrategy
    ? (config.questionConfigType === 'selectionLevel' ? config.selectionLevelCounts : config.levelBasedCounts)
    : null;
  const levelScoring = config?.scoreSettings?.levelScoringConfiguration;
  return <aside className={styles.previewPane} aria-label={`Live ${noun} preview`}>
    <div className={styles.previewHeading}><div><strong>{Noun} preview</strong><span>Updates as you edit</span></div><span className={styles.liveBadge}><Radio size={12} /> Live</span></div>
    <article className={styles.previewCard}>
      <div className={styles.previewEyebrow}>{noun.toUpperCase()} {data.exerciseId && <span>· {data.exerciseId}</span>}</div>
      <h2>{data.exerciseName || <Missing>Untitled {noun}</Missing>}</h2>
      {location && <p className={styles.previewLocation}>{location}</p>}
      {(data.exerciseType || data.exerciseLevel) && (
        <div className={styles.previewTags}>
          {data.exerciseType && <span>{data.exerciseType}</span>}
          {data.exerciseLevel && <span>{data.exerciseLevel}</span>}
          <span>{graded ? 'Graded' : 'Non-graded'}</span>
        </div>
      )}
      <div className={styles.previewStats}>
        <div><Clock3 size={16} /><strong>{data.totalDuration || <Missing>—</Missing>}</strong><span>minutes</span></div>
        <div><FileQuestion size={16} /><strong>{questionCount || <Missing>—</Missing>}</strong><span>questions</span></div>
        <div><Award size={16} /><strong>{graded ? (marks || <Missing>—</Missing>) : '—'}</strong><span>{graded ? 'marks' : 'ungraded'}</span></div>
      </div>
      <section className={styles.calculationCard} aria-label="Question and marks breakdown">
        <h3>Question &amp; marks breakdown</h3>
        {questionCount > 0 && <div><span>Total questions</span><strong>{questionCount}</strong></div>}
        {data.exerciseType === 'Combined' ? <>
          {data.mcqConfig.generalQuestionCount > 0 && <div><span>MCQ questions</span><strong>{data.mcqConfig.generalQuestionCount}</strong></div>}
          {(questionCount - (data.mcqConfig.generalQuestionCount || 0)) > 0 && <div><span>Programming questions</span><strong>{questionCount - (data.mcqConfig.generalQuestionCount || 0)}</strong></div>}
        </> : null}
        {levelCounts && Object.entries(levelCounts).map(([level, count]) => {
          const scoring = levelScoring?.[level];
          return <div key={level}><span className={styles.levelName}><i data-level={level} />{level}</span><strong>{String(count || 0)} questions{graded && scoring && <small>{scoring.type === 'question_specific' ? `${number(Number(scoring.totalMarks || 0))} marks to distribute` : `${count || 0} × ${number(Number(scoring.marksPerQuestion || 0))} = ${number(Number(count || 0) * Number(scoring.marksPerQuestion || 0))} marks`}</small>}</strong></div>;
        })}
        {graded && <>
          <div><span>Allocated marks</span><strong>{number(allocatedMarks)}</strong></div>
          <div><span>{Noun} total</span><strong>{number(Number(marks || 0))}</strong></div>
          <p className={difference === 0 && Number(marks) > 0 ? styles.calculationValid : styles.calculationWarning}>
            {difference === 0 && Number(marks) > 0 ? <><CircleCheck size={14} /> Marks match the {noun} total.</> : <><CircleAlert size={14} />{Number(marks) > 0 ? `${number(Math.abs(difference))} marks ${difference > 0 ? 'still to allocate' : `over the ${noun} total`}. Adjust the question counts or marks.` : 'Set a total and allocate marks to your questions.'}</>}
          </p>
        </>}
        {!graded && <p className={styles.previewPlaceholder}>Marks are not required for this {noun}.</p>}
      </section>
      <section className={styles.readiness} data-state={issues.length ? 'incomplete' : 'ready'} aria-label="Setup readiness" aria-live="polite">
        <h3>{issues.length ? <CircleAlert size={15} /> : <CircleCheck size={15} />}{issues.length ? 'Unfinished setup' : 'Ready to complete setup'}</h3>
        <p>{issues.length ? 'You can save your progress now. Review these items before completing setup.' : 'Your settings are ready. Choose Complete setup to finish.'}</p>
        {issues.length > 0 && <details open><summary>{issues.length} {issues.length === 1 ? 'item' : 'items'} to review</summary><ul className={styles.previewIssueList}>{issues.map(issue => (
          onIssueClick
            ? <li key={issue} className={styles.previewMissing}>
                <button type="button" onClick={() => onIssueClick(issue)}
                  className={styles.previewIssueButton}
                  aria-label={`Jump to and fix: ${issue}`}>
                  {issue}
                </button>
              </li>
            : <li key={issue} className={styles.previewMissing}>{issue}</li>
        ))}</ul></details>}
      </section>
      {data.description && data.description.replace(/<[^>]*>/g, '').trim() &&
        <section className={styles.previewSection}><h3>Description</h3><RichText value={data.description} placeholder={`Your ${noun} description will appear here.`} /></section>}
      {data.instructions && data.instructions.replace(/<[^>]*>/g, '').trim() &&
        <section className={styles.previewSection}><h3>Instructions</h3><RichText value={data.instructions} placeholder="No instructions added." /></section>}
      {(hasDate(data.schedule.startDate) || hasDate(data.schedule.endDate)
        || (data.schedule.cutOffEnabled && hasDate(data.schedule.cutOffDate))
        || (data.schedule.remindGradeByEnabled && hasDate(data.schedule.remindGradeBy))) && (
        <section className={styles.previewSection}>
          <h3><CalendarDays size={15} /> Availability</h3>
          <dl className={styles.previewDetails}>
            {hasDate(data.schedule.startDate) && <div><dt>Start date</dt><dd>{displayDate(data.schedule.startDate)}</dd></div>}
            {hasDate(data.schedule.endDate) && <div><dt>End date</dt><dd>{displayDate(data.schedule.endDate)}</dd></div>}
            {data.schedule.cutOffEnabled && hasDate(data.schedule.cutOffDate) && <div><dt>Cut off date</dt><dd>{displayDate(data.schedule.cutOffDate)}</dd></div>}
            {data.schedule.remindGradeByEnabled && hasDate(data.schedule.remindGradeBy) && <div><dt>Grade by date</dt><dd>{displayDate(data.schedule.remindGradeBy)}</dd></div>}
          </dl>
        </section>
      )}
      {(() => {
        // Only surface rows that have real values. Missing entries live in
        // the Unfinished setup panel above instead of scattered "Not set"
        // pills through the details list.
        const rows: React.ReactNode[] = [];
        if (questionSource) {
          const label = questionSource === 'custom'
            ? customSources.map(source => sourceNames[source] || source).join(', ')
            : sourceNames[questionSource];
          if (label) rows.push(<div key="src"><dt>Questions from</dt><dd>{label}</dd></div>);
        }
        if (config?.attemptLimitEnabled) rows.push(<div key="attempts"><dt>Attempts</dt><dd>{config.submissionAttempts}</dd></div>);
        if (config?.questionFlow) rows.push(<div key="flow"><dt>Question flow</dt><dd>{config.questionFlow === 'controlled' ? 'Sequential' : 'Free navigation'}</dd></div>);
        if (graded && pass != null) rows.push(<div key="pass"><dt>Pass mark</dt><dd>{`${pass} / ${marks || 0}`}</dd></div>);
        if (data.notifications?.notifyStudent && enabledChannels.length > 0) rows.push(<div key="alerts"><dt>Student alerts</dt><dd>{enabledChannels.join(', ')}</dd></div>);
        if (graded && data.notifications?.notifyGradersSubmissions) rows.push(<div key="grader"><dt>Grader alerts</dt><dd>On</dd></div>);
        if (data.schedule.requiresAdminApproval) rows.push(<div key="approval"><dt>Approval</dt><dd>Required</dd></div>);
        if (rows.length === 0) return null;
        return (
          <section className={styles.previewSection}>
            <h3>Configuration</h3>
            <dl className={styles.previewDetails}>{rows}</dl>
          </section>
        );
      })()}
    </article>
    <p className={styles.previewFootnote}>Preview only. Save changes to update the {noun}.</p>
  </aside>;
}
