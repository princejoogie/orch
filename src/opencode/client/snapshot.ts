import { realpathSync } from "node:fs"
import type {
  GlobalSession,
  Project as OpencodeProject,
  Session as OpencodeSession,
  SessionStatus as OpencodeSessionStatus,
} from "@opencode-ai/sdk/v2"
import type {
  DashboardSnapshot,
  ProjectRow,
  ProjectSnapshot,
  SessionHistoryMessage,
  SessionPermissionRequest,
  SessionRow,
  SessionStatus,
  WorktreeRow,
} from "../types.ts"
import { Effect } from "effect"
import {
  DEFAULT_LIMIT,
  isAbortError,
  opencodeCall,
  OpencodeClientError,
  opencodeClient,
  opencodeServerUrl,
  requestOptions,
  type OpencodeClient,
} from "./base.ts"
import { formatPermissionRequests, loadPendingPermissions } from "./permission.ts"
import { loadContextUsage, loadLatestMessages } from "./session.ts"

const PROJECT_SESSION_WINDOW_MS = 2 * 24 * 60 * 60 * 1000
const PROJECT_COPY_REFRESH_TIMEOUT_MS = 5_000

export function getSessions(
  options: { limit?: number; serverUrl?: string | undefined; signal?: AbortSignal | undefined } = {},
): Effect.Effect<DashboardSnapshot, OpencodeClientError> {
  const serverUrl = options.serverUrl ?? opencodeServerUrl()
  const client = opencodeClient(serverUrl)
  return Effect.gen(function* () {
    const sessions = yield* opencodeCall("experimental.session.list", (signal) =>
      client.experimental.session.list(
        { archived: false, limit: options.limit ?? DEFAULT_LIMIT },
        requestOptions(options, signal),
      ),
    )
    const [statuses, permissions] = yield* Effect.all(
      [
        loadStatuses(sessions.data, serverUrl, options.signal),
        loadPermissionRequests(sessions.data, serverUrl, options.signal),
      ],
      { concurrency: 2 },
    )
    const details = yield* loadSessionDetails(sessions.data, serverUrl, options.signal, permissions)

    return {
      rows: sessions.data.map((session) =>
        toRow(
          session,
          statuses.get(routeKey(session))?.[session.id],
          details.get(session.id),
          permissions.get(session.id),
        ),
      ),
      serverUrl,
      scannedAt: new Date(),
    }
  })
}

export function getProjects(
  options: { serverUrl?: string | undefined; signal?: AbortSignal | undefined } = {},
): Effect.Effect<ProjectSnapshot, OpencodeClientError> {
  const serverUrl = options.serverUrl ?? opencodeServerUrl()
  const client = opencodeClient(serverUrl)
  return Effect.gen(function* () {
    const projects = yield* opencodeCall("project.list", (signal) =>
      client.project.list({}, requestOptions(options, signal)),
    )
    const maybeRows = yield* Effect.forEach(
      projects.data,
      (project) =>
        Effect.gen(function* () {
          const sessionUpdated = yield* loadRecentProjectSessionUpdated(client, project, options.signal)
          if (sessionUpdated === undefined) return undefined

          return toProjectRow(project, yield* loadProjectWorktrees(client, project, options.signal), sessionUpdated)
        }),
      { concurrency: 8 },
    )
    const rows = maybeRows.filter((row): row is ProjectRow => row !== undefined)

    return {
      projects: rows.toSorted((left, right) => right.updated - left.updated || left.title.localeCompare(right.title)),
      serverUrl,
      scannedAt: new Date(),
    }
  })
}

export function getProjectSessions(options: {
  project: ProjectRow
  workspaceID?: string | undefined
  limit?: number
  start?: number | undefined
  serverUrl?: string | undefined
  signal?: AbortSignal | undefined
}): Effect.Effect<DashboardSnapshot, OpencodeClientError> {
  const serverUrl = options.serverUrl ?? opencodeServerUrl()
  const client = opencodeClient(serverUrl)
  const start = options.start ?? Date.now() - PROJECT_SESSION_WINDOW_MS
  return Effect.gen(function* () {
    const sessions = yield* opencodeCall("session.list", (signal) =>
      client.session.list(
        {
          directory: options.project.directory,
          scope: "project",
          start,
          ...(options.limit !== undefined ? { limit: options.limit } : {}),
          ...(options.workspaceID !== undefined ? { workspace: options.workspaceID } : {}),
        },
        requestOptions(options, signal),
      ),
    )
    const projectSessions = sessionListItems(sessions.data).filter(
      (session) => session.projectID === options.project.id && isActiveSession(session),
    )
    const [statuses, permissions] = yield* Effect.all(
      [
        loadStatuses(projectSessions, serverUrl, options.signal),
        loadPermissionRequests(projectSessions, serverUrl, options.signal),
      ],
      { concurrency: 2 },
    )
    const details = yield* loadSessionDetails(projectSessions, serverUrl, options.signal, permissions)

    return {
      rows: projectSessions.map((session) =>
        toRow(
          session,
          statuses.get(routeKey(session))?.[session.id],
          details.get(session.id),
          permissions.get(session.id),
          options.project,
        ),
      ),
      serverUrl,
      scannedAt: new Date(),
    }
  })
}

