import { formatDirectory, type SessionRow, type SessionStatus } from "../opencode.ts"
import { theme } from "../theme.ts"

export { formatDirectory }

export const NEEDS_INPUT_WINDOW_MS = 60 * 60 * 1000
export const WORKING_MARKERS = [" ", ".", "o", "O", "@", "*", " "]

const WORKTREE_COLORS = [
  theme.error,
  theme.info,
  theme.warning,
  theme.accent,
  theme.success,
  theme.secondary,
  theme.primary,
  theme.textMuted,
]

export type LaneStatus = SessionStatus | "needs-input"

export type Section = {
  status: LaneStatus
  title: string
  marker: string
}

export type Selection = {
  section: LaneStatus
  index: number
}

export type PromptDialogState = {
  row: SessionRow
  value: string
  sending: boolean
  latestUserMessage?: string | undefined
  loadingPreview?: boolean | undefined
  error?: string | undefined
}

export type WorktreeOption = {
  directory: string
  workspaceID?: string | undefined
  name: string
}

export type AddSessionDialogState = {
  projectTitle: string
  worktrees: WorktreeOption[]
  worktreeIndex: number
  value: string
  sending: boolean
  error?: string | undefined
}

export type DeleteSessionDialogState = {
  row: SessionRow
  deleting?: boolean | undefined
  error?: string | undefined
}

export type WrappedLine = {
  key: string
  text: string
}

export type SearchInputProps = {
  value: string
  focused: boolean
  width: number
  onInput: (value: string) => void
  onFocus: () => void
}

export type ProjectTab = {
  id: string
  title: string
  rows: SessionRow[]
  worktreeColors: Record<string, string>
}

export const SECTIONS: Section[] = [
  { status: "working", title: "Working", marker: "*" },
  { status: "needs-input", title: "Needs input", marker: "!" },
  { status: "completed", title: "Completed", marker: "•" },
]

export function formatClock(value?: Date): string {
  return value ? value.toLocaleTimeString() : "never"
}

