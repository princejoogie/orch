import { context } from "./context.ts"
import { confirmModalBindings } from "./helpers.ts"

export interface HelpDialogCtx {
  readonly commandCount: number
  readonly close: () => void
  readonly moveSelection: (delta: -1 | 1) => void
  readonly executeSelected: () => void
}

export interface AddSessionDialogCtx {
  readonly worktreeCount: number
  readonly close: () => void
  readonly moveWorktree: (delta: -1 | 1) => void
}

export interface PromptDialogCtx {
  readonly close: () => void
}

export interface DeleteSessionDialogCtx {
  readonly close: () => void
  readonly confirm: () => void
}

export interface SearchCtx {
  readonly blur: () => void
}

export interface ListNavCtx {
  readonly tabCount: number
  readonly hasSelection: boolean
  readonly halfPage: number
  readonly refresh: () => void
  readonly openAddSession: () => void
  readonly openDeleteSession: () => void
  readonly openPrompt: () => void
  readonly openTmux: () => void
  readonly focusSearch: () => void
  readonly openHelp: () => void
  readonly selectTab: (index: number) => void
  readonly cycleTab: (delta: -1 | 1) => void
  readonly moveSelection: (delta: number) => void
  readonly moveSelectionClamped: (delta: number) => void
  readonly moveTop: () => void
  readonly moveBottom: () => void
  readonly quit: () => void
  readonly toggleConsole: () => void
}

export interface DashboardKeymapCtx {
  readonly textInputActive: boolean
  readonly helpDialog: HelpDialogCtx | null
  readonly addSessionDialog: AddSessionDialogCtx | null
  readonly promptDialog: PromptDialogCtx | null
  readonly deleteSessionDialog: DeleteSessionDialogCtx | null
  readonly search: SearchCtx | null
  readonly listNav: ListNavCtx | null
  readonly quit: () => void
}

const Dashboard = context<DashboardKeymapCtx>()
const HelpDialog = context<HelpDialogCtx>()
const AddSessionDialog = context<AddSessionDialogCtx>()
const PromptDialog = context<PromptDialogCtx>()
const DeleteSessionDialog = context<DeleteSessionDialogCtx>()
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

const helpDialogKeymap = HelpDialog(
  { id: "help.close", title: "Close help", keys: ["escape", "?"], run: (ctx) => ctx.close() },
  {
    id: "help.previous",
    title: "Previous help command",
    keys: ["k", "up", "ctrl+p"],
    enabled: (ctx) => ctx.commandCount > 1 || "Only one command.",
    run: (ctx) => ctx.moveSelection(-1),
  },
  {
    id: "help.next",
    title: "Next help command",
    keys: ["j", "down", "ctrl+n"],
    enabled: (ctx) => ctx.commandCount > 1 || "Only one command.",
    run: (ctx) => ctx.moveSelection(1),
  },
  { id: "help.execute", title: "Run selected help command", keys: ["return"], run: (ctx) => ctx.executeSelected() },
)

const addSessionDialogKeymap = AddSessionDialog(
  { id: "session-new.cancel", title: "Cancel", keys: ["escape"], run: (ctx) => ctx.close() },
  {
    id: "session-new.worktree.next",
    title: "Next worktree",
    keys: ["tab"],
    enabled: (ctx) => ctx.worktreeCount > 1 || "Only one worktree.",
    run: (ctx) => ctx.moveWorktree(1),
  },
  {
    id: "session-new.worktree.previous",
    title: "Previous worktree",
    keys: ["shift+tab"],
    enabled: (ctx) => ctx.worktreeCount > 1 || "Only one worktree.",
    run: (ctx) => ctx.moveWorktree(-1),
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

const searchKeymap = Search({
  id: "search.blur",
  title: "Blur search",
  keys: ["escape", "return"],
  run: (ctx) => ctx.blur(),
})

const listNavKeymap = ListNav(
  { id: "help.open", title: "Open help", keys: ["?"], run: (ctx) => ctx.openHelp() },
  { id: "search.focus", title: "Focus search", keys: ["/"], run: (ctx) => ctx.focusSearch() },
  { id: "app.quit", title: "Quit", keys: ["escape", "q"], run: (ctx) => ctx.quit() },
  { id: "sessions.refresh", title: "Refresh sessions", keys: ["r"], run: (ctx) => ctx.refresh() },
  { id: "sessions.new", title: "Create new session", keys: ["a"], run: (ctx) => ctx.openAddSession() },
  {
    id: "sessions.delete",
    title: "Delete selected session",
    keys: ["d"],
    enabled: selectedSession,
    run: (ctx) => ctx.openDeleteSession(),
  },
  {
    id: "sessions.prompt",
    title: "Prompt selected session",
    keys: ["return"],
    enabled: selectedSession,
    run: (ctx) => ctx.openPrompt(),
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
  { id: "selection.up", title: "Move up", keys: ["k", "up", "ctrl+p"], run: (ctx) => ctx.moveSelection(-1) },
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

export const dashboardKeymap = Dashboard(
  { id: "app.quit.ctrl-c", title: "Quit", keys: ["ctrl+c"], run: (ctx) => ctx.quit() },
  helpDialogKeymap.scope((ctx) => ctx.helpDialog),
  addSessionDialogKeymap.scope((ctx) => ctx.addSessionDialog),
  promptDialogKeymap.scope((ctx) => ctx.promptDialog),
  deleteSessionDialogKeymap.scope((ctx) => ctx.deleteSessionDialog),
  searchKeymap.scope((ctx) => ctx.search),
  listNavKeymap.scope((ctx) => !ctx.textInputActive && ctx.listNav),
)
