import { type ScrollBoxRenderable } from "@opentui/core"
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useRef } from "react"
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
  type LaneStatus,
} from "../lib/utils.ts"
import {
  createSessionWithPrompt,
  deleteSession,
  discoverOpencode,
  loadContextUsage,
  loadLatestExchange,
  loadLatestMessage,
  sendPrompt,
  type SessionRow,
} from "../opencode.ts"
import { openTmuxSessionForRow } from "../tmux.ts"
import { DashboardStoreProvider, useDashboardStore } from "./dashboard.store.ts"

const POLL_INTERVAL_MS = 2_000

export function DashboardPage() {
  return (
    <DashboardStoreProvider>
      <DashboardContent />
    </DashboardStoreProvider>
  )
}

function DashboardContent() {
  const renderer = useRenderer()
  const dimensions = useTerminalDimensions()
  const now = useNow(80)
  const listRef = useRef<ScrollBoxRenderable>(null)
  const pendingGoToTop = useRef(false)
  const pendingLatestMessages = useRef(new Set<string>())
  const pendingContextUsage = useRef(new Set<string>())

  const activeTabId = useDashboardStore((store) => store.activeTabId)
  const selection = useDashboardStore((store) => store.selection)
  const searchValue = useDashboardStore((store) => store.searchValue)
  const searchFocused = useDashboardStore((store) => store.searchFocused)
  const promptDialog = useDashboardStore((store) => store.promptDialog)
  const addSessionDialog = useDashboardStore((store) => store.addSessionDialog)
  const deleteSessionDialog = useDashboardStore((store) => store.deleteSessionDialog)
  const deletingSessionID = useDashboardStore((store) => store.deletingSessionID)
  const deleteError = useDashboardStore((store) => store.deleteError)
  const latestMessages = useDashboardStore((store) => store.latestMessages)
  const contextUsage = useDashboardStore((store) => store.contextUsage)
  const setActiveTabId = useDashboardStore((store) => store.setActiveTabId)
  const setSelection = useDashboardStore((store) => store.setSelection)
  const setSearchValue = useDashboardStore((store) => store.setSearchValue)
  const setSearchFocused = useDashboardStore((store) => store.setSearchFocused)
  const setPromptDialog = useDashboardStore((store) => store.setPromptDialog)
  const setAddSessionDialog = useDashboardStore((store) => store.setAddSessionDialog)
  const setDeleteSessionDialog = useDashboardStore((store) => store.setDeleteSessionDialog)
  const setDeletingSessionID = useDashboardStore((store) => store.setDeletingSessionID)
  const setDeleteError = useDashboardStore((store) => store.setDeleteError)
  const setLatestMessage = useDashboardStore((store) => store.setLatestMessage)
  const removeLatestMessage = useDashboardStore((store) => store.removeLatestMessage)
  const setContextUsage = useDashboardStore((store) => store.setContextUsage)
  const removeContextUsage = useDashboardStore((store) => store.removeContextUsage)

  const query = useQuery({
    queryKey: ["opencode-sessions"],
    queryFn: () => discoverOpencode(),
  })
  const { refetch } = query

  const snapshot = query.data
  const queryError = query.error instanceof Error ? query.error.message : query.error ? String(query.error) : undefined
  const width = Math.max(30, dimensions.width - 2)
  const tableWidth = Math.max(30, dimensions.width - 4)
  const tabs = useMemo(() => groupRowsByProject(snapshot?.rows ?? []), [snapshot?.rows])
  const activeTabIndex = activeTabId
    ? Math.max(
        0,
        tabs.findIndex((tab) => tab.id === activeTabId),
      )
    : 0
  const activeTab = tabs[activeTabIndex]
  const activeRows = useMemo(
    () => withLatestMessages(withContextUsage(activeTab?.rows ?? [], contextUsage), latestMessages),
    [activeTab?.rows, contextUsage, latestMessages],
  )
  const filteredRows = useMemo(
    () => activeRows.filter((row) => fuzzySessionMatch(row, searchValue)),
    [activeRows, searchValue],
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
    if (!activeTab) return
    for (const row of activeTab.rows) {
      const key = `${row.id}:${row.updated}`
      if (latestMessages[row.id]?.updated === row.updated) continue
      if (pendingLatestMessages.current.has(key)) continue

      pendingLatestMessages.current.add(key)
      void loadLatestMessage({ sessionID: row.id, directory: row.directory, workspaceID: row.workspaceID })
        .then((text) => {
          setLatestMessage(row.id, { updated: row.updated, text })
        })
        .catch(() => {
          setLatestMessage(row.id, { updated: row.updated, text: "" })
        })
        .finally(() => {
          pendingLatestMessages.current.delete(key)
        })
    }
  }, [activeTab, latestMessages, setLatestMessage])

  useEffect(() => {
    if (!activeTab) return
    for (const row of activeTab.rows) {
      const key = `${row.id}:${row.updated}`
      if (contextUsage[row.id]?.updated === row.updated) continue
      if (pendingContextUsage.current.has(key)) continue

      pendingContextUsage.current.add(key)
      void loadContextUsage({ sessionID: row.id, directory: row.directory, workspaceID: row.workspaceID })
        .then((usage) => {
          setContextUsage(row.id, { updated: row.updated, ...usage })
        })
        .catch(() => {
          setContextUsage(row.id, { updated: row.updated })
        })
        .finally(() => {
          pendingContextUsage.current.delete(key)
        })
    }
  }, [activeTab, contextUsage, setContextUsage])

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
    listRef.current?.scrollChildIntoView(selectedElementId)
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
    if (deleteSessionDialog) {
      if (key.name === "escape" || key.name === "n") {
        setDeleteSessionDialog(undefined)
        return
      }
      if (key.name === "return" || key.name === "enter" || key.name === "y") {
        const row = deleteSessionDialog.row
        setDeleteSessionDialog(undefined)
        void deleteCurrentSession(row)
        return
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
    if (key.name === "o") {
      if (currentRow) void openTmuxSession(currentRow)
      return
    }
    if (key.name === "d") {
      if (currentRow && !deletingSessionID) setDeleteSessionDialog({ row: currentRow })
      return
    }
    if (key.name === "return" || key.name === "enter") {
      if (currentRow) openPromptDialog(currentRow)
      return
    }
    if (key.name === "tab") {
      const tab = tabs[nextIndex(activeTabIndex, key.shift ? -1 : 1, tabs.length)]
      setActiveTabId(tab?.id)
      return
    }
    if (key.name === "j" || key.name === "down") {
      setSelection((current) => moveSelection(current, 1, rowsBySection))
      return
    }
    if (key.name === "k" || key.name === "up") {
      setSelection((current) => moveSelection(current, -1, rowsBySection))
      return
    }
    if (key.name === "G" || (key.name === "g" && key.shift) || key.sequence === "G") {
      setSelection((current) => selectionEdge(current, "bottom", rowsBySection))
      return
    }
    if (key.name === "g") {
      if (wasPendingGoToTop) setSelection((current) => selectionEdge(current, "top", rowsBySection))
      else pendingGoToTop.current = true
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

  function openPromptDialog(row: NonNullable<typeof currentRow>) {
    setPromptDialog({ row, value: "", sending: false, loadingPreview: true })
    void loadLatestExchange({ sessionID: row.id, directory: row.directory, workspaceID: row.workspaceID })
      .then((latestExchange) => {
        setPromptDialog((current) =>
          current?.row.id === row.id
            ? {
                ...current,
                latestUserMessage: latestExchange.userMessage,
                loadingPreview: false,
                row: { ...current.row, latestMessage: latestExchange.assistantMessage },
              }
            : current,
        )
      })
      .catch(() => {
        setPromptDialog((current) => (current?.row.id === row.id ? { ...current, loadingPreview: false } : current))
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

  async function deleteCurrentSession(row: SessionRow) {
    if (deletingSessionID) return

    setDeletingSessionID(row.id)
    setDeleteError(undefined)
    try {
      await deleteSession({ sessionID: row.id, directory: row.directory, workspaceID: row.workspaceID })
      removeLatestMessage(row.id)
      removeContextUsage(row.id)
      await query.refetch()
    } catch (deleteSessionError) {
      setDeleteError(deleteSessionError instanceof Error ? deleteSessionError.message : String(deleteSessionError))
    } finally {
      setDeletingSessionID(undefined)
    }
  }

  async function submitPrompt(value: string) {
    const trimmed = value.trim()
    if (!trimmed || !promptDialog || promptDialog.sending) return

    setPromptDialog((current) => (current ? { ...current, sending: true, error: undefined } : current))
    try {
      await sendPrompt({
        sessionID: promptDialog.row.id,
        directory: promptDialog.row.directory,
        workspaceID: promptDialog.row.workspaceID,
        text: trimmed,
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

  const footerInputWidth = Math.min(44, Math.max(16, Math.floor(width * 0.4)))
  const footerHint = deleteError
    ? `delete failed: ${deleteError}`
    : deletingSessionID
      ? "deleting session..."
      : "enter prompt · / search · o open tmux · d delete · a new session · tab/shift-tab project · j/k move · r refresh · q quit"
  const footerHintWidth = Math.max(0, width - footerInputWidth - 1)
  const headerHeight = 1
  const tabsHeight = 1
  const tableHeaderHeight = 2
  const footerHeight = 3
  const tableHeight = Math.max(1, dimensions.height - headerHeight - tabsHeight - tableHeaderHeight - footerHeight)

  return (
    <box
      style={{
        width: dimensions.width,
        height: dimensions.height,
        flexDirection: "column",
        backgroundColor: "#000000",
      }}
    >
      <Header snapshot={snapshot} width={width} />
      <ProjectTabs tabs={tabs} activeIndex={activeTabIndex} width={width} />
      <box
        style={{
          flexShrink: 0,
          height: tableHeaderHeight,
          paddingLeft: 1,
          paddingRight: 1,
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
          paddingLeft: 1,
          paddingRight: 1,
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
            now={now}
            width={tableWidth}
          />
        ))}
      </scrollbox>
      <box
        style={{
          flexDirection: "row",
          flexShrink: 0,
          height: footerHeight,
          justifyContent: "space-between",
          paddingLeft: 1,
          paddingRight: 1,
          width: dimensions.width,
        }}
      >
        <SearchInput value={searchValue} focused={searchFocused} width={footerInputWidth} onInput={setSearchValue} />
        <text content={truncate(footerHint, footerHintWidth)} style={{ fg: deleteError ? "#F87171" : "#64748B" }} />
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
      {deleteSessionDialog ? (
        <DeleteSessionDialog state={deleteSessionDialog} width={dimensions.width} height={dimensions.height} />
      ) : null}
    </box>
  )
}

function withLatestMessages(
  rows: SessionRow[],
  latestMessages: Record<string, { updated: number; text: string }>,
): SessionRow[] {
  return rows.map((row) => ({ ...row, latestMessage: latestMessages[row.id]?.text ?? row.latestMessage }))
}

function withContextUsage(
  rows: SessionRow[],
  contextUsage: Record<string, { updated: number; tokens?: number; percent?: number }>,
): SessionRow[] {
  return rows.map((row) => {
    const usage = contextUsage[row.id]
    if (!usage || usage.updated !== row.updated) return row
    return { ...row, contextTokens: usage.tokens, contextPercent: usage.percent }
  })
}

function fuzzySessionMatch(row: SessionRow, query: string): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return true

  const haystack = `${row.title} ${row.worktreeName}`.toLowerCase()
  return terms.every((term) => fuzzyIncludes(haystack, term))
}

function fuzzyIncludes(value: string, query: string): boolean {
  let queryIndex = 0
  for (const character of value) {
    if (character === query[queryIndex]) queryIndex += 1
    if (queryIndex === query.length) return true
  }
  return query.length === 0
}
