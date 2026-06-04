import { SIDEBAR_BACKGROUND, SIDEBAR_PADDING_X, SIDEBAR_PADDING_Y } from "../config/constants.ts"
import { Header, HeaderTitle } from "./header.tsx"
import { ProjectTabs } from "./project-tabs.tsx"
import { SearchInput } from "./search-input.tsx"
import { SidebarSettingsButton } from "./sidebar-settings-button.tsx"
import { useDashboardControllerContext } from "../hooks/use-dashboard-controller.tsx"
import { useGlobalStore } from "../store/global.ts"

export function Sidebar({ width, height }: { width: number; height: number }) {
  const controller = useDashboardControllerContext()
  const globalStore = useGlobalStore()

  if (width <= 0) return null

  const contentWidth = Math.max(1, width - SIDEBAR_PADDING_X * 2)

  return (
    <box
      style={{
        flexDirection: "column",
        flexShrink: 0,
        width,
        height,
        backgroundColor: SIDEBAR_BACKGROUND,
        paddingLeft: SIDEBAR_PADDING_X,
        paddingRight: SIDEBAR_PADDING_X,
        paddingTop: SIDEBAR_PADDING_Y,
        paddingBottom: SIDEBAR_PADDING_Y,
      }}
    >
      <box style={{ flexShrink: 0, width: contentWidth }}>
        <HeaderTitle />
      </box>
      {globalStore.page === "dashboard" ? <SearchInput width={contentWidth} /> : null}
      <box style={{ flexShrink: 0, marginTop: 1, width: contentWidth }}>
        <Header width={contentWidth} />
      </box>
      <box style={{ flexShrink: 0, marginTop: 2, width: contentWidth }}>
        <ProjectTabs width={contentWidth} />
      </box>
      <box style={{ flexGrow: 1 }} />
      <SidebarSettingsButton width={contentWidth} onPress={controller.openSettingsPage} />
    </box>
  )
}
