"use client"

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react'
import Shepherd from 'shepherd.js'
import 'shepherd.js/dist/css/shepherd.css'

// Shepherd v14 ships a single default export (a `ShepherdBase` instance) and does
// not export the `Tour` class as a named type, so the instance type has to be
// derived from the constructor hanging off that default export.
type ShepherdTour = InstanceType<typeof Shepherd.Tour>

// Only the placements this walkthrough actually uses. FloatingUI's own
// `Placement` union is not re-exported by shepherd.js, and narrowing to the
// handful we use keeps the beat table honest about what it is asking for.
type TourPlacement = 'top' | 'bottom' | 'left' | 'right' | 'bottom-start' | 'right-start'

export const WIZARD_TOUR_STORAGE_KEY = 'smartcliff_sm_wizard_tour_v1'

/** Imperative handle so the Guide button can replay the walkthrough on demand. */
export interface WizardTourHandle {
    runTour: () => void
}

interface WizardTourProps {
    /** Mirrors the wizard modal's own open state; the tour must never outlive it. */
    open: boolean
    /** The wizard's current step index. Beats are built for the step on screen. */
    stepIndex: number
    /** Fired when the walkthrough ends, however it ends (finished, skipped, escaped). */
    onFinish?: () => void
}

interface TourBeat {
    id: string
    /** `data-tour` value; resolved to `[data-tour="…"]` at attach time. */
    anchor: string
    on: TourPlacement
    title: string
    text: string
}

/**
 * The walkthrough is authored per wizard step because this is a multi-step modal:
 * the anchors for step 2 simply are not mounted while step 1 is on screen, so a
 * single flat step list would spend half its beats attached to nothing.
 *
 * Within step 2 three chains are mutually exclusive at runtime (they follow from
 * the chosen service model), so they live in one ordered list and the DOM-presence
 * filter in `buildAndStart` leaves whichever chain is actually rendered:
 *   - degree hierarchy: sm-degree, sm-startyear, sm-departments, sm-sections,
 *     sm-semesters, sm-workbench, sm-semtabs, sm-course-row, sm-course-batches
 *   - flat CSR/COE/B2B: sm-courses, sm-batchcount, sm-batch-names — these two
 *     batch anchors now exist ONLY here; placement no longer renders them
 *   - placement training: sm-phases (mapping-level phase count and names), then
 *     sm-prt-courses (the one course each phase carries, batches inside it)
 * sm-save closes every chain, and the step-0 anchors are shared by all models.
 *
 * That exclusivity is enforced at the anchors, not here, and it is easy to break:
 * `sm-course-row` is emitted by a component several chains render, so CourseRow
 * gates it on the degree flow (batches shown, not forced), and the placement
 * course card carries its own `sm-prt-courses` rather than a second `sm-courses`.
 * An anchor that appears in two chains silently attaches its step to whichever
 * copy the DOM returns first.
 */
