---
"orch": minor
---

Improve dashboard session workflows with explicit interruption support, safer destructive confirmations, and richer prompt context. Working sessions can now be interrupted with `ss`, delete remains on `dd`, and both flows use confirmation dialogs before running destructive actions.

Expand the prompt dialog to show scrollable session history and lazy-load older messages from opencode. Opening a tmux session now also asks the opencode TUI to select the focused dashboard session before attaching.

Improve worktree and server selectors by reusing the shared menu list UI, naming git worktrees from branch or commit metadata, and requiring confirmation before deleting a non-primary worktree from the new-session dialog.

Update docs and tests for the new keymaps, dialog behavior, session history paging, worktree deletion confirmation, and the longer needs-input window.
