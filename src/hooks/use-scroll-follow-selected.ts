import type { ScrollBoxRenderable } from "@opentui/core"
import { useLayoutEffect, type RefObject } from "react"
import { scrollTopForVisibleLine } from "../lib/scroll.ts"

const MAX_SCROLL_MEASURE_ATTEMPTS = 20

export function useScrollFollowSelected(
  scrollRef: RefObject<ScrollBoxRenderable | null>,
  selectedLine: number | null,
  margin: number,
): void {
  useLayoutEffect(() => {
    const scroll = scrollRef.current
    if (!scroll || selectedLine === null) return

    let cancelled = false
    let attempts = 0
    const apply = () => {
      if (cancelled) return
      const viewportHeight = scroll.viewport.height
      if (viewportHeight <= 0) {
        if (attempts++ < MAX_SCROLL_MEASURE_ATTEMPTS) globalThis.setTimeout(apply, 16)
        return
      }

      const nextTop = scrollTopForVisibleLine(scroll.scrollTop, viewportHeight, selectedLine, margin)
      if (nextTop !== scroll.scrollTop) scroll.scrollTo({ x: 0, y: nextTop })
    }

    apply()
    return () => {
      cancelled = true
    }
  }, [margin, scrollRef, selectedLine])
}
