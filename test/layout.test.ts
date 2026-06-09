import { describe, expect, test } from "bun:test"
import {
  centeredTopWithinScreen,
  preferredPromptSessionBodyHeight,
  promptSessionBodyLayout,
  topWithinScreen,
} from "../src/lib/layout.ts"

describe("topWithinScreen", () => {
  test("keeps a top value that fits", () => {
    expect(topWithinScreen(4, 5, 12)).toBe(4)
  })

  test("moves up by the overflow amount", () => {
    expect(topWithinScreen(8, 6, 12)).toBe(6)
  })

  test("does not move above the screen", () => {
    expect(topWithinScreen(1, 12, 8)).toBe(0)
  })
})

describe("centeredTopWithinScreen", () => {
  test("centers while preserving the bottom edge", () => {
    expect(centeredTopWithinScreen(20, 8)).toBe(6)
    expect(centeredTopWithinScreen(8, 8)).toBe(0)
  })
})

describe("promptSessionBodyLayout", () => {
  test("uses the preferred message and input heights when space allows", () => {
    expect(preferredPromptSessionBodyHeight(false)).toBe(34)
    expect(promptSessionBodyLayout(34, false)).toEqual({
      historyLabelHeight: 1,
      historyHeight: 24,
      historyMarginBottom: 1,
      inputHeight: 5,
      selectorFooterHeight: 1,
    })
  })

  test("shrinks the message list before the input", () => {
    expect(promptSessionBodyLayout(13, false)).toEqual({
      historyLabelHeight: 1,
      historyHeight: 3,
      historyMarginBottom: 1,
      inputHeight: 5,
      selectorFooterHeight: 1,
    })
  })

  test("collapses messages and then shrinks input on very short bodies", () => {
    expect(promptSessionBodyLayout(6, false)).toEqual({
      historyLabelHeight: 0,
      historyHeight: 0,
      historyMarginBottom: 0,
      inputHeight: 3,
      selectorFooterHeight: 1,
    })
  })
})
