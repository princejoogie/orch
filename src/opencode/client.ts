import {
  createOpencodeClient,
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

export function createPersistenceClient(options: { serverUrl?: string } = {}) {
  return createOpencodeClient({ baseUrl: options.serverUrl ?? opencodeServerUrl() })
}

export async function sendPrompt(input: {
  sessionID: string
  text: string
  directory?: string
  workspaceID?: string
  serverUrl?: string
}): Promise<void> {
  const client = createPersistenceClient({ serverUrl: input.serverUrl })
  await client.session.promptAsync(
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
  serverUrl?: string
}): Promise<string> {
  const client = createPersistenceClient({ serverUrl: input.serverUrl })
  const session = await client.session.create(
    { directory: input.directory, workspace: input.workspaceID },
    { throwOnError: true },
  )

  await sendPrompt({
    sessionID: session.data.id,
    directory: input.directory,
    workspaceID: input.workspaceID,
    serverUrl: input.serverUrl,
    text: input.text,
  })

  return session.data.id
}

export async function loadLatestMessage(input: {
  sessionID: string
  directory?: string
  workspaceID?: string
  serverUrl?: string
}): Promise<string> {
  const client = createPersistenceClient({ serverUrl: input.serverUrl })
  const result = await client.session.messages(
    {
      sessionID: input.sessionID,
      directory: input.directory,
      workspace: input.workspaceID,
      limit: 8,
    },
    { throwOnError: true },
  )

  return extractLatestText(result.data)
}

export async function loadContextUsage(input: {
  sessionID: string
  directory?: string
  workspaceID?: string
  serverUrl?: string
}): Promise<{ tokens?: number; percent?: number }> {
  const client = createPersistenceClient({ serverUrl: input.serverUrl })
  const [context, providers] = await Promise.all([
    client.v2.session.context(
      {
        sessionID: input.sessionID,
        directory: input.directory,
        workspace: input.workspaceID,
      },
      { throwOnError: true },
    ),
    client.config.providers({ directory: input.directory, workspace: input.workspaceID }, { throwOnError: true }),
  ])

  const latestAssistant = latestAssistantMessage(context.data)
  const tokens = latestAssistant ? contextTokens(latestAssistant) : undefined
  const model = latestAssistant
    ? providers.data.providers.find((provider: Provider) => provider.id === latestAssistant.model.providerID)?.models[
        latestAssistant.model.id
      ]
    : undefined
  const limit = model?.limit.context
  return {
    tokens,
    percent: tokens !== undefined && limit ? Math.round((tokens / limit) * 100) : undefined,
  }
}

function extractLatestText(messages: SessionMessagesResponse): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (!message) continue

    const text = textParts(message.parts)
    if (text) return text

    const tool = [...message.parts].reverse().find((part) => part.type === "tool")
    if (tool) return `${tool.tool} ${tool.state.status}`
  }
  return ""
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

function textParts(parts: Part[]): string {
  return parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim()
}
