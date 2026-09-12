// ─── Design Tokens ────────────────────────────────────────────────────────────
// Shared by ExerciseSettings.tsx (shell) and every extracted step component.
// Values are the exercise-creation-flow.html demo's design system verbatim —
// warm greys on cream, orange #EE6A22 accent, system font stack. The KEYS are
// unchanged so every existing `D.*` reference keeps working; only the values
// moved to the demo palette.
export const D = {
  orange:      '#EE6A22',                  // --orange
  orangeLight: 'rgba(238,106,34,0.10)',    // soft washes
  orangeMed:   'rgba(238,106,34,0.13)',    // the demo's focus ring alpha
  orangeGlow:  'rgba(238,106,34,0.15)',    // current-step halo
  orangeDark:  '#D65A16',                  // --orange-dark
  bg:          '#ffffff',
  surface:     '#FAF9F8',                  // --wash (card headers, side panels)
  surface2:    '#F5F3F1',                  // segmented-control track
  border:      '#F1EEEA',                  // --soft (dividers)
  border2:     '#E9E5E1',                  // --line (inputs, cards)
  textMain:    '#1D2433',                  // --ink
  textSub:     '#3F4756',                  // card titles / body
  textMuted:   '#6B7280',                  // --muted
  textHint:    '#9CA3AF',                  // --faint
  emerald:     '#0F9D58',                  // --green (switch on, valid)
  blue:        '#175CD3',                  // --blue
  purple:      '#6941C6',                  // --purple
  amber:       '#F0A415',                  // medium-level dot
  red:         '#D92D20',                  // --red
};

// ─── Font injection (once) ───────────────────────────────────────────────────
// The demo uses the native system stack — no webfont download is needed, so
// this is now a no-op kept only because the shell still calls it.
export const injectFonts = (() => {
  let injected = false;
  return () => {
    if (injected || typeof document === 'undefined') return;
    injected = true;
  };
})();

// Canonical font stack used throughout the modal — the demo's stack verbatim.
export const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,'Helvetica Neue',Arial,sans-serif";
