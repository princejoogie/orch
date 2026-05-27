import { type Binding, isBindingActive } from "./binding.ts"
import type { Keymap } from "./keymap.ts"
import type { ParsedStroke } from "./keys.ts"
import {
  type DispatchDecision,
  type DispatchState,
  initialDispatchState,
  pureDispatch,
  type PureDispatchOptions,
  pureTick,
} from "./pure-dispatch.ts"

export type DispatchResult<C> = DispatchDecision<C>

export interface Clock {
  now(): number
  setTimeout(fn: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
}

export interface DispatcherOptions extends PureDispatchOptions {
  readonly clock?: Clock
  readonly onCollision?: (sequence: readonly ParsedStroke[], bindings: readonly Binding<unknown>[]) => void
}

export interface Dispatcher<C> {
  readonly dispatch: (stroke: ParsedStroke) => DispatchResult<C>
  readonly runById: (id: string) => DispatchResult<C>
  readonly getState: () => DispatchState
  readonly getPending: () => readonly ParsedStroke[]
  readonly clearPending: () => void
  readonly onStateChange: (listener: (state: DispatchState) => void) => () => void
}

const defaultClock: Clock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>),
}

export function createDispatcher<C>(
  keymap: Keymap<C>,
  getContext: () => C,
  options: DispatcherOptions = {},
): Dispatcher<C> {
  const clock = options.clock ?? defaultClock
  const onCollision = options.onCollision
  let state = initialDispatchState
  let timer: unknown = null
  const listeners = new Set<(state: DispatchState) => void>()

  const clearTimer = () => {
    if (timer === null) return
    clock.clearTimeout(timer)
    timer = null
  }

  const reschedule = () => {
    clearTimer()
    if (state.timeoutAt === null) return
    const delay = Math.max(0, state.timeoutAt - clock.now())
    timer = clock.setTimeout(() => {
      timer = null
      const ctx = getContext()
      const { state: next, decision } = pureTick(keymap, state, ctx, clock.now())
      updateState(next)
      if (decision?.kind === "ran") decision.binding.action(ctx)
    }, delay)
  }

  const updateState = (next: DispatchState) => {
    if (next === state) return
    state = next
    for (const listener of listeners) listener(state)
    reschedule()
  }

  const detectCollision = (sequence: readonly ParsedStroke[], ctx: C) => {
    if (!onCollision) return
    const matches = keymap.bindings.filter((binding) => {
      if (isBindingActive(binding, ctx) !== true) return false
      return (
        binding.sequence.length === sequence.length &&
        binding.sequence.every((stroke, index) => {
          const candidate = sequence[index]!
          return (
            stroke.key === candidate.key &&
            stroke.ctrl === candidate.ctrl &&
            stroke.shift === candidate.shift &&
            stroke.meta === candidate.meta
          )
        })
      )
    })
    if (matches.length > 1) onCollision(sequence, matches as readonly Binding<unknown>[])
  }

  return {
    dispatch: (stroke) => {
      const ctx = getContext()
      const { state: next, decision } = pureDispatch(keymap, state, stroke, ctx, clock.now(), options)
      updateState(next)
      if (decision.kind === "ran") {
        detectCollision(decision.binding.sequence, ctx)
        decision.binding.action(ctx)
      }
      return decision
    },
    runById: (id) => {
      const ctx = getContext()
      const binding = keymap.bindings.find((candidate) => candidate.meta?.id === id)
      if (!binding) return { kind: "no-match" }
      const status = isBindingActive(binding, ctx)
      if (status === true) {
        binding.action(ctx)
        return { kind: "ran", binding }
      }
      return { kind: "disabled", binding, reason: status }
    },
    getState: () => state,
    getPending: () => state.pending,
    clearPending: () => updateState(initialDispatchState),
    onStateChange: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
