import { createContext, createElement, useContext, useRef, type ReactNode } from "react"
import { createStore, type StoreApi } from "zustand/vanilla"
import { useStore } from "zustand"
import type {
  AddSessionDialogState,
  CollapsedSections,
  DeleteSessionDialogState,
  DeleteWorktreeDialogState,
  InterruptSessionDialogState,
  PromptDialogState,
  Selection,
  WorktreeOption,
} from "../lib/utils.ts"
import type { DashboardSnapshot, SessionRow } from "../opencode.ts"

export type SessionListState = {
  snapshot?: DashboardSnapshot | undefined
  pending: boolean
  error?: string | undefined
  refetch?: (() => void) | undefined
}

export type DashboardStore = {
  activeTabId?: string | undefined
  selection: Selection
  searchValue: string
  searchFocused: boolean
  addSessionDialog?: AddSessionDialogState | undefined
  deleteWorktreeDialog?: DeleteWorktreeDialogState | undefined
  promptDialog?: PromptDialogState | undefined
  deleteDialog?: DeleteSessionDialogState | undefined
  interruptDialog?: InterruptSessionDialogState | undefined
  hoveredRowId?: string | undefined
  searchClearVersion: number
  addSessionClearVersion: number
  promptClearVersion: number
  collapsedSections: CollapsedSections
  visualMode: boolean
  selectedSessionIds: ReadonlySet<string>
  rowsByProjectId: Record<string, SessionRow[]>
  sessionListState: SessionListState
  setActiveTabId: (activeTabId?: string | undefined) => void
  setSelection: (selection: Selection) => void
  setSearchValue: (searchValue: string) => void
  setSearchFocused: (searchFocused: boolean) => void
  bumpSearchClearVersion: () => void
  openAddSessionDialog: (state: AddSessionDialogState) => void
  closeAddSessionDialog: () => void
  setAddSessionValue: (value: string) => void
  setAddSessionWorktreeIndex: (worktreeIndex: number) => void
  setAddSessionModelProviderIndex: (modelProviderIndex: number) => void
  setAddSessionModelIndex: (modelIndex: number) => void
  addAddSessionWorktree: (worktree: WorktreeOption) => void
  removeAddSessionWorktree: (directory: string) => void
  setAddSessionFocus: (focus: AddSessionDialogState["focus"]) => void
  setAddSessionSending: () => void
  setAddSessionError: (error: string) => void
  bumpAddSessionClearVersion: () => void
  openDeleteWorktreeDialog: (state: DeleteWorktreeDialogState) => void
  closeDeleteWorktreeDialog: () => void
  openPromptDialog: (state: PromptDialogState) => void
  closePromptDialog: () => void
  setPromptValue: (value: string) => void
  setPromptSending: () => void
  setPromptLoadingMore: () => void
  prependPromptMessages: (messages: SessionRow["messages"], hasMoreMessages: boolean) => void
  setPromptError: (error: string) => void
  bumpPromptClearVersion: () => void
  openDeleteDialog: (rows: SessionRow[]) => void
  closeDeleteDialog: () => void
  openInterruptDialog: (rows: SessionRow[]) => void
  closeInterruptDialog: () => void
  setHoveredRowId: (rowId?: string | undefined) => void
  toggleCollapsedSection: (section: keyof CollapsedSections) => void
  toggleVisualSelection: (sessionId?: string | undefined) => void
  toggleSelectedSessionId: (sessionId: string) => void
  clearMultiSelection: () => boolean
  setSelectionFromNavigation: (selection: Selection) => void
  setRowsForProject: (projectId: string, rows: SessionRow[]) => void
  clearRowsByProject: () => void
  setSessionListState: (state: SessionListState) => void
}

const DashboardStoreContext = createContext<StoreApi<DashboardStore> | undefined>(undefined)

