"use client"

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Poppins } from 'next/font/google'
import { toast } from 'sonner'
import {
  ArrowLeft, Search, Filter, Eye, Pencil, Users,
  Home, BookMarked, GitBranch, Layers, ChevronDown, ChevronRight,
  Calendar, Clock, UserPlus, GraduationCap, Building2, LayoutGrid, BookOpen
} from "lucide-react"
import ApprovalHierarchyModal from '@/app/lms/component/ApprovalHierarchyModal'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import DashboardLayout from '@/app/lms/component/layout'
import { useCourseBatchesQuery, useUpdateBatchMutation } from '@/queries/courseBatches'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-poppins',
})

const PAGE_SIZE = 8

type Batch = {
  _id: string
  batchName: string
  batchDescription: string
  batchStartDate: string | null
  batchEndDate: string | null
  status: string
  enrolledCount: number
  createdAt?: string
  updatedAt?: string
}

type BatchFormState = {
  batchName: string
  batchDescription: string
  batchStartDate: string
  batchEndDate: string
  status: string
}

const emptyForm: BatchFormState = {
  batchName: '',
  batchDescription: '',
  batchStartDate: '',
  batchEndDate: '',
  status: 'active',
}

// Displayed status combines the stored status with the schedule dates:
// archived/suspended win; otherwise Upcoming (not started) / Completed
// (ended) / Active (running now).
const deriveStatus = (batch: Batch): string => {
  if (batch.status === 'archived') return 'Archived'
  if (batch.status === 'suspended') return 'Suspended'
  const now = Date.now()
  if (batch.batchStartDate && new Date(batch.batchStartDate).getTime() > now) return 'Upcoming'
  if (batch.batchEndDate && new Date(batch.batchEndDate).getTime() < now) return 'Completed'
  return 'Active'
}

const statusChipClasses: Record<string, string> = {
  Active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Upcoming: 'bg-blue-50 text-blue-700 border-blue-200',
  Completed: 'bg-gray-100 text-gray-600 border-gray-200',
  Suspended: 'bg-amber-50 text-amber-700 border-amber-200',
  Archived: 'bg-gray-100 text-gray-500 border-gray-200',
}

const batchCodeOf = (index: number) => `BATCH-${String(index + 1).padStart(3, '0')}`

const formatDate = (dateString: string | null) => {
  if (!dateString) return '—'
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: '2-digit', year: 'numeric',
    })
  } catch {
    return '—'
  }
}

const toDateInput = (dateString: string | null) => {
  if (!dateString) return ''
  try {
    return new Date(dateString).toISOString().split('T')[0]
  } catch {
    return ''
  }
}

