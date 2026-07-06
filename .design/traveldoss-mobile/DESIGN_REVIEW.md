# Design Review: TravelDoss Mobile — Visitor Path

Reviewed against: `.design/traveldoss-mobile/DESIGN_BRIEF.md`
Philosophy: Dark-Mode Skeuomorphic Revival × Editorial/Magazine ("editorial scale over UI chrome")
Date: 2026-07-05
Method: Playwright (real Chromium, touch + mobile emulation, DPR 2) against the local
dev server; screenshots below; geometry verified by measurement where screenshots
were ambiguous. Review-driven fixes were applied and re-verified during this pass.

## Screenshots Captured

| Screenshot | Breakpoint | Description |
| --- | --- | --- |
| `screenshots/review-landing-mobile-375.png` | 375×812 | Sand hero, one-line banner, chip row |
| `screenshots/review-landing-tablet-768.png` | 768×1024 | Landing mid-breakpoint |
| `screenshots/review-landing-desktop-1280.png` | 1280×800 | Desktop regression reference |
| `screenshots/review-templates-mobile-375.png` | 375×812 | Newsstand tiles (mobile-render previews) |
| `screenshots/review-templates-tablet-768.png` | 768×1024 | Gallery two-up |
| `screenshots/review-templates-desktop-1280.png` | 1280 full-page | Desktop gallery (measured-scale tiles) |
| `screenshots/review-skin-peek-mobile-375.png` | 375×812 | Full-screen rack, mint pinned |
| `screenshots/review-dossier-vertical-mobile-375.png` | 375 full-page | The 80% surface, end to end |
| `screenshots/review-dossier-horizontal-mobile-375.png` | 375×812 | Board view **after** the canvas-cascade fix |
| `screenshots/review-dossier-grid-mobile-375.png` | 375×812 | Grid with panning flights rail |
| `screenshots/review-dossier-vertical-tablet-768.png` | 768×1024 | Tablet vertical |
| `screenshots/review-dossier-vertical-desktop-1280.png` | 1280×800 | Desktop unchanged check |
| `screenshots/review-day-jump-sheet-mobile-375.png` | 375×812 | Days TOC sheet |
| `screenshots/review-view-sheet-mobile-375.png` | 375×812 | Layout sheet |
| `screenshots/review-place-sheet-mobile-375.png` | 375×812 | Acting sheet (Maps/Call/Web/Copy) |
| `screenshots/review-mint-bar-mobile-375.png` | 375×812 | One-bar sample mode |
| `screenshots/review-mint-sheet-mobile-375.png` | 375×812 | Mint takeover, sticky Compose |
| `screenshots/review-dossier-reduced-motion-mobile-375.png` | 375×812 | prefers-reduced-motion render |

> All screenshots in `.design/traveldoss-mobile/screenshots/`.

## Summary

The mobile visitor path now reads as designed-for-touch: one calm bar per surface,
editorial type carrying hierarchy, complexity in sheets, and the newsstand finally
selling skins legibly. The review's screenshot pass caught three real defects that
code inspection and earlier spot-checks had missed — all three were **fixed and
re-verified during this review** (see Must Fix, all closed). Remaining items are
polish-grade.

## Must Fix — all closed during review

1. **Horizontal view was one giant pan surface on phones** *(fixed)*: the legacy
   "VIEW: Horizontal" rules (skin.css ~606) cascade after the top-of-file reset,
   turning `.tds-canvas` into a flex scroller — the flight strip stretched to board
   width (806px) and every value rendered off-screen (labels-only "empty wall").
   Measured: dd at x=427 on a 375 viewport; board 808/808 (not scrolling itself).
   _Fix applied_: mobile-scoped re-assertion of the block reset at the cascade tail;
   board is now the only scroller (343/808). Desktop untouched. See the reshot
   `review-dossier-horizontal-mobile-375.png`.
2. **WCAG 2.5.3 Label-in-Name on the mint CTA** *(fixed)*: visible label "Mint this
   dossier" was overridden by `aria-label="Mint your trip"` — speech-input users
   couldn't target what they read. Caught because the review script itself couldn't
   target it by name. _Fix applied_: aria-label removed; visible text is the name
   (StudioBar.tsx).
