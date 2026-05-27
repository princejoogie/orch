import { describe, expect, test } from "bun:test"
import { command } from "../src/keymap/command.ts"
import { dashboardKeymap, type DashboardKeymapCtx } from "../src/keymap/dashboard.ts"
import { createDispatcher } from "../src/keymap/dispatcher.ts"
import { Keymap } from "../src/keymap/keymap.ts"
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
    const ctx: DashboardKeymapCtx = {
      textInputActive: false,
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
      addSessionDialog: null,
      promptDialog: null,
      deleteSessionDialog: null,
      search: null,
      listNav: null,
      quit: () => {},
    }
    const dispatcher = createDispatcher(dashboardKeymap, () => ctx)

    expect(dispatcher.dispatch(parseKey("down")).kind).toBe("ran")
    expect(dispatcher.dispatch(parseKey("return")).kind).toBe("ran")
    expect(dispatcher.dispatch(parseKey("escape")).kind).toBe("ran")

    expect(moves).toEqual([1])
    expect(executed).toBe(true)
    expect(closed).toBe(true)
  })
})
