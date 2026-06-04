import { context } from "./context.ts"
import { confirmModalBindings } from "./helpers.ts"
import { Keymap } from "./keymap.ts"

export interface HelpDialogCtx {
  readonly commandCount: number
  readonly close: () => void
  readonly moveSelection: (delta: -1 | 1) => void
  readonly executeSelected: () => void
}

export interface MenuCtx {
  readonly itemCount: number
  readonly close: () => void
  readonly openMenu: (menu: "actions" | "selected" | "servers") => void
  readonly moveSelection: (delta: -1 | 1) => void
  readonly executeSelected: () => void
}

export interface AddSessionDialogCtx {
  readonly worktreeCount: number
  readonly providerCount: number
  readonly modelCount: number
  readonly focus: "input" | "worktree" | "model-provider" | "model"
  readonly close: () => void
  readonly moveFocus: (delta: -1 | 1) => void
  readonly moveWorktree: (delta: -1 | 1) => void
  readonly commitWorktree: () => void
  readonly moveModelSelector: (delta: -1 | 1) => void
  readonly commitModelSelector: () => void
  readonly canRemoveWorktree: boolean
  readonly removeWorktree: () => void
}

export interface PromptDialogCtx {
  readonly close: () => void
}

export interface DeleteSessionDialogCtx {
  readonly close: () => void
  readonly confirm: () => void
}

export interface SettingsPageCtx {
  readonly serverCount: number
  readonly close: () => void
  readonly moveServer: (delta: -1 | 1) => void
}

export interface SearchCtx {
  readonly blur: () => void
}

export interface ListNavCtx {
  readonly tabCount: number
  readonly hasSelection: boolean
  readonly hasDeletableSelection: boolean
  readonly currentSessionId?: string | undefined
  readonly halfPage: number
  readonly refresh: () => void
  readonly openAddSession: () => void
  readonly openDeleteSession: () => void
  readonly executeSelection: () => void
  readonly openTmux: () => void
  readonly toggleVisualSelection: (sessionId?: string | undefined) => void
  readonly toggleSelectedSession: (sessionId: string) => void
  readonly clearMultiSelection: () => boolean
  readonly focusSearch: () => void
  readonly openHelp: () => void
  readonly openSettings: () => void
  readonly openMenu: (menu: "actions" | "selected" | "servers") => void
  readonly selectTab: (index: number) => void
  readonly cycleTab: (delta: -1 | 1) => void
  readonly moveSelection: (delta: number) => void
  readonly moveSelectionClamped: (delta: number) => void
  readonly moveTop: () => void
  readonly moveBottom: () => void
  readonly quit: () => void
  readonly toggleConsole: () => void
}

export interface GlobalKeymapCtx {
  readonly textInputActive: boolean
  readonly menu: MenuCtx | null
  readonly helpDialog: HelpDialogCtx | null
  readonly clearTextInput: () => boolean
  readonly quit: () => void
}

export interface DashboardKeymapCtx {
  readonly addSessionDialog: AddSessionDialogCtx | null
  readonly promptDialog: PromptDialogCtx | null
  readonly deleteSessionDialog: DeleteSessionDialogCtx | null
  readonly search: SearchCtx | null
  readonly listNav: ListNavCtx | null
}

export interface SettingsKeymapCtx {
  readonly settingsPage: SettingsPageCtx | null
}

export interface AppKeymapCtx {
  readonly global: GlobalKeymapCtx
  readonly dashboard: DashboardKeymapCtx
  readonly settings: SettingsKeymapCtx
}

const Global = context<GlobalKeymapCtx>()
const Dashboard = context<DashboardKeymapCtx>()
const Settings = context<SettingsKeymapCtx>()
const Menu = context<MenuCtx>()
const HelpDialog = context<HelpDialogCtx>()
const AddSessionDialog = context<AddSessionDialogCtx>()
const PromptDialog = context<PromptDialogCtx>()
const DeleteSessionDialog = context<DeleteSessionDialogCtx>()
const SettingsPage = context<SettingsPageCtx>()
const Search = context<SearchCtx>()
const ListNav = context<ListNavCtx>()

