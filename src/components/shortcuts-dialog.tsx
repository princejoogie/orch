import { TextAttributes } from "@opentui/core"
import { useDashboardControllerContext } from "../hooks/use-dashboard-controller.tsx"
import { SHORTCUTS, type Shortcut, type ShortcutScope } from "./shortcuts.ts"
import { useGlobalStore } from "../store/global.ts"
import { mouseAction } from "./ui/button.tsx"
import { fitCell, HintRow, PlainLine, SearchDialogFrame, TextLine } from "./ui/dialog.tsx"
import { theme } from "../theme.ts"

type ShortcutRow =
  | { type: "section"; scope: ShortcutScope }
  | { type: "shortcut"; shortcut: Shortcut; selected: boolean }
  | { type: "spacer"; after: ShortcutScope }

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

export function ShortcutsDialog({ width, height }: { width: number; height: number }) {
  const controller = useDashboardControllerContext()
  const globalStore = useGlobalStore()

  if (!globalStore.shortcutsDialogOpen) return null

  const rows = buildShortcutRows(globalStore.selectedShortcutIndex)
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
      onClose={() => globalStore.setShortcutsDialogOpen(false)}
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
            onSelect={() => globalStore.setSelectedShortcutIndex(SHORTCUTS.indexOf(row.shortcut))}
            onRun={() => {
              if (controller.executeShortcutAction(row.shortcut.action)) globalStore.setShortcutsDialogOpen(false)
            }}
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
