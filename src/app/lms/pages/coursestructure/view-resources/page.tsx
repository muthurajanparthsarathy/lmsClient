"use client"
import { getToken } from "@/lib/session";

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Poppins } from 'next/font/google'
import {
  BookOpen, BookMarked, Home, GitBranch, Eye, ShieldCheck, CheckCircle2,
  Clock as ClockIcon, Lock, AlertCircle, X, XCircle, RefreshCw, ArrowLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCourseRosterQuery } from '@/queries/courseRoster'
import { toast, Toaster } from 'sonner'
import DashboardLayout from '@/app/lms/component/layout'
import LDLayout from '@/app/lms/component/ldshell/LDLayout'
import {
  fetchCourseApprovalsOverview,
  approveExerciseStep,
  rejectExerciseStep,
  approveQuestion,
  approveAllQuestions,
  rejectQuestion,
  raiseQuestionQuery,
  type CourseApprovalItem,
  type QuestionContext,
} from '@/apiServices/userService'
import { Textarea } from '@/components/ui/textarea'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

type CourseSummary = { _id: string; courseName: string; courseCode?: string; category?: string }

export default function ViewResourcesPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  // Shell selection — mirrors AttendanceManagementLayout's `?from=ldc` escape
  // hatch (features/attendancemanagement/AttendanceManagementLayout.tsx:34).
  // If the caller was the L&D console (its dashboard or its Approval queue),
  // stay inside LDLayout so the rail, brand and back destination all belong to
  // L&D instead of jumping to the admin shell.
  const fromParam = searchParams.get('from') || ''
  const fromLdc = fromParam.startsWith('/lms/pages/lddashboard')
  const courseId = searchParams.get('courseId') || ''
  const queryClient = useQueryClient()

  const [token, setToken] = useState<string | null>(null)
  const [institutionId, setInstitutionId] = useState<string | null>(null)
  // Queue "Review →" deep links carry ?tabType= so an assessment opens on the
  // You Do tab instead of the default We Do one.
  const [activeTab, setActiveTab] = useState<'We_Do' | 'You_Do'>(
    searchParams.get('tabType') === 'You_Do' ? 'You_Do' : 'We_Do'
  )
  const [detail, setDetail] = useState<CourseApprovalItem | null>(null)
  const [confirm, setConfirm] = useState<CourseApprovalItem | null>(null)
  // Reject flow — target item + message the approver types before sending.
  const [rejectTarget, setRejectTarget] = useState<CourseApprovalItem | null>(null)
  const [rejectMessage, setRejectMessage] = useState('')

  useEffect(() => {
    setToken(getToken())
    setInstitutionId(localStorage.getItem('smartcliff_institution'))
  }, [])

  // Course meta — from the shared roster entry (queries/courseRoster.ts).
  // This used to be its own hardcoded-localhost fetch of the FULL course
  // payload, with no auth header, to read four scalars.
  const { data: roster } = useCourseRosterQuery(courseId)
  const course: CourseSummary | null = useMemo(() => {
    const info: any = roster
    if (!info?._id) return null
    return {
      _id: info._id,
      courseName: info.courseName,
      courseCode: info.courseCode,
      category: info.category,
    }
  }, [roster])

  const { data: items = [], isLoading, isFetching, refetch } = useQuery({
    // `token` deliberately NOT in the key — it is a credential, not an
    // input to the response, and including it orphaned the cache entry
    // every time the token was refreshed. It gates the query via `enabled`.
    queryKey: ['courseApprovalsOverview', courseId, activeTab, institutionId],
    queryFn: () => fetchCourseApprovalsOverview(courseId, activeTab, institutionId!, token!),
    enabled: !!token && !!institutionId && !!courseId,
    // Trainer edits from a different page flip `editedSinceReject` on the
    // server. This page needs to notice quickly, so we shorten staleness
    // and let window focus + a manual button drive refetches. The manual
    // button in the header shows a spinner while a refetch is in flight.
    staleTime: 5 * 1000,
    refetchOnWindowFocus: true,
  })

  // Keep the open detail modal in sync after refetches — per-question
  // approvals mutate the exercise blob server-side, and the modal would
  // otherwise keep showing the stale copy it was opened with.
  useEffect(() => {
    if (!detail) return
    const fresh = items.find((i) => String(i.exerciseId) === String(detail.exerciseId))
    if (fresh && fresh !== detail) setDetail(fresh)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  const approveMutation = useMutation({
    mutationFn: (item: CourseApprovalItem) =>
      approveExerciseStep({
        entityType: item.entityType,
        entityId: String(item.entityId),
        tabType: item.tabType,
        subcategory: item.subcategory,
        exerciseId: String(item.exerciseId),
      }, token!),
    onSuccess: (resp: any) => {
      toast.success(resp?.message || 'Approved', { position: 'top-right' })
      queryClient.invalidateQueries({ queryKey: ['courseApprovalsOverview', courseId] })
      refetch()
      setConfirm(null)
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to approve', { position: 'top-right' })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ item, message }: { item: CourseApprovalItem; message: string }) =>
      rejectExerciseStep({
        entityType: item.entityType,
        entityId: String(item.entityId),
        tabType: item.tabType,
        subcategory: item.subcategory,
        exerciseId: String(item.exerciseId),
        comment: message,
      }, token!),
    onSuccess: (resp: any) => {
      toast.success(resp?.message || 'Rejected — trainer notified', { position: 'top-right' })
      queryClient.invalidateQueries({ queryKey: ['courseApprovalsOverview', courseId] })
      refetch()
      setRejectTarget(null)
      setRejectMessage('')
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to reject', { position: 'top-right' })
    },
  })

  const counts = useMemo(() => {
    const pending = items.filter((i) => i.approvalWorkflow?.overallStatus === 'in_progress').length
    const approved = items.filter((i) => i.approvalWorkflow?.overallStatus === 'approved').length
    return { pending, approved, total: items.length }
  }, [items])

  const renderStatusChip = (item: CourseApprovalItem) => {
    const wf = item.approvalWorkflow
    if (!wf) {
      return <Badge variant="secondary" className="text-[11px] h-5 px-1.5">No workflow</Badge>
    }
    if (wf.overallStatus === 'approved') {
      return (
        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[11px] h-5 px-1.5 flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" /> Approved
        </Badge>
      )
    }
    if (wf.overallStatus === 'rejected') {
      return (
        <Badge className="bg-red-100 text-red-800 border-red-200 text-[11px] h-5 px-1.5">Rejected</Badge>
      )
    }
    const step = wf.steps[(wf.currentStep || 1) - 1]
    const resubmits = wf.resubmissionCount || 0
    return (
      <span className="inline-flex items-center gap-1 flex-wrap">
        <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[11px] h-5 px-1.5 flex items-center gap-1">
          <ClockIcon className="h-3 w-3" />
          Pending at Step {wf.currentStep}: {step?.roleName}
        </Badge>
        {resubmits > 0 && (
          <Badge className="bg-violet-100 text-violet-800 border-violet-200 text-[11px] h-5 px-1.5 flex items-center gap-1">
            <RefreshCw className="h-3 w-3" />
            Re-request{resubmits > 1 ? ` #${resubmits}` : ''}
          </Badge>
        )}
      </span>
    )
  }

  const renderChain = (item: CourseApprovalItem) => {
    const wf = item.approvalWorkflow
    if (!wf || wf.steps.length === 0) return null
    return (
      <div className="flex items-center gap-1.5 flex-wrap mt-2">
        {wf.steps.map((s, i) => {
          const color =
            s.status === 'approved' ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : s.status === 'pending' ? 'bg-amber-50 border-amber-200 text-amber-700'
            : s.status === 'rejected' ? 'bg-red-50 border-red-200 text-red-700'
            : 'bg-gray-50 border-gray-200 text-gray-500'
          return (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-xs text-gray-400">→</span>}
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${color}`}>
                {i + 1}. {s.roleName}
                {s.status === 'approved' && ' ✓'}
              </span>
            </span>
          )
        })}
        <span className="text-[11px] text-gray-400">→ Students</span>
      </div>
    )
  }

  // active="appr-queue" so the L&D rail highlights Approvals for the whole
  // duration of the review, matching what happens on lddashboard itself.
  // Written as an inline ternary — an inline `const Shell = (…)=> …` component
  // was rejected by SWC ("Expected jsx identifier") once TypeScript stripped
  // the type annotations.
  const inner = (
    <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className={`${poppins.className} min-h-screen bg-white`}
      >
        {/* Breadcrumb + Back button.
            Back precedence:
              1. `?from=<url>` — the caller (e.g. the Approvals queue) tells us
                 exactly where to return. Approvals passes /lms/pages/approvals
                 so the queue reopens even for a caller that arrived here via a
                 plain <a href=…> and has no useful history entry.
              2. history.back() — for callers that used router.push (CustomDropdown,
                 lddashboard) and left a real back-stack entry.
              3. /lms/pages/coursestructure — final fallback so the button always
                 does SOMETHING; a hard-refresh into this URL has no history. */}
        <div className="px-4 pt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              const from = searchParams.get('from')
              if (from && from.startsWith('/lms/pages/')) {
                // Full navigation, NOT router.push:
                //   - Next 15's App Router doesn't reliably navigate to a
                //     different pathname carrying a `#hash` (measured — the
                //     URL didn't change and the nav-loader hit its 8s ceiling).
                //   - The L&D dashboard selects its opening tab from the hash
                //     at mount; a soft transition can arrive before its
                //     hash-router installs its listener, and the wrong tab
                //     wins.
                // A hard nav sidesteps both problems and matches the caller's
                // plain <a href=…> pattern.
                if (typeof window !== 'undefined') window.location.href = from
                return
              }
              if (typeof window !== 'undefined' && window.history.length > 1) {
                router.back()
                return
              }
              router.push('/lms/pages/coursestructure')
            }}
            className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 shrink-0"
            aria-label="Back"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <Breadcrumb>
            <BreadcrumbList className="text-[11px]">
              <BreadcrumbItem>
                <BreadcrumbLink href="/lms/pages/admindashboard"
                  className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-900">
                  <Home className="h-3 w-3" /> Dashboard
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-gray-300" />
              <BreadcrumbItem>
                <BreadcrumbLink href="/lms/pages/coursestructure"
                  className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-900">
                  <BookMarked className="h-3 w-3" /> Courses
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-gray-300" />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-[11px] font-medium text-gray-700 truncate max-w-[200px]">
                  {course?.courseName || 'View Resources'}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* Course header */}
        <div className="px-4 pt-1.5 flex items-center justify-between gap-3">
          <div className="text-[13px] text-gray-800 min-w-0">
            <span className="font-medium text-gray-500">Course Name:</span>{' '}
            <span className="font-semibold text-gray-900 truncate">{course?.courseName || '—'}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <Badge className="bg-amber-50 text-amber-700 border-amber-200 h-5 px-1.5">
              {counts.pending} pending
            </Badge>
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 h-5 px-1.5">
              {counts.approved} approved
            </Badge>
            <Badge variant="secondary" className="h-5 px-1.5">
              {counts.total} total
            </Badge>
            {/* Manual refresh — the trainer's edits flip the `editedSinceReject`
                flag on the server; this button lets the approver pull the
                latest state without reloading the page. Spins while a
                refetch is in flight. */}
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[11px] gap-1"
              onClick={() => refetch()}
              disabled={isFetching}
              title="Reload latest exercise state"
            >
              <RefreshCw className={`h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Tabs + list */}
        <div className="px-4 pt-2">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
            <TabsList className="inline-flex h-7 items-center justify-center rounded-md bg-gray-100 p-0.5">
              <TabsTrigger value="We_Do"
                className="rounded px-2 py-0.5 text-[11px] font-medium data-[state=active]:bg-white data-[state=active]:shadow-xs">
                We Do (Assignments)
              </TabsTrigger>
              <TabsTrigger value="You_Do"
                className="rounded px-2 py-0.5 text-[11px] font-medium data-[state=active]:bg-white data-[state=active]:shadow-xs">
                You Do (Assessments)
              </TabsTrigger>
            </TabsList>

            <div className="mt-3">
              <TabsContent value="We_Do" className="m-0">
                <ResourceList
                  items={items}
                  isLoading={isLoading}
                  onView={setDetail}
                  onApprove={setConfirm}
                  onReject={(it) => { setRejectTarget(it); setRejectMessage('') }}
                  isApproving={approveMutation.isPending}
                  isRejecting={rejectMutation.isPending}
                  renderStatusChip={renderStatusChip}
                  renderChain={renderChain}
                />
              </TabsContent>
              <TabsContent value="You_Do" className="m-0">
                <ResourceList
                  items={items}
                  isLoading={isLoading}
                  onView={setDetail}
                  onApprove={setConfirm}
                  onReject={(it) => { setRejectTarget(it); setRejectMessage('') }}
                  isApproving={approveMutation.isPending}
                  isRejecting={rejectMutation.isPending}
                  renderStatusChip={renderStatusChip}
                  renderChain={renderChain}
                />
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Confirm Approve Dialog */}
        <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
          <DialogContent className={`${poppins.className} max-w-md`}>
            <DialogHeader>
              <DialogTitle className="text-[15px] flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-indigo-600" />
                Approve this exercise?
              </DialogTitle>
              <DialogDescription className="text-[12px] text-gray-500 mt-1">
                You're approving as <span className="font-semibold">
                  {confirm?.approvalWorkflow?.steps[(confirm?.approvalWorkflow?.currentStep || 1) - 1]?.roleName}
                </span>. The next approver will be notified automatically.
              </DialogDescription>
            </DialogHeader>
            <div className="text-[13px] text-gray-700">
              <div className="font-semibold">{confirm?.exerciseName}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">
                {confirm?.exerciseType} · {confirm?.tabType === 'We_Do' ? 'Assignment' : 'Assessment'}
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" className="h-7 px-3 text-xs"
                onClick={() => setConfirm(null)} disabled={approveMutation.isPending}>
                No
              </Button>
              <Button size="sm" className="h-7 px-3 text-xs bg-indigo-600 hover:bg-indigo-700"
                onClick={() => confirm && approveMutation.mutate(confirm)}
                disabled={approveMutation.isPending}>
                {approveMutation.isPending ? 'Approving…' : 'Yes, approve'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject Dialog — approver types a message that becomes the query
            shown to the trainer via notification + email. */}
        <Dialog open={!!rejectTarget} onOpenChange={(o) => { if (!o) { setRejectTarget(null); setRejectMessage('') } }}>
          <DialogContent className={`${poppins.className} max-w-md`}>
            <DialogHeader>
              <DialogTitle className="text-[15px] flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-600" />
                Reject this exercise?
              </DialogTitle>
              <DialogDescription className="text-[12px] text-gray-500 mt-1">
                Send a message to <span className="font-semibold">{rejectTarget?.createdBy || 'the creator'}</span> so
                they know what to fix. They'll get a notification with your message
                and can edit &amp; resubmit for approval.
              </DialogDescription>
            </DialogHeader>
            <div className="text-[13px] text-gray-700">
              <div className="font-semibold">{rejectTarget?.exerciseName}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">
                {rejectTarget?.exerciseType} · {rejectTarget?.tabType === 'We_Do' ? 'Assignment' : 'Assessment'}
              </div>
            </div>
            <div className="mt-3">
              <label className="text-[11px] font-medium text-gray-600 block mb-1">
                Rejection message (required)
              </label>
              <Textarea
                value={rejectMessage}
                onChange={(e) => setRejectMessage(e.target.value)}
                placeholder="e.g. Please add a difficulty column for programming questions and increase total marks to 100."
                className="min-h-[96px] text-[12px]"
                disabled={rejectMutation.isPending}
              />
              <div className="text-[10.5px] text-gray-400 mt-1">
                {rejectMessage.trim().length} / 500 characters
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" className="h-7 px-3 text-xs"
                onClick={() => { setRejectTarget(null); setRejectMessage('') }}
                disabled={rejectMutation.isPending}>
                Cancel
              </Button>
              <Button size="sm" variant="destructive" className="h-7 px-3 text-xs"
                disabled={rejectMutation.isPending || !rejectMessage.trim() || rejectMessage.length > 500}
                onClick={() => rejectTarget && rejectMutation.mutate({ item: rejectTarget, message: rejectMessage.trim() })}>
                {rejectMutation.isPending ? 'Rejecting…' : 'Reject & Notify'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Detail Drawer (modal) */}
        <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
          <DialogContent className={`${poppins.className} flex flex-col w-[calc(100vw-2rem)] max-w-3xl h-[calc(100vh-2rem)] max-h-[85vh] my-4 p-0 rounded-lg overflow-hidden`}>
            <DialogHeader className="shrink-0 px-5 pt-4 pb-3 border-b">
              <DialogTitle className="text-[15px] font-semibold">
                {detail?.exerciseName}
              </DialogTitle>
              <DialogDescription className="text-[12px] text-gray-500 mt-0.5">
                {detail?.exerciseType} · {detail?.tabType === 'We_Do' ? 'Assignment' : 'Assessment'} · {detail?.subcategory}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-5 py-4">
              {detail && (
                <DetailBody
                  detail={detail}
                  renderChain={renderChain}
                  token={token!}
                  onRefresh={() => refetch()}
                />
              )}
            </div>
            <DialogFooter className="shrink-0 border-t px-5 py-3 bg-white">
              <Button variant="outline" size="sm" className="h-7 px-3 text-xs" onClick={() => setDetail(null)}>
                Close
              </Button>
              {detail?.canApprove && (
                <Button size="sm"
                  className="h-7 px-3 text-xs bg-indigo-600 hover:bg-indigo-700"
                  onClick={() => { setConfirm(detail); setDetail(null) }}>
                  Approve
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Toaster position="top-right" richColors closeButton />
      </motion.div>
  )
  return fromLdc
    ? <LDLayout active="appr-queue">{inner}</LDLayout>
    : <DashboardLayout>{inner}</DashboardLayout>
}

// ─────────────────────────────────────────────────────────────────────────────
// List
// ─────────────────────────────────────────────────────────────────────────────
function ResourceList({
  items, isLoading, onView, onApprove, onReject, isApproving, isRejecting,
  renderStatusChip, renderChain,
}: {
  items: CourseApprovalItem[]
  isLoading: boolean
  onView: (item: CourseApprovalItem) => void
  onApprove: (item: CourseApprovalItem) => void
  onReject: (item: CourseApprovalItem) => void
  isApproving: boolean
  isRejecting: boolean
  renderStatusChip: (item: CourseApprovalItem) => React.ReactNode
  renderChain: (item: CourseApprovalItem) => React.ReactNode
}) {
  if (isLoading) {
    return <div className="text-[12px] text-gray-500 py-8 text-center">Loading…</div>
  }
  if (!items || items.length === 0) {
    return (
      <div className="text-[12px] text-gray-500 py-10 text-center border border-dashed rounded-md">
        Nothing here yet.
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={String(item.exerciseId)} className="border rounded-md p-3 bg-white hover:border-indigo-300 transition-colors">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="text-[13px] font-semibold text-gray-900 truncate">
                  {item.exerciseName || 'Untitled'}
                </div>
                {renderStatusChip(item)}
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5">
                {item.exerciseType || '—'} · {item.entityName || item.entityType} · {item.subcategory}
                {item.totalDuration ? ` · ${item.totalDuration} min` : ''}
                {item.totalMarks ? ` · ${item.totalMarks} marks` : ''}
              </div>
              {renderChain(item)}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1.5"
                onClick={() => onView(item)}>
                <Eye className="h-3.5 w-3.5" /> View
              </Button>
              {/* Action buttons — server-side `canApprove` is what actually
                  gates visibility. That flag is true when:
                    - workflow is in_progress and the caller is the current-
                      step approver, OR
                    - workflow is rejected AND `editedSinceReject === true`
                      (the trainer has reworked the assessment).
                  So a rejected-and-not-yet-edited row shows only View, and
                  once the trainer edits, Approve + Reject reappear alongside
                  the still-visible "Rejected" badge. */}
              {item.canApprove && (
                <>
                  <Button size="sm"
                    className="h-7 px-3 text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700"
                    disabled={isApproving || isRejecting}
                    onClick={() => onApprove(item)}>
                    <ShieldCheck className="h-3.5 w-3.5" /> Approve
                  </Button>
                  <Button size="sm" variant="outline"
                    className="h-7 px-3 text-xs gap-1.5 border-red-300 text-red-700 hover:bg-red-50"
                    disabled={isApproving || isRejecting}
                    onClick={() => onReject(item)}>
                    <XCircle className="h-3.5 w-3.5" /> Reject
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Full Exercise Detail — every setting block on the exercise doc
// ─────────────────────────────────────────────────────────────────────────────
function ExerciseFullDetail({
  detail,
  renderChain,
}: {
  detail: CourseApprovalItem
  renderChain: (item: CourseApprovalItem) => React.ReactNode
}) {
  const ex = detail.exercise || {}
  const info = ex.exerciseInformation || {}
  const sched = ex.availabilityPeriod || detail.schedule || {}
  const wf = detail.approvalWorkflow
  const qConfig = ex.questionConfiguration || {}
  const mcq = qConfig.mcqQuestionConfiguration || null
  const prog = qConfig.programmingQuestionConfiguration || null
  const others = qConfig.othersQuestionConfiguration || null
  const grade = ex.gradeSettings || {}
  const notif = ex.notificationSettings || ex.notificatonandGradeSettings || {}
  const sec = ex.securitySettings || {}
  const addOpts = ex.additionalOptions || {}
  const progSettings = ex.programmingSettings || {}
  const sections = Array.isArray(ex.sections) ? ex.sections : []
  const sectionConfigs = ex.sectionConfigs || {}
  const selectedTopics = Array.isArray(ex.selectedTopics) ? ex.selectedTopics : []
  const questions = Array.isArray(ex.questions) ? ex.questions : []

  const fmt = (v: any) => (v === undefined || v === null || v === '' ? '—' : String(v))
  const fmtDate = (v: any) => (v ? new Date(v).toLocaleString() : '—')
  const fmtBool = (v: any) => (v === undefined || v === null ? '—' : v ? 'Yes' : 'No')
  const isGraded = ex.isGraded !== false  // schema default is true

  return (
    <div className="space-y-5 text-[13px] text-gray-800">
      {/* Approval Chain */}
      <section>
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Approval Chain</h4>
        {renderChain(detail)}
      </section>

      {/* Exercise Info */}
      <section>
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Exercise Information</h4>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
          <KV label="Name" value={info.exerciseName || detail.exerciseName} />
          <KV label="Exercise ID" value={info.exerciseId} />
          <KV label="Type" value={ex.exerciseType || info.exerciseType || detail.exerciseType} />
          <KV label="Test Type" value={info.testType} />
          <KV label="Level" value={info.exerciseLevel} />
          <KV label="Duration" value={info.totalDuration ? `${info.totalDuration} min` : null} />
          {isGraded && <KV label="Total Marks" value={info.totalMarks ?? detail.totalMarks} />}
          {isGraded && <KV label="MCQ Marks" value={info.totalMarksMCQ} />}
          {isGraded && <KV label="Programming Marks" value={info.totalMarksProgramming} />}
          <KV label="Graded" value={fmtBool(ex.isGraded)} />
          <KV label="Section Based" value={fmtBool(ex.isSectionBased ?? info.isSectionBased)} />
          <KV label="Section-Based Duration" value={fmtBool(info.sectionBasedDuration)} />
          <KV label="Selected Module" value={info.selectedModule} />
          <KV label="Selected Languages" value={
            Array.isArray(info.selectedLanguages) && info.selectedLanguages.length
              ? info.selectedLanguages.join(', ')
              : null
          } />
          <KV label="Created" value={fmtDate(ex.createdAt || detail.createdAt)} />
          <KV label="Created By" value={ex.createdBy} />
          <KV label="Updated" value={fmtDate(ex.updatedAt || detail.updatedAt)} />
          <KV label="Updated By" value={ex.updatedBy} />
          <KV label="Version" value={ex.version} />
        </dl>
        {info.description && (
          <div className="mt-3">
            <div className="text-[11px] text-gray-500 mb-1">Description</div>
            <div className="whitespace-pre-wrap text-[12px] bg-gray-50 rounded-md p-2">{info.description}</div>
          </div>
        )}
        {ex.instructions && (
          <div className="mt-2">
            <div className="text-[11px] text-gray-500 mb-1">Instructions</div>
            <div className="whitespace-pre-wrap text-[12px] bg-gray-50 rounded-md p-2">{ex.instructions}</div>
          </div>
        )}
      </section>

      {/* Schedule */}
      <section>
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Schedule & Availability</h4>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
          <KV label="Start" value={fmtDate(sched.startDate)} />
          <KV label="End" value={fmtDate(sched.endDate)} />
          <KV label="Cut-off Enabled" value={fmtBool(sched.cutOffEnabled)} />
          <KV label="Cut-off Date" value={sched.cutOffEnabled ? fmtDate(sched.cutOffDate) : '—'} />
          <KV label="Remind Grade By Enabled" value={fmtBool(sched.remindGradeByEnabled)} />
          <KV label="Remind Grade By" value={sched.remindGradeByEnabled ? fmtDate(sched.remindGradeBy) : '—'} />
          <KV label="Grace Period Enabled" value={fmtBool(sched.gracePeriodEnabled || sched.gracePeriodAllowed)} />
          <KV label="Grace Period Date" value={(sched.gracePeriodEnabled || sched.gracePeriodAllowed) ? fmtDate(sched.gracePeriodDate) : '—'} />
          <KV label="Extended Days" value={sched.extendedDays ?? 0} />
          <KV label="Requires Approval" value={fmtBool(sched.requiresAdminApproval)} />
        </dl>
      </section>

      {/* Programming Settings */}
      {(progSettings.selectedModule || (Array.isArray(progSettings.selectedLanguages) && progSettings.selectedLanguages.length)) && (
        <section>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Programming Settings</h4>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
            <KV label="Selected Module" value={progSettings.selectedModule} />
            <KV label="Selected Languages" value={
              Array.isArray(progSettings.selectedLanguages) && progSettings.selectedLanguages.length
                ? progSettings.selectedLanguages.join(', ')
                : null
            } />
          </dl>
        </section>
      )}

      {/* MCQ Configuration */}
      {mcq && (
        <section>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">MCQ Configuration</h4>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
            <KV label="Total MCQ Questions" value={mcq.totalMcqQuestions} />
            {isGraded && <KV label="Marks per Question" value={mcq.marksPerQuestion} />}
            {isGraded && <KV label="MCQ Total Marks" value={mcq.mcqTotalMarks} />}
            {isGraded && (
              <KV label="Scoring Type" value={
                mcq.scoringType === 'equalDistribution' ? 'Equal distribution (same marks per question)'
                : mcq.scoringType === 'questionSpecific' ? 'Question-specific (set per question)'
                : mcq.scoringType === 'levelSpecific' ? 'Level-specific (per difficulty)'
                : mcq.scoringType
              } />
            )}
            <KV label="Shuffle Questions" value={fmtBool(mcq.shuffleQuestions)} />
            <KV label="Attempt Limit" value={fmtBool(mcq.attemptLimitEnabled)} />
            <KV label="Submission Attempts" value={mcq.attemptLimitEnabled ? mcq.submissionAttempts : '—'} />
          </dl>
        </section>
      )}

      {/* Programming Configuration */}
      {prog && (
        <section>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Programming Configuration</h4>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
            <KV label="Question Selection Mode" value={
              prog.questionConfigType === 'general' ? 'General (single pool)'
              : prog.questionConfigType === 'levelBased' ? 'Level-based (counts per difficulty)'
              : prog.questionConfigType === 'selectionLevel' ? 'Selection level (auto-picked per difficulty)'
              : prog.questionConfigType
            } />
            <KV label="Question Flow" value={
              prog.questionFlow === 'freeFlow' ? 'Free flow (any order)'
              : prog.questionFlow === 'controlled' ? 'Controlled (linear)'
              : prog.questionFlow
            } />
            <KV label="Compiler File Mode" value={
              prog.compilerFileMode === 'single' ? 'Single file'
              : prog.compilerFileMode === 'multiple' ? 'Multi-file'
              : prog.compilerFileMode
            } />
            <KV label="Allow Code Execution" value={fmtBool(prog.allowCodeExecution)} />
            <KV label="Enable Test Cases" value={fmtBool(prog.enableTestCases)} />
            <KV label="Show Sample Cases" value={fmtBool(prog.showSampleCases)} />
            <KV label="Attempt Limit" value={fmtBool(prog.attemptLimitEnabled)} />
            <KV label="Submission Attempts" value={prog.attemptLimitEnabled ? prog.submissionAttempts : '—'} />
          </dl>
          <ProgrammingQuestionCountsSummary prog={prog} />
          {isGraded && <ScoreSettingsSummary settings={prog.scoreSettings} />}
        </section>
      )}

      {/* Others Configuration */}
      {others && (
        <section>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Others Configuration</h4>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
            {Object.entries(others).map(([k, v]) => (
              <KV key={k} label={k} value={typeof v === 'object' ? JSON.stringify(v) : (v as any)} />
            ))}
          </dl>
        </section>
      )}

      {/* Grade Settings */}
      {isGraded && (
      <section>
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Grade Settings</h4>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
          <KV label="MCQ Grade" value={grade.mcqGrade} />
          <KV label="MCQ Pass" value={grade.mcqGradeToPass} />
          <KV label="Programming Grade" value={grade.programmingGrade} />
          <KV label="Programming Pass" value={grade.programmingGradeToPass} />
          <KV label="Combined Grade" value={grade.combinedGrade} />
          <KV label="Combined Pass" value={grade.combinedGradeToPass} />
          <KV label="Separate Marks" value={fmtBool(grade.separateMarks)} />
          <KV label="Section Based" value={fmtBool(grade.sectionBased)} />
        </dl>
        {Array.isArray(grade.sections) && grade.sections.length > 0 && (
          <div className="mt-2">
            <div className="text-[11px] text-gray-500 mb-1">Grade Sections</div>
            <ul className="space-y-1 text-[12px]">
              {grade.sections.map((s: any, i: number) => (
                <li key={i} className="border rounded-md px-2 py-1 bg-gray-50">
                  {s.name || `Section ${i + 1}`}: total {fmt(s.totalMarks)}, pass {fmt(s.passMarks)}
                </li>
              ))}
            </ul>
          </div>
        )}
        {grade.sectionPassMarks && Object.keys(grade.sectionPassMarks).length > 0 && (
          <div className="mt-2">
            <div className="text-[11px] text-gray-500 mb-1">Section Pass Marks</div>
            <ul className="space-y-1 text-[12px]">
              {Object.entries(grade.sectionPassMarks).map(([sectionName, mark]) => (
                <li key={sectionName} className="border rounded-md px-2 py-1 bg-gray-50 flex items-center justify-between">
                  <span className="font-medium">{sectionName}</span>
                  <span className="text-gray-700">Pass mark: {String(mark)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
      )}

      {/* Notification Settings */}
      <section>
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Notification Settings</h4>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
          <KV label="Notify Users" value={fmtBool(notif.notifyUsers)} />
          <KV label="Notify Gmail" value={fmtBool(notif.notifyGmail)} />
          <KV label="Notify WhatsApp" value={fmtBool(notif.notifyWhatsApp)} />
          <KV label="Grade Sheet" value={fmtBool(notif.gradeSheet)} />
          <KV label="Notify Graders on Submission" value={fmtBool(notif.notifyGradersSubmissions)} />
          <KV label="Notify Graders on Late" value={fmtBool(notif.notifyGradersLateSubmissions)} />
          <KV label="Notify Student" value={fmtBool(notif.notifyStudent)} />
        </dl>
        {(notif.notifyGradersSubmissionsChannels || notif.notifyGradersLateSubmissionsChannels || notif.notifyStudentChannels) && (
          <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px]">
            {notif.notifyGradersSubmissionsChannels && (
              <ChannelBlock title="Grader Submission Channels" channels={notif.notifyGradersSubmissionsChannels} />
            )}
            {notif.notifyGradersLateSubmissionsChannels && (
              <ChannelBlock title="Grader Late Channels" channels={notif.notifyGradersLateSubmissionsChannels} />
            )}
            {notif.notifyStudentChannels && (
              <ChannelBlock title="Student Channels" channels={notif.notifyStudentChannels} />
            )}
          </div>
        )}
      </section>

      {/* Security Settings */}
      {sec && Object.keys(sec).length > 0 && (
        <section>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Security Settings</h4>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
            {Object.entries(sec).map(([k, v]) => (
              <KV key={k} label={k} value={typeof v === 'boolean' ? fmtBool(v) : (typeof v === 'object' ? JSON.stringify(v) : (v as any))} />
            ))}
          </dl>
        </section>
      )}

      {/* Additional Options */}
      <section>
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Additional Options</h4>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
          <KV label="Anonymous Submissions" value={fmtBool(addOpts.anonymousSubmissions)} />
          <KV label="Hide Grader Identity" value={fmtBool(addOpts.hideGraderIdentity)} />
        </dl>
      </section>

      {/* Sections (when section-based) */}
      {sections.length > 0 && (
        <section>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Sections ({sections.length})</h4>
          <ul className="space-y-1.5">
            {sections.map((s: any, i: number) => (
              <li key={i} className="border rounded-md p-2 bg-gray-50">
                <div className="font-medium text-[12px]">{s.name || s.title || `Section ${i + 1}`}</div>
                {s.description && <div className="text-[11px] text-gray-500">{s.description}</div>}
                <div className="text-[11px] text-gray-500 mt-1">
                  {s.totalQuestions ? `${s.totalQuestions} questions · ` : ''}
                  {s.totalMarks ? `${s.totalMarks} marks · ` : ''}
                  {s.duration ? `${s.duration} min` : ''}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Section configs */}
      {sectionConfigs && Object.keys(sectionConfigs).length > 0 && (
        <section>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Section Configurations</h4>
          <SectionConfigsSummary configs={sectionConfigs} />
        </section>
      )}

      {/* Selected Topics */}
      {selectedTopics.length > 0 && (
        <section>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Selected Topics ({selectedTopics.length})</h4>
          <ul className="flex flex-wrap gap-1.5">
            {selectedTopics.map((t: any, i: number) => (
              <li key={i} className="px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-[11px] text-indigo-700">
                {t.name || t.title || (typeof t === 'string' ? t : JSON.stringify(t))}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Questions summary */}
      {questions.length > 0 && (
        <section>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Questions ({questions.length})</h4>
          <ul className="space-y-1.5">
            {questions.slice(0, 20).map((q: any, i: number) => (
              <li key={q._id || i} className="border rounded-md p-2 bg-white">
                <div className="text-[12px] font-medium">
                  Q{i + 1}{q.questionType ? ` · ${q.questionType}` : ''}{q.score ? ` · ${q.score} marks` : ''}
                </div>
                {q.title && <div className="text-[11px] text-gray-700 mt-0.5 truncate">{q.title}</div>}
                {!q.title && q.questionText && (
                  <div className="text-[11px] text-gray-700 mt-0.5 line-clamp-2 whitespace-pre-wrap">{q.questionText}</div>
                )}
              </li>
            ))}
          </ul>
          {questions.length > 20 && (
            <div className="text-[11px] text-gray-500 mt-1">…and {questions.length - 20} more</div>
          )}
        </section>
      )}

      {/* Decisions log */}
      {wf && (
        <section>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Approval Decisions</h4>
          <ul className="space-y-1.5">
            {wf.steps.map((s, i) => (
              <li key={i} className="flex items-center justify-between border rounded-md p-2">
                <div>
                  <div className="text-[12px] font-medium">Step {s.order}: {s.roleName}</div>
                  <div className="text-[11px] text-gray-500">
                    Status: <span className="font-semibold capitalize">{s.status}</span>
                    {s.decidedAt && <> · {new Date(s.decidedAt).toLocaleString()}</>}
                    {s.comment && <> · "{s.comment}"</>}
                  </div>
                </div>
                {s.status === 'approved' && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                {s.status === 'pending' && <ClockIcon className="h-4 w-4 text-amber-600" />}
                {s.status === 'waiting' && <Lock className="h-4 w-4 text-gray-400" />}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Location */}
      <section>
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Location</h4>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
          <KV label="Tab" value={detail.tabType === 'We_Do' ? 'We Do' : 'You Do'} />
          <KV label="Subcategory" value={detail.subcategory} />
          <KV label="Entity Type" value={detail.entityType} />
          <KV label="Entity Name" value={detail.entityName} />
          <KV label="Entity ID" value={String(detail.entityId)} />
          <KV label="Exercise ID" value={String(detail.exerciseId)} />
        </dl>
      </section>
    </div>
  )
}

function KV({ label, value }: { label: string; value: any }) {
  const empty = value === undefined || value === null || value === ''
  return (
    <div>
      <dt className="text-[11px] text-gray-500">{label}</dt>
      <dd className={`text-[12px] ${empty ? 'text-gray-400' : 'text-gray-900'} break-words`}>
        {empty ? '—' : String(value)}
      </dd>
    </div>
  )
}

// Friendly summary for prog.scoreSettings — interprets scoreType and shows
// only the relevant sub-fields with plain-English labels.
function ScoreSettingsSummary({ settings }: { settings: any }) {
  if (!settings || typeof settings !== 'object') return null
  const t = settings.scoreType
  const total = settings.totalMarks
  let title = ''
  let body: React.ReactNode = null

  if (t === 'evenMarks') {
    title = 'Equal marks for every question'
    body = (
      <div className="text-[12px]">
        Each question is worth <span className="font-semibold">{settings.evenMarks ?? 0}</span> marks.
      </div>
    )
  } else if (t === 'separateMarks') {
    const general = Array.isArray(settings.separateMarks?.general) ? settings.separateMarks.general : []
    const lb = settings.separateMarks?.levelBased || {}
    title = 'Marks set per question'
    body = (
      <div className="text-[12px] space-y-1">
        {general.length > 0 && (
          <div>General: <span className="font-semibold">{general.join(', ')}</span></div>
        )}
        {(Array.isArray(lb.easy) && lb.easy.length > 0) && (
          <div>Easy: <span className="font-semibold">{lb.easy.join(', ')}</span></div>
        )}
        {(Array.isArray(lb.medium) && lb.medium.length > 0) && (
          <div>Medium: <span className="font-semibold">{lb.medium.join(', ')}</span></div>
        )}
        {(Array.isArray(lb.hard) && lb.hard.length > 0) && (
          <div>Hard: <span className="font-semibold">{lb.hard.join(', ')}</span></div>
        )}
        {general.length === 0 && !lb.easy?.length && !lb.medium?.length && !lb.hard?.length && (
          <div className="text-gray-400">No per-question marks defined.</div>
        )}
      </div>
    )
  } else if (t === 'levelBasedMarks') {
    const lvl = settings.levelBasedMarks || {}
    title = 'Same marks for every question of the same difficulty'
    body = (
      <ul className="text-[12px] space-y-1">
        <li>Easy: <span className="font-semibold">{lvl.easy ?? 0}</span> marks/question</li>
        <li>Medium: <span className="font-semibold">{lvl.medium ?? 0}</span> marks/question</li>
        <li>Hard: <span className="font-semibold">{lvl.hard ?? 0}</span> marks/question</li>
      </ul>
    )
  } else if (t === 'levelScoringConfiguration') {
    const cfg = settings.levelScoringConfiguration || {}
    title = 'Custom configuration per difficulty'
    body = (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[12px]">
        {(['easy', 'medium', 'hard'] as const).map((lvl) => {
          const c = cfg[lvl] || {}
          return (
            <div key={lvl} className="border rounded-md p-2 bg-gray-50">
              <div className="font-semibold capitalize mb-1">{lvl}</div>
              <div>Type: <span className="font-medium">{c.type || '—'}</span></div>
              <div>Questions: <span className="font-medium">{c.questionCount ?? 0}</span></div>
              <div>Marks/question: <span className="font-medium">{c.marksPerQuestion ?? 0}</span></div>
              <div>Total: <span className="font-medium">{c.totalMarks ?? 0}</span></div>
            </div>
          )
        })}
      </div>
    )
  } else {
    title = 'Score settings'
    body = <div className="text-[12px] text-gray-400">No scoring configured.</div>
  }

  return (
    <div className="mt-3">
      <div className="text-[11px] text-gray-500 mb-1">Scoring</div>
      <div className="border rounded-md p-2 bg-white">
        <div className="text-[12px] font-semibold mb-1">{title}</div>
        {body}
        {total !== undefined && total !== null && (
          <div className="text-[11px] text-gray-500 mt-2">
            Total possible marks: <span className="font-semibold text-gray-800">{total}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// Friendly summary for programming question counts. The schema keeps three
// separate count buckets (generalQuestionCount, levelBasedCounts, selectionLevelCounts)
// — only one is meaningful at a time based on questionConfigType.
function ProgrammingQuestionCountsSummary({ prog }: { prog: any }) {
  if (!prog || typeof prog !== 'object') return null
  const mode = prog.questionConfigType
  const lvl = (obj: any) => ({
    easy: obj?.easy ?? 0,
    medium: obj?.medium ?? 0,
    hard: obj?.hard ?? 0,
    total: (obj?.easy ?? 0) + (obj?.medium ?? 0) + (obj?.hard ?? 0),
  })
  return (
    <div className="mt-3">
      <div className="text-[11px] text-gray-500 mb-1">Question Counts</div>
      <div className="border rounded-md p-2 bg-white">
        {mode === 'general' && (
          <div className="text-[12px]">
            General pool: <span className="font-semibold">{prog.generalQuestionCount ?? 0}</span> question{(prog.generalQuestionCount ?? 0) === 1 ? '' : 's'}
          </div>
        )}
        {mode === 'levelBased' && (() => {
          const v = lvl(prog.levelBasedCounts)
          return (
            <div className="flex flex-wrap gap-2 text-[12px]">
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700">
                Easy: <span className="font-semibold">{v.easy}</span>
              </span>
              <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700">
                Medium: <span className="font-semibold">{v.medium}</span>
              </span>
              <span className="px-2 py-0.5 rounded-md bg-red-50 border border-red-200 text-red-700">
                Hard: <span className="font-semibold">{v.hard}</span>
              </span>
              <span className="px-2 py-0.5 rounded-md bg-gray-50 border border-gray-200 text-gray-700">
                Total: <span className="font-semibold">{v.total}</span>
              </span>
            </div>
          )
        })()}
        {mode === 'selectionLevel' && (() => {
          const v = lvl(prog.selectionLevelCounts)
          return (
            <div className="flex flex-wrap gap-2 text-[12px]">
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700">
                Easy: <span className="font-semibold">{v.easy}</span>
              </span>
              <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700">
                Medium: <span className="font-semibold">{v.medium}</span>
              </span>
              <span className="px-2 py-0.5 rounded-md bg-red-50 border border-red-200 text-red-700">
                Hard: <span className="font-semibold">{v.hard}</span>
              </span>
              <span className="px-2 py-0.5 rounded-md bg-gray-50 border border-gray-200 text-gray-700">
                Total: <span className="font-semibold">{v.total}</span>
              </span>
            </div>
          )
        })()}
        {!mode && (
          <div className="text-[12px] text-gray-400">No question selection mode set.</div>
        )}
      </div>
    </div>
  )
}

// Friendly summary for sectionConfigs map — each section's pedagogy config.
function SectionConfigsSummary({ configs }: { configs: any }) {
  if (!configs || typeof configs !== 'object') return null
  const entries = Object.entries(configs)
  if (entries.length === 0) return null
  return (
    <ul className="space-y-2">
      {entries.map(([name, cfg]: [string, any]) => {
        const dur = cfg?.duration ?? cfg?.totalDuration
        const qCount = cfg?.totalQuestions ?? cfg?.questionCount
        const marks = cfg?.totalMarks
        const types: string[] = []
        if (cfg?.mcqQuestionConfiguration) types.push('MCQ')
        if (cfg?.programmingQuestionConfiguration) types.push('Programming')
        if (cfg?.othersQuestionConfiguration) types.push('Others')
        return (
          <li key={name} className="border rounded-md p-2 bg-gray-50">
            <div className="text-[12px] font-semibold">{name}</div>
            <div className="text-[11px] text-gray-600 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
              {qCount !== undefined && <span>Questions: <span className="font-medium">{qCount}</span></span>}
              {marks !== undefined && <span>Total marks: <span className="font-medium">{marks}</span></span>}
              {dur !== undefined && <span>Duration: <span className="font-medium">{dur} min</span></span>}
              {types.length > 0 && <span>Types: <span className="font-medium">{types.join(', ')}</span></span>}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

// Wraps Settings + Questions tabs. Questions tab only appears when the
// exercise's approvalScope is "settings_and_questions".
function DetailBody({
  detail, renderChain, token, onRefresh,
}: {
  detail: CourseApprovalItem
  renderChain: (item: CourseApprovalItem) => React.ReactNode
  token: string
  onRefresh: () => void
}) {
  const scope = detail.exercise?.availabilityPeriod?.approvalScope || 'settings'
  const hasQuestionsTab = scope === 'settings_and_questions'
  const [tab, setTab] = useState<'settings' | 'questions'>('settings')

  useEffect(() => { setTab('settings') }, [detail.exerciseId])

  return (
    <div>
      {hasQuestionsTab && (
        <div className="mb-3 inline-flex items-center gap-1 p-0.5 bg-gray-100 rounded-md border">
          <button
            type="button"
            onClick={() => setTab('settings')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              tab === 'settings' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Settings
          </button>
          <button
            type="button"
            onClick={() => setTab('questions')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              tab === 'questions' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Questions
          </button>
        </div>
      )}

      {tab === 'settings' && (
        <ExerciseFullDetail detail={detail} renderChain={renderChain} />
      )}
      {tab === 'questions' && (
        <QuestionsTab detail={detail} token={token} onRefresh={onRefresh} />
      )}
    </div>
  )
}

function QuestionsTab({
  detail, token, onRefresh,
}: {
  detail: CourseApprovalItem
  token: string
  onRefresh: () => void
}) {
  const questions: any[] = Array.isArray(detail.exercise?.questions) ? detail.exercise.questions : []
  const wf = detail.approvalWorkflow
  const currentStep = wf?.steps?.[(wf.currentStep || 1) - 1]
  const canAct = !!detail.canApprove

  const ctxFor = (q: any): QuestionContext => ({
    entityType: detail.entityType,
    entityId: String(detail.entityId),
    tabType: detail.tabType,
    subcategory: detail.subcategory,
    exerciseId: String(detail.exerciseId),
    questionId: String(q._id),
  })

  const [acting, setActing] = useState<string | null>(null)
  // Reject flow — same UX as raise-query but semantically a hard reject.
  // `openRejectFor` = questionId whose reject textarea is open.
  const [openRejectFor, setOpenRejectFor] = useState<string | null>(null)
  const [rejectText, setRejectText] = useState('')
  const [viewing, setViewing] = useState<any | null>(null)
  const viewingIndex = viewing
    ? questions.findIndex((q) => String(q._id) === String(viewing._id))
    : -1

  const approvedCount = questions.filter(q => (q?.approval?.status || 'pending') === 'approved').length
  const pendingCount = questions.filter(q => (q?.approval?.status || 'pending') === 'pending').length

  // Common approve for the whole list — one call approves every question
  // still 'pending'. Queried / rejected ones are skipped server-side and
  // must be decided individually.
  const handleApproveAll = async () => {
    setActing('__all__')
    try {
      const resp = await approveAllQuestions({
        entityType: detail.entityType,
        entityId: String(detail.entityId),
        tabType: detail.tabType,
        subcategory: detail.subcategory,
        exerciseId: String(detail.exerciseId),
      }, token)
      toast.success(resp?.message || 'Questions approved', { position: 'top-right' })
      onRefresh()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to approve questions', { position: 'top-right' })
    } finally {
      setActing(null)
    }
  }

  const handleApprove = async (q: any) => {
    setActing(String(q._id))
    try {
      await approveQuestion(ctxFor(q), token)
      toast.success('Question approved', { position: 'top-right' })
      onRefresh()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to approve', { position: 'top-right' })
    } finally {
      setActing(null)
    }
  }

  const handleReject = async (q: any) => {
    if (!rejectText.trim()) {
      toast.error('Type the rejection reason first', { position: 'top-right' })
      return
    }
    setActing(String(q._id))
    try {
      await rejectQuestion(ctxFor(q), rejectText.trim(), token)
      toast.success('Question rejected. Trainer notified.', { position: 'top-right' })
      setRejectText('')
      setOpenRejectFor(null)
      onRefresh()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to reject', { position: 'top-right' })
    } finally {
      setActing(null)
    }
  }

  if (!questions.length) {
    return (
      <div className="text-[12px] text-gray-500 py-8 text-center border border-dashed rounded-md">
        This exercise has no questions.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-[12px] text-gray-600">
          <span className="font-semibold text-gray-900">{approvedCount}</span> of{' '}
          <span className="font-semibold text-gray-900">{questions.length}</span> questions approved
          {currentStep && (
            <> · <span>at <span className="font-medium">Step {currentStep.order}: {currentStep.roleName}</span></span></>
          )}
        </div>
      </div>

      {questions.map((q, i) => {
        const ap = q.approval || {}
        const status = ap.status || 'pending'
        const qid = String(q._id)
        const isOpenReject = openRejectFor === qid
        const queriesArr: any[] = Array.isArray(ap.queries) ? ap.queries : []
        const latestQuery = queriesArr.length > 0 ? queriesArr[queriesArr.length - 1] : null
        // Action gating for rejected questions: only re-enable Approve/Reject
        // after the trainer has edited the question (server flips
        // `editedSinceReject`). Otherwise show View Details only.
        const isRejected = status === 'rejected'
        const reworked = !!ap.editedSinceReject
        const showActions = canAct && (status === 'pending' || (isRejected && reworked))
        return (
          <div key={qid} className="border rounded-md p-3 bg-white">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[12px] font-semibold text-gray-900">Q{i + 1}</span>
                  <QuestionStatusChip status={status} />
                  {q.questionType && (
                    <span className="text-[11px] text-gray-500">{q.questionType}</span>
                  )}
                  {(q.mcqQuestionScore || q.score) && (
                    <span className="text-[11px] text-gray-500">
                      {q.mcqQuestionScore ?? q.score} marks
                    </span>
                  )}
                </div>
                <QuestionPreview q={q} />
                {isRejected && ap.rejectionMessage && (
                  <div className="mt-2 text-[11px] rounded-md p-2 border border-red-200 bg-red-50 text-red-800">
                    <div className="font-semibold mb-0.5">Rejection reason</div>
                    <div className="whitespace-pre-wrap">{ap.rejectionMessage}</div>
                    {reworked && (
                      <div className="mt-1 text-[10px] text-red-600 font-semibold">
                        Trainer has edited this question — re-review.
                      </div>
                    )}
                  </div>
                )}
                {latestQuery && (
                  <QueryThread queries={queriesArr} />
                )}
              </div>
              <div className="flex items-start gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-3 text-xs gap-1.5"
                  onClick={() => setViewing(q)}
                >
                  <Eye className="h-3.5 w-3.5" /> View Details
                </Button>
                {showActions && (
                  <>
                    {/* Any in-flight action (incl. Approve-all) disables every
                        question button — overlapping read-modify-save requests
                        on the same parent doc would clobber each other. */}
                    <Button
                      size="sm"
                      className="h-7 px-3 text-xs bg-indigo-600 hover:bg-indigo-700"
                      disabled={acting !== null}
                      onClick={() => handleApprove(q)}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-3 text-xs border-red-300 text-red-700 hover:bg-red-50"
                      disabled={acting !== null}
                      onClick={() => { setOpenRejectFor(isOpenReject ? null : qid); setRejectText('') }}
                    >
                      Reject
                    </Button>
                  </>
                )}
              </div>
            </div>

            {canAct && isOpenReject && (
              <div className="mt-3 ml-2 border-l-2 border-red-300 pl-3">
                <div className="text-[11px] font-semibold text-red-700 mb-1">Reject with a message for the trainer</div>
                <textarea
                  className="w-full text-[12px] border rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-red-300"
                  rows={3}
                  placeholder="Describe what's wrong so the trainer can fix and resubmit."
                  value={rejectText}
                  onChange={(e) => setRejectText(e.target.value)}
                />
                <div className="flex items-center gap-2 mt-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 px-3 text-xs"
                    disabled={!rejectText.trim() || acting !== null}
                    onClick={() => handleReject(q)}
                  >
                    Reject &amp; Notify
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-3 text-xs"
                    onClick={() => { setOpenRejectFor(null); setRejectText('') }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Common approve bar — sits below the whole question list. */}
      {canAct && (
        <div className="flex items-center justify-between gap-2 flex-wrap border-t pt-3">
          <div className="text-[11px] text-gray-500">
            {pendingCount > 0
              ? `${pendingCount} question${pendingCount === 1 ? '' : 's'} still pending your decision.`
              : approvedCount === questions.length
                ? 'All questions approved — you can approve the exercise below.'
                : 'Queried / rejected questions need individual handling before this step can advance.'}
          </div>
          {pendingCount > 0 && (
            <Button
              size="sm"
              className="h-7 px-3 text-xs bg-indigo-600 hover:bg-indigo-700"
              disabled={acting !== null}
              onClick={handleApproveAll}
            >
              {acting === '__all__' ? 'Approving…' : `Approve all pending (${pendingCount})`}
            </Button>
          )}
        </div>
      )}

      {/* Per-question Detail Dialog */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className={`${poppins.className} flex flex-col w-[calc(100vw-2rem)] max-w-3xl h-[calc(100vh-2rem)] max-h-[85vh] my-4 p-0 rounded-lg overflow-hidden`}>
          <DialogHeader className="shrink-0 px-5 pt-4 pb-3 border-b">
            <DialogTitle className="text-[15px] font-semibold">
              Question {viewingIndex >= 0 ? `Q${viewingIndex + 1}` : ''} Details
            </DialogTitle>
            <DialogDescription className="text-[12px] text-gray-500 mt-0.5">
              {viewing?.questionType || 'question'} · {viewing?.mcqQuestionDifficulty || ''}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-5 py-4">
            {viewing && <QuestionDetail q={viewing} />}
          </div>
          <DialogFooter className="shrink-0 border-t px-5 py-3 bg-white">
            <Button variant="outline" size="sm" className="h-7 px-3 text-xs" onClick={() => setViewing(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function QuestionStatusChip({ status }: { status: string }) {
  if (status === 'approved') {
    return (
      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] h-4 px-1.5">
        Approved
      </Badge>
    )
  }
  if (status === 'queried') {
    return (
      <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] h-4 px-1.5">
        Awaiting trainer response
      </Badge>
    )
  }
  if (status === 'rejected') {
    return (
      <Badge className="bg-red-100 text-red-800 border-red-200 text-[10px] h-4 px-1.5">
        Rejected
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
      Pending
    </Badge>
  )
}

// Safely coerce any mongoose Mixed value (string, number, object, array of
// blocks, …) into a string suitable for rendering. Walks nested {text,value,
// label,name} fields used across the question schemas. Never throws and
// never returns a non-string.
function renderable(v: any): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (Array.isArray(v)) return v.map(renderable).filter(Boolean).join('\n')
  if (typeof v === 'object') {
    if (typeof v.text === 'string') return v.text
    if (typeof v.text === 'object') return renderable(v.text)
    if (typeof v.value === 'string') return v.value
    if (typeof v.label === 'string') return v.label
    if (typeof v.name === 'string') return v.name
    if (typeof v.html === 'string') return v.html.replace(/<[^>]+>/g, '')
    try { return JSON.stringify(v) } catch { return '' }
  }
  return String(v)
}

function QuestionPreview({ q }: { q: any }) {
  const title = renderable(q.mcqQuestionTitle ?? q.questionTitle ?? q.questionText ?? q.title)
  const desc = renderable(q.mcqQuestionDescription)
  const options: any[] = Array.isArray(q.mcqQuestionOptions) ? q.mcqQuestionOptions : []
  return (
    <div className="mt-1 text-[12px] text-gray-800">
      {title ? (
        <div className="whitespace-pre-wrap line-clamp-3">{title}</div>
      ) : (
        <div className="text-gray-400">No question text.</div>
      )}
      {desc && <div className="text-[11px] text-gray-500 mt-1 line-clamp-2">{desc}</div>}
      {options.length > 0 && (
        <ul className="mt-1 space-y-0.5 text-[11px] text-gray-700">
          {options.slice(0, 6).map((o, i) => (
            <li key={i} className="truncate">
              <span className="font-semibold mr-1">{String.fromCharCode(65 + i)}.</span>
              {renderable(o) || '—'}
            </li>
          ))}
          {options.length > 6 && (
            <li className="text-gray-400">…and {options.length - 6} more</li>
          )}
        </ul>
      )}
    </div>
  )
}

function QueryThread({ queries }: { queries: any[] }) {
  if (!queries || queries.length === 0) return null
  return (
    <div className="mt-2 border-l-2 border-amber-300 pl-3 space-y-1.5">
      {queries.map((q, i) => (
        <div key={i} className="text-[11px]">
          <div className="text-amber-800">
            <span className="font-semibold">Query</span> · {q.raisedByName || 'approver'}
            {q.raisedAt && <span className="text-amber-600/80"> · {new Date(q.raisedAt).toLocaleString()}</span>}
          </div>
          <div className="text-gray-700 whitespace-pre-wrap">{q.text}</div>
          {q.resolvedAt && (
            <div className="mt-1 text-emerald-800">
              <span className="font-semibold">Addressed</span> · {q.resolvedByName || 'trainer'} · {new Date(q.resolvedAt).toLocaleString()}
              {q.resolutionNote && (
                <div className="text-gray-700 whitespace-pre-wrap">"{q.resolutionNote}"</div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// Full details for a single question. Only renders fields that have a value —
// no dashes, no empty rows. Focuses on what an approver actually needs to
// read: title, description, options/answers, programming snippets, test cases.
function QuestionDetail({ q }: { q: any }) {
  const titleRaw = q.mcqQuestionTitle ?? q.questionTitle ?? q.title ?? q.questionText
  const titleText = renderable(titleRaw)
  const descriptionRaw = q.mcqQuestionDescription ?? q.questionDescription ?? q.description
  const description = renderable(descriptionRaw)
  const options: any[] = Array.isArray(q.mcqQuestionOptions) ? q.mcqQuestionOptions : []
  const correctAnswers: any[] = Array.isArray(q.mcqQuestionCorrectAnswers) ? q.mcqQuestionCorrectAnswers : []
  const matchingPairs: any[] = Array.isArray(q.matchingPairs) ? q.matchingPairs : []
  const testCases: any[] = Array.isArray(q.testCases) ? q.testCases : []
  const tags: any[] = Array.isArray(q.tags) ? q.tags : []
  const has = (v: any) => v !== undefined && v !== null && String(v).trim() !== ''

  return (
    <div className="space-y-5 text-[13px] text-gray-800">
      {/* Title */}
      {titleText && (
        <section>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Title</h4>
          <div className="bg-gray-50 rounded-md p-3 border">
            <RichContentBlocks value={titleRaw} fallback={titleText} />
          </div>
        </section>
      )}

      {/* Description */}
      {description && (
        <section>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Description</h4>
          <div className="bg-gray-50 rounded-md p-3 border">
            <RichContentBlocks value={descriptionRaw} fallback={description} />
          </div>
        </section>
      )}

      {/* Image (if any) */}
      {q.mcqQuestionImageUrl && (
        <section>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Image</h4>
          <img
            src={q.mcqQuestionImageUrl}
            alt="Question"
            style={{ width: `${q.mcqQuestionImageSizePercent || 100}%` }}
            className={`rounded-md border ${q.mcqQuestionImageAlignment === 'center' ? 'mx-auto' : q.mcqQuestionImageAlignment === 'right' ? 'ml-auto' : ''}`}
          />
        </section>
      )}

      {/* MCQ Options */}
      {options.length > 0 && (
        <section>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">
            Options ({options.length})
          </h4>
          <ul className="space-y-1.5">
            {options.map((o, i) => {
              const isCorrect = !!o?.isCorrect
              return (
                <li
                  key={i}
                  className={`p-2 border rounded-md text-[12px] ${isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-white'}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="font-semibold shrink-0">{String.fromCharCode(65 + i)}.</span>
                    <span className="flex-1 whitespace-pre-wrap">{renderable(o)}</span>
                    {o?.imageUrl && (
                      <img src={o.imageUrl} alt="Option" className="h-10 w-auto rounded border ml-2" />
                    )}
                    {isCorrect && (
                      <span className="text-[10px] font-semibold text-emerald-700">✓ Correct</span>
                    )}
                  </div>
                  {o?.explanation && (
                    <div className="mt-1 ml-5 text-[11px] text-gray-600 italic">{renderable(o.explanation)}</div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* Type-specific answers */}
      {q.trueFalseAnswer !== undefined && q.trueFalseAnswer !== null && (
        <section>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">True/False Answer</h4>
          <div className="text-[13px] font-semibold">{q.trueFalseAnswer ? 'True' : 'False'}</div>
        </section>
      )}
      {has(q.shortAnswer) && (
        <section>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Short Answer</h4>
          <div className="text-[12px] bg-gray-50 rounded-md p-3 border whitespace-pre-wrap">{q.shortAnswer}</div>
        </section>
      )}
      {has(q.essayAnswer) && (
        <section>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Essay Answer</h4>
          <div className="text-[12px] bg-gray-50 rounded-md p-3 border whitespace-pre-wrap">{q.essayAnswer}</div>
        </section>
      )}
      {has(q.numericAnswer) && (
        <section>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Numeric Answer</h4>
          <div className="text-[13px]">
            <span className="font-semibold">{q.numericAnswer}</span>
            {has(q.numericTolerance) && <span className="ml-2 text-[11px] text-gray-500">± {q.numericTolerance}</span>}
          </div>
        </section>
      )}

      {/* Correct-answer list (multi-select / dropdown / ordering) */}
      {correctAnswers.length > 0 && (
        <section>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Correct Answers</h4>
          <ul className="flex flex-wrap gap-1.5">
            {correctAnswers.map((a, i) => (
              <li key={i} className="px-2 py-0.5 text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
                {renderable(a)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Matching pairs */}
      {matchingPairs.length > 0 && (
        <section>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Matching Pairs</h4>
          <ul className="space-y-1">
            {matchingPairs.map((p: any, i: number) => (
              <li key={i} className="flex items-center gap-2 text-[12px] border rounded-md p-2 bg-gray-50">
                <span className="flex-1">{renderable(p?.left ?? p?.key)}</span>
                <span className="text-gray-400">↔</span>
                <span className="flex-1">{renderable(p?.right ?? p?.value)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Programming-specific fields — each rendered only when present */}
      {has(q.programmingLanguage) && (
        <section>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Language</h4>
          <div className="text-[13px]">{q.programmingLanguage}</div>
        </section>
      )}
      {has(q.sampleInput) && (
        <section>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Sample Input</h4>
          <pre className="text-[12px] bg-gray-50 border rounded-md p-2 whitespace-pre-wrap">{q.sampleInput}</pre>
        </section>
      )}
      {has(q.sampleOutput) && (
        <section>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Sample Output</h4>
          <pre className="text-[12px] bg-gray-50 border rounded-md p-2 whitespace-pre-wrap">{q.sampleOutput}</pre>
        </section>
      )}
      {has(q.starterCode) && (
        <section>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Starter Code</h4>
          <pre className="text-[11px] bg-gray-900 text-gray-100 rounded-md p-3 overflow-x-auto">{q.starterCode}</pre>
        </section>
      )}
      {has(q.solutionCode) && (
        <section>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Reference Solution</h4>
          <pre className="text-[11px] bg-gray-900 text-gray-100 rounded-md p-3 overflow-x-auto">{q.solutionCode}</pre>
        </section>
      )}

      {/* Test Cases — both visible (sample) and hidden ones together */}
      {testCases.length > 0 && (
        <section>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Test Cases ({testCases.length})</h4>
          <ul className="space-y-2">
            {testCases.map((tc: any, i: number) => (
              <li key={tc?.id || i} className="border rounded-md p-2 bg-gray-50 text-[11px]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold">Case {i + 1}</span>
                  {tc?.isSample && <span className="px-1.5 py-0 rounded text-[10px] bg-blue-50 text-blue-700 border border-blue-200">Sample</span>}
                  {tc?.isHidden && <span className="px-1.5 py-0 rounded text-[10px] bg-gray-100 text-gray-600 border">Hidden</span>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {has(tc?.input) && (
                    <div>
                      <div className="text-gray-500 mb-0.5">Input</div>
                      <pre className="bg-white border rounded p-1 whitespace-pre-wrap">{tc.input}</pre>
                    </div>
                  )}
                  {has(tc?.expectedOutput) && (
                    <div>
                      <div className="text-gray-500 mb-0.5">Expected Output</div>
                      <pre className="bg-white border rounded p-1 whitespace-pre-wrap">{tc.expectedOutput}</pre>
                    </div>
                  )}
                </div>
                {has(tc?.description) && (
                  <div className="mt-1 text-gray-600 italic">{tc.description}</div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <section>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Tags</h4>
          <ul className="flex flex-wrap gap-1.5">
            {tags.map((t: any, i: number) => (
              <li key={i} className="px-2 py-0.5 text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">
                {renderable(t)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

// Renders question title / description in the same layout the question forms
// use. Handles:
//   • a plain string (HTML-safe paragraph)
//   • a single object  { text, imageUrl, imageAlignment, imageSizePercent }
//   • an array of ContentBlock entries { type: text|code|image, value/url, …}
function RichContentBlocks({ value, fallback }: { value: any; fallback?: string }) {
  const renderText = (html: string, key: any) => {
    if (!html) return null
    const looksHtml = /<[a-z][\s\S]*>/i.test(html)
    return looksHtml ? (
      <div
        key={key}
        className="text-[13px] leading-relaxed [&_strong]:font-bold [&_em]:italic [&_u]:underline [&_p]:my-1 [&_ul]:list-disc [&_ul]:ml-5 [&_ol]:list-decimal [&_ol]:ml-5 [&_code]:px-1 [&_code]:py-0.5 [&_code]:bg-gray-100 [&_code]:rounded"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    ) : (
      <div key={key} className="text-[13px] whitespace-pre-wrap leading-relaxed">{html}</div>
    )
  }
  const renderCode = (code: string, key: any, lang?: string) => (
    <pre
      key={key}
      className="text-[12px] bg-gray-900 text-gray-100 rounded-md p-3 overflow-x-auto"
    >{code}</pre>
  )
  const renderImage = (url: string, key: any, alignment?: string, sizePercent?: number) => {
    const justify =
      alignment === 'left' ? 'flex-start' :
      alignment === 'right' ? 'flex-end' : 'center'
    return (
      <div key={key} style={{ display: 'flex', justifyContent: justify }} className="my-1">
        <img
          src={url}
          alt=""
          style={{ width: `${sizePercent || 60}%`, height: 'auto' }}
          className="rounded border"
        />
      </div>
    )
  }

  // ── Array of ContentBlock-like entries ───────────────────────────────────
  if (Array.isArray(value)) {
    const nodes = value.map((cb: any, i: number) => {
      if (!cb) return null
      const t = cb.type
      if (t === 'text') return renderText(cb.value || '', i)
      if (t === 'code') return renderCode(cb.value || '', i, cb.language)
      if (t === 'image' && cb.url) return renderImage(cb.url, i, cb.alignment, cb.sizePercent)
      // Object without recognised type — try text / value / image fields
      if (cb.text) return renderText(String(cb.text), i)
      if (cb.value) return renderText(String(cb.value), i)
      if (cb.imageUrl) return renderImage(cb.imageUrl, i, cb.imageAlignment, cb.imageSizePercent)
      return null
    }).filter(Boolean)
    return nodes.length > 0 ? <div className="space-y-2">{nodes}</div> : (
      <div className="text-[12px] text-gray-400 italic">{fallback || 'No content'}</div>
    )
  }

  // ── Single object with text/image fields (option-style title) ────────────
  if (value && typeof value === 'object') {
    return (
      <div className="space-y-2">
        {(value.text || value.value) && renderText(String(value.text || value.value), 't')}
        {value.imageUrl && renderImage(value.imageUrl, 'i', value.imageAlignment, value.imageSizePercent)}
      </div>
    )
  }

  // ── Plain string ────────────────────────────────────────────────────────
  if (typeof value === 'string' && value.trim()) {
    return renderText(value, 's')
  }

  return <div className="text-[12px] text-gray-400 italic">{fallback || 'No content'}</div>
}

function ChannelBlock({ title, channels }: { title: string; channels: any }) {
  return (
    <div className="border rounded-md p-2 bg-gray-50">
      <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">{title}</div>
      <div className="flex flex-wrap gap-1">
        {channels?.dashboard && <span className="px-1.5 py-0 text-[10px] bg-blue-100 text-blue-700 rounded">Dashboard</span>}
        {channels?.gmail && <span className="px-1.5 py-0 text-[10px] bg-red-100 text-red-700 rounded">Gmail</span>}
        {channels?.whatsapp && <span className="px-1.5 py-0 text-[10px] bg-emerald-100 text-emerald-700 rounded">WhatsApp</span>}
        {!channels?.dashboard && !channels?.gmail && !channels?.whatsapp && (
          <span className="text-[10px] text-gray-400">none</span>
        )}
      </div>
    </div>
  )
}
