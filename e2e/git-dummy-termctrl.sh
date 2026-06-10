#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SESSION_NAME="${ORCH_E2E_SESSION:-orch-e2e-git-dummy}"
BINARY_PATH="${ORCH_E2E_BINARY:-$ROOT_DIR/dist/orch}"
SERVER_URL="${ORCH_E2E_SERVER_URL:-http://localhost:4096}"
PROJECT_INDEX="${ORCH_E2E_PROJECT_INDEX:-6}"
PROJECT_NAME="${ORCH_E2E_PROJECT_NAME:-git-dummy}"
SESSION_COUNT_LABEL="${ORCH_E2E_SESSION_COUNT_LABEL:-2 sessions}"
SESSION_TITLE="${ORCH_E2E_SESSION_TITLE:-Short input title}"
SEARCH_TITLE="${ORCH_E2E_SEARCH_TITLE:-Greeting}"
PROMPT_SESSION_TITLE="${ORCH_E2E_PROMPT_SESSION_TITLE:-$SEARCH_TITLE}"
SEARCH_RESULT_LABEL="${ORCH_E2E_SEARCH_RESULT_LABEL:-Completed 1}"
MODEL_PROVIDER_LABEL="${ORCH_E2E_MODEL_PROVIDER_LABEL:-OpenAI}"
COLS="${ORCH_E2E_COLS:-140}"
ROWS="${ORCH_E2E_ROWS:-42}"
TIMEOUT_MS="${ORCH_E2E_TIMEOUT_MS:-10000}"
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
    log "leaving termctrl session running: $SESSION_NAME"
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

settle() {
  termctrl show "$SESSION_NAME" >/dev/null
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

log "select project $PROJECT_NAME with shortcut $PROJECT_INDEX"
send_text "$PROJECT_INDEX"
wait_for "$SESSION_TITLE"
wait_for "$SESSION_COUNT_LABEL"

log "exercise top menus"
send_text "1"
wait_for "New Session"
wait_for "Refresh"
send_text "2"
wait_for "Prompt"
wait_for "Open in tmux"
send_key escape
settle

log "exercise server selector"
send_key ctrl-s
wait_for "active"
wait_for "Add server"
send_key escape
settle

log "exercise add-session dialog"
send_text "a"
wait_for "New session"
wait_for "Worktree: $PROJECT_NAME"
send_key tab
wait_for "$MODEL_PROVIDER_LABEL"
send_key escape
settle
wait_for "$SESSION_TITLE"

log "focus a session row and exercise prompt dialog"
send_key end
send_key enter
wait_for "Prompt session"
wait_for "Messages:"
wait_for "$PROMPT_SESSION_TITLE"
send_key tab
wait_for "$MODEL_PROVIDER_LABEL"
send_key escape
settle
wait_for "$SESSION_TITLE"

log "exercise search filtering"
send_text "/"
send_text "$SEARCH_TITLE"
wait_for "$SEARCH_RESULT_LABEL"
wait_for "$SEARCH_TITLE"
send_key ctrl-c
wait_for "$SESSION_COUNT_LABEL"
send_key enter

log "exercise settings page"
send_key ctrl-p
wait_for "Settings"
wait_for "Servers"
wait_for "$SERVER_URL"
send_key escape
settle
wait_for "Title"

log "restore $PROJECT_NAME after settings"
send_text "$PROJECT_INDEX"
wait_for "$SESSION_TITLE"

log "exercise shortcuts help"
send_text "?"
wait_for "Shortcuts"
wait_for "Open this help"
send_key escape
settle

log "exercise project cycling"
send_key tab
settle
send_key shift-tab
wait_for "$SESSION_TITLE"

log "git-dummy termctrl e2e passed"
