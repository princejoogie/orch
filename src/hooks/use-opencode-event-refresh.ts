import { useQueryClient } from "@tanstack/react-query"
import { Effect } from "effect"
import { useEffect } from "react"
import { AppRuntime } from "../effect/app-runtime.ts"
import {
  dashboardRefreshScopeForEvent,
  isAbortError,
  openOpencodeEventStream,
  opencodeClientError,
  type DashboardRefreshScope,
} from "../opencode/client/index.ts"

const EVENT_REFRESH_DEBOUNCE_MS = 150

export function useOpencodeEventRefresh(serverUrl: string): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    const abortController = new AbortController()
    let disposed = false
    let timer: ReturnType<typeof globalThis.setTimeout> | undefined
    let refreshProjects = false
    let refreshSessions = false
    let closeEventStream: Effect.Effect<void> | undefined

    const flush = () => {
      timer = undefined
      if (disposed) return

      const shouldRefreshProjects = refreshProjects
      const shouldRefreshSessions = refreshSessions
      refreshProjects = false
      refreshSessions = false

      if (shouldRefreshProjects) {
        void queryClient.invalidateQueries({ queryKey: ["opencode-projects", serverUrl] })
      }
      if (shouldRefreshSessions) {
        void queryClient.invalidateQueries({ queryKey: ["opencode-project-sessions", serverUrl] })
      }
    }

    const scheduleRefresh = (scope: DashboardRefreshScope) => {
      if (scope === "projects" || scope === "all") refreshProjects = true
      if (scope === "sessions" || scope === "all") refreshSessions = true
      if (timer === undefined) timer = globalThis.setTimeout(flush, EVENT_REFRESH_DEBOUNCE_MS)
    }

    void AppRuntime.runPromise(
      Effect.gen(function* () {
        const subscription = yield* openOpencodeEventStream({ serverUrl, signal: abortController.signal })
        closeEventStream = subscription.close

        yield* Effect.tryPromise({
          try: async () => {
            for await (const event of subscription.stream) {
              if (disposed) return
              const scope = dashboardRefreshScopeForEvent(event)
              if (scope) scheduleRefresh(scope)
            }
          },
          catch: (cause) => opencodeClientError("global.event.stream", cause),
        })
      }),
      { signal: abortController.signal },
    ).catch((eventError) => {
      if (!disposed && !isAbortError(eventError)) console.error("Failed to subscribe to opencode events", eventError)
    })

    return () => {
      disposed = true
      abortController.abort()
      void AppRuntime.runPromise(closeEventStream ?? Effect.void)
      if (timer !== undefined) globalThis.clearTimeout(timer)
    }
  }, [queryClient, serverUrl])
}
