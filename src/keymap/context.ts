import { command, type CommandConfig } from "./command.ts"
import { Keymap } from "./keymap.ts"

export type ContextItem<C> = CommandConfig<C> | Keymap<C>

export interface Context<C> {
  (...items: readonly ContextItem<C>[]): Keymap<C>
}

function isKeymap<C>(item: ContextItem<C>): item is Keymap<C> {
  return item instanceof Keymap
}

export function context<C>(): Context<C> {
  return (...items) => Keymap.union(...items.map((item) => (isKeymap(item) ? item : command(item))))
}
