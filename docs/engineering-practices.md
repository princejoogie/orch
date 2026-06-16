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

App-owned async, IO, SDK, CLI, and script work should be modeled with Effect. Keep Promise APIs at external edges only, then bridge with `AppRuntime.runPromise` from React Query, React lifecycle handlers, and executable entrypoints.

Follow these rules:

- Use `Effect.gen`, `Effect.tryPromise`, and `Effect.try` for async or fallible work.
- Use `Data.TaggedError` for app-owned failures instead of throwing generic `Error` values.
- Avoid `unknown` error channels in app-owned Effect APIs; map external failures to tagged errors at the seam.
- Keep the OpenCode SDK boundary in `src/opencode/client/` and filesystem persistence in `src/config/persistence.ts`.
- Catch recoverable UI action failures inside the Effect program and surface them through dialog state or toasts.

Async UI actions should set in-progress state and clear stale errors.

For dialogs:

- set `sending` or `deleting` before awaiting
- clear `error` before retrying
- keep the dialog open on failure
- show the failure in the dialog footer/body

Recoverable dialog failures should be visible in the UI that can recover from them.

## Failed Fixes And Bug Reports

When a user reports that a behavior does not work, or that a previous fix did not resolve the issue, reproduce the issue before changing code. If the issue cannot be reproduced, stop and report the attempted reproduction steps instead of changing code. Do not patch a plausible cause just because the code looks suspicious.

Required flow:

1. Run the smallest realistic reproduction in the relevant surface.
2. For TUI behavior, use `termctrl` and capture the visible failure with `termctrl show`.
3. If the failure cannot be reproduced, do not proceed with a code change.
4. Use the reproduced behavior to identify the state transition, event, or data path causing the failure.
5. Make the smallest correct code change.
6. Repeat the same reproduction steps as verification before relying on broader checks.

For OpenCode server issues, use the visible TUI state as the source of truth and use server logs only as supporting evidence. Serve logs live at `~/.local/state/opencode/serve.out.log` and `~/.local/state/opencode/serve.err.log`; detailed crash logs are usually referenced from those files under `~/.local/share/opencode/log/`.

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
