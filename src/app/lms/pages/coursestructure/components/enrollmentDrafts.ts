export type EnrollmentDrafts = Record<string, string[]>

export interface RosterUser {
  _id?: string
  id?: string
  role?: string | { renameRole?: string }
}

export interface RosterBatch {
  batchName?: string
  phase?: string
  users?: { user?: RosterUser | string | null }[]
}

export const cohortKey = (phase: string, batchName: string) =>
  JSON.stringify([phase, batchName])

export const readCohortKey = (key: string): [string, string] => JSON.parse(key)

export const rosterUserId = (user: RosterUser | string | null | undefined) =>
  typeof user === 'string' ? user : String(user?._id || user?.id || '')

export const memberIds = (batch?: RosterBatch): string[] =>
  [...new Set((batch?.users || []).map(({ user }) => rosterUserId(user)).filter(Boolean))]

/** Build editable destination selections from SAVED source enrolments. Existing
 * destination selections remain, and students already in a different target
 * batch are skipped to respect the server's one-batch-per-phase rule. */
export function copyPhaseSelections(
  roster: RosterBatch[],
  sourcePhase: string,
  targetPhase: string,
  checked: EnrollmentDrafts,
  initial: EnrollmentDrafts,
) {
  const nextChecked = { ...checked }
  const nextInitial = { ...initial }
  const skippedUsers = new Set<string>()
  const unmatchedBatches: string[] = []
  let added = 0
  let matchedBatches = 0
  if (!sourcePhase || !targetPhase || sourcePhase === targetPhase) {
    return { checked: nextChecked, initial: nextInitial, added, matchedBatches, skippedUsers: [], unmatchedBatches }
  }

  const normalize = (name?: string) => (name || '').trim().toLowerCase()
  const targets = roster.filter((b) => b.phase === targetPhase)
  const source = roster.filter((b) => b.phase === sourcePhase)
  const staff = new Set<string>()
  roster.forEach((b) => (b.users || []).forEach(({ user }) => {
    if (!user || typeof user === 'string') return
    const role = typeof user.role === 'string' ? user.role : user.role?.renameRole
    if (role && role.trim().toLowerCase() !== 'student') staff.add(rosterUserId(user))
  }))

  // Use the current drafts when available, including any checkbox removals.
  const assigned = new Map<string, string>()
  targets.forEach((batch) => {
    const key = cohortKey(targetPhase, batch.batchName || '')
    for (const id of checked[key] ?? memberIds(batch)) {
      if (!staff.has(id)) assigned.set(id, key)
    }
  })

  source.forEach((batch) => {
    const matches = targets.filter((b) => normalize(b.batchName) === normalize(batch.batchName))
    if (matches.length !== 1) {
      unmatchedBatches.push(batch.batchName || 'Unnamed batch')
      return
    }
    matchedBatches++
    const target = matches[0]
    const key = cohortKey(targetPhase, target.batchName || '')
    nextInitial[key] = initial[key] ?? memberIds(target)
    const selected = new Set(nextChecked[key] ?? nextInitial[key])
    for (const id of memberIds(batch)) {
      if (selected.has(id)) continue
      if (!staff.has(id) && assigned.has(id) && assigned.get(id) !== key) {
        skippedUsers.add(id)
        continue
      }
      selected.add(id)
      added++
      if (!staff.has(id)) assigned.set(id, key)
    }
    nextChecked[key] = [...selected]
  })

  return {
    checked: nextChecked, initial: nextInitial, added, matchedBatches,
    skippedUsers: [...skippedUsers], unmatchedBatches,
  }
}
