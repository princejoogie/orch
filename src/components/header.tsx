import { TextAttributes } from "@opentui/core"
import { countLane, truncate } from "../lib/utils.ts"
import type { DashboardSnapshot } from "../opencode.ts"
import { theme } from "../theme.ts"

export function Header({ snapshot, width }: { snapshot?: DashboardSnapshot; width: number }) {
  const rows = snapshot?.rows ?? []
  const now = Date.now()
  const serverUrl = snapshot?.serverUrl ?? "http://localhost:4096"

  return (
    <box
      style={{
        flexDirection: "column",
        flexShrink: 0,
        width,
      }}
    >
      <text content={truncate(serverUrl, width)} style={{ fg: theme.textMuted }} />
      <text content={`${rows.length} sessions`} style={{ fg: theme.text, marginTop: 1 }} />
      <text content={`${countLane(rows, "working", now)} working`} style={{ fg: theme.warning }} />
      <text content={`${countLane(rows, "needs-input", now)} needs input`} style={{ fg: theme.info }} />
      <text content={`${countLane(rows, "completed", now)} completed`} style={{ fg: theme.success }} />
    </box>
  )
}

export function HeaderTitle() {
  return <text content="Opencode Orchestrator" style={{ fg: theme.primary, attributes: TextAttributes.BOLD }} />
}
