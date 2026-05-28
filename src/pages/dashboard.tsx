import { TextAttributes, type ScrollBoxRenderable } from "@opentui/core"
import { useRenderer, useTerminalDimensions } from "@opentui/react"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useRef, useState } from "react"
import { Header, HeaderTitle } from "../components/header.tsx"
import { AddSessionDialog, DeleteSessionDialog, PromptDialog } from "../components/session-dialogs.tsx"
import { SettingsDialog, type SettingsDialogState } from "../components/settings-dialog.tsx"
import { SHORTCUTS, ShortcutsDialog, type ShortcutAction } from "../components/shortcuts-dialog.tsx"
import { SectionView, TableHeader } from "../components/session-table.tsx"
import { mouseAction } from "../components/ui/button.tsx"
import { ModalFrame, MouseDismissLayer, TextLine, fitCell } from "../components/ui/dialog.tsx"
import { SearchInput } from "../components/ui/input.tsx"
import { ProjectTabs } from "../components/ui/tabs.tsx"
import {
  defaultOrchConfig,
  loadOrchConfig,
  normalizeServerUrl,
  saveOrchConfig,
  serverNameFromUrl,
  type OrchConfig,
} from "../config/orch.ts"
import { useNow } from "../hooks/use-now.ts"
import { useScrollFollowSelected } from "../hooks/use-scroll-follow-selected.ts"
import { dashboardKeymap } from "../keymap/dashboard.ts"
import { useOpenTuiSubscribe } from "../keymap/opentui-adapter.ts"
import { useKeymap } from "../keymap/react.ts"
import { theme } from "../theme.ts"
import {
  groupRowsByProject,
  moveSelection,
  moveSelectionClamped,
  normalizeSelection,
  nextIndex,
  rowInLane,
  SECTIONS,
  selectedRow,
  selectionEdge,
  shortcutHintLine,
  worktreeOptions,
  type AddSessionDialogState,
  type DeleteSessionDialogState,
  type LaneStatus,
  type PromptDialogState,
  type CollapsedSections,
} from "../lib/utils.ts"
import { createSessionWithPrompt, deleteSession, getSessions, sendPrompt, type SessionRow } from "../opencode.ts"
import { openTmuxSessionForRow } from "../tmux.ts"
import { useDashboardStore } from "./dashboard.store.ts"

const POLL_INTERVAL_MS = 2_000
const APP_PADDING_X = 2
const APP_PADDING_Y = 1
const SIDEBAR_BACKGROUND = theme.backgroundPanel
const TOP_BAR_BACKGROUND = "#252525"
const SIDEBAR_PADDING_X = 2
const SIDEBAR_PADDING_Y = 1
const TOP_BAR_HEIGHT = 1
const SELECTION_SCROLL_EDGE_OFFSET = 3
const DOUBLE_CLICK_MS = 500
type MenuId = "actions" | "selected" | "servers"

type MenuItem = {
  label: string
  shortcut: string
  danger?: boolean
  disabled?: boolean
  run: () => void
}

type ToastStatus = "loading" | "success" | "error"

type Toast = {
  id: number
  status: ToastStatus
  title: string
  detail?: string | undefined
}

