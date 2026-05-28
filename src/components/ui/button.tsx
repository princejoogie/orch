import { TextAttributes, type MouseEvent } from "@opentui/core"
import type { ReactNode } from "react"
import { truncate } from "../../lib/utils.ts"
import { theme } from "../../theme.ts"

export function mouseAction(event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
}

export function Button({
  label,
  shortcut,
  width,
  danger = false,
  disabled = false,
  onPress,
}: {
  label: string
  shortcut?: string | undefined
  width: number
  danger?: boolean
  disabled?: boolean
  onPress: () => void
}) {
  const content = truncate(shortcut ? ` ${label} ${shortcut} ` : ` ${label} `, width).padEnd(width)
  const style = {
    fg: disabled ? theme.border : danger ? theme.error : theme.text,
    ...(disabled ? {} : { bg: theme.backgroundElement, attributes: TextAttributes.BOLD }),
  }

  return (
    <box
      style={{ height: 1, width }}
      onMouseDown={(event) => {
        mouseAction(event)
        if (!disabled) onPress()
      }}
    >
      <text content={content} style={style} />
    </box>
  )
}

export function ButtonRow({ children, width }: { children: ReactNode; width: number }) {
  return <box style={{ flexDirection: "row", flexWrap: "wrap", height: 1, width }}>{children}</box>
}

export function ButtonSpacer() {
  return <text content=" " />
}

export function DialogFooterActions({
  width,
  actionsWidth,
  hints,
  children,
}: {
  width: number
  actionsWidth: number
  hints?: ReactNode | undefined
  children: ReactNode
}) {
  return (
    <box style={{ flexDirection: "row", height: 1, width }}>
      <box style={{ width: Math.max(1, width - actionsWidth), height: 1 }}>{hints}</box>
      <box style={{ width: actionsWidth, height: 1 }}>{children}</box>
    </box>
  )
}
