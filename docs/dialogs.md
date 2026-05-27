# Dialogs

Dialogs use a drawn frame and a small set of reusable primitives in `src/components/ui/dialog.tsx`.

## File Boundaries

- `src/components/ui/dialog.tsx`: shared frame, text rows, dividers, hint rows, textarea, and generic dialog primitives.
- `src/components/session-dialogs.tsx`: only session-specific dialogs: prompt, add session, delete session.
- `src/components/shortcuts-dialog.tsx`: keyboard shortcut/help dialog and shortcut data.

Do not put non-session UI in `session-dialogs.tsx`.

## Shared Frames

Use `StandardDialogFrame` for ordinary modals:

- title row with optional right status
- subtitle row
- divider
- body
- divider
- footer hint row

Use `SearchDialogFrame` for command-palette-style modals:

- title/search-style header
- count text
- sectioned body
- footer hint row

## Footer Hints

Use `HintRow` instead of hand-written hint strings.

Example:

```tsx
<HintRow
  items={[
    { key: "enter", label: "send" },
    { key: "shift-enter", label: "newline" },
    { key: "esc", label: "cancel" },
  ]}
/>
```

This keeps the style consistent with the shortcuts dialog and future command palette work.

## Shortcut Dialog

Shortcut metadata lives next to the shortcut UI in `src/components/shortcuts-dialog.tsx`.
The dialog is selectable: up/down keys cycle through commands, and enter runs the selected command through the dashboard keymap context.

When adding a user-facing shortcut:

1. Add the binding in `src/keymap/dashboard.ts`.
2. Add the displayed shortcut in `src/components/shortcuts-dialog.tsx`.
3. Keep scope grouping meaningful: `Session`, `Navigation`, `Projects`, or `App`.

## Mouse In Dialogs

Dialog options can be clickable.

- Use `event.preventDefault()` to avoid focus stealing.
- Use `event.stopPropagation()` to keep clicks inside the modal.

## Textareas

Prompt textareas use explicit key bindings:

- enter submits
- `ctrl-s` submits
- shift-enter inserts newline

Do not rely on OpenTUI defaults for submit semantics because app prompts intentionally make enter submit.