function createDashboardStore() {
  return createStore<DashboardStore>((set, get) => ({
    selection: { type: "section", section: "working", index: 0 },
    searchValue: "",
    searchFocused: false,
    searchClearVersion: 0,
    addSessionClearVersion: 0,
    promptClearVersion: 0,
    collapsedSections: {},
    visualMode: false,
    selectedSessionIds: new Set(),
    rowsByProjectId: {},
    sessionListState: { pending: false },
    setActiveTabId: (activeTabId) =>
      set((state) =>
        state.activeTabId === activeTabId
          ? state
          : {
              activeTabId,
              visualMode: false,
              selectedSessionIds: new Set(),
              selection: { type: "section", section: "working", index: 0 },
            },
      ),
    setSelection: (selection) =>
      set((state) =>
        state.selection.section === selection.section &&
        state.selection.type === selection.type &&
        state.selection.index === selection.index &&
        state.selection.sessionId === selection.sessionId
          ? state
          : { selection },
      ),
    setSearchValue: (searchValue) =>
      set((state) => ({
        searchValue,
        selectedSessionIds: retainSelectedSessionIds(
          state.selectedSessionIds,
          visibleSessionIds(state.rowsByProjectId[state.activeTabId ?? ""] ?? [], searchValue),
        ),
      })),
    setSearchFocused: (searchFocused) => set({ searchFocused }),
    bumpSearchClearVersion: () => set((state) => ({ searchClearVersion: state.searchClearVersion + 1 })),
    openAddSessionDialog: (addSessionDialog) => set({ addSessionDialog }),
    closeAddSessionDialog: () => set({ addSessionDialog: undefined, deleteWorktreeDialog: undefined }),
    setAddSessionValue: (value) =>
      set((state) => ({
        addSessionDialog: state.addSessionDialog
          ? omitAddSessionError({ ...state.addSessionDialog, value })
          : undefined,
      })),
    setAddSessionWorktreeIndex: (worktreeIndex) =>
      set((state) => ({
        addSessionDialog: state.addSessionDialog ? { ...state.addSessionDialog, worktreeIndex } : undefined,
      })),
    setAddSessionModelProviderIndex: (modelProviderIndex) =>
      set((state) => ({
        addSessionDialog: state.addSessionDialog
          ? { ...state.addSessionDialog, modelProviderIndex, modelIndex: 0 }
          : undefined,
      })),
    setAddSessionModelIndex: (modelIndex) =>
      set((state) => ({
        addSessionDialog: state.addSessionDialog ? { ...state.addSessionDialog, modelIndex } : undefined,
      })),
    addAddSessionWorktree: (worktree) =>
      set((state) => {
        if (!state.addSessionDialog) return { addSessionDialog: undefined }
        const existingIndex = state.addSessionDialog.worktrees.findIndex(
          (option) => option.directory === worktree.directory,
        )
        if (existingIndex !== -1) {
          return { addSessionDialog: { ...state.addSessionDialog, worktreeIndex: existingIndex } }
        }

        return {
          addSessionDialog: {
            ...state.addSessionDialog,
            worktrees: [...state.addSessionDialog.worktrees, worktree],
            worktreeIndex: state.addSessionDialog.worktrees.length,
          },
        }
      }),
    removeAddSessionWorktree: (directory) =>
      set((state) => {
        if (!state.addSessionDialog) return { addSessionDialog: undefined }
        const worktrees = state.addSessionDialog.worktrees.filter((worktree) => worktree.directory !== directory)
        return {
          addSessionDialog: {
            ...state.addSessionDialog,
            worktrees,
            worktreeIndex: Math.min(state.addSessionDialog.worktreeIndex, worktrees.length),
          },
        }
      }),
    setAddSessionFocus: (focus) =>
      set((state) => ({
        addSessionDialog: state.addSessionDialog ? { ...state.addSessionDialog, focus } : undefined,
      })),
    setAddSessionSending: () =>
      set((state) => ({
        addSessionDialog: state.addSessionDialog
          ? omitAddSessionError({ ...state.addSessionDialog, sending: true })
          : undefined,
      })),
    setAddSessionError: (error) =>
      set((state) => ({
        addSessionDialog: state.addSessionDialog ? { ...state.addSessionDialog, sending: false, error } : undefined,
      })),
    bumpAddSessionClearVersion: () => set((state) => ({ addSessionClearVersion: state.addSessionClearVersion + 1 })),
    openDeleteWorktreeDialog: (deleteWorktreeDialog) => set({ deleteWorktreeDialog }),
    closeDeleteWorktreeDialog: () => set({ deleteWorktreeDialog: undefined }),
    openPromptDialog: (promptDialog) => set({ promptDialog }),
    closePromptDialog: () => set({ promptDialog: undefined }),
    setPromptValue: (value) =>
      set((state) => ({
        promptDialog: state.promptDialog ? omitPromptError({ ...state.promptDialog, value }) : undefined,
      })),
    setPromptSending: () =>
      set((state) => ({
        promptDialog: state.promptDialog ? omitPromptError({ ...state.promptDialog, sending: true }) : undefined,
      })),
    setPromptLoadingMore: () =>
      set((state) => ({
        promptDialog: state.promptDialog ? { ...state.promptDialog, loadingMorePreview: true } : undefined,
      })),
    prependPromptMessages: (messages, hasMoreMessages) =>
      set((state) => {
        if (!state.promptDialog) return { promptDialog: undefined }
        const existingIds = new Set(state.promptDialog.row.messages.map((message) => message.id))
        const olderMessages = messages.filter((message) => !existingIds.has(message.id))
        return {
          promptDialog: {
            ...state.promptDialog,
            loadingMorePreview: false,
            row: {
              ...state.promptDialog.row,
              messages: [...olderMessages, ...state.promptDialog.row.messages],
              hasMoreMessages,
            },
          },
        }
      }),
    setPromptError: (error) =>
      set((state) => ({
        promptDialog: state.promptDialog ? { ...state.promptDialog, sending: false, error } : undefined,
      })),
    bumpPromptClearVersion: () => set((state) => ({ promptClearVersion: state.promptClearVersion + 1 })),
    openDeleteDialog: (rows) => set({ deleteDialog: { rows } }),
    closeDeleteDialog: () => set({ deleteDialog: undefined }),
    openInterruptDialog: (rows) => set({ interruptDialog: { rows } }),
    closeInterruptDialog: () => set({ interruptDialog: undefined }),
    setHoveredRowId: (hoveredRowId) => set({ hoveredRowId }),
    toggleCollapsedSection: (section) =>
      set((state) => ({
        collapsedSections: { ...state.collapsedSections, [section]: !state.collapsedSections[section] },
      })),
    toggleVisualSelection: (sessionId) =>
      set((state) => {
        const visualMode = !state.visualMode
        if (!visualMode || !sessionId) return { visualMode }
        return { visualMode, selectedSessionIds: toggledSessionIds(state.selectedSessionIds, sessionId) }
      }),
    toggleSelectedSessionId: (sessionId) =>
      set((state) => {
        return { selectedSessionIds: toggledSessionIds(state.selectedSessionIds, sessionId) }
      }),
    clearMultiSelection: () => {
      const state = get()
      if (!state.visualMode && state.selectedSessionIds.size === 0) return false
      set({ visualMode: false, selectedSessionIds: new Set() })
      return true
    },
    setSelectionFromNavigation: (selection) =>
      set((state) => {
        const selectedSessionIds =
          state.visualMode && selection.type === "row" && selection.sessionId
            ? toggledSessionIds(state.selectedSessionIds, selection.sessionId)
            : state.selectedSessionIds
        return sameSelection(state.selection, selection) && selectedSessionIds === state.selectedSessionIds
          ? state
          : { selection, selectedSessionIds }
      }),
    setRowsForProject: (projectId, rows) =>
      set((state) => {
        if (state.rowsByProjectId[projectId] === rows) return state
        const rowsByProjectId = { ...state.rowsByProjectId, [projectId]: rows }
        if (state.activeTabId !== projectId) return { rowsByProjectId }

        return {
          rowsByProjectId,
          selectedSessionIds: retainSelectedSessionIds(
            state.selectedSessionIds,
            visibleSessionIds(rows, state.searchValue),
          ),
        }
      }),
    clearRowsByProject: () =>
      set({
        activeTabId: undefined,
        rowsByProjectId: {},
        visualMode: false,
        selectedSessionIds: new Set(),
        selection: { type: "section", section: "working", index: 0 },
      }),
    setSessionListState: (sessionListState) => set({ sessionListState }),
  }))
}

