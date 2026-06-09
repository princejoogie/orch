import { TextAttributes } from "@opentui/core"
import { topWithinScreen } from "../../lib/layout.ts"
import { theme } from "../../theme.ts"
import { mouseAction } from "./button.tsx"
import { ModalFrame, TextLine, fitCell } from "./dialog.tsx"

export type MenuItem = {
  label: string
  shortcut: string
  danger?: boolean
  disabled?: boolean
  background?: string
  run: () => void
}

export function MenuDropdown({
  left,
  top,
  items,
  selectedIndex,
  screenHeight,
  visibleStart = 0,
  visibleCount = items.length,
  maxWidth,
  showShortcuts = true,
  background,
  selectedBackground,
  selectOnHover = true,
  onSelect,
  onClose,
}: {
  left: number
  top: number
  items: readonly MenuItem[]
  selectedIndex: number
  screenHeight?: number | undefined
  visibleStart?: number | undefined
  visibleCount?: number | undefined
  maxWidth?: number | undefined
  showShortcuts?: boolean | undefined
  background?: string | undefined
  selectedBackground?: string | undefined
  selectOnHover?: boolean | undefined
  onSelect: (index: number) => void
  onClose: () => void
}) {
  const innerWidth = menuListWidth(items, showShortcuts, maxWidth ? Math.max(1, maxWidth - 2) : undefined)
  const width = innerWidth + 2
  const height = items.slice(visibleStart, visibleStart + visibleCount).length + 2
  const frameTop = screenHeight === undefined ? top : topWithinScreen(top, height, screenHeight)

  return (
    <ModalFrame left={left} top={frameTop} width={width} height={height} background={background}>
      <MenuList
        items={items}
        selectedIndex={selectedIndex}
        visibleStart={visibleStart}
        visibleCount={visibleCount}
        width={innerWidth}
        showShortcuts={showShortcuts}
        background={background}
        selectedBackground={selectedBackground}
        selectOnHover={selectOnHover}
        onSelect={onSelect}
        onClose={onClose}
      />
    </ModalFrame>
  )
}

export function MenuList({
  items,
  selectedIndex,
  visibleStart = 0,
  visibleCount = items.length,
  width,
  showShortcuts = true,
  background,
  selectedBackground,
  selectOnHover = true,
  onSelect,
  onClose = () => {},
}: {
  items: readonly MenuItem[]
  selectedIndex: number
  visibleStart?: number | undefined
  visibleCount?: number | undefined
  width?: number | undefined
  showShortcuts?: boolean | undefined
  background?: string | undefined
  selectedBackground?: string | undefined
  selectOnHover?: boolean | undefined
  onSelect: (index: number) => void
  onClose?: (() => void) | undefined
}) {
  const visibleItems = items.slice(visibleStart, visibleStart + visibleCount)
  const rowWidth = menuListWidth(items, showShortcuts, width)
  const shortcutWidth = showShortcuts ? Math.max(8, ...items.map((item) => item.shortcut.length)) : 0
  const labelWidth = showShortcuts ? Math.max(1, rowWidth - shortcutWidth - 3) : Math.max(1, rowWidth - 2)

  return (
    <>
      {visibleItems.map((item, offset) => {
        const index = visibleStart + offset
        return (
          <MenuDropdownItem
            key={`${item.label}:${index}`}
            item={item}
            selected={index === selectedIndex}
            labelWidth={labelWidth}
            shortcutWidth={shortcutWidth}
            showShortcut={showShortcuts}
            width={rowWidth}
            background={background}
            selectedBackground={selectedBackground}
            selectOnHover={selectOnHover}
            onSelect={() => onSelect(index)}
            onClose={onClose}
          />
        )
      })}
    </>
  )
}

function menuListWidth(items: readonly MenuItem[], showShortcuts: boolean, width?: number | undefined): number {
  if (width !== undefined) return Math.max(1, width)

  const shortcutWidth = showShortcuts ? Math.max(8, ...items.map((item) => item.shortcut.length)) : 0
  const naturalLabelWidth = Math.max(14, ...items.map((item) => item.label.length))
  return showShortcuts ? naturalLabelWidth + shortcutWidth + 3 : naturalLabelWidth + 2
}

function MenuDropdownItem({
  item,
  selected,
  labelWidth,
  shortcutWidth,
  showShortcut,
  width,
  background,
  selectedBackground,
  selectOnHover,
  onSelect,
  onClose,
}: {
  item: MenuItem
  selected: boolean
  labelWidth: number
  shortcutWidth: number
  showShortcut: boolean
  width: number
  background?: string | undefined
  selectedBackground?: string | undefined
  selectOnHover: boolean
  onSelect: () => void
  onClose: () => void
}) {
  const disabled = Boolean(item.disabled)
  const fg = disabled ? theme.border : item.danger ? theme.error : theme.text
  const bg = selected
    ? (selectedBackground ?? item.background ?? theme.backgroundElement)
    : (item.background ?? background)

  return (
    <box
      style={{ height: 1, width }}
      {...(selectOnHover ? { onMouseOver: onSelect } : {})}
      onMouseDown={(event) => {
        mouseAction(event)
        onSelect()
        if (disabled) return
        onClose()
        item.run()
      }}
    >
      <TextLine width={width} bg={bg}>
        <span fg={fg} {...(selected && !disabled ? { attributes: TextAttributes.BOLD } : {})}>
          {fitCell(` ${item.label}`, labelWidth + 1)}
        </span>
        {showShortcut ? (
          <>
            <span fg={disabled ? theme.border : theme.textMuted}>{fitCell(item.shortcut, shortcutWidth, "right")}</span>
            <span> </span>
          </>
        ) : null}
      </TextLine>
    </box>
  )
}
