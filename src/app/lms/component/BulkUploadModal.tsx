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
import { bulkUploadUsers } from "@/apiServices/userService"
import { courseStructuresSummaryQuery } from "@/apiServices/createCourseStucture"
import { type ServiceMapping } from "@/apiServices/serviceMappingService"
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

  const handleFileSelect = (selectedFile: File): void => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ]

    if (!validTypes.includes(selectedFile.type)) {
      toast.error("Please upload an Excel file (.xlsx, .xls) or CSV file")
      return
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB")
      return
    }

    setFile(selectedFile)
    setUploadResults(null)
    setUploadProgress({
      percentage: 0,
      status: 'idle',
      stage: 'upload',
      message: ''
    })
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files[0])
    }
  }

  const handleRemoveFile = (): void => {
    setFile(null)
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

  // One example per shape: a Student row with the student-only columns filled,
  // and a non-student row that leaves them blank. `role` must name a role that
  // already exists — an unrecognised name is now reported as a row error rather
  // than quietly creating a new role. Leave it blank to use the default picked
  // above. Client and service model are never columns: they must be stored as
  // ids and a spreadsheet only carries text, so they come from the pickers.
  const TEMPLATE_COLUMNS = [
    'email', 'firstName', 'lastName', 'phone', 'gender', 'password',
    'rollNumber', 'role', 'clientName', 'serviceModel',
  ]

  const downloadTemplate = (): void => {
    // The per-row fields the New user form collects. role / clientName /
    // serviceModel are NAMES here; the server resolves each to the id it stores
    // (role → role ref, clientName → clientId, serviceModel → serviceMappingId)
    // and rejects a name it does not recognise instead of inventing a record.
    // Leave any of the three blank to fall back to the pickers above.
    //
    // The degree-hierarchy columns (degree, department, year, semester, section,
    // batch, studentType) are intentionally NOT here — a placement student's
    // record does not carry them. The server still reads them when a file
    // includes them, for clients that run degree programs.
    const templateData = [
      TEMPLATE_COLUMNS,
      ['sam.k@example.com', 'sam', 'K', '9898989898', 'male', 'password123', '611222104076', 'Student', 'Knowledge Institute of Technology', 'placement training'],
      ['arun.k@example.com', 'Arun', 'K', '9123456780', 'male', 'password789', '', 'Admin', 'Knowledge Institute of Technology', '']
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

  const handleUpload = async (): Promise<void> => {
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

  const handleClose = (): void => {
    setFile(null)
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
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o && !isUploadInProgress) handleClose() }}>
      <DialogContent className="sm:max-w-[640px] max-h-[88vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="border-b border-hairline px-5 py-4">
          <DialogTitle className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-tile bg-brand-wash flex items-center justify-center">
              <FileSpreadsheet className="h-4 w-4 text-brand-strong" />
            </span>
            Bulk user upload
          </DialogTitle>
          <DialogDescription>
            Pick the role, client and service model, download the template, fill it, and upload.
          </DialogDescription>
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
          {!uploadResults && uploadProgress.status === 'idle' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                      onClick={() => { setRoleId(r._id); setRoleOpen(false) }}
                      className={optionClass(roleId === r._id)}>
                      {r.renameRole || r.originalRole}
                    </button>
                  ))}
              </Dropdown>

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
            </div>
          )}

          {/* What a row must contain, and where to get a file shaped like it */}
          {!uploadResults && uploadProgress.status === 'idle' && (
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
          {!uploadResults && uploadProgress.status === 'idle' && (
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
              <p className="text-2xs text-subtle text-center leading-relaxed">
                Required: email, firstName, lastName, phone, password · Optional: gender, rollNumber,
                role, clientName, serviceModel.<br />
                role / clientName / serviceModel are matched by name and saved as ids — leave a cell
                blank to use the picks above.
              </p>
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
            <Button variant="outline" size="sm" onClick={handleClose} disabled={isUploadInProgress}>
              {uploadResults ? 'Close' : 'Cancel'}
            </Button>

            <div className="flex gap-2">
              {uploadResults && (
                <Button onClick={handleUploadAnotherFile} variant="outline" size="sm">
                  Upload another
                </Button>
              )}

              {!uploadResults && uploadProgress.status !== 'completed' && (
                <Button
                  onClick={handleUpload}
                  disabled={!file || !roleId || isUploadInProgress}
                  title={!roleId ? "Choose a role assignment first" : undefined}
                  size="sm"
                >
                  {isUploadInProgress
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…</>
                    : <><Upload className="h-3.5 w-3.5" /> Upload &amp; create</>}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default BulkUploadModal
