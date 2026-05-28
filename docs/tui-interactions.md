# TUI Interactions

These are the OpenTUI/React interaction rules for `orch`.

## Renderer

`src/tui.tsx` owns the renderer configuration:

- `exitOnCtrlC: false` keeps shutdown under app control.
- `useKittyKeyboard: {}` keeps modifier handling reliable.
- `useMouse: true` enables click, hover, and wheel behavior.
- `openConsoleOnError: true` preserves a debugging escape hatch.

Renderer configuration is process-level behavior. Components should access renderer state through `useRenderer`, `useTerminalDimensions`, keymap hooks, and refs rather than creating alternate renderer setup paths.

## Keyboard Ownership

Keyboard actions belong to keymaps, not focused OpenTUI widgets.

- Global keyboard input flows through `src/keymap/opentui-adapter.ts`.
- Scoped actions live in `src/keymap/dashboard.ts`.
- The adapter calls `preventDefault()` when a keymap handles a stroke.
- Text-entry widgets still receive printable text because text-editing modes are scoped out of list keymaps.

Command keys are routed through keymap contexts. Feature components should describe the state and actions a command needs, then expose them through the relevant keymap context.

## Focus

OpenTUI focus can trigger built-in widget behavior. That matters for scrollboxes.

- Lists with app-owned navigation should be `focusable={false}`.
- Inputs and textareas may use `focused={...}` because they own text editing.
- Mouse clicks on selectable rows/tabs should call `event.preventDefault()` so selection changes preserve the current focus owner.
- Use `event.stopPropagation()` when a click should not bubble into a parent list or overlay.

## Mouse

Mouse support should mirror keyboard selection, not create a second state model.

- Rows support hover, click-to-select, and double-click to prompt the selected session.
- Lane titles support click-to-select and double-click to collapse or expand the lane; keyboard `enter` does the same for the selected lane.
- Project tabs support hover and click-to-select.
- Dialog options support click selection where useful.
- The top menu bar sits above the session list, not above the sidebar.
- Top menu rows mirror keyboard commands, show their keymaps, highlight on hover/selection, switch menus on hover while a dropdown is open, and support up/down/tab plus enter/escape navigation.
- Toast notifications float near the top-right of the main panel and must not overlap the sidebar.
- Modal frames expose a clickable `[x]` close control when the dialog can be cancelled.
- Dialog submit, cancel, confirm, and help-command rows should be clickable when the same action exists on the keyboard.
- Click handlers that perform actions should prevent default focus changes and stop propagation.

Mouse wheel scrolling should remain scrollbox-owned unless a custom-scrolled modal list is being rendered.

## Inputs

Search uses OpenTUI `<input>` and prompt dialogs use `<textarea>`.

- Keep app shortcuts gated by `textInputActive`.
- Textarea submit bindings are explicit: enter submits and shift-enter inserts a newline.
- Ctrl-C clears the active search, prompt, or new-session input when it has text; if the input is already empty, ctrl-C falls through to the normal app-level quit behavior.
- Single-line search should stay live via `onInput`, not commit-only `onChange`.
- Do not replay app state into inputs after `onInput`; only write into the widget for explicit app-owned resets such as Ctrl-C clearing.

If we add custom query modals later, route raw text input through one dispatcher rather than several independent keyboard hooks.
