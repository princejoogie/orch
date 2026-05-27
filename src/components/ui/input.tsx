import { type InputRenderable } from "@opentui/core"
import { useRef } from "react"
import type { SearchInputProps } from "../../lib/utils.ts"

export function SearchInput({ value, focused, width, onInput }: SearchInputProps) {
  const inputRef = useRef<InputRenderable>(null)
  const inputWidth = Math.min(44, Math.max(16, width))

  return (
    <box style={{ flexDirection: "row", flexShrink: 0 }}>
      <box
        style={{
          border: true,
          borderColor: focused ? "#38BDF8" : value ? "#475569" : "#1E293B",
          height: 3,
          paddingLeft: 1,
          paddingRight: 1,
          width: inputWidth,
        }}
      >
        <input
          ref={inputRef}
          value={value}
          focused={focused}
          placeholder="Search sessions"
          style={{ width: inputWidth - 4 }}
          onInput={(nextValue) => onInput(nextValue)}
        />
      </box>
    </box>
  )
}