export function formatAge(timestamp: number, now: Date): string {
  const seconds = Math.max(0, Math.floor((now.getTime() - timestamp) / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}h`
}

export function truncate(value: string, width: number): string {
  if (width <= 1) return ""
  if (value.length <= width) return value
  return `${value.slice(0, width - 1)}…`
}

export function preview(value: string): string {
  return value.replace(/\s+/g, " ").trim() || "No message yet."
}

export function wrapText(
  value: string,
  width: number,
  maxLines: number,
  emptyText = "No previous agent message.",
): WrappedLine[] {
  const source = value.replace(/\r\n?/g, "\n").trimEnd()
  if (!source.trim()) return [{ key: "empty", text: emptyText }]
  if (width <= 1) return [{ key: "narrow", text: "" }]

  const lines: WrappedLine[] = []
  let truncated = false
  let ordinal = 0
  const pushLine = (text: string) => {
    if (lines.length >= maxLines) {
      truncated = true
      return false
    }
    lines.push({ key: `${ordinal}:${text}`, text: text || " " })
    ordinal += 1
    return true
  }

  for (const paragraph of source.split(/\r?\n/)) {
    let remaining = paragraph.replace(/\t/g, "  ")
    if (!remaining && !pushLine(" ")) break

    while (remaining && lines.length < maxLines) {
      if (remaining.length <= width) {
        pushLine(remaining)
        remaining = ""
        break
      }

      const wordBoundary = remaining.lastIndexOf(" ", width)
      const cut = wordBoundary > 0 ? wordBoundary : width
      pushLine(remaining.slice(0, cut).trimEnd())
      remaining = remaining.slice(cut).trimStart()
    }
    if (remaining) truncated = true
    if (lines.length >= maxLines) break
  }

  if (truncated && lines.length > 0) {
    const last = lines[lines.length - 1]!
    last.text = truncate(`${last.text.trimEnd()}…`, width)
    last.key = `${last.key}:truncated`
  }
  return lines
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function nextIndex(current: number, delta: number, length: number): number {
  if (length === 0) return 0
  return (current + delta + length) % length
}

export function isNeedsInput(row: SessionRow, now: Date | number): boolean {
  const timestamp = now instanceof Date ? now.getTime() : now
  return row.status === "completed" && timestamp - row.updated < NEEDS_INPUT_WINDOW_MS
}

export function sectionElementId(status: LaneStatus): string {
  return `section-${status}`
}

export function rowElementId(row: SessionRow): string {
  return `session-${row.id}`
}

export function tabElementId(tab: ProjectTab): string {
  return `tab-${tab.id}`
}

export function count(rows: SessionRow[], status: SessionStatus): number {
  return rows.filter((row) => row.status === status).length
}

export function countLane(rows: SessionRow[], status: LaneStatus, now: Date | number): number {
  return rows.filter((row) => rowInLane(row, status, now)).length
}

export function rowInLane(row: SessionRow, status: LaneStatus, now: Date | number): boolean {
  if (status === "needs-input") return isNeedsInput(row, now)
  if (status === "completed") return row.status === "completed" && !isNeedsInput(row, now)
  return row.status === status
}

export function context(row: SessionRow): string {
  return formatDirectory(row.directory)
}

export function groupRowsByProject(rows: SessionRow[]): ProjectTab[] {
  const tabs = new Map<string, ProjectTab>()
  for (const row of rows) {
    const id = `${row.projectID}\t${row.workspaceID ?? ""}`
    const existing = tabs.get(id)
    if (existing) {
      existing.rows.push(row)
      continue
    }

    tabs.set(id, {
      id,
      title: row.projectTitle,
      rows: [row],
      worktreeColors: {},
    })
  }
  return [...tabs.values()]
    .sort((left, right) => latestActivity(right.rows) - latestActivity(left.rows) || left.id.localeCompare(right.id))
    .map((tab) => ({ ...tab, worktreeColors: assignWorktreeColors(tab.rows) }))
}

function latestActivity(rows: SessionRow[]): number {
  return Math.max(...rows.map((row) => row.updated))
}

export function worktreeOptions(tab?: ProjectTab): WorktreeOption[] {
  if (!tab) return []

  const options = new Map<string, WorktreeOption>()
  for (const row of tab.rows) {
    const id = `${row.directory}\t${row.workspaceID ?? ""}`
    if (options.has(id)) continue
    options.set(id, {
      directory: row.directory,
      ...(row.workspaceID !== undefined ? { workspaceID: row.workspaceID } : {}),
      name: row.worktreeName,
    })
  }
  return [...options.values()].sort((left, right) => left.name.localeCompare(right.name))
}

function assignWorktreeColors(rows: SessionRow[]): Record<string, string> {
  const worktrees = [...new Set(rows.map((row) => row.worktreeName))].sort((left, right) => left.localeCompare(right))
  return Object.fromEntries(
    worktrees.map((worktree, index) => [worktree, WORKTREE_COLORS[index % WORKTREE_COLORS.length] ?? theme.textMuted]),
  )
}

export function selectedRow(
  selection: Selection,
  rowsBySection: Record<LaneStatus, SessionRow[]>,
): SessionRow | undefined {
  return rowsBySection[selection.section][selection.index]
}

export function moveSelection(
  selection: Selection,
  delta: number,
  rowsBySection: Record<LaneStatus, SessionRow[]>,
): Selection {
  const entries = selectableEntries(rowsBySection)
  if (entries.length === 0) return { section: selection.section, index: 0 }

  const currentIndex = entries.findIndex(
    (entry) => entry.section === selection.section && entry.index === selection.index,
  )
  const next = entries[nextIndex(currentIndex === -1 ? 0 : currentIndex, delta, entries.length)]!
  return { section: next.section, index: next.index }
}

export function moveSelectionClamped(
  selection: Selection,
  delta: number,
  rowsBySection: Record<LaneStatus, SessionRow[]>,
): Selection {
  const entries = selectableEntries(rowsBySection)
  if (entries.length === 0) return { section: selection.section, index: 0 }

  const currentIndex = entries.findIndex(
    (entry) => entry.section === selection.section && entry.index === selection.index,
  )
  const next = entries[clamp((currentIndex === -1 ? 0 : currentIndex) + delta, 0, entries.length - 1)]!
  return { section: next.section, index: next.index }
}

export function selectionEdge(
  selection: Selection,
  edge: "top" | "bottom",
  rowsBySection: Record<LaneStatus, SessionRow[]>,
): Selection {
  const entries = selectableEntries(rowsBySection)
  if (entries.length === 0) return { section: selection.section, index: 0 }

  const next = edge === "top" ? entries[0]! : entries[entries.length - 1]!
  return { section: next.section, index: next.index }
}

function selectableEntries(rowsBySection: Record<LaneStatus, SessionRow[]>) {
  return SECTIONS.flatMap((section) =>
    rowsBySection[section.status].map((_row, index) => ({ section: section.status, index })),
  )
}
