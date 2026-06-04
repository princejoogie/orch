import { shortcutHintLine } from "../lib/utils.ts"
import { theme } from "../theme.ts"
import { mouseAction } from "./ui/button.tsx"

export function SidebarSettingsButton({ width, onPress }: { width: number; onPress: () => void }) {
  return (
    <box
      style={{ flexShrink: 0, height: 1, width }}
      onMouseDown={(event) => {
        mouseAction(event)
        onPress()
      }}
    >
      <text
        content={shortcutHintLine("Settings", "[^p]", width)}
        style={{ fg: theme.textMuted, bg: theme.backgroundElement }}
      />
    </box>
  )
}
