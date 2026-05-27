#!/usr/bin/env bun

import packageJson from "../package.json" with { type: "json" }

const HELP_TEXT =
  `orch ${packageJson.version}

Usage:
  orch              Start the active opencode sessions table
  orch --help       Show this help
  orch --version    Show the current version

Keys:
  r                 Refresh the opencode server snapshot
  ` +
  "`" +
  `                 Toggle the OpenTUI console
  d                 Toggle the debug overlay
  q, Esc, Ctrl+C    Quit
`

export async function main(args = Bun.argv.slice(2)): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(HELP_TEXT)
    return
  }

  if (args.includes("--version") || args.includes("-v")) {
    console.log(packageJson.version)
    return
  }

  const { runTui } = await import("./tui.tsx")
  await runTui({ args })
}

if (import.meta.main) {
  await main()
}
