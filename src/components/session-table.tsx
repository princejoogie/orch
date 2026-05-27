import { TextAttributes } from "@opentui/core"
import { useNow } from "../hooks/use-now.ts"
import {
  formatAge,
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
    <box style={{ flexDirection: "row", flexWrap: "no-wrap", height: 1, marginBottom: 1, overflow: "hidden", width }}>
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
  width,
}: {
  section: Section
  rows: SessionRow[]
  worktreeColors: Record<string, string>
  selection: Selection
  active: boolean
  width: number
}) {
  return (
    <box style={{ flexDirection: "column", marginBottom: 1, width }}>
      <box
        id={sectionElementId(section.status)}
        style={{ flexDirection: "row", flexWrap: "no-wrap", height: 1, marginBottom: 1, overflow: "hidden", width }}
      >
        <text
          content={`${active ? "> " : "  "}${section.title}`}
          style={{ fg: active ? "#F8FAFC" : "#E2E8F0", attributes: TextAttributes.BOLD }}
        />
        <text content={` ${rows.length}`} style={{ fg: "#64748B" }} />
      </box>
      {rows.length === 0 ? <text content="  none" style={{ fg: "#475569" }} /> : null}
      {rows.map((row, index) => (
        <SessionItem
          key={row.id}
          row={row}
          section={section}
          selected={active && selection.index === index}
          worktreeColors={worktreeColors}
          width={width}
        />
      ))}
    </box>
  )
}

function SessionItem({
  row,
  section,
  selected,
  worktreeColors,
  width,
}: {
  row: SessionRow
  section: Section
  selected: boolean
  worktreeColors: Record<string, string>
  width: number
}) {
  const now = useNow(80)
  const { titleWidth, messageWidth, worktreeWidth, contextWidth, ageWidth, gap } = tableLayout(width)
  const worktreeColor = worktreeColors[row.worktreeName] ?? "#94A3B8"

  return (
    <box
      id={rowElementId(row)}
      style={{
        flexDirection: "row",
        flexWrap: "no-wrap",
        height: 1,
        overflow: "hidden",
        width,
        backgroundColor: selected ? "#334155" : undefined,
      }}
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
      <text content="● " style={{ fg: worktreeColor }} />
      <text
        content={truncate(row.worktreeName, Math.max(1, worktreeWidth - 2)).padEnd(worktreeWidth - 2)}
        style={{ fg: selected ? "#CBD5E1" : "#94A3B8" }}
      />
      <text content={gap} style={{ fg: selected ? "#CBD5E1" : "#94A3B8" }} />
      <text content={formatContextUsage(row).padStart(contextWidth)} style={{ fg: selected ? "#F8FAFC" : "#CBD5E1" }} />
      <text content={gap} style={{ fg: selected ? "#CBD5E1" : "#94A3B8" }} />
      <text content={formatAge(row.updated, now).padStart(ageWidth)} style={{ fg: selected ? "#F8FAFC" : "#CBD5E1" }} />
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
