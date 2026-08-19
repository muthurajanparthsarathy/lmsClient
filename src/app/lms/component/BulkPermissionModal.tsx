"use client"
import { getToken } from "@/lib/session";
import { API_BASE_URL } from "@/lib/http";
import { useState, useEffect, useRef } from "react"
import {
  Dialog, DialogContent, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "react-toastify"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Check, X, Save, Loader2, Users, Search, ChevronDown, UserX,
  ShieldCheck, Filter, RotateCcw, Zap,
} from "lucide-react"
import {
  TreePermissionSelector,
  storedFromSelection,
  type SelectionState,
} from "@/components/permissions/TreePermissionSelector"

// ─── Types ────────────────────────────────────────────────────────────────────

interface User {
  id: string; firstName: string; lastName: string; email: string
  role: string; roleId: string; degree?: string; department?: string
  year?: string; batch?: string; semester?: string
  // Student-only: a student is added under a client and one of that client's
  // service models. Staff and admin users carry neither.
  clientName?: string; serviceModel?: string
  status: "active" | "inactive"; gender?: string
}

interface Role { _id: string; renameRole: string; originalRole: string }

interface BulkPermissionModalProps {
  isOpen: boolean; onClose: () => void; availableUsers: User[]
  roles: Role[]; basedOn: string | null; preSelectedUser?: User | null
  // When provided, the catalog is limited to permissions whose id is in this
  // list — used to constrain bulk-assign to an institution's allow-list (set
  // by the Super Admin via Clients → Permission Management). Omit for the
  // full catalog. An empty array shows nothing.
  allowedIds?: string[]
  // When provided, each permission's `functionalities` is limited to the
  // function ids in this map (keyed by permission id) — so bulk-assign only
  // offers the functions the institution enabled. Omit for all functions.
  allowedFunctions?: Record<string, string[]>
}

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700", "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700", "bg-orange-100 text-orange-700",
  "bg-pink-100 text-pink-700", "bg-teal-100 text-teal-700",
]

// ─── Small helpers ─────────────────────────────────────────────────────────────

function useOutsideClose(ref: React.RefObject<HTMLElement | null>, cb: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) cb() }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])
}

function initials(u: User) { return `${u.firstName?.[0] ?? ""}${u.lastName?.[0] ?? ""}`.toUpperCase() }
function avatarBg(id: string) { return AVATAR_COLORS[id.charCodeAt(0) % AVATAR_COLORS.length] }

// ─── Tiny checkbox ─────────────────────────────────────────────────────────────

function Tick({ checked, color = "bg-orange-500", size = 14, onClick }: { checked: boolean; color?: string; size?: number; onClick?: (e: React.MouseEvent) => void }) {
  return (
    <div
      onClick={onClick}
      style={{ width: size, height: size, flexShrink: 0 }}
      className={`rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${checked ? `${color} border-transparent` : "border-gray-300 dark:border-gray-600 hover:border-gray-400 bg-white dark:bg-gray-800"}`}
    >
      {checked && <Check style={{ width: size * 0.6, height: size * 0.6 }} className="text-white" strokeWidth={3} />}
    </div>
  )
}

// ─── Filter dropdown ───────────────────────────────────────────────────────────

