import { describe, expect, test } from "bun:test"
import type { Session } from "@opencode-ai/sdk/v2"
import { sessionListItems } from "../src/opencode/snapshot.ts"

const session = { id: "session-1" } as Session

describe("opencode snapshot", () => {
  test("reads project sessions from array and paged list responses", () => {
    expect(sessionListItems([session])).toEqual([session])
    expect(sessionListItems({ items: [session] })).toEqual([session])
  })
})
