#!/usr/bin/env bun

import { chmod, mkdir, rm } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import process from "node:process"
import { Data, Effect } from "effect"
import packageJson from "../package.json" with { type: "json" }
import { AppRuntime } from "../src/effect/app-runtime.ts"

type BuildPlatform = "darwin" | "linux" | "windows"
type BuildArch = "x64" | "arm64"

interface BuildTarget {
  platform: BuildPlatform
  arch: BuildArch
}

class BuildError extends Data.TaggedError("BuildError")<{
  readonly message: string
  readonly cause: unknown
}> {}

function getHostTarget(): BuildTarget {
  const platform = process.platform === "win32" ? "windows" : process.platform

  if (platform !== "darwin" && platform !== "linux" && platform !== "windows") {
    throw new Error(`Unsupported platform: ${process.platform}`)
  }

  if (process.arch !== "x64" && process.arch !== "arm64") {
    throw new Error(`Unsupported architecture: ${process.arch}`)
  }

  return { platform, arch: process.arch }
}

const args = process.argv.slice(2)
const rootDir = resolve(import.meta.dirname, "..")
const distDir = join(rootDir, "dist")
const target = getHostTarget()
const outfile = join(distDir, target.platform === "windows" ? "orch.exe" : "orch")

const program = Effect.gen(function* () {
  if (!args.includes("--no-clean")) {
    yield* Effect.tryPromise({
      try: () => rm(distDir, { recursive: true, force: true }),
      catch: (cause) => new BuildError({ message: `Failed to clean ${distDir}`, cause }),
    })
  }

  yield* Effect.tryPromise({
    try: () => mkdir(dirname(outfile), { recursive: true }),
    catch: (cause) => new BuildError({ message: `Failed to create ${dirname(outfile)}`, cause }),
  })

  console.log(`Building orch ${packageJson.version} for ${target.platform}-${target.arch}...`)

  const result = yield* Effect.tryPromise({
    try: () =>
      Bun.build({
        entrypoints: [join(rootDir, "src", "index.ts")],
        tsconfig: join(rootDir, "tsconfig.json"),
        target: "bun",
        format: "esm",
        minify: args.includes("--minify"),
        sourcemap: args.includes("--sourcemap") ? "external" : "none",
        compile: {
          target: `bun-${target.platform}-${target.arch}` as const,
          outfile,
          execArgv: [`--user-agent=orch/${packageJson.version}`, `--env-file=""`, "--"],
          windows: {},
        },
      }),
    catch: (cause) => new BuildError({ message: "Bun build failed", cause }),
  })

  for (const log of result.logs) {
    if (log.level === "error") {
      console.error(log.message)
    } else if (log.level === "warning") {
      console.warn(log.message)
    } else {
      console.log(log.message)
    }
  }

  if (!result.success) return yield* Effect.fail(new BuildError({ message: "Build failed.", cause: result.logs }))

  if (target.platform !== "windows") {
    yield* Effect.tryPromise({
      try: () => chmod(outfile, 0o755),
      catch: (cause) => new BuildError({ message: `Failed to chmod ${outfile}`, cause }),
    })
  }

  console.log(`Built ${outfile}`)
})

await AppRuntime.runPromise(program).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