const BEATS_BY_WIZARD_STEP: Record<number, TourBeat[]> = {
    0: [
        {
            id: 'sm-steps',
            anchor: 'sm-steps',
            on: 'right',
            title: 'Map a service to a college',
            text: 'This wizard records where a service actually runs — which client, which course, and which student groups sit it. These two steps track your progress, and you can jump back to either one at any time.',
        },
        {
            id: 'sm-client',
            anchor: 'sm-client',
            on: 'bottom-start',
            title: 'Start with the client',
            text: 'Pick the college or company this mapping belongs to. Everything you fill in after this is scoped to them.',
        },
        {
            id: 'sm-service',
            anchor: 'sm-service',
            on: 'bottom-start',
            title: 'Then the service',
            text: 'Choose the service your team is contracted to deliver for that client.',
        },
        {
            id: 'sm-year',
            anchor: 'sm-year',
            on: 'bottom-start',
            title: 'Which year',
            text: 'Set the year this engagement runs in. It is also used to suggest sensible batch names later on.',
        },
        {
            id: 'sm-model',
            anchor: 'sm-model',
            on: 'bottom-start',
            title: 'The service model decides everything after it',
            text: 'This is the choice that matters most. The model you pick fixes the structure you will fill in on the next step — a full degree hierarchy for Degree Program and DIV, or a simpler course-and-batches form for everything else.',
        },
        {
            id: 'sm-partner',
            anchor: 'sm-partner',
            on: 'bottom-start',
            title: 'Partner institution',
            text: 'CSR and COE engagements are delivered through a partner institution, so name it here. This field only appears for those models.',
        },
        {
            id: 'sm-save',
            anchor: 'sm-save',
            on: 'top',
            title: 'Save as you go',
            text: 'Save stores a partial mapping so you can walk away and finish it later from the list. Use Next when you are ready to build the structure.',
        },
    ],
    1: [
        {
            id: 'sm-degree',
            anchor: 'sm-degree',
            on: 'bottom-start',
            title: 'Begin the hierarchy at the degree',
            text: 'The structure is built top-down, and the degree programme is the top. Everything below hangs off this one choice.',
        },
        {
            id: 'sm-startyear',
            anchor: 'sm-startyear',
            on: 'bottom-start',
            title: 'Starting year',
            text: 'The year this cohort began the programme. The end year counts forward from it using the degree\'s length.',
        },
        {
            id: 'sm-departments',
            anchor: 'sm-departments',
            on: 'bottom-start',
            title: 'Departments under the degree',
            text: 'Add every department running this programme — CSE, ECE, and so on. Each one becomes its own branch of the tree, and the semesters you pick next are created under all of them.',
        },
        {
            id: 'sm-sections',
            anchor: 'sm-sections',
            on: 'top',
            title: 'Sections, if the college teaches in parallel',
            text: 'Split each semester into sections when the same semester runs as separate groups. Leave it alone if it does not.',
        },
        {
            id: 'sm-semesters',
            anchor: 'sm-semesters',
            on: 'bottom-start',
            title: 'Semesters in scope',
            text: 'Choose which semesters this mapping covers, and when each one runs. The same semester range is created under every department you just picked.',
        },
        {
            id: 'sm-workbench',
            anchor: 'sm-workbench',
            on: 'left',
            title: 'Your tree, built',
            text: 'Applying the setup expands it into the full tree: degree, then department, then section, then semester. Pick a node on the left and its contents open on the right.',
        },
        {
            id: 'sm-semtabs',
            anchor: 'sm-semtabs',
            on: 'bottom',
            title: 'Courses live inside a semester',
            text: 'This is the part people get lost in — courses are not attached to the degree, they are attached to one semester. Select the semester tab first, then add its courses.',
        },
        {
            id: 'sm-course-row',
            anchor: 'sm-course-row',
            on: 'top',
            title: 'Add the courses',
            text: 'Choose the category first; it filters the course names offered next to it. Add one row per course taught in this semester.',
        },
        {
            id: 'sm-course-batches',
            anchor: 'sm-course-batches',
            on: 'top',
            title: 'And finally the batches',
            text: 'Tick this when a course runs as parallel batches, then name each one. That completes the chain: degree, department, section, semester, course, batch.',
        },
        {
            // Course now leads the flat chain — the layout flipped to course
            // first, batches second, and the beats must walk the screen's order.
            id: 'sm-courses',
            anchor: 'sm-courses',
            on: 'top',
            title: 'The course being delivered',
            text: 'Pick the category, then the course name it filters to. In these models one mapping carries one course, taken by all the batches below.',
        },
        {
            id: 'sm-batchcount',
            anchor: 'sm-batchcount',
            on: 'bottom-start',
            title: 'How many batches',
            text: 'Then the number of student groups sitting it. Each one gets its own name card below.',
        },
        {
            id: 'sm-batch-names',
            anchor: 'sm-batch-names',
            on: 'right-start',
            title: 'Name each batch',
            text: 'Give every batch a name the college will recognise on a report. The service providing year is offered as a naming hint.',
        },
        {
            // The placement chain opens here: in the new shape phases belong to
            // the mapping itself, so the walkthrough meets them before any course.
            id: 'sm-phases',
            anchor: 'sm-phases',
            on: 'bottom-start',
            title: 'Phases come first',
            text: 'Tick Enable phases when this training runs in stages, then set how many. With it off, the mapping carries a single course directly.',
        },
        {
            id: 'sm-prt-courses',
            anchor: 'sm-prt-courses',
            on: 'top',
            title: 'The phase name IS the course',
            text: 'Naming a phase names its course — one input answers both. Tick Batches on a phase to say how many groups sit it and name each one. With phases off, name the single course here instead.',
        },
        {
            id: 'sm-save',
            anchor: 'sm-save',
            on: 'top',
            title: 'Save & Preview',
            text: 'This writes the mapping, then shows a hierarchy preview of exactly what was saved — use Modify there to adjust and re-save, or Done to close. Setting up each course — structure, calendar, resources — happens afterwards in Course Setup.',
        },
    ],
}

