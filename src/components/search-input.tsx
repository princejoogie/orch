import { type InputRenderable } from "@opentui/core"
import { useEffect, useRef } from "react"
import { useDashboardStore } from "../store/dashboard.ts"
import { theme } from "../theme.ts"

export function SearchInput({ width }: { width: number }) {
  const dashboardStore = useDashboardStore()
  const inputRef = useRef<InputRenderable>(null)
  const inputWidth = Math.min(44, Math.max(16, width))

  useEffect(() => {
    const input = inputRef.current
    if (input && input.plainText.length > 0) input.setText("")
  }, [dashboardStore.searchClearVersion])

  return (
    <box style={{ flexDirection: "row", flexShrink: 0 }}>
      <box
        style={{
          border: true,
          borderColor: dashboardStore.searchFocused
            ? theme.borderActive
            : dashboardStore.searchValue
              ? theme.border
              : theme.borderSubtle,
          height: 3,
          paddingLeft: 1,
          paddingRight: 1,
          width: inputWidth,
        }}
        onMouseDown={() => dashboardStore.setSearchFocused(true)}
      >
        <input
          ref={inputRef}
          focused={dashboardStore.searchFocused}
          placeholder="Search sessions"
          style={{ width: inputWidth - 4 }}
          onInput={dashboardStore.setSearchValue}
        />
      </box>
    </box>
  )
}
