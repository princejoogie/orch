---
"orch": minor
---

Refactor the TUI shell into explicit dashboard/settings controllers, stores, and focused UI components. Settings now lives as a full-page route, shell layout owns top-level composition, and dashboard state transitions such as tab changes, search filtering, row caching, and multi-selection cleanup are handled inside store actions.

Project navigation now uses SDK-backed project and project-session data. Worktree options are listed from local `git worktree list --porcelain` so all actual git worktrees appear in selectors. Project tabs are filtered to projects with sessions from the last week and sorted by latest session activity, while selected project rows can render from cache during background refreshes.

Improve new-session creation by replacing the inline worktree list with the shared dropdown component used by other menus. The dialog starts in the prompt textarea, `tab`/`shift-tab` move focus between the input and plain `Worktree: <name>` selector, and `j`/`k` only cycle worktrees while the selector is focused. The selector includes a deferred `New worktree` option that creates an OpenCode worktree when the message is sent, and `dd` removes the focused non-primary worktree through OpenCode.

Document the updated architecture, dialog/keymap behavior, and named `termctrl` workflow for interactive TUI verification. Add keymap coverage for settings navigation and new-session focus behavior.