const selectorFor = (anchor: string) => `[data-tour="${anchor}"]`

// Presence in the DOM is not enough to anchor against: `sm-steps` lives in a
// `hidden sm:flex` sidebar, so below that breakpoint it still matches the
// selector while having no box at all — Shepherd would attach to a zero-size
// rect and park the popover in a viewport corner pointing at nothing.
const isAnchorPresent = (anchor: string) => {
    const el = document.querySelector<HTMLElement>(selectorFor(anchor))
    return Boolean(el && el.offsetParent !== null && el.getBoundingClientRect().width > 0)
}

/**
 * Themed CSS for this tour only.
 *
 * Every rule is scoped either by `.sm-wizard-tour` (applied to each step element
 * via `defaultStepOptions.classes`) or by `body.sm-wizard-tour-active` (for the
 * shared overlay container, which Shepherd renders without any per-tour class).
 * Without that scoping these orange tokens would repaint SummaryTutorial's blue
 * tour, since both tours style the same global `.shepherd-*` classes.
 *
 * The z-index sits far above the wizard modal's `z-50` and its nested overlay
 * confirm dialogs. Shepherd appends the popover to `document.body` rather than to
 * the modal, which is what keeps it clear of the `overflow:hidden` the modal uses
 * for its height animation — the high z-index is what keeps it clear of the
 * backdrop once it is out there.
 */
