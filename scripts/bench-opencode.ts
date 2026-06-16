import { performance } from "node:perf_hooks"
import { Effect } from "effect"
import { AppRuntime } from "../src/effect/app-runtime.ts"
import { getSessions, opencodeServerUrl } from "../src/opencode/client/index.ts"

const iterations = Number(Bun.argv.find((arg) => arg.startsWith("--iterations="))?.split("=")[1] ?? 20)
const limit = Number(Bun.argv.find((arg) => arg.startsWith("--limit="))?.split("=")[1] ?? 300)
const serverUrl = opencodeServerUrl()

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))] ?? 0
}

function report(name: string, values: number[]) {
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length
  console.log(
    `${name}: avg=${avg.toFixed(2)}ms p50=${percentile(values, 0.5).toFixed(2)}ms p95=${percentile(values, 0.95).toFixed(2)}ms`,
  )
}

const program = Effect.gen(function* () {
  const snapshotTimes: number[] = []
  let rows = 0

  for (let i = 0; i < iterations; i += 1) {
    const started = performance.now()
    // Sequential on purpose: benchmark repeated polling cost, not parallel throughput.
    const snapshot = yield* getSessions({ limit })
    rows = snapshot.rows.length
    snapshotTimes.push(performance.now() - started)
  }

  console.log(`server=${serverUrl}`)
  console.log(`iterations=${iterations} limit=${limit} rows=${rows}`)
  report("snapshot", snapshotTimes)
})

await AppRuntime.runPromise(program)
