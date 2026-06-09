import { TextAttributes } from "@opentui/core"
import { useNow } from "../hooks/use-now.ts"
import {
  formatAge,
  displayWorktreeName,
  preview,
  rowElementId,
  sectionElementId,
  truncate,
  WORKING_MARKERS,
  type LaneStatus,
  type Section,
  type Selection,
} from "../lib/utils.ts"
import { type SessionRow } from "../opencode.ts"
import { theme } from "../theme.ts"

function tableLayout(width: number) {
  const gap = 4
  const ageWidth = 6
  const contextWidth = 13
  const availableWidth = Math.max(4, width - 2 - gap * 4)
  const variableWidth = Math.max(3, availableWidth - ageWidth - contextWidth)
  const titleWidth = Math.min(48, Math.max(8, Math.floor(variableWidth * 0.38)))
  const messageWidth = Math.min(28, Math.max(8, Math.floor(variableWidth * 0.22)))
  const worktreeWidth = Math.max(3, variableWidth - titleWidth - messageWidth)
  return { titleWidth, messageWidth, worktreeWidth, contextWidth, ageWidth, gap: " ".repeat(gap) }
}

export function TableHeader({ width }: { width: number }) {
  const { titleWidth, messageWidth, worktreeWidth, contextWidth, ageWidth, gap } = tableLayout(width)

  return (
    <box style={{ flexDirection: "row", flexWrap: "no-wrap", height: 1, marginBottom: 1, overflow: "hidden", width }}>
      <text content="  " style={{ fg: theme.textMuted }} />
      <text content={"Title".padEnd(titleWidth)} style={{ fg: theme.textMuted, attributes: TextAttributes.BOLD }} />
      <text content={gap} style={{ fg: theme.textMuted }} />
      <text content={"Latest".padEnd(messageWidth)} style={{ fg: theme.textMuted, attributes: TextAttributes.BOLD }} />
      <text content={gap} style={{ fg: theme.textMuted }} />
      <text
        content={"Worktree".padEnd(worktreeWidth)}
        style={{ fg: theme.textMuted, attributes: TextAttributes.BOLD }}
      />
      <text content={gap} style={{ fg: theme.textMuted }} />
      <text
        content={"Context".padStart(contextWidth)}
        style={{ fg: theme.textMuted, attributes: TextAttributes.BOLD }}
      />
      <text content={gap} style={{ fg: theme.textMuted }} />
      <text content={"Age".padStart(ageWidth)} style={{ fg: theme.textMuted, attributes: TextAttributes.BOLD }} />
    </box>
  )
}

export function SectionView({
  section,
  rows,
  worktreeColors,
  selection,
  active,
  collapsed,
  width,
  hoveredRowId,
  selectedSessionIds,
  multiSelectActive,
  onRowHover,
  onHeaderSelect,
  onHeaderClick,
  onRowSelect,
  onRowClick,
}: {
  section: Section
  rows: SessionRow[]
  worktreeColors: Record<string, string>
  selection: Selection
  active: boolean
  collapsed: boolean
  width: number
  hoveredRowId?: string | undefined
  selectedSessionIds: ReadonlySet<string>
  multiSelectActive: boolean
  onRowHover: (rowId: string | undefined) => void
  onHeaderSelect: () => void
  onHeaderClick: () => void
  onRowSelect: (selection: Selection) => void
  onRowClick: (row: SessionRow) => void
}) {
  const headerSelected = active && selection.type === "section"
  const headerContent = `${headerSelected ? "> " : "  "}${collapsed ? "+" : "-"} ${section.title}`

  return (
    <box style={{ flexDirection: "column", marginBottom: 1, width }}>
      <box
        id={sectionElementId(section.status)}
        style={{
          flexDirection: "row",
          flexWrap: "no-wrap",
          height: 1,
          overflow: "hidden",
          width,
          ...(headerSelected ? { backgroundColor: theme.backgroundElement } : {}),
        }}
        onMouseDown={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onHeaderSelect()
        }}
      >
        <box
          style={{ flexDirection: "row", flexWrap: "no-wrap", height: 1, width: headerContent.length }}
          onMouseDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onHeaderSelect()
            onHeaderClick()
          }}
        >
          <text content={headerContent} style={{ fg: theme.text, attributes: TextAttributes.BOLD }} />
        </box>
        <text content={` ${rows.length}`} style={{ fg: theme.textMuted }} />
      </box>
      {!collapsed && rows.length === 0 ? <text content="  none" style={{ fg: theme.border }} /> : null}
      {!collapsed &&
        rows.map((row, index) => (
          <SessionItem
            key={row.id}
            row={row}
            section={section}
            selected={active && selection.type === "row" && selection.index === index && selection.sessionId === row.id}
            hovered={hoveredRowId === row.id}
            checked={selectedSessionIds.has(row.id)}
            multiSelectActive={multiSelectActive}
            worktreeColors={worktreeColors}
            width={width}
            onHover={(hovered) => onRowHover(hovered ? row.id : undefined)}
            onSelect={() => onRowSelect({ type: "row", section: section.status, index, sessionId: row.id })}
            onClick={() => onRowClick(row)}
          />
        ))}
    </box>
  )
}

