import {
  createOpencodeClient,
  type Agent,
  type AssistantMessage,
  type Part,
  type PermissionRequest,
  type Provider,
  type SessionMessage,
  type SessionMessagesResponse,
} from "@opencode-ai/sdk/v2"
import { DEFAULT_OPENCODE_SERVER_URL, defaultOpencodeServerUrl, normalizeServerUrl } from "../config/orch.ts"
import type { SessionHistoryMessage, SessionPermissionRequest } from "./types.ts"

export const DEFAULT_LIMIT = 100
export const LATEST_MESSAGES_LIMIT = 20

export function opencodeServerUrl(): string {
  return defaultOpencodeServerUrl()
}

export function opencodeClient(serverUrl = opencodeServerUrl()) {
  return createOpencodeClient({ baseUrl: normalizeServerUrl(serverUrl) || DEFAULT_OPENCODE_SERVER_URL })
}

export type LatestMessages = {
  userMessage: string
  assistantMessage: string
  latestResponseError?: string | undefined
  messages: SessionHistoryMessage[]
  hasMore: boolean
  assistantInfo?: AssistantMessage | undefined
}

export type LatestMessagePreview = {
  message: string
  userMessage: string
  latestResponseError?: string | undefined
}

export async function sendPrompt(input: {
  sessionID: string
  text: string
  model?: { providerID: string; modelID: string; variant?: string | undefined } | undefined
  directory?: string | undefined
  workspaceID?: string | undefined
  serverUrl?: string | undefined
}): Promise<void> {
  await opencodeClient(input.serverUrl).session.promptAsync(
    {
      sessionID: input.sessionID,
      ...routeOptions(input),
      ...(input.model !== undefined
        ? { model: { providerID: input.model.providerID, modelID: input.model.modelID } }
        : {}),
      ...(input.model?.variant !== undefined ? { variant: input.model.variant } : {}),
      parts: [{ type: "text", text: input.text }],
    },
    { throwOnError: true },
  )
}

export async function createSessionWithPrompt(input: {
  text: string
  directory: string
  model?: { providerID: string; modelID: string; variant?: string | undefined } | undefined
  workspaceID?: string | undefined
  serverUrl?: string | undefined
}): Promise<string> {
  const client = opencodeClient(input.serverUrl)
  const session = await client.session.create(
    {
      directory: input.directory,
      ...(input.workspaceID !== undefined ? { workspace: input.workspaceID } : {}),
      ...(input.model !== undefined
        ? {
            model: {
              providerID: input.model.providerID,
              id: input.model.modelID,
              ...(input.model.variant !== undefined ? { variant: input.model.variant } : {}),
            },
          }
        : {}),
    },
    { throwOnError: true },
  )

  await sendPrompt({
    sessionID: session.data.id,
    directory: input.directory,
    text: input.text,
    ...(input.model !== undefined ? { model: input.model } : {}),
    ...(input.workspaceID !== undefined ? { workspaceID: input.workspaceID } : {}),
    ...(input.serverUrl !== undefined ? { serverUrl: input.serverUrl } : {}),
  })

  return session.data.id
}

export async function createWorktree(input: {
  directory: string
  workspaceID?: string | undefined
  serverUrl?: string | undefined
}): Promise<{ directory: string; name: string }> {
  const worktree = await opencodeClient(input.serverUrl).worktree.create(
    { directory: input.directory, ...(input.workspaceID !== undefined ? { workspace: input.workspaceID } : {}) },
    { throwOnError: true },
  )

  return { directory: worktree.data.directory, name: worktree.data.name }
}

export type ModelOption = {
  providerID: string
  providerName: string
  modelID: string
  name: string
  variants: string[]
}

export type ModelProviderOption = {
  id: string
  name: string
  models: ModelOption[]
}

export type DefaultModelOption = {
  providerID: string
  modelID: string
  variant?: string | undefined
}

export async function loadDefaultModel(input: {
  directory?: string | undefined
  workspaceID?: string | undefined
  serverUrl?: string | undefined
  signal?: AbortSignal | undefined
}): Promise<DefaultModelOption | undefined> {
  const client = opencodeClient(input.serverUrl)
  const [config, agents] = await Promise.all([
    client.config.get(routeOptions(input), {
      throwOnError: true,
      ...(input.signal !== undefined ? { signal: input.signal } : {}),
    }),
    client.app.agents(routeOptions(input), {
      throwOnError: true,
      ...(input.signal !== undefined ? { signal: input.signal } : {}),
    }),
  ])
  return defaultAgentModel(config.data.default_agent, agents.data) ?? parseModelConfig(config.data.model)
}

