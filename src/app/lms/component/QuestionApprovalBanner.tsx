"use client"
import { getToken } from "@/lib/session";

// Shared "Request Approve" action for question forms.
// When the question being edited has an open query in the current workflow
// step, a compact "Request Approve" button is rendered as a floating bottom-
// right action — visually near where forms place their Update & Continue
// button. No banner UI; the host form doesn't need any layout changes.

import { useMemo, useState } from "react"
import { ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { resolveQuestionQuery, type QuestionContext } from "@/app/lms/pages/usermanagement/api/userService"

export type QuestionApprovalQuery = {
  raisedBy?: string
  raisedByName?: string
  raisedAt?: string
  text?: string
  resolvedAt?: string | null
  resolutionNote?: string
}

export type QuestionApprovalState = {
  status?: 'pending' | 'queried' | 'approved' | 'rejected'
  queries?: QuestionApprovalQuery[]
  rejectionMessage?: string
  editedSinceReject?: boolean
}

interface BannerProps {
  approval: QuestionApprovalState | null | undefined
  context: QuestionContext  // entityType, entityId, tabType, subcategory, exerciseId, questionId
  onResolved?: () => void   // called after a successful Approve so the form can refetch
}

// Returns the open query (the last unresolved one) or null.
export function getOpenQuery(approval: QuestionApprovalState | null | undefined): QuestionApprovalQuery | null {
  if (!approval || approval.status !== 'queried') return null
  const arr = Array.isArray(approval.queries) ? approval.queries : []
  for (let i = arr.length - 1; i >= 0; i--) {
    if (!arr[i].resolvedAt) return arr[i]
  }
  return null
}

// Renders nothing on its own — kept as a compat shim so existing form
// integrations don't break. Use `RequestApproveButton` inline next to the
// form's Save / Update & Continue button instead.
export function QuestionApprovalBanner(_props: BannerProps) {
  return null
}

// Inline "Request Approve" button. Renders nothing when there's no open
// query. Place it next to the form's Save / Update & Continue button.
export function RequestApproveButton({ approval, context, onResolved }: BannerProps) {
  const open = useMemo(() => getOpenQuery(approval), [approval])
  const [busy, setBusy] = useState(false)
  if (!open) return null

  const handle = async () => {
    setBusy(true)
    try {
      const token = getToken() || ''
      await resolveQuestionQuery(context, undefined, token)
      toast.success('Request sent. Approver notified.', { position: 'top-right' })
      onResolved?.()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send request', { position: 'top-right' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      type="button"
      onClick={handle}
      disabled={busy}
      className="h-8 px-3 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 shrink-0"
    >
      <ShieldCheck className="h-3.5 w-3.5" />
      {busy ? 'Sending…' : 'Request Approve'}
    </Button>
  )
}

// Helper for forms that auto-derive the approval context from initialData
// (the parent doesn't have to compute entityType/entityId/etc.).
export function deriveApprovalContext(initialData: any, exerciseData: any, tabType: string): QuestionContext | null {
  if (!initialData?._id || !exerciseData) return null
  const map: any = { module: 'modules', submodule: 'submodules', topic: 'topics', subtopic: 'subtopics' }
  const entityType = map[(exerciseData.nodeType || '').toLowerCase().trim()] || 'topics'
  const entityId = exerciseData.nodeId || ''
  const exerciseId = exerciseData.exerciseId || exerciseData.fullExerciseData?._id || exerciseData.id || ''
  const subcategory = exerciseData.subcategory || 'assignments'
  if (!entityId || !exerciseId) return null
  return {
    entityType,
    entityId: String(entityId),
    tabType: (tabType === 'We_Do' ? 'We_Do' : 'You_Do'),
    subcategory,
    exerciseId: String(exerciseId),
    questionId: String(initialData._id),
  }
}

// Renders the Approve button when an open query exists. Place next to Save.
export function QuestionApproveButton({
  approval, context, onResolved, disabled, size = 'sm',
}: {
  approval: QuestionApprovalState | null | undefined
  context: QuestionContext
  onResolved?: () => void
  disabled?: boolean
  size?: 'sm' | 'md'
}) {
  const open = getOpenQuery(approval)
  const [busy, setBusy] = useState(false)

  if (!open) return null

  const handle = async () => {
    setBusy(true)
    try {
      const token = getToken() || ''
      await resolveQuestionQuery(context, undefined, token)
      toast.success('Marked as addressed. Approver notified.', { position: 'top-right' })
      onResolved?.()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to mark as addressed', { position: 'top-right' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      type="button"
      onClick={handle}
      disabled={busy || disabled}
      className={`gap-1.5 ${size === 'sm' ? 'h-7 px-3 text-xs' : 'h-8 px-4 text-sm'} bg-emerald-600 hover:bg-emerald-700`}
    >
      <ShieldCheck className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      {busy ? 'Marking…' : 'Approve'}
    </Button>
  )
}
