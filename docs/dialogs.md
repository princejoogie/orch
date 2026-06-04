# Dialogs

Dialogs use a drawn frame and a small set of reusable primitives in `src/components/ui/dialog.tsx`.

## Ownership

- `src/components/ui/dialog.tsx`: shared frame, text rows, dividers, hint rows, textarea, and generic dialog primitives.
- `src/components/app-dialogs.tsx`: shell overlay component that renders all app dialogs with only screen dimensions from the shell.
- `src/components/session-dialogs.tsx`: session workflow dialogs: prompt, add session, delete worktree, delete session, interrupt session.
- `src/components/shortcuts.ts`: keyboard shortcut/help metadata and command action identifiers.
- `src/components/shortcuts-dialog.tsx`: keyboard shortcut/help dialog rendering.

Dialog modules are organized by product behavior. Shared rendering primitives live in UI modules, feature dialogs live with their feature, and app-wide command/help surfaces live with command metadata.

Feature dialogs read their own store state and controller actions. Do not pass dialog store state or store actions down from `src/tui.tsx`.

Settings are not a modal dialog. `src/pages/settings.tsx` owns the full-page settings UI for persisted opencode servers and active server selection.

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

Shortcut metadata lives in `src/components/shortcuts.ts`.
The dialog is selectable: up/down or tab keys cycle through commands, and enter runs the selected command through the app keymap context.

When adding a user-facing shortcut:

1. Add the binding in `src/keymap/dashboard.ts`.
2. Add the displayed shortcut in `src/components/shortcuts.ts`.
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

The prompt-session dialog shows previous session messages in a fixed-height scrollable section above the textarea. Messages are grouped by contiguous role with `● User:` or `● Assistant:` headers, and individual messages are separated by a blank line. The textarea keeps focus for typing; the message section starts at the newest loaded messages, supports mouse-wheel scrolling, and lazy-loads older messages when the user scrolls upward near the top.

## New Session Dialog

The new-session dialog starts with focus in the prompt textarea.

- `tab` and `shift-tab` switch focus between the prompt textarea and worktree selector.
- The worktree selector trigger is plain `Worktree: <name>` text and reuses the shared `MenuDropdown` component while focused.
- `j`/`k`, `down`/`up`, and `ctrl-n`/`ctrl-p` cycle worktrees only while the worktree selector is focused.
- `enter` commits the selected worktree and returns focus to the prompt textarea.
- `dd` opens a destructive confirmation dialog for the selected non-primary worktree while the worktree selector is focused. The confirmation uses the same `enter`/`y` confirm and `esc`/`n` cancel keys as deleting a session.
- The first worktree selector option is `+ New worktree`, but opening the dialog still selects the current worktree by default. Selecting it only marks the pending choice, and the worktree is created when the message is sent.
- Printable keys are not captured by worktree navigation while the prompt textarea is focused.
