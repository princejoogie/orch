import { opencodeClient } from "./base.ts"

export type DashboardRefreshScope = "sessions" | "projects" | "all"
export type OpencodeEvent = { type: string }
export type OpencodeEventStreamItem = OpencodeEvent | { payload: OpencodeEvent }

export async function subscribeOpencodeEvents(input: {
  serverUrl?: string | undefined
  signal?: AbortSignal | undefined
}): Promise<AsyncGenerator<OpencodeEvent, void, unknown>> {
  const events = await opencodeClient(input.serverUrl).global.event({
    ...(input.signal !== undefined ? { signal: input.signal } : {}),
  })
  return opencodeEventStream(events.stream)
}

export function opencodeEventPayload(event: OpencodeEventStreamItem): OpencodeEvent {
  return "payload" in event ? event.payload : event
}

async function* opencodeEventStream(
  stream: AsyncIterable<OpencodeEventStreamItem>,
): AsyncGenerator<OpencodeEvent, void, unknown> {
  for await (const event of stream) yield opencodeEventPayload(event)
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
