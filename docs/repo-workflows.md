# Repo Workflows

These are the repository workflow conventions for `orch` as a private CLI with standalone release assets.

## Scripts

Primary scripts in `package.json`:

- `bun run check`: full local verification pipeline.
- `bun run format:check`: formatting gate.
- `bun run typecheck`: strict TypeScript gate.
- `bun run lint`: oxlint gate over `src/`, `scripts/`, and `test/`.
- `bun run test`: Bun tests.
- `bun run test:e2e:git-dummy`: opt-in termctrl e2e smoke against the local `git-dummy` OpenCode fixture.
- `bun run package:smoke`: builds the binary and checks `--help`/`--version`.
- `bun run build:standalone`: creates release tarballs and `.sha256` files for the current or requested target.

Run `bun run check` before handing off substantial changes.

## TypeScript Strictness

`tsconfig.json` intentionally enables stricter options:

- `exactOptionalPropertyTypes`
- `noUncheckedIndexedAccess`
- `noUnusedLocals`
- `noImplicitOverride`

Prefer omitting optional fields over passing `undefined` when constructing API payloads or state objects.

## CI

`.github/workflows/ci.yml` runs:

1. `bun install --frozen-lockfile`
2. `bun run format:check`
3. `bun run typecheck`
4. `bun run lint`
5. `bun run test`
6. `bun run package:smoke`

Keep CI aligned with `bun run check`.

## Release Assets

`scripts/release-targets.ts` defines supported standalone targets:

- `darwin-arm64`
- `darwin-x64`
- `linux-arm64`
- `linux-x64`

`scripts/build-standalone.ts` builds a Bun-compiled `orch`, archives it as `orch-<target>.tar.gz`, and writes matching SHA-256 files.

Examples:

```sh
bun run build:standalone
bun run build:standalone -- linux-x64
bun run build:standalone -- all
```

## Publish Workflow

`.github/workflows/publish.yml` runs on GitHub Release publication.

It verifies the release tag matches `package.json`:

```sh
v${version} == ${GITHUB_REF_NAME}
```

Then it builds and uploads standalone release assets for every supported target.

The Homebrew tap dispatch is optional and guarded by repo variables/secrets.

## Changesets

`.changeset/` is present for release notes/versioning.

Use:

```sh
bun run changeset
bun run changeset:status
bun run changeset:version
```

Because `orch` is still private, Changesets are a convention for release discipline rather than npm publishing.

## Nix

`flake.nix` defines a dev shell with Bun, Node 24, GitHub CLI, Git, and tmux.

`flake.lock` is not currently checked in because `nix` was not available in the environment when this was added. Generate it with:

```sh
nix flake lock
```

## Tests

Tests live in `test/` and should focus on pure logic:

- keymap dispatch semantics
- scroll math
- utility functions

Prefer testing extracted pure functions over driving the terminal renderer.

## TUI Verification With termctrl

Use `termctrl` for end-to-end checks that depend on visible OpenTUI behavior. Prefer named sessions for multi-step interaction, and always stop the session when finished.

`bun run test:e2e:git-dummy` builds `dist/orch`, starts it in a `termctrl` OpenTUI session, selects the `git-dummy` project fixture, and verifies the visible dashboard, menus, search, settings, add-session dialog, prompt dialog, shortcuts help, and project cycling. It is not part of `bun run check` or CI because it requires a live OpenCode server with the local fixture data.

Useful overrides:

```sh
ORCH_E2E_SKIP_BUILD=1 bun run test:e2e:git-dummy
ORCH_E2E_KEEP_ALIVE=1 bun run test:e2e:git-dummy
ORCH_E2E_PROJECT_INDEX=6 ORCH_E2E_PROJECT_NAME=git-dummy bun run test:e2e:git-dummy
```

Example workflow:

```sh
bun run build
termctrl start orch-test --cols 130 --rows 35 -- $(pwd)/dist/orch
termctrl wait orch-test "Projects" --timeout 5000
termctrl show orch-test
termctrl send orch-test text:a
termctrl wait orch-test "New session" --timeout 5000
termctrl show orch-test
termctrl send orch-test tab
termctrl show orch-test
termctrl send orch-test text:j
termctrl show orch-test
termctrl send orch-test tab
termctrl show orch-test
termctrl stop orch-test
```

Use this style when changing keyboard focus, dialogs, menus, sidebars, scroll behavior, or any behavior where text output alone is not enough. Capture evidence from `termctrl show`; do not rely on logs for alternate-screen TUIs.
