# Scrolling

Selection is app-owned and scroll follows selection only when the cursor reaches a viewport margin.

## Core Rule

Selectable lists with app-owned navigation render their scrollbox without renderer focus:

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

List follow scrolling uses logical row indexes. Logical row index + `scrollTopForVisibleLine` is stable under culling, padding, and layout changes because it does not depend on child renderable coordinates.

The selected entry can be a lane title or a session row. Selected sessions are anchored by the session `id` returned from opencode. When polling or activity changes reorder rows, the dashboard resolves that `id` back to the row's current section and index before rendering selection or computing the selected line. Collapsed lanes keep their title selectable and omit hidden session rows from the logical line count.

## Wheel Scrolling

Mouse wheel remains scrollbox-owned.

- Wheel scroll can move the viewport without changing selection.
- The next keyboard selection change will reassert selected-row visibility.
- Selection follows explicit keyboard or pointer selection actions; wheel movement alone changes only the viewport.

## Tests

`test/scroll.test.ts` locks down the margin behavior. Update it whenever changing scroll math.
