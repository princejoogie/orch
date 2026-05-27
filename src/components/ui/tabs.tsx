import { TextAttributes } from "@opentui/core"
import { count, tabElementId, truncate, type ProjectTab } from "../../lib/utils.ts"

export function ProjectTabs({ tabs, activeIndex, width }: { tabs: ProjectTab[]; activeIndex: number; width: number }) {
  const tabWidth = Math.max(10, Math.min(24, Math.floor(width / Math.max(1, Math.min(tabs.length, 5))) - 1))

  return (
    <box
      style={{
        flexDirection: "row",
        flexShrink: 0,
        paddingLeft: 1,
        paddingRight: 1,
        width: width + 2,
      }}
    >
      {tabs.length === 0 ? <text content="no projects" style={{ fg: "#64748B" }} /> : null}
      {tabs.map((tab, index) => {
        const active = index === activeIndex
        const working = count(tab.rows, "working")
        const label = `${truncate(tab.title, Math.max(1, tabWidth - 4))} ${working}/${tab.rows.length}`
        return (
          <text
            id={tabElementId(tab)}
            key={tab.id}
            content={` ${truncate(label, tabWidth).padEnd(tabWidth)} `}
            style={{
              fg: active ? "#F8FAFC" : "#94A3B8",
              bg: active ? "#1E3A8A" : undefined,
              attributes: active ? TextAttributes.BOLD : undefined,
              marginRight: 1,
            }}
          />
        )
      })}
    </box>
  )
}
