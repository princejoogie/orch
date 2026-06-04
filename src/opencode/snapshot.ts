import type {
  GlobalSession,
  Project as OpencodeProject,
  Session as OpencodeSession,
  SessionStatus as OpencodeSessionStatus,
} from "@opencode-ai/sdk/v2"
import { DEFAULT_LIMIT, loadContextUsage, loadLatestMessages, opencodeClient, opencodeServerUrl } from "./client.ts"
import type { DashboardSnapshot, ProjectRow, ProjectSnapshot, SessionRow, SessionStatus, WorktreeRow } from "./types.ts"

const PROJECT_SESSION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

export async function getSessions(
  options: { limit?: number; serverUrl?: string | undefined; signal?: AbortSignal | undefined } = {},
): Promise<DashboardSnapshot> {
  const serverUrl = options.serverUrl ?? opencodeServerUrl()
  const client = opencodeClient(serverUrl)
  const sessions = await client.experimental.session.list(
    { archived: false, limit: options.limit ?? DEFAULT_LIMIT },
    { throwOnError: true, ...(options.signal !== undefined ? { signal: options.signal } : {}) },
  )
  const [statuses, details] = await Promise.all([
    loadStatuses(sessions.data, serverUrl, options.signal),
    loadSessionDetails(sessions.data, serverUrl, options.signal),
  ])

  return {
    rows: sessions.data.map((session) =>
      toRow(session, statuses.get(routeKey(session))?.[session.id], details.get(session.id)),
    ),
    serverUrl,
    scannedAt: new Date(),
  }
}

export async function getProjects(
  options: { serverUrl?: string | undefined; signal?: AbortSignal | undefined } = {},
): Promise<ProjectSnapshot> {
  const serverUrl = options.serverUrl ?? opencodeServerUrl()
  const client = opencodeClient(serverUrl)
  const projects = await client.project.list(
    {},
    { throwOnError: true, ...(options.signal !== undefined ? { signal: options.signal } : {}) },
  )
  const rows = (
    await Promise.all(
      projects.data.map(async (project) =>
        Promise.all([
          loadProjectWorktrees(client, project, options.signal),
          loadRecentProjectSessionUpdated(client, project.worktree, options.signal),
        ]).then(([worktrees, sessionUpdated]) =>
          sessionUpdated !== undefined ? toProjectRow(project, worktrees, sessionUpdated) : undefined,
        ),
      ),
    )
  ).filter((row): row is ProjectRow => row !== undefined)

  return {
    projects: rows.toSorted((left, right) => right.updated - left.updated || left.title.localeCompare(right.title)),
    serverUrl,
    scannedAt: new Date(),
  }
}

export async function getProjectSessions(options: {
  project: ProjectRow
  workspaceID?: string | undefined
  limit?: number
  start?: number | undefined
  serverUrl?: string | undefined
  signal?: AbortSignal | undefined
}): Promise<DashboardSnapshot> {
  const serverUrl = options.serverUrl ?? opencodeServerUrl()
  const client = opencodeClient(serverUrl)
  const start = options.start ?? Date.now() - PROJECT_SESSION_WINDOW_MS
  const sessions = await client.session.list(
    {
      directory: options.project.directory,
      scope: "project",
      start,
      ...(options.limit !== undefined ? { limit: options.limit } : {}),
      ...(options.workspaceID !== undefined ? { workspace: options.workspaceID } : {}),
    },
    { throwOnError: true, ...(options.signal !== undefined ? { signal: options.signal } : {}) },
  )
  const [statuses, details] = await Promise.all([
    loadStatuses(sessions.data, serverUrl, options.signal),
    loadSessionDetails(sessions.data, serverUrl, options.signal),
  ])

  return {
    rows: sessions.data.map((session) =>
      toRow(session, statuses.get(routeKey(session))?.[session.id], details.get(session.id), options.project),
    ),
    serverUrl,
    scannedAt: new Date(),
  }
}

type StatusMap = Record<string, OpencodeSessionStatus>
type SessionDetails = Pick<SessionRow, "latestMessage" | "latestUserMessage" | "contextTokens" | "contextPercent">

async function loadProjectWorktrees(
  client: ReturnType<typeof opencodeClient>,
  project: OpencodeProject,
  signal: AbortSignal | undefined,
): Promise<WorktreeRow[]> {
  try {
    const worktrees = await client.worktree.list(
      { directory: project.worktree },
      { throwOnError: true, ...(signal !== undefined ? { signal } : {}) },
    )
    return worktreeRows(project.worktree, worktrees.data)
  } catch (worktreeError) {
    if (isAbortError(worktreeError)) throw worktreeError
    return worktreeRows(project.worktree, [])
  }
}

async function loadRecentProjectSessionUpdated(
  client: ReturnType<typeof opencodeClient>,
  directory: string,
  signal: AbortSignal | undefined,
): Promise<number | undefined> {
  const start = Date.now() - PROJECT_SESSION_WINDOW_MS
  try {
    const sessions = await client.session.list(
      { directory, scope: "project", start },
      { throwOnError: true, ...(signal !== undefined ? { signal } : {}) },
    )
    return sessions.data.reduce<number | undefined>(
      (updated, session) => Math.max(updated ?? session.time.updated, session.time.updated),
      undefined,
    )
  } catch (sessionError) {
    if (isAbortError(sessionError)) throw sessionError
    return undefined
  }
}

