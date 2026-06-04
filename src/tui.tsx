import { createCliRenderer } from "@opentui/core"
import { createRoot, useTerminalDimensions } from "@opentui/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AppDialogs } from "./components/app-dialogs.tsx"
import { AppMenus } from "./components/app-menus.tsx"
import { Sidebar } from "./components/sidebar.tsx"
import { Toast } from "./components/toast.tsx"
import { TopMenuBar } from "./components/top-menu.tsx"
import {
  APP_PADDING_X,
  APP_PADDING_Y,
  MAIN_PANEL_MIN_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_WIDTH_RATIO,
  TABLE_HEADER_HEIGHT,
  TOP_BAR_HEIGHT,
} from "./config/constants.ts"
import { DashboardControllerProvider } from "./hooks/use-dashboard-controller.tsx"
import { SettingsControllerProvider } from "./hooks/use-settings-controller.tsx"
import { DashboardPage } from "./pages/dashboard.tsx"
import { SettingsPage } from "./pages/settings.tsx"
import { DashboardStoreProvider } from "./store/dashboard.ts"
import { useGlobalStore } from "./store/global.ts"
import { theme } from "./theme.ts"

interface RunTuiOptions {
  args: string[]
}

export async function runTui(_options: RunTuiOptions): Promise<void> {
  let resolveDone!: () => void
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve
  })
  const queryClient = new QueryClient()

  const renderer = await createCliRenderer({
    exitOnCtrlC: false,
    targetFps: 30,
    useKittyKeyboard: {},
    useMouse: true,
    openConsoleOnError: true,
    onDestroy: () => {
      queryClient.clear()
      resolveDone()
    },
  })

  renderer.setBackgroundColor(theme.background)
  createRoot(renderer).render(
    <QueryClientProvider client={queryClient}>
      <DashboardStoreProvider>
        <App />
      </DashboardStoreProvider>
    </QueryClientProvider>,
  )

  await done
}

function App() {
  const dimensions = useTerminalDimensions()
  const desiredSidebarWidth = Math.min(
    SIDEBAR_MAX_WIDTH,
    Math.max(SIDEBAR_MIN_WIDTH, Math.floor(dimensions.width * SIDEBAR_WIDTH_RATIO)),
  )
  const mainPanelMinimum = Math.min(dimensions.width, MAIN_PANEL_MIN_WIDTH)
  const sidebarWidth = Math.max(0, Math.min(desiredSidebarWidth, dimensions.width - mainPanelMinimum))
  const mainPanelWidth = Math.max(1, dimensions.width - sidebarWidth)
  const contentHeight = Math.max(1, dimensions.height - TOP_BAR_HEIGHT)
  const tableWidth = Math.max(1, mainPanelWidth - APP_PADDING_X * 2)
  const tableHeight = Math.max(1, contentHeight - APP_PADDING_Y * 2 - TABLE_HEADER_HEIGHT)
  const globalStore = useGlobalStore()

  return (
    <SettingsControllerProvider>
      <DashboardControllerProvider tableHeight={tableHeight}>
        <box
          style={{
            width: dimensions.width,
            height: dimensions.height,
            flexDirection: "row",
            backgroundColor: theme.background,
          }}
        >
          <box
            style={{
              flexDirection: "column",
              flexShrink: 0,
              width: mainPanelWidth,
              height: dimensions.height,
              backgroundColor: theme.background,
            }}
          >
            <TopMenuBar width={mainPanelWidth} />
            {globalStore.page === "settings" && globalStore.settingsPage ? (
              <SettingsPage width={mainPanelWidth} height={contentHeight} />
            ) : (
              <DashboardPage
                width={mainPanelWidth}
                height={contentHeight}
                tableWidth={tableWidth}
                tableHeight={tableHeight}
              />
            )}
          </box>
          <Sidebar width={sidebarWidth} height={dimensions.height} />
          <AppMenus screenWidth={dimensions.width} screenHeight={dimensions.height} mainPanelWidth={mainPanelWidth} />
          <AppDialogs width={dimensions.width} height={dimensions.height} />
          <Toast screenWidth={mainPanelWidth} />
        </box>
      </DashboardControllerProvider>
    </SettingsControllerProvider>
  )
}
