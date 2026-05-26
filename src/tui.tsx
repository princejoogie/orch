import { createCliRenderer, TextAttributes, type SelectOption } from "@opentui/core"
import { createRoot, TimeToFirstDraw, useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react"
import { startTransition, useEffect, useState } from "react"

type AppAction = "status" | "console" | "debug" | "quit"

type ActionOption = SelectOption & {
  value: AppAction
}

const ACTIONS: ActionOption[] = [
  {
    name: "Show status",
    description: "Refresh runtime details and the current working directory",
    value: "status",
  },
  {
    name: "Toggle console",
    description: "OpenTUI's built-in console overlay",
    value: "console",
  },
  {
    name: "Toggle debug overlay",
    description: "Inspect render stats and layout diagnostics",
    value: "debug",
  },
  {
    name: "Quit",
    description: "Destroy the renderer and return to the shell",
    value: "quit",
  },
]

const ACTION_VALUES: ReadonlySet<string> = new Set(ACTIONS.map((action) => action.value))

interface RunTuiOptions {
  args: string[]
}

interface AppProps extends RunTuiOptions {
  startedAt: Date
}

function isAppAction(value: unknown): value is AppAction {
  return typeof value === "string" && ACTION_VALUES.has(value)
}

function formatElapsed(startedAt: Date, now: Date): string {
  const seconds = Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 1000))
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}m ${remainder.toString().padStart(2, "0")}s`
}

function App({ args, startedAt }: AppProps) {
  const renderer = useRenderer()
  const dimensions = useTerminalDimensions()
  const [now, setNow] = useState(() => new Date())
  const [status, setStatus] = useState("Ready. Choose an action or press q to quit.")

  const compact = dimensions.width < 72
  const selectedBackgroundColor = compact ? "#243447" : "#1E3A5F"

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const runAction = (action: AppAction) => {
    switch (action) {
      case "status":
        startTransition(() => {
          setStatus(`Bun ${Bun.version} · ${process.cwd()}`)
        })
        break
      case "console":
        renderer.console.toggle()
        startTransition(() => setStatus("Console overlay toggled."))
        break
      case "debug":
        renderer.toggleDebugOverlay()
        startTransition(() => setStatus("Debug overlay toggled."))
        break
      case "quit":
        renderer.destroy()
        break
    }
  }

  useKeyboard((key) => {
    if (key.ctrl && key.name === "c") {
      key.preventDefault()
      renderer.destroy()
      return
    }

    if (key.name === "escape" || key.name === "q") {
      renderer.destroy()
      return
    }

    if (key.name === "d") {
      runAction("debug")
      return
    }

    if (key.name === "`") {
      runAction("console")
    }
  })

  return (
    <box
      style={{
        width: dimensions.width,
        height: dimensions.height,
        flexDirection: "column",
        backgroundColor: "#071018",
        padding: compact ? 1 : 2,
      }}
    >
      <box style={{ flexDirection: "row", alignItems: "center" }}>
        {compact ? (
          <text content="orch" style={{ fg: "#7DD3FC", attributes: TextAttributes.BOLD }} />
        ) : (
          <ascii-font text="orch" style={{ font: "tiny", color: "#7DD3FC" }} />
        )}
        <text
          content=" OpenTUI React CLI"
          style={{ fg: "#E2E8F0", marginLeft: compact ? 1 : 2, attributes: TextAttributes.BOLD }}
        />
      </box>

      <box
        title="Session"
        titleAlignment="center"
        style={{
          border: true,
          borderColor: "#334155",
          focusedBorderColor: "#38BDF8",
          flexDirection: "column",
          marginTop: 1,
          padding: 1,
        }}
      >
        <text content={`Started: ${startedAt.toLocaleTimeString()} · Uptime: ${formatElapsed(startedAt, now)}`} />
        <text content={`Terminal: ${dimensions.width}x${dimensions.height} · Args: ${args.join(" ") || "none"}`} />
        <text content={status} style={{ fg: "#A7F3D0", marginTop: 1 }} />
      </box>

      <box
        title="Actions"
        bottomTitle="Enter runs · q quits"
        titleAlignment="center"
        bottomTitleAlignment="right"
        style={{
          border: true,
          borderColor: "#475569",
          focusedBorderColor: "#38BDF8",
          flexGrow: 1,
          marginTop: 1,
        }}
      >
        <select
          focused
          options={ACTIONS}
          onSelect={(_, option) => {
            if (isAppAction(option?.value)) {
              runAction(option.value)
            }
          }}
          style={{
            height: "100%",
            backgroundColor: "transparent",
            focusedBackgroundColor: "transparent",
            selectedBackgroundColor,
            selectedTextColor: "#FDE68A",
            descriptionColor: "#94A3B8",
            selectedDescriptionColor: "#CBD5E1",
          }}
          showDescription
          showScrollIndicator
          wrapSelection
          fastScrollStep={3}
        />
      </box>

      <TimeToFirstDraw />
      <text
        content="Keys: ↑/↓ or j/k move · Enter runs · ` console · d debug · q/Esc/Ctrl+C quit"
        style={{ fg: "#94A3B8", marginTop: 1 }}
      />
    </box>
  )
}

export async function runTui(options: RunTuiOptions): Promise<void> {
  let resolveDone = () => {}
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve
  })

  const renderer = await createCliRenderer({
    exitOnCtrlC: false,
    targetFps: 60,
    useKittyKeyboard: {},
    useMouse: true,
    openConsoleOnError: true,
    onDestroy: resolveDone,
  })

  renderer.setBackgroundColor("#071018")
  createRoot(renderer).render(<App {...options} startedAt={new Date()} />)

  await done
}
