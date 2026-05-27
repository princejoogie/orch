# orch

## 1.0.0

### Major Changes

- First stable release of `orch`, a terminal orchestrator for managing opencode sessions across projects and git worktrees.

  Highlights:

  - Provides a keyboard-driven OpenTUI dashboard for active opencode sessions from the configured persistence server.
  - Groups sessions by project/worktree and separates them into `Working`, `Needs input`, and `Completed` lanes.
  - Shows session titles, latest assistant responses, latest user prompts in prompt previews, worktree names, update age, and context usage when available.
  - Polls the opencode server automatically and supports manual refresh for keeping session state current.
  - Supports fuzzy session search, project tab navigation, numbered tab shortcuts, top/bottom jumps, half-page movement, mouse selection, hover states, and double-click prompting.
  - Adds prompt, create-session, and delete-session dialogs with multiline input, worktree selection, confirmation flows, loading states, error display, and shortcut hints.
  - Integrates with tmux to open the selected worktree, reuse existing sessions, switch or attach depending on the current terminal context, and focus an existing opencode pane when one is already running.
  - Includes an in-app shortcuts dialog covering session actions, navigation, project switching, search, refresh, console toggle, and quit commands.
  - Supports `OPENCODE_SERVER_URL`, `--help`, and `--version` for CLI configuration and scripting.
  - Ships release automation for standalone `orch` archives and SHA-256 checksums on `darwin-arm64`, `darwin-x64`, `linux-arm64`, and `linux-x64`.
  - Establishes CI, package smoke validation, strict TypeScript settings, keymap tests, selection tests, scroll tests, and repository documentation for ongoing maintenance.

## 0.1.0

Initial private development release.
