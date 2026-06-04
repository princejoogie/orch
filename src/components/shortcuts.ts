export type ShortcutScope = "Session" | "Navigation" | "Projects" | "App"

export type ShortcutAction =
  | "prompt-selected-session"
  | "create-session"
  | "delete-selected-session"
  | "start-visual-selection"
  | "toggle-session-selection"
  | "clear-session-selection"
  | "open-selected-in-tmux"
  | "move-selection-down"
  | "move-selection-up"
  | "half-page-down"
  | "half-page-up"
  | "jump-to-top"
  | "jump-to-bottom"
  | "next-project"
  | "previous-project"
  | "open-actions-menu"
  | "open-selected-menu"
  | "open-server-selector"
  | "open-settings"
  | "focus-search"
  | "open-help"
  | "refresh-sessions"
  | "toggle-console"
  | "quit"

export type Shortcut = {
  scope: ShortcutScope
  description: string
  shortcut: string
  action: ShortcutAction
}

export const SHORTCUTS: readonly Shortcut[] = [
  {
    scope: "Session",
    description: "Prompt session or toggle lane",
    shortcut: "enter",
    action: "prompt-selected-session",
  },
  { scope: "Session", description: "Create new session", shortcut: "a", action: "create-session" },
  { scope: "Session", description: "Delete selected sessions", shortcut: "d", action: "delete-selected-session" },
  { scope: "Session", description: "Toggle visual selection", shortcut: "v", action: "start-visual-selection" },
  { scope: "Session", description: "Toggle session selection", shortcut: "space", action: "toggle-session-selection" },
  { scope: "Session", description: "Clear session selection", shortcut: "esc", action: "clear-session-selection" },
  { scope: "Session", description: "Open selected in tmux", shortcut: "o", action: "open-selected-in-tmux" },
  { scope: "Navigation", description: "Move selection down", shortcut: "j / down", action: "move-selection-down" },
  { scope: "Navigation", description: "Move selection up", shortcut: "k / up", action: "move-selection-up" },
  { scope: "Navigation", description: "Half page down", shortcut: "ctrl-d", action: "half-page-down" },
  { scope: "Navigation", description: "Half page up", shortcut: "ctrl-u", action: "half-page-up" },
  { scope: "Navigation", description: "Jump to top", shortcut: "gg / home", action: "jump-to-top" },
  { scope: "Navigation", description: "Jump to bottom", shortcut: "G / end", action: "jump-to-bottom" },
  { scope: "Projects", description: "Next project", shortcut: "tab", action: "next-project" },
  { scope: "Projects", description: "Previous project", shortcut: "shift-tab", action: "previous-project" },
  { scope: "App", description: "Open actions menu", shortcut: "1", action: "open-actions-menu" },
  { scope: "App", description: "Open selected menu", shortcut: "2", action: "open-selected-menu" },
  { scope: "App", description: "Open server selector", shortcut: "ctrl-s", action: "open-server-selector" },
  { scope: "App", description: "Open settings", shortcut: "ctrl-p", action: "open-settings" },
  { scope: "App", description: "Focus search", shortcut: "/", action: "focus-search" },
  { scope: "App", description: "Open this help", shortcut: "?", action: "open-help" },
  { scope: "App", description: "Refresh sessions", shortcut: "r", action: "refresh-sessions" },
  { scope: "App", description: "Toggle console", shortcut: "`", action: "toggle-console" },
  { scope: "App", description: "Quit", shortcut: "q / esc", action: "quit" },
]
