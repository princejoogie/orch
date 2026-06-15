import { describe, expect, test } from "bun:test"
import type { Session } from "@opencode-ai/sdk/v2"
import { projectDirectoryItems, sessionListItems } from "../src/opencode/client/index.ts"

const session = { id: "session-1" } as Session

describe("opencode snapshot", () => {
  test("reads project sessions from array and paged list responses", () => {
    expect(sessionListItems([session])).toEqual([session])
    expect(sessionListItems({ items: [session] })).toEqual([session])
  })

  test("reads project directories from string and object responses", () => {
    expect(projectDirectoryItems(["/repo", { directory: "/repo-worktree" }, { directory: 42 }, null])).toEqual([
      "/repo",
      "/repo-worktree",
    ])
  })
})
