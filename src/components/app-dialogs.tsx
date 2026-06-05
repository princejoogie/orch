import {
  AddSessionDialog,
  DeleteSessionDialog,
  DeleteWorktreeDialog,
  InterruptSessionDialog,
  PermissionDialog,
  PromptDialog,
} from "./session-dialogs.tsx"
import { ShortcutsDialog } from "./shortcuts-dialog.tsx"

export function AppDialogs({ width, height }: { width: number; height: number }) {
  return (
    <>
      <AddSessionDialog width={width} height={height} />
      <DeleteWorktreeDialog width={width} height={height} />
      <PromptDialog width={width} height={height} />
      <PermissionDialog width={width} height={height} />
      <DeleteSessionDialog width={width} height={height} />
      <InterruptSessionDialog width={width} height={height} />
      <ShortcutsDialog width={width} height={height} />
    </>
  )
}
