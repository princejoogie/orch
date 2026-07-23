import { TextAttributes } from "@opentui/core"
import { useState } from "react"
import { useDashboardControllerContext } from "../hooks/use-dashboard-controller.tsx"
import { countLane } from "../lib/session-hierarchy.ts"
import { displayWorktreeName, tabElementId, truncate } from "../lib/utils.ts"
import { useDashboardStore } from "../store/dashboard.ts"
import { theme } from "../theme.ts"

export function ProjectTabs({ width }: { width: number }) {
  const controller = useDashboardControllerContext()
  const dashboardStore = useDashboardStore()
  const [hoveredTabId, setHoveredTabId] = useState<string>()
  const [hoveredWorktreeDirectory, setHoveredWorktreeDirectory] = useState<string>()
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
        const projectFilterActive = active && !controller.activeWorktree
        const hovered = hoveredTabId === tab.id
        const working = countLane(tab.rows, "working", controller.now)
        const needsInput = countLane(tab.rows, "needs-input", controller.now)
        const countLabel = working > 0 || needsInput > 0 ? `${working}/${needsInput}` : ""
        const label = countLabel
          ? `${truncate(tab.title, Math.max(1, tabWidth - countLabel.length - 1))} ${countLabel}`
          : tab.title
        return (
          <box key={tab.id} style={{ flexDirection: "column", flexShrink: 0, width }}>
            <box
              id={tabElementId(tab)}
              style={{ height: 1, width }}
              onMouseDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
                dashboardStore.setActiveTabId(tab.id)
                dashboardStore.setActiveWorktreeDirectory(tab.id)
              }}
              onMouseOver={() => setHoveredTabId(tab.id)}
              onMouseOut={() => setHoveredTabId((current) => (current === tab.id ? undefined : current))}
            >
              <text
                content={` ${truncate(label, tabWidth).padEnd(tabWidth)} `}
                style={{
                  fg: active ? theme.text : theme.textMuted,
                  ...(projectFilterActive || hovered
                    ? { bg: projectFilterActive ? theme.backgroundElement : theme.background }
                    : {}),
                  ...(projectFilterActive ? { attributes: TextAttributes.BOLD } : {}),
                }}
              />
            </box>
            {active
              ? controller.activeWorktrees.map((worktree, worktreeIndex) => {
                  const worktreeActive = worktreeIndex === controller.activeWorktreeIndex
                  const worktreeHovered = hoveredWorktreeDirectory === worktree.directory
                  return (
                    <box
                      key={`${tab.id}:${worktree.directory}`}
                      style={{ height: 1, width }}
                      onMouseDown={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        if (worktreeActive) return
                        dashboardStore.setActiveTabId(tab.id)
                        dashboardStore.setActiveWorktreeDirectory(tab.id, worktree.directory)
                      }}
                      onMouseOver={() => setHoveredWorktreeDirectory(worktree.directory)}
                      onMouseOut={() =>
                        setHoveredWorktreeDirectory((current) => (current === worktree.directory ? undefined : current))
                      }
                    >
                      <text
                        content={worktreeLine(worktree.name, worktreeActive, width)}
                        style={{
                          fg: worktreeActive ? theme.text : theme.textMuted,
                          ...(worktreeActive || worktreeHovered
                            ? { bg: worktreeActive ? theme.backgroundElement : theme.background }
                            : {}),
                          ...(worktreeActive ? { attributes: TextAttributes.BOLD } : {}),
                        }}
                      />
                    </box>
                  )
                })
              : null}
          </box>
        )
      })}
    </box>
  )
}

function worktreeLine(name: string, active: boolean, width: number): string {
  const prefix = active ? "  > " : "    "
  return truncate(`${prefix}${displayWorktreeName(name)}`, width).padEnd(width)
}
