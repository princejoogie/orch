import { formatDirectory, type ProjectRow, type SessionRow, type SessionStatus } from "../opencode.ts"
import { theme } from "../theme.ts"

export { formatDirectory }

export const NEEDS_INPUT_WINDOW_MS = 4 * 60 * 60 * 1000
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
  type: "section" | "row"
  section: LaneStatus
  index: number
  sessionId?: string | undefined
}

export type CollapsedSections = Partial<Record<LaneStatus, boolean>>

export type PromptDialogState = {
  row: SessionRow
  modelProviders: ModelProviderOption[]
  modelProviderIndex: number
  modelIndex: number
  variantIndex: number
  focus: "input" | "model-provider" | "model" | "variant"
  value: string
  sending: boolean
  error?: string | undefined
}

export type WorktreeOption = {
  directory: string
  workspaceID?: string | undefined
  primary?: boolean | undefined
  name: string
}

export type ModelOption = {
  providerID: string
  providerName: string
  modelID: string
  name: string
  variants: string[]
}

export type ModelProviderOption = {
  id: string
  name: string
  models: ModelOption[]
}

export type AddSessionDialogState = {
  projectTitle: string
  projectDirectory: string
  workspaceID?: string | undefined
  initialModel?: SessionRow["model"] | undefined
  worktrees: WorktreeOption[]
  worktreeIndex: number
  modelProviders: ModelProviderOption[]
  modelProviderIndex: number
  modelIndex: number
  variantIndex: number
  focus: "input" | "worktree" | "model-provider" | "model" | "variant"
  value: string
  sending: boolean
  error?: string | undefined
}

export type DeleteWorktreeDialogState = {
  projectDirectory: string
  worktree: WorktreeOption
}

export type DeleteSessionDialogState = {
  rows: SessionRow[]
  deleting?: boolean | undefined
  error?: string | undefined
}

export type InterruptSessionDialogState = {
  rows: SessionRow[]
  interrupting?: boolean | undefined
  error?: string | undefined
}

export type WrappedLine = {
  key: string
  text: string
}

