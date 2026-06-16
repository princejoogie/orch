import { describe, expect, test } from "bun:test"
import {
  dashboardRefreshScopeForEvent,
  opencodeEventPayload,
  type OpencodeEvent,
  type OpencodeEventStreamItem,
} from "../src/opencode/client/index.ts"

describe("opencode events", () => {
  test("unwraps global event payloads before dashboard refresh routing", () => {
    const payload = {
      id: "event-1",
      type: "session.status",
      properties: { sessionID: "session-1", status: { type: "idle" } },
    } as OpencodeEvent
    const globalEvent = {
      directory: "/repo",
      payload,
    } as OpencodeEventStreamItem

    expect(opencodeEventPayload(globalEvent)).toBe(payload)
    expect(dashboardRefreshScopeForEvent(opencodeEventPayload(globalEvent))).toBe("sessions")
  })
})
