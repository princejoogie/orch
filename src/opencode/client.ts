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
  assistantInfo?: AssistantMessage | undefined
}

export async function sendPrompt(input: {
  sessionID: string
  text: string
  directory?: string | undefined
  workspaceID?: string | undefined
}): Promise<void> {
  await opencodeClient.session.promptAsync(
    {
      sessionID: input.sessionID,
      ...routeOptions(input),
      parts: [{ type: "text", text: input.text }],
    },
    { throwOnError: true },
  )
}

export async function createSessionWithPrompt(input: {
  text: string
  directory: string
  workspaceID?: string | undefined
}): Promise<string> {
  const session = await opencodeClient.session.create(
    { directory: input.directory, ...(input.workspaceID !== undefined ? { workspace: input.workspaceID } : {}) },
    { throwOnError: true },
  )

  await sendPrompt({
    sessionID: session.data.id,
    directory: input.directory,
    text: input.text,
    ...(input.workspaceID !== undefined ? { workspaceID: input.workspaceID } : {}),
  })

  return session.data.id
}

export async function deleteSession(input: {
  sessionID: string
  directory?: string | undefined
  workspaceID?: string | undefined
}): Promise<void> {
  await opencodeClient.session.delete(
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
}): Promise<LatestMessages> {
  const result = await opencodeClient.session.messages(
    {
      sessionID: input.sessionID,
      ...routeOptions(input),
      limit: input.limit ?? 20,
    },
    { throwOnError: true },
  )

  return extractLatestMessages(result.data)
}

export async function loadContextUsage(input: {
  sessionID: string
  directory?: string | undefined
  workspaceID?: string | undefined
  historyAssistantMessage?: AssistantMessage | undefined
}): Promise<{ tokens?: number; percent?: number }> {
  const [context, providers] = await Promise.all([
    opencodeClient.v2.session.context(
      {
        sessionID: input.sessionID,
        ...routeOptions(input),
      },
      { throwOnError: true },
    ),
    opencodeClient.config.providers(routeOptions(input), { throwOnError: true }),
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

  return { userMessage, assistantMessage, ...(assistantInfo !== undefined ? { assistantInfo } : {}) }
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
