"use client";
import { getToken } from "@/lib/session";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Loading } from "@/components/loading-ui/loading";
import {
  Plus,
  Loader2,
  Briefcase,
  UserCheck,
  Handshake,
  ClipboardList,
  ShieldCheck,
  GraduationCap,
  Filter,
  KeyRound,
  FileSpreadsheet,
  Download,
  Search,
  MoreHorizontal,
  Users,
  SearchX,
  Trash2,
  X,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import DashboardLayout from "../../component/layout";
import { StaffLayout } from "../../component/stafflayout/staff-layout";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addUser, deleteUser, toggleUserStatus, updateUser, bulkSetUserStatus, fetchUsersForExport } from "@/apiServices/userService";
import { Switch } from "@/components/ui/switch";
import { userPermission } from "@/apiServices/tokenVerify";
import { useUsersPageQuery, useUsersListQuery, useRolesQuery, transformUser } from "@/queries/users";
import { queryKeys } from "@/lib/queryKeys";
import { API_BASE_URL } from "@/lib/http";

// Shared design kit
import { EmptyState, Modal, pageEnter } from "../../shared/ui";
import TableFooter from "../../shared/listing/TableFooter";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

// Local components
import { UserModals } from "./components/UserModals";
import BulkUserModal from "./components/BulkUserModal";
import { RowActionsMenu, rowHasAnyAction } from "./components/RowActionsMenu";
import { UsersTable } from "./components/UsersTable";
import { UserFilterPanel } from "./components/UserFilterPanel";
import { hasPermission } from "./components/permissions";
import { User, Role, UserFormData, ApiPermission } from "./components/types";
import { defaultPermissionsForRole } from "@/config/permissions.helpers";

// Pull the human-readable message out of a backend error response. The API
// returns { message: [{ key, value }] } (or sometimes a plain string), so try
// those shapes before falling back to a generic message.
const getApiErrorMessage = (error: any, fallback: string): string => {
  const data = error?.response?.data;
  const msg = data?.message;
  if (Array.isArray(msg) && msg[0]?.value) return msg[0].value;
  if (typeof msg === 'string' && msg.trim()) return msg;
  if (typeof data?.error === 'string' && data.error.trim()) return data.error;
  return fallback;
};

function getRoleIcon(roleName: string) {
  const lowerRole = roleName.toLowerCase();
  if (lowerRole.includes('lms')) return ShieldCheck;
  if (lowerRole.includes('manager')) return Briefcase;
  if (lowerRole.includes('hr')) return UserCheck;
  if (lowerRole.includes('poc')) return Handshake;
  if (lowerRole.includes('coordinator')) return ClipboardList;
  if (lowerRole.includes('student')) return GraduationCap;
  return ShieldCheck;
}

// Icon tint per role for the advanced-filter MultiSelect options (token colors).
function getRoleColor(roleName: string) {
  const lowerRole = roleName.toLowerCase();
  if (lowerRole.includes('lms')) return "text-brand-strong";
  if (lowerRole.includes('manager')) return "text-info-700";
  if (lowerRole.includes('hr')) return "text-danger-700";
  if (lowerRole.includes('poc')) return "text-warn-700";
  if (lowerRole.includes('coordinator')) return "text-warn-700";
  if (lowerRole.includes('student')) return "text-success-700";
  return "text-subtle";
}

// Constants - All fields available for all users
const degreeOptions = ["B.Tech", "B.E", "B.Sc", "B.Com", "B.A", "M.Tech", "M.Sc", "MBA", "PhD"];
const departmentOptions = ["Computer Science", "Electrical", "Mechanical", "Civil", "Electronics", "Information Technology", "Mathematics", "Physics", "Chemistry"];
const yearOptions = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year"];

const BULK_BTN_BASE =
  "h-7 px-2.5 rounded-full text-xs font-medium disabled:opacity-40 disabled:hover:bg-transparent " +
  "disabled:cursor-not-allowed transition-colors duration-150";
const BULK_BAR_BTN = `${BULK_BTN_BASE} text-white/90 hover:bg-white/10 hover:text-white`;
const BULK_BAR_BTN_DANGER = `${BULK_BTN_BASE} text-danger-500 hover:bg-danger-500/15`;

