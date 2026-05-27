import { TextAttributes } from "@opentui/core"
import { count, tabElementId, truncate, type ProjectTab } from "../../lib/utils.ts"
import { theme } from "../../theme.ts"

export function ProjectTabs({ tabs, activeIndex, width }: { tabs: ProjectTab[]; activeIndex: number; width: number }) {
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
        const working = count(tab.rows, "working")
        const countLabel = `${working}/${tab.rows.length}`
        const label = `${truncate(tab.title, Math.max(1, tabWidth - countLabel.length - 1))} ${countLabel}`
        return (
          <text
            id={tabElementId(tab)}
            key={tab.id}
            content={` ${truncate(label, tabWidth).padEnd(tabWidth)} `}
            style={{
              fg: active ? theme.text : theme.textMuted,
              bg: active ? theme.backgroundElement : undefined,
              attributes: active ? TextAttributes.BOLD : undefined,
            }}
          />
        )
      })}
    </box>
  )
}
