---
"orch": minor
---

Improve dashboard session workflows with explicit interruption support, safer destructive confirmations, and richer prompt context. Working sessions can now be interrupted with `ss`, delete remains on `dd`, and both flows use confirmation dialogs before running destructive actions.

Expand the prompt dialog to show a taller full-history message view from opencode, including queued user-message indicators. Prompt and new-session dialog model/default lookups now run only while those dialogs are mounted. Opening a tmux session now also asks the opencode TUI to select the focused dashboard session before attaching.

Improve worktree and server selectors by reusing the shared menu list UI, naming git worktrees from branch or commit metadata, seeding new sessions from the selected row's worktree/model, supporting mouse focus for prompt/new-session inputs and selectors, and requiring confirmation before deleting a non-primary worktree from the new-session dialog.

Update docs and tests for the new keymaps, dialog behavior, session history rendering, worktree deletion confirmation, and the longer needs-input window.
