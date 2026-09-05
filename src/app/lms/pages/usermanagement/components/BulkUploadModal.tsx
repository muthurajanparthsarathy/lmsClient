"use client"
import { getToken } from "@/lib/session";
import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Upload, X, CheckCircle, XCircle, Download, Loader2, AlertTriangle,
  FileSpreadsheet, ChevronDown, ShieldCheck, Building2, Briefcase,
} from "lucide-react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "react-toastify"
import { bulkUploadUsers } from "@/app/lms/pages/usermanagement/api/userService"
import { courseStructuresSummaryQuery } from "@/app/lms/pages/coursestructure/api/createCourseStucture"
import { type ServiceMapping } from "@/app/lms/pages/servicemapping/api/serviceMappingService"
import { useClientsQuery, useServiceMappingsQuery } from "@/queries/referenceData"

interface UploadResults {
  summary?: {
    totalProcessed: number
    successfullyCreated: number
    emailsSent: number
    emailsFailed: number
    existingUsers: number
    validationErrors: number
  }
  users?: Array<{
    _id: string
    email: string
    firstName: string
    lastName: string
    role: string
    studentType?: string
    clientName?: string
    degree?: string
    department?: string
    year?: string
    semester?: string
  }>
  creditExceeded?: boolean
  message?: Array<{ key: string; value: string }>
}

interface BulkRole {
  _id: string
  renameRole?: string
  originalRole?: string
}

interface BulkClient {
  _id: string
  clientCompany: string
}

interface BulkUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (data: UploadResults) => void
  /**
   * Roles for the "Role assignment" pick. The spreadsheet used to carry a role
   * NAME per row, which the server turned into a role by fuzzy-matching text —
   * a typo quietly minted a brand-new role. Choosing the role here sends a real
   * id instead, and it is what the server derives permissions from.
   */
  roles?: BulkRole[]
  isLoadingRoles?: boolean
}

type UploadStatus = 'idle' | 'uploading' | 'processing' | 'completed' | 'error'
type UploadStage = 'upload' | 'processing'

interface UploadProgress {
  percentage: number
  status: UploadStatus
  stage: UploadStage
  message: string
}

interface CourseStructure {
  _id: string
  name: string
  courseName: string
  courseCode?: string
  [key: string]: any
}

/**
 * The same picker the Bulk add users modal uses, so the two bulk flows read as
 * one screen: a labelled button that opens a token-styled panel, rather than a
 * native <select> whose list is drawn by the OS and ignores the app's theme.
 *
 * Declared at module scope — nesting it in the component would remount the
 * whole control on every keystroke elsewhere in the modal.
 */
