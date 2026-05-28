import { orchConfigPath, orchStatePath, readJsonFile, writeJsonFile } from "./persistence.ts"

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

export async function loadOrchConfig(): Promise<OrchConfig> {
  const raw = await readJsonFile<unknown>(orchConfigPath(), defaultOrchConfig())
  return normalizeOrchConfig(raw)
}

export async function saveOrchConfig(config: OrchConfig): Promise<OrchConfig> {
  const normalized = normalizeOrchConfig(config)
  await writeJsonFile(orchConfigPath(), normalized)
  return normalized
}

export async function loadOrchState<T extends OrchState>(fallback: T): Promise<T> {
  return readJsonFile<T>(orchStatePath(), fallback)
}

export async function saveOrchState<T extends OrchState>(state: T): Promise<void> {
  await writeJsonFile(orchStatePath(), state)
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
  } catch {
    return trimmed.replace(/\/$/, "")
  }
}

export function serverNameFromUrl(value: string): string {
  const url = normalizeServerUrl(value)
  try {
    return new URL(url).host || url
  } catch {
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
