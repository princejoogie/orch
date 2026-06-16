import type { AssistantMessage, Part, Provider, SessionMessage, SessionMessagesResponse2 } from "@opencode-ai/sdk/v2"
import { Effect } from "effect"
import type { SessionHistoryMessage, SessionPermissionRequest } from "../types.ts"
import {
  isAbortError,
  opencodeCall,
  opencodeClient,
  requestOptions,
  routeOptions,
  type OpencodeClient,
} from "./base.ts"
import { formatPermissionRequests, loadPendingPermissions, permissionHistoryMessage } from "./permission.ts"

export const LATEST_MESSAGES_LIMIT = 20

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

export function sendPrompt(input: {
  sessionID: string
  text: string
  model?: { providerID: string; modelID: string; variant?: string | undefined } | undefined
  directory?: string | undefined
  workspaceID?: string | undefined
  serverUrl?: string | undefined
}) {
  return opencodeCall("session.promptAsync", (signal) =>
    opencodeClient(input.serverUrl).session.promptAsync(
      {
        sessionID: input.sessionID,
        ...routeOptions(input),
        ...(input.model !== undefined
          ? { model: { providerID: input.model.providerID, modelID: input.model.modelID } }
          : {}),
        ...(input.model?.variant !== undefined ? { variant: input.model.variant } : {}),
        parts: [{ type: "text", text: input.text }],
      },
      requestOptions(undefined, signal),
    ),
  ).pipe(Effect.asVoid)
}

export function createSessionWithPrompt(input: {
  text: string
  directory: string
  model?: { providerID: string; modelID: string; variant?: string | undefined } | undefined
  workspaceID?: string | undefined
  serverUrl?: string | undefined
}) {
  const client = opencodeClient(input.serverUrl)
  return Effect.gen(function* () {
    const session = yield* opencodeCall("session.create", (signal) =>
      client.session.create(
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
        requestOptions(undefined, signal),
      ),
    )

    yield* sendPrompt({
      sessionID: session.data.id,
      directory: input.directory,
      text: input.text,
      ...(input.model !== undefined ? { model: input.model } : {}),
      ...(input.workspaceID !== undefined ? { workspaceID: input.workspaceID } : {}),
      ...(input.serverUrl !== undefined ? { serverUrl: input.serverUrl } : {}),
    })

    return session.data.id
  })
}

export function deleteSession(input: {
  sessionID: string
  directory?: string | undefined
  workspaceID?: string | undefined
  serverUrl?: string | undefined
}) {
  return opencodeCall("session.delete", (signal) =>
    opencodeClient(input.serverUrl).session.delete(
      {
        sessionID: input.sessionID,
        ...routeOptions(input),
      },
      requestOptions(undefined, signal),
    ),
  ).pipe(Effect.asVoid)
}

export function interruptSession(input: {
  sessionID: string
  directory?: string | undefined
  workspaceID?: string | undefined
  serverUrl?: string | undefined
}) {
  return opencodeCall("session.abort", (signal) =>
    opencodeClient(input.serverUrl).session.abort(
      {
        sessionID: input.sessionID,
        ...routeOptions(input),
      },
      requestOptions(undefined, signal),
    ),
  ).pipe(Effect.asVoid)
}

export function selectTuiSession(input: {
  sessionID: string
  directory?: string | undefined
  workspaceID?: string | undefined
  serverUrl?: string | undefined
}) {
  return opencodeCall("tui.selectSession", (signal) =>
    opencodeClient(input.serverUrl).tui.selectSession(
      {
        sessionID: input.sessionID,
        ...routeOptions(input),
      },
      requestOptions(undefined, signal),
    ),
  ).pipe(Effect.asVoid)
}