export async function loadModelProviders(input: {
  directory?: string | undefined
  workspaceID?: string | undefined
  serverUrl?: string | undefined
  signal?: AbortSignal | undefined
}): Promise<ModelProviderOption[]> {
  const result = await opencodeClient(input.serverUrl).config.providers(routeOptions(input), {
    throwOnError: true,
    ...(input.signal !== undefined ? { signal: input.signal } : {}),
  })

  return result.data.providers
    .map((provider: Provider) => {
      const providerName = provider.name ?? provider.id
      return {
        id: provider.id,
        name: providerName,
        models: Object.entries(provider.models).map(([modelID, model]) => ({
          providerID: provider.id,
          providerName,
          modelID,
          name: model.name ?? modelID,
          variants: Object.keys(model.variants ?? {}),
        })),
      }
    })
    .filter((provider) => provider.models.length > 0)
}

function parseModelConfig(value: string | undefined): DefaultModelOption | undefined {
  if (!value) return undefined

  const separatorIndex = value.indexOf("/")
  if (separatorIndex <= 0 || separatorIndex === value.length - 1) return undefined

  return {
    providerID: value.slice(0, separatorIndex),
    modelID: value.slice(separatorIndex + 1),
  }
}

function defaultAgentModel(defaultAgentName: string | undefined, agents: Agent[]): DefaultModelOption | undefined {
  const configuredAgent = defaultAgentName ? agents.find((agent) => agent.name === defaultAgentName) : undefined
  const fallbackAgent = agents.find((agent) => agent.name === "build")
  const agent = configuredAgent ?? fallbackAgent
  const model = agent?.model
  if (!model) return undefined

  return {
    providerID: model.providerID,
    modelID: model.modelID,
    ...(agent.variant !== undefined ? { variant: agent.variant } : {}),
  }
}

export async function removeWorktree(input: {
  projectDirectory: string
  worktreeDirectory: string
  workspaceID?: string | undefined
  serverUrl?: string | undefined
}): Promise<void> {
  await opencodeClient(input.serverUrl).worktree.remove(
    {
      directory: input.projectDirectory,
      ...(input.workspaceID !== undefined ? { workspace: input.workspaceID } : {}),
      worktreeRemoveInput: { directory: input.worktreeDirectory },
    },
    { throwOnError: true },
  )
}

export async function deleteSession(input: {
  sessionID: string
  directory?: string | undefined
  workspaceID?: string | undefined
  serverUrl?: string | undefined
}): Promise<void> {
  await opencodeClient(input.serverUrl).session.delete(
    {
      sessionID: input.sessionID,
      ...routeOptions(input),
    },
    { throwOnError: true },
  )
}

export async function interruptSession(input: {
  sessionID: string
  directory?: string | undefined
  workspaceID?: string | undefined
  serverUrl?: string | undefined
}): Promise<void> {
  await opencodeClient(input.serverUrl).session.abort(
    {
      sessionID: input.sessionID,
      ...routeOptions(input),
    },
    { throwOnError: true },
  )
}

export async function selectTuiSession(input: {
  sessionID: string
  directory?: string | undefined
  workspaceID?: string | undefined
  serverUrl?: string | undefined
}): Promise<void> {
  await opencodeClient(input.serverUrl).tui.selectSession(
    {
      sessionID: input.sessionID,
      ...routeOptions(input),
    },
    { throwOnError: true },
  )
}

export async function loadLatestMessages(input: {
  sessionID: string
  directory?: string | undefined
  workspaceID?: string | undefined
  limit?: number | undefined
  pendingPermissionRequests?: SessionPermissionRequest[] | undefined
  serverUrl?: string | undefined
  signal?: AbortSignal | undefined
}): Promise<LatestMessages> {
  const limit = input.limit ?? LATEST_MESSAGES_LIMIT
  const client = opencodeClient(input.serverUrl)
  const [result, preview] = await Promise.all([
    client.session.messages(
      {
        sessionID: input.sessionID,
        ...routeOptions(input),
        limit,
      },
      { throwOnError: true, ...(input.signal !== undefined ? { signal: input.signal } : {}) },
    ),
    loadLatestMessagePreview({
      client,
      sessionID: input.sessionID,
      directory: input.directory,
      workspaceID: input.workspaceID,
      limit,
      pendingPermissionRequests: input.pendingPermissionRequests ?? [],
      signal: input.signal,
    }).catch((previewError): LatestMessagePreview | undefined => {
      if (isAbortError(previewError)) throw previewError
      return undefined
    }),
  ])

  return mergeLatestPreview(extractLatestMessages(result.data, limit, input.pendingPermissionRequests ?? []), preview)
}

