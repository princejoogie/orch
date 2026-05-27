import type { ParsedStroke } from "./keys.ts"

export type Enabled = true | false | string

export interface BindingMeta {
  readonly id?: string
  readonly title?: string
  readonly description?: string
  readonly group?: string
  readonly keywords?: readonly string[]
}

export interface Binding<C> {
  readonly sequence: readonly ParsedStroke[]
  readonly when?: (ctx: C) => boolean
  readonly enabled?: (ctx: C) => Enabled
  readonly action: (ctx: C) => void
  readonly meta?: BindingMeta
}

export type Command<C> = Binding<C> & {
  readonly meta: BindingMeta & { readonly id: string; readonly title: string }
}

export function isCommand<C>(binding: Binding<C>): binding is Command<C> {
  return binding.meta?.id !== undefined && binding.meta.title !== undefined
}

export function isBindingActive<C>(binding: Binding<C>, ctx: C): true | string {
  if (binding.when && !binding.when(ctx)) return "out of scope"
  const enabled = binding.enabled?.(ctx) ?? true
  if (enabled === true) return true
  if (enabled === false) return "disabled"
  return enabled
}
