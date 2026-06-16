import { createHash } from "node:crypto"
import { realpathSync } from "node:fs"
import { basename } from "node:path"
import { $ } from "bun"
import { Data, Effect } from "effect"
import type { SessionRow } from "./opencode/client/index.ts"

type Pane = {
  paneId: string
  windowId: string
  currentCommand: string
  pid: number
}

type ProcessRow = {
  pid: number
  ppid: number
  command: string
}

type GitWorktree = {
  path: string
  head?: string
  branch?: string
  bare: boolean
  prunable: boolean
}

export class TmuxError extends Data.TaggedError("TmuxError")<{
  readonly message: string
  readonly operation: string
  readonly cause: unknown
}> {}

export function openTmuxSessionForRow(row: SessionRow): Effect.Effect<void, TmuxError> {
  return Effect.gen(function* () {
    const sessionName = yield* resolveSessionName(row)

    if (!(yield* tmuxHasSession(sessionName))) {
      yield* runTmuxNewSession(sessionName, row.directory)
    }

    yield* focusOpencodePane(sessionName)
    yield* openExistingTmuxSession(sessionName)
  })
}

function tmuxCommand<A>(operation: string, run: () => PromiseLike<A>): Effect.Effect<A, TmuxError> {
  return Effect.tryPromise({
    try: run,
    catch: (cause) => new TmuxError({ message: `tmux operation failed: ${operation}`, operation, cause }),
  })
}

function resolveSessionName(row: SessionRow): Effect.Effect<string, TmuxError> {
  return Effect.gen(function* () {
    const baseName = (yield* tmsSessionName(row.directory)) ?? baseSessionName(row)
    const hashedName = `${baseName}_${hashPath(row.directory)}`
    const sessions = yield* listTmuxSessionNames()

    if (sessions.includes(baseName)) return baseName
    if (sessions.includes(hashedName)) return hashedName
    return baseName
  })
}

function baseSessionName(row: SessionRow): string {
  if (row.worktreeName && row.worktreeName !== row.projectTitle) {
    return sanitizeSessionName(`${row.projectTitle}_${row.worktreeName}`)
  }

  return sanitizeSessionName(row.projectTitle)
}

function tmsSessionName(directory: string): Effect.Effect<string | undefined, TmuxError> {
  return Effect.gen(function* () {
    const worktrees = yield* gitWorktrees(directory)
    const main = worktrees.find((worktree) => !worktree.bare && !worktree.prunable)
    if (!main) return undefined

    const currentPath = realPath(directory)
    const current = worktrees.find(
      (worktree) => !worktree.bare && !worktree.prunable && realPath(worktree.path) === currentPath,
    )
    if (!current) return undefined

    const repoName = basename(main.path)
    if (realPath(current.path) === realPath(main.path)) return sanitizeSessionName(repoName)

    return sanitizeSessionName(`${repoName}_${worktreeLabel(current)}`)
  })
}

function gitWorktrees(directory: string): Effect.Effect<GitWorktree[], TmuxError> {
  return Effect.gen(function* () {
    const result = yield* tmuxCommand("git.worktree.list", () =>
      $`git -C ${directory} worktree list --porcelain`.quiet().nothrow(),
    )
    if (result.exitCode !== 0) return []

    const worktrees: GitWorktree[] = []
    let current: GitWorktree | undefined

    const flush = () => {
      if (current) {
        current.path = realPath(current.path)
        worktrees.push(current)
        current = undefined
      }
    }

    for (const line of result.stdout.toString().split("\n")) {
      if (line.trim() === "") {
        flush()
        continue
      }

      if (line.startsWith("worktree ")) {
        flush()
        current = { path: line.slice("worktree ".length), bare: false, prunable: false }
        continue
      }

      if (!current) continue

      if (line.startsWith("HEAD ")) current.head = line.slice("HEAD ".length)
      else if (line.startsWith("branch ")) current.branch = shortBranch(line.slice("branch ".length))
      else if (line === "bare") current.bare = true
      else if (line.startsWith("prunable")) current.prunable = true
    }

    flush()
    return worktrees
  })
}

function worktreeLabel(worktree: GitWorktree): string {
  return worktree.branch ?? worktree.head?.slice(0, 8) ?? basename(worktree.path)
}

