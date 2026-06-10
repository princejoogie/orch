import { describe, expect, test } from "bun:test"
import type { SessionMessage } from "@opencode-ai/sdk/v2"
import { latestSessionMessagePreview } from "../src/opencode/client/index.ts"

const userMessage = (id: string, text: string, created = 0): Extract<SessionMessage, { type: "user" }> => ({
  id,
  time: { created },
  text,
  type: "user",
})

const assistantMessage = (id: string, text: string, created = 0): Extract<SessionMessage, { type: "assistant" }> => ({
  id,
  time: { created },
  type: "assistant",
  agent: "build",
  model: { id: "model", providerID: "provider", variant: "default" },
  content: [{ id: `${id}:text`, type: "text", text }],
})

const assistantError = (id: string, message: string, created = 0): Extract<SessionMessage, { type: "assistant" }> => ({
  id,
  time: { created },
  type: "assistant",
  agent: "build",
  model: { id: "model", providerID: "provider", variant: "default" },
  content: [],
  error: { type: "unknown", message },
})

describe("latest session message preview", () => {
  test("uses the newest user prompt when it has no assistant response yet", () => {
    expect(
      latestSessionMessagePreview([
        userMessage("user-2", "queued prompt", 2),
        assistantError("assistant-1", "old failure", 1),
      ]),
    ).toEqual({
      message: "queued prompt",
      userMessage: "queued prompt",
    })
  })

  test("uses newest assistant text before older user text", () => {
    expect(
      latestSessionMessagePreview([
        assistantMessage("assistant-2", "latest answer", 2),
        userMessage("user-1", "older prompt", 1),
      ]),
    ).toEqual({
      message: "latest answer",
      userMessage: "older prompt",
    })
  })

  test("surfaces newest assistant response errors", () => {
    expect(
      latestSessionMessagePreview([
        assistantError("assistant-2", "request failed", 2),
        userMessage("user-1", "older prompt", 1),
      ]),
    ).toEqual({
      message: "Error: request failed",
      userMessage: "older prompt",
      latestResponseError: "request failed",
    })
  })
})
