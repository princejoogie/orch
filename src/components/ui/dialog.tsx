import { TextAttributes, type KeyBinding, type MouseEvent, type TextareaRenderable } from "@opentui/core"
import { useEffect, useRef, type ReactNode } from "react"
import { mouseAction } from "./button.tsx"
import { truncate, type WrappedLine } from "../../lib/utils.ts"
import { theme } from "../../theme.ts"

const DIALOG_BACKGROUND = theme.backgroundPanel
const DIALOG_BORDER = theme.info
const DIALOG_DANGER = theme.error
const DIALOG_FIELD_BORDER = theme.borderSubtle
const DIALOG_TITLE = theme.text
const DIALOG_TEXT = theme.text
const DIALOG_MUTED = theme.textMuted
const DIALOG_HINT = theme.textMuted
const DIALOG_SEPARATOR = theme.border
const DIALOG_COUNT = theme.primary

const PROMPT_TEXTAREA_KEY_BINDINGS: KeyBinding[] = [
  { name: "return", action: "submit" },
  { name: "kpenter", action: "submit" },
  { name: "linefeed", action: "submit" },
  { name: "return", shift: true, action: "newline" },
  { name: "kpenter", shift: true, action: "newline" },
  { name: "linefeed", shift: true, action: "newline" },
]

type DialogProps = {
  screenWidth: number
  screenHeight: number
  width: number
  height: number
  danger?: boolean
  children: ReactNode
}

export function fitCell(text: string, width: number, align: "left" | "right" = "left"): string {
  const trimmed = truncate(text, width)
  return align === "right" ? trimmed.padStart(width, " ") : trimmed.padEnd(width, " ")
}

export function Dialog({ screenWidth, screenHeight, width, height, danger, children }: DialogProps) {
  return (
    <box
      style={{
        position: "absolute",
        zIndex: 20,
        left: Math.max(1, Math.floor((screenWidth - width) / 2)),
        top: Math.max(1, Math.floor((screenHeight - height) / 2)),
        width,
        height,
        border: true,
        borderColor: danger ? DIALOG_DANGER : DIALOG_BORDER,
        backgroundColor: DIALOG_BACKGROUND,
        flexDirection: "column",
        padding: 1,
      }}
    >
      {children}
    </box>
  )
}

export function PlainLine({ text, fg = DIALOG_TEXT, bg }: { text: string; fg?: string; bg?: string | undefined }) {
  return (
    <box style={{ height: 1 }}>
      <text content={text} style={{ fg, ...(bg ? { bg } : {}) }} />
    </box>
  )
}

export function TextLine({
  children,
  fg = DIALOG_TEXT,
  bg,
  width,
}: {
  children: ReactNode
  fg?: string
  bg?: string | undefined
  width?: number | undefined
}) {
  return (
    <box style={{ height: 1, ...(width !== undefined ? { width } : {}) }}>
      <text style={{ fg, ...(bg ? { bg } : {}) }}>{children}</text>
    </box>
  )
}

export function Divider({
  width,
  junctionAt,
  junctionChar = "┼",
}: {
  width: number
  junctionAt?: number
  junctionChar?: string
}) {
  const line = Array.from({ length: width }, (_, index) => (index === junctionAt ? junctionChar : "─")).join("")
  return <PlainLine text={line} fg={DIALOG_SEPARATOR} />
}

export function PaddedRow({ children }: { children: ReactNode }) {
  return <box style={{ height: 1, paddingLeft: 1, paddingRight: 1 }}>{children}</box>
}

export function MouseDismissLayer({
  screenWidth,
  screenHeight,
  top = 0,
  onDismiss,
}: {
  screenWidth: number
  screenHeight: number
  top?: number
  onDismiss: () => void
}) {
  return (
    <box
      style={{
        position: "absolute",
        zIndex: 19,
        left: 0,
        top,
        width: screenWidth,
        height: Math.max(0, screenHeight - top),
      }}
      onMouseDown={(event) => {
        mouseAction(event)
        onDismiss()
      }}
    />
  )
}

