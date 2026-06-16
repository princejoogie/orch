import { Effect, Stream } from "effect"
import { opencodeCall, OpencodeClientError, opencodeClient, streamOptions } from "./base.ts"

export type DashboardRefreshScope = "sessions" | "projects" | "all"
export type OpencodeEvent = { type: string }
export type OpencodeEventStreamItem = OpencodeEvent | { payload: OpencodeEvent }

export function subscribeOpencodeEvents(input: { serverUrl?: string | undefined; signal?: AbortSignal | undefined }) {
  return opencodeCall("global.event", (signal) =>
    opencodeClient(input.serverUrl).global.event(streamOptions(input, signal)),
  ).pipe(
    Effect.map((events) =>
      Stream.fromAsyncIterable(
        events.stream,
        (cause) =>
          new OpencodeClientError({
            message: "OpenCode global.event stream failed",
            operation: "global.event.stream",
            cause,
          }),
      ).pipe(Stream.map(opencodeEventPayload)),
    ),
  )
}

export function opencodeEventPayload(event: OpencodeEventStreamItem): OpencodeEvent {
  return "payload" in event ? event.payload : event
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
