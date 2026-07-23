import { TextAttributes } from "@opentui/core"
import { useDashboardControllerContext } from "../hooks/use-dashboard-controller.tsx"
import { countLane } from "../lib/session-hierarchy.ts"
import { shortcutHintLine } from "../lib/utils.ts"
import { mouseAction } from "./ui/button.tsx"
import { useGlobalStore } from "../store/global.ts"
import { theme } from "../theme.ts"

export function Header({ width }: { width: number }) {
  const controller = useDashboardControllerContext()
  const globalStore = useGlobalStore()
  const now = Date.now()
  const serverUrl = controller.projectSnapshot?.serverUrl ?? globalStore.config.activeServerUrl
  const active = globalStore.openMenu === "servers"

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
          globalStore.toggleMenu("servers")
        }}
      >
        <text
          content={shortcutHintLine(serverUrl, "[^s]", width)}
          style={{ fg: active ? theme.text : theme.textMuted, ...(active ? { attributes: TextAttributes.BOLD } : {}) }}
        />
      </box>
      <text content={`${controller.activeProjectRows.length} sessions`} style={{ fg: theme.text, marginTop: 1 }} />
      <text
        content={`${countLane(controller.activeProjectRows, "working", now)} working`}
        style={{ fg: theme.warning }}
      />
      <text
        content={`${countLane(controller.activeProjectRows, "needs-input", now)} needs input`}
        style={{ fg: theme.info }}
      />
      <text
        content={`${countLane(controller.activeProjectRows, "completed", now)} completed`}
        style={{ fg: theme.success }}
      />
    </box>
  )
}

export function HeaderTitle() {
  return <text content="Opencode Orchestrator" style={{ fg: theme.primary, attributes: TextAttributes.BOLD }} />
}