3. **Site-wide decorative bubbles floated over dossier content** *(fixed)*:
   `MobileBubbles` mounts globally in `__root.tsx` and drifted across the flight
   card on touch devices (visible in the pre-fix horizontal capture). Atmosphere
   belongs to the funnel, not the paid artifact. _Fix applied_: suppressed on `/t/`
   and `/e2e/` routes with proper listener cleanup.

## Should Fix

1. **Tablet flight fields eye-span**: at 641–860px the label→value gap stretches to
   ~700px (`review-dossier-vertical-tablet-768.png`, CARRIER…TAP row). _Fix: cap
   `.tds-flightstrip-fields` at ~520px max-width inside that media band, or lower
   the 860px breakpoint so the desktop three-column row takes over sooner._
2. **Day-jump landing drift on long trips**: `content-visibility: auto` sections use
   a 720px intrinsic estimate; jumping to a far, unrendered day can land slightly
   off before the browser reflows (also why Day 03 appears as reserved blank space
   in the full-page capture — a capture artifact, not a user-visible bug). _Fix:
   before `scrollIntoView`, force `contentVisibility="visible"` on the target
   section for the jump, or use `scroll-margin` + a post-render correction frame._
3. **iOS keyboard shim unverified on hardware**: the `--kb-inset` visualViewport
   tracking for the sticky Compose footer follows the documented behavior but has
   only been emulator-verified. _Fix: two-minute check on a physical iPhone after
   deploy; fall back to `interactive-widget=resizes-content` in the viewport meta
   if drift appears._

## Could Improve

1. **Peek rack renders all 10 skins eagerly** — fine today (~small DOM), linear cost
   as the registry grows. _Suggestion: `content-visibility: auto` on non-adjacent
   slides, or windowed mounting at 20+ skins._
2. **Decorative micro-labels at `text-ink/35`** (~2.4:1) — pre-existing pattern,
   decorative-only, but worth a pass to `ink/50` where they carry meaning (e.g.
   "10 dossier templates" count).
3. **Lighthouse not formally run** (T14's ≥90 target): structural work is in
   (content-visibility, zero-CLS masthead, transform-only sheets); run against a
   production build during ship. Local dev-server numbers would mislead.
4. **Sample "Preview" badge** now sits below the mobile bar at `top-[4.5rem]` —
   verify against real trips with the archive banner active (three stacked top
   elements is the worst case).

## What Works Well

- **The one-bar budget holds everywhere** — public read shows only the view pill;
  sample mode exactly `[view icon][Mint this dossier]`; the mint takeover pins
  Compose in the thumb zone. No screen has competing bottom chrome
  (`review-mint-bar`, `review-mint-sheet`).
- **The day-jump sheet is the product's best mobile moment**: seal eyebrow, serif
  day labels, today-highlighting — it feels like the dossier, not like chrome
  (`review-day-jump-sheet-mobile-375.png`).
- **Newsstand tiles finally sell the skins**: each tile previews the skin's own
  mobile layout at ~0.85 scale — the "compare chrome like magazines" promise now
  survives a phone (`review-templates-mobile-375.png`), and the measured-scale
  fix repaired desktop's silent right-crop as a bonus.
- **Skins stayed untouched**: every change lives in shared views/CSS/route chrome;
  all ten skins inherit the recomposition (spot-checked Epictetus, Orsino, Cassian
  across tiles/peek/harness).
- **Reduced-motion is genuinely quiet**: sheets jump-cut, masthead fade disabled,
  view switch crossfades (`review-dossier-reduced-motion-mobile-375.png`).

## Checklist Verdicts

| Category | Verdict |
| --- | --- |
| Visual hierarchy | Pass — day chapters + editorial labels carry order; one primary action per screen |
| Consistency | Pass — TdSheet physics identical across 5 contexts; seal = interactive accent throughout |
| Aesthetic fidelity | Pass — reads as the same editorial product as desktop, re-composed not shrunken |
| Component quality | Pass — vaul/shadcn primitives extended, not reimplemented; skins untouched |
| States & interactions | Pass with note — copy-address has done-state; minting has spinner; pre-existing forms untouched |
| Responsive | Pass after Must-fix #1; tablet nit logged (Should-fix #1) |
| Accessibility | Pass after Must-fix #2 — rings, traps, names, aria-current, reduced-motion |
| Typography | Pass — 16px+ body on mobile, display serif clamped, tabular numerals on data |
| Dark mode | N/A by design — single navy theme; skins own their palettes |
| Mobile-first | Pass — mobile base + `md:` desktop layers; no horizontal page scroll at 375 |