const tabNumberBindings = Array.from({ length: 9 }, (_, index) => ({
  id: `projects.select-${index + 1}`,
  title: `Select project ${index + 1}`,
  keys: [`${index + 1}`],
  enabled: (ctx: ListNavCtx) => index < ctx.tabCount || "No project at that index.",
  run: (ctx: ListNavCtx) => ctx.selectTab(index),
}))

const selectedSession = (ctx: ListNavCtx) => ctx.hasSelection || "No session selected."
const deletableSelection = (ctx: ListNavCtx) => ctx.hasDeletableSelection || "No session selected."

const helpDialogKeymap = HelpDialog(
  { id: "help.close", title: "Close help", keys: ["escape", "?"], run: (ctx) => ctx.close() },
  {
    id: "help.previous",
    title: "Previous help command",
    keys: ["k", "up", "ctrl+p", "shift+tab"],
    enabled: (ctx) => ctx.commandCount > 1 || "Only one command.",
    run: (ctx) => ctx.moveSelection(-1),
  },
  {
    id: "help.next",
    title: "Next help command",
    keys: ["j", "down", "ctrl+n", "tab"],
    enabled: (ctx) => ctx.commandCount > 1 || "Only one command.",
    run: (ctx) => ctx.moveSelection(1),
  },
  { id: "help.execute", title: "Run selected help command", keys: ["return"], run: (ctx) => ctx.executeSelected() },
)

const menuKeymap = Menu(
  { id: "menu.actions.open", title: "Open actions menu", keys: ["1"], run: (ctx) => ctx.openMenu("actions") },
  { id: "menu.selected.open", title: "Open selected menu", keys: ["2"], run: (ctx) => ctx.openMenu("selected") },
  { id: "menu.close", title: "Close menu", keys: ["escape"], run: (ctx) => ctx.close() },
  {
    id: "menu.previous",
    title: "Previous menu item",
    keys: ["k", "up", "ctrl+p", "shift+tab"],
    enabled: (ctx) => ctx.itemCount > 1 || "Only one item.",
    run: (ctx) => ctx.moveSelection(-1),
  },
  {
    id: "menu.next",
    title: "Next menu item",
    keys: ["j", "down", "ctrl+n", "tab"],
    enabled: (ctx) => ctx.itemCount > 1 || "Only one item.",
    run: (ctx) => ctx.moveSelection(1),
  },
  { id: "menu.execute", title: "Run selected menu item", keys: ["return"], run: (ctx) => ctx.executeSelected() },
)

