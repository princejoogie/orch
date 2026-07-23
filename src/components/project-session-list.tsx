import { useQuery } from "@tanstack/react-query"
import { Data, Effect } from "effect"
import { useEffect, useRef } from "react"
import { useDashboardControllerContext } from "../hooks/use-dashboard-controller.tsx"
import { EMPTY_SESSION_ROWS, PROJECT_POLL_INTERVAL_MS } from "../config/constants.ts"
import { AppRuntime } from "../effect/app-runtime.ts"
import { SECTIONS, errorMessage } from "../lib/utils.ts"
import { getProjectSessions } from "../opencode/client/index.ts"
import { useDashboardStore } from "../store/dashboard.ts"
import { useGlobalStore } from "../store/global.ts"
import { theme } from "../theme.ts"
import { SectionView } from "./session-table.tsx"

class ProjectSessionQueryError extends Data.TaggedError("ProjectSessionQueryError")<{
  readonly message: string
}> {}

export function ProjectSessionList({ width }: { width: number }) {
  const controller = useDashboardControllerContext()
  const dashboardStore = useDashboardStore()
  const setRowsForProject = useDashboardStore((store) => store.setRowsForProject)
  const setSessionListState = useDashboardStore((store) => store.setSessionListState)
  const globalStore = useGlobalStore()
  const addToast = useGlobalStore((store) => store.addToast)
  const sessionErrorToastRef = useRef<string | undefined>(undefined)
  const {
    data: sessionsData,
    error: sessionsErrorValue,
    isPending: sessionsPending,
    refetch: refetchSessions,
  } = useQuery({
    queryKey: ["opencode-project-sessions", globalStore.config.activeServerUrl, controller.activeTab?.id],
    enabled: controller.activeTab !== undefined,
    refetchInterval: PROJECT_POLL_INTERVAL_MS,
    refetchIntervalInBackground: true,
    queryFn: ({ signal }) => {
      const activeTab = controller.activeTab
      if (!activeTab) {
        return AppRuntime.runPromise(Effect.fail(new ProjectSessionQueryError({ message: "No project selected" })), {
          signal,
        })
      }
      return AppRuntime.runPromise(
        getProjectSessions({
          project: {
            id: activeTab.id,
            title: activeTab.title,
            directory: activeTab.directory,
            worktreeName: activeTab.worktrees[0]?.name ?? activeTab.title,
            worktrees: activeTab.worktrees,
            updated: 0,
          },
          serverUrl: globalStore.config.activeServerUrl,
        }),
        { signal },
      )
    },
  })
  const rows =
    sessionsData?.rows ??
    (controller.activeTabRowsLoaded ? (controller.activeTab?.rows ?? EMPTY_SESSION_ROWS) : EMPTY_SESSION_ROWS)
  const sessionError = sessionsErrorValue ? errorMessage(sessionsErrorValue) : undefined
  const sessionErrorToastKey =
    sessionError && controller.activeTab?.id
      ? `${globalStore.config.activeServerUrl}\n${controller.activeTab.id}\n${sessionError}`
      : undefined

  useEffect(() => {
    if (controller.activeTab?.id) setRowsForProject(controller.activeTab.id, rows)
  }, [controller.activeTab?.id, rows, setRowsForProject])

  useEffect(() => {
    setSessionListState({
      snapshot: sessionsData,
      pending: controller.activeTab !== undefined && sessionsPending,
      error: sessionError,
      refetch: () => void refetchSessions(),
    })
  }, [
    controller.activeTab,
    controller.activeTabRowsLoaded,
    refetchSessions,
    sessionError,
    sessionsData,
    sessionsPending,
    setSessionListState,
  ])

  useEffect(() => {
    if (!sessionErrorToastKey) {
      sessionErrorToastRef.current = undefined
      return
    }

    if (sessionErrorToastRef.current === sessionErrorToastKey) return
    sessionErrorToastRef.current = sessionErrorToastKey
    console.error("Failed to load sessions", sessionsErrorValue)
    addToast({ status: "error", title: "Failed to load sessions", detail: sessionError })
  }, [addToast, sessionError, sessionErrorToastKey, sessionsErrorValue])

  return (
    <>
      {controller.projectPending ? <text content="loading projects…" style={{ fg: theme.info }} /> : null}
      {controller.projectError ? (
        <text content={`error: ${controller.projectError}`} style={{ fg: theme.error }} />
      ) : null}
      {controller.projectSnapshot && controller.projectSnapshot.projects.length === 0 ? (
        <box style={{ flexDirection: "column" }}>
          <text content="No projects with sessions found." style={{ fg: theme.warning }} />
          <text content={controller.projectSnapshot.serverUrl} style={{ fg: theme.textMuted }} />
        </box>
      ) : null}
      {controller.activeTab && sessionsPending ? (
        <text
          content={controller.activeTabRowsLoaded ? "updating project sessions…" : "loading project sessions…"}
          style={{ fg: theme.info }}
        />
      ) : null}
      {sessionError ? <text content={`error: ${sessionError}`} style={{ fg: theme.error }} /> : null}
      {!controller.projectPending &&
      !controller.activeTab &&
      controller.projectSnapshot &&
      controller.projectSnapshot.projects.length > 0 ? (
        <text content="No project selected." style={{ fg: theme.warning }} />
      ) : null}
      {SECTIONS.map((section) => (
        <SectionView
          key={section.status}
          section={section}
          rows={controller.rowsBySection[section.status]}
          worktreeColors={controller.activeTab?.worktreeColors ?? {}}
          selection={controller.selection}
          active={controller.activeSection === section.status}
          collapsed={Boolean(dashboardStore.collapsedSections[section.status])}
          width={width}
          rowDepthById={controller.rowDepthById}
          hoveredRowId={dashboardStore.hoveredRowId}
          selectedSessionIds={dashboardStore.selectedSessionIds}
          multiSelectActive={dashboardStore.visualMode || dashboardStore.selectedSessionIds.size > 0}
          onRowHover={dashboardStore.setHoveredRowId}
          onHeaderSelect={() => dashboardStore.setSelection({ type: "section", section: section.status, index: 0 })}
          onHeaderClick={() => controller.handleSectionHeaderClick(section.status)}
          onRowSelect={(selection) => dashboardStore.setSelection(selection)}
          onRowClick={controller.handleSessionRowClick}
        />
      ))}
    </>
  )
}
