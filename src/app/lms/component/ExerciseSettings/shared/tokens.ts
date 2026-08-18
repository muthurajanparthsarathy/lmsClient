// ─── Design Tokens ────────────────────────────────────────────────────────────
// Shared by ExerciseSettings.tsx (shell) and every extracted step component.
// Aligned to Coursesidebar.tsx / Coursecontent.tsx palette so the modal feels
// like part of the same product. Accent is #E8640C orange, surfaces are
// Slate-tinted whites, type ramp uses the Slate scale (0F172A → 94A3B8).
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
  blue:        '#3b82f6',
  purple:      '#8b5cf6',
  amber:       '#f59e0b',
  red:         '#ef4444',
};

// ─── Font injection (once) ───────────────────────────────────────────────────
// Inter — same family used by Coursesidebar / Coursecontent.
export const injectFonts = (() => {
  let injected = false;
  return () => {
    if (injected || typeof document === 'undefined') return;
    injected = true;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(link);
  };
})();

// Canonical font stack used throughout the modal (matches Coursesidebar).
export const FONT = "'Poppins','DM Sans','Segoe UI',sans-serif";
