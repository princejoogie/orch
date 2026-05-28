# Code Organization

This document defines where code belongs.

## Top-Level Source Areas

- `src/pages/`: screen-level composition and state wiring.
- `src/components/`: reusable or feature-specific UI components.
- `src/components/ui/`: generic visual primitives with no feature ownership.
- `src/hooks/`: React hooks that encapsulate lifecycle or renderer/ref behavior.
- `src/keymap/`: keyboard parsing, dispatch, adapters, and app keymaps.
- `src/config/`: orch config/state file paths, JSON persistence, and config normalization.
- `src/lib/`: pure utilities and domain-agnostic helpers.
- `src/opencode/`: opencode API client, snapshot loading, and related types.
- `scripts/`: build, release, smoke, and maintenance scripts.
- `test/`: Bun tests for pure behavior and workflow-critical utilities.

## Page Components

`src/pages/dashboard.tsx` is allowed to compose state, data, keymap contexts, and layout.

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

- `session-dialogs.tsx` contains prompt/add/delete session dialogs.
- `shortcuts-dialog.tsx` contains shortcut metadata and shortcut rendering.
- `session-table.tsx` contains session list/table rows and sections.

Component files should have cohesive product ownership. When a component begins combining unrelated features or app-wide data, split the behavior by the owner that changes with it.

## UI Primitives

`src/components/ui/dialog.tsx` owns generic dialog building blocks:

- frames
- dividers
- padded rows
- hint rows
- textarea wrappers
- generic option rows

Feature data like session labels, shortcuts, and command definitions belongs to the feature or command surface that owns the user-facing behavior.

## Keymaps

Keymap code has two layers:

- generic dispatch engine in `src/keymap/*.ts`
- app-specific bindings in `src/keymap/dashboard.ts`

Generic keymap files stay reusable by modeling parsing and dispatch. Dashboard actions live in the app-specific keymap layer that has access to dashboard state.

## Data Layer

`src/config/orch.ts` owns persisted orch configuration. Config is stored at `~/.config/orch/config.json`; generic app state helpers write below `~/.local/state/orch`.

`src/opencode/client.ts` owns low-level API calls.

`src/opencode/snapshot.ts` owns assembling the dashboard snapshot.

UI components should consume prepared `SessionRow` data rather than calling the opencode SDK directly.

## Tests

Tests should mirror module ownership.

- Keymap behavior belongs in keymap tests.
- Scroll behavior belongs in scroll tests.
- Utility behavior belongs in utility tests.

Terminal output tests are most useful when the rendered text itself is the behavior under test; otherwise test the pure behavior behind the rendering.
