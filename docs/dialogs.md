# Dialogs

Dialogs use a drawn frame and a small set of reusable primitives in `src/components/ui/dialog.tsx`.

## Ownership

- `src/components/ui/dialog.tsx`: shared frame, text rows, dividers, hint rows, textarea, and generic dialog primitives.
- `src/components/session-dialogs.tsx`: session workflow dialogs: prompt, add session, delete session.
- `src/components/settings-dialog.tsx`: settings for persisted opencode servers and active server selection.
- `src/components/shortcuts-dialog.tsx`: keyboard shortcut/help dialog and shortcut data.

Dialog modules are organized by product behavior. Shared rendering primitives live in UI modules, feature dialogs live with their feature, and app-wide command/help surfaces live with command metadata.

## Shared Frames

Use `StandardDialogFrame` for ordinary modals:

- title row with optional right status
- subtitle row
- divider
- body
- optional action row
- divider
- footer hint row

Use `SearchDialogFrame` for command-palette-style modals:

- title/search-style header
- count text
- sectioned body
- footer hint row

## Toasts

Long-running background actions should report progress through floating toasts instead of keeping modal dialogs open.

- Toasts render outside the sidebar, offset from the top-right of the main panel.
- Loading toasts remain visible until the background action completes.
- Success and error toasts auto-dismiss after a short delay and can be clicked away.
- Confirmation dialogs should dismiss once the action is accepted; follow-up status belongs in the toast.

## Footer Hints

Use `HintRow` instead of hand-written hint strings for actions that are not already visible in the dialog.

Visible controls should carry their own shortcuts and live in the bottom-right footer action area:

- Submit shortcuts live beside submit button labels, for example `Send ↵`.
- Cancel shortcuts live beside cancel button labels and the top-right close control, for example `Cancel esc` and `[x] esc`.
- Footer hints are reserved for hidden actions such as `shift-enter newline`.

Example:

```tsx
<HintRow
  items={[{ key: "shift-enter", label: "newline" }]}
/>
```

This keeps the style consistent with the shortcuts dialog and future command palette work.

## Shortcut Dialog

Shortcut metadata lives next to the shortcut UI in `src/components/shortcuts-dialog.tsx`.
The dialog is selectable: up/down or tab keys cycle through commands, and enter runs the selected command through the dashboard keymap context.

When adding a user-facing shortcut:

1. Add the binding in `src/keymap/dashboard.ts`.
2. Add the displayed shortcut in `src/components/shortcuts-dialog.tsx`.
3. Keep scope grouping meaningful: `Session`, `Navigation`, `Projects`, or `App`.

## Mouse In Dialogs

Dialog options, action rows, and close controls can be clickable.

- Use `event.preventDefault()` so clicks preserve the current focus owner.
- Use `event.stopPropagation()` to keep clicks inside the modal.
- Put shared click handling on boxes, not spans; OpenTUI spans are text-only.
- Cancellable dialogs render an invisible dismiss layer behind the frame; clicking outside closes the dialog.
- `ModalFrame` absorbs inside clicks so borders and blank dialog space do not trigger outside-click dismissal.

## Textareas

Prompt textareas use explicit key bindings:

- enter submits
- shift-enter inserts newline

Prompt submission is an app-level decision, so textarea submit semantics are explicit instead of inherited from the renderer default.
