import type { CommandConfig } from "./command.ts"

export const defaultVerticalKeys = {
  up: ["k", "up", "ctrl+p", "ctrl+k"] as const,
  down: ["j", "down", "ctrl+n", "ctrl+j"] as const,
}

export interface ConfirmModalOptions<C> {
  readonly id: string
  readonly close: (ctx: C) => void
  readonly confirm: {
    readonly title: string
    readonly run: (ctx: C) => void
    readonly enabled?: (ctx: C) => true | string
  }
  readonly cancelTitle?: string
  readonly cancelKeys?: readonly string[]
}

export interface SelectionModalOptions<C> extends ConfirmModalOptions<C> {
  readonly move: (ctx: C, delta: -1 | 1) => void
  readonly verticalKeys?: { readonly up: readonly string[]; readonly down: readonly string[] }
}

export function confirmModalBindings<C>(options: ConfirmModalOptions<C>): readonly CommandConfig<C>[] {
  return [
    {
      id: `${options.id}.cancel`,
      title: options.cancelTitle ?? "Cancel",
      keys: [...(options.cancelKeys ?? ["escape"])],
      run: options.close,
    },
    {
      id: `${options.id}.confirm`,
      title: options.confirm.title,
      keys: ["return"],
      ...(options.confirm.enabled ? { enabled: options.confirm.enabled } : {}),
      run: options.confirm.run,
    },
  ]
}

export function selectionModalBindings<C>(options: SelectionModalOptions<C>): readonly CommandConfig<C>[] {
  return [
    ...confirmModalBindings(options),
    {
      id: `${options.id}.up`,
      title: "Up",
      keys: [...(options.verticalKeys?.up ?? defaultVerticalKeys.up)],
      run: (ctx) => options.move(ctx, -1),
    },
    {
      id: `${options.id}.down`,
      title: "Down",
      keys: [...(options.verticalKeys?.down ?? defaultVerticalKeys.down)],
      run: (ctx) => options.move(ctx, 1),
    },
  ]
}
