import { TextAttributes, type MouseEvent, type ScrollBoxRenderable } from "@opentui/core"
import { useRef } from "react"
import {
  DialogError,
  DialogLabel,
  DialogTextarea,
  fitCell,
  HintRow,
  PlainLine,
  StandardDialogFrame,
  TextLine,
} from "./ui/dialog.tsx"
import { Button, ButtonRow, ButtonSpacer, DialogFooterActions, mouseAction } from "./ui/button.tsx"
import { MenuDropdown, type MenuItem } from "./ui/menu-dropdown.tsx"
import { useDashboardControllerContext } from "../hooks/use-dashboard-controller.tsx"
import { clamp, wrapText, type WorktreeOption } from "../lib/utils.ts"
import type { SessionHistoryMessage } from "../opencode.ts"
import { useDashboardStore } from "../store/dashboard.ts"
import { theme } from "../theme.ts"

export function PromptDialog({ width, height }: { width: number; height: number }) {
  const controller = useDashboardControllerContext()
  const dashboardStore = useDashboardStore()
  const state = dashboardStore.promptDialog
  const historyRef = useRef<ScrollBoxRenderable>(null)

  if (!state) return null

  const dialogWidth = Math.min(Math.max(48, Math.floor(width * 0.7)), 80, width - 4)
  const inputHeight = 5
  const historyHeight = 10
  const historyBlockHeight = historyHeight + 1
  const inputBlockHeight = inputHeight + 3
  const bodyHeight = 1 + historyBlockHeight + inputBlockHeight + (state.error ? 1 : 0)
  const historyLines = state.loadingPreview
    ? [{ key: "loading", text: "Loading messages..." }]
    : promptHistoryLines(state.row.messages, dialogWidth - 8)
  const dialogHeight = Math.min(height - 2, bodyHeight + 7)
  const handleHistoryScroll = (event: MouseEvent) => {
    if (event.scroll?.direction !== "up" || state.loadingMorePreview || !state.row.hasMoreMessages) return
    if ((historyRef.current?.scrollTop ?? 0) <= 1) void controller.loadMorePromptMessages()
  }

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
      <DialogLabel>Messages:</DialogLabel>
      <scrollbox
        ref={historyRef}
        focusable={false}
        onMouseScroll={handleHistoryScroll}
        style={{
          contentOptions: { flexDirection: "column" },
          height: historyHeight,
          marginBottom: 1,
          paddingLeft: 1,
          paddingRight: 1,
          scrollX: false,
          scrollY: true,
          stickyScroll: true,
          stickyStart: "bottom",
          verticalScrollbarOptions: { showArrows: false },
          viewportCulling: true,
        }}
      >
        {state.loadingMorePreview ? <text content="Loading older messages..." style={{ fg: theme.textMuted }} /> : null}
        {historyLines.map((line) => (
          <text key={line.key} content={line.text} style={{ fg: theme.textMuted }} />
        ))}
      </scrollbox>
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

function promptHistoryLines(messages: SessionHistoryMessage[], width: number) {
  if (messages.length === 0) return [{ key: "empty", text: "No previous messages." }]

  return messages.flatMap((message, index) => {
    const label = message.role === "user" ? "User" : "Assistant"
    const lines = wrapText(message.text, Math.max(1, width - label.length - 2), Number.MAX_SAFE_INTEGER)
    return lines.map((line, lineIndex) => ({
      key: `${index}:${line.key}`,
      text: lineIndex === 0 ? `${label}: ${line.text}` : `${" ".repeat(label.length + 2)}${line.text}`,
    }))
  })
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
  const selectorWidth = Math.max(1, dialogWidth - 4)
  const bodyHeight = 2 + inputBlockHeight + (state.error ? 1 : 0)
  const dialogHeight = Math.max(1, Math.min(height - 2, bodyHeight + 6))
  const dialogLeft = Math.max(1, Math.floor((width - dialogWidth) / 2))
  const dialogTop = Math.max(1, Math.floor((height - dialogHeight) / 2))
  const worktreeSelectorLeft = dialogLeft + 2
  const worktreeSelectorTop = dialogTop + 3
  const worktreeOptionCount = state.worktrees.length + 1
  const selectedDisplayWorktreeIndex = toDisplayWorktreeIndex(state.worktreeIndex, state.worktrees.length)
  const worktreeVisibleCount = Math.min(worktreeOptionCount, 6)
  const worktreeVisibleStart = clamp(
    selectedDisplayWorktreeIndex - worktreeVisibleCount + 1,
    0,
    Math.max(0, worktreeOptionCount - worktreeVisibleCount),
  )
  const worktreeMenuItems: MenuItem[] = [
    {
      label: "+ New worktree",
      shortcut: "",
      run: () => {
        dashboardStore.setAddSessionWorktreeIndex(state.worktrees.length)
        dashboardStore.setAddSessionFocus("input")
      },
    },
    ...state.worktrees.map((worktree, index) => ({
      label: worktree.name,
      shortcut: "",
      run: () => {
        dashboardStore.setAddSessionWorktreeIndex(index)
        dashboardStore.setAddSessionFocus("input")
      },
    })),
  ]

  return (
    <>
      <StandardDialogFrame
        screenWidth={width}
        screenHeight={height}
        width={dialogWidth}
        height={dialogHeight}
        danger={Boolean(state.error)}
        title="New session"
        headerRight={state.sending ? "creating" : undefined}
        onClose={dashboardStore.closeAddSessionDialog}
        footer={
          <DialogFooterActions
            width={dialogWidth - 4}
            actionsWidth={27}
            hints={
              <HintRow
                items={[
                  { key: "tab", label: "focus" },
                  { key: "j/k", label: "worktree", when: selectorFocused, disabled: worktreeOptionCount <= 1 },
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
        <WorktreeSelector
          width={selectorWidth}
          worktrees={state.worktrees}
          selectedIndex={state.worktreeIndex}
          focused={selectorFocused}
          onFocus={() => dashboardStore.setAddSessionFocus("worktree")}
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
      {selectorFocused && worktreeMenuItems.length > 0 ? (
        <MenuDropdown
          left={worktreeSelectorLeft}
          top={worktreeSelectorTop + 1}
          items={worktreeMenuItems}
          selectedIndex={selectedDisplayWorktreeIndex}
          visibleStart={worktreeVisibleStart}
          visibleCount={worktreeVisibleCount}
          maxWidth={selectorWidth}
          showShortcuts={false}
          onSelect={(index) =>
            dashboardStore.setAddSessionWorktreeIndex(fromDisplayWorktreeIndex(index, state.worktrees.length))
          }
          onClose={() => {}}
        />
      ) : null}
    </>
  )
}

function WorktreeSelector({
  width,
  worktrees,
  selectedIndex,
  focused,
  onFocus,
}: {
  width: number
  worktrees: WorktreeOption[]
  selectedIndex: number
  focused: boolean
  onFocus: () => void
}) {
  const selected = worktrees[selectedIndex]
  const fieldWidth = Math.max(1, width)
  const selectedName = selected?.name ?? "New worktree"
  const content = `Worktree: ${selectedName}`

  return (
    <box
      style={{
        height: 1,
        width,
        marginBottom: 1,
      }}
      onMouseDown={(event) => {
        mouseAction(event)
        onFocus()
      }}
    >
      <TextLine width={fieldWidth} bg={focused ? theme.backgroundElement : undefined}>
        <span fg={selected ? theme.text : theme.textMuted} {...(focused ? { attributes: TextAttributes.BOLD } : {})}>
          {fitCell(content, fieldWidth)}
        </span>
      </TextLine>
    </box>
  )
}

function toDisplayWorktreeIndex(worktreeIndex: number, worktreeCount: number): number {
  return worktreeIndex === worktreeCount ? 0 : worktreeIndex + 1
}

function fromDisplayWorktreeIndex(displayIndex: number, worktreeCount: number): number {
  return displayIndex === 0 ? worktreeCount : displayIndex - 1
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

export function DeleteWorktreeDialog({ width, height }: { width: number; height: number }) {
  const controller = useDashboardControllerContext()
  const dashboardStore = useDashboardStore()
  const state = dashboardStore.deleteWorktreeDialog

  if (!state) return null

  const dialogWidth = Math.min(Math.max(48, Math.floor(width * 0.55)), 72, width - 4)
  const dialogHeight = 10

  return (
    <StandardDialogFrame
      screenWidth={width}
      screenHeight={height}
      width={dialogWidth}
      height={dialogHeight}
      danger
      title="Delete worktree?"
      headerRight="destructive"
      subtitle={<PlainLine text={fitCell(state.worktree.name, dialogWidth - 4)} fg={theme.textMuted} />}
      onClose={dashboardStore.closeDeleteWorktreeDialog}
      footer={
        <DialogFooterActions width={dialogWidth - 4} actionsWidth={33}>
          <ButtonRow width={33}>
            <Button label="Delete" shortcut="↵/y" width={14} danger onPress={controller.confirmDeleteWorktree} />
            <ButtonSpacer />
            <Button label="Cancel" shortcut="esc/n" width={18} onPress={dashboardStore.closeDeleteWorktreeDialog} />
          </ButtonRow>
        </DialogFooterActions>
      }
    >
      <PlainLine text={fitCell(state.worktree.directory, dialogWidth - 6)} fg={theme.textMuted} />
      <PlainLine text="This cannot be undone." fg={theme.error} />
    </StandardDialogFrame>
  )
}

export function InterruptSessionDialog({ width, height }: { width: number; height: number }) {
  const controller = useDashboardControllerContext()
  const dashboardStore = useDashboardStore()
  const state = dashboardStore.interruptDialog

  if (!state) return null

  const dialogWidth = Math.min(Math.max(48, Math.floor(width * 0.55)), 72, width - 4)
  const bodyHeight = state.error ? 4 : 3
  const dialogHeight = bodyHeight + 7
  const count = state.rows.length
  const firstRow = state.rows[0]
  const title = count === 1 ? "Interrupt session?" : `Interrupt ${count} sessions?`
  const subtitle = count === 1 && firstRow ? firstRow.title : `${count} working sessions`
  const worktree = count === 1 && firstRow ? firstRow.worktreeName : "Multiple worktrees may be affected."

  return (
    <StandardDialogFrame
      screenWidth={width}
      screenHeight={height}
      width={dialogWidth}
      height={dialogHeight}
      danger
      title={title}
      headerRight={state.interrupting ? "interrupting" : "destructive"}
      subtitle={<PlainLine text={fitCell(subtitle, dialogWidth - 4)} fg={theme.textMuted} />}
      onClose={dashboardStore.closeInterruptDialog}
      footer={
        <DialogFooterActions width={dialogWidth - 4} actionsWidth={36}>
          <ButtonRow width={36}>
            <Button
              label="Interrupt"
              shortcut="↵/y"
              width={17}
              danger
              disabled={Boolean(state.interrupting)}
              onPress={controller.confirmInterruptSession}
            />
            <ButtonSpacer />
            <Button
              label="Cancel"
              shortcut="esc/n"
              width={18}
              disabled={Boolean(state.interrupting)}
              onPress={dashboardStore.closeInterruptDialog}
            />
          </ButtonRow>
        </DialogFooterActions>
      }
    >
      <PlainLine text={fitCell(worktree, dialogWidth - 6)} fg={theme.textMuted} />
      <PlainLine
        text={state.interrupting ? "Interrupting sessions..." : "This stops active work in progress."}
        fg={theme.error}
      />
      <DialogError error={state.error} width={dialogWidth} />
    </StandardDialogFrame>
  )
}
