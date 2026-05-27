import type { GlobalSession, SessionStatus as OpencodeSessionStatus } from "@opencode-ai/sdk/v2"
import { DEFAULT_LIMIT, loadContextUsage, loadLatestMessages, opencodeClient, opencodeServerUrl } from "./client.ts"
import type { DashboardSnapshot, SessionRow, SessionStatus } from "./types.ts"

export const ACTIVE_SESSION_WINDOW_MS = 24 * 60 * 60 * 1000

export async function getSessions(options: { limit?: number } = {}): Promise<DashboardSnapshot> {
  const serverUrl = opencodeServerUrl()
  const since = Date.now() - ACTIVE_SESSION_WINDOW_MS
  const sessions = await opencodeClient.experimental.session.list(
    { archived: false, limit: options.limit ?? DEFAULT_LIMIT, start: since },
    { throwOnError: true },
  )
  const [statuses, details] = await Promise.all([loadStatuses(sessions.data), loadSessionDetails(sessions.data)])

  return {
    rows: sessions.data.map((session) =>
      toRow(session, statuses.get(routeKey(session))?.[session.id], details.get(session.id)),
    ),
    serverUrl,
    since,
    scannedAt: new Date(),
  }
}

type StatusMap = Record<string, OpencodeSessionStatus>
type SessionDetails = Pick<SessionRow, "latestMessage" | "latestUserMessage" | "contextTokens" | "contextPercent">

async function loadStatuses(sessions: GlobalSession[]): Promise<Map<string, StatusMap>> {
  const routes = new Map<string, { directory: string; workspaceID?: string | undefined }>()
  for (const session of sessions) {
    routes.set(routeKey(session), {
      directory: session.directory,
      ...(session.workspaceID !== undefined ? { workspaceID: session.workspaceID } : {}),
    })
  }

  const entries = await Promise.all(
    [...routes.entries()].map(async ([key, route]) => {
      try {
        const result = await opencodeClient.session.status(
          { directory: route.directory, ...(route.workspaceID !== undefined ? { workspace: route.workspaceID } : {}) },
          { throwOnError: true },
        )
        return [key, result.data] as const
      } catch {
        return [key, {}] as const
      }
    }),
  )

  return new Map(entries)
}

async function loadSessionDetails(sessions: GlobalSession[]): Promise<Map<string, SessionDetails>> {
  const entries = await Promise.all(
    sessions.map(async (session): Promise<readonly [string, SessionDetails]> => {
      try {
        const messages = await loadLatestMessages({
          sessionID: session.id,
          directory: session.directory,
          ...(session.workspaceID !== undefined ? { workspaceID: session.workspaceID } : {}),
        })
        const context = await loadContextUsage({
          sessionID: session.id,
          directory: session.directory,
          ...(session.workspaceID !== undefined ? { workspaceID: session.workspaceID } : {}),
          ...(messages.assistantInfo !== undefined ? { historyAssistantMessage: messages.assistantInfo } : {}),
        }).catch((): { tokens?: number; percent?: number } => ({}))
        return [
          session.id,
          {
            latestMessage: messages.assistantMessage,
            latestUserMessage: messages.userMessage,
            ...(context.tokens !== undefined ? { contextTokens: context.tokens } : {}),
            ...(context.percent !== undefined ? { contextPercent: context.percent } : {}),
          },
        ] as const
      } catch {
        return [session.id, { latestMessage: "", latestUserMessage: "" }] as const
      }
    }),
  )

  return new Map(entries)
}

function routeKey(input: { directory: string; workspaceID?: string | undefined }): string {
  return `${input.directory}\t${input.workspaceID ?? ""}`
}

function toRow(session: GlobalSession, status?: OpencodeSessionStatus, details?: SessionDetails): SessionRow {
  const projectWorktree = session.project?.worktree
  return {
    id: session.id,
    title: session.title,
    latestMessage: details?.latestMessage ?? "",
    latestUserMessage: details?.latestUserMessage ?? "",
    ...(details?.contextTokens !== undefined ? { contextTokens: details.contextTokens } : {}),
    ...(details?.contextPercent !== undefined ? { contextPercent: details.contextPercent } : {}),
    directory: session.directory,
    projectID: session.projectID,
    projectTitle: session.project?.name ?? formatDirectory(projectWorktree ?? session.directory),
    worktreeName: formatDirectory(session.directory),
    ...(session.workspaceID !== undefined ? { workspaceID: session.workspaceID } : {}),
    updated: session.time.updated,
    status: inferStatus(session, status),
  }
}

function inferStatus(session: GlobalSession, status?: OpencodeSessionStatus): SessionStatus {
  if (session.time.compacting) return "working"
  if (status?.type === "busy" || status?.type === "retry") return "working"
  return "completed"
}

export function formatDirectory(directory: string): string {
  const normalized = directory.replace(/\/+$/, "")
  return normalized.split("/").pop() || directory
}
