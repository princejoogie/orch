import { Effect, Runtime } from "effect"

export type AppEffect<A, E = never, R = never> = Effect.Effect<A, E, R>

const runtime = Runtime.defaultRuntime

export const AppRuntime = {
  runFork: Runtime.runFork(runtime),
  runPromise: Runtime.runPromise(runtime),
  runPromiseExit: Runtime.runPromiseExit(runtime),
}
