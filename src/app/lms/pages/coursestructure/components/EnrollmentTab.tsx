"use client"
import { getToken } from "@/lib/session";
import { API_BASE_URL } from "@/lib/http";

import { useState, useEffect, useMemo, useRef } from 'react'
import { Poppins } from 'next/font/google'
import { GraduationCap, Mail, Phone, UserIcon, UserPlus, Trash2, Calendar, Clock, Settings, CheckCircle, XCircle, Clock as ClockIcon, ToggleLeft, ToggleRight, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { fetchUsers, addUser, addParticipantsToCourse, removeParticipantFromCourse, removeMultipleParticipantsFromCourse, updateParticipantEnrollment } from '@/app/lms/pages/usermanagement/api/userService'
import { fetchRoles } from '@/apiServices/rolesApi'
import { userPermission } from '@/apiServices/tokenVerify'
import { UserModals } from '@/app/lms/pages/usermanagement/components/UserModals'
import type { Role as UmRole, UserFormData, ApiPermission, User as UmUser } from '@/app/lms/pages/usermanagement/components/types'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from 'sonner'
import { Toaster } from 'sonner'
import FilteredTable from './participantsFilteredTable'
import { cohortKey, readCohortKey, memberIds, copyPhaseSelections } from './enrollmentDrafts'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-poppins',
})

interface EnrollmentTabProps {
  courseId: string
  batchId?: string
  batchName?: string
  /** The phase whose batches are on screen; '' / undefined when the course has
   *  no phases. A batch is identified by (phase, batchName) — the name alone
   *  repeats across phases. */
  phase?: string
  /** Every phase available for this course. The enrol dialog can move between
   *  them without closing; selections remain isolated by (phase, batch). */
  phaseOptions?: string[]
  // Hierarchy scoping (batch → degree → department → section → semester).
  // Whichever of these is set narrows the add-users list to STUDENTS matching
  // that node; staff (no such fields on their profile) stay visible everywhere.
  degree?: string
  department?: string
  section?: string
  semester?: string
  isAddModalOpen?: boolean
  onAddModalClose?: () => void
  onOpenAddModal?: () => void
}

type User = {
  id: string
  _id?: string
  userId?: string
  firstName: string
  lastName: string
  email: string
  phone: string
  degree: string
  department: string
  year?: string
  status: 'active' | 'inactive'
  role: string
  roleId: string
  lastLogin: string
  semester?: string
  section?: string
  batch?: string
  clientName?: string
  clientId?: string
  gender?: string
  profile?: string
  createdAt?: string
  notes?: any[]
  permission?: any
}

type Enrollment = {
  user: User
  status: 'active' | 'suspended' | 'completed' | 'dropped'
  enableEnrolmentDates: boolean
  enrolmentStartsDate: string | null
  enrolmentEndsDate: string | null
  createdAt: string
  updatedAt: string
}

const showSuccessToast = (message: string) => {
  toast.success(message, {
    duration: 3000,
    position: "top-right",
  })
}

const showErrorToast = (message: string) => {
  toast.error(message, {
    duration: 4000,
    position: "top-right",
  })
}

const showWarningToast = (message: string) => {
  toast.warning(message, {
    duration: 3000,
    position: "top-right",
  })
}
const fetchCourseParticipants = async (courseId: string, institutionId: string, token: string) => {
  try {
    // ?roster=1 — this only ever reads batchAndParticipants plus the course's
    // clientId/clientName, but was pulling the entire course document
    // (896 KB on the demo course: every module and pedagogy tree, plus each
    // enrolled user's full record including their password hash).
    const response = await fetch(
      `${API_BASE_URL}/getAll/courses-data/${courseId}?roster=1`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'institution': institutionId,
        },
      }
    );
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to fetch course data');
    }
    
    const data = await response.json();
    
    if (!data.success || !data.data) {
      throw new Error('Invalid course data response');
    }
    
    return data.data;
  } catch (error) {
    console.error('Error fetching course participants:', error);
    throw error;
  }
};

