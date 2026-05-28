import type { OrchServer } from "../config/orch.ts"
import { serverNameFromUrl } from "../config/orch.ts"
import { clamp, truncate } from "../lib/utils.ts"
import { theme } from "../theme.ts"
import { Button, ButtonRow, ButtonSpacer, DialogFooterActions } from "./ui/button.tsx"
import {
  DialogError,
  DialogLabel,
  DialogOption,
  DialogTextarea,
  fitCell,
  HintRow,
  PlainLine,
  StandardDialogFrame,
} from "./ui/dialog.tsx"

export type SettingsDialogState = {
  servers: OrchServer[]
  activeServerUrl: string
  selectedServerIndex: number
  serverUrlValue: string
  saving: boolean
  error?: string | undefined
}

export function SettingsDialog({
  state,
  width,
  height,
  clearVersion,
  onInput,
  onServerSelect,
  onAddServer,
  onClose,
}: {
  state: SettingsDialogState
  width: number
  height: number
  clearVersion: number
  onInput: (value: string) => void
  onServerSelect: (index: number) => void
  onAddServer: (value: string) => void
  onClose: () => void
}) {
  const dialogWidth = Math.min(Math.max(56, Math.floor(width * 0.7)), 84, width - 4)
  const serverLines = Math.min(Math.max(state.servers.length, 1), 6)
  const serverStart = clamp(
    state.selectedServerIndex - serverLines + 1,
    0,
    Math.max(0, state.servers.length - serverLines),
  )
  const inputHeight = 1
  const bodyHeight = 2 + serverLines + inputHeight + 3 + (state.error ? 1 : 0)
  const dialogHeight = Math.max(1, Math.min(height - 2, bodyHeight + 7))

  return (
    <StandardDialogFrame
      screenWidth={width}
      screenHeight={height}
      width={dialogWidth}
      height={dialogHeight}
      danger={Boolean(state.error)}
      title="Settings"
      headerRight={state.saving ? "saving" : "opencode"}
      subtitle={<PlainLine text={fitCell(state.activeServerUrl, dialogWidth - 4)} fg={theme.textMuted} />}
      onClose={onClose}
      footer={
        <DialogFooterActions
          width={dialogWidth - 4}
          actionsWidth={30}
          hints={<HintRow items={[{ key: "tab", label: "server" }]} />}
        >
          <ButtonRow width={30}>
            <Button
              label="Add server"
              shortcut="↵"
              width={17}
              disabled={state.saving || state.serverUrlValue.trim().length === 0}
              onPress={() => onAddServer(state.serverUrlValue)}
            />
            <ButtonSpacer />
            <Button label="Close" shortcut="esc" width={12} onPress={onClose} />
          </ButtonRow>
        </DialogFooterActions>
      }
    >
      <DialogLabel>Servers</DialogLabel>
      <box style={{ flexDirection: "column", height: serverLines }}>
        {state.servers.length > 0 ? (
          state.servers.slice(serverStart, serverStart + serverLines).map((server, offset) => {
            const index = serverStart + offset
            return (
              <DialogOption
                key={server.url}
                selected={index === state.selectedServerIndex}
                onSelect={() => onServerSelect(index)}
              >
                {truncate(
                  `${server.url === state.activeServerUrl ? "*" : " "} ${server.name} ${server.url}`,
                  dialogWidth - 6,
                )}
              </DialogOption>
            )
          })
        ) : (
          <PlainLine text="No servers configured." fg={theme.textMuted} />
        )}
      </box>
      <DialogLabel>Add opencode server</DialogLabel>
      <DialogTextarea
        value={state.serverUrlValue}
        placeholder={`URL, e.g. http://${serverNameFromUrl("http://localhost:4096")}`}
        focused={!state.saving}
        height={inputHeight}
        clearVersion={clearVersion}
        onInput={onInput}
        onSubmit={onAddServer}
      />
      <DialogError error={state.error} width={dialogWidth} />
    </StandardDialogFrame>
  )
}
