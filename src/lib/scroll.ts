export function scrollTopForVisibleLine(currentTop: number, viewportHeight: number, line: number, margin = 1): number {
  const safeViewportHeight = Math.max(1, viewportHeight)
  if (line < currentTop + margin) return Math.max(0, line - margin)
  if (line >= currentTop + safeViewportHeight - margin) {
    return Math.max(0, line - safeViewportHeight + margin + 1)
  }
  return currentTop
}
