"use client"
import { getToken } from "@/lib/session";

import { useState, useEffect, useMemo } from 'react'
import { Search, Filter, ChevronDown, ChevronUp, X, Mail, Users, UserPlus, Trash2, Eye, Plus, UserMinus, ChevronRight, Crown, Edit } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { motion, AnimatePresence } from 'framer-motion'
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from 'sonner'
import { Toaster } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  createGroup, 
  getGroupsByCourse, 
  addUsersToGroup, 
  removeUsersFromGroup, 
  deleteGroup, 
  setGroupLeader,
  fetchGroupsCourseData, 
  removeGroupLeader
} from '@/app/lms/pages/usermanagement/api/userService'

interface GroupEnrollmentTabProps {
  courseId: string
}

type User = {
  id: string
  _id?: string
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

type Group = {
  id: string
  _id?: string
  groupName: string
  groupDescription?: string
  members: User[]
  groupLeader?: User | null
  status: string
  createdAt: string
  course: string
  institution: string
}
const showSuccessToast = (message: string) => {
  toast.success(message, {
    duration: 3000,
    position: "top-right",
    style: {
      background: '#10b981',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      padding: '12px 16px',
      fontSize: '14px',
      fontWeight: '500',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    },
    className: 'custom-toast-success',
  })
}

const showErrorToast = (message: string) => {
  toast.error(message, {
    duration: 4000,
    position: "top-right",
    style: {
      background: '#ef4444',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      padding: '12px 16px',
      fontSize: '14px',
      fontWeight: '500',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    },
    className: 'custom-toast-error',
  })
}

const showWarningToast = (message: string) => {
  toast.warning(message, {
    duration: 3000,
    position: "top-right",
    style: {
      background: '#f59e0b',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      padding: '12px 16px',
      fontSize: '14px',
      fontWeight: '500',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    },
    className: 'custom-toast-warning',
  })
}

export default function GroupEnrollmentTab({ courseId }: GroupEnrollmentTabProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [selectedGroup, setSelectedGroup] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
    const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false)
  const [isAddToGroupModalOpen, setIsAddToGroupModalOpen] = useState(false)
  const [selectedGroupForAction, setSelectedGroupForAction] = useState<Group | null>(null)
  const [selectedUsersToAdd, setSelectedUsersToAdd] = useState<string[]>([])
  
  const [showBulkRemoveConfirm, setShowBulkRemoveConfirm] = useState(false)
  const [showDeleteGroupConfirm, setShowDeleteGroupConfirm] = useState(false)
  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null)
  
  const [showSetLeaderModal, setShowSetLeaderModal] = useState(false)
  const [selectedUserForLeader, setSelectedUserForLeader] = useState<User | null>(null)
  const [showGroupDetailsModal, setShowGroupDetailsModal] = useState(false)
  const [selectedGroupForDetails, setSelectedGroupForDetails] = useState<Group | null>(null)
  const [selectedUsersToRemove, setSelectedUsersToRemove] = useState<string[]>([])
  
  const [modalSearchTerm, setModalSearchTerm] = useState('')
  const [modalDebouncedSearchTerm, setModalDebouncedSearchTerm] = useState('')
  const [modalShowFilters, setModalShowFilters] = useState(false)
  const [modalSelectedStatus, setModalSelectedStatus] = useState<string>('all')
  const [modalSelectedRole, setModalSelectedRole] = useState<string>('all')
  const [modalSelectedDegree, setModalSelectedDegree] = useState<string>('all')
  const [modalSelectedDepartment, setModalSelectedDepartment] = useState<string>('all')
  const [modalSelectedYear, setModalSelectedYear] = useState<string>('all')
  const [modalCurrentPage, setModalCurrentPage] = useState(1)
    const [newGroupName, setNewGroupName] = useState('')
  const [newGroupDescription, setNewGroupDescription] = useState('')

  const [token, setToken] = useState<string | null>(null)
  const [institutionId, setInstitutionId] = useState<string | null>(null)
  const [basedOn, setBasedOn] = useState<string | null>(null)
  const [showRemoveLeaderConfirm, setShowRemoveLeaderConfirm] = useState(false)

  const [openAddUsersAfterCreate, setOpenAddUsersAfterCreate] = useState(false)

  const queryClient = useQueryClient()
  const degreeOptions = ["B.Tech", "B.E", "B.Sc", "B.Com", "B.A", "M.Tech", "M.Sc", "MBA", "PhD"]
  const departmentOptions = ["Computer Science", "Electrical", "Mechanical", "Civil", "Electronics", "Information Technology", "Mathematics", "Physics", "Chemistry"]
  const yearOptions = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year"]
  
  const groupsPerPage = 10
  const modalUsersPerPage = 3

  useEffect(() => {
    const storedToken = getToken()
    const storedInstitutionId = localStorage.getItem('smartcliff_institution')
    const storedBasedOn = localStorage.getItem('smartcliff_basedOn')

    setToken(storedToken)
    setInstitutionId(storedInstitutionId)
    setBasedOn(storedBasedOn)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    const timer = setTimeout(() => {
      setModalDebouncedSearchTerm(modalSearchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [modalSearchTerm])

  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchTerm, selectedGroup])

  useEffect(() => {
    setModalCurrentPage(1)
  }, [modalDebouncedSearchTerm, modalSelectedStatus, modalSelectedRole, modalSelectedDegree, modalSelectedDepartment, modalSelectedYear])

  const { 
    data: courseData, 
    isLoading: isLoadingCourseData,
    refetch: refetchCourseData
  } = useQuery({
    queryKey: ['courseParticipantsForGroups', courseId, institutionId, token],
    queryFn: async () => {
      if (!token || !institutionId || !courseId) return { participants: [] }
      
      try {
        const data = await fetchGroupsCourseData(courseId, institutionId, token);
        
        return data;
      } catch (error) {
        console.error('Error fetching course participants:', error);
        throw error;
      }
    },
    enabled: !!token && !!institutionId && !!courseId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

const { 
  data: groupsData, 
  isLoading: isLoadingGroups, 
  refetch: refetchGroups 
} = useQuery({
  queryKey: ['courseGroups', courseId, institutionId, token],
  queryFn: async () => {
    if (!token || !institutionId || !courseId) return { groups: [] }
    
    try {
      const response = await getGroupsByCourse(courseId, institutionId, token);
      
      const transformedGroups: Group[] = (response.data || []).map((group: any) => ({
        id: group._id,
        _id: group._id,
        groupName: group.groupName,
        groupDescription: group.groupDescription || '',
        members: (group.members || []).map((member: any) => {
          let roleName = 'Unknown Role';
          
          if (member.role) {
            if (typeof member.role === 'string') {
              roleName = member.role;
            } else if (member.role.renameRole) {
              roleName = member.role.renameRole;
            } else if (member.role.name) {
              roleName = member.role.name;
            }
          }
          
          return {
            id: member._id,
            _id: member._id,
            firstName: member.firstName || '',
            lastName: member.lastName || '',
            email: member.email || '',
            phone: member.phone || '',
            role: roleName,
            roleId: member.role?._id || member.role || '',
            status: member.status || 'active',
            degree: member.degree || '',
            department: member.department || '',
            year: member.year || '',
            semester: member.semester || '',
            batch: member.batch || '',
            profile: member.profile || ''
          }
        }),
        groupLeader: group.groupLeader ? {
          id: group.groupLeader._id,
          _id: group.groupLeader._id,
          firstName: group.groupLeader.firstName || '',
          lastName: group.groupLeader.lastName || '',
          email: group.groupLeader.email || '',
          phone: group.groupLeader.phone || '',
          role: (() => {
            if (!group.groupLeader.role) return 'Unknown Role';
            if (typeof group.groupLeader.role === 'string') return group.groupLeader.role;
            if (group.groupLeader.role.renameRole) return group.groupLeader.role.renameRole;
            if (group.groupLeader.role.name) return group.groupLeader.role.name;
            return 'Unknown Role';
          })(),
          roleId: group.groupLeader.role?._id || group.groupLeader.role || '',
          status: group.groupLeader.status || 'active',
          degree: group.groupLeader.degree || '',
          department: group.groupLeader.department || '',
          year: group.groupLeader.year || '',
          semester: group.groupLeader.semester || '',
          batch: group.groupLeader.batch || '',
          profile: group.groupLeader.profile || ''
        } : null,
        status: group.status || 'active',
        createdAt: group.createdAt,
        course: group.course,
        institution: group.institution
      }));

      return { groups: transformedGroups };
    } catch (error) {
      console.error('Error fetching groups:', error);
      return { groups: [] };
    }
  },
  enabled: !!token && !!institutionId && !!courseId,
  refetchOnWindowFocus: false,
})

const transformedParticipants = useMemo(() => {
  const participants = courseData?.participants || [];
  const users: User[] = [];
  
  participants.forEach((enrollment: any) => {
    const user = enrollment.user || enrollment;
    
    let roleName = 'Unknown Role';
    let roleId = '';
    
    if (user.role) {
      if (typeof user.role === 'string') {
        roleName = user.role;
        roleId = user.role;
      } else if (user.role.renameRole) {
        roleName = user.role.renameRole;
        roleId = user.role._id;
      } else if (user.role.name) {
        roleName = user.role.name;
        roleId = user.role._id;
      } else {
        roleName = 'Unknown';
        roleId = user.role._id || '';
      }
    } else if (user.roleName) {
      roleName = user.roleName;
      roleId = user.roleId || '';
    }

    const userData: User = {
      id: user._id || user.id,
      _id: user._id,
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
      year: user.year || '',
      batch: user.batch || '',
      gender: user.gender || '',
      profile: user.profile || '',
      createdAt: user.createdAt || '',
      notes: user.notes || [],
      permission: user.permission || {}
    }
    
    users.push(userData);
  });
  
  return users;
}, [courseData?.participants])

  const availableRoles = useMemo(() => {
    const roles = new Set<string>();
    transformedParticipants.forEach(user => {
      if (user.role) {
        roles.add(user.role);
      }
    });
    return Array.from(roles).sort();
  }, [transformedParticipants])

  const { 
    data: availableUsersData, 
    isLoading: isLoadingAvailableUsers,
    refetch: refetchAvailableUsers 
  } = useQuery({
    queryKey: ['availableUsersForGroups', institutionId, token, basedOn, courseId, 
               modalDebouncedSearchTerm, modalSelectedStatus, modalSelectedRole,
               modalSelectedDegree, modalSelectedDepartment, modalSelectedYear,
               groupsData?.groups, transformedParticipants],
    queryFn: async () => {
      if (!token || !institutionId || !basedOn) {
        return { users: [], allUsers: [], pagination: null }
      }
      
      try {
        const allGroupMembers: User[] = [];
        groupsData?.groups.forEach(group => {
          allGroupMembers.push(...group.members);
        });
                const allGroupMemberIds = Array.from(new Set(
          allGroupMembers.map(member => member._id || member.id)
        ));
        const availableUsers = transformedParticipants.filter(user => {
          const userId = user._id || user.id
          const isInAnyGroup = allGroupMemberIds.includes(userId)
          
          return !isInAnyGroup
        })

        const filteredUsers = availableUsers.filter(user => {
          const matchesSearch = !modalDebouncedSearchTerm ||
            user.firstName.toLowerCase().includes(modalDebouncedSearchTerm.toLowerCase()) ||
            user.lastName.toLowerCase().includes(modalDebouncedSearchTerm.toLowerCase()) ||
            user.email.toLowerCase().includes(modalDebouncedSearchTerm.toLowerCase()) ||
            (user.phone && user.phone.includes(modalDebouncedSearchTerm)) ||
            (basedOn === 'college' && (
              (user.degree && user.degree.toLowerCase().includes(modalDebouncedSearchTerm.toLowerCase())) ||
              (user.department && user.department.toLowerCase().includes(modalDebouncedSearchTerm.toLowerCase())) ||
              (user.batch && user.batch.includes(modalDebouncedSearchTerm))
            ))

          const matchesStatus = !modalSelectedStatus || modalSelectedStatus === "all" || user.status === modalSelectedStatus
          const matchesRole = !modalSelectedRole || modalSelectedRole === "all" || user.role === modalSelectedRole

          const matchesDegree = !modalSelectedDegree || modalSelectedDegree === "all" || user.degree === modalSelectedDegree
          const matchesDepartment = !modalSelectedDepartment || modalSelectedDepartment === "all" || user.department === modalSelectedDepartment
          const matchesYear = !modalSelectedYear || modalSelectedYear === "all" || user.year === modalSelectedYear

          return matchesSearch && matchesStatus && matchesRole && matchesDegree && matchesDepartment && matchesYear
        })
                const modalStartIndex = (modalCurrentPage - 1) * modalUsersPerPage
        const modalEndIndex = modalStartIndex + modalUsersPerPage
        const modalPaginatedUsers = filteredUsers.slice(modalStartIndex, modalEndIndex)
        const modalTotalPages = Math.ceil(filteredUsers.length / modalUsersPerPage)

        return { 
          users: modalPaginatedUsers, 
          allUsers: filteredUsers,
          pagination: {
            currentPage: modalCurrentPage,
            totalPages: modalTotalPages,
            totalUsers: filteredUsers.length,
            hasNextPage: modalCurrentPage < modalTotalPages,
            hasPrevPage: modalCurrentPage > 1
          }
        };
      } catch (error) {
        console.error('Error fetching available users:', error);
        return { users: [], allUsers: [], pagination: null };
      }
    },
    enabled: !!token && !!institutionId && !!basedOn && !!isAddToGroupModalOpen,
    refetchOnWindowFocus: false,
  })
const removeGroupLeaderMutation = useMutation({
  mutationFn: async (groupId: string) => {
    if (!token || !institutionId) {
      throw new Error('Missing required data')
    }
    
    return await removeGroupLeader(groupId, institutionId, token)
  },
  onSuccess: (data) => {
    showSuccessToast(data.message || "Group leader removed successfully!")
        if (selectedGroupForDetails && selectedGroupForDetails.id === data.data?._id) {
      setSelectedGroupForDetails(prev => {
        if (!prev) return prev
        return {
          ...prev,
          groupLeader: null
        }
      })
    }
    
    setShowRemoveLeaderConfirm(false)
    refetchGroups()
    queryClient.invalidateQueries({ queryKey: ['courseGroups', courseId] })
  },
  onError: (error: any) => {
    showErrorToast(error.message || "Failed to remove group leader. Please try again.")
  }
})

const handleRemoveGroupLeader = () => {
  if (!selectedGroupForDetails) {
    showErrorToast("No group selected")
    return
  }
  
  if (!selectedGroupForDetails.groupLeader) {
    showWarningToast("This group has no leader")
    return
  }
  
  setShowRemoveLeaderConfirm(true)
}

const handleConfirmRemoveLeader = () => {
  if (!selectedGroupForDetails) return
  
  removeGroupLeaderMutation.mutate(selectedGroupForDetails.id)
}
  const filteredGroups = useMemo(() => {
    if (!groupsData?.groups) return [];
    
    return groupsData.groups.filter(group => {
      if (!debouncedSearchTerm) return true;
      
      const searchLower = debouncedSearchTerm.toLowerCase();
      return (
        group.groupName.toLowerCase().includes(searchLower) ||
        (group.groupDescription && group.groupDescription.toLowerCase().includes(searchLower))
      );
    });
  }, [groupsData?.groups, debouncedSearchTerm])

  const startIndex = (currentPage - 1) * groupsPerPage
  const endIndex = startIndex + groupsPerPage
  const paginatedGroups = filteredGroups.slice(startIndex, endIndex)
  const totalPages = Math.ceil(filteredGroups.length / groupsPerPage)

  const clearFilters = () => {
    setSelectedGroup('all')
    setSearchTerm('')
    setCurrentPage(1)
  }

  const clearModalFilters = () => {
    setModalSelectedStatus('all')
    setModalSelectedRole('all')
    setModalSelectedDegree('all')
    setModalSelectedDepartment('all')
    setModalSelectedYear('all')
    setModalSearchTerm('')
    setModalCurrentPage(1)
  }

  const hasActiveFilters = () => {
    return (
      selectedGroup !== 'all' ||
      searchTerm !== ''
    )
  }

  const hasModalActiveFilters = () => {
    return (
      modalSelectedStatus !== 'all' ||
      modalSelectedRole !== 'all' ||
      modalSelectedDegree !== 'all' ||
      modalSelectedDepartment !== 'all' ||
      modalSelectedYear !== 'all' ||
      modalSearchTerm !== ''
    )
  }

  const getModalBadgeData = () => {
    const badges: { label: string; type: string }[] = []
    
    if (modalSelectedStatus !== 'all') {
      badges.push({
        label: modalSelectedStatus,
        type: 'status'
      })
    }
    
    if (modalSelectedRole !== 'all') {
      badges.push({
        label: modalSelectedRole,
        type: 'role'
      })
    }
    
    if (modalSelectedDegree !== 'all') {
      badges.push({
        label: modalSelectedDegree,
        type: 'degree'
      })
    }
    
    if (modalSelectedDepartment !== 'all') {
      badges.push({
        label: modalSelectedDepartment,
        type: 'department'
      })
    }
    
    if (modalSelectedYear !== 'all') {
      badges.push({
        label: modalSelectedYear,
        type: 'year'
      })
    }
    
    return badges
  }

  const createGroupMutation = useMutation({
    mutationFn: async (groupData: { groupName: string; groupDescription: string }) => {
      if (!token || !institutionId || !courseId) {
        throw new Error('Missing required data')
      }
      
      return await createGroup(
        courseId, 
        groupData.groupName, 
        groupData.groupDescription, 
        institutionId, 
        token
      )
    },
    onSuccess: (data, variables) => {
      showSuccessToast(data.message || "Group created successfully!")
            const createdGroup = data.data || {}
      const newGroup: Group = {
        id: createdGroup._id || createdGroup.id,
        _id: createdGroup._id,
        groupName: variables.groupName,
        groupDescription: variables.groupDescription,
        members: [],
        groupLeader: null,
        status: 'active',
        createdAt: new Date().toISOString(),
        course: courseId,
        institution: institutionId || ''
      }
      
      setNewGroupName('')
      setNewGroupDescription('')
      refetchGroups()
      queryClient.invalidateQueries({ queryKey: ['courseGroups', courseId] })
      
      if (openAddUsersAfterCreate) {
        setSelectedGroupForAction(newGroup)
        setIsAddToGroupModalOpen(true)
        setOpenAddUsersAfterCreate(false)
      }
      
      setIsCreateGroupModalOpen(false)
    },
    onError: (error: any) => {
      showErrorToast(error.message || "Failed to create group. Please try again.")
      setOpenAddUsersAfterCreate(false)
    }
  })

 const addUsersToGroupMutation = useMutation({
  mutationFn: async ({ groupId, userIds }: { groupId: string; userIds: string[] }) => {
    if (!token || !institutionId) {
      throw new Error('Missing required data')
    }
    
    return await addUsersToGroup(groupId, userIds, institutionId, token)
  },
  onSuccess: (data, variables) => {
    showSuccessToast(data.message || "Users added to group successfully!")
        if (selectedGroupForDetails && selectedGroupForDetails.id === variables.groupId) {
      queryClient.invalidateQueries({ queryKey: ['courseGroups', courseId] })
    }
    
    setIsAddToGroupModalOpen(false)
    setSelectedUsersToAdd([])
    clearModalFilters()
    refetchGroups()
    refetchAvailableUsers()
    refetchCourseData()
    queryClient.invalidateQueries({ queryKey: ['courseGroups', courseId] })
    queryClient.invalidateQueries({ queryKey: ['courseParticipantsForGroups', courseId] })
  },
  onError: (error: any) => {
    showErrorToast(error.message || "Failed to add users to group. Please try again.")
  }
})

 const removeUsersFromGroupMutation = useMutation({
  mutationFn: async ({ groupId, userIds }: { groupId: string; userIds: string[] }) => {
    if (!token || !institutionId) {
      throw new Error('Missing required data')
    }
    
    return await removeUsersFromGroup(groupId, userIds, institutionId, token)
  },
  onSuccess: (data, variables) => {
    showSuccessToast(data.message || `${variables.userIds.length} user(s) removed from group successfully!`)
        if (selectedGroupForDetails && selectedGroupForDetails.id === variables.groupId) {
      setSelectedGroupForDetails(prev => {
        if (!prev) return prev
        return {
          ...prev,
          members: prev.members.filter(member => 
            !variables.userIds.includes(member.id || member._id || '')
          )
        }
      })
    }
    
    setSelectedUsersToRemove([])
    setShowBulkRemoveConfirm(false)
    refetchGroups()
    refetchCourseData()
    queryClient.invalidateQueries({ queryKey: ['courseGroups', courseId] })
    queryClient.invalidateQueries({ queryKey: ['courseParticipantsForGroups', courseId] })
  },
  onError: (error: any) => {
    showErrorToast(error.message || "Failed to remove users from group. Please try again.")
  }
})

  const deleteGroupMutation = useMutation({
    mutationFn: async (groupId: string) => {
      if (!token || !institutionId) {
        throw new Error('Missing required data')
      }
      
      return await deleteGroup(groupId, institutionId, token)
    },
    onSuccess: (data) => {
      showSuccessToast(data.message || "Group deleted successfully!")
      setShowDeleteGroupConfirm(false)
      setGroupToDelete(null)
      refetchGroups()
      refetchCourseData()
      queryClient.invalidateQueries({ queryKey: ['courseGroups', courseId] })
      queryClient.invalidateQueries({ queryKey: ['courseParticipantsForGroups', courseId] })
    },
    onError: (error: any) => {
      showErrorToast(error.message || "Failed to delete group. Please try again.")
      setShowDeleteGroupConfirm(false)
      setGroupToDelete(null)
    }
  })

 const setGroupLeaderMutation = useMutation({
  mutationFn: async ({ groupId, userId }: { groupId: string; userId: string }) => {
    if (!token || !institutionId) {
      throw new Error('Missing required data')
    }
    
    return await setGroupLeader(groupId, userId, institutionId, token)
  },
  onSuccess: (data, variables) => {
    showSuccessToast(data.message || "Group leader set successfully!")
        if (selectedGroupForDetails && selectedGroupForDetails.id === variables.groupId) {
      const newLeader = selectedGroupForDetails.members.find(
        member => member.id === variables.userId || member._id === variables.userId
      )
      
      if (newLeader) {
        setSelectedGroupForDetails(prev => {
          if (!prev) return prev
          return {
            ...prev,
            groupLeader: newLeader
          }
        })
      }
    }
    
    setShowSetLeaderModal(false)
    setSelectedUserForLeader(null)
    refetchGroups()
    queryClient.invalidateQueries({ queryKey: ['courseGroups', courseId] })
  },
  onError: (error: any) => {
    showErrorToast(error.message || "Failed to set group leader. Please try again.")
  }
})
useEffect(() => {
  if (selectedGroupForDetails && groupsData?.groups) {
    const updatedGroup = groupsData.groups.find(
      group => group.id === selectedGroupForDetails.id
    )
    if (updatedGroup) {
      setSelectedGroupForDetails(updatedGroup)
    }
  }
}, [groupsData?.groups, selectedGroupForDetails?.id])
  const handleCreateGroup = (openAddUsersModal: boolean = false) => {
    if (!newGroupName.trim()) {
      showErrorToast("Please enter a group name")
      return
    }
        setOpenAddUsersAfterCreate(openAddUsersModal)
    
    createGroupMutation.mutate({
      groupName: newGroupName,
      groupDescription: newGroupDescription
    })
  }

  const handleAddToGroup = (group: Group) => {
    setSelectedGroupForAction(group)
    setIsAddToGroupModalOpen(true)
    setSelectedUsersToAdd([])
    clearModalFilters()
    setModalCurrentPage(1)
    
    setTimeout(() => {
      refetchAvailableUsers()
    }, 100)
  }

  const handleViewGroupDetails = (group: Group) => {
    setSelectedGroupForDetails(group)
    setShowGroupDetailsModal(true)
    setSelectedUsersToRemove([])
  }

  const handleUserSelectionToggle = (userId: string) => {
    setSelectedUsersToAdd(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const handleModalSelectAllUsers = () => {
    if (!availableUsersData?.allUsers) return
    
    if (selectedUsersToAdd.length === availableUsersData.allUsers.length) {
      setSelectedUsersToAdd([])
    } else {
      const allUserIds = availableUsersData.allUsers.map(user => user.id)
      setSelectedUsersToAdd(allUserIds)
    }
  }

  const isAllModalUsersSelected = availableUsersData?.allUsers && 
    availableUsersData.allUsers.every(user => selectedUsersToAdd.includes(user.id))

  const handleSubmitUsersToGroup = () => {
    if (selectedUsersToAdd.length === 0) {
      showWarningToast("Please select at least one user to add")
      return
    }
    
    if (!selectedGroupForAction) {
      showErrorToast("No group selected")
      return
    }
    
    addUsersToGroupMutation.mutate({
      groupId: selectedGroupForAction.id,
      userIds: selectedUsersToAdd
    })
  }

  const handleDeleteGroup = (group: Group) => {
    setGroupToDelete(group)
    setShowDeleteGroupConfirm(true)
  }

  const handleConfirmDeleteGroup = () => {
    if (!groupToDelete) return
    
    deleteGroupMutation.mutate(groupToDelete.id)
  }

  const handleBulkRemove = (userIds: string[]) => {
    if (!selectedGroupForDetails) return
    
    setSelectedUsersToRemove(userIds)
    setShowBulkRemoveConfirm(true)
  }

  const handleConfirmBulkRemove = () => {
    if (selectedUsersToRemove.length === 0 || !selectedGroupForDetails) return
    
    removeUsersFromGroupMutation.mutate({
      groupId: selectedGroupForDetails.id,
      userIds: selectedUsersToRemove
    })
  }

  const handleSetGroupLeader = (user: User) => {
    if (!selectedGroupForDetails) {
      showErrorToast("No group selected")
      return
    }
    
    setSelectedUserForLeader(user)
    setShowSetLeaderModal(true)
  }

const handleConfirmSetLeader = () => {
  if (!selectedUserForLeader || !selectedGroupForDetails) return
  
  setGroupLeaderMutation.mutate({
    groupId: selectedGroupForDetails.id,
    userId: selectedUserForLeader.id || selectedUserForLeader._id || ''
  })
}

  const getInitials = (firstName: string, lastName: string) => {
    const first = firstName?.charAt(0) || ''
    const last = lastName?.charAt(0) || ''
    return `${first}${last}`.toUpperCase() || '?'
  }

  return (
    <div className="space-y-4 relative">
      {/* Header with Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="px-3 py-1">
            {groupsData?.groups.length || 0} Groups
          </Badge>
          <Badge variant="outline" className="px-3 py-1 bg-blue-50 text-blue-700">
            {groupsData?.groups.reduce((total, group) => total + group.members.length, 0) || 0} Total Participants
          </Badge>
          <Badge variant="outline" className="px-3 py-1 bg-green-50 text-green-700">
            {transformedParticipants.length} Total Enrolled Users
          </Badge>
        </div>
        
        <div className="flex gap-2">
          <Button 
            size="sm" 
            className="gap-2 bg-indigo-600 hover:bg-indigo-700"
            onClick={() => setIsCreateGroupModalOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Create Group
          </Button>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search groups..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2"
              >
                <X className="h-4 w-4 text-gray-400" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Groups Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Group Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingGroups ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                </TableRow>
              ))
            ) : paginatedGroups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="h-8 w-8 text-gray-400" />
                    <p>No groups found</p>
                    <p className="text-sm text-gray-400">
                      Try creating a group or adjusting your search
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedGroups.map((group) => (
                <TableRow key={group.id} className="hover:bg-gray-50">
                  <TableCell className="font-medium">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                        <Users className="h-4 w-4 text-indigo-600" />
                      </div>
                      <div className="ml-2">
                        <div className="text-sm font-medium text-gray-900">
                          {group.groupName}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-gray-600 max-w-[200px] truncate">
                      {group.groupDescription || 'No description'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                      {group.members.length} members
                    </Badge>
                  </TableCell>
                
                  <TableCell>
                    <Badge 
                      variant="outline"
                      className={
                        group.status === 'active' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-gray-50 text-gray-600 border-gray-200'
                      }
                    >
                      {group.status ? group.status.charAt(0).toUpperCase() + group.status.slice(1) : 'Unknown'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-xs h-7"
                        onClick={() => handleViewGroupDetails(group)}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View Users
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => handleAddToGroup(group)}
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                        onClick={() => handleDeleteGroup(group)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <div className="text-sm text-gray-700">
            Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
            <span className="font-medium">{Math.min(endIndex, filteredGroups.length)}</span>{' '}
            of <span className="font-medium">{filteredGroups.length}</span> groups
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = i + 1
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    className={currentPage === pageNum ? "bg-indigo-600 text-white" : ""}
                  >
                    {pageNum}
                  </Button>
                )
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => prev + 1)}
              disabled={currentPage >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      <Dialog open={isCreateGroupModalOpen} onOpenChange={setIsCreateGroupModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Group</DialogTitle>
            <DialogDescription>
              Create a new group for organizing course participants.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="group-name">Group Name  <span style={{color:"red"}}>* </span></Label>
              <Input
                id="group-name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="e.g., MERN Stack Group"
              />
            </div>
            
            <div>
              <Label htmlFor="group-description">Description (Optional)</Label>
              <Input
                id="group-description"
                value={newGroupDescription}
                onChange={(e) => setNewGroupDescription(e.target.value)}
                placeholder="Brief description of the group"
              />
            </div>
          </div>
          
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateGroupModalOpen(false)
                setNewGroupName('')
                setNewGroupDescription('')
              }}
              disabled={createGroupMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleCreateGroup(false)}
              disabled={!newGroupName.trim() || createGroupMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {createGroupMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating...
                </>
              ) : (
                'Create Group'
              )}
            </Button>
            <Button
              onClick={() => handleCreateGroup(true)}
              disabled={!newGroupName.trim() || createGroupMutation.isPending}
              variant="secondary"
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Create & Add Users
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Group Details Modal - Shows all users in the group */}
      <Dialog open={showGroupDetailsModal} onOpenChange={setShowGroupDetailsModal}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="shrink-0 p-6 pb-1 border-b">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  {selectedGroupForDetails?.groupName}
                  {selectedGroupForDetails?.groupLeader && (
                    <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700">
                      <Crown className="h-3 w-3 mr-1" />
                      Leader: {selectedGroupForDetails.groupLeader.firstName} {selectedGroupForDetails.groupLeader.lastName}
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription>
                  {selectedGroupForDetails?.members.length || 0} members in this group
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                {selectedGroupForDetails?.groupLeader && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveGroupLeader}
                    className="text-yellow-600 hover:text-yellow-700 border-yellow-300 hover:bg-yellow-50"
                  >
                    <Crown className="h-4 w-4 mr-2" />
                    Remove Leader
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (selectedGroupForDetails) {
                      handleAddToGroup(selectedGroupForDetails)
                      setShowGroupDetailsModal(false)
                    }
                  }}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add More Users
                </Button>
              </div>
            </div>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto p-6">
            {/* Bulk Actions Bar */}
            {selectedUsersToRemove.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-md mb-4"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="px-3 py-1">
                    {selectedUsersToRemove.length} selected
                  </Badge>
                  <span className="text-sm text-blue-700">
                    {selectedUsersToRemove.length} user(s) selected for removal
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleBulkRemove(selectedUsersToRemove)}
                    disabled={removeUsersFromGroupMutation.isPending}
                    className="gap-2"
                  >
                    <UserMinus className="h-4 w-4" />
                    Remove from Group ({selectedUsersToRemove.length})
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Users Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedUsersToRemove.length === (selectedGroupForDetails?.members.length || 0) && (selectedGroupForDetails?.members.length || 0) > 0}
                        onCheckedChange={() => {
                          if (!selectedGroupForDetails) return
                          
                          if (selectedUsersToRemove.length === selectedGroupForDetails.members.length) {
                              setSelectedUsersToRemove([])
                            } else {
                              const allUserIds = selectedGroupForDetails.members
                                .map(user => user.id || user._id)
                                .filter((id): id is string => !!id)
                              setSelectedUsersToRemove(allUserIds)
                            }
                        }}
                        disabled={(selectedGroupForDetails?.members.length || 0) === 0}
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    {/* Conditional columns for college mode */}
                    {basedOn === 'college' && <TableHead>Degree</TableHead>}
                    {basedOn === 'college' && <TableHead>Department</TableHead>}
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!selectedGroupForDetails || selectedGroupForDetails.members.length === 0 ? (
                    <TableRow>
                      <TableCell 
                        colSpan={basedOn === 'college' ? 8 : 6} 
                        className="text-center py-8 text-gray-500"
                      >
                        <div className="flex flex-col items-center gap-2">
                          <Users className="h-8 w-8 text-gray-400" />
                          <p>No users in this group</p>
                          <p className="text-sm text-gray-400">
                            Add users to get started
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    selectedGroupForDetails.members.map((user) => {
                    const isGroupLeader = selectedGroupForDetails?.groupLeader?.id === user.id || 
                     selectedGroupForDetails?.groupLeader?._id === user._id;
                      
                      return (
                        <TableRow key={`${user.id}-${user._id || 'no-id'}`} className="hover:bg-gray-50">
                          <TableCell>
                            <Checkbox
                              checked={selectedUsersToRemove.includes(user.id || user._id || '')}
                              onCheckedChange={() => {
                                const userId = user.id || user._id || ''
                                if (!userId) return
                                setSelectedUsersToRemove(prev =>
                                  prev.includes(userId)
                                    ? prev.filter(id => id !== userId)
                                    : [...prev, userId]
                                )
                              }}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={user.profile} alt={`${user.firstName} ${user.lastName}`} />
                                <AvatarFallback>{getInitials(user.firstName, user.lastName)}</AvatarFallback>
                              </Avatar>
                              <div className="ml-2">
                                <div className="flex items-center gap-1">
                                  <div className="text-sm font-medium text-gray-900">
                                    {user.firstName} {user.lastName}
                                  </div>
                                  {isGroupLeader && (
                                    <Crown className="h-3 w-3 text-yellow-500" />
                                  )}
                                </div>
                                <div className="text-xs text-gray-500">{user.phone || 'No phone'}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <a 
                              href={`mailto:${user.email}`}
                              className="flex items-center gap-1 text-blue-600 hover:underline"
                            >
                              <Mail className="h-3 w-3" />
                              <span className="truncate max-w-[150px]">{user.email}</span>
                            </a>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-purple-50 text-purple-700">
                              {user.role || 'Unknown'}
                            </Badge>
                          </TableCell>
                          {/* Conditional columns for college mode */}
                          {basedOn === 'college' && (
                            <TableCell>
                              <div className="text-sm">{user.degree || '-'}</div>
                            </TableCell>
                          )}
                          {basedOn === 'college' && (
                            <TableCell>
                              <Badge variant="outline" className="bg-gray-50">
                                {user.department || 'N/A'}
                              </Badge>
                            </TableCell>
                          )}
                          <TableCell>
                            <Badge 
                              variant={user.status === 'active' ? 'default' : 'secondary'}
                              className={
                                user.status === 'active' 
                                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100'
                                  : 'bg-gray-100 text-gray-800 hover:bg-gray-100'
                              }
                            >
                              {user.status ? user.status.charAt(0).toUpperCase() + user.status.slice(1) : 'Unknown'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {isGroupLeader ? (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="text-xs h-7 text-red-600 hover:text-red-700"
                                  onClick={handleRemoveGroupLeader}
                                >
                                  <Crown className="h-3 w-3 mr-1" />
                                  Remove as Leader
                                </Button>
                              ) : (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="text-xs h-7 text-yellow-600 hover:text-yellow-700"
                                  onClick={() => handleSetGroupLeader(user)}
                                >
                                  <Crown className="h-3 w-3 mr-1" />
                                  Make Leader
                                </Button>
                              )}
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-red-600 hover:text-red-700 text-xs h-7"
                                onClick={() => handleBulkRemove([user.id || user._id || ''])}
                              >
                                Remove
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          
          <DialogFooter className="shrink-0 border-t p-6 pt-4 bg-white">
            <div className="flex items-center justify-between w-full">
              <div className="text-sm text-gray-600">
                {selectedGroupForDetails?.members.length || 0} user(s) in this group
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowGroupDetailsModal(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Users to Group Modal */}
      <Dialog 
        open={isAddToGroupModalOpen} 
        onOpenChange={(open) => {
          setIsAddToGroupModalOpen(open)
          if (!open) {
            setSelectedUsersToAdd([])
            clearModalFilters()
            setSelectedGroupForAction(null)
          }
        }}
      >        
        <DialogContent className="flex flex-col max-w-7xl h-[95vh] overflow-hidden p-0">
          <DialogHeader className="shrink-0 p-6 pb-1">
            <DialogTitle>
              Add Users to {selectedGroupForAction?.groupName}
            </DialogTitle>
            <DialogDescription>
              Select enrolled users to add to this group. Only users not already in the group are shown.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 min-h-0 overflow-hidden px-6">
            <div className="h-full flex flex-col">
              {/* Modal Search and Filter Controls */}
              <div className="mb-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder={
                        basedOn === 'college' 
                          ? "Search name, email, role, degree, department..." 
                          : "Search name, email, role..."
                      }
                      value={modalSearchTerm}
                      onChange={(e) => setModalSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                    {modalSearchTerm && (
                      <button
                        onClick={() => setModalSearchTerm('')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2"
                      >
                        <X className="h-4 w-4 text-gray-400" />
                      </button>
                    )}
                  </div>
                  
                  <Button
                    variant={hasModalActiveFilters() ? "default" : "outline"}
                    onClick={() => setModalShowFilters(!modalShowFilters)}
                    className="gap-2"
                  >
                    <Filter className="h-4 w-4" />
                    Filters
                    {hasModalActiveFilters() ? (
                      <span>({getModalBadgeData().length})</span>
                    ) : null}
                    {modalShowFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>

                {/* Modal Active Filter Badges */}
                {hasModalActiveFilters() && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-gray-50 rounded-md">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-gray-700">Active Filters:</span>
                        {getModalBadgeData().map(badge => (
                          <Badge
                            key={`${badge.type}-${badge.label}`}
                            variant="secondary"
                            className="flex items-center gap-1 text-xs"
                          >
                            {badge.label}
                            <button
                              onClick={() => {
                                if (badge.type === 'status') {
                                  setModalSelectedStatus('all')
                                } else if (badge.type === 'role') {
                                  setModalSelectedRole('all')
                                } else if (badge.type === 'degree') {
                                  setModalSelectedDegree('all')
                                } else if (badge.type === 'department') {
                                  setModalSelectedDepartment('all')
                                } else if (badge.type === 'year') {
                                  setModalSelectedYear('all')
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
                        onClick={clearModalFilters}
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 text-gray-600 hover:text-red-600"
                      >
                        Clear All
                      </Button>
                    </div>
                  </motion.div>
                )}

                {/* Modal Expandable Filter Panel */}
                <AnimatePresence>
                  {modalShowFilters && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-gray-900">Filter Users</h3>
                        <Button
                          onClick={() => setModalShowFilters(false)}
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Status Filter */}
                        <div className="w-full">
                          <Label className="text-xs font-medium text-gray-700 mb-1">Status</Label>
                          <Select
                            value={modalSelectedStatus}
                            onValueChange={setModalSelectedStatus}
                          >
                            <SelectTrigger className="text-xs h-8 cursor-pointer w-full">
                              <SelectValue placeholder="All Statuses" />
                            </SelectTrigger>
                            <SelectContent className="text-xs cursor-pointer">
                              <SelectItem value="all">All Statuses</SelectItem>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Role Filter */}
                        <div className="w-full">
                          <Label className="text-xs font-medium text-gray-700 mb-1">Role</Label>
                          <Select
                            value={modalSelectedRole}
                            onValueChange={setModalSelectedRole}
                          >
                            <SelectTrigger className="text-xs h-8 cursor-pointer w-full">
                              <SelectValue placeholder="All Roles" />
                            </SelectTrigger>
                            <SelectContent className="text-xs cursor-pointer">
                              <SelectItem value="all">All Roles</SelectItem>
                              {availableRoles.map((role) => (
                                <SelectItem key={role} value={role}>
                                  {role}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* College-specific filters */}
                        {basedOn === 'college' && (
                          <>
                            {/* Degree Filter */}
                            <div className="w-full">
                              <Label className="text-xs font-medium text-gray-700 mb-1">Degree</Label>
                              <Select
                                value={modalSelectedDegree}
                                onValueChange={setModalSelectedDegree}
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
                                value={modalSelectedDepartment}
                                onValueChange={setModalSelectedDepartment}
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
                          </>
                        )}
                      </div>

                      {/* College-specific year filter */}
                      {basedOn === 'college' && (
                        <div className="mt-4">
                          <Label className="text-xs font-medium text-gray-700 mb-1">Year</Label>
                          <Select
                            value={modalSelectedYear}
                            onValueChange={setModalSelectedYear}
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
                      )}

                      {/* Filter Actions */}
                      <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                        <Button
                          onClick={clearModalFilters}
                          variant="outline"
                          size="sm"
                          className="text-xs h-8"
                        >
                          Clear Filters
                        </Button>
                        <Button
                          onClick={() => setModalShowFilters(false)}
                          variant="default"
                          size="sm"
                          className="text-xs h-8 bg-indigo-600 hover:bg-indigo-700"
                        >
                          Apply Filters
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Users Table */}
              <div className="flex-1 overflow-auto">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={isAllModalUsersSelected}
                            onCheckedChange={handleModalSelectAllUsers}
                            disabled={isLoadingAvailableUsers || !availableUsersData?.allUsers?.length}
                          />
                        </TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        {/* Conditional columns for college mode */}
                        {basedOn === 'college' && <TableHead>Degree</TableHead>}
                        {basedOn === 'college' && <TableHead>Department</TableHead>}
                        {basedOn === 'college' && <TableHead>Year</TableHead>}
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingAvailableUsers ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i}>
                            <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                            {/* Conditional skeleton columns for college mode */}
                            {basedOn === 'college' && <TableCell><Skeleton className="h-4 w-20" /></TableCell>}
                            {basedOn === 'college' && <TableCell><Skeleton className="h-4 w-20" /></TableCell>}
                            {basedOn === 'college' && <TableCell><Skeleton className="h-4 w-16" /></TableCell>}
                            <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                          </TableRow>
                        ))
                      ) : availableUsersData?.users.length === 0 ? (
                        <TableRow>
                          <TableCell 
                            colSpan={basedOn === 'college' ? 8 : 5} 
                            className="text-center py-8 text-gray-500"
                          >
                            <div className="flex flex-col items-center gap-2">
                              <Users className="h-8 w-8 text-gray-400" />
                              <p>No enrolled users available</p>
                              <p className="text-sm text-gray-400">
                                {hasModalActiveFilters() 
                                  ? "Try adjusting your filters" 
                                  : "All enrolled users are already in this group"}
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        availableUsersData?.users.map((user) => (
                          <TableRow key={user.id} className="hover:bg-gray-50">
                            <TableCell>
                              <Checkbox
                                checked={selectedUsersToAdd.includes(user.id)}
                                onCheckedChange={() => handleUserSelectionToggle(user.id)}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                                  <span className="text-indigo-600 text-sm font-medium">
                                    {user.firstName?.charAt(0).toUpperCase() || '?'}
                                  </span>
                                </div>
                                <div className="ml-2">
                                  <div className="text-sm font-medium text-gray-900">
                                    {user.firstName} {user.lastName}
                                  </div>
                                  <div className="text-xs text-gray-500">{user.phone || 'No phone'}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <a 
                                href={`mailto:${user.email}`}
                                className="flex items-center gap-1 text-blue-600 hover:underline"
                              >
                                <Mail className="h-3 w-3" />
                                <span className="truncate max-w-[150px]">{user.email}</span>
                              </a>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-purple-50 text-purple-700">
                                {user.role || 'Unknown'}
                              </Badge>
                            </TableCell>
                            {/* Conditional columns for college mode */}
                            {basedOn === 'college' && (
                              <TableCell>
                                <div className="text-sm">{user.degree || '-'}</div>
                              </TableCell>
                            )}
                            {basedOn === 'college' && (
                              <TableCell>
                                <Badge variant="outline" className="bg-gray-50 text-xs">
                                  {user.department || 'N/A'}
                                </Badge>
                              </TableCell>
                            )}
                            {basedOn === 'college' && (
                              <TableCell>
                                <div className="text-sm">{user.year || '-'}</div>
                              </TableCell>
                            )}
                            <TableCell>
                              <Badge 
                                variant={user.status === 'active' ? 'default' : 'secondary'}
                                className={
                                  user.status === 'active' 
                                    ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100'
                                    : 'bg-gray-100 text-gray-800 hover:bg-gray-100'
                                }
                              >
                                {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Modal Pagination */}
                {availableUsersData?.pagination && availableUsersData.pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <div className="text-sm text-gray-700">
                      Showing <span className="font-medium">{(modalCurrentPage - 1) * modalUsersPerPage + 1}</span> to{' '}
                      <span className="font-medium">
                        {Math.min(modalCurrentPage * modalUsersPerPage, availableUsersData.pagination.totalUsers || 0)}
                      </span>{' '}
                      of <span className="font-medium">{availableUsersData.pagination.totalUsers}</span> users
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setModalCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={!availableUsersData.pagination.hasPrevPage}
                      >
                        Previous
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, availableUsersData.pagination.totalPages) }, (_, i) => {
                          const pageNum = i + 1
                          return (
                            <Button
                              key={pageNum}
                              variant={modalCurrentPage === pageNum ? "default" : "outline"}
                              size="sm"
                              onClick={() => setModalCurrentPage(pageNum)}
                              className={modalCurrentPage === pageNum ? "bg-indigo-600 text-white" : ""}
                            >
                              {pageNum}
                            </Button>
                          )
                        })}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setModalCurrentPage(prev => prev + 1)}
                        disabled={!availableUsersData.pagination.hasNextPage}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t p-6 pt-4 bg-white">
            <div className="flex items-center justify-between w-full">
              <div className="text-sm text-gray-600">
                {selectedUsersToAdd.length} user(s) selected
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAddToGroupModalOpen(false)
                    clearModalFilters()
                  }}
                  disabled={addUsersToGroupMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitUsersToGroup}
                  disabled={selectedUsersToAdd.length === 0 || addUsersToGroupMutation.isPending}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {addUsersToGroupMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Adding...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add Selected ({selectedUsersToAdd.length})
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Remove Confirmation Dialog */}
      <Dialog open={showBulkRemoveConfirm} onOpenChange={setShowBulkRemoveConfirm}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Remove Users from Group
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {selectedUsersToRemove.length} user(s) from {selectedGroupForDetails?.groupName || 'the group'}? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowBulkRemoveConfirm(false)}
              disabled={removeUsersFromGroupMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmBulkRemove}
              disabled={removeUsersFromGroupMutation.isPending}
            >
              {removeUsersFromGroupMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Removing...
                </>
              ) : (
                `Remove ${selectedUsersToRemove.length} Users`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Group Confirmation Dialog */}
      <Dialog open={showDeleteGroupConfirm} onOpenChange={setShowDeleteGroupConfirm}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Delete Group
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the group <span className="font-semibold">{groupToDelete?.groupName}</span>? 
              This will remove all {groupToDelete?.members.length || 0} members from the group and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteGroupConfirm(false)
                setGroupToDelete(null)
              }}
              disabled={deleteGroupMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDeleteGroup}
              disabled={deleteGroupMutation.isPending}
            >
              {deleteGroupMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Deleting...
                </>
              ) : (
                'Delete Group'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set Group Leader Confirmation Dialog */}
      <Dialog open={showSetLeaderModal} onOpenChange={setShowSetLeaderModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-yellow-600">
              <Crown className="h-5 w-5" />
              Set Group Leader
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to set <span className="font-semibold">{selectedUserForLeader?.firstName} {selectedUserForLeader?.lastName}</span> as the group leader for {selectedGroupForDetails?.groupName}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowSetLeaderModal(false)}
              disabled={setGroupLeaderMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSetLeader}
              disabled={setGroupLeaderMutation.isPending}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              {setGroupLeaderMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Setting...
                </>
              ) : (
                'Set as Leader'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
 <Dialog open={showRemoveLeaderConfirm} onOpenChange={setShowRemoveLeaderConfirm}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-yellow-600">
              <Crown className="h-5 w-5" />
              Remove Group Leader
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to remove <span className="font-semibold">
                {selectedGroupForDetails?.groupLeader?.firstName} {selectedGroupForDetails?.groupLeader?.lastName}
              </span> as the group leader for {selectedGroupForDetails?.groupName}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowRemoveLeaderConfirm(false)}
              disabled={removeGroupLeaderMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmRemoveLeader}
              disabled={removeGroupLeaderMutation.isPending}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              {removeGroupLeaderMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Removing...
                </>
              ) : (
                'Remove Leader'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Toaster Component - This makes toasts visible */}
      <Toaster 
        position="top-right"
        richColors
        closeButton
        expand={false}
        duration={3000}
        visibleToasts={3}
        toastOptions={{
          style: {
            borderRadius: '8px',
            fontSize: '14px',
          },
          className: 'sonner-toast',
        }}
      />
    </div>
  )
}