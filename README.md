# orch

Terminal orchestrator for [opencode](https://opencode.ai/) sessions across projects and git worktrees.

`orch` gives you one keyboard-driven place to watch active opencode sessions, spot sessions that need input, prompt or create sessions, delete stale sessions, and jump back into the right tmux workspace without leaving the terminal.

<img width="2539" height="1363" alt="orch demo" src="https://github.com/user-attachments/assets/18ac61df-87c6-4ed1-b2ea-315ce8f49652" />

## Install

`orch` is currently a private/source-first CLI. Clone, install, and run with Bun:

```bash
git clone https://github.com/princejoogie/orch.git
cd orch
bun install
bun run dev
```

Build a standalone executable for your current platform:

```bash
bun run build
./dist/orch
```

The host build output is `dist/orch` on macOS/Linux and `dist/orch.exe` on Windows.

Build release archives and checksums:

```bash
bun run build:standalone
```

Release assets are written to `dist/release/` as `orch-<target>.tar.gz` plus `.sha256` files. Supported targets are `darwin-arm64`, `darwin-x64`, `linux-arm64`, and `linux-x64`.

Requirements:

- Bun 1.3 or newer for source/development usage.
- A running opencode persistence server. By default, `orch` connects to `http://localhost:4096`.
- `tmux` for opening selected worktrees from the dashboard.

Run it from the repo or built binary:

```bash
orch
```

## Local Development

Clone and install:

```bash
git clone https://github.com/princejoogie/orch.git
cd orch
bun install
```

With Nix flakes:

```bash
nix develop
bun install
bun run dev
```

Common checks:

```bash
bun run check
bun run typecheck
bun run lint
bun run test
bun run package:smoke
```

`bun run check` runs formatting, typechecking, linting, tests, and package smoke validation.

Benchmark opencode snapshot polling:

```bash
bun run bench:opencode
bun run bench:opencode -- --iterations=50 --limit=300 --server=http://localhost:4096
```

## Configuration

- `OPENCODE_SERVER_URL`: opencode persistence server URL, defaults to `http://localhost:4096`.

Example:

```bash
OPENCODE_SERVER_URL=http://localhost:4096 orch
```

CLI flags:

```bash
orch --help
orch --version
```

## Keybindings

- `up` / `down`: move selection
- `k` / `j`: move selection
- `ctrl-n`: move selection down
- `ctrl-u` / `ctrl-d`: half page up or down
- `gg` / `G`: jump to first or last session
- `home` / `end`: jump to first or last session
- `tab` / `shift-tab`: switch project tab
- `1`-`9`: select project tab by index
- `/`: focus search
- `ctrl-s`: open server selector
- `ctrl-p`: open settings
- `?`: open keyboard shortcut help
- `enter`: prompt the selected session
- `a`: create a new session in the active project
- `d`: delete the selected session with confirmation
- `o`: open selected worktree in tmux
- `r`: refresh sessions
- `` ` ``: toggle the OpenTUI console
- `q` / `esc` / `ctrl-c`: quit or close the active layer

Prompt dialogs:

- `enter`: send prompt
- `shift-enter`: insert newline
- `esc`: cancel

Settings page:

- `tab` / `shift-tab`: switch selected server
- `up` / `down`: switch selected server
- `ctrl-p` / `ctrl-n`: switch selected server
- `enter`: add server from the input
- `esc`: return to dashboard

## How It Works

`orch` talks to opencode through `@opencode-ai/sdk`. It lists projects and project worktrees through the SDK, then loads sessions from the last week, statuses, pending permission requests, latest messages, and context usage only for the selected project.

Sessions are grouped into project tabs and lanes:

- `Working`
- `Needs input`
- `Completed`

When opening a session in tmux, `orch` asks the opencode TUI to select the focused dashboard session, derives a session name from the project or git worktree, reuses an existing tmux session when it can, and focuses an existing `opencode` pane if one is already running.

## Conventions

Project conventions live in `docs/`:

- `docs/engineering-practices.md`
- `docs/code-organization.md`
- `docs/tui-interactions.md`
- `docs/keymaps.md`
- `docs/scrolling.md`
- `docs/dialogs.md`
- `docs/repo-workflows.md`

Agents should also read `AGENTS.md` before making changes.

## Releases

Release automation lives in `.github/workflows/publish.yml`. The workflow runs on GitHub Release publication, verifies that the tag matches `package.json`, builds standalone binaries for each release target, and uploads archives plus checksums.

Changesets are configured for release notes and version bumps:

```bash
bun run changeset
bun run changeset:status
bun run changeset:version
```

`orch` is currently private, so release assets are the primary distribution path.

## License

No license file is currently included.
