#!/usr/bin/env bun

import { chmod, mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { Data, Effect } from "effect"
import { AppRuntime } from "../src/effect/app-runtime.ts"
import { currentReleaseTargetId, findReleaseTarget, releaseTargets } from "./release-targets.ts"

const root = process.cwd()
const requestedTargetId = process.argv[2]
const releaseDir = process.argv[3] ?? join(root, "dist", "release")

class StandaloneBuildError extends Data.TaggedError("StandaloneBuildError")<{
  readonly message: string
  readonly cause: unknown
}> {}

const run = (cmd: readonly string[]) =>
  Effect.try({
    try: () => {
      const proc = Bun.spawnSync({ cmd: [...cmd], cwd: root, stdout: "inherit", stderr: "inherit" })
      if (proc.exitCode !== 0) throw new Error(`Command failed (${proc.exitCode}): ${cmd.join(" ")}`)
    },
    catch: (cause) => new StandaloneBuildError({ message: `Command failed: ${cmd.join(" ")}`, cause }),
  })

function sha256(path: string): Effect.Effect<string, StandaloneBuildError> {
  return Effect.gen(function* () {
    const hasher = new Bun.CryptoHasher("sha256")
    const buffer = yield* Effect.tryPromise({
      try: () => Bun.file(path).arrayBuffer(),
      catch: (cause) => new StandaloneBuildError({ message: `Failed to read ${path}`, cause }),
    })
    hasher.update(buffer)
    return hasher.digest("hex")
  })
}

function selectedTargets() {
  if (requestedTargetId === "all") return releaseTargets

  const targetId = requestedTargetId ?? currentReleaseTargetId()
  const target = findReleaseTarget(targetId)
  if (!target) throw new Error(`Unsupported standalone target: ${targetId ?? "unknown"}`)
  return [target]
}

const program = Effect.gen(function* () {
  yield* Effect.tryPromise({
    try: () => rm(releaseDir, { recursive: true, force: true }),
    catch: (cause) => new StandaloneBuildError({ message: `Failed to clean ${releaseDir}`, cause }),
  })
  yield* Effect.tryPromise({
    try: () => mkdir(releaseDir, { recursive: true }),
    catch: (cause) => new StandaloneBuildError({ message: `Failed to create ${releaseDir}`, cause }),
  })

  const checksums: string[] = []
  const hostTargetId = currentReleaseTargetId()

  for (const target of selectedTargets()) {
    const stageDir = join(releaseDir, target.id)
    const binaryPath = join(stageDir, "orch")
    const assetName = `orch-${target.id}.tar.gz`
    const assetPath = join(releaseDir, assetName)

    yield* Effect.tryPromise({
      try: () => mkdir(stageDir, { recursive: true }),
      catch: (cause) => new StandaloneBuildError({ message: `Failed to create ${stageDir}`, cause }),
    })
    yield* run([
      "bun",
      "build",
      "--compile",
      "--bytecode",
      "--format=esm",
      `--target=${target.bunTarget}`,
      `--outfile=${binaryPath}`,
      "src/index.ts",
    ])
    yield* Effect.tryPromise({
      try: () => chmod(binaryPath, 0o755),
      catch: (cause) => new StandaloneBuildError({ message: `Failed to chmod ${binaryPath}`, cause }),
    })

    if (target.id === hostTargetId) {
      yield* Effect.try({
        try: () => {
          const version = Bun.spawnSync({ cmd: [binaryPath, "--version"], cwd: root, stdout: "pipe", stderr: "pipe" })
          if (version.exitCode !== 0) {
            throw new Error(`Standalone smoke failed for ${target.id}: ${version.stderr.toString()}`)
          }
        },
        catch: (cause) => new StandaloneBuildError({ message: `Standalone smoke failed for ${target.id}`, cause }),
      })
    }

    yield* run(["tar", "-czf", assetPath, "-C", stageDir, "orch"])
    const checksumLine = `${yield* sha256(assetPath)}  ${assetName}`
    checksums.push(checksumLine)
    yield* Effect.tryPromise({
      try: () => writeFile(join(releaseDir, `${assetName}.sha256`), `${checksumLine}\n`),
      catch: (cause) => new StandaloneBuildError({ message: `Failed to write ${assetName}.sha256`, cause }),
    })
  }

  yield* Effect.tryPromise({
    try: () => writeFile(join(releaseDir, "checksums.txt"), `${checksums.join("\n")}\n`),
    catch: (cause) => new StandaloneBuildError({ message: "Failed to write checksums.txt", cause }),
  })
})

await AppRuntime.runPromise(program).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
