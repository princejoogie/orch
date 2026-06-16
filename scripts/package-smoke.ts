#!/usr/bin/env bun

import { access } from "node:fs/promises"
import { join } from "node:path"
import { Data, Effect } from "effect"
import packageJson from "../package.json" with { type: "json" }
import { AppRuntime } from "../src/effect/app-runtime.ts"

const root = process.cwd()
const binaryPath = join(root, "dist", process.platform === "win32" ? "orch.exe" : "orch")

class SmokeError extends Data.TaggedError("SmokeError")<{
  readonly message: string
  readonly cause: unknown
}> {}

const run = (cmd: readonly string[]) =>
  Effect.gen(function* () {
    const proc = yield* Effect.sync(() => Bun.spawnSync({ cmd: [...cmd], cwd: root, stdout: "pipe", stderr: "pipe" }))
    const result = { stdout: proc.stdout.toString(), stderr: proc.stderr.toString() }
    if (proc.exitCode !== 0) {
      return yield* Effect.fail(
        new SmokeError({
          message: `Command failed (${proc.exitCode}): ${cmd.join(" ")}\n${result.stdout}${result.stderr}`,
          cause: proc.exitCode,
        }),
      )
    }
    return result
  })

const ensure = (condition: boolean, message: string): Effect.Effect<void, SmokeError> =>
  condition ? Effect.void : Effect.fail(new SmokeError({ message, cause: false }))

const program = Effect.gen(function* () {
  yield* run(["bun", "run", "build"])
  yield* Effect.tryPromise({
    try: () => access(binaryPath),
    catch: (cause) => new SmokeError({ message: `Binary is not accessible: ${binaryPath}`, cause }),
  })

  const version = yield* run([binaryPath, "--version"])
  yield* ensure(
    version.stdout.trim() === packageJson.version,
    `Expected ${packageJson.version}, got ${version.stdout.trim()}`,
  )

  const help = yield* run([binaryPath, "--help"])
  yield* ensure(help.stdout.includes("Usage:"), "Expected --help output to include Usage")
  yield* ensure(help.stdout.includes("orch"), "Expected --help output to include binary name")
})

await AppRuntime.runPromise(program).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
