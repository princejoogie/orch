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
}: {
  state: PromptDialogState
  width: number
  height: number
  onInput: (value: string) => void
  onSubmit: (value: string) => void
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
      headerRight={state.sending ? "sending" : "enter send"}
      subtitle={<PlainLine text={fitCell(state.row.title, dialogWidth - 4)} fg={theme.textMuted} />}
      footer={
        <HintRow
          items={[
            { key: "enter", label: "send" },
            { key: "ctrl-s", label: "send" },
            { key: "shift-enter", label: "newline" },
            { key: "esc", label: "cancel" },
          ]}
        />
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
}: {
  state: AddSessionDialogState
  width: number
  height: number
  onInput: (value: string) => void
  onSubmit: (value: string) => void
  onWorktreeSelect: (index: number) => void
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
      headerRight={state.sending ? "creating" : "enter create"}
      subtitle={<PlainLine text={fitCell(state.projectTitle, dialogWidth - 4)} fg={theme.textMuted} />}
      footer={
        <HintRow
          items={[
            { key: "tab", label: "worktree" },
            { key: "click", label: "select" },
            { key: "enter", label: "create" },
            { key: "shift-enter", label: "newline" },
            { key: "esc", label: "cancel" },
          ]}
        />
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
}: {
  state: DeleteSessionDialogState
  width: number
  height: number
}) {
  const dialogWidth = Math.min(Math.max(44, Math.floor(width * 0.55)), 72, width - 4)
  const bodyHeight = state.error ? 4 : 3
  const dialogHeight = bodyHeight + 7

  return (
    <StandardDialogFrame
      screenWidth={width}
      screenHeight={height}
      width={dialogWidth}
      height={dialogHeight}
      danger
      title="Delete session?"
      headerRight={state.deleting ? "deleting" : "destructive"}
      subtitle={<PlainLine text={fitCell(state.row.title, dialogWidth - 4)} fg={theme.textMuted} />}
      footer={
        <HintRow
          items={[
            { key: "enter/y", label: "confirm" },
            { key: "esc/n", label: "cancel" },
          ]}
        />
      }
    >
      <PlainLine text={fitCell(state.row.worktreeName, dialogWidth - 6)} fg={theme.textMuted} />
      <PlainLine text={state.deleting ? "Deleting session..." : "This cannot be undone."} fg={theme.error} />
      <DialogError error={state.error} width={dialogWidth} />
    </StandardDialogFrame>
  )
}
