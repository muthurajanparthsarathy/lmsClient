/* One rule for how a value is CAPITALISED on the Service Mapping surfaces.
 *
 * Values arrive from the database exactly as somebody typed them — "placement
 * training", "skilling", "htd" — and the page shows them next to labels that
 * are written properly, so a raw value reads as a bug. Everything goes through
 * here instead of each surface inventing its own casing.
 *
 * Two cases, and the second is the reason this exists rather than a plain
 * `capitalize` class:
 *
 *   - ACRONYMS stay upper: TD, HTD, CSR, COE, B2B, DIV. Title-casing those
 *     produces "Htd" and "Csr", which is worse than leaving them alone.
 *   - Everything else is Title Case, with the small connecting words kept
 *     lower unless they lead — "Business to Business", not "Business To
 *     Business".
 *
 * Display only. Filtering, matching and what gets saved all keep the stored
 * value untouched.
 */

const MINOR_WORDS = new Set([
    'a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'vs', 'with',
])

/** Known acronyms plus the shape of one: up to four letters with no vowel
 *  pattern worth title-casing (TD, HTD, CSR, COE), or a digit inside (B2B). */
const ACRONYMS = new Set(['td', 'htd', 'csr', 'coe', 'b2b', 'b2i', 'b2c', 'div', 'prt', 'ai', 'it', 'hr'])

const isAcronym = (word: string) => {
    const bare = word.replace(/[^a-z0-9]/gi, '')
    if (!bare) return false
    if (ACRONYMS.has(bare.toLowerCase())) return true
    // Already written in capitals by whoever typed it, and short enough that
    // it is a code rather than a word.
    return bare.length <= 4 && bare === bare.toUpperCase() && /[A-Z]/.test(bare)
}

export const titleCase = (value: string): string => {
    if (!value) return ''
    return value
        .trim()
        .split(/(\s+)/)
        .map((part, index) => {
            if (!part.trim()) return part
            if (isAcronym(part)) return part.toUpperCase()
            const lower = part.toLowerCase()
            // index counts the separators too, so the first WORD is index 0.
            if (index > 0 && MINOR_WORDS.has(lower)) return lower
            return lower.charAt(0).toUpperCase() + lower.slice(1)
        })
        .join('')
}
