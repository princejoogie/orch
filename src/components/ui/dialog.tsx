import { TextAttributes, type KeyBinding, type TextareaRenderable } from "@opentui/core"
import { useRef, type ReactNode } from "react"
import { truncate, type WrappedLine } from "../../lib/utils.ts"

const DIALOG_BACKGROUND = "#0F172A"
const DIALOG_BORDER = "#38BDF8"
const DIALOG_DANGER = "#F87171"
const DIALOG_FIELD_BORDER = "#334155"
const DIALOG_TITLE = "#F8FAFC"
const DIALOG_TEXT = "#CBD5E1"
const DIALOG_MUTED = "#94A3B8"
const DIALOG_HINT = "#64748B"

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
  return <text content={children} style={{ fg: danger ? "#FCA5A5" : DIALOG_MUTED, marginTop }} />
}

export function DialogOption({ children, selected }: { children: string; selected: boolean }) {
  return (
    <text
      content={`${selected ? "> " : "  "}${children}`}
      style={{ fg: selected ? DIALOG_TITLE : DIALOG_MUTED, attributes: selected ? TextAttributes.BOLD : undefined }}
    />
  )
}

export function DialogHint({ children }: { children: string }) {
  return <text content={children} style={{ fg: DIALOG_HINT }} />
}

export function DialogError({ error, width }: { error?: string; width: number }) {
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
  onInput,
  onSubmit,
}: {
  value: string
  placeholder: string
  focused: boolean
  height: number
  onInput: (value: string) => void
  onSubmit: (value: string) => void
}) {
  const textareaRef = useRef<TextareaRenderable>(null)

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
        initialValue={value}
        focused={focused}
        style={{ width: "100%", height, wrapMode: "word" }}
        keyBindings={PROMPT_TEXTAREA_KEY_BINDINGS}
        onContentChange={() => onInput(textareaRef.current?.plainText ?? value)}
        onSubmit={() => onSubmit(textareaRef.current?.plainText ?? value)}
      />
    </box>
  )
}
