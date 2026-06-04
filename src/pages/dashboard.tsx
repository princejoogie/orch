import { APP_PADDING_X, APP_PADDING_Y } from "../config/constants.ts"
import { ProjectSessionList } from "../components/project-session-list.tsx"
import { TableHeader } from "../components/session-table.tsx"
import { theme } from "../theme.ts"
import { useDashboardControllerContext } from "../hooks/use-dashboard-controller.tsx"

type DashboardPageProps = {
  width: number
  height: number
  tableWidth: number
  tableHeight: number
}

export function DashboardPage({ width, height, tableWidth, tableHeight }: DashboardPageProps) {
  const controller = useDashboardControllerContext()

  return (
    <box
      style={{
        flexDirection: "column",
        flexShrink: 0,
        width,
        height,
        backgroundColor: theme.background,
        paddingTop: APP_PADDING_Y,
        paddingBottom: APP_PADDING_Y,
      }}
    >
      <box
        style={{
          flexShrink: 0,
          height: 2,
          paddingLeft: APP_PADDING_X,
          paddingRight: APP_PADDING_X,
          width,
        }}
      >
        <TableHeader width={tableWidth} />
      </box>
      <scrollbox
        ref={controller.listRef}
        focusable={false}
        style={{
          contentOptions: { flexDirection: "column" },
          flexShrink: 0,
          height: tableHeight,
          width,
          wrapperOptions: { width: tableWidth },
          minHeight: 0,
          paddingLeft: APP_PADDING_X,
          paddingRight: APP_PADDING_X,
          scrollX: false,
          scrollY: true,
          verticalScrollbarOptions: { showArrows: false },
          viewportCulling: true,
        }}
      >
        <ProjectSessionList key={controller.activeTab?.id ?? "none"} width={tableWidth} />
      </scrollbox>
    </box>
  )
}
