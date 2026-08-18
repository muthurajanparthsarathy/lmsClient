// constants.tsx
// Aligned with ExerciseSettings palette (client/src/app/lms/component/ExerciseSettings/shared/tokens.ts)
// so the Create Assessment modal reads as the same product surface.
export const D = {
  orange:      '#E8640C',
  orangeLight: 'rgba(232,100,12,0.10)',
  orangeMed:   'rgba(232,100,12,0.14)',
  orangeGlow:  'rgba(232,100,12,0.18)',
  orangeDark:  '#C8520A',
  bg:          '#ffffff',
  surface:     '#f8fafc',
  surface2:    '#f4f5f7',
  border:      '#eef0f4',
  border2:     '#e5e7eb',
  textMain:    '#0F172A',
  textSub:     '#334155',
  textMuted:   '#475569',
  textHint:    '#94A3B8',
  emerald:     '#10b981',
  blue:        '#E8640C', // remapped to orange — Assessment used blue as a secondary accent; keep visual unity
  purple:      '#E8640C', // remapped to orange too — no purple accents in the shared surface
  amber:       '#f59e0b',
  red:         '#ef4444',
};

export const injectFonts = (() => {
  let injected = false;
  return () => {
    if (injected || typeof document === 'undefined') return;
    injected = true;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800;900&display=swap';
    document.head.appendChild(link);
  };
})();

export const isApproximatelyEqual = (a: number, b: number, tolerance = 0.01) => Math.abs(a - b) < tolerance;
export const formatDecimal = (v: number) => {
  const n = Number(v);
  if (!isFinite(n)) return '0';
  return n % 1 === 0 ? n.toString() : n.toFixed(2);
};

export const getEntityType = (nt: string) => {
  const m: Record<string, any> = { module: 'modules', submodule: 'submodules', topic: 'topics', subtopic: 'subtopics' };
  return m[nt?.toLowerCase()] || 'topics';
};

export const generateCalendarDays = (year: number, month: number) => {
  const dim = new Date(year, month, 0).getDate();
  const fd = new Date(year, month - 1, 1).getDay();
  const days: (number | null)[] = [];
  for (let i = 0; i < fd; i++) days.push(null);
  for (let i = 1; i <= dim; i++) days.push(i);
  return days;
};

export const moduleLanguages: Record<string, { name: string; icon: string }[]> = {
  'Core Programming': [
    { name: 'C', icon: '/active-images/c.png' }, { name: 'C++', icon: '/active-images/cpp.png' },
    { name: 'Java', icon: '/active-images/java.png' }, { name: 'Python', icon: '/active-images/python.png' },
    { name: 'C#', icon: '/active-images/csharp.png' },
  ],
  'Frontend': [
    { name: 'HTML', icon: '/active-images/html.png' }, { name: 'CSS', icon: '/active-images/css.png' },
    { name: 'JavaScript', icon: '/active-images/javascript.png' }, { name: 'Bootstrap', icon: '/active-images/bootstrap.png' },
    { name: 'TypeScript', icon: '/active-images/typescript.png' }, { name: 'React', icon: '/active-images/react.png' },
  ],
  'Database': [
    { name: 'SQL', icon: '/active-images/sql.png' }, { name: 'MongoDB', icon: '/active-images/mongodb.png' }
  ],
};

export const mcqScoringOptions = [
  { value: 'equalDistribution', label: 'Equal Distribution' },
  { value: 'questionSpecific', label: 'Question Specific' }
];

export const configOptions = [
  { label: 'General Configuration', value: 'general' },
  { label: 'Level Based Configuration', value: 'levelBased' },
  { label: 'Selection Level Configuration', value: 'selectionLevel' },
];

export const questionFlowOptions = [
  { value: 'freeFlow', label: 'Free Flow', description: 'Users can attempt questions in any order', icon: 'Shuffle' },
  { value: 'controlled', label: 'Controlled Flow', description: 'Users must follow specific sequence', icon: 'Lock' },
];

export const levelScoringOptions = [
  { value: 'level_specific', label: 'Level-specific marks' },
  { value: 'question_specific', label: 'Question-specific marks' },
];