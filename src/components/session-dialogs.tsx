import {
  DialogError,
  DialogLabel,
  DialogOption,
  DialogTextarea,
  DialogTextLines,
  fitCell,
  HintRow,
  PlainLine,
  StandardDialogFrame,
} from "./ui/dialog.tsx"
import { Button, ButtonRow, ButtonSpacer, DialogFooterActions } from "./ui/button.tsx"
import {
  clamp,
  truncate,
  wrapText,
  type AddSessionDialogState,
  type DeleteSessionDialogState,
  type PromptDialogState,
} from "../lib/utils.ts"
import { theme } from "../theme.ts"

export function PromptDialog({
  state,
  width,
  height,
  onInput,
  onSubmit,
  onCancel,
  clearVersion,
}: {
  state: PromptDialogState
  width: number
  height: number
  onInput: (value: string) => void
  onSubmit: (value: string) => void
  onCancel: () => void
  clearVersion: number
}) {
  const dialogWidth = Math.min(Math.max(48, Math.floor(width * 0.7)), 80, width - 4)
  const inputHeight = 5
  const previewHeight = 3
  const previewBlockHeight = previewHeight + 2
  const inputBlockHeight = inputHeight + 3
  const bodyHeight = 2 + previewBlockHeight * 2 + inputBlockHeight + (state.error ? 1 : 0)
  const userLines = state.loadingPreview
    ? [{ key: "loading", text: "Loading user message..." }]
    : wrapText(state.latestUserMessage ?? "", dialogWidth - 6, previewHeight, "No previous user message.")
  const assistantLines = state.loadingPreview
    ? [{ key: "loading", text: "Loading assistant message..." }]
    : wrapText(state.row.latestMessage, dialogWidth - 6, previewHeight)
  const dialogHeight = Math.min(height - 2, bodyHeight + 7)

  return (
    <StandardDialogFrame
      screenWidth={width}
      screenHeight={height}
      width={dialogWidth}
      height={dialogHeight}
      danger={Boolean(state.error)}
      title="Prompt session"
      headerRight={state.sending ? "sending" : undefined}
      subtitle={<PlainLine text={fitCell(state.row.title, dialogWidth - 4)} fg={theme.textMuted} />}
      onClose={onCancel}
      footer={
        <DialogFooterActions
          width={dialogWidth - 4}
          actionsWidth={25}
          hints={<HintRow items={[{ key: "shift-enter", label: "newline" }]} />}
        >
          <ButtonRow width={25}>
            <Button
              label="Send"
              shortcut="↵"
              width={10}
              disabled={state.sending || state.value.trim().length === 0}
              onPress={() => onSubmit(state.value)}
            />
            <ButtonSpacer />
            <Button label="Cancel" shortcut="esc" width={14} onPress={onCancel} />
          </ButtonRow>
        </DialogFooterActions>
      }
    >
      <DialogLabel>User:</DialogLabel>
      <DialogTextLines lines={userLines} height={previewHeight} />
      <DialogLabel>Assistant:</DialogLabel>
      <DialogTextLines lines={assistantLines} height={previewHeight} />
      <DialogTextarea
        value={state.value}
        placeholder={state.sending ? "Sending..." : "Type prompt"}
        focused={!state.sending}
        height={inputHeight}
        clearVersion={clearVersion}
        onInput={onInput}
        onSubmit={onSubmit}
      />
      <DialogError error={state.error} width={dialogWidth} />
    </StandardDialogFrame>
  )
}

