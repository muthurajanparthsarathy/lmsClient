"use client"
import { getToken } from "@/lib/session";

import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Search, Loader2, Users, Check } from 'lucide-react'
import { serviceMappingApi, type ServiceMapping } from '@/apiServices/serviceMappingService'
import { fetchUsers, addParticipantsToCourse } from '@/apiServices/userService'
import { toast } from 'sonner'

// Enroll students into a course by picking one of the client's SERVICES first —
// a client (e.g. Karpagam) can have several degree programs, each its own service
// with its own service id, so the picker lists them all by service id. The chosen
// service's master data drives the degree ▸ department ▸ section filter (section
// optional), and students matching that hierarchy for this client are shown to
// enroll. Deliberately standalone: it reuses the same fetch + enroll APIs as the
// existing EnrollmentTab without touching it.

const eq = (a: unknown, b?: string) =>
    !b || String(a ?? '').trim().toLowerCase() === String(b).trim().toLowerCase()
const roleNameOf = (u: Record<string, unknown>) =>
    (typeof u?.role === 'string' ? u.role : (u?.role as { renameRole?: string })?.renameRole || '').toLowerCase()

type Student = { _id?: string; id?: string; name?: string; email?: string; enrollmentNumber?: string } & Record<string, unknown>

export default function EnrollUsersModal({
    open,
    onClose,
    courseId,
    clientId,
    clientName,
    batchName,
    onEnrolled,
}: {
    open: boolean
    onClose: () => void
    courseId: string
    clientId: string
    clientName: string
    batchName?: string
    onEnrolled?: () => void
}) {
    const [services, setServices] = useState<ServiceMapping[]>([])
    const [serviceId, setServiceId] = useState('')
    const [degree, setDegree] = useState('')
    const [department, setDepartment] = useState('')
    const [section, setSection] = useState('')
    const [students, setStudents] = useState<Student[]>([])
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [search, setSearch] = useState('')
    const [loadingServices, setLoadingServices] = useState(false)
    const [loadingStudents, setLoadingStudents] = useState(false)
    const [enrolling, setEnrolling] = useState(false)
    const [didSearch, setDidSearch] = useState(false)

    // The client's services, each carrying its own service id.
    useEffect(() => {
        if (!open || !clientId) return
        let cancelled = false
        setLoadingServices(true)
        serviceMappingApi
            .getByClient(clientId)
            .then((res) => { if (!cancelled) setServices(res.data || []) })
            .catch(() => { if (!cancelled) setServices([]) })
            .finally(() => { if (!cancelled) setLoadingServices(false) })
        return () => { cancelled = true }
    }, [open, clientId])

    // Reset everything each time the modal opens.
    useEffect(() => {
        if (!open) return
        setServiceId(''); setDegree(''); setDepartment(''); setSection('')
        setStudents([]); setSelected(new Set()); setSearch(''); setDidSearch(false)
    }, [open])

    const activeService = useMemo(() => services.find((s) => s._id === serviceId), [services, serviceId])

    // Each degree-program service is single-degree, so its master data lists the
    // one degree plus its departments and sections directly.
    const valuesAt = (level: string): string[] => {
        const md = activeService?.masterData || []
        return md
            .filter((m) => String(m.level).toLowerCase() === level.toLowerCase())
            .flatMap((m) => m.values || [])
    }
    const degrees = activeService ? valuesAt('Degree') : []
    const departments = activeService ? valuesAt('Department') : []
    const sections = activeService ? valuesAt('Section') : []

    // Pick the service's sole degree automatically; clear lower levels on change.
    useEffect(() => {
        const degs = activeService ? valuesAt('Degree') : []
        setDegree(degs.length === 1 ? degs[0] : '')
        setDepartment(''); setSection(''); setStudents([]); setSelected(new Set()); setDidSearch(false)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serviceId])

    const serviceLabel = (s: ServiceMapping): string => {
        const deg = (s.masterData || []).find((m) => String(m.level).toLowerCase() === 'degree')?.values?.[0]
        const model = (s.serviceModels || [])[0] || s.service || ''
        return [s.serviceCode || '(no id)', deg || model].filter(Boolean).join('  ·  ')
    }

    const loadStudents = async () => {
        if (!serviceId) { toast.error('Pick a service'); return }
        if (!degree || !department) { toast.error('Degree and department are required'); return }
        const institutionId = localStorage.getItem('smartcliff_institution') || ''
        const token = getToken() || ''
        const basedOn = localStorage.getItem('smartcliff_basedOn') || ''
        setLoadingStudents(true)
        setDidSearch(true)
        try {
            const res = await fetchUsers(institutionId, token, basedOn)
            const all: Student[] = res?.users || []
            const filtered = all.filter((u) =>
                roleNameOf(u) === 'student' &&
                (eq(u.clientId, clientId) || eq(u.clientName, clientName)) &&
                eq(u.degree, degree) &&
                eq(u.department, department) &&
                eq(u.section, section),
            )
            setStudents(filtered)
            setSelected(new Set())
        } catch {
            toast.error('Failed to load students')
            setStudents([])
        } finally {
            setLoadingStudents(false)
        }
    }

    const shown = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return students
        return students.filter((u) =>
            [u.name, u.email, u.enrollmentNumber].filter(Boolean).join(' ').toLowerCase().includes(q))
    }, [students, search])

    const idOf = (u: Student) => String(u._id || u.id || '')
    const toggle = (id: string) => setSelected((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id); else next.add(id)
        return next
    })
    const allShownSelected = shown.length > 0 && shown.every((u) => selected.has(idOf(u)))
    const toggleAll = () => setSelected((prev) => {
        const next = new Set(prev)
        if (allShownSelected) shown.forEach((u) => next.delete(idOf(u)))
        else shown.forEach((u) => next.add(idOf(u)))
        return next
    })

    const enroll = async () => {
        if (!selected.size) { toast.error('Select at least one student'); return }
        const institutionId = localStorage.getItem('smartcliff_institution') || ''
        const token = getToken() || ''
        setEnrolling(true)
        try {
            await addParticipantsToCourse(
                courseId, Array.from(selected), institutionId, token,
                { status: 'active' }, batchName, { degree, department, section },
            )
            toast.success(`Enrolled ${selected.size} student${selected.size > 1 ? 's' : ''}`)
            onEnrolled?.()
            onClose()
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Enrollment failed')
        } finally {
            setEnrolling(false)
        }
    }

    if (!open) return null

    const selectCls = 'h-9 w-full rounded-lg border border-hairline-strong px-2.5 text-[13px] text-ink-800 bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 focus:outline-none disabled:bg-ink-50 disabled:text-faint'

    return createPortal(
        <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
            <div
                className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl bg-white shadow-xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-hairline">
                    <div className="flex items-center gap-2">
                        <Users size={16} className="text-brand-strong" />
                        <h3 className="text-sm font-semibold text-heading">Enroll Users</h3>
                        {clientName && <span className="text-xs text-faint">· {clientName}</span>}
                    </div>
                    <button type="button" onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-faint hover:bg-ink-100 hover:text-ink-600 transition-colors" aria-label="Close">
                        <X size={15} />
                    </button>
                </div>

                <div className="px-5 py-4 space-y-3 border-b border-hairline">
                    <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wide text-subtle mb-1">
                            Service <span className="text-danger-500">*</span>
                        </label>
                        <select className={selectCls} value={serviceId} onChange={(e) => setServiceId(e.target.value)} disabled={loadingServices}>
                            <option value="">{loadingServices ? 'Loading services…' : services.length ? 'Select a service…' : 'No services for this client'}</option>
                            {services.map((s) => (
                                <option key={s._id} value={s._id}>{serviceLabel(s)}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wide text-subtle mb-1">Degree <span className="text-danger-500">*</span></label>
                            <select className={selectCls} value={degree} onChange={(e) => { setDegree(e.target.value); setDepartment(''); setSection('') }} disabled={!activeService}>
                                <option value="">Select…</option>
                                {degrees.map((d) => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wide text-subtle mb-1">Department <span className="text-danger-500">*</span></label>
                            <select className={selectCls} value={department} onChange={(e) => { setDepartment(e.target.value); setSection('') }} disabled={!degree}>
                                <option value="">Select…</option>
                                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wide text-subtle mb-1">Section <span className="text-ink-300">(optional)</span></label>
                            <select className={selectCls} value={section} onChange={(e) => setSection(e.target.value)} disabled={!department || sections.length === 0}>
                                <option value="">{sections.length ? 'All / Select…' : 'None'}</option>
                                {sections.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={loadStudents}
                        disabled={loadingStudents || !serviceId || !degree || !department}
                        className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-brand-700 text-white text-[12.5px] font-semibold hover:bg-brand-800 disabled:opacity-50 transition-colors"
                    >
                        {loadingStudents ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                        Find students
                    </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3">
                    {!didSearch ? (
                        <p className="text-[13px] text-faint py-6 text-center">Pick a service and hierarchy, then Find students.</p>
                    ) : loadingStudents ? (
                        <p className="text-[13px] text-faint py-6 text-center">Loading students…</p>
                    ) : students.length === 0 ? (
                        <p className="text-[13px] text-faint py-6 text-center">No students match this client and hierarchy.</p>
                    ) : (
                        <>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="relative flex-1">
                                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
                                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, enrollment no." className="h-8 w-full rounded-lg border border-hairline-strong pl-8 pr-2.5 text-[12.5px] focus:border-brand-500 focus:outline-none" />
                                </div>
                                <button type="button" onClick={toggleAll} className="text-[12px] font-medium text-brand-strong hover:text-brand-700 whitespace-nowrap">
                                    {allShownSelected ? 'Clear' : 'Select all'}
                                </button>
                            </div>
                            <div className="space-y-1">
                                {shown.map((u) => {
                                    const id = idOf(u)
                                    const on = selected.has(id)
                                    return (
                                        <button key={id} type="button" onClick={() => toggle(id)} className={`w-full flex items-center gap-2.5 px-2.5 h-10 rounded-lg text-left transition-colors ${on ? 'bg-brand-wash' : 'hover:bg-row-hover'}`}>
                                            <span className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border ${on ? 'bg-brand-700 border-brand-700' : 'border-ink-300'}`}>
                                                {on && <Check size={11} className="text-white" />}
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-[13px] text-ink-800 truncate">{u.name || '(no name)'}</span>
                                                <span className="block text-[11px] text-faint truncate">{[u.enrollmentNumber, u.email].filter(Boolean).join(' · ')}</span>
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>
                        </>
                    )}
                </div>

                <div className="flex items-center justify-between px-5 py-3 border-t border-hairline">
                    <span className="text-[12.5px] text-subtle">{selected.size} selected</span>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={onClose} className="h-9 px-3.5 rounded-lg text-[12.5px] font-medium text-ink-600 hover:bg-ink-100 transition-colors">Cancel</button>
                        <button type="button" onClick={enroll} disabled={enrolling || selected.size === 0} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-brand-700 text-white text-[12.5px] font-semibold hover:bg-brand-800 disabled:opacity-50 transition-colors">
                            {enrolling ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
                            Enroll {selected.size > 0 ? selected.size : ''} to course
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body,
    )
}