export function DashboardPage() {
  const renderer = useRenderer()
  const dimensions = useTerminalDimensions()
  const now = useNow(80)
  const listRef = useRef<ScrollBoxRenderable>(null)
  const lastSessionClickRef = useRef<{ rowId: string; time: number } | null>(null)
  const lastSectionClickRef = useRef<{ section: LaneStatus; time: number } | null>(null)
  const [addSessionDialog, setAddSessionDialog] = useState<AddSessionDialogState>()
  const [promptDialog, setPromptDialog] = useState<PromptDialogState>()
  const [deleteDialog, setDeleteDialog] = useState<DeleteSessionDialogState>()
  const [settingsDialog, setSettingsDialog] = useState<SettingsDialogState>()
  const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false)
  const [selectedShortcutIndex, setSelectedShortcutIndex] = useState(0)
  const [hoveredRowId, setHoveredRowId] = useState<string>()
  const [openMenu, setOpenMenu] = useState<MenuId>()
  const [selectedMenuIndex, setSelectedMenuIndex] = useState(0)
  const [searchClearVersion, setSearchClearVersion] = useState(0)
  const [addSessionClearVersion, setAddSessionClearVersion] = useState(0)
  const [promptClearVersion, setPromptClearVersion] = useState(0)
  const [settingsClearVersion, setSettingsClearVersion] = useState(0)
  const [collapsedSections, setCollapsedSections] = useState<CollapsedSections>({})
  const [visualMode, setVisualMode] = useState(false)
  const [selectedSessionIds, setSelectedSessionIds] = useState<ReadonlySet<string>>(() => new Set())
  const [toasts, setToasts] = useState<Toast[]>([])
  const [config, setConfig] = useState<OrchConfig>(() => defaultOrchConfig())
  const nextToastId = useRef(1)

  const activeTabId = useDashboardStore((store) => store.activeTabId)
  const selection = useDashboardStore((store) => store.selection)
  const searchValue = useDashboardStore((store) => store.searchValue)
  const searchFocused = useDashboardStore((store) => store.searchFocused)
  const setActiveTabId = useDashboardStore((store) => store.setActiveTabId)
  const setSelection = useDashboardStore((store) => store.setSelection)
  const setSearchValue = useDashboardStore((store) => store.setSearchValue)
  const setSearchFocused = useDashboardStore((store) => store.setSearchFocused)

  const query = useQuery({
    queryKey: ["opencode-sessions", config.activeServerUrl],
    queryFn: () => getSessions({ serverUrl: config.activeServerUrl }),
  })
  const { refetch } = query

  const snapshot = query.data
  const queryError = query.error instanceof Error ? query.error.message : query.error ? String(query.error) : undefined
  const sidebarWidth = Math.min(
    Math.max(24, Math.floor(dimensions.width * 0.32)),
    Math.max(24, dimensions.width - 42),
    42,
  )
  const mainPanelWidth = Math.max(1, dimensions.width - sidebarWidth)
  const tableWidth = Math.max(1, mainPanelWidth - APP_PADDING_X * 2)
  const sidebarContentWidth = Math.max(1, sidebarWidth - SIDEBAR_PADDING_X * 2)
  const contentHeight = Math.max(1, dimensions.height - TOP_BAR_HEIGHT)
  const tabs = useMemo(() => groupRowsByProject(snapshot?.rows ?? []), [snapshot?.rows])
  const activeTabIndex = activeTabId
    ? Math.max(
        0,
        tabs.findIndex((tab) => tab.id === activeTabId),
      )
    : 0
  const activeTab = tabs[activeTabIndex]
  const filteredRows = useMemo(
    () => (activeTab?.rows ?? []).filter((row) => fuzzySessionMatch(row, searchValue)),
    [activeTab?.rows, searchValue],
  )
  const rowsBySection = useMemo<Record<LaneStatus, SessionRow[]>>(
    () => ({
      working: filteredRows.filter((row) => rowInLane(row, "working", now)),
      "needs-input": filteredRows.filter((row) => rowInLane(row, "needs-input", now)),
      completed: filteredRows.filter((row) => rowInLane(row, "completed", now)),
    }),
    [filteredRows, now],
  )
  const resolvedSelection = useMemo(
    () => normalizeSelection(selection, rowsBySection, collapsedSections),
    [selection, rowsBySection, collapsedSections],
  )
  const activeSection = resolvedSelection.section
  const currentRow = selectedRow(resolvedSelection, rowsBySection, collapsedSections)
  const selectedRows = useMemo(
    () => filteredRows.filter((row) => selectedSessionIds.has(row.id)),
    [filteredRows, selectedSessionIds],
  )
  const rowsToDelete = selectedRows.length > 0 ? selectedRows : currentRow ? [currentRow] : []
  const tableHeaderHeight = 2
  const tableHeight = Math.max(1, contentHeight - APP_PADDING_Y * 2 - tableHeaderHeight)
  const statusLineCount =
    (query.isPending ? 1 : 0) + (queryError ? 1 : 0) + (snapshot && snapshot.rows.length === 0 ? 2 : 0)
  const selectedLine = selectedSessionLine(resolvedSelection, rowsBySection, collapsedSections, statusLineCount)
  const subscribe = useOpenTuiSubscribe()
  const actionsMenuItems: MenuItem[] = [
    {
      label: "New Session",
      shortcut: "a",
      disabled: !activeTab || worktreeOptions(activeTab).length === 0,
      run: openAddSessionDialog,
    },
    { label: "Refresh", shortcut: "r", run: () => void query.refetch() },
    { label: "Settings", shortcut: "click", run: openSettingsDialog },
    { label: "Help", shortcut: "?", run: openShortcutsDialog },
    { label: "Quit", shortcut: "q / esc", run: () => renderer.destroy() },
  ]
  const selectedMenuItems: MenuItem[] = [
    {
      label: "Prompt",
      shortcut: "enter",
      disabled: !currentRow,
      run: () => {
        if (currentRow) openPromptDialog(currentRow)
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
      shortcut: "d",
      danger: true,
      disabled: rowsToDelete.length === 0,
      run: () => {
        openDeleteSessionDialog()
      },
    },
  ]
  const serverMenuItems: MenuItem[] = [
    ...config.servers.map((server) => ({
      label: server.name,
      shortcut: server.url === config.activeServerUrl ? "active" : "switch",
      run: () => void switchServer(server.url),
    })),
    { label: "Add server", shortcut: "edit", run: openSettingsDialog },
  ]
  const activeMenuItems =
    openMenu === "actions"
      ? actionsMenuItems
      : openMenu === "selected"
        ? selectedMenuItems
        : openMenu === "servers"
          ? serverMenuItems
          : []

  useKeymap(
    dashboardKeymap,
    {
      textInputActive: searchFocused || Boolean(addSessionDialog) || Boolean(promptDialog) || Boolean(settingsDialog),
      menu:
        openMenu &&
        !shortcutsDialogOpen &&
        !addSessionDialog &&
        !promptDialog &&
        !deleteDialog &&
        !settingsDialog &&
        !searchFocused
          ? {
              itemCount: activeMenuItems.length,
              close: () => setOpenMenu(undefined),
              openMenu: (menu) => toggleMenu(menu),
              moveSelection: (delta) =>
                setSelectedMenuIndex((current) => nextIndex(current, delta, activeMenuItems.length)),
              executeSelected: executeSelectedMenuItem,
            }
          : null,
      helpDialog: shortcutsDialogOpen
        ? {
            commandCount: SHORTCUTS.length,
            close: () => setShortcutsDialogOpen(false),
            moveSelection: (delta) =>
              setSelectedShortcutIndex((current) => nextIndex(current, delta, SHORTCUTS.length)),
            executeSelected: executeSelectedShortcut,
          }
        : null,
      addSessionDialog: addSessionDialog
        ? {
            worktreeCount: addSessionDialog.worktrees.length,
            close: () => setAddSessionDialog(undefined),
            moveWorktree: (delta) =>
              setAddSessionDialog((current) =>
                current && current.worktrees.length > 1
                  ? { ...current, worktreeIndex: nextIndex(current.worktreeIndex, delta, current.worktrees.length) }
                  : current,
              ),
          }
        : null,
      promptDialog: promptDialog ? { close: () => setPromptDialog(undefined) } : null,
      deleteSessionDialog: deleteDialog
        ? { close: () => setDeleteDialog(undefined), confirm: () => void confirmDeleteSession() }
        : null,
      settingsDialog: settingsDialog
        ? {
            serverCount: settingsDialog.servers.length,
            close: () => setSettingsDialog(undefined),
            moveServer: (delta) =>
              setSettingsDialog((current) =>
                current && current.servers.length > 1
                  ? {
                      ...current,
                      selectedServerIndex: nextIndex(current.selectedServerIndex, delta, current.servers.length),
                    }
                  : current,
              ),
          }
        : null,
      search: searchFocused ? { blur: () => setSearchFocused(false) } : null,
      listNav:
        openMenu ||
        shortcutsDialogOpen ||
        addSessionDialog ||
        promptDialog ||
        deleteDialog ||
        settingsDialog ||
        searchFocused
          ? null
          : {
              tabCount: tabs.length,
              hasSelection: Boolean(currentRow),
              hasDeletableSelection: rowsToDelete.length > 0,
              halfPage: halfPage(tableHeight),
              refresh: () => void query.refetch(),
              openAddSession: openAddSessionDialog,
              openDeleteSession: openDeleteSessionDialog,
              executeSelection,
              openTmux: () => {
                if (currentRow) void openTmuxSession(currentRow)
              },
              focusSearch: () => setSearchFocused(true),
              openHelp: openShortcutsDialog,
              openSettings: openSettingsDialog,
              openMenu: (menu) => toggleMenu(menu),
              selectTab: (index) => {
                const tab = tabs[index]
                if (tab) setActiveTabId(tab.id)
              },
              cycleTab: (delta) => {
                const tab = tabs[nextIndex(activeTabIndex, delta, tabs.length)]
                setActiveTabId(tab?.id)
              },
              toggleVisualSelection,
              toggleCurrentSelection,
              clearMultiSelection,
              moveSelection: (delta) => moveDashboardSelection(delta),
              moveSelectionClamped: (delta) => moveDashboardSelection(delta, true),
              moveTop: () => setSelection((current) => selectionEdge(current, "top", rowsBySection, collapsedSections)),
              moveBottom: () =>
                setSelection((current) => selectionEdge(current, "bottom", rowsBySection, collapsedSections)),
              quit: () => renderer.destroy(),
              toggleConsole: () => renderer.console.toggle(),
            },
      clearTextInput: clearActiveTextInput,
      quit: () => renderer.destroy(),
    },
    subscribe,
  )

  useScrollFollowSelected(listRef, selectedLine, SELECTION_SCROLL_EDGE_OFFSET)

  useEffect(() => {
    const interval = setInterval(() => void refetch(), POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [refetch])

  useEffect(() => {
    let disposed = false
    void loadOrchConfig().then((loadedConfig) => {
      if (!disposed) setConfig(loadedConfig)
    })
    return () => {
      disposed = true
    }
  }, [])

  useEffect(() => {
    if (tabs.length === 0) {
      if (activeTabId !== undefined) setActiveTabId(undefined)
      return
    }
    if (activeTabId && tabs.some((tab) => tab.id === activeTabId)) return
    setActiveTabId(tabs[0]?.id)
  }, [activeTabId, setActiveTabId, tabs])

  useEffect(() => {
    setSelection((current) => {
      const next = normalizeSelection(current, rowsBySection, collapsedSections)
      return current.type === next.type &&
        current.section === next.section &&
        current.index === next.index &&
        current.sessionId === next.sessionId
        ? current
        : next
    })
  }, [activeTab?.id, rowsBySection, collapsedSections, setSelection])

  useEffect(() => {
    const visibleIds = new Set(filteredRows.map((row) => row.id))
    setSelectedSessionIds((current) => {
      const next = new Set([...current].filter((id) => visibleIds.has(id)))
      return next.size === current.size ? current : next
    })
  }, [filteredRows])

  function toggleSection(section: LaneStatus) {
    setCollapsedSections((current) => ({ ...current, [section]: !current[section] }))
  }

  function openDeleteSessionDialog() {
    if (rowsToDelete.length > 0) setDeleteDialog({ rows: rowsToDelete })
  }

  function addToast(toast: Omit<Toast, "id">): number {
    const id = nextToastId.current
    nextToastId.current += 1
    setToasts((current) => [...current, { id, ...toast }].slice(-4))
    return id
  }

  function updateToast(id: number, update: Omit<Toast, "id">) {
    setToasts((current) => current.map((toast) => (toast.id === id ? { id, ...update } : toast)))
  }

  function executeSelection() {
    if (resolvedSelection.type === "section") {
      toggleSection(resolvedSelection.section)
      return
    }

    if (currentRow) openPromptDialog(currentRow)
  }

  function toggleVisualSelection() {
    setVisualMode((current) => {
      const next = !current
      if (next && currentRow) toggleSessionId(currentRow.id)
      return next
    })
  }

  function toggleCurrentSelection() {
    if (!currentRow) return
    toggleSessionId(currentRow.id)
  }

  function clearMultiSelection(): boolean {
    if (!visualMode && selectedSessionIds.size === 0) return false
    setVisualMode(false)
    setSelectedSessionIds(new Set())
    return true
  }

  function moveDashboardSelection(delta: number, clamped = false) {
    setSelection((current) => {
      const next = clamped
        ? moveSelectionClamped(current, delta, rowsBySection, collapsedSections)
        : moveSelection(current, delta, rowsBySection, collapsedSections)
      if (visualMode && next.type === "row" && next.sessionId) toggleSessionId(next.sessionId)
      return next
    })
  }

  function toggleSessionId(sessionId: string) {
    setSelectedSessionIds((current) => {
      const next = new Set(current)
      if (next.has(sessionId)) next.delete(sessionId)
      else next.add(sessionId)
      return next
    })
  }

  function openAddSessionDialog() {
    if (!activeTab) return
    const worktrees = worktreeOptions(activeTab)
    if (worktrees.length === 0) return
    setAddSessionDialog({ projectTitle: activeTab.title, worktrees, worktreeIndex: 0, value: "", sending: false })
  }

  function openShortcutsDialog() {
    setSelectedShortcutIndex(0)
    setOpenMenu(undefined)
    setShortcutsDialogOpen(true)
  }

  function openSettingsDialog() {
    setOpenMenu(undefined)
    setSettingsDialog({
      servers: config.servers,
      activeServerUrl: config.activeServerUrl,
      selectedServerIndex: Math.max(
        0,
        config.servers.findIndex((server) => server.url === config.activeServerUrl),
      ),
      serverUrlValue: "",
      saving: false,
    })
  }

  async function switchServer(serverUrl: string) {
    const normalizedUrl = normalizeServerUrl(serverUrl)
    const nextConfig = await persistConfig({ ...config, activeServerUrl: normalizedUrl })
    setSettingsDialog((current) =>
      current ? { ...current, activeServerUrl: nextConfig.activeServerUrl, servers: nextConfig.servers } : current,
    )
  }

  async function addServerFromSettings(serverUrl: string) {
    const normalizedUrl = normalizeServerUrl(serverUrl)
    if (!normalizedUrl) return

    setSettingsDialog((current) => (current ? { ...current, saving: true, error: undefined } : current))
    try {
      const existing = config.servers.some((server) => server.url === normalizedUrl)
      const nextServers = existing
        ? config.servers
        : [...config.servers, { name: serverNameFromUrl(normalizedUrl), url: normalizedUrl }]
      const nextConfig = await persistConfig({ servers: nextServers, activeServerUrl: normalizedUrl })
      setSettingsDialog({
        servers: nextConfig.servers,
        activeServerUrl: nextConfig.activeServerUrl,
        selectedServerIndex: Math.max(
          0,
          nextConfig.servers.findIndex((server) => server.url === nextConfig.activeServerUrl),
        ),
        serverUrlValue: "",
        saving: false,
      })
      setSettingsClearVersion((current) => current + 1)
    } catch (settingsError) {
      setSettingsDialog((current) =>
        current
          ? {
              ...current,
              saving: false,
              error: settingsError instanceof Error ? settingsError.message : String(settingsError),
            }
          : current,
      )
    }
  }

  async function persistConfig(nextConfig: OrchConfig): Promise<OrchConfig> {
    const savedConfig = await saveOrchConfig(nextConfig)
    setConfig(savedConfig)
    return savedConfig
  }

  function toggleMenu(menu: MenuId) {
    setOpenMenu((current) => {
      const next = current === menu ? undefined : menu
      if (next) setSelectedMenuIndex(0)
      return next
    })
  }

  function executeSelectedMenuItem() {
    const item = activeMenuItems[selectedMenuIndex]
    if (!item || item.disabled) return
    setOpenMenu(undefined)
    item.run()
  }

  function clearActiveTextInput(): boolean {
    if (searchFocused && searchValue.length > 0) {
      setSearchValue("")
      setSearchClearVersion((current) => current + 1)
      return true
    }

    if (addSessionDialog && addSessionDialog.value.length > 0) {
      setAddSessionDialog((current) => (current ? { ...current, value: "", error: undefined } : current))
      setAddSessionClearVersion((current) => current + 1)
      return true
    }

    if (promptDialog && promptDialog.value.length > 0) {
      setPromptDialog((current) => (current ? { ...current, value: "", error: undefined } : current))
      setPromptClearVersion((current) => current + 1)
      return true
    }

    if (settingsDialog && settingsDialog.serverUrlValue.length > 0) {
      setSettingsDialog((current) => (current ? { ...current, serverUrlValue: "", error: undefined } : current))
      setSettingsClearVersion((current) => current + 1)
      return true
    }

    return false
  }

  function handleSessionRowClick(row: SessionRow) {
    const time = Date.now()
    const lastClick = lastSessionClickRef.current

    if (lastClick?.rowId === row.id && time - lastClick.time <= DOUBLE_CLICK_MS) {
      lastSessionClickRef.current = null
      openPromptDialog(row)
      return
    }

    lastSessionClickRef.current = { rowId: row.id, time }
  }

  function handleSectionHeaderClick(section: LaneStatus) {
    const time = Date.now()
    const lastClick = lastSectionClickRef.current

    if (lastClick?.section === section && time - lastClick.time <= DOUBLE_CLICK_MS) {
      lastSectionClickRef.current = null
      toggleSection(section)
      return
    }

    lastSectionClickRef.current = { section, time }
  }

  function executeSelectedShortcut() {
    const shortcut = SHORTCUTS[selectedShortcutIndex]
    if (!shortcut || !executeShortcutAction(shortcut.action)) return
    setShortcutsDialogOpen(false)
  }

  function executeShortcutAction(action: ShortcutAction): boolean {
    switch (action) {
      case "prompt-selected-session":
        if (!currentRow) return false
        openPromptDialog(currentRow)
        return true
      case "create-session":
        if (!activeTab || worktreeOptions(activeTab).length === 0) return false
        openAddSessionDialog()
        return true
      case "delete-selected-session":
        return openDeleteSessionDialogForShortcut()
      case "start-visual-selection":
        toggleVisualSelection()
        return true
      case "toggle-session-selection":
        if (!currentRow) return false
        toggleCurrentSelection()
        return true
      case "clear-session-selection":
        return clearMultiSelection()
      case "open-selected-in-tmux":
        if (!currentRow) return false
        void openTmuxSession(currentRow)
        return true
      case "move-selection-down":
        setSelection((current) => moveSelection(current, 1, rowsBySection, collapsedSections))
        return true
      case "move-selection-up":
        setSelection((current) => moveSelection(current, -1, rowsBySection, collapsedSections))
        return true
      case "half-page-down":
        setSelection((current) =>
          moveSelectionClamped(current, halfPage(tableHeight), rowsBySection, collapsedSections),
        )
        return true
      case "half-page-up":
        setSelection((current) =>
          moveSelectionClamped(current, -halfPage(tableHeight), rowsBySection, collapsedSections),
        )
        return true
      case "jump-to-top":
        setSelection((current) => selectionEdge(current, "top", rowsBySection, collapsedSections))
        return true
      case "jump-to-bottom":
        setSelection((current) => selectionEdge(current, "bottom", rowsBySection, collapsedSections))
        return true
      case "next-project": {
        const tab = tabs[nextIndex(activeTabIndex, 1, tabs.length)]
        setActiveTabId(tab?.id)
        return tabs.length > 0
      }
      case "previous-project": {
        const tab = tabs[nextIndex(activeTabIndex, -1, tabs.length)]
        setActiveTabId(tab?.id)
        return tabs.length > 0
      }
      case "open-actions-menu":
        toggleMenu("actions")
        return true
      case "open-selected-menu":
        toggleMenu("selected")
        return true
      case "open-server-selector":
        toggleMenu("servers")
        return true
      case "open-settings":
        openSettingsDialog()
        return true
      case "focus-search":
        setSearchFocused(true)
        return true
      case "open-help":
        return true
      case "refresh-sessions":
        void query.refetch()
        return true
      case "toggle-console":
        renderer.console.toggle()
        return true
      case "quit":
        renderer.destroy()
        return true
    }
  }

  function openDeleteSessionDialogForShortcut(): boolean {
    if (rowsToDelete.length === 0) return false
    setDeleteDialog({ rows: rowsToDelete })
    return true
  }

  function openPromptDialog(row: SessionRow) {
    setPromptDialog({
      row,
      value: "",
      sending: false,
      latestUserMessage: row.latestUserMessage,
      loadingPreview: false,
    })
  }

  async function openTmuxSession(row: SessionRow) {
    try {
      await openTmuxSessionForRow(row)
    } catch (tmuxError) {
      console.error(tmuxError instanceof Error ? tmuxError.message : String(tmuxError))
    }
  }

  async function submitAddSession(value: string) {
    const trimmed = value.trim()
    if (!trimmed || !addSessionDialog || addSessionDialog.sending) return

    const worktree = addSessionDialog.worktrees[addSessionDialog.worktreeIndex]
    if (!worktree) return

    setAddSessionDialog((current) => (current ? { ...current, sending: true, error: undefined } : current))
    try {
      await createSessionWithPrompt({
        directory: worktree.directory,
        workspaceID: worktree.workspaceID,
        text: trimmed,
        serverUrl: config.activeServerUrl,
      })
      setAddSessionDialog(undefined)
      await query.refetch()
    } catch (createError) {
      setAddSessionDialog((current) =>
        current
          ? {
              ...current,
              sending: false,
              error: createError instanceof Error ? createError.message : String(createError),
            }
          : current,
      )
    }
  }

  async function submitPrompt(value: string) {
    const trimmed = value.trim()
    if (!trimmed || !promptDialog || promptDialog.sending) return

    const row = promptDialog.row
    setPromptDialog((current) => (current ? { ...current, sending: true, error: undefined } : current))
    try {
      await sendPrompt({
        sessionID: row.id,
        directory: row.directory,
        workspaceID: row.workspaceID,
        text: trimmed,
        serverUrl: config.activeServerUrl,
      })
      setPromptDialog(undefined)
      await query.refetch()
    } catch (promptError) {
      setPromptDialog((current) =>
        current
          ? {
              ...current,
              sending: false,
              error: promptError instanceof Error ? promptError.message : String(promptError),
            }
          : current,
      )
    }
  }

  function confirmDeleteSession() {
    if (!deleteDialog || deleteDialog.deleting) return

    const rows = deleteDialog.rows
    const count = rows.length
    const toastId = addToast({
      status: "loading",
      title: `Deleting ${formatSessionCount(count)}`,
      detail: "Running in background",
    })

    clearMultiSelection()
    setDeleteDialog(undefined)

    void (async () => {
      const results = await Promise.allSettled(
        rows.map((row) =>
          deleteSession({
            sessionID: row.id,
            directory: row.directory,
            workspaceID: row.workspaceID,
            serverUrl: config.activeServerUrl,
          }),
        ),
      )
      const failed = results.filter((result) => result.status === "rejected")

      if (failed.length === 0) {
        updateToast(toastId, { status: "success", title: `Deleted ${formatSessionCount(count)}` })
      } else {
        updateToast(toastId, {
          status: "error",
          title: `Deleted ${count - failed.length} of ${count} sessions`,
          detail: String(failed[0]?.reason ?? "Unknown delete error"),
        })
      }

      await query.refetch()
    })()
  }

  function dismissToast(id: number) {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }

  useEffect(() => {
    const dismissible = toasts.filter((toast) => toast.status !== "loading")
    if (dismissible.length === 0) return

    const timers = dismissible.map((toast) => setTimeout(() => dismissToast(toast.id), 5_000))
    return () => {
      for (const timer of timers) clearTimeout(timer)
    }
  }, [toasts])

  return (
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
        <TopMenuBar openMenu={openMenu} width={mainPanelWidth} visualMode={visualMode} onOpenMenu={toggleMenu} />
        <box
          style={{
            flexDirection: "column",
            flexShrink: 0,
            width: mainPanelWidth,
            height: contentHeight,
            backgroundColor: theme.background,
            paddingTop: APP_PADDING_Y,
            paddingBottom: APP_PADDING_Y,
          }}
        >
          <box
            style={{
              flexShrink: 0,
              height: tableHeaderHeight,
              paddingLeft: APP_PADDING_X,
              paddingRight: APP_PADDING_X,
              width: mainPanelWidth,
            }}
          >
            <TableHeader width={tableWidth} />
          </box>
          <scrollbox
            ref={listRef}
            focusable={false}
            style={{
              contentOptions: { flexDirection: "column" },
              flexShrink: 0,
              height: tableHeight,
              width: mainPanelWidth,
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
            {query.isPending ? <text content="loading sessions…" style={{ fg: theme.info }} /> : null}
            {queryError ? <text content={`error: ${queryError}`} style={{ fg: theme.error }} /> : null}
            {snapshot && snapshot.rows.length === 0 ? (
              <box style={{ flexDirection: "column" }}>
                <text content="No sessions found on the opencode persistence server." style={{ fg: theme.warning }} />
                <text content={snapshot.serverUrl} style={{ fg: theme.textMuted }} />
              </box>
            ) : null}
            {SECTIONS.map((section) => (
              <SectionView
                key={section.status}
                section={section}
                rows={rowsBySection[section.status]}
                worktreeColors={activeTab?.worktreeColors ?? {}}
                selection={resolvedSelection}
                active={activeSection === section.status}
                collapsed={Boolean(collapsedSections[section.status])}
                width={tableWidth}
                hoveredRowId={hoveredRowId}
                selectedSessionIds={selectedSessionIds}
                multiSelectActive={visualMode || selectedSessionIds.size > 0}
                onRowHover={setHoveredRowId}
                onHeaderSelect={() => setSelection({ type: "section", section: section.status, index: 0 })}
                onHeaderClick={() => handleSectionHeaderClick(section.status)}
                onRowSelect={(nextSelection) => setSelection(nextSelection)}
                onRowClick={handleSessionRowClick}
              />
            ))}
          </scrollbox>
        </box>
      </box>
      <box
        style={{
          flexDirection: "column",
          flexShrink: 0,
          width: sidebarWidth,
          height: dimensions.height,
          backgroundColor: SIDEBAR_BACKGROUND,
          paddingLeft: SIDEBAR_PADDING_X,
          paddingRight: SIDEBAR_PADDING_X,
          paddingTop: SIDEBAR_PADDING_Y,
          paddingBottom: SIDEBAR_PADDING_Y,
        }}
      >
        <box style={{ flexShrink: 0, width: sidebarContentWidth }}>
          <HeaderTitle />
        </box>
        <SearchInput
          value={searchValue}
          focused={searchFocused}
          width={sidebarContentWidth}
          clearVersion={searchClearVersion}
          onInput={setSearchValue}
          onFocus={() => setSearchFocused(true)}
        />
        <box style={{ flexShrink: 0, marginTop: 1, width: sidebarContentWidth }}>
          <Header
            snapshot={snapshot}
            width={sidebarContentWidth}
            active={openMenu === "servers"}
            onServerPress={() => toggleMenu("servers")}
          />
        </box>
        <box style={{ flexShrink: 0, marginTop: 2, width: sidebarContentWidth }}>
          <ProjectTabs
            tabs={tabs}
            activeIndex={activeTabIndex}
            width={sidebarContentWidth}
            onSelect={(tab) => setActiveTabId(tab.id)}
          />
        </box>
        <box style={{ flexGrow: 1 }} />
        <SidebarSettingsButton width={sidebarContentWidth} onPress={openSettingsDialog} />
      </box>
      {openMenu === "actions" ? (
        <>
          <MouseDismissLayer
            screenWidth={dimensions.width}
            screenHeight={dimensions.height}
            top={TOP_BAR_HEIGHT}
            onDismiss={() => setOpenMenu(undefined)}
          />
          <MenuDropdown
            left={0}
            top={TOP_BAR_HEIGHT}
            items={actionsMenuItems}
            selectedIndex={selectedMenuIndex}
            onSelect={setSelectedMenuIndex}
            onClose={() => setOpenMenu(undefined)}
          />
        </>
      ) : null}
      {openMenu === "selected" ? (
        <>
          <MouseDismissLayer
            screenWidth={dimensions.width}
            screenHeight={dimensions.height}
            top={TOP_BAR_HEIGHT}
            onDismiss={() => setOpenMenu(undefined)}
          />
          <MenuDropdown
            left={10}
            top={TOP_BAR_HEIGHT}
            items={selectedMenuItems}
            selectedIndex={selectedMenuIndex}
            onSelect={setSelectedMenuIndex}
            onClose={() => setOpenMenu(undefined)}
          />
        </>
      ) : null}
      {openMenu === "servers" ? (
        <>
          <MouseDismissLayer
            screenWidth={dimensions.width}
            screenHeight={dimensions.height}
            top={TOP_BAR_HEIGHT}
            onDismiss={() => setOpenMenu(undefined)}
          />
          <MenuDropdown
            left={mainPanelWidth + SIDEBAR_PADDING_X}
            top={SIDEBAR_PADDING_Y + 4}
            items={serverMenuItems}
            selectedIndex={selectedMenuIndex}
            onSelect={setSelectedMenuIndex}
            onClose={() => setOpenMenu(undefined)}
          />
        </>
      ) : null}
      {addSessionDialog ? (
        <AddSessionDialog
          state={addSessionDialog}
          width={dimensions.width}
          height={dimensions.height}
          clearVersion={addSessionClearVersion}
          onInput={(value) =>
            setAddSessionDialog((current) => (current ? { ...current, value, error: undefined } : current))
          }
          onCancel={() => setAddSessionDialog(undefined)}
          onWorktreeSelect={(worktreeIndex) =>
            setAddSessionDialog((current) => (current ? { ...current, worktreeIndex } : current))
          }
          onSubmit={(value) => void submitAddSession(value)}
        />
      ) : null}
      {promptDialog ? (
        <PromptDialog
          state={promptDialog}
          width={dimensions.width}
          height={dimensions.height}
          clearVersion={promptClearVersion}
          onInput={(value) =>
            setPromptDialog((current) => (current ? { ...current, value, error: undefined } : current))
          }
          onCancel={() => setPromptDialog(undefined)}
          onSubmit={(value) => void submitPrompt(value)}
        />
      ) : null}
      {deleteDialog ? (
        <DeleteSessionDialog
          state={deleteDialog}
          width={dimensions.width}
          height={dimensions.height}
          onConfirm={() => void confirmDeleteSession()}
          onCancel={() => setDeleteDialog(undefined)}
        />
      ) : null}
      {settingsDialog ? (
        <SettingsDialog
          state={settingsDialog}
          width={dimensions.width}
          height={dimensions.height}
          clearVersion={settingsClearVersion}
          onInput={(value) =>
            setSettingsDialog((current) =>
              current ? { ...current, serverUrlValue: value, error: undefined } : current,
            )
          }
          onServerSelect={(serverIndex) => {
            setSettingsDialog((current) => (current ? { ...current, selectedServerIndex: serverIndex } : current))
            const server = settingsDialog.servers[serverIndex]
            if (server) void switchServer(server.url)
          }}
          onAddServer={(serverUrl) => void addServerFromSettings(serverUrl)}
          onClose={() => setSettingsDialog(undefined)}
        />
      ) : null}
      {shortcutsDialogOpen ? (
        <ShortcutsDialog
          width={dimensions.width}
          height={dimensions.height}
          selectedIndex={selectedShortcutIndex}
          onSelect={setSelectedShortcutIndex}
          onRun={(action) => {
            if (executeShortcutAction(action)) setShortcutsDialogOpen(false)
          }}
          onClose={() => setShortcutsDialogOpen(false)}
        />
      ) : null}
      <ToastStack
        toasts={toasts}
        screenWidth={mainPanelWidth}
        top={TOP_BAR_HEIGHT + 1}
        now={now}
        onDismiss={dismissToast}
      />
    </box>
  )
}

function formatSessionCount(count: number): string {
  return `${count} session${count === 1 ? "" : "s"}`
}

function ToastStack({
  toasts,
  screenWidth,
  top,
  now,
  onDismiss,
}: {
  toasts: readonly Toast[]
  screenWidth: number
  top: number
  now: Date
  onDismiss: (id: number) => void
}) {
  const width = Math.min(42, Math.max(24, screenWidth - 4))
  const left = Math.max(1, screenWidth - width - 2)

  return (
    <box style={{ position: "absolute", zIndex: 30, left, top, width, flexDirection: "column" }}>
      {toasts.map((toast) => (
        <ToastView key={toast.id} toast={toast} width={width} now={now} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </box>
  )
}

function ToastView({
  toast,
  width,
  now,
  onDismiss,
}: {
  toast: Toast
  width: number
  now: Date
  onDismiss: () => void
}) {
  const statusColor = toast.status === "loading" ? theme.info : toast.status === "success" ? theme.success : theme.error
  const loadingFrames = ["|", "/", "-", "\\"]
  const statusText =
    toast.status === "loading"
      ? (loadingFrames[Math.floor(now.getTime() / 120) % loadingFrames.length] ?? "|")
      : toast.status === "success"
        ? "ok"
        : "err"
  const contentWidth = Math.max(1, width - 2)

  return (
    <box
      style={{
        flexDirection: "column",
        width,
        marginBottom: 1,
        backgroundColor: theme.backgroundPanel,
        border: true,
        borderColor: toast.status === "loading" ? theme.info : theme.border,
      }}
      onMouseDown={(event) => {
        mouseAction(event)
        if (toast.status !== "loading") onDismiss()
      }}
    >
      <TextLine width={contentWidth} bg={theme.backgroundElement}>
        <span fg={statusColor} attributes={TextAttributes.BOLD}>{` ${statusText} `}</span>
        <span fg={theme.text} attributes={TextAttributes.BOLD}>
          {fitCell(toast.title, Math.max(1, contentWidth - statusText.length - 4))}
        </span>
      </TextLine>
      {toast.detail ? (
        <TextLine width={contentWidth} bg={theme.backgroundPanel}>
          <span fg={theme.textMuted}>{fitCell(` ${toast.detail}`, contentWidth)}</span>
        </TextLine>
      ) : null}
    </box>
  )
}

function TopMenuBar({
  openMenu,
  width,
  visualMode,
  onOpenMenu,
}: {
  openMenu: MenuId | undefined
  width: number
  visualMode: boolean
  onOpenMenu: (menu: MenuId) => void
}) {
  const indicator = visualMode ? " VISUAL " : ""
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
        active={openMenu === "actions"}
        onPress={() => onOpenMenu("actions")}
        onHover={() => {
          if (openMenu) onOpenMenu("actions")
        }}
      />
      <MenuButton
        label="[2] Selected"
        width={14}
        active={openMenu === "selected"}
        onPress={() => onOpenMenu("selected")}
        onHover={() => {
          if (openMenu) onOpenMenu("selected")
        }}
      />
      <text content={" ".repeat(spacerWidth)} style={{ bg: TOP_BAR_BACKGROUND }} />
      {visualMode ? (
        <text
          content={indicator}
          style={{ fg: theme.background, bg: theme.primary, attributes: TextAttributes.BOLD }}
        />
      ) : null}
    </box>
  )
}

function SidebarSettingsButton({ width, onPress }: { width: number; onPress: () => void }) {
  return (
    <box
      style={{ flexShrink: 0, height: 1, width }}
      onMouseDown={(event) => {
        mouseAction(event)
        onPress()
      }}
    >
      <text
        content={shortcutHintLine("Settings", "[^p]", width)}
        style={{ fg: theme.textMuted, bg: theme.backgroundElement }}
      />
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

function MenuDropdown({
  left,
  top,
  items,
  selectedIndex,
  onSelect,
  onClose,
}: {
  left: number
  top: number
  items: MenuItem[]
  selectedIndex: number
  onSelect: (index: number) => void
  onClose: () => void
}) {
  const labelWidth = Math.max(14, ...items.map((item) => item.label.length))
  const shortcutWidth = Math.max(8, ...items.map((item) => item.shortcut.length))
  const innerWidth = labelWidth + shortcutWidth + 3
  const width = innerWidth + 2
  const height = items.length + 2

  return (
    <ModalFrame left={left} top={top} width={width} height={height}>
      {items.map((item, index) => (
        <MenuDropdownItem
          key={item.label}
          item={item}
          selected={index === selectedIndex}
          labelWidth={labelWidth}
          shortcutWidth={shortcutWidth}
          width={innerWidth}
          onSelect={() => onSelect(index)}
          onClose={onClose}
        />
      ))}
    </ModalFrame>
  )
}

function MenuDropdownItem({
  item,
  selected,
  labelWidth,
  shortcutWidth,
  width,
  onSelect,
  onClose,
}: {
  item: MenuItem
  selected: boolean
  labelWidth: number
  shortcutWidth: number
  width: number
  onSelect: () => void
  onClose: () => void
}) {
  const disabled = Boolean(item.disabled)
  const fg = disabled ? theme.border : item.danger ? theme.error : theme.text
  const bg = selected ? theme.backgroundElement : undefined

  return (
    <box
      style={{ height: 1, width }}
      onMouseOver={onSelect}
      onMouseDown={(event) => {
        mouseAction(event)
        onSelect()
        if (disabled) return
        onClose()
        item.run()
      }}
    >
      <TextLine width={width} bg={bg}>
        <span fg={fg} {...(selected && !disabled ? { attributes: TextAttributes.BOLD } : {})}>
          {fitCell(` ${item.label}`, labelWidth + 1)}
        </span>
        <span fg={disabled ? theme.border : theme.textMuted}>{fitCell(item.shortcut, shortcutWidth, "right")}</span>
        <span> </span>
      </TextLine>
    </box>
  )
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