export default function UserManagementPage() {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [newUserId, setNewUserId] = useState("");
  const [createdUser, setCreatedUser] = useState<User | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<Record<string, boolean>>({});
  const [token, setToken] = useState<string | null>(null);
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [basedOn, setBasedOn] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<ApiPermission[]>([]);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(true);
  const [canAddUser, setCanAddUser] = useState(false);
  const [canBulkUpload, setCanBulkUpload] = useState(false);
  const [canBulkPermission, setCanBulkPermission] = useState(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [showBulkUserModal, setShowBulkUserModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [selectedUserForPermission, setSelectedUserForPermission] = useState<User | null>(null);
  const [showBulkPermissionModal, setShowBulkPermissionModal] = useState(false);
  const [selectedUserForBulkPermissions, setSelectedUserForBulkPermissions] = useState<User | null>(null);
  const [showViewDetailsModal, setShowViewDetailsModal] = useState(false);
  const [selectedUserForDetails, setSelectedUserForDetails] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedDegree, setSelectedDegree] = useState<string>("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedBatch, setSelectedBatch] = useState<string>("");

  // Add loading state for form submission
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Table UX state (selection, sorting, layout, page size)
  //
  // Selection keeps the ROW, not just the id: it spans pages, and with the
  // directory paginated the rows for other pages are no longer in memory —
  // bulk actions and "Export selected" both need the user objects themselves.
  const [selectedRows, setSelectedRows] = useState<Record<string, User>>({});
  const selectedIds = useMemo(() => Object.keys(selectedRows), [selectedRows]);
  const [sortKey, setSortKey] = useState<string>("");
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  // A FIXED 10 rows per page.
  //
  // This used to default to 25 and then auto-fit to the wrapper's height, so
  // the row count changed with the window and no two screens showed the same
  // page. A stable, predictable page is worth more here than filling every
  // pixel — "page 3" should mean the same 10 users on a laptop and a monitor.
  // The footer's page-size control still overrides it per session.
  const [pageSize, setPageSize] = useState(10);
  const tableCardRef = useRef<HTMLDivElement | null>(null);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const [newUser, setNewUser] = useState<UserFormData>({
    id: "", firstName: "", lastName: "", email: "", phone: "", password: "",
    role: "Student", roleId: "", status: "active", gender: "Male",
    degree: "", department: "", semester: "", year: "", batch: "",
    phase: "", serviceModel: "", rollNumber: "",
    studentType: "",
    clientId: "",
    clientName: "",
  });

  const queryClient = useQueryClient();

  // Fetch user role and permissions
  useEffect(() => {
    const role = localStorage.getItem('smartcliff_roleValue');
    setUserRole(role);

    const fetchUserPermissions = async () => {
      try {
        setIsLoadingPermissions(true);
        const response = await userPermission();
        if (response.valid && response.user && response.user.permissions) {
          setUserPermissions(response.user.permissions);
          setCanAddUser(hasPermission(response.user.permissions, 'usermanagement', 'Add User'));
          setCanBulkUpload(hasPermission(response.user.permissions, 'usermanagement', 'Bulk Upload'));
          setCanBulkPermission(hasPermission(response.user.permissions, 'usermanagement', 'Bulk Permission'));
        }
      } catch (error) {
        console.error('Failed to fetch user permissions:', error);
      } finally {
        setIsLoadingPermissions(false);
      }
    };
    fetchUserPermissions();
  }, []);

  // Get token and institution info
  useEffect(() => {
    setToken(getToken());
    setInstitutionId(localStorage.getItem('smartcliff_institution'));
    setBasedOn(localStorage.getItem('smartcliff_basedOn'));
  }, []);

  // Roles — one shared cache entry (see src/queries/users.ts); no more token
  // in the key, no copy into local state.
  const { data: rolesData, isLoading: isLoadingRoles } = useRolesQuery(institutionId);
  const roles: Role[] = rolesData ?? [];

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Changing a filter goes back to page 1. This adjusts state DURING render
  // rather than in an effect: as an effect it committed the new filter with
  // the OLD page number first, so a filter change while on page 3 fired a
  // request for page 3 and then immediately a second one for page 1. React
  // re-runs this render before committing, so only the page-1 request is ever
  // made.
  const filterSignature = JSON.stringify([
    debouncedSearchTerm, selectedRoles, selectedStatus,
    selectedDegree, selectedDepartment, selectedYear, selectedBatch,
  ]);
  const [lastFilterSignature, setLastFilterSignature] = useState(filterSignature);
  if (lastFilterSignature !== filterSignature) {
    setLastFilterSignature(filterSignature);
    setCurrentPage(1);
  }

  // ── The directory read ─────────────────────────────────────────────────────
  // The page used to pull EVERY user in the institution and filter, sort and
  // slice the array in the browser. That works at 179 users and collapses at
  // 100,000: a ~300 MB response, parsed and held in React state, before a
  // single row is drawn. The search, the six filters, the sort and the slice
  // now all run in Mongo, and one page crosses the wire.
  //
  // Everything below the fetch — the filter predicate, the comparator, the
  // slice — was deleted rather than reimplemented: the server-side port in
  // getUserAccessPaginated (server/controllers/userAuth.js) is a field-for-
  // field copy of it, checked against this page's own predicate over live data
  // across every filter, both sort directions and deep pages.
  const queryParams = useMemo(
    () => ({
      page: currentPage,
      limit: pageSize,
      search: debouncedSearchTerm,
      roles: selectedRoles,
      status: selectedStatus,
      degree: selectedDegree,
      department: selectedDepartment,
      year: selectedYear,
      batch: selectedBatch,
      sortKey,
      sortDir,
    }),
    [currentPage, pageSize, debouncedSearchTerm, selectedRoles, selectedStatus,
      selectedDegree, selectedDepartment, selectedYear, selectedBatch, sortKey, sortDir],
  );

  // `isLoading` is true only for the very first page — keepPreviousData holds
  // the previous rows through every later fetch, so the table never blanks
  // while paging or typing, which is how the in-memory version behaved.
  const { data: usersPage, isLoading: isLoadingUsers } =
    useUsersPageQuery(institutionId, queryParams);

  // Batch options came from the loaded rows; with one page in hand the server
  // supplies them, over the whole institution exactly as before.
  const dynamicBatchOptions = usersPage?.batches ?? [];

  // The Bulk Permission picker is the one consumer here that still wants every
  // user at once. It now loads ONLY while that modal is open, instead of on
  // every page view — so the table's cost no longer includes it. (The picker
  // itself remains a full-roster read; making it search server-side is its own
  // piece of work, flagged in the report.)
  const { data: allUsersForPicker } = useUsersListQuery(
    institutionId,
    basedOn,
    showBulkPermissionModal,
  );

  // Mutations
  const addUserMutation = useMutation({
    mutationFn: async (userData: any) => addUser(userData, token!),
    onSuccess: async (data, submittedUserData) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      const createdId = data.user?._id;
      setNewUserId(createdId);
      // Kept so the success modal's "Configure Permissions" has the row: the
      // new user may not be on the visible page, and the full directory is no
      // longer loaded to look them up in.
      setCreatedUser(data.user ? transformUser(data.user) : null);

      // Persist role-based baseline permissions right after creation so the
      // account can sign in and reach its "home" pages without the admin
      // having to open Assign Permission first. The role name is looked up
      // from the roles list against the id we just submitted, and mapped to
      // one of three buckets by `defaultPermissionsForRole` — admin/POC/
      // coordinator get Admin Dashboard + Profile; trainer gets Staff
      // Dashboard + Courses + Profile; student gets Student Dashboard +
      // Courses + Profile. Failures here are non-fatal — the account is
      // already created; the admin can still open Assign Permission.
      try {
        const roleObj = roles.find((r) => r._id === submittedUserData.role);
        const roleName =
          roleObj?.originalRole || roleObj?.renameRole || newUser.role || "";
        const defaults = defaultPermissionsForRole(roleName);
        if (createdId && defaults.length > 0 && token) {
          await fetch(`${API_BASE_URL}/user-permission/update/${createdId}`, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ permissions: defaults }),
          });
        }
      } catch (e) {
        console.error("Failed to seed role-based default permissions:", e);
      }

      setShowAddUserModal(false);
      setShowSuccessModal(true);
      resetForm();
      toast.success("User added successfully");
      setIsSubmitting(false);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to add user"));
      setIsSubmitting(false);
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, userData }: { userId: string; userData: any }) => updateUser(userId, userData, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      setShowAddUserModal(false);
      setShowSuccessModal(true);
      resetForm();
      toast.success("User updated successfully");
      setIsSubmitting(false);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to update user"));
      setIsSubmitting(false);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => deleteUser(userId, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      setShowDeleteModal(false);
      toast.success("User deleted successfully");
    },
    onError: () => toast.error("Failed to delete user"),
  });

  const resetForm = () => {
    setNewUser({
      id: "", firstName: "", lastName: "", email: "", phone: "", password: "",
      role: "Student", roleId: "", status: "active", gender: "Male",
      degree: "", department: "", semester: "", year: "", batch: "",
      phase: "", serviceModel: "", rollNumber: "",
      studentType: "",
      clientId: "",
      clientName: "",
    });
  };

  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!newUser.roleId) {
      toast.error("Please select a role");
      return;
    }

    // Only students are placed into a client's service-mapping hierarchy — the
    // Client field is hidden for every other role, so don't require it there.
    const selectedRole = roles.find(r => r._id === newUser.roleId);
    const isStudentRole =
      (selectedRole?.renameRole?.toLowerCase() || '').includes('student') ||
      (selectedRole?.originalRole?.toLowerCase() || '').includes('student');
    if (isStudentRole && !newUser.clientName) {
      toast.error("Please select a client");
      return;
    }

    // Start loading
    setIsSubmitting(true);

    try {
      const userData: any = {
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        phone: newUser.phone,
        role: newUser.roleId,
        gender: newUser.gender,
        status: newUser.status,
        ...(newUser.password && { password: newUser.password }),
      };

      // Client + service model drive the whole hierarchy — sent for every user.
      if (newUser.clientName) userData.clientName = newUser.clientName;
      if (newUser.clientId) userData.clientId = newUser.clientId;
      if (newUser.serviceModel) userData.serviceModel = newUser.serviceModel;
      if (newUser.serviceMappingId) userData.serviceMappingId = newUser.serviceMappingId;
      if (newUser.studentType) userData.studentType = newUser.studentType;

      // Hierarchy fields, driven by the selected service mapping
      if (newUser.degree) userData.degree = newUser.degree;
      if (newUser.department) userData.department = newUser.department;
      if (newUser.semester) userData.semester = newUser.semester;
      if (newUser.section) userData.section = newUser.section;
      if (newUser.rollNumber) userData.rollNumber = newUser.rollNumber;
      if (newUser.batch) userData.batch = newUser.batch;
      if (newUser.phase) userData.phase = newUser.phase;

      if (newUser.id) {
        await updateUserMutation.mutateAsync({ userId: newUser.id, userData });
      } else {
        await addUserMutation.mutateAsync(userData);
      }
    } catch (error) {
      console.error('Error submitting user:', error);
    }
  };

  const handleEdit = (user: User) => {
    setNewUser({
      id: user.id, firstName: user.firstName, lastName: user.lastName,
      email: user.email, phone: user.phone, password: "",
      role: user.role, roleId: user.roleId, status: user.status,
      gender: user.gender as "Male" | "Female",
      degree: user.degree || "", department: user.department || "",
      semester: user.semester || "", section: user.section || "", rollNumber: user.rollNumber || "", year: user.year || "", batch: user.batch || "",
      phase: user.phase || "", serviceModel: user.serviceModel || "",
      studentType: user.studentType || "",
      clientId: user.clientId || "",
      clientName: user.clientName || "",
    });
    setShowAddUserModal(true);
  };

  const handleDelete = (user: User) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (userToDelete) deleteUserMutation.mutate(userToDelete.id);
  };

  const toggleStatus = async (userId: string, newStatus: "active" | "inactive") => {
    try {
      setUpdatingStatus(prev => ({ ...prev, [userId]: true }));
      await toggleUserStatus(userId, newStatus, token || undefined);
      toast.success(`Status changed to ${newStatus}`);
      await queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    } catch (error) {
      toast.error("Failed to update user status");
    } finally {
      setUpdatingStatus(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handleAddUserClick = () => {
    resetForm();
    setShowAddUserModal(true);
  };

  const handlePermissionsClick = (user: User) => {
    setSelectedUserForPermission(user);
    setShowPermissionModal(true);
  };

  const handleViewDetails = (user: User) => {
    setSelectedUserForDetails(user);
    setShowViewDetailsModal(true);
  };

  const handleToggleStatus = (user: User) => {
    toggleStatus(user.id, user.status === "active" ? "inactive" : "active");
  };

  const handleDuplicateUser = (user: User) => {
    const duplicateEmail = user.email.replace(/@/, `+copy@`);
    setNewUser({
      id: "", firstName: user.firstName + " (Copy)", lastName: user.lastName,
      email: duplicateEmail, phone: user.phone, password: "",
      role: user.role, roleId: user.roleId, status: "active",
      gender: user.gender as "Male" | "Female",
      degree: user.degree || "", department: user.department || "",
      semester: user.semester || "", section: user.section || "", rollNumber: user.rollNumber || "", year: user.year || "", batch: user.batch || "",
      phase: user.phase || "", serviceModel: user.serviceModel || "",
      studentType: user.studentType || "",
      clientId: user.clientId || "",
      clientName: user.clientName || "",
    });
    setShowAddUserModal(true);
  };

  const clearAllFilters = () => {
    setSelectedRoles([]);
    setSelectedStatus("");
    setSelectedDegree("");
    setSelectedDepartment("");
    setSelectedYear("");
    setSelectedBatch("");
    setSearchTerm("");
    setCurrentPage(1);
  };

  const hasActiveFilters = () => {
    return selectedRoles.length > 0 || selectedStatus !== "" ||
      selectedDegree !== "" || selectedDepartment !== "" ||
      selectedYear !== "" || selectedBatch !== "" || searchTerm !== "";
  };

  // Use role _id for filtering
  const dynamicRoleOptions = roles.map(role => ({
    value: role._id,
    label: role.renameRole,
    icon: getRoleIcon(role.renameRole),
    color: getRoleColor(role.renameRole)
  }));

  // ── Sorting ────────────────────────────────────────────────────────────────
  const sortValue = (u: User, key: string): string => {
    if (key === 'name') return `${u.firstName} ${u.lastName}`.toLowerCase();
    return String((u as any)[key] ?? '').toLowerCase();
  };

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // ── Pagination ─────────────────────────────────────────────────────────────
  // All four numbers are the server's now. `total` is the count of rows
  // matching the filters, which is what the old `sortedUsers.length` was.
  const currentUsers = usersPage?.users ?? [];
  const totalFiltered = usersPage?.total ?? 0;
  const totalPages = usersPage?.totalPages ?? 1;
  const safePage = Math.min(currentPage, totalPages);
  const rangeStart = totalFiltered === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, totalFiltered);

  useEffect(() => {
    setCurrentPage((p) => Math.min(p, totalPages));
  }, [pageSize, totalPages]);

  // (The height-driven auto-fit effect that lived here is gone — pageSize is
  // fixed at 10 above. The table wrapper still flexes; it just no longer
  // rewrites the page size as the window resizes.)

  // Selected ids that still match the current filters.
  //
  // This used to be `selectedIds` intersected with the loaded list. Selection
  // spans pages, and off-page rows are no longer in memory — so the page keeps
  // the selected ROW next to its id, and re-runs the page's own predicate over
  // those rows. Same rule as before ("a selection survives only while it still
  // matches"), evaluated against the handful of selected users instead of the
  // whole directory.
  const matchesCurrentFilters = useCallback((user: User) => {
    const q = debouncedSearchTerm.toLowerCase();
    const matchesSearch = !debouncedSearchTerm ||
      user.firstName.toLowerCase().includes(q) ||
      user.lastName.toLowerCase().includes(q) ||
      user.email.toLowerCase().includes(q) ||
      (user.degree || '').toLowerCase().includes(q) ||
      (user.department || '').toLowerCase().includes(q);
    const matchesRoles = selectedRoles.length === 0 || selectedRoles.includes(user.roleId);
    const matchesStatus = !selectedStatus || selectedStatus === "all" || user.status === selectedStatus;
    const matchesDegree = !selectedDegree || selectedDegree === "all" || user.degree === selectedDegree;
    const matchesDepartment = !selectedDepartment || selectedDepartment === "all" || user.department === selectedDepartment;
    const matchesYear = !selectedYear || selectedYear === "all" || user.year === selectedYear;
    const matchesBatch = !selectedBatch || selectedBatch === "all" || user.batch === selectedBatch;
    return matchesSearch && matchesRoles && matchesStatus && matchesDegree && matchesDepartment && matchesYear && matchesBatch;
  }, [debouncedSearchTerm, selectedRoles, selectedStatus, selectedDegree, selectedDepartment, selectedYear, selectedBatch]);

  const visibleSelectedRows = useMemo(
    () => Object.values(selectedRows).filter(matchesCurrentFilters),
    [selectedRows, matchesCurrentFilters]
  );
  const visibleSelectedIds = useMemo(
    () => visibleSelectedRows.map(u => u.id),
    [visibleSelectedRows]
  );

  // ── Selection ──────────────────────────────────────────────────────────────
  const pageIds = currentUsers.map(u => u.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.includes(id));
  const somePageSelected = pageIds.some(id => selectedIds.includes(id));
  // (The header checkbox's indeterminate state is owned by UsersTable, which
  // receives somePageSelected/allPageSelected as props.)

  const toggleSelectAllPage = () => {
    setSelectedRows(prev => {
      const next = { ...prev };
      if (allPageSelected) {
        pageIds.forEach(id => { delete next[id]; });
      } else {
        currentUsers.forEach(u => { next[u.id] = u; });
      }
      return next;
    });
  };

  const toggleSelectOne = (id: string) => {
    setSelectedRows(prev => {
      if (prev[id]) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      const row = currentUsers.find(u => u.id === id);
      return row ? { ...prev, [id]: row } : prev;
    });
  };

  // ── Bulk actions ───────────────────────────────────────────────────────────
  const canToggleStatusPerm = hasPermission(userPermissions, 'usermanagement', 'Toggle User Status');
  const canDeletePerm = hasPermission(userPermissions, 'usermanagement', 'Delete');

  const handleBulkStatus = async (status: 'active' | 'inactive') => {
    if (!visibleSelectedIds.length || !token) return;
    setBulkBusy(true);
    try {
      await bulkSetUserStatus(visibleSelectedIds, status, token);
      toast.success(`${visibleSelectedIds.length} user${visibleSelectedIds.length > 1 ? 's' : ''} ${status === 'active' ? 'activated' : 'deactivated'}`);
      setSelectedRows({});
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to update status"));
    } finally {
      setBulkBusy(false);
    }
  };

  const confirmBulkDelete = async () => {
    if (!visibleSelectedIds.length || !token) return;
    setBulkBusy(true);
    try {
      const results = await Promise.allSettled(visibleSelectedIds.map(id => deleteUser(id, token)));
      const ok = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.length - ok;
      if (ok) toast.success(`${ok} user${ok > 1 ? 's' : ''} deleted`);
      if (failed) toast.error(`${failed} user${failed > 1 ? 's' : ''} could not be deleted`);
      setSelectedRows({});
      setShowBulkDeleteModal(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    } finally {
      setBulkBusy(false);
    }
  };

  // ── Export ─────────────────────────────────────────────────────────────────
  // "Export all" still means every row matching the filters, not just the
  // visible page — but those rows no longer live in the browser, so it asks the
  // server for them, sorted the same way, carrying only the thirteen CSV
  // columns (~366 bytes a row against ~2.6 KB for a table row).
  // "Export selected" needs no request at all: the rows are already in hand.
  const [isExporting, setIsExporting] = useState(false);

  const exportUsers = async (scope: 'selected' | 'all') => {
    if (isExporting) return;
    let rows: User[];
    if (scope === 'selected') {
      // Ordered by the active sort, as it was when the whole list was sorted
      // in memory and then filtered down to the selection.
      rows = [...visibleSelectedRows];
      if (sortKey) {
        rows.sort((a, b) => sortValue(a, sortKey).localeCompare(sortValue(b, sortKey), undefined, { numeric: true }));
        if (sortDir === 'desc') rows.reverse();
      }
    } else {
      if (!institutionId || !token) return;
      setIsExporting(true);
      try {
        const raw = await fetchUsersForExport(institutionId, token, {
          search: debouncedSearchTerm,
          roles: selectedRoles,
          status: selectedStatus,
          degree: selectedDegree,
          department: selectedDepartment,
          year: selectedYear,
          batch: selectedBatch,
          sortKey,
          sortDir,
        });
        rows = raw.map(transformUser);
      } catch (error) {
        toast.error(getApiErrorMessage(error, "Export failed"));
        return;
      } finally {
        setIsExporting(false);
      }
    }
    if (!rows.length) {
      toast.info("Nothing to export");
      return;
    }
    const esc = (v: any) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ["First Name", "Last Name", "Email", "Phone", "Gender", "Role", "Batch", "Degree", "Department", "Semester", "Section", "Client", "Status"];
    const lines = [
      header.join(','),
      ...rows.map(u => [
        u.firstName, u.lastName, u.email, u.phone, u.gender, u.role, u.batch,
        u.degree, u.department, u.semester, u.section, u.clientName, u.status,
      ].map(esc).join(',')),
    ];
    const blob = new Blob(["﻿" + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} user${rows.length > 1 ? 's' : ''}`);
  };

  // ── Shared cell renderers ──────────────────────────────────────────────────
  // Status column mirrors the Client Management pattern: a real sliding
  // Switch (green when active, gray when inactive) with a compact Active /
  // Inactive text label beside it — a bare knob names nothing to a screen
  // reader, and the pill-plus-switch combo repeated the same signal twice.
  const renderStatus = (user: User) => {
    const isActive = user.status === "active";
    const isToggling = Boolean(updatingStatus[user.id]);
    return (
      <div className="flex items-center justify-end gap-2">
        {canToggleStatusPerm && (
          <Switch
            checked={isActive}
            disabled={isToggling}
            onCheckedChange={(checked) => toggleStatus(user.id, checked ? "active" : "inactive")}
            aria-label={isActive ? 'Deactivate user' : 'Activate user'}
            title={isActive ? 'Active — switch off to deactivate' : 'Inactive — switch on to activate'}
            className="data-[state=checked]:bg-success-500 data-[state=unchecked]:bg-ink-200"
          />
        )}
        <span className={`text-xs font-medium ${isActive ? 'text-success-700' : 'text-subtle'} ${isToggling ? 'animate-pulse' : ''}`}>
          {isActive ? 'Active' : 'Inactive'}
        </span>
      </div>
    );
  };

  const renderActions = (user: User) => (
    <RowActionsMenu
      user={user}
      onEdit={handleEdit}
      onPermissions={handlePermissionsClick}
      onDelete={handleDelete}
      onViewDetails={handleViewDetails}
      onDuplicate={handleDuplicateUser}
      userPermissions={userPermissions}
    />
  );

  // Only render the Actions column when the signed-in admin has at least one
  // row-level action (Edit / Assign / Delete / Duplicate / View Full Details).
  // Deactivate lives in the Status column, so it doesn't count toward this.
  const showActionsColumn = rowHasAnyAction(userPermissions);

  if (isLoadingPermissions) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-brand" />
          <p className="text-sm text-subtle">Loading permissions…</p>
        </div>
      </div>
    );
  }

  // Initial load only. Background refreshes (the 2-min interval, post-mutation
  // invalidations) update rows in place instead of swapping the table for
  // skeletons — the old `|| isFetching` here re-skeletoned the table on every
  // filter change because filters lived in the query key.
  const isTableLoading = isLoadingUsers;

  // Differentiated empty states: no matches (offer to clear filters) vs a
  // truly empty directory (offer the Add User CTA, when permitted).
  const usersEmptyState = hasActiveFilters() ? (
    <EmptyState
      icon={SearchX}
      title="No users match your filters"
      message="Try a different search, or clear the filters to see every user."
      secondaryAction={
        <button
          type="button"
          onClick={clearAllFilters}
          className="h-9 px-3.5 rounded-control border border-hairline-strong bg-surface text-sm font-medium text-body hover:bg-row-hover hover:text-heading transition-colors duration-150"
        >
          Clear filters
        </button>
      }
    />
  ) : (
    <EmptyState
      icon={Users}
      title="No users yet"
      message="Users you add will appear here with their role, client and status."
      primaryAction={canAddUser ? (
        <button
          type="button"
          onClick={handleAddUserClick}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-control bg-brand-strong text-white text-sm font-semibold shadow-xs hover:bg-brand-800 transition-colors duration-150"
        >
          <Plus size={15} strokeWidth={2.4} /> Add User
        </button>
      ) : undefined}
    />
  );

  // Bulk actions for the floating selection bar (shown only once rows are
  // selected): Activate · Deactivate · Permissions · Export · Delete.
  const renderBulkActions = () => (
    <>
      {canToggleStatusPerm && (
        <>
          <button
            type="button"
            onClick={() => handleBulkStatus('active')}
            disabled={!visibleSelectedIds.length || bulkBusy}
            className={BULK_BAR_BTN}
          >
            Activate
          </button>
          <button
            type="button"
            onClick={() => handleBulkStatus('inactive')}
            disabled={!visibleSelectedIds.length || bulkBusy}
            className={BULK_BAR_BTN}
          >
            Deactivate
          </button>
        </>
      )}
      {canBulkPermission && (
        <button
          type="button"
          onClick={() => setShowBulkPermissionModal(true)}
          disabled={!visibleSelectedIds.length || bulkBusy}
          className={BULK_BAR_BTN}
        >
          Permissions
        </button>
      )}
      <button
        type="button"
        onClick={() => exportUsers('selected')}
        disabled={!visibleSelectedIds.length || bulkBusy}
        className={BULK_BAR_BTN}
      >
        Export
      </button>
      {canDeletePerm && (
        <button
          type="button"
          onClick={() => setShowBulkDeleteModal(true)}
          disabled={!visibleSelectedIds.length || bulkBusy}
          className={BULK_BAR_BTN_DANGER}
        >
          Delete
        </button>
      )}
      {bulkBusy && <Loader2 className="w-3.5 h-3.5 animate-spin text-white/70" />}
    </>
  );

  // A filter counts as active only when it holds a real value ("all" and "" both
  // mean "no filter", matching how the users query interprets them).
  const isSet = (v: string) => !!v && v !== "all";
  const activeFilterCount =
    (selectedRoles.length ? 1 : 0) +
    (isSet(selectedStatus) ? 1 : 0) +
    (isSet(selectedDegree) ? 1 : 0) +
    (isSet(selectedDepartment) ? 1 : 0) +
    (isSet(selectedYear) ? 1 : 0) +
    (isSet(selectedBatch) ? 1 : 0);

  // Removable chips for the applied filters (search has its own input, so it is
  // not chipped here). Each chip's remove clears exactly that filter.
  const filterChips: { key: string; label: string; onRemove: () => void }[] = [
    ...selectedRoles.map((id) => ({
      key: `role-${id}`,
      label: roles.find((r) => r._id === id)?.renameRole || "Role",
      onRemove: () => setSelectedRoles(selectedRoles.filter((r) => r !== id)),
    })),
    ...(isSet(selectedStatus) ? [{ key: "status", label: selectedStatus === "active" ? "Active" : "Inactive", onRemove: () => setSelectedStatus("") }] : []),
    ...(isSet(selectedDegree) ? [{ key: "degree", label: selectedDegree, onRemove: () => setSelectedDegree("") }] : []),
    ...(isSet(selectedDepartment) ? [{ key: "dept", label: selectedDepartment, onRemove: () => setSelectedDepartment("") }] : []),
    ...(isSet(selectedYear) ? [{ key: "year", label: selectedYear, onRemove: () => setSelectedYear("") }] : []),
    ...(isSet(selectedBatch) ? [{ key: "batch", label: selectedBatch, onRemove: () => setSelectedBatch("") }] : []),
  ];

  const pageContent = (
    <div className="min-h-full h-full flex flex-col">
      <Toaster position="top-right" richColors closeButton />
      <motion.div
        variants={pageEnter}
        initial="hidden"
        animate="visible"
        className="flex flex-1 min-h-0 flex-col px-4 sm:px-6 md:px-8 pt-3 pb-3"
      >

        {/* Slim heading — chip strip + subtitle dropped so the header reads
            just like Client Management. */}
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-base sm:text-lg font-semibold text-heading tracking-[-0.01em]">
            User Management
          </h1>
        </div>

        {/* One toolbar: search left · Filter · Export · Print grouped right
            · vertical divider · Add User (primary). Mirrors Client
            Management so the two admin lists read the same. */}
        <div className="no-print mt-3 flex items-center gap-2 flex-wrap min-w-0">
          {/* Compact search */}
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-faint pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search users…"
              className="w-full h-9 pl-8 pr-8 rounded-control border border-hairline-strong bg-surface text-sm text-body placeholder:text-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors duration-150"
            />
            {searchTerm && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex size-5 items-center justify-center rounded-chip text-faint hover:bg-ink-100 hover:text-heading transition-colors duration-150"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Secondary-action cluster (Filter · Export · More) pushed right */}
          <div className="ml-auto flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
              className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-control border text-xs font-medium transition-colors duration-150 relative ${activeFilterCount > 0 || showFilters ? "border-brand text-brand-strong bg-brand-wash" : "border-hairline-strong bg-surface text-body hover:bg-row-hover hover:text-heading"}`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Filter</span>
              {activeFilterCount > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-strong px-1 text-2xs font-bold text-white tabular-nums">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Export — standalone dropdown like Client Management */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Export list"
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-control border border-hairline-strong bg-surface text-xs font-medium text-body hover:bg-row-hover hover:text-heading transition-colors duration-150"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Export</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={6} className="w-40">
                <DropdownMenuItem onClick={() => exportUsers('all')} className="cursor-pointer">
                  <FileSpreadsheet className="h-4 w-4 text-success-700" /> Export all (CSV)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Overflow — page-specific actions that don't fit elsewhere
                (Import, Bulk permissions). Kept behind a kebab so the
                primary row stays clean. */}
            {(canAddUser || canBulkPermission) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" aria-label="More actions" className="inline-flex items-center justify-center h-8 w-8 rounded-control border border-hairline-strong bg-surface text-body hover:bg-row-hover hover:text-heading transition-colors duration-150">
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={6} className="w-56">
                  {canAddUser && (
                    <DropdownMenuItem onClick={() => setShowBulkUserModal(true)} className="cursor-pointer">
                      <FileSpreadsheet className="h-4 w-4" /> Import users (Excel)
                    </DropdownMenuItem>
                  )}
                  {canBulkPermission && (
                    <DropdownMenuItem onClick={() => setShowBulkPermissionModal(true)} className="cursor-pointer">
                      <KeyRound className="h-4 w-4" /> Bulk permissions
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Primary — Add User, matching Client Management's brand button */}
          {canAddUser && (
            <>
              <span className="hidden sm:inline-block h-5 w-px bg-hairline-strong mx-0.5" aria-hidden />
              <motion.button
                type="button"
                onClick={handleAddUserClick}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-control bg-brand-strong text-white shadow-sm hover:bg-brand-800 transition-colors duration-150 ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 flex-shrink-0"
              >
                <Plus size={14} strokeWidth={2.4} />
                <span className="text-xs font-semibold hidden sm:inline">Add User</span>
              </motion.button>
            </>
          )}
        </div>

        {/* ── Inline filter panel — expands on the same screen under the toolbar ── */}
        <UserFilterPanel
          open={showFilters}
          onClose={() => setShowFilters(false)}
          roleOptions={dynamicRoleOptions}
          selectedRoles={selectedRoles}
          setSelectedRoles={setSelectedRoles}
          selectedStatus={selectedStatus}
          setSelectedStatus={setSelectedStatus}
          selectedDegree={selectedDegree}
          setSelectedDegree={setSelectedDegree}
          selectedDepartment={selectedDepartment}
          setSelectedDepartment={setSelectedDepartment}
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          selectedBatch={selectedBatch}
          setSelectedBatch={setSelectedBatch}
          degreeOptions={degreeOptions}
          departmentOptions={departmentOptions}
          yearOptions={yearOptions}
          batchOptions={dynamicBatchOptions}
          basedOn={basedOn}
          activeCount={activeFilterCount}
          onClear={clearAllFilters}
        />

        {/* ── Active-filter chips (appear only when filters are applied) ── */}
        {filterChips.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {filterChips.map((chip) => (
              <span
                key={chip.key}
                className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1.5 rounded-full border border-brand-500/30 bg-brand-wash text-xs font-medium text-brand-strong"
              >
                {chip.label}
                <button
                  type="button"
                  aria-label={`Remove ${chip.label} filter`}
                  onClick={chip.onRemove}
                  className="inline-flex size-4 items-center justify-center rounded-full hover:bg-brand-500/20 transition-colors duration-150"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-xs font-medium text-subtle hover:text-heading transition-colors duration-150 ml-0.5"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Flat listing — flex-1 min-h-0 lets the wrapper absorb the vertical
            space between the toolbar and the pagination footer; the auto-fit
            effect then picks the row count that exactly fills that height, so
            no scrollbar appears and no empty band sits below the last row. */}
        <div ref={tableCardRef} className="mt-2 flex flex-1 min-h-0 flex-col">
          <UsersTable
            users={currentUsers}
            isLoading={isTableLoading}
            skeletonRows={pageSize}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={toggleSort}
            selectedIds={selectedIds}
            onToggleOne={toggleSelectOne}
            allPageSelected={allPageSelected}
            somePageSelected={somePageSelected}
            onToggleAllPage={toggleSelectAllPage}
            renderStatus={renderStatus}
            renderActions={renderActions}
            emptyState={usersEmptyState}
            showActionsColumn={showActionsColumn}
          />

          {/* Footer / pagination */}
          {!isTableLoading && totalFiltered > 0 && (
            <TableFooter
              from={rangeStart}
              to={rangeEnd}
              total={totalFiltered}
              pageSize={pageSize}
              onPageSize={(n) => { setPageSize(n); setCurrentPage(1); }}
              currentPage={safePage}
              totalPages={totalPages}
              onPage={setCurrentPage}
            />
          )}
        </div>

        {/* ── Bulk delete confirmation ── */}
        <Modal
          open={showBulkDeleteModal}
          onClose={() => { if (!bulkBusy) setShowBulkDeleteModal(false); }}
          size="sm"
          title={`Delete ${visibleSelectedIds.length} user${visibleSelectedIds.length > 1 ? 's' : ''}?`}
          footer={
            <>
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(false)}
                disabled={bulkBusy}
                className="h-9 px-3.5 rounded-control border border-hairline-strong bg-surface text-sm font-medium text-body hover:bg-row-hover hover:text-heading disabled:opacity-50 transition-colors duration-150"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmBulkDelete}
                disabled={bulkBusy}
                className="inline-flex items-center gap-2 h-9 px-3.5 rounded-control bg-danger-700 text-white text-sm font-semibold shadow-xs hover:bg-danger-700/90 disabled:opacity-60 transition-colors duration-150"
              >
                {bulkBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Delete
              </button>
            </>
          }
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-tile bg-danger-50 flex items-center justify-center flex-shrink-0">
              <Trash2 className="w-5 h-5 text-danger-700" />
            </div>
            <p className="text-sm text-subtle pt-0.5">
              This action cannot be undone. The selected user accounts will be permanently removed.
            </p>
          </div>
        </Modal>

        <UserModals
          institutionId={institutionId}
          showAddUserModal={showAddUserModal}
          setShowAddUserModal={setShowAddUserModal}
          showSuccessModal={showSuccessModal}
          setShowSuccessModal={setShowSuccessModal}
          showDeleteModal={showDeleteModal}
          setShowDeleteModal={setShowDeleteModal}
          showPermissionModal={showPermissionModal}
          setShowPermissionModal={setShowPermissionModal}
          showBulkUploadModal={showBulkUploadModal}
          setShowBulkUploadModal={setShowBulkUploadModal}
          showBulkPermissionModal={showBulkPermissionModal}
          setShowBulkPermissionModal={setShowBulkPermissionModal}
          showViewDetailsModal={showViewDetailsModal}
          setShowViewDetailsModal={setShowViewDetailsModal}
          newUser={newUser}
          setNewUser={setNewUser}
          newUserId={newUserId}
          userToDelete={userToDelete}
          selectedUserForPermission={selectedUserForPermission}
          setSelectedUserForPermission={setSelectedUserForPermission}
          selectedUserForDetails={selectedUserForDetails}
          setSelectedUserForDetails={setSelectedUserForDetails}
          selectedUserForBulkPermissions={selectedUserForBulkPermissions}
          setSelectedUserForBulkPermissions={setSelectedUserForBulkPermissions}
          roles={roles}
          isLoadingRoles={isLoadingRoles}
          basedOn={basedOn}
          userPermissions={userPermissions}
          allUsers={allUsersForPicker ?? []}
          onAddUserSubmit={handleAddUserSubmit}
          onConfirmDelete={confirmDelete}
          onConfigurePermissions={() => {
            // The just-created user came back on the create response — it is
            // not necessarily on the visible page, and the whole directory is
            // no longer in memory to search.
            const user = createdUser;
            if (user) {
              setSelectedUserForPermission(user);
              setShowSuccessModal(false);
              setShowPermissionModal(true);
            }
          }}
          isDeleting={deleteUserMutation.isPending}
          isEditing={!!newUser.id}
          canBulkUpload={canBulkUpload}
          canBulkPermission={canBulkPermission}
          isSubmitting={isSubmitting}
          onSubmitSuccess={() => {}}
        />

        <BulkUserModal
          isOpen={showBulkUserModal}
          onClose={() => setShowBulkUserModal(false)}
          roles={roles}
          onComplete={() => queryClient.invalidateQueries({ queryKey: queryKeys.users.all })}
        />
      </motion.div>

      {/* ── Floating bulk bar — appears only after a selection. Rendered OUTSIDE
          the animated page wrapper so its `fixed` positioning is viewport-
          relative, never trapped by the entrance transform. ── */}
      <AnimatePresence>
        {visibleSelectedIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 16, x: '-50%' }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className="fixed bottom-6 left-1/2 z-dropdown flex items-center gap-3 rounded-full bg-ink-900 py-2 pl-4 pr-2 text-white shadow-xl"
          >
            <span className="text-xs font-semibold whitespace-nowrap tabular-nums">
              {visibleSelectedIds.length} selected
            </span>
            <span className="h-4 w-px bg-white/20" />
            <span className="flex items-center gap-1.5">{renderBulkActions()}</span>
            <button
              type="button"
              aria-label="Clear selection"
              onClick={() => setSelectedRows({})}
              className="inline-flex size-7 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );

  if (userRole === null) {
    return <div className="min-h-screen flex items-center justify-center"><Loading size="size-8" /></div>;
  }

  return userRole === 'admin' || userRole === 'ldhead' || userRole === 'subhead' || userRole === 'programcoordinator'
    ? <DashboardLayout>{pageContent}</DashboardLayout>
    // noBuiltInPadding: the flex-1 chain assumes the admin shell's zero outer
    // padding; StaffLayout would otherwise add ~2.5rem on top and push the
    // table below the viewport in POC / trainer roles.
    : <StaffLayout noBuiltInPadding>{pageContent}</StaffLayout>;
}
