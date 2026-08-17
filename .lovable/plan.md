# Templates page: mobile spacing, honest cover previews, mobile polish

## 1. Fix the awkward mobile spacing (the top of the page)

On a 393px phone the headline block currently reserves `60vw` (up to 360px) of
height for two lines of sand type, so there is a large dead band above and below
the wordmark — the area circled in the screenshot.

- Reduce the mobile sand canvas to the size the two lines actually need
  (~`44vw`, min 170px, max 250px); desktop sizing stays as-is.
- Tighten the vertical rhythm below it: Back → headline → deck paragraph →
  meta row → search all step down in even increments instead of the current
  mixed 6/5/4/8 stack.
- Keep the reserved-height behaviour so CLS stays 0 (the canvas still has a
  fixed box, just a correctly-sized one).

## 2. Cover previews stop forcing the Lisbon fixture

In "The table" mode, each cover currently renders the real Lisbon demo
itinerary shrunk to ~25% — unreadable grey mush that also reads as if every
dossier is about Lisbon.

- Extract the abstract cover already used in the compose picker (skin name,
  accent rule, foil edge, wax seal, and Morning / Evening / Night placeholder
  rules drawn from that skin's own tokens) into one shared component.
- Use it for the mobile swipeable cover rail and the desktop atelier-table
  covers, so the table shows dossier *objects*, not a miniature Lisbon page.
- The "Grid" mode cards and the full-page template preview keep the real
  rendered spread — that is where a genuine look at the design belongs.
- No content or data changes; this is presentation only.

## 3. Wider mobile opportunities on this page

- Cover rail: make each cover a comfortable single-hand card, add the
  positional dots + "swipe" hint already present on desktop, and make sure the
  first and last cover can centre (padding, not clipped edges).
- Controls: on phones the result count and the Table/Grid toggle wrap into a
  cramped two-line row — put the toggle on its own line as a proper segmented
  control with 44px targets.
- Filters: keep the tag row swipeable but add a small "N active" affordance so
  filtered state is obvious after scrolling down.
- Bottom clearance: verify the cover rail and grid clear the floating mobile
  nav bar (no content trapped behind the glass pill).
- Motion: every new transition respects `prefers-reduced-motion`.

## Technical notes

- New shared file `src/components/flow/DossierCover.tsx` holding the abstract
  cover; `TemplateCarousel.tsx` and `AtelierTable.tsx` both consume it.
  Per-skin files under `src/lib/skins/*` are untouched (house rule 1).
- `SkinCoverTile` (live scaled render) stays exported and stays in use for the
  grid and preview surfaces.
- Spacing edits are confined to `src/routes/templates.tsx` and the two carousel
  components; base styles are the 375px composition with desktop behind `md:`.
- Finish with `npx vitest run` and a clean `tsc --noEmit`; no new dependencies.