export default function EnrollmentTab({
  courseId,
  batchId,
  batchName,
  phase,
  phaseOptions = [],
  degree,
  department,
  section,
  semester,
  isAddModalOpen = false,
  onAddModalClose,
  onOpenAddModal
}: EnrollmentTabProps) {
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [selectedEnrollment, setSelectedEnrollment] = useState<Enrollment | null>(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  // The enrol dialog is a DIFF, not an add-only list: the target batch's current
  // members arrive ticked, and what you tick/untick before saving is what gets
  // added/removed.
  //
  // Kept PER COHORT, not per dialog. A cohort is (phase, batch): Placement
  // Training deliberately repeats batch names in every phase, so a batch-name
  // key alone merges Phase I / Batch I with Phase II / Batch I.
  const [checkedByBatch, setCheckedByBatch] = useState<Record<string, string[]>>({})
  const [initialByBatch, setInitialByBatch] = useState<Record<string, string[]>>({})
  // The save runs two sequential requests, so it needs its own pending flag —
  // neither mutation's isPending covers the pair.
  const [isSavingEnrolment, setIsSavingEnrolment] = useState(false)
  const [selectedUsersToRemove, setSelectedUsersToRemove] = useState<string[]>([])
  const [confirmDiscardEnrol, setConfirmDiscardEnrol] = useState(false)
  const [showBulkRemoveConfirm, setShowBulkRemoveConfirm] = useState(false)
  const [showSingleRemoveConfirm, setShowSingleRemoveConfirm] = useState(false)
  const [userToRemove, setUserToRemove] = useState<string | null>(null)
  const [userToRemoveName, setUserToRemoveName] = useState<string>('')
    const [enrollmentStatus, setEnrollmentStatus] = useState<'active' | 'suspended' | 'completed' | 'dropped'>('active')
  const [enableEnrolmentDates, setEnableEnrolmentDates] = useState<boolean>(false)
  const [enrolmentStartsDate, setEnrolmentStartsDate] = useState<string>('')
  const [enrolmentEndsDate, setEnrolmentEndsDate] = useState<string>('')
  
  const [token, setToken] = useState<string | null>(null)
  const [institutionId, setInstitutionId] = useState<string | null>(null)
  const [basedOn, setBasedOn] = useState<string | null>(null)

  // Narrower scope: only the course's client's students. Available in the
  // picker but no longer the default.
  // DEFAULT ON — the picker opens on THIS CLIENT's people. A course belongs to
  // one client, and opening on every account in the institution meant scrolling
  // 228 rows of other clients' users to find the handful that could plausibly
  // be enrolled. "Everyone" is still one click away for the rare cross-client
  // case.
  const [allClientStudents, setAllClientStudents] = useState(false)
  const [allSystemUsers, setAllSystemUsers] = useState(true)

  // The batch the enrol will write into. Defaults to the tab you opened from but
  // is changeable IN the picker, so you can enrol into any of the course's
  // batches without closing and switching tabs — the batch is part of the flow,
  // not a thing you set outside it. Empty string = the course's implicit single
  // batch (courses with no named batches).
  const [targetPhase, setTargetPhase] = useState('')
  const [targetBatchName, setTargetBatchName] = useState('')
  useEffect(() => {
    if (!isAddModalOpen) return
    setTargetPhase(phase || '')
    setTargetBatchName(batchName || '')
    // A freshly opened dialog holds no drafts; each batch seeds itself from the
    // roster the first time it is selected.
    setCheckedByBatch({})
    setInitialByBatch({})
  }, [isAddModalOpen, batchName, phase])

  // The batch being edited right now, plus the draft that belongs to it. Every
  // existing read of "the selection" goes through these two, so the table, the
  // counts and the footer keep working on one batch at a time while the drafts
  // for the other batches sit untouched behind them.
  const activeBatchName = String(targetBatchName || batchName || '')
  const activePhaseName = String(targetPhase || phase || '')
  const activeBatchKey = cohortKey(activePhaseName, activeBatchName)
  const checkedUserIds = useMemo(
    () => checkedByBatch[activeBatchKey] || [],
    [checkedByBatch, activeBatchKey]
  )
  const initialMemberIds = useMemo(
    () => new Set(initialByBatch[activeBatchKey] || []),
    [initialByBatch, activeBatchKey]
  )
  const setCheckedForActiveBatch = (next: string[] | ((prev: string[]) => string[])) =>
    setCheckedByBatch((prev) => ({
      ...prev,
      [activeBatchKey]: typeof next === 'function' ? next(prev[activeBatchKey] || []) : next,
    }))


  // New User modal state (reuses user-management UserModals)
  const [showAddUserModal, setShowAddUserModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [newUserId, setNewUserId] = useState('')
  const [umRoles, setUmRoles] = useState<UmRole[]>([])
  const [isLoadingRoles, setIsLoadingRoles] = useState(false)
  const [umPermissions, setUmPermissions] = useState<ApiPermission[]>([])
  const emptyUserForm: UserFormData = {
    id: '', firstName: '', lastName: '', email: '', phone: '', password: '',
    role: 'Student', roleId: '', status: 'active', gender: 'Male',
    degree: '', department: '', semester: '', year: '', batch: '',
  }
  const [newUser, setNewUser] = useState<UserFormData>(emptyUserForm)

  const queryClient = useQueryClient()

  useEffect(() => {
    const storedToken = getToken()
    const storedInstitutionId = localStorage.getItem('smartcliff_institution')
    const storedBasedOn = localStorage.getItem('smartcliff_basedOn')

    setToken(storedToken)
    setInstitutionId(storedInstitutionId)
    setBasedOn(storedBasedOn)

    const perms = userPermission()
    if (perms.valid && perms.user) {
      setUmPermissions((perms.user as any).permissions || [])
    }
  }, [])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setIsLoadingRoles(true)
    fetchRoles(token)
      .then((result: any) => {
        if (!cancelled) setUmRoles(result?.roles || [])
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setIsLoadingRoles(false) })
    return () => { cancelled = true }
  }, [token])

  const { 
    data: courseData, 
    isLoading: isLoadingCourseData, 
    refetch: refetchCourseData 
  } = useQuery({
    queryKey: ['courseData', courseId, institutionId, token],
    queryFn: async () => {
      if (!token || !institutionId || !courseId) return null;
      
      try {
        const data = await fetchCourseParticipants(courseId, institutionId, token);
        return data;
      } catch (error) {
        console.error('Error fetching course data:', error);
        throw error;
      }
    },
    enabled: !!token && !!institutionId && !!courseId,
    // The participant roster is NOT cacheable for minutes at a time. It changes
    // from OUTSIDE this page: creating a student in User Management auto-enrols
    // them here, and nothing in this component knows that happened. With a 5
    // minute staleTime and no refetch on focus, coming back to this page served
    // the old course document and the new student simply was not in it — for up
    // to five minutes, then it fixed itself. Indistinguishable from "enrolment
    // is broken", and impossible to reproduce reliably, which is exactly what
    // made this hard to pin down.
    //
    // Always refetch on mount and on focus: this is a small document, and being
    // right matters far more here than saving one request.
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  // Snapshot the TARGET batch's members and pre-tick them.
  //
  // Keyed on the batch being enrolled into, not the tab that was open: the
  // picker lets you retarget, and the ticks must then describe THAT batch.
  // Deliberately NOT keyed on courseData — it is `staleTime: 0`, so a
  // background refetch while the dialog is open would re-snapshot and silently
  // re-tick rows the user had just unticked. Read through a ref instead.
  const courseDataRef = useRef<any>(courseData)
  courseDataRef.current = courseData
  const hasCourseRoster = !!courseData

  useEffect(() => {
    if (!isAddModalOpen || !hasCourseRoster) return
    const wanted = activeBatchName
    const batch = (courseDataRef.current?.batchAndParticipants || [])
      .filter((b: any) => String(b?.phase || '') === activePhaseName)
      .find((b: any) => String(b?.batchName || '') === wanted)
    // A phase switch may briefly retain the previous phase's batch name.
    // Wait for a valid target before taking the saved-members snapshot.
    if (!batch && activeBatchName) return
    const ids = memberIds(batch)

    // Seed a batch ONCE, the first time it is selected. Coming back to a batch
    // you already edited has to restore what you ticked there, not reset it to
    // the saved roster — the dropdown moves between drafts, it doesn't start
    // one over.
    setInitialByBatch((prev) => (prev[activeBatchKey] ? prev : { ...prev, [activeBatchKey]: ids }))
    setCheckedByBatch((prev) => (prev[activeBatchKey] ? prev : { ...prev, [activeBatchKey]: ids }))
  }, [isAddModalOpen, hasCourseRoster, activeBatchKey, activeBatchName, activePhaseName])

  // What the save has to do for the batch ON SCREEN.
  const toAdd = useMemo(
    () => checkedUserIds.filter((id) => !initialMemberIds.has(id)),
    [checkedUserIds, initialMemberIds]
  )
  const toRemove = useMemo(
    () => [...initialMemberIds].filter((id) => !checkedUserIds.includes(id)),
    [checkedUserIds, initialMemberIds]
  )

  // …and for EVERY batch with unsaved work. This is what the summary strip
  // lists and what one Save walks through, so picks made under Batch I land in
  // Batch I even though Batch II was the last thing on screen.
  const pendingByBatch = useMemo(
    () => Object.keys(checkedByBatch)
      .map((key) => {
        const [changePhase, changeBatch] = readCohortKey(key)
        const initial = new Set(initialByBatch[key] || [])
        const checked = checkedByBatch[key] || []
        return {
          key,
          phase: changePhase,
          batchName: changeBatch,
          add: checked.filter((id) => !initial.has(id)),
          remove: [...initial].filter((id) => !checked.includes(id)),
        }
      })
      .filter((c) => c.add.length > 0 || c.remove.length > 0),
    [checkedByBatch, initialByBatch]
  )
  const hasPendingChanges = pendingByBatch.length > 0

  // The batches of the PHASE on screen, for the target-batch picker.
  // Declared here — after courseData exists — because the header reads it.
  //
  // Scoped to the phase, and deduped: one record holds every phase's batches
  // and a phased course repeats its names, so listing them all offered "phase
  // 1, phase 2, phase 1, phase 2" with no way to tell which belonged to the
  // phase being worked on. Enrolling from here targets THIS phase only.
  const availablePhaseOptions = useMemo(() => Array.from(new Set([
    ...phaseOptions,
    ...(((courseData?.batchAndParticipants as { phase?: string }[]) || [])
      .map((b) => String(b?.phase || '').trim())
      .filter(Boolean)),
  ])), [phaseOptions, courseData?.batchAndParticipants])

  const copySourcePhase = availablePhaseOptions[0] || ''
  const showCopyPhase = !!copySourcePhase && activePhaseName !== copySourcePhase
  const [phaseCopyNotice, setPhaseCopyNotice] = useState<{ phase: string; message: string; summary: string } | null>(null)
  useEffect(() => {
    if (!isAddModalOpen) setPhaseCopyNotice(null)
  }, [isAddModalOpen])

  const handleCopyPhase = () => {
    if (isSavingEnrolment || !hasCourseRoster) return
    const result = copyPhaseSelections(
      courseData?.batchAndParticipants || [], copySourcePhase, activePhaseName,
      checkedByBatch, initialByBatch,
    )
    setInitialByBatch(result.initial)
    setCheckedByBatch(result.checked)
    const details = [
      `${result.added} additional selection${result.added === 1 ? '' : 's'} from ${copySourcePhase} across ${result.matchedBatches} matching batch${result.matchedBatches === 1 ? '' : 'es'}.`,
      'Switch batches to review, then tick or untick users and save changes.',
      result.skippedUsers.length ? `${result.skippedUsers.length} user(s) skipped because they are selected in another ${activePhaseName} batch.` : '',
      result.unmatchedBatches.length ? `No matching ${activePhaseName} batch for: ${result.unmatchedBatches.join(', ')}.` : '',
    ].filter(Boolean).join(' ')
    setPhaseCopyNotice({
      phase: activePhaseName,
      message: details,
      summary: `${result.added} preselected${result.skippedUsers.length || result.unmatchedBatches.length ? ' · see details' : ''}`,
    })
    if (result.skippedUsers.length || result.unmatchedBatches.length) {
      showWarningToast(details)
    }
  }

  const batchOptions: string[] = useMemo(() => Array.from(new Set(
    ((courseData?.batchAndParticipants as { batchName?: string; phase?: string; archivedBySync?: boolean }[]) || [])
      .filter((b) => String(b?.phase || '') === activePhaseName)
      // A Degree Program group the Service Mapping dropped keeps its students
      // but takes no new ones.
      .filter((b) => !b?.archivedBySync)
      .map((b) => (b?.batchName || '').trim())
      .filter(Boolean)
  )), [courseData?.batchAndParticipants, activePhaseName])

  // Degree Program: the section of the group being enrolled into. Its students
  // are the ones offered, and it is recorded on each enrolment. The picker can
  // retarget to another section's group, so this follows the target rather
  // than the tab the dialog was opened from. '' → the page's own context.
  const targetSection: string = useMemo(() => {
    const entry = ((courseData?.batchAndParticipants as { batchName?: string; phase?: string; section?: string }[]) || [])
      .find((b) => String(b?.phase || '') === activePhaseName && String(b?.batchName || '') === activeBatchName)
    return String(entry?.section || '').trim() || String(section || '')
  }, [courseData?.batchAndParticipants, activePhaseName, activeBatchName, section])

  // Changing phase changes the batch domain too. Preserve the same name when
  // that phase has it; otherwise open the phase's first batch.
  useEffect(() => {
    if (!isAddModalOpen || batchOptions.length === 0) return
    if (batchOptions.includes(targetBatchName)) return
    setTargetBatchName(batchOptions[0])
  }, [isAddModalOpen, batchOptions, targetBatchName])

  // "Default" is the fallback container the enrol path creates when a course
  // has no batches of its own (see courseStructure.js — it's absorbed into the
  // first real batch the moment one appears). So a course is batch-based only
  // once it carries a batch that isn't that placeholder; otherwise the picker
  // is shown disabled — there is nothing to choose between.
  const isBatchBased = batchOptions.some((bn) => bn.toLowerCase() !== 'default')
  const defaultBatchName = batchOptions[0] || ''

  // Course ▸ client ▸ service model, for the enrol dialog's subtitle.
  const courseTitle: string = courseData?.courseName || ''
  const courseClientName: string = courseData?.clientName || ''
  const courseServiceModal: string = courseData?.serviceModal || ''

  // Sections are stored on the user document — matching is by the user's
  // section field (trim + case-insensitive, sections are short codes like "A").
  // Only STUDENTS are scoped by section: staff (trainers, admins…) carry no
  // section on their profile and stay visible in every section. Role-name
  // check mirrors FilteredTable's role tabs (handles both the raw role object
  // and the already-transformed role string).
  const roleNameOf = (user: any) =>
    (typeof user?.role === 'string' ? user.role : user?.role?.renameRole || '').toLowerCase()

  const eq = (a: any, b?: string) =>
    !b || String(a || '').trim().toLowerCase() === String(b).trim().toLowerCase()

  // Scope students to the selected hierarchy node (batch → degree → department →
  // section → semester); staff carry none of these and remain visible everywhere.
  // Whichever fields are provided narrow the list; empty ones don't filter.
  // Takes the ENROLMENT record, not the user document. That distinction is the
  // whole fix: `batch` and `semester` do not exist on UserModel at all — they
  // are recorded on the batch participant subdoc, as "the hierarchy node this
  // participant was enrolled at". Reading them off the populated user therefore
  // always produced undefined, `eq(undefined, 'a')` was false, and EVERY student
  // was filtered out of a batch that genuinely contained them.
  //
  // `narrows` also restores the rule this function's own comment always claimed:
  // a context value that is empty must not filter anything. Comparing against an
  // empty context used to demand the record be empty too.
  const matchesSection = (enrollment: any, sectionScope: string | undefined = section) => {
    const user = enrollment?.user || enrollment
    if (roleNameOf(user) !== 'student') return true

    // Prefer the enrolment's own value, fall back to the user's. Older records
    // written before the hierarchy was stored per-participant only carry it on
    // the user, and those must keep working.
    const at = (key: string) => enrollment?.[key] ?? user?.[key]

    // Blank on EITHER side means "not scoped by this level", so it matches.
    //
    // Both directions are load-bearing:
    //   - blank CONTEXT  → viewing the whole course must not demand blank records
    //   - blank RECORD   → an enrolment that never recorded a level is not
    //                      scoped to it, so a view of Semester 1 must not hide it
    //
    // That second case is not hypothetical: auto-enrolment records degree,
    // department and section but deliberately leaves `semester` empty, because a
    // student belongs to the section for the whole programme rather than to one
    // semester of it. Comparing that empty value against a semester-scoped URL
    // evaluated eq('', '1') and silently hid EVERY auto-enrolled student —
    // which reads exactly like "enrolment is broken" rather than "the view is
    // over-filtering".
    const narrows = (context: any, value: any) =>
      !context || !String(value ?? '').trim() || eq(value, context)

    // Batch is deliberately NOT narrowed. A student belongs to a section; which
    // batch they were filed into is an artefact of auto-enrolment picking the
    // first one, not a fact about them. Narrowing by it split one cohort across
    // tabs and made most of a section look unenrolled.
    return (
      narrows(degree, at('degree')) &&
      narrows(department, at('department')) &&
      narrows(sectionScope, at('section')) &&
      narrows(semester, at('semester'))
    )
  }

  // Relaxed scope: all of the course's client's students (ignores batch/hierarchy).
  // Staff always visible; if the course's client is unknown, show all students.
  // Match on the client id OR the readable client name — a student belongs to the
  // client if either identifier lines up (their stored clientId ObjectId may point
  // at a differently-keyed client doc even though the company name is the same).
  const matchesClient = (user: any) => {
    if (roleNameOf(user) !== 'student') return true
    const cid = String(courseData?.clientId?._id || courseData?.clientId || '')
    const cname = courseData?.clientName || ''
    if (!cid && !cname) return true
    // getUserAccess returns each user's clientId REPLACED by the full client doc
    // (or null), so read the id off the object; fall back to a raw id if present.
    const uid = String(user?.clientId?._id || user?.clientId || '')
    if (cid && uid && uid === cid) return true
    if (cname && eq(user?.clientName, cname)) return true
    return false
  }

  const transformedParticipants = useMemo(() => {
    // ONLY the selected batch when a tab is open. The course's batches now come
    // from the service mapping (b1, b2, …) and Manage & Enroll writes into the
    // open tab's batch — so the tab must read back exactly what was enrolled
    // there. Showing every batch under every tab made b1's enrolments appear
    // under b2, which reads as "the batches don't work".
    //
    // (This list DID flatten all batches for a while: back then batch entries
    // were auto-created containers, not real cohorts, and auto-enrolment filed
    // whole sections into whichever entry came first, so scoping hid people.
    // Auto-enrolled students still land in the FIRST batch — they appear under
    // that tab, which is truthfully where they are filed; move or enrol them
    // per batch from there.)
    //
    // With no batch selected (a course with no batch tabs), every entry shows —
    // there is only the fallback container, and it holds the whole roster.
    const sourceBatches = (courseData?.batchAndParticipants || []).filter(
      (batch: any) => !batchId || String(batch?._id) === String(batchId)
    )
    const flatEnrollments = sourceBatches
      .flatMap((batch: any) =>
        (batch?.users || []).map((batchUser: any) => ({
          ...batchUser,
          batchId: batch?._id,
          batchName: batch?.batchName,
        }))
      )
      // Section context (degree-program flow) narrows students to that
      // section; staff are never filtered out.
      // The whole enrolment, NOT enrollment.user — the batch/semester it was
      // made at live on the enrolment record, never on the user document.
      .filter((enrollment: any) => matchesSection(enrollment));

    // One row per PERSON. In the no-tab case every batch is flattened, so a
    // student sitting in two batches of the same course would otherwise be
    // listed twice — and worse, selection and bulk-remove key off the user id,
    // so a duplicate row would make the checkboxes act in pairs. First
    // occurrence wins, which keeps the batch that actually holds them.
    const seen = new Set<string>();
    const uniqueEnrollments = flatEnrollments.filter((enrollment: any) => {
      const u = enrollment?.user || enrollment;
      const id = String(u?._id || u?.id || '');
      if (!id) return true;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    return uniqueEnrollments.map((enrollment: any) => {
      const user = enrollment.user || enrollment;
      
      let roleName = 'Unknown Role';
      let roleId = '';
      
      if (typeof user.role === 'string') {
        roleName = user.role;
        roleId = user.role;
      } else if (user.role?.renameRole) {
        roleName = user.role.renameRole;
        roleId = user.role._id;
      }

      const userData: User = {
        id: user._id || user.id,
        _id: user._id,
        userId: user.userId || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: user.phone || '',
        role: roleName,
        roleId: roleId,
        status: user.status || 'active',
        lastLogin: user.lastLogin || '',
        degree: user.degree || '',
        department: user.department || '',
        semester: user.semester || '',
        section: user.section || '',
        year: user.year || '',
        batch: user.batch || '',
        gender: user.gender || '',
        profile: user.profile || '',
        createdAt: user.createdAt || '',
        notes: user.notes || [],
        permission: user.permission || {}
      }

      return {
        user: userData,
        status: enrollment.status || 'active',
        batchId: enrollment.batchId || '',
        batchName: enrollment.batchName || '',
        enableEnrolmentDates: false,
        enrolmentStartsDate: null,
        enrolmentEndsDate: null,
        createdAt: enrollment.joinedAt || new Date().toISOString(),
        updatedAt: enrollment.updatedAt || new Date().toISOString()
      }
    })
    // Latest enrolment first — the roster leads with who just joined, so a
    // fresh batch of enrolments is immediately visible at the top.
    .sort((a: { createdAt: string }, b: { createdAt: string }) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    // EVERY value matchesSection reads must be listed. It previously named only
    // section, so moving between two nodes that share a section — Civil ▸ a to
    // Mechanical ▸ a — changed `department` without changing any dependency, the
    // memo never recomputed, and the new department's students never appeared.
    // The stale list looked exactly like "not enrolled", which is the worst kind
    // of caching bug: indistinguishable from a data problem.
  }, [courseData?.batchAndParticipants, batchId, batchName, degree, department, section, semester])


  const allParticipants = useMemo(() => {
    return transformedParticipants.map((enrollment: { user: any }) => enrollment.user);
  }, [transformedParticipants]);

  const {
    data: allUsersData,
    isLoading: isLoadingAllUsers,
    refetch: refetchAllUsers
  } = useQuery({
    // basedOn is NOT part of the key or the gate any more: /getAll/userAccess
    // returns every user of the institution regardless of it, and the Manage &
    // Enroll flow wants ALL users, so gating on basedOn (which is often unset)
    // was what made the picker come up empty.
    queryKey: ['allUsersForCourse', institutionId, token],
    queryFn: async () => {
      if (!token || !institutionId) return { users: [] }

      const data = await fetchUsers(institutionId, token, basedOn || '')

      const transformedUsers: User[] = (data.users || []).map((user: any) => {
        const roleName = user.role?.renameRole ||
                       (typeof user.role === 'string' ? user.role : 'Unknown Role')

        const roleId = user.role?._id || user.role

        return {
          id: user._id || user.id,
          _id: user._id,
          userId: user.userId || '',
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          email: user.email,
          phone: user.phone || '',
          role: roleName,
          roleId: roleId,
          status: user.status || 'active',
          lastLogin: user.lastLogin || '',
          degree: user.degree || '',
          department: user.department || '',
          semester: user.semester || '',
          section: user.section || '',
          year: user.year || '',
          batch: user.batch || '',
          clientName: user.clientName || '',
          clientId: (user.clientId && (user.clientId._id || user.clientId)) ? String(user.clientId._id || user.clientId) : '',
          gender: user.gender || '',
          profile: user.profile || '',
          createdAt: user.createdAt || '',
          notes: user.notes || [],
          permission: user.permission || {}
        }
      })

      return { users: transformedUsers }
    },
    enabled: !!token && !!institutionId && isAddModalOpen,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const availableUsersToAdd = useMemo(() => {
    // The target batch's OWN members are not excluded — they are the rows that
    // arrive ticked, and unticking one is how you remove it. Only members of
    // the course's OTHER batches stay withheld: a student belongs to exactly
    // one batch of a course, and the server rejects a second (staff are exempt,
    // a trainer serves several batches). Offering them would produce a picker
    // whose save the server refuses.
    // Three scopes, widest first:
    //   allSystemUsers  → EVERY user in the institution
    //   allClientStudents → every student of this course's client
    //   default → students matching the course's hierarchy node
    // The role tabs in the picker still let staff/student be filtered on top.
    const scopeFn = allSystemUsers
      ? (() => true)
      : allClientStudents
        ? matchesClient
        : (u: User) => matchesSection(u, targetSection)
    // Students in another batch of THIS phase are NOT filtered out — they are
    // returned and disabled by `blockedByBatch` below, so the picker says why
    // they cannot be chosen instead of appearing to not exist.
    const pool = (allUsersData?.users || []).filter((u: User) => {
      const id = String(u._id || u.id || '')
      if (initialMemberIds.has(id) || checkedUserIds.includes(id)) return true
      return scopeFn(u)
    })
    // A current member the user list does not carry (another client, or filtered
    // away) would otherwise vanish from the dialog — and a row that is not
    // rendered cannot be ticked, so saving would read it as a removal. Pull it
    // back in from the roster.
    const present = new Set(pool.map((u: User) => String(u._id || u.id || '')))
    const visibleMemberIds = new Set([...initialMemberIds, ...checkedUserIds])
    const missingMembers = (courseData?.batchAndParticipants || [])
      .flatMap((b: any) => b?.users || [])
      .map((e: any) => e?.user || e)
      .filter((u: any) => {
        const id = String(u?._id || u?.id || '')
        if (!id || !visibleMemberIds.has(id) || present.has(id)) return false
        present.add(id)
        return true
      })
      .map((u: any) => ({
        ...u,
        id: String(u._id || u.id),
        role: typeof u.role === 'string' ? u.role : u.role?.renameRole || 'Unknown Role',
        roleId: typeof u.role === 'string' ? u.role : u.role?._id || '',
      }))
    return [...pool, ...missingMembers]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allUsersData?.users, initialMemberIds, checkedUserIds, allSystemUsers, allClientStudents, degree, department, section, targetSection, semester, courseData?.clientId, courseData?.clientName, courseData?.batchAndParticipants])

  // Who cannot be ticked for the target batch, and why.
  //
  // A STUDENT belongs to exactly one batch OF A PHASE — the server enforces it
  // and rejects the save otherwise. Scoped to the phase deliberately: a student
  // in Phase I's "phase 1" is a different cohort from Phase II's, so they stay
  // freely selectable there. Staff are exempt; a trainer serves several batches.
  const blockedByBatch = useMemo(() => {
    const wanted = activeBatchName
    const out: Record<string, string> = {}
    ;(courseData?.batchAndParticipants || []).forEach((b: any) => {
      if (String(b?.phase || '') !== activePhaseName) return
      if (String(b?.batchName || '') === wanted) return
      ;(b?.users || []).forEach((e: any) => {
        const u = e?.user || e
        const id = String(u?._id || u?.id || '')
        if (!id) return
        if (roleNameOf(u) !== 'student') return
        out[id] = `In ${b?.batchName || 'another batch'}`
      })
    })
    return out
  }, [courseData?.batchAndParticipants, activeBatchName, activePhaseName])

  // One lookup for both the pending-block rule (which needs a role) and the
  // summary strip (which needs a name). The roster is folded in so a member the
  // user list doesn't carry still resolves to a name rather than an id.
  const usersById = useMemo(() => {
    const m = new Map<string, any>()
    ;(allUsersData?.users || []).forEach((u: any) => m.set(String(u._id || u.id || ''), u))
    ;(courseData?.batchAndParticipants || []).forEach((b: any) =>
      (b?.users || []).forEach((e: any) => {
        const u = e?.user || e
        const id = String(u?._id || u?.id || '')
        if (id && !m.has(id)) m.set(id, u)
      }))
    return m
  }, [allUsersData?.users, courseData?.batchAndParticipants])

  const nameOfId = (id: string) => {
    const u = usersById.get(id)
    if (!u) return 'Unknown user'
    return [u.firstName, u.lastName].filter(Boolean).join(' ').trim()
      || u.name || u.email || 'Unknown user'
  }

  // Already spoken for by ANOTHER batch's draft. Same rule as the saved roster
  // above — a student sits in exactly one batch of a phase — applied to picks
  // that have not been saved yet, so ticking someone for Batch I takes them out
  // of play in Batch II instead of the later pick quietly winning.
  const pendingElsewhere = useMemo(() => {
    const out: Record<string, string> = {}
    Object.keys(checkedByBatch).forEach((key) => {
      if (key === activeBatchKey) return
      const [otherPhase, otherBatch] = readCohortKey(key)
      // The one-batch-per-student rule is phase-local. A learner selected for
      // Phase I remains available in Phase II.
      if (otherPhase !== activePhaseName) return
      const initial = new Set(initialByBatch[key] || [])
      ;(checkedByBatch[key] || []).forEach((id) => {
        if (initial.has(id)) return                             // saved there, not a pick
        if (roleNameOf(usersById.get(id)) !== 'student') return // staff serve several batches
        out[id] = `Picked for ${otherBatch || 'this course'}`
      })
    })
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedByBatch, initialByBatch, activeBatchKey, activePhaseName, usersById])

  // Who the table may not tick for the batch on screen. Anyone you have just
  // UNticked out of another batch is dropped back in: removals run before adds,
  // so their slot is free by the time this batch's add lands, and that is what
  // makes moving someone between batches a single save.
  const disabledForActiveBatch = useMemo(() => {
    const out: Record<string, string> = { ...blockedByBatch }
    pendingByBatch.forEach((c) => {
      if (c.key === activeBatchKey || c.phase !== activePhaseName) return
      c.remove.forEach((id) => { delete out[id] })
    })
    return { ...out, ...pendingElsewhere }
  }, [blockedByBatch, pendingElsewhere, pendingByBatch, activeBatchKey, activePhaseName])

  const addParticipantsMutation = useMutation({
    mutationFn: async (participantData: { participantIds: string[], enrollmentData: any }) => {
      if (!token || !institutionId || !courseId) {
        throw new Error('Missing required data')
      }
      
      return await addParticipantsToCourse(
        courseId,
        participantData.participantIds,
        institutionId,
        token,
        participantData.enrollmentData,
        // Enrol into the batch chosen in the picker, not just the tab we came
        // from — the two are the same until the user picks another.
        activeBatchName || 'Default',
        { degree, department, section: targetSection || section, semester, phase: activePhaseName }
      )
    },
    onSuccess: (data) => {
      showSuccessToast(data.message || "Participants added successfully!")
      setCheckedByBatch({})
      setInitialByBatch({})
      refetchCourseData()
      refetchAllUsers()
      queryClient.invalidateQueries({ queryKey: ['courseData', courseId] })
      if (onAddModalClose) onAddModalClose()
    },
    onError: (error: any) => {
      showErrorToast(error.message || "Failed to add participants. Please try again.")
    }
  })

  const removeParticipantMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!token || !institutionId || !courseId) {
        throw new Error('Missing required data')
      }
      
      return await removeParticipantFromCourse(courseId, userId, institutionId, token, batchId)
    },
    onSuccess: (data) => {
      showSuccessToast(data.message || "Participant removed successfully!")
      setSelectedUsersToRemove([])
      setUserToRemove(null)
      setUserToRemoveName('')
      refetchCourseData()
      refetchAllUsers()
      queryClient.invalidateQueries({ queryKey: ['courseData', courseId] })
    },
    onError: (error: any) => {
      showErrorToast(error.message || "Failed to remove participant. Please try again.")
      setUserToRemove(null)
      setUserToRemoveName('')
    }
  })

  const updateEnrollmentMutation = useMutation({
    mutationFn: async ({ userId, enrollmentData }: { userId: string, enrollmentData: any }) => {
      if (!token || !institutionId || !courseId) {
        throw new Error('Missing required data')
      }
      
      return await updateParticipantEnrollment(
        courseId,
        userId,
        { ...enrollmentData, ...(batchId ? { batchId } : {}) },
        institutionId,
        token
      )
    },
    onSuccess: (data) => {
      showSuccessToast(data.message || "Enrollment updated successfully!")
      setIsSettingsModalOpen(false)
      setSelectedEnrollment(null)
      refetchCourseData()
      queryClient.invalidateQueries({ queryKey: ['courseData', courseId] })
    },
    onError: (error: any) => {
      showErrorToast(error.message || "Failed to update enrollment. Please try again.")
    }
  })

  const removeParticipantsMutation = useMutation({
    mutationFn: async (participantIds: string[]) => {
      if (!token || !institutionId || !courseId) {
        throw new Error('Missing required data')
      }
      
      return await removeMultipleParticipantsFromCourse(courseId, participantIds, institutionId, token, batchId)
    },
    onSuccess: (data) => {
      showSuccessToast(data.message || `${selectedUsersToRemove.length} participant(s) removed successfully!`)
      setShowBulkRemoveConfirm(false)
      setSelectedUsersToRemove([])
      refetchCourseData()
      refetchAllUsers()
      queryClient.invalidateQueries({ queryKey: ['courseData', courseId] })
    },
    onSettled: () => {
      setSelectedUsersToRemove([])
    },
    onError: (error: any) => {
      showErrorToast(error.message || "Failed to remove participants. Please try again.")
    }
  })

  const addUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      if (!token) throw new Error('Missing token')
      return await addUser(userData, token)
    },
    onSuccess: (data: any) => {
      const createdId = data?.user?.userId || data?.user?._id || data?.user?.id || ''
      setNewUserId(createdId)
      setShowAddUserModal(false)
      setShowSuccessModal(true)
      setNewUser(emptyUserForm)
      refetchAllUsers()
      queryClient.invalidateQueries({ queryKey: ['allUsersForCourse'] })
      showSuccessToast('User added successfully')
    },
    onError: (err: any) => {
      showErrorToast(err?.message || 'Failed to add user')
    }
  })

  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUser.roleId) {
      showErrorToast('Please select a role')
      return
    }
    const userData: any = {
      email: newUser.email,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      phone: newUser.phone,
      role: newUser.roleId,
      gender: newUser.gender,
      status: newUser.status,
      ...(newUser.password && { password: newUser.password }),
    }
    if (basedOn === 'college') {
      if (newUser.degree) userData.degree = newUser.degree
      if (newUser.department) userData.department = newUser.department
      if (newUser.semester) userData.semester = newUser.semester
      if (newUser.year) userData.year = newUser.year
    }
    if ((basedOn === 'college' || basedOn === 'skilling') && newUser.batch) {
      userData.batch = newUser.batch
    }
    await addUserMutation.mutateAsync(userData)
  }

  const handleOpenNewUserModal = () => {
    setNewUser(emptyUserForm)
    setShowAddUserModal(true)
  }

  const handleConfirmBulkRemove = () => {
    if (selectedUsersToRemove.length === 0) return
    
    removeParticipantsMutation.mutate(selectedUsersToRemove)
  }

  const handleConfirmSingleRemove = () => {
    if (!userToRemove) return
    
    removeParticipantMutation.mutate(userToRemove)
    setShowSingleRemoveConfirm(false)
  }

  const handleAddParticipants = () => {
    if (onOpenAddModal) {
      onOpenAddModal()
    }
  }

  const handleViewUser = (user: User) => {
    setSelectedUser(user)
    setIsDetailsModalOpen(true)
  }

  const handleOpenSettings = (user: User) => {
    const enrollment = transformedParticipants.find((e: { user: { _id: string | undefined; id: string } }) => e.user._id === user._id || e.user.id === user.id);
    if (enrollment) {
      setSelectedEnrollment(enrollment);
      setEnrollmentStatus(enrollment.status);
      setEnableEnrolmentDates(enrollment.enableEnrolmentDates || false);
      
      if (enrollment.enableEnrolmentDates && enrollment.enrolmentStartsDate) {
        setEnrolmentStartsDate(formatDateForInput(enrollment.enrolmentStartsDate));
      } else {
        setEnrolmentStartsDate('');
      }
      
      if (enrollment.enableEnrolmentDates && enrollment.enrolmentEndsDate) {
        setEnrolmentEndsDate(formatDateForInput(enrollment.enrolmentEndsDate));
      } else {
        setEnrolmentEndsDate('');
      }
      
      setIsSettingsModalOpen(true);
    }
  }

  const handleSaveEnrollmentSettings = () => {
    if (!selectedEnrollment) return;

    let enrollmentData: any = {
      status: enrollmentStatus,
      enableEnrolmentDates: enableEnrolmentDates,
      updatedAt: new Date().toISOString()
    };

    if (enableEnrolmentDates) {
      const startDate = enrolmentStartsDate || formatDateForInput(new Date().toISOString());
      enrollmentData.enrolmentStartsDate = startDate;
      
      if (startDate) {
        const endDate = new Date(startDate);
        endDate.setFullYear(endDate.getFullYear() + 1);
        enrollmentData.enrolmentEndsDate = formatDateForInput(endDate.toISOString());
      }
    }

    updateEnrollmentMutation.mutate({
      userId: selectedEnrollment.user._id || selectedEnrollment.user.id,
      enrollmentData
    });
  }

  // Ticks land in the draft of the batch ON SCREEN — never in a shared pile.
  const handleUserSelectionToggle = (userId: string) => {
    if (isSavingEnrolment || !hasCourseRoster) return
    setCheckedForActiveBatch(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const handleSelectAllUsers = (participantIds: string[]) => {
    if (isSavingEnrolment || !hasCourseRoster) return
    setCheckedForActiveBatch(participantIds)
  }

  const handleSubmitParticipants = async () => {
    if (!hasPendingChanges) {
      showWarningToast("Nothing to save — tick or untick someone first.")
      return
    }
    // Only REQUIRE a batch when the course actually has batches. A course with no
    // batches enrols students straight into the course (implicit single batch).
    if (isBatchBased && pendingByBatch.some((c) => !c.batchName)) {
      showWarningToast("No batch selected. Open this page from a batch's Manage Participants action.")
      return
    }
    if (!token || !institutionId || !courseId) {
      showErrorToast('Missing required data')
      return
    }

    // The two calls key the batch DIFFERENTLY — add by NAME, remove by _id —
    // so each target batch has to be resolved both ways.
    const batchRecordFor = (wantedPhase: string, wanted: string, roster: any[]) => (roster || []).find(
      (b: any) => String(b?.batchName || '') === wanted
        && String(b?.phase || '') === wantedPhase
    )
    const roster = courseData?.batchAndParticipants || []
    const changes = pendingByBatch

    setIsSavingEnrolment(true)
    try {
      // Never let an unresolved target turn a batch removal into a course-wide
      // removal (the removal API treats an omitted batchId as all batches).
      for (const change of changes) {
        if (change.remove.length && !batchRecordFor(change.phase, change.batchName, roster)?._id) {
          throw new Error(`Could not find ${change.phase} ${change.batchName}. Reload and try again.`)
        }
      }
      // Every batch's removals FIRST, then every batch's adds. A student sits in
      // exactly one batch of a course, so freeing the slots before anything is
      // added is what lets one save move someone from Batch I to Batch II
      // instead of tripping the server's rule.
      for (const change of changes) {
        if (change.remove.length === 0) continue
        await removeMultipleParticipantsFromCourse(
          courseId, change.remove, institutionId, token,
          batchRecordFor(change.phase, change.batchName, roster)?._id
        )
      }
      for (const change of changes) {
        if (change.add.length === 0) continue
        await addParticipantsToCourse(
          courseId, change.add, institutionId, token, { status: 'active' },
          change.batchName || 'Default',
          {
            degree, department, semester, phase: change.phase,
            // Degree Program: each group records its OWN section.
            section: String(batchRecordFor(change.phase, change.batchName, roster)?.section || '').trim() || section,
          }
        )
      }
      const added = changes.reduce((n, c) => n + c.add.length, 0)
      const removed = changes.reduce((n, c) => n + c.remove.length, 0)
      const parts = [
        added ? `${added} enrolled` : '',
        removed ? `${removed} removed` : '',
        changes.length > 1 ? `across ${changes.length} batches` : '',
      ].filter(Boolean)
      showSuccessToast(parts.join(' · '))
      refetchCourseData()
      refetchAllUsers()
      queryClient.invalidateQueries({ queryKey: ['courseData', courseId] })
      queryClient.invalidateQueries({ queryKey: queryKeys.courseBatches.detail(courseId) })
      if (onAddModalClose) onAddModalClose()
    } catch (error: any) {
      // Surface the server's own words — "already in another batch" is a real
      // and reachable outcome here, and a generic message hides which rule bit.
      showErrorToast(error?.message || 'Could not save the enrolment changes.')
      // Re-snapshot EVERY drafted batch from the truth so a retry replays only
      // what is still outstanding rather than repeating work that already
      // landed — a multi-batch save can fail halfway through.
      const fresh = await refetchCourseData()
      const freshRoster = (fresh as any)?.data?.batchAndParticipants || []
      setInitialByBatch((prev) => {
        const next = { ...prev }
        Object.keys(prev).forEach((key) => {
          const [changePhase, changeBatch] = readCohortKey(key)
          const batch = batchRecordFor(changePhase, changeBatch, freshRoster)
          if (!batch) return
          next[key] = Array.from(new Set<string>(
            (batch.users || [])
              .map((e: any) => String(e?.user?._id || e?.user || e?._id || ''))
              .filter(Boolean)
          ))
        })
        return next
      })
    } finally {
      setIsSavingEnrolment(false)
    }
  }

  // Students in the currently-scoped list (section/hierarchy) not yet ticked for
  // this batch. Blocked students are excluded — including anyone already picked
  // for another batch in this same dialog: "Add all" ticking someone the save
  // will be refused for turns one click into a guaranteed 400.
  const matchingStudents = useMemo(
    () => availableUsersToAdd.filter((u: User) => {
      const id = String(u._id || u.id || '')
      return roleNameOf(u) === 'student'
        && !disabledForActiveBatch[id]
        && !checkedUserIds.includes(id)
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [availableUsersToAdd, disabledForActiveBatch, checkedUserIds]
  )

  // One click: tick every student matching this section/hierarchy node INTO the
  // batch on screen. It ticks rather than enrols — with a draft per batch, the
  // only thing that writes is Save, or this would file everyone into whichever
  // batch was selected at the time and bypass the other batches' drafts.
  const handleAddAllMatching = () => {
    if (isSavingEnrolment || !hasCourseRoster) return
    // Only REQUIRE a batch when the course actually has batches. A course with no
    // batches enrols students straight into the course (implicit single batch).
    if (isBatchBased && !activeBatchName) {
      showWarningToast("No batch selected. Open this page from a batch's Manage Participants action.")
      return
    }
    const ids = matchingStudents.map((u: User) => String(u._id || u.id || '')).filter(Boolean)
    if (ids.length === 0) {
      showWarningToast("No matching students left to add.")
      return
    }
    setCheckedForActiveBatch((prev) => Array.from(new Set([...prev, ...ids])))
  }

  const handleRemoveParticipant = (userId: string, userName: string) => {
    setUserToRemove(userId)
    setUserToRemoveName(userName)
    setShowSingleRemoveConfirm(true)
  }

  const handleBulkRemove = (participantIds: string[]) => {
    setSelectedUsersToRemove(participantIds)
    setShowBulkRemoveConfirm(true)
  }

  const handleSelectAllUsersForRemoval = (participantIds: string[]) => {
    setSelectedUsersToRemove(participantIds)
  }
  
  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase()
  }
  
  const formatDate = (dateString: string | null) => {
    if (!dateString || dateString === 'null' || dateString === '') return 'N/A'
    try {
      return new Date(dateString).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    } catch {
      return 'N/A'
    }
  }

  const formatDateForInput = (dateString: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toISOString().split('T')[0]
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { variant: 'default', className: 'bg-success-50 text-success-700 ring-1 ring-inset ring-success-500/20', icon: CheckCircle },
      suspended: { variant: 'secondary', className: 'bg-ink-100 text-ink-700 ring-1 ring-inset ring-ink-500/20', icon: XCircle },
      completed: { variant: 'default', className: 'bg-info-50 text-info-700 ring-1 ring-inset ring-info-500/20', icon: CheckCircle },
      dropped: { variant: 'destructive', className: 'bg-danger-50 text-danger-700 ring-1 ring-inset ring-danger-500/20', icon: XCircle }
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.suspended
    const Icon = config.icon
    
    return (
      <Badge 
        variant={config.variant as any}
        className={`flex items-center gap-1 ${config.className}`}
      >
        <Icon className="h-3 w-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  const handleCloseAddModal = () => {
    setCheckedByBatch({})
    setInitialByBatch({})
    // Reset to the "Everyone" default so the next open starts wide again,
    // matching the initial state above.
    setAllSystemUsers(true)
    setAllClientStudents(false)
    setConfirmDiscardEnrol(false)
    if (onAddModalClose) onAddModalClose()
  }

  // Closing with unsaved work would silently drop it — across EVERY batch you
  // drafted, not just the one on screen — so the X and Cancel confirm first.
  // The backdrop can't close it at all.
  const requestCloseAddModal = () => {
    if (hasPendingChanges) {
      setConfirmDiscardEnrol(true)
      return
    }
    handleCloseAddModal()
  }

  const handleCloseSettingsModal = () => {
    setIsSettingsModalOpen(false)
    setSelectedEnrollment(null)
    setEnrollmentStatus('active')
    setEnableEnrolmentDates(false)
    setEnrolmentStartsDate('')
    setEnrolmentEndsDate('')
  }

  const renderEnrollmentDates = (enrollment: Enrollment) => {
    if (!enrollment.enableEnrolmentDates) {
      return (
        <>
          <div>
            <Label className="text-xs text-subtle">Enrollment Starts</Label>
            <p className="text-sm text-faint">Not set</p>
          </div>
          <div>
            <Label className="text-xs text-subtle">Enrollment Ends</Label>
            <p className="text-sm text-faint">Not set</p>
          </div>
        </>
      );
    }

    return (
      <>
        <div>
          <Label className="text-xs text-subtle">Enrollment Starts</Label>
          <p className="text-sm">{formatDate(enrollment.enrolmentStartsDate)}</p>
        </div>
        <div>
          <Label className="text-xs text-subtle">Enrollment Ends</Label>
          <p className="text-sm">{formatDate(enrollment.enrolmentEndsDate)}</p>
        </div>
      </>
    );
  };
function calculateDuration(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const years = Math.floor(diffDays / 365);
  const months = Math.floor((diffDays % 365) / 30);
  const days = diffDays % 30;
  
  let result = [];
  if (years > 0) result.push(`${years} year${years > 1 ? 's' : ''}`);
  if (months > 0) result.push(`${months} month${months > 1 ? 's' : ''}`);
  if (days > 0) result.push(`${days} day${days > 1 ? 's' : ''}`);
  
  return result.join(', ') || '0 days';
}
  return (
    <div className="flex-1 min-h-0 flex flex-col relative">
      {/* Main Participants Table */}
      <FilteredTable
        users={allParticipants}
        // Role tabs removed from the roster toolbar — the search box takes the
        // full row, and role narrowing lives in the Filters panel's Roles select.
        showRoleTabs={false}
        showBatchFilter={false}
        fillHeight={true}
        isLoading={isLoadingCourseData}
        selectedUserIds={selectedUsersToRemove}
        onUserSelect={(userId) => {
          setSelectedUsersToRemove(prev =>
            prev.includes(userId)
              ? prev.filter(id => id !== userId)
              : [...prev, userId]
          )
        }}
        onSelectAll={handleSelectAllUsersForRemoval}
        onBulkRemove={handleBulkRemove}
        onViewUser={handleViewUser}
        onSettingsUser={handleOpenSettings}
        // The Status column's inline switch. Rides the same mutation as the
        // settings dialog, so the batchId scoping and refetch come for free.
        onToggleStatus={(userId, status) =>
          updateEnrollmentMutation.mutate({ userId, enrollmentData: { status } })}
        isTogglingStatus={updateEnrollmentMutation.isPending}
        onRemoveUser={(userId) => {
          const user = allParticipants.find((u: { id: string; _id: string }) => u.id === userId || u._id === userId)
          if (user) {
            handleRemoveParticipant(userId, `${user.firstName} ${user.lastName}`)
          }
        }}
        isRemoving={removeParticipantMutation.isPending || removeParticipantsMutation.isPending}
        title={section ? `Participants — Section ${section}` : 'Participants'}
        emptyMessage={section ? `No participants in Section ${section}` : 'No participants found'}
        emptyDescription="Try adding participants using the 'Add Participants' button"
        showActions={true}
        showSelection={true}
        basedOn={basedOn}
        itemsPerPage={10}
        enrollments={transformedParticipants}
        showEnrolledOn={true}
      />

      {/* Add Individual Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={(o) => { if (!o) requestCloseAddModal() }}>
        <DialogContent
          showCloseButton={false}
          // Backdrop clicks are inert here: losing a 200-row selection to a
          // mis-click is the expensive mistake. gap-0 so the table — not dead
          // space between header/body/footer — gets the dialog's height.
          onInteractOutside={(e) => e.preventDefault()}
          className={`${poppins.className} flex flex-col gap-0 w-[calc(100vw-0.75rem)] max-w-none h-[calc(100dvh-0.75rem)] max-h-none m-0 overflow-hidden p-0 rounded-xl`}
        >
          {/* The table is the point of this dialog, so the chrome around it is
              kept to two compact rows — batch and pool sit side by side rather
              than stacking, which used to push the list down to ~3 visible rows. */}
          <DialogHeader className="shrink-0 px-3 sm:px-4 pt-2.5 pb-2 border-b border-hairline gap-0 text-left">
            {/* ── Row 1: what you're doing + who ── */}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <DialogTitle className="text-md font-semibold text-heading flex items-center gap-2">
                  <span className="h-6 w-6 rounded-lg bg-brand-100 flex items-center justify-center shrink-0">
                    <UserPlus className="h-3.5 w-3.5 text-brand-700" />
                  </span>
                  Enroll participants
                </DialogTitle>
                <DialogDescription className="text-xs text-subtle mt-1 truncate" title={[courseTitle, courseClientName, courseServiceModal].filter(Boolean).join(' · ')}>
                  <span className="font-semibold text-ink-700">{courseTitle || 'this course'}</span>
                  {/* Client and service model alongside the course name: the
                      same course name can exist under several clients/services,
                      so the name alone doesn't say which setup you're in. */}
                  {courseClientName && (
                    <>
                      <span className="text-faint"> · </span>
                      <span className="font-medium text-ink-700">{courseClientName}</span>
                    </>
                  )}
                  {courseServiceModal && (
                    <>
                      <span className="text-faint"> · </span>
                      <span className="font-medium text-ink-700">{courseServiceModal}</span>
                    </>
                  )}
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleOpenNewUserModal}
                  className="gap-1.5 h-8 px-3 text-xs border-hairline-strong text-ink-700 hover:border-line-hover"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  New User
                </Button>
                <button
                  type="button"
                  onClick={requestCloseAddModal}
                  title="Close"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-control border border-hairline text-subtle transition-colors hover:bg-row-hover hover:text-heading focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 cursor-pointer"
                >
                  <X className="h-4 w-4" strokeWidth={3} />
                  <span className="sr-only">Close</span>
                </button>
              </div>
            </div>

            {/* ── Row 2: target phase, target batch and user pool ── */}
            <div className="mt-2 flex items-center gap-x-3 gap-y-1.5 flex-wrap rounded-control bg-canvas px-2 py-1.5">
              {availablePhaseOptions.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-2xs font-semibold uppercase tracking-wide text-faint">
                    Phase
                  </span>
                  <select
                    value={activePhaseName}
                    onChange={(e) => setTargetPhase(e.target.value)}
                    disabled={isSavingEnrolment}
                    className="h-8 px-2.5 pr-7 rounded-control text-xs font-semibold border border-brand bg-surface text-brand cursor-pointer focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors"
                    aria-label="Enroll into phase"
                  >
                    {availablePhaseOptions.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
              )}

              {availablePhaseOptions.length > 0 && batchOptions.length > 0 && (
                <span className="h-5 w-px bg-hairline hidden sm:block" aria-hidden />
              )}

              {batchOptions.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-2xs font-semibold uppercase tracking-wide ${isBatchBased ? 'text-faint' : 'text-faint/60'}`}>
                    Batch
                  </span>
                  {/* Dropdown, not pills: only valid batches for this course
                      are offered, and the placeholder forces an explicit
                      choice when nothing is preselected (footer blocks
                      enrolment until then). A course that isn't batch-based
                      has nothing to choose between — the picker is shown
                      disabled on its single container rather than hidden, so
                      it's clear WHY there's no choice to make. */}
                  <select
                    value={isBatchBased ? activeBatchName : defaultBatchName}
                    onChange={(e) => setTargetBatchName(e.target.value)}
                    disabled={!isBatchBased || isSavingEnrolment}
                    aria-label="Enroll into batch"
                    title={isBatchBased ? undefined : 'This course is not batch-based'}
                    className={`h-8 px-2.5 pr-7 rounded-control text-xs font-semibold border bg-surface focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors ${
                      !isBatchBased
                        ? 'border-hairline-strong text-faint bg-canvas cursor-not-allowed opacity-70'
                        : activeBatchName
                          ? 'border-brand text-brand cursor-pointer'
                          : 'border-warn-500/50 text-warn-700 cursor-pointer'
                    }`}
                  >
                    <option value="" disabled>Select batch…</option>
                    {batchOptions.map((bn) => (
                      <option key={bn} value={bn}>{bn}</option>
                    ))}
                  </select>
                  {!isBatchBased && (
                    <span className="text-2xs text-faint">Not batch-based</span>
                  )}
                </div>
              )}

              {batchOptions.length > 0 && (
                <span className="h-5 w-px bg-hairline hidden sm:block" aria-hidden />
              )}

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-2xs font-semibold uppercase tracking-wide text-faint">User</span>
                {/* Two scopes only — "This course" was dropped per the
                    enrolment brief (course-level narrowing isn't needed in
                    this picker; role/status/search filters do that job). */}
                <div className="inline-flex items-center rounded-control border border-hairline-strong bg-canvas p-0.5">
                  {([
                    { key: 'all', label: 'Everyone', on: allSystemUsers },
                    { key: 'client', label: 'This client', on: !allSystemUsers },
                  ] as const).map(({ key, label, on }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setAllSystemUsers(key === 'all')
                        setAllClientStudents(key === 'client')
                      }}
                      className={`px-3 h-6 rounded-[7px] text-xs font-semibold transition-colors ${
                        on ? 'bg-surface text-brand shadow-xs' : 'text-subtle hover:text-ink-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            {showCopyPhase && (
              <div className="flex items-center gap-2 sm:ml-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyPhase}
                  disabled={isSavingEnrolment || !hasCourseRoster || batchOptions.length === 0}
                  title={`Preselect saved ${copySourcePhase} users in all matching ${activePhaseName} batches. Existing selections are kept; review the checkboxes before saving.`}
                  className="h-8 gap-1.5 px-3 text-xs border-brand text-brand hover:bg-brand-50"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Same as {copySourcePhase}
                </Button>
                {phaseCopyNotice?.phase === activePhaseName && (
                  <span role="status" title={phaseCopyNotice.message} className="text-2xs text-subtle">
                    <span aria-hidden="true">{phaseCopyNotice.summary}</span>
                    <span className="sr-only">{phaseCopyNotice.message}</span>
                  </span>
                )}
              </div>
            )}
            </div>
          </DialogHeader>

          {/* ── Unsaved work, batch by batch ──
              The dropdown only ever shows ONE batch's ticks, so without this
              the picks made under Batch I disappear from view the moment you
              switch to Batch II and there is nothing to say they are still
              coming. Each chip names its batch and who is going into it, and
              clicking one switches the table back to that batch. */}
          {pendingByBatch.length > 0 && (
            <div className="shrink-0 px-3 sm:px-4 pt-1.5">
              <div className="flex items-center gap-2">
                <span className="text-2xs font-semibold uppercase tracking-wide text-faint shrink-0">
                  Unsaved
                </span>
                <div className="flex flex-nowrap gap-1.5 min-w-0 overflow-x-auto py-0.5">
                  {pendingByBatch.map((c) => {
                    const isActive = c.key === activeBatchKey
                    const addNames = c.add.map(nameOfId)
                    const removeNames = c.remove.map(nameOfId)
                    return (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => {
                          setTargetPhase(c.phase)
                          setTargetBatchName(c.batchName)
                        }}
                        title={[
                          addNames.length ? `Enrolling: ${addNames.join(', ')}` : '',
                          removeNames.length ? `Removing: ${removeNames.join(', ')}` : '',
                        ].filter(Boolean).join('  ·  ')}
                        aria-pressed={isActive}
                        className={`inline-flex shrink-0 items-center gap-1.5 h-7 px-2.5 rounded-control border text-xs transition-colors ${
                          isActive
                            ? 'border-brand bg-brand-50 text-brand'
                            : 'border-hairline-strong bg-surface text-ink-700 hover:border-line-hover'
                        }`}
                      >
                        <span className="font-semibold shrink-0">
                          {[c.phase, c.batchName || 'This course'].filter(Boolean).join(' · ')}
                        </span>
                        {c.add.length > 0 && (
                          <span className="font-semibold text-success-700 shrink-0">+{c.add.length}</span>
                        )}
                        {c.remove.length > 0 && (
                          <span className="font-semibold text-danger-700 shrink-0">−{c.remove.length}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-hidden px-3 sm:px-4 pt-2 pb-1 flex flex-col">
            <FilteredTable
              key={activeBatchKey}
              users={availableUsersToAdd}
              isLoading={isLoadingAllUsers || isLoadingCourseData}
              selectedUserIds={checkedUserIds}
              disabledUserIds={disabledForActiveBatch}
              onUserSelect={handleUserSelectionToggle}
              onSelectAll={handleSelectAllUsers}
              title="Users"
              emptyMessage="No users available to add"
              emptyDescription="All users are already enrolled in this course"
              showActions={false}
              showSelection={true}
              compactSelection={true}
              basedOn={basedOn}
              // The list now gets nearly the whole dialog, so a page of 10 left
              // empty space below the last row; 25 fills it and halves the paging.
              itemsPerPage={25}
              showRoleTabs={true}
              fillHeight={true}
            />
          </div>

          <DialogFooter className="shrink-0 border-t border-hairline px-3 sm:px-4 py-2 bg-surface">
            <div className="flex flex-wrap items-center justify-between w-full gap-x-4 gap-y-2">
              {/* Running selection — a live count so you always know how many
                  you're about to enrol before you commit. */}
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                {isBatchBased && !activeBatchName ? (
                  <span className="text-xs font-semibold text-warn-700">Pick a batch to enrol into first</span>
                ) : (toAdd.length > 0 || toRemove.length > 0) ? (
                  // Both directions, separately: "3 selected" would hide that
                  // two of them are being taken OUT of the batch.
                  <span className="inline-flex items-center gap-1.5">
                    {toAdd.length > 0 && (
                      <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-success-50 text-success-700 text-xs font-semibold">
                        +{toAdd.length} to enrol
                      </span>
                    )}
                    {toRemove.length > 0 && (
                      <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-danger-50 text-danger-700 text-xs font-semibold">
                        −{toRemove.length} to remove
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-xs text-faint">
                    Tick to add, untick to remove
                  </span>
                )}
                {matchingStudents.length > 0 && (
                  <button
                    type="button"
                    className="text-xs font-semibold text-brand hover:text-brand-700 transition-colors"
                    onClick={handleAddAllMatching}
                    disabled={isSavingEnrolment || !hasCourseRoster}
                    title="Select every matching student in one click"
                  >
                    + Add all {matchingStudents.length} matching
                  </button>
                )}
              </div>
              <div className="flex gap-2 shrink-0 ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-4 text-xs border-hairline-strong text-ink-700 hover:border-line-hover"
                  onClick={requestCloseAddModal}
                >
                  Cancel
                </Button>
                <button
                  type="button"
                  onClick={handleSubmitParticipants}
                  disabled={!hasPendingChanges || isSavingEnrolment || (isBatchBased && pendingByBatch.some((c) => !c.batchName))}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-tile bg-gradient-to-b from-brand-400 to-brand-600 text-white text-xs font-semibold shadow-brand hover:brightness-105 transition-[filter] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  {isSavingEnrolment ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-3.5 w-3.5" />
                      {/* One save commits every batch's draft, so it says how
                          many batches it is about to write — "Save changes to
                          Batch I" while you have picks waiting in Batch II
                          would be a lie about what the click does. */}
                      {pendingByBatch.length > 1
                        ? `Save changes (${pendingByBatch.length} batches)`
                        : 'Save changes'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discard confirmation for the enrol picker — only when users are ticked */}
      <Dialog open={confirmDiscardEnrol} onOpenChange={setConfirmDiscardEnrol}>
        <DialogContent showCloseButton={false} className={`${poppins.className} sm:max-w-[420px]`}>
          <DialogHeader>
            <DialogTitle>Discard your selection?</DialogTitle>
            <DialogDescription>
              {pendingByBatch.reduce((n, c) => n + c.add.length + c.remove.length, 0)} unsaved change
              {pendingByBatch.reduce((n, c) => n + c.add.length + c.remove.length, 0) === 1 ? '' : 's'}
              {pendingByBatch.length > 1 ? ` across ${pendingByBatch.length} cohorts` : ''}.
              Closing now clears them.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDiscardEnrol(false)}>
              Keep selecting
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleCloseAddModal}
            >
              Discard &amp; close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single Remove Confirmation Dialog */}
      <Dialog open={showSingleRemoveConfirm} onOpenChange={setShowSingleRemoveConfirm}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-danger-700">
              <Trash2 className="h-5 w-5" />
              Remove Participant
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to remove <span className="font-semibold">{userToRemoveName}</span> from this course? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowSingleRemoveConfirm(false)
                setUserToRemove(null)
                setUserToRemoveName('')
              }}
              disabled={removeParticipantMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmSingleRemove}
              disabled={removeParticipantMutation.isPending}
            >
              {removeParticipantMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Removing...
                </>
                  ) : (
                'Remove Participant'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Remove Confirmation Dialog */}
      <Dialog open={showBulkRemoveConfirm} onOpenChange={setShowBulkRemoveConfirm}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-danger-700">
              <Trash2 className="h-5 w-5" />
              Remove {selectedUsersToRemove.length} Participant(s)
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {selectedUsersToRemove.length} participant(s) from this course? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowBulkRemoveConfirm(false)}
              disabled={removeParticipantsMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmBulkRemove}
              disabled={removeParticipantsMutation.isPending}
            >
              {removeParticipantsMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Removing...
                </>
              ) : (
                `Remove ${selectedUsersToRemove.length} Participant(s)`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Details Modal */}
      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden">
          {selectedUser && (
            <>
              <DialogHeader>
                <DialogTitle>User Details</DialogTitle>
                <DialogDescription>
                  Complete information about {selectedUser.firstName} {selectedUser.lastName}
                </DialogDescription>
              </DialogHeader>
              
              <ScrollArea className="max-h-[70vh] pr-4">
                <div className="space-y-6">
                  {/* Profile Header */}
                  <div className="flex items-start gap-4">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={selectedUser.profile} alt={`${selectedUser.firstName} ${selectedUser.lastName}`} />
                      <AvatarFallback className="text-lg">
                        {getInitials(selectedUser.firstName, selectedUser.lastName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-xl font-semibold">
                            {selectedUser.firstName} {selectedUser.lastName}
                          </h3>
                          <p className="text-subtle">{selectedUser.role || 'Student'}</p>
                        </div>
                        <Badge 
                          variant={selectedUser.status === 'active' ? 'default' : 'secondary'}
                          className={
                            selectedUser.status === 'active'
                              ? 'bg-success-50 text-success-700 ring-1 ring-inset ring-success-500/20'
                              : 'bg-ink-100 text-ink-700 ring-1 ring-inset ring-ink-500/20'
                          }
                        >
                          {selectedUser.status.charAt(0).toUpperCase() + selectedUser.status.slice(1)}
                        </Badge>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-4 w-4 text-faint" />
                          <a href={`mailto:${selectedUser.email}`} className="text-info-700 hover:underline">
                            {selectedUser.email}
                          </a>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-4 w-4 text-faint" />
                          <span>{selectedUser.phone || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Enrollment Information */}
                  {(() => {
                    const enrollment = transformedParticipants.find((e: { user: { _id: string | undefined; id: string } }) => 
                      e.user._id === selectedUser._id || e.user.id === selectedUser.id
                    );
                    
                    if (enrollment) {
                      return (
                        <>
                          <div>
                            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              Enrollment Information
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div>
                                <Label className="text-xs text-subtle">Status</Label>
                                <div className="mt-1">
                                  {getStatusBadge(enrollment.status)}
                                </div>
                              </div>
                              <div>
                               
                              </div>
                              {renderEnrollmentDates(enrollment)}
                            </div>
                          </div>
                          <Separator />
                        </>
                      );
                    }
                    return null;
                  })()}

                  {/* Personal Information */}
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <UserIcon className="h-4 w-4" />
                      Personal Information
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-xs text-subtle">User ID</Label>
                        <p className="text-sm font-mono">{selectedUser.userId || 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-subtle">Gender</Label>
                        <p className="text-sm">{selectedUser.gender || 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-subtle">Member Since</Label>
                        <p className="text-sm">{formatDate(selectedUser.createdAt || '')}</p>
                      </div>
                    </div>
                  </div>

                  {/* Academic Information (for college) */}
                  {basedOn === 'college' && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <GraduationCap className="h-4 w-4" />
                          Academic Information
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          <div>
                            <Label className="text-xs text-subtle">Degree</Label>
                            <p className="text-sm">{selectedUser.degree || 'N/A'}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-subtle">Department</Label>
                            <p className="text-sm">{selectedUser.department || 'N/A'}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-subtle">Year</Label>
                            <p className="text-sm">{selectedUser.year || 'N/A'}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-subtle">Semester</Label>
                            <p className="text-sm">{selectedUser.semester || 'N/A'}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-subtle">Batch</Label>
                            <p className="text-sm">{selectedUser.batch || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Enrollment Settings Modal */}
    <Dialog open={isSettingsModalOpen} onOpenChange={handleCloseSettingsModal}>
  <DialogContent className="sm:max-w-md">
    <DialogHeader className="pb-2">
      <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
        <Settings className="h-4 w-4" />
        Enrollment Settings
      </DialogTitle>
      <DialogDescription className="text-xs">
        Update details for {selectedEnrollment?.user.firstName} {selectedEnrollment?.user.lastName}
      </DialogDescription>
    </DialogHeader>
    
    {selectedEnrollment && (
      <div className="space-y-4 py-2">
        {/* Dates Toggle - Compact */}
        <div className="flex items-center justify-between p-3 bg-surface-sunken rounded-tile border border-hairline">
          <div className="space-y-0.5">
            <Label htmlFor="enable-dates" className="text-xs font-medium">Custom Dates</Label>
            <p className="text-[10px] text-subtle leading-tight">
              {enableEnrolmentDates ? 'Dates will be saved' : 'Dates remain null'}
            </p>
          </div>
          <Switch
            id="enable-dates"
            checked={enableEnrolmentDates}
            onCheckedChange={(checked) => {
              setEnableEnrolmentDates(checked);
              if (checked) {
                const today = formatDateForInput(new Date().toISOString());
                setEnrolmentStartsDate(today);
                const endDate = new Date(today);
                endDate.setFullYear(endDate.getFullYear() + 1);
                setEnrolmentEndsDate(formatDateForInput(endDate.toISOString()));
              } else {
                setEnrolmentStartsDate('');
                setEnrolmentEndsDate('');
              }
            }}
            className="scale-90"
          />
        </div>

        {/* Status and Dates Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="enrollment-status" className="text-xs">Status</Label>
            <Select
              value={enrollmentStatus}
              onValueChange={(value: 'active' | 'suspended' | 'completed' | 'dropped') => 
                setEnrollmentStatus(value)
              }
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent className="text-sm">
                <SelectItem value="active" className="text-sm">Active</SelectItem>
                <SelectItem value="suspended" className="text-sm">Suspended</SelectItem>
                <SelectItem value="completed" className="text-sm">Completed</SelectItem>
                <SelectItem value="dropped" className="text-sm">Dropped</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="duration" className="text-xs">Duration</Label>
            <div className="flex items-center h-8 px-3 text-sm bg-surface-sunken rounded-control border border-hairline">
              <ClockIcon className="h-3 w-3 mr-1.5 text-subtle" />
              {enrolmentStartsDate && enrolmentEndsDate 
                ? calculateDuration(enrolmentStartsDate, enrolmentEndsDate)
                : 'N/A'}
            </div>
          </div>
        </div>

        {/* Dates Row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="enrolment-starts" className="text-xs">Start Date</Label>
            <Input
              id="enrolment-starts"
              type="date"
              value={enrolmentStartsDate}
              onChange={(e) => {
                setEnrolmentStartsDate(e.target.value);
                if (e.target.value) {
                  const endDate = new Date(e.target.value);
                  endDate.setFullYear(endDate.getFullYear() + 1);
                  setEnrolmentEndsDate(formatDateForInput(endDate.toISOString()));
                }
              }}
              disabled={!enableEnrolmentDates}
              className={`h-8 text-sm ${!enableEnrolmentDates ? 'bg-ink-100 text-faint' : ''}`}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="enrolment-ends" className="text-xs">End Date</Label>
            <Input
              id="enrolment-ends"
              type="date"
              value={enrolmentEndsDate}
              onChange={(e) => setEnrolmentEndsDate(e.target.value)}
              disabled={!enableEnrolmentDates}
              className={`h-8 text-sm ${!enableEnrolmentDates ? 'bg-ink-100 text-faint' : ''}`}
            />
          </div>
        </div>

        {/* Current Status Display - Compact */}
        <div className="p-3 bg-surface-sunken rounded-control border border-hairline">
          <Label className="text-xs text-gray-500 mb-1.5 block">Current Status</Label>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">Enrollment:</span>
              {getStatusBadge(selectedEnrollment.status)}
            </div>
          
          </div>
        </div>
      </div>
    )}

    <DialogFooter className="pt-4 border-t">
      <div className="flex gap-2 w-full">
        <Button
          variant="outline"
          onClick={handleCloseSettingsModal}
          disabled={updateEnrollmentMutation.isPending}
          className="h-8 px-3 text-sm flex-1"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSaveEnrollmentSettings}
          disabled={updateEnrollmentMutation.isPending}
          className="h-8 px-3 text-sm flex-1 bg-gradient-to-b from-brand-400 to-brand-600 text-white hover:brightness-105"
        >
          {updateEnrollmentMutation.isPending ? (
            <>
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1.5"></div>
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>
    </DialogFooter>
  </DialogContent>
</Dialog>

      {/* New User Modal (reuses user-management UserModals) */}
      <UserModals
        // null → institution-scoped permission filtering stays off; safe here
        // because the permission modals never open from this screen.
        institutionId={null}
        showAddUserModal={showAddUserModal}
        setShowAddUserModal={setShowAddUserModal}
        showSuccessModal={showSuccessModal}
        setShowSuccessModal={setShowSuccessModal}
        showDeleteModal={false}
        setShowDeleteModal={() => {}}
        showPermissionModal={false}
        setShowPermissionModal={() => {}}
        showBulkUploadModal={false}
        setShowBulkUploadModal={() => {}}
        showBulkPermissionModal={false}
        setShowBulkPermissionModal={() => {}}
        showViewDetailsModal={false}
        setShowViewDetailsModal={() => {}}
        newUser={newUser}
        setNewUser={setNewUser}
        newUserId={newUserId}
        userToDelete={null}
        selectedUserForPermission={null}
        setSelectedUserForPermission={() => {}}
        selectedUserForDetails={null}
        setSelectedUserForDetails={() => {}}
        selectedUserForBulkPermissions={null}
        setSelectedUserForBulkPermissions={() => {}}
        roles={umRoles}
        isLoadingRoles={isLoadingRoles}
        basedOn={basedOn}
        userPermissions={umPermissions}
        allUsers={[] as UmUser[]}
        onAddUserSubmit={handleAddUserSubmit}
        onConfirmDelete={() => {}}
        onConfigurePermissions={() => setShowSuccessModal(false)}
        isDeleting={false}
        isEditing={false}
        canBulkUpload={false}
        canBulkPermission={false}
      />

      {/* Toaster Component */}
      <Toaster
        position="top-right"
        richColors
        closeButton
        expand={false}
        duration={3000}
        visibleToasts={3}
      />
    </div>
  )
}