export function ModalFrame({
  children,
  left,
  top,
  width,
  height,
  junctionRows = [],
  topJunctionColumns = [],
  onClose,
}: {
  children: ReactNode
  left: number
  top: number
  width: number
  height: number
  junctionRows?: readonly number[]
  topJunctionColumns?: readonly number[]
  onClose?: (() => void) | undefined
}) {
  const innerWidth = Math.max(1, width - 2)
  const innerHeight = Math.max(1, height - 2)
  const junctions = new Set(junctionRows)
  const topJunctions = new Set(topJunctionColumns)
  const topBorder = Array.from({ length: innerWidth }, (_, index) => (topJunctions.has(index) ? "┬" : "─")).join("")

  return (
    <box
      style={{
        position: "absolute",
        zIndex: 20,
        left,
        top,
        width,
        height,
        flexDirection: "column",
        backgroundColor: DIALOG_BACKGROUND,
      }}
      onMouseDown={mouseAction}
    >
      <PlainLine text={`┌${topBorder}┐`} fg={DIALOG_SEPARATOR} />
      {onClose ? (
        <box
          style={{ position: "absolute", zIndex: 21, left: Math.max(1, width - 9), top: 0, height: 1, width: 8 }}
          onMouseDown={(event) => {
            mouseAction(event)
            onClose()
          }}
        >
          <text content="[x] esc" style={{ fg: DIALOG_DANGER, attributes: TextAttributes.BOLD }} />
        </box>
      ) : null}
      <box style={{ height: innerHeight, flexDirection: "row" }}>
        <box style={{ width: 1, height: innerHeight, flexDirection: "column" }}>
          {Array.from({ length: innerHeight }, (_, index) => (
            <PlainLine key={index} text={junctions.has(index) ? "├" : "│"} fg={DIALOG_SEPARATOR} />
          ))}
        </box>
        <box style={{ width: innerWidth, height: innerHeight, flexDirection: "column" }}>{children}</box>
        <box style={{ width: 1, height: innerHeight, flexDirection: "column" }}>
          {Array.from({ length: innerHeight }, (_, index) => (
            <PlainLine key={index} text={junctions.has(index) ? "┤" : "│"} fg={DIALOG_SEPARATOR} />
          ))}
        </box>
      </box>
      <PlainLine text={`└${"─".repeat(innerWidth)}┘`} fg={DIALOG_SEPARATOR} />
    </box>
  )
}

export type HintItem = {
  readonly key: string
  readonly label: string
  readonly when?: boolean | undefined
  readonly disabled?: boolean | undefined
}

export function HintRow({ items }: { items: readonly HintItem[] }) {
  const visible = items.filter((item) => item.when !== false)
  return (
    <TextLine>
      {visible.flatMap((item, index) => [
        <span key={`${item.key}:${item.label}:key`} fg={item.disabled ? DIALOG_SEPARATOR : DIALOG_COUNT}>
          {item.key}
        </span>,
        <span
          key={`${item.key}:${item.label}:label`}
          fg={item.disabled ? DIALOG_SEPARATOR : DIALOG_HINT}
        >{` ${item.label}${index < visible.length - 1 ? "  " : ""}`}</span>,
      ])}
    </TextLine>
  )
}

function searchHeaderText(title: string, contentWidth: number, countText: string) {
  const reserved = 1 + 1 + 1 + 10 + (countText.length > 0 ? countText.length + 2 : 0)
  return truncate(title, Math.max(6, Math.min(title.length, contentWidth - reserved)))
}

