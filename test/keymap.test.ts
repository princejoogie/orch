import { describe, expect, test } from "bun:test"
import { command } from "../src/keymap/command.ts"
import {
  dashboardPageKeymap,
  globalKeymap,
  settingsPageKeymap,
  type DashboardKeymapCtx,
  type GlobalKeymapCtx,
  type SettingsKeymapCtx,
} from "../src/keymap/dashboard.ts"
import { createDispatcher } from "../src/keymap/dispatcher.ts"
import { Keymap } from "../src/keymap/keymap.ts"
import { normalizeOpenTuiKey } from "../src/keymap/opentui-adapter.ts"
import { parseKey } from "../src/keymap/keys.ts"

describe("keymap dispatcher", () => {
  test("dispatches simple bindings", () => {
    let count = 0
    const keymap = command<{ enabled: boolean }>({
      keys: ["j"],
      run: () => {
        count += 1
      },
    })
    const dispatcher = createDispatcher(keymap, () => ({ enabled: true }))

    expect(dispatcher.dispatch(parseKey("j")).kind).toBe("ran")
    expect(count).toBe(1)
  })

  test("supports multi-key sequences", () => {
    let jumped = false
    const keymap = command<{}>({
      keys: ["g g"],
      run: () => {
        jumped = true
      },
    })
    const dispatcher = createDispatcher(keymap, () => ({}))

    expect(dispatcher.dispatch(parseKey("g")).kind).toBe("pending")
    expect(jumped).toBe(false)
    expect(dispatcher.dispatch(parseKey("g")).kind).toBe("ran")
    expect(jumped).toBe(true)
  })

  test("scopes child keymaps", () => {
    let childRan = false
    const child = command<{ active: boolean }>({
      keys: ["return"],
      run: () => {
        childRan = true
      },
    })
    const keymap = Keymap.union(child.scope<{ child: { active: boolean } | null }>((ctx) => ctx.child))
    const dispatcher = createDispatcher(keymap, () => ({ child: null }))

    expect(dispatcher.dispatch(parseKey("return")).kind).toBe("no-match")
    expect(childRan).toBe(false)
  })

  test("help dialog supports selection and executing commands", () => {
    const moves: number[] = []
    let executed = false
    let closed = false
    const ctx: GlobalKeymapCtx = {
      textInputActive: false,
      menu: null,
      helpDialog: {
        commandCount: 2,
        close: () => {
          closed = true
        },
        moveSelection: (delta) => moves.push(delta),
        executeSelected: () => {
          executed = true
        },
      },
      clearTextInput: () => false,
      quit: () => {},
    }
    const dispatcher = createDispatcher(globalKeymap, () => ctx)

    expect(dispatcher.dispatch(parseKey("down")).kind).toBe("ran")
    expect(dispatcher.dispatch(parseKey("tab")).kind).toBe("ran")
    expect(dispatcher.dispatch(parseKey("shift+tab")).kind).toBe("ran")
    expect(dispatcher.dispatch(parseKey("return")).kind).toBe("ran")
    expect(dispatcher.dispatch(parseKey("escape")).kind).toBe("ran")

    expect(moves).toEqual([1, 1, -1])
    expect(executed).toBe(true)
    expect(closed).toBe(true)
  })

  test("menu supports selection and executing items", () => {
    const moves: number[] = []
    const openedMenus: string[] = []
    let executed = false
    let closed = false
    const ctx: GlobalKeymapCtx = {
      textInputActive: false,
      menu: {
        itemCount: 2,
        close: () => {
          closed = true
        },
        openMenu: (menu) => openedMenus.push(menu),
        moveSelection: (delta) => moves.push(delta),
        executeSelected: () => {
          executed = true
        },
      },
      helpDialog: null,
      clearTextInput: () => false,
      quit: () => {},
    }
    const dispatcher = createDispatcher(globalKeymap, () => ctx)

    expect(dispatcher.dispatch(parseKey("down")).kind).toBe("ran")
    expect(dispatcher.dispatch(parseKey("tab")).kind).toBe("ran")
    expect(dispatcher.dispatch(parseKey("shift+tab")).kind).toBe("ran")
    expect(dispatcher.dispatch(parseKey("1")).kind).toBe("ran")
    expect(dispatcher.dispatch(parseKey("2")).kind).toBe("ran")
    expect(dispatcher.dispatch(parseKey("return")).kind).toBe("ran")
    expect(dispatcher.dispatch(parseKey("escape")).kind).toBe("ran")

    expect(moves).toEqual([1, 1, -1])
    expect(openedMenus).toEqual(["actions", "selected"])
    expect(executed).toBe(true)
    expect(closed).toBe(true)
  })

  test("list navigation opens settings and server selector shortcuts", () => {
    const openedMenus: string[] = []
    let openedSettings = false
    const ctx: DashboardKeymapCtx = {
      addSessionDialog: null,
      deleteWorktreeDialog: null,
      promptDialog: null,
      deleteSessionDialog: null,
      interruptSessionDialog: null,
      search: null,
      listNav: {
        tabCount: 0,
        hasSelection: false,
        hasDeletableSelection: false,
        hasInterruptibleSelection: false,
        currentSessionId: undefined,
        halfPage: 1,
        refresh: () => {},
        openAddSession: () => {},
        openDeleteSession: () => {},
        openInterruptSession: () => {},
        executeSelection: () => {},
        openTmux: () => {},
        toggleVisualSelection: () => {},
        toggleSelectedSession: () => {},
        clearMultiSelection: () => false,
        focusSearch: () => {},
        openHelp: () => {},
        openSettings: () => {
          openedSettings = true
        },
        openMenu: (menu) => openedMenus.push(menu),
        selectTab: () => {},
        cycleTab: () => {},
        moveSelection: () => {},
        moveSelectionClamped: () => {},
        moveTop: () => {},
        moveBottom: () => {},
        quit: () => {},
        toggleConsole: () => {},
      },
    }
    const dispatcher = createDispatcher(dashboardPageKeymap, () => ctx)

    expect(dispatcher.dispatch(parseKey("ctrl+s")).kind).toBe("ran")
    expect(dispatcher.dispatch(parseKey("ctrl+p")).kind).toBe("ran")

    expect(openedMenus).toEqual(["servers"])
    expect(openedSettings).toBe(true)
  })

  test("list navigation uses multi-key session actions", () => {
    let deleted = false
    let interrupted = false
    const ctx: DashboardKeymapCtx = {
      addSessionDialog: null,
      deleteWorktreeDialog: null,
      promptDialog: null,
      deleteSessionDialog: null,
      interruptSessionDialog: null,
      search: null,
      listNav: {
        tabCount: 0,
        hasSelection: true,
        hasDeletableSelection: true,
        hasInterruptibleSelection: true,
        currentSessionId: "session-id",
        halfPage: 1,
        refresh: () => {},
        openAddSession: () => {},
        openDeleteSession: () => {
          deleted = true
        },
        openInterruptSession: () => {
          interrupted = true
        },
        executeSelection: () => {},
        openTmux: () => {},
        toggleVisualSelection: () => {},
        toggleSelectedSession: () => {},
        clearMultiSelection: () => false,
        focusSearch: () => {},
        openHelp: () => {},
        openSettings: () => {},
        openMenu: () => {},
        selectTab: () => {},
        cycleTab: () => {},
        moveSelection: () => {},
        moveSelectionClamped: () => {},
        moveTop: () => {},
        moveBottom: () => {},
        quit: () => {},
        toggleConsole: () => {},
      },
    }
    const dispatcher = createDispatcher(dashboardPageKeymap, () => ctx)

    expect(dispatcher.dispatch(parseKey("d")).kind).toBe("pending")
    expect(deleted).toBe(false)
    expect(dispatcher.dispatch(parseKey("d")).kind).toBe("ran")
    expect(deleted).toBe(true)
    expect(dispatcher.dispatch(parseKey("s")).kind).toBe("pending")
    expect(interrupted).toBe(false)
    expect(dispatcher.dispatch(parseKey("s")).kind).toBe("ran")
    expect(interrupted).toBe(true)
  })

  test("add session dialog tabs between input and worktree selector", () => {
    const focus: { current: "input" | "worktree" } = { current: "input" }
    const moves: number[] = []
    let openedDeleteWorktree = false
    let closed = false
    const ctx: DashboardKeymapCtx = {
      addSessionDialog: {
        worktreeCount: 2,
        get focus() {
          return focus.current
        },
        close: () => {
          closed = true
        },
        toggleFocus: () => {
          focus.current = focus.current === "input" ? "worktree" : "input"
        },
        moveWorktree: (delta) => moves.push(delta),
        commitWorktree: () => {
          focus.current = "input"
        },
        canRemoveWorktree: true,
        removeWorktree: () => {
          openedDeleteWorktree = true
        },
      },
      deleteWorktreeDialog: null,
      promptDialog: null,
      deleteSessionDialog: null,
      interruptSessionDialog: null,
      search: null,
      listNav: null,
    }
    const dispatcher = createDispatcher(dashboardPageKeymap, () => ctx)

    expect(dispatcher.dispatch(parseKey("j")).kind).toBe("no-match")
    expect(dispatcher.dispatch(parseKey("tab")).kind).toBe("ran")
    expect(focus.current).toBe("worktree")
    expect(dispatcher.dispatch(parseKey("j")).kind).toBe("ran")
    expect(dispatcher.dispatch(parseKey("down")).kind).toBe("ran")
    expect(dispatcher.dispatch(parseKey("k")).kind).toBe("ran")
    expect(dispatcher.dispatch(parseKey("d")).kind).toBe("pending")
    expect(dispatcher.dispatch(parseKey("d")).kind).toBe("ran")
    expect(dispatcher.dispatch(parseKey("return")).kind).toBe("ran")
    expect(focus.current).toBe("input")
    expect(dispatcher.dispatch(parseKey("tab")).kind).toBe("ran")
    expect(focus.current).toBe("worktree")
    expect(dispatcher.dispatch(parseKey("tab")).kind).toBe("ran")
    expect(focus.current).toBe("input")
    expect(dispatcher.dispatch(parseKey("k")).kind).toBe("no-match")
    expect(dispatcher.dispatch(parseKey("escape")).kind).toBe("ran")

    expect(moves).toEqual([1, 1, -1])
    expect(openedDeleteWorktree).toBe(true)
    expect(closed).toBe(true)
  })

  test("delete worktree dialog uses confirmation shortcuts", () => {
    let confirmed = false
    let closed = false
    const ctx: DashboardKeymapCtx = {
      addSessionDialog: null,
      deleteWorktreeDialog: {
        close: () => {
          closed = true
        },
        confirm: () => {
          confirmed = true
        },
      },
      promptDialog: null,
      deleteSessionDialog: null,
      interruptSessionDialog: null,
      search: null,
      listNav: null,
    }
    const dispatcher = createDispatcher(dashboardPageKeymap, () => ctx)

    expect(dispatcher.dispatch(parseKey("y")).kind).toBe("ran")
    expect(confirmed).toBe(true)
    expect(dispatcher.dispatch(parseKey("escape")).kind).toBe("ran")

    expect(closed).toBe(true)
  })

  test("settings page owns server navigation shortcuts", () => {
    const moves: number[] = []
    let closed = false
    const ctx: SettingsKeymapCtx = {
      settingsPage: {
        serverCount: 2,
        close: () => {
          closed = true
        },
        moveServer: (delta) => moves.push(delta),
      },
    }
    const dispatcher = createDispatcher(settingsPageKeymap, () => ctx)

    expect(dispatcher.dispatch(parseKey("ctrl+p")).kind).toBe("ran")
    expect(dispatcher.dispatch(parseKey("ctrl+n")).kind).toBe("ran")
    expect(dispatcher.dispatch(parseKey("escape")).kind).toBe("ran")

    expect(moves).toEqual([-1, 1])
    expect(closed).toBe(true)
  })

  test("normalizes OpenTUI comma key names", () => {
    expect(
      normalizeOpenTuiKey({ name: "comma", ctrl: true, shift: false, meta: false, option: false } as never),
    ).toEqual({ key: "comma", ctrl: true, shift: false, meta: false })
  })
})
