// Framer Motion variants for the pedagogy popups.
// Moved verbatim out of page.tsx during the file split.

export const popupVariants = {
    hidden: {
        opacity: 0,
        y: 20,
        transition: { duration: 0.1 }
    },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.3, ease: "easeOut" }
    },
    exit: {
        opacity: 0,
        y: -20,
        transition: { duration: 0.1 }
    }
} as const

export const popAnimation = {
    initial: { scale: 1 },
    animate: {
        scale: [1, 2, 1],
        transition: {
            duration: 1,
            ease: "easeInOut"
        }
    },
    exit: { scale: 1 }
} as any

/** Learning levels, easiest first. Picker is multi-select — a cell can hold
 *  any combination, stored as one combined string ("Easy & Medium"). Use
 *  parseLevels/formatLevels below to move between that string and the list. */
export const LEVEL_OPTIONS = ["Basic", "Easy", "Medium", "Hard"] as const

export const LEVEL_SEPARATOR = " & "

/** "Easy & Medium" -> ["Easy", "Medium"]; tolerates legacy single values and "," */
export function parseLevels(value?: string | null): string[] {
    if (!value) return []
    return value
        .split(/\s*[&,]\s*/)
        .map((part) => part.trim())
        .filter(Boolean)
}

/**
 * ["Medium", "Easy"] -> "Easy & Medium". Always emits LEVEL_OPTIONS order and
 * drops duplicates, so a level saved from two different click orders produces
 * one identical string — level rows are matched by string equality.
 */
export function formatLevels(levels: string[]): string {
    const seen = new Set(levels.map((l) => l.trim()).filter(Boolean))
    const known = LEVEL_OPTIONS.filter((option) => seen.has(option))
    // Preserve anything unrecognised (older data) after the known levels.
    const unknown = [...seen].filter((l) => !LEVEL_OPTIONS.includes(l as any))
    return [...known, ...unknown].join(LEVEL_SEPARATOR)
}

