import {
  createOpencodeClient,
  type Agent,
  type AssistantMessage,
  type Part,
  type Provider,
  type SessionMessage,
  type SessionMessagesResponse,
} from "@opencode-ai/sdk/v2"
import { DEFAULT_OPENCODE_SERVER_URL, defaultOpencodeServerUrl, normalizeServerUrl } from "../config/orch.ts"
import type { SessionHistoryMessage } from "./types.ts"

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
  messages: SessionHistoryMessage[]
  hasMore: boolean
  assistantInfo?: AssistantMessage | undefined
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
  serverUrl?: string | undefined
  signal?: AbortSignal | undefined
}): Promise<LatestMessages> {
  const limit = input.limit ?? LATEST_MESSAGES_LIMIT
  const result = await opencodeClient(input.serverUrl).session.messages(
    {
      sessionID: input.sessionID,
      ...routeOptions(input),
      limit,
    },
    { throwOnError: true, ...(input.signal !== undefined ? { signal: input.signal } : {}) },
  )

  return extractLatestMessages(result.data, limit)
}

export async function loadSessionHistory(input: {
  sessionID: string
  directory?: string | undefined
  workspaceID?: string | undefined
  serverUrl?: string | undefined
  signal?: AbortSignal | undefined
}): Promise<SessionHistoryMessage[]> {
  const result = await opencodeClient(input.serverUrl).session.messages(
    {
      sessionID: input.sessionID,
      ...routeOptions(input),
    },
    { throwOnError: true, ...(input.signal !== undefined ? { signal: input.signal } : {}) },
  )

  return extractHistoryMessages(result.data)
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

function extractLatestMessages(messages: SessionMessagesResponse, limit: number): LatestMessages {
  let userMessage = ""
  let assistantMessage = ""
  let assistantInfo: AssistantMessage | undefined
  const history = extractHistoryMessages(messages)

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (!message) continue

    if (!assistantMessage && message.info.role === "assistant") {
      assistantMessage = textParts(message.parts)
      if (hasContextTokens(message.info)) assistantInfo = message.info
    }
    if (!userMessage && message.info.role === "user") userMessage = textParts(message.parts)
    if (userMessage && assistantMessage) break
  }

  return {
    userMessage,
    assistantMessage,
    messages: history,
    hasMore: messages.length >= limit,
    ...(assistantInfo !== undefined ? { assistantInfo } : {}),
  }
}

function extractHistoryMessages(messages: SessionMessagesResponse): SessionHistoryMessage[] {
  const answeredUserIds = new Set<string>()
  for (const message of messages) {
    if (message.info.role === "assistant" && message.info.parentID) answeredUserIds.add(message.info.parentID)
  }
  const history: SessionHistoryMessage[] = []

  for (const message of messages) {
    if (message.info.role !== "user" && message.info.role !== "assistant") continue

    const text = textParts(message.parts)
    if (!text) continue

    history.push({
      id: message.info.id,
      role: message.info.role,
      text,
      ...(message.info.role === "user" && !answeredUserIds.has(message.info.id) ? { queued: true } : {}),
    })
  }

  return history
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

function textParts(parts: Part[]): string {
  return parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim()
}
