"use client"
import { getToken } from "@/lib/session";
import { API_BASE_URL } from "@/lib/http";
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { X, Save, Loader2 } from "lucide-react"
import { toast } from "react-toastify"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  TreePermissionSelector,
  type SelectionState,
  selectionFromStored,
  storedFromSelection,
} from "@/app/lms/pages/usermanagement/components/permissions/TreePermissionSelector"
import { defaultSelectionForNewUser, classifyRole } from "@/app/lms/pages/usermanagement/config/permissions.helpers"

interface PermissionModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  userName: string
  userEmail: string
  // Optional I/O overrides. When omitted the modal keeps its original LMS
  // behavior (fetch/PUT via getToken to the /user endpoints). The Super Admin
  // console injects these to (a) load/save through its own authenticated
  // endpoints for an existing user, or (b) collect a selection for a not-yet-
  // created user (Add User) without hitting the network.
  loadPermissions?: () => Promise<any[]>
  savePermissions?: (permissions: any[]) => Promise<any> | void
  saveLabel?: string
  // When provided, the catalog (and its role categories) is limited to
  // permissions whose id is in this list — used to constrain Add User / Assign
  // Permission to an institution's allow-list. Omit for the full catalog.
  allowedIds?: string[]
  // When provided, each permission's "Available Functions" is limited to the
  // function ids in this map (keyed by permission id) — so a user can only be
  // granted the functions the institution enabled. Omit for all functions.
  allowedFunctions?: Record<string, string[]>
  // The role of the account being edited (renameRole / originalRole — anything
  // classifyRole understands). A STUDENT is shown the Student catalog only:
  // granting a learner an Admin or Trainer page is never the intent, and the
  // tabs invited exactly that mistake. Every other role still sees all three
  // categories. Omit entirely for the institution-level Permission Management
  // in the Super Admin console, which is not scoped to one person's role.
  roleName?: string
}

type CategoryTab = "all" | "admin" | "staff" | "student"

