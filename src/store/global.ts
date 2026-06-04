import { create } from "zustand"
import { defaultOrchConfig, type OrchConfig } from "../config/orch.ts"
import type { SettingsPageState } from "../pages/settings.tsx"

export type MenuId = "actions" | "selected" | "servers"
export type AppPage = "dashboard" | "settings"

export type ToastStatus = "loading" | "success" | "error"

export type Toast = {
  id: number
  status: ToastStatus
  title: string
  detail?: string | undefined
}

export type GlobalStore = {
  page: AppPage
  settingsPage?: SettingsPageState | undefined
  shortcutsDialogOpen: boolean
  selectedShortcutIndex: number
  openMenu?: MenuId | undefined
  selectedMenuIndex: number
  settingsClearVersion: number
  toasts: Toast[]
  config: OrchConfig
  nextToastId: number
  setPage: (page: AppPage) => void
  openSettingsPage: () => void
  closeSettingsPage: () => void
  setSettingsInput: (value: string) => void
  selectSettingsServer: (index: number) => void
  setSettingsSaving: () => void
  setSettingsError: (error: string) => void
  syncSettingsFromConfig: (config: OrchConfig) => void
  bumpSettingsClearVersion: () => void
  setShortcutsDialogOpen: (open: boolean) => void
  setSelectedShortcutIndex: (index: number) => void
  setOpenMenu: (menu?: MenuId | undefined) => void
  toggleMenu: (menu: MenuId) => void
  setSelectedMenuIndex: (index: number) => void
  setConfig: (config: OrchConfig) => void
  addToast: (toast: Omit<Toast, "id">) => number
  updateToast: (id: number, update: Omit<Toast, "id">) => void
  dismissToast: (id: number) => void
}

export const useGlobalStore = create<GlobalStore>((set, get) => ({
  page: "dashboard",
  shortcutsDialogOpen: false,
  selectedShortcutIndex: 0,
  selectedMenuIndex: 0,
  settingsClearVersion: 0,
  toasts: [],
  config: defaultOrchConfig(),
  nextToastId: 1,
  setPage: (page) => set({ page }),
  openSettingsPage: () =>
    set((state) => ({ page: "settings", openMenu: undefined, settingsPage: settingsStateFromConfig(state.config) })),
  closeSettingsPage: () => set({ page: "dashboard", settingsPage: undefined }),
  setSettingsInput: (value) =>
    set((state) => ({
      settingsPage: state.settingsPage
        ? omitSettingsError({ ...state.settingsPage, serverUrlValue: value })
        : undefined,
    })),
  selectSettingsServer: (index) =>
    set((state) => ({
      settingsPage: state.settingsPage ? { ...state.settingsPage, selectedServerIndex: index } : undefined,
    })),
  setSettingsSaving: () =>
    set((state) => ({
      settingsPage: state.settingsPage ? omitSettingsError({ ...state.settingsPage, saving: true }) : undefined,
    })),
  setSettingsError: (error) =>
    set((state) => ({
      settingsPage: state.settingsPage ? { ...state.settingsPage, saving: false, error } : undefined,
    })),
  syncSettingsFromConfig: (config) =>
    set((state) => ({
      settingsPage: settingsStateFromConfig(config),
      settingsClearVersion: state.settingsClearVersion + 1,
    })),
  bumpSettingsClearVersion: () => set((state) => ({ settingsClearVersion: state.settingsClearVersion + 1 })),
  setShortcutsDialogOpen: (open) => set({ shortcutsDialogOpen: open }),
  setSelectedShortcutIndex: (index) => set({ selectedShortcutIndex: index }),
  setOpenMenu: (openMenu) => set({ openMenu }),
  toggleMenu: (menu) =>
    set((state) => {
      const openMenu = state.openMenu === menu ? undefined : menu
      return openMenu ? { openMenu, selectedMenuIndex: 0 } : { openMenu }
    }),
  setSelectedMenuIndex: (index) => set({ selectedMenuIndex: index }),
  setConfig: (config) => set({ config }),
  addToast: (toast) => {
    const id = get().nextToastId
    set((state) => ({ nextToastId: id + 1, toasts: [...state.toasts, { id, ...toast }].slice(-4) }))
    return id
  },
  updateToast: (id, update) =>
    set((state) => ({ toasts: state.toasts.map((toast) => (toast.id === id ? { id, ...update } : toast)) })),
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}))

function settingsStateFromConfig(config: OrchConfig): SettingsPageState {
  return {
    servers: config.servers,
    activeServerUrl: config.activeServerUrl,
    selectedServerIndex: Math.max(
      0,
      config.servers.findIndex((server) => server.url === config.activeServerUrl),
    ),
    serverUrlValue: "",
    saving: false,
  }
}

function omitSettingsError(state: SettingsPageState): SettingsPageState {
  return {
    servers: state.servers,
    activeServerUrl: state.activeServerUrl,
    selectedServerIndex: state.selectedServerIndex,
    serverUrlValue: state.serverUrlValue,
    saving: state.saving,
  }
}
