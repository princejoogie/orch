export function topWithinScreen(top: number, height: number, screenHeight: number): number {
  const overflow = top + height - screenHeight
  if (overflow <= 0) return top
  return Math.max(0, top - overflow)
}

export function centeredTopWithinScreen(screenHeight: number, height: number): number {
  return topWithinScreen(Math.max(1, Math.floor((screenHeight - height) / 2)), height, screenHeight)
}

export type PromptSessionBodyLayout = {
  historyLabelHeight: number
  historyHeight: number
  historyMarginBottom: number
  inputHeight: number
  selectorFooterHeight: number
}

const PROMPT_HISTORY_MAX_HEIGHT = 24
const PROMPT_HISTORY_LABEL_HEIGHT = 1
const PROMPT_HISTORY_MARGIN_BOTTOM = 1
const PROMPT_INPUT_PREFERRED_HEIGHT = 5
const PROMPT_TEXTAREA_BORDER_HEIGHT = 2
const PROMPT_SELECTOR_FOOTER_HEIGHT = 1
const PROMPT_INPUT_PREFERRED_BLOCK_HEIGHT =
  PROMPT_INPUT_PREFERRED_HEIGHT + PROMPT_TEXTAREA_BORDER_HEIGHT + PROMPT_SELECTOR_FOOTER_HEIGHT
const PROMPT_HISTORY_PREFERRED_SECTION_HEIGHT =
  PROMPT_HISTORY_LABEL_HEIGHT + PROMPT_HISTORY_MAX_HEIGHT + PROMPT_HISTORY_MARGIN_BOTTOM

export function preferredPromptSessionBodyHeight(hasError: boolean): number {
  return PROMPT_HISTORY_PREFERRED_SECTION_HEIGHT + PROMPT_INPUT_PREFERRED_BLOCK_HEIGHT + (hasError ? 1 : 0)
}

export function promptSessionBodyLayout(bodyHeight: number, hasError: boolean): PromptSessionBodyLayout {
  const availableHeight = Math.max(0, bodyHeight - (hasError ? 1 : 0))
  const inputBlockHeight = Math.min(PROMPT_INPUT_PREFERRED_BLOCK_HEIGHT, availableHeight)
  const selectorFooterHeight =
    inputBlockHeight >= PROMPT_TEXTAREA_BORDER_HEIGHT + 1 + PROMPT_SELECTOR_FOOTER_HEIGHT
      ? PROMPT_SELECTOR_FOOTER_HEIGHT
      : 0
  const inputHeight = Math.max(0, inputBlockHeight - PROMPT_TEXTAREA_BORDER_HEIGHT - selectorFooterHeight)
  const historySectionHeight = Math.min(
    PROMPT_HISTORY_PREFERRED_SECTION_HEIGHT,
    Math.max(0, availableHeight - inputBlockHeight),
  )
  const historyLabelHeight =
    historySectionHeight >= PROMPT_HISTORY_LABEL_HEIGHT + 1 + PROMPT_HISTORY_MARGIN_BOTTOM
      ? PROMPT_HISTORY_LABEL_HEIGHT
      : 0
  const historyMarginBottom = historyLabelHeight > 0 ? PROMPT_HISTORY_MARGIN_BOTTOM : 0
  const historyHeight = Math.max(0, historySectionHeight - historyLabelHeight - historyMarginBottom)

  return { historyLabelHeight, historyHeight, historyMarginBottom, inputHeight, selectorFooterHeight }
}
