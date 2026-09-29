// The app runs under `html { zoom: .95 }` on desktop (globals.css). A panel
// portalled to <body> and pinned with `position: fixed` has its left / top /
// width / max-height multiplied by that zoom, while getBoundingClientRect()
// reports what is actually on screen — so a panel placed straight from a
// measured trigger lands ~5% short of it: shifted left, too narrow, too high.
// Divide measured pixels by this before handing them to a style.
export function pageZoom(): number {
    if (typeof document === 'undefined') return 1
    const body = document.body as HTMLElement & { currentCSSZoom?: number }
    if (typeof body.currentCSSZoom === 'number' && body.currentCSSZoom > 0) return body.currentCSSZoom
    const z = parseFloat(getComputedStyle(document.documentElement).zoom)
    return Number.isFinite(z) && z > 0 ? z : 1
}
