import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { DashboardPage } from "./pages/dashboard.tsx"

interface RunTuiOptions {
  args: string[]
}

export async function runTui(_options: RunTuiOptions): Promise<void> {
  let resolveDone = () => {}
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve
  })

  const renderer = await createCliRenderer({
    exitOnCtrlC: false,
    targetFps: 30,
    useKittyKeyboard: {},
    useMouse: true,
    openConsoleOnError: true,
    onDestroy: resolveDone,
  })

  renderer.setBackgroundColor("#000000")
  const queryClient = new QueryClient()
  createRoot(renderer).render(
    <QueryClientProvider client={queryClient}>
      <DashboardPage />
    </QueryClientProvider>,
  )

  await done
}