function shortBranch(branch: string): string {
  return branch.replace(/^refs\/heads\//, "").replace(/^refs\/remotes\//, "")
}

function realPath(path: string): string {
  try {
    return realpathSync(path)
  } catch (realPathError) {
    console.error("Failed to resolve real path", realPathError)
    return path
  }
}

function sanitizeSessionName(value: string): string {
  const sanitized = value
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")

  return sanitized || "tms"
}

function hashPath(path: string): string {
  return createHash("sha1").update(path).digest("hex").slice(0, 6)
}

function focusOpencodePane(sessionName: string): Effect.Effect<void, TmuxError> {
  return Effect.gen(function* () {
    const pane = yield* findOpencodePane(sessionName)
    if (!pane) return

    yield* tmuxCommand("tmux.select-window", () => $`tmux select-window -t ${pane.windowId}`.quiet())
    yield* tmuxCommand("tmux.select-pane", () => $`tmux select-pane -t ${pane.paneId}`.quiet())
  })
}

function findOpencodePane(sessionName: string): Effect.Effect<Pane | undefined, TmuxError> {
  return Effect.gen(function* () {
    const panes = yield* listPanes(sessionName)
    if (panes.length === 0) return undefined

    const direct = panes.find((pane) => isOpencodeCommand(pane.currentCommand))
    if (direct) return direct

    const processes = yield* listProcesses()
    const childrenByParent = new Map<number, ProcessRow[]>()
    for (const process of processes) {
      const children = childrenByParent.get(process.ppid) ?? []
      children.push(process)
      childrenByParent.set(process.ppid, children)
    }

    return panes.find((pane) => hasOpencodeDescendant(pane.pid, childrenByParent))
  })
}

function hasOpencodeDescendant(pid: number, childrenByParent: Map<number, ProcessRow[]>): boolean {
  const queue = [...(childrenByParent.get(pid) ?? [])]
  const seen = new Set<number>()

  while (queue.length > 0) {
    const process = queue.shift()!
    if (seen.has(process.pid)) continue
    seen.add(process.pid)

    if (isOpencodeCommand(process.command)) return true
    queue.push(...(childrenByParent.get(process.pid) ?? []))
  }

  return false
}

function isOpencodeCommand(command: string): boolean {
  return /(^|[/\s])opencode(\s|$)/.test(command)
}

function listTmuxSessionNames(): Effect.Effect<string[], TmuxError> {
  return Effect.gen(function* () {
    const result = yield* tmuxCommand("tmux.list-sessions", () =>
      $`tmux list-sessions -F "#{session_name}"`.quiet().nothrow(),
    )
    if (result.exitCode !== 0) return []

    return result.stdout.toString().split("\n").filter(Boolean)
  })
}

function listPanes(sessionName: string): Effect.Effect<Pane[], TmuxError> {
  const format = "#{pane_id}\t#{window_id}\t#{pane_current_command}\t#{pane_pid}"
  return Effect.gen(function* () {
    const result = yield* tmuxCommand("tmux.list-panes", () =>
      $`tmux list-panes -t ${sessionName} -s -F ${format}`.quiet().nothrow(),
    )
    if (result.exitCode !== 0) return []

    return result.stdout
      .toString()
      .split("\n")
      .filter(Boolean)
      .flatMap((line) => {
        const [paneId, windowId, currentCommand, pid] = line.split("\t")
        const parsedPid = Number(pid)
        if (!paneId || !windowId || !currentCommand || !Number.isInteger(parsedPid)) return []
        return [{ paneId, windowId, currentCommand, pid: parsedPid }]
      })
  })
}

function listProcesses(): Effect.Effect<ProcessRow[], TmuxError> {
  return Effect.gen(function* () {
    const result = yield* tmuxCommand("ps.list", () => $`ps -axo pid=,ppid=,command=`.quiet().nothrow())
    if (result.exitCode !== 0) return []

    return result.stdout
      .toString()
      .split("\n")
      .filter(Boolean)
      .flatMap((line) => {
        const match = line.match(/^\s*(\d+)\s+(\d+)\s+(.+)$/)
        if (!match) return []
        return [{ pid: Number(match[1]), ppid: Number(match[2]), command: match[3] ?? "" }]
      })
  })
}

function openExistingTmuxSession(name: string): Effect.Effect<void, TmuxError> {
  if (process.env.TMUX) {
    return runTmuxSwitchClient(name)
  }

  return runTmuxAttachSession(name)
}

function tmuxHasSession(name: string): Effect.Effect<boolean, TmuxError> {
  return tmuxCommand("tmux.has-session", () => $`tmux has-session -t ${name}`.quiet().nothrow()).pipe(
    Effect.map((result) => result.exitCode === 0),
  )
}

function runTmuxNewSession(name: string, path: string): Effect.Effect<void, TmuxError> {
  return tmuxCommand("tmux.new-session", () => $`tmux new-session -d -s ${name} -c ${path}`.quiet()).pipe(Effect.asVoid)
}

function runTmuxSwitchClient(name: string): Effect.Effect<void, TmuxError> {
  return Effect.gen(function* () {
    yield* keepCurrentSessionAlive()
    yield* tmuxCommand("tmux.switch-client", () => $`tmux switch-client -t ${name}`)
  })
}

function keepCurrentSessionAlive(): Effect.Effect<void, TmuxError> {
  return Effect.gen(function* () {
    const result = yield* tmuxCommand("tmux.display-current-session", () =>
      $`tmux display-message -p "#{session_name}"`.quiet().nothrow(),
    )
    if (result.exitCode !== 0) return

    const currentSession = result.stdout.toString().trim()
    if (!currentSession) return

    yield* tmuxCommand("tmux.keep-current-session", () =>
      $`tmux set-option -t ${currentSession} destroy-unattached off`.quiet().nothrow(),
    )
  })
}

function runTmuxAttachSession(name: string): Effect.Effect<void, TmuxError> {
  return tmuxCommand("tmux.attach-session", () => $`tmux attach-session -t ${name} < ${Bun.stdin}`).pipe(Effect.asVoid)
}
