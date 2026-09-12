"use client"

import { CalendarDays, ChevronDown } from 'lucide-react'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'

export default function ClientYearFilter({ years, value, onChange }: { years: string[]; value: string[]; onChange: (years: string[]) => void }) {
    const caption = value.length ? value.join(', ') : 'Created Year'
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button type="button" aria-label={`Created Year: ${value.length ? caption : 'All years'}`} title={caption} className={`group inline-flex h-8 w-0 min-w-0 flex-1 items-center gap-2 rounded-control border px-2.5 text-xs shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-brand/20 sm:w-[170px] sm:flex-none ${value.length ? 'border-brand-500/30 bg-brand-wash text-brand-strong' : 'border-hairline-strong bg-surface text-body hover:bg-row-hover'}`}>
                    <CalendarDays className="size-3.5 shrink-0 text-subtle" />
                    <span className="min-w-0 flex-1 truncate text-left font-medium">{caption}</span>
                    <ChevronDown className="size-3.5 shrink-0 text-subtle transition-transform group-data-[state=open]:rotate-180" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={6} className="max-h-72 w-48 overflow-y-auto rounded-xl p-1">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-subtle">Created year</DropdownMenuLabel>
                <DropdownMenuCheckboxItem checked={!value.length} onSelect={(event) => event.preventDefault()} onCheckedChange={() => onChange([])} className="text-xs">All years</DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                {years.map((year) => <DropdownMenuCheckboxItem key={year} checked={value.includes(year)} onSelect={(event) => event.preventDefault()} onCheckedChange={(checked) => onChange((checked ? [...value, year] : value.filter((item) => item !== year)).sort().reverse())} className="py-2 text-xs [&>span:first-child]:rounded-sm [&>span:first-child]:border [&>span:first-child]:border-hairline-strong">{year}</DropdownMenuCheckboxItem>)}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