export function SearchDialogFrame({
  screenWidth,
  screenHeight,
  width,
  height,
  title,
  query,
  placeholder,
  countText,
  footer,
  onClose,
  onBodyMouseScroll,
  children,
}: {
  screenWidth: number
  screenHeight: number
  width: number
  height: number
  title: string
  query: string
  placeholder: string
  countText: string
  footer: ReactNode
  onClose?: (() => void) | undefined
  onBodyMouseScroll?: (event: MouseEvent) => void
  children: ReactNode
}) {
  const left = Math.max(1, Math.floor((screenWidth - width) / 2))
  const top = Math.max(1, Math.floor((screenHeight - height) / 2))
  const innerWidth = Math.max(16, width - 2)
  const contentWidth = Math.max(14, innerWidth - 2)
  const bodyHeight = Math.max(1, height - 6)
  const titleText = searchHeaderText(title, contentWidth, countText)
  const dividerColumn = 1 + titleText.length + 1
  const headerDivider = "│"
  const searchWidth = Math.max(1, contentWidth - titleText.length - headerDivider.length - countText.length - 5)
  const queryText = query ? fitCell(query, searchWidth) : fitCell(placeholder, searchWidth)

  return (
    <>
      {onClose ? <MouseDismissLayer screenWidth={screenWidth} screenHeight={screenHeight} onDismiss={onClose} /> : null}
      <ModalFrame
        left={left}
        top={top}
        width={width}
        height={height}
        junctionRows={[1, height - 4]}
        topJunctionColumns={[dividerColumn]}
        onClose={onClose}
      >
        <PaddedRow>
          <TextLine>
            <span fg={DIALOG_COUNT} attributes={TextAttributes.BOLD}>
              {titleText}
            </span>
            <span> </span>
            <span fg={DIALOG_SEPARATOR}>{headerDivider}</span>
            <span> </span>
            <span fg={query ? DIALOG_TEXT : DIALOG_MUTED}>{queryText}</span>
            <span> </span>
            <span fg={DIALOG_MUTED}>{countText}</span>
          </TextLine>
        </PaddedRow>
        <Divider width={innerWidth} junctionAt={dividerColumn} junctionChar="┴" />
        <box
          style={{ height: bodyHeight, flexDirection: "column" }}
          {...(onBodyMouseScroll ? { onMouseScroll: onBodyMouseScroll } : {})}
        >
          {children}
        </box>
        <Divider width={innerWidth} />
        <PaddedRow>{footer}</PaddedRow>
      </ModalFrame>
    </>
  )
}

export function standardDialogBodyHeight(height: number, hasMiddleRow = false, hasSubtitle = true): number {
  return Math.max(1, height - (hasSubtitle ? (hasMiddleRow ? 9 : 7) : hasMiddleRow ? 8 : 6))
}

export function StandardDialogFrame({
  screenWidth,
  screenHeight,
  width,
  height,
  title,
  danger = false,
  headerRight,
  subtitle,
  middleRow,
  footer,
  onClose,
  bodyPadding = 1,
  children,
}: {
  screenWidth: number
  screenHeight: number
  width: number
  height: number
  title: string
  danger?: boolean
  headerRight?: string | undefined
  subtitle?: ReactNode | undefined
  middleRow?: ReactNode
  footer: ReactNode
  onClose?: (() => void) | undefined
  bodyPadding?: number
  children: ReactNode
}) {
  const left = Math.max(1, Math.floor((screenWidth - width) / 2))
  const top = Math.max(1, Math.floor((screenHeight - height) / 2))
  const innerWidth = Math.max(16, width - 2)
  const contentWidth = Math.max(14, innerWidth - 2)
  const hasSubtitle = subtitle !== undefined && subtitle !== null && subtitle !== false
  const hasMiddleRow = middleRow !== undefined && middleRow !== null && middleRow !== false
  const bodyHeight = standardDialogBodyHeight(height, hasMiddleRow, hasSubtitle)
  const rightText = headerRight ?? ""
  const headerGap = Math.max(1, contentWidth - title.length - rightText.length)
  const headerDividerRow = hasSubtitle ? 2 : 1
  const junctionRows = hasMiddleRow
    ? [headerDividerRow, headerDividerRow + 2, height - 4]
    : [headerDividerRow, height - 4]

  return (
    <>
      {onClose ? <MouseDismissLayer screenWidth={screenWidth} screenHeight={screenHeight} onDismiss={onClose} /> : null}
      <ModalFrame left={left} top={top} width={width} height={height} junctionRows={junctionRows} onClose={onClose}>
        <PaddedRow>
          <TextLine>
            <span fg={danger ? DIALOG_DANGER : DIALOG_COUNT} attributes={TextAttributes.BOLD}>
              {title}
            </span>
            {headerRight ? (
              <>
                <span>{" ".repeat(headerGap)}</span>
                <span fg={DIALOG_MUTED}>{headerRight}</span>
              </>
            ) : null}
          </TextLine>
        </PaddedRow>
        {hasSubtitle ? <PaddedRow>{subtitle}</PaddedRow> : null}
        <Divider width={innerWidth} />
        {hasMiddleRow ? (
          <>
            <PaddedRow>{middleRow}</PaddedRow>
            <Divider width={innerWidth} />
          </>
        ) : null}
        <box
          style={{ height: bodyHeight, flexDirection: "column", paddingLeft: bodyPadding, paddingRight: bodyPadding }}
        >
          {children}
        </box>
        <Divider width={innerWidth} />
        <PaddedRow>{footer}</PaddedRow>
      </ModalFrame>
    </>
  )
}

