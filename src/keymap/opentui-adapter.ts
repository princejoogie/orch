import type { KeyEvent } from "@opentui/core"
import { useKeyboard } from "@opentui/react"
import { useMemo, useRef } from "react"
import type { ParsedStroke } from "./keys.ts"
import type { KeySubscribe } from "./react.ts"

function normalizeKeyName(name: string): string {
  const key = name.toLowerCase()
  return key === "enter" ? "return" : key
}

export function normalizeOpenTuiKey(event: KeyEvent): ParsedStroke {
  return {
    key: normalizeKeyName(event.name),
    ctrl: event.ctrl,
    shift: event.shift,
    meta: event.meta || event.option,
  }
}

export function useOpenTuiSubscribe(): KeySubscribe {
  const handlersRef = useRef<Set<(stroke: ParsedStroke) => boolean | void>>(new Set())

  useKeyboard((event) => {
    const keyEvent = event as KeyEvent
    if (keyEvent.defaultPrevented) return

    const stroke = normalizeOpenTuiKey(keyEvent)
    let handled = false
    for (const handler of handlersRef.current) {
      if (handler(stroke)) handled = true
    }
    if (handled) keyEvent.preventDefault()
  })

  return useMemo(
    () => (handler) => {
      handlersRef.current.add(handler)
      return () => {
        handlersRef.current.delete(handler)
      }
    },
    [],
  )
}
