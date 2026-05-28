# Engineering Practices

These are the default engineering practices for `orch`.

## Make Ownership Explicit

Every piece of behavior should have one owner.

- Key commands are owned by keymaps.
- Text editing is owned by inputs and textareas.
- Selected-row scrolling is owned by `useScrollFollowSelected`.
- Session API access is owned by the opencode client/snapshot modules.
- Shared UI frame behavior is owned by `src/components/ui/dialog.tsx`.

When behavior needs to change, update the owning module instead of adding a second local path for the same responsibility.

## Prefer Small, Named Modules

Split code by responsibility, not by convenience.

- Dialogs live with the feature or app surface whose behavior they represent.
- Shortcut/help UI lives with command metadata.
- Reusable modal primitives live in UI modules.
- Put pure reusable logic in `src/lib/`.
- Put React lifecycle helpers in `src/hooks/`.
- Put keyboard routing in `src/keymap/`.

File ownership should match the behavior named by the file. App-wide data belongs in app-wide surfaces, not in a feature module that only happens to need a nearby UI primitive.

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
- Keep compiler settings strict and fix call sites when the types expose an unsafe assumption.

## Minimal Correct Changes

Prefer the smallest change that fixes the behavior and preserves conventions.

- Compatibility layers need a real consumer.
- New abstractions should serve repeated behavior or a clear ownership boundary.
- Do extract a module when a file is taking on a different responsibility.

## Async And Errors

Async UI actions should set in-progress state and clear stale errors.

For dialogs:

- set `sending` or `deleting` before awaiting
- clear `error` before retrying
- keep the dialog open on failure
- show the failure in the dialog footer/body

Recoverable dialog failures should be visible in the UI that can recover from them.

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
