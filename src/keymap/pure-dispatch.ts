import { type Binding, isBindingActive } from "./binding.ts"
import type { Keymap } from "./keymap.ts"
import { type ParsedStroke, sequenceMatches, sequenceStartsWith } from "./keys.ts"

export interface DispatchState {
  readonly pending: readonly ParsedStroke[]
  readonly timeoutAt: number | null
}

export const initialDispatchState: DispatchState = { pending: [], timeoutAt: null }

export type DispatchDecision<C> =
  | { readonly kind: "ran"; readonly binding: Binding<C> }
  | { readonly kind: "pending"; readonly sequence: readonly ParsedStroke[] }
  | { readonly kind: "disabled"; readonly binding: Binding<C>; readonly reason: string }
  | { readonly kind: "no-match" }

export interface PureDispatchOptions {
  readonly disambiguationTimeoutMs?: number
}

function findMatches<C>(bindings: readonly Binding<C>[], sequence: readonly ParsedStroke[], ctx: C) {
  const exact: Binding<C>[] = []
  const continuing: Binding<C>[] = []

  for (const binding of bindings) {
    if (binding.sequence.length === 0) continue
    const status = isBindingActive(binding, ctx)
    const visible =
      status === true || (typeof status === "string" && status !== "out of scope" && status !== "disabled")
    if (!visible) continue
    if (sequenceMatches(binding.sequence, sequence)) exact.push(binding)
    else if (sequenceStartsWith(binding.sequence, sequence)) continuing.push(binding)
  }

  return { exact, continuing }
}

function decide<C>(binding: Binding<C>, ctx: C): DispatchDecision<C> {
  const status = isBindingActive(binding, ctx)
  if (status === true) return { kind: "ran", binding }
  return { kind: "disabled", binding, reason: status }
}

export function pureDispatch<C>(
  keymap: Keymap<C>,
  state: DispatchState,
  stroke: ParsedStroke,
  ctx: C,
  now: number,
  options: PureDispatchOptions = {},
): { readonly state: DispatchState; readonly decision: DispatchDecision<C> } {
  const timeoutMs = options.disambiguationTimeoutMs ?? 500
  const next = [...state.pending, stroke]
  const { exact, continuing } = findMatches(keymap.bindings, next, ctx)

  if (exact.length === 0 && continuing.length === 0) {
    if (state.pending.length === 0) return { state: initialDispatchState, decision: { kind: "no-match" } }
    return pureDispatch(keymap, initialDispatchState, stroke, ctx, now, options)
  }

  if (exact.length > 0 && continuing.length === 0) {
    return { state: initialDispatchState, decision: decide(exact[0]!, ctx) }
  }

  return { state: { pending: next, timeoutAt: now + timeoutMs }, decision: { kind: "pending", sequence: next } }
}

export function pureTick<C>(
  keymap: Keymap<C>,
  state: DispatchState,
  ctx: C,
  now: number,
): { readonly state: DispatchState; readonly decision: DispatchDecision<C> | null } {
  if (state.timeoutAt === null || now < state.timeoutAt) return { state, decision: null }
  if (state.pending.length === 0) return { state: initialDispatchState, decision: null }

  const { exact } = findMatches(keymap.bindings, state.pending, ctx)
  if (exact.length === 0) return { state: initialDispatchState, decision: { kind: "no-match" } }
  return { state: initialDispatchState, decision: decide(exact[0]!, ctx) }
}
