"use client"

import { useState, useEffect, useMemo, useRef } from 'react'
import { Search, Filter, ChevronDown, ChevronUp, X, Mail, Eye, UserIcon, GraduationCap, Trash2, Settings, Calendar, Clock, CheckCircle, XCircle, Clock as ClockIcon, Users, Briefcase } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { motion, AnimatePresence } from 'framer-motion'
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from 'sonner'

interface User {
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
  batch?: string
  gender?: string
  profile?: string
  createdAt?: string
  notes?: any[]
  permission?: any
}

interface Enrollment {
  user: User
  // Mirrors the batchUser schema enum — 'suspended' is the stored off-state
  // (shown as "Inactive" in the UI); there is no 'inactive' value on record.
  status: 'active' | 'suspended' | 'completed' | 'dropped'
  enrolmentStarts: string
  enrolmentDuration: number
  enrolmentEnds: string
  createdAt: string
  updatedAt: string
}

interface Role {
  _id: string;
  renameRole: string;
  originalRole: string;
  roleValue: string;
}

interface FilteredTableProps {
  users: User[]
  enrollments?: Enrollment[]
  isLoading?: boolean
  selectedUserIds?: string[]
  onUserSelect?: (userId: string) => void
  onSelectAll?: (participantIds: string[]) => void
  onBulkRemove?: (participantIds: string[]) => void
  onViewUser?: (user: User) => void
  onSettingsUser?: (user: User) => void
  onRemoveUser?: (userId: string) => void
  // Inline active/inactive switch in the Status column. 'suspended' is the
  // stored off-state — the schema enum has no 'inactive'; the UI word for it
  // is "Inactive". Terminal states (completed/dropped) keep the badge and are
  // only changed through the settings dialog.
  onToggleStatus?: (userId: string, nextStatus: 'active' | 'suspended') => void
  isTogglingStatus?: boolean
  isRemoving?: boolean
  title?: string
  emptyMessage?: string
  emptyDescription?: string
  showActions?: boolean
  showSelection?: boolean
  basedOn?: string | null
  itemsPerPage?: number
  showRoleTabs?: boolean
  showBatchFilter?: boolean
  rightAction?: React.ReactNode
  fillHeight?: boolean
  // Adds an "Enrolled on" column reading enrollment.createdAt — for the
  // roster view, where each row has an enrollment record.
  showEnrolledOn?: boolean
}

const degreeOptions = ["B.Tech", "B.E", "B.Sc", "B.Com", "B.A", "M.Tech", "M.Sc", "MBA", "PhD"]
const departmentOptions = ["Computer Science", "Electrical", "Mechanical", "Civil", "Electronics", "Information Technology", "Mathematics", "Physics", "Chemistry"]
const yearOptions = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year"]