export default function CourseBatchesPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const courseId = searchParams.get('courseId')

  // courseName / studentType / batches / degree / semester / departmentSections
  // and the loading + error flags all come from the shared query below.
  // Expanded nodes in the tree, keyed by path (batchId, batchId/deg, …)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggleExpand = (key: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false)

  // Edit modal — batches themselves come from the course's client (picked at
  // course creation), so there is no Add/Delete here; only the schedule
  // dates, description and status can be changed. The name is locked.
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null)
  const [form, setForm] = useState<BatchFormState>(emptyForm)
  const [saving, setSaving] = useState(false)

  // View modal
  const [viewBatch, setViewBatch] = useState<Batch | null>(null)

  // Shared cache entry with the Sections and Participants pages — drilling
  // into a batch and coming back no longer refetches this.
  const {
    data: hierarchy,
    isLoading: loading,
    error: queryError,
    refetch: fetchBatches,
  } = useCourseBatchesQuery(courseId)
  const error = queryError
    ? (queryError as Error).message || 'Failed to load batches'
    : null

  const courseName = hierarchy?.courseName || ''
  const studentType = hierarchy?.studentType || ''
  const degree = hierarchy?.degree || ''
  const semester = hierarchy?.semester || ''
  const batches = useMemo(() => hierarchy?.batches || [], [hierarchy])
  const departmentSections = useMemo(() => hierarchy?.departmentSections || [], [hierarchy])

  const updateBatch = useUpdateBatchMutation(courseId)

  // Attach the display code by the batch's position in the course document so
  // codes stay stable regardless of the current search/filter/page.
  const codedBatches = useMemo(
    () => batches.map((b, i) => ({ ...b, code: batchCodeOf(i), displayStatus: deriveStatus(b) })),
    [batches]
  )

  const filteredBatches = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return codedBatches.filter((b) => {
      const matchesSearch =
        !term ||
        b.batchName.toLowerCase().includes(term) ||
        b.code.toLowerCase().includes(term) ||
        b.displayStatus.toLowerCase().includes(term)
      const matchesStatus = statusFilter === 'All' || b.displayStatus === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [codedBatches, searchTerm, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredBatches.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageBatches = filteredBatches.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [searchTerm, statusFilter])

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const toggleSelectAll = () => {
    const pageIds = pageBatches.map(b => b._id)
    const allSelected = pageIds.every(id => selectedIds.includes(id))
    setSelectedIds(allSelected ? selectedIds.filter(id => !pageIds.includes(id)) : Array.from(new Set([...selectedIds, ...pageIds])))
  }

  // ── Edit (dates / description / status only — name comes from the client) ──
  const openEditModal = (batch: Batch) => {
    setEditingBatch(batch)
    setForm({
      batchName: batch.batchName,
      batchDescription: batch.batchDescription || '',
      batchStartDate: toDateInput(batch.batchStartDate),
      batchEndDate: toDateInput(batch.batchEndDate),
      status: batch.status || 'active',
    })
    setIsFormOpen(true)
  }

  const handleSaveBatch = async () => {
    if (!editingBatch) return
    if (form.batchStartDate && form.batchEndDate && form.batchEndDate < form.batchStartDate) {
      toast.warning('End date must be after start date')
      return
    }
    try {
      setSaving(true)
      // batchName is intentionally NOT sent — it is fixed by the client's
      // batch definition and cannot be renamed here.
      const payload = {
        batchDescription: form.batchDescription,
        batchStartDate: form.batchStartDate ? new Date(form.batchStartDate).toISOString() : null,
        batchEndDate: form.batchEndDate ? new Date(`${form.batchEndDate}T23:59:59`).toISOString() : null,
        status: form.status,
      }

      // The mutation invalidates the shared batches entry on success, so the
      // Sections and Participants pages pick the edit up too — the manual
      // fetchBatches() this replaces only refreshed THIS page.
      await updateBatch.mutateAsync({ batchId: editingBatch._id, payload })
      toast.success('Batch updated successfully')
      setIsFormOpen(false)
      setEditingBatch(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save batch')
    } finally {
      setSaving(false)
    }
  }

  // ── Manage participants inside a batch ────────────────────────────────────
  // Degree-program courses have a Sections level between the batch and its
  // users (sections are stored on the course, mirrored from the client's
  // degree config) — route there first. Skilling goes straight to users.
  const goToManageParticipants = (batch: Batch) => {
    const query = new URLSearchParams({
      courseId: courseId ?? '',
      batchId: batch._id,
      batchName: batch.batchName,
    }).toString()
    const target = studentType === 'degree-program'
      ? 'course-sections'
      : 'course-participants'
    router.push(`/lms/pages/coursestructure/${target}?${query}`)
  }

  // Add participants scoped to a hierarchy node under a batch.
  const goToAddParticipants = (
    batch: Batch,
    ctx: { degree?: string; department?: string; section?: string; semester?: string } = {}
  ) => {
    const params: Record<string, string> = {
      courseId: courseId ?? '',
      batchId: batch._id,
      batchName: batch.batchName,
    }
    if (ctx.degree) params.degree = ctx.degree
    if (ctx.department) params.department = ctx.department
    if (ctx.section) params.section = ctx.section
    if (ctx.semester) params.semester = ctx.semester
    router.push(`/lms/pages/coursestructure/course-participants?${new URLSearchParams(params).toString()}`)
  }

  if (!courseId) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Card className="w-full max-w-md border-red-100">
            <CardContent className="pt-6 text-center">
              <h3 className="font-medium text-gray-900 mb-1">No course selected</h3>
              <p className="text-sm text-gray-600 mb-4">Open this page from a course&apos;s Add Participants action.</p>
              <Button variant="outline" size="sm" onClick={() => router.push('/lms/pages/coursestructure')} className="w-full">
                <ArrowLeft className="mr-2 h-3 w-3" />
                Go to Courses
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className={`${poppins.className} h-full flex flex-col bg-white overflow-hidden`}
      >
        {/* Breadcrumb */}
        <div className="px-4 pt-2">
          <Breadcrumb>
            <BreadcrumbList className="text-[11px]">
              <BreadcrumbItem>
                <BreadcrumbLink
                  href="/lms/pages/admindashboard"
                  className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-900"
                >
                  <Home className="h-3 w-3" />
                  Dashboard
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-gray-300" />
              <BreadcrumbItem>
                <BreadcrumbLink
                  href="/lms/pages/coursestructure"
                  className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-900"
                >
                  <BookMarked className="h-3 w-3" />
                  Courses
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-gray-300" />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-[11px] font-medium text-gray-500 truncate max-w-[180px]">
                  {courseName || 'Course'}
                </BreadcrumbPage>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-gray-300" />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-[11px] font-medium text-gray-700">
                  Batches
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* Course name + actions */}
        <div className="px-4 pt-1.5 flex items-center justify-between gap-3">
          <div className="text-[13px] text-gray-800 min-w-0">
            <span className="font-medium text-gray-500">Course Name:</span>{' '}
            <span className="font-semibold text-gray-900 truncate">{courseName}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 h-7 px-3 text-xs"
              onClick={() => setIsApprovalModalOpen(true)}
            >
              <GitBranch className="h-3.5 w-3.5" />
              Approval Hierarchy
            </Button>
          </div>
        </div>

        {/* Toolbar + table */}
        <div className="px-4 pt-3 flex-1 min-h-0 flex flex-col">
          <div className="border border-gray-200 rounded-lg flex-1 min-h-0 flex flex-col">
            <div className="p-3 flex items-center justify-between gap-3">
              <div className="relative w-full max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  placeholder="Search batch name, code, status..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-8 text-xs rounded-full"
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                      <Filter className="h-3.5 w-3.5" />
                      Filters
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuLabel className="text-xs">Status</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {['All', 'Active', 'Upcoming', 'Completed', 'Suspended', 'Archived'].map((s) => (
                      <DropdownMenuItem
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={`text-xs ${statusFilter === s ? 'bg-indigo-50 text-indigo-700' : ''}`}
                      >
                        {s}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Badge variant="outline" className="h-8 px-3 flex items-center text-xs font-medium bg-gray-50">
                  {filteredBatches.length} {filteredBatches.length === 1 ? 'Batch' : 'Batches'}
                </Badge>
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 min-h-0 overflow-auto">
              {loading ? (
                <div className="py-16 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                  <p className="mt-3 text-sm text-gray-500">Loading batches...</p>
                </div>
              ) : error ? (
                <div className="py-16 text-center">
                  <p className="text-sm text-red-600 mb-3">{error}</p>
                  <Button variant="outline" size="sm" onClick={() => fetchBatches()}>Retry</Button>
                </div>
              ) : filteredBatches.length === 0 ? (
                <div className="py-16 text-center">
                  <Layers className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-700">
                    {batches.length === 0 ? 'No batches yet' : 'No batches match your search'}
                  </p>
                  {batches.length === 0 && (
                    <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                      Batches come from the client selected at course creation.
                      Pick the batch(es) in the course&apos;s Basic Configuration,
                      or add batches to the client in Dynamic Field Settings.
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-2 space-y-1.5">
                  {pageBatches.map((batch) => {
                    const bKey = batch._id
                    const degKey = `${bKey}/deg`
                    const hasHierarchy = !!degree || departmentSections.length > 0
                    return (
                      <div key={batch._id} className="rounded-lg border border-gray-200 overflow-hidden">
                        {/* ── Batch row ── */}
                        <div className="flex items-center gap-2 px-2 py-2 bg-white hover:bg-gray-50/60">
                          <button
                            type="button"
                            onClick={() => hasHierarchy && toggleExpand(bKey)}
                            className={`w-5 h-5 flex items-center justify-center rounded ${hasHierarchy ? 'text-gray-500 hover:bg-gray-100' : 'text-transparent'}`}
                          >
                            {expanded.has(bKey) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          </button>
                          <span className="w-6 h-6 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
                            <Layers className="h-3.5 w-3.5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-gray-900">{batch.batchName}</span>
                              <span className="text-[10px] text-gray-400">{batch.code}</span>
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusChipClasses[batch.displayStatus] || statusChipClasses.Active}`}>
                                {batch.displayStatus}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mt-0.5">
                              <Calendar className="h-3 w-3 text-gray-400" />
                              {formatDate(batch.batchStartDate)} - {formatDate(batch.batchEndDate)}
                              <span className="text-gray-300">·</span>
                              {batch.enrolledCount} enrolled
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-indigo-600 hover:text-indigo-800" title="Add participants to this batch" onClick={() => goToAddParticipants(batch, {})}>
                              <UserPlus className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-500 hover:text-gray-900" title="View batch" onClick={() => setViewBatch(batch)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-500 hover:text-gray-900" title="Edit batch" onClick={() => openEditModal(batch)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* ── Degree ── */}
                        {expanded.has(bKey) && hasHierarchy && (
                          <div className="border-t border-gray-100 bg-gray-50/40">
                            <div className="flex items-center gap-2 px-2 py-1.5 pl-6">
                              <button type="button" onClick={() => toggleExpand(degKey)} className="w-5 h-5 flex items-center justify-center rounded text-gray-500 hover:bg-gray-100">
                                {expanded.has(degKey) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                              </button>
                              <GraduationCap className="h-3.5 w-3.5 text-blue-500" />
                              <span className="text-xs font-medium text-gray-800">{degree || 'Degree'}</span>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-auto text-indigo-600 hover:text-indigo-800" title="Add participants at degree level" onClick={() => goToAddParticipants(batch, { degree })}>
                                <UserPlus className="h-3.5 w-3.5" />
                              </Button>
                            </div>

                            {/* ── Departments ── */}
                            {expanded.has(degKey) && departmentSections.map((dept) => {
                              const deptKey = `${degKey}/${dept.department}`
                              return (
                                <div key={dept.department}>
                                  <div className="flex items-center gap-2 px-2 py-1.5 pl-12">
                                    <button type="button" onClick={() => toggleExpand(deptKey)} className="w-5 h-5 flex items-center justify-center rounded text-gray-500 hover:bg-gray-100">
                                      {expanded.has(deptKey) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                    </button>
                                    <Building2 className="h-3.5 w-3.5 text-violet-500" />
                                    <span className="text-xs text-gray-800">{dept.department}</span>
                                    <span className="text-[10px] text-gray-400">· {dept.sections.length} section{dept.sections.length === 1 ? '' : 's'}</span>
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-auto text-indigo-600 hover:text-indigo-800" title="Add participants at department level" onClick={() => goToAddParticipants(batch, { degree, department: dept.department })}>
                                      <UserPlus className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>

                                  {/* ── Sections ── */}
                                  {expanded.has(deptKey) && dept.sections.map((sec) => {
                                    const secKey = `${deptKey}/${sec}`
                                    return (
                                      <div key={sec}>
                                        <div className="flex items-center gap-2 px-2 py-1.5 pl-[72px]">
                                          <button type="button" onClick={() => toggleExpand(secKey)} className="w-5 h-5 flex items-center justify-center rounded text-gray-500 hover:bg-gray-100">
                                            {expanded.has(secKey) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                          </button>
                                          <LayoutGrid className="h-3.5 w-3.5 text-emerald-500" />
                                          <span className="text-xs text-gray-800">Section {sec}</span>
                                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-auto text-indigo-600 hover:text-indigo-800" title="Add participants at section level" onClick={() => goToAddParticipants(batch, { degree, department: dept.department, section: sec })}>
                                            <UserPlus className="h-3.5 w-3.5" />
                                          </Button>
                                        </div>

                                        {/* ── Semesters (leaves) — one per department semester ── */}
                                        {expanded.has(secKey) && (
                                          (dept.semesters && dept.semesters.length ? dept.semesters : ['']).map((sm) => (
                                            <div key={sm || 'none'} className="flex items-center gap-2 px-2 py-1.5 pl-[96px]">
                                              <span className="w-5" />
                                              <BookOpen className="h-3.5 w-3.5 text-amber-500" />
                                              <span className="text-xs text-gray-700">Semester {sm || '—'}</span>
                                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-auto text-indigo-600 hover:text-indigo-800" title="Add participants at semester level" onClick={() => goToAddParticipants(batch, { degree, department: dept.department, section: sec, semester: sm })}>
                                                <UserPlus className="h-3.5 w-3.5" />
                                              </Button>
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer: count + pagination */}
            {!loading && !error && filteredBatches.length > 0 && (
              <div className="px-4 py-2.5 border-t border-gray-200 flex items-center justify-between">
                <span className="text-[11px] text-gray-500">
                  Showing {(safePage - 1) * PAGE_SIZE + 1}-{Math.min(safePage * PAGE_SIZE, filteredBatches.length)} of {filteredBatches.length}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                    disabled={safePage <= 1}
                    onClick={() => setPage(safePage - 1)}
                  >
                    Prev
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <Button
                      key={p}
                      variant={p === safePage ? 'default' : 'outline'}
                      size="sm"
                      className={`h-7 w-7 p-0 text-xs ${p === safePage ? 'bg-indigo-600 hover:bg-indigo-700' : ''}`}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage(safePage + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Edit batch modal — schedule/description/status only */}
        <Dialog open={isFormOpen} onOpenChange={(open) => { if (!open) setIsFormOpen(false) }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base">Edit Batch</DialogTitle>
              <DialogDescription className="text-xs">
                Set the batch schedule. The batch name comes from the client and cannot be changed here.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-1">
              <div className="space-y-1">
                <Label className="text-xs">Batch Name</Label>
                <Input
                  value={form.batchName}
                  readOnly
                  disabled
                  className="h-8 text-xs bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description</Label>
                <Textarea
                  value={form.batchDescription}
                  onChange={(e) => setForm({ ...form, batchDescription: e.target.value })}
                  placeholder="Optional description"
                  className="text-xs min-h-[60px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Start Date</Label>
                  <Input
                    type="date"
                    value={form.batchStartDate}
                    onChange={(e) => setForm({ ...form, batchStartDate: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">End Date</Label>
                  <Input
                    type="date"
                    value={form.batchEndDate}
                    onChange={(e) => setForm({ ...form, batchEndDate: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full h-8 text-xs border border-gray-200 rounded-md px-2 bg-white"
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setIsFormOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="text-xs bg-indigo-600 hover:bg-indigo-700"
                onClick={handleSaveBatch}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View batch modal */}
        <Dialog open={!!viewBatch} onOpenChange={(open) => { if (!open) setViewBatch(null) }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base">{viewBatch?.batchName}</DialogTitle>
              <DialogDescription className="text-xs">Batch details</DialogDescription>
            </DialogHeader>
            {viewBatch && (
              <div className="space-y-2.5 py-1 text-xs">
                {viewBatch.batchDescription && (
                  <p className="text-gray-600">{viewBatch.batchDescription}</p>
                )}
                <div className="flex items-center gap-2 text-gray-700">
                  <Calendar className="h-3.5 w-3.5 text-gray-400" />
                  {formatDate(viewBatch.batchStartDate)} - {formatDate(viewBatch.batchEndDate)}
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <Users className="h-3.5 w-3.5 text-gray-400" />
                  {viewBatch.enrolledCount} participant{viewBatch.enrolledCount === 1 ? '' : 's'} enrolled
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-2 py-0.5 ${statusChipClasses[deriveStatus(viewBatch)] || statusChipClasses.Active}`}
                  >
                    {deriveStatus(viewBatch)}
                  </Badge>
                </div>
                {viewBatch.createdAt && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Clock className="h-3.5 w-3.5 text-gray-400" />
                    Created {formatDate(viewBatch.createdAt)}
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setViewBatch(null)}>
                Close
              </Button>
              <Button
                size="sm"
                className="text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700"
                onClick={() => { if (viewBatch) goToManageParticipants(viewBatch) }}
              >
                <Users className="h-3.5 w-3.5" />
                Manage Participants
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ApprovalHierarchyModal
          open={isApprovalModalOpen}
          onClose={() => setIsApprovalModalOpen(false)}
          courseId={courseId || ''}
        />
      </motion.div>
    </DashboardLayout>
  )
}
