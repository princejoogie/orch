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
  onSelect,
  onClose,
}: {
  left: number
  top: number
  items: readonly MenuItem[]
  selectedIndex: number
  onSelect: (index: number) => void
  onClose: () => void
}) {
  const labelWidth = Math.max(14, ...items.map((item) => item.label.length))
  const shortcutWidth = Math.max(8, ...items.map((item) => item.shortcut.length))
  const innerWidth = labelWidth + shortcutWidth + 3
  const width = innerWidth + 2
  const height = items.length + 2

  return (
    <ModalFrame left={left} top={top} width={width} height={height}>
      {items.map((item, index) => (
        <MenuDropdownItem
          key={item.label}
          item={item}
          selected={index === selectedIndex}
          labelWidth={labelWidth}
          shortcutWidth={shortcutWidth}
          width={innerWidth}
          onSelect={() => onSelect(index)}
          onClose={onClose}
        />
      ))}
    </ModalFrame>
  )
}

function MenuDropdownItem({
  item,
  selected,
  labelWidth,
  shortcutWidth,
  width,
  onSelect,
  onClose,
}: {
  item: MenuItem
  selected: boolean
  labelWidth: number
  shortcutWidth: number
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
        <span fg={disabled ? theme.border : theme.textMuted}>{fitCell(item.shortcut, shortcutWidth, "right")}</span>
        <span> </span>
      </TextLine>
    </box>
  )
}
