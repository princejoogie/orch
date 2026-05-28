import { type InputRenderable } from "@opentui/core"
import { useEffect, useRef } from "react"
import type { SearchInputProps } from "../../lib/utils.ts"
import { theme } from "../../theme.ts"

export function SearchInput({ value, focused, width, clearVersion, onInput, onFocus }: SearchInputProps) {
  const inputRef = useRef<InputRenderable>(null)
  const inputWidth = Math.min(44, Math.max(16, width))

  useEffect(() => {
    const input = inputRef.current
    if (input && input.plainText.length > 0) input.setText("")
  }, [clearVersion])

  return (
    <box style={{ flexDirection: "row", flexShrink: 0 }}>
      <box
        style={{
          border: true,
          borderColor: focused ? theme.borderActive : value ? theme.border : theme.borderSubtle,
          height: 3,
          paddingLeft: 1,
          paddingRight: 1,
          width: inputWidth,
        }}
        onMouseDown={onFocus}
      >
        <input
          ref={inputRef}
          focused={focused}
          placeholder="Search sessions"
          style={{ width: inputWidth - 4 }}
          onInput={onInput}
        />
      </box>
    </box>
  )
}