export function DashboardStoreProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<StoreApi<DashboardStore>>(undefined)

  if (!storeRef.current) {
    storeRef.current = createDashboardStore()
  }

  return createElement(DashboardStoreContext.Provider, { value: storeRef.current }, children)
}

export function useDashboardStore(): DashboardStore
export function useDashboardStore<T>(selector: (store: DashboardStore) => T): T
export function useDashboardStore<T>(selector?: (store: DashboardStore) => T): DashboardStore | T {
  const store = useContext(DashboardStoreContext)

  if (!store) {
    throw new Error("useDashboardStore must be used inside DashboardStoreProvider")
  }

  return selector ? useStore(store, selector) : useStore(store)
}

function sameSelection(left: Selection, right: Selection): boolean {
  return (
    left.section === right.section &&
    left.type === right.type &&
    left.index === right.index &&
    left.sessionId === right.sessionId
  )
}

function toggledSessionIds(current: ReadonlySet<string>, sessionId: string): ReadonlySet<string> {
  const next = new Set(current)
  if (next.has(sessionId)) next.delete(sessionId)
  else next.add(sessionId)
  return next
}

function retainSelectedSessionIds(current: ReadonlySet<string>, visibleIds: ReadonlySet<string>): ReadonlySet<string> {
  const next = new Set([...current].filter((id) => visibleIds.has(id)))
  return next.size === current.size ? current : next
}

function visibleSessionIds(rows: SessionRow[], searchValue: string): ReadonlySet<string> {
  return new Set(rows.filter((row) => fuzzySessionMatch(row, searchValue)).map((row) => row.id))
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

function omitAddSessionError(state: AddSessionDialogState): AddSessionDialogState {
  return {
    projectTitle: state.projectTitle,
    projectDirectory: state.projectDirectory,
    worktrees: state.worktrees,
    worktreeIndex: state.worktreeIndex,
    modelProviders: state.modelProviders,
    modelProviderIndex: state.modelProviderIndex,
    modelIndex: state.modelIndex,
    focus: state.focus,
    value: state.value,
    sending: state.sending,
  }
}

function omitPromptError(state: PromptDialogState): PromptDialogState {
  return {
    row: state.row,
    value: state.value,
    sending: state.sending,
    loadingPreview: state.loadingPreview,
    loadingMorePreview: state.loadingMorePreview,
  }
}
