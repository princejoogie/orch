# Repository Notes

## Read First

- Project conventions live in `docs/`.
- Start with `docs/README.md`, then read the doc that matches the files you are editing.
- Keep docs and implementation aligned. If behavior changes, update the relevant doc in the same change.
- Respect file boundaries from `docs/code-organization.md`; do not put app-wide UI data in feature-specific files.

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

## Commit Readiness

- Before committing or pushing code changes, run `bun run check`.
- For small docs-only changes, targeted checks are acceptable, but code/script/config changes should use the full check.
- Before release commits, also run `bun run build:standalone`.
- CI enforces formatting, typechecking, linting, tests, and package smoke.
- If formatting fails, run `bun run format`, then rerun `bun run format:check`.

## Release Process

- Release workflow: `.github/workflows/publish.yml`.
- Add a changeset for user-facing changes with `bun run changeset`.
- Check pending changesets with `bun run changeset:status`.
- Apply pending changesets with `bun run changeset:version`; this bumps `package.json` and updates `CHANGELOG.md` when release notes exist.
- Run `bun run check` before committing the version bump.
- Run `bun run build:standalone` before release commits.
- Commit and push the version bump and consumed changesets to `main`.
- Create a GitHub release named and tagged `v<package.json version>`.
- The workflow verifies the release tag matches `package.json`, builds standalone binaries, and uploads release assets.
- Homebrew tap dispatch is optional and uses `HOMEBREW_TAP_REPOSITORY` plus `HOMEBREW_TAP_TOKEN` when configured.
- After releases, verify the publish workflow passes and uploaded assets/checksums exist.

## Release Commands

- Create release: `gh release create vX.Y.Z --target main --title "vX.Y.Z" --notes "..."`.
- Check publish run: `gh run list --workflow publish.yml --limit 5`.
- Inspect release assets: `gh release view vX.Y.Z --json assets`.

## TUI Conventions

- Keyboard commands belong in `src/keymap/`, not ad hoc `useKeyboard` handlers.
- App-owned scrollboxes should be `focusable={false}` so OpenTUI default scrolling does not fight selection movement.
- Selection scrolling should use `useScrollFollowSelected` and `scrollTopForVisibleLine`.
- Mouse click handlers on selectable rows/tabs/dialog options should prevent default focus changes and stop propagation.
- Text input modes must gate list/app shortcuts through keymap scopes.

## Dialog Conventions

- Shared modal primitives live in `src/components/ui/dialog.tsx`.
- Session-specific dialogs live in `src/components/session-dialogs.tsx`.
- Keyboard shortcut/help UI lives in `src/components/shortcuts-dialog.tsx`.
- Modal dividers must connect to side borders with junction characters. When adding a divider inside a modal frame, ensure the frame's `junctionRows` includes that row so the side bars render `├` and `┤` rather than detached `│`.
- Use `HintRow` for dialog footers instead of hand-written hint strings.

## TypeScript Conventions

- Strict TypeScript settings are intentional; do not weaken them to land changes.
- With `exactOptionalPropertyTypes`, omit optional object fields rather than passing `undefined`.
- With `noUncheckedIndexedAccess`, check indexed values or provide explicit fallbacks.
- Keep pure behavior in testable helpers where possible.

## Plans And Docs

- This repo currently uses `docs/` for standing conventions.
- If adding a larger future-direction plan, create a focused markdown file under `docs/` or a dedicated `plans/` folder if multiple plans are needed.
- Do not leave important design decisions only in chat; capture durable conventions in docs.
