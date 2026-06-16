# Repository Notes

## Read First

- Start with `docs/README.md`.
- Read the docs that match the files or behavior you are changing.
- Keep docs and implementation aligned. If behavior changes, update the relevant doc in the same change.
- After every change, especially substantial changes, recheck whether existing docs need updates or whether a new doc is needed to describe the system behavior.

## Bug Reports

- Reproduce reported behavior before changing code. If you cannot reproduce it, stop and report exactly what you tried instead of patching a guessed cause.
- For TUI behavior, use `termctrl` and treat `termctrl show` as the evidence for visible state. API calls and logs may explain the bug, but they do not replace visible TUI reproduction.
- For OpenCode server behavior, correlate reproduction with `~/.local/state/opencode/serve.out.log`, `~/.local/state/opencode/serve.err.log`, or the detailed logs referenced from those files when needed.

## Docs

- `docs/README.md`: docs index and maintenance rule.
- `docs/engineering-practices.md`: implementation, TypeScript, state, errors, and review expectations.
- `docs/code-organization.md`: source ownership and module boundaries.
- `docs/tui-interactions.md`: OpenTUI/React keyboard, focus, mouse, and text input behavior.
- `docs/keymaps.md`: scoped keymap architecture and dashboard shortcut wiring.
- `docs/scrolling.md`: selected-row scrolling, scrollbox focus, and mouse wheel behavior.
- `docs/dialogs.md`: modal frame conventions and dialog ownership.
- `docs/repo-workflows.md`: CI, release assets, changesets, Nix, tests, and package smoke checks.

## Commands

- Full check: `bun run check`.
- Format check: `bun run format:check`.
- Typecheck: `bun run typecheck`.
- Lint: `bun run lint`.
- Test: `bun run test`.
- Package smoke: `bun run package:smoke`.
- Host build: `bun run build`.
- Standalone release asset build: `bun run build:standalone`.
- Create changeset: `bun run changeset`.
- Check changesets: `bun run changeset:status`.
- Apply changesets: `bun run changeset:version`.

More detail lives in `docs/repo-workflows.md` for commit readiness, release process, and verification expectations.
