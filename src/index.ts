#!/usr/bin/env bun

import { Data, Effect } from "effect"
import packageJson from "../package.json" with { type: "json" }
import { AppRuntime } from "./effect/app-runtime.ts"

const HELP_TEXT =
  `orch ${packageJson.version}

Usage:
  orch              Start the active opencode sessions table
  orch --help       Show this help
  orch --version    Show the current version

Keys:
  o                 Open selected project/worktree in tmux
  r                 Refresh the opencode server snapshot
  ` +
  "`" +
  `                 Toggle the OpenTUI console
  d                 Toggle the debug overlay
  q, Esc, Ctrl+C    Quit
`

export class CliImportError extends Data.TaggedError("CliImportError")<{
  readonly message: string
  readonly cause: unknown
}> {}

export function main(args = Bun.argv.slice(2)) {
  if (args.includes("--help") || args.includes("-h")) {
    return Effect.sync(() => console.log(HELP_TEXT))
  }

  if (args.includes("--version") || args.includes("-v")) {
    return Effect.sync(() => console.log(packageJson.version))
  }

  return Effect.gen(function* () {
    const { runTui } = yield* Effect.tryPromise({
      try: () => import("./tui.tsx"),
      catch: (cause) => new CliImportError({ message: "Failed to load TUI", cause }),
    })
    yield* runTui({ args })
  })
}

if (import.meta.main) {
  await AppRuntime.runPromise(main())
}
