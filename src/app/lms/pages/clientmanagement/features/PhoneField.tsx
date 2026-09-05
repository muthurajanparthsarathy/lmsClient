"use client"

import React from 'react'
import { COUNTRY_CODES, splitPhone } from './lib'

// Country-code select + digits-only number input, emitting the single combined
// string the rest of the form already stores and validates. The select reads as
// a borderless prefix inside one field so the control looks like a single input.
export default function PhoneField({
    value,
    onChange,
    hasError,
    disabled,
}: {
    value: string
    onChange: (v: string) => void
    hasError?: boolean
    disabled?: boolean
}) {
    const { code, local } = splitPhone(value)
    // E.164 caps national numbers at 15 digits; the per-country exactness
    // (10 for +91) is the validator's job, not the input's.
    const emit = (nextCode: string, nextLocal: string) =>
        onChange(nextLocal ? `${nextCode} ${nextLocal}` : '')
    return (
        <div
            className={`flex h-10 items-stretch rounded-control border bg-surface overflow-hidden transition-colors focus-within:ring-2 ${
                hasError
                    ? 'border-danger-500 focus-within:border-danger-500 focus-within:ring-danger-500/15'
                    : 'border-hairline-strong hover:border-line-hover focus-within:border-brand focus-within:ring-brand/15'
            } ${disabled ? 'bg-ink-50 opacity-70' : ''}`}
        >
            <select
                value={code}
                onChange={(e) => emit(e.target.value, local)}
                disabled={disabled}
                aria-label="Country code"
                className="h-full pl-2.5 pr-1 text-sm text-body bg-canvas border-r border-hairline focus:outline-none cursor-pointer disabled:cursor-not-allowed"
            >
                {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                ))}
            </select>
            <input
                type="tel"
                inputMode="numeric"
                value={local}
                onChange={(e) => emit(code, e.target.value.replace(/\D/g, '').slice(0, 15))}
                placeholder="99999 99999"
                disabled={disabled}
                aria-label="Mobile number"
                className="h-full flex-1 min-w-0 px-3 text-sm text-body placeholder:text-faint focus:outline-none bg-transparent disabled:cursor-not-allowed"
            />
        </div>
    )
}
