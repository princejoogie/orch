import { describe, expect, test } from "bun:test"
import type { SessionMessage } from "@opencode-ai/sdk/v2"
import { Effect } from "effect"
import { latestSessionMessagePreview, opencodeCall, streamOptions } from "../src/opencode/client/index.ts"

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

describe("opencode client boundary", () => {
  test("preserves external error details", async () => {
    const error = await Effect.runPromise(
      Effect.flip(opencodeCall("session.promptAsync", () => Promise.reject(new Error("authentication failed")))),
    )

    expect(error.message).toBe("OpenCode session.promptAsync failed: authentication failed")
  })

  test("cancels SSE retry sleep when the request is aborted", async () => {
    const external = new AbortController()
    const runtime = new AbortController()
    const options = streamOptions({ signal: external.signal }, runtime.signal)
    const sleep = options.sseSleepFn(30_000)

    external.abort()

    await sleep
    expect(options.signal.aborted).toBe(true)
  })
})