export async function loadSessionHistory(input: {
  sessionID: string
  directory?: string | undefined
  workspaceID?: string | undefined
  pendingPermissionRequests?: SessionPermissionRequest[] | undefined
  serverUrl?: string | undefined
  signal?: AbortSignal | undefined
}): Promise<SessionHistoryMessage[]> {
  const client = opencodeClient(input.serverUrl)
  const [result, pendingPermissionRequests] = await Promise.all([
    client.session.messages(
      {
        sessionID: input.sessionID,
        ...routeOptions(input),
      },
      { throwOnError: true, ...(input.signal !== undefined ? { signal: input.signal } : {}) },
    ),
    input.pendingPermissionRequests !== undefined
      ? Promise.resolve(input.pendingPermissionRequests)
      : loadPendingPermissions({
          sessionID: input.sessionID,
          directory: input.directory,
          workspaceID: input.workspaceID,
          serverUrl: input.serverUrl,
          signal: input.signal,
        }).catch((permissionError): SessionPermissionRequest[] => {
          if (isAbortError(permissionError)) throw permissionError
          console.error("Failed to load pending permission requests", permissionError)
          return []
        }),
  ])

  return extractHistoryMessages(result.data, pendingPermissionRequests)
}

export async function loadPendingPermissions(input: {
  sessionID?: string | undefined
  directory?: string | undefined
  workspaceID?: string | undefined
  serverUrl?: string | undefined
  signal?: AbortSignal | undefined
}): Promise<SessionPermissionRequest[]> {
  const result = await opencodeClient(input.serverUrl).permission.list(routeOptions(input), {
    throwOnError: true,
    ...(input.signal !== undefined ? { signal: input.signal } : {}),
  })
  const requests = result.data.map(toSessionPermissionRequest)
  return input.sessionID === undefined ? requests : requests.filter((request) => request.sessionID === input.sessionID)
}

export async function replyPermissionRequest(input: {
  requestID: string
  reply: "once" | "always" | "reject"
  message?: string | undefined
  directory?: string | undefined
  workspaceID?: string | undefined
  serverUrl?: string | undefined
}): Promise<void> {
  await opencodeClient(input.serverUrl).permission.reply(
    {
      requestID: input.requestID,
      reply: input.reply,
      ...routeOptions(input),
      ...(input.message !== undefined ? { message: input.message } : {}),
    },
    { throwOnError: true },
  )
}

export async function loadContextUsage(input: {
  sessionID: string
  directory?: string | undefined
  workspaceID?: string | undefined
  historyAssistantMessage?: AssistantMessage | undefined
  serverUrl?: string | undefined
  signal?: AbortSignal | undefined
}): Promise<{ tokens?: number; percent?: number }> {
  const client = opencodeClient(input.serverUrl)
  const [context, providers] = await Promise.all([
    client.v2.session.context(
      {
        sessionID: input.sessionID,
        ...routeOptions(input),
      },
      { throwOnError: true, ...(input.signal !== undefined ? { signal: input.signal } : {}) },
    ),
    client.config.providers(routeOptions(input), {
      throwOnError: true,
      ...(input.signal !== undefined ? { signal: input.signal } : {}),
    }),
  ])

  const latestAssistant = latestAssistantMessage(context.data)
  const fallbackAssistant = latestAssistant ? undefined : input.historyAssistantMessage
  const tokens = latestAssistant
    ? contextTokens(latestAssistant)
    : fallbackAssistant
      ? historyTokens(fallbackAssistant)
      : undefined
  const providerID = latestAssistant?.model.providerID ?? fallbackAssistant?.providerID
  const modelID = latestAssistant?.model.id ?? fallbackAssistant?.modelID
  const model =
    providerID && modelID
      ? providers.data.providers.find((provider: Provider) => provider.id === providerID)?.models[modelID]
      : undefined
  const limit = model?.limit.context
  const percent = tokens !== undefined && limit ? Math.round((tokens / limit) * 100) : undefined
  return { ...(tokens !== undefined ? { tokens } : {}), ...(percent !== undefined ? { percent } : {}) }
}

