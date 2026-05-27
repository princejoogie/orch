# Keymaps

The keymap system in `src/keymap/` is a local, small-app adaptation of `ghui`'s `@ghui/keymap` package.

## Files

- `src/keymap/keys.ts`: parses key strings like `ctrl+d`, `shift+tab`, and multi-stroke sequences like `g g`.
- `src/keymap/binding.ts`: binding metadata, enablement, and active checks.
- `src/keymap/keymap.ts`: immutable keymap value plus `scope`, `union`, `prefix`, and command extraction.
- `src/keymap/pure-dispatch.ts`: pure pending-sequence dispatch with timeout support.
- `src/keymap/dispatcher.ts`: imperative dispatcher that runs binding actions.
- `src/keymap/react.ts`: React hook that reads fresh context every dispatch.
- `src/keymap/opentui-adapter.ts`: maps OpenTUI key events to parsed strokes.
- `src/keymap/dashboard.ts`: dashboard-specific contexts and bindings.

## Design

Keymaps are scoped by mode:

- Help dialog scope handles help close, command selection, and command execution keys.
- Add-session dialog scope handles cancel and worktree cycling.
- Prompt dialog scope handles cancel.
- Delete dialog scope handles confirm/cancel.
- Search scope handles blur.
- List navigation scope handles session/project/app shortcuts.

Only one relevant scope should own a key at a time. This prevents `q`, `j`, `/`, or digits from leaking while text input or dialogs are active.

## Adding A Shortcut

Add new dashboard shortcuts in `src/keymap/dashboard.ts`.

1. Pick the narrowest context that owns the action.
2. Add an `id`, `title`, `keys`, optional `enabled`, and `run`.
3. Pass any required state/action through the context object built in `src/pages/dashboard.tsx`.
4. Add the shortcut to `src/components/shortcuts-dialog.tsx` if it is user-facing.
5. Add or update tests if the behavior affects dispatch semantics.

## Multi-Key Sequences

Use space-separated bindings for sequences:

```ts
{ id: "selection.top", title: "Jump to top", keys: ["g g", "home"], run: (ctx) => ctx.moveTop() }
```

The dispatcher enters a pending state after the first `g` and resolves when the second stroke arrives or the timeout fires.

## Enablement

Bindings can return a disabled reason:

```ts
enabled: (ctx) => ctx.hasSelection || "No session selected."
```

Disabled bindings count as handled by the keymap. This is intentional: the key should not fall through to an underlying widget.

## Do Not

- Do not add one-off `useKeyboard` handlers in UI components for app commands.
- Do not make scrollboxes focused to get navigation for free.
- Do not let text-input modes share the list navigation scope.
