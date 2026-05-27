import { type ScrollBoxRenderable } from "@opentui/core"
import { useRenderer, useTerminalDimensions } from "@opentui/react"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useRef, useState } from "react"
import { Header, HeaderTitle } from "../components/header.tsx"
import { AddSessionDialog, DeleteSessionDialog, PromptDialog, ShortcutsDialog } from "../components/session-dialogs.tsx"
import { SectionView, TableHeader } from "../components/session-table.tsx"
import { SearchInput } from "../components/ui/input.tsx"
import { ProjectTabs } from "../components/ui/tabs.tsx"
import { useNow } from "../hooks/use-now.ts"
import { useScrollFollowSelected } from "../hooks/use-scroll-follow-selected.ts"
import { dashboardKeymap } from "../keymap/dashboard.ts"
import { useOpenTuiSubscribe } from "../keymap/opentui-adapter.ts"
import { useKeymap } from "../keymap/react.ts"
import { theme } from "../theme.ts"
import {
  clamp,
  groupRowsByProject,
  moveSelection,
  moveSelectionClamped,
  nextIndex,
  rowInLane,
  SECTIONS,
  selectedRow,
  selectionEdge,
  worktreeOptions,
  type AddSessionDialogState,
  type DeleteSessionDialogState,
  type LaneStatus,
  type PromptDialogState,
} from "../lib/utils.ts"
import { createSessionWithPrompt, deleteSession, getSessions, sendPrompt, type SessionRow } from "../opencode.ts"
import { openTmuxSessionForRow } from "../tmux.ts"
import { useDashboardStore } from "./dashboard.store.ts"

const POLL_INTERVAL_MS = 2_000
const APP_PADDING_X = 2
const APP_PADDING_Y = 1
const SIDEBAR_BACKGROUND = theme.backgroundPanel
const SIDEBAR_PADDING_X = 2
const SIDEBAR_PADDING_Y = 1
const SELECTION_SCROLL_EDGE_OFFSET = 3

