import {
  createOpencodeClient,
  type AssistantMessage,
  type Part,
  type Provider,
  type SessionMessage,
  type SessionMessagesResponse,
} from "@opencode-ai/sdk/v2"

export const DEFAULT_LIMIT = 300
export const DEFAULT_OPENCODE_SERVER_URL = "http://localhost:4096"

export function opencodeServerUrl(): string {
  return Bun.env.OPENCODE_SERVER_URL ?? DEFAULT_OPENCODE_SERVER_URL
}

export const opencodeClient = createOpencodeClient({ baseUrl: opencodeServerUrl() })

export type LatestMessages = {
  userMessage: string
  assistantMessage: string
  assistantInfo?: AssistantMessage
}

export async function sendPrompt(input: {
  sessionID: string
  text: string
  directory?: string
  workspaceID?: string
}): Promise<void> {
  await opencodeClient.session.promptAsync(
    {
      sessionID: input.sessionID,
      directory: input.directory,
      workspace: input.workspaceID,
      parts: [{ type: "text", text: input.text }],
    },
    { throwOnError: true },
  )
}

export async function createSessionWithPrompt(input: {
  text: string
  directory: string
  workspaceID?: string
}): Promise<string> {
  const session = await opencodeClient.session.create(
    { directory: input.directory, workspace: input.workspaceID },
    { throwOnError: true },
  )

  await sendPrompt({
    sessionID: session.data.id,
    directory: input.directory,
    workspaceID: input.workspaceID,
    text: input.text,
  })

  return session.data.id
}

export async function deleteSession(input: {
  sessionID: string
  directory?: string
  workspaceID?: string
}): Promise<void> {
  await opencodeClient.session.delete(
    {
      sessionID: input.sessionID,
      directory: input.directory,
      workspace: input.workspaceID,
    },
    { throwOnError: true },
  )
}

export async function loadLatestMessages(input: {
  sessionID: string
  directory?: string
  workspaceID?: string
  limit?: number
}): Promise<LatestMessages> {
  const result = await opencodeClient.session.messages(
    {
      sessionID: input.sessionID,
      directory: input.directory,
      workspace: input.workspaceID,
      limit: input.limit ?? 20,
    },
    { throwOnError: true },
  )

  return extractLatestMessages(result.data)
}

export async function loadContextUsage(input: {
  sessionID: string
  directory?: string
  workspaceID?: string
  historyAssistantMessage?: AssistantMessage
}): Promise<{ tokens?: number; percent?: number }> {
  const [context, providers] = await Promise.all([
    opencodeClient.v2.session.context(
      {
        sessionID: input.sessionID,
        directory: input.directory,
        workspace: input.workspaceID,
      },
      { throwOnError: true },
    ),
    opencodeClient.config.providers(
      { directory: input.directory, workspace: input.workspaceID },
      { throwOnError: true },
    ),
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
  return {
    tokens,
    percent: tokens !== undefined && limit ? Math.round((tokens / limit) * 100) : undefined,
  }
}

function extractLatestMessages(messages: SessionMessagesResponse): LatestMessages {
  let userMessage = ""
  let assistantMessage = ""
  let assistantInfo: AssistantMessage | undefined

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

  return { userMessage, assistantMessage, assistantInfo }
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
