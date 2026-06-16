import { TextAttributes, type ScrollBoxRenderable } from "@opentui/core"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useLayoutEffect, useRef } from "react"
import {
  DialogError,
  DialogLabel,
  DialogTextarea,
  fitCell,
  HintRow,
  PlainLine,
  StandardDialogFrame,
  standardDialogBodyHeight,
  TextLine,
} from "./ui/dialog.tsx"
import { Button, ButtonRow, ButtonSpacer, DialogFooterActions, mouseAction } from "./ui/button.tsx"
import { MenuDropdown, type MenuItem } from "./ui/menu-dropdown.tsx"
import { useDashboardControllerContext } from "../hooks/use-dashboard-controller.tsx"
import { AppRuntime } from "../effect/app-runtime.ts"
import {
  clamp,
  displayWorktreeName,
  errorMessage,
  wrapText,
  type ModelProviderOption,
  type WorktreeOption,
} from "../lib/utils.ts"
import { centeredTopWithinScreen, preferredPromptSessionBodyHeight, promptSessionBodyLayout } from "../lib/layout.ts"
import {
  loadDefaultModel,
  loadModelProviders,
  loadSessionHistory,
  type DefaultModelOption,
  type SessionHistoryMessage,
} from "../opencode/client/index.ts"
import { useDashboardStore } from "../store/dashboard.ts"
import { useGlobalStore } from "../store/global.ts"
import { theme } from "../theme.ts"

type PromptHistoryLine = {
  key: string
  text: string
  role?: SessionHistoryMessage["role"] | undefined
  roleLabel?: string | undefined
  queued?: boolean | undefined
  permissionRequested?: boolean | undefined
  responseError?: boolean | undefined
}

const PROMPT_USER_BULLET = theme.primary
const PROMPT_ASSISTANT_BULLET = theme.info
const PROMPT_USER_BACKGROUND = theme.backgroundElement
const SELECTOR_DROPDOWN_BACKGROUND = theme.backgroundElement
const SELECTOR_DROPDOWN_SELECTED_BACKGROUND = theme.backgroundElementActive
const MAX_PROMPT_HISTORY_SCROLL_MEASURE_ATTEMPTS = 20