function worktreeRows(primaryDirectory: string, directories: string[]): WorktreeRow[] {
  const rows = new Map<string, WorktreeRow>()
  rows.set(primaryDirectory, { directory: primaryDirectory, name: formatDirectory(primaryDirectory) })

  for (const directory of directories) {
    if (rows.has(directory)) continue
    rows.set(directory, { directory, name: formatDirectory(directory) })
  }

  const [primary, ...rest] = [...rows.values()]
  return primary ? [primary, ...rest.sort((left, right) => left.name.localeCompare(right.name))] : []
}

async function loadStatuses(
  sessions: SessionLike[],
  serverUrl: string,
  signal: AbortSignal | undefined,
): Promise<Map<string, StatusMap>> {
  const client = opencodeClient(serverUrl)
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
        const result = await client.session.status(
          { directory: route.directory, ...(route.workspaceID !== undefined ? { workspace: route.workspaceID } : {}) },
          { throwOnError: true, ...(signal !== undefined ? { signal } : {}) },
        )
        return [key, result.data] as const
      } catch (statusError) {
        if (isAbortError(statusError)) throw statusError
        return [key, {}] as const
      }
    }),
  )

  return new Map(entries)
}

async function loadSessionDetails(
  sessions: SessionLike[],
  serverUrl: string,
  signal: AbortSignal | undefined,
): Promise<Map<string, SessionDetails>> {
  const entries = await Promise.all(
    sessions.map(async (session): Promise<readonly [string, SessionDetails]> => {
      try {
        const messages = await loadLatestMessages({
          sessionID: session.id,
          directory: session.directory,
          serverUrl,
          ...(signal !== undefined ? { signal } : {}),
          ...(session.workspaceID !== undefined ? { workspaceID: session.workspaceID } : {}),
        })
        const context = await loadContextUsage({
          sessionID: session.id,
          directory: session.directory,
          serverUrl,
          ...(signal !== undefined ? { signal } : {}),
          ...(session.workspaceID !== undefined ? { workspaceID: session.workspaceID } : {}),
          ...(messages.assistantInfo !== undefined ? { historyAssistantMessage: messages.assistantInfo } : {}),
        }).catch((contextError): { tokens?: number; percent?: number } => {
          if (isAbortError(contextError)) throw contextError
          return {}
        })
        return [
          session.id,
          {
            latestMessage: messages.assistantMessage,
            latestUserMessage: messages.userMessage,
            ...(context.tokens !== undefined ? { contextTokens: context.tokens } : {}),
            ...(context.percent !== undefined ? { contextPercent: context.percent } : {}),
          },
        ] as const
      } catch (detailsError) {
        if (isAbortError(detailsError)) throw detailsError
        return [session.id, { latestMessage: "", latestUserMessage: "" }] as const
      }
    }),
  )

  return new Map(entries)
}

function routeKey(input: { directory: string; workspaceID?: string | undefined }): string {
  return `${input.directory}\t${input.workspaceID ?? ""}`
}

type SessionLike = GlobalSession | OpencodeSession

function toProjectRow(project: OpencodeProject, worktrees: WorktreeRow[], updated: number): ProjectRow {
  return {
    id: project.id,
    title: project.name ?? formatDirectory(project.worktree),
    directory: project.worktree,
    worktreeName: formatDirectory(project.worktree),
    worktrees,
    updated,
  }
}

function toRow(
  session: SessionLike,
  status?: OpencodeSessionStatus,
  details?: SessionDetails,
  project?: ProjectRow,
): SessionRow {
  const globalProject = "project" in session ? session.project : undefined
  const projectWorktree = globalProject?.worktree ?? project?.directory
  return {
    id: session.id,
    title: session.title,
    latestMessage: details?.latestMessage ?? "",
    latestUserMessage: details?.latestUserMessage ?? "",
    ...(details?.contextTokens !== undefined ? { contextTokens: details.contextTokens } : {}),
    ...(details?.contextPercent !== undefined ? { contextPercent: details.contextPercent } : {}),
    directory: session.directory,
    projectID: session.projectID,
    projectTitle: project?.title ?? globalProject?.name ?? formatDirectory(projectWorktree ?? session.directory),
    worktreeName: formatDirectory(session.directory),
    ...(session.workspaceID !== undefined ? { workspaceID: session.workspaceID } : {}),
    updated: session.time.updated,
    status: inferStatus(session, status),
  }
}

function inferStatus(session: SessionLike, status?: OpencodeSessionStatus): SessionStatus {
  if (session.time.compacting) return "working"
  if (status?.type === "busy" || status?.type === "retry") return "working"
  return "completed"
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError"
}

export function formatDirectory(directory: string): string {
  const normalized = directory.replace(/\/+$/, "")
  return normalized.split("/").pop() || directory
}