type StatusMap = Record<string, OpencodeSessionStatus>
type SessionDetails = Pick<
  SessionRow,
  | "latestMessage"
  | "latestUserMessage"
  | "latestResponseError"
  | "messages"
  | "hasMoreMessages"
  | "contextTokens"
  | "contextPercent"
>
type SessionLike = GlobalSession | OpencodeSession
type SessionListData = OpencodeSession[] | { items: OpencodeSession[] }

function loadProjectWorktrees(
  client: OpencodeClient,
  project: OpencodeProject,
  signal: AbortSignal | undefined,
): Effect.Effect<WorktreeRow[], OpencodeClientError> {
  return Effect.gen(function* () {
    yield* refreshProjectCopies(client, project, signal)
    return worktreeRows(project.worktree, yield* loadProjectDirectories(client, project, signal))
  })
}

function refreshProjectCopies(
  client: OpencodeClient,
  project: OpencodeProject,
  signal: AbortSignal | undefined,
): Effect.Effect<void, OpencodeClientError> {
  return opencodeCall("v2.projectCopy.refresh", (runtimeSignal) =>
    client.v2.projectCopy.refresh(
      { projectID: project.id, location: { directory: project.worktree } },
      requestOptions({ signal: refreshSignal(signal) }, runtimeSignal),
    ),
  ).pipe(
    Effect.asVoid,
    Effect.catchAll((refreshError) =>
      signal?.aborted && isAbortError(refreshError) ? Effect.fail(refreshError) : Effect.void,
    ),
  )
}

function refreshSignal(signal: AbortSignal | undefined): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(PROJECT_COPY_REFRESH_TIMEOUT_MS)
  return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal
}

function loadProjectDirectories(
  client: OpencodeClient,
  project: OpencodeProject,
  signal: AbortSignal | undefined,
): Effect.Effect<string[], OpencodeClientError> {
  return opencodeCall("project.directories", (runtimeSignal) =>
    client.project.directories(
      { projectID: project.id, directory: project.worktree },
      requestOptions({ signal }, runtimeSignal),
    ),
  ).pipe(
    Effect.map((result) => projectDirectoryItems(result.data)),
    Effect.catchAll((directoryError) => {
      if (isAbortError(directoryError)) return Effect.fail(directoryError)
      return Effect.sync(() => {
        console.error("Failed to load project directories", directoryError)
        return [project.worktree]
      })
    }),
  )
}

function loadRecentProjectSessionUpdated(
  client: OpencodeClient,
  project: OpencodeProject,
  signal: AbortSignal | undefined,
): Effect.Effect<number | undefined, OpencodeClientError> {
  const start = Date.now() - PROJECT_SESSION_WINDOW_MS
  return opencodeCall("session.list", (runtimeSignal) =>
    client.session.list(
      { directory: project.worktree, scope: "project", start },
      requestOptions({ signal }, runtimeSignal),
    ),
  ).pipe(
    Effect.map((sessions) =>
      sessionListItems(sessions.data)
        .filter((session) => session.projectID === project.id && isActiveSession(session))
        .reduce<number | undefined>(
          (updated, session) => Math.max(updated ?? session.time.updated, session.time.updated),
          undefined,
        ),
    ),
    Effect.catchAll((sessionError) => {
      if (isAbortError(sessionError)) return Effect.fail(sessionError)
      return Effect.sync(() => {
        console.error("Failed to load recent project sessions", sessionError)
        return undefined
      })
    }),
  )
}

