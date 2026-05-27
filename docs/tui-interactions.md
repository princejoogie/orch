# TUI Interactions

These are the OpenTUI/React interaction rules for `orch`.

## Renderer

`src/tui.tsx` owns the renderer configuration:

- `exitOnCtrlC: false` keeps shutdown under app control.
- `useKittyKeyboard: {}` keeps modifier handling reliable.
- `useMouse: true` enables click, hover, and wheel behavior.
- `openConsoleOnError: true` preserves a debugging escape hatch.

Do not add local renderer setup inside components. Components should use `useRenderer`, `useTerminalDimensions`, keymap hooks, and refs.

## Keyboard Ownership

Keyboard actions belong to keymaps, not focused OpenTUI widgets.

- Global keyboard input flows through `src/keymap/opentui-adapter.ts`.
- Scoped actions live in `src/keymap/dashboard.ts`.
- The adapter calls `preventDefault()` when a keymap handles a stroke.
- Text-entry widgets still receive printable text because text-editing modes are scoped out of list keymaps.

Avoid adding ad hoc `useKeyboard` handlers in feature components. If a key is a command, add it to the relevant keymap context.

## Focus

OpenTUI focus can trigger built-in widget behavior. That matters for scrollboxes.

- Lists with app-owned navigation should be `focusable={false}`.
- Inputs and textareas may use `focused={...}` because they own text editing.
- Mouse clicks on selectable rows/tabs should call `event.preventDefault()` to avoid stealing focus unexpectedly.
- Use `event.stopPropagation()` when a click should not bubble into a parent list or overlay.

## Mouse

Mouse support should mirror keyboard selection, not create a second state model.

- Rows support hover and click-to-select.
- Project tabs support hover and click-to-select.
- Dialog options support click selection where useful.
- Click handlers that perform actions should prevent default focus changes and stop propagation.

Mouse wheel scrolling should remain scrollbox-owned unless a custom-scrolled modal list is being rendered.

## Inputs

Search uses OpenTUI `<input>` and prompt dialogs use `<textarea>`.

- Keep app shortcuts gated by `textInputActive`.
- Textarea submit bindings are explicit: enter and `ctrl-s` submit, shift-enter inserts a newline.
- Single-line search should stay live via `onInput`, not commit-only `onChange`.

If we add custom query modals later, route raw text input through one dispatcher rather than several independent keyboard hooks.