export function loadLatestMessages(input: {
  sessionID: string
  directory?: string | undefined
  workspaceID?: string | undefined
  limit?: number | undefined
  pendingPermissionRequests?: SessionPermissionRequest[] | undefined
  serverUrl?: string | undefined
  signal?: AbortSignal | undefined
}) {
  const limit = input.limit ?? LATEST_MESSAGES_LIMIT
  const client = opencodeClient(input.serverUrl)
  return Effect.gen(function* () {
    const [result, preview] = yield* Effect.all(
      [
        opencodeCall("session.messages", (signal) =>
          client.session.messages(
            {
              sessionID: input.sessionID,
              ...routeOptions(input),
              limit,
            },
            requestOptions(input, signal),
          ),
        ),
        loadLatestMessagePreview({
          client,
          sessionID: input.sessionID,
          directory: input.directory,
          workspaceID: input.workspaceID,
          limit,
          pendingPermissionRequests: input.pendingPermissionRequests ?? [],
          signal: input.signal,
        }).pipe(
          Effect.catchAll((previewError) =>
            isAbortError(previewError) ? Effect.fail(previewError) : Effect.succeed(undefined),
          ),
        ),
      ],
      { concurrency: 2 },
    )

    return mergeLatestPreview(extractLatestMessages(result.data, limit, input.pendingPermissionRequests ?? []), preview)
  })
}

export function loadSessionHistory(input: {
  sessionID: string
  directory?: string | undefined
  workspaceID?: string | undefined
  pendingPermissionRequests?: SessionPermissionRequest[] | undefined
  serverUrl?: string | undefined
  signal?: AbortSignal | undefined
}) {
  const client = opencodeClient(input.serverUrl)
  return Effect.gen(function* () {
    const [result, pendingPermissionRequests] = yield* Effect.all(
      [
        opencodeCall("session.messages", (signal) =>
          client.session.messages(
            {
              sessionID: input.sessionID,
              ...routeOptions(input),
            },
            requestOptions(input, signal),
          ),
        ),
        input.pendingPermissionRequests !== undefined
          ? Effect.succeed(input.pendingPermissionRequests)
          : loadPendingPermissions({
              sessionID: input.sessionID,
              directory: input.directory,
              workspaceID: input.workspaceID,
              serverUrl: input.serverUrl,
              signal: input.signal,
            }).pipe(
              Effect.catchAll((permissionError) => {
                if (isAbortError(permissionError)) return Effect.fail(permissionError)
                return Effect.sync(() => {
                  console.error("Failed to load pending permission requests", permissionError)
                  return []
                })
              }),
            ),
      ],
      { concurrency: 2 },
    )

    return extractHistoryMessages(result.data, pendingPermissionRequests)
  })
}

export function loadContextUsage(input: {
  sessionID: string
  directory?: string | undefined
  workspaceID?: string | undefined
  historyAssistantMessage?: AssistantMessage | undefined
  serverUrl?: string | undefined
  signal?: AbortSignal | undefined
}) {
  const client = opencodeClient(input.serverUrl)
  return Effect.gen(function* () {
    const [context, providers] = yield* Effect.all(
      [
        opencodeCall("v2.session.context", (signal) =>
          client.v2.session.context(
            {
              sessionID: input.sessionID,
              ...routeOptions(input),
            },
            requestOptions(input, signal),
          ),
        ),
        opencodeCall("config.providers", (signal) =>
          client.config.providers(routeOptions(input), requestOptions(input, signal)),
        ),
      ],
      { concurrency: 2 },
    )

    const latestAssistant = latestAssistantMessage(context.data.data)
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
  })
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

function extractLatestMessages(
  messages: SessionMessagesResponse2,
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

function loadLatestMessagePreview(input: {
  client: OpencodeClient
  sessionID: string
  directory?: string | undefined
  workspaceID?: string | undefined
  limit: number
  pendingPermissionRequests: SessionPermissionRequest[]
  signal?: AbortSignal | undefined
}) {
  return Effect.gen(function* () {
    const result = yield* opencodeCall("v2.session.messages", (signal) =>
      input.client.v2.session.messages(
        {
          sessionID: input.sessionID,
          ...routeOptions(input),
          limit: input.limit,
          order: "desc",
        },
        requestOptions(input, signal),
      ),
    )

    return latestSessionMessagePreview(result.data.data, input.pendingPermissionRequests)
  })
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
  messages: SessionMessagesResponse2,
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

function textParts(parts: Part[]): string {
  return parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim()
}