const TOUR_CSS = `
.shepherd-element.sm-wizard-tour {
    z-index: 10000;
    max-width: 340px;
    background: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: 16px;
    box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04), 0 12px 32px -8px rgba(26, 21, 18, 0.18);
    font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    animation: sm-wizard-tour-in 0.2s ease-out;
}

@keyframes sm-wizard-tour-in {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
    .shepherd-element.sm-wizard-tour { animation: none; }
}

.shepherd-element.sm-wizard-tour .shepherd-arrow::before {
    background: var(--color-surface);
    border: 1px solid var(--color-line);
}

.shepherd-element.sm-wizard-tour .shepherd-content {
    border-radius: 16px;
    padding: 0;
}

.shepherd-element.sm-wizard-tour .shepherd-header {
    background: transparent;
    padding: 18px 18px 0;
    border-radius: 16px 16px 0 0;
}

.shepherd-element.sm-wizard-tour .shepherd-title {
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    color: var(--color-heading);
    line-height: 1.4;
}

.shepherd-element.sm-wizard-tour .shepherd-cancel-icon {
    color: var(--color-ink-400);
    font-size: 18px;
    transition: color 0.15s ease;
}

.shepherd-element.sm-wizard-tour .shepherd-cancel-icon:hover {
    color: var(--color-heading);
}

.shepherd-element.sm-wizard-tour .shepherd-text {
    font-family: inherit;
    font-size: 12.5px;
    line-height: 1.6;
    color: var(--color-ink-500);
    padding: 8px 18px 0;
}

.shepherd-element.sm-wizard-tour .sm-tour-count {
    display: block;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-brand-500);
    margin-bottom: 6px;
}

.shepherd-element.sm-wizard-tour .shepherd-footer {
    padding: 14px 18px 16px;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
}

.shepherd-element.sm-wizard-tour .shepherd-button {
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    height: 32px;
    padding: 0 16px;
    border-radius: 10px;
    border: none;
    cursor: pointer;
    transition: filter 0.15s ease, background-color 0.15s ease;
    background: var(--color-brand-700);
    color: white;
    box-shadow: var(--shadow-sm);
}

.shepherd-element.sm-wizard-tour .shepherd-button:not(:disabled):hover {
    background: var(--color-brand-800);
}

.shepherd-element.sm-wizard-tour .shepherd-button.shepherd-button-secondary {
    background: var(--color-surface);
    color: var(--color-ink-500);
    border: 1px solid var(--color-line);
    box-shadow: none;
}

.shepherd-element.sm-wizard-tour .shepherd-button.shepherd-button-secondary:hover {
    background: var(--color-row-hover);
    color: var(--color-heading);
}

/* Applied by Shepherd to the anchored element itself via \`highlightClass\`. */
.sm-wizard-tour-target {
    position: relative;
    z-index: 9999;
    border-radius: 12px;
    box-shadow: 0 0 0 2px var(--color-brand-500), 0 0 0 6px rgba(249, 115, 22, 0.16);
    transition: box-shadow 0.2s ease;
}

body.sm-wizard-tour-active .shepherd-modal-overlay-container {
    z-index: 9998;
}
`

