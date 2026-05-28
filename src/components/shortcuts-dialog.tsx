import { TextAttributes } from "@opentui/core"
import { mouseAction } from "./ui/button.tsx"
import { fitCell, HintRow, PlainLine, SearchDialogFrame, TextLine } from "./ui/dialog.tsx"
import { theme } from "../theme.ts"

type ShortcutScope = "Session" | "Navigation" | "Projects" | "App"

export type ShortcutAction =
  | "prompt-selected-session"
  | "create-session"
  | "delete-selected-session"
  | "start-visual-selection"
  | "toggle-session-selection"
  | "clear-session-selection"
  | "open-selected-in-tmux"
  | "move-selection-down"
  | "move-selection-up"
  | "half-page-down"
  | "half-page-up"
  | "jump-to-top"
  | "jump-to-bottom"
  | "next-project"
  | "previous-project"
  | "open-actions-menu"
  | "open-selected-menu"
  | "open-server-selector"
  | "open-settings"
  | "focus-search"
  | "open-help"
  | "refresh-sessions"
  | "toggle-console"
  | "quit"

type Shortcut = {
  scope: ShortcutScope
  description: string
  shortcut: string
  action: ShortcutAction
}

type ShortcutRow =
  | { type: "section"; scope: ShortcutScope }
  | { type: "shortcut"; shortcut: Shortcut; selected: boolean }
  | { type: "spacer"; after: ShortcutScope }

export const SHORTCUTS: readonly Shortcut[] = [
  {
    scope: "Session",
    description: "Prompt session or toggle lane",
    shortcut: "enter",
    action: "prompt-selected-session",
  },
  { scope: "Session", description: "Create new session", shortcut: "a", action: "create-session" },
  { scope: "Session", description: "Delete selected sessions", shortcut: "d", action: "delete-selected-session" },
  { scope: "Session", description: "Toggle visual selection", shortcut: "v", action: "start-visual-selection" },
  { scope: "Session", description: "Toggle session selection", shortcut: "space", action: "toggle-session-selection" },
  { scope: "Session", description: "Clear session selection", shortcut: "esc", action: "clear-session-selection" },
  { scope: "Session", description: "Open selected in tmux", shortcut: "o", action: "open-selected-in-tmux" },
  { scope: "Navigation", description: "Move selection down", shortcut: "j / down", action: "move-selection-down" },
  { scope: "Navigation", description: "Move selection up", shortcut: "k / up", action: "move-selection-up" },
  { scope: "Navigation", description: "Half page down", shortcut: "ctrl-d", action: "half-page-down" },
  { scope: "Navigation", description: "Half page up", shortcut: "ctrl-u", action: "half-page-up" },
  { scope: "Navigation", description: "Jump to top", shortcut: "gg / home", action: "jump-to-top" },
  { scope: "Navigation", description: "Jump to bottom", shortcut: "G / end", action: "jump-to-bottom" },
  { scope: "Projects", description: "Next project", shortcut: "tab", action: "next-project" },
  { scope: "Projects", description: "Previous project", shortcut: "shift-tab", action: "previous-project" },
  { scope: "App", description: "Open actions menu", shortcut: "1", action: "open-actions-menu" },
  { scope: "App", description: "Open selected menu", shortcut: "2", action: "open-selected-menu" },
  { scope: "App", description: "Open server selector", shortcut: "ctrl-s", action: "open-server-selector" },
  { scope: "App", description: "Open settings", shortcut: "ctrl-p", action: "open-settings" },
  { scope: "App", description: "Focus search", shortcut: "/", action: "focus-search" },
  { scope: "App", description: "Open this help", shortcut: "?", action: "open-help" },
  { scope: "App", description: "Refresh sessions", shortcut: "r", action: "refresh-sessions" },
  { scope: "App", description: "Toggle console", shortcut: "`", action: "toggle-console" },
  { scope: "App", description: "Quit", shortcut: "q / esc", action: "quit" },
]

