import { describe, expect, test } from "bun:test"
import { moveSelection, moveSelectionClamped, type LaneStatus, type Selection } from "../src/lib/utils.ts"
import type { SessionRow } from "../src/opencode.ts"

const row = (id: string, status: SessionRow["status"]): SessionRow => ({
  id,
  title: id,
  latestMessage: "",
  latestUserMessage: "",
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

describe("selection movement", () => {
  test("moveSelection wraps around list edges", () => {
    expect(moveSelection({ section: "completed", index: 1 }, 1, rowsBySection)).toEqual({
      section: "working",
      index: 0,
    })
    expect(moveSelection({ section: "working", index: 0 }, -1, rowsBySection)).toEqual({
      section: "completed",
      index: 1,
    })
  })

  test("moveSelectionClamped stops at list edges", () => {
    expect(moveSelectionClamped({ section: "completed", index: 0 }, 10, rowsBySection)).toEqual({
      section: "completed",
      index: 1,
    } satisfies Selection)
    expect(moveSelectionClamped({ section: "working", index: 1 }, -10, rowsBySection)).toEqual({
      section: "working",
      index: 0,
    } satisfies Selection)
  })
})
