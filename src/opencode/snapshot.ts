import type { GlobalSession, SessionStatus as OpencodeSessionStatus } from "@opencode-ai/sdk/v2"
import { createPersistenceClient, DEFAULT_LIMIT, opencodeServerUrl } from "./client.ts"
import type { DashboardSnapshot, SessionRow, SessionStatus } from "./types.ts"

export const ACTIVE_SESSION_WINDOW_MS = 24 * 60 * 60 * 1000

export async function discoverOpencode(
  options: { limit?: number; serverUrl?: string } = {},
): Promise<DashboardSnapshot> {
  const serverUrl = options.serverUrl ?? opencodeServerUrl()
  const since = Date.now() - ACTIVE_SESSION_WINDOW_MS
  const client = createPersistenceClient({ serverUrl })
  const sessions = await client.experimental.session.list(
    { archived: false, limit: options.limit ?? DEFAULT_LIMIT, start: since },
    { throwOnError: true },
  )
  const statuses = await loadStatuses(client, sessions.data)

  return {
    rows: sessions.data.map((session) => toRow(session, statuses.get(routeKey(session))?.[session.id])),
    serverUrl,
    since,
    scannedAt: new Date(),
  }
}

type PersistenceClient = ReturnType<typeof createPersistenceClient>
type StatusMap = Record<string, OpencodeSessionStatus>

async function loadStatuses(client: PersistenceClient, sessions: GlobalSession[]): Promise<Map<string, StatusMap>> {
  const routes = new Map<string, { directory: string; workspaceID?: string }>()
  for (const session of sessions) {
    routes.set(routeKey(session), { directory: session.directory, workspaceID: session.workspaceID })
  }

  const entries = await Promise.all(
    [...routes.entries()].map(async ([key, route]) => {
      try {
        const result = await client.session.status(
          { directory: route.directory, workspace: route.workspaceID },
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

function routeKey(input: { directory: string; workspaceID?: string }): string {
  return `${input.directory}\t${input.workspaceID ?? ""}`
}

function toRow(session: GlobalSession, status?: OpencodeSessionStatus): SessionRow {
  const projectWorktree = session.project?.worktree
  return {
    id: session.id,
    title: session.title,
    latestMessage: "",
    directory: session.directory,
    projectID: session.projectID,
    projectTitle: session.project?.name ?? formatDirectory(projectWorktree ?? session.directory),
    worktreeName: formatDirectory(session.directory),
    workspaceID: session.workspaceID,
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
