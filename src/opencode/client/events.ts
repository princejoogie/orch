import type { Event as OpencodeEvent } from "@opencode-ai/sdk/v2"
import { opencodeClient } from "./base.ts"

export type DashboardRefreshScope = "sessions" | "projects" | "all"

export async function subscribeOpencodeEvents(input: {
  serverUrl?: string | undefined
  signal?: AbortSignal | undefined
}): Promise<AsyncGenerator<OpencodeEvent, void, unknown>> {
  const events = await opencodeClient(input.serverUrl).event.subscribe(undefined, {
    ...(input.signal !== undefined ? { signal: input.signal } : {}),
  })
  return events.stream
}

export function dashboardRefreshScopeForEvent(event: OpencodeEvent): DashboardRefreshScope | undefined {
  const type = event.type
  if (
    type === "project.updated" ||
    type === "project.directories.updated" ||
    type === "worktree.ready" ||
    type === "worktree.failed" ||
    type === "session.created" ||
    type === "session.deleted" ||
    type === "session.next.moved"
  ) {
    return "all"
  }

  if (
    type === "session.updated" ||
    type === "session.status" ||
    type === "session.idle" ||
    type === "session.compacted" ||
    type === "session.diff" ||
    type === "session.error" ||
    type === "message.updated" ||
    type === "message.removed" ||
    type === "message.part.updated" ||
    type === "message.part.removed" ||
    type === "todo.updated" ||
    type === "permission.asked" ||
    type === "permission.replied" ||
    type === "permission.v2.asked" ||
    type === "permission.v2.replied"
  ) {
    return "sessions"
  }

  if (type.startsWith("session.next.") && !type.endsWith(".delta")) return "sessions"

  return undefined
}
