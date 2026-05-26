#!/usr/bin/env bun

import { chmodSync, mkdirSync, rmSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import process from "node:process"
import packageJson from "../package.json" with { type: "json" }

type BuildPlatform = "darwin" | "linux" | "windows"
type BuildArch = "x64" | "arm64"

interface BuildTarget {
  platform: BuildPlatform
  arch: BuildArch
}

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

if (!args.includes("--no-clean")) {
  rmSync(distDir, { recursive: true, force: true })
}

mkdirSync(dirname(outfile), { recursive: true })

console.log(`Building orch ${packageJson.version} for ${target.platform}-${target.arch}...`)

const result = await Bun.build({
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

if (!result.success) {
  console.error("Build failed.")
  process.exit(1)
}

if (target.platform !== "windows") {
  chmodSync(outfile, 0o755)
}

console.log(`Built ${outfile}`)
