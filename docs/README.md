# orch docs

This folder defines project conventions and engineering practices for `orch`.

These docs are not a history of where patterns came from. They are the standards to use when changing this codebase.

## Conventions

- `docs/engineering-practices.md`: general implementation, TypeScript, state, errors, and review expectations.
- `docs/code-organization.md`: where code belongs and how modules should be split.
- `docs/tui-interactions.md`: OpenTUI/React ownership rules for keyboard, focus, mouse, and text input.
- `docs/keymaps.md`: scoped keymap architecture and dashboard shortcut wiring.
- `docs/scrolling.md`: selected-row scrolling, scrollbox focus rules, and mouse wheel behavior.
- `docs/dialogs.md`: modal frame conventions and dialog file boundaries.
- `docs/repo-workflows.md`: CI, release assets, changesets, Nix, tests, and package smoke checks.

Keep these docs current when changing the corresponding code. If implementation and docs disagree, fix one before finishing the change.
