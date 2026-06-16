import { dirname } from "node:path"
import { Data, Effect } from "effect"

const JSON_INDENT = 2

export class OrchFileError extends Data.TaggedError("OrchFileError")<{
  readonly message: string
  readonly operation: "read" | "write"
  readonly path: string
  readonly cause: unknown
}> {}

export function orchConfigPath(fileName = "config.json"): string {
  return `${homeDirectory()}/.config/orch/${fileName}`
}

export function orchStatePath(fileName = "state.json"): string {
  return `${homeDirectory()}/.local/state/orch/${fileName}`
}

export function readJsonFile<T>(filePath: string, fallback: T): Effect.Effect<T> {
  return Effect.gen(function* () {
    const file = Bun.file(filePath)
    const exists = yield* Effect.tryPromise({
      try: () => file.exists(),
      catch: (cause) =>
        new OrchFileError({
          message: `Failed to stat JSON file ${filePath}`,
          operation: "read",
          path: filePath,
          cause,
        }),
    }).pipe(
      Effect.catchTag("OrchFileError", (readError) =>
        Effect.sync(() => {
          console.error(readError.message, readError.cause)
          return false
        }),
      ),
    )
    if (!exists) return fallback

    return yield* Effect.tryPromise({
      try: () => file.json() as Promise<T>,
      catch: (cause) =>
        new OrchFileError({
          message: `Failed to read JSON file ${filePath}`,
          operation: "read",
          path: filePath,
          cause,
        }),
    }).pipe(
      Effect.catchTag("OrchFileError", (readError) =>
        Effect.sync(() => {
          console.error(readError.message, readError.cause)
          return fallback
        }),
      ),
    )
  })
}

export function writeJsonFile<T>(filePath: string, value: T): Effect.Effect<void, OrchFileError> {
  return Effect.gen(function* () {
    yield* Effect.tryPromise({
      try: () => Bun.$`mkdir -p ${dirname(filePath)}`.quiet(),
      catch: (cause) =>
        new OrchFileError({
          message: `Failed to create directory for ${filePath}`,
          operation: "write",
          path: filePath,
          cause,
        }),
    })
    yield* Effect.tryPromise({
      try: () => Bun.write(filePath, `${JSON.stringify(value, null, JSON_INDENT)}\n`),
      catch: (cause) =>
        new OrchFileError({
          message: `Failed to write JSON file ${filePath}`,
          operation: "write",
          path: filePath,
          cause,
        }),
    })
  })
}

function homeDirectory(): string {
  return Bun.env.HOME ?? "."
}