export function PermissionModal({ isOpen, onClose, userId, userName, userEmail, loadPermissions, savePermissions, saveLabel, allowedIds, allowedFunctions, roleName }: PermissionModalProps) {
  // A learner's catalog is the Student tree and nothing else, so the tab strip
  // has one reachable value and is hidden rather than shown with three tabs
  // that must not be used. Any other role keeps the full All/Admin/Staff/
  // Student picker.
  const studentOnly = !!roleName && classifyRole(roleName) === "student"

  const [selection, setSelection] = useState<SelectionState>({})
  const [category, setCategory] = useState<CategoryTab>(studentOnly ? "student" : "all")
  const [search, setSearch] = useState("")
  const [customSaving, setCustomSaving] = useState(false)
  const queryClient = useQueryClient()
  const token = getToken()

  // Map a backend/embedded permissions array onto the modal's local selection
  // state. Shared by the LMS fetch path and the injected loadPermissions path.
  //
  // When the incoming list is empty (new user just created — Add User →
  // Configure Permissions), pre-check the default baseline pages from the
  // tree (currently the role dashboards) so admins don't start from zero
  // every time. Existing users keep exactly what they had.
  const applyBackendPermissions = (backendPermissions: any[]) => {
    const resolved = selectionFromStored(backendPermissions || [])
    if (Object.keys(resolved).length === 0) {
      setSelection(defaultSelectionForNewUser())
      return
    }
    setSelection(resolved)
  }

  const updateMutation = useMutation({
    mutationFn: async (permissions: any[]) => {
      const response = await fetch(`${API_BASE_URL}/user-permission/update/${userId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ permissions })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message?.[0]?.value || 'Failed to update permissions')
      }

      return response.json()
    },
    onSuccess: (data) => {
      // Refetches the users list, whose rows embed each user's permissions.
      // (Effective now that the list has no module-level cache underneath —
      // this invalidation used to be served stale by userService's 15-min
      // cache. The old ['user-permissions', userId] invalidation was dangling:
      // no query anywhere registers that key.)
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success(data.message?.[0]?.value || "Permissions updated successfully")
      onClose()
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update permissions")
      console.error("Update error:", error)
    }
  })

  useEffect(() => {
    if (!isOpen) return

    setSelection({})
    setSearch("")
    setCategory(studentOnly ? "student" : "all")

    // 1. Injected loader (Super Admin console — its own auth, or a local
    //    collect-mode selection for a not-yet-created user).
    if (loadPermissions) {
      Promise.resolve(loadPermissions())
        .then(perms => applyBackendPermissions(perms || []))
        .catch(() => setSelection(defaultSelectionForNewUser()))
      return
    }

    // 2. Original LMS path — fetch this user's saved permissions.
    if (userId) {
      fetch(`${API_BASE_URL}/user/get-permission/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.ok ? res.json() : Promise.reject())
        .then(data => {
          // Both branches route through applyBackendPermissions so the
          // new-user default pre-check runs when the API returns no rows too.
          applyBackendPermissions(data.data?.permissions || [])
        })
        .catch(() => {
          toast.error("Failed to load permissions")
          setSelection(defaultSelectionForNewUser())
        })
      return
    }

    // 3. No source (collect mode with no initial data) — start from defaults.
    setSelection(defaultSelectionForNewUser())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, userId, token, loadPermissions])

  const selectedPageCount = Object.keys(selection).length
  const getTotalSelectedFunctionalities = () =>
    Object.values(selection).reduce((total, funcs) => total + funcs.size, 0)

  const handleClearAll = () => setSelection({})

  const handleSave = () => {
    if (selectedPageCount === 0) {
      toast.error("Please select at least one permission")
      return
    }

    const permissionsArray = storedFromSelection(selection)

    // Injected saver (Super Admin console) takes precedence over the LMS mutation.
    if (savePermissions) {
      setCustomSaving(true)
      Promise.resolve(savePermissions(permissionsArray))
        .then(() => { toast.success("Permissions updated successfully"); onClose() })
        .catch((e: any) => toast.error(e?.message || "Failed to update permissions"))
        .finally(() => setCustomSaving(false))
      return
    }

    updateMutation.mutate(permissionsArray)
  }

  const tabs: CategoryTab[] = ["all", "admin", "staff", "student"]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {/* The kit's own close button is suppressed and re-rendered inside the
          header below, so the red treatment lands here WITHOUT restyling the
          shared Dialog every other modal in the app uses. */}
      <DialogContent className="max-w-5xl max-h-[90vh] p-0 overflow-hidden" showCloseButton={false}>
        <div className="flex flex-col h-[80vh]">
          {/* Header */}
          <DialogHeader className="p-4 border-b bg-white">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-sm font-semibold text-gray-900">
                  Permissions for {userName}
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-600">
                  {userEmail}
                </DialogDescription>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-danger-500 text-white transition-colors hover:bg-danger-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-danger-500/40"
              >
                <X className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>
          </DialogHeader>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search…"
                  className="flex-1 px-3 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
                {!studentOnly && (
                  <div className="flex gap-1">
                    {tabs.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCategory(c)}
                        className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                          category === c
                            ? "bg-orange-500 text-white border border-orange-500"
                            : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {c === "all" ? "All" : c[0].toUpperCase() + c.slice(1)}
                      </button>
                    ))}
                  </div>
                )}
                {/* Red because it IS destructive — one click drops every
                    permission on the account. Outlined rather than solid so it
                    does not compete with Save Changes for primary weight. */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  className="h-7 px-2.5 text-xs font-medium text-danger-500 border border-danger-500/30 hover:bg-danger-50 hover:text-danger-700"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear All
                </Button>
              </div>
              <TreePermissionSelector
                selection={selection}
                onChange={setSelection}
                category={category}
                search={search}
                allowedIds={allowedIds}
                allowedFunctions={allowedFunctions}
              />
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="p-3 border-t bg-white">
            <div className="flex items-center justify-between w-full">
              <div className="text-xs text-gray-600">
                {selectedPageCount > 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{selectedPageCount} permission(s)</span>
                    <span className="text-gray-400">•</span>
                    <span>{getTotalSelectedFunctionalities()} function(s)</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    <span className="text-amber-700">No permissions selected</span>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={updateMutation.isPending || customSaving}
                  size="sm"
                  className="h-8 px-3 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={updateMutation.isPending || customSaving || selectedPageCount === 0}
                  className="bg-orange-600 hover:bg-orange-700 h-8 px-3 text-xs"
                  size="sm"
                >
                  {updateMutation.isPending || customSaving ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-3 w-3 mr-1.5" />
                      {saveLabel || "Save Changes"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
