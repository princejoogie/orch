# Engineering Practices

These are the default engineering practices for `orch`.

## Make Ownership Explicit

Every piece of behavior should have one owner.

- Key commands are owned by keymaps.
- Text editing is owned by inputs and textareas.
- Selected-row scrolling is owned by `useScrollFollowSelected`.
- Session API access is owned by the opencode client/snapshot modules.
- Shared UI frame behavior is owned by `src/components/ui/dialog.tsx`.

Do not duplicate ownership with a second ad hoc handler or local workaround.

## Prefer Small, Named Modules

Split code by responsibility, not by convenience.

- Put session-specific dialogs in `session-dialogs.tsx`.
- Put shortcut/help UI in `shortcuts-dialog.tsx`.
- Put reusable modal primitives in `ui/dialog.tsx`.
- Put pure reusable logic in `src/lib/`.
- Put React lifecycle helpers in `src/hooks/`.
- Put keyboard routing in `src/keymap/`.

If a file name says “session”, it should not contain app-wide shortcut data.

## Keep Pure Logic Testable

Prefer extracting pure functions when behavior is subtle.

Good examples:

- `scrollTopForVisibleLine`
- key parsing and dispatch
- selection movement helpers

Add tests for these functions before changing their semantics.

## Strict TypeScript Is Intentional

The project uses strict compiler options including `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`.

Follow these rules:

- Omit optional fields instead of setting them to `undefined` in object literals.
- Check indexed lookups before use, or use an explicit fallback.
- Keep state types honest: if a value may be `undefined`, say so in the type.
- Do not weaken compiler settings to avoid fixing call sites.

## Minimal Correct Changes

Prefer the smallest change that fixes the behavior and preserves conventions.

- Do not add compatibility layers unless there is a real consumer.
- Do not add a new abstraction for a one-off branch.
- Do extract a module when a file is taking on a different responsibility.

## Async And Errors

Async UI actions should set in-progress state and clear stale errors.

For dialogs:

- set `sending` or `deleting` before awaiting
- clear `error` before retrying
- keep the dialog open on failure
- show the failure in the dialog footer/body

Do not log recoverable dialog failures only to the console.

## User-Facing Commands

When adding a command that users can invoke directly:

1. Add the keymap binding.
2. Add or update help/shortcut UI.
3. Gate it correctly for text-input and modal states.
4. Add tests if dispatch semantics changed.

## Verification

For non-trivial changes, run:

```sh
bun run check
```

If only docs changed, targeted checks are enough, but run the full check when touching code, scripts, TypeScript config, or package workflow.
