import { describe, expect, test } from "bun:test"
import { countLane, projectRowsBySection, sessionRowDepths, sessionRowLanes } from "../src/lib/session-hierarchy.ts"
import type { SessionRow } from "../src/opencode/types.ts"

const HOUR_MS = 60 * 60 * 1000

function row(
  id: string,
  status: SessionRow["status"],
  options: { parentID?: string; updated?: number } = {},
): SessionRow {
  return {
    id,
    ...(options.parentID ? { parentID: options.parentID } : {}),
    title: id,
    latestMessage: "",
    latestUserMessage: "",
    messages: [],
    hasMoreMessages: false,
    pendingPermissionRequests: [],
    directory: "/tmp",
    projectID: "project",
    projectTitle: "Project",
    worktreeName: "main",
    updated: options.updated ?? 0,
    status,
  }
}

describe("session hierarchy", () => {
  const now = 5 * HOUR_MS

  test("keeps descendants with a non-completed parent and orders the family together", () => {
    const parent = row("parent", "working")
    const child = row("child", "completed", { parentID: parent.id })
    const grandchild = row("grandchild", "completed", { parentID: child.id })
    const other = row("other", "completed")
    const rows = [parent, other, child, grandchild]
    const lanes = sessionRowLanes(rows, now)
    const sections = projectRowsBySection(rows, lanes)

    expect(sections.working.map((item) => item.id)).toEqual(["parent", "child", "grandchild"])
    expect(sections.completed.map((item) => item.id)).toEqual(["other"])
    expect(sessionRowDepths(rows, lanes)).toEqual({ parent: 0, other: 0, child: 1, grandchild: 2 })
    expect(countLane(rows, "working", now)).toBe(3)
  })

  test("preserves inherited lanes when a visible child is filtered away from its parent", () => {
    const parent = row("parent", "working")
    const child = row("child", "completed", { parentID: parent.id })
    const lanes = sessionRowLanes([parent, child], now)
    const sections = projectRowsBySection([child], lanes)

    expect(sections.working.map((item) => item.id)).toEqual(["child"])
    expect(sessionRowDepths([child], lanes)).toEqual({ child: 0 })
  })

  test("resets child indentation when a completed parent is in another lane", () => {
    const parent = row("parent", "completed")
    const child = row("child", "working", { parentID: parent.id })
    const rows = [parent, child]
    const lanes = sessionRowLanes(rows, now)

    expect(projectRowsBySection(rows, lanes).working.map((item) => item.id)).toEqual(["child"])
    expect(sessionRowDepths(rows, lanes)).toEqual({ parent: 0, child: 0 })
  })

  test("inherits a recent completed parent's needs-input lane", () => {
    const parent = row("parent", "completed", { updated: now - HOUR_MS })
    const child = row("child", "completed", { parentID: parent.id })
    const rows = [parent, child]

    expect(countLane(rows, "needs-input", now)).toBe(2)
  })

  test("elevates a working family when a child needs input", () => {
    const parent = row("parent", "working")
    const child = row("child", "working", { parentID: parent.id })
    child.pendingPermissionRequests = [
      {
        id: "permission",
        sessionID: child.id,
        permission: "bash",
        patterns: ["git status"],
        summary: "Permission requested: bash git status",
      },
    ]
    const rows = [parent, child]
    const lanes = sessionRowLanes(rows, now)

    expect(projectRowsBySection(rows, lanes)["needs-input"].map((item) => item.id)).toEqual(["parent", "child"])
    expect(countLane(rows, "working", now)).toBe(0)
    expect(countLane(rows, "needs-input", now)).toBe(2)
  })

  test("uses each row's own lane and zero depth for malformed parent cycles", () => {
    const first = row("first", "working", { parentID: "second" })
    const second = row("second", "completed", { parentID: "first" })
    const rows = [first, second]
    const lanes = sessionRowLanes(rows, now)

    expect(Object.fromEntries(lanes)).toEqual({ first: "working", second: "completed" })
    expect(sessionRowDepths(rows, lanes)).toEqual({ first: 0, second: 0 })
  })
})