const addSessionDialogKeymap = AddSessionDialog(
  { id: "session-new.cancel", title: "Cancel", keys: ["escape"], run: (ctx) => ctx.close() },
  { id: "session-new.focus.next", title: "Next field", keys: ["tab"], run: (ctx) => ctx.moveFocus(1) },
  { id: "session-new.focus.previous", title: "Previous field", keys: ["shift+tab"], run: (ctx) => ctx.moveFocus(-1) },
  {
    id: "session-new.worktree.next",
    title: "Next worktree",
    keys: ["j", "down", "ctrl+n"],
    when: (ctx) => ctx.focus === "worktree",
    enabled: (ctx) => ctx.worktreeCount > 1 || "Only one worktree.",
    run: (ctx) => ctx.moveWorktree(1),
  },
  {
    id: "session-new.worktree.previous",
    title: "Previous worktree",
    keys: ["k", "up", "ctrl+p"],
    when: (ctx) => ctx.focus === "worktree",
    enabled: (ctx) => ctx.worktreeCount > 1 || "Only one worktree.",
    run: (ctx) => ctx.moveWorktree(-1),
  },
  {
    id: "session-new.worktree.commit",
    title: "Use selected worktree",
    keys: ["return"],
    when: (ctx) => ctx.focus === "worktree",
    run: (ctx) => ctx.commitWorktree(),
  },
  {
    id: "session-new.worktree.remove",
    title: "Remove selected worktree",
    keys: ["d d"],
    when: (ctx) => ctx.focus === "worktree",
    enabled: (ctx) => ctx.canRemoveWorktree || "Cannot remove this worktree.",
    run: (ctx) => ctx.removeWorktree(),
  },
  {
    id: "session-new.model.next",
    title: "Next model selector option",
    keys: ["j", "down", "ctrl+n"],
    when: (ctx) => ctx.focus === "model-provider" || ctx.focus === "model",
    enabled: (ctx) => (ctx.focus === "model-provider" ? ctx.providerCount : ctx.modelCount) > 1 || "Only one option.",
    run: (ctx) => ctx.moveModelSelector(1),
  },
  {
    id: "session-new.model.previous",
    title: "Previous model selector option",
    keys: ["k", "up", "ctrl+p"],
    when: (ctx) => ctx.focus === "model-provider" || ctx.focus === "model",
    enabled: (ctx) => (ctx.focus === "model-provider" ? ctx.providerCount : ctx.modelCount) > 1 || "Only one option.",
    run: (ctx) => ctx.moveModelSelector(-1),
  },
  {
    id: "session-new.model.commit",
    title: "Use selected model option",
    keys: ["return"],
    when: (ctx) => ctx.focus === "model-provider" || ctx.focus === "model",
    run: (ctx) => ctx.commitModelSelector(),
  },
)

const promptDialogKeymap = PromptDialog({
  id: "prompt.cancel",
  title: "Cancel prompt",
  keys: ["escape"],
  run: (ctx) => ctx.close(),
})

const deleteSessionDialogKeymap = DeleteSessionDialog(
  ...confirmModalBindings<DeleteSessionDialogCtx>({
    id: "session-delete",
    close: (ctx) => ctx.close(),
    cancelKeys: ["escape", "n"],
    confirm: { title: "Delete session", run: (ctx) => ctx.confirm() },
  }),
  { id: "session-delete.confirm-y", title: "Delete session", keys: ["y"], run: (ctx) => ctx.confirm() },
)

const settingsPageControlsKeymap = SettingsPage(
  { id: "settings.close", title: "Close settings", keys: ["escape"], run: (ctx) => ctx.close() },
  {
    id: "settings.server.next",
    title: "Next server",
    keys: ["down", "ctrl+n", "tab"],
    enabled: (ctx) => ctx.serverCount > 1 || "Only one server.",
    run: (ctx) => ctx.moveServer(1),
  },
  {
    id: "settings.server.previous",
    title: "Previous server",
    keys: ["up", "ctrl+p", "shift+tab"],
    enabled: (ctx) => ctx.serverCount > 1 || "Only one server.",
    run: (ctx) => ctx.moveServer(-1),
  },
)

const searchKeymap = Search({
  id: "search.blur",
  title: "Blur search",
  keys: ["escape", "return"],
  run: (ctx) => ctx.blur(),
})

