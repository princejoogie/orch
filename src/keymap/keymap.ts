import { type Binding, type Command, isBindingActive, isCommand } from "./binding.ts"
import { type ParsedStroke, parseBinding } from "./keys.ts"

function liftBinding<C, C2>(binding: Binding<C>, project: (ctx: C2) => C): Binding<C2> {
  return {
    sequence: binding.sequence,
    ...(binding.when ? { when: (ctx: C2) => binding.when!(project(ctx)) } : {}),
    ...(binding.enabled ? { enabled: (ctx: C2) => binding.enabled!(project(ctx)) } : {}),
    action: (ctx) => binding.action(project(ctx)),
    ...(binding.meta ? { meta: binding.meta } : {}),
  }
}

function liftBindingScope<C, C2>(binding: Binding<C>, project: (ctx: C2) => C | null | undefined | false): Binding<C2> {
  const inScope = (ctx: C2): C | null => {
    const projected = project(ctx)
    return projected === null || projected === undefined || projected === false ? null : projected
  }

  return {
    sequence: binding.sequence,
    when: (ctx: C2) => {
      const projected = inScope(ctx)
      if (projected === null) return false
      return binding.when ? binding.when(projected) : true
    },
    ...(binding.enabled
      ? {
          enabled: (ctx: C2) => {
            const projected = inScope(ctx)
            if (projected === null) return false
            return binding.enabled!(projected)
          },
        }
      : {}),
    action: (ctx: C2) => {
      const projected = inScope(ctx)
      if (projected !== null) binding.action(projected)
    },
    ...(binding.meta ? { meta: binding.meta } : {}),
  }
}

export class Keymap<C> {
  readonly bindings: readonly Binding<C>[]

  constructor(bindings: readonly Binding<C>[]) {
    this.bindings = bindings
  }

  static empty<C>(): Keymap<C> {
    return new Keymap<C>([])
  }

  static of<C>(...bindings: readonly Binding<C>[]): Keymap<C> {
    return new Keymap<C>(bindings)
  }

  static union<C>(...keymaps: readonly Keymap<C>[]): Keymap<C> {
    return new Keymap<C>(keymaps.flatMap((keymap) => keymap.bindings))
  }

  union(...keymaps: readonly Keymap<C>[]): Keymap<C> {
    return Keymap.union(this, ...keymaps)
  }

  contramap<C2>(project: (ctx: C2) => C): Keymap<C2> {
    return new Keymap<C2>(this.bindings.map((binding) => liftBinding(binding, project)))
  }

  lift<C2>(project: (ctx: C2) => C): Keymap<C2> {
    return this.contramap(project)
  }

  scope<C2>(project: (ctx: C2) => C | null | undefined | false): Keymap<C2> {
    return new Keymap<C2>(this.bindings.map((binding) => liftBindingScope(binding, project)))
  }

  restrict(predicate: (ctx: C) => boolean): Keymap<C> {
    return new Keymap<C>(
      this.bindings.map((binding) => ({
        ...binding,
        when: binding.when ? (ctx: C) => predicate(ctx) && binding.when!(ctx) : predicate,
      })),
    )
  }

  prefix(stroke: string | ParsedStroke): Keymap<C> {
    const prefix = typeof stroke === "string" ? parseBinding(stroke) : [stroke]
    return new Keymap<C>(this.bindings.map((binding) => ({ ...binding, sequence: [...prefix, ...binding.sequence] })))
  }

  filter(predicate: (binding: Binding<C>) => boolean): Keymap<C> {
    return new Keymap<C>(this.bindings.filter(predicate))
  }

  active(ctx: C): readonly Binding<C>[] {
    return this.bindings.filter((binding) => isBindingActive(binding, ctx) === true)
  }

  commands(ctx: C): readonly Command<C>[] {
    return this.bindings.filter(
      (binding): binding is Command<C> => isBindingActive(binding, ctx) === true && isCommand(binding),
    )
  }
}