export type ProjectTab = {
  id: string
  title: string
  directory: string
  rows: SessionRow[]
  worktreeColors: Record<string, string>
  worktrees: WorktreeOption[]
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
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

export function truncate(value: string, width: number): string {
  if (width <= 1) return ""
  if (value.length <= width) return value
  return `${value.slice(0, width - 1)}…`
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function shortcutHintLine(label: string, hint: string, width: number): string {
  const suffix = ` ${hint}`
  if (width <= suffix.length + 1) return truncate(`${label}${suffix}`, width)
  return `${truncate(label, width - suffix.length).padEnd(width - suffix.length)}${suffix}`
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

export function projectTabs(projects: ProjectRow[], rowsByProjectId: Record<string, SessionRow[]>): ProjectTab[] {
  return [...projects]
    .sort((left, right) => right.updated - left.updated || left.title.localeCompare(right.title))
    .map((project) => {
      const projectRows = rowsByProjectId[project.id] ?? []
      return {
        id: project.id,
        title: project.title,
        directory: project.directory,
        rows: projectRows,
        worktreeColors: assignWorktreeColors(projectRows),
        worktrees:
          project.worktrees.length > 0
            ? project.worktrees
            : [{ directory: project.directory, name: project.worktreeName, primary: true }],
      }
    })
}

export function worktreeOptions(tab?: ProjectTab): WorktreeOption[] {
  const worktrees = tab?.worktrees ?? []
  const byDirectory = new Map<string, WorktreeOption>()

  for (const worktree of worktrees) {
    if (!byDirectory.has(worktree.directory)) byDirectory.set(worktree.directory, worktree)
  }

  return [...byDirectory.values()]
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
  collapsedSections: CollapsedSections = {},
): SessionRow | undefined {
  const normalized = normalizeSelection(selection, rowsBySection, collapsedSections)
  if (normalized.type !== "row") return undefined
  return rowsBySection[normalized.section][normalized.index]
}

export function normalizeSelection(
  selection: Selection,
  rowsBySection: Record<LaneStatus, SessionRow[]>,
  collapsedSections: CollapsedSections = {},
): Selection {
  const entries = selectableEntries(rowsBySection, collapsedSections)
  if (entries.length === 0) return { type: "section", section: selection.section, index: 0 }

  if (selection.sessionId) {
    const selectedEntry = entries.find((entry) => entry.type === "row" && entry.row.id === selection.sessionId)
    if (selectedEntry) return entrySelection(selectedEntry)
  }

  if (selection.type === "section") return { type: "section", section: selection.section, index: 0 }

  const row = !collapsedSections[selection.section] ? rowsBySection[selection.section][selection.index] : undefined
  if (row) return { type: "row", section: selection.section, index: selection.index, sessionId: row.id }

  if (SECTIONS.some((section) => section.status === selection.section)) {
    return { type: "section", section: selection.section, index: 0 }
  }

  return entrySelection(entries[0]!)
}

export function moveSelection(
  selection: Selection,
  delta: number,
  rowsBySection: Record<LaneStatus, SessionRow[]>,
  collapsedSections: CollapsedSections = {},
): Selection {
  const entries = selectableEntries(rowsBySection, collapsedSections)
  if (entries.length === 0) return { type: "section", section: selection.section, index: 0 }

  const currentIndex = selectionEntryIndex(selection, entries)
  const next = entries[nextIndex(currentIndex === -1 ? 0 : currentIndex, delta, entries.length)]!
  return entrySelection(next)
}

export function moveSelectionClamped(
  selection: Selection,
  delta: number,
  rowsBySection: Record<LaneStatus, SessionRow[]>,
  collapsedSections: CollapsedSections = {},
): Selection {
  const entries = selectableEntries(rowsBySection, collapsedSections)
  if (entries.length === 0) return { type: "section", section: selection.section, index: 0 }

  const currentIndex = selectionEntryIndex(selection, entries)
  const next = entries[clamp((currentIndex === -1 ? 0 : currentIndex) + delta, 0, entries.length - 1)]!
  return entrySelection(next)
}

export function selectionEdge(
  selection: Selection,
  edge: "top" | "bottom",
  rowsBySection: Record<LaneStatus, SessionRow[]>,
  collapsedSections: CollapsedSections = {},
): Selection {
  const entries = selectableEntries(rowsBySection, collapsedSections)
  if (entries.length === 0) return { type: "section", section: selection.section, index: 0 }

  const next = edge === "top" ? entries[0]! : entries[entries.length - 1]!
  return entrySelection(next)
}

function selectableEntries(rowsBySection: Record<LaneStatus, SessionRow[]>, collapsedSections: CollapsedSections) {
  return SECTIONS.flatMap((section) => [
    { type: "section" as const, section: section.status, index: 0 },
    ...(collapsedSections[section.status]
      ? []
      : rowsBySection[section.status].map((row, index) => ({
          type: "row" as const,
          section: section.status,
          index,
          row,
        }))),
  ])
}

function selectionEntryIndex(selection: Selection, entries: ReturnType<typeof selectableEntries>): number {
  if (selection.sessionId) {
    const sessionIndex = entries.findIndex((entry) => entry.type === "row" && entry.row.id === selection.sessionId)
    if (sessionIndex !== -1) return sessionIndex
  }

  return entries.findIndex(
    (entry) => entry.type === selection.type && entry.section === selection.section && entry.index === selection.index,
  )
}

function entrySelection(entry: ReturnType<typeof selectableEntries>[number]): Selection {
  return entry.type === "section"
    ? { type: "section", section: entry.section, index: 0 }
    : { type: "row", section: entry.section, index: entry.index, sessionId: entry.row.id }
}
