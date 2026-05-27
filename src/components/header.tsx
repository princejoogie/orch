import { TextAttributes } from "@opentui/core"
import { countLane, truncate } from "../lib/utils.ts"
import type { DashboardSnapshot } from "../opencode.ts"

export function Header({ snapshot, width }: { snapshot?: DashboardSnapshot; width: number }) {
  const rows = snapshot?.rows ?? []
  const now = Date.now()
  const stats = `${snapshot?.serverUrl ?? "http://localhost:4096"} · ${rows.length} sessions · ${countLane(rows, "working", now)} working · ${countLane(rows, "needs-input", now)} needs input · ${countLane(rows, "completed", now)} completed`
  const title = "opencode orchestrator"
  const statsWidth = Math.max(0, width - title.length - 3)

  return (
    <box
      style={{
        flexDirection: "row",
        flexShrink: 0,
        justifyContent: "space-between",
        paddingLeft: 1,
        paddingRight: 1,
        width: width + 2,
      }}
    >
      <text content="opencode orchestrator" style={{ fg: "#7DD3FC", attributes: TextAttributes.BOLD }} />
      <text content={truncate(stats, statsWidth)} style={{ fg: "#94A3B8" }} />
    </box>
  )
}