function buildShortcutRows(selectedIndex: number): ShortcutRow[] {
  const rows: ShortcutRow[] = []
  let previousScope: ShortcutScope | undefined

  for (let index = 0; index < SHORTCUTS.length; index += 1) {
    const shortcut = SHORTCUTS[index]!
    if (shortcut.scope !== previousScope) {
      if (previousScope) rows.push({ type: "spacer", after: previousScope })
      rows.push({ type: "section", scope: shortcut.scope })
      previousScope = shortcut.scope
    }
    rows.push({ type: "shortcut", shortcut, selected: index === selectedIndex })
  }

  return rows
}

export function ShortcutsDialog({
  width,
  height,
  selectedIndex,
  onSelect,
  onRun,
  onClose,
}: {
  width: number
  height: number
  selectedIndex: number
  onSelect: (index: number) => void
  onRun: (action: ShortcutAction) => void
  onClose: () => void
}) {
  const rows = buildShortcutRows(selectedIndex)
  const dialogWidth = Math.min(Math.max(52, Math.floor(width * 0.55)), 78, width - 4)
  const dialogHeight = Math.min(height - 2, rows.length + 6)
  const rowWidth = Math.max(1, dialogWidth - 2)
  const bodyHeight = Math.max(1, dialogHeight - 6)
  const selectedRowIndex = rows.findIndex((row) => row.type === "shortcut" && row.selected)
  const viewportStart = selectedRowIndex === -1 ? 0 : Math.max(0, Math.min(selectedRowIndex, rows.length - bodyHeight))
  const visibleRows = rows.slice(viewportStart, viewportStart + bodyHeight)
  const bottomPaddingRows = Math.max(0, bodyHeight - visibleRows.length)

  return (
    <SearchDialogFrame
      screenWidth={width}
      screenHeight={height}
      width={dialogWidth}
      height={dialogHeight}
      title="Shortcuts"
      query=""
      placeholder="Keyboard"
      countText={`${SHORTCUTS.length} commands`}
      onClose={onClose}
      footer={
        <HintRow
          items={[
            { key: "?", label: "close" },
            { key: "up/down", label: "select" },
            { key: "enter", label: "run" },
            { key: "esc", label: "close" },
          ]}
        />
      }
    >
      {visibleRows.map((row) => {
        if (row.type === "spacer") return <PlainLine key={`spacer-${row.after}`} text="" />
        if (row.type === "section")
          return <ShortcutSection key={`section-${row.scope}`} title={row.scope} width={rowWidth} />
        return (
          <ShortcutLine
            key={row.shortcut.description}
            row={row}
            width={rowWidth}
            onSelect={() => onSelect(SHORTCUTS.indexOf(row.shortcut))}
            onRun={() => onRun(row.shortcut.action)}
          />
        )
      })}
      {Array.from({ length: bottomPaddingRows }, (_, index) => (
        <PlainLine key={`pad-${index}`} text="" />
      ))}
    </SearchDialogFrame>
  )
}

function ShortcutSection({ title, width }: { title: string; width: number }) {
  return <PlainLine text={fitCell(`  ${title.toUpperCase()}`, width)} fg={theme.textMuted} />
}

function ShortcutLine({
  row,
  width,
  onSelect,
  onRun,
}: {
  row: Extract<ShortcutRow, { type: "shortcut" }>
  width: number
  onSelect: () => void
  onRun: () => void
}) {
  const selectorWidth = 2
  const shortcutWidth = Math.min(20, Math.max(10, Math.floor(width * 0.34)))
  const titleWidth = Math.max(8, width - selectorWidth - shortcutWidth - 2)
  const bg = row.selected ? theme.backgroundElement : undefined

  return (
    <box
      style={{ height: 1, width }}
      onMouseDown={(event) => {
        mouseAction(event)
        onSelect()
        onRun()
      }}
      onMouseOver={onSelect}
    >
      <TextLine width={width} bg={bg}>
        <span fg={row.selected ? theme.primary : theme.textMuted}>{row.selected ? "▸" : " "}</span>
        <span> </span>
        <span {...(row.selected ? { attributes: TextAttributes.BOLD } : {})}>
          {fitCell(row.shortcut.description, titleWidth)}
        </span>
        <span fg={row.selected ? theme.primary : theme.textMuted}>
          {fitCell(row.shortcut.shortcut, shortcutWidth, "right")}
        </span>
        <span> </span>
      </TextLine>
    </box>
  )
}