export default function FilteredTable({
  users,
  enrollments = [],
  isLoading = false,
  selectedUserIds = [],
  onUserSelect,
  onSelectAll,
  onBulkRemove,
  onViewUser,
  onSettingsUser,
  onRemoveUser,
  onToggleStatus,
  isTogglingStatus = false,
  isRemoving = false,
  title = "Participants",
  emptyMessage = "No users found",
  emptyDescription = "Try changing your filters",
  showActions = true,
  showSelection = false,
  basedOn = null,
  itemsPerPage = 10,
  showRoleTabs = false,
  showBatchFilter = true,
  rightAction = null,
  fillHeight = false,
  showEnrolledOn = false,
}: FilteredTableProps) {
  const [roleTabFilter, setRoleTabFilter] = useState<'all' | 'staff' | 'student'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  // The filter popover closes like any dropdown: outside click or Esc. Radix
  // Select options render in a body-level portal, so picking one would read as
  // an "outside" click without the popper-wrapper guard; same portal presence
  // tells us an open Select owns the Esc press.
  const filterBtnRef = useRef<HTMLButtonElement>(null)
  const filterPanelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!showFilters) return
    const onDown = (e: MouseEvent) => {
      const t = e.target
      if (!(t instanceof Element)) return
      if (filterPanelRef.current?.contains(t)) return
      if (filterBtnRef.current?.contains(t)) return
      if (t.closest('[data-radix-popper-content-wrapper]')) return
      setShowFilters(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (document.querySelector('[data-radix-popper-content-wrapper]')) return
      setShowFilters(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [showFilters])
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedDegree, setSelectedDegree] = useState<string>('all')
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all')
  const [selectedYear, setSelectedYear] = useState<string>('all')
  const [selectedBatch, setSelectedBatch] = useState<string>('all')
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [showBulkRemoveDialog, setShowBulkRemoveDialog] = useState(false)
  const [localSelectedUserIds, setLocalSelectedUserIds] = useState<string[]>([])

  useEffect(() => {
    setLocalSelectedUserIds(selectedUserIds)
  }, [selectedUserIds])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchTerm, selectedStatus, selectedDegree, selectedDepartment, selectedYear, selectedBatch, selectedRoles, roleTabFilter])

  const availableRoles = useMemo(() => {
    const rolesMap = new Map<string, Role>();
    
    users.forEach(user => {
      if (user.role && user.roleId) {
        rolesMap.set(user.roleId, {
          _id: user.roleId,
          renameRole: user.role,
          originalRole: user.role,
          roleValue: user.role.toLowerCase().replace(/\s+/g, '')
        });
      }
    });
    
    return Array.from(rolesMap.values());
  }, [users])

  // Get unique batch values from users
  const availableBatches = useMemo(() => {
    const batchSet = new Set<string>();
    users.forEach(user => {
      if (user.batch) {
        batchSet.add(user.batch);
      }
    });
    return Array.from(batchSet).sort();
  }, [users]);

  const getEnrollmentForUser = (userId: string) => {
    return enrollments.find(enrollment => 
      enrollment.user._id === userId || enrollment.user.id === userId
    );
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { variant: 'default', className: 'bg-emerald-100 text-emerald-800', icon: CheckCircle },
      inactive: { variant: 'secondary', className: 'bg-gray-100 text-gray-800', icon: XCircle },
      completed: { variant: 'default', className: 'bg-blue-100 text-blue-800', icon: CheckCircle },
      dropped: { variant: 'destructive', className: 'bg-red-100 text-red-800', icon: XCircle }
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.inactive
    const Icon = config.icon
    
    return (
      <Badge
        variant={config.variant as any}
        className={`flex items-center gap-1 ${config.className} text-[11px] px-1.5 py-0 h-5`}
      >
        <Icon className="h-3 w-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const enrollment = getEnrollmentForUser(user.id)
      
      const matchesSearch = !debouncedSearchTerm ||
        (user.userId && user.userId.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) ||
        user.firstName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        user.lastName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        user.phone.includes(debouncedSearchTerm) ||
        user.role.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        (enrollment && enrollment.status.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) ||
        (basedOn === 'college' && (
          (user.degree && user.degree.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) ||
          (user.department && user.department.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) ||
          (user.batch && user.batch.toLowerCase().includes(debouncedSearchTerm.toLowerCase()))
        ))

      const matchesRoles = selectedRoles.length === 0 || 
        selectedRoles.includes(user.roleId)

      const matchesStatus = !selectedStatus || selectedStatus === "all" || user.status === selectedStatus
      const matchesDegree = !selectedDegree || selectedDegree === "all" || user.degree === selectedDegree
      const matchesDepartment = !selectedDepartment || selectedDepartment === "all" || user.department === selectedDepartment
      const matchesYear = !selectedYear || selectedYear === "all" || user.year === selectedYear
      const matchesBatch = !selectedBatch || selectedBatch === "all" || user.batch === selectedBatch

      const matchesRoleTab = !showRoleTabs || roleTabFilter === 'all' || (
        roleTabFilter === 'student'
          ? (user.role || '').toLowerCase() === 'student'
          : (user.role || '').toLowerCase() !== 'student'
      )

      return matchesSearch && matchesRoles && matchesStatus && matchesDegree && matchesDepartment && matchesYear && matchesBatch && matchesRoleTab
    });
  }, [users, enrollments, debouncedSearchTerm, selectedStatus, selectedDegree, selectedDepartment, selectedYear, selectedBatch, selectedRoles, basedOn, showRoleTabs, roleTabFilter])

  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex)
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage)
  const totalUsers = filteredUsers.length

  const clearFilters = () => {
    setSelectedStatus('all')
    setSelectedDegree('all')
    setSelectedDepartment('all')
    setSelectedYear('all')
    setSelectedBatch('all')
    setSelectedRoles([])
    setSearchTerm('')
    setCurrentPage(1)
  }

  const hasActiveFilters = () => {
    return (
      selectedStatus !== 'all' ||
      selectedDegree !== 'all' ||
      selectedDepartment !== 'all' ||
      selectedYear !== 'all' ||
      selectedBatch !== 'all' ||
      selectedRoles.length > 0 ||
      searchTerm !== ''
    )
  }

  const getBadgeData = () => {
    const badges: { label: string; value: number; type: string }[] = []
    
    if (selectedStatus !== 'all') {
      badges.push({
        label: `Status: ${selectedStatus}`,
        value: totalUsers || 0,
        type: 'status'
      })
    }
    
    if (selectedDegree !== 'all') {
      badges.push({
        label: `Degree: ${selectedDegree}`,
        value: totalUsers || 0,
        type: 'degree'
      })
    }
    
    if (selectedDepartment !== 'all') {
      badges.push({
        label: `Dept: ${selectedDepartment}`,
        value: totalUsers || 0,
        type: 'department'
      })
    }
    
    if (selectedYear !== 'all') {
      badges.push({
        label: `Year: ${selectedYear}`,
        value: totalUsers || 0,
        type: 'year'
      })
    }
    
    if (selectedBatch !== 'all') {
      badges.push({
        label: `Batch: ${selectedBatch}`,
        value: totalUsers || 0,
        type: 'batch'
      })
    }
    
    if (selectedRoles.length > 0) {
      const selectedRoleNames = availableRoles
        .filter(role => selectedRoles.includes(role._id))
        .map(role => role.renameRole)
      
      badges.push({
        label: `Roles: ${selectedRoleNames.join(', ')}`,
        value: totalUsers || 0,
        type: 'role'
      })
    }
    
    return badges
  }

  const handleRoleToggle = (roleId: string) => {
    setSelectedRoles(prev =>
      prev.includes(roleId)
        ? prev.filter(id => id !== roleId)
        : [...prev, roleId]
    )
  }

  const handleSelectAllRoles = () => {
    if (selectedRoles.length === availableRoles.length) {
      setSelectedRoles([])
    } else {
      const allRoleIds = availableRoles.map(role => role._id)
      setSelectedRoles(allRoleIds)
    }
  }

  const isAllRolesSelected = availableRoles.length > 0 && selectedRoles.length === availableRoles.length

  // Trigger label for the Roles multi-select. The trigger holds a static value
  // ("multiple") with no matching SelectItem, so SelectValue/placeholder would
  // render blank — derive the text from the checked roles instead.
  const rolesTriggerLabel = useMemo(() => {
    if (selectedRoles.length === 0 || isAllRolesSelected) return 'All Roles'
    const names = availableRoles
      .filter(role => selectedRoles.includes(role._id))
      .map(role => role.renameRole)
    return names.length <= 2 ? names.join(', ') : `${names.length} roles selected`
  }, [selectedRoles, availableRoles, isAllRolesSelected])

  const handleSelectAllUsers = () => {
    if (onSelectAll) {
      if (localSelectedUserIds.length === filteredUsers.length) {
        const newSelection: string[] = []
        setLocalSelectedUserIds(newSelection)
        onSelectAll(newSelection)
      } else {
        const allUserIds = filteredUsers.map(user => user.id)
        setLocalSelectedUserIds(allUserIds)
        onSelectAll(allUserIds)
      }
    }
  }

  const handleUserSelect = (userId: string) => {
    const newSelection = localSelectedUserIds.includes(userId)
      ? localSelectedUserIds.filter(id => id !== userId)
      : [...localSelectedUserIds, userId]
    
    setLocalSelectedUserIds(newSelection)
    onUserSelect?.(userId)
  }

  const isAllUsersSelected = filteredUsers.length > 0 && 
    filteredUsers.every(user => localSelectedUserIds.includes(user.id))

  const handleBulkRemove = () => {
    if (onBulkRemove && localSelectedUserIds.length > 0) {
      onBulkRemove(localSelectedUserIds)
      setShowBulkRemoveDialog(false)
    }
  }

  const clearSelection = () => {
    setLocalSelectedUserIds([])
    if (onSelectAll) {
      onSelectAll([])
    }
  }

  const showBulkRemoveConfirmation = () => {
    toast.custom(
      (t) => (
        <div className="w-[356px] rounded-lg bg-white p-4 shadow-lg">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-900">Remove Selected Participants</h3>
            <p className="text-sm text-gray-600">
              Are you sure you want to remove {localSelectedUserIds.length} participant(s) from this course? 
              This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => toast.dismiss(t)}
                disabled={isRemoving}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  toast.dismiss(t)
                  handleBulkRemove()
                }}
                disabled={isRemoving}
              >
                {isRemoving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Removing...
                  </>
                ) : (
                  `Remove ${localSelectedUserIds.length} Participants`
                )}
              </Button>
            </div>
          </div>
        </div>
      ),
      {
        duration: Infinity,
      }
    )
  }

  return (
    // `relative` is the filter panel's containing block — the panel is
    // absolutely positioned so opening it takes no layout space at all.
    <div className={fillHeight ? "relative flex flex-col h-full gap-1.5 min-h-0" : "relative space-y-2"}>
      {/* Bulk Actions Bar */}
      {showSelection && localSelectedUserIds.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-md"
        >
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="px-3 py-1">
              {localSelectedUserIds.length} selected
            </Badge>
            <span className="text-sm text-blue-700">
              {localSelectedUserIds.length} {title.toLowerCase()} selected
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              className="text-xs h-6 px-2"
            >
              Clear
            </Button>
          </div>
          <div className="flex gap-2">
            {onBulkRemove && (
              <Button
                variant="destructive"
                size="sm"
                onClick={showBulkRemoveConfirmation}
                disabled={isRemoving}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Remove Selected ({localSelectedUserIds.length})
              </Button>
            )}
          </div>
        </motion.div>
      )}

      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex-1 flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full">
          {/* Search + optional Role Tabs */}
          <div className="flex items-center gap-2 w-full">
            <div className={`relative ${showRoleTabs ? 'w-1/2' : 'w-full sm:w-[calc(100%-30px)]'} min-w-[180px]`}>
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                placeholder={
                  basedOn === 'college'
                    ? "Search name, email, role, status, degree, batch..."
                    : "Search name, email, role, status..."
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 transform -translate-y-1/2"
                >
                  <X className="h-3.5 w-3.5 text-gray-400" />
                </button>
              )}
            </div>

            {showRoleTabs && (
              <div className="inline-flex items-center gap-0.5 p-0.5 bg-gray-100 rounded-md border w-1/2 justify-center">
                {([
                  { key: 'all', label: 'All', Icon: Users },
                  { key: 'staff', label: 'Staff', Icon: Briefcase },
                  { key: 'student', label: 'Student', Icon: GraduationCap },
                ] as const).map(({ key, label, Icon }) => {
                  const isActive = roleTabFilter === key
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setRoleTabFilter(key)}
                      className={`relative flex items-center justify-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors flex-1 ${
                        isActive
                          ? 'bg-white text-blue-600 shadow-xs'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-blue-600' : 'text-gray-500'}`} />
                      {label}
                      {isActive && (
                        <span className="absolute left-2 right-2 -bottom-0.5 h-0.5 bg-blue-600 rounded-full" />
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <Button
            ref={filterBtnRef}
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-1.5 h-8 px-2.5 text-xs"
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
            {hasActiveFilters() ? (
              <span>({getBadgeData().length})</span>
            ) : null}
            {showFilters ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {rightAction}
          <Badge variant="secondary" className="px-2 py-0.5 text-[11px]">
            {totalUsers || 0} {title}
          </Badge>
          {showSelection && (
            <div className="flex items-center">
              <Checkbox
                id="select-all-users"
                checked={isAllUsersSelected}
                onCheckedChange={handleSelectAllUsers}
                disabled={isLoading || filteredUsers.length === 0}
                className="mr-1.5 h-3.5 w-3.5"
              />
              <Label
                htmlFor="select-all-users"
                className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                onClick={handleSelectAllUsers}
              >
                {isAllUsersSelected ? 'Deselect All' : 'Select All'}
              </Label>
            </div>
          )}
        </div>
      </div>

      {/* Active Filter Badges */}
      {hasActiveFilters() && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-gray-50 rounded-md">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-gray-700">Active Filters:</span>
              {getBadgeData().map(badge => (
                <Badge
                  key={badge.label}
                  variant="secondary"
                  className="flex items-center gap-1 text-xs"
                >
                  {badge.label}
                  <button
                    onClick={() => {
                      if (badge.type === 'degree') {
                        setSelectedDegree("all")
                      } else if (badge.type === 'department') {
                        setSelectedDepartment("all")
                      } else if (badge.type === 'year') {
                        setSelectedYear("all")
                      } else if (badge.type === 'batch') {
                        setSelectedBatch("all")
                      } else if (badge.type === 'status') {
                        setSelectedStatus("all")
                      } else if (badge.type === 'role') {
                        setSelectedRoles([])
                      }
                    }}
                    className="ml-1 hover:text-red-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <Button
              onClick={clearFilters}
              variant="ghost"
              size="sm"
              className="text-xs h-7 text-gray-600 hover:text-red-600"
            >
              Clear All
            </Button>
          </div>
        </motion.div>
      )}

      {/* Filter popover — a compact card at the table's top-right, not a
          full-width sheet. `absolute` keeps it out of flow (the table never
          shifts) and, with no `top`, it lands at its static position — the
          table's top edge, hanging from the toolbar. Narrow on purpose: the
          rows stay visible on the left so filtering feedback is live; the
          filters themselves apply on change ("Done" only closes). The root's
          `relative` is its containing block; z-50 clears the sticky header. */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            ref={filterPanelRef}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-50 w-[380px] max-w-full"
          >
            {/* Styled after the Client Management filter panel (ClientFilterPanel):
                same card chrome, uppercase 2xs labels, token-based selects and a
                Reset action in the header. Filters still apply on change. */}
            <div className="bg-surface border border-hairline rounded-xl p-4 shadow-lg max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 gap-3">
              <h3 className="text-sm font-semibold text-heading">Filters</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={clearFilters}
                  disabled={!hasActiveFilters()}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-control border border-hairline-strong bg-surface text-xs font-medium text-body hover:bg-row-hover hover:text-heading disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
                >
                  Reset
                </button>
                <Button
                  onClick={() => setShowFilters(false)}
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {/* User Status Filter */}
              <div className="w-full">
                <span className="block text-2xs font-semibold uppercase tracking-wider text-subtle mb-1.5">Status</span>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full h-9 px-3 rounded-control border border-hairline-strong bg-surface text-sm text-body focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors duration-150 cursor-pointer"
                >
                  <option value="all">Any status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Suspended</option>
                </select>
              </div>

              {/* Role Filter - Multi-select */}
              <div className="w-full">
                <span className="block text-2xs font-semibold uppercase tracking-wider text-subtle mb-1.5">Roles</span>
                <Select
                  value="multiple"
                  onValueChange={() => {}}
                >
                  <SelectTrigger className="text-sm h-9 cursor-pointer w-full rounded-control border-hairline-strong">
                    <span className="truncate">{rolesTriggerLabel}</span>
                  </SelectTrigger>
                  <SelectContent className="text-xs cursor-pointer">
                    <div className="p-2 max-h-60 overflow-y-auto">
                      {/* All Roles Option */}
                      <div
                        className="flex items-center gap-2 p-2 hover:bg-row-hover rounded cursor-pointer"
                        onClick={handleSelectAllRoles}
                      >
                        {/* The row owns the click; the box only mirrors state,
                            otherwise a direct hit toggles twice and looks dead. */}
                        <Checkbox
                          checked={isAllRolesSelected}
                          className="pointer-events-none"
                          tabIndex={-1}
                        />
                        <span className="font-medium">All Roles</span>
                      </div>

                      <div className="my-2 border-t"></div>

                      {/* Individual Role Options */}
                      {availableRoles.map(role => (
                        <div
                          key={role._id}
                          className="flex items-center gap-2 p-2 hover:bg-row-hover rounded cursor-pointer"
                          onClick={() => handleRoleToggle(role._id)}
                        >
                          <Checkbox
                            checked={selectedRoles.includes(role._id)}
                            className="pointer-events-none"
                            tabIndex={-1}
                          />
                          <span>{role.renameRole}</span>
                        </div>
                      ))}
                      {availableRoles.length === 0 && (
                        <div className="p-2 text-faint text-center">No roles available</div>
                      )}
                    </div>
                    <div className="border-t p-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs"
                        onClick={() => setSelectedRoles([])}
                      >
                        Clear Roles
                      </Button>
                    </div>
                  </SelectContent>
                </Select>
              </div>

              {/* Batch Filter - shown next to Role when enabled */}
              {showBatchFilter && (
                <div className="w-full">
                  <Label className="text-xs font-medium text-gray-700 mb-1">Batch</Label>
                  <Select
                    value={selectedBatch}
                    onValueChange={setSelectedBatch}
                  >
                    <SelectTrigger className="text-xs h-8 cursor-pointer w-full">
                      <SelectValue placeholder="All Batches" />
                    </SelectTrigger>
                    <SelectContent className="text-xs cursor-pointer">
                      <SelectItem value="all">All Batches</SelectItem>
                      {availableBatches.map((batch) => (
                        <SelectItem key={batch} value={batch}>
                          {batch}
                        </SelectItem>
                      ))}
                      {availableBatches.length === 0 && (
                        <div className="p-2 text-gray-500 text-center text-xs">No batches available</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* College-specific filters */}
              {basedOn === 'college' && (
                <>
                  {/* Degree Filter */}
                  <div className="w-full">
                    <Label className="text-xs font-medium text-gray-700 mb-1">Degree</Label>
                    <Select
                      value={selectedDegree}
                      onValueChange={setSelectedDegree}
                    >
                      <SelectTrigger className="text-xs h-8 cursor-pointer w-full">
                        <SelectValue placeholder="All Degrees" />
                      </SelectTrigger>
                      <SelectContent className="text-xs cursor-pointer">
                        <SelectItem value="all">All Degrees</SelectItem>
                        {degreeOptions.map((degree) => (
                          <SelectItem key={degree} value={degree}>
                            {degree}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Department Filter */}
                  <div className="w-full">
                    <Label className="text-xs font-medium text-gray-700 mb-1">Department</Label>
                    <Select
                      value={selectedDepartment}
                      onValueChange={setSelectedDepartment}
                    >
                      <SelectTrigger className="text-xs h-8 cursor-pointer w-full">
                        <SelectValue placeholder="All Departments" />
                      </SelectTrigger>
                      <SelectContent className="text-xs cursor-pointer">
                        <SelectItem value="all">All Departments</SelectItem>
                        {departmentOptions.map((dept) => (
                          <SelectItem key={dept} value={dept}>
                            {dept}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Year Filter */}
                  <div className="w-full">
                    <Label className="text-xs font-medium text-gray-700 mb-1">Year</Label>
                    <Select
                      value={selectedYear}
                      onValueChange={setSelectedYear}
                    >
                      <SelectTrigger className="text-xs h-8 cursor-pointer w-full">
                        <SelectValue placeholder="All Years" />
                      </SelectTrigger>
                      <SelectContent className="text-xs cursor-pointer">
                        <SelectItem value="all">All Years</SelectItem>
                        {yearOptions.map((year) => (
                          <SelectItem key={year} value={year}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                </>
              )}
            </div>

            {/* Filter Actions — Reset lives in the header; filters apply the
                moment they change, so the footer only needs Done. Brand
                button color matches the Apply Filters button on the client
                module's filter panel. */}
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-hairline">
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                className="inline-flex items-center h-8 px-3.5 rounded-control bg-brand-strong text-white text-xs font-semibold shadow-xs hover:bg-brand-800 transition-colors duration-150"
              >
                Done
              </button>
            </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <div
        className={`rounded-md border ${fillHeight ? 'flex-1 min-h-0 overflow-y-auto custom-scrollbar' : ''}`}
      >
        <Table className="text-[12px] [&_th]:h-8 [&_th]:py-1 [&_th]:px-2 [&_td]:py-1.5 [&_td]:px-2">
          <TableHeader className={fillHeight ? '[&_th]:sticky [&_th]:top-0 [&_th]:bg-white [&_th]:z-10 [&_th]:shadow-[inset_0_-1px_0_0_rgb(229_231_235)]' : ''}>
            <TableRow>
              {showSelection && (
                <TableHead className="w-8">
                  <Checkbox
                    checked={isAllUsersSelected}
                    onCheckedChange={handleSelectAllUsers}
                    disabled={isLoading || filteredUsers.length === 0}
                    className="h-3.5 w-3.5"
                  />
                </TableHead>
              )}
              <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">User ID</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Name</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Email</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Role</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Status</TableHead>
              {showEnrolledOn && <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Enrolled On</TableHead>}
              {basedOn === 'college' && <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Batch</TableHead>}
              {showActions && <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({
                    length: (showSelection ? 1 : 0) +
                           (basedOn === 'college' ? 6 : 4) +
                           (showEnrolledOn ? 1 : 0) +
                           (showActions ? 1 : 0)
                  }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : paginatedUsers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={
                    (showSelection ? 1 : 0) +
                    (basedOn === 'college' ? 6 : 4) +
                    (showEnrolledOn ? 1 : 0) +
                    (showActions ? 1 : 0)
                  }
                  className="text-center py-8 text-gray-500"
                >
                  <div className="flex flex-col items-center gap-2">
                    <UserIcon className="h-8 w-8 text-gray-400" />
                    <p>{emptyMessage}</p>
                    <p className="text-sm text-gray-400">{emptyDescription}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedUsers.map((user) => {
                const enrollment = getEnrollmentForUser(user.id)
                
                return (
                  <TableRow key={user.id} className="hover:bg-gray-50">
                    {showSelection && (
                      <TableCell>
                        <Checkbox
                          checked={localSelectedUserIds.includes(user.id)}
                          onCheckedChange={() => handleUserSelect(user.id)}
                          className="h-3.5 w-3.5"
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <span className="text-[11px] font-mono font-medium text-gray-700">
                        {user.userId || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-6 w-6 rounded-full bg-indigo-100 flex items-center justify-center">
                          <span className="text-indigo-600 text-[11px] font-medium">
                            {user.firstName?.charAt(0).toUpperCase() || '?'}
                          </span>
                        </div>
                        <div className="ml-2 text-[12px] font-medium text-gray-900 truncate max-w-[160px]">
                          {user.firstName} {user.lastName}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <a
                        href={`mailto:${user.email}`}
                        className="flex items-center gap-1 text-[12px] text-blue-600 hover:underline"
                      >
                        <Mail className="h-3 w-3" />
                        <span className="truncate max-w-[160px]">{user.email}</span>
                      </a>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[11px] px-1.5 py-0 h-5">
                        {user.role || 'Unknown Role'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {enrollment ? (
                        onToggleStatus && (enrollment.status === 'active' || enrollment.status === 'suspended') ? (
                          // No text label: the Status header plus the switch's
                          // position and color already say it; the aria-label
                          // and tooltip carry it for screen readers and hover.
                          <Switch
                            checked={enrollment.status === 'active'}
                            disabled={isTogglingStatus}
                            onCheckedChange={(checked) =>
                              onToggleStatus(user.id, checked ? 'active' : 'suspended')}
                            aria-label={`${enrollment.status === 'active' ? 'Deactivate' : 'Activate'} ${user.firstName} ${user.lastName}`}
                            title={enrollment.status === 'active' ? 'Active — click to deactivate' : 'Inactive — click to activate'}
                            className="scale-75 origin-left data-[state=checked]:bg-emerald-500"
                          />
                        ) : (
                          getStatusBadge(enrollment.status)
                        )
                      ) : (
                        <Badge variant="secondary" className="bg-gray-100 text-gray-800 text-[11px] px-1.5 py-0 h-5">
                          Not Enrolled
                        </Badge>
                      )}
                    </TableCell>
                    {showEnrolledOn && (
                      <TableCell>
                        {enrollment?.createdAt ? (
                          <span
                            className="text-[12px] text-gray-700 tabular-nums whitespace-nowrap"
                            title={new Date(enrollment.createdAt).toLocaleString('en-IN')}
                          >
                            {new Date(enrollment.createdAt).toLocaleDateString('en-IN', {
                              day: '2-digit', month: 'short', year: 'numeric',
                            })}
                          </span>
                        ) : (
                          <span className="text-[12px] text-gray-400">—</span>
                        )}
                      </TableCell>
                    )}
                    {basedOn === 'college' && (
                      <TableCell>
                        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[11px] px-1.5 py-0 h-5">
                          {user.batch || 'N/A'}
                        </Badge>
                      </TableCell>
                    )}

                    {showActions && (
                      <TableCell>
                        <div className="flex gap-0.5">
                          {onViewUser && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => onViewUser(user)}
                              title="View Details"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {onSettingsUser && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => onSettingsUser(user)}
                              title="Enrollment Settings"
                            >
                              <Settings className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {onRemoveUser && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                              onClick={() => onRemoveUser(user.id)}
                              disabled={isRemoving}
                              title="Remove Participant"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={`flex items-center justify-between px-2 border-t ${fillHeight ? 'shrink-0 bg-white py-1' : 'py-2'}`}>
          <div className="text-[11px] text-gray-600">
            Showing <span className="font-medium">{startIndex + 1}</span>-
            <span className="font-medium">{Math.min(endIndex, totalUsers)}</span>
            {' '}of <span className="font-medium">{totalUsers}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[11px]"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Prev
            </Button>
            <div className="flex items-center gap-0.5">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = i + 1
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`h-7 w-7 p-0 text-[11px] ${currentPage === pageNum ? "bg-indigo-600 text-white" : ""}`}
                  >
                    {pageNum}
                  </Button>
                )
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[11px]"
              onClick={() => setCurrentPage(prev => prev + 1)}
              disabled={currentPage >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}