function worktreeRows(primaryDirectory: string, directories: string[]): WorktreeRow[] {
  const rows = new Map<string, WorktreeRow>()
  rows.set(primaryDirectory, {
    directory: primaryDirectory,
    name: formatDirectory(primaryDirectory),
    primary: true,
  })

  for (const directory of directories) {
    if (!directory || sameDirectory(directory, primaryDirectory)) continue
    if ([...rows.keys()].some((existing) => sameDirectory(existing, directory))) continue
    rows.set(directory, {
      directory,
      name: formatDirectory(directory),
    })
  }

  const [primaryRow, ...rest] = [...rows.values()]
  return primaryRow ? [primaryRow, ...rest.sort((left, right) => left.name.localeCompare(right.name))] : []
}

function loadStatuses(
  sessions: SessionLike[],
  serverUrl: string,
  signal: AbortSignal | undefined,
): Effect.Effect<Map<string, StatusMap>, OpencodeClientError> {
  const client = opencodeClient(serverUrl)
  const routes = new Map<string, { directory: string; workspaceID?: string | undefined }>()
  for (const session of sessions) {
    routes.set(routeKey(session), {
      directory: session.directory,
      ...(session.workspaceID !== undefined ? { workspaceID: session.workspaceID } : {}),
    })
  }

  return Effect.gen(function* () {
    const entries = yield* Effect.forEach(
      [...routes.entries()],
      ([key, route]) =>
        opencodeCall("session.status", (runtimeSignal) =>
          client.session.status(
            {
              directory: route.directory,
              ...(route.workspaceID !== undefined ? { workspace: route.workspaceID } : {}),
            },
            requestOptions({ signal }, runtimeSignal),
          ),
        ).pipe(
          Effect.map((result) => [key, result.data] as const),
          Effect.catchAll((statusError) => {
            if (isAbortError(statusError)) return Effect.fail(statusError)
            return Effect.sync(() => {
              console.error("Failed to load session statuses", statusError)
              return [key, {} as StatusMap] as const
            })
          }),
        ),
      { concurrency: 8 },
    )

    return new Map(entries)
  })
}

function loadSessionDetails(
  sessions: SessionLike[],
  serverUrl: string,
  signal: AbortSignal | undefined,
  permissions: Map<string, SessionPermissionRequest[]> = new Map(),
): Effect.Effect<Map<string, SessionDetails>, OpencodeClientError> {
  return Effect.gen(function* () {
    const entries = yield* Effect.forEach(
      sessions,
      (session): Effect.Effect<readonly [string, SessionDetails], OpencodeClientError> => {
        const pendingPermissionRequests = permissions.get(session.id) ?? []
        return Effect.gen(function* () {
          const messages = yield* loadLatestMessages({
            sessionID: session.id,
            directory: session.directory,
            serverUrl,
            pendingPermissionRequests,
            ...(signal !== undefined ? { signal } : {}),
            ...(session.workspaceID !== undefined ? { workspaceID: session.workspaceID } : {}),
          })
          const context = yield* loadContextUsage({
            sessionID: session.id,
            directory: session.directory,
            serverUrl,
            ...(signal !== undefined ? { signal } : {}),
            ...(session.workspaceID !== undefined ? { workspaceID: session.workspaceID } : {}),
            ...(messages.assistantInfo !== undefined ? { historyAssistantMessage: messages.assistantInfo } : {}),
          }).pipe(
            Effect.catchAll((contextError) => {
              if (isAbortError(contextError)) return Effect.fail(contextError)
              return Effect.sync(() => {
                console.error("Failed to load session context usage", contextError)
                return {} as { tokens?: number; percent?: number }
              })
            }),
          )
          return [
            session.id,
            {
              latestMessage: messages.assistantMessage,
              latestUserMessage: messages.userMessage,
              ...(messages.latestResponseError !== undefined
                ? { latestResponseError: messages.latestResponseError }
                : {}),
              messages: messages.messages,
              hasMoreMessages: messages.hasMore,
              ...(context.tokens !== undefined ? { contextTokens: context.tokens } : {}),
              ...(context.percent !== undefined ? { contextPercent: context.percent } : {}),
            },
          ] as const
        }).pipe(
          Effect.catchAll((detailsError) => {
            if (isAbortError(detailsError)) return Effect.fail(detailsError)
            return Effect.sync(() => {
              console.error("Failed to load session details", detailsError)
              return [
                session.id,
                {
                  latestMessage: formatPermissionRequests(pendingPermissionRequests),
                  latestUserMessage: "",
                  messages: [] as SessionHistoryMessage[],
                  hasMoreMessages: false,
                },
              ] as const
            })
          }),
        )
      },
      { concurrency: 8 },
    )

    return new Map(entries)
  })
}

