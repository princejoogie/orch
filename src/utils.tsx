import { TextAttributes, type InputRenderable, type KeyBinding, type TextareaRenderable } from "@opentui/core"
import { useRef } from "react"
import { formatDirectory, type DashboardSnapshot, type SessionRow, type SessionStatus } from "./opencode.ts"

export { formatDirectory }

export const NEEDS_INPUT_WINDOW_MS = 60 * 60 * 1000
const WORKTREE_COLORS = [
  "#F87171",
  "#22D3EE",
  "#FBBF24",
  "#A78BFA",
  "#34D399",
  "#F472B6",
  "#60A5FA",
  "#FB923C",
  "#A3E635",
  "#F9A8D4",
]
const WORKING_MARKERS = [" ", ".", "o", "O", "@", "*", " "]
const PROMPT_TEXTAREA_KEY_BINDINGS: KeyBinding[] = [
  { name: "return", action: "submit" },
  { name: "kpenter", action: "submit" },
  { name: "linefeed", action: "submit" },
  { name: "return", shift: true, action: "newline" },
  { name: "kpenter", shift: true, action: "newline" },
  { name: "linefeed", shift: true, action: "newline" },
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
  loadingPreview?: boolean
  error?: string
}

export type WorktreeOption = {
  directory: string
  workspaceID?: string
  name: string
}

export type AddSessionDialogState = {
  projectTitle: string
  worktrees: WorktreeOption[]
  worktreeIndex: number
  value: string
  sending: boolean
  error?: string
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

export function wrapText(value: string, width: number, maxLines: number): WrappedLine[] {
  const source = value.replace(/\r\n?/g, "\n").trimEnd()
  if (!source.trim()) return [{ key: "empty", text: "No previous agent message." }]
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
    options.set(id, { directory: row.directory, workspaceID: row.workspaceID, name: row.worktreeName })
  }
  return [...options.values()].sort((left, right) => left.name.localeCompare(right.name))
}

