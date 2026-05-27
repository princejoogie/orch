# Scrolling

Selection is app-owned and scroll follows selection only when the cursor reaches a viewport margin.

## Core Rule

The list scrollbox in `src/pages/dashboard.tsx` must remain:

```tsx
<scrollbox focusable={false} ... />
```

If the scrollbox is focused, OpenTUI's built-in scroll keybindings will also handle `j`, `k`, arrows, page keys, home, and end. That creates double movement: app selection changes and the scrollbox scrolls independently.

## Scroll Math

`src/lib/scroll.ts` owns the primitive:

```ts
scrollTopForVisibleLine(currentTop, viewportHeight, selectedLine, margin)
```

Behavior:

- If the selected line is inside the top/bottom margins, scroll does not change.
- If the selected line crosses the bottom margin, scroll down enough to keep the margin.
- If the selected line crosses the top margin, scroll up enough to keep the margin.

This is why pressing `j` moves the cursor through visible rows before scrolling.

## Hook

`src/hooks/use-scroll-follow-selected.ts` applies the scroll before paint using `useLayoutEffect`.

It retries while `scroll.viewport.height <= 0` because OpenTUI may not have measured the scrollbox on the first render.

Use this pattern for future app-owned selectable lists:

```ts
const selectedLine = computeSelectedLine(...)
useScrollFollowSelected(scrollRef, selectedLine, margin)
```

## Selected Line Calculation

The dashboard computes a logical row index, not a child renderable coordinate.

Do not use `findDescendantById(...).y` for list follow scrolling. Logical row index + `scrollTopForVisibleLine` is more stable under culling, padding, and layout changes.

## Wheel Scrolling

Mouse wheel remains scrollbox-owned.

- Wheel scroll can move the viewport without changing selection.
- The next keyboard selection change will reassert selected-row visibility.
- Do not sync selection to wheel movement unless we intentionally add pointer-driven selection.

## Tests

`test/scroll.test.ts` locks down the margin behavior. Update it whenever changing scroll math.