export function DialogTitle({ children, marginTop = 0 }: { children: string; marginTop?: number }) {
  return <text content={children} style={{ fg: DIALOG_TITLE, attributes: TextAttributes.BOLD, marginTop }} />
}

export function DialogLabel({ children, marginTop = 0 }: { children: string; marginTop?: number }) {
  return <text content={children} style={{ fg: DIALOG_TEXT, attributes: TextAttributes.BOLD, marginTop }} />
}

export function DialogDescription({
  children,
  danger,
  marginTop = 0,
}: {
  children: string
  danger?: boolean
  marginTop?: number
}) {
  return <text content={children} style={{ fg: danger ? DIALOG_DANGER : DIALOG_MUTED, marginTop }} />
}

export function DialogOption({
  children,
  selected,
  onSelect,
}: {
  children: string
  selected: boolean
  onSelect?: () => void
}) {
  return (
    <box
      style={{ height: 1 }}
      onMouseDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onSelect?.()
      }}
    >
      <text
        content={`${selected ? "> " : "  "}${children}`}
        style={{
          fg: selected ? DIALOG_TITLE : DIALOG_MUTED,
          ...(selected ? { attributes: TextAttributes.BOLD } : {}),
        }}
      />
    </box>
  )
}

export function DialogHint({ children }: { children: string }) {
  return <text content={children} style={{ fg: DIALOG_HINT }} />
}

export function DialogError({ error, width }: { error?: string | undefined; width: number }) {
  return error ? <text content={truncate(error, width - 4)} style={{ fg: DIALOG_DANGER }} /> : null
}

export function DialogTextLines({ lines, height }: { lines: WrappedLine[]; height: number }) {
  return (
    <box
      style={{
        flexDirection: "column",
        height,
        marginBottom: 1,
        marginTop: 1,
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      {lines.map((line) => (
        <text key={line.key} content={line.text} style={{ fg: DIALOG_MUTED }} />
      ))}
    </box>
  )
}

export function DialogTextarea({
  value,
  placeholder,
  focused,
  height,
  clearVersion,
  onInput,
  onSubmit,
}: {
  value: string
  placeholder: string
  focused: boolean
  height: number
  clearVersion: number
  onInput: (value: string) => void
  onSubmit: (value: string) => void
}) {
  const textareaRef = useRef<TextareaRenderable>(null)

  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea && textarea.plainText.length > 0) textarea.setText("")
  }, [clearVersion])

  return (
    <box
      style={{
        height: height + 2,
        border: true,
        borderColor: DIALOG_FIELD_BORDER,
        paddingLeft: 1,
        paddingRight: 1,
        marginBottom: 1,
      }}
    >
      <textarea
        ref={textareaRef}
        placeholder={placeholder}
        initialValue=""
        focused={focused}
        style={{ width: "100%", height, wrapMode: "word" }}
        keyBindings={PROMPT_TEXTAREA_KEY_BINDINGS}
        onContentChange={() => {
          const nextValue = textareaRef.current?.plainText ?? value
          onInput(nextValue)
        }}
        onSubmit={() => onSubmit(textareaRef.current?.plainText ?? value)}
      />
    </box>
  )
}
