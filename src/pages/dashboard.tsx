import { type ScrollBoxRenderable } from "@opentui/core"
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useRef, useState } from "react"
import { Header } from "../components/header.tsx"
import { AddSessionDialog, DeleteSessionDialog, PromptDialog } from "../components/session-dialogs.tsx"
import { SectionView, TableHeader } from "../components/session-table.tsx"
import { SearchInput } from "../components/ui/input.tsx"
import { ProjectTabs } from "../components/ui/tabs.tsx"
import { useNow } from "../hooks/use-now.ts"
import {
  clamp,
  groupRowsByProject,
  moveSelection,
  nextIndex,
  rowElementId,
  rowInLane,
  SECTIONS,
  sectionElementId,
  selectedRow,
  selectionEdge,
  truncate,
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
const HEADER_MARGIN_BOTTOM = 1
const TABS_MARGIN_BOTTOM = 1
const SELECTION_SCROLL_EDGE_OFFSET = 3

export function DashboardPage() {
  const renderer = useRenderer()
  const dimensions = useTerminalDimensions()
  const now = useNow(80)
  const listRef = useRef<ScrollBoxRenderable>(null)
  const pendingGoToTop = useRef(false)
  const selectionScrollDirection = useRef<-1 | 0 | 1>(0)
  const [addSessionDialog, setAddSessionDialog] = useState<AddSessionDialogState>()
  const [promptDialog, setPromptDialog] = useState<PromptDialogState>()
  const [deleteDialog, setDeleteDialog] = useState<DeleteSessionDialogState>()

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
  const width = Math.max(30, dimensions.width - APP_PADDING_X * 2)
  const tableWidth = width
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
  const selectedElementId = currentRow ? rowElementId(currentRow) : sectionElementId(selection.section)
  const workingCount = rowsBySection.working.length
  const needsInputCount = rowsBySection["needs-input"].length
  const completedCount = rowsBySection.completed.length

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

  useEffect(() => {
    scrollChildIntoViewNearEdge(listRef.current, selectedElementId, selectionScrollDirection.current)
    selectionScrollDirection.current = 0
  }, [selectedElementId])

  useKeyboard((key) => {
    if (key.ctrl && key.name === "c") {
      key.preventDefault()
      renderer.destroy()
      return
    }
    const wasPendingGoToTop = pendingGoToTop.current
    pendingGoToTop.current = false
    if (addSessionDialog) {
      if (key.name === "escape") {
        setAddSessionDialog(undefined)
        return
      }
      if (addSessionDialog.worktrees.length > 1 && key.name === "tab") {
        setAddSessionDialog((current) =>
          current
            ? {
                ...current,
                worktreeIndex: nextIndex(current.worktreeIndex, key.shift ? -1 : 1, current.worktrees.length),
              }
            : current,
        )
        return
      }
      return
    }
    if (promptDialog) {
      if (key.name === "escape") setPromptDialog(undefined)
      return
    }
    if (deleteDialog) {
      if (key.name === "escape" || key.name === "n") {
        setDeleteDialog(undefined)
        return
      }
      if (key.name === "return" || key.name === "enter" || key.name === "y") {
        void confirmDeleteSession()
      }
      return
    }
    if (searchFocused) {
      if (key.name === "escape" || key.name === "return" || key.name === "enter") setSearchFocused(false)
      return
    }
    if (key.name === "/" || key.sequence === "/") {
      key.preventDefault()
      setSearchFocused(true)
      return
    }
    if (key.name === "escape" || key.name === "q") {
      renderer.destroy()
      return
    }
    if (key.name === "r") {
      void query.refetch()
      return
    }
    if (key.name === "a") {
      openAddSessionDialog()
      return
    }
    if (key.name === "d") {
      if (currentRow) setDeleteDialog({ row: currentRow })
      return
    }
    if (key.name === "return" || key.name === "enter") {
      if (currentRow) openPromptDialog(currentRow)
      return
    }
    if (key.name === "o") {
      if (currentRow) void openTmuxSession(currentRow)
      return
    }
    if (key.name === "tab") {
      const tab = tabs[nextIndex(activeTabIndex, key.shift ? -1 : 1, tabs.length)]
      setActiveTabId(tab?.id)
      return
    }
    if (key.name === "j" || key.name === "down") {
      selectionScrollDirection.current = 1
      setSelection((current) => moveSelection(current, 1, rowsBySection))
      return
    }
    if (key.name === "k" || key.name === "up") {
      selectionScrollDirection.current = -1
      setSelection((current) => moveSelection(current, -1, rowsBySection))
      return
    }
    if (key.name === "G" || (key.name === "g" && key.shift) || key.sequence === "G") {
      selectionScrollDirection.current = 1
      setSelection((current) => selectionEdge(current, "bottom", rowsBySection))
      return
    }
    if (key.name === "g") {
      if (wasPendingGoToTop) {
        selectionScrollDirection.current = -1
        setSelection((current) => selectionEdge(current, "top", rowsBySection))
      } else pendingGoToTop.current = true
      return
    }
    if (key.name === "`") renderer.console.toggle()
  })

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

  const footerInputWidth = Math.min(44, Math.max(16, Math.floor(width * 0.4)))
  const footerHint =
    "enter prompt · / search · o open tmux · d delete · a new session · tab/shift-tab project · j/k move · r refresh · q quit"
  const footerHintWidth = Math.max(0, width - footerInputWidth - 1)
  const headerHeight = 1 + HEADER_MARGIN_BOTTOM
  const tabsHeight = 1 + TABS_MARGIN_BOTTOM
  const tableHeaderHeight = 2
  const footerHeight = 3
  const tableHeight = Math.max(
    1,
    dimensions.height - APP_PADDING_Y * 2 - headerHeight - tabsHeight - tableHeaderHeight - footerHeight,
  )

  return (
    <box
      style={{
        width: dimensions.width,
        height: dimensions.height,
        flexDirection: "column",
        backgroundColor: "#000000",
        paddingTop: APP_PADDING_Y,
        paddingBottom: APP_PADDING_Y,
      }}
    >
      <box style={{ flexShrink: 0, marginBottom: HEADER_MARGIN_BOTTOM, width: dimensions.width }}>
        <Header snapshot={snapshot} width={width} />
      </box>
      <box style={{ flexShrink: 0, marginBottom: TABS_MARGIN_BOTTOM, width: dimensions.width }}>
        <ProjectTabs tabs={tabs} activeIndex={activeTabIndex} width={width} />
      </box>
      <box
        style={{
          flexShrink: 0,
          height: tableHeaderHeight,
          paddingLeft: APP_PADDING_X,
          paddingRight: APP_PADDING_X,
          width: dimensions.width,
        }}
      >
        <TableHeader width={tableWidth} />
      </box>
      <scrollbox
        ref={listRef}
        focused={!searchFocused}
        style={{
          contentOptions: { flexDirection: "column" },
          flexShrink: 0,
          height: tableHeight,
          width: dimensions.width,
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
        {query.isPending ? <text content="loading sessions…" style={{ fg: "#38BDF8" }} /> : null}
        {queryError ? <text content={`error: ${queryError}`} style={{ fg: "#F87171" }} /> : null}
        {snapshot && snapshot.rows.length === 0 ? (
          <box style={{ flexDirection: "column" }}>
            <text content="No sessions found on the opencode persistence server." style={{ fg: "#FDE68A" }} />
            <text content={snapshot.serverUrl} style={{ fg: "#64748B" }} />
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
          />
        ))}
      </scrollbox>
      <box
        style={{
          flexDirection: "row",
          flexShrink: 0,
          height: footerHeight,
          alignItems: "center",
          justifyContent: "space-between",
          paddingLeft: APP_PADDING_X,
          paddingRight: APP_PADDING_X,
          width: dimensions.width,
        }}
      >
        <SearchInput value={searchValue} focused={searchFocused} width={footerInputWidth} onInput={setSearchValue} />
        <text content={truncate(footerHint, footerHintWidth)} style={{ fg: "#64748B" }} />
      </box>
      {addSessionDialog ? (
        <AddSessionDialog
          state={addSessionDialog}
          width={dimensions.width}
          height={dimensions.height}
          onInput={(value) =>
            setAddSessionDialog((current) => (current ? { ...current, value, error: undefined } : current))
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
    </box>
  )
}

function fuzzySessionMatch(row: SessionRow, query: string): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return true

  const haystack = `${row.title} ${row.worktreeName}`.toLowerCase()
  return terms.every((term) => fuzzyIncludes(haystack, term))
}

function scrollChildIntoViewNearEdge(scrollBox: ScrollBoxRenderable | null, childId: string, direction: -1 | 0 | 1) {
  if (!scrollBox) return

  const child = scrollBox.content.findDescendantById(childId)
  if (!child) return

  const childTop = child.y
  const childBottom = child.y + child.height
  const viewportTop = scrollBox.viewport.y
  const viewportBottom = scrollBox.viewport.y + scrollBox.viewport.height
  const edgeOffset = Math.min(
    SELECTION_SCROLL_EDGE_OFFSET,
    Math.max(0, Math.floor((scrollBox.viewport.height - 1) / 2)),
  )

  if (childTop < viewportTop) {
    scrollBox.scrollBy({ x: 0, y: childTop - viewportTop })
    return
  }

  if (childBottom > viewportBottom) {
    scrollBox.scrollBy({ x: 0, y: childBottom - viewportBottom })
    return
  }

  if (direction < 0 && childTop < viewportTop + edgeOffset) {
    scrollBox.scrollBy({ x: 0, y: childTop - viewportTop - edgeOffset })
    return
  }

  if (direction > 0 && childBottom > viewportBottom - edgeOffset) {
    scrollBox.scrollBy({ x: 0, y: childBottom - viewportBottom + edgeOffset })
    return
  }
}

function fuzzyIncludes(value: string, query: string): boolean {
  let queryIndex = 0
  for (const character of value) {
    if (character === query[queryIndex]) queryIndex += 1
    if (queryIndex === query.length) return true
  }
  return query.length === 0
}
