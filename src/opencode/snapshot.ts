import { realpathSync } from "node:fs"
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
          loadProjectWorktrees(project),
          loadRecentProjectSessionUpdated(client, project, options.signal),
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
  const projectSessions = sessions.data.filter(
    (session) => session.projectID === options.project.id && isActiveSession(session),
  )
  const [statuses, details] = await Promise.all([
    loadStatuses(projectSessions, serverUrl, options.signal),
    loadSessionDetails(projectSessions, serverUrl, options.signal),
  ])

  return {
    rows: projectSessions.map((session) =>
      toRow(session, statuses.get(routeKey(session))?.[session.id], details.get(session.id), options.project),
    ),
    serverUrl,
    scannedAt: new Date(),
  }
}

type StatusMap = Record<string, OpencodeSessionStatus>
type SessionDetails = Pick<
  SessionRow,
  "latestMessage" | "latestUserMessage" | "messages" | "hasMoreMessages" | "contextTokens" | "contextPercent"
>
type GitWorktree = {
  directory: string
  head?: string | undefined
  branch?: string | undefined
  bare?: boolean | undefined
  prunable?: boolean | undefined
}

async function loadProjectWorktrees(project: OpencodeProject): Promise<WorktreeRow[]> {
  return worktreeRows(project.worktree, await loadGitWorktrees(project.worktree))
}

async function loadGitWorktrees(directory: string): Promise<GitWorktree[]> {
  try {
    const process = Bun.spawn(["git", "-C", directory, "worktree", "list", "--porcelain"], {
      stdout: "pipe",
      stderr: "ignore",
    })
    const output = await new Response(process.stdout).text()
    const exitCode = await process.exited
    if (exitCode !== 0) return []

    return parseGitWorktrees(output)
  } catch (worktreeError) {
    console.error("Failed to load git worktrees", worktreeError)
    return []
  }
}

function parseGitWorktrees(output: string): GitWorktree[] {
  const worktrees: GitWorktree[] = []
  let current: GitWorktree | undefined

  const flush = () => {
    if (current) {
      worktrees.push(current)
      current = undefined
    }
  }

  for (const line of output.split("\n")) {
    if (line.trim() === "") {
      flush()
      continue
    }

    if (line.startsWith("worktree ")) {
      flush()
      current = { directory: line.slice("worktree ".length) }
      continue
    }

    if (!current) continue

    if (line.startsWith("HEAD ")) current.head = line.slice("HEAD ".length)
    else if (line.startsWith("branch ")) current.branch = shortBranch(line.slice("branch ".length))
    else if (line === "bare") current.bare = true
    else if (line.startsWith("prunable")) current.prunable = true
  }

  flush()
  return worktrees.filter((worktree) => worktree.directory.length > 0 && !worktree.bare && !worktree.prunable)
}

async function loadRecentProjectSessionUpdated(
  client: ReturnType<typeof opencodeClient>,
  project: OpencodeProject,
  signal: AbortSignal | undefined,
): Promise<number | undefined> {
  const start = Date.now() - PROJECT_SESSION_WINDOW_MS
  try {
    const sessions = await client.session.list(
      { directory: project.worktree, scope: "project", start },
      { throwOnError: true, ...(signal !== undefined ? { signal } : {}) },
    )
    return sessions.data
      .filter((session) => session.projectID === project.id && isActiveSession(session))
      .reduce<number | undefined>(
        (updated, session) => Math.max(updated ?? session.time.updated, session.time.updated),
        undefined,
      )
  } catch (sessionError) {
    if (isAbortError(sessionError)) throw sessionError
    console.error("Failed to load recent project sessions", sessionError)
    return undefined
  }
}

function worktreeRows(primaryDirectory: string, worktrees: GitWorktree[]): WorktreeRow[] {
  const rows = new Map<string, WorktreeRow>()
  const primary = worktrees.find((worktree) => sameDirectory(worktree.directory, primaryDirectory))
  rows.set(primaryDirectory, {
    directory: primaryDirectory,
    name: worktreeName(primary) ?? formatDirectory(primaryDirectory),
    primary: true,
  })

  for (const worktree of worktrees) {
    if (sameDirectory(worktree.directory, primaryDirectory)) continue
    if (rows.has(worktree.directory)) continue
    rows.set(worktree.directory, {
      directory: worktree.directory,
      name: worktreeName(worktree) ?? formatDirectory(worktree.directory),
    })
  }

  const [primaryRow, ...rest] = [...rows.values()]
  return primaryRow ? [primaryRow, ...rest.sort((left, right) => left.name.localeCompare(right.name))] : []
}

function worktreeName(worktree: GitWorktree | undefined): string | undefined {
  return worktree?.branch ?? worktree?.head?.slice(0, 8)
}

function shortBranch(branch: string): string {
  return branch.replace(/^refs\/heads\//, "").replace(/^refs\/remotes\//, "")
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
        console.error("Failed to load session statuses", statusError)
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
          console.error("Failed to load session context usage", contextError)
          return {}
        })
        return [
          session.id,
          {
            latestMessage: messages.assistantMessage,
            latestUserMessage: messages.userMessage,
            messages: messages.messages,
            hasMoreMessages: messages.hasMore,
            ...(context.tokens !== undefined ? { contextTokens: context.tokens } : {}),
            ...(context.percent !== undefined ? { contextPercent: context.percent } : {}),
          },
        ] as const
      } catch (detailsError) {
        if (isAbortError(detailsError)) throw detailsError
        console.error("Failed to load session details", detailsError)
        return [session.id, { latestMessage: "", latestUserMessage: "", messages: [], hasMoreMessages: false }] as const
      }
    }),
  )

  return new Map(entries)
}

function routeKey(input: { directory: string; workspaceID?: string | undefined }): string {
  return `${input.directory}\t${input.workspaceID ?? ""}`
}

type SessionLike = GlobalSession | OpencodeSession

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
  project?: ProjectRow,
): SessionRow {
  const globalProject = "project" in session ? session.project : undefined
  const projectWorktree = globalProject?.worktree ?? project?.directory
  return {
    id: session.id,
    title: session.title,
    latestMessage: details?.latestMessage ?? "",
    latestUserMessage: details?.latestUserMessage ?? "",
    messages: details?.messages ?? [],
    hasMoreMessages: details?.hasMoreMessages ?? false,
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

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError"
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