const WizardTour = forwardRef<WizardTourHandle, WizardTourProps>(function WizardTour(
    { open, stepIndex, onFinish },
    ref
) {
    const tourRef = useRef<ShepherdTour | null>(null)
    const styleRef = useRef<HTMLStyleElement | null>(null)
    // True for as long as the user is inside the walkthrough. It has to survive
    // the tour being torn down and rebuilt when the wizard advances a step, which
    // is why it is a ref rather than component state.
    const runningRef = useRef(false)
    // Set while we are deliberately tearing a tour down mid-walkthrough, so the
    // teardown does not fire the terminal handlers and end the whole session.
    const rebuildingRef = useRef(false)
    // Direction of travel, used to decide which way to skip past an anchor that
    // has vanished from the DOM since the beat list was built.
    const directionRef = useRef<1 | -1>(1)
    const onFinishRef = useRef(onFinish)
    onFinishRef.current = onFinish

    const removeStyle = useCallback(() => {
        styleRef.current?.remove()
        styleRef.current = null
    }, [])

    const clearHighlights = useCallback(() => {
        document.querySelectorAll('.sm-wizard-tour-target').forEach((el) => {
            el.classList.remove('sm-wizard-tour-target')
        })
        // Shepherd puts tabIndex=0 on every element it attaches to and never takes
        // it back. Left behind, the plain layout wrappers carrying data-tour would
        // stay keyboard tab stops for the rest of the page's life — and the tour
        // auto-runs, so every first-time user would inherit a changed tab order in
        // a form this work was supposed to leave untouched.
        document.querySelectorAll('[data-tour][tabindex="0"]').forEach((el) => {
            el.removeAttribute('tabindex')
        })
        document.body.classList.remove('sm-wizard-tour-active')
    }, [])

    /** Tears the live tour down without ending the walkthrough session. */
    const teardownTour = useCallback(() => {
        const tour = tourRef.current
        tourRef.current = null
        if (tour) {
            rebuildingRef.current = true
            try {
                // `complete()` is a no-op on a tour that never started, and unlike
                // `cancel()` it will not trip a confirmCancel prompt.
                tour.complete()
            } finally {
                rebuildingRef.current = false
            }
        }
        clearHighlights()
    }, [clearHighlights])

    /** Ends the walkthrough for good: tears down, persists, notifies. */
    const endSession = useCallback(() => {
        runningRef.current = false
        teardownTour()
        removeStyle()
        try {
            window.localStorage.setItem(WIZARD_TOUR_STORAGE_KEY, 'done')
        } catch {
            // Storage can be unavailable (private mode, blocked cookies). The tour
            // still ran; it will simply offer itself again next time.
        }
        onFinishRef.current?.()
    }, [removeStyle, teardownTour])

    const buildAndStart = useCallback(() => {
        teardownTour()

        // Only the beats whose anchor is on screen right now. This is the primary
        // defence against attaching to nothing: the wizard renders different
        // fields per service model, and the degree workbench does not exist until
        // its setup is applied.
        const beats = (BEATS_BY_WIZARD_STEP[stepIndex] ?? []).filter((beat) => isAnchorPresent(beat.anchor))
        if (beats.length === 0) {
            endSession()
            return
        }

        if (!styleRef.current) {
            const style = document.createElement('style')
            style.setAttribute('data-sm-wizard-tour', 'true')
            style.textContent = TOUR_CSS
            document.head.appendChild(style)
            styleRef.current = style
        }
        document.body.classList.add('sm-wizard-tour-active')

        const tour: ShepherdTour = new Shepherd.Tour({
            useModalOverlay: true,
            keyboardNavigation: true,
            exitOnEsc: true,
            defaultStepOptions: {
                classes: 'sm-wizard-tour',
                highlightClass: 'sm-wizard-tour-target',
                cancelIcon: { enabled: true },
                scrollTo: { behavior: 'smooth', block: 'center' },
                arrow: true,
                modalOverlayOpeningPadding: 6,
                modalOverlayOpeningRadius: 12,
            },
        })
        tourRef.current = tour

        beats.forEach((beat, index) => {
            const isFirst = index === 0
            const isLast = index === beats.length - 1

            tour.addStep({
                id: beat.id,
                title: beat.title,
                text: `<span class="sm-tour-count">Step ${index + 1} of ${beats.length}</span>${beat.text}`,
                attachTo: {
                    // Resolved lazily on show rather than captured at build time, so
                    // a re-rendered field (React replacing the node) still anchors.
                    element: () => document.querySelector<HTMLElement>(selectorFor(beat.anchor)),
                    on: beat.on,
                },
                buttons: [
                    isFirst
                        ? { text: 'Skip', secondary: true, action: () => endSession() }
                        : {
                            text: 'Back',
                            secondary: true,
                            action: () => {
                                directionRef.current = -1
                                tour.back()
                            },
                        },
                    isLast
                        ? { text: 'Done', action: () => endSession() }
                        : {
                            text: 'Next',
                            action: () => {
                                directionRef.current = 1
                                tour.next()
                            },
                        },
                ],
            })
        })

        // Second line of defence. The build-time filter cannot know about an
        // anchor that disappears *during* the tour (a model change unmounting the
        // partner field, say). Shepherd would then centre a popover pointing at
        // nothing, so step past it in whichever direction the user was heading.
        tour.on('show', (event: { step?: { id?: string } }) => {
            const beat = beats.find((candidate) => candidate.id === event?.step?.id)
            if (!beat || isAnchorPresent(beat.anchor)) return

            const position = beats.indexOf(beat)
            const forward = directionRef.current === 1
            const hasSomewhereToGo = forward ? position < beats.length - 1 : position > 0
            // Deferred: Shepherd is mid-show, and advancing synchronously from
            // inside its own event would re-enter the same code path.
            window.setTimeout(() => {
                if (tourRef.current !== tour) return
                if (!hasSomewhereToGo) {
                    endSession()
                } else if (forward) {
                    tour.next()
                } else {
                    tour.back()
                }
            }, 0)
        })

        // Escape, the cancel icon and normal completion all end the walkthrough —
        // but not the teardown we perform ourselves when rebuilding for a new
        // wizard step, which is what `rebuildingRef` distinguishes.
        const handleTerminalEvent = () => {
            if (rebuildingRef.current) return
            clearHighlights()
            if (runningRef.current) endSession()
        }
        tour.on('complete', handleTerminalEvent)
        tour.on('cancel', handleTerminalEvent)

        directionRef.current = 1
        tour.start()
    }, [clearHighlights, endSession, stepIndex, teardownTour])

    const runTour = useCallback(() => {
        if (!open) return
        runningRef.current = true
        // One frame of slack so the modal's entrance animation has committed
        // layout; anchoring against a mid-transition element mispositions the
        // popover badly enough to look broken.
        requestAnimationFrame(() => {
            if (runningRef.current) buildAndStart()
        })
    }, [buildAndStart, open])

    useImperativeHandle(ref, () => ({ runTour }), [runTour])

    // Auto-run on the very first visit, and rebuild the beat list whenever the
    // wizard moves between its own steps while the walkthrough is running.
    useEffect(() => {
        if (!open) return

        let cancelled = false
        let frame = 0

        // The wizard swaps panels inside framer-motion's AnimatePresence with
        // mode="wait", so at the instant stepIndex changes the OUTGOING panel is
        // still mounted and the incoming one has not rendered. Building then would
        // filter nearly every beat away as "absent" and collapse the walkthrough to
        // whichever anchors happen to sit outside the animated container. So wait
        // for the incoming step to actually arrive, with a bounded number of frames
        // so a step that genuinely has no anchors still terminates.
        const startWhenAnchorsReady = () => {
            const MAX_FRAMES = 60
            let attempts = 0
            const tick = () => {
                if (cancelled || !runningRef.current) return
                const beats = BEATS_BY_WIZARD_STEP[stepIndex] ?? []
                if (beats.some((beat) => isAnchorPresent(beat.anchor)) || attempts >= MAX_FRAMES) {
                    buildAndStart()
                    return
                }
                attempts += 1
                frame = requestAnimationFrame(tick)
            }
            frame = requestAnimationFrame(tick)
        }

        if (runningRef.current) {
            startWhenAnchorsReady()
            return () => { cancelled = true; cancelAnimationFrame(frame) }
        }

        let seen = true
        try {
            seen = Boolean(window.localStorage.getItem(WIZARD_TOUR_STORAGE_KEY))
        } catch {
            // Treat unreadable storage as "already seen" so a browser that blocks
            // it does not force the tour on the user at every single open.
            seen = true
        }
        if (seen) return

        runningRef.current = true
        startWhenAnchorsReady()
        return () => { cancelled = true; cancelAnimationFrame(frame) }
    }, [open, stepIndex, buildAndStart])

    // Shepherd binds Escape only to the step dialog and the attached element, and
    // never focuses the step on show — so Escape bubbles straight past it to the
    // wizard's own window-level close handler, discarding everything entered. The
    // tour auto-runs and is replayable mid-flow, so that could throw away a fully
    // built degree hierarchy. Capture phase on window runs before that bubble-phase
    // listener, so while the walkthrough is live Escape ends the walkthrough only.
    useEffect(() => {
        if (!open) return
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Escape' || !runningRef.current) return
            e.stopPropagation()
            e.preventDefault()
            endSession()
        }
        window.addEventListener('keydown', onKeyDown, true)
        return () => window.removeEventListener('keydown', onKeyDown, true)
    }, [open, endSession])

    // The tour is rendered into document.body, so nothing about closing the modal
    // removes it on its own — it has to be torn down explicitly here.
    useEffect(() => {
        if (open) return
        runningRef.current = false
        teardownTour()
        removeStyle()
    }, [open, removeStyle, teardownTour])

    useEffect(() => {
        return () => {
            runningRef.current = false
            teardownTour()
            removeStyle()
        }
    }, [removeStyle, teardownTour])

    return null
})

export default WizardTour
