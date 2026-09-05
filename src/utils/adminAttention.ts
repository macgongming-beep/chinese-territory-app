import type { ReturnVisit } from '../types'

export type AttentionUser = {
  name: string
  approvalStatus?: 'pending' | 'approved' | 'blocked'
  isActive?: boolean
}

export function getActiveApprovedUserNames(users: AttentionUser[]): Set<string> {
  return new Set(
    users
      .filter((user) => user.isActive !== false && (!user.approvalStatus || user.approvalStatus === 'approved'))
      .map((user) => user.name.trim())
      .filter(Boolean),
  )
}

export function isReturnVisitAssigneeBroken(returnVisit: ReturnVisit, activeNames: Set<string>): boolean {
  const assignee = returnVisit.assignedUserName.trim()
  return !assignee || !activeNames.has(assignee)
}

export function countBrokenReturnVisits(returnVisits: ReturnVisit[], users: AttentionUser[]): number {
  const activeNames = getActiveApprovedUserNames(users)
  return returnVisits.filter((returnVisit) => isReturnVisitAssigneeBroken(returnVisit, activeNames)).length
}
