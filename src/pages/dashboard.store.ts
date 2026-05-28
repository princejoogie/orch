import { createContext, createElement, useContext, useRef, type ReactNode } from "react"
import { createStore, type StoreApi } from "zustand/vanilla"
import { useStore } from "zustand"
import type { Selection } from "../lib/utils.ts"

export type DashboardStore = {
  activeTabId?: string | undefined
  selection: Selection
  searchValue: string
  searchFocused: boolean
  setActiveTabId: (activeTabId?: string | undefined) => void
  setSelection: (selection: Selection | ((current: Selection) => Selection)) => void
  setSearchValue: (searchValue: string) => void
  setSearchFocused: (searchFocused: boolean) => void
}

const DashboardStoreContext = createContext<StoreApi<DashboardStore> | undefined>(undefined)

function createDashboardStore() {
  return createStore<DashboardStore>((set) => ({
    selection: { type: "section", section: "working", index: 0 },
    searchValue: "",
    searchFocused: false,
    setActiveTabId: (activeTabId) => set({ activeTabId }),
    setSelection: (selection) =>
      set((state) => {
        const next = typeof selection === "function" ? selection(state.selection) : selection
        return state.selection.section === next.section &&
          state.selection.type === next.type &&
          state.selection.index === next.index &&
          state.selection.sessionId === next.sessionId
          ? state
          : { selection: next }
      }),
    setSearchValue: (searchValue) => set({ searchValue }),
    setSearchFocused: (searchFocused) => set({ searchFocused }),
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
