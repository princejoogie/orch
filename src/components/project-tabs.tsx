import { TextAttributes } from "@opentui/core"
import { useState } from "react"
import { useDashboardControllerContext } from "../hooks/use-dashboard-controller.tsx"
import { countLane, tabElementId, truncate } from "../lib/utils.ts"
import { useDashboardStore } from "../store/dashboard.ts"
import { theme } from "../theme.ts"

export function ProjectTabs({ width }: { width: number }) {
  const controller = useDashboardControllerContext()
  const dashboardStore = useDashboardStore()
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
      {controller.tabs.length === 0 ? <text content="no projects" style={{ fg: theme.textMuted }} /> : null}
      {controller.tabs.map((tab, index) => {
        const active = index === controller.activeTabIndex
        const hovered = hoveredTabId === tab.id
        const working = countLane(tab.rows, "working", controller.now)
        const needsInput = countLane(tab.rows, "needs-input", controller.now)
        const countLabel = working > 0 || needsInput > 0 ? `${working}/${needsInput}` : ""
        const label = countLabel
          ? `${truncate(tab.title, Math.max(1, tabWidth - countLabel.length - 1))} ${countLabel}`
          : tab.title
        return (
          <box
            id={tabElementId(tab)}
            key={tab.id}
            style={{ height: 1, width }}
            onMouseDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
              dashboardStore.setActiveTabId(tab.id)
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
