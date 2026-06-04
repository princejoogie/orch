import { TextAttributes } from "@opentui/core"
import {
  DialogError,
  DialogLabel,
  DialogTextarea,
  DialogTextLines,
  fitCell,
  HintRow,
  PlainLine,
  StandardDialogFrame,
  TextLine,
} from "./ui/dialog.tsx"
import { Button, ButtonRow, ButtonSpacer, DialogFooterActions, mouseAction } from "./ui/button.tsx"
import { useDashboardControllerContext } from "../hooks/use-dashboard-controller.tsx"
import { clamp, truncate, wrapText, type WorktreeOption } from "../lib/utils.ts"
import { useDashboardStore } from "../store/dashboard.ts"
import { theme } from "../theme.ts"

export function PromptDialog({ width, height }: { width: number; height: number }) {
  const controller = useDashboardControllerContext()
  const dashboardStore = useDashboardStore()
  const state = dashboardStore.promptDialog

  if (!state) return null

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
      onClose={dashboardStore.closePromptDialog}
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
              onPress={() => void controller.submitPrompt(state.value)}
            />
            <ButtonSpacer />
            <Button label="Cancel" shortcut="esc" width={14} onPress={dashboardStore.closePromptDialog} />
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
        clearVersion={dashboardStore.promptClearVersion}
        onInput={dashboardStore.setPromptValue}
        onSubmit={(value) => void controller.submitPrompt(value)}
      />
      <DialogError error={state.error} width={dialogWidth} />
    </StandardDialogFrame>
  )
}

