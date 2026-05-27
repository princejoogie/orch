import { createCliRenderer, type ScrollBoxRenderable } from "@opentui/core"
import { createRoot, useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react"
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  createSessionWithPrompt,
  discoverOpencode,
  loadContextUsage,
  loadLatestMessage,
  sendPrompt,
  type SessionRow,
} from "./opencode.ts"
import {
  AddSessionDialog,
  Header,
  PromptDialog,
  ProjectTabs,
  SECTIONS,
  SectionView,
  TableHeader,
  groupRowsByProject,
  moveSelection,
  nextIndex,
  rowElementId,
  rowInLane,
  sectionElementId,
  selectedRow,
  worktreeOptions,
  clamp,
  type AddSessionDialogState,
  type PromptDialogState,
  type Selection,
} from "./utils.tsx"

const POLL_INTERVAL_MS = 2_000

interface RunTuiOptions {
  args: string[]
}

function App() {
  const renderer = useRenderer()
  const dimensions = useTerminalDimensions()
  const listRef = useRef<ScrollBoxRenderable>(null)
  const pendingLatestMessages = useRef(new Set<string>())
  const pendingContextUsage = useRef(new Set<string>())
  const [now, setNow] = useState(() => new Date())
  const [activeTabIndex, setActiveTabIndex] = useState(0)
  const [selection, setSelection] = useState<Selection>({ section: "working", index: 0 })
  const [promptDialog, setPromptDialog] = useState<PromptDialogState | undefined>()
  const [addSessionDialog, setAddSessionDialog] = useState<AddSessionDialogState | undefined>()
  const [latestMessages, setLatestMessages] = useState<Record<string, { updated: number; text: string }>>({})
  const [contextUsage, setContextUsage] = useState<
    Record<string, { updated: number; tokens?: number; percent?: number }>
  >({})
  const query = useQuery({
    queryKey: ["opencode-sessions"],
    queryFn: () => discoverOpencode(),
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: true,
  })

  const snapshot = query.data
  const queryError = query.error instanceof Error ? query.error.message : query.error ? String(query.error) : undefined
  const width = Math.max(30, dimensions.width - 6)
  const tabs = useMemo(() => groupRowsByProject(snapshot?.rows ?? []), [snapshot?.rows])
  const activeTab = tabs[activeTabIndex]
  const rowsBySection = useMemo(
    () => ({
      working: withLatestMessages(
        withContextUsage(activeTab?.rows.filter((row) => rowInLane(row, "working", now)) ?? [], contextUsage),
        latestMessages,
      ),
      "needs-input": withLatestMessages(
        withContextUsage(activeTab?.rows.filter((row) => rowInLane(row, "needs-input", now)) ?? [], contextUsage),
        latestMessages,
      ),
      completed: withLatestMessages(
        withContextUsage(activeTab?.rows.filter((row) => rowInLane(row, "completed", now)) ?? [], contextUsage),
        latestMessages,
      ),
    }),
    [activeTab?.rows, contextUsage, latestMessages, now],
  )
  const activeSection = selection.section
  const currentRow = selectedRow(selection, rowsBySection)
  const workingCount = rowsBySection.working.length
  const needsInputCount = rowsBySection["needs-input"].length
  const completedCount = rowsBySection.completed.length

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 80)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    setActiveTabIndex((current) => clamp(current, 0, Math.max(0, tabs.length - 1)))
  }, [tabs.length])

  useEffect(() => {
    if (!activeTab) return
    for (const row of activeTab.rows) {
      const key = `${row.id}:${row.updated}`
      if (latestMessages[row.id]?.updated === row.updated) continue
      if (pendingLatestMessages.current.has(key)) continue

      pendingLatestMessages.current.add(key)
      void loadLatestMessage({ sessionID: row.id, directory: row.directory, workspaceID: row.workspaceID })
        .then((text) => {
          setLatestMessages((current) => ({ ...current, [row.id]: { updated: row.updated, text } }))
        })
        .catch(() => {
          setLatestMessages((current) => ({ ...current, [row.id]: { updated: row.updated, text: "" } }))
        })
        .finally(() => {
          pendingLatestMessages.current.delete(key)
        })
    }
  }, [activeTab, latestMessages])

  useEffect(() => {
    if (!activeTab) return
    for (const row of activeTab.rows) {
      const key = `${row.id}:${row.updated}`
      if (contextUsage[row.id]?.updated === row.updated) continue
      if (pendingContextUsage.current.has(key)) continue

      pendingContextUsage.current.add(key)
      void loadContextUsage({ sessionID: row.id, directory: row.directory, workspaceID: row.workspaceID })
        .then((usage) => {
          setContextUsage((current) => ({ ...current, [row.id]: { updated: row.updated, ...usage } }))
        })
        .catch(() => {
          setContextUsage((current) => ({ ...current, [row.id]: { updated: row.updated } }))
        })
        .finally(() => {
          pendingContextUsage.current.delete(key)
        })
    }
  }, [activeTab, contextUsage])

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
  }, [activeTab?.id, workingCount, needsInputCount, completedCount])

  useEffect(() => {
    const row = selectedRow(selection, rowsBySection)
    const id = row ? rowElementId(row) : sectionElementId(selection.section)
    listRef.current?.scrollChildIntoView(id)
  }, [rowsBySection, selection])

  useKeyboard((key) => {
    if (key.ctrl && key.name === "c") {
      key.preventDefault()
      renderer.destroy()
      return
    }
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
    if (key.name === "return" || key.name === "enter") {
      if (currentRow) openPromptDialog(currentRow)
      return
    }
    if (key.name === "tab") {
      setActiveTabIndex((current) => nextIndex(current, key.shift ? -1 : 1, tabs.length))
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
    if (key.name === "d") {
      renderer.toggleDebugOverlay()
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
    void loadLatestMessage({ sessionID: row.id, directory: row.directory, workspaceID: row.workspaceID })
      .then((latestMessage) => {
        setPromptDialog((current) =>
          current?.row.id === row.id
            ? { ...current, loadingPreview: false, row: { ...current.row, latestMessage } }
            : current,
        )
      })
      .catch(() => {
        setPromptDialog((current) => (current?.row.id === row.id ? { ...current, loadingPreview: false } : current))
      })
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

  return (
    <box
      style={{
        width: dimensions.width,
        height: dimensions.height,
        flexDirection: "column",
        backgroundColor: "#000000",
        padding: 1,
      }}
    >
      <Header snapshot={snapshot} fetching={query.isFetching} />
      {query.isPending ? <text content="loading sessions…" style={{ fg: "#38BDF8", marginTop: 1 }} /> : null}
      {queryError ? <text content={`error: ${queryError}`} style={{ fg: "#F87171", marginTop: 1 }} /> : null}
      <ProjectTabs tabs={tabs} activeIndex={activeTabIndex} width={width} />
      <scrollbox
        ref={listRef}
        focused
        style={{
          contentOptions: { flexDirection: "column" },
          flexDirection: "column",
          flexGrow: 1,
          marginTop: 1,
          padding: 1,
          scrollX: false,
          scrollY: true,
          scrollbarOptions: { showArrows: false },
          viewportCulling: true,
        }}
      >
        {snapshot && snapshot.rows.length === 0 ? (
          <box style={{ flexDirection: "column" }}>
            <text content="No sessions found on the opencode persistence server." style={{ fg: "#FDE68A" }} />
            <text content={snapshot.serverUrl} style={{ fg: "#64748B" }} />
          </box>
        ) : null}
        {snapshot && snapshot.rows.length > 0 ? <TableHeader width={width} /> : null}
        {SECTIONS.map((section) => (
          <SectionView
            key={section.status}
            section={section}
            rows={rowsBySection[section.status]}
            worktreeColors={activeTab?.worktreeColors ?? {}}
            selection={selection}
            active={activeSection === section.status}
            now={now}
            width={width}
          />
        ))}
      </scrollbox>
      <box style={{ flexDirection: "row", justifyContent: "flex-end" }}>
        <text
          content="enter prompt · a new session · tab/shift-tab project · j/k move · r refresh · q quit"
          style={{ fg: "#64748B" }}
        />
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

export async function runTui(_options: RunTuiOptions): Promise<void> {
  let resolveDone = () => {}
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve
  })

  const renderer = await createCliRenderer({
    exitOnCtrlC: false,
    targetFps: 30,
    useKittyKeyboard: {},
    useMouse: true,
    openConsoleOnError: true,
    onDestroy: resolveDone,
  })

  renderer.setBackgroundColor("#000000")
  const queryClient = new QueryClient()
  createRoot(renderer).render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  )

  await done
}
