import {
  Dialog,
  DialogDescription,
  DialogError,
  DialogHint,
  DialogLabel,
  DialogOption,
  DialogTextarea,
  DialogTextLines,
  DialogTitle,
} from "./ui/dialog.tsx"
import {
  clamp,
  truncate,
  wrapText,
  type AddSessionDialogState,
  type DeleteSessionDialogState,
  type PromptDialogState,
} from "../lib/utils.ts"

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
  const userLines = state.loadingPreview
    ? [{ key: "loading", text: "Loading user message..." }]
    : wrapText(state.latestUserMessage ?? "", dialogWidth - 6, previewHeight, "No previous user message.")
  const assistantLines = state.loadingPreview
    ? [{ key: "loading", text: "Loading assistant message..." }]
    : wrapText(state.row.latestMessage, dialogWidth - 6, previewHeight)
  const dialogHeight = 13 + inputHeight + previewHeight * 2 + (state.error ? 1 : 0)

  return (
    <Dialog
      screenWidth={width}
      screenHeight={height}
      width={dialogWidth}
      height={dialogHeight}
      danger={Boolean(state.error)}
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
      <DialogHint>Enter send · Shift-Enter newline · Esc cancel</DialogHint>
    </Dialog>
  )
}

export function AddSessionDialog({
  state,
  width,
  height,
  onInput,
  onSubmit,
}: {
  state: AddSessionDialogState
  width: number
  height: number
  onInput: (value: string) => void
  onSubmit: (value: string) => void
}) {
  const dialogWidth = Math.min(Math.max(56, Math.floor(width * 0.7)), 80, width - 4)
  const inputHeight = 5
  const worktreeLines = Math.min(state.worktrees.length, 6)
  const worktreeStart = clamp(
    state.worktreeIndex - worktreeLines + 1,
    0,
    Math.max(0, state.worktrees.length - worktreeLines),
  )
  const dialogHeight = Math.max(1, Math.min(height - 2, 13 + inputHeight + worktreeLines + (state.error ? 1 : 0)))

  return (
    <Dialog
      screenWidth={width}
      screenHeight={height}
      width={dialogWidth}
      height={dialogHeight}
      danger={Boolean(state.error)}
    >
      <DialogTitle>{`New session in ${truncate(state.projectTitle, dialogWidth - 18)}`}</DialogTitle>
      <DialogLabel marginTop={1}>Worktree</DialogLabel>
      <box style={{ flexDirection: "column", height: worktreeLines, marginBottom: 1 }}>
        {state.worktrees.slice(worktreeStart, worktreeStart + worktreeLines).map((worktree, offset) => {
          const index = worktreeStart + offset
          return (
            <DialogOption
              key={`${worktree.directory}:${worktree.workspaceID ?? ""}`}
              selected={index === state.worktreeIndex}
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
      <DialogHint>Tab select worktree · Enter create · Shift-Enter newline · Esc cancel</DialogHint>
    </Dialog>
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
  const dialogHeight = state.error ? 12 : 11

  return (
    <Dialog screenWidth={width} screenHeight={height} width={dialogWidth} height={dialogHeight} danger>
      <DialogTitle>Delete session?</DialogTitle>
      <DialogDescription marginTop={1}>{truncate(state.row.title, dialogWidth - 4)}</DialogDescription>
      <DialogDescription>{truncate(state.row.worktreeName, dialogWidth - 4)}</DialogDescription>
      <DialogDescription danger marginTop={1}>
        {state.deleting ? "Deleting session..." : "This cannot be undone."}
      </DialogDescription>
      <DialogError error={state.error} width={dialogWidth} />
      <DialogHint>Enter/y confirm · Esc/n cancel</DialogHint>
    </Dialog>
  )
}
