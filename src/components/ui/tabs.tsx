import { TextAttributes } from "@opentui/core"
import { useState } from "react"
import { count, tabElementId, truncate, type ProjectTab } from "../../lib/utils.ts"
import { theme } from "../../theme.ts"

export function ProjectTabs({
  tabs,
  activeIndex,
  width,
  onSelect,
}: {
  tabs: ProjectTab[]
  activeIndex: number
  width: number
  onSelect: (tab: ProjectTab) => void
}) {
  const [hoveredTabId, setHoveredTabId] = useState<string>()
  const tabWidth = Math.max(8, width - 2)

  return (
    <box
      style={{
        flexDirection: "column",
        flexShrink: 0,
        width,
      }}
    >
      <text content="Projects" style={{ fg: theme.text, attributes: TextAttributes.BOLD, marginBottom: 1 }} />
      {tabs.length === 0 ? <text content="no projects" style={{ fg: theme.textMuted }} /> : null}
      {tabs.map((tab, index) => {
        const active = index === activeIndex
        const hovered = hoveredTabId === tab.id
        const working = count(tab.rows, "working")
        const countLabel = `${working}/${tab.rows.length}`
        const label = `${truncate(tab.title, Math.max(1, tabWidth - countLabel.length - 1))} ${countLabel}`
        return (
          <box
            id={tabElementId(tab)}
            key={tab.id}
            style={{ height: 1, width }}
            onMouseDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onSelect(tab)
            }}
            onMouseOver={() => setHoveredTabId(tab.id)}
            onMouseOut={() => setHoveredTabId((current) => (current === tab.id ? undefined : current))}
          >
            <text
              content={` ${truncate(label, tabWidth).padEnd(tabWidth)} `}
              style={{
                fg: active ? theme.text : theme.textMuted,
                ...(active || hovered ? { bg: active ? theme.backgroundElement : theme.background } : {}),
                ...(active ? { attributes: TextAttributes.BOLD } : {}),
              }}
            />
          </box>
        )
      })}
    </box>
  )
}
