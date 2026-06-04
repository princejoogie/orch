import { TextAttributes } from "@opentui/core"
import { TOP_BAR_HEIGHT } from "../config/constants.ts"
import { useDashboardControllerContext } from "../hooks/use-dashboard-controller.tsx"
import { type Toast as ToastState, useGlobalStore } from "../store/global.ts"
import { theme } from "../theme.ts"
import { mouseAction } from "./ui/button.tsx"
import { TextLine, fitCell } from "./ui/dialog.tsx"

const LOADING_FRAMES = ["|", "/", "-", "\\"] as const

export function Toast({ screenWidth }: { screenWidth: number }) {
  const controller = useDashboardControllerContext()
  const globalStore = useGlobalStore()
  const width = Math.min(42, Math.max(24, screenWidth - 4))
  const left = Math.max(1, screenWidth - width - 2)

  return (
    <box style={{ position: "absolute", zIndex: 30, left, top: TOP_BAR_HEIGHT + 1, width, flexDirection: "column" }}>
      {globalStore.toasts.map((toast) => (
        <ToastView
          key={toast.id}
          toast={toast}
          width={width}
          now={controller.now}
          onDismiss={() => globalStore.dismissToast(toast.id)}
        />
      ))}
    </box>
  )
}

function ToastView({
  toast,
  width,
  now,
  onDismiss,
}: {
  toast: ToastState
  width: number
  now: Date
  onDismiss: () => void
}) {
  const statusColor = toast.status === "loading" ? theme.info : toast.status === "success" ? theme.success : theme.error
  const statusText =
    toast.status === "loading"
      ? (LOADING_FRAMES[Math.floor(now.getTime() / 120) % LOADING_FRAMES.length] ?? "|")
      : toast.status === "success"
        ? "ok"
        : "err"
  const contentWidth = Math.max(1, width - 2)

  return (
    <box
      style={{
        flexDirection: "column",
        width,
        marginBottom: 1,
        backgroundColor: theme.backgroundPanel,
        border: true,
        borderColor: toast.status === "loading" ? theme.info : theme.border,
      }}
      onMouseDown={(event) => {
        mouseAction(event)
        if (toast.status !== "loading") onDismiss()
      }}
    >
      <TextLine width={contentWidth} bg={theme.backgroundElement}>
        <span fg={statusColor} attributes={TextAttributes.BOLD}>{` ${statusText} `}</span>
        <span fg={theme.text} attributes={TextAttributes.BOLD}>
          {fitCell(toast.title, Math.max(1, contentWidth - statusText.length - 4))}
        </span>
      </TextLine>
      {toast.detail ? (
        <TextLine width={contentWidth} bg={theme.backgroundPanel}>
          <span fg={theme.textMuted}>{fitCell(` ${toast.detail}`, contentWidth)}</span>
        </TextLine>
      ) : null}
    </box>
  )
}
