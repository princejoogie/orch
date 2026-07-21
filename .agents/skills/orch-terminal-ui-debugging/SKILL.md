---
name: orch-terminal-ui-debugging
description: Use when debugging, fixing, or verifying orch terminal UI behavior, especially OpenTUI visible state, dashboard lanes, dialogs, keyboard/focus behavior, OpenCode session status, event streams, or bugs that require termctrl reproduction before code changes.
---

# Orch Terminal UI Debugging

Use the actual `orch` terminal surface as the source of truth. Direct API checks, logs, and unit tests explain behavior after reproduction; they do not replace visible TUI evidence.

## Read First

Before changing code, read the project docs that match the bug:

- `AGENTS.md` for repository rules and command summary.
- `docs/engineering-practices.md` for the required failed-fix and bug-report workflow.
- `docs/tui-interactions.md` for OpenTUI keyboard, focus, mouse, input, dialog, and renderer ownership.
- `docs/repo-workflows.md` for `termctrl` verification examples and `bun` checks.

Read narrower docs as needed: `docs/keymaps.md`, `docs/scrolling.md`, `docs/dialogs.md`, and `docs/code-organization.md`.

## Required Workflow

1. Reproduce the reported behavior in the smallest realistic `orch` scenario before patching.
2. Use `termctrl` for TUI behavior and capture visible state with `termctrl show`.
3. Use the user's exact interaction, path, pane, prompt, and timing expectation when provided.
4. If reproduction fails, stop and report the attempted steps instead of changing plausible code.
5. After reproduction, identify the responsible ownership boundary from the docs and code: keymap, dialog, renderer, OpenCode client/snapshot, store, hook, or UI component.
6. Make the smallest correct change in the owning module.
7. Repeat the same `termctrl` scenario as verification, then run targeted tests or `bun run check` based on change size.

## Evidence Rules

- Treat `termctrl show` output as the primary evidence for visible TUI state.
- Use OpenCode API/status checks to compare visible state against actual session state.
- Use OpenCode serve logs only as supporting evidence. Check `~/.local/state/opencode/serve.out.log`, `~/.local/state/opencode/serve.err.log`, and detailed logs referenced from those files under `~/.local/share/opencode/log/`.
- For trivial OpenCode prompts such as `hi`, a 30 second visible-state wait is enough before switching to status/log correlation.
- Report whether the bug was reproduced, the exact timeout used, and what changed after verification.

## Useful Commands

Build and run a visible TUI smoke:

```sh
bun run build
termctrl start orch-test --cols 130 --rows 35 -- $(pwd)/dist/orch
termctrl wait orch-test "Projects" --timeout 5000
termctrl show orch-test
termctrl stop orch-test
```

Use the project e2e smoke when the local fixture/server requirements are satisfied:

```sh
bun run test:e2e:git-dummy
```

Run full verification before handoff for substantial code changes:

```sh
bun run check
```
