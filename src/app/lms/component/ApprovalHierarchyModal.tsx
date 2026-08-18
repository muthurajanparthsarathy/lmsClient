"use client"
import { getToken } from "@/lib/session";

import { useEffect, useMemo, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Poppins } from "next/font/google"
import {
  ArrowDown,
  ArrowUp,
  GitBranch,
  Info,
  Lock,
  Plus,
  RotateCcw,
  Save,
  UserRound,
  X,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  fetchApprovalHierarchy,
  saveApprovalHierarchy,
  type ApprovalStep,
  type AvailableRole,
  type AvailableUser,
} from "@/apiServices/userService"

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
})

interface Props {
  open: boolean
  onClose: () => void
  courseId: string
  // Optional — surfaced in the header so the manager sees which course they're
  // configuring. The Approvals page passes both; other call sites may not.
  courseName?: string
  clientName?: string
}

// A row in the editor. `userId` is empty until the manager picks a person —
// the Save button is gated on every row having both a role AND a person.
type EditorRow = { roleId: string; userId: string }

const emptyRow = (): EditorRow => ({ roleId: "", userId: "" })

export default function ApprovalHierarchyModal({
  open,
  onClose,
  courseId,
  courseName,
  clientName,
}: Props) {
  const [token, setToken] = useState<string | null>(null)
  const [institutionId, setInstitutionId] = useState<string | null>(null)
  const [rows, setRows] = useState<EditorRow[]>([])

  const queryClient = useQueryClient()

  useEffect(() => {
    setToken(getToken())
    setInstitutionId(localStorage.getItem("smartcliff_institution"))
  }, [])

  const { data, isLoading } = useQuery({
    queryKey: ["approvalHierarchy", courseId, institutionId],
    queryFn: () => fetchApprovalHierarchy(courseId, institutionId!, token!),
    enabled: open && !!courseId && !!token && !!institutionId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  })

  // Hydrate local state from server every time the modal reopens. Legacy
  // role-only steps (userId=null) come through as blank people — the Save
  // gate then forces the manager to pick a specific person before proceeding.
  useEffect(() => {
    if (!open) return
    if (data?.steps) {
      setRows(
        data.steps.map((s: ApprovalStep) => ({
          roleId: String(s.roleId || ""),
          userId: s.userId ? String(s.userId) : "",
        })),
      )
    }
  }, [open, data?.steps])

  const availableRoles: AvailableRole[] = data?.availableRoles || []
  const availableUsersByRole: Record<string, AvailableUser[]> =
    data?.availableUsersByRole || {}

  const roleName = (roleId: string) =>
    availableRoles.find((r) => String(r.roleId) === roleId)?.roleName || ""

  const userName = (roleId: string, userId: string) =>
    (availableUsersByRole[roleId] || []).find((u) => String(u.userId) === userId)?.name || ""

  // ── Row operations ──
  const addRow = () => setRows((prev) => [...prev, emptyRow()])
  const removeRow = (idx: number) => setRows((prev) => prev.filter((_, i) => i !== idx))
  const setRow = (idx: number, patch: Partial<EditorRow>) =>
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r
        // Changing role invalidates the picked person — a Manager isn't valid
        // in an HR slot. The dropdown re-populates from the new role.
        if (patch.roleId !== undefined && patch.roleId !== r.roleId) {
          return { roleId: patch.roleId, userId: "" }
        }
        return { ...r, ...patch }
      }),
    )
  const move = (idx: number, dir: -1 | 1) => {
    setRows((prev) => {
      const next = [...prev]
      const target = idx + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
  }

  const handleReset = () => {
    if (data?.steps) {
      setRows(
        data.steps.map((s: ApprovalStep) => ({
          roleId: String(s.roleId || ""),
          userId: s.userId ? String(s.userId) : "",
        })),
      )
    } else {
      setRows([])
    }
  }

  // ── Save gate ──
  // Every row must have both a role AND a person picked. Duplicate (role,user)
  // pairs are rejected server-side; we surface it here so the button reason
  // matches the eventual error.
  const invalid = useMemo(() => {
    if (rows.length === 0) return "Add at least one approval level."
    const pairSeen = new Set<string>()
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      if (!r.roleId) return `Level ${i + 1}: pick a role.`
      if (!r.userId) return `Level ${i + 1}: pick a specific person.`
      const pair = `${r.roleId}:${r.userId}`
      if (pairSeen.has(pair)) return `Level ${i + 1}: this person is already at another level with the same role.`
      pairSeen.add(pair)
    }
    return null
  }, [rows])

  const saveMutation = useMutation({
    mutationFn: () =>
      saveApprovalHierarchy(
        courseId,
        rows.map((r) => ({ roleId: r.roleId, userId: r.userId })),
        institutionId!,
        token!,
      ),
    onSuccess: (resp: any) => {
      toast.success(resp?.message || "Approval hierarchy saved", { position: "top-right" })
      queryClient.invalidateQueries({ queryKey: ["approvalHierarchy", courseId, institutionId] })
      // The saved chain lives ON the course doc, so every cached course list
      // (full + summary) is stale now — the prefix covers both. This is what
      // lets host pages (approvals chains, course-participants, batches)
      // drop their refetch-on-modal-close workarounds.
      queryClient.invalidateQueries({ queryKey: ["courseStructures"] })
      onClose()
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to save approval hierarchy", { position: "top-right" })
    },
  })

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent
        className={`${poppins.className} flex flex-col w-[calc(100vw-2rem)] max-w-3xl h-[calc(100vh-2rem)] max-h-[85vh] my-4 p-0 rounded-lg overflow-hidden`}
      >
        <DialogHeader className="shrink-0 px-5 pt-4 pb-3 border-b">
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="text-[15px] font-semibold flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-indigo-600" />
                Set Approval Hierarchy
                {data?.source === "default" && (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] h-5 px-1.5">
                    Default: L&amp;D
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="text-[12px] text-gray-500 mt-0.5">
                {courseName ? (
                  <>
                    Configure who approves for{" "}
                    <span className="font-semibold text-gray-700">{courseName}</span>
                    {clientName ? (
                      <span className="text-gray-400"> · {clientName}</span>
                    ) : null}
                    . Each level picks a specific person; notifications go only to them.
                  </>
                ) : (
                  <>Each level picks a specific person; notifications go only to them.</>
                )}
                {data?.source === "default" && (
                  <> This course has no chain of its own yet — L&amp;D approves by default. Save to customize.</>
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-5 space-y-3">
          {isLoading ? (
            <div className="text-[12px] text-gray-500 py-10 text-center">Loading…</div>
          ) : availableRoles.length === 0 ? (
            <div className="text-[12px] text-gray-500 border border-dashed rounded-md p-6 text-center">
              No approver roles found in this institution.
            </div>
          ) : (
            <>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 flex items-center justify-between">
                <span>Approval Sequence</span>
                <span className="text-gray-400 normal-case font-normal">
                  {rows.length ? `${rows.length} level${rows.length === 1 ? "" : "s"}` : "No levels yet"}
                </span>
              </div>

              {rows.length === 0 ? (
                <div className="text-[12px] text-gray-500 border border-dashed rounded-md p-6 text-center">
                  No approval levels configured yet. Add one below to start the flow.
                </div>
              ) : (
                <ol className="space-y-3">
                  {rows.map((row, i) => {
                    const roleUsers = row.roleId ? availableUsersByRole[row.roleId] || [] : []
                    const noUsers = Boolean(row.roleId) && roleUsers.length === 0
                    return (
                      <li
                        key={i}
                        className="rounded-md border border-gray-200 bg-white p-3 shadow-sm hover:border-indigo-300 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 h-7 w-7 rounded-full bg-indigo-600 text-white text-[12px] font-semibold flex items-center justify-center mt-0.5">
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                                Level {i + 1} · Role
                              </label>
                              <select
                                value={row.roleId}
                                onChange={(e) => setRow(i, { roleId: e.target.value })}
                                className="w-full h-9 rounded-md border border-gray-200 bg-white px-2.5 text-[13px] text-gray-800 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15"
                              >
                                <option value="">Select role…</option>
                                {availableRoles.map((r) => (
                                  <option key={r.roleId} value={r.roleId}>
                                    {r.roleName}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-gray-500 mb-1 flex items-center gap-1">
                                <UserRound className="h-3 w-3" /> Person
                              </label>
                              <select
                                value={row.userId}
                                onChange={(e) => setRow(i, { userId: e.target.value })}
                                disabled={!row.roleId || noUsers}
                                className="w-full h-9 rounded-md border border-gray-200 bg-white px-2.5 text-[13px] text-gray-800 disabled:bg-gray-50 disabled:text-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15"
                              >
                                <option value="">
                                  {!row.roleId
                                    ? "Pick a role first"
                                    : noUsers
                                    ? "No users in this role"
                                    : "Select person…"}
                                </option>
                                {roleUsers.map((u) => (
                                  <option key={u.userId} value={u.userId}>
                                    {u.name}
                                    {u.email ? ` · ${u.email}` : ""}
                                  </option>
                                ))}
                              </select>
                              {noUsers && (
                                <p className="mt-1 text-[10.5px] text-amber-700">
                                  No users assigned to the {roleName(row.roleId) || "selected"} role. Add
                                  one in User Management, then reopen this modal.
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col gap-0.5 pt-4">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              disabled={i === 0}
                              onClick={() => move(i, -1)}
                              title="Move up"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              disabled={i === rows.length - 1}
                              onClick={() => move(i, 1)}
                              title="Move down"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-gray-400 hover:text-red-600 mt-1"
                              onClick={() => removeRow(i)}
                              title="Remove this level"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        {row.roleId && row.userId && (
                          <div className="mt-2 pl-10 text-[11px] text-gray-500">
                            Notifications go to{" "}
                            <span className="font-medium text-gray-700">
                              {userName(row.roleId, row.userId)}
                            </span>{" "}
                            at this level.
                          </div>
                        )}
                      </li>
                    )
                  })}

                  {/* Terminal audience row — visual anchor so the flow ends in Students */}
                  <li className="flex items-center gap-2 p-2 border border-dashed rounded-md bg-gray-50">
                    <div className="flex-shrink-0 h-7 w-7 rounded-full bg-gray-300 text-white text-[12px] font-semibold flex items-center justify-center">
                      <Lock className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-gray-700">Student Access</div>
                      <div className="text-[11px] text-gray-500">
                        Visible to students after every approver above approves
                      </div>
                    </div>
                  </li>
                </ol>
              )}

              <button
                type="button"
                onClick={addRow}
                className="mt-1 inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-dashed border-indigo-300 bg-indigo-50/40 text-[12px] font-semibold text-indigo-700 hover:bg-indigo-50"
              >
                <Plus className="h-3.5 w-3.5" /> Add Approval Level
              </button>

              <div className="rounded-md bg-blue-50 border border-blue-100 p-2.5 flex items-start gap-2 mt-2">
                <Info className="h-3.5 w-3.5 text-blue-600 mt-0.5 shrink-0" />
                <div className="text-[11.5px] text-blue-800 leading-snug">
                  Each approval level names one specific person. Only that person receives the
                  approval notification and can approve or reject at their level — role membership
                  filters the picker, it does not authorize approval.
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t px-5 py-3 bg-white">
          <div className="flex items-center justify-between w-full gap-2">
            <div className="text-[11px] text-gray-500">
              {invalid ? (
                <span className="text-amber-700">{invalid}</span>
              ) : (
                <>{rows.length} approval level{rows.length === 1 ? "" : "s"} — all set</>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-3 text-xs gap-1.5"
                onClick={handleReset}
                disabled={saveMutation.isPending}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </Button>
              <Button
                size="sm"
                className="h-7 px-3 text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || Boolean(invalid)}
              >
                {saveMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    Save Hierarchy
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
