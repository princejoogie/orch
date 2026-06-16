import { type ScrollBoxRenderable } from "@opentui/core"
import { useRenderer } from "@opentui/react"
import { useQuery } from "@tanstack/react-query"
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode, type RefObject } from "react"
import { SHORTCUTS, type ShortcutAction } from "../components/shortcuts.ts"
import { type MenuItem } from "../components/ui/menu-dropdown.tsx"
import {
  DOUBLE_CLICK_MS,
  EMPTY_SESSION_ROWS,
  PROJECT_POLL_INTERVAL_MS,
  SELECTION_SCROLL_EDGE_OFFSET,
} from "../config/constants.ts"
import { loadOrchConfig } from "../config/orch.ts"
import { AppRuntime } from "../effect/app-runtime.ts"
import { useSettingsControllerContext } from "./use-settings-controller.tsx"
import { useNow } from "./use-now.ts"
import { useScrollFollowSelected } from "./use-scroll-follow-selected.ts"
import { appKeymap } from "../keymap/dashboard.ts"
import { useOpenTuiSubscribe } from "../keymap/opentui-adapter.ts"
import { useKeymap } from "../keymap/react.ts"
import { useOpencodeEventRefresh } from "./use-opencode-event-refresh.ts"
import {
  moveSelection,
  moveSelectionClamped,
  normalizeSelection,
  nextIndex,
  projectTabs,
  rowInLane,
  SECTIONS,
  selectedRow,
  selectionEdge,
  worktreeOptions,
  errorMessage,
  type CollapsedSections,
  type LaneStatus,
  type ProjectTab,
  type Selection,
  type WorktreeOption,
} from "../lib/utils.ts"
import {
  createSessionWithPrompt,
  createWorktree,
  deleteSession,
  getProjects,
  interruptSession,
  removeWorktree,
  replyPermissionRequest,
  sendPrompt,
  selectTuiSession,
  type ModelProviderOption,
  type ProjectSnapshot,
  type SessionRow,
} from "../opencode/client/index.ts"
import { useDashboardStore } from "../store/dashboard.ts"
import { useGlobalStore, type MenuId } from "../store/global.ts"
import { openTmuxSessionForRow } from "../tmux.ts"

export type DashboardController = {
  now: Date
  listRef: RefObject<ScrollBoxRenderable | null>
  projectSnapshot?: ProjectSnapshot | undefined
  projectPending: boolean
  projectError?: string | undefined
  tabs: ProjectTab[]
  activeTab?: ProjectTab | undefined
  activeTabIndex: number
  activeWorktrees: WorktreeOption[]
  activeWorktree?: WorktreeOption | undefined
  activeWorktreeIndex: number
  activeTabRowsLoaded: boolean
  activeProjectRows: SessionRow[]
  rowsBySection: Record<LaneStatus, SessionRow[]>
  activeSection: LaneStatus
  selection: Selection
  actionsMenuItems: MenuItem[]
  selectedMenuItems: MenuItem[]
  serverMenuItems: MenuItem[]
  openMenu: (menu: MenuId) => void
  openSettingsPage: () => void
  submitAddSession: (value: string) => Promise<void>
  replyToPermission: (reply: "once" | "always" | "reject") => Promise<void>
  submitPrompt: (value: string) => Promise<void>
  confirmDeleteWorktree: () => void
  confirmDeleteSession: () => void
  confirmInterruptSession: () => void
  executeShortcutAction: (action: ShortcutAction) => boolean
  handleSectionHeaderClick: (section: LaneStatus) => void
  handleSessionRowClick: (row: SessionRow) => void
}

const DashboardControllerContext = createContext<DashboardController | undefined>(undefined)

export function DashboardControllerProvider({ tableHeight, children }: { tableHeight: number; children: ReactNode }) {
  const controller = useDashboardController({ tableHeight })

  return <DashboardControllerContext.Provider value={controller}>{children}</DashboardControllerContext.Provider>
}

export function useDashboardControllerContext(): DashboardController {
  const controller = useContext(DashboardControllerContext)

  if (!controller) {
    throw new Error("useDashboardControllerContext must be used inside DashboardControllerProvider")
  }

  return controller
}

