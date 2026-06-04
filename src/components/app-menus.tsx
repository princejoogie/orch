import { SIDEBAR_PADDING_X, SIDEBAR_PADDING_Y, TOP_BAR_HEIGHT } from "../config/constants.ts"
import { useDashboardControllerContext } from "../hooks/use-dashboard-controller.tsx"
import { useGlobalStore } from "../store/global.ts"
import { MouseDismissLayer } from "./ui/dialog.tsx"
import { MenuDropdown } from "./ui/menu-dropdown.tsx"

export function AppMenus({
  screenWidth,
  screenHeight,
  mainPanelWidth,
}: {
  screenWidth: number
  screenHeight: number
  mainPanelWidth: number
}) {
  const controller = useDashboardControllerContext()
  const globalStore = useGlobalStore()
  const serverSelectorLeft = mainPanelWidth + SIDEBAR_PADDING_X
  const serverSelectorTop = SIDEBAR_PADDING_Y + 1 + 3 + 1

  if (globalStore.openMenu === "actions") {
    return (
      <>
        <MouseDismissLayer
          screenWidth={screenWidth}
          screenHeight={screenHeight}
          top={TOP_BAR_HEIGHT}
          onDismiss={() => globalStore.setOpenMenu(undefined)}
        />
        <MenuDropdown
          left={0}
          top={TOP_BAR_HEIGHT}
          items={controller.actionsMenuItems}
          selectedIndex={globalStore.selectedMenuIndex}
          onSelect={globalStore.setSelectedMenuIndex}
          onClose={() => globalStore.setOpenMenu(undefined)}
        />
      </>
    )
  }

  if (globalStore.openMenu === "selected") {
    return (
      <>
        <MouseDismissLayer
          screenWidth={screenWidth}
          screenHeight={screenHeight}
          top={TOP_BAR_HEIGHT}
          onDismiss={() => globalStore.setOpenMenu(undefined)}
        />
        <MenuDropdown
          left={10}
          top={TOP_BAR_HEIGHT}
          items={controller.selectedMenuItems}
          selectedIndex={globalStore.selectedMenuIndex}
          onSelect={globalStore.setSelectedMenuIndex}
          onClose={() => globalStore.setOpenMenu(undefined)}
        />
      </>
    )
  }

  if (globalStore.openMenu === "servers") {
    return (
      <>
        <MouseDismissLayer
          screenWidth={screenWidth}
          screenHeight={screenHeight}
          top={TOP_BAR_HEIGHT}
          onDismiss={() => globalStore.setOpenMenu(undefined)}
        />
        <MenuDropdown
          left={serverSelectorLeft}
          top={serverSelectorTop + 1}
          items={controller.serverMenuItems}
          selectedIndex={globalStore.selectedMenuIndex}
          onSelect={globalStore.setSelectedMenuIndex}
          onClose={() => globalStore.setOpenMenu(undefined)}
        />
      </>
    )
  }

  return null
}
