"use client";

// Creating, editing and deleting ONE user.
//
// The add form, the three mutations and the row-level handlers are kept
// together because they are a single loop: the form feeds the mutation, the
// mutation's success resets the form and swaps which modal is open. Splitting
// the state from the mutation that owns it is what makes "which modal closes
// on success" hard to answer.
//
// Bulk operations are deliberately NOT here — see useBulkUserActions.

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addUser,
  deleteUser,
  toggleUserStatus,
  updateUser,
} from "@/app/lms/pages/usermanagement/api/userService";
import { transformUser } from "@/app/lms/pages/usermanagement/queries/users";
import { defaultPermissionsForRole } from "@/app/lms/pages/usermanagement/config/permissions.helpers";
import { queryKeys } from "@/lib/queryKeys";
import { API_BASE_URL } from "@/lib/http";
import type { Role, User, UserFormData } from "../types";
import { emptyUserForm, getApiErrorMessage } from "../userManagement.constants";

export function useUserCrud(token: string | null, roles: Role[]) {
  const queryClient = useQueryClient();

  const [newUser, setNewUser] = useState<UserFormData>(emptyUserForm());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [newUserId, setNewUserId] = useState("");
  const [createdUser, setCreatedUser] = useState<User | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<Record<string, boolean>>({});

  const resetForm = () => setNewUser(emptyUserForm());

  // ── Mutations ──────────────────────────────────────────────────────────────
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
        const roleObj = roles.find((r) => r._id === (submittedUserData as any).role);
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
    mutationFn: async ({ userId, userData }: { userId: string; userData: any }) =>
      updateUser(userId, userData, token!),
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

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleAddUserSubmit = async (e: FormEvent) => {
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

  // Edit and Duplicate load the same fields; they differ only in whether the
  // row's id (and so the update-vs-create branch above) comes with them.
  const loadUserIntoForm = (user: User, overrides: Partial<UserFormData>) => {
    setNewUser({
      id: user.id, firstName: user.firstName, lastName: user.lastName,
      email: user.email, phone: user.phone, password: "",
      role: user.role, roleId: user.roleId, status: user.status,
      gender: user.gender as "Male" | "Female",
      degree: user.degree || "", department: user.department || "",
      semester: user.semester || "", section: user.section || "",
      rollNumber: user.rollNumber || "", year: user.year || "",
      batch: user.batch || "",
      phase: user.phase || "", serviceModel: user.serviceModel || "",
      studentType: user.studentType || "",
      clientId: user.clientId || "",
      clientName: user.clientName || "",
      ...overrides,
    });
    setShowAddUserModal(true);
  };

  const handleEdit = (user: User) => loadUserIntoForm(user, {});

  const handleDuplicateUser = (user: User) =>
    loadUserIntoForm(user, {
      id: "",
      firstName: user.firstName + " (Copy)",
      email: user.email.replace(/@/, `+copy@`),
      status: "active",
    });

  const handleAddUserClick = () => {
    resetForm();
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
    } catch {
      toast.error("Failed to update user status");
    } finally {
      setUpdatingStatus(prev => ({ ...prev, [userId]: false }));
    }
  };

  return {
    newUser, setNewUser, isSubmitting,
    showAddUserModal, setShowAddUserModal,
    showSuccessModal, setShowSuccessModal,
    showDeleteModal, setShowDeleteModal,
    userToDelete, newUserId, createdUser, updatingStatus,
    isDeleting: deleteUserMutation.isPending,
    handleAddUserSubmit, handleEdit, handleDuplicateUser,
    handleAddUserClick, handleDelete, confirmDelete, toggleStatus,
  };
}
