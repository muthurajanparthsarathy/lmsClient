"use client"

import React from 'react'
import { motion } from 'framer-motion'

// The summary tiles above a listing. The icon tile carries the colour so the
// numbers themselves stay a uniform near-black and read as one row.
//
// A sparkline is opt-in per stat: only counts that move over time earn one. On a
// roster size like "how many clients exist" a trend line would imply movement
// that isn't meaningful.

export type Tone = 'orange' | 'green' | 'purple' | 'blue'

export type Stat = {
    label: string
    value: number | string
    sub: string
    tone: Tone
    icon: React.ReactNode
    trend?: number[]
}

// Tones resolved through the token palette. The design system has no purple —
// existing `purple` call sites keep compiling but now render as the neutral
// ink tone, which is the closest sanctioned equivalent.
const TONES: Record<Tone, { tile: string; icon: string; line: string }> = {
    orange: { tile: 'bg-brand-wash', icon: 'text-brand', line: 'var(--color-brand-500)' },
    green: { tile: 'bg-success-50', icon: 'text-success-700', line: 'var(--color-success-500)' },
    purple: { tile: 'bg-ink-100', icon: 'text-ink-600', line: 'var(--color-ink-500)' },
    blue: { tile: 'bg-info-50', icon: 'text-info-700', line: 'var(--color-info-500)' },
}

// A tiny trend line, derived from the real values rather than drawn to a fixed
// shape, normalised into the box.
function Sparkline({ points, color, id }: { points: number[]; color: string; id: string }) {
    if (points.length < 2) return null
    const w = 68
    const h = 28
    const min = Math.min(...points)
    const max = Math.max(...points)
    const span = max - min || 1
    const step = w / (points.length - 1)
    const coords = points.map((p, i) => {
        // Inset top and bottom so peaks aren't clipped by the viewBox.
        const y = h - 4 - ((p - min) / span) * (h - 8)
        return [i * step, y] as const
    })
    const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
    const gradientId = `spark-${id}`

    return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" aria-hidden="true" focusable="false">
            <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.18" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#${gradientId})`} />
            <motion.path
                d={line}
                stroke={color}
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
            />
            <circle cx={coords[coords.length - 1][0]} cy={coords[coords.length - 1][1]} r="2.5" fill={color} />
        </svg>
    )
}

export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="bg-surface rounded-xl border border-hairline px-4 py-3.5 flex items-center gap-3 shadow-xs">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-tile bg-ink-100 animate-pulse flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                        <div className="h-2.5 w-20 rounded bg-ink-100 animate-pulse" />
                        <div className="h-4 w-10 rounded bg-ink-100 animate-pulse" />
                        <div className="h-2 w-16 rounded bg-ink-100 animate-pulse" />
                    </div>
                </div>
            ))}
        </div>
    )
}

export default function StatCards({ stats, isLoading }: { stats: Stat[]; isLoading?: boolean }) {
    if (isLoading) return <StatCardsSkeleton count={stats.length || 4} />

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {stats.map((s, i) => {
                const t = TONES[s.tone]
                return (
                    <motion.div
                        key={s.label}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        // Staggered left to right so the row assembles rather
                        // than snapping in as one block.
                        transition={{ duration: 0.24, delay: i * 0.05, ease: [0.2, 0, 0, 1] }}
                        className="bg-surface rounded-xl border border-hairline px-4 py-3.5 flex items-center gap-3 shadow-xs"
                    >
                        <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-tile flex items-center justify-center flex-shrink-0 ${t.tile}`}>
                            <span className={t.icon}>{s.icon}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-2xs font-medium text-subtle truncate">{s.label}</p>
                            <p className="text-2xl font-semibold text-heading tabular-nums">{s.value}</p>
                            <p className="text-2xs text-faint truncate">{s.sub}</p>
                        </div>
                        {s.trend && s.trend.length > 1 && (
                            <div className="flex-shrink-0 hidden xl:block">
                                <Sparkline points={s.trend} color={t.line} id={s.tone} />
                            </div>
                        )}
                    </motion.div>
                )
            })}
        </div>
    )
}
