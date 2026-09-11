# Share button double border

## Goal
Give the dossier Share button a double-ring border that matches the reference: a subtle inner border plus a matching outer ring with a small gap between them.

## Changes

1. **Update `src/components/studio/SharedDossierCard.tsx`**
   - Keep the existing `border border-white/15` as the inner ring.
   - Add an outer ring using `outline outline-1 outline-white/15 outline-offset-[3px]` (or a wrapper span with equivalent padding) so the button reads as two concentric rounded borders.
   - Preserve the existing hover/focus states, icon, text, tap target size, and print-hide behavior.

## Verification
- `npx tsgo --noEmit` clean.
- `bun test src tests` matches current baseline.
- Screenshot of the dossier top-right Share button shows two visible rings.
