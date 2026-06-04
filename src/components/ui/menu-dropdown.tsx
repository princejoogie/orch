import { TextAttributes } from "@opentui/core"
import { theme } from "../../theme.ts"
import { mouseAction } from "./button.tsx"
import { ModalFrame, TextLine, fitCell } from "./dialog.tsx"

export type MenuItem = {
  label: string
  shortcut: string
  danger?: boolean
  disabled?: boolean
  run: () => void
}

export function MenuDropdown({
  left,
  top,
  items,
  selectedIndex,
  visibleStart = 0,
  visibleCount = items.length,
  maxWidth,
  showShortcuts = true,
  onSelect,
  onClose,
}: {
  left: number
  top: number
  items: readonly MenuItem[]
  selectedIndex: number
  visibleStart?: number | undefined
  visibleCount?: number | undefined
  maxWidth?: number | undefined
  showShortcuts?: boolean | undefined
  onSelect: (index: number) => void
  onClose: () => void
}) {
  const visibleItems = items.slice(visibleStart, visibleStart + visibleCount)
  const shortcutWidth = showShortcuts ? Math.max(8, ...items.map((item) => item.shortcut.length)) : 0
  const naturalLabelWidth = Math.max(14, ...items.map((item) => item.label.length))
  const naturalInnerWidth = showShortcuts ? naturalLabelWidth + shortcutWidth + 3 : naturalLabelWidth + 2
  const innerWidth = maxWidth ? Math.max(1, maxWidth - 2) : naturalInnerWidth
  const labelWidth = showShortcuts ? Math.max(1, innerWidth - shortcutWidth - 3) : Math.max(1, innerWidth - 2)
  const width = innerWidth + 2
  const height = visibleItems.length + 2

  return (
    <ModalFrame left={left} top={top} width={width} height={height}>
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
            width={innerWidth}
            onSelect={() => onSelect(index)}
            onClose={onClose}
          />
        )
      })}
    </ModalFrame>
  )
}

function MenuDropdownItem({
  item,
  selected,
  labelWidth,
  shortcutWidth,
  showShortcut,
  width,
  onSelect,
  onClose,
}: {
  item: MenuItem
  selected: boolean
  labelWidth: number
  shortcutWidth: number
  showShortcut: boolean
  width: number
  onSelect: () => void
  onClose: () => void
}) {
  const disabled = Boolean(item.disabled)
  const fg = disabled ? theme.border : item.danger ? theme.error : theme.text
  const bg = selected ? theme.backgroundElement : undefined

  return (
    <box
      style={{ height: 1, width }}
      onMouseOver={onSelect}
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
