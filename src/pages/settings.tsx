import { TextAttributes } from "@opentui/core"
import type { OrchServer } from "../config/orch.ts"
import { serverNameFromUrl } from "../config/orch.ts"
import { AppRuntime } from "../effect/app-runtime.ts"
import { useSettingsControllerContext } from "../hooks/use-settings-controller.tsx"
import { clamp } from "../lib/utils.ts"
import { useGlobalStore } from "../store/global.ts"
import { theme } from "../theme.ts"
import { Button, ButtonRow, ButtonSpacer } from "../components/ui/button.tsx"
import { DialogError, DialogLabel, DialogTextarea, PlainLine, fitCell } from "../components/ui/dialog.tsx"
import { MenuList, type MenuItem } from "../components/ui/menu-dropdown.tsx"

export type SettingsPageState = {
  servers: OrchServer[]
  activeServerUrl: string
  selectedServerIndex: number
  serverUrlValue: string
  saving: boolean
  error?: string | undefined
}

export function SettingsPage({ width, height }: { width: number; height: number }) {
  const settingsController = useSettingsControllerContext()
  const globalStore = useGlobalStore()
  const state = globalStore.settingsPage

  if (!state) return null

  const contentWidth = Math.max(1, width - 4)
  const serverLines = Math.min(Math.max(state.servers.length, 1), Math.max(1, height - 11), 10)
  const serverStart = clamp(
    state.selectedServerIndex - serverLines + 1,
    0,
    Math.max(0, state.servers.length - serverLines),
  )
  const serverMenuItems: MenuItem[] = state.servers.map((server, index) => ({
    label: server.name,
    shortcut: server.url === state.activeServerUrl ? "active" : "switch",
    run: () => void AppRuntime.runPromise(settingsController.selectSettingsServer(index)),
  }))

  return (
    <box
      style={{
        flexDirection: "column",
        flexShrink: 0,
        width,
        height,
        paddingLeft: 2,
        paddingRight: 2,
        paddingTop: 1,
        paddingBottom: 1,
      }}
    >
      <box style={{ height: 1, width: contentWidth, flexDirection: "row" }}>
        <text content="Settings" style={{ fg: theme.primary, attributes: TextAttributes.BOLD }} />
        <text
          content={fitCell(state.saving ? "saving" : "opencode", Math.max(1, contentWidth - 8), "right")}
          style={{ fg: theme.textMuted }}
        />
      </box>
      <PlainLine text={fitCell(state.activeServerUrl, contentWidth)} fg={theme.textMuted} />
      <box style={{ height: 1 }} />
      <DialogLabel>Servers</DialogLabel>
      <box style={{ flexDirection: "column", height: serverLines, width: contentWidth }}>
        {state.servers.length > 0 ? (
          <MenuList
            items={serverMenuItems}
            selectedIndex={state.selectedServerIndex}
            visibleStart={serverStart}
            visibleCount={serverLines}
            width={contentWidth}
            onSelect={globalStore.selectSettingsServer}
          />
        ) : (
          <PlainLine text="No servers configured." fg={theme.textMuted} />
        )}
      </box>
      <box style={{ height: 1 }} />
      <DialogLabel>Add opencode server</DialogLabel>
      <DialogTextarea
        value={state.serverUrlValue}
        placeholder={`URL, e.g. http://${serverNameFromUrl("http://localhost:4096")}`}
        focused={!state.saving}
        height={1}
        clearVersion={globalStore.settingsClearVersion}
        onInput={globalStore.setSettingsInput}
        onSubmit={(serverUrl) => void AppRuntime.runPromise(settingsController.addServerFromSettings(serverUrl))}
      />
      <DialogError error={state.error} width={contentWidth} />
      <box style={{ flexGrow: 1 }} />
      <ButtonRow width={30}>
        <Button
          label="Add server"
          shortcut="enter"
          width={18}
          disabled={state.saving || state.serverUrlValue.trim().length === 0}
          onPress={() => void AppRuntime.runPromise(settingsController.addServerFromSettings(state.serverUrlValue))}
        />
        <ButtonSpacer />
        <Button label="Back" shortcut="esc" width={11} onPress={globalStore.closeSettingsPage} />
      </ButtonRow>
    </box>
  )
}
