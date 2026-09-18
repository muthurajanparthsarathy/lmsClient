"use client"

import * as Select from '@radix-ui/react-select'
import { Check, ChevronDown, ChevronUp, type LucideIcon } from 'lucide-react'

interface ClientToolbarFilterProps {
    label: string
    allLabel: string
    value: string
    onChange: (value: string) => void
    options: { value: string; label: string }[]
    icon: LucideIcon
    className?: string
}

const ALL = '__all__'

export default function ClientToolbarFilter({ label, allLabel, value, onChange, options, icon: Icon, className = '' }: ClientToolbarFilterProps) {
    return (
        <Select.Root value={value || ALL} onValueChange={(next) => onChange(next === ALL ? '' : next)}>
            <Select.Trigger
                aria-label={label}
                title={value ? `${label}: ${options.find((option) => option.value === value)?.label || value}` : label}
                className={`group inline-flex h-8 min-w-0 items-center gap-2 rounded-control border px-2.5 text-xs shadow-xs outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand/20 data-[state=open]:border-brand ${value ? 'border-brand-500/30 bg-brand-wash text-brand-strong' : 'border-hairline-strong bg-surface text-body hover:border-line-hover hover:bg-row-hover'} ${className}`}
            >
                <Icon aria-hidden="true" className={`size-3.5 shrink-0 ${value ? 'text-brand-strong' : 'text-subtle'}`} strokeWidth={1.75} />
                <span className="min-w-0 flex-1 truncate text-left font-medium">
                    <Select.Value>{value ? options.find((option) => option.value === value)?.label || value : allLabel}</Select.Value>
                </span>
                <Select.Icon asChild>
                    <ChevronDown className="size-3.5 shrink-0 text-subtle transition-transform duration-150 group-data-[state=open]:rotate-180" />
                </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
                <Select.Content
                    position="popper"
                    align="start"
                    sideOffset={6}
                    collisionPadding={12}
                    className="z-popover max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-hairline bg-surface p-1 text-body shadow-lg"
                >
                    <Select.ScrollUpButton className="flex h-6 items-center justify-center text-subtle"><ChevronUp className="size-3.5" /></Select.ScrollUpButton>
                    <Select.Viewport className="max-h-64">
                        <Select.Group>
                            <Select.Label className="px-2.5 pb-2 pt-2 text-[10px] font-semibold uppercase tracking-wider text-subtle">{label}</Select.Label>
                            {[{ value: ALL, label: allLabel }, ...options].map((option) => (
                                <Select.Item
                                    key={option.value}
                                    value={option.value}
                                    className="relative flex min-h-9 cursor-pointer select-none items-center rounded-lg py-2 pl-2.5 pr-9 text-xs outline-none transition-colors data-[highlighted]:bg-row-hover data-[highlighted]:text-heading data-[state=checked]:bg-brand-wash data-[state=checked]:font-medium data-[state=checked]:text-brand-strong"
                                >
                                    <Select.ItemText>{option.label}</Select.ItemText>
                                    <Select.ItemIndicator className="absolute right-2.5"><Check className="size-3.5 text-brand-strong" strokeWidth={2} /></Select.ItemIndicator>
                                </Select.Item>
                            ))}
                        </Select.Group>
                    </Select.Viewport>
                    <Select.ScrollDownButton className="flex h-6 items-center justify-center text-subtle"><ChevronDown className="size-3.5" /></Select.ScrollDownButton>
                </Select.Content>
            </Select.Portal>
        </Select.Root>
    )
}
