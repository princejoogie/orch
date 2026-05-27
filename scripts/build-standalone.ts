#!/usr/bin/env bun

import { chmod, mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { currentReleaseTargetId, findReleaseTarget, releaseTargets } from "./release-targets.ts"

const root = process.cwd()
const requestedTargetId = process.argv[2]
const releaseDir = process.argv[3] ?? join(root, "dist", "release")

function run(cmd: readonly string[]): void {
  const proc = Bun.spawnSync({ cmd: [...cmd], cwd: root, stdout: "inherit", stderr: "inherit" })
  if (proc.exitCode !== 0) throw new Error(`Command failed (${proc.exitCode}): ${cmd.join(" ")}`)
}

async function sha256(path: string): Promise<string> {
  const hasher = new Bun.CryptoHasher("sha256")
  hasher.update(await Bun.file(path).arrayBuffer())
  return hasher.digest("hex")
}

function selectedTargets() {
  if (requestedTargetId === "all") return releaseTargets

  const targetId = requestedTargetId ?? currentReleaseTargetId()
  const target = findReleaseTarget(targetId)
  if (!target) throw new Error(`Unsupported standalone target: ${targetId ?? "unknown"}`)
  return [target]
}

await rm(releaseDir, { recursive: true, force: true })
await mkdir(releaseDir, { recursive: true })

const checksums: string[] = []
const hostTargetId = currentReleaseTargetId()

for (const target of selectedTargets()) {
  const stageDir = join(releaseDir, target.id)
  const binaryPath = join(stageDir, "orch")
  const assetName = `orch-${target.id}.tar.gz`
  const assetPath = join(releaseDir, assetName)

  // Release assets intentionally build sequentially so CI logs map one target to one archive.
  // oxlint-disable-next-line no-await-in-loop
  await mkdir(stageDir, { recursive: true })
  run([
    "bun",
    "build",
    "--compile",
    "--bytecode",
    "--format=esm",
    `--target=${target.bunTarget}`,
    `--outfile=${binaryPath}`,
    "src/index.ts",
  ])
  // oxlint-disable-next-line no-await-in-loop
  await chmod(binaryPath, 0o755)

  if (target.id === hostTargetId) {
    const version = Bun.spawnSync({ cmd: [binaryPath, "--version"], cwd: root, stdout: "pipe", stderr: "pipe" })
    if (version.exitCode !== 0)
      throw new Error(`Standalone smoke failed for ${target.id}: ${version.stderr.toString()}`)
  }

  run(["tar", "-czf", assetPath, "-C", stageDir, "orch"])
  // oxlint-disable-next-line no-await-in-loop
  const checksumLine = `${await sha256(assetPath)}  ${assetName}`
  checksums.push(checksumLine)
  // oxlint-disable-next-line no-await-in-loop
  await writeFile(join(releaseDir, `${assetName}.sha256`), `${checksumLine}\n`)
}

await writeFile(join(releaseDir, "checksums.txt"), `${checksums.join("\n")}\n`)
