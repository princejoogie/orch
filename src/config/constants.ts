import type { SessionRow } from "../opencode.ts"
import { theme } from "../theme.ts"

export const POLL_INTERVAL_MS = 2_000
export const APP_PADDING_X = 2
export const APP_PADDING_Y = 1
export const SIDEBAR_BACKGROUND = theme.backgroundPanel
export const TOP_BAR_BACKGROUND = "#252525"
export const SIDEBAR_PADDING_X = 2
export const SIDEBAR_PADDING_Y = 1
export const TOP_BAR_HEIGHT = 1
export const TABLE_HEADER_HEIGHT = 2
export const SIDEBAR_MIN_WIDTH = 24
export const SIDEBAR_MAX_WIDTH = 36
export const SIDEBAR_WIDTH_RATIO = 0.28
export const MAIN_PANEL_MIN_WIDTH = 40
export const SELECTION_SCROLL_EDGE_OFFSET = 3
export const DOUBLE_CLICK_MS = 500
export const EMPTY_SESSION_ROWS: SessionRow[] = []
