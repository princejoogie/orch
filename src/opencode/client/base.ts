import { createOpencodeClient } from "@opencode-ai/sdk/v2"
import { Data, Effect } from "effect"
import { DEFAULT_OPENCODE_SERVER_URL, defaultOpencodeServerUrl, normalizeServerUrl } from "../../config/orch.ts"

export const DEFAULT_LIMIT = 100

export function opencodeServerUrl(): string {
  return defaultOpencodeServerUrl()
}

export function opencodeClient(serverUrl = opencodeServerUrl()) {
  return createOpencodeClient({ baseUrl: normalizeServerUrl(serverUrl) || DEFAULT_OPENCODE_SERVER_URL })
}

export type OpencodeClient = ReturnType<typeof opencodeClient>

export class OpencodeClientError extends Data.TaggedError("OpencodeClientError")<{
  readonly message: string
  readonly operation: string
  readonly cause: unknown
}> {}

export function opencodeCall<A>(
  operation: string,
  run: (signal: AbortSignal) => PromiseLike<A>,
): Effect.Effect<A, OpencodeClientError> {
  return Effect.tryPromise({
    try: run,
    catch: (cause) => opencodeClientError(operation, cause),
  })
}

export function opencodeClientError(operation: string, cause: unknown): OpencodeClientError {
  const detail = cause instanceof Error ? cause.message.trim() : typeof cause === "string" ? cause.trim() : ""
  const message = `OpenCode ${operation} failed${detail ? `: ${detail}` : ""}`
  return new OpencodeClientError({ message, operation, cause })
}

export function requestOptions(
  input: { signal?: AbortSignal | undefined } | undefined,
  signal: AbortSignal,
): { throwOnError: true; signal: AbortSignal } {
  return { throwOnError: true, signal: mergedSignal(input?.signal, signal) }
}

export function streamOptions(
  input: { signal?: AbortSignal | undefined } | undefined,
  signal: AbortSignal,
): { signal: AbortSignal; sseSleepFn: (ms: number) => Promise<void> } {
  const combinedSignal = mergedSignal(input?.signal, signal)
  return {
    signal: combinedSignal,
    sseSleepFn: (ms) => sleepUntil(ms, combinedSignal),
  }
}

export function routeOptions(input: { directory?: string | undefined; workspaceID?: string | undefined }) {
  return {
    ...(input.directory !== undefined ? { directory: input.directory } : {}),
    ...(input.workspaceID !== undefined ? { workspace: input.workspaceID } : {}),
  }
}

export function isAbortError(error: unknown): boolean {
  if (error instanceof Error && error.name === "AbortError") return true
  if (error instanceof OpencodeClientError) return isAbortError(error.cause)
  if (typeof error !== "object" || error === null || !("cause" in error)) return false
  return isAbortError((error as { cause?: unknown }).cause)
}

function mergedSignal(external: AbortSignal | undefined, runtime: AbortSignal): AbortSignal {
  return external ? AbortSignal.any([external, runtime]) : runtime
}

function sleepUntil(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve()

  return new Promise((resolve) => {
    const finish = () => {
      globalThis.clearTimeout(timer)
      signal.removeEventListener("abort", finish)
      resolve()
    }
    const timer = globalThis.setTimeout(finish, ms)
    signal.addEventListener("abort", finish, { once: true })
  })
}
