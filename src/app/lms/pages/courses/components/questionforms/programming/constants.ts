// Difficulty style tokens shared by every difficulty-scoped surface in the
// Programming form (pills, badges, progress bars, action buttons, sidebar rows).
// Extracted 2026-08-30 from ProgrammingQuestionForm.tsx.
//
// `DS[diff]` returns an object of ready-to-spread style fragments — the form
// spreads them directly into inline `style` props for the current difficulty.
// Green / amber / red are hand-picked to match the sidebar chips in the
// exercise details panel and the badges on the saved-questions list.

export const DS: Record<string, any> = {
  easy: {
    bg: '#f0fdf4', border: '#bbf7d0', text: '#16a34a', dot: '#16a34a',
    bar: '#16a34a', solid: { background: '#16a34a', color: 'white' },
    pill: { background: '#f0fdf4', color: '#16a34a', border: '1.5px solid #bbf7d0' },
    badgeBg: '#f0fdf4', badgeColor: '#16a34a', badgeBorder: '#bbf7d0',
  },
  medium: {
    bg: '#fffbeb', border: '#fde68a', text: '#d97706', dot: '#d97706',
    bar: '#d97706', solid: { background: '#d97706', color: 'white' },
    pill: { background: '#fffbeb', color: '#d97706', border: '1.5px solid #fde68a' },
    badgeBg: '#fffbeb', badgeColor: '#d97706', badgeBorder: '#fde68a',
  },
  hard: {
    bg: '#fff5f5', border: '#fed7d7', text: '#e53e3e', dot: '#e53e3e',
    bar: '#e53e3e', solid: { background: '#e53e3e', color: 'white' },
    pill: { background: '#fff5f5', color: '#e53e3e', border: '1.5px solid #fed7d7' },
    badgeBg: '#fff5f5', badgeColor: '#e53e3e', badgeBorder: '#fed7d7',
  },
};
