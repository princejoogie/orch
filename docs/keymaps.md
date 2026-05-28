# Keymaps

The keymap system in `src/keymap/` owns keyboard parsing, scoping, dispatch, and app command bindings.

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
- List navigation scope handles session/project/app shortcuts, lane-title collapse, and multi-session selection.
- Menu scope handles dropdown navigation and top-menu number shortcuts so `1`/`2` can switch menus while a dropdown is open.

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

## Dashboard Selection

- Lane titles are selectable entries. `enter` toggles the selected lane between expanded and collapsed.
- `v` toggles visual session selection. Entering visual mode toggles the focused session, and moving with `j`/`k`/arrows while visual mode is active toggles each focused session.
- `space` toggles the focused session in the selected set without entering visual mode.
- `esc` clears visual/multi-selection before it falls back to the normal quit behavior.
- `d` deletes the selected set when any sessions are checked; otherwise it deletes the focused session.

## Ownership Rules

- App commands route through keymaps so command handling has one dispatch path.
- Widget focus is reserved for widgets that own direct text entry or renderer-native interaction.
- Text-input and modal modes use narrower scopes than list navigation so printable text and modal keys cannot leak into app navigation.
