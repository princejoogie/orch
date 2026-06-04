---
"orch": minor
---

Refactor the TUI shell into explicit dashboard/settings controllers, stores, and focused UI components. Settings now lives as a full-page route, shell layout owns top-level composition, and dashboard state transitions such as tab changes, search filtering, row caching, and multi-selection cleanup are handled inside store actions.

Project navigation now uses SDK-backed project, worktree, and project-session data. Project tabs are filtered to projects with sessions from the last week and sorted by latest session activity, while selected project rows can render from cache during background refreshes.

Improve new-session creation by replacing the inline worktree list with a focused dropdown-style worktree selector. The dialog starts in the prompt textarea, `tab`/`shift-tab` move focus between the input and worktree selector, and `j`/`k` only cycle worktrees while the selector is focused.

Document the updated architecture, dialog/keymap behavior, and named `termctrl` workflow for interactive TUI verification. Add keymap coverage for settings navigation and new-session focus behavior.
