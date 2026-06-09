# orch

## 1.2.1

### Patch Changes

- 469f427: Add opencode permission-request handling to the dashboard. Sessions with pending permissions now show in `Needs input`, open a permission dialog before the prompt dialog, and support once, always, deny, or cancel actions with documented shortcuts.
- Improve session message previews and prompt history behavior. Session rows now prefer the newest visible user or assistant message from the v2 messages endpoint, surface latest assistant errors, and keep prompt-session history scrolled to the newest messages as updates arrive.

## 1.2.0

### Minor Changes

- 6f68b9e: Improve dashboard session workflows with explicit interruption support, safer destructive confirmations, and richer prompt context. Working sessions can now be interrupted with `ss`, delete remains on `dd`, and both flows use confirmation dialogs before running destructive actions.

  Expand the prompt dialog to show a taller full-history message view from opencode, including queued user-message indicators. Prompt and new-session dialog model/default lookups now run only while those dialogs are mounted. Opening a tmux session now also asks the opencode TUI to select the focused dashboard session before attaching.

  Improve worktree and server selectors by reusing the shared menu list UI, naming git worktrees from branch or commit metadata, seeding new sessions from the selected row's worktree/model, supporting mouse focus for prompt/new-session inputs and selectors, and requiring confirmation before deleting a non-primary worktree from the new-session dialog.

  Update docs and tests for the new keymaps, dialog behavior, session history rendering, worktree deletion confirmation, and the longer needs-input window.

## 1.1.0

### Minor Changes

- Add persistent server settings and richer dashboard controls.

  Highlights:

  - Adds an in-app Settings dialog for managing opencode persistence server URLs.
  - Persists orch configuration under `~/.config/orch/config.json`, with active server and known server list normalization.
  - Switches dashboard queries and session actions to the active configured server instead of relying only on `OPENCODE_SERVER_URL`.
  - Adds a server selector menu in the sidebar and a settings shortcut for quickly changing or adding servers.
  - Adds a top menu bar with Actions and Selected menus for mouse-driven access to common dashboard commands.
  - Adds visual multi-select mode with row checkboxes, space toggling, `v` selection mode, and escape/quit behavior that clears active selections first.
  - Supports deleting multiple selected sessions in the background, with success/error toast feedback and automatic refresh after completion.
  - Adds collapsible session lanes, section-row navigation, and double-click lane toggling.
  - Improves dialogs with explicit button rows, clickable close/cancel actions, clearable text inputs, and outside-click dismissal layers.
  - Updates shortcut help, keymap tests, selection behavior, and repository docs for the new menu, settings, multi-select, and dialog interactions.
  - Refreshes the README demo image.

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
