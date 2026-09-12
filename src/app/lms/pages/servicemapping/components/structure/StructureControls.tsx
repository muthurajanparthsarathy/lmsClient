'use client'

// The controls the Structure & course design is built from.
// ─────────────────────────────────────────────────────────────────────────────
// Two families, because the two surfaces answer the same question differently:
//
//   • StructureToggle / StructureStepper — the standalone screen
//     (StructureCourseStep), where the step is drawn at full page scale. Sized
//     by a token (`lg` there, `md` if ever embedded) rather than duplicated.
//   • StructureCheckbox / StructureCountInput — the service-mapping modal,
//     which asks its yes/no questions with checkboxes and takes counts by
//     direct entry, like every other field in that wizard.

import React, { useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { cn } from '@/lib/utils'

export type ControlSize = 'md' | 'lg'

const TOGGLE: Record<ControlSize, { root: string; thumb: string }> = {
    md: { root: 'h-6 w-11 p-[3px]', thumb: 'size-[18px] data-[state=checked]:translate-x-[20px]' },
    lg: { root: 'h-9 w-[62px] p-[4px]', thumb: 'size-7 data-[state=checked]:translate-x-[26px]' },
}

/**
 * The step's on/off pill. Radix, so it is a real switch to assistive tech and to
 * the keyboard — the label it belongs to is passed by id rather than repeated as
 * an "Enabled" caption beside it.
 *
 * brand-600 rather than 700: the track carries no text, and 700 is reserved for
 * surfaces that do (see the contrast note in globals.css).
 */
export function StructureToggle({
    checked,
    onCheckedChange,
    labelledBy,
    size = 'md',
}: {
    checked: boolean
    onCheckedChange: (next: boolean) => void
    labelledBy: string
    size?: ControlSize
}) {
    return (
        <SwitchPrimitive.Root
            checked={checked}
            onCheckedChange={onCheckedChange}
            aria-labelledby={labelledBy}
            className={cn(
                'inline-flex shrink-0 cursor-pointer items-center rounded-full outline-none transition-colors',
                'data-[state=checked]:bg-brand-600 data-[state=unchecked]:bg-ink-300',
                'focus-visible:ring-4 focus-visible:ring-brand-500/30',
                TOGGLE[size].root
            )}
        >
            <SwitchPrimitive.Thumb
                className={cn(
                    'pointer-events-none block rounded-full bg-white shadow-sm transition-transform',
                    'data-[state=unchecked]:translate-x-0',
                    TOGGLE[size].thumb
                )}
            />
        </SwitchPrimitive.Root>
    )
}

const STEPPER: Record<ControlSize, { root: string; value: string; icon: number }> = {
    md: { root: 'h-9 w-[120px] rounded-control', value: 'text-sm', icon: 14 },
    lg: { root: 'h-[53px] w-[180px] rounded-[6px] text-[20px]', value: 'text-[20px]', icon: 20 },
}

/**
 * − | n | + . Three equal cells in one bordered box.
 *
 * A segmented stepper rather than a number input because the field it replaces
 * had a NaN trap: mid-retype a number input is briefly empty, and reading that
 * as zero wiped the names the user had just typed. There is no text state here,
 * so the count can only ever be a number, and `min` is enforced by disabling the
 * minus rather than by clamping after the fact.
 */
export function StructureStepper({
    label,
    value,
    onChange,
    min = 1,
    max,
    size = 'md',
}: {
    label: string
    value: number
    onChange: (next: number) => void
    min?: number
    max: number
    size?: ControlSize
}) {
    const cell = cn(
        'flex flex-1 items-center justify-center text-body outline-none transition-colors',
        'hover:bg-row-hover hover:text-heading focus-visible:ring-2 focus-visible:ring-inset',
        'focus-visible:ring-brand-500/40 disabled:cursor-not-allowed disabled:text-faint',
        'disabled:hover:bg-transparent'
    )
    return (
        <div
            role="group"
            aria-label={label}
            className={cn(
                'inline-flex items-stretch overflow-hidden border border-hairline-strong bg-surface',
                STEPPER[size].root
            )}
        >
            <button
                type="button"
                onClick={() => onChange(value - 1)}
                disabled={value <= min}
                aria-label={`Decrease ${label.toLowerCase()}`}
                className={cell}
            >
                <Minus size={STEPPER[size].icon} />
            </button>
            <span
                aria-live="polite"
                className={cn(
                    'flex flex-1 items-center justify-center border-x border-hairline-strong font-semibold tabular-nums text-heading',
                    STEPPER[size].value
                )}
            >
                {value}
            </span>
            <button
                type="button"
                onClick={() => onChange(value + 1)}
                disabled={value >= max}
                aria-label={`Increase ${label.toLowerCase()}`}
                className={cell}
            >
                <Plus size={STEPPER[size].icon} />
            </button>
        </div>
    )
}

/**
 * The wizard's own checkbox, with its label on the same line and the whole row
 * clickable. Used where the step asks a yes/no question — phases, batches — so
 * these read as the same kind of control as every other opt-in in the modal.
 */
export function StructureCheckbox({
    checked,
    onCheckedChange,
    label,
    labelClass,
}: {
    checked: boolean
    onCheckedChange: (next: boolean) => void
    label: string
    labelClass?: string
}) {
    return (
        <label className="group inline-flex cursor-pointer select-none items-center gap-2">
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onCheckedChange(e.target.checked)}
                className="h-4 w-4 accent-brand-500"
            />
            <span className={cn('text-sm font-medium text-heading transition-colors group-hover:text-brand-700', labelClass)}>
                {label}
            </span>
        </label>
    )
}