function assignWorktreeColors(rows: SessionRow[]): Record<string, string> {
  const worktrees = [...new Set(rows.map((row) => row.worktreeName))].sort((left, right) => left.localeCompare(right))
  return Object.fromEntries(
    worktrees.map((worktree, index) => [worktree, WORKTREE_COLORS[index % WORKTREE_COLORS.length]]),
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

export function Header({ snapshot }: { snapshot?: DashboardSnapshot }) {
  const rows = snapshot?.rows ?? []
  const now = Date.now()
  return (
    <box style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <text content="opencode orchestrator" style={{ fg: "#7DD3FC", attributes: TextAttributes.BOLD }} />
      <text
        content={`${snapshot?.serverUrl ?? "http://localhost:4096"} · ${rows.length} sessions · ${countLane(rows, "working", now)} working · ${countLane(rows, "needs-input", now)} needs input · ${countLane(rows, "completed", now)} completed`}
        style={{ fg: "#94A3B8" }}
      />
    </box>
  )
}

export function ProjectTabs({ tabs, activeIndex, width }: { tabs: ProjectTab[]; activeIndex: number; width: number }) {
  const tabWidth = Math.max(10, Math.min(24, Math.floor(width / Math.max(1, Math.min(tabs.length, 5))) - 1))

  return (
    <box style={{ flexDirection: "row", marginTop: 1 }}>
      {tabs.length === 0 ? <text content="no projects" style={{ fg: "#64748B" }} /> : null}
      {tabs.map((tab, index) => {
        const active = index === activeIndex
        const working = count(tab.rows, "working")
        const label = `${truncate(tab.title, Math.max(1, tabWidth - 4))} ${working}/${tab.rows.length}`
        return (
          <text
            id={tabElementId(tab)}
            key={tab.id}
            content={` ${truncate(label, tabWidth).padEnd(tabWidth)} `}
            style={{
              fg: active ? "#F8FAFC" : "#94A3B8",
              bg: active ? "#1E3A8A" : undefined,
              attributes: active ? TextAttributes.BOLD : undefined,
              marginRight: 1,
            }}
          />
        )
      })}
    </box>
  )
}

export function SearchInput({ value, focused, width, onInput }: SearchInputProps) {
  const inputRef = useRef<InputRenderable>(null)
  const inputWidth = Math.min(44, Math.max(16, width - 8))

  return (
    <box style={{ flexDirection: "row" }}>
      <box
        style={{
          border: true,
          borderColor: focused ? "#38BDF8" : value ? "#475569" : "#1E293B",
          height: 3,
          paddingLeft: 1,
          paddingRight: 1,
          width: inputWidth,
        }}
      >
        <input
          ref={inputRef}
          value={value}
          focused={focused}
          placeholder="Search sessions"
          style={{ width: inputWidth - 4 }}
          onInput={(nextValue) => onInput(nextValue)}
        />
      </box>
    </box>
  )
}

function tableLayout(width: number) {
  const gap = 4
  const ageWidth = 6
  const contextWidth = 13
  const availableWidth = Math.max(4, width - 2 - gap * 4)
  const variableWidth = Math.max(3, availableWidth - ageWidth - contextWidth)
  const titleWidth = Math.min(56, Math.max(8, Math.floor(variableWidth * 0.5)))
  const worktreeWidth = Math.min(48, Math.max(8, Math.floor(variableWidth * 0.4)))
  const messageWidth = Math.max(3, variableWidth - titleWidth - worktreeWidth)
  return { titleWidth, messageWidth, worktreeWidth, contextWidth, ageWidth, gap: " ".repeat(gap) }
}

export function TableHeader({ width }: { width: number }) {
  const { titleWidth, messageWidth, worktreeWidth, contextWidth, ageWidth, gap } = tableLayout(width)

  return (
    <box style={{ flexDirection: "row", marginBottom: 1 }}>
      <text content="  " style={{ fg: "#64748B" }} />
      <text content={"Title".padEnd(titleWidth)} style={{ fg: "#64748B", attributes: TextAttributes.BOLD }} />
      <text content={gap} style={{ fg: "#64748B" }} />
      <text content={"Latest".padEnd(messageWidth)} style={{ fg: "#64748B", attributes: TextAttributes.BOLD }} />
      <text content={gap} style={{ fg: "#64748B" }} />
      <text content={"Worktree".padEnd(worktreeWidth)} style={{ fg: "#64748B", attributes: TextAttributes.BOLD }} />
      <text content={gap} style={{ fg: "#64748B" }} />
      <text content={"Context".padStart(contextWidth)} style={{ fg: "#64748B", attributes: TextAttributes.BOLD }} />
      <text content={gap} style={{ fg: "#64748B" }} />
      <text content={"Age".padStart(ageWidth)} style={{ fg: "#64748B", attributes: TextAttributes.BOLD }} />
    </box>
  )
}

export function SectionView({
  section,
  rows,
  worktreeColors,
  selection,
  active,
  now,
  width,
}: {
  section: Section
  rows: SessionRow[]
  worktreeColors: Record<string, string>
  selection: Selection
  active: boolean
  now: Date
  width: number
}) {
  const { titleWidth, messageWidth, worktreeWidth, contextWidth, ageWidth, gap } = tableLayout(width)

  return (
    <box style={{ flexDirection: "column", marginBottom: 1 }}>
      <box id={sectionElementId(section.status)} style={{ flexDirection: "row", marginBottom: 1 }}>
        <text
          content={`${active ? "> " : "  "}${section.title}`}
          style={{ fg: active ? "#F8FAFC" : "#E2E8F0", attributes: TextAttributes.BOLD }}
        />
        <text content={` ${rows.length}`} style={{ fg: "#64748B" }} />
      </box>
      {rows.length === 0 ? <text content="  none" style={{ fg: "#475569" }} /> : null}
      {rows.map((row, index) => {
        const selected = active && selection.index === index
        return (
          <box
            id={rowElementId(row)}
            key={row.id}
            style={{ flexDirection: "row", backgroundColor: selected ? "#334155" : undefined }}
          >
            <text content={`${sectionMarker(section, now)} `} style={{ fg: sectionMarkerColor(section.status) }} />
            <text
              content={truncate(row.title, titleWidth).padEnd(titleWidth)}
              style={{ fg: selected ? "#F8FAFC" : "#E2E8F0", attributes: selected ? TextAttributes.BOLD : undefined }}
            />
            <text content={gap} style={{ fg: selected ? "#CBD5E1" : "#94A3B8" }} />
            <text
              content={truncate(preview(row.latestMessage), messageWidth).padEnd(messageWidth)}
              style={{ fg: selected ? "#CBD5E1" : "#94A3B8" }}
            />
            <text content={gap} style={{ fg: selected ? "#CBD5E1" : "#94A3B8" }} />
            <text content="● " style={{ fg: worktreeColors[row.worktreeName] ?? "#94A3B8" }} />
            <text
              content={truncate(row.worktreeName, Math.max(1, worktreeWidth - 2)).padEnd(worktreeWidth - 2)}
              style={{ fg: selected ? "#CBD5E1" : "#94A3B8" }}
            />
            <text content={gap} style={{ fg: selected ? "#CBD5E1" : "#94A3B8" }} />
            <text
              content={formatContextUsage(row).padStart(contextWidth)}
              style={{ fg: selected ? "#F8FAFC" : "#CBD5E1" }}
            />
            <text content={gap} style={{ fg: selected ? "#CBD5E1" : "#94A3B8" }} />
            <text
              content={formatAge(row.updated, now).padStart(ageWidth)}
              style={{ fg: selected ? "#F8FAFC" : "#CBD5E1" }}
            />
          </box>
        )
      })}
    </box>
  )
}

function formatContextUsage(row: SessionRow): string {
  if (row.contextTokens === undefined) return "-"
  const tokens = formatTokenCount(row.contextTokens)
  return row.contextPercent === undefined ? tokens : `${tokens} (${row.contextPercent}%)`
}

function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`
  return String(tokens)
}

function sectionMarkerColor(status: LaneStatus): string {
  if (status === "working") return "#FBBF24"
  if (status === "needs-input") return "#38BDF8"
  return "#86EFAC"
}

function sectionMarker(section: Section, now: Date): string {
  if (section.status !== "working") return section.marker
  return WORKING_MARKERS[Math.floor(now.getTime() / 80) % WORKING_MARKERS.length]!
}

export function PromptDialog({
  state,
  width,
  height,
  onInput,
  onSubmit,
}: {
  state: PromptDialogState
  width: number
  height: number
  onInput: (value: string) => void
  onSubmit: (value: string) => void
}) {
  const textareaRef = useRef<TextareaRenderable>(null)
  const dialogWidth = Math.min(Math.max(48, Math.floor(width * 0.7)), 80, width - 4)
  const inputHeight = 5
  const previewHeight = 4
  const messageLines = state.loadingPreview
    ? [{ key: "loading", text: "Loading previous agent message..." }]
    : wrapText(state.row.latestMessage, dialogWidth - 6, previewHeight)
  const dialogHeight = 10 + inputHeight + previewHeight + (state.error ? 1 : 0)

  return (
    <box
      style={{
        position: "absolute",
        zIndex: 20,
        left: Math.max(1, Math.floor((width - dialogWidth) / 2)),
        top: Math.max(1, Math.floor((height - dialogHeight) / 2)),
        width: dialogWidth,
        height: dialogHeight,
        border: true,
        borderColor: state.error ? "#F87171" : "#38BDF8",
        backgroundColor: "#0F172A",
        flexDirection: "column",
        padding: 1,
      }}
    >
      <text content="Previous message" style={{ fg: "#CBD5E1", attributes: TextAttributes.BOLD }} />
      <box
        style={{
          flexDirection: "column",
          height: previewHeight,
          marginBottom: 1,
          marginTop: 1,
          paddingLeft: 1,
          paddingRight: 1,
        }}
      >
        {messageLines.map((line) => (
          <text key={line.key} content={line.text} style={{ fg: "#94A3B8" }} />
        ))}
      </box>
      <box
        style={{
          height: inputHeight + 2,
          border: true,
          borderColor: "#334155",
          paddingLeft: 1,
          paddingRight: 1,
          marginBottom: 1,
        }}
      >
        <textarea
          ref={textareaRef}
          placeholder={state.sending ? "Sending..." : "Type prompt"}
          initialValue={state.value}
          focused={!state.sending}
          style={{ width: "100%", height: inputHeight, wrapMode: "word" }}
          keyBindings={PROMPT_TEXTAREA_KEY_BINDINGS}
          onContentChange={() => onInput(textareaRef.current?.plainText ?? state.value)}
          onSubmit={() => onSubmit(textareaRef.current?.plainText ?? state.value)}
        />
      </box>
      {state.error ? <text content={truncate(state.error, dialogWidth - 4)} style={{ fg: "#F87171" }} /> : null}
      <text content="Enter send · Shift-Enter newline · Esc cancel" style={{ fg: "#64748B" }} />
    </box>
  )
}

export function AddSessionDialog({
  state,
  width,
  height,
  onInput,
  onSubmit,
}: {
  state: AddSessionDialogState
  width: number
  height: number
  onInput: (value: string) => void
  onSubmit: (value: string) => void
}) {
  const textareaRef = useRef<TextareaRenderable>(null)
  const dialogWidth = Math.min(Math.max(56, Math.floor(width * 0.7)), 80, width - 4)
  const inputHeight = 5
  const worktreeLines = Math.min(state.worktrees.length, 6)
  const worktreeStart = clamp(
    state.worktreeIndex - worktreeLines + 1,
    0,
    Math.max(0, state.worktrees.length - worktreeLines),
  )
  const dialogHeight = Math.max(1, Math.min(height - 2, 13 + inputHeight + worktreeLines + (state.error ? 1 : 0)))

  return (
    <box
      style={{
        position: "absolute",
        zIndex: 20,
        left: Math.max(1, Math.floor((width - dialogWidth) / 2)),
        top: Math.max(1, Math.floor((height - dialogHeight) / 2)),
        width: dialogWidth,
        height: dialogHeight,
        border: true,
        borderColor: state.error ? "#F87171" : "#38BDF8",
        backgroundColor: "#0F172A",
        flexDirection: "column",
        padding: 1,
      }}
    >
      <text
        content={`New session in ${truncate(state.projectTitle, dialogWidth - 18)}`}
        style={{ fg: "#F8FAFC", attributes: TextAttributes.BOLD }}
      />
      <text content="Worktree" style={{ fg: "#CBD5E1", attributes: TextAttributes.BOLD, marginTop: 1 }} />
      <box style={{ flexDirection: "column", height: worktreeLines, marginBottom: 1 }}>
        {state.worktrees.slice(worktreeStart, worktreeStart + worktreeLines).map((worktree, offset) => {
          const index = worktreeStart + offset
          const selected = index === state.worktreeIndex
          return (
            <text
              key={`${worktree.directory}:${worktree.workspaceID ?? ""}`}
              content={`${selected ? "> " : "  "}${truncate(worktree.name, dialogWidth - 6)}`}
              style={{ fg: selected ? "#F8FAFC" : "#94A3B8", attributes: selected ? TextAttributes.BOLD : undefined }}
            />
          )
        })}
      </box>
      <box
        style={{
          height: inputHeight + 2,
          border: true,
          borderColor: "#334155",
          paddingLeft: 1,
          paddingRight: 1,
          marginBottom: 1,
        }}
      >
        <textarea
          ref={textareaRef}
          placeholder={state.sending ? "Creating..." : "Type first prompt"}
          initialValue={state.value}
          focused={!state.sending}
          style={{ width: "100%", height: inputHeight, wrapMode: "word" }}
          keyBindings={PROMPT_TEXTAREA_KEY_BINDINGS}
          onContentChange={() => onInput(textareaRef.current?.plainText ?? state.value)}
          onSubmit={() => onSubmit(textareaRef.current?.plainText ?? state.value)}
        />
      </box>
      {state.error ? <text content={truncate(state.error, dialogWidth - 4)} style={{ fg: "#F87171" }} /> : null}
      <text content="Tab select worktree · Enter create · Shift-Enter newline · Esc cancel" style={{ fg: "#64748B" }} />
    </box>
  )
}
