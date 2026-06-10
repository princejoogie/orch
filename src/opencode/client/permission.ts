import type { PermissionRequest } from "@opencode-ai/sdk/v2"
import type { SessionHistoryMessage, SessionPermissionRequest } from "../types.ts"
import { opencodeClient, routeOptions } from "./base.ts"

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

export function formatPermissionRequests(requests: SessionPermissionRequest[]): string {
  if (requests.length === 0) return ""
  if (requests.length === 1) return requests[0]!.summary
  const permissions = [...new Set(requests.map((request) => request.permission))].join(", ")
  return `${requests.length} permission requests: ${permissions}`
}

export function permissionHistoryMessage(request: SessionPermissionRequest): SessionHistoryMessage {
  return {
    id: `permission:${request.id}`,
    role: "assistant",
    text: request.summary,
    permissionRequested: true,
  }
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

function formatPermissionRequest(permission: string, patterns: string[]): string {
  const patternText = patterns.length > 0 ? ` ${patterns.join(", ")}` : ""
  return `Permission requested: ${permission}${patternText}`
}