export function DashboardPage() {
  const renderer = useRenderer()
  const dimensions = useTerminalDimensions()
  const now = useNow(80)
  const listRef = useRef<ScrollBoxRenderable>(null)
  const [addSessionDialog, setAddSessionDialog] = useState<AddSessionDialogState>()
  const [promptDialog, setPromptDialog] = useState<PromptDialogState>()
  const [deleteDialog, setDeleteDialog] = useState<DeleteSessionDialogState>()
  const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false)
  const [hoveredRowId, setHoveredRowId] = useState<string>()

  const activeTabId = useDashboardStore((store) => store.activeTabId)
  const selection = useDashboardStore((store) => store.selection)
  const searchValue = useDashboardStore((store) => store.searchValue)
  const searchFocused = useDashboardStore((store) => store.searchFocused)
  const setActiveTabId = useDashboardStore((store) => store.setActiveTabId)
  const setSelection = useDashboardStore((store) => store.setSelection)
  const setSearchValue = useDashboardStore((store) => store.setSearchValue)
  const setSearchFocused = useDashboardStore((store) => store.setSearchFocused)

  const query = useQuery({
    queryKey: ["opencode-sessions"],
    queryFn: () => getSessions(),
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
  const activeSection = selection.section
  const currentRow = selectedRow(selection, rowsBySection)
  const workingCount = rowsBySection.working.length
  const needsInputCount = rowsBySection["needs-input"].length
  const completedCount = rowsBySection.completed.length
  const tableHeaderHeight = 2
  const tableHeight = Math.max(1, dimensions.height - APP_PADDING_Y * 2 - tableHeaderHeight)
  const statusLineCount =
    (query.isPending ? 1 : 0) + (queryError ? 1 : 0) + (snapshot && snapshot.rows.length === 0 ? 2 : 0)
  const selectedLine = selectedSessionLine(selection, rowsBySection, statusLineCount)
  const subscribe = useOpenTuiSubscribe()

  useKeymap(
    dashboardKeymap,
    {
      textInputActive: searchFocused || Boolean(addSessionDialog) || Boolean(promptDialog),
      helpDialog: shortcutsDialogOpen ? { close: () => setShortcutsDialogOpen(false) } : null,
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
      search: searchFocused ? { blur: () => setSearchFocused(false) } : null,
      listNav:
        shortcutsDialogOpen || addSessionDialog || promptDialog || deleteDialog || searchFocused
          ? null
          : {
              tabCount: tabs.length,
              hasSelection: Boolean(currentRow),
              halfPage: halfPage(tableHeight),
              refresh: () => void query.refetch(),
              openAddSession: openAddSessionDialog,
              openDeleteSession: () => {
                if (currentRow) setDeleteDialog({ row: currentRow })
              },
              openPrompt: () => {
                if (currentRow) openPromptDialog(currentRow)
              },
              openTmux: () => {
                if (currentRow) void openTmuxSession(currentRow)
              },
              focusSearch: () => setSearchFocused(true),
              openHelp: () => setShortcutsDialogOpen(true),
              selectTab: (index) => {
                const tab = tabs[index]
                if (tab) setActiveTabId(tab.id)
              },
              cycleTab: (delta) => {
                const tab = tabs[nextIndex(activeTabIndex, delta, tabs.length)]
                setActiveTabId(tab?.id)
              },
              moveSelection: (delta) => setSelection((current) => moveSelection(current, delta, rowsBySection)),
              moveSelectionClamped: (delta) =>
                setSelection((current) => moveSelectionClamped(current, delta, rowsBySection)),
              moveTop: () => setSelection((current) => selectionEdge(current, "top", rowsBySection)),
              moveBottom: () => setSelection((current) => selectionEdge(current, "bottom", rowsBySection)),
              quit: () => renderer.destroy(),
              toggleConsole: () => renderer.console.toggle(),
            },
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
    if (tabs.length === 0) {
      if (activeTabId !== undefined) setActiveTabId(undefined)
      return
    }
    if (activeTabId && tabs.some((tab) => tab.id === activeTabId)) return
    setActiveTabId(tabs[0]?.id)
  }, [activeTabId, setActiveTabId, tabs])

  useEffect(() => {
    const lengths = {
      working: workingCount,
      "needs-input": needsInputCount,
      completed: completedCount,
    }
    setSelection((current) => {
      if (lengths[current.section] > 0) {
        return { section: current.section, index: clamp(current.index, 0, lengths[current.section] - 1) }
      }
      if (lengths.working > 0) return { section: "working", index: 0 }
      if (lengths["needs-input"] > 0) return { section: "needs-input", index: 0 }
      if (lengths.completed > 0) return { section: "completed", index: 0 }
      return { section: current.section, index: 0 }
    })
  }, [activeTab?.id, workingCount, needsInputCount, completedCount, setSelection])

  function openAddSessionDialog() {
    if (!activeTab) return
    const worktrees = worktreeOptions(activeTab)
    if (worktrees.length === 0) return
    setAddSessionDialog({ projectTitle: activeTab.title, worktrees, worktreeIndex: 0, value: "", sending: false })
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
      renderer.destroy()
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
      await sendPrompt({ sessionID: row.id, directory: row.directory, workspaceID: row.workspaceID, text: trimmed })
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

  async function confirmDeleteSession() {
    if (!deleteDialog || deleteDialog.deleting) return

    const row = deleteDialog.row
    setDeleteDialog((current) => (current ? { ...current, deleting: true, error: undefined } : current))
    try {
      await deleteSession({ sessionID: row.id, directory: row.directory, workspaceID: row.workspaceID })
      setDeleteDialog(undefined)
      await query.refetch()
    } catch (deleteError) {
      setDeleteDialog((current) =>
        current
          ? {
              ...current,
              deleting: false,
              error: deleteError instanceof Error ? deleteError.message : String(deleteError),
            }
          : current,
      )
    }
  }

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
              selection={selection}
              active={activeSection === section.status}
              width={tableWidth}
              hoveredRowId={hoveredRowId}
              onRowHover={setHoveredRowId}
              onRowSelect={(nextSelection) => setSelection(nextSelection)}
            />
          ))}
        </scrollbox>
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
        <box style={{ flexShrink: 0, marginBottom: 1, width: sidebarContentWidth }}>
          <HeaderTitle />
        </box>
        <SearchInput
          value={searchValue}
          focused={searchFocused}
          width={sidebarContentWidth}
          onInput={setSearchValue}
          onFocus={() => setSearchFocused(true)}
        />
        <box style={{ flexShrink: 0, marginTop: 2, width: sidebarContentWidth }}>
          <Header snapshot={snapshot} width={sidebarContentWidth} />
        </box>
        <box style={{ flexShrink: 0, marginTop: 2, width: sidebarContentWidth }}>
          <ProjectTabs
            tabs={tabs}
            activeIndex={activeTabIndex}
            width={sidebarContentWidth}
            onSelect={(tab) => setActiveTabId(tab.id)}
          />
        </box>
      </box>
      {addSessionDialog ? (
        <AddSessionDialog
          state={addSessionDialog}
          width={dimensions.width}
          height={dimensions.height}
          onInput={(value) =>
            setAddSessionDialog((current) => (current ? { ...current, value, error: undefined } : current))
          }
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
          onInput={(value) =>
            setPromptDialog((current) => (current ? { ...current, value, error: undefined } : current))
          }
          onSubmit={(value) => void submitPrompt(value)}
        />
      ) : null}
      {deleteDialog ? (
        <DeleteSessionDialog state={deleteDialog} width={dimensions.width} height={dimensions.height} />
      ) : null}
      {shortcutsDialogOpen ? <ShortcutsDialog width={dimensions.width} height={dimensions.height} /> : null}
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
  selection: { section: LaneStatus; index: number },
  rowsBySection: Record<LaneStatus, SessionRow[]>,
  prefixLines: number,
): number | null {
  if (!rowsBySection[selection.section][selection.index]) return null

  let line = prefixLines
  for (const section of SECTIONS) {
    if (section.status === selection.section) return line + 2 + selection.index
    line += 2 + Math.max(1, rowsBySection[section.status].length) + 1
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
