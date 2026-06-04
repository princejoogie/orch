import { TextAttributes } from "@opentui/core"
import { TOP_BAR_BACKGROUND, TOP_BAR_HEIGHT } from "../config/constants.ts"
import { useDashboardControllerContext } from "../hooks/use-dashboard-controller.tsx"
import { useDashboardStore } from "../store/dashboard.ts"
import { useGlobalStore } from "../store/global.ts"
import { theme } from "../theme.ts"
import { mouseAction } from "./ui/button.tsx"
import { fitCell } from "./ui/dialog.tsx"

export function TopMenuBar({ width }: { width: number }) {
  const controller = useDashboardControllerContext()
  const dashboardStore = useDashboardStore()
  const globalStore = useGlobalStore()
  const indicator = dashboardStore.visualMode ? " VISUAL " : ""
  const indicatorWidth = indicator.length
  const spacerWidth = Math.max(0, width - 27 - indicatorWidth)

  return (
    <box
      style={{
        flexDirection: "row",
        flexShrink: 0,
        height: TOP_BAR_HEIGHT,
        width,
        backgroundColor: TOP_BAR_BACKGROUND,
      }}
    >
      <MenuButton
        label="[1] Actions"
        width={13}
        active={globalStore.openMenu === "actions"}
        onPress={() => globalStore.toggleMenu("actions")}
        onHover={() => {
          if (globalStore.openMenu) controller.openMenu("actions")
        }}
      />
      <MenuButton
        label="[2] Selected"
        width={14}
        active={globalStore.openMenu === "selected"}
        onPress={() => globalStore.toggleMenu("selected")}
        onHover={() => {
          if (globalStore.openMenu) controller.openMenu("selected")
        }}
      />
      <text content={" ".repeat(spacerWidth)} style={{ bg: TOP_BAR_BACKGROUND }} />
      {dashboardStore.visualMode ? (
        <text
          content={indicator}
          style={{ fg: theme.background, bg: theme.primary, attributes: TextAttributes.BOLD }}
        />
      ) : null}
    </box>
  )
}

function MenuButton({
  label,
  width,
  active,
  onPress,
  onHover,
}: {
  label: string
  width: number
  active: boolean
  onPress: () => void
  onHover: () => void
}) {
  return (
    <box
      style={{ height: 1, width }}
      onMouseOver={onHover}
      onMouseDown={(event) => {
        mouseAction(event)
        onPress()
      }}
    >
      <text
        content={fitCell(` ${label} `, width)}
        style={{
          fg: active ? theme.text : theme.textMuted,
          bg: active ? theme.backgroundElement : TOP_BAR_BACKGROUND,
          ...(active ? { attributes: TextAttributes.BOLD } : {}),
        }}
      />
    </box>
  )
}
