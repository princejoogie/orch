import { createContext, useCallback, useContext, useRef, type ReactNode } from "react"
import { normalizeServerUrl, saveOrchConfig, serverNameFromUrl, type OrchConfig } from "../config/orch.ts"
import { AppRuntime } from "../effect/app-runtime.ts"
import { errorMessage } from "../lib/utils.ts"
import { useDashboardStore } from "../store/dashboard.ts"
import { useGlobalStore } from "../store/global.ts"

export type SettingsController = {
  switchServer: (serverUrl: string) => Promise<void>
  selectSettingsServer: (serverIndex: number) => Promise<void>
  addServerFromSettings: (serverUrl: string) => Promise<void>
}

const SettingsControllerContext = createContext<SettingsController | undefined>(undefined)

export function SettingsControllerProvider({ children }: { children: ReactNode }) {
  const controller = useSettingsController()

  return <SettingsControllerContext.Provider value={controller}>{children}</SettingsControllerContext.Provider>
}

export function useSettingsControllerContext(): SettingsController {
  const controller = useContext(SettingsControllerContext)

  if (!controller) {
    throw new Error("useSettingsControllerContext must be used inside SettingsControllerProvider")
  }

  return controller
}

function useSettingsController(): SettingsController {
  const dashboardStore = useDashboardStore()
  const globalStore = useGlobalStore()
  const dashboardStoreRef = useRef(dashboardStore)
  const globalStoreRef = useRef(globalStore)

  dashboardStoreRef.current = dashboardStore
  globalStoreRef.current = globalStore

  const persistConfig = useCallback(async (nextConfig: OrchConfig): Promise<OrchConfig> => {
    const previousServerUrl = globalStoreRef.current.config.activeServerUrl
    const savedConfig = await AppRuntime.runPromise(saveOrchConfig(nextConfig))
    if (savedConfig.activeServerUrl !== previousServerUrl) dashboardStoreRef.current.clearRowsByProject()
    globalStoreRef.current.setConfig(savedConfig)
    return savedConfig
  }, [])

  const switchServer = useCallback(
    async (serverUrl: string) => {
      const normalizedUrl = normalizeServerUrl(serverUrl)
      const nextConfig = await persistConfig({ ...globalStoreRef.current.config, activeServerUrl: normalizedUrl })
      if (globalStoreRef.current.settingsPage) globalStoreRef.current.syncSettingsFromConfig(nextConfig)
    },
    [persistConfig],
  )

  const selectSettingsServer = useCallback(
    async (serverIndex: number) => {
      globalStoreRef.current.selectSettingsServer(serverIndex)
      const server = globalStoreRef.current.settingsPage?.servers[serverIndex]
      if (!server) return

      try {
        await switchServer(server.url)
      } catch (settingsError) {
        console.error("Failed to switch server", settingsError)
        const detail = errorMessage(settingsError)
        globalStoreRef.current.setSettingsError(detail)
        globalStoreRef.current.addToast({ status: "error", title: "Failed to switch server", detail })
      }
    },
    [switchServer],
  )

  const addServerFromSettings = useCallback(
    async (serverUrl: string) => {
      const normalizedUrl = normalizeServerUrl(serverUrl)
      if (!normalizedUrl) return

      globalStoreRef.current.setSettingsSaving()
      try {
        const currentConfig = globalStoreRef.current.config
        const existing = currentConfig.servers.some((server) => server.url === normalizedUrl)
        const nextServers = existing
          ? currentConfig.servers
          : [...currentConfig.servers, { name: serverNameFromUrl(normalizedUrl), url: normalizedUrl }]
        const nextConfig = await persistConfig({ servers: nextServers, activeServerUrl: normalizedUrl })
        globalStoreRef.current.syncSettingsFromConfig(nextConfig)
      } catch (settingsError) {
        console.error("Failed to save server", settingsError)
        const detail = errorMessage(settingsError)
        globalStoreRef.current.setSettingsError(detail)
        globalStoreRef.current.addToast({ status: "error", title: "Failed to save server", detail })
      }
    },
    [persistConfig],
  )

  return { switchServer, selectSettingsServer, addServerFromSettings }
}
