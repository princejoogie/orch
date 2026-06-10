import { useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import {
  dashboardRefreshScopeForEvent,
  subscribeOpencodeEvents,
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

    void (async () => {
      try {
        const stream = await subscribeOpencodeEvents({ serverUrl, signal: abortController.signal })
        for await (const event of stream) {
          if (disposed) break
          const scope = dashboardRefreshScopeForEvent(event)
          if (scope) scheduleRefresh(scope)
        }
      } catch (eventError) {
        if (!disposed && !isAbortError(eventError)) console.error("Failed to subscribe to opencode events", eventError)
      }
    })()

    return () => {
      disposed = true
      abortController.abort()
      if (timer !== undefined) globalThis.clearTimeout(timer)
    }
  }, [queryClient, serverUrl])
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError"
}