export function AddSessionDialog({ width, height }: { width: number; height: number }) {
  const controller = useDashboardControllerContext()
  const dashboardStore = useDashboardStore()
  const state = dashboardStore.addSessionDialog

  if (!state) return null

  const dialogWidth = Math.min(Math.max(56, Math.floor(width * 0.7)), 80, width - 4)
  const inputHeight = 5
  const inputBlockHeight = inputHeight + 3
  const selectorFocused = state.focus === "worktree"
  const worktreeLines = selectorFocused ? Math.min(state.worktrees.length, 6) : 0
  const worktreeDropdownHeight = worktreeLines > 0 ? worktreeLines + 2 : 0
  const worktreeStart = clamp(
    state.worktreeIndex - worktreeLines + 1,
    0,
    Math.max(0, state.worktrees.length - worktreeLines),
  )
  const selectorWidth = Math.max(1, dialogWidth - 6)
  const bodyHeight = 1 + 3 + worktreeDropdownHeight + inputBlockHeight + (state.error ? 1 : 0)
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
      onClose={dashboardStore.closeAddSessionDialog}
      footer={
        <DialogFooterActions
          width={dialogWidth - 4}
          actionsWidth={27}
          hints={
            <HintRow
              items={[
                { key: "tab", label: "focus" },
                { key: "j/k", label: "worktree", when: selectorFocused, disabled: state.worktrees.length <= 1 },
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
              onPress={() => void controller.submitAddSession(state.value)}
            />
            <ButtonSpacer />
            <Button label="Cancel" shortcut="esc" width={14} onPress={dashboardStore.closeAddSessionDialog} />
          </ButtonRow>
        </DialogFooterActions>
      }
    >
      <DialogLabel>Worktree</DialogLabel>
      <WorktreeSelector
        width={selectorWidth}
        worktrees={state.worktrees}
        selectedIndex={state.worktreeIndex}
        focused={selectorFocused}
        visibleStart={worktreeStart}
        visibleCount={worktreeLines}
        onFocus={() => dashboardStore.setAddSessionFocus("worktree")}
        onSelect={dashboardStore.setAddSessionWorktreeIndex}
        onCommit={(index) => {
          dashboardStore.setAddSessionWorktreeIndex(index)
          dashboardStore.setAddSessionFocus("input")
        }}
      />
      <DialogTextarea
        value={state.value}
        placeholder={state.sending ? "Creating..." : "Type first prompt"}
        focused={!state.sending && state.focus === "input"}
        height={inputHeight}
        clearVersion={dashboardStore.addSessionClearVersion}
        onInput={dashboardStore.setAddSessionValue}
        onSubmit={(value) => void controller.submitAddSession(value)}
      />
      <DialogError error={state.error} width={dialogWidth} />
    </StandardDialogFrame>
  )
}

function WorktreeSelector({
  width,
  worktrees,
  selectedIndex,
  focused,
  visibleStart,
  visibleCount,
  onFocus,
  onSelect,
  onCommit,
}: {
  width: number
  worktrees: WorktreeOption[]
  selectedIndex: number
  focused: boolean
  visibleStart: number
  visibleCount: number
  onFocus: () => void
  onSelect: (index: number) => void
  onCommit: (index: number) => void
}) {
  const selected = worktrees[selectedIndex]
  const fieldWidth = Math.max(1, width - 2)
  const selectedName = selected?.name ?? "No worktrees"

  return (
    <>
      <box
        style={{
          height: 3,
          width,
          border: true,
          borderColor: focused ? theme.info : theme.borderSubtle,
          paddingLeft: 1,
          paddingRight: 1,
          marginBottom: focused ? 0 : 1,
        }}
        onMouseDown={(event) => {
          mouseAction(event)
          onFocus()
        }}
      >
        <TextLine width={fieldWidth} bg={focused ? theme.backgroundElement : undefined}>
          <span fg={selected ? theme.text : theme.textMuted} {...(focused ? { attributes: TextAttributes.BOLD } : {})}>
            {fitCell(selectedName, Math.max(1, fieldWidth - 2))}
          </span>
          <span fg={focused ? theme.primary : theme.textMuted}> v</span>
        </TextLine>
      </box>
      {focused && visibleCount > 0 ? (
        <box
          style={{
            flexDirection: "column",
            height: visibleCount + 2,
            width,
            border: true,
            borderColor: theme.borderSubtle,
            paddingLeft: 1,
            paddingRight: 1,
            marginBottom: 1,
          }}
        >
          {worktrees.slice(visibleStart, visibleStart + visibleCount).map((worktree, offset) => {
            const index = visibleStart + offset
            const selectedOption = index === selectedIndex
            return (
              <box
                key={`${worktree.directory}:${worktree.workspaceID ?? ""}`}
                style={{ height: 1, width: fieldWidth }}
                onMouseOver={() => onSelect(index)}
                onMouseDown={(event) => {
                  mouseAction(event)
                  onCommit(index)
                }}
              >
                <TextLine width={fieldWidth} bg={selectedOption ? theme.backgroundElement : undefined}>
                  <span
                    fg={selectedOption ? theme.text : theme.textMuted}
                    {...(selectedOption ? { attributes: TextAttributes.BOLD } : {})}
                  >
                    {fitCell(`${selectedOption ? ">" : " "} ${truncate(worktree.name, fieldWidth - 3)}`, fieldWidth)}
                  </span>
                </TextLine>
              </box>
            )
          })}
        </box>
      ) : null}
    </>
  )
}

export function DeleteSessionDialog({ width, height }: { width: number; height: number }) {
  const controller = useDashboardControllerContext()
  const dashboardStore = useDashboardStore()
  const state = dashboardStore.deleteDialog

  if (!state) return null

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
      onClose={dashboardStore.closeDeleteDialog}
      footer={
        <DialogFooterActions width={dialogWidth - 4} actionsWidth={33}>
          <ButtonRow width={33}>
            <Button
              label="Delete"
              shortcut="↵/y"
              width={14}
              danger
              disabled={Boolean(state.deleting)}
              onPress={controller.confirmDeleteSession}
            />
            <ButtonSpacer />
            <Button
              label="Cancel"
              shortcut="esc/n"
              width={18}
              disabled={Boolean(state.deleting)}
              onPress={dashboardStore.closeDeleteDialog}
            />
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
