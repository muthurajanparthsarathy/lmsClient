"use client"
import { getToken, getSessionItem, SESSION_KEYS } from "@/lib/session";
import { attendanceApi } from "@/apiServices/attendanceApi";

import { useState, useEffect, useMemo, useRef, Fragment } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCourseBatchesQuery } from '@/queries/courseBatches'
import { queryKeys } from '@/lib/queryKeys'
import {
    ArrowLeft, Plus, X, Clock, CalendarDays, Sparkles, Coffee,
    Lightbulb, Users, Target, AlertCircle, Settings, Eye, EyeOff, FileDown,
    ChevronLeft, ChevronRight, Rows3, Maximize2, Minimize2, LayoutList, RotateCcw,
    MousePointerClick, ArrowDown, ArrowUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink,
    BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import DashboardLayout from '@/app/lms/component/layout'
import { moduleApi } from '@/apiServices/pedagogyAndModuleAdd/addmodule'
import { subModuleApi } from '@/apiServices/pedagogyAndModuleAdd/addsubmodule'
import { topicApi } from '@/apiServices/pedagogyAndModuleAdd/addtopic'
import { subTopicApi } from '@/apiServices/pedagogyAndModuleAdd/addsubtopic'
import { pedagogyViewApi } from '@/apiServices/pedagogyAndModuleAdd/pedagogy'
import { courseStructureApi } from '@/apiServices/createCourseStucture'
import { programCalendarApi } from '@/apiServices/programCalendarApi'
import { instituteHolidayCalendarApi } from '@/apiServices/instituteHolidayCalendarApi'
import { scopeIdFor } from '@/app/lms/pages/calendar/components/ClientList'
import { userPermission } from '@/apiServices/tokenVerify'

// ─── Types ────────────────────────────────────────────────────────────────────

type CourseData = {
    _id: string; courseName: string; courseCode: string; courseDescription?: string
    courseDuration: string; courseLevel: string; category: string; serviceType: string
    serviceModal: string; status: string; createdAt: string; updatedAt: string; clientName?: string
    // Present at runtime (courseStructureModal.js stores it, getById returns the
    // whole doc); the type just never declared it. Needed to scope this course's
    // holidays to its client.
    clientId?: string
    clientData?: { clientCompany: string; clientAddress: string; contactPersons: Array<{ name: string; email: string; phoneNumber: string; isPrimary: boolean }> }
    courseHierarchy: string[]; I_Do: string[]; We_Do: string[] | Record<string, string[]>; You_Do: string[]
    courseImage?: string; isActive: boolean
}
type TableRowItem = {
    moduleId: string | null; moduleName: string; subModuleId: string | null; subModuleName: string
    topicId: string | null; topicName: string; subtopicId: string | null; subtopicName: string
    rowIndex: number; rowId: string
}
type MergeInfo = { isMerged: true; isStart: boolean; rowSpan: number; value: number; type: 'iDo'|'weDo'|'youDo' } | { isMerged: false }
type ContentItem = { module: string; subModule: string; topic: string; subTopic: string; activity: string; type: 'iDo'|'weDo'|'youDo'|'assessmentGap'; hours: number; gapDays?: number }

type DaySlot = {
    id: string; kind: 'session' | 'break'; name: string
    startTime: string; endTime: string
    trainer?: string; sessionType?: string   // session only
}
type HolidayDuration = 'full' | 'first-half' | 'second-half'
type Holiday = { id: string; name: string; date: string; duration?: HolidayDuration }  // duration defaults to 'full' when absent
// Cancelled session day in the actual calendar. appliesTo holds batch subdoc
// ids; EMPTY means all batches — the legacy meaning and the explicit
// "everyone" answer both, so old records read correctly unchanged. A scoped
// deviation shifts only its batches' end dates.
type Deviation = { id: string; date: string; reason: string; appliesTo?: string[] }

type CalConfig = { startDate: string; workingDays: number[] }

type GenRow = ContentItem & {
    date: Date; startMins: number; endMins: number; slotName: string
}
type SchedItem = GenRow

// ─── Constants ────────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2, 9)
const DAY_ABBR   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const PEDAGOGY_CFG = {
    iDo:  { label: 'I Do',   bg: 'bg-info-50',    text: 'text-info-700',    dot: 'bg-info-500',    icon: Lightbulb },
    weDo: { label: 'We Do',  bg: 'bg-brand-100',  text: 'text-brand-700',   dot: 'bg-brand-500',   icon: Users    },
    youDo:{ label: 'You Do', bg: 'bg-success-50', text: 'text-success-700', dot: 'bg-success-500', icon: Target   },
} as const

// Same six-slot rotation as before, retinted onto the token ramps so session
// tags stay distinguishable without leaving the design system.
const SESSION_COLORS = [
    { bg: 'bg-info-50',    border: 'border-info-500',    text: 'text-info-700',    sub: 'text-info-500',    chip: 'bg-info-500'    },
    { bg: 'bg-brand-50',   border: 'border-brand-400',   text: 'text-brand-700',   sub: 'text-brand-500',   chip: 'bg-brand-500'   },
    { bg: 'bg-success-50', border: 'border-success-500', text: 'text-success-700', sub: 'text-success-500', chip: 'bg-success-500' },
    { bg: 'bg-warn-50',    border: 'border-warn-500',    text: 'text-warn-700',    sub: 'text-warn-500',    chip: 'bg-warn-500'    },
    { bg: 'bg-ink-50',     border: 'border-ink-400',     text: 'text-ink-700',     sub: 'text-ink-500',     chip: 'bg-ink-400'     },
    { bg: 'bg-danger-50',  border: 'border-danger-500',  text: 'text-danger-700',  sub: 'text-danger-500',  chip: 'bg-danger-500'  },
]

// ─── Time Helpers ─────────────────────────────────────────────────────────────

function parseTimeMins(t: string) { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0) }
function durationMins(start: string, end: string) { const d = parseTimeMins(end) - parseTimeMins(start); return d > 0 ? d : d < 0 ? d + 24*60 : 0 }
function minsToDisplay(m: number) {
    const h = Math.floor(m / 60) % 24, mn = ((m % 60) + 60) % 60, ap = h >= 12 ? 'PM' : 'AM'
    const hh = h > 12 ? h - 12 : h === 0 ? 12 : h
    return `${hh}:${mn.toString().padStart(2,'0')} ${ap}`
}
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function isoDate(d: Date) { const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), dd = String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}` }
function fmtDate(d: Date) { return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }
function fmtDateShort(d: Date) { return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) }
function fmtDateLong(d: Date) {
    const day = d.toLocaleDateString('en-IN', { day: '2-digit' })
    const month = d.toLocaleDateString('en-IN', { month: 'long' })
    const year = d.getFullYear()
    return `${day}-${month}-${year}`
}
// Calendar-grid cells for a month, padded with leading/trailing nulls so the
// grid always starts on Sunday and fills complete weeks.
function getMonthGrid(month: Date): (Date | null)[] {
    const year = month.getFullYear(), m = month.getMonth()
    const firstDay = new Date(year, m, 1)
    const daysInMonth = new Date(year, m + 1, 0).getDate()
    const cells: (Date | null)[] = []
    for (let i = 0; i < firstDay.getDay(); i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, m, d))
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
}
function getWeekGrid(weekStart: Date): Date[] {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}

// 24h "HH:mm" ⇄ 12h parts
function to12(value: string) {
    const [hStr, mStr] = (value || '00:00').split(':')
    const h = parseInt(hStr) || 0
    return { h12: h % 12 === 0 ? 12 : h % 12, m: (mStr || '00').padStart(2,'0'), ampm: h >= 12 ? 'PM' : 'AM' }
}
function from12(h12: number, m: string, ampm: string) {
    let h = h12 % 12
    if (ampm === 'PM') h += 12
    return `${String(h).padStart(2,'0')}:${m.padStart(2,'0')}`
}

// ─── 12-hour Time Picker ──────────────────────────────────────────────────────

function TimeInput12({ value, onChange, accent }: { value: string; onChange: (v: string) => void; accent?: string }) {
    const { h12, m, ampm } = to12(value)
    const mins = ['00','05','10','15','20','25','30','35','40','45','50','55']
    const minOpts = mins.includes(m) ? mins : [m, ...mins].sort()
    const cls = `h-7 rounded-md border bg-white text-xs px-1 focus:outline-none focus:ring-1 focus:ring-brand-300 ${accent || 'border-ink-200 text-ink-700'}`
    return (
        <div className="inline-flex items-center gap-0.5">
            <select value={h12} onChange={e => onChange(from12(parseInt(e.target.value), m, ampm))} className={cls}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            <span className="text-ink-400 text-xs">:</span>
            <select value={m} onChange={e => onChange(from12(h12, e.target.value, ampm))} className={cls}>
                {minOpts.map(mm => <option key={mm} value={mm}>{mm}</option>)}
            </select>
            <select value={ampm} onChange={e => onChange(from12(h12, m, e.target.value))} className={`${cls} font-semibold`}>
                <option value="AM">AM</option>
                <option value="PM">PM</option>
            </select>
        </div>
    )
}

// ─── Pure Row/Merge Helpers (from pedagogy2) ──────────────────────────────────

// Normalize an id that may arrive as a plain string OR a populated object
// ({_id, title, ...}) so cross-collection id comparisons never silently fail
// due to type mismatch (the cause of topics/sub-items rendering "detached"
// from their parent module/topic).
function idStr(v: any): string {
    if (v == null) return ''
    if (typeof v === 'object') return String(v._id ?? v.id ?? '')
    return String(v)
}
function idEq(a: any, b: any): boolean { return idStr(a) === idStr(b) && idStr(a) !== '' }

function buildTableRows(course: CourseData, modules: any[], subModules: any[], topics: any[], subTopics: any[]): TableRowItem[] {
    const h = course.courseHierarchy
    const hasM = h.includes('Module'), hasSM = h.includes('Sub Module'), hasT = h.includes('Topic'), hasST = h.includes('Sub Topic')
    const rows: TableRowItem[] = []; let idx = 0
    const push = (r: Omit<TableRowItem,'rowIndex'>) => rows.push({ ...r, rowIndex: idx++ })
    if (!hasM && !hasT) return rows
    if (hasM) {
        modules.forEach(mod => {
            if (hasSM) {
                const mSubs = subModules.filter((s: any) => idEq(s.moduleId, mod._id))
                if (mSubs.length > 0) {
                    mSubs.forEach((sub: any) => {
                        if (hasT) {
                            const sTs = topics.filter((t: any) => idEq(t.subModuleId, sub._id))
                            if (sTs.length > 0) { sTs.forEach((topic: any) => { if (hasST) { const stList = subTopics.filter((st: any) => idEq(st.topicId, topic._id)); if (stList.length > 0) { stList.forEach((st: any) => push({ moduleId: mod._id, moduleName: mod.title, subModuleId: sub._id, subModuleName: sub.title, topicId: topic._id, topicName: topic.title, subtopicId: st._id, subtopicName: st.title, rowId: `${mod._id}-${sub._id}-${topic._id}-${st._id}` })) } else { push({ moduleId: mod._id, moduleName: mod.title, subModuleId: sub._id, subModuleName: sub.title, topicId: topic._id, topicName: topic.title, subtopicId: `${topic._id}-ph`, subtopicName: '-', rowId: `${mod._id}-${sub._id}-${topic._id}-ph` }) } } else { push({ moduleId: mod._id, moduleName: mod.title, subModuleId: sub._id, subModuleName: sub.title, topicId: topic._id, topicName: topic.title, subtopicId: null, subtopicName: '', rowId: `${mod._id}-${sub._id}-${topic._id}` }) } }) }
                            else { push({ moduleId: mod._id, moduleName: mod.title, subModuleId: sub._id, subModuleName: sub.title, topicId: `${sub._id}-ph`, topicName: '-', subtopicId: `${sub._id}-ph-s`, subtopicName: '-', rowId: `${mod._id}-${sub._id}-ph` }) }
                        } else { push({ moduleId: mod._id, moduleName: mod.title, subModuleId: sub._id, subModuleName: sub.title, topicId: null, topicName: '', subtopicId: null, subtopicName: '', rowId: `${mod._id}-${sub._id}` }) }
                    })
                } else { push({ moduleId: mod._id, moduleName: mod.title, subModuleId: `${mod._id}-ph`, subModuleName: '-', topicId: `${mod._id}-ph-t`, topicName: '-', subtopicId: `${mod._id}-ph-s`, subtopicName: '-', rowId: `${mod._id}-ph` }) }
            } else if (hasT) {
                const mTs = topics.filter((t: any) => idEq(t.moduleId, mod._id))
                if (mTs.length > 0) { mTs.forEach((topic: any) => { if (hasST) { const stList = subTopics.filter((st: any) => idEq(st.topicId, topic._id)); if (stList.length > 0) { stList.forEach((st: any) => push({ moduleId: mod._id, moduleName: mod.title, subModuleId: null, subModuleName: '', topicId: topic._id, topicName: topic.title, subtopicId: st._id, subtopicName: st.title, rowId: `${mod._id}-${topic._id}-${st._id}` })) } else { push({ moduleId: mod._id, moduleName: mod.title, subModuleId: null, subModuleName: '', topicId: topic._id, topicName: topic.title, subtopicId: `${topic._id}-ph`, subtopicName: '-', rowId: `${mod._id}-${topic._id}-ph` }) } } else { push({ moduleId: mod._id, moduleName: mod.title, subModuleId: null, subModuleName: '', topicId: topic._id, topicName: topic.title, subtopicId: null, subtopicName: '', rowId: `${mod._id}-${topic._id}` }) } }) }
                else { push({ moduleId: mod._id, moduleName: mod.title, subModuleId: null, subModuleName: '', topicId: `${mod._id}-ph`, topicName: '-', subtopicId: `${mod._id}-ph-s`, subtopicName: '-', rowId: `${mod._id}-ph` }) }
            } else { push({ moduleId: mod._id, moduleName: mod.title, subModuleId: null, subModuleName: '', topicId: null, topicName: '', subtopicId: `${mod._id}-ph`, subtopicName: '-', rowId: `${mod._id}-ph` }) }
        })
    } else if (hasT) { topics.forEach((topic: any) => push({ moduleId: null, moduleName: '', subModuleId: null, subModuleName: '', topicId: topic._id, topicName: topic.title, subtopicId: null, subtopicName: '', rowId: `${topic._id}` })) }
    return rows
}

function getAffectedRowIds(mIds: string[], smIds: string[], tIds: string[], stIds: string[], rows: TableRowItem[]): string[] {
    const s = new Set<string>()
    const mSet = mIds.map(idStr), smSet = smIds.map(idStr), tSet = tIds.map(idStr), stSet = stIds.map(idStr)
    rows.forEach(r => {
        if (mSet.length > 0 && !mSet.includes(idStr(r.moduleId))) return
        if (smSet.length > 0) { if (r.subModuleId && !r.subModuleId.includes('placeholder') && !smSet.includes(idStr(r.subModuleId))) return } else { if (r.subModuleId && !r.subModuleId.includes('placeholder')) return }
        if (tSet.length > 0) { if (r.topicId && !r.topicId.includes('placeholder') && !tSet.includes(idStr(r.topicId))) return } else { if (r.topicId && !r.topicId.includes('placeholder')) return }
        if (stSet.length > 0) { if (r.subtopicId && !r.subtopicId.includes('placeholder') && !stSet.includes(idStr(r.subtopicId))) return } else { if (r.subtopicId && !r.subtopicId.includes('placeholder')) return }
        s.add(r.rowId)
    })
    return Array.from(s)
}

function isCellMerged(ridx: number, type: 'iDo'|'weDo'|'youDo', activity: string, pvs: any[], rows: TableRowItem[]): MergeInfo {
    const row = rows[ridx]; if (!row) return { isMerged: false }
    for (const view of pvs) {
        for (const p of (view.pedagogies || [])) {
            const mIds: string[] = p.module||[], smIds: string[] = p.subModule||[], tIds: string[] = p.topic||[], stIds: string[] = p.subTopic||[]
            const isMulti = mIds.length>1||smIds.length>1||tIds.length>1||stIds.length>1
            if (!isMulti) continue
            const mM = mIds.length===0||mIds.map(idStr).includes(idStr(row.moduleId))
            const smM = smIds.length===0||!row.subModuleId||row.subModuleId.includes('placeholder')||smIds.map(idStr).includes(idStr(row.subModuleId))
            const tM = tIds.length===0||!row.topicId||row.topicId.includes('placeholder')||tIds.map(idStr).includes(idStr(row.topicId))
            const stM = stIds.length===0||!row.subtopicId||row.subtopicId.includes('placeholder')||stIds.map(idStr).includes(idStr(row.subtopicId))
            if (mM&&smM&&tM&&stM) {
                const ad = (p[type]||[]).find((a: any) => a.type===activity)
                if (!ad) continue
                const affIds = getAffectedRowIds(mIds,smIds,tIds,stIds,rows)
                const idxs = affIds.map(rid => rows.findIndex(r => r.rowId===rid)).filter(i => i!==-1).sort((a,b)=>a-b)
                // HTML rowSpan only makes sense for a CONTIGUOUS block of rows — if the
                // matched rows are scattered (gaps in between), spanning would visually
                // bleed into unrelated rows and corrupt their columns, so treat as unmerged.
                const isContiguous = idxs.length>0 && idxs.every((v,k) => v === idxs[0] + k)
                if (isContiguous && idxs.includes(ridx)) return { isMerged:true, isStart: ridx===idxs[0], rowSpan: idxs.length, value: ad.duration, type }
            }
        }
    }
    return { isMerged: false }
}

function buildCourseHours(pvs: any[], rows: TableRowItem[]) {
    const h: any = {}
    pvs.forEach(view => { (view.pedagogies||[]).forEach((p: any) => {
        const mIds: string[]=p.module||[], smIds: string[]=p.subModule||[], tIds: string[]=p.topic||[], stIds: string[]=p.subTopic||[]
        if (mIds.length>1||smIds.length>1||tIds.length>1||stIds.length>1) return
        const mid=mIds[0]||'', tid=tIds[0]||'', sid=stIds[0]||''
        if (!mid) return
        const mi = rows.findIndex(r => idEq(r.moduleId,mid)&&(!smIds[0]||idEq(r.subModuleId,smIds[0]))&&(!tid||idEq(r.topicId,tid))&&(!sid||idEq(r.subtopicId,sid)))
        if (mi===-1) return
        const row = rows[mi]
        const eT=row.topicId||`${row.moduleId}-dt`, eS=row.subtopicId||(row.topicId?`${row.topicId}-ds`:`${row.moduleId}-ds`)
        if (!h[row.moduleId!]) h[row.moduleId!]={}; if (!h[row.moduleId!][eT]) h[row.moduleId!][eT]={}; if (!h[row.moduleId!][eT][eS]) h[row.moduleId!][eT][eS]={iDo:{},weDo:{},youDo:{}}
        const slot=h[row.moduleId!][eT][eS]
        ;(p.iDo||[]).forEach((a: any)=>{slot.iDo[a.type]=a.duration});(p.weDo||[]).forEach((a: any)=>{slot.weDo[a.type]=a.duration});(p.youDo||[]).forEach((a: any)=>{slot.youDo[a.type]=a.duration})
    })})
    return h
}

// ─── Hierarchy row-span helper ────────────────────────────────────────────────

function computeHierarchySpans(rows: TableRowItem[]) {
    const mSpan  = new Array(rows.length).fill(0)
    const smSpan = new Array(rows.length).fill(0)
    const tSpan  = new Array(rows.length).fill(0)
    let i = 0
    while (i < rows.length) { let j = i; while (j < rows.length && rows[j].moduleId === rows[i].moduleId) j++; mSpan[i] = j - i; i = j }
    i = 0
    while (i < rows.length) { let j = i; while (j < rows.length && rows[j].subModuleId === rows[i].subModuleId && rows[j].moduleId === rows[i].moduleId) j++; smSpan[i] = j - i; i = j }
    i = 0
    while (i < rows.length) { let j = i; while (j < rows.length && rows[j].topicId === rows[i].topicId && rows[j].subModuleId === rows[i].subModuleId) j++; tSpan[i] = j - i; i = j }
    return { mSpan, smSpan, tSpan }
}

// ─── Generate Calendar (session-slot fill) ────────────────────────────────────

function generateCalendar(daySlots: DaySlot[], contentItems: ContentItem[], config: CalConfig, holidays: Holiday[]): GenRow[] {
    const sessionSlots = daySlots.filter(s => s.kind === 'session' && durationMins(s.startTime, s.endTime) > 0)
        .sort((a, b) => parseTimeMins(a.startTime) - parseTimeMins(b.startTime))
    if (!sessionSlots.length || !contentItems.length || !config.startDate) return []

    const holidayMap = new Map(holidays.map(h => [h.date, h.duration || 'full'] as const))
    const isWorking = (d: Date) => config.workingDays.includes(d.getDay()) && holidayMap.get(isoDate(d)) !== 'full'

    // Midpoint of the day's session span — sessions ending at/before it count as the
    // "first half", sessions starting at/after it count as the "second half", so a
    // half-day holiday only blocks the matching set of sessions, not the whole day.
    const dayMidMins = sessionSlots.length
        ? (parseTimeMins(sessionSlots[0].startTime) + parseTimeMins(sessionSlots[sessionSlots.length - 1].endTime)) / 2
        : 0
    const sessionAllowedOnHoliday = (slot: DaySlot, duration: HolidayDuration) => {
        if (duration === 'full') return false
        const start = parseTimeMins(slot.startTime), end = parseTimeMins(slot.endTime)
        if (duration === 'first-half') return start >= dayMidMins   // blocks AM, so only PM sessions run
        return end <= dayMidMins                                     // 'second-half' blocks PM, so only AM sessions run
    }

    // mutable queue (minutes remaining)
    const queue = contentItems.map(i => ({ ...i, remMins: Math.round(i.hours * 60) }))
    let qi = 0
    const rows: GenRow[] = []
    let cur = new Date(config.startDate + 'T00:00:00')
    let guard = 0

    while (qi < queue.length && guard < 2000) {
        guard++
        // Assessment gap item: next content starts (gapDays) calendar days after
        // assessment end. cur is already 1 day past assessment end, so advance
        // (gapDays - 1) more calendar days, then land on the next working day.
        if (queue[qi].type === 'assessmentGap') {
            const gapDays = queue[qi].gapDays || 1
            for (let i = 0; i < gapDays - 1; i++) cur = addDays(cur, 1)
            while (!isWorking(cur) && guard < 2000) { guard++; cur = addDays(cur, 1) }
            qi++
            continue
        }
        if (!isWorking(cur)) { cur = addDays(cur, 1); continue }
        const holidayDuration = holidayMap.get(isoDate(cur))

        for (const slot of sessionSlots) {
            if (qi >= queue.length) break
            // Stop filling this day's slots if the next item is a gap — let the outer loop handle it
            if (queue[qi].type === 'assessmentGap') break
            if (holidayDuration && !sessionAllowedOnHoliday(slot, holidayDuration)) continue
            let clock = parseTimeMins(slot.startTime)
            const slotEnd = parseTimeMins(slot.endTime)

            while (clock < slotEnd && qi < queue.length) {
                const item = queue[qi]
                // Stop filling this slot if the next item is a gap — let the outer loop handle it
                if (item.type === 'assessmentGap') break
                const avail = slotEnd - clock
                const use = Math.min(item.remMins, avail)
                if (use <= 0) { qi++; continue }
                rows.push({
                    module: item.module, subModule: item.subModule, topic: item.topic, subTopic: item.subTopic,
                    activity: item.activity, type: item.type, hours: Math.round((use / 60) * 100) / 100,
                    date: new Date(cur), startMins: clock, endMins: clock + use, slotName: slot.name,
                })
                clock += use
                item.remMins -= use
                if (item.remMins <= 0) qi++
            }
        }
        cur = addDays(cur, 1)
    }
    return rows
}

// Calculate estimated end date by counting forward through working days
function calculateEndDate(startDateStr: string, days: number, workingDayNums: number[], hols: Holiday[]): Date | null {
    if (!startDateStr || days <= 0) return null
    const fullHolidaySet = new Set(hols.filter(h => !h.duration || h.duration === 'full').map(h => h.date))
    let cur = new Date(startDateStr + 'T00:00:00')
    let count = 0
    let guard = 0
    while (count < days && guard < 2000) {
        guard++
        if (workingDayNums.includes(cur.getDay()) && !fullHolidaySet.has(isoDate(cur))) {
            count++
            if (count === days) return cur
        }
        cur = addDays(cur, 1)
    }
    return cur
}


// ─── Component ────────────────────────────────────────────────────────────────

/* Standalone the screen brings the admin chrome with it; hosted inside another
   shell (the L&D console) it must not render a second sidebar and navbar.
   Declared at module scope so its identity is stable across renders — inline it
   would remount the whole subtree on every render. */
function Shell({ embedded, children }: { embedded: boolean; children: React.ReactNode }) {
    return embedded ? <>{children}</> : <DashboardLayout>{children}</DashboardLayout>
}

export default function ProgramCalendarContent(
    { courseId: courseIdProp, embedded = false }: { courseId?: string; embedded?: boolean } = {}
) {
    const searchParams = useSearchParams()
    const router = useRouter()
    // A host that has no query string of its own passes the course down instead.
    const courseId = courseIdProp ?? searchParams.get('courseId')

    const [token, setToken] = useState<string | null>(null)
    useEffect(() => { setToken(getToken()) }, [])

    // The course's batches — the deviation question ("applies to all batches?")
    // only exists when there is more than one real batch to choose between. A
    // lone "Default" batch is the fallback container of a batchless course.
    // Shared cache entry with the Batches / Sections / Participants pages —
    // this used to be a private hardcoded-localhost fetch of the same endpoint.
    const { data: batchHierarchy } = useCourseBatchesQuery(courseId || null)
    const courseBatches = useMemo(
        () => (batchHierarchy?.batches || []).map((b: any) => ({
            _id: String(b._id),
            batchName: String(b.batchName || ''),
            mine: Boolean(b.mine),
        })),
        [batchHierarchy]
    )
    // Admins scope deviations to any batch; everyone else only to batches they
    // are enrolled in — read post-mount so SSR/hydration never disagree. Same
    // rule attendance already applies.
    const [isAdmin, setIsAdmin] = useState(false)
    useEffect(() => {
        setIsAdmin((getSessionItem(SESSION_KEYS.originalRole) || '').trim().toLowerCase() === 'admin')
    }, [])
    const realBatches = useMemo(
        () => (courseBatches.length === 1 && courseBatches[0].batchName.trim().toLowerCase() === 'default')
            ? [] : courseBatches,
        [courseBatches]
    )
    const batchNameOf = (id: string) => courseBatches.find(b => b._id === id)?.batchName || id
    // The batches a NON-ADMIN may scope a deviation to: their own. One
    // membership means no question at all — the answer is known.
    const myRealBatches = useMemo(() => realBatches.filter(b => b.mine), [realBatches])

    // Two tabs now: build the daily template in Session Details, then set a start
    // date in Program Calendar and it schedules itself. The old 'holidays' tab is
    // gone — holidays come from the client's holiday module, not manual entry.
    const [activeTab, setActiveTab] = useState<'session' | 'calendar'>('session')

    // ── Interactive guided tour (game-style spotlight + arrow) ──
    const [tourStep, setTourStep] = useState(0)            // 0 = off, 1..N = active step
    const [tourRect, setTourRect] = useState<DOMRect | null>(null)
    const tourStartRef   = useRef<HTMLDivElement>(null)    // Start Date field (now in Program Calendar tab)
    const tourSessionRef = useRef<HTMLButtonElement>(null) // Add Session button
    const tourSteps = [
        { ref: tourSessionRef, title: 'Add Sessions & Breaks', desc: 'Build your daily schedule — add sessions and tea breaks with their timings.',        arrow: 'down' as const },
        { ref: tourStartRef,   title: 'Set your Start Date',   desc: 'Open the Program Calendar tab and pick your start date. The schedule builds itself around the client\'s holidays.', arrow: 'up' as const },
    ]
    const endTour = (remember: boolean) => {
        setTourStep(0)
        if (remember) { try { localStorage.setItem('pcTourDismissed', '1') } catch {} }
    }

    // ── Column visibility settings ──
    const [showSettings, setShowSettings] = useState(false)
    const [collapseIDo,  setCollapseIDo]  = useState(false)
    const [collapseWeDo, setCollapseWeDo] = useState(false)
    const [hideIDo,  setHideIDo]  = useState(true)
    const [hideWeDo, setHideWeDo] = useState(true)
    const [collapseYouDo,setCollapseYouDo]= useState(false)

    // ── Session template (Tab 1) ──
    const workingDays = [1,2,3,4,5,6]  // Sunday (0) excluded by default
    // Start empty — populated from saved data or defaults after API load
    const [daySlots, setDaySlots] = useState<DaySlot[]>([])
    // The start date as the DATABASE knows it — what the lock protects. The
    // input's live value may differ until Save; an unsaved plan is free.
    const [savedStartDate, setSavedStartDate] = useState('')
    const [startDateDirty, setStartDateDirty] = useState(false)

    // ── Calendar config (Tab 2) ──
    const [startDate, setStartDate] = useState('')
    const [holidays, setHolidays] = useState<Holiday[]>([])

    // ── Dirty tracking — detect unsaved changes ──
    const [sessionDirty, setSessionDirty] = useState(false)
    const [holidayDirty, setHolidayDirty] = useState(false)
    const [dataLoaded,  setDataLoaded]  = useState(false)
    const [resetConfirm, setResetConfirm] = useState(false)
    const [holidayName, setHolidayName] = useState('')
    const [holidayDate, setHolidayDate] = useState('')
    const [holidayDuration, setHolidayDuration] = useState<HolidayDuration>('full')
    const [holidayDateError, setHolidayDateError] = useState('')
    // Global gap days applied after every assessment banner (0 = no gap)
    const [globalAsmtGapDays, setGlobalAsmtGapDays] = useState(0)
    const [generated, setGenerated] = useState<GenRow[] | null>(null)
    const [calMonth, setCalMonth] = useState(() => new Date())
    const [calView, setCalView] = useState<'month'|'week'>('month')
    const [calWeekStart, setCalWeekStart] = useState(() => { const d = new Date(); return addDays(d, -d.getDay()) })

    // ── Program Calendar mode: planned / actual / comparison ──
    const [calendarMode, setCalendarMode] = useState<'planned'|'actual'|'comparison'>('planned')
    // Planned dates are common to every batch; ACTUAL dates are batch-specific.
    // So when Actual mode is on and the course has real batches, a specific
    // batch MUST be selected — its scoped deviations (plus the all-batch ones)
    // reflow the grid. 'all' is the internal value for a batchless course:
    // there is nothing to pick, the calendar shows directly and every
    // deviation applies. Switching the selection re-derives actualGenerated.
    const [selectedActualBatch, setSelectedActualBatch] = useState<string>('all')
    const [deviations, setDeviations] = useState<Deviation[]>([])
    // Keep selectedActualBatch valid: in Planned mode it rests at 'all';
    // in Actual and Comparison modes a course WITH batches must always point
    // at a real batch (first one by default, and again if the picked batch is
    // removed), while a batchless course stays on 'all' — no selector shown.
    useEffect(() => {
        if (calendarMode === 'planned' || !realBatches.length) {
            if (selectedActualBatch !== 'all') setSelectedActualBatch('all')
            return
        }
        if (!realBatches.some(b => b._id === selectedActualBatch)) {
            setSelectedActualBatch(realBatches[0]._id)
        }
    }, [calendarMode, realBatches, selectedActualBatch])
    // Visibility rule for the Actual view's deviation UI (chips, info bar):
    // course-wide deviations always show; batch-scoped ones only for the batch
    // being viewed. Mirrors the reflow filter inside actualGenerated — the
    // chips must never contradict the dates beside them.
    const devInActualView = (dv: Deviation) =>
        !dv.appliesTo?.length || (selectedActualBatch !== 'all' && dv.appliesTo.includes(selectedActualBatch))
    const [deviationModal, setDeviationModal] = useState<string|null>(null)  // ISO date being marked
    const [deviationReason, setDeviationReason] = useState('')
    // The modal's batch-scope answer: all batches (default), or the picked ids.
    const [deviationAll, setDeviationAll] = useState(true)
    const [deviationSel, setDeviationSel] = useState<string[]>([])
    // One opener for every "+" so an existing deviation's scope prefills
    // instead of silently resetting to "all" on edit.
    const openDeviationModal = (iso: string) => {
        const ex = deviations.find(d => d.date === iso)
        setDeviationReason('')
        setDeviationAll(!(ex?.appliesTo?.length))
        setDeviationSel(ex?.appliesTo || [])
        setDeviationModal(iso)
    }

    // ── Start-date lock ─────────────────────────────────────────────────────
    // A start date is editable while it is still a PLAN and locks the moment
    // reality references it. Evidence (attendance marks, recorded deviations)
    // locks it for everyone — moving the start would reflow sessions under
    // records of what actually happened. A merely-passed date with NO evidence
    // may still be corrected, by an admin alone (a false start). The lock is
    // derived from facts, never stored, so it can't drift from reality.
    const { data: attendanceEvidence } = useQuery({
        // Keyed under the shared "attendance" root (was a standalone
        // ['attendance-any'] root, which no invalidation could reach) so
        // marking or resetting a day refreshes the lock for an already-mounted
        // observer. The no-cache options below are unchanged.
        queryKey: queryKeys.attendance.records(courseId || ''),
        queryFn: () => attendanceApi.list(courseId!),
        enabled: !!courseId,
        // A LOCK must never trust a cached answer — evidence can be cleared
        // (or appear) from other screens, and showing a stale lock reads as
        // a bug. Re-ask the server on every mount.
        staleTime: 0,
        refetchOnMount: 'always',
    })
    const hasAttendance = (attendanceEvidence?.length ?? 0) > 0
    const todayYmdLocal = (() => {
        const d = new Date()
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    })()
    const evidenceLock = Boolean(savedStartDate) && (hasAttendance || deviations.length > 0)
    const startPassed = Boolean(savedStartDate) && todayYmdLocal >= savedStartDate
    const startDateEditable = !evidenceLock && (!startPassed || isAdmin)

    // ── Program Calendar view mode (table vs calendar grid) ──
    const [scheduleView, setScheduleView] = useState<'table'|'calendar'>('table')
    const [schedMonth, setSchedMonth] = useState(() => new Date())
    const [schedCalSubView, setSchedCalSubView] = useState<'month'|'week'|'day'>('month')
    const [schedWeekStart, setSchedWeekStart] = useState(() => { const d = new Date(); return addDays(d, -d.getDay()) })
    const [schedDay, setSchedDay] = useState(() => new Date())
    const [detailItem, setDetailItem] = useState<{ date: string; item: SchedItem } | null>(null)
    const [calDayModal, setCalDayModal] = useState<string | null>(null)  // ISO date for day detail modal
    const [deleteSlotId, setDeleteSlotId] = useState<string | null>(null)  // confirm delete slot
    const [clearSessionsConfirm, setClearSessionsConfirm] = useState(false)
    const [saveToast, setSaveToast] = useState<string | null>(null)
    const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const showSaveToast = (msg: string) => {
        if (toastTimer.current) clearTimeout(toastTimer.current)
        setSaveToast(msg)
        toastTimer.current = setTimeout(() => setSaveToast(null), 3000)
    }
    const [holidayPrompt, setHolidayPrompt] = useState<string | null>(null)  // ISO date awaiting add/remove confirmation
    const [holidayPromptName, setHolidayPromptName] = useState('')
    const [holidayPromptDuration, setHolidayPromptDuration] = useState<HolidayDuration>('full')
    const [showWorkingDaysModal, setShowWorkingDaysModal] = useState(false)
    const [showHolidaysModal, setShowHolidaysModal] = useState(false)
    const [showAddNameModal, setShowAddNameModal] = useState(false)
    const [timetablePopup, setTimetablePopup] = useState<DaySlot | null>(null)
    const [showTimetableModal, setShowTimetableModal] = useState(false)
    const [tableFullscreen, setTableFullscreen] = useState(false)
    useEffect(() => {
        if (!tableFullscreen) return
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setTableFullscreen(false) }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [tableFullscreen])


    // ── API ──
    const { data: allCourses = [], isLoading: isCoursesLoading } = useQuery(courseStructureApi.getAll())
    const courseFromList = useMemo(() => (allCourses as any[]).find((c: any) => c._id === courseId) as CourseData|undefined, [allCourses, courseId])

    // Every query below is gated on `course`, so failing to resolve it leaves the
    // whole page inert. The list is not authoritative — it can still be loading,
    // and a course created moments ago may not be in the cached copy — so a miss
    // falls back to fetching that one course by id. Arriving here from Course
    // Setup depends on this.
    const { data: courseById } = useQuery({
        ...courseStructureApi.getById(courseId || ''),
        enabled: Boolean(courseId) && !courseFromList && !isCoursesLoading,
    })
    const course = useMemo(
        () => courseFromList || ((courseById as any)?.data as CourseData | undefined),
        [courseFromList, courseById]
    )

    const { data: rawModules = [] } = useQuery({ ...moduleApi.getAll(), enabled: !!course, select: (d: any[]) => d.filter(m => m.courses?.includes?.(courseId)||m.courses===courseId).sort((a: any,b: any)=>(a.index||0)-(b.index||0)) })
    const { data: rawSubModules = [] } = useQuery({ ...subModuleApi.getAll(), enabled: !!course, select: (d: any[]) => d.filter(m => m.courses?.includes?.(courseId)||m.courses===courseId).sort((a: any,b: any)=>(a.index||0)-(b.index||0)) })
    const { data: rawTopics = [] } = useQuery({ ...topicApi.getAll(), enabled: !!course, select: (d: any[]) => d.filter(m => m.courses?.includes?.(courseId)||m.courses===courseId).sort((a: any,b: any)=>(a.index||0)-(b.index||0)) })
    const { data: rawSubTopics = [] } = useQuery({ ...subTopicApi.getAll(), enabled: !!course, select: (d: any[]) => d.filter(m => m.courses===courseId).sort((a: any,b: any)=>(a.index||0)-(b.index||0)) })
    const { data: pedagogyViews = [] } = useQuery({ ...pedagogyViewApi.getAll(), queryKey: ['pedagogyViews', courseId, (rawModules as any[]).length], select: (d: any[]) => d.filter(v => v.courses===courseId), enabled: !!token&&!!course&&(rawModules as any[]).length>0 })

    // ── Persist / restore program calendar config ──
    const { data: savedCalendar, isSuccess: calendarFetched, isError: calendarFetchFailed } = useQuery({
        ...programCalendarApi.getByCourse(courseId || ''),
        enabled: !!courseId && !!token,
    })
    const queryClient = useQueryClient()
    const { mutate: saveCalendar, isPending: isSaving } = useMutation(programCalendarApi.save())
    const { mutate: deleteCalendar, isPending: isDeleting } = useMutation(programCalendarApi.delete())

    // ── Client holidays: the ONE source the calendar schedules around ──
    // Holidays are no longer typed on this page. They come from the per-client
    // holiday module, which stores each client's calendar under the composite
    // scope key <institutionId>__client__<clientId> (the same key ClientList
    // mints). The course carries its clientId, so this page can resolve exactly
    // which client's holidays apply and pull them from the existing endpoint —
    // no server change, no new route.
    const [institutionId, setInstitutionId] = useState('')
    useEffect(() => {
        const { user } = userPermission()
        const id = (user?.institution as string) || ''
        if (id) setInstitutionId(id)
    }, [])
    const clientId = (course as CourseData | undefined)?.clientId || ''
    const clientScopeId = clientId && institutionId ? scopeIdFor(institutionId, clientId) : ''
    // Institute-wide is the bare institution id (scopeIdFor(id, null)). We pull
    // BOTH and union them: an institute holiday (a national day) applies to every
    // client, while a client can add its own local closures on top. Real data
    // needs this — most institutions keep their holidays at the institute level
    // and never create a per-client calendar, so client-only would apply nothing.
    const instituteScopeId = institutionId ? scopeIdFor(institutionId, null) : ''
    const holidayScopeId = clientScopeId || instituteScopeId // used only for the "linked?" UI hint
    const { data: clientHolidayCal, isSuccess: clientHolidaysFetched } = useQuery({
        ...instituteHolidayCalendarApi.getByInstitute(clientScopeId),
        enabled: !!clientScopeId && !!token,
    })
    const { data: instituteHolidayCal, isSuccess: instituteHolidaysFetched } = useQuery({
        ...instituteHolidayCalendarApi.getByInstitute(instituteScopeId),
        enabled: !!instituteScopeId && !!token,
    })
    // Feed the resolved holidays into the same `holidays` state generation already
    // reads; its dependency-array effect then reflows the schedule around them.
    // Union of institute-wide + client-specific, deduped by date with the CLIENT
    // entry winning a conflict (a client can override, e.g. mark a half-day where
    // the institute has a full day). This replaces the manual-entry tab entirely.
    useEffect(() => {
        // Wait until BOTH resolve so the union isn't briefly half-applied (which
        // would reflow the calendar twice on open). A scope with no calendar
        // resolves to null, which is a valid "no holidays here" answer.
        if (!instituteHolidaysFetched) return
        if (clientScopeId && !clientHolidaysFetched) return
        type RawHoliday = { holidayId?: string; id?: string; name?: string; date?: string; duration?: HolidayDuration }
        const read = (cal: unknown): RawHoliday[] =>
            ((cal as { holidays?: RawHoliday[] } | null)?.holidays) || []
        const byDate = new Map<string, Holiday>()
        // Institute first, then client — client overwrites the same date.
        for (const src of [read(instituteHolidayCal), read(clientHolidayCal)]) {
            for (const h of src) {
                const date = h.date || ''
                if (!date) continue
                byDate.set(date, {
                    id: h.holidayId || h.id || uid(),
                    name: h.name || 'Holiday',
                    date,                       // already "YYYY-MM-DD", no TZ conversion
                    duration: h.duration || 'full',
                })
            }
        }
        setHolidays(Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date)))
    }, [instituteHolidaysFetched, clientHolidaysFetched, instituteHolidayCal, clientHolidayCal, clientScopeId])

    // ── Restore saved data from MongoDB on first load ──
    useEffect(() => {
        if (dataLoaded) return
        if (!calendarFetched && !calendarFetchFailed) return  // still loading
        const d = savedCalendar as any
        // If a saved record exists, use its sessions as-is (even if sessions=[]).
        // When there is NO saved record, start with an empty session list.
        const hasSavedRecord = d && d._id
        const normSessions = (arr: any[]) => arr.map(s => ({ ...s, id: s.id || s.slotId || s._id || uid() }))
        setDaySlots(hasSavedRecord ? normSessions(d.sessions ?? []) : [])
        if (d?.startDate) { setStartDate(d.startDate); setSavedStartDate(d.startDate) }
        // Holidays are NOT restored from the record — the holiday-module union
        // effect above is their single source of truth and would overwrite any
        // restored copy anyway.
        if (d?.deviations?.length) setDeviations(d.deviations.map((dv: any) => ({ ...dv, id: dv.id || dv.deviationId || uid() })))
        setDataLoaded(true)
        setSessionDirty(false)
        setHolidayDirty(false)
    }, [calendarFetched, calendarFetchFailed]) // eslint-disable-line react-hooks/exhaustive-deps

    // ── Auto-start the guided tour on first visit (no start date, not dismissed) ──
    useEffect(() => {
        if (!dataLoaded || startDate || tourStep !== 0) return
        let dismissed = false
        try { dismissed = localStorage.getItem('pcTourDismissed') === '1' } catch {}
        if (dismissed) return
        const t = setTimeout(() => { setActiveTab('session'); setTourStep(1) }, 700)
        return () => clearTimeout(t)
    }, [dataLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

    // ── Measure the current tour target so the spotlight + arrow can follow it ──
    useEffect(() => {
        if (tourStep === 0) { setTourRect(null); return }
        const step = tourSteps[tourStep - 1]
        if (!step) { setTourStep(0); return }
        let raf = 0
        const measure = () => {
            const el = step.ref.current
            if (el) setTourRect(el.getBoundingClientRect())
        }
        const el = step.ref.current
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        const t = setTimeout(() => {
            measure()
            const loop = () => { measure(); raf = requestAnimationFrame(loop) }
            raf = requestAnimationFrame(loop)
            setTimeout(() => cancelAnimationFrame(raf), 700) // stop tracking after scroll settles
        }, 60)
        window.addEventListener('resize', measure)
        window.addEventListener('scroll', measure, true)
        return () => { clearTimeout(t); cancelAnimationFrame(raf); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true) }
    }, [tourStep]) // eslint-disable-line react-hooks/exhaustive-deps

    // ── Auto-advance from step 1 once a start date is chosen ──
    useEffect(() => {
        if (tourStep === 1 && startDate) setTourStep(2)
    }, [startDate]) // eslint-disable-line react-hooks/exhaustive-deps


    const activityTypes = useMemo(() => {
        const wd = course?.We_Do; const weDo = !wd ? [] : Array.isArray(wd) ? wd as string[] : Object.values(wd).flat() as string[]
        return { iDo: course?.I_Do||[], weDo, youDo: course?.You_Do||[] }
    }, [course])

    const tableRows = useMemo<TableRowItem[]>(() => !course ? [] : buildTableRows(course, rawModules as any[], rawSubModules as any[], rawTopics as any[], rawSubTopics as any[]), [course, rawModules, rawSubModules, rawTopics, rawSubTopics])
    const courseHours = useMemo(() => buildCourseHours(pedagogyViews as any[], tableRows), [pedagogyViews, tableRows])

    const getSingleHour = (row: TableRowItem, type: 'iDo'|'weDo'|'youDo', activity: string): number => {
        const eT=row.topicId||`${row.moduleId}-dt`, eS=row.subtopicId||(row.topicId?`${row.topicId}-ds`:`${row.moduleId}-ds`)
        return courseHours?.[row.moduleId!]?.[eT]?.[eS]?.[type]?.[activity]||0
    }

    // You Do = the "Assessment" — shown as a full-width horizontal banner placed
    // AFTER the whole group's rows (grouped by module so it sits between modules).
    // Returns the combined hours + scheduled start/end dates for that block.
    const getYouDoCell = (ridx: number): { skip: boolean; total: number; rowSpan: number; start?: Date; end?: Date; dayHours: { date: Date; hours: number; startMins: number; endMins: number }[] } => {
        const acts = activityTypes.youDo as string[]
        if (!acts.length) return { skip: false, total: 0, rowSpan: 1, dayHours: [] }

        // Vertical group = the ACTUAL pedagogy merge selection for You Do
        // (e.g. h1,h2,h3 merged into one Assessment in the pedagogy view),
        // NOT the outer Module/Topic hierarchy grouping.
        let span = 1, isStart = true, anyMerge = false
        acts.forEach(activity => {
            const mi = isCellMerged(ridx, 'youDo', activity, pedagogyViews as any[], tableRows)
            if (mi.isMerged) {
                anyMerge = true
                span = Math.max(span, mi.rowSpan)
                if (!mi.isStart) isStart = false
            }
        })
        if (anyMerge && !isStart) return { skip: true, total: 0, rowSpan: 1, dayHours: [] }   // continuation row of a merge
        if (!span || span < 1) span = 1

        // sum You Do hours across the group's rows
        let total = 0
        for (let r = ridx; r < ridx + span && r < tableRows.length; r++) {
            acts.forEach(activity => {
                const mi = isCellMerged(r, 'youDo', activity, pedagogyViews as any[], tableRows)
                if (mi.isMerged) { if (mi.isStart) total += mi.value }
                else total += getSingleHour(tableRows[r], 'youDo', activity)
            })
        }
        // date range across the group's rows — uses the YOU DO-only schedule so it
        // doesn't bleed into (or get bled into by) the rows' own I Do/We Do dates.
        let start: Date | undefined, end: Date | undefined
        for (let r = ridx; r < ridx + span && r < tableRows.length; r++) {
            const d = youDoDateMap[tableRows[r].rowId]
            if (d) { if (!start || d.start < start) start = new Date(d.start); if (!end || d.end > end) end = new Date(d.end) }
        }
        return { skip: false, total, rowSpan: span, start, end, dayHours: getGroupDayHours(youDoDayHoursMap, ridx, span) }
    }

    // Queue order matters: a merged You Do (Assessment) must be scheduled AFTER all of
    // its group's I Do / We Do hours have used up their day capacity — not right after
    // the group's FIRST row — otherwise it eats into day 1 before h2/h3 even get a turn.
    // So: gather You Do items keyed by the LAST row of their group, then interleave them
    // in only once that row's own I Do/We Do has been queued.
    // Extracted so it can be called directly in event handlers (bypasses effect chain)
    const buildContentItems = (gapDays: number): ContentItem[] => {
        const items: ContentItem[] = []
        const mergedSeen = new Set<string>()

        const pendingYouDoByEndRow: Record<number, ContentItem[]> = {}
        tableRows.forEach((row, ridx) => {
            ;(activityTypes.youDo as string[]).forEach(activity => {
                const mi = isCellMerged(ridx, 'youDo', activity, pedagogyViews as any[], tableRows)
                if (mi.isMerged) {
                    if (mi.isStart) {
                        const key = `youDo-${activity}-${mi.rowSpan}-${mi.value}-${ridx}`
                        if (!mergedSeen.has(key)) {
                            mergedSeen.add(key)
                            const endRow = ridx + mi.rowSpan - 1
                            ;(pendingYouDoByEndRow[endRow] ||= []).push({ module:row.moduleName, subModule:row.subModuleName, topic:row.topicName, subTopic:row.subtopicName, activity, type:'youDo', hours: mi.value })
                        }
                    }
                } else {
                    const v = getSingleHour(row, 'youDo', activity)
                    if (v > 0) (pendingYouDoByEndRow[ridx] ||= []).push({ module:row.moduleName, subModule:row.subModuleName, topic:row.topicName, subTopic:row.subtopicName, activity, type:'youDo', hours: v })
                }
            })
        })

        tableRows.forEach((row, ridx) => {
            ;(['iDo','weDo'] as const).forEach(type => {
                ;(activityTypes[type] as string[]).forEach(activity => {
                    const mi = isCellMerged(ridx, type, activity, pedagogyViews as any[], tableRows)
                    if (mi.isMerged) { if (mi.isStart) { const key=`${type}-${activity}-${mi.rowSpan}-${mi.value}-${ridx}`; if (!mergedSeen.has(key)) { mergedSeen.add(key); items.push({ module:row.moduleName, subModule:row.subModuleName, topic:row.topicName, subTopic:row.subtopicName, activity, type, hours:mi.value }) } } }
                    else { const v=getSingleHour(row,type,activity); if (v>0) items.push({ module:row.moduleName, subModule:row.subModuleName, topic:row.topicName, subTopic:row.subtopicName, activity, type, hours:v }) }
                })
            })
            if (pendingYouDoByEndRow[ridx]) {
                // Gap BEFORE assessment: assessment starts N calendar days after preceding content
                if (gapDays > 0) {
                    items.push({ module:'', subModule:'', topic:'', subTopic:'', activity:'assessmentGap', type:'assessmentGap', hours:0, gapDays })
                }
                items.push(...pendingYouDoByEndRow[ridx])
                // After assessment: always advance to next working day so post-assessment
                // content never shares the assessment day's remaining session slots
                items.push({ module:'', subModule:'', topic:'', subTopic:'', activity:'assessmentGap', type:'assessmentGap', hours:0, gapDays: 1 })
            }
        })
        return items
    }

    const contentItems = useMemo<ContentItem[]>(
        () => buildContentItems(globalAsmtGapDays),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [tableRows, pedagogyViews, activityTypes, courseHours, globalAsmtGapDays]
    )

    const totalContentHours = useMemo(() => contentItems.reduce((a,i)=>a+i.hours,0), [contentItems])
    const teachingContentHours = useMemo(() => contentItems.filter(i=>i.type!=='youDo').reduce((a,i)=>a+i.hours,0), [contentItems])

    const hierarchySpans = useMemo(() => computeHierarchySpans(tableRows), [tableRows])

    const activityTotals = useMemo(() => {
        const t: Record<string, Record<string, number>> = {}
        contentItems.forEach(item => {
            if (!t[item.type]) t[item.type] = {}
            t[item.type][item.activity] = (t[item.type][item.activity] || 0) + item.hours
        })
        return t
    }, [contentItems])

    // Build a rowId -> {start,end} date map and a rowId -> per-day-hours map from
    // `generated`, restricted to a given pedagogy type set. A merged You Do
    // (Assessment) item is tagged with the FIRST row's module/topic/subTopic identity
    // (see contentItems below), which is the same key as that row's own I Do/We Do
    // teaching hours — so without separating by type, a row's "Start/End Date" would
    // incorrectly absorb the multi-day span of the assessment scheduled on top of it.
    function buildDateMaps(types: Array<'iDo'|'weDo'|'youDo'|'assessmentGap'>, rows?: GenRow[]) {
        const dateMap: Record<string, { start: Date; end: Date }> = {}
        const dayMap: Record<string, { date: Date; hours: number; startMins: number; endMins: number }[]> = {}
        const useRows = rows ?? generated
        if (!useRows?.length) return { dateMap, dayMap }
        const keyToIds: Record<string, string[]> = {}
        tableRows.forEach(row => {
            const k = `${row.moduleName}|${row.topicName}|${row.subtopicName}`
            if (!keyToIds[k]) keyToIds[k] = []
            keyToIds[k].push(row.rowId)
        })
        const acc: Record<string, Record<string, { hours: number; startMins: number; endMins: number }>> = {}
        useRows.forEach(r => {
            if (!types.includes(r.type)) return
            const ids = keyToIds[`${r.module}|${r.topic}|${r.subTopic}`] || []
            ids.forEach(id => {
                const ex = dateMap[id]
                if (!ex) dateMap[id] = { start: new Date(r.date), end: new Date(r.date) }
                else { if (r.date < ex.start) ex.start = new Date(r.date); if (r.date > ex.end) ex.end = new Date(r.date) }
                if (!acc[id]) acc[id] = {}
                const iso = isoDate(r.date)
                const cur = acc[id][iso]
                if (!cur) acc[id][iso] = { hours: r.hours, startMins: r.startMins, endMins: r.endMins }
                else { cur.hours = Math.round((cur.hours + r.hours) * 100) / 100; cur.startMins = Math.min(cur.startMins, r.startMins); cur.endMins = Math.max(cur.endMins, r.endMins) }
            })
        })
        Object.entries(acc).forEach(([id, days]) => {
            dayMap[id] = Object.entries(days)
                .map(([iso, v]) => ({ date: new Date(iso + 'T00:00:00'), hours: v.hours, startMins: v.startMins, endMins: v.endMins }))
                .sort((a, b) => a.date.getTime() - b.date.getTime())
        })
        return { dateMap, dayMap }
    }

    // Teaching schedule (I Do / We Do) — drives each row's own Start/End Date columns.
    const { dateMap: rowDateMap, dayMap: dayHoursMap } = useMemo(
        () => buildDateMaps(['iDo', 'weDo']), [generated, tableRows])

    // Assessment schedule (You Do) — drives the horizontal Assessment banner only.
    const { dateMap: youDoDateMap, dayMap: youDoDayHoursMap } = useMemo(
        () => buildDateMaps(['youDo']), [generated, tableRows])

    // combine per-day session timing across a vertical group span (e.g. a merged You Do block)
    const getGroupDayHours = (map: Record<string, { date: Date; hours: number; startMins: number; endMins: number }[]>, ridx: number, span: number): { date: Date; hours: number; startMins: number; endMins: number }[] => {
        const acc: Record<string, { hours: number; startMins: number; endMins: number }> = {}
        for (let r = ridx; r < ridx + span && r < tableRows.length; r++) {
            const entries = map[tableRows[r].rowId] || []
            entries.forEach(e => {
                const iso = isoDate(e.date)
                const cur = acc[iso]
                if (!cur) acc[iso] = { hours: e.hours, startMins: e.startMins, endMins: e.endMins }
                else { cur.hours = Math.round((cur.hours + e.hours) * 100) / 100; cur.startMins = Math.min(cur.startMins, e.startMins); cur.endMins = Math.max(cur.endMins, e.endMins) }
            })
        }
        return Object.entries(acc)
            .map(([iso, v]) => ({ date: new Date(iso + 'T00:00:00'), hours: v.hours, startMins: v.startMins, endMins: v.endMins }))
            .sort((a, b) => a.date.getTime() - b.date.getTime())
    }

    // combine Start/End date across a vertical group span — a merge's non-merged
    // activities (e.g. We Do not merged the same way as I Do) still get scheduled
    // under OTHER rows in the span, so only checking the start row's own date entry
    // silently drops those hours/days from the displayed range.
    const getGroupDates = (map: Record<string, { start: Date; end: Date }>, ridx: number, span: number): { start?: Date; end?: Date } => {
        let start: Date | undefined, end: Date | undefined
        for (let r = ridx; r < ridx + span && r < tableRows.length; r++) {
            const d = map[tableRows[r].rowId]
            if (d) { if (!start || d.start < start) start = new Date(d.start); if (!end || d.end > end) end = new Date(d.end) }
        }
        return { start, end }
    }

    const fmtDayHours = (entries: { date: Date; hours: number; startMins: number; endMins: number }[]) =>
        entries.map(e => `${fmtDateShort(e.date)} (${minsToDisplay(e.startMins)}-${minsToDisplay(e.endMins)})`).join(', ')

    // ── Timetable / session derived ──
    const sortedSlots = useMemo(() => [...daySlots].sort((a,b)=>parseTimeMins(a.startTime)-parseTimeMins(b.startTime)), [daySlots])
    const teachingMins = useMemo(() => daySlots.filter(s=>s.kind==='session').reduce((a,s)=>a+durationMins(s.startTime,s.endTime),0), [daySlots])
    const breakMins = useMemo(() => daySlots.filter(s=>s.kind==='break').reduce((a,s)=>a+durationMins(s.startTime,s.endTime),0), [daySlots])
    const dayStart = useMemo(() => sortedSlots.length ? parseTimeMins(sortedSlots[0].startTime) : 0, [sortedSlots])
    const dayEnd = useMemo(() => sortedSlots.length ? Math.max(...sortedSlots.map(s=>parseTimeMins(s.endTime))) : 0, [sortedSlots])
    const dailyHours = teachingMins / 60
    const estimatedDays = dailyHours > 0 ? Math.ceil(totalContentHours / dailyHours) : 0
    const estimatedEndDate = useMemo(() =>
        startDate && estimatedDays > 0 ? calculateEndDate(startDate, estimatedDays, workingDays, holidays) : null,
        [startDate, estimatedDays, holidays]  // eslint-disable-line react-hooks/exhaustive-deps
    )
    const sessionCount = daySlots.filter(s=>s.kind==='session').length

    const workingDaysList = useMemo(() => {
        if (!startDate || !estimatedEndDate) return []
        const fullHolidaySet = new Set(holidays.filter(h => !h.duration || h.duration === 'full').map(h => h.date))
        const list: Date[] = []
        let cur = new Date(startDate + 'T00:00:00')
        const end = estimatedEndDate
        while (cur <= end && list.length < 500) {
            if (workingDays.includes(cur.getDay()) && !fullHolidaySet.has(isoDate(cur))) list.push(new Date(cur))
            cur = addDays(cur, 1)
        }
        return list
    }, [startDate, estimatedEndDate, holidays]) // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-generate Sunday "Weekly Off" holiday entries for every Sunday in the date range.
    // These are derived (not stored in DB) — they only affect display so Sundays look like
    // holidays in the calendar grid, not just blank weekend cells.
    const sundayHolidaysInRange = useMemo((): Holiday[] => {
        if (!startDate) return []
        // Use computed end date if available; fall back to 6 months from start so
        // Sundays show in the holiday list even before sessions/content are configured.
        const sd = new Date(startDate + 'T00:00:00')
        const endRef: Date = estimatedEndDate ?? new Date(sd.getFullYear(), sd.getMonth() + 6, sd.getDate())
        const result: Holiday[] = []
        let cur = new Date(sd)
        // Advance to first Sunday
        while (cur.getDay() !== 0) cur = addDays(cur, 1)
        while (cur <= endRef) {
            result.push({ id: `__sun__${isoDate(cur)}`, name: 'Sunday Off', date: isoDate(cur), duration: 'full' })
            cur = addDays(cur, 7)
        }
        return result
    }, [startDate, estimatedEndDate])

    // Merged holidays for visual display: user-defined + auto Sundays (Sundays manually
    // added by the user are kept as-is and not duplicated).
    const displayHolidays = useMemo((): Holiday[] => {
        const userDates = new Set(holidays.map(h => h.date))
        const autoSundays = sundayHolidaysInRange.filter(s => !userDates.has(s.date))
        return [...holidays, ...autoSundays].sort((a, b) => a.date.localeCompare(b.date))
    }, [holidays, sundayHolidaysInRange])

    // ── Save handlers ──
    // ONLY the inputs are persisted: the chosen start date, the session
    // template, and the deviations that happened. End date, totals and day
    // counts are derived and recompute from these on every load; holidays come
    // from the holiday module. Storing any of them would create a second
    // source of truth that goes stale the moment pedagogy hours change.
    const savePayload = () => ({
        courseId: courseId!,
        startDate,
        sessions: daySlots,
        deviations,
    })

    // The start date's own save — persists the calendar's inputs with the
    // newly chosen date. Separate from the sessions save so the date can be
    // saved where it is chosen, without hunting for another tab's button.
    function handleSaveStartDate() {
        if (!courseId || !startDate) return
        saveCalendar(savePayload(), {
            onSuccess: () => {
                setSavedStartDate(startDate)
                setStartDateDirty(false)
                setDataLoaded(true)
                queryClient.invalidateQueries({ queryKey: ['programCalendar', courseId] })
                showSaveToast('Start date saved.')
            },
        })
    }

    function handleSaveSession() {
        if (!courseId) return
        saveCalendar(savePayload(), { onSuccess: () => { setSessionDirty(false); setDataLoaded(true); queryClient.invalidateQueries({ queryKey: ['programCalendar', courseId] }); showSaveToast('Session details saved successfully!') } })
        if (startDate && dailyHours > 0 && contentItems.length > 0) {
            setGenerated(generateCalendar(daySlots, contentItems, { startDate, workingDays }, holidays))
        }
    }

    // handleSaveHolidays removed with the Holiday Management tab — holidays are no
    // longer entered or saved on this page; they are pulled from the client module.

    // Auto-generate program calendar whenever start date, sessions, or content changes
    useEffect(() => {
        if (startDate && dailyHours > 0 && contentItems.length > 0) {
            setGenerated(generateCalendar(daySlots, contentItems, { startDate, workingDays }, holidays))
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startDate, daySlots, contentItems, holidays])


    // ── Actual calendar: same as planned but cancelled dates treated as extra holidays ──
    // When 'all' is selected (or the course has no real batches), only
    // all-batch deviations reflow — a b2-only cancellation is not true for
    // b1/b3, so the shared grid stays common. When a specific batch is
    // selected, that batch's scoped deviations reflow the grid too, so the
    // user sees THIS batch's actual reality. Batch-scoped deviations continue
    // to surface as tags in the Deviation column and as per-batch end chips.
    const actualGenerated = useMemo(() => {
        if (!startDate || dailyHours <= 0 || !contentItems.length) return null
        const batchScopeActive = selectedActualBatch !== 'all'
        const cancelledAsHolidays: Holiday[] = deviations
            .filter(dv => !dv.appliesTo?.length || (batchScopeActive && dv.appliesTo.includes(selectedActualBatch)))
            .map(dv => ({
                id: dv.id, name: dv.reason || 'Cancelled', date: dv.date, duration: 'full' as const,
            }))
        return generateCalendar(daySlots, contentItems, { startDate, workingDays }, [...holidays, ...cancelledAsHolidays])
    }, [startDate, daySlots, contentItems, holidays, deviations, dailyHours, workingDays, selectedActualBatch])

    // Each real batch's ACTUAL end date once any deviation is batch-scoped:
    // the shared plan re-generated with that batch's own cancellations (the
    // all-batch ones plus its scoped ones). Empty while every deviation still
    // applies to everyone — then there is nothing batch-specific to report.
    const perBatchEnds = useMemo(() => {
        if (!startDate || dailyHours <= 0 || !contentItems.length) return []
        if (!realBatches.length) return []
        if (!deviations.some(dv => dv.appliesTo?.length)) return []
        return realBatches.map(b => {
            const cancelled: Holiday[] = deviations
                .filter(dv => !dv.appliesTo?.length || dv.appliesTo.includes(b._id))
                .map(dv => ({ id: dv.id, name: dv.reason || 'Cancelled', date: dv.date, duration: 'full' as const }))
            const rows = generateCalendar(daySlots, contentItems, { startDate, workingDays }, [...holidays, ...cancelled])
            return { name: b.batchName, end: rows.length ? rows[rows.length - 1].date : null }
        })
    }, [deviations, realBatches, startDate, daySlots, contentItems, holidays, dailyHours, workingDays])

    // Actual calendar date maps (same logic as planned, uses actualGenerated).
    const { dateMap: actualRowDateMap, dayMap: actualDayHoursMap } = useMemo(
        () => buildDateMaps(['iDo', 'weDo'], actualGenerated ?? []), [actualGenerated, tableRows])
    const { dateMap: actualYouDoDateMap, dayMap: actualYouDoDayHoursMap } = useMemo(
        () => buildDateMaps(['youDo'], actualGenerated ?? []), [actualGenerated, tableRows])

    // ── Slot CRUD ──
    function deleteSlotAndSave(id: string) {
        const next = daySlots.filter(s => s.id !== id)
        setDaySlots(next)
        setDeleteSlotId(null)
        setSessionDirty(false)
        if (courseId) {
            saveCalendar({ ...savePayload(), sessions: next }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['programCalendar', courseId] }); showSaveToast('Session deleted and saved.') } })
        }
    }

    function clearAllSlotsAndSave() {
        setDaySlots([])
        setClearSessionsConfirm(false)
        setSessionDirty(false)
        if (courseId) {
            saveCalendar({ ...savePayload(), sessions: [] }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['programCalendar', courseId] }); showSaveToast('All sessions cleared.') } })
        }
    }

    function addSlot(kind: 'session'|'break') {
        const last = daySlots.at(-1)
        const baseStart = last ? last.endTime : (kind==='session' ? '09:00' : '11:00')
        const baseStartMins = parseTimeMins(baseStart)
        const endMins = baseStartMins + (kind === 'session' ? 120 : 15)
        const end = `${String(Math.floor(endMins/60)%24).padStart(2,'0')}:${String(endMins%60).padStart(2,'0')}`
        const n = daySlots.filter(s=>s.kind===kind).length + 1
        setDaySlots(p => [...p, { id: uid(), kind, name: kind==='session'?`Session ${n}`:'Break', startTime: baseStart, endTime: end }])
        setSessionDirty(true)
    }
    function updateSlot(id: string, patch: Partial<DaySlot>) { setDaySlots(p => p.map(s => s.id===id ? { ...s, ...patch } : s)); setSessionDirty(true) }
    function removeSlot(id: string) { setDaySlots(p => p.filter(s => s.id!==id)); setSessionDirty(true) }

    function addHoliday() {
        if (!holidayDate || holidays.some(h=>h.date===holidayDate)) return
        const _endStr = summary?.endDate instanceof Date ? isoDate(summary.endDate) : estimatedEndDate ? isoDate(estimatedEndDate) : ''
        if (startDate && holidayDate < startDate) return
        if (_endStr && holidayDate > _endStr) return
        setHolidays(p => [...p, { id: uid(), name: holidayName || 'Holiday', date: holidayDate, duration: holidayDuration }].sort((a,b)=>a.date.localeCompare(b.date)))
        setHolidayName(''); setHolidayDate(''); setHolidayDuration('full')
        setHolidayDirty(true)
    }

    function toggleHolidayOnDate(iso: string) {
        if (holidays.some(h => h.date === iso)) {
            setHolidays(p => p.filter(h => h.date !== iso))
        } else {
            setHolidays(p => [...p, { id: uid(), name: holidayName || 'Holiday', date: iso, duration: holidayDuration }].sort((a,b)=>a.date.localeCompare(b.date)))
        }
        setHolidayDirty(true)
    }

    function addHolidayOnDate(iso: string, name: string, duration: HolidayDuration) {
        if (holidays.some(h => h.date === iso)) return
        const _endStr = summary?.endDate instanceof Date ? isoDate(summary.endDate) : estimatedEndDate ? isoDate(estimatedEndDate) : ''
        if (startDate && iso < startDate) return
        if (_endStr && iso > _endStr) return
        setHolidays(p => [...p, { id: uid(), name: name || 'Holiday', date: iso, duration }].sort((a,b)=>a.date.localeCompare(b.date)))
        setHolidayDirty(true)
    }
    function removeHolidayOnDate(iso: string) {
        setHolidays(p => p.filter(h => h.date !== iso))
        setHolidayDirty(true)
    }

    function handleReset() {
        if (!courseId) return
        deleteCalendar(courseId, {
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ['programCalendar', courseId] })
                setStartDate('')
                setDaySlots([])
                setHolidays([])
                setDeviations([])
                setSessionDirty(false)
                setHolidayDirty(false)
                setDataLoaded(false)
                setResetConfirm(false)
                setActiveTab('session')
                showSaveToast('Calendar reset successfully.')
            },
            onError: () => { setResetConfirm(false) },
        })
    }

    async function exportToExcel() {
        if (!tableRows.length) return
        const ExcelJS = (await import('exceljs')).default
        const wb = new ExcelJS.Workbook()
        wb.creator = 'Program Calendar'
        const ws = wb.addWorksheet('Program Calendar', { views: [{ state: 'frozen', ySplit: 2 }] })

        const hier: string[] = []
        if (hasModule)    hier.push('Module')
        if (hasSubModule) hier.push('Sub Module')
        if (hasTopic)     hier.push('Topic')
        if (hasSubTopic)  hier.push('Sub Topic')

        // Respect the same hide/collapse state as the UI
        const showIDo  = !hideIDo  && activityTypes.iDo.length  > 0
        const showWeDo = !hideWeDo && activityTypes.weDo.length > 0
        const iDoActs  = showIDo  ? (collapseIDo  ? ['I Do']  : activityTypes.iDo  as string[]) : []
        const weDoActs = showWeDo ? (collapseWeDo ? ['We Do'] : activityTypes.weDo as string[]) : []

        const allCols = [
            ...hier.map(h  => ({ key: h,            group: 'hier' as const })),
            ...iDoActs.map(a  => ({ key: a,          group: 'ido'  as const })),
            ...weDoActs.map(a => ({ key: a,          group: 'wedo' as const })),
            { key: 'Total Hours', group: 'stat' as const },
            { key: 'Start Date',  group: 'stat' as const },
            { key: 'End Date',    group: 'stat' as const },
        ]

        // Column widths — generous spacing so nothing feels cramped
        ws.columns = allCols.map(c => ({
            width:
                c.group === 'hier' ? 38 :
                c.group === 'ido'  ? 18 :
                c.group === 'wedo' ? 18 :
                c.group === 'stat' ? 26 : 16,
        }))

        const numCols   = allCols.length
        const hierCount = hier.length
        const iDoStart  = hierCount + 1
        const iDoEnd    = hierCount + iDoActs.length
        const weDoStart = iDoEnd + 1
        const weDoEnd   = iDoEnd + weDoActs.length
        const thCol     = numCols - 2   // Total Hours
        const sdCol     = numCols - 1   // Start Date
        const edCol     = numCols       // End Date

        // Black border on all sides
        const BLACK = 'FF000000'
        const border = (style: 'thin'|'medium' = 'thin') => ({
            top: { style, color: { argb: BLACK } }, left: { style, color: { argb: BLACK } },
            bottom: { style, color: { argb: BLACK } }, right: { style, color: { argb: BLACK } },
        })

        const style = (
            cell: any,
            bg: string,
            fg = '000000',
            bold = false,
            align: 'left'|'center'|'right' = 'center',
            wrap = false,
            borderStyle: 'thin'|'medium' = 'thin',
            size = 11,
        ) => {
            cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + bg } }
            cell.font      = { bold, color: { argb: 'FF' + fg }, size, name: 'Calibri' }
            cell.alignment = { vertical: 'middle', horizontal: align, wrapText: wrap, shrinkToFit: false }
            cell.border    = border(borderStyle)
        }

        // ── Row 1: group headers ──
        const r1 = ws.getRow(1); r1.height = 40
        hier.forEach((h, i) => {
            const c = r1.getCell(i + 1)
            c.value = h
            style(c, '1E293B', 'FFFFFF', true, 'center', false, 'medium', 13)
            ws.mergeCells(1, i + 1, 2, i + 1)
        })
        if (showIDo) {
            const c = r1.getCell(iDoStart); c.value = 'I Do'
            style(c, '3730A3', 'FFFFFF', true, 'center', false, 'medium', 13)
            if (collapseIDo) ws.mergeCells(1, iDoStart, 2, iDoStart)
            else if (iDoActs.length > 1) ws.mergeCells(1, iDoStart, 1, iDoEnd)
        }
        if (showWeDo) {
            const c = r1.getCell(weDoStart); c.value = 'We Do'
            style(c, '6D28D9', 'FFFFFF', true, 'center', false, 'medium', 13)
            if (collapseWeDo) ws.mergeCells(1, weDoStart, 2, weDoStart)
            else if (weDoActs.length > 1) ws.mergeCells(1, weDoStart, 1, weDoEnd)
        }
        const thH = r1.getCell(thCol); thH.value = 'Total Hours'; style(thH, 'B45309', 'FFFFFF', true, 'center', false, 'medium', 13); ws.mergeCells(1, thCol, 2, thCol)
        const sdH = r1.getCell(sdCol); sdH.value = 'Start Date';  style(sdH, '15803D', 'FFFFFF', true, 'center', false, 'medium', 13); ws.mergeCells(1, sdCol, 2, sdCol)
        const edH = r1.getCell(edCol); edH.value = 'End Date';    style(edH, '6D28D9', 'FFFFFF', true, 'center', false, 'medium', 13); ws.mergeCells(1, edCol, 2, edCol)

        // ── Row 2: activity sub-headers ──
        const r2 = ws.getRow(2); r2.height = 32
        if (showIDo && !collapseIDo)  iDoActs.forEach((a, i)  => { const c = r2.getCell(iDoStart + i);  c.value = a; style(c, 'E0E7FF', '3730A3', true, 'center', false, 'thin', 12) })
        if (showWeDo && !collapseWeDo) weDoActs.forEach((a, i) => { const c = r2.getCell(weDoStart + i); c.value = a; style(c, 'EDE9FE', '5B21B6', true, 'center', false, 'thin', 12) })

        // ── Data rows ──
        const { mSpan, smSpan, tSpan } = hierarchySpans
        const asmtByLastRow: Record<number, { total: number; start?: Date; end?: Date; dayHours: { date: Date; hours: number; startMins: number; endMins: number }[] }> = {}
        tableRows.forEach((_, i) => {
            const yd = getYouDoCell(i)
            if (!yd.skip && yd.total > 0) asmtByLastRow[i + yd.rowSpan - 1] = { total: yd.total, start: yd.start, end: yd.end, dayHours: yd.dayHours }
        })

        const physicalSpan = (start: number, span: number) => {
            if (span <= 1) return span
            let extra = 0
            for (let k = start; k < start + span - 1; k++) { if (asmtByLastRow[k]) extra++ }
            return span + extra
        }

        const groupContinuesAfter = (spanArr: number[], ridx: number): boolean => {
            let g = ridx
            while (g >= 0 && !(spanArr[g] > 0)) g--
            if (g < 0) return false
            return ridx < g + spanArr[g] - 1
        }

        let exRow = 3
        tableRows.forEach((row, ridx) => {
            const rowBg = ridx % 2 === 0 ? 'FFFFFF' : 'F8FAFF'
            const wsRow = ws.getRow(exRow); wsRow.height = 30
            let col = 1

            // Hierarchy cells
            if (hasModule) {
                if (mSpan[ridx] > 0) {
                    const c = wsRow.getCell(col)
                    c.value = row.moduleName !== '-' ? row.moduleName : '—'
                    style(c, 'DBEAFE', '1E3A8A', true, 'center', true, 'medium')
                    if (mSpan[ridx] > 1) ws.mergeCells(exRow, col, exRow + physicalSpan(ridx, mSpan[ridx]) - 1, col)
                }
                col++
            }
            if (hasSubModule) {
                if (smSpan[ridx] > 0) {
                    const c = wsRow.getCell(col)
                    c.value = row.subModuleName !== '-' ? row.subModuleName : '—'
                    style(c, 'E0F2FE', '0C4A6E', false, 'center', true)
                    if (smSpan[ridx] > 1) ws.mergeCells(exRow, col, exRow + physicalSpan(ridx, smSpan[ridx]) - 1, col)
                }
                col++
            }
            if (hasTopic) {
                if (tSpan[ridx] > 0) {
                    const c = wsRow.getCell(col)
                    c.value = row.topicName !== '-' ? row.topicName : '—'
                    style(c, 'F0FDF4', '14532D', false, 'center', true)
                    if (tSpan[ridx] > 1) ws.mergeCells(exRow, col, exRow + physicalSpan(ridx, tSpan[ridx]) - 1, col)
                }
                col++
            }
            if (hasSubTopic) {
                const c = wsRow.getCell(col)
                c.value = row.subtopicName !== '-' ? row.subtopicName : '—'
                style(c, rowBg, '374151', false, 'center', true)
                col++
            }

            // Activity cells (iDo / weDo)
            ;(['iDo', 'weDo'] as const).forEach(type => {
                const acts = activityTypes[type] as string[]
                const show = type === 'iDo' ? showIDo : showWeDo
                if (!show || !acts.length) return
                const isCollapsed = type === 'iDo' ? collapseIDo : collapseWeDo
                const bg  = type === 'iDo' ? 'EEF2FF' : 'F5F3FF'
                const clr = type === 'iDo' ? '3730A3' : '5B21B6'

                if (isCollapsed) {
                    let span = 1, isStart = true, anyMerged = false
                    acts.forEach(a => {
                        const mi = isCellMerged(ridx, type, a, pedagogyViews as any[], tableRows)
                        if (mi.isMerged) { anyMerged = true; span = Math.max(span, mi.rowSpan); if (!mi.isStart) isStart = false }
                    })
                    const c = wsRow.getCell(col)
                    if (anyMerged && !isStart) {
                        style(c, rowBg, 'D1D5DB', false, 'center'); col++
                    } else {
                        let total = 0
                        for (let r = ridx; r < ridx + span && r < tableRows.length; r++) {
                            acts.forEach(a => {
                                const mi = isCellMerged(r, type, a, pedagogyViews as any[], tableRows)
                                if (mi.isMerged) { if (mi.isStart) total += mi.value } else total += getSingleHour(tableRows[r], type, a)
                            })
                        }
                        c.value = total || null
                        style(c, total > 0 ? bg : rowBg, total > 0 ? clr : 'D1D5DB', total > 0, 'center')
                        if (anyMerged && span > 1) ws.mergeCells(exRow, col, exRow + physicalSpan(ridx, span) - 1, col)
                        col++
                    }
                } else {
                    acts.forEach(activity => {
                        const mi = isCellMerged(ridx, type, activity, pedagogyViews as any[], tableRows)
                        const c = wsRow.getCell(col)
                        if (mi.isMerged) {
                            if (mi.isStart) {
                                c.value = mi.value
                                style(c, bg, clr, true, 'center')
                                if (mi.rowSpan > 1) ws.mergeCells(exRow, col, exRow + physicalSpan(ridx, mi.rowSpan) - 1, col)
                            }
                        } else {
                            const v = getSingleHour(row, type, activity)
                            c.value = v || null
                            style(c, v > 0 ? bg : rowBg, v > 0 ? clr : 'D1D5DB', v > 0, 'center')
                        }
                        col++
                    })
                }
            })

            // Total Hours / Start Date / End Date
            let dGrpSpan = 1, dGrpIsStart = true, dGrpAnyMerged = false
            ;(['iDo', 'weDo'] as const).forEach(type => {
                ;(activityTypes[type] as string[]).forEach(a => {
                    const mi = isCellMerged(ridx, type, a, pedagogyViews as any[], tableRows)
                    if (mi.isMerged) { dGrpAnyMerged = true; dGrpSpan = Math.max(dGrpSpan, mi.rowSpan); if (!mi.isStart) dGrpIsStart = false }
                })
            })
            if (!(dGrpAnyMerged && !dGrpIsStart)) {
                const dates    = getGroupDates(rowDateMap, ridx, dGrpAnyMerged ? dGrpSpan : 1)
                let groupTotal = 0
                for (let r = ridx; r < ridx + dGrpSpan && r < tableRows.length; r++) {
                    ;(['iDo', 'weDo'] as const).forEach(type => {
                        ;(activityTypes[type] as string[]).forEach(a => {
                            const mi = isCellMerged(r, type, a, pedagogyViews as any[], tableRows)
                            if (mi.isMerged) { if (mi.isStart) groupTotal += mi.value } else groupTotal += getSingleHour(tableRows[r], type, a)
                        })
                    })
                }
                const thc = wsRow.getCell(thCol)
                thc.value = groupTotal || null
                style(thc, groupTotal > 0 ? 'FEF3C7' : rowBg, groupTotal > 0 ? '92400E' : 'D1D5DB', groupTotal > 0, 'center')

                const sc = wsRow.getCell(sdCol)
                sc.value = dates.start ? fmtDateLong(dates.start) : ''
                style(sc, dates.start ? 'F0FDF4' : rowBg, dates.start ? '15803D' : 'D1D5DB', !!dates.start, 'center')

                const ec = wsRow.getCell(edCol)
                ec.value = dates.end ? fmtDateLong(dates.end) : ''
                style(ec, dates.end ? 'F5F3FF' : rowBg, dates.end ? '6D28D9' : 'D1D5DB', !!dates.end, 'center')

                if (dGrpAnyMerged && dGrpSpan > 1) {
                    const endR = exRow + physicalSpan(ridx, dGrpSpan) - 1
                    ws.mergeCells(exRow, thCol, endR, thCol)
                    ws.mergeCells(exRow, sdCol, endR, sdCol)
                    ws.mergeCells(exRow, edCol, endR, edCol)
                }
            }
            exRow++

            // Assessment banner
            const asmt = asmtByLastRow[ridx]
            if (asmt) {
                const bRow = ws.getRow(exRow); bRow.height = 32
                let bcol = 1
                if (hasModule)    { if (!groupContinuesAfter(mSpan,  ridx)) style(bRow.getCell(bcol), 'DBEAFE', '1E3A8A', false, 'center'); bcol++ }
                if (hasSubModule) { if (!groupContinuesAfter(smSpan, ridx)) style(bRow.getCell(bcol), 'E0F2FE', '0C4A6E', false, 'center'); bcol++ }
                const bc = bRow.getCell(bcol)
                const datePart = (asmt.start && asmt.end) ? `   |   Start: ${fmtDateLong(asmt.start)}   →   End: ${fmtDateLong(asmt.end)}` : ''
                bc.value = `★  ASSESSMENT   ${asmt.total} hrs${datePart}`
                style(bc, 'ECFDF5', '065F46', true, 'center', false, 'medium', 12)
                ws.mergeCells(exRow, bcol, exRow, numCols)
                exRow++
            }
        })

        // ── Total row ──
        const totalRowNum = exRow
        const tRow = ws.getRow(totalRowNum); tRow.height = 34
        if (hierCount > 0) {
            const c = tRow.getCell(1); c.value = 'TOTAL'
            style(c, 'FEF08A', '78350F', true, 'center', false, 'medium', 12)
            if (hierCount > 1) ws.mergeCells(totalRowNum, 1, totalRowNum, hierCount)
        }
        let tcol = hierCount + 1
        ;(['iDo', 'weDo'] as const).forEach(type => {
            const acts = activityTypes[type] as string[]
            const show = type === 'iDo' ? showIDo : showWeDo
            if (!show || !acts.length) return
            const isCol = type === 'iDo' ? collapseIDo : collapseWeDo
            if (isCol) {
                const t = acts.reduce((s, a) => s + (activityTotals[type]?.[a] || 0), 0)
                const c = tRow.getCell(tcol); c.value = t || null
                style(c, 'FEF08A', '78350F', true, 'center', false, 'medium', 12); tcol++
            } else {
                acts.forEach(a => {
                    const c = tRow.getCell(tcol); c.value = activityTotals[type]?.[a] || null
                    style(c, 'FEF08A', '78350F', true, 'center', false, 'medium', 12); tcol++
                })
            }
        })
        const stc = tRow.getCell(thCol)
        stc.value = `${totalContentHours}h`
        style(stc, 'FEF08A', '78350F', true, 'center', false, 'medium', 12)
        ws.mergeCells(totalRowNum, thCol, totalRowNum, edCol)

        // ── Download ──
        const buf = await wb.xlsx.writeBuffer()
        const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = `${course?.courseCode || 'program'}_calendar.xlsx`; a.click()
        URL.revokeObjectURL(url)
    }

    // ── Generated summary ──
    const summary = useMemo(() => {
        if (!generated || !generated.length) return null
        const dates = generated.map(r => r.date.getTime())
        const distinctDays = new Set(generated.map(r => isoDate(r.date)))
        const distinctSessions = new Set(generated.map(r => `${isoDate(r.date)}-${r.startMins}-${r.slotName}`))
        const minDate = new Date(Math.min(...dates)), maxDate = new Date(Math.max(...dates))
        const learningHours = generated.reduce((a,r)=>a+r.hours,0)
        // count holidays (including auto-Sundays) that fall within range
        const holidaysInRange = displayHolidays.filter(h => { const t = new Date(h.date+'T00:00:00').getTime(); return t>=minDate.getTime() && t<=maxDate.getTime() })
        return { startDate: minDate, endDate: maxDate, totalWorkingDays: distinctDays.size, totalSessions: distinctSessions.size, totalHolidays: holidaysInRange.length, learningHours: Math.round(learningHours*10)/10 }
    }, [generated, displayHolidays])

    // Group generated rows by date for calendar grid views
    const scheduleByDate = useMemo(() => {
        if (!generated) return {} as Record<string, GenRow[]>
        const m: Record<string, GenRow[]> = {}
        generated.forEach(r => { const k = isoDate(r.date); if (!m[k]) m[k] = []; m[k].push(r) })
        return m
    }, [generated])

    const dayGenRows = scheduleByDate

    // Skeleton mirroring the page chrome (breadcrumb, tab strip, config card)
    // rather than a lone spinner.
    if (isCoursesLoading) return (
        <Shell embedded={embedded}>
            <div className="min-h-screen px-6 py-5 md:px-8 space-y-4">
                <div className="h-3.5 w-80 animate-pulse rounded-md bg-ink-100" />
                <div className="flex gap-4 border-b border-hairline pb-2">
                    <div className="h-4 w-28 animate-pulse rounded-md bg-ink-100" />
                    <div className="h-4 w-32 animate-pulse rounded-md bg-ink-100" />
                </div>
                <div className="rounded-xl border border-hairline bg-surface p-5 shadow-xs space-y-3">
                    <div className="h-4 w-48 animate-pulse rounded-md bg-ink-100" />
                    <div className="h-10 w-full animate-pulse rounded-md bg-ink-100" />
                    <div className="h-10 w-full animate-pulse rounded-md bg-ink-100" />
                    <div className="h-10 w-2/3 animate-pulse rounded-md bg-ink-100" />
                </div>
            </div>
        </Shell>
    )

    const hierarchy = course?.courseHierarchy || []
    const hasModule = hierarchy.includes('Module'), hasSubModule = hierarchy.includes('Sub Module'), hasTopic = hierarchy.includes('Topic'), hasSubTopic = hierarchy.includes('Sub Topic')

    return (
        <Shell embedded={embedded}>
            <style>{`@keyframes savePulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.07)} }`}</style>
            <div className="min-h-screen">
                <div className="max-w-full mx-auto px-6 py-5 md:px-8 space-y-4">

                    {/* ── Breadcrumb ── */}
                    <div className="flex items-center gap-3">
                        <button onClick={() => router.back()} className="h-8 w-8 rounded-control flex items-center justify-center hover:bg-row-hover transition-colors shrink-0">
                            <ArrowLeft className="h-4 w-4 text-subtle"/>
                        </button>
                        <Breadcrumb>
                            <BreadcrumbList>
                                <BreadcrumbItem><BreadcrumbLink href="/lms/pages/coursestructure" className="text-xs text-subtle hover:text-heading">Courses</BreadcrumbLink></BreadcrumbItem>
                                <BreadcrumbSeparator/>
                                <BreadcrumbItem><BreadcrumbPage className="text-xs font-semibold text-heading">{course?.courseName || '...'}</BreadcrumbPage></BreadcrumbItem>
                                <BreadcrumbSeparator/>
                                <BreadcrumbItem><BreadcrumbPage className="text-xs text-subtle font-mono">{course?.courseCode}</BreadcrumbPage></BreadcrumbItem>
                                <BreadcrumbSeparator/>
                                <BreadcrumbItem><BreadcrumbPage className="text-xs font-medium text-brand-strong">Program Calendar</BreadcrumbPage></BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb>
                    </div>

                    {/* ── Tabs + header save button ── */}
                    <div className="flex items-center justify-between border-b border-hairline">
                        <div className="flex gap-5">
                            <button onClick={() => setActiveTab('session')}
                                className={`relative px-1 py-2 text-sm font-semibold transition-colors flex items-center gap-1.5 ${activeTab==='session'?'text-heading':'text-subtle hover:text-heading'}`}>
                                <Clock className="h-3.5 w-3.5"/> Session Details
                                {startDate && <span className="h-1.5 w-1.5 rounded-full bg-success-500"/>}
                                {activeTab==='session' && <motion.span layoutId="tab-underline" transition={{duration:0.2,ease:[0.2,0,0,1]}} className="absolute left-0 right-0 -bottom-px h-[2px] rounded-full bg-brand-500"/>}
                            </button>
                            <button onClick={() => setActiveTab('calendar')}
                                className={`relative px-1 py-2 text-sm font-semibold transition-colors flex items-center gap-1.5 ${activeTab==='calendar'?'text-heading':'text-subtle hover:text-heading'}`}>
                                <CalendarDays className="h-3.5 w-3.5"/> Program Calendar
                                {activeTab==='calendar' && <motion.span layoutId="tab-underline" transition={{duration:0.2,ease:[0.2,0,0,1]}} className="absolute left-0 right-0 -bottom-px h-[2px] rounded-full bg-brand-500"/>}
                            </button>
                        </div>
                        {/* Reset button — only show when there is saved data */}
                        {(savedCalendar as any)?._id && (
                            <button onClick={()=>setResetConfirm(true)}
                                className="mb-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-danger-500/30 bg-danger-50 hover:bg-danger-50 text-danger-700 text-[12px] font-semibold active:scale-95 transition-all">
                                <RotateCcw className="h-3.5 w-3.5"/> Reset Calendar
                            </button>
                        )}
                    </div>

                    <AnimatePresence mode="wait">
                    {/* ════════════ TAB 1: SESSION DETAILS ════════════ */}
                    {activeTab === 'session' && (
                        <motion.div key="session-tab" initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }} transition={{duration:0.2}} className="space-y-4">

                            {/* ── First-time walkthrough banner ── */}
                            {dataLoaded && !startDate && (
                                <div className="bg-brand-wash border border-brand-200 rounded-2xl p-5">
                                    <div className="flex items-start gap-3 mb-4">
                                        <span className="h-8 w-8 rounded-xl bg-brand-700 flex items-center justify-center shrink-0 mt-0.5">
                                            <Sparkles className="h-4 w-4 text-white"/>
                                        </span>
                                        <div className="flex-1">
                                            <p className="text-[14px] font-bold text-brand-800">Welcome — let's set up your Program Calendar</p>
                                            <p className="text-[12px] text-brand-700 mt-0.5">Follow these steps to generate the full training schedule for this course.</p>
                                        </div>
                                        <button onClick={()=>{ setActiveTab('session'); setTourStep(1) }}
                                            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-700 hover:bg-brand-800 text-white text-[12px] font-semibold shadow-sm active:scale-95 transition-all">
                                            <MousePointerClick className="h-3.5 w-3.5"/> Start Guided Tour
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        {[
                                            { step: '1', icon: '🕐', title: 'Add Sessions', desc: 'Define your daily schedule here — add sessions and tea breaks with their timings.', color: 'bg-white border-brand-200' },
                                            { step: '2', icon: '📅', title: 'Set a Start Date', desc: 'Open the Program Calendar tab and pick your start date — that is the only thing left.', color: 'bg-white border-brand-200' },
                                            { step: '3', icon: '🗓️', title: 'Auto-scheduled', desc: 'The calendar builds itself, skipping this client\'s holidays automatically. No manual holiday entry.', color: 'bg-white border-brand-200' },
                                        ].map(({ step, icon, title, desc, color }) => (
                                            <div key={step} className={`flex items-start gap-3 rounded-xl border ${color} px-4 py-3 shadow-sm`}>
                                                <div className="h-6 w-6 rounded-full bg-brand-700 text-white text-[11px] font-extrabold flex items-center justify-center shrink-0 mt-0.5">{step}</div>
                                                <div>
                                                    <p className="text-[12px] font-bold text-ink-800">{icon} {title}</p>
                                                    <p className="text-[11px] text-ink-500 mt-0.5 leading-relaxed">{desc}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* ── Session-only header ──
                                Start/End/Working Days/Total Holidays moved to the
                                Program Calendar tab where the schedule actually lives.
                                Session Details keeps only session facts + actions. */}
                            <div className="bg-white border border-ink-200 rounded-xl shadow-sm px-4 py-2.5 flex items-center gap-3 flex-wrap">
                                {/* Total Work Hours — session-scoped by definition */}
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="h-7 w-7 rounded-lg bg-warn-50 flex items-center justify-center shrink-0 text-[13px]">⏱️</span>
                                    <div>
                                        <p className="text-[9px] font-semibold text-ink-400 uppercase tracking-wide leading-none">Total Work Hours</p>
                                        <p className="text-[12px] font-bold text-warn-700 leading-tight mt-0.5">
                                            {totalContentHours > 0 ? `${Math.round(totalContentHours * 10) / 10}h` : '—'}
                                        </p>
                                    </div>
                                </div>

                                {/* Buttons pushed to right */}
                                <div className="ml-auto flex items-center gap-2 shrink-0">
                                    <button onClick={()=>setShowTimetableModal(true)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-50 border border-brand-100 text-brand-700 text-[12px] font-semibold hover:bg-brand-100 active:scale-95 transition-all">
                                        <CalendarDays className="h-3.5 w-3.5"/> Timetable Preview
                                    </button>
                                    <Button onClick={handleSaveSession} disabled={!courseId || isSaving}
                                        style={sessionDirty ? { animation: 'savePulse 1.4s ease-in-out infinite' } : {}}
                                        className={`h-8 px-4 text-[12px] font-semibold text-white gap-1.5 rounded-lg shadow-sm disabled:opacity-50 ${sessionDirty ? 'bg-brand-600 hover:bg-brand-700' : 'bg-brand-700 hover:bg-brand-800'}`}>
                                        {isSaving ? <><div className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin"/> Saving…</> : sessionDirty ? 'Save Updated Sessions' : 'Save Sessions'}
                                    </Button>
                                </div>
                            </div>

                                                            {/* Session / Break Builder */}
                                <Card className="border border-ink-200 shadow-sm">
                                    <div className="flex items-center justify-between px-3 py-1 border-b border-ink-100 bg-ink-50/60">
                                        <span className="flex items-center gap-1.5 text-[11px] font-bold text-ink-700"><Clock className="h-3 w-3 text-brand-500"/> Daily Session Template</span>
                                        <span className="text-[10px] font-semibold text-brand-700 bg-brand-50 border border-brand-100 rounded px-1.5 py-0.5">{Math.floor(teachingMins/60)}h {teachingMins%60>0?teachingMins%60+'m':''} / day</span>
                                    </div>
                                    <CardContent className="pt-0 pb-2 px-0">
                                        <table className="w-full text-xs border-collapse">
                                            <thead>
                                                <tr className="border-b border-ink-200 bg-ink-50">
                                                    <th className="px-2 py-1.5 text-center text-[10px] font-semibold text-ink-500 w-8">#</th>
                                                    <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-ink-500">Session</th>
                                                    <th className="px-2 py-1.5 text-center text-[10px] font-semibold text-ink-500">Start</th>
                                                    <th className="px-2 py-1.5 text-center text-[10px] font-semibold text-ink-500">End</th>
                                                    <th className="px-2 py-1.5 text-center text-[10px] font-semibold text-ink-500">Duration</th>
                                                    <th className="w-6"/>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-ink-100">
                                                {daySlots.length === 0 && (
                                                    <tr>
                                                        <td colSpan={6} className="py-8">
                                                            <div className="flex flex-col items-center text-center">
                                                                <span className="h-10 w-10 rounded-xl bg-brand-50 flex items-center justify-center mb-2">
                                                                    <Clock className="h-5 w-5 text-brand-400"/>
                                                                </span>
                                                                <p className="text-[12px] font-semibold text-ink-500">No sessions added yet</p>
                                                                <p className="text-[11px] text-ink-400 mt-0.5">Use the buttons below to add your first session or tea break.</p>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                                <AnimatePresence initial={false}>
                                                {daySlots.map(slot => {
                                                    const dur = durationMins(slot.startTime, slot.endTime)
                                                    const isSession = slot.kind === 'session'
                                                    const sessIdx = daySlots.filter(s=>s.kind==='session').findIndex(s=>s.id===slot.id)
                                                    const durLabel = dur>0 ? `${Math.floor(dur/60)>0?Math.floor(dur/60)+'h ':''}${dur%60>0?dur%60+'m':''}`.trim() : '—'
                                                    return (
                                                        <motion.tr key={slot.id} layout initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.15}} className={`${isSession?'bg-white':'bg-warn-50/50'} hover:bg-ink-50 transition-colors`}>
                                                            <td className="px-2 py-1 text-center">
                                                                {isSession
                                                                    ? <span className="h-5 w-5 rounded-full bg-brand-600 text-white text-[10px] font-bold inline-flex items-center justify-center">{sessIdx+1}</span>
                                                                    : <Coffee className="h-3.5 w-3.5 text-warn-500 mx-auto"/>}
                                                            </td>
                                                            <td className="px-2 py-1">
                                                                <Input value={slot.name} onChange={e=>updateSlot(slot.id,{name:e.target.value})}
                                                                    placeholder={isSession?'Session name':'Break name'}
                                                                    className={`h-7 text-xs border border-ink-200 font-medium ${isSession?'text-ink-800':'text-warn-700'}`}/>
                                                            </td>
                                                            <td className="px-2 py-1 text-center">
                                                                <TimeInput12 value={slot.startTime} onChange={v=>updateSlot(slot.id,{startTime:v})}/>
                                                            </td>
                                                            <td className="px-2 py-1 text-center">
                                                                <TimeInput12 value={slot.endTime} onChange={v=>updateSlot(slot.id,{endTime:v})}/>
                                                                {dur<=0 && <div className="text-[10px] text-danger-500 mt-0.5">End after start</div>}
                                                            </td>
                                                            <td className="px-2 py-1 text-center">
                                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isSession?'bg-brand-100 text-brand-700':'bg-warn-50 text-warn-700'}`}>{durLabel}</span>
                                                            </td>
                                                            <td className="px-2 py-1 text-center">
                                                                <button onClick={()=>setDeleteSlotId(slot.id)} title="Delete" className="h-7 w-7 rounded-lg flex items-center justify-center bg-danger-50 hover:bg-danger-50 border border-danger-500/30 active:scale-90 transition-all mx-auto"><X className="h-4 w-4 text-danger-500"/></button>
                                                            </td>
                                                        </motion.tr>
                                                    )
                                                })}
                                                </AnimatePresence>
                                            </tbody>
                                            <tfoot>
                                                <tr className="border-t border-ink-200 bg-ink-50">
                                                    <td colSpan={4} className="px-2 py-1 text-right text-[10px] font-semibold text-ink-500">Teaching Total</td>
                                                    <td className="px-2 py-1 text-center">
                                                        <span className="text-[10px] font-bold text-brand-700 bg-brand-100 px-1.5 py-0.5 rounded">{Math.floor(teachingMins/60)}h {teachingMins%60>0?teachingMins%60+'m':''}</span>
                                                    </td>
                                                    <td/>
                                                </tr>
                                            </tfoot>
                                        </table>
                                        <div className="flex gap-2 px-3 pt-3 pb-1">
                                            <button ref={tourSessionRef} onClick={()=>addSlot('session')} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-brand-700 hover:bg-brand-800 active:scale-95 text-white text-xs font-semibold shadow-sm shadow-brand-200 transition-all">
                                                <Plus className="h-3.5 w-3.5 shrink-0"/> Add Session
                                            </button>
                                            <button onClick={()=>addSlot('break')} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-warn-500 hover:bg-warn-700 active:scale-95 text-white text-xs font-semibold shadow-sm shadow-warn-500/30 transition-all">
                                                <Coffee className="h-3.5 w-3.5 shrink-0"/> Add Tea Break
                                            </button>
                                            {daySlots.length > 0 && (
                                                <button onClick={()=>setClearSessionsConfirm(true)} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-danger-50 hover:bg-danger-50 border border-danger-500/30 active:scale-95 text-danger-700 text-xs font-semibold transition-all">
                                                    <X className="h-3.5 w-3.5 shrink-0"/> Clear All
                                                </button>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>

                        </motion.div>
                    )}


                    {/* ════════════ TAB 2: PROGRAM CALENDAR ════════════ */}
                    {activeTab === 'calendar' && (
                        <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} className="space-y-4">

                            {/* ── Start date — the one control that builds the calendar ──
                                Entering it fires the auto-generate effect, which schedules
                                the sessions around this course's client holidays. Lives HERE,
                                not in Session Details, so the flow reads: build the template,
                                come here, pick a date, watch it fill in. */}
                            {/* flex-nowrap + overflow-x-auto keep the whole start-date
                                strip on ONE row: label · date · Save · → ends · working
                                days · holidays · lock chip all live in a single line.
                                Very narrow viewports scroll horizontally instead of
                                wrapping onto multiple rows.
                                Background and border stripped — the strip now reads as
                                inline text, not a highlighted card. */}
                            <div ref={tourStartRef} className="px-1 py-2 flex items-center gap-2 flex-nowrap overflow-x-auto">
                                <span className="h-9 w-9 rounded-lg bg-brand-700 flex items-center justify-center shrink-0">
                                    <CalendarDays className="h-4.5 w-4.5 text-white"/>
                                </span>
                                <p className="text-[12px] font-bold text-brand-800 leading-none whitespace-nowrap">Program start date</p>
                                {/* Lock message shared by the disabled input, the
                                    icon beside it, and the aria-label — one string,
                                    three surfaces, so hovering the date input or the
                                    lock badge both surface the reason. */}
                                {(() => {
                                    const lockMsg = evidenceLock
                                        ? (hasAttendance
                                            ? 'Program calendar locked due to attendance marked'
                                            : `Locked — ${deviations.length} deviation${deviations.length > 1 ? 's' : ''} recorded`)
                                        : undefined
                                    return (
                                        <>
                                            <Input type="date" value={startDate} disabled={!startDateEditable}
                                                onChange={e=>{ setStartDate(e.target.value); setStartDateDirty(true) }}
                                                title={lockMsg}
                                                className={`h-9 text-[13px] font-bold text-brand-700 w-44 border border-brand-200 bg-white ${!startDateEditable ? 'opacity-60 cursor-not-allowed' : ''}`}/>
                                            {evidenceLock && (
                                                <span
                                                    title={lockMsg}
                                                    aria-label={lockMsg}
                                                    className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-danger-50 border border-danger-500/30 text-danger-700 cursor-help"
                                                >
                                                    🔒
                                                </span>
                                            )}
                                        </>
                                    )
                                })()}
                                {/* Save lives WHERE the date is chosen. Once the
                                    lock derives from evidence, both the input and
                                    this button give way to the reason pill. */}
                                {startDateEditable && (
                                    <Button onClick={handleSaveStartDate}
                                        disabled={!courseId || !startDate || !startDateDirty || isSaving}
                                        className="h-9 px-3.5 bg-brand-700 hover:bg-brand-800 text-white text-[12px] font-semibold disabled:opacity-50">
                                        {isSaving ? 'Saving…' : startDateDirty ? 'Save' : 'Saved'}
                                    </Button>
                                )}
                                {/* The computed end and its supporting counts sit
                                    beside the chosen start as PLAIN TEXT — they are
                                    statements, not controls, so no boxes competing
                                    with the input and Save. */}
                                {(() => {
                                    const endObj = summary?.endDate instanceof Date ? summary.endDate
                                        : (estimatedEndDate instanceof Date ? estimatedEndDate : null)
                                    const workDays = estimatedDays ?? 0
                                    const totalHols = displayHolidays.length
                                    if (!endObj) {
                                        return startDate ? (
                                            <span className="text-[11px] font-medium text-ink-400">End date appears once sessions and course hours exist</span>
                                        ) : null
                                    }
                                    return (
                                        <span className="flex items-baseline gap-2 flex-nowrap whitespace-nowrap"
                                            title="Computed: start + course hours over working days, minus holidays">
                                            <span className="text-[13px] font-bold text-brand-700">
                                                <span className="text-brand-400 font-normal">ends at </span>{fmtDateLong(endObj)}
                                            </span>
                                            <span className="text-[11px] font-medium text-ink-400">
                                                · <button
                                                    type="button"
                                                    onClick={() => setShowWorkingDaysModal(true)}
                                                    className="text-info-700 font-semibold underline underline-offset-2 decoration-info-500/40 hover:decoration-info-700 hover:text-info-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info-500/30 rounded-sm"
                                                >
                                                    {workDays} working day{workDays === 1 ? '' : 's'}
                                                </button> · <button
                                                    type="button"
                                                    onClick={() => setShowHolidaysModal(true)}
                                                    className="text-info-700 font-semibold underline underline-offset-2 decoration-info-500/40 hover:decoration-info-700 hover:text-info-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info-500/30 rounded-sm"
                                                >
                                                    {totalHols} holiday{totalHols === 1 ? '' : 's'}
                                                </button>
                                            </span>
                                        </span>
                                    )
                                })()}
                                {/* Lock chip moved up next to the date input so the
                                    reason is right beside the control it disables. */}
                                {!evidenceLock && startPassed && (
                                    <span className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[11px] font-semibold border ${
                                        isAdmin
                                            ? 'bg-warn-50 border-warn-500/30 text-warn-700'
                                            : 'bg-ink-100 border-ink-200 text-ink-500'
                                    }`}>
                                        {isAdmin
                                            ? `Started ${savedStartDate} — admin correction only`
                                            : `Locked — course started ${savedStartDate}`}
                                    </span>
                                )}
                                {/* Happy-path holiday count lives in the stats
                                    tile below — only the failure state needs to
                                    interrupt this row. */}
                                {!holidayScopeId && (
                                    <span className="text-[11px] font-medium text-warn-700">Institution not resolved — holidays not applied yet</span>
                                )}
                            </div>

                            {/* View controls only — every fact (start, end, counts)
                                lives in the header line above. One fact, one place;
                                this row spends its space on actions alone. */}
                            {(() => {
                                return (
                                    <div className="flex items-center justify-end gap-2 flex-wrap">
                                        <div className="flex items-center gap-2 shrink-0">
                                            {/* Calendar mode selector */}
                                            <select value={calendarMode} onChange={e=>setCalendarMode(e.target.value as any)}
                                                className="h-8 text-[11px] font-semibold border border-ink-200 rounded-lg px-2 bg-white text-ink-700 focus:outline-none focus:ring-1 focus:ring-brand-400 cursor-pointer">
                                                <option value="planned">Planned Calendar</option>
                                                <option value="actual">Actual Calendar</option>
                                                <option value="comparison">Planned vs Actual</option>
                                            </select>
                                            {/* Batch selector — Actual and Comparison modes. Planned
                                                dates are shared by every batch, but Actual dates are
                                                batch-specific, so whenever the course HAS real batches
                                                a specific batch must be chosen (defaulted to the first
                                                by the keep-valid effect). A batchless course renders
                                                the actual calendar directly — no selector. Switching
                                                reflows actualGenerated with THIS batch's scoped
                                                deviations. */}
                                            {calendarMode !== 'planned' && realBatches.length > 0 && (
                                                <select
                                                    value={realBatches.some(b => b._id === selectedActualBatch) ? selectedActualBatch : realBatches[0]._id}
                                                    onChange={e => setSelectedActualBatch(e.target.value)}
                                                    title="Which batch's actual calendar to display"
                                                    className="h-8 text-[11px] font-semibold border border-ink-200 rounded-lg px-2 bg-white text-ink-700 focus:outline-none focus:ring-1 focus:ring-brand-400 cursor-pointer"
                                                >
                                                    {realBatches.map(b => (
                                                        <option key={b._id} value={b._id}>{b.batchName}</option>
                                                    ))}
                                                </select>
                                            )}
                                            {/* View toggle (only for planned/actual) */}
                                            {calendarMode !== 'comparison' && generated && generated.length > 0 && (
                                                <div className="flex items-center bg-ink-100 rounded-lg p-0.5 gap-0.5">
                                                    {([
                                                        { v: 'table'    as const, icon: <LayoutList className="h-3.5 w-3.5"/>,    label: 'Table'    },
                                                        { v: 'calendar' as const, icon: <CalendarDays className="h-3.5 w-3.5"/>, label: 'Calendar' },
                                                    ]).map(({v, icon, label}) => (
                                                        <button key={v} onClick={()=>setScheduleView(v)}
                                                            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${scheduleView===v ? 'bg-white text-ink-800 shadow-sm' : 'text-ink-500 hover:text-ink-700'}`}>
                                                            {icon} {label}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                            {generated && generated.length > 0 && (
                                                <button onClick={exportToExcel} className="flex items-center gap-1.5 text-xs font-semibold bg-ink-700 hover:bg-ink-800 active:scale-95 text-white rounded-lg px-3 py-1.5 transition-all">
                                                    <FileDown className="h-3.5 w-3.5"/> Export Excel
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )
                            })()}

                            {/* No calendar placeholder */}
                            {!generated && (
                                <div className="rounded-xl border border-dashed border-brand-300 bg-brand-50 px-6 py-10 text-center space-y-3">
                                    <div className="h-12 w-12 rounded-full bg-brand-100 flex items-center justify-center mx-auto"><CalendarDays className="h-6 w-6 text-brand-500"/></div>
                                    <p className="text-sm font-semibold text-ink-700">No calendar generated yet</p>
                                    <p className="text-xs text-ink-400">Pick a start date above — the calendar builds itself once your sessions are set. Add sessions in <button className="underline text-brand-600 font-medium" onClick={()=>setActiveTab('session')}>Session Details</button> if you haven&apos;t yet.</p>
                                </div>
                            )}
                            {generated && generated.length === 0 && (
                                <div className="rounded-xl border border-dashed border-danger-500/30 bg-danger-50/30 px-6 py-8 text-center">
                                    <p className="text-sm text-danger-700">Could not generate — check sessions, start date, and course hours are configured.</p>
                                </div>
                            )}



                            {/* ── Program Calendar Table (Planned + Actual share the same layout) ── */}
                            {(calendarMode === 'planned' || calendarMode === 'actual') && generated && generated.length>0 && scheduleView==='table' && (() => {
                            const isActual = calendarMode === 'actual'
                            const useGenerated = isActual ? actualGenerated : generated
                            const useDateMap = isActual ? actualRowDateMap : rowDateMap
                            const useDayHoursMap = isActual ? actualDayHoursMap : dayHoursMap
                            const useYouDoDateMap = isActual ? actualYouDoDateMap : youDoDateMap
                            const useYouDoDayHoursMap = isActual ? actualYouDoDayHoursMap : youDoDayHoursMap
                            if (isActual && (!actualGenerated || actualGenerated.length === 0)) return null
                            return (
                                <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{duration:0.2}}
                                    className={tableFullscreen
                                        ? 'fixed inset-0 z-modal bg-white flex flex-col'
                                        : 'overflow-auto max-h-[75vh] rounded-xl border border-ink-300 shadow-md'}>
                                    {tableFullscreen && (
                                        <div className="flex items-center justify-between px-4 py-2 bg-ink-800 shrink-0">
                                            <span className="text-[13px] font-bold text-white tracking-wide">Program Calendar — Full Screen</span>
                                            <button onClick={()=>setTableFullscreen(false)}
                                                className="flex items-center gap-1.5 text-[11px] font-semibold text-white bg-white/20 hover:bg-white/30 border border-white/30 rounded-lg px-3 py-1.5 transition-all">
                                                <Minimize2 className="h-3.5 w-3.5"/> Exit Full Screen
                                            </button>
                                        </div>
                                    )}
                                    <div className={tableFullscreen ? 'overflow-auto flex-1' : ''}>
                                    <table className="w-full text-[11px] border-collapse">
                                        <thead className="sticky top-0 z-20">
                                            {/* Row 1: group headers */}
                                            <tr>
                                                {hasModule    && <th rowSpan={2} style={{background:'#1E293B',color:'white'}} className="border border-ink-700 px-2.5 py-1.5 text-center font-bold align-middle min-w-[120px]">Module</th>}
                                                {hasSubModule && <th rowSpan={2} style={{background:'#1E293B',color:'white'}} className="border border-ink-700 px-2.5 py-1.5 text-center font-bold align-middle min-w-[110px]">Sub Module</th>}
                                                {hasTopic     && <th rowSpan={2} style={{background:'#1E293B',color:'white'}} className="border border-ink-700 px-2.5 py-1.5 text-center font-bold align-middle min-w-[130px]">Topic</th>}
                                                {hasSubTopic  && <th rowSpan={2} style={{background:'#1E293B',color:'white'}} className="border border-ink-700 px-2.5 py-1.5 text-center font-bold align-middle min-w-[110px]">Sub Topic</th>}
                                                {!hideIDo && activityTypes.iDo.length>0 && (
                                                    collapseIDo
                                                        ? <th rowSpan={2} style={{background:'#4338CA',color:'white'}} className="border border-brand-900 px-2.5 py-1.5 text-center font-bold align-middle">I Do</th>
                                                        : <th colSpan={activityTypes.iDo.length} style={{background:'#4338CA',color:'white'}} className="border border-brand-900 px-2 py-1.5 text-center font-bold">I Do</th>
                                                )}
                                                {!hideWeDo && activityTypes.weDo.length>0 && (
                                                    collapseWeDo
                                                        ? <th rowSpan={2} style={{background:'#7C3AED',color:'white'}} className="border border-brand-900 px-2.5 py-1.5 text-center font-bold align-middle">We Do</th>
                                                        : <th colSpan={activityTypes.weDo.length} style={{background:'#7C3AED',color:'white'}} className="border border-brand-900 px-2 py-1.5 text-center font-bold">We Do</th>
                                                )}
                                                <th rowSpan={2} style={{background:'#B45309',color:'white'}} className="border border-warn-700 px-2.5 py-1.5 text-center font-bold align-middle whitespace-nowrap">Total Hours</th>
                                                {/* One date pair in both modes: the plan in Planned mode,
                                                    the viewed batch's dates in Actual mode (amber pills
                                                    mark drift from the plan). */}
                                                <th rowSpan={2} style={{background:'#15803D',color:'white'}} className="border border-success-700 px-2.5 py-1.5 text-center font-bold align-middle whitespace-nowrap">Start Date</th>
                                                <th rowSpan={2} style={{background:'#7E22CE',color:'white'}} className="border border-brand-900 px-2.5 py-1.5 text-center font-bold align-middle whitespace-nowrap">End Date</th>
                                                {isActual && <th rowSpan={2} style={{background:'#991B1B',color:'white'}} className="border border-danger-700 px-2.5 py-1.5 text-center font-bold align-middle whitespace-nowrap min-w-[120px]">Deviation</th>}
                                            </tr>
                                            {/* Row 2: activity sub-headers (only for expanded groups) */}
                                            <tr>
                                                {!hideIDo  && !collapseIDo  && activityTypes.iDo.map(a  => <th key={`i-${a}`} style={{background:'#E0E7FF',color:'#3730A3'}} className="border border-ink-900 px-2 py-1 text-center font-semibold text-[10px] whitespace-nowrap">{a}</th>)}
                                                {!hideWeDo && !collapseWeDo && activityTypes.weDo.map(a => <th key={`w-${a}`} style={{background:'#EDE9FE',color:'#5B21B6'}} className="border border-ink-900 px-2 py-1 text-center font-semibold text-[10px] whitespace-nowrap">{a}</th>)}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(() => {
                                                const { mSpan, smSpan, tSpan } = hierarchySpans
                                                const hierCols = [hasModule,hasSubModule,hasTopic,hasSubTopic].filter(Boolean).length
                                                const iDoCols  = (!hideIDo  && activityTypes.iDo.length>0)  ? (collapseIDo?1:activityTypes.iDo.length)  : 0
                                                const weDoCols = (!hideWeDo && activityTypes.weDo.length>0) ? (collapseWeDo?1:activityTypes.weDo.length) : 0
                                                // Planned: +3 = Total Hours, Start, End. Actual: +4 = those
                                                // three plus Deviation.
                                                const fullCols = hierCols + iDoCols + weDoCols + (isActual ? 4 : 3)

                                                // assessment banner keyed by its group's last row index
                                                const asmtByLastRow: Record<number, {total:number;start?:Date;end?:Date;dayHours:{date:Date;hours:number;startMins:number;endMins:number}[]}> = {}
                                                tableRows.forEach((_, i) => {
                                                    const yd = getYouDoCell(i)
                                                    if (!yd.skip && yd.total>0) {
                                                        // For actual calendar, override dates from actual youDo maps
                                                        let start = yd.start, end = yd.end, dayHours = yd.dayHours
                                                        if (isActual) {
                                                            let s: Date|undefined, e: Date|undefined
                                                            for (let r=i; r<i+yd.rowSpan && r<tableRows.length; r++) {
                                                                const d = useYouDoDateMap[tableRows[r].rowId]
                                                                if (d) { if (!s||d.start<s) s=new Date(d.start); if (!e||d.end>e) e=new Date(d.end) }
                                                            }
                                                            start = s; end = e
                                                            dayHours = getGroupDayHours(useYouDoDayHoursMap, i, yd.rowSpan)
                                                        }
                                                        asmtByLastRow[i + yd.rowSpan - 1] = { total: yd.total, start, end, dayHours }
                                                    }
                                                })

                                                // A rowSpan covers physical <tr> elements, but each Assessment banner
                                                // injects an EXTRA <tr> that isn't one of tableRows. Any rowSpan whose
                                                // logical range straddles a banner must grow by 1 per banner inside it,
                                                // otherwise it eats into the banner's row and every row after loses
                                                // alignment (the bug behind subsequent rows like h5 looking detached).
                                                const physicalSpan = (start: number, span: number) => {
                                                    if (span <= 1) return span
                                                    let extra = 0
                                                    for (let k = start; k < start + span - 1; k++) { if (asmtByLastRow[k]) extra++ }
                                                    return span + extra
                                                }

                                                // For a banner anchored at ridx, does the Module/Sub Module GROUP that
                                                // ridx belongs to have more rows after it? If yes, that hierarchy cell's
                                                // rowSpan already inflates (via physicalSpan) to cover the banner row, so
                                                // nothing needs rendering there. If no (the banner sits right at the
                                                // group's own boundary), the banner row needs an explicit blank cell in
                                                // that column so the table stays structurally aligned.
                                                const groupContinuesAfter = (spanArr: number[], ridx: number): boolean => {
                                                    let g = ridx
                                                    while (g >= 0 && !(spanArr[g] > 0)) g--
                                                    if (g < 0) return false
                                                    return ridx < g + spanArr[g] - 1
                                                }
                                                const hierColsBeforeTopic = (hasModule?1:0) + (hasSubModule?1:0)

                                                // Start/End Date pertain to the whole merged teaching block (the
                                                // schedule was built as ONE content item for the group), so the
                                                // date cells must merge across the same rows as the iDo/weDo cells.
                                                const getRowGroupSpan = (ridx: number): { span: number; isStart: boolean; anyMerged: boolean } => {
                                                    let span = 1, isStart = true, anyMerged = false
                                                    ;(['iDo','weDo'] as const).forEach(type => {
                                                        ;(activityTypes[type] as string[]).forEach(activity => {
                                                            const mi = isCellMerged(ridx, type, activity, pedagogyViews as any[], tableRows)
                                                            if (mi.isMerged) { anyMerged = true; span = Math.max(span, mi.rowSpan); if (!mi.isStart) isStart = false }
                                                        })
                                                    })
                                                    return { span, isStart, anyMerged }
                                                }

                                                const getGroupTotalHours = (ridx: number, span: number): number => {
                                                    let total = 0
                                                    for (let r = ridx; r < ridx + span && r < tableRows.length; r++) {
                                                        ;(['iDo','weDo'] as const).forEach(type => {
                                                            ;(activityTypes[type] as string[]).forEach(activity => {
                                                                const mi = isCellMerged(r, type, activity, pedagogyViews as any[], tableRows)
                                                                if (mi.isMerged) { if (mi.isStart) total += mi.value }
                                                                else total += getSingleHour(tableRows[r], type, activity)
                                                            })
                                                        })
                                                    }
                                                    return total
                                                }

                                                const renderActivityCells = (row: TableRowItem, ridx: number) =>
                                                    (['iDo','weDo'] as const).map(type => {
                                                        if (type==='iDo' && hideIDo)  return null
                                                        if (type==='weDo' && hideWeDo) return null
                                                        const isCollapsed = type==='iDo'?collapseIDo:collapseWeDo
                                                        const cellBg  = type==='iDo' ? '#EEF2FF' : '#F5F3FF'
                                                        const cellClr = type==='iDo' ? '#3730A3' : '#5B21B6'
                                                        const activities = activityTypes[type] as string[]
                                                        if (activities.length === 0) return null
                                                        if (isCollapsed) {
                                                            // If any activity is merged across rows, the whole collapsed
                                                            // cell must merge too — one cell spanning the group, showing
                                                            // the combined total instead of repeating/splitting per row.
                                                            let span = 1, isStart = true, anyMerged = false
                                                            activities.forEach(activity => {
                                                                const mi = isCellMerged(ridx, type, activity, pedagogyViews as any[], tableRows)
                                                                if (mi.isMerged) { anyMerged = true; span = Math.max(span, mi.rowSpan); if (!mi.isStart) isStart = false }
                                                            })
                                                            if (anyMerged && !isStart) return null
                                                            let total = 0
                                                            for (let r = ridx; r < ridx + span && r < tableRows.length; r++) {
                                                                activities.forEach(activity => {
                                                                    const mi = isCellMerged(r, type, activity, pedagogyViews as any[], tableRows)
                                                                    if (mi.isMerged) { if (mi.isStart) total += mi.value }
                                                                    else total += getSingleHour(tableRows[r], type, activity)
                                                                })
                                                            }
                                                            return <td key={type} rowSpan={anyMerged ? physicalSpan(ridx, span) : 1} style={total>0?{background:cellBg}:{}} className="border border-ink-900 px-2 py-1.5 text-center align-middle">{total>0 ? <span className="font-bold" style={{color:cellClr}}>{total}</span> : <span className="text-ink-200">—</span>}</td>
                                                        }
                                                        return activities.map(activity => {
                                                            const mi = isCellMerged(ridx, type, activity, pedagogyViews as any[], tableRows)
                                                            if (mi.isMerged && !mi.isStart) return null
                                                            const val = mi.isMerged ? mi.value : getSingleHour(row, type, activity)
                                                            return (
                                                                <td key={`${type}-${activity}`} rowSpan={mi.isMerged ? physicalSpan(ridx, mi.rowSpan) : 1} style={val>0?{background:cellBg}:{}} className="border border-ink-900 px-2 py-1.5 text-center align-middle">
                                                                    {val>0 ? <span className="font-bold" style={{color:cellClr}}>{val}</span> : <span className="text-ink-200">—</span>}
                                                                </td>
                                                            )
                                                        })
                                                    })

                                                return tableRows.map((row, ridx) => {
                                                    const stripe = ridx%2===0 ? '#ffffff' : '#FFF7ED'
                                                    const grp = getRowGroupSpan(ridx)
                                                    const dates = getGroupDates(useDateMap, ridx, grp.anyMerged ? grp.span : 1)
                                                    const plannedDates = isActual ? getGroupDates(rowDateMap, ridx, grp.anyMerged ? grp.span : 1) : dates
                                                    const groupDayHours = getGroupDayHours(useDayHoursMap, ridx, grp.anyMerged ? grp.span : 1)
                                                    const asmt = asmtByLastRow[ridx]
                                                    const dateRowSpan = grp.anyMerged ? physicalSpan(ridx, grp.span) : 1
                                                    const mainRow = (
                                                        <tr key={row.rowId} style={{background: stripe}} className="hover:brightness-95 transition-all">
                                                            {hasModule    && mSpan[ridx]>0  && <td rowSpan={physicalSpan(ridx, mSpan[ridx])}  style={{background:'#FFEDD5'}} className="border border-ink-900 px-2.5 py-1.5 font-bold text-info-700 text-center align-middle">{row.moduleName&&row.moduleName!=='-'?row.moduleName:'—'}</td>}
                                                            {hasSubModule && smSpan[ridx]>0 && <td rowSpan={physicalSpan(ridx, smSpan[ridx])} style={{background:'#F0F9FF'}} className="border border-ink-900 px-2.5 py-1.5 font-medium text-info-700 text-center align-middle">{row.subModuleName&&row.subModuleName!=='-'?row.subModuleName:'—'}</td>}
                                                            {hasTopic     && tSpan[ridx]>0  && <td rowSpan={physicalSpan(ridx, tSpan[ridx])}  style={{background:'#F8FAFC'}} className="border border-ink-900 px-2.5 py-1.5 font-medium text-ink-700 text-center align-middle">{row.topicName&&row.topicName!=='-'?row.topicName:'—'}</td>}
                                                            {hasSubTopic  && <td style={{background: stripe}} className="border border-ink-900 px-2.5 py-1.5 text-ink-600 text-center align-middle">{row.subtopicName&&row.subtopicName!=='-'?row.subtopicName:'—'}</td>}

                                                            {renderActivityCells(row, ridx)}

                                                            {!(grp.anyMerged && !grp.isStart) && (() => {
                                                                const groupTotal = getGroupTotalHours(ridx, grp.anyMerged ? grp.span : 1)
                                                                return (
                                                                    <td rowSpan={dateRowSpan} style={groupTotal>0?{background:'#FEF3C7'}:{}} className="border border-ink-200 px-2 py-1.5 text-center align-middle">
                                                                        {groupTotal>0 ? <span className="font-bold text-warn-700">{groupTotal}</span> : <span className="text-ink-200">—</span>}
                                                                    </td>
                                                                )
                                                            })()}
                                                            {!(grp.anyMerged && !grp.isStart) && (
                                                                <td rowSpan={dateRowSpan} className="border border-ink-900 px-2 py-1.5 text-center whitespace-nowrap align-middle">
                                                                    {dates.start ? (
                                                                        <span className={`inline-block font-semibold rounded px-1.5 py-0.5 text-[10px] ${isActual && plannedDates.start && isoDate(dates.start)!==isoDate(plannedDates.start) ? 'text-warn-700 bg-warn-50 border border-warn-500/30' : 'text-success-700 bg-success-50 border border-success-500/30'}`}>
                                                                            {fmtDateLong(dates.start)}
                                                                        </span>
                                                                    ) : <span className="text-ink-300">—</span>}
                                                                </td>
                                                            )}
                                                            {!(grp.anyMerged && !grp.isStart) && (
                                                                <td rowSpan={dateRowSpan} className="border border-ink-900 px-2 py-1.5 text-center whitespace-nowrap align-middle">
                                                                    {dates.end ? (
                                                                        <span className={`inline-block font-semibold rounded px-1.5 py-0.5 text-[10px] ${isActual && plannedDates.end && isoDate(dates.end)!==isoDate(plannedDates.end) ? 'text-warn-700 bg-warn-50 border border-warn-500/30' : 'text-brand-700 bg-brand-50 border border-brand-200'}`}>
                                                                            {fmtDateLong(dates.end)}
                                                                        </span>
                                                                    ) : <span className="text-ink-300">—</span>}
                                                                    {groupDayHours.length > 0 && (
                                                                        <div className="text-[9px] text-ink-400 font-medium mt-0.5 text-center">
                                                                            {groupDayHours.map((e,i) => (
                                                                                <div key={i}>{fmtDateShort(e.date)} ({minsToDisplay(e.startMins)}-{minsToDisplay(e.endMins)})</div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </td>
                                                            )}
                                                            {/* Deviation cell — actual calendar only */}
                                                            {isActual && !(grp.anyMerged && !grp.isStart) && (() => {
                                                                const pStart = plannedDates.start ? isoDate(plannedDates.start) : null
                                                                const pEnd   = plannedDates.end   ? isoDate(plannedDates.end)   : null
                                                                const groupDevs = deviations.filter(d => devInActualView(d) && pStart && pEnd && d.date >= pStart && d.date <= pEnd)
                                                                return (
                                                                    <td rowSpan={dateRowSpan} className="border border-danger-500/30 px-2 py-1.5 text-center align-middle" style={{background: groupDevs.length>0 ? '#FFF1F2' : '#FAFAFA'}}>
                                                                        {groupDevs.length > 0 ? (
                                                                            <div className="space-y-1">
                                                                                {groupDevs.map(dv => (
                                                                                    <div key={dv.id} className="flex items-start gap-1">
                                                                                        <div className="text-left">
                                                                                            <span className="block text-[9px] font-bold text-danger-500">{new Date(dv.date+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}</span>
                                                                                            <span className="text-[10px] text-danger-700">{dv.reason}</span>
                                                                                            {/* Scoped cancellations name their batches —
                                                                                                unlabeled they read as course-wide. */}
                                                                                            {(dv.appliesTo?.length ?? 0) > 0 && (
                                                                                                <span className="block text-[9px] font-semibold text-warn-700">
                                                                                                    {dv.appliesTo!.map(batchNameOf).join(', ')} only
                                                                                                </span>
                                                                                            )}
                                                                                        </div>
                                                                                        <button onClick={()=>{
                                                                                            const nextDevs = deviations.filter(x=>x.id!==dv.id)
                                                                                            setDeviations(nextDevs)
                                                                                            if (courseId) saveCalendar({ ...savePayload(), deviations: nextDevs }, { onSuccess: ()=>{ queryClient.invalidateQueries({ queryKey: ['programCalendar', courseId] }); showSaveToast('Deviation removed.') } })
                                                                                        }} className="text-danger-500/40 hover:text-danger-700 text-xs shrink-0 mt-0.5">×</button>
                                                                                    </div>
                                                                                ))}
                                                                                <button onClick={()=>openDeviationModal(pStart||'')}
                                                                                    className="text-[10px] text-brand-500 hover:underline mt-0.5">+ Add</button>
                                                                            </div>
                                                                        ) : (
                                                                            <button onClick={()=>openDeviationModal(pStart||'')}
                                                                                className="h-6 w-6 rounded-full bg-ink-100 hover:bg-danger-50 border border-ink-200 hover:border-danger-500/40 text-ink-400 hover:text-danger-500 text-base font-light flex items-center justify-center transition-all mx-auto leading-none">
                                                                                +
                                                                            </button>
                                                                        )}
                                                                    </td>
                                                                )
                                                            })()}
                                                        </tr>
                                                    )
                                                    if (!asmt) return mainRow
                                                    // ── Horizontal assessment banner after the group's last row ──
                                                    return (
                                                        <Fragment key={row.rowId}>
                                                            {mainRow}
                                                            <tr style={{background:'#ECFDF5'}}>
                                                                {hasModule    && !groupContinuesAfter(mSpan, ridx)  && <td style={{background:'#FFEDD5'}} className="border-x border-ink-900"/>}
                                                                {hasSubModule && !groupContinuesAfter(smSpan, ridx) && <td style={{background:'#F0F9FF'}} className="border-x border-ink-900"/>}
                                                                <td colSpan={fullCols - hierColsBeforeTopic} className="border-y-2 border-success-500 px-4 py-1.5">
                                                                    <div className="flex items-center justify-center gap-3 flex-wrap">
                                                                        <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-success-700"><Target className="h-3.5 w-3.5"/>Assessment</span>
                                                                        <span className="text-[13px] font-extrabold text-success-700">{asmt.total}<span className="text-[10px] font-medium text-success-500 ml-0.5">hrs</span></span>
                                                                        {asmt.start && asmt.end && <>
                                                                            <span className="text-[10px] font-semibold text-success-700 bg-success-50 border border-success-500/40 rounded px-1.5 py-0.5"><span className="text-success-500">Start</span> {fmtDateLong(asmt.start)}</span>
                                                                            <span className="text-[10px] font-semibold text-success-700 bg-success-50 border border-success-500/40 rounded px-1.5 py-0.5"><span className="text-success-500">End</span> {fmtDateLong(asmt.end)}</span>
                                                                        </>}
                                                                        {globalAsmtGapDays > 0 && (
                                                                            <span className="text-[10px] font-semibold text-warn-700 bg-warn-50 border border-warn-500/30 rounded px-1.5 py-0.5">
                                                                                ⏸ +{globalAsmtGapDays} day{globalAsmtGapDays>1?'s':''} gap
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {asmt.dayHours.length > 0 && (
                                                                        <div className="text-center text-[9px] text-success-700 font-medium mt-0.5">
                                                                            {asmt.dayHours.map((e,i) => (
                                                                                <div key={i}>{fmtDateShort(e.date)} ({minsToDisplay(e.startMins)}-{minsToDisplay(e.endMins)})</div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        </Fragment>
                                                    )
                                                })
                                            })()}
                                            {/* Total row — in Actual mode the grand total also spans
                                                the Deviation column. */}
                                            <tr style={{background:'#F1F5F9'}}>
                                                <td colSpan={[hasModule,hasSubModule,hasTopic,hasSubTopic].filter(Boolean).length} className="border border-ink-900 px-2.5 py-1.5 text-center font-extrabold text-ink-800">Total</td>
                                                {(['iDo','weDo'] as const).map(type => {
                                                    if (type==='iDo' && hideIDo)  return null
                                                    if (type==='weDo' && hideWeDo) return null
                                                    const isCollapsed = type==='iDo'?collapseIDo:collapseWeDo
                                                    const activities = activityTypes[type] as string[]
                                                    if (activities.length === 0) return null
                                                    if (isCollapsed) {
                                                        const total = activities.reduce((s,a) => s + (activityTotals[type]?.[a] || 0), 0)
                                                        return <td key={type} className="border border-ink-900 px-2 py-1.5 text-center font-bold text-ink-700">{total || '—'}</td>
                                                    }
                                                    return activities.map(activity => (
                                                        <td key={`t-${type}-${activity}`} className="border border-ink-900 px-2 py-1.5 text-center font-bold text-ink-700">
                                                            {activityTotals[type]?.[activity] ?? '—'}
                                                        </td>
                                                    ))
                                                })}
                                                <td colSpan={isActual ? 4 : 3} className="border border-ink-900 bg-warn-50 px-2 py-1.5 text-center font-extrabold text-warn-700">
                                                    <span className="text-[13px]">{totalContentHours}h</span>
                                                    {totalContentHours !== teachingContentHours && (
                                                        <div className="text-[9px] font-medium text-warn-700 mt-0.5 leading-tight">
                                                            {teachingContentHours}h teaching + {totalContentHours - teachingContentHours}h assessment
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                    </div>
                                </motion.div>
                            )
                            })()}

                            {/* ── Calendar view — Google Calendar style (Planned) ── */}
                            {calendarMode === 'planned' && generated && generated.length>0 && scheduleView==='calendar' && (() => {
                                const todayIso = isoDate(new Date())

                                // Google-style event pill
                                const EventPill = ({ iso, it, idx }: { iso: string; it: SchedItem; idx: number }) => {
                                    const isAsmt = it.type==='youDo'
                                    const bg = isAsmt ? 'bg-success-700 hover:bg-success-700' : it.type==='iDo' ? 'bg-brand-500 hover:bg-brand-700' : 'bg-brand-500 hover:bg-brand-700'
                                    const label = isAsmt ? 'Assessment' : (it.subTopic && it.subTopic!=='-' ? it.subTopic : it.topic && it.topic!=='-' ? it.topic : it.module)
                                    return (
                                        <button key={idx} onClick={(e)=>{ e.stopPropagation(); setCalDayModal(iso) }}
                                            className={`w-full text-left text-[10px] font-medium text-white rounded-sm px-1.5 py-0.5 truncate transition-all active:scale-[0.98] ${bg}`}
                                            title={`${label} · ${it.activity} · ${it.hours}h`}>
                                            {isAsmt && <Target className="inline h-2.5 w-2.5 mr-0.5 -mt-px"/>}
                                            {label}<span className="opacity-75 ml-1">{it.hours}h</span>
                                        </button>
                                    )
                                }

                                // Google-style date number circle
                                const DateCircle = ({ iso, d }: { iso: string; d: Date }) => {
                                    const isToday = iso === todayIso
                                    const holiday = displayHolidays.find(h => h.date===iso)
                                    const isSun   = d.getDay()===0
                                    return (
                                        <span className={`h-7 w-7 rounded-full flex items-center justify-center text-[13px] font-medium
                                            ${isToday ? 'bg-info-700 text-white font-bold' :
                                              holiday  ? 'bg-danger-500 text-white' :
                                              isSun    ? 'text-danger-500' : 'text-ink-700'}`}>
                                            {d.getDate()}
                                        </span>
                                    )
                                }

                                return (
                                <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{duration:0.2}} className="rounded-xl border border-ink-200 bg-white shadow-sm overflow-hidden">

                                    {/* ── GCal-style toolbar ── */}
                                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-ink-100 bg-white">
                                        <div className="flex items-center gap-2">
                                            {/* Prev / Next */}
                                            <button
                                                onClick={()=>{ if(schedCalSubView==='month') setSchedMonth(m=>new Date(m.getFullYear(),m.getMonth()-1,1)); else if(schedCalSubView==='week') setSchedWeekStart(w=>addDays(w,-7)); else setSchedDay(d=>addDays(d,-1)) }}
                                                className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-ink-100 text-ink-600 transition-all active:scale-90">
                                                <ChevronLeft className="h-4 w-4"/>
                                            </button>
                                            <button
                                                onClick={()=>{ if(schedCalSubView==='month') setSchedMonth(m=>new Date(m.getFullYear(),m.getMonth()+1,1)); else if(schedCalSubView==='week') setSchedWeekStart(w=>addDays(w,7)); else setSchedDay(d=>addDays(d,1)) }}
                                                className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-ink-100 text-ink-600 transition-all active:scale-90">
                                                <ChevronRight className="h-4 w-4"/>
                                            </button>
                                            {/* Title */}
                                            <h2 className="text-[15px] font-semibold text-ink-800 ml-1 select-none">
                                                {schedCalSubView==='month' && schedMonth.toLocaleDateString('en-IN',{month:'long',year:'numeric'})}
                                                {schedCalSubView==='week'  && `${fmtDateShort(schedWeekStart)} – ${fmtDateShort(addDays(schedWeekStart,6))}, ${addDays(schedWeekStart,6).getFullYear()}`}
                                                {schedCalSubView==='day'   && schedDay.toLocaleDateString('en-IN',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}
                                            </h2>
                                            {/* Today jump */}
                                            {summary && (
                                                <button onClick={()=>{ setSchedMonth(new Date(summary.startDate.getFullYear(),summary.startDate.getMonth(),1)); setSchedWeekStart(addDays(summary.startDate,-summary.startDate.getDay())); setSchedDay(summary.startDate) }}
                                                    className="ml-1 text-[11px] font-medium text-info-700 hover:text-info-700 border border-info-500/30 hover:border-info-500 rounded-full px-2.5 py-0.5 transition-all">
                                                    Jump to start
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 bg-ink-100 rounded-lg p-0.5">
                                            {([{v:'month' as const,l:'Month'},{v:'week' as const,l:'Week'},{v:'day' as const,l:'Day'}]).map(({v,l})=>(
                                                <button key={v} onClick={()=>setSchedCalSubView(v)}
                                                    className={`px-3 py-1 rounded-md text-[12px] font-medium transition-all ${schedCalSubView===v?'bg-white text-ink-800 shadow-sm':'text-ink-500 hover:text-ink-700'}`}>
                                                    {l}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <AnimatePresence mode="wait">
                                    <motion.div key={schedCalSubView} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.15}}>

                                        {/* ══════════ MONTH VIEW ══════════ */}
                                        {schedCalSubView==='month' && (
                                            <div>
                                                {/* Day-of-week header */}
                                                <div className="grid grid-cols-7 border-b border-ink-100">
                                                    {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>(
                                                        <div key={d} className={`py-2 text-center text-[11px] font-semibold uppercase tracking-wide ${d==='Sun'?'text-danger-500':'text-ink-400'}`}>{d}</div>
                                                    ))}
                                                </div>
                                                <div className="grid grid-cols-7">
                                                    {getMonthGrid(schedMonth).map((d, i) => {
                                                        if (!d) return <div key={i} className="min-h-[110px] bg-ink-50/40 border-b border-r border-ink-100"/>
                                                        const iso = isoDate(d)
                                                        const items = scheduleByDate[iso] || []
                                                        const holiday = displayHolidays.find(h=>h.date===iso)
                                                        const isWeekend = d.getDay()===0 || d.getDay()===6
                                                        const isSun = d.getDay()===0
                                                        const isInMonth = d.getMonth()===schedMonth.getMonth()
                                                        const dayTotal = Math.round(items.reduce((s,it)=>s+it.hours,0)*100)/100
                                                        return (
                                                            <div key={i} onClick={()=>setCalDayModal(iso)}
                                                                className={`min-h-[110px] p-1 flex flex-col border-b border-r border-ink-100 cursor-pointer group transition-colors
                                                                    ${holiday ? 'bg-danger-50/60' : isWeekend ? 'bg-ink-50/60' : 'bg-white'}
                                                                    ${!isInMonth ? 'opacity-40' : ''}
                                                                    hover:bg-info-50/30`}>
                                                                <div className="flex items-start justify-between mb-0.5">
                                                                    <DateCircle iso={iso} d={d}/>
                                                                    {dayTotal>0 && <span className="text-[9px] text-ink-400 mt-1.5 mr-0.5">{dayTotal}h</span>}
                                                                </div>
                                                                {holiday && (
                                                                    <div className="text-[10px] font-medium text-danger-700 bg-danger-50 rounded-sm px-1 py-0.5 truncate mb-0.5">
                                                                        {holiday.name}{holiday.duration && holiday.duration!=='full' ? ` (${holiday.duration==='first-half'?'AM':'PM'})` : ''}
                                                                    </div>
                                                                )}
                                                                {isSun && !holiday && <div className="text-[9px] text-danger-500 px-1 mb-0.5">Weekend</div>}
                                                                <div className="flex flex-col gap-px">
                                                                    {items.slice(0,3).map((it,idx)=><EventPill key={idx} iso={iso} it={it} idx={idx}/>)}
                                                                    {items.length>3 && (
                                                                        <button onClick={(e)=>{e.stopPropagation();setCalDayModal(iso)}}
                                                                            className="text-[10px] text-info-700 hover:text-info-700 font-medium text-left px-1 mt-0.5">
                                                                            +{items.length-3} more
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* ══════════ WEEK VIEW ══════════ */}
                                        {schedCalSubView==='week' && (
                                            <div>
                                                {/* Column headers */}
                                                <div className="grid grid-cols-7 border-b border-ink-100">
                                                    {getWeekGrid(schedWeekStart).map((d,i)=>{
                                                        const iso = isoDate(d)
                                                        const isToday = iso===todayIso
                                                        const isSun = d.getDay()===0
                                                        return (
                                                            <div key={i} className={`py-2 flex flex-col items-center gap-0.5 border-r border-ink-100 last:border-r-0 ${isSun?'bg-danger-50/30':''}`}>
                                                                <span className={`text-[11px] font-semibold uppercase tracking-wide ${isSun?'text-danger-500':'text-ink-400'}`}>{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]}</span>
                                                                <DateCircle iso={iso} d={d}/>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                                <div className="grid grid-cols-7">
                                                    {getWeekGrid(schedWeekStart).map((d,i)=>{
                                                        const iso = isoDate(d)
                                                        const items = scheduleByDate[iso] || []
                                                        const holiday = displayHolidays.find(h=>h.date===iso)
                                                        const isWeekend = d.getDay()===0 || d.getDay()===6
                                                        const dayTotal = Math.round(items.reduce((s,it)=>s+it.hours,0)*100)/100
                                                        return (
                                                            <div key={i} onClick={()=>setCalDayModal(iso)}
                                                                className={`min-h-[180px] p-1.5 flex flex-col gap-1 border-r border-ink-100 last:border-r-0 cursor-pointer transition-colors
                                                                    ${holiday?'bg-danger-50/60':isWeekend?'bg-ink-50/50':'bg-white'} hover:bg-info-50/20`}>
                                                                {dayTotal>0 && <span className="text-[9px] text-ink-400 text-right">{dayTotal}h</span>}
                                                                {holiday && (
                                                                    <div className="text-[10px] font-medium text-danger-700 bg-danger-50 rounded px-1.5 py-0.5 truncate">
                                                                        {holiday.name}
                                                                    </div>
                                                                )}
                                                                <div className="flex flex-col gap-0.5">
                                                                    {items.slice(0,8).map((it,idx)=><EventPill key={idx} iso={iso} it={it} idx={idx}/>)}
                                                                    {items.length>8 && (
                                                                        <button onClick={(e)=>{e.stopPropagation();setCalDayModal(iso)}}
                                                                            className="text-[10px] text-info-700 hover:text-info-700 font-medium px-1">
                                                                            +{items.length-8} more
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* ══════════ DAY VIEW ══════════ */}
                                        {schedCalSubView==='day' && (() => {
                                            const iso = isoDate(schedDay)
                                            const holiday = displayHolidays.find(h=>h.date===iso)
                                            const PX_PER_MIN = 1.8
                                            const timedSlots = sortedSlots.filter(s=>durationMins(s.startTime,s.endTime)>0)
                                            const timelineStart = timedSlots.length ? Math.min(...timedSlots.map(s=>parseTimeMins(s.startTime))) : 540
                                            const timelineEnd   = timedSlots.length ? Math.max(...timedSlots.map(s=>parseTimeMins(s.endTime)))   : 960
                                            const totalHeight = Math.max((timelineEnd-timelineStart)*PX_PER_MIN, 200)
                                            const hourMarks: number[] = []
                                            for (let m=Math.ceil(timelineStart/60)*60; m<=timelineEnd; m+=60) hourMarks.push(m)
                                            const rows = dayGenRows[iso] || []
                                            const dayMid = (timelineStart+timelineEnd)/2
                                            return (
                                                <div>
                                                    {/* Day view toolbar */}
                                                    <div className="flex items-center justify-between px-4 py-2 border-b border-ink-100 bg-ink-50/50">
                                                        <div className="flex items-center gap-2">
                                                            <button onClick={()=>setSchedDay(d=>addDays(d,-1))} className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-ink-200 text-ink-500 transition-all"><ChevronLeft className="h-3.5 w-3.5"/></button>
                                                            <span className="text-[13px] font-semibold text-ink-700">{schedDay.toLocaleDateString('en-IN',{weekday:'long',day:'2-digit',month:'long'})}</span>
                                                            <button onClick={()=>setSchedDay(d=>addDays(d,1))} className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-ink-200 text-ink-500 transition-all"><ChevronRight className="h-3.5 w-3.5"/></button>
                                                        </div>
                                                        {holiday && <span className="text-[11px] font-medium px-3 py-1 rounded-full bg-danger-50 text-danger-700 border border-danger-500/30">🔴 {holiday.name}</span>}
                                                    </div>

                                                    {holiday && (!holiday.duration || holiday.duration==='full') ? (
                                                        <div className="py-16 text-center">
                                                            <div className="h-14 w-14 rounded-full bg-danger-50 flex items-center justify-center mx-auto mb-3"><CalendarDays className="h-7 w-7 text-danger-500"/></div>
                                                            <p className="text-sm font-semibold text-danger-700">{holiday.name}</p>
                                                            <p className="text-xs text-ink-400 mt-1">Full day holiday — no sessions scheduled.</p>
                                                        </div>
                                                    ) : rows.length===0 ? (
                                                        <div className="py-16 text-center">
                                                            <Clock className="h-12 w-12 text-ink-200 mx-auto mb-3"/>
                                                            <p className="text-sm text-ink-400">No sessions on this day.</p>
                                                        </div>
                                                    ) : (
                                                        <div className="flex">
                                                            {/* Time gutter */}
                                                            <div className="w-16 shrink-0 border-r border-ink-100 relative bg-white" style={{height:totalHeight}}>
                                                                {hourMarks.map(m=>(
                                                                    <div key={m} className="absolute right-2 -translate-y-1/2 text-[10px] text-ink-400 font-medium" style={{top:(m-timelineStart)*PX_PER_MIN}}>{minsToDisplay(m)}</div>
                                                                ))}
                                                            </div>
                                                            {/* Event area */}
                                                            <div className="relative flex-1 bg-white" style={{height:totalHeight}}>
                                                                {hourMarks.map(m=>(
                                                                    <div key={m} className="absolute left-0 right-0 border-t border-ink-100" style={{top:(m-timelineStart)*PX_PER_MIN}}/>
                                                                ))}
                                                                {/* Break bands */}
                                                                {sortedSlots.filter(s=>s.kind==='break'&&durationMins(s.startTime,s.endTime)>0).map(s=>{
                                                                    const top=(parseTimeMins(s.startTime)-timelineStart)*PX_PER_MIN
                                                                    const h=(parseTimeMins(s.endTime)-parseTimeMins(s.startTime))*PX_PER_MIN
                                                                    return <div key={s.id} className="absolute left-0 right-0 bg-warn-50 border-y border-warn-50 flex items-center justify-center text-[10px] font-medium text-warn-500" style={{top,height:h}}>{s.name}</div>
                                                                })}
                                                                {/* Half-day holiday overlay */}
                                                                {holiday && holiday.duration && holiday.duration!=='full' && (()=>{
                                                                    const first = holiday.duration==='first-half'
                                                                    const top = first ? 0 : (dayMid-timelineStart)*PX_PER_MIN
                                                                    const h   = first ? (dayMid-timelineStart)*PX_PER_MIN : (timelineEnd-dayMid)*PX_PER_MIN
                                                                    return <div className="absolute left-0 right-0 bg-danger-50/80 border-y border-danger-500/30 flex items-center justify-center text-[11px] font-semibold text-danger-500 z-10" style={{top,height:h}}>🔴 {holiday.name} ({first?'First Half':'Second Half'})</div>
                                                                })()}
                                                                {/* Session blocks */}
                                                                {rows.map((row,idx)=>{
                                                                    const top=(row.startMins-timelineStart)*PX_PER_MIN
                                                                    const h=Math.max((row.endMins-row.startMins)*PX_PER_MIN,28)
                                                                    const isAsmt=row.type==='youDo'
                                                                    const bg = isAsmt ? 'bg-success-500 hover:bg-success-700 text-white'
                                                                        : row.type==='iDo' ? 'bg-brand-500 hover:bg-brand-700 text-white'
                                                                        : 'bg-brand-500 hover:bg-brand-700 text-white'
                                                                    const label = isAsmt ? 'Assessment' : (row.subTopic && row.subTopic!=='-' ? row.subTopic : row.topic && row.topic!=='-' ? row.topic : row.module)
                                                                    return (
                                                                        <button key={idx} onClick={()=>setCalDayModal(iso)}
                                                                            className={`absolute left-2 right-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] font-semibold shadow-sm hover:shadow-md transition-all overflow-hidden ${bg}`}
                                                                            style={{top,height:h}}>
                                                                            {isAsmt && <Target className="inline h-3 w-3 mr-1 -mt-px"/>}
                                                                            <span>{label}</span>
                                                                            <span className="ml-1.5 text-[10px] font-normal opacity-80">{minsToDisplay(row.startMins)}–{minsToDisplay(row.endMins)} · {row.hours}h</span>
                                                                        </button>
                                                                    )
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })()}

                                    </motion.div>
                                    </AnimatePresence>

                                    {/* Legend */}
                                    <div className="flex items-center gap-4 px-4 py-2 border-t border-ink-100 bg-ink-50/50">
                                        {[{c:'bg-brand-500',l:'I Do'},{c:'bg-brand-500',l:'We Do'},{c:'bg-success-700',l:'Assessment'},{c:'bg-danger-500',l:'Holiday'}].map(({c,l})=>(
                                            <span key={l} className="flex items-center gap-1.5 text-[11px] text-ink-500"><span className={`h-2.5 w-2.5 rounded-full ${c}`}/>{l}</span>
                                        ))}
                                        <span className="ml-auto text-[11px] text-ink-400 flex items-center gap-1"><AlertCircle className="h-3 w-3"/>Click a day to view details</span>
                                    </div>

                                </motion.div>
                                )
                            })()}

                            {/* Actual calendar info bar — counts only the deviations that
                                touch the batch being viewed, matching the table beside it. */}
                            {calendarMode === 'actual' && (() => { const viewDevs = deviations.filter(devInActualView); return viewDevs.length > 0 && (
                                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-danger-50 border border-danger-500/30 text-[12px] text-danger-700 flex-wrap">
                                    <span className="font-bold">⚠ {viewDevs.length} deviation{viewDevs.length>1?'s':''} recorded.</span>
                                    <span className="text-danger-500">Dates shown in <span className="font-bold text-warn-700">amber</span> have been rescheduled. Click <span className="font-bold">+</span> in the Deviation column to add a cancellation.</span>
                                    {/* Batch-scoped deviations make end dates diverge —
                                        say each batch's actual end instead of letting
                                        one shared grid imply they all match. */}
                                    {perBatchEnds.length > 0 && (
                                        <span className="flex items-center gap-1.5 flex-wrap w-full pt-1">
                                            {perBatchEnds.map(pb => (
                                                <span key={pb.name} className="inline-flex items-center h-[20px] px-2 rounded-full bg-white border border-danger-500/30 text-[11px] font-semibold text-danger-700">
                                                    {pb.name} ends {pb.end ? pb.end.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                                                </span>
                                            ))}
                                        </span>
                                    )}
                                </div>
                            )})()}
                            {calendarMode === 'actual' && deviations.filter(devInActualView).length === 0 && (
                                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-info-50 border border-info-50 text-[12px] text-info-700">
                                    Click <strong className="mx-1">+</strong> in the <strong>Deviation</strong> column (last column) to mark a session as cancelled. The calendar will reschedule remaining content automatically.
                                </div>
                            )}

                            {/* ══════════ PLANNED VS ACTUAL COMPARISON ══════════ */}
                            {calendarMode === 'comparison' && (
                                <motion.div initial={{opacity:0}} animate={{opacity:1}} className="space-y-3">
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <div className="flex items-center gap-2 text-[11px] font-semibold">
                                            <span className="h-3 w-3 rounded-full bg-success-500 inline-block"/> On Track
                                            <span className="h-3 w-3 rounded-full bg-warn-500 inline-block ml-2"/> Rescheduled
                                            <span className="h-3 w-3 rounded-full bg-danger-500 inline-block ml-2"/> Cancelled
                                        </div>
                                        {(() => { const n = deviations.filter(devInActualView).length; return n > 0 && (
                                            <span className="text-[11px] text-ink-500 ml-auto">{n} deviation{n>1?'s':''} recorded</span>
                                        )})()}
                                    </div>

                                    {(!generated || !actualGenerated) ? (
                                        <div className="rounded-xl border border-dashed border-ink-200 bg-ink-50 px-6 py-10 text-center">
                                            <p className="text-sm text-ink-400">Configure the calendar first to see the comparison.</p>
                                        </div>
                                    ) : (
                                        <div className="overflow-auto max-h-[75vh] rounded-xl border border-ink-300 shadow-md">
                                        {(() => {
                                            // One row per content item (module/topic/subtopic/activity),
                                            // in first-appearance order. Planned range = min/max of the
                                            // item's planned block dates (shared by all batches); actual
                                            // range = the same over actualGenerated, which is already
                                            // reflowed for the batch picked in the selector.
                                            type Cmp = { row: GenRow; hours: number; pStart?: Date; pEnd?: Date; aStart?: Date; aEnd?: Date }
                                            const byKey: Record<string, Cmp> = {}
                                            const order: string[] = []
                                            const keyOf = (r: GenRow) => `${r.module}|${r.subModule}|${r.topic}|${r.subTopic}`
                                            generated.forEach(r => {
                                                const k = keyOf(r)
                                                if (!byKey[k]) { byKey[k] = { row: r, hours: 0 }; order.push(k) }
                                                const c = byKey[k]
                                                c.hours = Math.round((c.hours + r.hours) * 100) / 100
                                                if (!c.pStart || r.date < c.pStart) c.pStart = new Date(r.date)
                                                if (!c.pEnd   || r.date > c.pEnd)   c.pEnd   = new Date(r.date)
                                            })
                                            actualGenerated.forEach(r => {
                                                const k = keyOf(r)
                                                if (!byKey[k]) { byKey[k] = { row: r, hours: 0 }; order.push(k) }
                                                const c = byKey[k]
                                                if (!c.aStart || r.date < c.aStart) c.aStart = new Date(r.date)
                                                if (!c.aEnd   || r.date > c.aEnd)   c.aEnd   = new Date(r.date)
                                            })
                                            const fmt = (d?: Date) => d ? d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—'
                                            // Merge the Module cell across consecutive rows that share the
                                            // same module name — matches the Planned/Actual view where the
                                            // module column is common to all its topics (no repeated cell
                                            // per row). The topic column stays one-per-row.
                                            const modSpans = new Array(order.length).fill(0)
                                            {
                                                let a = 0
                                                while (a < order.length) {
                                                    const mName = byKey[order[a]].row.module || '—'
                                                    let b = a
                                                    while (b < order.length && (byKey[order[b]].row.module || '—') === mName) b++
                                                    modSpans[a] = b - a
                                                    a = b
                                                }
                                            }
                                            return (
                                                <table className="w-full text-[11px] border-collapse">
                                                    <thead className="sticky top-0 z-10">
                                                        {/* Row 1: hierarchy + grouped date headers.
                                                            Palette mirrors the Planned/Actual view: dark
                                                            navy for identity cols, amber for hours, blue
                                                            for Planned dates, green for Actual dates,
                                                            dark red for Deviation. */}
                                                        <tr>
                                                            <th rowSpan={2} style={{background:'#1E293B',color:'white'}} className="border border-ink-700 px-2.5 py-1.5 text-center font-bold align-middle whitespace-nowrap min-w-[40px]">#</th>
                                                            <th rowSpan={2} style={{background:'#1E293B',color:'white'}} className="border border-ink-700 px-2.5 py-1.5 text-center font-bold align-middle min-w-[130px]">Module</th>
                                                            <th rowSpan={2} style={{background:'#1E293B',color:'white'}} className="border border-ink-700 px-2.5 py-1.5 text-center font-bold align-middle min-w-[140px]">Topic</th>
                                                            <th rowSpan={2} style={{background:'#B45309',color:'white'}} className="border border-warn-700 px-2.5 py-1.5 text-center font-bold align-middle whitespace-nowrap">Total Hours</th>
                                                            <th colSpan={2} style={{background:'#0369A1',color:'white'}} className="border border-info-700 px-2.5 py-1.5 text-center font-bold whitespace-nowrap">Planned</th>
                                                            <th colSpan={2} style={{background:'#15803D',color:'white'}} className="border border-success-700 px-2.5 py-1.5 text-center font-bold whitespace-nowrap">Actual</th>
                                                            <th rowSpan={2} style={{background:'#991B1B',color:'white'}} className="border border-danger-700 px-2.5 py-1.5 text-center font-bold align-middle whitespace-nowrap min-w-[120px]">Deviation</th>
                                                        </tr>
                                                        {/* Row 2: Start / End sub-headers per date group */}
                                                        <tr>
                                                            <th style={{background:'#DBEAFE',color:'#075985'}} className="border border-info-700 px-2 py-1 text-center font-semibold text-[10px] whitespace-nowrap">Start Date</th>
                                                            <th style={{background:'#DBEAFE',color:'#075985'}} className="border border-info-700 px-2 py-1 text-center font-semibold text-[10px] whitespace-nowrap">End Date</th>
                                                            <th style={{background:'#DCFCE7',color:'#166534'}} className="border border-success-700 px-2 py-1 text-center font-semibold text-[10px] whitespace-nowrap">Start Date</th>
                                                            <th style={{background:'#DCFCE7',color:'#166534'}} className="border border-success-700 px-2 py-1 text-center font-semibold text-[10px] whitespace-nowrap">End Date</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {order.map((k, i) => {
                                                            const { row, hours, pStart, pEnd, aStart, aEnd } = byKey[k]
                                                            const status = (!aStart && pStart) ? 'cancelled'
                                                                : (pStart && aStart && (isoDate(pStart) !== isoDate(aStart) || isoDate(pEnd!) !== isoDate(aEnd!))) ? 'rescheduled'
                                                                : 'on-track'
                                                            const rowDevs = (pStart && pEnd)
                                                                ? deviations.filter(d => devInActualView(d) && d.date >= isoDate(pStart) && d.date <= isoDate(pEnd))
                                                                : []
                                                            // Sub-topic still tucks under the Topic cell.
                                                            const topicLabel = row.topic && row.topic !== '-'
                                                                ? (row.subTopic && row.subTopic !== '-' ? `${row.topic} › ${row.subTopic}` : row.topic)
                                                                : (row.subTopic && row.subTopic !== '-' ? row.subTopic : '—')
                                                            const stripe = i%2===0 ? '#ffffff' : '#FFF7ED'
                                                            // Date pill colors mirror the Actual view:
                                                            // - Planned dates keep their info/brand tint;
                                                            //   when the actual has slipped they gain a
                                                            //   struck line so the drift reads instantly.
                                                            // - Actual dates take amber on rescheduled,
                                                            //   ink-300 on cancelled, else the matching
                                                            //   green (start) / purple (end) pill.
                                                            const plannedStartPill = status!=='on-track'
                                                                ? 'text-info-700 bg-info-50 border border-info-200 line-through opacity-70'
                                                                : 'text-info-700 bg-info-50 border border-info-200'
                                                            const plannedEndPill = plannedStartPill
                                                            const actualStartPill = status==='rescheduled'
                                                                ? 'text-warn-700 bg-warn-50 border border-warn-500/30'
                                                                : status==='cancelled'
                                                                    ? 'text-ink-400 bg-ink-50 border border-ink-200'
                                                                    : 'text-success-700 bg-success-50 border border-success-500/30'
                                                            const actualEndPill = status==='rescheduled'
                                                                ? 'text-warn-700 bg-warn-50 border border-warn-500/30'
                                                                : status==='cancelled'
                                                                    ? 'text-ink-400 bg-ink-50 border border-ink-200'
                                                                    : 'text-brand-700 bg-brand-50 border border-brand-200'
                                                            return (
                                                                <tr key={k} style={{background: stripe}} className="hover:brightness-95 transition-all">
                                                                    <td className="border border-ink-200 px-2 py-1.5 text-center text-ink-400 align-middle">{i+1}</td>
                                                                    {modSpans[i] > 0 && (
                                                                        <td rowSpan={modSpans[i]} style={{background:'#FFEDD5'}} className="border border-ink-900 px-2.5 py-1.5 font-bold text-info-700 text-center align-middle">
                                                                            {row.module && row.module !== '-' ? row.module : '—'}
                                                                        </td>
                                                                    )}
                                                                    <td className="border border-ink-900 px-2.5 py-1.5 text-left text-ink-700 align-middle" style={{background:'#F8FAFC'}} title={topicLabel !== '—' ? topicLabel : undefined}>{topicLabel}</td>
                                                                    <td className="border border-ink-200 px-2 py-1.5 text-center align-middle" style={hours>0?{background:'#FEF3C7'}:{}}>
                                                                        {hours>0 ? <span className="font-bold text-warn-700">{hours}</span> : <span className="text-ink-200">—</span>}
                                                                    </td>
                                                                    <td className="border border-ink-900 px-2 py-1.5 text-center whitespace-nowrap align-middle" style={{background:'#F0F9FF'}}>
                                                                        {pStart ? <span className={`inline-block font-semibold rounded px-1.5 py-0.5 text-[10px] ${plannedStartPill}`}>{fmt(pStart)}</span> : <span className="text-ink-300">—</span>}
                                                                    </td>
                                                                    <td className="border border-ink-900 px-2 py-1.5 text-center whitespace-nowrap align-middle" style={{background:'#F0F9FF'}}>
                                                                        {pEnd ? <span className={`inline-block font-semibold rounded px-1.5 py-0.5 text-[10px] ${plannedEndPill}`}>{fmt(pEnd)}</span> : <span className="text-ink-300">—</span>}
                                                                    </td>
                                                                    <td className="border border-ink-900 px-2 py-1.5 text-center whitespace-nowrap align-middle" style={{background:'#ECFDF5'}}>
                                                                        {aStart ? <span className={`inline-block font-semibold rounded px-1.5 py-0.5 text-[10px] ${actualStartPill}`}>{fmt(aStart)}</span> : <span className="text-ink-300">—</span>}
                                                                    </td>
                                                                    <td className="border border-ink-900 px-2 py-1.5 text-center whitespace-nowrap align-middle" style={{background:'#ECFDF5'}}>
                                                                        {aEnd ? <span className={`inline-block font-semibold rounded px-1.5 py-0.5 text-[10px] ${actualEndPill}`}>{fmt(aEnd)}</span> : <span className="text-ink-300">—</span>}
                                                                    </td>
                                                                    <td className="border border-danger-500/30 px-2 py-1.5 text-center align-middle" style={{background: rowDevs.length>0 ? '#FFF1F2' : '#FAFAFA'}}>
                                                                        {rowDevs.length ? rowDevs.map(dv => (
                                                                            <div key={dv.id} className="text-[10px] whitespace-nowrap">
                                                                                <span className="font-bold text-danger-500">{new Date(dv.date+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}</span>
                                                                                {dv.reason && <span className="text-danger-700 italic"> — {dv.reason}</span>}
                                                                            </div>
                                                                        )) : <span className="text-ink-300">—</span>}
                                                                    </td>
                                                                </tr>
                                                            )
                                                        })}
                                                    </tbody>
                                                </table>
                                            )
                                        })()}
                                        </div>
                                    )}
                                </motion.div>
                            )}

                        </motion.div>
                    )}

                    </AnimatePresence>

                </div>
            </div>

            {/* ── Scheduled item detail popup ── */}
            <AnimatePresence>
            {detailItem && (() => {
                const { date, item } = detailItem
                const isAsmt = item.type==='youDo'
                const dObj = new Date(date+'T00:00:00')
                const blocks = (generated||[]).filter(r => isoDate(r.date)===date && r.module===item.module && r.subModule===item.subModule && r.topic===item.topic && r.subTopic===item.subTopic && r.activity===item.activity && r.type===item.type)
                    .sort((a,b)=>a.startMins-b.startMins)
                const typeLabel = isAsmt ? 'Assessment' : item.type==='iDo' ? 'I Do' : 'We Do'
                const headerBg = isAsmt ? 'bg-gradient-to-r from-success-500 to-success-700' : item.type==='iDo' ? 'bg-brand-700' : 'bg-brand-700'
                const hierParts = [item.module, item.subModule, item.topic, item.subTopic].filter(v => v && v!=='-')
                return (
                    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                        onClick={()=>setDetailItem(null)}
                        className="fixed inset-0 z-overlay bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                        <motion.div initial={{opacity:0,scale:0.95,y:8}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.95,y:8}}
                            onClick={e=>e.stopPropagation()}
                            className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
                            {/* Header */}
                            <div className={`px-5 py-4 ${headerBg} text-white flex items-start justify-between`}>
                                <div>
                                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider opacity-90">
                                        {isAsmt ? <Target className="h-3.5 w-3.5"/> : item.type==='iDo' ? <Lightbulb className="h-3.5 w-3.5"/> : <Users className="h-3.5 w-3.5"/>}
                                        {typeLabel}
                                    </div>
                                    <h3 className="text-lg font-extrabold mt-1 leading-tight">{isAsmt ? 'Assessment' : (item.subTopic && item.subTopic!=='-' ? item.subTopic : item.topic && item.topic!=='-' ? item.topic : item.module)}</h3>
                                    <p className="text-[12px] opacity-90 mt-0.5">{fmtDateLong(dObj)}</p>
                                </div>
                                <button onClick={()=>setDetailItem(null)} className="h-7 w-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors shrink-0"><X className="h-4 w-4"/></button>
                            </div>
                            {/* Body */}
                            <div className="p-5 space-y-4">
                                {isAsmt && (
                                    <div className="flex items-center gap-2 rounded-lg bg-success-50 border border-success-500/30 px-3 py-2">
                                        <Target className="h-4 w-4 text-success-700 shrink-0"/>
                                        <p className="text-[12px] font-semibold text-success-700">This is an assessment slot.</p>
                                    </div>
                                )}
                                {/* Hierarchy */}
                                <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
                                    {hierParts.map((p, i) => (
                                        <Fragment key={i}>
                                            {i>0 && <ChevronRight className="h-3 w-3 text-ink-300"/>}
                                            <span className={`${i===hierParts.length-1?'font-bold text-ink-900':'text-ink-500'}`}>{p}</span>
                                        </Fragment>
                                    ))}
                                </div>
                                {/* Meta */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-lg border border-ink-200 px-3 py-2">
                                        <p className="text-[10px] text-ink-400 uppercase tracking-wide font-semibold">Activity</p>
                                        <p className="text-sm font-bold text-ink-800 mt-0.5">{item.activity}</p>
                                    </div>
                                    <div className="rounded-lg border border-ink-200 px-3 py-2">
                                        <p className="text-[10px] text-ink-400 uppercase tracking-wide font-semibold">Total Hours</p>
                                        <p className="text-sm font-bold text-warn-700 mt-0.5">{item.hours}h</p>
                                    </div>
                                </div>
                                {/* Time blocks */}
                                {blocks.length>0 && (
                                    <div>
                                        <p className="text-[10px] text-ink-400 uppercase tracking-wide font-semibold mb-1.5">Session Time{blocks.length>1?'s':''}</p>
                                        <div className="space-y-1.5">
                                            {blocks.map((b, i) => (
                                                <div key={i} className="flex items-center justify-between rounded-lg bg-ink-50 border border-ink-100 px-3 py-1.5">
                                                    <span className="flex items-center gap-1.5 text-[12px] font-medium text-ink-600"><Clock className="h-3.5 w-3.5 text-ink-400"/>{b.slotName}</span>
                                                    <span className="text-[12px] font-semibold text-ink-800">{minsToDisplay(b.startMins)} – {minsToDisplay(b.endMins)} <span className="text-ink-400">·</span> {b.hours}h</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )
            })()}
            </AnimatePresence>

            {/* ── Delete Session Confirmation ── */}
            <AnimatePresence>
            {deleteSlotId && (() => {
                const slot = daySlots.find(s => s.id === deleteSlotId)
                if (!slot) return null
                return (
                    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                        onClick={()=>setDeleteSlotId(null)}
                        className="fixed inset-0 z-popover bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                        <motion.div initial={{opacity:0,scale:0.95,y:8}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.95,y:8}} transition={{type:'spring',stiffness:400,damping:30}}
                            onClick={e=>e.stopPropagation()}
                            className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">
                            <div className="px-5 py-4 bg-danger-500 text-white flex items-center justify-between">
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-widest opacity-75">Delete {slot.kind === 'session' ? 'Session' : 'Break'}</p>
                                    <p className="text-[16px] font-bold mt-0.5">"{slot.name}"</p>
                                </div>
                                <button onClick={()=>setDeleteSlotId(null)} className="h-7 w-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center"><X className="h-4 w-4"/></button>
                            </div>
                            <div className="px-5 py-4 space-y-4">
                                <p className="text-sm text-ink-600">Are you sure you want to delete this {slot.kind}? This will also update the saved schedule in the database.</p>
                                <div className="flex gap-2">
                                    <button onClick={()=>setDeleteSlotId(null)}
                                        className="flex-1 h-9 rounded-lg border border-ink-200 text-sm font-medium text-ink-600 hover:bg-ink-50 transition-all">
                                        Cancel
                                    </button>
                                    <button onClick={()=>deleteSlotAndSave(deleteSlotId)}
                                        className="flex-1 h-9 rounded-lg bg-danger-500 hover:bg-danger-700 text-white text-sm font-semibold transition-all active:scale-95">
                                        {isSaving ? 'Deleting…' : 'Yes, Delete'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )
            })()}
            </AnimatePresence>

            {/* ── Clear All Sessions Confirmation ── */}
            <AnimatePresence>
            {clearSessionsConfirm && (
                <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                    onClick={()=>setClearSessionsConfirm(false)}
                    className="fixed inset-0 z-popover bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <motion.div initial={{opacity:0,scale:0.95,y:8}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.95,y:8}} transition={{type:'spring',stiffness:400,damping:30}}
                        onClick={e=>e.stopPropagation()}
                        className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">
                        <div className="px-5 py-4 bg-danger-700 text-white flex items-center justify-between">
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-widest opacity-75">Clear All Sessions</p>
                                <p className="text-[16px] font-bold mt-0.5">Remove all {daySlots.length} slots?</p>
                            </div>
                            <button onClick={()=>setClearSessionsConfirm(false)} className="h-7 w-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center"><X className="h-4 w-4"/></button>
                        </div>
                        <div className="px-5 py-4 space-y-4">
                            <p className="text-sm text-ink-600">This will remove all sessions and breaks from both the schedule and the database. This cannot be undone.</p>
                            <div className="flex gap-2">
                                <button onClick={()=>setClearSessionsConfirm(false)}
                                    className="flex-1 h-9 rounded-lg border border-ink-200 text-sm font-medium text-ink-600 hover:bg-ink-50 transition-all">
                                    Cancel
                                </button>
                                <button onClick={clearAllSlotsAndSave}
                                    className="flex-1 h-9 rounded-lg bg-danger-700 hover:bg-danger-700 text-white text-sm font-semibold transition-all active:scale-95">
                                    {isSaving ? 'Clearing…' : 'Yes, Clear All'}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
            </AnimatePresence>

            {/* ── Calendar Day Detail Modal ── */}
            <AnimatePresence>
            {calDayModal && (() => {
                const iso = calDayModal
                const dObj = new Date(iso + 'T00:00:00')
                const dayItems = scheduleByDate[iso] || []
                const holiday = holidays.find(h => h.date === iso)
                const isSun = dObj.getDay() === 0
                const isToday = iso === isoDate(new Date())
                const totalHours = Math.round(dayItems.reduce((s, r) => s + r.hours, 0) * 10) / 10
                // group by slot
                const bySlot: Record<string, SchedItem[]> = {}
                dayItems.forEach(r => { if (!bySlot[r.slotName]) bySlot[r.slotName] = []; bySlot[r.slotName].push(r) })
                const typeColor = (t: string) => t === 'youDo' ? 'bg-success-500' : t === 'iDo' ? 'bg-brand-500' : 'bg-brand-500'
                const typeBg   = (t: string) => t === 'youDo' ? 'bg-success-50 border-success-500/30 text-success-700' : t === 'iDo' ? 'bg-brand-50 border-brand-200 text-brand-800' : 'bg-brand-50 border-brand-200 text-brand-800'
                const typeLabel = (t: string) => t === 'youDo' ? 'Assessment' : t === 'iDo' ? 'I Do' : 'We Do'
                return (
                    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                        onClick={()=>setCalDayModal(null)}
                        className="fixed inset-0 z-modal bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                        <motion.div initial={{opacity:0,scale:0.96,y:12}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.96,y:12}} transition={{type:'spring',stiffness:400,damping:30}}
                            onClick={e=>e.stopPropagation()}
                            className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">

                            {/* Header */}
                            <div className={`px-5 py-4 flex items-center justify-between shrink-0 ${holiday ? 'bg-danger-500' : isSun ? 'bg-ink-600' : isToday ? 'bg-info-700' : 'bg-ink-800'} text-white`}>
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-widest opacity-70">
                                        {dObj.toLocaleDateString('en-IN',{weekday:'long'})}
                                    </p>
                                    <p className="text-[20px] font-bold leading-tight mt-0.5">
                                        {dObj.toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})}
                                    </p>
                                    {holiday && <p className="text-[12px] mt-1 font-medium opacity-90">🔴 {holiday.name}{holiday.duration && holiday.duration!=='full' ? ` · ${holiday.duration==='first-half'?'First Half':'Second Half'}` : ''}</p>}
                                    {isSun && !holiday && <p className="text-[12px] mt-1 opacity-80">Weekend — no sessions scheduled</p>}
                                </div>
                                <button onClick={()=>setCalDayModal(null)} className="h-8 w-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all shrink-0"><X className="h-4 w-4"/></button>
                            </div>

                            {/* Stats row */}
                            {dayItems.length > 0 && (
                                <div className="flex items-center gap-0 border-b border-ink-100 shrink-0">
                                    {[
                                        { label: 'Sessions', value: Object.keys(bySlot).length },
                                        { label: 'Content Items', value: dayItems.length },
                                        { label: 'Total Hours', value: totalHours + 'h' },
                                    ].map(({label, value}, i) => (
                                        <div key={label} className={`flex-1 py-2.5 text-center ${i < 2 ? 'border-r border-ink-100' : ''}`}>
                                            <p className="text-[17px] font-bold text-ink-800">{value}</p>
                                            <p className="text-[10px] text-ink-400 uppercase tracking-wide">{label}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Body */}
                            <div className="overflow-y-auto flex-1 p-4 space-y-4">
                                {dayItems.length === 0 ? (
                                    <div className="py-12 text-center">
                                        <CalendarDays className="h-12 w-12 text-ink-200 mx-auto mb-3"/>
                                        <p className="text-sm font-semibold text-ink-500">{holiday ? 'Holiday — no sessions scheduled' : isSun ? 'Weekend — no sessions scheduled' : 'No sessions on this day'}</p>
                                    </div>
                                ) : (
                                    Object.entries(bySlot).map(([slotName, slotItems]) => {
                                        const slotHours = Math.round(slotItems.reduce((s,r)=>s+r.hours,0)*10)/10
                                        const firstRow = slotItems[0]
                                        return (
                                            <div key={slotName} className="rounded-xl border border-ink-200 overflow-hidden">
                                                {/* Slot header */}
                                                <div className="flex items-center justify-between px-3 py-2 bg-ink-50 border-b border-ink-200">
                                                    <div className="flex items-center gap-2">
                                                        <Clock className="h-3.5 w-3.5 text-ink-400"/>
                                                        <span className="text-[12px] font-bold text-ink-700">{slotName}</span>
                                                        <span className="text-[11px] text-ink-400">{minsToDisplay(firstRow.startMins)} – {minsToDisplay(firstRow.endMins)}</span>
                                                    </div>
                                                    <span className="text-[11px] font-semibold text-warn-700 bg-warn-50 border border-warn-50 rounded px-1.5 py-0.5">{slotHours}h</span>
                                                </div>
                                                {/* Items */}
                                                <div className="divide-y divide-ink-100">
                                                    {slotItems.map((row, idx) => {
                                                        const label = row.type==='youDo' ? 'Assessment' : (row.subTopic && row.subTopic!=='-' ? row.subTopic : row.topic && row.topic!=='-' ? row.topic : row.module)
                                                        const hierParts = [row.module, row.subModule, row.topic, row.subTopic].filter(v=>v&&v!=='-')
                                                        return (
                                                            <div key={idx} className="px-3 py-2.5 flex items-start gap-3">
                                                                <span className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${typeColor(row.type)}`}/>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-start justify-between gap-2">
                                                                        <p className="text-[12px] font-semibold text-ink-800 leading-snug">{label}</p>
                                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${typeBg(row.type)}`}>{typeLabel(row.type)}</span>
                                                                            <span className="text-[11px] font-bold text-warn-700">{row.hours}h</span>
                                                                        </div>
                                                                    </div>
                                                                    {hierParts.length > 1 && (
                                                                        <p className="text-[10px] text-ink-400 mt-0.5 truncate">{hierParts.join(' › ')}</p>
                                                                    )}
                                                                    {row.activity && <p className="text-[10px] text-ink-400 mt-0.5">{row.activity}</p>}
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>

                            {/* Footer */}
                            <div className="px-4 py-3 border-t border-ink-100 bg-ink-50/60 flex justify-end shrink-0">
                                <button onClick={()=>setCalDayModal(null)}
                                    className="px-5 py-2 rounded-lg bg-ink-800 hover:bg-ink-900 text-white text-[12px] font-semibold transition-all active:scale-95">
                                    Close
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )
            })()}
            </AnimatePresence>

            {/* ── Add/remove holiday prompt (Holiday Management & Program Calendar views) ── */}
            <AnimatePresence>
            {holidayPrompt && (() => {
                const iso = holidayPrompt
                const existing = holidays.find(h => h.date === iso)
                const dObj = new Date(iso + 'T00:00:00')
                const isSunday = dObj.getDay() === 0
                const close = () => setHolidayPrompt(null)
                return (
                    <motion.div key="holiday-prompt" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                        onClick={close}
                        className="fixed inset-0 z-overlay bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                        <motion.div initial={{opacity:0,scale:0.95,y:8}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.95,y:8}}
                            onClick={e=>e.stopPropagation()}
                            className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">
                            <div className={`px-5 py-4 ${isSunday && !existing ? 'bg-brand-500' : existing ? 'bg-danger-500' : 'bg-danger-500'} text-white flex items-start justify-between`}>
                                <div>
                                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider opacity-90">
                                        <CalendarDays className="h-3.5 w-3.5"/>
                                        {isSunday && !existing ? 'Default Day Off' : existing ? 'Holiday' : 'Add Holiday'}
                                    </div>
                                    <p className="text-[15px] font-extrabold mt-1">{fmtDateLong(dObj)}</p>
                                    <p className="text-[11px] opacity-80 mt-0.5">{dObj.toLocaleDateString('en-IN',{weekday:'long'})}</p>
                                </div>
                                <button onClick={close} className="h-7 w-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors shrink-0"><X className="h-4 w-4"/></button>
                            </div>
                            <div className="p-5 space-y-4">
                                {isSunday && !existing ? (
                                    <>
                                        <div className="flex items-start gap-3 rounded-xl bg-brand-50 border border-brand-200 px-4 py-3">
                                            <CalendarDays className="h-5 w-5 text-brand-500 shrink-0 mt-0.5"/>
                                            <div>
                                                <p className="text-sm font-bold text-brand-700">Sunday — Default Non-Working Day</p>
                                                <p className="text-[12px] text-brand-600 mt-1">Sundays are automatically excluded from the program schedule. No sessions will be scheduled on this day.</p>
                                            </div>
                                        </div>
                                        <Button onClick={close} className="w-full h-9 bg-brand-500 hover:bg-brand-600 text-white">OK</Button>
                                    </>
                                ) : existing ? (
                                    <>
                                        <div className="rounded-xl bg-danger-50 border border-danger-500/30 px-4 py-3 space-y-1">
                                            <p className="text-[10px] font-bold text-danger-500 uppercase tracking-wide">Holiday Name</p>
                                            <p className="text-base font-extrabold text-danger-700">{existing.name}</p>
                                            {existing.duration && existing.duration!=='full' && (
                                                <p className="text-[11px] font-semibold text-warn-700 bg-warn-50 border border-warn-500/30 rounded px-2 py-0.5 inline-block">
                                                    {existing.duration==='first-half'?'First Half Only':'Second Half Only'}
                                                </p>
                                            )}
                                            {(!existing.duration || existing.duration==='full') && (
                                                <p className="text-[11px] text-danger-500">Full Day Holiday</p>
                                            )}
                                        </div>
                                        <p className="text-sm text-ink-600">Removing this holiday will reschedule the program, shifting content back onto this day.</p>
                                        <div className="flex gap-2">
                                            <Button onClick={()=>{ removeHolidayOnDate(iso); close() }} className="flex-1 h-9 bg-danger-500 hover:bg-danger-700 text-white">Remove Holiday</Button>
                                            <Button onClick={close} variant="outline" className="h-9">Cancel</Button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="space-y-1.5">
                                            <Label className="text-[12px] font-bold text-ink-700">Holiday Name <span className="text-danger-500">*</span></Label>
                                            <Input value={holidayPromptName} onChange={e=>setHolidayPromptName(e.target.value)} placeholder="e.g. Independence Day" className="h-9 text-sm" autoFocus/>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-[12px] font-bold text-ink-700">Duration</Label>
                                            <div className="flex gap-1 bg-ink-100 rounded-lg p-0.5">
                                                {([
                                                    { v:'full' as const, label:'Full Day' },
                                                    { v:'first-half' as const, label:'First Half' },
                                                    { v:'second-half' as const, label:'Second Half' },
                                                ]).map(({v,label}) => (
                                                    <button key={v} type="button" onClick={()=>setHolidayPromptDuration(v)}
                                                        className={`flex-1 py-1 rounded-md text-[11px] font-semibold transition-colors ${holidayPromptDuration===v?'bg-white text-danger-700 shadow-sm':'text-ink-500 hover:text-ink-700'}`}>
                                                        {label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button onClick={()=>{ addHolidayOnDate(iso, holidayPromptName, holidayPromptDuration); close() }} className="flex-1 h-9 bg-danger-500 hover:bg-danger-700 text-white gap-1.5"><Plus className="h-4 w-4"/>Add Holiday</Button>
                                            <Button onClick={close} variant="outline" className="h-9">Cancel</Button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )
            })()}
            {/* ── Timetable Slot Detail Popup ── */}
            {timetablePopup && (() => {
                const slot = timetablePopup
                const isSession = slot.kind === 'session'
                const dur = durationMins(slot.startTime, slot.endTime)
                const durLabel = dur>0 ? `${Math.floor(dur/60)>0?Math.floor(dur/60)+'h ':''}${dur%60>0?dur%60+'m':''}`.trim() : '—'
                const sessIdx = daySlots.filter(s=>s.kind==='session').findIndex(s=>s.id===slot.id)
                return (
                    <motion.div key="timetable-popup" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                        onClick={()=>setTimetablePopup(null)}
                        className="fixed inset-0 z-modal bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                        <motion.div initial={{opacity:0,scale:0.95,y:8}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.95,y:8}}
                            onClick={e=>e.stopPropagation()}
                            className="w-full max-w-xs rounded-2xl bg-white shadow-2xl overflow-hidden">
                            <div className={`px-5 py-4 ${isSession?'bg-brand-700':'bg-warn-500'} text-white flex items-start justify-between`}>
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">{isSession ? `Session ${sessIdx+1}` : 'Break'}</p>
                                    <p className="text-[17px] font-extrabold mt-0.5 leading-tight">{slot.name}</p>
                                </div>
                                <button onClick={()=>setTimetablePopup(null)} className="h-7 w-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors shrink-0 mt-0.5"><X className="h-4 w-4"/></button>
                            </div>
                            <div className="p-5 space-y-3">
                                <div className="flex items-center justify-between rounded-xl bg-ink-50 border border-ink-100 px-4 py-3">
                                    <div className="text-center">
                                        <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wide mb-0.5">Start</p>
                                        <p className="text-[16px] font-extrabold text-ink-800 font-mono">{minsToDisplay(parseTimeMins(slot.startTime))}</p>
                                    </div>
                                    <div className="text-ink-300 text-lg font-light">→</div>
                                    <div className="text-center">
                                        <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wide mb-0.5">End</p>
                                        <p className="text-[16px] font-extrabold text-ink-800 font-mono">{minsToDisplay(parseTimeMins(slot.endTime))}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wide mb-0.5">Duration</p>
                                        <p className={`text-[16px] font-extrabold ${isSession?'text-brand-700':'text-warn-700'}`}>{durLabel}</p>
                                    </div>
                                </div>
                                <div className={`rounded-lg border px-3 py-2 text-center text-[12px] font-semibold ${isSession?'bg-brand-50 border-brand-100 text-brand-700':'bg-warn-50 border-warn-50 text-warn-700'}`}>
                                    {isSession ? 'Teaching Session' : 'Break / Recess'}
                                </div>
                                <Button onClick={()=>setTimetablePopup(null)} variant="outline" className="w-full h-9">Close</Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )
            })()}

            {/* ── Timetable Preview Modal ── */}
            {showTimetableModal && (
                <motion.div key="timetable-modal" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                    onClick={()=>setShowTimetableModal(false)}
                    className="fixed inset-0 z-modal bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <motion.div initial={{opacity:0,scale:0.95,y:8}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.95,y:8}}
                        onClick={e=>e.stopPropagation()}
                        className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden">
                        <div className="px-5 py-4 bg-brand-700 text-white flex items-center justify-between">
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">Session Details</p>
                                <p className="text-[15px] font-extrabold mt-0.5">Timetable Preview
                                    {dayEnd>dayStart && <span className="text-brand-200 text-[12px] font-medium ml-2">{minsToDisplay(dayStart)} – {minsToDisplay(dayEnd)}</span>}
                                </p>
                            </div>
                            <button onClick={()=>setShowTimetableModal(false)} className="h-7 w-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors shrink-0"><X className="h-4 w-4"/></button>
                        </div>
                        <div className="p-5">
                            {sortedSlots.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
                                    <Clock className="h-10 w-10 text-ink-200"/>
                                    <p className="text-sm text-ink-400">No sessions added yet. Add sessions from Session Details.</p>
                                </div>
                            ) : (
                                <>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm border-collapse border border-ink-200 rounded-lg overflow-hidden">
                                            <tbody>
                                                <tr className="bg-ink-50 border-b border-ink-200">
                                                    <td className="px-3 py-2.5 text-[11px] font-bold text-ink-500 uppercase tracking-wide whitespace-nowrap border-r-2 border-ink-200 bg-ink-100 w-28">Time</td>
                                                    {sortedSlots.map(slot => {
                                                        const isSession = slot.kind === 'session'
                                                        return (
                                                            <td key={slot.id} onClick={()=>{ setTimetablePopup(slot); setShowTimetableModal(false) }} className={`px-3 py-2.5 text-center border-r border-ink-100 cursor-pointer hover:brightness-95 transition-all ${isSession?'bg-brand-50/60':'bg-warn-50/60'}`}>
                                                                <p className="text-[11px] font-mono font-semibold text-ink-700 whitespace-nowrap">{minsToDisplay(parseTimeMins(slot.startTime))}</p>
                                                                <p className="text-[9px] text-ink-300 leading-none my-0.5">↓</p>
                                                                <p className="text-[11px] font-mono font-semibold text-ink-700 whitespace-nowrap">{minsToDisplay(parseTimeMins(slot.endTime))}</p>
                                                            </td>
                                                        )
                                                    })}
                                                </tr>
                                                <tr className="border-b border-ink-200">
                                                    <td className="px-3 py-2.5 text-[11px] font-bold text-ink-500 uppercase tracking-wide whitespace-nowrap border-r-2 border-ink-200 bg-ink-100">Session</td>
                                                    {sortedSlots.map(slot => {
                                                        const isSession = slot.kind === 'session'
                                                        const sessIdx = daySlots.filter(s=>s.kind==='session').findIndex(s=>s.id===slot.id)
                                                        return (
                                                            <td key={slot.id} onClick={()=>{ setTimetablePopup(slot); setShowTimetableModal(false) }} className={`px-3 py-2.5 text-center border-r border-ink-100 cursor-pointer hover:brightness-95 transition-all ${isSession?'bg-white':'bg-warn-50/40'}`}>
                                                                <div className="flex flex-col items-center gap-1">
                                                                    {isSession
                                                                        ? <span className="h-5 w-5 rounded-full bg-brand-600 text-white text-[10px] font-bold inline-flex items-center justify-center">{sessIdx+1}</span>
                                                                        : <Coffee className="h-3.5 w-3.5 text-warn-500"/>}
                                                                    <span className={`text-[11px] font-medium leading-tight text-center ${isSession?'text-ink-700':'text-warn-700'}`}>{slot.name}</span>
                                                                </div>
                                                            </td>
                                                        )
                                                    })}
                                                </tr>
                                                <tr>
                                                    <td className="px-3 py-2.5 text-[11px] font-bold text-ink-500 uppercase tracking-wide whitespace-nowrap border-r-2 border-ink-200 bg-ink-100">Duration</td>
                                                    {sortedSlots.map(slot => {
                                                        const dur = durationMins(slot.startTime, slot.endTime)
                                                        const isSession = slot.kind === 'session'
                                                        const durLabel = dur>0 ? `${Math.floor(dur/60)>0?Math.floor(dur/60)+'h ':''}${dur%60>0?dur%60+'m':''}`.trim() : '—'
                                                        return (
                                                            <td key={slot.id} onClick={()=>{ setTimetablePopup(slot); setShowTimetableModal(false) }} className={`px-3 py-2.5 text-center border-r border-ink-100 cursor-pointer hover:brightness-95 transition-all ${isSession?'bg-white':'bg-warn-50/40'}`}>
                                                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${isSession?'bg-brand-100 text-brand-700':'bg-warn-50 text-warn-700'}`}>{durLabel}</span>
                                                            </td>
                                                        )
                                                    })}
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="mt-3 flex items-center justify-between">
                                        <span className="text-[11px] text-ink-400">Click any column to see slot details</span>
                                        <span className="text-[12px] text-ink-500 font-medium">Teaching Total: <span className="font-bold text-brand-700 bg-brand-100 px-2 py-0.5 rounded-md ml-1">{Math.floor(teachingMins/60)}h {teachingMins%60>0?teachingMins%60+'m':''}</span></span>
                                    </div>
                                </>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}

            {/* ── Add Holiday Name Modal ── */}
            {showAddNameModal && holidayDate && (
                <motion.div key="add-holiday-name" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                    onClick={()=>setShowAddNameModal(false)}
                    className="fixed inset-0 z-modal bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <motion.div initial={{opacity:0,scale:0.95,y:8}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.95,y:8}}
                        onClick={e=>e.stopPropagation()}
                        className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">
                        <div className="px-5 py-4 bg-danger-500 text-white flex items-start justify-between">
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">Add Holiday</p>
                                <p className="text-[15px] font-extrabold mt-0.5">{fmtDateLong(new Date(holidayDate+'T00:00:00'))}</p>
                                <p className="text-[11px] opacity-75">{new Date(holidayDate+'T00:00:00').toLocaleDateString('en-IN',{weekday:'long'})}</p>
                            </div>
                            <button onClick={()=>setShowAddNameModal(false)} className="h-7 w-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors shrink-0 mt-0.5"><X className="h-4 w-4"/></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="space-y-1.5">
                                <Label className="text-[12px] font-bold text-ink-700">Holiday Name <span className="text-danger-500">*</span></Label>
                                <Input value={holidayName} onChange={e=>setHolidayName(e.target.value)}
                                    placeholder="e.g. Independence Day" className="h-9 text-sm" autoFocus
                                    onKeyDown={e=>{ if(e.key==='Enter' && holidayName.trim()){ addHoliday(); setShowAddNameModal(false) } }}/>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[12px] font-bold text-ink-700">Duration</Label>
                                <div className="flex gap-1 bg-ink-100 rounded-lg p-0.5">
                                    {([
                                        { v:'full' as const, label:'Full Day' },
                                        { v:'first-half' as const, label:'1st Half' },
                                        { v:'second-half' as const, label:'2nd Half' },
                                    ]).map(({v,label}) => (
                                        <button key={v} type="button" onClick={()=>setHolidayDuration(v)}
                                            className={`flex-1 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${holidayDuration===v?'bg-white text-danger-700 shadow-sm':'text-ink-500 hover:text-ink-700'}`}>
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={()=>{ addHoliday(); setShowAddNameModal(false) }} disabled={!holidayName.trim()}
                                    className="flex-1 h-9 bg-danger-500 hover:bg-danger-700 text-white gap-1.5 disabled:opacity-50">
                                    <Plus className="h-4 w-4"/> Add Holiday
                                </Button>
                                <Button onClick={()=>setShowAddNameModal(false)} variant="outline" className="h-9">Cancel</Button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}

            {/* ── Working Days Modal ── */}
            {showWorkingDaysModal && (
                <motion.div key="working-days-modal" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                    onClick={()=>setShowWorkingDaysModal(false)}
                    className="fixed inset-0 z-modal bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <motion.div initial={{opacity:0,scale:0.95,y:8}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.95,y:8}}
                        onClick={e=>e.stopPropagation()}
                        className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">
                        <div className="px-5 py-4 bg-brand-700 text-white flex items-center justify-between">
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">Holiday Management</p>
                                <p className="text-[15px] font-extrabold mt-0.5">Working Days <span className="text-brand-200 text-[13px] font-semibold">({workingDaysList.length})</span></p>
                            </div>
                            <button onClick={()=>setShowWorkingDaysModal(false)} className="h-7 w-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors shrink-0"><X className="h-4 w-4"/></button>
                        </div>
                        <div className="p-4 max-h-[60vh] overflow-y-auto">
                            {workingDaysList.length === 0 ? (
                                <p className="text-center text-[13px] text-ink-400 py-6">No working days calculated yet. Set a start date and configure sessions.</p>
                            ) : (
                                <div className="space-y-1.5">
                                    {workingDaysList.map((d, i) => (
                                        <div key={i} className="flex items-center gap-3 rounded-lg border border-brand-100 bg-brand-50 px-3 py-2">
                                            <span className="h-6 w-6 rounded-full bg-brand-700 text-white text-[11px] font-extrabold flex items-center justify-center shrink-0">{i+1}</span>
                                            <span className="text-[13px] font-semibold text-brand-800">{d.toLocaleDateString('en-IN',{weekday:'short', day:'2-digit', month:'short', year:'numeric'})}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}

            {/* ── Holidays Modal ── */}
            {showHolidaysModal && (
                <motion.div key="holidays-modal" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                    onClick={()=>setShowHolidaysModal(false)}
                    className="fixed inset-0 z-modal bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <motion.div initial={{opacity:0,scale:0.95,y:8}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.95,y:8}}
                        onClick={e=>e.stopPropagation()}
                        className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">
                        <div className="px-5 py-4 bg-danger-500 text-white flex items-center justify-between">
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">Holiday Management</p>
                                <p className="text-[15px] font-extrabold mt-0.5">Holidays <span className="text-danger-500/30 text-[13px] font-semibold">({holidays.length} + {sundayHolidaysInRange.filter(s=>!holidays.some(h=>h.date===s.date)).length} Sundays)</span></p>
                            </div>
                            <button onClick={()=>setShowHolidaysModal(false)} className="h-7 w-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors shrink-0"><X className="h-4 w-4"/></button>
                        </div>
                        <div className="p-4 max-h-[60vh] overflow-y-auto">
                            {displayHolidays.length === 0 ? (
                                <p className="text-center text-[13px] text-ink-400 py-6">No holidays added yet.</p>
                            ) : (
                                <div className="space-y-1.5">
                                    {displayHolidays.map((h, i) => {
                                        const isAuto = h.id?.startsWith('__sun__')
                                        const d = new Date(h.date + 'T00:00:00')
                                        return (
                                            <div key={h.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${isAuto ? 'border-danger-50 bg-danger-50/50' : 'border-danger-50 bg-danger-50'}`}>
                                                <span className={`h-6 w-6 rounded-full text-white text-[11px] font-extrabold flex items-center justify-center shrink-0 ${isAuto ? 'bg-danger-500/40' : 'bg-danger-500'}`}>{i+1}</span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[13px] font-bold text-ink-800 truncate flex items-center gap-1.5">
                                                        {h.name}
                                                        {isAuto && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-danger-50 text-danger-500 border border-danger-500/30">Auto</span>}
                                                    </p>
                                                    <p className="text-[10px] text-ink-400">{d.toLocaleDateString('en-IN',{weekday:'short', day:'2-digit', month:'short', year:'numeric'})} · Full Day</p>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}

            </AnimatePresence>

            {/* ── Deviation (Mark Cancelled) Modal ── */}
            <AnimatePresence>
            {deviationModal && (() => {
                const iso = deviationModal
                const dObj = new Date(iso + 'T00:00:00')
                const existing = deviations.find(d => d.date === iso)
                return (
                    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                        onClick={()=>setDeviationModal(null)}
                        className="fixed inset-0 z-popover bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                        <motion.div initial={{opacity:0,scale:0.95,y:8}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.95,y:8}} transition={{type:'spring',stiffness:400,damping:30}}
                            onClick={e=>e.stopPropagation()}
                            className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">
                            <div className="px-5 py-4 bg-danger-500 text-white flex items-start justify-between">
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-widest opacity-75">Actual Calendar</p>
                                    <p className="text-[16px] font-bold mt-0.5">Mark Session Cancelled</p>
                                    <p className="text-[12px] opacity-85 mt-0.5">{dObj.toLocaleDateString('en-IN',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}</p>
                                </div>
                                <button onClick={()=>setDeviationModal(null)} className="h-7 w-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center shrink-0"><X className="h-4 w-4"/></button>
                            </div>
                            <div className="p-5 space-y-4">
                                <div className="rounded-lg bg-warn-50 border border-warn-500/30 px-3 py-2.5 text-[12px] text-warn-700">
                                    <strong>Note:</strong> Marking this day as cancelled will reschedule all planned sessions to the next available working day in the Actual Calendar. The Planned Calendar remains unchanged.
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[12px] font-bold text-ink-700">Reason for Cancellation <span className="text-danger-500">*</span></label>
                                    <textarea value={deviationReason} onChange={e=>setDeviationReason(e.target.value)}
                                        placeholder="e.g. Trainer unavailable, Client holiday, Power outage…"
                                        className="w-full h-20 text-[12px] border border-ink-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-danger-500"/>
                                </div>
                                {/* Batch scope — asked at the ONE moment the answer
                                    is known, and only of someone with a real choice.
                                    Admins (and edge-case users in no batch) pick any
                                    scope; a trainer in exactly one batch is never
                                    asked — their deviation IS that batch's; a
                                    trainer in several picks among their own. Hidden
                                    when the course has fewer than two real batches. */}
                                {realBatches.length > 1 && (() => {
                                    const restricted = !isAdmin && myRealBatches.length > 0
                                    // Single-batch trainer: statement, not question.
                                    if (restricted && myRealBatches.length === 1) {
                                        return (
                                            <div className="rounded-lg bg-info-50 border border-info-50 px-3 py-2.5 text-[12px] text-info-700">
                                                Applies to <strong>{myRealBatches[0].batchName}</strong> — your batch.
                                                Its end date alone will extend; the other batches hold.
                                            </div>
                                        )
                                    }
                                    const choices = restricted ? myRealBatches : realBatches
                                    return (
                                        <div className="space-y-2">
                                            <label className="text-[12px] font-bold text-ink-700">
                                                {restricted ? 'Does this apply to all YOUR batches?' : 'Does this apply to all batches?'}
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <div className="inline-flex rounded-lg border border-ink-200 overflow-hidden">
                                                    {([
                                                        { v: true, l: restricted ? 'Yes — all my batches' : 'Yes — all batches' },
                                                        { v: false, l: 'No — specific' },
                                                    ] as const).map(o => (
                                                        <button key={o.l} type="button"
                                                            onClick={() => setDeviationAll(o.v)}
                                                            className={`h-8 px-3 text-[12px] font-semibold transition-colors ${
                                                                deviationAll === o.v
                                                                    ? 'bg-danger-500 text-white'
                                                                    : 'text-ink-500 hover:bg-ink-50'
                                                            }`}>
                                                            {o.l}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            {!deviationAll && (
                                                <div className="flex items-center gap-3 flex-wrap pt-0.5">
                                                    {choices.map(b => {
                                                        const on = deviationSel.includes(b._id)
                                                        return (
                                                            <label key={b._id} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-700 cursor-pointer">
                                                                <input type="checkbox" checked={on}
                                                                    onChange={() => setDeviationSel(prev => on ? prev.filter(x => x !== b._id) : [...prev, b._id])}
                                                                    className="w-3.5 h-3.5 accent-danger-500" />
                                                                {b.batchName}
                                                            </label>
                                                        )
                                                    })}
                                                    <span className="text-[11px] text-ink-400">
                                                        Only these batches lose the day — their end date extends, the rest hold.
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })()}
                                <div className="flex gap-2">
                                    <button onClick={()=>setDeviationModal(null)}
                                        className="flex-1 h-9 rounded-lg border border-ink-200 text-sm font-medium text-ink-600 hover:bg-ink-50 transition-all">
                                        Cancel
                                    </button>
                                    <button onClick={()=>{
                                        if (!deviationReason.trim()) return
                                        // Mirrors the modal's branches. Note a
                                        // trainer's "all my batches" stores the ID
                                        // LIST — never [] — because empty means
                                        // course-wide, which is not theirs to say.
                                        const restricted = !isAdmin && myRealBatches.length > 0
                                        const questionShown = realBatches.length > 1 && !(restricted && myRealBatches.length === 1)
                                        if (questionShown && !deviationAll && deviationSel.length === 0) return
                                        const appliesTo = realBatches.length <= 1
                                            ? []
                                            : restricted && myRealBatches.length === 1
                                                ? [myRealBatches[0]._id]
                                                : restricted
                                                    ? (deviationAll ? myRealBatches.map(b => b._id) : deviationSel)
                                                    : (deviationAll ? [] : deviationSel)
                                        const nextDevs = existing
                                            ? deviations.map(d => d.date===iso ? {...d, reason: deviationReason.trim(), appliesTo} : d)
                                            : [...deviations, { id: uid(), date: iso, reason: deviationReason.trim(), appliesTo }]
                                        setDeviations(nextDevs)
                                        setDeviationModal(null)
                                        setDeviationReason('')
                                        if (courseId) {
                                            saveCalendar({ ...savePayload(), deviations: nextDevs }, {
                                                onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['programCalendar', courseId] }); showSaveToast('Deviation saved.') }
                                            })
                                        }
                                    }}
                                        disabled={!deviationReason.trim() || (realBatches.length > 1 && !(!isAdmin && myRealBatches.length === 1) && !deviationAll && deviationSel.length === 0)}
                                        className="flex-1 h-9 rounded-lg bg-danger-500 hover:bg-danger-700 disabled:opacity-40 text-white text-sm font-semibold transition-all active:scale-95">
                                        Confirm Cancellation
                                    </button>
                                </div>
                                {existing && (
                                    <button onClick={()=>{
                                        const nextDevs = deviations.filter(d=>d.date!==iso)
                                        setDeviations(nextDevs)
                                        setDeviationModal(null)
                                        if (courseId) {
                                            saveCalendar({ ...savePayload(), deviations: nextDevs }, {
                                                onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['programCalendar', courseId] }); showSaveToast('Cancellation removed.') }
                                            })
                                        }
                                    }}
                                        className="w-full h-8 text-[11px] font-semibold text-ink-400 hover:text-danger-700 transition-colors">
                                        Remove existing cancellation
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )
            })()}
            </AnimatePresence>

            {/* ── Save Toast Notification ── */}
            <AnimatePresence>
            {saveToast && (
                <motion.div
                    initial={{ opacity: 0, y: -24, scale: 0.94 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -16, scale: 0.94 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                    className="fixed top-6 right-6 z-toast flex items-center gap-3 bg-ink-900 text-white px-4 py-3 rounded-xl shadow-2xl min-w-[220px] max-w-xs"
                >
                    <span className="flex items-center justify-center h-6 w-6 rounded-full bg-success-500 shrink-0">
                        <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    </span>
                    <span className="text-[13px] font-semibold leading-tight">{saveToast}</span>
                    <button onClick={() => setSaveToast(null)} className="ml-auto text-white/50 hover:text-white/90 transition-colors shrink-0">
                        <X className="h-3.5 w-3.5" />
                    </button>
                </motion.div>
            )}
            </AnimatePresence>

            {/* ── Interactive Guided Tour (spotlight + bouncing arrow) ── */}
            <AnimatePresence>
            {tourStep > 0 && tourRect && (() => {
                const step = tourSteps[tourStep - 1]
                const pad = 8
                const holeTop = tourRect.top - pad
                const holeLeft = tourRect.left - pad
                const holeW = tourRect.width + pad * 2
                const holeH = tourRect.height + pad * 2
                const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
                const vh = typeof window !== 'undefined' ? window.innerHeight : 800
                const placeBelow = tourRect.top + tourRect.height / 2 < vh / 2
                const tipW = 320
                const tipLeft = Math.min(Math.max(tourRect.left + tourRect.width / 2 - tipW / 2, 12), vw - tipW - 12)
                const tipTop = placeBelow ? holeTop + holeH + 64 : holeTop - 64
                const arrowLeft = Math.min(Math.max(tourRect.left + tourRect.width / 2 - 16, 16), vw - 48)
                const arrowTop = placeBelow ? holeTop + holeH + 6 : holeTop - 6
                const isLast = tourStep === tourSteps.length
                return (
                    <motion.div key="tour-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-toast pointer-events-none">
                        {/* Spotlight hole (dims everything else via huge box-shadow) */}
                        <motion.div
                            initial={false}
                            animate={{ top: holeTop, left: holeLeft, width: holeW, height: holeH }}
                            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                            style={{ position: 'fixed', borderRadius: 14, boxShadow: '0 0 0 9999px rgba(15,23,42,0.55)' }}
                            className="pointer-events-none"
                        />
                        {/* Pulsing highlight ring */}
                        <motion.div
                            initial={false}
                            animate={{ top: holeTop, left: holeLeft, width: holeW, height: holeH, boxShadow: ['0 0 0 0px rgba(99,102,241,0.45)', '0 0 0 8px rgba(99,102,241,0)'] }}
                            transition={{ top: { type: 'spring', stiffness: 320, damping: 32 }, left: { type: 'spring', stiffness: 320, damping: 32 }, width: { type: 'spring', stiffness: 320, damping: 32 }, height: { type: 'spring', stiffness: 320, damping: 32 }, boxShadow: { duration: 1.4, repeat: Infinity } }}
                            style={{ position: 'fixed', borderRadius: 14 }}
                            className="pointer-events-none border-2 border-brand-400"
                        />
                        {/* Bouncing arrow pointing at the target */}
                        <motion.div
                            style={{ position: 'fixed', left: arrowLeft, top: arrowTop, transform: placeBelow ? 'none' : 'translateY(-100%)' }}
                            animate={{ y: placeBelow ? [0, 8, 0] : [0, -8, 0] }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
                            className="pointer-events-none"
                        >
                            <span className="flex items-center justify-center h-9 w-9 rounded-full bg-brand-700 text-white shadow-lg shadow-brand-400/50">
                                {placeBelow ? <ArrowUp className="h-5 w-5"/> : <ArrowDown className="h-5 w-5"/>}
                            </span>
                        </motion.div>
                        {/* Tooltip card */}
                        <div style={{ position: 'fixed', left: tipLeft, top: tipTop, width: tipW, transform: placeBelow ? 'none' : 'translateY(-100%)' }} className="pointer-events-auto">
                            <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }}
                                transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                                className="bg-white rounded-2xl shadow-2xl border border-brand-100 overflow-hidden">
                                <div className="px-4 py-3 bg-gradient-to-r from-brand-700 to-info-700 text-white flex items-center gap-2.5">
                                    <span className="h-7 w-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0 text-[12px] font-extrabold">{tourStep}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80 leading-none">Step {tourStep} of {tourSteps.length}</p>
                                        <p className="text-[13px] font-extrabold leading-tight mt-0.5">{step.title}</p>
                                    </div>
                                </div>
                                <div className="px-4 py-3">
                                    <p className="text-[12px] text-ink-600 leading-relaxed">{step.desc}</p>
                                    {/* Progress dots */}
                                    <div className="flex items-center gap-1.5 mt-3">
                                        {tourSteps.map((_, i) => (
                                            <span key={i} className={`h-1.5 rounded-full transition-all ${i === tourStep - 1 ? 'w-5 bg-brand-700' : 'w-1.5 bg-ink-200'}`}/>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-center justify-between gap-2 px-4 pb-3.5">
                                    <button onClick={() => endTour(true)} className="text-[11px] font-semibold text-ink-400 hover:text-ink-600 transition-colors">
                                        Don't show again
                                    </button>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => endTour(false)} className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-ink-500 hover:bg-ink-100 transition-colors">
                                            Skip
                                        </button>
                                        <button onClick={() => isLast ? endTour(false) : setTourStep(s => s + 1)}
                                            className="flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-brand-700 hover:bg-brand-800 text-white text-[12px] font-semibold active:scale-95 transition-all shadow-sm">
                                            {isLast ? <>Finish <Sparkles className="h-3.5 w-3.5"/></> : <>Next <ChevronRight className="h-3.5 w-3.5"/></>}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>
                )
            })()}
            </AnimatePresence>

            {/* ── Reset Confirmation Modal ── */}
            <AnimatePresence>
            {resetConfirm && (
                <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                    className="fixed inset-0 z-popover bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={()=>{ if (!isDeleting) setResetConfirm(false) }}>
                    <motion.div initial={{opacity:0,scale:0.92,y:16}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.92,y:16}}
                        transition={{type:'spring',stiffness:420,damping:28}}
                        onClick={e=>e.stopPropagation()}
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                        {/* Header */}
                        <div className="px-6 py-5 bg-danger-500 text-white">
                            <div className="flex items-center gap-3">
                                <span className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                                    <RotateCcw className="h-5 w-5 text-white"/>
                                </span>
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">Confirm Reset</p>
                                    <p className="text-[16px] font-extrabold leading-tight">Reset Program Calendar?</p>
                                </div>
                            </div>
                        </div>
                        {/* Body */}
                        <div className="px-6 py-5 space-y-3">
                            <p className="text-[13px] text-ink-600 leading-relaxed">
                                This will <span className="font-semibold text-danger-700">permanently delete</span> all saved calendar data for this course from the database, including:
                            </p>
                            <ul className="space-y-1.5">
                                {['Start date & working days', 'All sessions and breaks', 'All holidays', 'All deviations'].map(item => (
                                    <li key={item} className="flex items-center gap-2 text-[12px] text-ink-500">
                                        <X className="h-3.5 w-3.5 text-danger-500 shrink-0"/> {item}
                                    </li>
                                ))}
                            </ul>
                            <p className="text-[11px] font-semibold text-danger-500 bg-danger-50 border border-danger-50 rounded-lg px-3 py-2">
                                This action cannot be undone.
                            </p>
                        </div>
                        {/* Footer */}
                        <div className="flex gap-2 px-6 pb-5">
                            <button onClick={()=>setResetConfirm(false)} disabled={isDeleting}
                                className="flex-1 h-10 rounded-xl border border-ink-200 text-ink-700 text-[13px] font-semibold hover:bg-ink-50 active:scale-95 transition-all disabled:opacity-50">
                                Cancel
                            </button>
                            <button onClick={handleReset} disabled={isDeleting}
                                className="flex-1 h-10 rounded-xl bg-danger-500 hover:bg-danger-700 text-white text-[13px] font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-70 shadow-sm shadow-danger-500/30">
                                {isDeleting
                                    ? <><div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin"/> Resetting…</>
                                    : <><RotateCcw className="h-4 w-4"/> Yes, Reset Everything</>}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
            </AnimatePresence>

        </Shell>
    )
}
















