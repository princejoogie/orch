import { useQuery } from "@tanstack/react-query"
import { useEffect } from "react"
import { useDashboardControllerContext } from "../hooks/use-dashboard-controller.tsx"
import { EMPTY_SESSION_ROWS, POLL_INTERVAL_MS } from "../config/constants.ts"
import { SECTIONS } from "../lib/utils.ts"
import { getProjectSessions } from "../opencode.ts"
import { useDashboardStore } from "../store/dashboard.ts"
import { useGlobalStore } from "../store/global.ts"
import { theme } from "../theme.ts"
import { SectionView } from "./session-table.tsx"

export function ProjectSessionList({ width }: { width: number }) {
  const controller = useDashboardControllerContext()
  const dashboardStore = useDashboardStore()
  const globalStore = useGlobalStore()
  const activeTab = controller.activeTab
  const activeTabId = activeTab?.id
  const activeTabRowsLoaded = controller.activeTabRowsLoaded
  const setSessionListState = dashboardStore.setSessionListState
  const setRowsForProject = dashboardStore.setRowsForProject
  const serverUrl = globalStore.config.activeServerUrl
  const sessionsQuery = useQuery({
    queryKey: ["opencode-project-sessions", serverUrl, activeTab?.id],
    enabled: activeTab !== undefined,
    queryFn: ({ signal }) => {
      if (!activeTab) throw new Error("No project selected")
      return getProjectSessions({
        project: {
          id: activeTab.id,
          title: activeTab.title,
          directory: activeTab.directory,
          worktreeName: activeTab.worktrees[0]?.name ?? activeTab.title,
          worktrees: activeTab.worktrees,
          updated: 0,
        },
        serverUrl,
        signal,
      })
    },
  })
  const rows =
    sessionsQuery.data?.rows ?? (activeTabRowsLoaded ? (activeTab?.rows ?? EMPTY_SESSION_ROWS) : EMPTY_SESSION_ROWS)
  const refetchSessions = sessionsQuery.refetch
  const hasProject = activeTab !== undefined
  const sessionError =
    sessionsQuery.error instanceof Error
      ? sessionsQuery.error.message
      : sessionsQuery.error
        ? String(sessionsQuery.error)
        : undefined

  useEffect(() => {
    if (activeTabId) setRowsForProject(activeTabId, rows)
  }, [activeTabId, rows, setRowsForProject])

  useEffect(() => {
    setSessionListState({
      snapshot: sessionsQuery.data,
      pending: hasProject && sessionsQuery.isPending && !activeTabRowsLoaded,
      error: sessionError,
      refetch: () => void refetchSessions(),
    })
  }, [
    activeTabId,
    activeTabRowsLoaded,
    hasProject,
    sessionError,
    setSessionListState,
    sessionsQuery.data,
    sessionsQuery.isPending,
    refetchSessions,
  ])

  useEffect(() => {
    if (!hasProject) return
    const interval = setInterval(() => void refetchSessions(), POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [hasProject, refetchSessions])

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
      {activeTab && sessionsQuery.isPending && !activeTabRowsLoaded ? (
        <text content="loading project sessions…" style={{ fg: theme.info }} />
      ) : null}
      {sessionError ? <text content={`error: ${sessionError}`} style={{ fg: theme.error }} /> : null}
      {!controller.projectPending &&
      !activeTab &&
      controller.projectSnapshot &&
      controller.projectSnapshot.projects.length > 0 ? (
        <text content="No project selected." style={{ fg: theme.warning }} />
      ) : null}
      {SECTIONS.map((section) => (
        <SectionView
          key={section.status}
          section={section}
          rows={controller.rowsBySection[section.status]}
          worktreeColors={activeTab?.worktreeColors ?? {}}
          selection={controller.selection}
          active={controller.activeSection === section.status}
          collapsed={Boolean(dashboardStore.collapsedSections[section.status])}
          width={width}
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
