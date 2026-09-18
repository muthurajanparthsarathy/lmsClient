"use client"

import { useState } from 'react'
import { Building2, ChevronDown, X } from 'lucide-react'
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/* The toolbar's client picker.
 *
 * Its own component rather than the shared MappingSingleFilter, which Course
 * Setup's Course filter also uses: this one is a PLAIN list — no tickboxes and
 * no "all" row — and making the shared one behave that way would change the
 * Course filter nobody asked to change.
 *
 * One client at a time, so a tickbox would be promising a multi-select that is
 * not there; the picked row is marked by the brand wash instead. Clearing is
 * the × on the trigger, which is why no "All clients" row is needed inside the
 * list to get back.
 */
export default function ClientPickerFilter({ options, value, onChange }: {
    options: { value: string; label: string }[]
    value: string
    onChange: (value: string) => void
}) {
    const [search, setSearch] = useState('')
    const chosen = options.find((option) => option.value === value)
    const caption = chosen?.label || 'All clients'
    const shown = options.filter((option) => option.label.toLowerCase().includes(search.trim().toLowerCase()))

    return (
        <DropdownMenu onOpenChange={() => setSearch('')}>
            <div
                className={`group inline-flex h-8 w-full min-w-0 items-center gap-1 rounded-control border px-2.5 text-xs shadow-xs transition-colors duration-150 ${
                    value
                        ? 'border-brand-500/30 bg-brand-wash text-brand-strong'
                        : 'border-hairline-strong bg-surface text-body hover:border-line-hover hover:bg-row-hover'
                }`}
            >
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        aria-label={`Client: ${caption}`}
                        title={caption}
                        className="inline-flex h-full min-w-0 flex-1 items-center gap-2 bg-transparent text-left outline-none focus-visible:ring-2 focus-visible:ring-brand/20"
                    >
                        <Building2 aria-hidden="true" className={`size-3.5 shrink-0 ${value ? 'text-brand-strong' : 'text-subtle'}`} strokeWidth={1.75} />
                        <span className="min-w-0 flex-1 truncate font-medium">{caption}</span>
                        {!value && <ChevronDown className="size-3.5 shrink-0 text-subtle transition-transform duration-150 group-data-[state=open]:rotate-180" />}
                    </button>
                </DropdownMenuTrigger>

                {/* Outside the trigger, or opening the menu and clearing would be
                    the same click. Only while a client is picked — with none, it
                    would be a button that does nothing. */}
                {value && (
                    <button
                        type="button"
                        aria-label="Clear client filter"
                        title="Clear client filter"
                        onClick={() => onChange('')}
                        className="inline-flex size-5 shrink-0 items-center justify-center rounded-chip text-brand-strong hover:bg-brand-wash-hover"
                    >
                        <X className="size-3" />
                    </button>
                )}
            </div>

            <DropdownMenuContent align="start" sideOffset={6} className="w-64 max-w-[calc(100vw-1.5rem)] rounded-xl">
                <DropdownMenuLabel className="text-xs">Client</DropdownMenuLabel>
                {options.length === 0 ? (
                    <p className="px-2 py-3 text-center text-xs text-subtle">No clients yet</p>
                ) : (
                    <>
                        {/* Typing is what a long list is navigated by; the keydown
                            is stopped so the menu's own typeahead does not steal it
                            and jump the highlight somewhere else. */}
                        <input
                            aria-label="Search clients"
                            placeholder="Search…"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            onKeyDown={(event) => event.stopPropagation()}
                            className="mb-1 h-8 w-full rounded-lg border border-hairline px-2 text-xs outline-none focus:border-brand"
                        />
                        <div className="max-h-56 overflow-y-auto">
                            {shown.map((option) => (
                                <DropdownMenuItem
                                    key={option.value}
                                    onSelect={() => onChange(option.value)}
                                    className={`cursor-pointer py-2 text-xs ${
                                        option.value === value ? 'bg-brand-wash font-medium text-brand-strong' : ''
                                    }`}
                                >
                                    <span className="min-w-0 truncate">{option.label}</span>
                                </DropdownMenuItem>
                            ))}
                            {!shown.length && (
                                <p className="px-2 py-3 text-center text-xs text-subtle">No match for “{search.trim()}”.</p>
                            )}
                        </div>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
