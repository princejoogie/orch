import { Effect, Stream } from "effect"
import { opencodeCall, opencodeClient, opencodeClientError, OpencodeClientError, streamOptions } from "./base.ts"

export type DashboardRefreshScope = "sessions" | "projects" | "all"
export type OpencodeEvent = { type: string }
export type OpencodeEventStreamItem = OpencodeEvent | { payload: OpencodeEvent }
export type OpencodeEventSubscription = {
  readonly stream: AsyncIterable<OpencodeEvent>
  readonly close: Effect.Effect<void>
}

export function subscribeOpencodeEvents(input: { serverUrl?: string | undefined; signal?: AbortSignal | undefined }) {
  return openOpencodeEventStream(input).pipe(
    Effect.map((subscription) =>
      Stream.fromAsyncIterable(subscription.stream, (cause) => opencodeClientError("global.event.stream", cause)).pipe(
        Stream.ensuring(subscription.close),
      ),
    ),
  )
}

export function openOpencodeEventStream(input: {
  serverUrl?: string | undefined
  signal?: AbortSignal | undefined
}): Effect.Effect<OpencodeEventSubscription, OpencodeClientError> {
  return opencodeCall("global.event", (signal) =>
    opencodeClient(input.serverUrl).global.event(streamOptions(input, signal)),
  ).pipe(Effect.map((events) => ({ stream: mapOpencodeEvents(events.stream), close: closeEventStream(events.stream) })))
}

type ClosableAsyncIterable<A> = AsyncIterable<A> & {
  readonly return?: () => IteratorResult<A> | PromiseLike<IteratorResult<A>>
}

async function* mapOpencodeEvents(stream: AsyncIterable<OpencodeEventStreamItem>): AsyncIterable<OpencodeEvent> {
  try {
    for await (const event of stream) yield opencodeEventPayload(event)
  } finally {
    await AppEventStreamClose.close(stream)
  }
}

function closeEventStream(stream: AsyncIterable<unknown>): Effect.Effect<void> {
  return Effect.tryPromise({
    try: () => AppEventStreamClose.close(stream),
    catch: () => undefined,
  }).pipe(Effect.ignore)
}

const AppEventStreamClose = {
  async close(stream: AsyncIterable<unknown>): Promise<void> {
    const iterator = stream as unknown as ClosableAsyncIterable<unknown>
    if (typeof iterator.return !== "function") return
    await iterator.return()
  },
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
