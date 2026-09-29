// Grading Console palette.
//
// Written as literal hex rather than the app's semantic Tailwind tokens on
// purpose: this screen is specced pixel-for-pixel against a reference design,
// and the shared `--surface` / `--hairline` variables drift with the rest of
// the admin theme. Keeping them here means one place to retune.

export const C = {
  text: "#0B1437",
  textSoft: "#39496B",
  textMuted: "#53658C",
  textFaint: "#8090AF",
  blue: "#0667F9",
  blueDeep: "#0B66F6",
  border: "#DEE7F3",
  borderSoft: "#E7EEF8",
  surface: "#F8FAFE",
  selected: "#EEF5FF",
  green: "#09B96D",
  editorBg: "#182331",
  editorGutter: "#1D2A39",
} as const;

/** Difficulty pill classes — compact (20px tall) so three fit in an 82px row. */
export const DIFFICULTY_PILL: Record<string, string> = {
  easy: "bg-[#E4F7EE] text-[#12A15C]",
  medium: "bg-[#FDF0DF] text-[#DE8100]",
  hard: "bg-[#FDE8EC] text-[#DE3450]",
};

export function difficultyPill(d?: string): string {
  return DIFFICULTY_PILL[(d || "").toLowerCase()] || "bg-[#EEF2F8] text-[#66789C]";
}

/** Shared card chrome for the right-hand grading column. */
export const CARD = "rounded-[12px] border border-[#DEE7F3] bg-white";
