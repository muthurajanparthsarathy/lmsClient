"use client";
import {
  Edit,
  Trash2,
  KeyRound,
  Eye,
  Copy,
  MoreVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { User, ApiPermission } from "./types";
import { hasPermission } from "./permissions";

// Row-level checks used by both this menu and the parent table (page.tsx
// consults the same helper via `rowHasAnyAction` to decide whether the
// Actions column is worth showing at all).
export function rowActionFlags(userPermissions: ApiPermission[]) {
  return {
    canEditUser: hasPermission(userPermissions, "usermanagement", "Edit"),
    canAssignPermissions: hasPermission(userPermissions, "usermanagement", "Permissions"),
    canDeleteUser: hasPermission(userPermissions, "usermanagement", "Delete"),
    canDuplicateUser: hasPermission(userPermissions, "usermanagement", "Duplicate User"),
    canViewDetails: hasPermission(userPermissions, "usermanagement", "View Full Details"),
  };
}

export function rowHasAnyAction(userPermissions: ApiPermission[]): boolean {
  const f = rowActionFlags(userPermissions);
  return f.canEditUser || f.canAssignPermissions || f.canDeleteUser || f.canDuplicateUser || f.canViewDetails;
}

interface RowActionsMenuProps {
  user: User;
  onEdit: (user: User) => void;
  onPermissions: (user: User) => void;
  onDelete: (user: User) => void;
  onViewDetails?: (user: User) => void;
  onDuplicate?: (user: User) => void;
  userPermissions: ApiPermission[];
}

// Row-actions kebab. Deactivate/Activate is NOT here — that lives in the
// Status column as a Switch, gated on the same "Deactivate User" grant. The
// kebab renders nothing (returns null) when the user has no row-level
// actions, so the whole Actions column can be hidden by the parent table.
export function RowActionsMenu({
  user,
  onEdit,
  onPermissions,
  onDelete,
  onViewDetails,
  onDuplicate,
  userPermissions,
}: RowActionsMenuProps) {
  const { canEditUser, canAssignPermissions, canDeleteUser, canDuplicateUser, canViewDetails } =
    rowActionFlags(userPermissions);

  const anyAction = canEditUser || canAssignPermissions || canDeleteUser || canDuplicateUser || canViewDetails;
  if (!anyAction) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Row actions"
          className="inline-flex size-6 items-center justify-center rounded-chip text-subtle hover:bg-ink-100 hover:text-heading transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 data-[state=open]:bg-ink-100 data-[state=open]:text-heading"
        >
          <MoreVertical size={14} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4} className="w-48">
        {canViewDetails && onViewDetails && (
          <>
            <DropdownMenuItem onClick={() => onViewDetails(user)} className="text-xs cursor-pointer">
              <Eye className="h-3.5 w-3.5" /> View details
            </DropdownMenuItem>
            {(canEditUser || canAssignPermissions || canDuplicateUser || canDeleteUser) && (
              <DropdownMenuSeparator />
            )}
          </>
        )}
        {canEditUser && (
          <DropdownMenuItem onClick={() => onEdit(user)} className="text-xs cursor-pointer">
            <Edit className="h-3.5 w-3.5" /> Edit user
          </DropdownMenuItem>
        )}
        {canAssignPermissions && (
          <DropdownMenuItem onClick={() => onPermissions(user)} className="text-xs cursor-pointer">
            <KeyRound className="h-3.5 w-3.5" /> Assign permissions
          </DropdownMenuItem>
        )}
        {canDuplicateUser && (
          <DropdownMenuItem onClick={() => onDuplicate?.(user)} className="text-xs cursor-pointer">
            <Copy className="h-3.5 w-3.5" /> Duplicate
          </DropdownMenuItem>
        )}
        {(canEditUser || canAssignPermissions || canDuplicateUser) && canDeleteUser && (
          <DropdownMenuSeparator />
        )}
        {canDeleteUser && (
          <DropdownMenuItem
            variant="destructive"
            onClick={() => onDelete(user)}
            className="text-xs cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete user
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
