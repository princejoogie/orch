import { describe, expect, test } from "bun:test"
import {
  displayWorktreeName,
  formatAge,
  moveSelection,
  moveSelectionClamped,
  normalizeSelection,
  type LaneStatus,
  type Selection,
} from "../src/lib/utils.ts"
import { rowInLane } from "../src/lib/session-hierarchy.ts"
import type { SessionRow } from "../src/opencode/client/index.ts"

const row = (id: string, status: SessionRow["status"]): SessionRow => ({
  id,
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
  updated: 0,
  status,
})

const rowsBySection: Record<LaneStatus, SessionRow[]> = {
  working: [row("w1", "working"), row("w2", "working")],
  "needs-input": [row("n1", "completed")],
  completed: [row("c1", "completed"), row("c2", "completed")],
}

describe("formatAge", () => {
  const now = new Date(2 * 24 * 60 * 60 * 1000)

  test("formats sub-day ages with seconds, minutes, and hours", () => {
    expect(formatAge(now.getTime() - 12 * 1000, now)).toBe("12s")
    expect(formatAge(now.getTime() - 12 * 60 * 1000, now)).toBe("12m")
    expect(formatAge(now.getTime() - 12 * 60 * 60 * 1000, now)).toBe("12h")
  })

  test("formats ages of at least one day with d suffix", () => {
    expect(formatAge(now.getTime() - 24 * 60 * 60 * 1000, now)).toBe("1d")
    expect(formatAge(now.getTime() - 47 * 60 * 60 * 1000, now)).toBe("1d")
    expect(formatAge(now.getTime() - 48 * 60 * 60 * 1000, now)).toBe("2d")
  })
})

describe("displayWorktreeName", () => {
  test("trims opencode branch prefix from display names", () => {
    expect(displayWorktreeName("opencode/add-session-dialog")).toBe("add-session-dialog")
    expect(displayWorktreeName("feature/add-session-dialog")).toBe("feature/add-session-dialog")
  })
})

describe("selection movement", () => {
  test("moveSelection wraps around list edges", () => {
    expect(moveSelection({ type: "row", section: "completed", index: 1 }, 1, rowsBySection)).toEqual({
      type: "section",
      section: "working",
      index: 0,
    })
    expect(moveSelection({ type: "section", section: "working", index: 0 }, -1, rowsBySection)).toEqual({
      type: "row",
      section: "completed",
      index: 1,
      sessionId: "c2",
    })
  })

  test("moveSelectionClamped stops at list edges", () => {
    expect(moveSelectionClamped({ type: "row", section: "completed", index: 0 }, 10, rowsBySection)).toEqual({
      type: "row",
      section: "completed",
      index: 1,
      sessionId: "c2",
    } satisfies Selection)
    expect(moveSelectionClamped({ type: "row", section: "working", index: 1 }, -10, rowsBySection)).toEqual({
      type: "section",
      section: "working",
      index: 0,
    } satisfies Selection)
  })

  test("normalizeSelection follows session id after row order changes", () => {
    const reorderedRowsBySection: Record<LaneStatus, SessionRow[]> = {
      ...rowsBySection,
      working: [row("w3", "working"), row("w1", "working"), row("w2", "working")],
    }

    expect(
      normalizeSelection({ type: "row", section: "working", index: 1, sessionId: "w2" }, reorderedRowsBySection),
    ).toEqual({
      type: "row",
      section: "working",
      index: 2,
      sessionId: "w2",
    } satisfies Selection)
  })

  test("collapsed sections keep the lane title selectable and skip hidden rows", () => {
    expect(
      moveSelection({ type: "section", section: "working", index: 0 }, 1, rowsBySection, { working: true }),
    ).toEqual({
      type: "section",
      section: "needs-input",
      index: 0,
    } satisfies Selection)
    expect(
      normalizeSelection({ type: "row", section: "working", index: 0, sessionId: "w1" }, rowsBySection, {
        working: true,
      }),
    ).toEqual({ type: "section", section: "working", index: 0 } satisfies Selection)
  })
})

describe("lane filtering", () => {
  test("completed rows need input for less than four hours", () => {
    const now = 4 * 60 * 60 * 1000
    const justInsideWindow = row("recent", "completed")
    justInsideWindow.updated = now - 1
    const atWindow = row("old", "completed")
    atWindow.updated = 0

    expect(rowInLane(justInsideWindow, "needs-input", now)).toBe(true)
    expect(rowInLane(atWindow, "needs-input", now)).toBe(false)
    expect(rowInLane(atWindow, "completed", now)).toBe(true)
  })

  test("rows with pending permissions need input even while working", () => {
    const now = 0
    const pendingPermission = row("permission", "working")
    pendingPermission.pendingPermissionRequests = [
      {
        id: "perm_1",
        sessionID: pendingPermission.id,
        permission: "bash",
        patterns: ["git status"],
        summary: "Permission requested: bash git status",
      },
    ]

    expect(rowInLane(pendingPermission, "needs-input", now)).toBe(true)
    expect(rowInLane(pendingPermission, "working", now)).toBe(false)
  })
})
