"use client"

import { useState, useEffect, useMemo, Fragment } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft, BookOpen, GitBranch, Layers, UserPlus, SearchX,
} from "lucide-react"
import ApprovalHierarchyModal from '@/app/lms/component/ApprovalHierarchyModal'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import DashboardLayout from '@/app/lms/component/layout'
import EnrollmentTab from '@/app/lms/component/EnrollmentTab'
import { EmptyState, Skeleton, SkeletonTable, StatusPill } from '@/app/lms/shared/ui'
import { useCourseBatchesQuery } from '@/queries/courseBatches'
import { useServiceMapping } from '@/apiServices/serviceMappingService'

/* Standalone the screen brings the admin chrome with it; hosted inside another
   shell (the L&D console) it must not render a second sidebar and navbar.
   Declared at module scope so its identity is stable across renders — inline it
   would remount the whole subtree on every keystroke. */
function Shell({ embedded, children }: { embedded: boolean; children: React.ReactNode }) {
  return embedded ? <>{children}</> : <DashboardLayout>{children}</DashboardLayout>
}

export default function CourseParticipantsContent(
  { courseId: courseIdProp, embedded = false }: { courseId?: string; embedded?: boolean } = {}
) {
  const searchParams = useSearchParams()
  const router = useRouter()
  // A host that has no query string of its own passes the course down instead.
  const courseId = courseIdProp ?? searchParams.get('courseId')
  const batchId = searchParams.get('batchId')
  const batchName = searchParams.get('batchName')
  // Present only for degree-program courses, which route through the
  // Sections page (batch → section → users). Scopes user management
  // to that one section.
  const section = searchParams.get('section')
  // Full hierarchy context (batch → degree → department → section → semester).
  // Any subset may be present; each narrows the add-users list to that node.
  const degree = searchParams.get('degree')
  const department = searchParams.get('department')
  const semester = searchParams.get('semester')

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false)
  // The service-picker enroll flow (pick client's service by id → hierarchy →
  // students → enroll), separate from the in-tab EnrollmentTab add modal.

  // The header used to come from /getAll/courses-data/:courseId — the whole
  // course document (896 KB on the demo course: every module and pedagogy
  // tree, plus each enrolled user's full record) fetched WITHOUT an auth
  // header, to read three strings. courseName, courseCode and mappingId all
  // ride the batches response this page already needs.

  // ── Batches shown as tabs ────────────────────────────────────────────────
  // Enrollment is managed per batch; these tabs let the user switch batches
  // without leaving the page. Auth + endpoint mirror the Course Batches page.
  // Same cache entry the Batches and Sections pages fill — arriving here from
  // either of them costs no request at all.
  const { data: hierarchy, isLoading, error: hierarchyError } = useCourseBatchesQuery(courseId)
  const loading = !!courseId && isLoading
  const error = !courseId
    ? "No course ID found in URL. Please check the URL and try again."
    : hierarchyError
      ? (hierarchyError as Error).message || "Unknown error occurred"
      : null
  const batches = useMemo(
    () => (hierarchy?.batches || []) as Array<{ _id: string; batchName: string }>,
    [hierarchy]
  )
  const batchCtx = useMemo(
    () => ({ degree: hierarchy?.degree || '', semester: hierarchy?.semester || '' }),
    [hierarchy]
  )

  // ── The course's service mapping — for the breadcrumb's service id + year ──
  // The human service id ("b2i-deg-be-3") and the year live on the
  // ServiceMapping, so we read it through the service-mapping module's own
  // hook: same ['service-mapping','detail',id] entry the Business Management
  // pages use, so its mutations invalidate this too. Purely for display; a
  // miss just drops those two crumbs.
  const mappingId = hierarchy?.mappingId || ''
  const { data: mapping = null } = useServiceMapping(mappingId || undefined)

  // The enrollment URL for one batch, carrying the hierarchy context the
  // section/enrollment flow expects. Switching batch is just a param change, so
  // every existing reader (EnrollmentTab, the header, etc.) picks it up as before.
  const batchHref = (b: { _id: string; batchName: string }): string => {
    const params = new URLSearchParams({ courseId: courseId || '', batchId: b._id, batchName: b.batchName })
    if (batchCtx.degree) params.set('degree', batchCtx.degree)
    if (batchCtx.semester) params.set('semester', batchCtx.semester)
    return `?${params.toString()}`
  }

  // Arriving from the course menu (only a courseId), open the first batch so the
  // tabs have an active one and the enrollment table isn't empty. Also recovers
  // a STALE batchId — the server absorbs a leftover "Default" container into the
  // first real batch, so a URL still pointing at it would scope the roster to a
  // batch that no longer exists and show nobody.
  useEffect(() => {
    if (!batches.length || !courseId) return
    if (batchId && batches.some((b) => b._id === batchId)) return
    router.replace(batchHref(batches[0]))
    // batchHref is a pure helper of the same inputs already listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId, batches, courseId, batchCtx])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'bg-success-50 text-success-700 border-success-500/20'
      case 'draft':
        return 'bg-warn-50 text-warn-700 border-warn-500/20'
      case 'archived':
        return 'bg-ink-100 text-ink-700 border-ink-300'
      default:
        return 'bg-ink-100 text-ink-700 border-ink-300'
    }
  }

  if (loading) {
    // Skeleton mirroring the final geometry: breadcrumb line, header card,
    // batch-tab strip, then the roster table — no spinner-only load.
    return (
      <Shell embedded={embedded}>
        <div className="h-full min-h-0 overflow-y-auto px-6 py-5 md:px-8">
          <Skeleton className="h-3.5 w-72" />
          <div className="mt-4 rounded-xl border border-hairline bg-surface p-5 shadow-xs">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <Skeleton className="h-9 w-9 rounded-tile" />
                <div>
                  <Skeleton className="h-4 w-56" />
                  <Skeleton className="mt-2 h-3 w-36" />
                </div>
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-9 w-36 rounded-control" />
                <Skeleton className="h-9 w-36 rounded-control" />
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Skeleton className="h-8 w-24 rounded-chip" />
            <Skeleton className="h-8 w-24 rounded-chip" />
            <Skeleton className="h-8 w-24 rounded-chip" />
          </div>
          <div className="mt-3 rounded-xl border border-hairline bg-surface shadow-xs overflow-hidden">
            <SkeletonTable rows={7} cols={5} />
          </div>
        </div>
      </Shell>
    )
  }

  if (error || !hierarchy) {
    return (
      <Shell embedded={embedded}>
        <div className="h-full min-h-0 flex items-center justify-center px-6">
          <div className="w-full max-w-md rounded-xl border border-hairline bg-surface shadow-xs">
            <EmptyState
              icon={SearchX}
              title="Couldn't load this course"
              message={error || "Course not found"}
              primaryAction={
                <button
                  type="button"
                  onClick={() => router.push('/lms/pages/coursestructure')}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-control bg-gradient-to-b from-brand-400 to-brand-600 text-white text-sm font-semibold shadow-brand hover:brightness-105 transition-all"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to Courses
                </button>
              }
            />
          </div>
        </div>
      </Shell>
    )
  }

  const handleAddParticipants = () => {
    setIsAddModalOpen(true)
  }

  // A lone "Default" batch is the fallback container courses without real
  // batches enrol into — plumbing, not a cohort — so the strip only renders
  // when there is a real batch to switch to.
  const showBatchTabs = batches.length > 0
    && !(batches.length === 1 && (batches[0].batchName || '').trim().toLowerCase() === 'default')

  const handleCloseAddModal = () => {
    setIsAddModalOpen(false)
  }

  return (
    <Shell embedded={embedded}>
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        className="h-full flex flex-col overflow-hidden"
      >
        {/* Breadcrumb removed — the rail + back arrow carry the context. The
            corner-pinned notification bell stays; pr-16 keeps this first row's
            right-side buttons clear of it. */}

        {/* Course identity card: who this roster belongs to, plus the two page
            actions. Elevated on the sunken canvas per the console card anatomy. */}
        <div className={`px-6 md:px-8 pt-4${embedded ? "" : " pr-16 md:pr-16"}`}>
          <div className="rounded-xl border border-hairline bg-surface shadow-xs px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0 flex items-center gap-3">
              {/* Back to this course's hierarchy — same destination as the
                  breadcrumb's Courses/course links. */}
              <button
                type="button"
                onClick={() => router.push(mappingId
                  ? `/lms/pages/coursestructure?openMappingId=${mappingId}`
                  : '/lms/pages/coursestructure')}
                title="Back to this course's hierarchy"
                className="h-8 w-8 rounded-control flex items-center justify-center text-subtle hover:text-heading hover:bg-row-hover transition-colors shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <span className="h-9 w-9 rounded-tile bg-brand-wash flex items-center justify-center shrink-0">
                <BookOpen className="h-4 w-4 text-brand-strong" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-md font-semibold text-heading truncate">{hierarchy.courseName}</span>
                  {hierarchy.courseCode && (
                    <span className="inline-flex items-center h-[22px] px-2 rounded-chip bg-ink-100 text-ink-700 text-2xs font-semibold tabular-nums">
                      {hierarchy.courseCode}
                    </span>
                  )}
                  {/* No batch pill here — the active tab in the batch strip
                      below already says which batch the roster is scoped to. */}
                  {section && <StatusPill tone="info">Section: {section}</StatusPill>}
                </div>
                {/* No description line: the breadcrumb ("User enrolment"), the
                    roster itself and the Manage & Enroll button already say
                    everything a subtitle would repeat. */}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-control border border-hairline-strong bg-surface text-xs font-semibold text-body hover:bg-row-hover transition-colors"
                onClick={() => setIsApprovalModalOpen(true)}
              >
                <GitBranch className="h-3.5 w-3.5" />
                Approval Hierarchy
              </button>
              {/* Manage Course & Enroll — opens the full-screen picker of ALL
                  users in the system (search + role tabs + multi-select) and
                  enrols the chosen ones into the batch currently selected in the
                  tabs below. Auto-enrolment still runs on user creation; this is
                  the manual path for enrolling anyone into any course/batch. */}
              <button
                type="button"
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-control bg-gradient-to-b from-brand-400 to-brand-600 text-white text-xs font-semibold shadow-brand hover:brightness-105 active:scale-[.98] transition-all"
                onClick={handleAddParticipants}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Manage &amp; Enroll
              </button>
            </div>
          </div>
        </div>

        {/* One white card holds the batch switch AND the roster it scopes —
            same surface, so the relationship is physical, not implied. The
            switch is a full-width segmented control in the app's own idiom
            (the Hierarchy/Table toggle): sunken track, equal segments
            (2 → 50/50, n → 1/n), and a brand-gradient thumb that SLIDES to the
            chosen batch. Too many batches scrolls the track sideways rather
            than shrinking segments below readability. */}
        <div className="px-6 md:px-8 pt-3 pb-4 flex-1 min-h-0 flex flex-col">
          <div className="bg-surface rounded-xl border border-hairline shadow-xs p-3 sm:p-4 flex-1 min-h-0 flex flex-col">
            {/* Named so the pills need no decoding: "BATCH  [b1][b2]". The
                pills are content-sized — a switch between short names has no
                business spanning the row — and the brand-gradient thumb slides
                to the active one, same idiom as the Hierarchy/Table toggle. */}
            {showBatchTabs && (
              <div className="flex items-center gap-2.5 mb-3 flex-shrink-0">
                <span className="inline-flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-faint flex-shrink-0">
                  <Layers size={13} className="text-brand-500" /> Batches
                </span>
                <div className="inline-flex items-center gap-1 rounded-control bg-surface-sunken p-1 overflow-x-auto max-w-full">
                  {batches.map((b) => {
                    const active = b._id === batchId
                    return (
                      <button
                        key={b._id}
                        type="button"
                        onClick={() => router.push(batchHref(b))}
                        aria-pressed={active}
                        // The label sits above the sliding thumb (z-10), which
                        // is a sibling span so layoutId can animate it between
                        // pills.
                        className={`relative h-7 px-3.5 rounded-[6px] flex items-center justify-center text-xs font-semibold whitespace-nowrap transition-colors ${
                          active ? 'text-white' : 'text-subtle hover:text-heading'
                        }`}
                      >
                        {active && (
                          <motion.span
                            layoutId="batch-thumb"
                            transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
                            className="absolute inset-0 rounded-[6px] bg-gradient-to-b from-brand-400 to-brand-600 shadow-brand"
                          />
                        )}
                        <span className="relative z-10">{b.batchName}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            <div className="flex-1 min-h-0 flex flex-col">
            <EnrollmentTab
              courseId={courseId || ''}
              batchId={batchId || undefined}
              batchName={batchName || undefined}
              degree={degree || undefined}
              department={department || undefined}
              section={section || undefined}
              semester={semester || undefined}
              isAddModalOpen={isAddModalOpen}
              onAddModalClose={handleCloseAddModal}
              onOpenAddModal={handleAddParticipants}
            />
            </div>
          </div>
        </div>

        <ApprovalHierarchyModal
          open={isApprovalModalOpen}
          onClose={() => setIsApprovalModalOpen(false)}
          courseId={courseId || ''}
        />

      </motion.div>
    </Shell>
  )
}
