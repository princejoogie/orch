import { createOpencodeClient } from "@opencode-ai/sdk/v2"
import { DEFAULT_OPENCODE_SERVER_URL, defaultOpencodeServerUrl, normalizeServerUrl } from "../../config/orch.ts"

export const DEFAULT_LIMIT = 100

export function opencodeServerUrl(): string {
  return defaultOpencodeServerUrl()
}

export function opencodeClient(serverUrl = opencodeServerUrl()) {
  return createOpencodeClient({ baseUrl: normalizeServerUrl(serverUrl) || DEFAULT_OPENCODE_SERVER_URL })
}

export type OpencodeClient = ReturnType<typeof opencodeClient>

export function routeOptions(input: { directory?: string | undefined; workspaceID?: string | undefined }) {
  return {
    ...(input.directory !== undefined ? { directory: input.directory } : {}),
    ...(input.workspaceID !== undefined ? { workspace: input.workspaceID } : {}),
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError"
}
