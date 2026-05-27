import { describe, expect, test } from "bun:test"
import { scrollTopForVisibleLine } from "../src/lib/scroll.ts"

describe("scrollTopForVisibleLine", () => {
  test("does not scroll while line is inside the viewport margins", () => {
    expect(scrollTopForVisibleLine(10, 20, 15, 3)).toBe(10)
    expect(scrollTopForVisibleLine(10, 20, 26, 3)).toBe(10)
  })

  test("scrolls down only when the line crosses the lower margin", () => {
    expect(scrollTopForVisibleLine(10, 20, 27, 3)).toBe(11)
    expect(scrollTopForVisibleLine(10, 20, 35, 3)).toBe(19)
  })

  test("scrolls up only when the line crosses the upper margin", () => {
    expect(scrollTopForVisibleLine(10, 20, 13, 3)).toBe(10)
    expect(scrollTopForVisibleLine(10, 20, 11, 3)).toBe(8)
  })
})
