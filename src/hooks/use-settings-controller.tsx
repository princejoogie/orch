import { Data, Effect } from "effect"
import { createContext, useCallback, useContext, useRef, type ReactNode } from "react"
import { normalizeServerUrl, saveOrchConfig, serverNameFromUrl, type OrchConfig } from "../config/orch.ts"
import type { OrchFileError } from "../config/persistence.ts"
import { errorMessage } from "../lib/utils.ts"
import { useDashboardStore } from "../store/dashboard.ts"
import { useGlobalStore } from "../store/global.ts"

export type SettingsController = {
  switchServer: (serverUrl: string) => Effect.Effect<void, OrchFileError>
  selectSettingsServer: (serverIndex: number) => Effect.Effect<void>
  addServerFromSettings: (serverUrl: string) => Effect.Effect<void>
}

const SettingsControllerContext = createContext<SettingsController | undefined>(undefined)

class SettingsControllerProviderError extends Data.TaggedError("SettingsControllerProviderError")<{
  readonly message: string
}> {}

export function SettingsControllerProvider({ children }: { children: ReactNode }) {
  const controller = useSettingsController()

  return <SettingsControllerContext.Provider value={controller}>{children}</SettingsControllerContext.Provider>
}

export function useSettingsControllerContext(): SettingsController {
  const controller = useContext(SettingsControllerContext)

  if (!controller) {
    throw new SettingsControllerProviderError({
      message: "useSettingsControllerContext must be used inside SettingsControllerProvider",
    })
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

  const persistConfig = useCallback(
    (nextConfig: OrchConfig): Effect.Effect<OrchConfig, OrchFileError> =>
      Effect.gen(function* () {
        const previousServerUrl = globalStoreRef.current.config.activeServerUrl
        const savedConfig = yield* saveOrchConfig(nextConfig)
        if (savedConfig.activeServerUrl !== previousServerUrl) dashboardStoreRef.current.clearRowsByProject()
        globalStoreRef.current.setConfig(savedConfig)
        return savedConfig
      }),
    [],
  )

  const switchServer = useCallback(
    (serverUrl: string) =>
      Effect.gen(function* () {
        const normalizedUrl = normalizeServerUrl(serverUrl)
        const nextConfig = yield* persistConfig({ ...globalStoreRef.current.config, activeServerUrl: normalizedUrl })
        if (globalStoreRef.current.settingsPage) globalStoreRef.current.syncSettingsFromConfig(nextConfig)
      }),
    [persistConfig],
  )

  const selectSettingsServer = useCallback(
    (serverIndex: number) =>
      Effect.gen(function* () {
        globalStoreRef.current.selectSettingsServer(serverIndex)
        const server =
          globalStoreRef.current.settingsPage?.servers[serverIndex] ??
          globalStoreRef.current.config.servers[serverIndex]
        if (!server) return

        yield* switchServer(server.url).pipe(
          Effect.catchAll((settingsError) =>
            Effect.sync(() => {
              console.error("Failed to switch server", settingsError)
              const detail = errorMessage(settingsError)
              globalStoreRef.current.setSettingsError(detail)
              globalStoreRef.current.addToast({ status: "error", title: "Failed to switch server", detail })
            }),
          ),
        )
      }),
    [switchServer],
  )

  const addServerFromSettings = useCallback(
    (serverUrl: string) =>
      Effect.gen(function* () {
        const normalizedUrl = normalizeServerUrl(serverUrl)
        if (!normalizedUrl) return

        globalStoreRef.current.setSettingsSaving()
        const currentConfig = globalStoreRef.current.config
        const existing = currentConfig.servers.some((server) => server.url === normalizedUrl)
        const nextServers = existing
          ? currentConfig.servers
          : [...currentConfig.servers, { name: serverNameFromUrl(normalizedUrl), url: normalizedUrl }]
        yield* persistConfig({ servers: nextServers, activeServerUrl: normalizedUrl }).pipe(
          Effect.tap((nextConfig) => Effect.sync(() => globalStoreRef.current.syncSettingsFromConfig(nextConfig))),
          Effect.catchAll((settingsError) =>
            Effect.sync(() => {
              console.error("Failed to save server", settingsError)
              const detail = errorMessage(settingsError)
              globalStoreRef.current.setSettingsError(detail)
              globalStoreRef.current.addToast({ status: "error", title: "Failed to save server", detail })
            }),
          ),
        )
      }),
    [persistConfig],
  )

  return { switchServer, selectSettingsServer, addServerFromSettings }
}
