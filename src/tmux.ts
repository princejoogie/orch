import { createHash } from "node:crypto"
import { $ } from "bun"
import type { SessionRow } from "./opencode.ts"

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

export async function openTmuxSessionForRow(row: SessionRow): Promise<void> {
  const sessionName = await resolveSessionName(row)

  if (!(await tmuxHasSession(sessionName))) {
    await runTmuxNewSession(sessionName, row.directory)
  }

  await focusOpencodePane(sessionName)
  await openExistingTmuxSession(sessionName)
}

async function resolveSessionName(row: SessionRow): Promise<string> {
  const baseName = baseSessionName(row)
  const hashedName = `${baseName}_${hashPath(row.directory)}`
  const sessions = await listTmuxSessionNames()

  if (sessions.includes(baseName)) return baseName
  if (sessions.includes(hashedName)) return hashedName
  return baseName
}

function baseSessionName(row: SessionRow): string {
  if (row.worktreeName && row.worktreeName !== row.projectTitle) {
    return sanitizeSessionName(`${row.projectTitle}_${row.worktreeName}`)
  }

  return sanitizeSessionName(row.projectTitle)
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

async function focusOpencodePane(sessionName: string): Promise<void> {
  const pane = await findOpencodePane(sessionName)
  if (!pane) return

  await $`tmux select-window -t ${pane.windowId}`.quiet()
  await $`tmux select-pane -t ${pane.paneId}`.quiet()
}

async function findOpencodePane(sessionName: string): Promise<Pane | undefined> {
  const panes = await listPanes(sessionName)
  if (panes.length === 0) return undefined

  const direct = panes.find((pane) => isOpencodeCommand(pane.currentCommand))
  if (direct) return direct

  const processes = await listProcesses()
  const childrenByParent = new Map<number, ProcessRow[]>()
  for (const process of processes) {
    const children = childrenByParent.get(process.ppid) ?? []
    children.push(process)
    childrenByParent.set(process.ppid, children)
  }

  return panes.find((pane) => hasOpencodeDescendant(pane.pid, childrenByParent))
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

async function listTmuxSessionNames(): Promise<string[]> {
  const result = await $`tmux list-sessions -F "#{session_name}"`.quiet().nothrow()
  if (result.exitCode !== 0) return []

  return result.stdout.toString().split("\n").filter(Boolean)
}

async function listPanes(sessionName: string): Promise<Pane[]> {
  const format = "#{pane_id}\t#{window_id}\t#{pane_current_command}\t#{pane_pid}"
  const result = await $`tmux list-panes -t ${sessionName} -s -F ${format}`.quiet().nothrow()
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
}

async function listProcesses(): Promise<ProcessRow[]> {
  const result = await $`ps -axo pid=,ppid=,command=`.quiet().nothrow()
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
}

async function openExistingTmuxSession(name: string): Promise<void> {
  if (process.env.TMUX) {
    await runTmuxSwitchClient(name)
  } else {
    await runTmuxAttachSession(name)
  }
}

async function tmuxHasSession(name: string): Promise<boolean> {
  const result = await $`tmux has-session -t ${name}`.quiet().nothrow()
  return result.exitCode === 0
}

async function runTmuxNewSession(name: string, path: string): Promise<void> {
  await $`tmux new-session -d -s ${name} -c ${path}`.quiet()
}

async function runTmuxSwitchClient(name: string): Promise<void> {
  await $`tmux switch-client -t ${name}`
}

async function runTmuxAttachSession(name: string): Promise<void> {
  await $`tmux attach-session -t ${name} < ${Bun.stdin}`
}
