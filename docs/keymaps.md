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
- `src/keymap/dashboard.ts`: app-specific global, dashboard page, and settings page contexts and bindings.

## Design

Keymaps are scoped by mode:

- Help dialog scope handles help close, command selection, and command execution keys.
- Add-session dialog scope handles cancel, input/selector focus switching, focused worktree selector navigation, selection commit, and focused non-primary worktree removal.
- Prompt dialog scope handles cancel.
- Delete dialog scope handles confirm/cancel.
- Settings page scope handles back and server selection.
- Search scope handles blur.
- Dashboard list navigation scope handles session/project shortcuts, lane-title collapse, and multi-session selection.
- Menu scope handles dropdown navigation and top-menu number shortcuts so `1`/`2` can switch menus while a dropdown is open.

Only one relevant scope should own a key at a time. This prevents `q`, `j`, `/`, or digits from leaking while text input or dialogs are active.

Global keymaps and page keymaps are separate. Global scopes own app-level overlays such as the top menu, shortcut help, and Ctrl-C. Page scopes own page-local actions, so the same key can mean different things on different pages when only one page scope is active.

## Adding A Shortcut

Add new shortcuts in `src/keymap/dashboard.ts`.

1. Pick the narrowest context that owns the action.
2. Add an `id`, `title`, `keys`, optional `enabled`, and `run`.
3. Put app-wide actions in the global keymap, dashboard actions in the dashboard page keymap, and settings actions in the settings page keymap.
4. Pass dashboard state/actions through `src/hooks/use-dashboard-controller.tsx`; settings/config actions belong in `src/hooks/use-settings-controller.tsx`.
5. Add the user-facing shortcut metadata to `src/components/shortcuts.ts` so `src/components/shortcuts-dialog.tsx` can display it.
6. Add or update tests if the behavior affects dispatch semantics.

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
- Global commands should not duplicate page-owned commands unless scope gating guarantees only one binding is active.
- Widget focus is reserved for widgets that own direct text entry or renderer-native interaction.
- Text-input and modal modes use narrower scopes than list navigation so printable text and modal keys cannot leak into app navigation.
