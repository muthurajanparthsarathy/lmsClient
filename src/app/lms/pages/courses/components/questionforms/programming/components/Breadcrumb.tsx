// Breadcrumb rendered in the Programming form's top bar.
// Extracted 2026-08-30, redesigned 2026-08-30 to give the teacher a clear
// idea of where they are AND what they are doing.
//
// Shape (only rendered when the corresponding hierarchyData field is present):
//
//   Course / Module / Submodule / Topic / Subtopic / Exercise / <Tab · Subcategory> / Questions / <Action · Question label>
//
// Separator is a plain "/" per user request. Each crumb keeps its
// data-tip so hovering shows what level it is (Course / Module / Topic / …).
// The final crumb (the current action) is bold so the teacher's eye lands
// on "what am I doing right now" first — matching the "you are here" idiom.

import React from 'react';

const capFirst = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

// Human label for the We_Do / You_Do tab tag. The DB values are the raw
// underscore forms; the breadcrumb should read like a person wrote it.
const humanTab = (t?: string) => {
  if (!t) return '';
  if (t === 'We_Do') return 'We Do';
  if (t === 'You_Do') return 'You Do';
  return t.replace(/_/g, ' ');
};

// Small reusable crumb piece. `tip` becomes a hover-tooltip via [data-tip]
// (styled by `.lms-crumb[data-tip]:hover::before` in `programming/styles.ts`).
const Crumb: React.FC<{
  text: string; tip: string;
  color?: string; weight?: number; maxWidth?: number;
}> = ({ text, tip, color = 'var(--lms-text-sec)', weight = 500, maxWidth }) => (
  <span
    className="lms-crumb"
    data-tip={tip}
    style={{
      color, fontWeight: weight, verticalAlign: 'bottom',
      display: 'inline-block',
      ...(maxWidth ? { maxWidth, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } : {}),
    }}
  >
    {text}
  </span>
);

export const QuestionFormBreadcrumb: React.FC<{
  hierarchyData: any; tabType?: string; subcategory?: string; subcategoryLabel?: string;
  exerciseName?: string; actionLabel: string; questionLabel: string;
}> = ({ hierarchyData, subcategoryLabel, exerciseName }) => {
  const Sep = () => <li aria-hidden="true"><span className="lms-breadcrumb-sep">/</span></li>;

  // Build the crumb rail. Order = wide → narrow scope:
  //   Course / Module / Submodule / Topic / Subtopic / <Subcategory> / <Exercise>
  // The final crumb is the Exercise name (aka "assessment name" in You_Do
  // context) and gets the bold-orange "you are here" treatment. The
  // Questions / Add-Question / Question-#N tail was removed 2026-08-30 per
  // user request — where the teacher is (subcategory + exercise) is enough
  // context; what they're doing is obvious from the form on screen.
  const rail: Array<{ text: string; tip: string; maxWidth?: number; color?: string; weight?: number }> = [];
  if (hierarchyData?.courseName)    rail.push({ text: capFirst(hierarchyData.courseName),    tip: 'Course',    maxWidth: 160 });
  if (hierarchyData?.moduleName)    rail.push({ text: capFirst(hierarchyData.moduleName),    tip: 'Module',    maxWidth: 140 });
  if (hierarchyData?.submoduleName) rail.push({ text: capFirst(hierarchyData.submoduleName), tip: 'Submodule', maxWidth: 140 });
  if (hierarchyData?.topicName)     rail.push({ text: capFirst(hierarchyData.topicName),     tip: 'Topic',     maxWidth: 140 });
  if (hierarchyData?.subtopicName)  rail.push({ text: capFirst(hierarchyData.subtopicName),  tip: 'Subtopic',  maxWidth: 140 });
  if (subcategoryLabel)             rail.push({ text: capFirst(subcategoryLabel),            tip: 'Section',   maxWidth: 140 });

  return (
    <nav aria-label="Breadcrumb" style={{ fontFamily: 'var(--lms-font)' }}>
      {/* flex-nowrap keeps the whole rail on ONE line — the wrapper in
          the parent header has overflow-x:auto so long rails scroll
          horizontally instead of wrapping into a second row. */}
      <ol className="flex items-center flex-nowrap whitespace-nowrap" style={{ minWidth: 'max-content' }}>
        {rail.map((c, i) => (
          <React.Fragment key={i}>
            <li>
              <Crumb
                text={c.text}
                tip={c.tip}
                color={c.color}
                weight={c.weight}
                maxWidth={c.maxWidth}
              />
            </li>
            <Sep />
          </React.Fragment>
        ))}
        {/* Final crumb: the exercise / assessment name, bold-orange as
            the "you are here" spotlight. No trailing separator. */}
        {exerciseName && (
          <li>
            <span
              className="lms-crumb"
              data-tip="Assessment"
              style={{
                fontFamily: 'var(--lms-font)', fontSize: 12.5, fontWeight: 700,
                color: 'var(--lms-orange)',
                display: 'inline-block',
                maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                verticalAlign: 'bottom',
              }}
            >
              {capFirst(exerciseName)}
            </span>
          </li>
        )}
      </ol>
    </nav>
  );
};
