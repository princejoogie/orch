# Code Organization

This document defines where code belongs.

## Top-Level Source Areas

- `src/pages/`: screen-level composition and page UI.
- `src/components/`: reusable or feature-specific UI components.
- `src/components/ui/`: generic visual primitives with no feature ownership.
- `src/hooks/`: React hooks that encapsulate lifecycle or renderer/ref behavior.
- `src/keymap/`: keyboard parsing, dispatch, adapters, and app keymaps.
- `src/store/`: Zustand stores for app-wide UI state and dashboard page state.
- `src/config/`: orch config/state file paths, JSON persistence, config normalization, and shared UI/page constants.
- `src/lib/`: pure utilities and domain-agnostic helpers.
- `src/opencode/`: opencode API client modules, snapshot loading, and related types.
- `scripts/`: build, release, smoke, and maintenance scripts.
- `test/`: Bun tests for pure behavior and workflow-critical utilities.

`src/tui.tsx` owns process-level renderer setup and the app shell layout: terminal dimensions, main/sidebar widths, top-menu placement, route switching, and shell overlays.

## Page Components

`src/pages/dashboard.tsx` owns only the dashboard page surface. It renders the dashboard table/scrollbox using layout metrics from the shell; app shell layout, sidebar, top menu, toasts, and modal overlays do not belong in the dashboard page file.

`src/pages/settings.tsx` owns the full-page settings UI. Settings routing and persisted config state live in the global store because settings is an app page, not a dashboard dialog. The settings page reads the global store and `src/hooks/use-settings-controller.tsx` directly instead of receiving store state or depending on dashboard page logic.

Low-level behavior belongs in focused modules:

- key parsing
- scroll math
- modal frame drawing
- opencode request details
- shortcut metadata rendering

Page components compose those modules rather than reimplementing them locally.

## Component Boundaries

Use feature-specific component files for feature-specific data.

Examples:

- `session-dialogs.tsx` contains permission, prompt, add, and delete session dialogs.
- `shortcuts.ts` contains shortcut metadata and command action identifiers.
- `shortcuts-dialog.tsx` contains shortcut/help rendering.
- `sidebar.tsx` contains sidebar composition and delegates search/header/project tab behavior to sidebar-owned components.
- `toast.tsx` contains toast rendering and dismiss behavior.
- `session-table.tsx` contains session list/table rows and sections.

Component files should have cohesive product ownership. When a component begins combining unrelated features or app-wide data, split the behavior by the owner that changes with it.

Do not pass Zustand store values through component props. Components that need store state or actions should call the relevant store hook themselves. Passing layout metrics such as `width`, `height`, or `tableWidth` is fine because those belong to the shell layout, not app state.

Keep state as local as its behavior allows. For example, project session query state lives in `ProjectSessionList`, sidebar search wiring lives in the sidebar search component, and toast rendering reads toast state in `Toast`.

## UI Primitives

`src/components/ui/dialog.tsx` owns generic dialog building blocks:

- frames
- dividers
- padded rows
- hint rows
- textarea wrappers
- generic option rows

Feature data like session labels, shortcuts, and command definitions belongs to the feature or command surface that owns the user-facing behavior.

## Stores

`src/store/global.ts` owns app-wide state:

- current page
- top menu and shortcuts dialog state
- settings page state
- persisted orch config
- toasts

`src/store/dashboard.ts` owns dashboard-only state:

- selected project tab
- selected project worktree filters
- dashboard search and selection
- session workflow dialogs
- collapsed lanes and visual selection
- project row caches
- selected project session query state

Zustand actions should take explicit values instead of generic updater callbacks. Components that need many fields should read the whole store once and use namespaced access. If setting one store value requires updating related values in the same store, put that side effect in the store action rather than mirroring it from a component effect.

## Keymaps

Keymap code has two layers:

- generic dispatch engine in `src/keymap/*.ts`
- app-specific bindings in `src/keymap/dashboard.ts`

Generic keymap files stay reusable by modeling parsing and dispatch. App-specific keymaps are split into global, dashboard page, and settings page scopes, then composed by the page wiring.

`src/hooks/use-dashboard-controller.tsx` owns dashboard data, dashboard actions, and dashboard keymap context wiring used by dashboard-connected components. Page files should not build keymap contexts directly.

`src/hooks/use-settings-controller.tsx` owns settings/config persistence actions such as server switching and adding servers. Settings behavior must not depend on dashboard page/controller modules.

## Data Layer

`src/config/orch.ts` owns persisted orch configuration. Config is stored at `~/.config/orch/config.json`; generic app state helpers write below `~/.local/state/orch`.

`src/opencode/client/` owns low-level API calls and groups them by OpenCode concern: sessions, permissions, models, worktrees, events, and dashboard snapshots. `src/opencode/client/index.ts` is the public import seam for OpenCode data; do not add a top-level `src/opencode.ts` barrel.

`src/opencode/client/snapshot.ts` owns assembling the dashboard snapshot, including pending permission requests that move sessions into the needs-input lane.

Use opencode SDK endpoints when they exist. For example, project tabs come from `client.project.list()`, project worktree options come from `client.project.directories()` after a best-effort `client.experimental.projectCopy.refresh()`, selected-project sessions come from `client.session.list()`, and pending permission requests come from `client.permission.list()`. Project snapshots are filtered to projects with sessions whose `projectID` matches the project row and sorted by latest session activity before reaching UI code. Project session rows are cached per project, then the dashboard controller applies the active worktree filter before rendering the session list. Session row latest-message previews use the v2 session messages endpoint with descending order so the table previews the newest visible user or assistant message; the prompt dialog separately loads full history for its scrollable message list. Dashboard data refresh is primarily event-driven through OpenCode's event stream, with slower query polling left as a fallback for missed events or older servers.

UI components should consume prepared `SessionRow` data rather than calling the opencode SDK directly.

## Tests

Tests should mirror module ownership.

- Keymap behavior belongs in keymap tests.
- Scroll behavior belongs in scroll tests.
- Utility behavior belongs in utility tests.

Terminal output tests are most useful when the rendered text itself is the behavior under test; otherwise test the pure behavior behind the rendering.
