import { orchConfigPath, orchStatePath, readJsonFile, writeJsonFile } from "./persistence.ts"
import { Effect } from "effect"

export const DEFAULT_OPENCODE_SERVER_URL = "http://localhost:4096"

export type OrchServer = {
  name: string
  url: string
}

export type OrchConfig = {
  servers: OrchServer[]
  activeServerUrl: string
}

export type OrchState = Record<string, unknown>

export function defaultOpencodeServerUrl(): string {
  return normalizeServerUrl(Bun.env.OPENCODE_SERVER_URL ?? DEFAULT_OPENCODE_SERVER_URL)
}

export function defaultOrchConfig(): OrchConfig {
  const url = defaultOpencodeServerUrl()
  return { activeServerUrl: url, servers: [{ name: defaultServerName(url), url }] }
}

export function loadOrchConfig(): Effect.Effect<OrchConfig> {
  return Effect.gen(function* () {
    const raw = yield* readJsonFile<unknown>(orchConfigPath(), defaultOrchConfig())
    return normalizeOrchConfig(raw)
  })
}

export function saveOrchConfig(config: OrchConfig) {
  return Effect.gen(function* () {
    const normalized = normalizeOrchConfig(config)
    yield* writeJsonFile(orchConfigPath(), normalized)
    return normalized
  })
}

export function loadOrchState<T extends OrchState>(fallback: T): Effect.Effect<T> {
  return readJsonFile<T>(orchStatePath(), fallback)
}

export function saveOrchState<T extends OrchState>(state: T) {
  return writeJsonFile(orchStatePath(), state)
}

export function normalizeOrchConfig(value: unknown): OrchConfig {
  const fallback = defaultOrchConfig()
  if (!isObject(value)) return fallback

  const activeServerUrl =
    typeof value.activeServerUrl === "string" ? normalizeServerUrl(value.activeServerUrl) : fallback.activeServerUrl
  const servers = Array.isArray(value.servers)
    ? value.servers.flatMap((server) => normalizeServer(server))
    : fallback.servers
  const uniqueServers = uniqueServersByUrl(servers.length > 0 ? servers : fallback.servers)

  if (!uniqueServers.some((server) => server.url === activeServerUrl)) {
    uniqueServers.unshift({ name: defaultServerName(activeServerUrl), url: activeServerUrl })
  }

  return { activeServerUrl, servers: uniqueServers }
}

export function normalizeServerUrl(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return DEFAULT_OPENCODE_SERVER_URL
  try {
    const url = new URL(trimmed)
    return url.toString().replace(/\/$/, "")
  } catch (urlError) {
    console.error("Failed to parse server URL", urlError)
    return trimmed.replace(/\/$/, "")
  }
}

export function serverNameFromUrl(value: string): string {
  const url = normalizeServerUrl(value)
  try {
    return new URL(url).host || url
  } catch (urlError) {
    console.error("Failed to parse server name URL", urlError)
    return url
  }
}

function normalizeServer(value: unknown): OrchServer[] {
  if (!isObject(value) || typeof value.url !== "string") return []
  const url = normalizeServerUrl(value.url)
  const name = typeof value.name === "string" && value.name.trim() ? value.name.trim() : defaultServerName(url)
  return [{ name, url }]
}

function uniqueServersByUrl(servers: OrchServer[]): OrchServer[] {
  const seen = new Set<string>()
  const unique: OrchServer[] = []
  for (const server of servers) {
    if (seen.has(server.url)) continue
    seen.add(server.url)
    unique.push(server)
  }
  return unique
}

function defaultServerName(url: string): string {
  return serverNameFromUrl(url) || "opencode"
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
