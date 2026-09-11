# Layout switcher sand refinements

## Goal
Make the layout switcher's drifting sand border react in the outward direction and replace the remaining pink outline with a gold tone that complements the champagne sand.

## Changes

1. **Reverse the sand magnet direction** in `src/components/flow/SandBorder.tsx`
   - Current code pulls grains toward the cursor (`tx = (dx/len) * force`).
   - Change to a repulsive/outward force: `tx = -(dx/len) * force`, `ty = -(dy/len) * force`.
   - Update the comment to describe the outward bulge.

2. **Replace the pink shell border** in `src/styles.css` (`.td-sand-shell`)
   - Swap the sunset-pink gradient stops and shadow for the existing `seal` champagne-gold token.
   - Keep the graphite lower-left to gold top-right direction so the shell still has a subtle metallic glow.

## Verification
- `npx tsgo --noEmit` clean.
- `bun test src tests` passes (or matches the current baseline).
- Manual preview hover over the layout switcher shows grains bulging outward and no pink in the border.
