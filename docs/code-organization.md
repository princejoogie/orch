# Code Organization

This document defines where code belongs.

## Top-Level Source Areas

- `src/pages/`: screen-level composition and state wiring.
- `src/components/`: reusable or feature-specific UI components.
- `src/components/ui/`: generic visual primitives with no feature ownership.
- `src/hooks/`: React hooks that encapsulate lifecycle or renderer/ref behavior.
- `src/keymap/`: keyboard parsing, dispatch, adapters, and app keymaps.
- `src/lib/`: pure utilities and domain-agnostic helpers.
- `src/opencode/`: opencode API client, snapshot loading, and related types.
- `scripts/`: build, release, smoke, and maintenance scripts.
- `test/`: Bun tests for pure behavior and workflow-critical utilities.

## Page Components

`src/pages/dashboard.tsx` is allowed to compose state, data, keymap contexts, and layout.

It should not own low-level implementations for:

- key parsing
- scroll math
- modal frame drawing
- opencode request details
- shortcut metadata rendering

Move those to the appropriate module.

## Component Boundaries

Use feature-specific component files for feature-specific data.

Examples:

- `session-dialogs.tsx` contains prompt/add/delete session dialogs.
- `shortcuts-dialog.tsx` contains shortcut metadata and shortcut rendering.
- `session-table.tsx` contains session list/table rows and sections.

If a component file starts accumulating unrelated app-wide concerns, split it.

## UI Primitives

`src/components/ui/dialog.tsx` owns generic dialog building blocks:

- frames
- dividers
- padded rows
- hint rows
- textarea wrappers
- generic option rows

It should not own feature data like session labels, shortcuts, or command definitions.

## Keymaps

Keymap code has two layers:

- generic dispatch engine in `src/keymap/*.ts`
- app-specific bindings in `src/keymap/dashboard.ts`

Do not mix dashboard actions into generic keymap files.

## Data Layer

`src/opencode/client.ts` owns low-level API calls.

`src/opencode/snapshot.ts` owns assembling the dashboard snapshot.

UI components should consume prepared `SessionRow` data rather than calling the opencode SDK directly.

## Tests

Tests should mirror module ownership.

- Keymap behavior belongs in keymap tests.
- Scroll behavior belongs in scroll tests.
- Utility behavior belongs in utility tests.

Avoid snapshot-testing terminal output unless the rendered text itself is the behavior under test.
