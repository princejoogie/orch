import type { SessionRow } from "../opencode/types.ts"
import { isNeedsInput, type LaneStatus } from "./utils.ts"

export function countLane(rows: readonly SessionRow[], status: LaneStatus, now: Date | number): number {
  const laneById = sessionRowLanes(rows, now)
  return rows.filter((row) => laneById.get(row.id) === status).length
}

export function rowInLane(row: SessionRow, status: LaneStatus, now: Date | number): boolean {
  return sessionOwnLane(row, now) === status
}

export function sessionRowLanes(rows: readonly SessionRow[], now: Date | number): Map<string, LaneStatus> {
  const rowsById = new Map(rows.map((row) => [row.id, row]))
  const laneById = new Map<string, LaneStatus>()
  const stack: SessionRow[] = []
  const stackIndexById = new Map<string, number>()

  const resolveLane = (row: SessionRow): LaneStatus => {
    const cached = laneById.get(row.id)
    if (cached) return cached

    const cycleIndex = stackIndexById.get(row.id)
    if (cycleIndex !== undefined) {
      for (const member of stack.slice(cycleIndex)) laneById.set(member.id, sessionOwnLane(member, now))
      return laneById.get(row.id) ?? sessionOwnLane(row, now)
    }

    stackIndexById.set(row.id, stack.length)
    stack.push(row)

    const parent = row.parentID ? rowsById.get(row.parentID) : undefined
    const parentLane = parent ? resolveLane(parent) : undefined
    const lane =
      laneById.get(row.id) ?? (parentLane && parentLane !== "completed" ? parentLane : sessionOwnLane(row, now))
    laneById.set(row.id, lane)

    stack.pop()
    stackIndexById.delete(row.id)
    return lane
  }

  for (const row of rows) resolveLane(row)
  return laneById
}

export function projectRowsBySection(
  rows: readonly SessionRow[],
  laneById: ReadonlyMap<string, LaneStatus>,
): Record<LaneStatus, SessionRow[]> {
  return {
    working: orderRowsByHierarchy(rows.filter((row) => laneById.get(row.id) === "working")),
    "needs-input": orderRowsByHierarchy(rows.filter((row) => laneById.get(row.id) === "needs-input")),
    completed: orderRowsByHierarchy(rows.filter((row) => laneById.get(row.id) === "completed")),
  }
}

export function sessionRowDepths(
  rows: readonly SessionRow[],
  laneById: ReadonlyMap<string, LaneStatus>,
): Record<string, number> {
  const rowsById = new Map(rows.map((row) => [row.id, row]))
  const depthById = new Map<string, number>()
  const stack: SessionRow[] = []
  const stackIndexById = new Map<string, number>()

  const resolveDepth = (row: SessionRow): number => {
    const cached = depthById.get(row.id)
    if (cached !== undefined) return cached

    const cycleIndex = stackIndexById.get(row.id)
    if (cycleIndex !== undefined) {
      for (const member of stack.slice(cycleIndex)) depthById.set(member.id, 0)
      return 0
    }

    const parent = row.parentID ? rowsById.get(row.parentID) : undefined
    if (!parent || laneById.get(parent.id) !== laneById.get(row.id)) {
      depthById.set(row.id, 0)
      return 0
    }

    stackIndexById.set(row.id, stack.length)
    stack.push(row)
    const depth = depthById.get(row.id) ?? resolveDepth(parent) + 1
    depthById.set(row.id, depth)
    stack.pop()
    stackIndexById.delete(row.id)
    return depth
  }

  for (const row of rows) resolveDepth(row)
  return Object.fromEntries(depthById)
}

function sessionOwnLane(row: SessionRow, now: Date | number): LaneStatus {
  if (isNeedsInput(row, now)) return "needs-input"
  return row.status
}

function orderRowsByHierarchy(rows: SessionRow[]): SessionRow[] {
  const rowsById = new Map(rows.map((row) => [row.id, row]))
  const childrenByParentId = new Map<string, SessionRow[]>()

  for (const row of rows) {
    if (!row.parentID || !rowsById.has(row.parentID)) continue
    const children = childrenByParentId.get(row.parentID) ?? []
    children.push(row)
    childrenByParentId.set(row.parentID, children)
  }

  const ordered: SessionRow[] = []
  const visited = new Set<string>()

  const appendBranch = (row: SessionRow) => {
    if (visited.has(row.id)) return
    visited.add(row.id)
    ordered.push(row)
    for (const child of childrenByParentId.get(row.id) ?? []) appendBranch(child)
  }

  for (const row of rows) {
    if (row.parentID && rowsById.has(row.parentID)) continue
    appendBranch(row)
  }

  for (const row of rows) appendBranch(row)
  return ordered
}