/**
 * A count taken by direct entry, clamped to [min, max] as it is typed.
 *
 * The clamp is IMMEDIATE on purpose: a value below the floor is not a smaller
 * count, it is an invalid one, and the field says so the instant it is typed
 * rather than letting an invalid number sit there until focus leaves. Typing 1
 * into a field whose floor is 2 shows 2 straight away.
 *
 * The draft string is what keeps typing survivable around that. Mid-retype the
 * field is briefly EMPTY, and reading that as a number would send 0 — which on
 * the phase count means "phases off" and would delete every phase course on a
 * single Backspace. An empty or unreadable draft is held on screen and never
 * committed; blur brings the stored value back.
 *
 * The native spinners are left ON: stepping one at a time is the common edit
 * here (two phases to three, four batches to five), and a pair of arrows does
 * that in one click without selecting the digit first. They also respect `min`
 * and `max` on their own, so the arrows can never offer a count the field would
 * have to correct.
 */
export function StructureCountInput({
    label,
    value,
    onChange,
    min = 1,
    max,
    className,
}: {
    label: string
    value: number
    onChange: (next: number) => void
    min?: number
    max: number
    className?: string
}) {
    // null = not being edited, so the stored value is what shows.
    const [draft, setDraft] = useState<string | null>(null)

    const onInput = (raw: string) => {
        if (raw === '') { setDraft(''); return }
        const n = parseInt(raw, 10)
        if (Number.isNaN(n)) return
        const clamped = Math.min(max, Math.max(min, n))
        setDraft(String(clamped))
        onChange(clamped)
    }

    // Nothing to resolve — every committed value was already in range. Dropping
    // the draft just hands the box back to the stored value, which is what
    // restores it after the field was left empty.
    const onBlur = () => setDraft(null)

    return (
        <input
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            value={draft ?? String(value)}
            onChange={(e) => onInput(e.target.value)}
            onBlur={onBlur}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
            aria-label={label}
            className={cn(
                // Wider than it needs to be for two digits: the spinner column
                // eats about a sixth of the box, and the number has to stay
                // readable beside it.
                'h-9 w-[86px] rounded-control border border-hairline-strong bg-surface py-1 pl-3 pr-1 text-sm',
                'text-heading tabular-nums outline-none transition-colors hover:border-line-hover',
                'focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-500/15',
                className
            )}
        />
    )
}
