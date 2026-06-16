import { createContext, createElement, useContext, useRef, type ReactNode } from "react"
import { createStore, type StoreApi } from "zustand/vanilla"
import { useStore } from "zustand"
import { Data } from "effect"
import type {
  AddSessionDialogState,
  CollapsedSections,
  DeleteSessionDialogState,
  DeleteWorktreeDialogState,
  InterruptSessionDialogState,
  PermissionDialogState,
  PromptDialogState,
  Selection,
  WorktreeOption,
} from "../lib/utils.ts"
import type { DashboardSnapshot, SessionRow } from "../opencode/client/index.ts"

export type SessionListState = {
  snapshot?: DashboardSnapshot | undefined
  pending: boolean
  error?: string | undefined
  refetch?: (() => void) | undefined
}

export type DashboardStore = {
  activeTabId?: string | undefined
  activeWorktreeByProjectId: Record<string, string>
  selection: Selection
  searchValue: string
  searchFocused: boolean
  addSessionDialog?: AddSessionDialogState | undefined
  deleteWorktreeDialog?: DeleteWorktreeDialogState | undefined
  permissionDialog?: PermissionDialogState | undefined
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
  setActiveWorktreeDirectory: (projectId: string, directory?: string | undefined) => void
  setSelection: (selection: Selection) => void
  setSearchValue: (searchValue: string) => void
  setSearchFocused: (searchFocused: boolean) => void
  bumpSearchClearVersion: () => void
  openAddSessionDialog: (state: AddSessionDialogState) => void
  closeAddSessionDialog: () => void
  setAddSessionValue: (value: string) => void
  setAddSessionWorktreeIndex: (worktreeIndex: number) => void
  setAddSessionModelOptions: (
    projectDirectory: string,
    modelDirectory: string,
    workspaceID: string | undefined,
    modelProviders: AddSessionDialogState["modelProviders"],
    modelProviderIndex: number,
    modelIndex: number,
    variantIndex: number,
  ) => void
  setAddSessionModelProviderIndex: (modelProviderIndex: number) => void
  setAddSessionModelIndex: (modelIndex: number) => void
  setAddSessionVariantIndex: (variantIndex: number) => void
  addAddSessionWorktree: (worktree: WorktreeOption) => void
  removeAddSessionWorktree: (directory: string) => void
  setAddSessionFocus: (focus: AddSessionDialogState["focus"]) => void
  setAddSessionSending: () => void
  setAddSessionError: (error: string) => void
  bumpAddSessionClearVersion: () => void
  openDeleteWorktreeDialog: (state: DeleteWorktreeDialogState) => void
  closeDeleteWorktreeDialog: () => void
  openPermissionDialog: (state: PermissionDialogState) => void
  closePermissionDialog: () => void
  setPermissionResponding: () => void
  setPermissionError: (error: string) => void
  openPromptDialog: (state: PromptDialogState) => void
  closePromptDialog: () => void
  setPromptValue: (value: string) => void
  setPromptModelOptions: (
    sessionId: string,
    modelProviders: PromptDialogState["modelProviders"],
    modelProviderIndex: number,
    modelIndex: number,
    variantIndex: number,
  ) => void
  setPromptModelProviderIndex: (modelProviderIndex: number) => void
  setPromptModelIndex: (modelIndex: number) => void
  setPromptVariantIndex: (variantIndex: number) => void
  setPromptFocus: (focus: PromptDialogState["focus"]) => void
  setPromptSending: () => void
  setPromptSent: () => void
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

export class DashboardStoreProviderError extends Data.TaggedError("DashboardStoreProviderError")<{
  readonly message: string
}> {}

const DashboardStoreContext = createContext<StoreApi<DashboardStore> | undefined>(undefined)

function createDashboardStore() {
  return createStore<DashboardStore>((set, get) => ({
    activeWorktreeByProjectId: {},
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
    setActiveWorktreeDirectory: (projectId, directory) =>
      set((state) => {
        if (state.activeWorktreeByProjectId[projectId] === directory) return state
        const activeWorktreeByProjectId = { ...state.activeWorktreeByProjectId }
        if (directory) activeWorktreeByProjectId[projectId] = directory
        else delete activeWorktreeByProjectId[projectId]
        if (state.activeTabId !== projectId) return { activeWorktreeByProjectId }

        return {
          activeWorktreeByProjectId,
          visualMode: false,
          selectedSessionIds: new Set(),
          selection: { type: "section", section: "working", index: 0 },
        }
      }),
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
      set((state) => {
        const activeProjectId = state.activeTabId ?? ""
        return {
          searchValue,
          selectedSessionIds: retainSelectedSessionIds(
            state.selectedSessionIds,
            visibleSessionIds(
              state.rowsByProjectId[activeProjectId] ?? [],
              searchValue,
              state.activeWorktreeByProjectId[activeProjectId],
            ),
          ),
        }
      }),
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
      set((state) => {
        if (!state.addSessionDialog) return { addSessionDialog: undefined }
        if (state.addSessionDialog.worktreeIndex === worktreeIndex) return state
        const currentContext = addSessionModelContext(state.addSessionDialog, state.addSessionDialog.worktreeIndex)
        const nextContext = addSessionModelContext(state.addSessionDialog, worktreeIndex)
        if (
          currentContext.directory === nextContext.directory &&
          currentContext.workspaceID === nextContext.workspaceID
        ) {
          return {
            addSessionDialog: {
              ...state.addSessionDialog,
              worktreeIndex,
            },
          }
        }
        return {
          addSessionDialog: {
            ...state.addSessionDialog,
            worktreeIndex,
            modelProviders: [],
            modelProviderIndex: 0,
            modelIndex: 0,
            variantIndex: 0,
          },
        }
      }),
    setAddSessionModelOptions: (
      projectDirectory,
      modelDirectory,
      workspaceID,
      modelProviders,
      modelProviderIndex,
      modelIndex,
      variantIndex,
    ) =>
      set((state) => {
        if (!state.addSessionDialog || state.addSessionDialog.projectDirectory !== projectDirectory) return state
        const selectedWorktree = state.addSessionDialog.worktrees[state.addSessionDialog.worktreeIndex]
        const currentModelDirectory = selectedWorktree?.directory ?? state.addSessionDialog.projectDirectory
        const currentWorkspaceID = selectedWorktree ? selectedWorktree.workspaceID : state.addSessionDialog.workspaceID
        if (currentModelDirectory !== modelDirectory || currentWorkspaceID !== workspaceID) return state
        return {
          addSessionDialog: {
            ...state.addSessionDialog,
            modelProviders,
            modelProviderIndex,
            modelIndex,
            variantIndex,
          },
        }
      }),
    setAddSessionModelProviderIndex: (modelProviderIndex) =>
      set((state) => ({
        addSessionDialog: state.addSessionDialog
          ? { ...state.addSessionDialog, modelProviderIndex, modelIndex: 0, variantIndex: 0 }
          : undefined,
      })),
    setAddSessionModelIndex: (modelIndex) =>
      set((state) => ({
        addSessionDialog: state.addSessionDialog
          ? { ...state.addSessionDialog, modelIndex, variantIndex: 0 }
          : undefined,
      })),
    setAddSessionVariantIndex: (variantIndex) =>
      set((state) => ({
        addSessionDialog: state.addSessionDialog ? { ...state.addSessionDialog, variantIndex } : undefined,
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
    openPermissionDialog: (permissionDialog) => set({ permissionDialog, promptDialog: undefined }),
    closePermissionDialog: () => set({ permissionDialog: undefined }),
    setPermissionResponding: () =>
      set((state) => ({
        permissionDialog: state.permissionDialog
          ? omitPermissionError({ ...state.permissionDialog, responding: true })
          : undefined,
      })),
    setPermissionError: (error) =>
      set((state) => ({
        permissionDialog: state.permissionDialog ? { ...state.permissionDialog, responding: false, error } : undefined,
      })),
    openPromptDialog: (promptDialog) => set({ promptDialog }),
    closePromptDialog: () => set({ promptDialog: undefined }),
    setPromptValue: (value) =>
      set((state) => ({
        promptDialog: state.promptDialog ? omitPromptError({ ...state.promptDialog, value }) : undefined,
      })),
    setPromptModelOptions: (sessionId, modelProviders, modelProviderIndex, modelIndex, variantIndex) =>
      set((state) => {
        if (!state.promptDialog || state.promptDialog.row.id !== sessionId) return state
        return {
          promptDialog: {
            ...state.promptDialog,
            modelProviders,
            modelProviderIndex,
            modelIndex,
            variantIndex,
          },
        }
      }),
    setPromptModelProviderIndex: (modelProviderIndex) =>
      set((state) => ({
        promptDialog: state.promptDialog
          ? { ...state.promptDialog, modelProviderIndex, modelIndex: 0, variantIndex: 0 }
          : undefined,
      })),
    setPromptModelIndex: (modelIndex) =>
      set((state) => ({
        promptDialog: state.promptDialog ? { ...state.promptDialog, modelIndex, variantIndex: 0 } : undefined,
      })),
    setPromptVariantIndex: (variantIndex) =>
      set((state) => ({
        promptDialog: state.promptDialog ? { ...state.promptDialog, variantIndex } : undefined,
      })),
    setPromptFocus: (focus) =>
      set((state) => ({
        promptDialog: state.promptDialog ? { ...state.promptDialog, focus } : undefined,
      })),
    setPromptSending: () =>
      set((state) => ({
        promptDialog: state.promptDialog ? omitPromptError({ ...state.promptDialog, sending: true }) : undefined,
      })),
    setPromptSent: () =>
      set((state) => ({
        promptClearVersion: state.promptClearVersion + 1,
        promptDialog: state.promptDialog
          ? omitPromptError({ ...state.promptDialog, value: "", sending: false, focus: "input" })
          : undefined,
      })),
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
        const permissionRow = state.permissionDialog
          ? rows.find((row) => row.id === state.permissionDialog?.row.id)
          : undefined
        const permissionRequest = permissionRow?.pendingPermissionRequests.find(
          (request) => request.id === state.permissionDialog?.request.id,
        )
        const permissionDialog =
          state.permissionDialog && permissionRow
            ? {
                ...state.permissionDialog,
                row: permissionRow,
                request: permissionRequest ?? state.permissionDialog.request,
              }
            : state.permissionDialog
        const promptRow = state.promptDialog ? rows.find((row) => row.id === state.promptDialog?.row.id) : undefined
        const promptDialog =
          state.promptDialog && promptRow ? { ...state.promptDialog, row: promptRow } : state.promptDialog
        if (state.activeTabId !== projectId) return { rowsByProjectId, permissionDialog, promptDialog }

        return {
          rowsByProjectId,
          permissionDialog,
          promptDialog,
          selectedSessionIds: retainSelectedSessionIds(
            state.selectedSessionIds,
            visibleSessionIds(rows, state.searchValue, state.activeWorktreeByProjectId[projectId]),
          ),
        }
      }),
    clearRowsByProject: () =>
      set({
        activeTabId: undefined,
        activeWorktreeByProjectId: {},
        rowsByProjectId: {},
        permissionDialog: undefined,
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
    throw new DashboardStoreProviderError({ message: "useDashboardStore must be used inside DashboardStoreProvider" })
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

function addSessionModelContext(
  state: AddSessionDialogState,
  worktreeIndex: number,
): { directory: string; workspaceID?: string | undefined } {
  const worktree = state.worktrees[worktreeIndex]
  const workspaceID = worktree ? worktree.workspaceID : state.workspaceID
  return {
    directory: worktree?.directory ?? state.projectDirectory,
    ...(workspaceID !== undefined ? { workspaceID } : {}),
  }
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

function visibleSessionIds(
  rows: SessionRow[],
  searchValue: string,
  worktreeDirectory: string | undefined,
): ReadonlySet<string> {
  return new Set(
    rows
      .filter(
        (row) => (!worktreeDirectory || row.directory === worktreeDirectory) && fuzzySessionMatch(row, searchValue),
      )
      .map((row) => row.id),
  )
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
    ...(state.workspaceID !== undefined ? { workspaceID: state.workspaceID } : {}),
    ...(state.initialModel !== undefined ? { initialModel: state.initialModel } : {}),
    worktrees: state.worktrees,
    worktreeIndex: state.worktreeIndex,
    modelProviders: state.modelProviders,
    modelProviderIndex: state.modelProviderIndex,
    modelIndex: state.modelIndex,
    variantIndex: state.variantIndex,
    focus: state.focus,
    value: state.value,
    sending: state.sending,
  }
}

function omitPermissionError(state: PermissionDialogState): PermissionDialogState {
  return {
    row: state.row,
    request: state.request,
    ...(state.responding !== undefined ? { responding: state.responding } : {}),
  }
}

function omitPromptError(state: PromptDialogState): PromptDialogState {
  return {
    row: state.row,
    modelProviders: state.modelProviders,
    modelProviderIndex: state.modelProviderIndex,
    modelIndex: state.modelIndex,
    variantIndex: state.variantIndex,
    focus: state.focus,
    value: state.value,
    sending: state.sending,
  }
}
