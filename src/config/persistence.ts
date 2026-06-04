import { dirname } from "node:path"

const JSON_INDENT = 2

export function orchConfigPath(fileName = "config.json"): string {
  return `${homeDirectory()}/.config/orch/${fileName}`
}

export function orchStatePath(fileName = "state.json"): string {
  return `${homeDirectory()}/.local/state/orch/${fileName}`
}

export async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  const file = Bun.file(filePath)
  if (!(await file.exists())) return fallback

  try {
    return (await file.json()) as T
  } catch (readError) {
    console.error(`Failed to read JSON file ${filePath}`, readError)
    return fallback
  }
}

export async function writeJsonFile<T>(filePath: string, value: T): Promise<void> {
  await Bun.$`mkdir -p ${dirname(filePath)}`.quiet()
  await Bun.write(filePath, `${JSON.stringify(value, null, JSON_INDENT)}\n`)
}

function homeDirectory(): string {
  return Bun.env.HOME ?? "."
}
