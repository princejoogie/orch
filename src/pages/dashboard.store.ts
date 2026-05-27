import { createContext, createElement, useContext, useRef, type ReactNode } from "react"
import { createStore, type StoreApi } from "zustand/vanilla"
import { useStore } from "zustand"
import type { AddSessionDialogState, DeleteSessionDialogState, PromptDialogState, Selection } from "../lib/utils.ts"

type LatestMessageState = Record<string, { updated: number; text: string }>
type ContextUsageState = Record<string, { updated: number; tokens?: number; percent?: number }>

export type DashboardStore = {
  activeTabId?: string
  selection: Selection
  searchValue: string
  searchFocused: boolean
  promptDialog?: PromptDialogState
  addSessionDialog?: AddSessionDialogState
  deleteSessionDialog?: DeleteSessionDialogState
  deletingSessionID?: string
  deleteError?: string
  latestMessages: LatestMessageState
  contextUsage: ContextUsageState
  setActiveTabId: (activeTabId?: string) => void
  setSelection: (selection: Selection | ((current: Selection) => Selection)) => void
  setSearchValue: (searchValue: string) => void
  setSearchFocused: (searchFocused: boolean) => void
  setPromptDialog: (
    promptDialog?: PromptDialogState | ((current?: PromptDialogState) => PromptDialogState | undefined),
  ) => void
  setAddSessionDialog: (
    addSessionDialog?: AddSessionDialogState | ((current?: AddSessionDialogState) => AddSessionDialogState | undefined),
  ) => void
  setDeleteSessionDialog: (deleteSessionDialog?: DeleteSessionDialogState) => void
  setDeletingSessionID: (deletingSessionID?: string) => void
  setDeleteError: (deleteError?: string) => void
  setLatestMessage: (sessionID: string, message: { updated: number; text: string }) => void
  removeLatestMessage: (sessionID: string) => void
  setContextUsage: (sessionID: string, usage: { updated: number; tokens?: number; percent?: number }) => void
  removeContextUsage: (sessionID: string) => void
}

const DashboardStoreContext = createContext<StoreApi<DashboardStore> | undefined>(undefined)

function createDashboardStore() {
  return createStore<DashboardStore>((set) => ({
    selection: { section: "working", index: 0 },
    searchValue: "",
    searchFocused: false,
    latestMessages: {},
    contextUsage: {},
    setActiveTabId: (activeTabId) => set({ activeTabId }),
    setSelection: (selection) =>
      set((state) => ({ selection: typeof selection === "function" ? selection(state.selection) : selection })),
    setSearchValue: (searchValue) => set({ searchValue }),
    setSearchFocused: (searchFocused) => set({ searchFocused }),
    setPromptDialog: (promptDialog) =>
      set((state) => ({
        promptDialog: typeof promptDialog === "function" ? promptDialog(state.promptDialog) : promptDialog,
      })),
    setAddSessionDialog: (addSessionDialog) =>
      set((state) => ({
        addSessionDialog:
          typeof addSessionDialog === "function" ? addSessionDialog(state.addSessionDialog) : addSessionDialog,
      })),
    setDeleteSessionDialog: (deleteSessionDialog) => set({ deleteSessionDialog }),
    setDeletingSessionID: (deletingSessionID) => set({ deletingSessionID }),
    setDeleteError: (deleteError) => set({ deleteError }),
    setLatestMessage: (sessionID, message) =>
      set((state) => ({ latestMessages: { ...state.latestMessages, [sessionID]: message } })),
    removeLatestMessage: (sessionID) =>
      set((state) => {
        const latestMessages = { ...state.latestMessages }
        delete latestMessages[sessionID]
        return { latestMessages }
      }),
    setContextUsage: (sessionID, usage) =>
      set((state) => ({ contextUsage: { ...state.contextUsage, [sessionID]: usage } })),
    removeContextUsage: (sessionID) =>
      set((state) => {
        const contextUsage = { ...state.contextUsage }
        delete contextUsage[sessionID]
        return { contextUsage }
      }),
  }))
}

export function DashboardStoreProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<StoreApi<DashboardStore>>(undefined)

  if (!storeRef.current) {
    storeRef.current = createDashboardStore()
  }

  return createElement(DashboardStoreContext.Provider, { value: storeRef.current }, children)
}

export function useDashboardStore<T>(selector: (store: DashboardStore) => T): T {
  const store = useContext(DashboardStoreContext)

  if (!store) {
    throw new Error("useDashboardStore must be used inside DashboardStoreProvider")
  }

  return useStore(store, selector)
}