const listNavKeymap = ListNav(
  { id: "help.open", title: "Open help", keys: ["?"], run: (ctx) => ctx.openHelp() },
  { id: "menu.actions.open", title: "Open actions menu", keys: ["1"], run: (ctx) => ctx.openMenu("actions") },
  { id: "menu.selected.open", title: "Open selected menu", keys: ["2"], run: (ctx) => ctx.openMenu("selected") },
  { id: "menu.servers.open", title: "Open server selector", keys: ["ctrl+s"], run: (ctx) => ctx.openMenu("servers") },
  { id: "settings.open", title: "Open settings", keys: ["ctrl+p"], run: (ctx) => ctx.openSettings() },
  { id: "search.focus", title: "Focus search", keys: ["/"], run: (ctx) => ctx.focusSearch() },
  {
    id: "selection.clear-or-quit",
    title: "Clear selection or quit",
    keys: ["escape", "q"],
    run: (ctx) => {
      if (!ctx.clearMultiSelection()) ctx.quit()
    },
  },
  { id: "sessions.refresh", title: "Refresh sessions", keys: ["r"], run: (ctx) => ctx.refresh() },
  { id: "sessions.new", title: "Create new session", keys: ["a"], run: (ctx) => ctx.openAddSession() },
  {
    id: "selection.visual",
    title: "Toggle visual selection",
    keys: ["v"],
    run: (ctx) => ctx.toggleVisualSelection(ctx.currentSessionId),
  },
  {
    id: "selection.toggle",
    title: "Toggle selected session",
    keys: ["space"],
    enabled: selectedSession,
    run: (ctx) => {
      if (ctx.currentSessionId) ctx.toggleSelectedSession(ctx.currentSessionId)
    },
  },
  {
    id: "sessions.delete",
    title: "Delete selected sessions",
    keys: ["d"],
    enabled: deletableSelection,
    run: (ctx) => ctx.openDeleteSession(),
  },
  {
    id: "sessions.prompt",
    title: "Open selected session or toggle lane",
    keys: ["return"],
    run: (ctx) => ctx.executeSelection(),
  },
  {
    id: "sessions.open-tmux",
    title: "Open selected in tmux",
    keys: ["o"],
    enabled: selectedSession,
    run: (ctx) => ctx.openTmux(),
  },
  { id: "projects.next", title: "Next project", keys: ["tab"], run: (ctx) => ctx.cycleTab(1) },
  { id: "projects.previous", title: "Previous project", keys: ["shift+tab"], run: (ctx) => ctx.cycleTab(-1) },
  ...tabNumberBindings,
  { id: "selection.down", title: "Move down", keys: ["j", "down", "ctrl+n"], run: (ctx) => ctx.moveSelection(1) },
  { id: "selection.up", title: "Move up", keys: ["k", "up"], run: (ctx) => ctx.moveSelection(-1) },
  {
    id: "selection.half-down",
    title: "Half page down",
    keys: ["ctrl+d"],
    run: (ctx) => ctx.moveSelectionClamped(ctx.halfPage),
  },
  {
    id: "selection.half-up",
    title: "Half page up",
    keys: ["ctrl+u"],
    run: (ctx) => ctx.moveSelectionClamped(-ctx.halfPage),
  },
  { id: "selection.top", title: "Jump to top", keys: ["g g", "home"], run: (ctx) => ctx.moveTop() },
  { id: "selection.bottom", title: "Jump to bottom", keys: ["shift+g", "end"], run: (ctx) => ctx.moveBottom() },
  { id: "console.toggle", title: "Toggle console", keys: ["`"], run: (ctx) => ctx.toggleConsole() },
)

export const globalKeymap = Global(
  {
    id: "app.quit.ctrl-c",
    title: "Quit",
    keys: ["ctrl+c"],
    run: (ctx) => {
      if (!ctx.clearTextInput()) ctx.quit()
    },
  },
  menuKeymap.scope((ctx) => ctx.menu),
  helpDialogKeymap.scope((ctx) => ctx.helpDialog),
)

export const dashboardPageKeymap = Dashboard(
  addSessionDialogKeymap.scope((ctx) => ctx.addSessionDialog),
  promptDialogKeymap.scope((ctx) => ctx.promptDialog),
  deleteSessionDialogKeymap.scope((ctx) => ctx.deleteSessionDialog),
  searchKeymap.scope((ctx) => ctx.search),
  listNavKeymap.scope((ctx) => ctx.listNav),
)

export const settingsPageKeymap = Settings(settingsPageControlsKeymap.scope((ctx) => ctx.settingsPage))

export const appKeymap = Keymap.union<AppKeymapCtx>(
  globalKeymap.lift((ctx) => ctx.global),
  dashboardPageKeymap.lift((ctx) => ctx.dashboard),
  settingsPageKeymap.lift((ctx) => ctx.settings),
)