const Dropdown = ({
  label, icon, value, placeholder, open, setOpen, disabled, required, hint, children,
}: {
  label: string
  icon: React.ReactNode
  value?: string
  placeholder: string
  open: boolean
  setOpen: (fn: (o: boolean) => boolean) => void
  disabled?: boolean
  required?: boolean
  hint?: string
  children: React.ReactNode
}) => (
  <div>
    <Label className="mb-1.5 block text-sm font-medium text-body">
      {label}{required && <span className="text-danger-500"> *</span>}
    </Label>
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o: boolean) => !o)}
        className="h-10 w-full flex items-center justify-between gap-2 rounded-control border border-hairline-strong bg-surface px-3 text-sm transition-colors hover:border-line-hover focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-subtle"
      >
        <span className="flex items-center gap-2 min-w-0">
          {icon}
          <span className={`truncate ${value ? "text-body" : "text-faint"}`}>{value || placeholder}</span>
        </span>
        <ChevronDown size={15} className={`text-faint transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-dropdown mt-1.5 w-full max-h-52 overflow-y-auto rounded-tile border border-hairline bg-surface shadow-lg p-1">
          {children}
        </div>
      )}
    </div>
    {hint && <p className="mt-1 text-2xs text-subtle">{hint}</p>}
  </div>
)

const optionClass = (selected: boolean) =>
  `w-full text-left rounded-chip px-2.5 py-2 text-sm transition-colors duration-150 ${
    selected ? "bg-brand-wash text-heading" : "text-body hover:bg-row-hover"
  }`

// ─── The template contract ───────────────────────────────────────────────────
//
// Role, client and service model are NOT columns. All three are chosen in the
// pickers at the top of this modal and applied to every row, so repeating them
// per row only invited a typo to contradict the picks. The server still READS
// those columns when an older file carries them (a row value wins over the
// picker) — dropping them here changed the template, not the parser.
const TEMPLATE_COLUMNS = [
  'email', 'firstName', 'lastName', 'phone', 'gender', 'password', 'rollNumber',
]

// The server destructures these keys VERBATIM off each parsed row
// (`bulkUploadUsers` in server/controllers/userAuth.js) and the User schema
// marks phone and password required. A file that misspells one does not fail
// loudly — every row simply arrives with the field undefined and is rejected
// one at a time, which is why the check below happens before the upload.
const REQUIRED_COLUMNS = new Set(['email', 'firstName', 'lastName', 'phone', 'password'])

// Columns the previous template carried. Still honoured by the server, so they
// are reported as an override rather than as ignored noise.
const LEGACY_COLUMNS = new Set(['role', 'clientname', 'servicemodel'])

type ColumnStatus = 'matched' | 'mismatch' | 'missing' | 'optional-missing' | 'extra' | 'legacy'

interface ColumnCheck {
  expected?: string
  found?: string
  status: ColumnStatus
}

interface FileInspection {
  /** false when the format cannot be read in the browser (legacy .xls). */
  parsed: boolean
  note?: string
  columns: ColumnCheck[]
  /** Blocking — the upload would produce a row error for every row. */
  problems: string[]
  /** Non-blocking — worth showing, but the file will still import. */
  warnings: string[]
  sample: string[][]
  headers: string[]
  totalRows: number
}

const normHeader = (s: string) => String(s ?? '').trim().toLowerCase()

/** Split one CSV line, honouring "quoted, fields" and "" escapes. */
const splitCsvLine = (line: string): string[] => {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ } else quoted = false
      } else cur += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out.map(v => v.trim())
}

/** ExcelJS cell values are unions (rich text, formula, hyperlink, date…). */
const cellText = (v: any): string => {
  if (v == null) return ''
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((r: any) => r.text).join('')
    if ('text' in v) return String(v.text ?? '')
    if ('result' in v) return String(v.result ?? '')
    if (v instanceof Date) return v.toISOString()
    return ''
  }
  return String(v)
}

const SAMPLE_ROWS = 5

/**
 * Read the header row and the first few data rows in the BROWSER, so a wrong
 * column name is caught before the file is sent rather than coming back as N
 * identical row errors.
 *
 * Returns null for a format that cannot be read here — legacy binary .xls has
 * no parser on this side, and guessing would be worse than saying so.
 */
async function readSheet(
  f: File,
): Promise<{ headers: string[]; rows: string[][]; totalRows: number } | null> {
  const name = f.name.toLowerCase()

  if (name.endsWith('.csv')) {
    const lines = (await f.text()).split(/\r?\n/).filter(l => l.trim() !== '')
    if (!lines.length) return { headers: [], rows: [], totalRows: 0 }
    const all = lines.map(splitCsvLine)
    const body = all.slice(1).filter(r => r.some(c => c !== ''))
    return { headers: all[0], rows: body.slice(0, SAMPLE_ROWS), totalRows: body.length }
  }

  if (name.endsWith('.xlsx')) {
    // Dynamic — exceljs is large and only needed once a file is actually picked.
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(await f.arrayBuffer())
    const ws = wb.worksheets[0]
    if (!ws) return { headers: [], rows: [], totalRows: 0 }

    // `.values` is 1-indexed with a leading hole, hence the slice.
    const rowValues = (n: number): string[] =>
      (ws.getRow(n).values as any[] ?? []).slice(1).map(cellText).map(s => s.trim())

    const headers = rowValues(1)
    const rows: string[][] = []
    let totalRows = 0
    for (let n = 2; n <= ws.rowCount; n++) {
      const r = rowValues(n)
      if (!r.some(c => c !== '')) continue
      totalRows++
      if (rows.length < SAMPLE_ROWS) rows.push(r)
    }
    return { headers, rows, totalRows }
  }

  return null
}

/** Compare a file's headers against the template contract. */
function inspectHeaders(headers: string[], sample: string[][], totalRows: number): FileInspection {
  const columns: ColumnCheck[] = []
  const problems: string[] = []
  const warnings: string[] = []
  const found = headers.map(h => ({ raw: String(h ?? '').trim(), key: normHeader(h) }))
  const claimed = new Set<string>()

  for (const expected of TEMPLATE_COLUMNS) {
    const hit = found.find(f => f.key === normHeader(expected) && !claimed.has(f.raw))
    if (!hit) {
      if (REQUIRED_COLUMNS.has(expected)) {
        columns.push({ expected, status: 'missing' })
        problems.push(`Missing required column "${expected}"`)
      } else {
        columns.push({ expected, status: 'optional-missing' })
      }
      continue
    }
    claimed.add(hit.raw)
    // Case and spacing matter: the server reads `row.email`, not `row.Email`.
    if (hit.raw === expected) {
      columns.push({ expected, found: hit.raw, status: 'matched' })
    } else {
      columns.push({ expected, found: hit.raw, status: 'mismatch' })
      problems.push(`Column "${hit.raw}" must be spelled exactly "${expected}"`)
    }
  }

  for (const f of found) {
    if (!f.raw || claimed.has(f.raw)) continue
    if (LEGACY_COLUMNS.has(f.key)) {
      columns.push({ found: f.raw, status: 'legacy' })
      warnings.push(`"${f.raw}" is an old template column — a value in it overrides the picks above for that row`)
    } else {
      columns.push({ found: f.raw, status: 'extra' })
      warnings.push(`"${f.raw}" is not a template column and will be ignored`)
    }
  }

  if (!headers.length) problems.push('The first row must be the column names')
  else if (!totalRows) problems.push('The file has no data rows')

  return { parsed: true, columns, problems, warnings, sample, headers, totalRows }
}

const BulkUploadModal: React.FC<BulkUploadModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  roles = [],
  isLoadingRoles = false,
}) => {
  const [file, setFile] = useState<File | null>(null)
  // Placement context applied to every row in the file — the same three picks
  // the single "New user" form makes, so bulk accounts are created with the same
  // ObjectId refs (role / clientId / serviceMappingId) rather than loose text.
  const [roleId, setRoleId] = useState<string>('')
  const [clientId, setClientId] = useState<string>('')
  const [mappingId, setMappingId] = useState<string>('')
  const [clients, setClients] = useState<BulkClient[]>([])
  const [mappings, setMappings] = useState<ServiceMapping[]>([])
  const [isLoadingContext, setIsLoadingContext] = useState(false)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  // What the picked file's header row actually says, checked against
  // TEMPLATE_COLUMNS the moment it is chosen. Null until a file is read.
  const [inspection, setInspection] = useState<FileInspection | null>(null)
  const [isInspecting, setIsInspecting] = useState(false)
  // "Upload & create" shows this confirmation of what was read before anything
  // is sent; the button on it performs the real upload.
  const [showPreview, setShowPreview] = useState(false)
  const [uploadResults, setUploadResults] = useState<UploadResults | null>(null)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    percentage: 0,
    status: 'idle',
    stage: 'upload',
    message: ''
  })
  // Which picker panel is open. Only one at a time, like the Bulk add users modal.
  const [roleOpen, setRoleOpen] = useState(false)
  const [clientOpen, setClientOpen] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)
  // A file that was turned away (wrong type, too big, unreadable, or wrong
  // columns). It is NOT held as the picked file — the dropzone stays empty and
  // ready for the corrected file — but its name and the reasons are kept so the
  // error says WHICH file failed and why.
  const [rejectedFile, setRejectedFile] = useState<{ name: string; reasons: string[] } | null>(null)
  const [confirmDiscardBulk, setConfirmDiscardBulk] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch course structures
  // Uses the shared summary cache entry — this modal reads only listing
  // scalars off the course rows. The old private 30s poll was pure waste for
  // a modal that is closed almost all the time.
  const {
    data: courseStructures = [],
    isLoading: coursesLoading,
    error: coursesError
  } = useQuery({
    ...courseStructuresSummaryQuery(),
    enabled: isOpen,
  })

  useEffect(() => {
    if (coursesError) {
      toast.error("Failed to load courses")
    }
  }, [coursesError])

  // Shared cache entries — same freshness contract (staleTime 0, revalidate
  // on open) as the Add User modal, deduped across all three consumers.
  const { data: clientsData, isLoading: isLoadingClients } = useClientsQuery(isOpen)
  const { data: mappingsData, isLoading: isLoadingMappings } = useServiceMappingsQuery(isOpen)
  useEffect(() => { setClients((clientsData as BulkClient[]) || []) }, [clientsData])
  useEffect(() => { setMappings((mappingsData as ServiceMapping[]) || []) }, [mappingsData])
  useEffect(() => { setIsLoadingContext(isLoadingClients || isLoadingMappings) }, [isLoadingClients, isLoadingMappings])

  // Mirrors UserModals: a client may run several services under one model name,
  // so options are per MAPPING and tracked by mapping id, never by model name.
  const clientIdOf = (m: ServiceMapping) =>
    typeof m.client === 'string' ? m.client : m.client?._id
  const modelNameOf = (m: ServiceMapping): string =>
    (m.serviceModels?.length ? m.serviceModels[0] : m.service) || 'Service'
  const degreeOf = (m: ServiceMapping): string =>
    (m.masterData || []).find(e => e.level === 'Degree')?.values?.[0] || ''
  const serviceLabelOf = (m: ServiceMapping): string =>
    `${modelNameOf(m)}${degreeOf(m) ? ` · ${degreeOf(m)}` : ''} (${m.serviceCode || '—'})`

  const clientMappings = clientId ? mappings.filter(m => clientIdOf(m) === clientId) : []
  const selectedMapping = clientMappings.find(m => m._id === mappingId) || null
  const selectedClient = clients.find(c => c._id === clientId) || null
  const selectedRole = roles.find(r => r._id === roleId) || null

  // Client + service model place a learner inside a client's programme, which
  // only means anything for students. Staff roles are institution-level, so
  // those two pickers stay hidden until a student role is picked.
  const isStudentRole = /student/i.test(
    selectedRole?.renameRole || selectedRole?.originalRole || ''
  )

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const droppedFiles = e.dataTransfer.files
    if (droppedFiles.length > 0) {
      handleFileSelect(droppedFiles[0])
    }
  }, [])

  // One place to turn a file away: the dropzone goes back to empty, the input
  // is cleared so re-picking the same file still fires onChange, and the toast
  // names the file rather than just saying "wrong file".
  const rejectFile = (name: string, reasons: string[]): void => {
    setFile(null)
    setInspection(null)
    setRejectedFile({ name, reasons })
    if (fileInputRef.current) fileInputRef.current.value = ''
    toast.error(`${name} — ${reasons[0]}${reasons.length > 1 ? ` (+${reasons.length - 1} more)` : ''}`)
  }

  const handleFileSelect = (selectedFile: File): void => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ]

    // Browsers report a blank or odd MIME type for spreadsheets often enough
    // (CSVs saved by Excel especially) that the extension is the tiebreaker.
    const extOk = /\.(xlsx|xls|csv)$/i.test(selectedFile.name)
    if (!validTypes.includes(selectedFile.type) && !extOk) {
      rejectFile(selectedFile.name, ['Not an Excel or CSV file (.xlsx, .xls or .csv only)'])
      return
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      rejectFile(selectedFile.name, [`File is ${formatFileSize(selectedFile.size)} — the limit is 5MB`])
      return
    }

    setRejectedFile(null)
    setFile(selectedFile)
    setUploadResults(null)
    setShowPreview(false)
    setUploadProgress({
      percentage: 0,
      status: 'idle',
      stage: 'upload',
      message: ''
    })
    void inspectFile(selectedFile)
  }

  // Read the header row now, not at upload time. The server matches column
  // names verbatim, so a "Email" or a missing "password" turns into one row
  // error per row — which is a slow, confusing way to learn the header is wrong.
  const inspectFile = async (selectedFile: File): Promise<void> => {
    setIsInspecting(true)
    setInspection(null)
    try {
      const sheet = await readSheet(selectedFile)
      if (!sheet) {
        // Legacy binary .xls — no parser on this side. Say so instead of
        // implying the file was checked.
        setInspection({
          parsed: false,
          note: 'This .xls file cannot be checked in the browser. Save it as .xlsx or .csv to see the column check before uploading.',
          columns: [], problems: [], warnings: [], sample: [], headers: [], totalRows: 0,
        })
        return
      }
      const result = inspectHeaders(sheet.headers, sheet.rows, sheet.totalRows)
      // A file whose columns don't match the template can't be uploaded, so it
      // is turned away rather than left sitting in the dropzone looking picked.
      // The reasons are listed under the dropzone with the file's name.
      if (result.problems.length) {
        rejectFile(selectedFile.name, result.problems)
        return
      }
      setInspection(result)
    } catch (err: any) {
      rejectFile(selectedFile.name, ['Could not be read — is it a valid .xlsx or .csv?'])
    } finally {
      setIsInspecting(false)
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files[0])
    }
  }

  const handleRemoveFile = (): void => {
    setFile(null)
    setInspection(null)
    setRejectedFile(null)
    setShowPreview(false)
    setUploadProgress({
      percentage: 0,
      status: 'idle',
      stage: 'upload',
      message: ''
    })
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const downloadTemplate = (): void => {
    // The per-row fields the New user form collects. Role, client and service
    // model come from the pickers above and are sent once for the whole file,
    // so they are not columns here.
    //
    // The degree-hierarchy columns (degree, department, year, semester, section,
    // batch, studentType) are intentionally NOT here — a placement student's
    // record does not carry them. The server still reads them when a file
    // includes them, for clients that run degree programs.
    //
    // Two rows so both shapes are visible: one with a roll number, one without.
    const templateData = [
      TEMPLATE_COLUMNS,
      ['sam.k@example.com', 'sam', 'K', '9898989898', 'male', 'password123', '611222104076'],
      ['arun.k@example.com', 'Arun', 'K', '9123456780', 'male', 'password789', '']
    ]

    const csvContent = templateData.map(row => row.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'user_bulk_upload_template.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const simulateUploadProgress = (): Promise<void> => {
    return new Promise((resolve) => {
      let progress = 0
      const interval = setInterval(() => {
        progress += Math.random() * 15
        if (progress >= 90) {
          progress = 90
          clearInterval(interval)
          resolve()
        }
        setUploadProgress(prev => ({
          ...prev,
          percentage: Math.min(progress, 90),
          status: 'uploading',
          message: `Uploading file... ${Math.round(progress)}%`
        }))
      }, 200)
    })
  }

  const simulateProcessingProgress = (): Promise<void> => {
    return new Promise((resolve) => {
      let progress = 90
      const interval = setInterval(() => {
        progress += Math.random() * 5
        if (progress >= 100) {
          progress = 100
          clearInterval(interval)
          resolve()
        }
        setUploadProgress(prev => ({
          ...prev,
          percentage: progress,
          stage: 'processing',
          status: 'processing',
          message: `Processing users... ${Math.round(progress)}%`
        }))
      }, 300)
    })
  }

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData): Promise<UploadResults> => {
      const token = getToken()
      if (!token) throw new Error("No authentication token found")

      await simulateUploadProgress()
      const result = await bulkUploadUsers(formData, token)
      await simulateProcessingProgress()

      return result
    },
    onSuccess: (data: UploadResults) => {
      setUploadProgress({
        percentage: 100,
        status: 'completed',
        stage: 'processing',
        message: 'Upload completed successfully!'
      })

      setTimeout(() => {
        setUploadResults(data)
        toast.success("Bulk upload completed successfully!")

        if (onSuccess) {
          onSuccess(data)
        }
      }, 500)
    },
    onError: (error: Error) => {
      setUploadProgress({
        percentage: 0,
        status: 'error',
        stage: 'upload',
        message: 'Upload failed. Please try again.'
      })
      toast.error(error.message || "Upload failed. Please try again.")
    }
  })

  // Step one of "Upload & create": confirm what was actually read out of the
  // file. Nothing is sent until the preview's own button is pressed.
  const handleReviewFile = (): void => {
    if (!file) {
      toast.error("Please select a file to upload")
      return
    }
    // The role decides the account's permissions, so refuse to guess it. A file
    // uploaded without one used to create users who could log in and see nothing.
    if (!roleId) {
      toast.error("Please choose a role assignment for these users")
      return
    }
    if (isInspecting) {
      toast.error("Still reading the file — one moment")
      return
    }
    if (inspection?.problems.length) {
      toast.error(
        inspection.problems.length === 1
          ? inspection.problems[0]
          : `Fix ${inspection.problems.length} column problems before uploading`,
      )
      return
    }
    setShowPreview(true)
  }

  const handleUpload = async (): Promise<void> => {
    if (!file) {
      toast.error("Please select a file to upload")
      return
    }
    if (!roleId) {
      toast.error("Please choose a role assignment for these users")
      return
    }
    // Re-checked here, not just in handleReviewFile: the preview stays mounted
    // while the picks can still change, and this is the last gate before send.
    if (inspection?.problems.length) {
      toast.error("Fix the column problems before uploading")
      return
    }

    setShowPreview(false)
    setUploadProgress({
      percentage: 0,
      status: 'uploading',
      stage: 'upload',
      message: 'Starting upload...'
    })

    const formData = new FormData()
    formData.append('file', file)
    formData.append('notificationMethod', 'email')

    // Real refs, not names — the server stores these as ObjectIds.
    formData.append('role', roleId)
    if (clientId) {
      formData.append('clientId', clientId)
      if (selectedClient?.clientCompany) {
        formData.append('clientName', selectedClient.clientCompany)
      }
    }
    if (selectedMapping) {
      formData.append('serviceMappingId', selectedMapping._id)
      formData.append('serviceModel', modelNameOf(selectedMapping))
    }

    uploadMutation.mutate(formData)
  }

  // Anything picked yet? Closing then would throw away the setup, so the X and
  // Cancel confirm first. An untouched modal closes straight away.
  // Once the upload has run, the picks are spent — there is nothing left to
  // warn about, so results close without a prompt.
  const hasBulkWork = (): boolean =>
    !uploadResults && Boolean(file || roleId || clientId || mappingId)

  const requestCloseBulk = (): void => {
    if (isUploadInProgress) return
    if (hasBulkWork()) {
      setConfirmDiscardBulk(true)
      return
    }
    handleClose()
  }

  const handleClose = (): void => {
    setConfirmDiscardBulk(false)
    setRejectedFile(null)
    setFile(null)
    setInspection(null)
    setShowPreview(false)
    setUploadResults(null)
    // Clear the placement picks too — reopening should not silently reuse the
    // last client/service for a different set of users.
    setRoleId('')
    setClientId('')
    setMappingId('')
    setRoleOpen(false)
    setClientOpen(false)
    setModelOpen(false)
    setUploadProgress({
      percentage: 0,
      status: 'idle',
      stage: 'upload',
      message: ''
    })
    onClose()
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleUploadAreaClick = (): void => {
    fileInputRef.current?.click()
  }

  const handleRemoveFileClick = (e: React.MouseEvent<HTMLButtonElement>): void => {
    e.stopPropagation()
    handleRemoveFile()
  }

  const handleUploadAnotherFile = (): void => {
    setFile(null)
    setInspection(null)
    setRejectedFile(null)
    setShowPreview(false)
    setUploadResults(null)
    setUploadProgress({
      percentage: 0,
      status: 'idle',
      stage: 'upload',
      message: ''
    })
  }

  const getProgressBarColor = (): string => {
    switch (uploadProgress.status) {
      case 'uploading':
        return 'bg-brand-strong'
      case 'processing':
        return 'bg-warn-500'
      case 'completed':
        return 'bg-success-500'
      case 'error':
        return 'bg-danger-500'
      default:
        return 'bg-ink-400'
    }
  }

  const getStatusIcon = () => {
    switch (uploadProgress.status) {
      case 'uploading':
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-brand-strong" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-success-500" />
      case 'error':
        return <XCircle className="h-4 w-4 text-danger-500" />
      default:
        return <Upload className="h-4 w-4 text-faint" />
    }
  }

  const isUploadInProgress = uploadProgress.status === 'uploading' || uploadProgress.status === 'processing'

  // Presentational step marker — derived from the state the flow already tracks
  // (configure → upload → results), no state of its own. Same three-chip header
  // as the Bulk add users modal.
  const currentStep = uploadResults ? 3 : roleId ? 2 : 1
  const steps = ["Configure", "Upload", "Results"]

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o) requestCloseBulk() }}>
      <DialogContent
        showCloseButton={false}
        // The backdrop can't dismiss this: a configured upload with a validated
        // file is too much work to lose to a stray click.
        onInteractOutside={(e) => e.preventDefault()}
        className="sm:max-w-[640px] max-h-[88vh] flex flex-col gap-0 p-0 overflow-hidden"
      >
        <DialogHeader className="border-b border-hairline px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-tile bg-brand-wash flex items-center justify-center">
                  <FileSpreadsheet className="h-4 w-4 text-brand-strong" />
                </span>
                Bulk user upload
              </DialogTitle>
              <DialogDescription>
                Pick the role{isStudentRole ? ', client and service model' : ''}, download the template, fill it, and upload.
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={requestCloseBulk}
              disabled={isUploadInProgress}
              title="Close"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-500 text-white transition-colors duration-150 hover:bg-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <X className="h-4 w-4" strokeWidth={3} />
              <span className="sr-only">Close</span>
            </button>
          </div>
          <div className="flex items-center gap-2 pt-1" aria-hidden="true">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 h-6 pl-1 pr-2.5 rounded-full text-2xs font-semibold transition-colors duration-150 ${
                    currentStep === i + 1
                      ? "bg-brand-wash text-brand-strong"
                      : currentStep > i + 1
                        ? "bg-success-50 text-success-700"
                        : "bg-ink-100 text-subtle"
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${
                    currentStep === i + 1
                      ? "bg-brand-strong text-white"
                      : currentStep > i + 1
                        ? "bg-success-500 text-white"
                        : "bg-ink-200 text-ink-700"
                  }`}>
                    {i + 1}
                  </span>
                  {s}
                </span>
                {i < steps.length - 1 && <span className="w-4 h-px bg-ink-200" />}
              </div>
            ))}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Access & placement — applied to every row in the file */}
          {!uploadResults && uploadProgress.status === 'idle' && !showPreview && (
            <div className={`grid grid-cols-1 gap-3 ${isStudentRole ? 'sm:grid-cols-3' : 'sm:grid-cols-1'}`}>
              <Dropdown
                label="Role"
                required
                icon={<ShieldCheck size={14} className="text-subtle" />}
                value={selectedRole?.renameRole || selectedRole?.originalRole}
                placeholder={isLoadingRoles ? "Loading roles…" : "Select role"}
                open={roleOpen}
                setOpen={setRoleOpen}
                disabled={isLoadingRoles}
              >
                {roles.length === 0 ? <p className="px-3 py-2 text-xs text-faint">No roles</p> :
                  roles.map((r) => (
                    <button key={r._id} type="button"
                      onClick={() => {
                        setRoleId(r._id)
                        setRoleOpen(false)
                        // Leaving a student role drops the placement picks —
                        // they're hidden from here on, so keeping them would
                        // silently apply a client the user can no longer see.
                        if (!/student/i.test(r.renameRole || r.originalRole || '')) {
                          setClientId('')
                          setMappingId('')
                          setClientOpen(false)
                          setModelOpen(false)
                        }
                      }}
                      className={optionClass(roleId === r._id)}>
                      {r.renameRole || r.originalRole}
                    </button>
                  ))}
              </Dropdown>

              {/* Placement pickers appear only for students — see isStudentRole. */}
              {isStudentRole && (
              <Dropdown
                label="Client"
                icon={<Building2 size={14} className="text-subtle" />}
                value={selectedClient?.clientCompany}
                placeholder={isLoadingContext ? "Loading…" : "Select client"}
                open={clientOpen}
                setOpen={setClientOpen}
                disabled={isLoadingContext}
              >
                {clients.length === 0 ? <p className="px-3 py-2 text-xs text-faint">No clients</p> :
                  clients.map((c) => (
                    <button key={c._id} type="button"
                      onClick={() => { setClientId(c._id); setMappingId(''); setClientOpen(false) }}
                      className={optionClass(clientId === c._id)}>
                      {c.clientCompany}
                    </button>
                  ))}
              </Dropdown>
              )}

              {isStudentRole && (
              <Dropdown
                label="Service model"
                icon={<Briefcase size={14} className="text-subtle" />}
                value={selectedMapping ? serviceLabelOf(selectedMapping) : undefined}
                placeholder={clientId ? "Select model" : "Pick client first"}
                open={modelOpen}
                setOpen={setModelOpen}
                disabled={!clientId || clientMappings.length === 0}
              >
                {clientMappings.length === 0 ? <p className="px-3 py-2 text-xs text-faint">No service mappings</p> :
                  clientMappings.map((m) => (
                    <button key={m._id} type="button"
                      onClick={() => { setMappingId(m._id); setModelOpen(false) }}
                      className={optionClass(mappingId === m._id)}>
                      {serviceLabelOf(m)}
                    </button>
                  ))}
              </Dropdown>
              )}
            </div>
          )}

          {/* What a row must contain, and where to get a file shaped like it */}
          {!uploadResults && uploadProgress.status === 'idle' && !showPreview && (
            <div className="rounded-tile border border-brand-500/20 bg-brand-wash p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-heading">Template columns</p>
                <p className="text-2xs text-subtle truncate">{TEMPLATE_COLUMNS.join(" · ")}</p>
              </div>
              <Button onClick={downloadTemplate} variant="outline" size="sm" className="flex items-center gap-1.5 text-xs flex-shrink-0">
                <Download className="h-3.5 w-3.5" /> Template
              </Button>
            </div>
          )}

          {/* File Upload Section */}
          {!uploadResults && uploadProgress.status === 'idle' && !showPreview && (
            <div className="space-y-3">
              <div
                className={`border-2 border-dashed rounded-tile p-6 text-center cursor-pointer transition-colors duration-150 ${
                  isDragging
                    ? 'border-brand bg-brand-wash'
                    : file
                      ? 'border-success-500/50 bg-success-50'
                      : 'border-hairline-strong hover:border-line-hover hover:bg-canvas'
                }`}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleUploadAreaClick}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileInputChange}
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                />

                {file ? (
                  <div className="space-y-1">
                    <CheckCircle className="h-7 w-7 text-success-500 mx-auto" />
                    <p className="text-sm font-medium text-heading">{file.name}</p>
                    <p className="text-xs text-subtle">{formatFileSize(file.size)}</p>
                    <button
                      type="button"
                      onClick={handleRemoveFileClick}
                      className="text-xs text-subtle hover:text-danger-700 inline-flex items-center gap-1 transition-colors duration-150"
                    >
                      <X className="h-3 w-3" /> Remove
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Upload className="h-7 w-7 text-faint mx-auto" />
                    <p className="text-sm font-medium text-heading">
                      {isDragging ? 'Drop the file here' : 'Drag & drop the filled template'}
                    </p>
                    <p className="text-xs text-subtle">or click to browse — .xlsx, .xls or .csv up to 5MB</p>
                  </div>
                )}
              </div>

              {/* Why the last file was turned away — named, so it's obvious
                  which one to fix when several are being tried. */}
              {rejectedFile && (
                <div className="rounded-tile border border-danger-500/40 bg-danger-50 p-3">
                  <div className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 text-danger-500 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-danger-700 break-all">
                        {rejectedFile.name} was not accepted
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {rejectedFile.reasons.map((r, i) => (
                          <li key={i} className="text-2xs text-danger-700/90">• {r}</li>
                        ))}
                      </ul>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRejectedFile(null)}
                      className="text-danger-500 hover:text-danger-700 shrink-0"
                      title="Dismiss"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Column check ──────────────────────────────────────────────────
              The header row of the picked file, matched against the template.
              Shown as soon as a file is chosen so a wrong column name is a
              five-second fix rather than N identical row errors after upload. */}
          {!uploadResults && uploadProgress.status === 'idle' && !showPreview && file && (
            <div className="rounded-tile border border-hairline p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-heading">
                  {isInspecting ? 'Reading the file…' : 'Column check'}
                </p>
                {isInspecting
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin text-subtle" />
                  : inspection?.parsed && (
                    <span className="text-2xs text-subtle">
                      {inspection.totalRows} data row{inspection.totalRows === 1 ? '' : 's'}
                    </span>
                  )}
              </div>

              {!isInspecting && inspection && !inspection.parsed && (
                <p className="text-2xs text-warn-700 flex items-start gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-px" />
                  {inspection.note}
                </p>
              )}

              {!isInspecting && inspection?.parsed && (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {inspection.columns.map((c, i) => {
                      const style: Record<ColumnStatus, string> = {
                        matched: 'bg-success-50 text-success-700 border-success-500/25',
                        mismatch: 'bg-danger-50 text-danger-700 border-danger-500/25',
                        missing: 'bg-danger-50 text-danger-700 border-danger-500/25',
                        'optional-missing': 'bg-ink-50 text-subtle border-hairline',
                        legacy: 'bg-warn-50 text-warn-700 border-warn-500/25',
                        extra: 'bg-warn-50 text-warn-700 border-warn-500/25',
                      }
                      const label =
                        c.status === 'mismatch' ? `${c.found} → ${c.expected}`
                        : c.status === 'missing' ? `${c.expected} missing`
                        : c.status === 'optional-missing' ? `${c.expected} — not provided`
                        : (c.found ?? c.expected)
                      return (
                        <span
                          key={`${c.expected ?? c.found}-${i}`}
                          className={`inline-flex items-center gap-1 rounded-chip border px-2 py-0.5 text-2xs font-medium ${style[c.status]}`}
                        >
                          {c.status === 'matched' && <CheckCircle className="h-3 w-3" />}
                          {(c.status === 'mismatch' || c.status === 'missing') && <XCircle className="h-3 w-3" />}
                          {(c.status === 'legacy' || c.status === 'extra') && <AlertTriangle className="h-3 w-3" />}
                          {label}
                        </span>
                      )
                    })}
                  </div>

                  {inspection.problems.length > 0 && (
                    <ul className="space-y-1">
                      {inspection.problems.map((p, i) => (
                        <li key={i} className="text-2xs text-danger-700 flex items-start gap-1.5">
                          <XCircle className="h-3.5 w-3.5 flex-shrink-0 mt-px" />{p}
                        </li>
                      ))}
                    </ul>
                  )}
                  {inspection.warnings.length > 0 && (
                    <ul className="space-y-1">
                      {inspection.warnings.map((w, i) => (
                        <li key={i} className="text-2xs text-warn-700 flex items-start gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-px" />{w}
                        </li>
                      ))}
                    </ul>
                  )}
                  {!inspection.problems.length && !inspection.warnings.length && (
                    <p className="text-2xs text-success-700 flex items-center gap-1.5">
                      <CheckCircle className="h-3.5 w-3.5" />
                      Every column matches the template.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Preview ───────────────────────────────────────────────────────
              Step one of "Upload & create": what was actually read out of the
              file, and the context every row will be created with. Nothing has
              been sent at this point. */}
          {showPreview && !uploadResults && uploadProgress.status === 'idle' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-heading">Ready to create</p>
                <span className="text-2xs text-subtle truncate max-w-[55%]">{file?.name}</span>
              </div>

              {/* Applied to every row — the picks, not the spreadsheet */}
              <div className="rounded-tile border border-brand-500/20 bg-brand-wash p-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { label: 'Role', value: selectedRole ? (selectedRole.renameRole || selectedRole.originalRole) : '—' },
                  { label: 'Client', value: selectedClient?.clientCompany || '—' },
                  { label: 'Service model', value: selectedMapping ? modelNameOf(selectedMapping) : '—' },
                ].map(f => (
                  <div key={f.label} className="min-w-0">
                    <p className="text-2xs text-subtle">{f.label}</p>
                    <p className="text-xs font-semibold text-heading truncate">{f.value}</p>
                  </div>
                ))}
              </div>

              {/* Header row → template field, as read from the file */}
              <div className="rounded-tile border border-hairline overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-hairline bg-ink-50">
                  <p className="text-xs font-semibold text-heading">Columns read from your file</p>
                  <span className="text-2xs text-subtle">
                    {inspection?.totalRows ?? 0} row{(inspection?.totalRows ?? 0) === 1 ? '' : 's'} will be created
                  </span>
                </div>
                <div className="max-h-40 overflow-y-auto divide-y divide-hairline">
                  {(inspection?.columns ?? []).map((c, i) => (
                    <div key={`${c.expected ?? c.found}-${i}`} className="flex items-center gap-2 px-3 py-1.5">
                      <span className="text-xs text-body flex-1 truncate">{c.found ?? '—'}</span>
                      <span className="text-2xs text-faint">→</span>
                      <span className="text-xs font-medium text-heading flex-1 truncate">
                        {c.expected ?? <span className="text-faint">not a template column</span>}
                      </span>
                      <span className="text-2xs flex-shrink-0">
                        {c.status === 'matched' && <span className="text-success-700">matched</span>}
                        {c.status === 'optional-missing' && <span className="text-subtle">not provided</span>}
                        {c.status === 'legacy' && <span className="text-warn-700">overrides picks</span>}
                        {c.status === 'extra' && <span className="text-warn-700">ignored</span>}
                        {(c.status === 'missing' || c.status === 'mismatch') && <span className="text-danger-700">problem</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* First rows, exactly as parsed */}
              {!!inspection?.sample.length && (
                <div className="rounded-tile border border-hairline overflow-hidden">
                  <p className="text-xs font-semibold text-heading px-3 py-2 border-b border-hairline bg-ink-50">
                    First {inspection.sample.length} row{inspection.sample.length === 1 ? '' : 's'}
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-2xs">
                      <thead>
                        <tr className="border-b border-hairline">
                          {inspection.headers.map((h, i) => (
                            <th key={`${h}-${i}`} className="text-left font-semibold text-subtle px-3 py-1.5 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-hairline">
                        {inspection.sample.map((row, r) => (
                          <tr key={r}>
                            {inspection.headers.map((_, c) => (
                              <td key={c} className="px-3 py-1.5 text-body whitespace-nowrap max-w-[160px] truncate">
                                {row[c] || <span className="text-faint">—</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {inspection && !inspection.parsed && (
                <p className="text-2xs text-warn-700 flex items-start gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-px" />
                  {inspection.note} The server will still validate every row.
                </p>
              )}
            </div>
          )}

          {/* Upload Progress Section */}
          {isUploadInProgress && (
            <div className="space-y-3">
              <div className="w-full bg-ink-100 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor()}`}
                  style={{ width: `${uploadProgress.percentage}%` }}
                />
              </div>
              <p className="text-xs text-center text-subtle flex items-center justify-center gap-1.5">
                {getStatusIcon()} {uploadProgress.message}
              </p>

              {/* Stage Indicators */}
              <div className="flex justify-center gap-6">
                {([
                  { key: 'upload' as const, label: 'Uploading' },
                  { key: 'processing' as const, label: 'Processing' },
                ]).map((s) => {
                  const active = uploadProgress.stage === s.key
                  return (
                    <span key={s.key} className={`flex items-center gap-1.5 text-2xs ${active ? 'text-brand-strong font-semibold' : 'text-faint'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-brand-strong' : 'bg-ink-200'}`} />
                      {s.label}
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {/* Upload Results */}
          {uploadResults && (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Processed", n: uploadResults.summary?.totalProcessed || 0, cls: "border-hairline bg-canvas text-body" },
                  { label: "Created", n: uploadResults.summary?.successfullyCreated || 0, cls: "border-success-500/20 bg-success-50 text-success-700" },
                  { label: "Emails sent", n: uploadResults.summary?.emailsSent || 0, cls: "border-warn-500/20 bg-warn-50 text-warn-700" },
                  { label: "Emails failed", n: uploadResults.summary?.emailsFailed || 0, cls: "border-danger-500/20 bg-danger-50 text-danger-700" },
                ].map((s) => (
                  <div key={s.label} className={`rounded-tile border p-2.5 text-center ${s.cls}`}>
                    <p className="text-lg font-bold tabular-nums">{s.n}</p>
                    <p className="text-2xs font-medium">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* User List */}
              {uploadResults.users && uploadResults.users.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-heading">
                    Created users ({uploadResults.users.length})
                  </p>
                  <div className="max-h-48 overflow-y-auto border border-hairline rounded-tile divide-y divide-hairline">
                    {uploadResults.users.slice(0, 10).map((user, index) => (
                      <div key={user._id || index} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                        <CheckCircle className="h-3.5 w-3.5 text-success-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-body truncate">{user.firstName} {user.lastName}</p>
                          <p className="text-faint truncate">
                            {[user.email, user.clientName, user.degree, user.studentType].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-2xs flex-shrink-0 ml-auto">
                          {user.role}
                        </Badge>
                      </div>
                    ))}
                    {uploadResults.users.length > 10 && (
                      <p className="text-center py-1.5 text-2xs text-faint">
                        +{uploadResults.users.length - 10} more users
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {uploadResults.creditExceeded && (
                <Alert className="bg-warn-50 border-warn-500/20 py-2">
                  <AlertTriangle className="h-4 w-4 text-warn-700" />
                  <AlertDescription className="text-warn-700 text-xs">
                    Users created, but some emails failed due to insufficient credits.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-hairline bg-surface px-5 py-3.5">
          <div className="flex w-full justify-between items-center">
            {/* Once results are in there is nothing left to lose — Close goes
                straight through; Cancel mid-setup confirms. */}
            <Button
              variant="outline"
              size="sm"
              onClick={uploadResults ? handleClose : requestCloseBulk}
              disabled={isUploadInProgress}
            >
              {uploadResults ? 'Close' : 'Cancel'}
            </Button>

            <div className="flex gap-2">
              {uploadResults && (
                <Button onClick={handleUploadAnotherFile} variant="outline" size="sm">
                  Upload another
                </Button>
              )}

              {showPreview && !uploadResults && !isUploadInProgress && (
                <Button onClick={() => setShowPreview(false)} variant="outline" size="sm">
                  Back
                </Button>
              )}

              {!uploadResults && uploadProgress.status !== 'completed' && (
                <Button
                  onClick={showPreview ? handleUpload : handleReviewFile}
                  disabled={
                    !file || !roleId || isUploadInProgress || isInspecting ||
                    !!inspection?.problems.length
                  }
                  title={
                    !roleId ? "Choose a role assignment first"
                    : inspection?.problems.length ? "Fix the column problems first"
                    : undefined
                  }
                  size="sm"
                >
                  {isUploadInProgress
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…</>
                    : isInspecting
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading…</>
                      : showPreview
                        ? <><CheckCircle className="h-3.5 w-3.5" /> Confirm &amp; create</>
                        : <><Upload className="h-3.5 w-3.5" /> Upload &amp; create</>}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>

      {/* Discard confirmation — only when something has actually been set up */}
      <Dialog open={confirmDiscardBulk} onOpenChange={setConfirmDiscardBulk}>
        <DialogContent showCloseButton={false} className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Discard this upload?</DialogTitle>
            <DialogDescription>
              {file
                ? `${file.name} and the role/placement picks will be cleared.`
                : 'The role and placement picks will be cleared.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmDiscardBulk(false)}>
              Keep editing
            </Button>
            <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={handleClose}>
              Discard &amp; close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}

export default BulkUploadModal