function FilterDropdown({ placeholder, options, selected, onChange }: { placeholder: string; options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutsideClose(ref, () => setOpen(false))

  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v])

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} type="button"
        className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${selected.length > 0 ? "border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 font-medium" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 hover:border-gray-300"}`}>
        <span className="truncate">{selected.length === 0 ? placeholder : selected.length > 1 ? `${selected.length} selected` : selected[0]}</span>
        <div className="flex items-center gap-1 ml-1 flex-shrink-0">
          {selected.length > 0 && <span className="w-3.5 h-3.5 rounded-full bg-orange-500 text-white text-[9px] flex items-center justify-center font-bold leading-none">{selected.length}</span>}
          <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 w-full min-w-[140px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden">
          <div className="flex border-b border-gray-100 dark:border-gray-700">
            <button onClick={() => onChange([...options])} className="flex-1 text-[10px] py-1.5 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30 font-semibold transition-colors">All</button>
            <button onClick={() => onChange([])} className="flex-1 text-[10px] py-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 font-semibold transition-colors">Clear</button>
          </div>
          <div className="max-h-40 overflow-y-auto">
            {options.map(opt => (
              <label key={opt} onClick={() => toggle(opt)} className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                <Tick checked={selected.includes(opt)} size={12} />
                <span className="text-xs text-gray-700 dark:text-gray-300 capitalize truncate">{opt}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function RoleDropdown({ roles, selected, onChange }: { roles: Role[]; selected: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutsideClose(ref, () => setOpen(false))

  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])
  const names = roles.filter(r => selected.includes(r._id)).map(r => r.renameRole)

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} type="button"
        className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${selected.length > 0 ? "border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 font-medium" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 hover:border-gray-300"}`}>
        <span className="truncate">{selected.length === 0 ? "All Roles" : selected.length > 1 ? `${selected.length} roles` : names[0]}</span>
        <div className="flex items-center gap-1 ml-1 flex-shrink-0">
          {selected.length > 0 && <span className="w-3.5 h-3.5 rounded-full bg-orange-500 text-white text-[9px] flex items-center justify-center font-bold leading-none">{selected.length}</span>}
          <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 w-full min-w-[160px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden">
          <div className="flex border-b border-gray-100 dark:border-gray-700">
            <button onClick={() => onChange(roles.map(r => r._id))} className="flex-1 text-[10px] py-1.5 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30 font-semibold transition-colors">All</button>
            <button onClick={() => onChange([])} className="flex-1 text-[10px] py-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 font-semibold transition-colors">Clear</button>
          </div>
          <div className="max-h-40 overflow-y-auto">
            {roles.map(r => (
              <label key={r._id} onClick={() => toggle(r._id)} className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                <Tick checked={selected.includes(r._id)} size={12} />
                <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{r.renameRole}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────

export function BulkPermissionModal({ isOpen, onClose, availableUsers, roles, basedOn, preSelectedUser, allowedIds, allowedFunctions }: BulkPermissionModalProps) {
  // User selection
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [roleFilters, setRoleFilters] = useState<string[]>([])
  const [statusFilters, setStatusFilters] = useState<string[]>([])
  const [degreeFilters, setDegreeFilters] = useState<string[]>([])
  const [deptFilters, setDeptFilters] = useState<string[]>([])
  const [yearFilters, setYearFilters] = useState<string[]>([])
  const [batchFilters, setBatchFilters] = useState<string[]>([])
  const [clientFilters, setClientFilters] = useState<string[]>([])
  const [serviceFilters, setServiceFilters] = useState<string[]>([])
  const [showSelected, setShowSelected] = useState(false)

  // Permission selection — tree-driven
  const [selection, setSelection] = useState<SelectionState>({})
  const [category, setCategory] = useState<'all' | 'admin' | 'staff' | 'student'>('all')
  const [permSearch, setPermSearch] = useState("")

  const queryClient = useQueryClient()
  const token = typeof window !== "undefined" ? getToken() : null

  // Unique filter options
  const uniqueDegrees = [...new Set(availableUsers.map(u => u.degree).filter(Boolean) as string[])]
  const uniqueDepts   = [...new Set(availableUsers.map(u => u.department).filter(Boolean) as string[])]
  const uniqueYears   = [...new Set(availableUsers.map(u => u.year).filter(Boolean) as string[])]
  const uniqueBatches = [...new Set(availableUsers.map(u => u.batch).filter(Boolean) as string[])]

  // Client / Service Model are student-only, so the pair of filters only shows
  // once a Student role is picked -- on staff and admin rows both fields are
  // empty and the dropdowns would be dead. Same name-match the Add User form
  // uses to decide a client is required (usermanagement/page.tsx).
  const isStudentRoleId = (id: string) => {
    const r = roles.find(x => x._id === id)
    return (r?.renameRole?.toLowerCase() || "").includes("student") ||
           (r?.originalRole?.toLowerCase() || "").includes("student")
  }
  const studentRoleSelected = roleFilters.some(isStudentRoleId)
  // Options come from the students of the selected role(s) only, so the lists
  // never offer a client or model with nobody behind it.
  const studentScope = availableUsers.filter(u => roleFilters.includes(u.roleId) && isStudentRoleId(u.roleId))
  const uniqueClients = [...new Set(studentScope.map(u => u.clientName).filter(Boolean) as string[])].sort()
  // Service Model cascades off Client: each client runs its own set of models,
  // so picking a client narrows this list to that client's models -- a client
  // with only TD offers only TD, one running HTD and TD offers both. With no
  // client picked it falls back to every model across the students in scope.
  const serviceScope = clientFilters.length
    ? studentScope.filter(u => u.clientName && clientFilters.includes(u.clientName))
    : studentScope
  const uniqueServiceModels = [...new Set(serviceScope.map(u => u.serviceModel).filter(Boolean) as string[])].sort()

  // Deselecting the Student role hides both dropdowns; leaving their values set
  // would keep shrinking the list with nothing on screen to explain it.
  useEffect(() => {
    if (!studentRoleSelected && (clientFilters.length || serviceFilters.length)) {
      setClientFilters([])
      setServiceFilters([])
    }
  }, [studentRoleSelected])

  // Switching client can strip models the previous one had. A model left
  // selected that the new client does not run would filter the list down to
  // nothing with no visible cause, so drop the picks that no longer apply.
  useEffect(() => {
    if (!serviceFilters.length) return
    const stillValid = serviceFilters.filter(m => uniqueServiceModels.includes(m))
    if (stillValid.length !== serviceFilters.length) setServiceFilters(stillValid)
  }, [clientFilters])

  const activeFilters = roleFilters.length + statusFilters.length + degreeFilters.length + deptFilters.length + yearFilters.length + batchFilters.length + clientFilters.length + serviceFilters.length

  const filteredUsers = availableUsers.filter(u => {
    const q = searchTerm.toLowerCase()
    return (
      (!q || u.firstName.toLowerCase().includes(q) || u.lastName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) &&
      (!roleFilters.length   || roleFilters.includes(u.roleId)) &&
      (!statusFilters.length || statusFilters.includes(u.status)) &&
      (!degreeFilters.length || (u.degree && degreeFilters.includes(u.degree))) &&
      (!deptFilters.length   || (u.department && deptFilters.includes(u.department))) &&
      (!yearFilters.length   || (u.year && yearFilters.includes(u.year))) &&
      (!batchFilters.length  || (u.batch && batchFilters.includes(u.batch))) &&
      (!clientFilters.length  || (u.clientName && clientFilters.includes(u.clientName))) &&
      (!serviceFilters.length || (u.serviceModel && serviceFilters.includes(u.serviceModel)))
    )
  })

  const displayUsers = showSelected
    ? availableUsers.filter(u => selectedUsers.includes(u.id))
    : filteredUsers

  const allFilteredSelected = filteredUsers.length > 0 && filteredUsers.every(u => selectedUsers.includes(u.id))

  useEffect(() => {
    if (preSelectedUser && !selectedUsers.includes(preSelectedUser.id)) {
      setSelectedUsers([preSelectedUser.id])
    }
  }, [preSelectedUser])

  const toggleUser = (id: string) => setSelectedUsers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const toggleAllFiltered = () => {
    if (allFilteredSelected) {
      setSelectedUsers(prev => prev.filter(id => !filteredUsers.some(u => u.id === id)))
    } else {
      setSelectedUsers(prev => { const next = [...prev]; filteredUsers.forEach(u => { if (!next.includes(u.id)) next.push(u.id) }); return next })
    }
  }

  const clearAllPerms = () => setSelection({})

  const selectedPermCount = Object.keys(selection).length
  const totalFuncs = Object.values(selection).reduce((a, b) => a + b.size, 0)

  const resetFilters = () => { setSearchTerm(""); setRoleFilters([]); setStatusFilters([]); setDegreeFilters([]); setDeptFilters([]); setYearFilters([]); setBatchFilters([]); setClientFilters([]); setServiceFilters([]) }

  const mutation = useMutation({
    mutationFn: async (payload: { userId: string; permissions: any[] }[]) => {
      const r = await fetch(`${API_BASE_URL}/user-permission/bulk-update`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ userPermissions: payload }),
      })
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message?.[0]?.value || "Failed") }
      return r.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
      toast.success(`Permissions updated for ${data.data?.summary?.successful || selectedUsers.length} users`)
      onClose()
      setSelectedUsers([]); setSelection({})
    },
    onError: (e: any) => toast.error(e.message || "Failed to update permissions"),
  })

  const handleSave = () => {
    if (!selectedUsers.length) { toast.error("Select at least one user"); return }
    if (!Object.keys(selection).length) { toast.error("Select at least one permission"); return }
    const permissions = storedFromSelection(selection)
    mutation.mutate(selectedUsers.map(userId => ({ userId, permissions })))
  }

  const canSave = selectedUsers.length > 0 && Object.keys(selection).length > 0
  const isReady = canSave

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[96vw] w-[1200px] max-h-[92vh] p-0 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl bg-gray-50 dark:bg-gray-950 gap-0">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-none">Bulk Permission Assignment</DialogTitle>
              <DialogDescription className="text-xs text-gray-400 mt-0.5">Assign permissions to multiple users at once</DialogDescription>
            </div>
          </div>
          {/* Stats */}
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${selectedUsers.length > 0 ? "bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-950/40 dark:border-orange-800 dark:text-orange-300" : "bg-gray-100 border-gray-200 text-gray-400 dark:bg-gray-800 dark:border-gray-700"}`}>
              <Users className="w-3 h-3" />{selectedUsers.length} users
            </span>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${selectedPermCount > 0 ? "bg-violet-50 border-violet-200 text-violet-700 dark:bg-violet-950/40 dark:border-violet-800 dark:text-violet-300" : "bg-gray-100 border-gray-200 text-gray-400 dark:bg-gray-800 dark:border-gray-700"}`}>
              <ShieldCheck className="w-3 h-3" />{selectedPermCount} perms
            </span>
            {totalFuncs > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300">
                <Zap className="w-3 h-3" />{totalFuncs} fns
              </span>
            )}
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="flex flex-1 min-h-0 overflow-hidden" style={{ height: "calc(92vh - 108px)" }}>

          {/* ──── LEFT: User panel (narrower) ──────────────────────────── */}
          <div className="w-[320px] flex-shrink-0 flex flex-col min-h-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">

            {/* Search row */}
            <div className="flex-shrink-0 p-3 border-b border-gray-100 dark:border-gray-800 space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input
                  value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search users…"
                  className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400"
                />
                {searchTerm && <button onClick={() => setSearchTerm("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"><X className="w-3 h-3" /></button>}
              </div>

              {/* Filter toggle + tabs */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors ${showFilters || activeFilters > 0 ? "bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                >
                  <Filter className="w-3 h-3" />
                  Filters
                  {activeFilters > 0 && <span className="w-3.5 h-3.5 rounded-full bg-orange-500 text-white text-[9px] flex items-center justify-center font-bold">{activeFilters}</span>}
                </button>

                {/* View toggle */}
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg">
                  <button onClick={() => setShowSelected(false)} className={`px-2 py-0.5 text-[11px] font-medium rounded-md transition-colors ${!showSelected ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm" : "text-gray-500"}`}>
                    All {!showSelected && <span className="text-[10px] text-gray-400">({filteredUsers.length})</span>}
                  </button>
                  <button onClick={() => setShowSelected(true)} className={`px-2 py-0.5 text-[11px] font-medium rounded-md transition-colors ${showSelected ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm" : "text-gray-500"}`}>
                    Selected {showSelected && <span className="text-[10px] text-gray-400">({selectedUsers.length})</span>}
                    {selectedUsers.length > 0 && !showSelected && <span className="ml-1 w-4 h-4 inline-flex items-center justify-center rounded-full bg-orange-500 text-white text-[9px] font-bold">{selectedUsers.length}</span>}
                  </button>
                </div>
              </div>

              {/* Filter panel */}
              {showFilters && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-2.5 space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div><p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Role</p><RoleDropdown roles={roles} selected={roleFilters} onChange={setRoleFilters} /></div>
                    <div><p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Status</p><FilterDropdown placeholder="All" options={["active", "inactive"]} selected={statusFilters} onChange={setStatusFilters} /></div>
                    {/* Student-only: narrow to one client's students, or to a
                        single service model within them, before assigning. */}
                    {studentRoleSelected && uniqueClients.length > 0 && (
                      <div><p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Client</p><FilterDropdown placeholder="All" options={uniqueClients} selected={clientFilters} onChange={setClientFilters} /></div>
                    )}
                    {studentRoleSelected && uniqueServiceModels.length > 0 && (
                      <div><p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Service Model</p><FilterDropdown placeholder="All" options={uniqueServiceModels} selected={serviceFilters} onChange={setServiceFilters} /></div>
                    )}
                    {basedOn === "college" && uniqueDegrees.length > 0 && (
                      <div><p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Degree</p><FilterDropdown placeholder="All" options={uniqueDegrees} selected={degreeFilters} onChange={setDegreeFilters} /></div>
                    )}
                    {basedOn === "college" && uniqueDepts.length > 0 && (
                      <div><p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Dept</p><FilterDropdown placeholder="All" options={uniqueDepts} selected={deptFilters} onChange={setDeptFilters} /></div>
                    )}
                    {basedOn === "college" && uniqueYears.length > 0 && (
                      <div><p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Year</p><FilterDropdown placeholder="All" options={uniqueYears} selected={yearFilters} onChange={setYearFilters} /></div>
                    )}
                    {basedOn === "college" && uniqueBatches.length > 0 && (
                      <div><p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Batch</p><FilterDropdown placeholder="All" options={uniqueBatches} selected={batchFilters} onChange={setBatchFilters} /></div>
                    )}
                  </div>
                  {activeFilters > 0 && (
                    <button onClick={resetFilters} className="flex items-center gap-1 text-[11px] text-red-500 hover:text-red-700 font-medium transition-colors">
                      <RotateCcw className="w-3 h-3" /> Reset filters
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Select-all row */}
            {!showSelected && (
              <div className="flex-shrink-0 flex items-center justify-between px-3 py-1.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/30">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <Tick checked={allFilteredSelected} size={13} onClick={toggleAllFiltered} />
                  <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">Select all ({filteredUsers.length})</span>
                </label>
                {selectedUsers.length > 0 && (
                  <button onClick={() => setSelectedUsers([])} className="text-[11px] text-red-500 hover:text-red-700 font-medium flex items-center gap-0.5 transition-colors">
                    <X className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>
            )}

            {/* User list */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-2 space-y-1">
                {displayUsers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-2">
                      <UserX className="w-5 h-5 text-gray-300" />
                    </div>
                    <p className="text-xs font-medium text-gray-500">{showSelected ? "No users selected" : "No users found"}</p>
                    {!showSelected && <p className="text-[11px] text-gray-400 mt-0.5">Adjust your search or filters</p>}
                  </div>
                ) : (
                  displayUsers.map(user => {
                    const isSel = selectedUsers.includes(user.id)
                    const userRole = roles.find(r => r._id === user.roleId)
                    return (
                      <div
                        key={user.id}
                        onClick={() => toggleUser(user.id)}
                        className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-all border ${isSel ? "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800" : "bg-white dark:bg-gray-800/40 border-transparent hover:border-gray-200 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"}`}
                      >
                        <Tick checked={isSel} size={13} />
                        <div className={`w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-[11px] font-bold ${avatarBg(user.id)}`}>
                          {initials(user)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">{user.firstName} {user.lastName}</p>
                            <span className={`flex-shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full leading-none ${user.status === "active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" : "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400"}`}>
                              {user.status}
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
                          <p className="text-[10px] text-gray-400">{userRole?.renameRole || user.role}</p>
                        </div>
                        {showSelected && (
                          <button onClick={e => { e.stopPropagation(); toggleUser(user.id) }} className="flex-shrink-0 w-5 h-5 rounded-md hover:bg-red-100 dark:hover:bg-red-950/30 flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors">
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </ScrollArea>
          </div>

          {/* ──── RIGHT: Permissions tree ────────────────────────────────── */}
          <div className="flex-1 flex flex-col min-h-0">

            {/* Permissions toolbar */}
            <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
              {/* Search perms */}
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input
                  value={permSearch} onChange={e => setPermSearch(e.target.value)}
                  placeholder="Search permissions…"
                  className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400"
                />
                {permSearch && <button onClick={() => setPermSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"><X className="w-3 h-3" /></button>}
              </div>

              {/* Category tabs */}
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg">
                {(['all', 'admin', 'staff', 'student'] as const).map(c => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors capitalize ${category === c ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
                  >
                    {c === 'all' ? 'All' : c[0].toUpperCase() + c.slice(1)}
                  </button>
                ))}
              </div>

              <button
                onClick={clearAllPerms}
                className="ml-auto flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 rounded-lg border border-red-200 dark:border-red-800 transition-colors"
              >
                Clear all
              </button>
            </div>

            {/* Tree body */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-3">
                <TreePermissionSelector
                  selection={selection}
                  onChange={setSelection}
                  category={category}
                  search={permSearch}
                  allowedIds={allowedIds}
                  allowedFunctions={allowedFunctions}
                />
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
          {/* Status */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${isReady ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400" : "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400"}`}>
            {isReady ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Ready — <strong>{selectedPermCount}</strong> permissions{totalFuncs > 0 ? ` & ${totalFuncs} functions` : ""} for <strong>{selectedUsers.length}</strong> user{selectedUsers.length !== 1 ? "s" : ""}</span>
              </>
            ) : (
              <>
                <span className="w-3.5 h-3.5 rounded-full border-2 border-amber-400 flex items-center justify-center text-[9px] font-bold">!</span>
                <span>{selectedUsers.length === 0 ? "Select at least one user to continue" : "Select at least one permission to continue"}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { setSelectedUsers([]); setSelection({}) }}
              disabled={!selectedUsers.length && !selectedPermCount}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
            <button
              onClick={onClose}
              disabled={mutation.isPending}
              className="px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={mutation.isPending || !canSave}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 disabled:cursor-not-allowed rounded-lg shadow-sm shadow-orange-500/20 transition-colors"
            >
              {mutation.isPending
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Assigning…</>
                : <><Save className="w-3.5 h-3.5" /> Assign Permissions</>
              }
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