function extractLatestMessages(
  messages: SessionMessagesResponse,
  limit: number,
  pendingPermissionRequests: SessionPermissionRequest[],
): LatestMessages {
  let userMessage = ""
  let assistantMessage = ""
  let latestResponseError = ""
  let assistantInfo: AssistantMessage | undefined
  let foundAssistant = false
  const history = extractHistoryMessages(messages, pendingPermissionRequests)
  const permissionMessage = formatPermissionRequests(pendingPermissionRequests)

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (!message) continue

    if (!foundAssistant && message.info.role === "assistant") {
      foundAssistant = true
      assistantMessage = textParts(message.parts)
      latestResponseError = assistantErrorText(message.info.error)
      if (hasContextTokens(message.info)) assistantInfo = message.info
    }
    if (!userMessage && message.info.role === "user") userMessage = textParts(message.parts)
    if (userMessage && foundAssistant) break
  }
  const responseErrorMessage = latestResponseError ? `Error: ${latestResponseError}` : ""

  return {
    userMessage,
    assistantMessage: permissionMessage || responseErrorMessage || latestHistoryPreview(history) || assistantMessage,
    ...(latestResponseError ? { latestResponseError } : {}),
    messages: history,
    hasMore: messages.length >= limit,
    ...(assistantInfo !== undefined ? { assistantInfo } : {}),
  }
}

async function loadLatestMessagePreview(input: {
  client: ReturnType<typeof opencodeClient>
  sessionID: string
  directory?: string | undefined
  workspaceID?: string | undefined
  limit: number
  pendingPermissionRequests: SessionPermissionRequest[]
  signal?: AbortSignal | undefined
}): Promise<LatestMessagePreview> {
  const result = await input.client.v2.session.messages(
    {
      sessionID: input.sessionID,
      ...routeOptions(input),
      limit: input.limit,
      order: "desc",
    },
    { throwOnError: true, ...(input.signal !== undefined ? { signal: input.signal } : {}) },
  )

  return latestSessionMessagePreview(result.data.items, input.pendingPermissionRequests)
}

function mergeLatestPreview(messages: LatestMessages, preview: LatestMessagePreview | undefined): LatestMessages {
  if (!preview) return messages
  return {
    ...messages,
    userMessage: preview.userMessage || messages.userMessage,
    assistantMessage: preview.message || messages.assistantMessage,
    latestResponseError: preview.latestResponseError,
  }
}

export function latestSessionMessagePreview(
  messages: SessionMessage[],
  pendingPermissionRequests: SessionPermissionRequest[] = [],
): LatestMessagePreview {
  let message = ""
  let messageRole: "user" | "assistant" | undefined
  let userMessage = ""
  let latestResponseError = ""
  let foundAssistant = false
  const permissionMessage = formatPermissionRequests(pendingPermissionRequests)

  for (const item of messages) {
    if (!userMessage && item.type === "user") userMessage = item.text.trim()
    if (!foundAssistant && item.type === "assistant") {
      foundAssistant = true
      latestResponseError = sessionErrorText(item.error)
    }
    if (!message) {
      const text = sessionMessageText(item)
      if (text) {
        message = text
        if (item.type === "user" || item.type === "assistant") messageRole = item.type
      }
    }
    if (message && userMessage && foundAssistant) break
  }

  const latestMessageResponseError = messageRole === "assistant" ? latestResponseError : ""
  const responseErrorMessage = latestMessageResponseError ? `Error: ${latestMessageResponseError}` : ""
  return {
    message: permissionMessage || responseErrorMessage || message,
    userMessage,
    ...(latestMessageResponseError ? { latestResponseError: latestMessageResponseError } : {}),
  }
}

function latestHistoryPreview(messages: SessionHistoryMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message?.text.trim()) return message.text.trim()
  }
  return ""
}

function sessionMessageText(message: SessionMessage): string {
  if (message.type === "user") return message.text.trim()
  if (message.type === "assistant") return assistantContentText(message) || sessionErrorText(message.error)
  return ""
}

function assistantContentText(message: Extract<SessionMessage, { type: "assistant" }>): string {
  return message.content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim()
}

function sessionErrorText(error: Extract<SessionMessage, { type: "assistant" }>["error"]): string {
  return error?.message.trim() ?? ""
}

