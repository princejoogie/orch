import { useEffect, useMemo, useRef } from "react"
import { createDispatcher, type Dispatcher, type DispatcherOptions } from "./dispatcher.ts"
import type { Keymap } from "./keymap.ts"
import type { ParsedStroke } from "./keys.ts"

export type KeySubscribe = (handler: (stroke: ParsedStroke) => boolean | void) => () => void

export function useKeymap<C>(
  keymap: Keymap<C>,
  ctx: C,
  subscribe: KeySubscribe,
  options?: DispatcherOptions,
): Dispatcher<C> {
  const ctxRef = useRef(ctx)
  ctxRef.current = ctx

  const dispatcher = useMemo(
    () => createDispatcher(keymap, () => ctxRef.current, options),
    // options are treated as creation-time config, matching ghui's adapter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [keymap],
  )

  useEffect(() => subscribe((stroke) => dispatcher.dispatch(stroke).kind !== "no-match"), [dispatcher, subscribe])

  return dispatcher
}