function useDashboardController({ tableHeight }: { tableHeight: number }): DashboardController {
  const renderer = useRenderer()
  const now = useNow(80)
  const listRef = useRef<ScrollBoxRenderable>(null)
  const lastSessionClickRef = useRef<{ rowId: string; time: number } | null>(null)
  const lastSectionClickRef = useRef<{ section: LaneStatus; time: number } | null>(null)
  const dashboardStore = useDashboardStore()
  const globalStore = useGlobalStore()
  const settingsController = useSettingsControllerContext()
  const dashboardStoreRef = useRef(dashboardStore)
  const globalStoreRef = useRef(globalStore)
  const projectErrorToastRef = useRef<string | undefined>(undefined)

  dashboardStoreRef.current = dashboardStore
  globalStoreRef.current = globalStore

  const projectsQuery = useQuery({
    queryKey: ["opencode-projects", globalStore.config.activeServerUrl],
    queryFn: ({ signal }) =>
      AppRuntime.runPromise(getProjects({ serverUrl: globalStore.config.activeServerUrl }), { signal }),
  })
  const { refetch: refetchProjects } = projectsQuery

  const projectSnapshot = projectsQuery.data
  const projectQueryError = projectsQuery.error ? errorMessage(projectsQuery.error) : undefined
  const projectErrorToastKey = projectQueryError
    ? `${globalStore.config.activeServerUrl}\n${projectQueryError}`
    : undefined
  const tabs = useMemo(
    () => projectTabs(projectSnapshot?.projects ?? [], dashboardStore.rowsByProjectId),
    [dashboardStore.rowsByProjectId, projectSnapshot?.projects],
  )
  const activeTabId = dashboardStore.activeTabId
  const setActiveTabId = dashboardStore.setActiveTabId
  const selectedTabIndex = activeTabId ? tabs.findIndex((tab) => tab.id === activeTabId) : -1
  const activeTabIndex = selectedTabIndex === -1 ? 0 : selectedTabIndex
  useEffect(() => {
    const firstTabId = tabs[0]?.id
    if (!firstTabId) {
      if (activeTabId !== undefined) setActiveTabId(undefined)
      return
    }

    if (selectedTabIndex === -1) setActiveTabId(firstTabId)
  }, [activeTabId, selectedTabIndex, setActiveTabId, tabs])
  const activeTab = tabs[activeTabIndex]
  const activeTabKey = activeTab?.id
  const projectWorktrees = useMemo(() => worktreeOptions(activeTab), [activeTab])
  const activeWorktrees = useMemo(() => (projectWorktrees.length > 1 ? projectWorktrees : []), [projectWorktrees])
  const selectedWorktreeDirectory = activeTabKey ? dashboardStore.activeWorktreeByProjectId[activeTabKey] : undefined
  const activeWorktreeIndex = selectedWorktreeDirectory
    ? activeWorktrees.findIndex((worktree) => worktree.directory === selectedWorktreeDirectory)
    : -1
  const activeWorktree = activeWorktreeIndex >= 0 ? activeWorktrees[activeWorktreeIndex] : undefined
  const activeTabRowsLoaded = activeTabKey !== undefined && Object.hasOwn(dashboardStore.rowsByProjectId, activeTabKey)
  const activeTabCachedRows = activeTabKey ? dashboardStore.rowsByProjectId[activeTabKey] : undefined
  const activeProjectRows = activeTabRowsLoaded ? (activeTabCachedRows ?? EMPTY_SESSION_ROWS) : EMPTY_SESSION_ROWS
  const filteredRows = useMemo(
    () =>
      activeProjectRows.filter(
        (row) =>
          (!activeWorktree || row.directory === activeWorktree.directory) &&
          fuzzySessionMatch(row, dashboardStore.searchValue),
      ),
    [activeProjectRows, activeWorktree, dashboardStore.searchValue],
  )
  const rowsBySection = useMemo(() => projectRowsBySection(filteredRows, now), [filteredRows, now])
  const resolvedSelection = useMemo(
    () => normalizeSelection(dashboardStore.selection, rowsBySection, dashboardStore.collapsedSections),
    [dashboardStore.collapsedSections, dashboardStore.selection, rowsBySection],
  )
  const activeSection = resolvedSelection.section
  const currentRow = selectedRow(resolvedSelection, rowsBySection, dashboardStore.collapsedSections)
  const selectedRows = useMemo(
    () => filteredRows.filter((row) => dashboardStore.selectedSessionIds.has(row.id)),
    [dashboardStore.selectedSessionIds, filteredRows],
  )
  const rowsToDelete = selectedRows.length > 0 ? selectedRows : currentRow ? [currentRow] : []
  const selectedRowsToInterrupt = selectedRows.filter((row) => row.status === "working")
  const rowsToInterrupt =
    selectedRowsToInterrupt.length > 0 ? selectedRowsToInterrupt : currentRow?.status === "working" ? [currentRow] : []
  const statusLineCount =
    (projectsQuery.isPending || dashboardStore.sessionListState.pending ? 1 : 0) +
    (projectQueryError || dashboardStore.sessionListState.error ? 1 : 0) +
    (projectSnapshot && projectSnapshot.projects.length === 0 ? 2 : 0)
  const selectedLine = selectedSessionLine(
    resolvedSelection,
    rowsBySection,
    dashboardStore.collapsedSections,
    statusLineCount,
  )
  const subscribe = useOpenTuiSubscribe()
  useOpencodeEventRefresh(globalStore.config.activeServerUrl)
  const actionsMenuItems: MenuItem[] = [
    {
      label: "New Session",
      shortcut: "a",
      disabled: !activeTab || worktreeOptions(activeTab).length === 0,
      run: openAddSessionDialog,
    },
    { label: "Refresh", shortcut: "r", run: () => void refreshDashboard() },
    { label: "Settings", shortcut: "click", run: openSettingsPage },
    { label: "Help", shortcut: "?", run: openShortcutsDialog },
    { label: "Quit", shortcut: "q / esc", run: () => renderer.destroy() },
  ]
  const selectedMenuItems: MenuItem[] = [
    {
      label: "Prompt",
      shortcut: "enter",
      disabled: !currentRow,
      run: () => {
        if (currentRow) openPromptOrPermissionDialog(currentRow)
      },
    },
    {
      label: "Open in tmux",
      shortcut: "o",
      disabled: !currentRow,
      run: () => {
        if (currentRow) void openTmuxSession(currentRow)
      },
    },
    {
      label: "Delete",
      shortcut: "dd",
      danger: true,
      disabled: rowsToDelete.length === 0,
      run: () => {
        openDeleteSessionDialog()
      },
    },
    {
      label: "Interrupt",
      shortcut: "ss",
      danger: true,
      disabled: rowsToInterrupt.length === 0,
      run: () => {
        openInterruptSessionDialog()
      },
    },
  ]
  const serverMenuItems: MenuItem[] = [
    ...globalStore.config.servers.map((server) => ({
      label: server.name,
      shortcut: server.url === globalStore.config.activeServerUrl ? "active" : "switch",
      run: () => void settingsController.switchServer(server.url),
    })),
    { label: "Add server", shortcut: "edit", run: openSettingsPage },
  ]
  const activeMenuItems =
    globalStore.openMenu === "actions"
      ? actionsMenuItems
      : globalStore.openMenu === "selected"
        ? selectedMenuItems
        : globalStore.openMenu === "servers"
          ? serverMenuItems
          : []

  useKeymap(
    appKeymap,
    {
      global: {
        textInputActive:
          dashboardStore.searchFocused ||
          Boolean(dashboardStore.addSessionDialog) ||
          Boolean(dashboardStore.deleteWorktreeDialog) ||
          Boolean(dashboardStore.permissionDialog) ||
          Boolean(dashboardStore.promptDialog) ||
          globalStore.page === "settings",
        menu:
          globalStore.openMenu &&
          !globalStore.shortcutsDialogOpen &&
          !dashboardStore.addSessionDialog &&
          !dashboardStore.deleteWorktreeDialog &&
          !dashboardStore.permissionDialog &&
          !dashboardStore.promptDialog &&
          !dashboardStore.deleteDialog &&
          !dashboardStore.interruptDialog &&
          !dashboardStore.searchFocused
            ? {
                itemCount: activeMenuItems.length,
                close: () => globalStore.setOpenMenu(undefined),
                openMenu,
                moveSelection: (delta) =>
                  globalStore.setSelectedMenuIndex(
                    nextIndex(globalStore.selectedMenuIndex, delta, activeMenuItems.length),
                  ),
                executeSelected: executeSelectedMenuItem,
              }
            : null,
        helpDialog: globalStore.shortcutsDialogOpen
          ? {
              commandCount: SHORTCUTS.length,
              close: () => globalStore.setShortcutsDialogOpen(false),
              moveSelection: (delta) =>
                globalStore.setSelectedShortcutIndex(
                  nextIndex(globalStore.selectedShortcutIndex, delta, SHORTCUTS.length),
                ),
              executeSelected: executeSelectedShortcut,
            }
          : null,
        clearTextInput: clearActiveTextInput,
        quit: () => renderer.destroy(),
      },
      dashboard: {
        addSessionDialog: dashboardStore.addSessionDialog
          ? dashboardStore.deleteWorktreeDialog
            ? null
            : {
                worktreeCount: dashboardStore.addSessionDialog.worktrees.length + 1,
                providerCount: dashboardStore.addSessionDialog.modelProviders.length,
                modelCount:
                  dashboardStore.addSessionDialog.modelProviders[dashboardStore.addSessionDialog.modelProviderIndex]
                    ?.models.length ?? 0,
                variantCount: variantOptions(
                  dashboardStore.addSessionDialog.modelProviders[dashboardStore.addSessionDialog.modelProviderIndex]
                    ?.models[dashboardStore.addSessionDialog.modelIndex],
                ).length,
                focus: dashboardStore.addSessionDialog.focus,
                close: dashboardStore.closeAddSessionDialog,
                moveFocus: (delta) => {
                  const dialog = dashboardStore.addSessionDialog
                  if (!dialog) return
                  dashboardStore.setAddSessionFocus(nextAddSessionFocus(dialog.focus, delta))
                },
                moveWorktree: (delta) => {
                  const dialog = dashboardStore.addSessionDialog
                  if (!dialog || dialog.worktrees.length === 0) return
                  dashboardStore.setAddSessionWorktreeIndex(
                    nextIndex(dialog.worktreeIndex, delta, dialog.worktrees.length + 1),
                  )
                },
                commitWorktree: () => {
                  const dialog = dashboardStore.addSessionDialog
                  if (!dialog) return
                  dashboardStore.setAddSessionFocus("input")
                },
                moveModelSelector: (delta) => {
                  const dialog = dashboardStore.addSessionDialog
                  if (!dialog) return
                  if (dialog.focus === "model-provider") {
                    dashboardStore.setAddSessionModelProviderIndex(
                      nextIndex(dialog.modelProviderIndex, delta, dialog.modelProviders.length),
                    )
                    return
                  }

                  const modelCount = dialog.modelProviders[dialog.modelProviderIndex]?.models.length ?? 0
                  if (dialog.focus === "model" && modelCount > 0) {
                    dashboardStore.setAddSessionModelIndex(nextIndex(dialog.modelIndex, delta, modelCount))
                    return
                  }

                  const variantCount = variantOptions(
                    dialog.modelProviders[dialog.modelProviderIndex]?.models[dialog.modelIndex],
                  ).length
                  if (dialog.focus === "variant" && variantCount > 0) {
                    dashboardStore.setAddSessionVariantIndex(nextIndex(dialog.variantIndex, delta, variantCount))
                  }
                },
                commitModelSelector: () => {
                  const dialog = dashboardStore.addSessionDialog
                  if (!dialog) return
                  dashboardStore.setAddSessionFocus(
                    dialog.focus === "model-provider" ? "model" : dialog.focus === "model" ? "variant" : "input",
                  )
                },
                canRemoveWorktree: canRemoveSelectedAddSessionWorktree(),
                removeWorktree: openDeleteSelectedAddSessionWorktreeDialog,
              }
          : null,
        deleteWorktreeDialog: dashboardStore.deleteWorktreeDialog
          ? { close: dashboardStore.closeDeleteWorktreeDialog, confirm: confirmDeleteWorktree }
          : null,
        permissionDialog: dashboardStore.permissionDialog
          ? {
              close: dashboardStore.closePermissionDialog,
              decide: (reply) => void replyToPermission(reply),
            }
          : null,
        promptDialog: dashboardStore.promptDialog
          ? {
              providerCount: dashboardStore.promptDialog.modelProviders.length,
              modelCount:
                dashboardStore.promptDialog.modelProviders[dashboardStore.promptDialog.modelProviderIndex]?.models
                  .length ?? 0,
              variantCount: variantOptions(
                dashboardStore.promptDialog.modelProviders[dashboardStore.promptDialog.modelProviderIndex]?.models[
                  dashboardStore.promptDialog.modelIndex
                ],
              ).length,
              focus: dashboardStore.promptDialog.focus,
              close: dashboardStore.closePromptDialog,
              moveFocus: (delta) => {
                const dialog = dashboardStore.promptDialog
                if (!dialog) return
                dashboardStore.setPromptFocus(nextPromptFocus(dialog.focus, delta))
              },
              moveModelSelector: (delta) => {
                const dialog = dashboardStore.promptDialog
                if (!dialog) return
                if (dialog.focus === "model-provider") {
                  dashboardStore.setPromptModelProviderIndex(
                    nextIndex(dialog.modelProviderIndex, delta, dialog.modelProviders.length),
                  )
                  return
                }

                const modelCount = dialog.modelProviders[dialog.modelProviderIndex]?.models.length ?? 0
                if (dialog.focus === "model" && modelCount > 0) {
                  dashboardStore.setPromptModelIndex(nextIndex(dialog.modelIndex, delta, modelCount))
                  return
                }

                const variantCount = variantOptions(
                  dialog.modelProviders[dialog.modelProviderIndex]?.models[dialog.modelIndex],
                ).length
                if (dialog.focus === "variant" && variantCount > 0) {
                  dashboardStore.setPromptVariantIndex(nextIndex(dialog.variantIndex, delta, variantCount))
                }
              },
              commitModelSelector: () => {
                const dialog = dashboardStore.promptDialog
                if (!dialog) return
                dashboardStore.setPromptFocus(
                  dialog.focus === "model-provider" ? "model" : dialog.focus === "model" ? "variant" : "input",
                )
              },
            }
          : null,
        deleteSessionDialog: dashboardStore.deleteDialog
          ? { close: dashboardStore.closeDeleteDialog, confirm: () => void confirmDeleteSession() }
          : null,
        interruptSessionDialog: dashboardStore.interruptDialog
          ? { close: dashboardStore.closeInterruptDialog, confirm: () => void confirmInterruptSession() }
          : null,
        search:
          globalStore.page === "dashboard" && dashboardStore.searchFocused
            ? { blur: () => dashboardStore.setSearchFocused(false) }
            : null,
        listNav:
          globalStore.page !== "dashboard" ||
          globalStore.openMenu ||
          globalStore.shortcutsDialogOpen ||
          dashboardStore.addSessionDialog ||
          dashboardStore.deleteWorktreeDialog ||
          dashboardStore.permissionDialog ||
          dashboardStore.promptDialog ||
          dashboardStore.deleteDialog ||
          dashboardStore.interruptDialog ||
          dashboardStore.searchFocused
            ? null
            : {
                tabCount: tabs.length,
                hasSelection: Boolean(currentRow),
                hasDeletableSelection: rowsToDelete.length > 0,
                hasInterruptibleSelection: rowsToInterrupt.length > 0,
                currentSessionId: currentRow?.id,
                halfPage: halfPage(tableHeight),
                refresh: () => void refreshDashboard(),
                openAddSession: openAddSessionDialog,
                openDeleteSession: openDeleteSessionDialog,
                openInterruptSession: openInterruptSessionDialog,
                executeSelection,
                openTmux: () => {
                  if (currentRow) void openTmuxSession(currentRow)
                },
                focusSearch: () => dashboardStore.setSearchFocused(true),
                openHelp: openShortcutsDialog,
                openSettings: openSettingsPage,
                openMenu,
                selectTab: (index) => {
                  const tab = tabs[index]
                  if (tab) dashboardStore.setActiveTabId(tab.id)
                },
                cycleTab: (delta) => {
                  const tab = tabs[nextIndex(activeTabIndex, delta, tabs.length)]
                  dashboardStore.setActiveTabId(tab?.id)
                },
                worktreeCount: activeWorktrees.length + 1,
                cycleWorktree: cycleActiveWorktree,
                toggleVisualSelection: dashboardStore.toggleVisualSelection,
                toggleSelectedSession: dashboardStore.toggleSelectedSessionId,
                clearMultiSelection: dashboardStore.clearMultiSelection,
                moveSelection: (delta) => moveDashboardSelection(delta),
                moveSelectionClamped: (delta) => moveDashboardSelection(delta, true),
                moveTop: () =>
                  dashboardStore.setSelection(
                    selectionEdge(dashboardStore.selection, "top", rowsBySection, dashboardStore.collapsedSections),
                  ),
                moveBottom: () =>
                  dashboardStore.setSelection(
                    selectionEdge(dashboardStore.selection, "bottom", rowsBySection, dashboardStore.collapsedSections),
                  ),
                quit: () => renderer.destroy(),
                toggleConsole: () => renderer.console.toggle(),
              },
      },
      settings: {
        settingsPage:
          globalStore.page === "settings" &&
          globalStore.settingsPage &&
          !globalStore.openMenu &&
          !globalStore.shortcutsDialogOpen &&
          !dashboardStore.addSessionDialog &&
          !dashboardStore.deleteWorktreeDialog &&
          !dashboardStore.permissionDialog &&
          !dashboardStore.promptDialog &&
          !dashboardStore.deleteDialog &&
          !dashboardStore.interruptDialog &&
          !dashboardStore.searchFocused
            ? {
                serverCount: globalStore.settingsPage.servers.length,
                close: globalStore.closeSettingsPage,
                moveServer: (delta) => {
                  const settingsPage = globalStore.settingsPage
                  if (!settingsPage || settingsPage.servers.length <= 1) return
                  void settingsController.selectSettingsServer(
                    nextIndex(settingsPage.selectedServerIndex, delta, settingsPage.servers.length),
                  )
                },
              }
            : null,
      },
    },
    subscribe,
  )

  useScrollFollowSelected(listRef, selectedLine, SELECTION_SCROLL_EDGE_OFFSET)

  useEffect(() => {
    const interval = setInterval(() => void refetchProjects(), PROJECT_POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [refetchProjects])

  useEffect(() => {
    if (!activeTabKey || !selectedWorktreeDirectory || activeWorktreeIndex !== -1) return
    dashboardStore.setActiveWorktreeDirectory(activeTabKey)
  }, [activeTabKey, activeWorktreeIndex, dashboardStore, selectedWorktreeDirectory])

  useEffect(() => {
    if (!projectErrorToastKey) {
      projectErrorToastRef.current = undefined
      return
    }

    if (projectErrorToastRef.current === projectErrorToastKey) return
    projectErrorToastRef.current = projectErrorToastKey
    console.error("Failed to load projects", projectsQuery.error)
    globalStoreRef.current.addToast({
      status: "error",
      title: "Failed to load projects",
      detail: projectQueryError,
    })
  }, [projectErrorToastKey, projectQueryError, projectsQuery.error])

  useEffect(() => {
    let disposed = false
    void AppRuntime.runPromise(loadOrchConfig())
      .then((loadedConfig) => {
        if (disposed) return
        const globalStoreSnapshot = globalStoreRef.current
        if (globalStoreSnapshot.config.activeServerUrl !== loadedConfig.activeServerUrl) {
          dashboardStoreRef.current.clearRowsByProject()
        }
        globalStoreSnapshot.setConfig(loadedConfig)
      })
      .catch((configError) => {
        if (disposed) return
        console.error("Failed to load config", configError)
        globalStoreRef.current.addToast({
          status: "error",
          title: "Failed to load config",
          detail: errorMessage(configError),
        })
      })
    return () => {
      disposed = true
    }
  }, [])

  useEffect(() => {
    const dismissible = globalStore.toasts.filter((toast) => toast.status !== "loading")
    if (dismissible.length === 0) return

    const timers = dismissible.map((toast) => setTimeout(() => globalStoreRef.current.dismissToast(toast.id), 5_000))
    return () => {
      for (const timer of timers) clearTimeout(timer)
    }
  }, [globalStore.toasts])

  function openDeleteSessionDialog(): boolean {
    if (rowsToDelete.length === 0) return false
    dashboardStore.openDeleteDialog(rowsToDelete)
    return true
  }

  function openInterruptSessionDialog(): boolean {
    if (rowsToInterrupt.length === 0) return false
    dashboardStore.openInterruptDialog(rowsToInterrupt)
    return true
  }

  function executeSelection() {
    if (resolvedSelection.type === "section") {
      dashboardStore.toggleCollapsedSection(resolvedSelection.section)
      return
    }

    if (currentRow) openPromptOrPermissionDialog(currentRow)
  }

  function moveDashboardSelection(delta: number, clamped = false) {
    const next = clamped
      ? moveSelectionClamped(resolvedSelection, delta, rowsBySection, dashboardStore.collapsedSections)
      : moveSelection(resolvedSelection, delta, rowsBySection, dashboardStore.collapsedSections)
    dashboardStore.setSelectionFromNavigation(next)
  }

  function openAddSessionDialog() {
    if (!activeTab) return
    let worktrees = worktreeOptions(activeTab)
    if (currentRow && currentRow.workspaceID !== undefined) {
      const workspaceID = currentRow.workspaceID
      const selectedIndex = worktrees.findIndex((worktree) => worktree.directory === currentRow.directory)
      const selectedWorktree = {
        directory: currentRow.directory,
        workspaceID,
        name: currentRow.worktreeName,
        ...(selectedIndex !== -1 && worktrees[selectedIndex]?.primary ? { primary: true } : {}),
      }
      worktrees =
        selectedIndex === -1
          ? [selectedWorktree, ...worktrees]
          : worktrees.map((worktree, index) => (index === selectedIndex ? selectedWorktree : worktree))
    }
    if (worktrees.length === 0) return
    const initialWorktreeDirectory = currentRow?.directory ?? activeWorktree?.directory
    const initialWorkspaceID = currentRow?.workspaceID ?? activeWorktree?.workspaceID
    const initialWorktreeIndex = initialWorktreeDirectory
      ? Math.max(
          0,
          worktrees.findIndex(
            (worktree) =>
              worktree.directory === initialWorktreeDirectory && worktree.workspaceID === initialWorkspaceID,
          ),
        )
      : 0
    dashboardStore.openAddSessionDialog({
      projectTitle: activeTab.title,
      projectDirectory: activeTab.directory,
      ...(currentRow?.workspaceID !== undefined ? { workspaceID: currentRow.workspaceID } : {}),
      ...(currentRow?.model !== undefined ? { initialModel: currentRow.model } : {}),
      worktrees,
      worktreeIndex: initialWorktreeIndex,
      modelProviders: [],
      modelProviderIndex: 0,
      modelIndex: 0,
      variantIndex: 0,
      focus: "input",
      value: "",
      sending: false,
    })
  }

  function openShortcutsDialog() {
    globalStore.setSelectedShortcutIndex(0)
    globalStore.setOpenMenu(undefined)
    globalStore.setShortcutsDialogOpen(true)
  }

  function openSettingsPage() {
    dashboardStore.setSearchFocused(false)
    globalStore.openSettingsPage()
  }

  async function refreshDashboard() {
    await Promise.all([refetchProjects(), Promise.resolve(dashboardStore.sessionListState.refetch?.())])
  }

  function openMenu(menu: MenuId) {
    globalStore.setOpenMenu(menu)
    globalStore.setSelectedMenuIndex(0)
  }

  function cycleActiveWorktree(delta: -1 | 1): boolean {
    const filterCount = activeWorktrees.length + 1
    if (!activeTab || filterCount <= 1) return false

    const nextFilterIndex = nextIndex(activeWorktreeIndex + 1, delta, filterCount)
    if (dashboardStore.activeTabId !== activeTab.id) dashboardStore.setActiveTabId(activeTab.id)
    dashboardStore.setActiveWorktreeDirectory(activeTab.id, activeWorktrees[nextFilterIndex - 1]?.directory)
    return true
  }

  function executeSelectedMenuItem() {
    const item = activeMenuItems[globalStore.selectedMenuIndex]
    if (!item || item.disabled) return
    globalStore.setOpenMenu(undefined)
    item.run()
  }

  function clearActiveTextInput(): boolean {
    if (dashboardStore.searchFocused && dashboardStore.searchValue.length > 0) {
      dashboardStore.setSearchValue("")
      dashboardStore.bumpSearchClearVersion()
      return true
    }

    if (dashboardStore.addSessionDialog && dashboardStore.addSessionDialog.value.length > 0) {
      dashboardStore.setAddSessionValue("")
      dashboardStore.bumpAddSessionClearVersion()
      return true
    }

    if (dashboardStore.promptDialog && dashboardStore.promptDialog.value.length > 0) {
      dashboardStore.setPromptValue("")
      dashboardStore.bumpPromptClearVersion()
      return true
    }

    if (globalStore.settingsPage && globalStore.settingsPage.serverUrlValue.length > 0) {
      globalStore.setSettingsInput("")
      globalStore.bumpSettingsClearVersion()
      return true
    }

    return false
  }

  function handleSessionRowClick(row: SessionRow) {
    const time = Date.now()
    const lastClick = lastSessionClickRef.current

    if (lastClick?.rowId === row.id && time - lastClick.time <= DOUBLE_CLICK_MS) {
      lastSessionClickRef.current = null
      openPromptOrPermissionDialog(row)
      return
    }

    lastSessionClickRef.current = { rowId: row.id, time }
  }

  function handleSectionHeaderClick(section: LaneStatus) {
    const time = Date.now()
    const lastClick = lastSectionClickRef.current

    if (lastClick?.section === section && time - lastClick.time <= DOUBLE_CLICK_MS) {
      lastSectionClickRef.current = null
      dashboardStore.toggleCollapsedSection(section)
      return
    }

    lastSectionClickRef.current = { section, time }
  }

  function executeSelectedShortcut() {
    const shortcut = SHORTCUTS[globalStore.selectedShortcutIndex]
    if (!shortcut || !executeShortcutAction(shortcut.action)) return
    globalStore.setShortcutsDialogOpen(false)
  }

  function executeShortcutAction(action: ShortcutAction): boolean {
    switch (action) {
      case "prompt-selected-session":
        if (!currentRow) return false
        openPromptOrPermissionDialog(currentRow)
        return true
      case "create-session":
        if (!activeTab || worktreeOptions(activeTab).length === 0) {
          return false
        }
        openAddSessionDialog()
        return true
      case "delete-selected-session":
        return openDeleteSessionDialog()
      case "interrupt-selected-session":
        return openInterruptSessionDialog()
      case "start-visual-selection":
        dashboardStore.toggleVisualSelection(currentRow?.id)
        return true
      case "toggle-session-selection":
        if (!currentRow) return false
        dashboardStore.toggleSelectedSessionId(currentRow.id)
        return true
      case "clear-session-selection":
        return dashboardStore.clearMultiSelection()
      case "open-selected-in-tmux":
        if (!currentRow) return false
        void openTmuxSession(currentRow)
        return true
      case "move-selection-down":
        dashboardStore.setSelection(
          moveSelection(resolvedSelection, 1, rowsBySection, dashboardStore.collapsedSections),
        )
        return true
      case "move-selection-up":
        dashboardStore.setSelection(
          moveSelection(resolvedSelection, -1, rowsBySection, dashboardStore.collapsedSections),
        )
        return true
      case "half-page-down":
        dashboardStore.setSelection(
          moveSelectionClamped(
            resolvedSelection,
            halfPage(tableHeight),
            rowsBySection,
            dashboardStore.collapsedSections,
          ),
        )
        return true
      case "half-page-up":
        dashboardStore.setSelection(
          moveSelectionClamped(
            resolvedSelection,
            -halfPage(tableHeight),
            rowsBySection,
            dashboardStore.collapsedSections,
          ),
        )
        return true
      case "jump-to-top":
        dashboardStore.setSelection(
          selectionEdge(resolvedSelection, "top", rowsBySection, dashboardStore.collapsedSections),
        )
        return true
      case "jump-to-bottom":
        dashboardStore.setSelection(
          selectionEdge(resolvedSelection, "bottom", rowsBySection, dashboardStore.collapsedSections),
        )
        return true
      case "next-project": {
        const tab = tabs[nextIndex(activeTabIndex, 1, tabs.length)]
        dashboardStore.setActiveTabId(tab?.id)
        return tabs.length > 0
      }
      case "previous-project": {
        const tab = tabs[nextIndex(activeTabIndex, -1, tabs.length)]
        dashboardStore.setActiveTabId(tab?.id)
        return tabs.length > 0
      }
      case "next-worktree":
        return cycleActiveWorktree(1)
      case "previous-worktree":
        return cycleActiveWorktree(-1)
      case "open-actions-menu":
        globalStore.toggleMenu("actions")
        return true
      case "open-selected-menu":
        globalStore.toggleMenu("selected")
        return true
      case "open-server-selector":
        globalStore.toggleMenu("servers")
        return true
      case "open-settings":
        openSettingsPage()
        return true
      case "focus-search":
        if (globalStore.page !== "dashboard") return false
        dashboardStore.setSearchFocused(true)
        return true
      case "open-help":
        return true
      case "refresh-sessions":
        void refreshDashboard()
        return true
      case "toggle-console":
        renderer.console.toggle()
        return true
      case "quit":
        renderer.destroy()
        return true
    }
  }

  function openPromptDialog(row: SessionRow) {
    dashboardStore.openPromptDialog({
      row,
      modelProviders: [],
      modelProviderIndex: 0,
      modelIndex: 0,
      variantIndex: 0,
      focus: "input",
      value: "",
      sending: false,
    })
  }

  function openPromptOrPermissionDialog(row: SessionRow) {
    const request = row.pendingPermissionRequests[0]
    if (request) {
      dashboardStore.openPermissionDialog({ row, request })
      return
    }

    openPromptDialog(row)
  }

  async function replyToPermission(reply: "once" | "always" | "reject") {
    const dialog = dashboardStoreRef.current.permissionDialog
    if (!dialog || dialog.responding) return

    dashboardStoreRef.current.setPermissionResponding()
    try {
      await AppRuntime.runPromise(
        replyPermissionRequest({
          requestID: dialog.request.id,
          reply,
          directory: dialog.row.directory,
          workspaceID: dialog.row.workspaceID,
          serverUrl: globalStoreRef.current.config.activeServerUrl,
        }),
      )
      dashboardStoreRef.current.closePermissionDialog()
      openPromptDialog({
        ...dialog.row,
        messages: dialog.row.messages.filter((message) => !message.permissionRequested),
        pendingPermissionRequests: [],
      })
      await refreshDashboard()
    } catch (permissionError) {
      console.error("Failed to respond to permission request", permissionError)
      const detail = errorMessage(permissionError)
      dashboardStoreRef.current.setPermissionError(detail)
      globalStoreRef.current.addToast({ status: "error", title: "Failed to respond to permission", detail })
    }
  }

  async function openTmuxSession(row: SessionRow) {
    try {
      try {
        await AppRuntime.runPromise(
          selectTuiSession({
            sessionID: row.id,
            directory: row.directory,
            ...(row.workspaceID !== undefined ? { workspaceID: row.workspaceID } : {}),
            serverUrl: globalStore.config.activeServerUrl,
          }),
        )
      } catch (tuiError) {
        globalStore.addToast({
          status: "error",
          title: "Failed to switch opencode session",
          detail: errorMessage(tuiError),
        })
        console.error("Failed to switch opencode session", tuiError)
      }

      await openTmuxSessionForRow(row)
    } catch (tmuxError) {
      console.error("Failed to open tmux", tmuxError)
      globalStore.addToast({ status: "error", title: "Failed to open tmux", detail: errorMessage(tmuxError) })
    }
  }

  async function submitAddSession(value: string) {
    const trimmed = value.trim()
    const dialog = dashboardStore.addSessionDialog
    if (!trimmed || !dialog || dialog.sending) return

    let worktree = dialog.worktrees[dialog.worktreeIndex]
    const workspaceID = worktree ? worktree.workspaceID : dialog.workspaceID
    const modelProvider = dialog.modelProviders[dialog.modelProviderIndex]
    const model = modelProvider?.models[dialog.modelIndex]
    const variant = variantOptions(model)[dialog.variantIndex]
    const selectedModel = model
      ? { providerID: model.providerID, modelID: model.modelID, ...(variant !== undefined ? { variant } : {}) }
      : undefined

    dashboardStore.setAddSessionSending()
    try {
      if (!worktree) {
        const created = await AppRuntime.runPromise(
          createWorktree({
            directory: dialog.projectDirectory,
            ...(workspaceID !== undefined ? { workspaceID } : {}),
            serverUrl: globalStore.config.activeServerUrl,
          }),
        )
        worktree = {
          directory: created.directory,
          name: created.name,
          ...(workspaceID !== undefined ? { workspaceID } : {}),
        }
        dashboardStore.addAddSessionWorktree(worktree)
      }

      if (!worktree) {
        dashboardStore.setAddSessionError("Select a worktree.")
        return
      }

      await AppRuntime.runPromise(
        createSessionWithPrompt({
          directory: worktree.directory,
          workspaceID: worktree.workspaceID,
          ...(selectedModel !== undefined ? { model: selectedModel } : {}),
          text: trimmed,
          serverUrl: globalStore.config.activeServerUrl,
        }),
      )
      dashboardStore.closeAddSessionDialog()
      await refreshDashboard()
    } catch (createError) {
      console.error("Failed to create session", createError)
      const detail = errorMessage(createError)
      dashboardStore.setAddSessionError(detail)
      globalStore.addToast({ status: "error", title: "Failed to create session", detail })
    }
  }

  function canRemoveSelectedAddSessionWorktree(): boolean {
    const dialog = dashboardStore.addSessionDialog
    if (!dialog || dialog.sending) return false
    const worktree = dialog.worktrees[dialog.worktreeIndex]
    return Boolean(worktree && !worktree.primary)
  }

  function openDeleteSelectedAddSessionWorktreeDialog() {
    const dialog = dashboardStore.addSessionDialog
    if (!dialog || dialog.sending) return
    const worktree = dialog.worktrees[dialog.worktreeIndex]
    if (!worktree || worktree.primary) return

    dashboardStore.openDeleteWorktreeDialog({ projectDirectory: dialog.projectDirectory, worktree })
  }

  function confirmDeleteWorktree() {
    const dialog = dashboardStore.deleteWorktreeDialog
    if (!dialog) return

    const toastId = globalStore.addToast({
      status: "loading",
      title: "Deleting worktree",
      detail: dialog.worktree.name,
    })

    dashboardStore.closeDeleteWorktreeDialog()

    void (async () => {
      try {
        await AppRuntime.runPromise(
          removeWorktree({
            projectDirectory: dialog.projectDirectory,
            worktreeDirectory: dialog.worktree.directory,
            ...(dialog.worktree.workspaceID !== undefined ? { workspaceID: dialog.worktree.workspaceID } : {}),
            serverUrl: globalStore.config.activeServerUrl,
          }),
        )
        dashboardStore.removeAddSessionWorktree(dialog.worktree.directory)
        globalStore.updateToast(toastId, { status: "success", title: "Deleted worktree", detail: dialog.worktree.name })
        await refreshDashboard()
      } catch (removeError) {
        console.error("Failed to delete worktree", removeError)
        const detail = errorMessage(removeError)
        dashboardStore.setAddSessionError(detail)
        globalStore.updateToast(toastId, { status: "error", title: "Failed to delete worktree", detail })
      }
    })()
  }

  async function submitPrompt(value: string) {
    const trimmed = value.trim()
    if (!trimmed || !dashboardStore.promptDialog || dashboardStore.promptDialog.sending) return

    const row = dashboardStore.promptDialog.row
    const modelProvider = dashboardStore.promptDialog.modelProviders[dashboardStore.promptDialog.modelProviderIndex]
    const model = modelProvider?.models[dashboardStore.promptDialog.modelIndex]
    const variant = variantOptions(model)[dashboardStore.promptDialog.variantIndex]
    const selectedModel = model
      ? { providerID: model.providerID, modelID: model.modelID, ...(variant !== undefined ? { variant } : {}) }
      : undefined

    dashboardStore.setPromptSending()
    try {
      await AppRuntime.runPromise(
        sendPrompt({
          sessionID: row.id,
          directory: row.directory,
          workspaceID: row.workspaceID,
          ...(selectedModel !== undefined ? { model: selectedModel } : {}),
          text: trimmed,
          serverUrl: globalStore.config.activeServerUrl,
        }),
      )
      dashboardStore.setPromptSent()
      await refreshDashboard()
    } catch (promptError) {
      console.error("Failed to send prompt", promptError)
      const detail = errorMessage(promptError)
      dashboardStore.setPromptError(detail)
      globalStore.addToast({ status: "error", title: "Failed to send prompt", detail })
    }
  }

  function confirmDeleteSession() {
    if (!dashboardStore.deleteDialog || dashboardStore.deleteDialog.deleting) return

    const rows = dashboardStore.deleteDialog.rows
    const count = rows.length
    const toastId = globalStore.addToast({
      status: "loading",
      title: `Deleting ${formatSessionCount(count)}`,
      detail: "Running in background",
    })

    dashboardStore.clearMultiSelection()
    dashboardStore.closeDeleteDialog()

    void (async () => {
      const results = await Promise.allSettled(
        rows.map((row) =>
          AppRuntime.runPromise(
            deleteSession({
              sessionID: row.id,
              directory: row.directory,
              workspaceID: row.workspaceID,
              serverUrl: globalStore.config.activeServerUrl,
            }),
          ),
        ),
      )
      const failed = results.filter((result) => result.status === "rejected")

      if (failed.length === 0) {
        globalStore.updateToast(toastId, { status: "success", title: `Deleted ${formatSessionCount(count)}` })
      } else {
        for (const result of failed) console.error("Failed to delete session", result.reason)
        globalStore.updateToast(toastId, {
          status: "error",
          title: `Deleted ${count - failed.length} of ${count} sessions`,
          detail: String(failed[0]?.reason ?? "Unknown delete error"),
        })
      }

      await refreshDashboard()
    })()
  }

  function confirmInterruptSession() {
    if (!dashboardStore.interruptDialog || dashboardStore.interruptDialog.interrupting) return

    const rows = dashboardStore.interruptDialog.rows
    const count = rows.length
    const toastId = globalStore.addToast({
      status: "loading",
      title: `Interrupting ${formatSessionCount(count)}`,
      detail: "Running in background",
    })

    dashboardStore.clearMultiSelection()
    dashboardStore.closeInterruptDialog()

    void (async () => {
      const results = await Promise.allSettled(
        rows.map((row) =>
          AppRuntime.runPromise(
            interruptSession({
              sessionID: row.id,
              directory: row.directory,
              workspaceID: row.workspaceID,
              serverUrl: globalStore.config.activeServerUrl,
            }),
          ),
        ),
      )
      const failed = results.filter((result) => result.status === "rejected")

      if (failed.length === 0) {
        globalStore.updateToast(toastId, { status: "success", title: `Interrupted ${formatSessionCount(count)}` })
      } else {
        for (const result of failed) console.error("Failed to interrupt session", result.reason)
        globalStore.updateToast(toastId, {
          status: "error",
          title: `Interrupted ${count - failed.length} of ${count} sessions`,
          detail: String(failed[0]?.reason ?? "Unknown interrupt error"),
        })
      }

      await refreshDashboard()
    })()
  }

  return {
    now,
    listRef,
    projectSnapshot,
    projectPending: projectsQuery.isPending,
    projectError: projectQueryError,
    tabs,
    activeTab,
    activeTabIndex,
    activeWorktrees,
    activeWorktree,
    activeWorktreeIndex,
    activeTabRowsLoaded,
    activeProjectRows,
    rowsBySection,
    activeSection,
    selection: resolvedSelection,
    actionsMenuItems,
    selectedMenuItems,
    serverMenuItems,
    openMenu,
    openSettingsPage,
    submitAddSession,
    replyToPermission,
    submitPrompt,
    confirmDeleteWorktree,
    confirmDeleteSession,
    confirmInterruptSession,
    executeShortcutAction,
    handleSectionHeaderClick,
    handleSessionRowClick,
  }
}

function projectRowsBySection(rows: SessionRow[], now: Date): Record<LaneStatus, SessionRow[]> {
  return {
    working: rows.filter((row) => rowInLane(row, "working", now)),
    "needs-input": rows.filter((row) => rowInLane(row, "needs-input", now)),
    completed: rows.filter((row) => rowInLane(row, "completed", now)),
  }
}

function formatSessionCount(count: number): string {
  return `${count} session${count === 1 ? "" : "s"}`
}

function fuzzySessionMatch(row: SessionRow, query: string): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return true

  const haystack = `${row.title} ${row.worktreeName}`.toLowerCase()
  return terms.every((term) => fuzzyIncludes(haystack, term))
}

function halfPage(height: number): number {
  return Math.max(1, Math.floor(height / 2))
}

function nextAddSessionFocus(focus: "input" | "worktree" | "model-provider" | "model" | "variant", delta: -1 | 1) {
  const order = ["input", "model-provider", "variant", "worktree"] as const
  const currentIndex = focus === "model" ? order.indexOf("model-provider") : order.indexOf(focus)
  return order[(currentIndex + delta + order.length) % order.length] ?? "input"
}

function nextPromptFocus(focus: "input" | "model-provider" | "model" | "variant", delta: -1 | 1) {
  const order = ["input", "model-provider", "variant"] as const
  const currentIndex = focus === "model" ? order.indexOf("model-provider") : order.indexOf(focus)
  return order[(currentIndex + delta + order.length) % order.length] ?? "input"
}

function variantOptions(model: ModelProviderOption["models"][number] | undefined): Array<string | undefined> {
  return [undefined, ...(model?.variants ?? [])]
}

function selectedSessionLine(
  selection: { type: "section" | "row"; section: LaneStatus; index: number },
  rowsBySection: Record<LaneStatus, SessionRow[]>,
  collapsedSections: CollapsedSections,
  prefixLines: number,
): number | null {
  if (selection.type === "row" && !rowsBySection[selection.section][selection.index]) return null

  let line = prefixLines
  for (const section of SECTIONS) {
    if (section.status === selection.section) {
      return selection.type === "section" ? line : line + 2 + selection.index
    }

    line += 2 + (collapsedSections[section.status] ? 0 : Math.max(1, rowsBySection[section.status].length)) + 1
  }

  return null
}

function fuzzyIncludes(value: string, query: string): boolean {
  let queryIndex = 0
  for (const character of value) {
    if (character === query[queryIndex]) queryIndex += 1
    if (queryIndex === query.length) return true
  }
  return query.length === 0
}