function extractHistoryMessages(
  messages: SessionMessagesResponse,
  pendingPermissionRequests: SessionPermissionRequest[] = [],
): SessionHistoryMessage[] {
  const answeredUserIds = new Set<string>()
  for (const message of messages) {
    if (message.info.role === "assistant" && message.info.parentID) answeredUserIds.add(message.info.parentID)
  }
  const history: SessionHistoryMessage[] = []
  const appendedPermissionIds = new Set<string>()
  const permissionRequestsByMessageId = new Map<string, SessionPermissionRequest[]>()
  for (const request of pendingPermissionRequests) {
    if (!request.tool?.messageID) continue
    const requests = permissionRequestsByMessageId.get(request.tool.messageID) ?? []
    requests.push(request)
    permissionRequestsByMessageId.set(request.tool.messageID, requests)
  }

  for (const message of messages) {
    if (message.info.role !== "user" && message.info.role !== "assistant") continue

    const text = textParts(message.parts)
    if (text) {
      history.push({
        id: message.info.id,
        role: message.info.role,
        text,
        ...(message.info.role === "user" && !answeredUserIds.has(message.info.id) ? { queued: true } : {}),
      })
    }

    if (message.info.role === "assistant") {
      const responseError = assistantErrorText(message.info.error)
      if (responseError) {
        history.push({
          id: `${message.info.id}:error`,
          role: "assistant",
          text: responseError,
          responseError: true,
        })
      }
    }

    for (const request of permissionRequestsByMessageId.get(message.info.id) ?? []) {
      history.push(permissionHistoryMessage(request))
      appendedPermissionIds.add(request.id)
    }
  }

  for (const request of pendingPermissionRequests) {
    if (appendedPermissionIds.has(request.id)) continue
    history.push(permissionHistoryMessage(request))
  }

  return history
}

function toSessionPermissionRequest(request: PermissionRequest): SessionPermissionRequest {
  return {
    id: request.id,
    sessionID: request.sessionID,
    permission: request.permission,
    patterns: request.patterns,
    summary: formatPermissionRequest(request.permission, request.patterns),
    ...(request.tool !== undefined ? { tool: request.tool } : {}),
  }
}

export function formatPermissionRequests(requests: SessionPermissionRequest[]): string {
  if (requests.length === 0) return ""
  if (requests.length === 1) return requests[0]!.summary
  const permissions = [...new Set(requests.map((request) => request.permission))].join(", ")
  return `${requests.length} permission requests: ${permissions}`
}

function formatPermissionRequest(permission: string, patterns: string[]): string {
  const patternText = patterns.length > 0 ? ` ${patterns.join(", ")}` : ""
  return `Permission requested: ${permission}${patternText}`
}

function permissionHistoryMessage(request: SessionPermissionRequest): SessionHistoryMessage {
  return {
    id: `permission:${request.id}`,
    role: "assistant",
    text: request.summary,
    permissionRequested: true,
  }
}

function routeOptions(input: { directory?: string | undefined; workspaceID?: string | undefined }) {
  return {
    ...(input.directory !== undefined ? { directory: input.directory } : {}),
    ...(input.workspaceID !== undefined ? { workspace: input.workspaceID } : {}),
  }
}

function latestAssistantMessage(
  messages: SessionMessage[],
): Extract<SessionMessage, { type: "assistant" }> | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message?.type === "assistant") return message
  }
  return undefined
}

function contextTokens(message: Extract<SessionMessage, { type: "assistant" }>): number | undefined {
  if (!message.tokens) return undefined
  return message.tokens.input + message.tokens.cache.read + message.tokens.cache.write
}

function historyTokens(message: AssistantMessage): number {
  return message.tokens.input + message.tokens.cache.read + message.tokens.cache.write
}

function hasContextTokens(message: AssistantMessage): boolean {
  return historyTokens(message) > 0
}

function assistantErrorText(error: AssistantMessage["error"]): string {
  if (!error) return ""

  const message = dataMessage(error.data)
  if (error.name === "MessageOutputLengthError") return message ?? "Response exceeded the output length limit."
  if (error.name === "ProviderAuthError") return message ? `Provider auth error: ${message}` : "Provider auth error."
  if (error.name === "APIError") {
    const status = error.data.statusCode ? ` ${error.data.statusCode}` : ""
    return message ? `API error${status}: ${message}` : `API error${status}.`
  }
  if (error.name === "MessageAbortedError") return message ?? "Response aborted."
  return message ?? "Response failed."
}

function dataMessage(data: { [key: string]: unknown }): string | undefined {
  return typeof data.message === "string" && data.message.trim() ? data.message.trim() : undefined
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError"
}

function textParts(parts: Part[]): string {
  return parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim()
}
