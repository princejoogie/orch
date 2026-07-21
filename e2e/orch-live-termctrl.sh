#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SESSION_NAME="${ORCH_E2E_SESSION:-orch-e2e-live}"
BINARY_PATH="${ORCH_E2E_BINARY:-$ROOT_DIR/dist/orch}"
SERVER_URL="${ORCH_E2E_SERVER_URL:-http://localhost:4096}"
PROJECT_NAME="${ORCH_E2E_PROJECT_NAME:-orch}"
PROJECT_INDEX="${ORCH_E2E_PROJECT_INDEX:-}"
PROJECT_DIRECTORY="${ORCH_E2E_PROJECT_DIRECTORY:-$ROOT_DIR}"
EVENT_PROMPT="${ORCH_E2E_EVENT_PROMPT:-hi}"
COLS="${ORCH_E2E_COLS:-140}"
ROWS="${ORCH_E2E_ROWS:-42}"
TIMEOUT_MS="${ORCH_E2E_TIMEOUT_MS:-10000}"
EVENT_TIMEOUT_MS="${ORCH_E2E_EVENT_TIMEOUT_MS:-10000}"
EXIT_ATTEMPTS="${ORCH_E2E_EXIT_ATTEMPTS:-50}"
SESSION_STARTED=0

log() {
  printf '[e2e] %s\n' "$*"
}

cleanup() {
  local status=$?
  set +e

  if [[ "$SESSION_STARTED" != "1" ]] || ! command -v termctrl >/dev/null 2>&1; then
    exit "$status"
  fi

  if [[ $status -ne 0 ]]; then
    log "failed; final visible TUI state follows"
    termctrl show "$SESSION_NAME" >&2
  fi

  if [[ "${ORCH_E2E_KEEP_ALIVE:-0}" == "1" ]]; then
    log "leaving termctrl session retained: $SESSION_NAME"
  else
    termctrl stop "$SESSION_NAME" >/dev/null 2>&1
  fi

  exit "$status"
}

trap cleanup EXIT

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf '[e2e] ERROR: missing required command: %s\n' "$1" >&2
    exit 127
  fi
}

wait_for() {
  local text="$1"
  local timeout="${2:-$TIMEOUT_MS}"

  log "wait for: $text"
  termctrl wait "$SESSION_NAME" "$text" --timeout "$timeout" >/dev/null
}

send_key() {
  log "send: $*"
  termctrl send "$SESSION_NAME" "$@" >/dev/null
}

send_text() {
  send_key "text:$1"
}

select_project_with_count() {
  local count="$1"
  local label="$count sessions"
  local index
  index="${PROJECT_INDEX:-$(project_index)}"

  if ((index < 1)); then
    printf '[e2e] ERROR: invalid project index %s for %s\n' "$index" "$PROJECT_NAME" >&2
    return 1
  fi

  log "select project $PROJECT_NAME at index $index"
  for ((current = 1; current < index; current += 1)); do
    send_key tab
  done
  wait_for "$label"
}

project_index() {
  ORCH_E2E_SERVER_URL="$SERVER_URL" ORCH_E2E_PROJECT_NAME="$PROJECT_NAME" bun -e '
    import { AppRuntime } from "./src/effect/app-runtime.ts"
    import { getProjects } from "./src/opencode/client/index.ts"

    const serverUrl = process.env.ORCH_E2E_SERVER_URL
    const projectName = process.env.ORCH_E2E_PROJECT_NAME
    const projects = await AppRuntime.runPromise(getProjects({ serverUrl }))
    const sorted = [...projects.projects].sort(
      (left, right) => right.updated - left.updated || left.title.localeCompare(right.title),
    )
    const index = sorted.findIndex((project) => project.title === projectName)
    if (index === -1) {
      console.error(`Project not found: ${projectName}`)
      process.exit(1)
    }

    console.log(index + 1)
  '
}

project_session_count() {
  ORCH_E2E_SERVER_URL="$SERVER_URL" ORCH_E2E_PROJECT_NAME="$PROJECT_NAME" bun -e '
    import { AppRuntime } from "./src/effect/app-runtime.ts"
    import { getProjects, getProjectSessions } from "./src/opencode/client/index.ts"

    const serverUrl = process.env.ORCH_E2E_SERVER_URL
    const projectName = process.env.ORCH_E2E_PROJECT_NAME
    const projects = await AppRuntime.runPromise(getProjects({ serverUrl }))
    const project = projects.projects.find((row) => row.title === projectName)
    if (!project) {
      console.error(`Project not found: ${projectName}`)
      process.exit(1)
    }

    const sessions = await AppRuntime.runPromise(getProjectSessions({ project, serverUrl }))
    console.log(sessions.rows.length)
  '
}

create_external_session() {
  ORCH_E2E_SERVER_URL="$SERVER_URL" ORCH_E2E_PROJECT_DIRECTORY="$PROJECT_DIRECTORY" ORCH_E2E_EVENT_PROMPT="$EVENT_PROMPT" bun -e '
    import { AppRuntime } from "./src/effect/app-runtime.ts"
    import { createSessionWithPrompt } from "./src/opencode/client/index.ts"

    const serverUrl = process.env.ORCH_E2E_SERVER_URL
    const directory = process.env.ORCH_E2E_PROJECT_DIRECTORY
    const text = process.env.ORCH_E2E_EVENT_PROMPT ?? "hi"
    const sessionID = await AppRuntime.runPromise(createSessionWithPrompt({ directory, serverUrl, text }))
    console.log(sessionID)
  '
}

wait_for_exit() {
  log "wait for process exit"
  for ((attempt = 0; attempt < EXIT_ATTEMPTS; attempt += 1)); do
    local status
    if ! status="$(termctrl status "$SESSION_NAME" 2>&1)"; then
      return 0
    fi
    if [[ "$status" == *" exited"* ]]; then
      return 0
    fi
    sleep 0.1
  done

  termctrl status "$SESSION_NAME" >&2
  return 1
}

require_command bun
require_command termctrl

cd "$ROOT_DIR"

if [[ "${ORCH_E2E_SKIP_BUILD:-0}" != "1" ]]; then
  log "build orch binary"
  bun run build
fi

if [[ ! -x "$BINARY_PATH" ]]; then
  printf '[e2e] ERROR: binary is not executable: %s\n' "$BINARY_PATH" >&2
  exit 1
fi

termctrl stop "$SESSION_NAME" >/dev/null 2>&1 || true

log "start orch in termctrl session: $SESSION_NAME"
termctrl start "$SESSION_NAME" --host opentui --cols "$COLS" --rows "$ROWS" -- "$BINARY_PATH" >/dev/null
SESSION_STARTED=1

wait_for "Opencode Orchestrator"
wait_for "$SERVER_URL"
wait_for "Projects"
wait_for "$PROJECT_NAME"

initial_count="$(project_session_count)"
select_project_with_count "$initial_count"

log "create external session for event refresh"
create_external_session >/dev/null
next_count="$((initial_count + 1))"
wait_for "$next_count sessions" "$EVENT_TIMEOUT_MS"

log "verify ctrl-c exits"
send_key ctrl-c
wait_for_exit

log "orch live termctrl e2e passed"
