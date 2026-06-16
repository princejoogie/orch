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
  Effect.try({
    try: () => {
      const proc = Bun.spawnSync({ cmd: [...cmd], cwd: root, stdout: "pipe", stderr: "pipe" })
      const result = { stdout: proc.stdout.toString(), stderr: proc.stderr.toString() }
      if (proc.exitCode !== 0) {
        throw new Error(`Command failed (${proc.exitCode}): ${cmd.join(" ")}\n${result.stdout}${result.stderr}`)
      }
      return result
    },
    catch: (cause) => new SmokeError({ message: `Command failed: ${cmd.join(" ")}`, cause }),
  })

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const program = Effect.gen(function* () {
  yield* run(["bun", "run", "build"])
  yield* Effect.tryPromise({
    try: () => access(binaryPath),
    catch: (cause) => new SmokeError({ message: `Binary is not accessible: ${binaryPath}`, cause }),
  })

  const version = yield* run([binaryPath, "--version"])
  assert(version.stdout.trim() === packageJson.version, `Expected ${packageJson.version}, got ${version.stdout.trim()}`)

  const help = yield* run([binaryPath, "--help"])
  assert(help.stdout.includes("Usage:"), "Expected --help output to include Usage")
  assert(help.stdout.includes("orch"), "Expected --help output to include binary name")
})

await AppRuntime.runPromise(program).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
