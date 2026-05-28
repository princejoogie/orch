import { TextAttributes } from "@opentui/core"
import { mouseAction } from "./ui/button.tsx"
import { countLane, shortcutHintLine } from "../lib/utils.ts"
import type { DashboardSnapshot } from "../opencode.ts"
import { theme } from "../theme.ts"

export function Header({
  snapshot,
  width,
  active,
  onServerPress,
}: {
  snapshot?: DashboardSnapshot | undefined
  width: number
  active?: boolean | undefined
  onServerPress: () => void
}) {
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
      <box
        style={{ height: 1, width }}
        onMouseDown={(event) => {
          mouseAction(event)
          onServerPress()
        }}
      >
        <text
          content={shortcutHintLine(serverUrl, "[^s]", width)}
          style={{ fg: active ? theme.text : theme.textMuted, ...(active ? { attributes: TextAttributes.BOLD } : {}) }}
        />
      </box>
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
