#!/usr/bin/env bun

import { access } from "node:fs/promises"
import { join } from "node:path"
import packageJson from "../package.json" with { type: "json" }

const root = process.cwd()
const binaryPath = join(root, "dist", process.platform === "win32" ? "orch.exe" : "orch")

function run(cmd: readonly string[]): { stdout: string; stderr: string } {
  const proc = Bun.spawnSync({ cmd: [...cmd], cwd: root, stdout: "pipe", stderr: "pipe" })
  const result = { stdout: proc.stdout.toString(), stderr: proc.stderr.toString() }
  if (proc.exitCode !== 0) {
    throw new Error(`Command failed (${proc.exitCode}): ${cmd.join(" ")}\n${result.stdout}${result.stderr}`)
  }
  return result
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

run(["bun", "run", "build"])
await access(binaryPath)

const version = run([binaryPath, "--version"])
assert(version.stdout.trim() === packageJson.version, `Expected ${packageJson.version}, got ${version.stdout.trim()}`)

const help = run([binaryPath, "--help"])
assert(help.stdout.includes("Usage:"), "Expected --help output to include Usage")
assert(help.stdout.includes("orch"), "Expected --help output to include binary name")