export function AddSessionDialog({
  state,
  width,
  height,
  onInput,
  onSubmit,
  onWorktreeSelect,
  onCancel,
  clearVersion,
}: {
  state: AddSessionDialogState
  width: number
  height: number
  onInput: (value: string) => void
  onSubmit: (value: string) => void
  onWorktreeSelect: (index: number) => void
  onCancel: () => void
  clearVersion: number
}) {
  const dialogWidth = Math.min(Math.max(56, Math.floor(width * 0.7)), 80, width - 4)
  const inputHeight = 5
  const inputBlockHeight = inputHeight + 3
  const worktreeLines = Math.min(state.worktrees.length, 6)
  const worktreeStart = clamp(
    state.worktreeIndex - worktreeLines + 1,
    0,
    Math.max(0, state.worktrees.length - worktreeLines),
  )
  const bodyHeight = 1 + worktreeLines + inputBlockHeight + (state.error ? 1 : 0)
  const dialogHeight = Math.max(1, Math.min(height - 2, bodyHeight + 7))

  return (
    <StandardDialogFrame
      screenWidth={width}
      screenHeight={height}
      width={dialogWidth}
      height={dialogHeight}
      danger={Boolean(state.error)}
      title="New session"
      headerRight={state.sending ? "creating" : undefined}
      subtitle={<PlainLine text={fitCell(state.projectTitle, dialogWidth - 4)} fg={theme.textMuted} />}
      onClose={onCancel}
      footer={
        <DialogFooterActions
          width={dialogWidth - 4}
          actionsWidth={27}
          hints={
            <HintRow
              items={[
                { key: "tab", label: "worktree" },
                { key: "shift-enter", label: "newline" },
              ]}
            />
          }
        >
          <ButtonRow width={27}>
            <Button
              label="Create"
              shortcut="↵"
              width={12}
              disabled={state.sending || state.value.trim().length === 0}
              onPress={() => onSubmit(state.value)}
            />
            <ButtonSpacer />
            <Button label="Cancel" shortcut="esc" width={14} onPress={onCancel} />
          </ButtonRow>
        </DialogFooterActions>
      }
    >
      <DialogLabel>Worktree</DialogLabel>
      <box style={{ flexDirection: "column", height: worktreeLines }}>
        {state.worktrees.slice(worktreeStart, worktreeStart + worktreeLines).map((worktree, offset) => {
          const index = worktreeStart + offset
          return (
            <DialogOption
              key={`${worktree.directory}:${worktree.workspaceID ?? ""}`}
              selected={index === state.worktreeIndex}
              onSelect={() => onWorktreeSelect(index)}
            >
              {truncate(worktree.name, dialogWidth - 6)}
            </DialogOption>
          )
        })}
      </box>
      <DialogTextarea
        value={state.value}
        placeholder={state.sending ? "Creating..." : "Type first prompt"}
        focused={!state.sending}
        height={inputHeight}
        clearVersion={clearVersion}
        onInput={onInput}
        onSubmit={onSubmit}
      />
      <DialogError error={state.error} width={dialogWidth} />
    </StandardDialogFrame>
  )
}

export function DeleteSessionDialog({
  state,
  width,
  height,
  onConfirm,
  onCancel,
}: {
  state: DeleteSessionDialogState
  width: number
  height: number
  onConfirm: () => void
  onCancel: () => void
}) {
  const dialogWidth = Math.min(Math.max(48, Math.floor(width * 0.55)), 72, width - 4)
  const bodyHeight = state.error ? 4 : 3
  const dialogHeight = bodyHeight + 7
  const count = state.rows.length
  const firstRow = state.rows[0]
  const title = count === 1 ? "Delete session?" : `Delete ${count} sessions?`
  const subtitle = count === 1 && firstRow ? firstRow.title : `${count} selected sessions`
  const worktree = count === 1 && firstRow ? firstRow.worktreeName : "Multiple worktrees may be affected."

  return (
    <StandardDialogFrame
      screenWidth={width}
      screenHeight={height}
      width={dialogWidth}
      height={dialogHeight}
      danger
      title={title}
      headerRight={state.deleting ? "deleting" : "destructive"}
      subtitle={<PlainLine text={fitCell(subtitle, dialogWidth - 4)} fg={theme.textMuted} />}
      onClose={onCancel}
      footer={
        <DialogFooterActions width={dialogWidth - 4} actionsWidth={33}>
          <ButtonRow width={33}>
            <Button
              label="Delete"
              shortcut="↵/y"
              width={14}
              danger
              disabled={Boolean(state.deleting)}
              onPress={onConfirm}
            />
            <ButtonSpacer />
            <Button label="Cancel" shortcut="esc/n" width={18} disabled={Boolean(state.deleting)} onPress={onCancel} />
          </ButtonRow>
        </DialogFooterActions>
      }
    >
      <PlainLine text={fitCell(worktree, dialogWidth - 6)} fg={theme.textMuted} />
      <PlainLine text={state.deleting ? "Deleting sessions..." : "This cannot be undone."} fg={theme.error} />
      <DialogError error={state.error} width={dialogWidth} />
    </StandardDialogFrame>
  )
}