function SessionItem({
  row,
  section,
  selected,
  hovered,
  checked,
  multiSelectActive,
  worktreeColors,
  width,
  onHover,
  onSelect,
  onClick,
}: {
  row: SessionRow
  section: Section
  selected: boolean
  hovered: boolean
  checked: boolean
  multiSelectActive: boolean
  worktreeColors: Record<string, string>
  width: number
  onHover: (hovered: boolean) => void
  onSelect: () => void
  onClick: () => void
}) {
  const now = useNow(80)
  const { titleWidth, messageWidth, worktreeWidth, contextWidth, ageWidth, gap } = tableLayout(width)
  const worktreeColor = worktreeColors[row.worktreeName] ?? theme.textMuted
  const worktreeName = displayWorktreeName(row.worktreeName)
  const hasResponseError = row.pendingPermissionRequests.length === 0 && Boolean(row.latestResponseError)
  const backgroundColor = selected
    ? theme.backgroundElement
    : checked
      ? theme.backgroundPanel
      : hovered
        ? theme.backgroundPanel
        : undefined

  return (
    <box
      id={rowElementId(row)}
      style={{
        flexDirection: "row",
        flexWrap: "no-wrap",
        height: 1,
        overflow: "hidden",
        width,
        ...(backgroundColor ? { backgroundColor } : {}),
      }}
      onMouseDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onSelect()
        onClick()
      }}
      onMouseOver={() => onHover(true)}
      onMouseOut={() => onHover(false)}
    >
      <text
        content={multiSelectActive ? `${checked ? "☑" : "☐"} ` : `${rowMarker(row, section, now)} `}
        style={{ fg: multiSelectActive && checked ? theme.primary : rowMarkerColor(row, section.status) }}
      />
      <text
        content={truncate(row.title, titleWidth).padEnd(titleWidth)}
        style={{ fg: theme.text, ...(selected ? { attributes: TextAttributes.BOLD } : {}) }}
      />
      <text content={gap} style={{ fg: selected ? theme.text : theme.textMuted }} />
      <text
        content={truncate(preview(row.latestMessage), messageWidth).padEnd(messageWidth)}
        style={{ fg: hasResponseError ? theme.error : selected ? theme.text : theme.textMuted }}
      />
      <text content={gap} style={{ fg: selected ? theme.text : theme.textMuted }} />
      <text content="● " style={{ fg: worktreeColor }} />
      <text
        content={truncate(worktreeName, Math.max(1, worktreeWidth - 2)).padEnd(worktreeWidth - 2)}
        style={{ fg: selected ? theme.text : theme.textMuted }}
      />
      <text content={gap} style={{ fg: selected ? theme.text : theme.textMuted }} />
      <text content={formatContextUsage(row).padStart(contextWidth)} style={{ fg: theme.text }} />
      <text content={gap} style={{ fg: selected ? theme.text : theme.textMuted }} />
      <text content={formatAge(row.updated, now).padStart(ageWidth)} style={{ fg: theme.text }} />
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
  if (status === "working") return theme.warning
  if (status === "needs-input") return theme.info
  return theme.success
}

function rowMarkerColor(row: SessionRow, status: LaneStatus): string {
  if (row.pendingPermissionRequests.length > 0) return theme.warning
  if (row.latestResponseError) return theme.error
  return sectionMarkerColor(status)
}

function sectionMarker(section: Section, now: Date): string {
  if (section.status !== "working") return section.marker
  return WORKING_MARKERS[Math.floor(now.getTime() / 80) % WORKING_MARKERS.length]!
}

function rowMarker(row: SessionRow, section: Section, now: Date): string {
  if (row.pendingPermissionRequests.length > 0) return "△"
  if (row.latestResponseError) return "×"
  return sectionMarker(section, now)
}
