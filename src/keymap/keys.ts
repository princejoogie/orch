import { Data } from "effect"

export interface ParsedStroke {
  readonly key: string
  readonly ctrl: boolean
  readonly shift: boolean
  readonly meta: boolean
}

const MODIFIERS = new Set(["ctrl", "shift", "meta"])

export class KeyParseError extends Data.TaggedError("KeyParseError")<{
  readonly message: string
  readonly input: string
}> {}

export function parseKey(input: string): ParsedStroke {
  const parts = input
    .split("+")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
  if (parts.length === 0) throw new KeyParseError({ message: `Empty key string: ${JSON.stringify(input)}`, input })

  const key = parts[parts.length - 1]!
  const mods = new Set(parts.slice(0, -1))
  for (const mod of mods) {
    if (!MODIFIERS.has(mod)) {
      throw new KeyParseError({ message: `Unknown modifier ${JSON.stringify(mod)} in ${JSON.stringify(input)}`, input })
    }
  }

  return { key, ctrl: mods.has("ctrl"), shift: mods.has("shift"), meta: mods.has("meta") }
}

export function parseBinding(input: string): readonly ParsedStroke[] {
  return input.trim().split(/\s+/).filter(Boolean).map(parseKey)
}

export function strokeMatches(left: ParsedStroke, right: ParsedStroke): boolean {
  return left.key === right.key && left.ctrl === right.ctrl && left.shift === right.shift && left.meta === right.meta
}

export function sequenceMatches(left: readonly ParsedStroke[], right: readonly ParsedStroke[]): boolean {
  return left.length === right.length && left.every((stroke, index) => strokeMatches(stroke, right[index]!))
}

export function sequenceStartsWith(sequence: readonly ParsedStroke[], prefix: readonly ParsedStroke[]): boolean {
  return prefix.length <= sequence.length && prefix.every((stroke, index) => strokeMatches(stroke, sequence[index]!))
}