function loadPermissionRequests(
  sessions: SessionLike[],
  serverUrl: string,
  signal: AbortSignal | undefined,
): Effect.Effect<Map<string, SessionPermissionRequest[]>, OpencodeClientError> {
  const sessionIds = new Set(sessions.map((session) => session.id))
  const routes = new Map<string, { directory: string; workspaceID?: string | undefined }>()
  for (const session of sessions) {
    routes.set(routeKey(session), {
      directory: session.directory,
      ...(session.workspaceID !== undefined ? { workspaceID: session.workspaceID } : {}),
    })
  }

  return Effect.gen(function* () {
    const requests = (yield* Effect.forEach(
      [...routes.values()],
      (route) =>
        loadPendingPermissions({
          directory: route.directory,
          serverUrl,
          signal,
          ...(route.workspaceID !== undefined ? { workspaceID: route.workspaceID } : {}),
        }).pipe(
          Effect.catchAll((permissionError) => {
            if (isAbortError(permissionError)) return Effect.fail(permissionError)
            return Effect.sync(() => {
              console.error("Failed to load pending permission requests", permissionError)
              return []
            })
          }),
        ),
      { concurrency: 8 },
    )).flat()

    const grouped = new Map<string, SessionPermissionRequest[]>()
    for (const request of requests) {
      if (!sessionIds.has(request.sessionID)) continue
      const existing = grouped.get(request.sessionID) ?? []
      if (!existing.some((item) => item.id === request.id)) {
        existing.push(request)
        grouped.set(request.sessionID, existing)
      }
    }

    return grouped
  })
}

function routeKey(input: { directory: string; workspaceID?: string | undefined }): string {
  return `${input.directory}\t${input.workspaceID ?? ""}`
}

export function sessionListItems(data: SessionListData): OpencodeSession[] {
  return Array.isArray(data) ? data : data.items
}

export function projectDirectoryItems(data: unknown): string[] {
  if (!Array.isArray(data)) return []
  return data.flatMap((item) => {
    if (typeof item === "string") return [item]
    if (isObject(item) && typeof item.directory === "string") return [item.directory]
    return []
  })
}

function isActiveSession(session: SessionLike): boolean {
  return !session.time.archived
}

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
  pendingPermissionRequests: SessionPermissionRequest[] = [],
  project?: ProjectRow,
): SessionRow {
  const globalProject = "project" in session ? session.project : undefined
  const projectWorktree = globalProject?.worktree ?? project?.directory
  const permissionMessage = formatPermissionRequests(pendingPermissionRequests)
  return {
    id: session.id,
    ...(session.parentID !== undefined ? { parentID: session.parentID } : {}),
    title: session.title,
    latestMessage: permissionMessage || details?.latestMessage || "",
    latestUserMessage: details?.latestUserMessage ?? "",
    messages: details?.messages ?? [],
    hasMoreMessages: details?.hasMoreMessages ?? false,
    pendingPermissionRequests,
    ...(details?.contextTokens !== undefined ? { contextTokens: details.contextTokens } : {}),
    ...(details?.contextPercent !== undefined ? { contextPercent: details.contextPercent } : {}),
    directory: session.directory,
    projectID: session.projectID,
    projectTitle: project?.title ?? globalProject?.name ?? formatDirectory(projectWorktree ?? session.directory),
    worktreeName: formatDirectory(session.directory),
    ...(session.workspaceID !== undefined ? { workspaceID: session.workspaceID } : {}),
    ...(session.model !== undefined
      ? {
          model: {
            providerID: session.model.providerID,
            modelID: session.model.id,
            ...(session.model.variant !== undefined ? { variant: session.model.variant } : {}),
          },
        }
      : {}),
    updated: session.time.updated,
    status: inferStatus(session, status),
  }
}

function inferStatus(session: SessionLike, status?: OpencodeSessionStatus): SessionStatus {
  if (session.time.compacting) return "working"
  if (status?.type === "busy" || status?.type === "retry") return "working"
  return "completed"
}

function sameDirectory(left: string, right: string): boolean {
  return canonicalDirectory(left) === canonicalDirectory(right)
}

function canonicalDirectory(directory: string): string {
  try {
    return realpathSync(directory)
  } catch {
    return directory.replace(/\/+$/, "")
  }
}

export function formatDirectory(directory: string): string {
  const normalized = directory.replace(/\/+$/, "")
  return normalized.split("/").pop() || directory
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