export function PromptDialog({ width, height }: { width: number; height: number }) {
  const controller = useDashboardControllerContext()
  const dashboardStore = useDashboardStore()
  const setPromptModelOptions = useDashboardStore((store) => store.setPromptModelOptions)
  const globalStore = useGlobalStore()
  const state = dashboardStore.promptDialog
  const promptSessionId = state?.row.id
  const promptModelProviderID = state?.row.model?.providerID
  const promptModelID = state?.row.model?.modelID
  const promptModelVariant = state?.row.model?.variant
  const modelProvidersQuery = useQuery({
    queryKey: [
      "opencode-dialog-model-providers",
      globalStore.config.activeServerUrl,
      state?.row.directory,
      state?.row.workspaceID,
    ],
    queryFn: ({ signal }) => {
      if (!state) return []
      return AppRuntime.runPromise(
        loadModelProviders({
          serverUrl: globalStore.config.activeServerUrl,
          directory: state.row.directory,
          workspaceID: state.row.workspaceID,
        }),
        { signal },
      )
    },
    enabled: state !== undefined,
  })
  const defaultModelQuery = useQuery({
    queryKey: [
      "opencode-dialog-default-model",
      globalStore.config.activeServerUrl,
      state?.row.directory,
      state?.row.workspaceID,
    ],
    queryFn: ({ signal }) => {
      if (!state) return null
      return AppRuntime.runPromise(
        loadDefaultModel({
          serverUrl: globalStore.config.activeServerUrl,
          directory: state.row.directory,
          workspaceID: state.row.workspaceID,
        }),
        { signal },
      ).then((model) => model ?? null)
    },
    enabled: state !== undefined,
  })
  const historyQuery = useQuery({
    queryKey: [
      "opencode-session-history",
      globalStore.config.activeServerUrl,
      state?.row.id,
      state?.row.directory,
      state?.row.workspaceID,
      state?.row.updated,
    ],
    queryFn: ({ signal }) => {
      if (!state) return []
      return AppRuntime.runPromise(
        loadSessionHistory({
          sessionID: state.row.id,
          directory: state.row.directory,
          workspaceID: state.row.workspaceID,
          serverUrl: globalStore.config.activeServerUrl,
        }),
        { signal },
      )
    },
    enabled: state !== undefined,
  })

  useEffect(() => {
    if (!promptSessionId || !modelProvidersQuery.data || defaultModelQuery.isPending) return
    const promptModel =
      promptModelProviderID && promptModelID
        ? {
            providerID: promptModelProviderID,
            modelID: promptModelID,
            ...(promptModelVariant !== undefined ? { variant: promptModelVariant } : {}),
          }
        : undefined
    const selection = modelSelectionForDefault(modelProvidersQuery.data, promptModel ?? defaultModelQuery.data)
    setPromptModelOptions(
      promptSessionId,
      modelProvidersQuery.data,
      selection.modelProviderIndex,
      selection.modelIndex,
      selection.variantIndex,
    )
  }, [
    defaultModelQuery.data,
    defaultModelQuery.isPending,
    modelProvidersQuery.data,
    setPromptModelOptions,
    promptModelID,
    promptModelProviderID,
    promptModelVariant,
    promptSessionId,
  ])

  if (!state) return null

  const dialogWidth = Math.min(Math.max(48, Math.floor(width * 0.7)), 80, width - 4)
  const modelLoadError = modelProvidersQuery.error
    ? errorMessage(modelProvidersQuery.error)
    : defaultModelQuery.error
      ? errorMessage(defaultModelQuery.error)
      : undefined
  const dialogError = state.error ?? modelLoadError
  const dialogHeight = Math.max(1, Math.min(height - 2, preferredPromptSessionBodyHeight(Boolean(dialogError)) + 7))
  const promptLayout = promptSessionBodyLayout(standardDialogBodyHeight(dialogHeight), Boolean(dialogError))
  const historyBlockHeight =
    promptLayout.historyLabelHeight + promptLayout.historyHeight + promptLayout.historyMarginBottom
  const modelProviderSelectorFocused = state.focus === "model-provider"
  const modelSelectorFocused = state.focus === "model"
  const variantSelectorFocused = state.focus === "variant"
  const modelSelectorActive = modelProviderSelectorFocused || modelSelectorFocused
  const selectorVisible = promptLayout.selectorFooterHeight > 0
  const selectorNavigationActive = selectorVisible && (modelSelectorActive || variantSelectorFocused)
  const selectorWidth = Math.max(1, dialogWidth - 4)
  const historyLineWidth = dialogWidth - 8
  const historyMessages = historyQuery.data ?? withoutQueuedMarkers(state.row.messages)
  const historyLines = historyQuery.isPending
    ? [{ key: "loading", text: "Loading messages..." }]
    : [
        ...(historyQuery.error && !historyQuery.data
          ? [{ key: "load-error", text: `Failed to load full history: ${errorMessage(historyQuery.error)}` }]
          : []),
        ...promptHistoryLines(historyMessages, historyLineWidth),
      ]
  const dialogTop = centeredTopWithinScreen(height, dialogHeight)
  const modelSelectorLeft = Math.max(1, Math.floor((width - dialogWidth) / 2)) + 2
  const modelSelectorTop = dialogTop + 4 + historyBlockHeight + 1 + promptLayout.inputHeight
  const variantSelectorLeft = modelSelectorLeft
  const variantSelectorTop = modelSelectorTop
  const selectedProvider = state.modelProviders[state.modelProviderIndex]
  const selectedModel = selectedProvider?.models[state.modelIndex]
  const variants = variantOptions(selectedModel)
  const selectedVariant = variants[state.variantIndex]
  const modelMenuItems: MenuItem[] = modelProviderSelectorFocused
    ? state.modelProviders.map((provider, index) => ({
        label: provider.name,
        shortcut: "",
        run: () => {
          dashboardStore.setPromptModelProviderIndex(index)
          dashboardStore.setPromptFocus("model")
        },
      }))
    : (selectedProvider?.models.map((model, index) => ({
        label: model.name,
        shortcut: "",
        run: () => {
          dashboardStore.setPromptModelIndex(index)
          dashboardStore.setPromptFocus("input")
        },
      })) ?? [])
  const modelOptionCount = modelProviderSelectorFocused
    ? state.modelProviders.length
    : (selectedProvider?.models.length ?? 0)
  const selectedModelMenuIndex = modelProviderSelectorFocused ? state.modelProviderIndex : state.modelIndex
  const modelVisibleCount = Math.min(modelOptionCount, 6)
  const modelVisibleStart = clamp(
    selectedModelMenuIndex - modelVisibleCount + 1,
    0,
    Math.max(0, modelOptionCount - modelVisibleCount),
  )
  const variantMenuItems: MenuItem[] = variants.map((variant, index) => ({
    label: variant ?? "Default",
    shortcut: "",
    run: () => {
      dashboardStore.setPromptVariantIndex(index)
      dashboardStore.setPromptFocus("input")
    },
  }))
  const variantOptionCount = variants.length
  const variantVisibleCount = Math.min(variantOptionCount, 6)
  const variantVisibleStart = clamp(
    state.variantIndex - variantVisibleCount + 1,
    0,
    Math.max(0, variantOptionCount - variantVisibleCount),
  )

  return (
    <>
      <StandardDialogFrame
        screenWidth={width}
        screenHeight={height}
        width={dialogWidth}
        height={dialogHeight}
        danger={Boolean(dialogError)}
        title="Prompt session"
        headerRight={state.sending ? "sending" : undefined}
        subtitle={<PlainLine text={fitCell(state.row.title, dialogWidth - 4)} fg={theme.textMuted} />}
        onClose={dashboardStore.closePromptDialog}
        footer={
          <DialogFooterActions
            width={dialogWidth - 4}
            actionsWidth={25}
            hints={
              <HintRow
                items={[
                  { key: "tab", label: "focus" },
                  {
                    key: "j/k",
                    label: variantSelectorFocused ? "variant" : "model",
                    when: selectorNavigationActive,
                    disabled: variantSelectorFocused ? variantOptionCount <= 1 : modelOptionCount <= 1,
                  },
                  { key: "shift-enter", label: "newline" },
                ]}
              />
            }
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
        {promptLayout.historyLabelHeight > 0 ? (
          <box style={{ height: promptLayout.historyLabelHeight }}>
            <DialogLabel>Messages:</DialogLabel>
          </box>
        ) : null}
        {promptLayout.historyHeight > 0 ? (
          <PromptHistoryScrollbox
            lines={historyLines}
            width={historyLineWidth}
            height={promptLayout.historyHeight}
            marginBottom={promptLayout.historyMarginBottom}
            sessionId={promptSessionId ?? ""}
            loading={historyQuery.isPending}
          />
        ) : null}
        <DialogTextarea
          value={state.value}
          placeholder={state.sending ? "Sending..." : "Type prompt"}
          focused={!state.sending && (state.focus === "input" || !selectorVisible)}
          height={promptLayout.inputHeight}
          footer={
            selectorVisible ? (
              <ModelVariantFooter
                width={Math.max(1, selectorWidth - 2)}
                providerName={selectedProvider?.name}
                modelName={selectedModel?.name}
                variant={selectedVariant}
                active={
                  modelProviderSelectorFocused
                    ? "provider"
                    : modelSelectorFocused
                      ? "model"
                      : variantSelectorFocused
                        ? "variant"
                        : undefined
                }
                onProviderFocus={() => dashboardStore.setPromptFocus("model-provider")}
                onModelFocus={() => dashboardStore.setPromptFocus("model")}
                onVariantFocus={() => dashboardStore.setPromptFocus("variant")}
              />
            ) : undefined
          }
          footerHeight={promptLayout.selectorFooterHeight}
          marginBottom={0}
          clearVersion={dashboardStore.promptClearVersion}
          onFocus={() => dashboardStore.setPromptFocus("input")}
          onInput={dashboardStore.setPromptValue}
          onSubmit={(value) => void controller.submitPrompt(value)}
        />
        <DialogError error={dialogError} width={dialogWidth} />
      </StandardDialogFrame>
      {selectorVisible && modelSelectorActive && modelMenuItems.length > 0 ? (
        <MenuDropdown
          left={modelSelectorLeft}
          top={modelSelectorTop + 1}
          screenHeight={height}
          items={modelMenuItems}
          selectedIndex={selectedModelMenuIndex}
          visibleStart={modelVisibleStart}
          visibleCount={modelVisibleCount}
          maxWidth={selectorWidth}
          showShortcuts={false}
          background={SELECTOR_DROPDOWN_BACKGROUND}
          selectedBackground={SELECTOR_DROPDOWN_SELECTED_BACKGROUND}
          onSelect={(index) => {
            if (modelProviderSelectorFocused) dashboardStore.setPromptModelProviderIndex(index)
            else dashboardStore.setPromptModelIndex(index)
          }}
          onClose={() => dashboardStore.setPromptFocus("input")}
        />
      ) : null}
      {selectorVisible && variantSelectorFocused && variantMenuItems.length > 0 ? (
        <MenuDropdown
          left={variantSelectorLeft}
          top={variantSelectorTop + 1}
          screenHeight={height}
          items={variantMenuItems}
          selectedIndex={state.variantIndex}
          visibleStart={variantVisibleStart}
          visibleCount={variantVisibleCount}
          maxWidth={selectorWidth}
          showShortcuts={false}
          background={SELECTOR_DROPDOWN_BACKGROUND}
          selectedBackground={SELECTOR_DROPDOWN_SELECTED_BACKGROUND}
          onSelect={(index) => dashboardStore.setPromptVariantIndex(index)}
          onClose={() => dashboardStore.setPromptFocus("input")}
        />
      ) : null}
    </>
  )
}

function PromptHistoryScrollbox({
  lines,
  width,
  height,
  marginBottom,
  sessionId,
  loading,
}: {
  lines: PromptHistoryLine[]
  width: number
  height: number
  marginBottom: number
  sessionId: string
  loading: boolean
}) {
  const scrollRef = useRef<ScrollBoxRenderable>(null)
  const lastLine = lines.length > 0 ? lines[lines.length - 1] : undefined
  const scrollVersion = [
    sessionId,
    height,
    loading ? "pending" : "ready",
    lines.length,
    lastLine?.key ?? "",
    lastLine?.text ?? "",
  ].join("\n")

  useLayoutEffect(() => {
    const scroll = scrollRef.current
    if (!scroll) return

    let cancelled = false
    let attempts = 0
    const apply = () => {
      if (cancelled) return
      const viewportHeight = scroll.viewport.height
      const scrollHeight = scroll.scrollHeight
      if (viewportHeight <= 0 || scrollHeight < lines.length) {
        if (attempts++ < MAX_PROMPT_HISTORY_SCROLL_MEASURE_ATTEMPTS) globalThis.setTimeout(apply, 16)
        return
      }

      const nextTop = Math.max(0, scrollHeight - viewportHeight)
      if (nextTop !== scroll.scrollTop) scroll.scrollTo({ x: 0, y: nextTop })
    }

    apply()
    return () => {
      cancelled = true
    }
  }, [lines.length, scrollVersion])

  return (
    <scrollbox
      ref={scrollRef}
      focusable={false}
      style={{
        contentOptions: { flexDirection: "column" },
        height,
        marginBottom,
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
      {lines.map((line) => (
        <PromptHistoryText key={line.key} line={line} width={width} />
      ))}
    </scrollbox>
  )
}

function PromptHistoryText({ line, width }: { line: PromptHistoryLine; width: number }) {
  const bg = line.role === "user" ? PROMPT_USER_BACKGROUND : undefined

  if (line.roleLabel) {
    const bulletColor = line.queued
      ? theme.warning
      : line.permissionRequested
        ? theme.warning
        : line.responseError
          ? theme.error
          : line.role === "user"
            ? PROMPT_USER_BULLET
            : PROMPT_ASSISTANT_BULLET
    const rest = ` ${line.roleLabel}:`
    const padding = " ".repeat(Math.max(0, width - 1 - rest.length))

    return (
      <text style={{ fg: theme.textMuted, ...(bg ? { bg } : {}) }}>
        <span fg={bulletColor}>●</span>
        <span>{rest}</span>
        <span>{padding}</span>
      </text>
    )
  }

  return (
    <text
      content={fitCell(line.text, width)}
      style={{ fg: line.responseError ? theme.error : theme.textMuted, ...(bg ? { bg } : {}) }}
    />
  )
}

function promptHistoryLines(messages: SessionHistoryMessage[], width: number): PromptHistoryLine[] {
  if (messages.length === 0) return [{ key: "empty", text: "No previous messages." }]

  return messages.flatMap((message, index) => {
    const lines = wrapText(message.text, Math.max(1, width), Number.MAX_SAFE_INTEGER).map((line) => ({
      key: `${index}:${line.key}`,
      text: line.text,
      role: message.role,
      permissionRequested: message.permissionRequested,
      responseError: message.responseError,
    }))
    const previousMessage = messages[index - 1]
    const showRole =
      !previousMessage ||
      previousMessage.role !== message.role ||
      previousMessage.queued !== message.queued ||
      previousMessage.permissionRequested !== message.permissionRequested ||
      previousMessage.responseError !== message.responseError
    const roleLine = showRole
      ? [
          {
            key: `${index}:role`,
            text: "",
            role: message.role,
            roleLabel: message.responseError
              ? "Assistant error"
              : message.permissionRequested
                ? "Permission requested"
                : message.role === "user"
                  ? message.queued
                    ? "User (queued)"
                    : "User"
                  : "Assistant",
            queued: message.queued,
            permissionRequested: message.permissionRequested,
            responseError: message.responseError,
          },
        ]
      : []
    const spacerLine = index < messages.length - 1 ? [{ key: `${index}:spacer`, text: " " }] : []

    return [...roleLine, ...lines, ...spacerLine]
  })
}

function withoutQueuedMarkers(messages: SessionHistoryMessage[]): SessionHistoryMessage[] {
  return messages.map(({ queued: _queued, ...message }) => message)
}

export function PermissionDialog({ width, height }: { width: number; height: number }) {
  const controller = useDashboardControllerContext()
  const dashboardStore = useDashboardStore()
  const state = dashboardStore.permissionDialog

  if (!state) return null

  const responding = Boolean(state.responding)
  const dialogWidth = Math.min(Math.max(58, Math.floor(width * 0.65)), 84, width - 4)
  const bodyWidth = Math.max(1, dialogWidth - 6)
  const visiblePatterns = state.request.patterns.slice(0, 4)
  const patternCounts = new Map<string, number>()
  const visiblePatternRows = visiblePatterns.map((pattern) => {
    const count = (patternCounts.get(pattern) ?? 0) + 1
    patternCounts.set(pattern, count)
    return { key: `${pattern}:${count}`, pattern }
  })
  const hiddenPatternCount = Math.max(0, state.request.patterns.length - visiblePatterns.length)
  const hasMultipleTargets = state.request.patterns.length > 1
  const permissionLabel = `${state.request.permission.slice(0, 1).toUpperCase()}${state.request.permission.slice(1)}`
  const actionLabel =
    state.request.patterns.length === 1
      ? `${permissionLabel} ${state.request.patterns[0]}`
      : state.request.patterns.length > 1
        ? `${permissionLabel} ${state.request.patterns.length} paths`
        : permissionLabel
  const pathLineCount = hasMultipleTargets ? 1 + visiblePatternRows.length + (hiddenPatternCount > 0 ? 1 : 0) : 1
  const bodyHeight = 2 + pathLineCount + (state.error ? 1 : 0)
  const dialogHeight = Math.min(height - 2, bodyHeight + 6)
  const requestIndex = state.row.pendingPermissionRequests.findIndex((request) => request.id === state.request.id)
  const requestCount = state.row.pendingPermissionRequests.length
  const footerWidth = dialogWidth - 4
  const buttonLayout = permissionButtonLayout(footerWidth)
  const headerRight = responding
    ? "replying"
    : requestCount > 1 && requestIndex !== -1
      ? `${requestIndex + 1}/${requestCount}`
      : undefined

  return (
    <StandardDialogFrame
      screenWidth={width}
      screenHeight={height}
      width={dialogWidth}
      height={dialogHeight}
      title="Permission required"
      headerRight={headerRight}
      onClose={responding ? undefined : dashboardStore.closePermissionDialog}
      footer={
        <ButtonRow width={footerWidth}>
          <Button
            label="Once"
            shortcut="↵"
            width={buttonLayout.once}
            disabled={responding}
            onPress={() => void controller.replyToPermission("once")}
          />
          <text content={" ".repeat(buttonLayout.gap)} />
          <Button
            label="Always"
            shortcut="a"
            width={buttonLayout.always}
            disabled={responding}
            onPress={() => void controller.replyToPermission("always")}
          />
          <text content={" ".repeat(buttonLayout.gap)} />
          <Button
            label="Deny"
            shortcut="d"
            width={buttonLayout.deny}
            danger
            disabled={responding}
            onPress={() => void controller.replyToPermission("reject")}
          />
          <text content={" ".repeat(buttonLayout.gap)} />
          <Button
            label="Cancel"
            shortcut="esc"
            width={buttonLayout.cancel}
            disabled={responding}
            onPress={dashboardStore.closePermissionDialog}
          />
        </ButtonRow>
      }
    >
      <PlainLine text={fitCell(`→ ${actionLabel}`, bodyWidth)} fg={theme.text} />
      <PlainLine text="" />
      {hasMultipleTargets ? (
        <>
          <PlainLine text="Paths:" fg={theme.textMuted} />
          {visiblePatternRows.map((row) => (
            <PlainLine key={row.key} text={fitCell(`  - ${row.pattern}`, bodyWidth)} fg={theme.textMuted} />
          ))}
        </>
      ) : state.request.patterns.length === 1 ? (
        <PlainLine text={fitCell(`Path: ${state.request.patterns[0]}`, bodyWidth)} fg={theme.textMuted} />
      ) : (
        <PlainLine text="Path: none" fg={theme.textMuted} />
      )}
      {hiddenPatternCount > 0 ? (
        <PlainLine text={fitCell(`  +${hiddenPatternCount} more`, bodyWidth)} fg={theme.textMuted} />
      ) : null}
      <DialogError error={state.error} width={dialogWidth} />
    </StandardDialogFrame>
  )
}

function permissionButtonLayout(width: number): {
  once: number
  always: number
  deny: number
  cancel: number
  gap: number
} {
  const gap = width >= 50 ? 2 : 1
  const sizes = { once: 10, always: 12, deny: 10, cancel: 12 }
  const keys = ["once", "always", "deny", "cancel"] as const
  let remaining = Math.max(0, width - gap * 3 - sizes.once - sizes.always - sizes.deny - sizes.cancel)
  let index = 0

  while (remaining > 0) {
    sizes[keys[index % keys.length]!] += 1
    remaining -= 1
    index += 1
  }

  return { ...sizes, gap }
}

function modelSelectionForDefault(
  providers: ModelProviderOption[],
  defaultModel: DefaultModelOption | null | undefined,
): { modelProviderIndex: number; modelIndex: number; variantIndex: number } {
  if (!defaultModel) return { modelProviderIndex: 0, modelIndex: 0, variantIndex: 0 }

  const modelProviderIndex = providers.findIndex((provider) => provider.id === defaultModel.providerID)
  if (modelProviderIndex === -1) return { modelProviderIndex: 0, modelIndex: 0, variantIndex: 0 }

  const provider = providers[modelProviderIndex]
  const modelIndex = provider?.models.findIndex((model) => model.modelID === defaultModel.modelID) ?? -1
  if (modelIndex === -1) return { modelProviderIndex: 0, modelIndex: 0, variantIndex: 0 }

  const model = provider?.models[modelIndex]
  const variantIndex = defaultModel.variant
    ? variantOptions(model).findIndex((variant) => variant === defaultModel.variant)
    : 0

  return { modelProviderIndex, modelIndex, variantIndex: Math.max(0, variantIndex) }
}

export function AddSessionDialog({ width, height }: { width: number; height: number }) {
  const controller = useDashboardControllerContext()
  const dashboardStore = useDashboardStore()
  const setAddSessionModelOptions = useDashboardStore((store) => store.setAddSessionModelOptions)
  const globalStore = useGlobalStore()
  const state = dashboardStore.addSessionDialog
  const addProjectDirectory = state?.projectDirectory
  const initialModelProviderID = state?.initialModel?.providerID
  const initialModelID = state?.initialModel?.modelID
  const initialModelVariant = state?.initialModel?.variant
  const selectedWorktree = state?.worktrees[state.worktreeIndex]
  const addModelDirectory = selectedWorktree?.directory ?? state?.projectDirectory
  const addWorkspaceID = selectedWorktree ? selectedWorktree.workspaceID : state?.workspaceID
  const modelProvidersQuery = useQuery({
    queryKey: [
      "opencode-dialog-model-providers",
      globalStore.config.activeServerUrl,
      addModelDirectory,
      addWorkspaceID,
    ],
    queryFn: ({ signal }) => {
      if (!state || !addModelDirectory) return []
      return AppRuntime.runPromise(
        loadModelProviders({
          serverUrl: globalStore.config.activeServerUrl,
          directory: addModelDirectory,
          ...(addWorkspaceID !== undefined ? { workspaceID: addWorkspaceID } : {}),
        }),
        { signal },
      )
    },
    enabled: state !== undefined,
  })
  const defaultModelQuery = useQuery({
    queryKey: ["opencode-dialog-default-model", globalStore.config.activeServerUrl, addModelDirectory, addWorkspaceID],
    queryFn: ({ signal }) => {
      if (!state || !addModelDirectory) return null
      return AppRuntime.runPromise(
        loadDefaultModel({
          serverUrl: globalStore.config.activeServerUrl,
          directory: addModelDirectory,
          ...(addWorkspaceID !== undefined ? { workspaceID: addWorkspaceID } : {}),
        }),
        { signal },
      ).then((model) => model ?? null)
    },
    enabled: state !== undefined,
  })

  useEffect(() => {
    if (!addProjectDirectory || !addModelDirectory || !modelProvidersQuery.data || defaultModelQuery.isPending) return
    const initialModel =
      initialModelProviderID && initialModelID
        ? {
            providerID: initialModelProviderID,
            modelID: initialModelID,
            ...(initialModelVariant !== undefined ? { variant: initialModelVariant } : {}),
          }
        : undefined
    const selection = modelSelectionForDefault(modelProvidersQuery.data, initialModel ?? defaultModelQuery.data)
    setAddSessionModelOptions(
      addProjectDirectory,
      addModelDirectory,
      addWorkspaceID,
      modelProvidersQuery.data,
      selection.modelProviderIndex,
      selection.modelIndex,
      selection.variantIndex,
    )
  }, [
    defaultModelQuery.data,
    defaultModelQuery.isPending,
    modelProvidersQuery.data,
    addProjectDirectory,
    addModelDirectory,
    addWorkspaceID,
    initialModelID,
    initialModelProviderID,
    initialModelVariant,
    setAddSessionModelOptions,
  ])

  if (!state) return null

  const dialogWidth = Math.min(Math.max(56, Math.floor(width * 0.7)), 80, width - 4)
  const inputHeight = 5
  const selectorFooterHeight = 1
  const inputBlockHeight = inputHeight + 2 + selectorFooterHeight
  const worktreeBlockHeight = 1
  const worktreeSelectorFocused = state.focus === "worktree"
  const modelProviderSelectorFocused = state.focus === "model-provider"
  const modelSelectorFocused = state.focus === "model"
  const variantSelectorFocused = state.focus === "variant"
  const modelSelectorActive = modelProviderSelectorFocused || modelSelectorFocused
  const selectorWidth = Math.max(1, dialogWidth - 4)
  const modelLoadError = modelProvidersQuery.error
    ? errorMessage(modelProvidersQuery.error)
    : defaultModelQuery.error
      ? errorMessage(defaultModelQuery.error)
      : undefined
  const dialogError = state.error ?? modelLoadError
  const bodyHeight = worktreeBlockHeight + inputBlockHeight + (dialogError ? 1 : 0)
  const dialogHeight = Math.max(1, Math.min(height - 2, bodyHeight + 6))
  const dialogLeft = Math.max(1, Math.floor((width - dialogWidth) / 2))
  const dialogTop = centeredTopWithinScreen(height, dialogHeight)
  const worktreeSelectorLeft = dialogLeft + 2
  const worktreeSelectorTop = dialogTop + 3 + inputBlockHeight
  const modelSelectorLeft = dialogLeft + 2
  const modelSelectorTop = dialogTop + 3 + 1 + inputHeight
  const variantSelectorLeft = dialogLeft + 2
  const variantSelectorTop = modelSelectorTop
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
      label: displayWorktreeName(worktree.name),
      shortcut: "",
      run: () => {
        dashboardStore.setAddSessionWorktreeIndex(index)
        dashboardStore.setAddSessionFocus("input")
      },
    })),
  ]
  const selectedProvider = state.modelProviders[state.modelProviderIndex]
  const selectedModel = selectedProvider?.models[state.modelIndex]
  const variants = variantOptions(selectedModel)
  const selectedVariant = variants[state.variantIndex]
  const modelMenuItems: MenuItem[] = modelProviderSelectorFocused
    ? state.modelProviders.map((provider, index) => ({
        label: provider.name,
        shortcut: "",
        run: () => {
          dashboardStore.setAddSessionModelProviderIndex(index)
          dashboardStore.setAddSessionFocus("model")
        },
      }))
    : (selectedProvider?.models.map((model, index) => ({
        label: model.name,
        shortcut: "",
        run: () => {
          dashboardStore.setAddSessionModelIndex(index)
          dashboardStore.setAddSessionFocus("input")
        },
      })) ?? [])
  const modelOptionCount = modelProviderSelectorFocused
    ? state.modelProviders.length
    : (selectedProvider?.models.length ?? 0)
  const selectedModelMenuIndex = modelProviderSelectorFocused ? state.modelProviderIndex : state.modelIndex
  const modelVisibleCount = Math.min(modelOptionCount, 6)
  const modelVisibleStart = clamp(
    selectedModelMenuIndex - modelVisibleCount + 1,
    0,
    Math.max(0, modelOptionCount - modelVisibleCount),
  )
  const variantMenuItems: MenuItem[] = variants.map((variant, index) => ({
    label: variant ?? "Default",
    shortcut: "",
    run: () => {
      dashboardStore.setAddSessionVariantIndex(index)
      dashboardStore.setAddSessionFocus("input")
    },
  }))
  const variantOptionCount = variants.length
  const variantVisibleCount = Math.min(variantOptionCount, 6)
  const variantVisibleStart = clamp(
    state.variantIndex - variantVisibleCount + 1,
    0,
    Math.max(0, variantOptionCount - variantVisibleCount),
  )
  return (
    <>
      <StandardDialogFrame
        screenWidth={width}
        screenHeight={height}
        width={dialogWidth}
        height={dialogHeight}
        danger={Boolean(dialogError)}
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
                  {
                    key: "j/k",
                    label: worktreeSelectorFocused ? "worktree" : variantSelectorFocused ? "variant" : "model",
                    when: worktreeSelectorFocused || modelSelectorActive || variantSelectorFocused,
                    disabled: worktreeSelectorFocused
                      ? worktreeOptionCount <= 1
                      : variantSelectorFocused
                        ? variantOptionCount <= 1
                        : modelOptionCount <= 1,
                  },
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
        <DialogTextarea
          value={state.value}
          placeholder={state.sending ? "Creating..." : "Type first prompt"}
          focused={!state.sending && state.focus === "input"}
          height={inputHeight}
          footer={
            <ModelVariantFooter
              width={Math.max(1, selectorWidth - 2)}
              providerName={selectedProvider?.name}
              modelName={selectedModel?.name}
              variant={selectedVariant}
              active={
                modelProviderSelectorFocused
                  ? "provider"
                  : modelSelectorFocused
                    ? "model"
                    : variantSelectorFocused
                      ? "variant"
                      : undefined
              }
              onProviderFocus={() => dashboardStore.setAddSessionFocus("model-provider")}
              onModelFocus={() => dashboardStore.setAddSessionFocus("model")}
              onVariantFocus={() => dashboardStore.setAddSessionFocus("variant")}
            />
          }
          footerHeight={selectorFooterHeight}
          marginBottom={0}
          clearVersion={dashboardStore.addSessionClearVersion}
          onFocus={() => dashboardStore.setAddSessionFocus("input")}
          onInput={dashboardStore.setAddSessionValue}
          onSubmit={(value) => void controller.submitAddSession(value)}
        />
        <WorktreeSelector
          width={selectorWidth}
          worktrees={state.worktrees}
          selectedIndex={state.worktreeIndex}
          focused={worktreeSelectorFocused}
          marginBottom={0}
          onFocus={() => dashboardStore.setAddSessionFocus("worktree")}
        />
        <DialogError error={dialogError} width={dialogWidth} />
      </StandardDialogFrame>
      {worktreeSelectorFocused && worktreeMenuItems.length > 0 ? (
        <MenuDropdown
          left={worktreeSelectorLeft}
          top={worktreeSelectorTop + 1}
          screenHeight={height}
          items={worktreeMenuItems}
          selectedIndex={selectedDisplayWorktreeIndex}
          visibleStart={worktreeVisibleStart}
          visibleCount={worktreeVisibleCount}
          maxWidth={selectorWidth}
          showShortcuts={false}
          background={SELECTOR_DROPDOWN_BACKGROUND}
          selectedBackground={SELECTOR_DROPDOWN_SELECTED_BACKGROUND}
          selectOnHover={false}
          onSelect={(index) =>
            dashboardStore.setAddSessionWorktreeIndex(fromDisplayWorktreeIndex(index, state.worktrees.length))
          }
          onClose={() => dashboardStore.setAddSessionFocus("input")}
        />
      ) : null}
      {modelSelectorActive && modelMenuItems.length > 0 ? (
        <MenuDropdown
          left={modelSelectorLeft}
          top={modelSelectorTop + 1}
          screenHeight={height}
          items={modelMenuItems}
          selectedIndex={selectedModelMenuIndex}
          visibleStart={modelVisibleStart}
          visibleCount={modelVisibleCount}
          maxWidth={selectorWidth}
          showShortcuts={false}
          background={SELECTOR_DROPDOWN_BACKGROUND}
          selectedBackground={SELECTOR_DROPDOWN_SELECTED_BACKGROUND}
          onSelect={(index) => {
            if (modelProviderSelectorFocused) dashboardStore.setAddSessionModelProviderIndex(index)
            else dashboardStore.setAddSessionModelIndex(index)
          }}
          onClose={() => dashboardStore.setAddSessionFocus("input")}
        />
      ) : null}
      {variantSelectorFocused && variantMenuItems.length > 0 ? (
        <MenuDropdown
          left={variantSelectorLeft}
          top={variantSelectorTop + 1}
          screenHeight={height}
          items={variantMenuItems}
          selectedIndex={state.variantIndex}
          visibleStart={variantVisibleStart}
          visibleCount={variantVisibleCount}
          maxWidth={selectorWidth}
          showShortcuts={false}
          background={SELECTOR_DROPDOWN_BACKGROUND}
          selectedBackground={SELECTOR_DROPDOWN_SELECTED_BACKGROUND}
          onSelect={(index) => dashboardStore.setAddSessionVariantIndex(index)}
          onClose={() => dashboardStore.setAddSessionFocus("input")}
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
  marginBottom = 1,
  onFocus,
}: {
  width: number
  worktrees: WorktreeOption[]
  selectedIndex: number
  focused: boolean
  marginBottom?: number | undefined
  onFocus: () => void
}) {
  const selected = worktrees[selectedIndex]
  const fieldWidth = Math.max(1, width)
  const selectedName = selected ? displayWorktreeName(selected.name) : "New worktree"
  const content = `Worktree: ${selectedName}`

  return (
    <box
      style={{
        height: 1,
        width,
        marginBottom,
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

function ModelVariantFooter({
  width,
  providerName,
  modelName,
  variant,
  active,
  onProviderFocus,
  onModelFocus,
  onVariantFocus,
}: {
  width: number
  providerName?: string | undefined
  modelName?: string | undefined
  variant?: string | undefined
  active?: "provider" | "model" | "variant" | undefined
  onProviderFocus: () => void
  onModelFocus: () => void
  onVariantFocus: () => void
}) {
  const modelText = modelName ?? "No model"
  const providerText = providerName ?? "No provider"
  const variantText = variant ?? "Default"
  const separator = " • "
  const separatorWidth = separator.length
  const variantWidth = Math.min(variantText.length, Math.max(1, width - separatorWidth * 2 - 2))
  const modelProviderTextWidth = Math.min(
    modelText.length + separatorWidth + providerText.length,
    Math.max(1, width - variantWidth - separatorWidth),
  )
  const providerWidth = Math.min(providerText.length, Math.max(1, modelProviderTextWidth - separatorWidth - 1))
  const modelWidth = Math.max(1, modelProviderTextWidth - providerWidth - separatorWidth)
  const modelProviderActive = active === "model" || active === "provider"

  return (
    <box style={{ height: 1, width, flexDirection: "row" }}>
      <box style={{ height: 1, width: modelProviderTextWidth, flexDirection: "row" }}>
        <SelectorFooterSegment
          width={modelWidth}
          text={modelText}
          fg={theme.text}
          active={modelProviderActive}
          onFocus={onModelFocus}
        />
        <box
          style={{ height: 1, width: separatorWidth }}
          onMouseDown={(event) => {
            mouseAction(event)
            onProviderFocus()
          }}
        >
          <text
            content={separator}
            style={{ fg: theme.textMuted, ...(modelProviderActive ? { bg: theme.backgroundElement } : {}) }}
          />
        </box>
        <SelectorFooterSegment
          width={providerWidth}
          text={providerText}
          fg={theme.textMuted}
          active={modelProviderActive}
          onFocus={onProviderFocus}
        />
      </box>
      <text content={separator} style={{ fg: theme.textMuted }} />
      <SelectorFooterSegment
        width={variantWidth}
        text={variantText}
        fg={theme.warning}
        active={active === "variant"}
        onFocus={onVariantFocus}
      />
    </box>
  )
}

function SelectorFooterSegment({
  width,
  text,
  fg,
  active,
  onFocus,
}: {
  width: number
  text: string
  fg: string
  active: boolean
  onFocus: () => void
}) {
  return (
    <box
      style={{ height: 1, width }}
      onMouseDown={(event) => {
        mouseAction(event)
        onFocus()
      }}
    >
      <text
        content={fitCell(text, width)}
        style={{ fg, ...(active ? { bg: theme.backgroundElement, attributes: TextAttributes.BOLD } : {}) }}
      />
    </box>
  )
}

function variantOptions(model: ModelProviderOption["models"][number] | undefined): Array<string | undefined> {
  return [undefined, ...(model?.variants ?? [])]
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
  const worktree =
    count === 1 && firstRow ? displayWorktreeName(firstRow.worktreeName) : "Multiple worktrees may be affected."

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
      subtitle={
        <PlainLine text={fitCell(displayWorktreeName(state.worktree.name), dialogWidth - 4)} fg={theme.textMuted} />
      }
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
  const worktree =
    count === 1 && firstRow ? displayWorktreeName(firstRow.worktreeName) : "Multiple worktrees may be affected."

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
