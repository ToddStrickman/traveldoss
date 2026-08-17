# Compose flow: template gate, top bar, mode bar

## What's wrong today

Tapping Compose in the mobile bar calls `openDock("paste")`, which silently
defaults the template to the first entry in the skin registry and drops you
straight into the intake modal. You never choose a dossier design — which is the
whole point of the product. The modal itself opens with a tall letterhead block
(eyebrow, headline, sub-line) that eats most of a 393px-wide screen before the
three intake options even appear, and those options are stacked full-width
cards, so on a phone the actual paste box sits below the fold.

## The flow to build

One modal, two stages. Compose always begins with the template choice, and any
entry point that already knows the template skips straight past it.

```text
Mobile bar / dock "Compose"
        |
        v
  [1] Pick a dossier         <- horizontal filmstrip of templates, one tap
        |                       (skipped when a template card was clicked)
        v
  [2] Compose your trip      <- top bar + mode bar + input
        |
        v
     Generation
```

- The mobile bar's Compose and the desktop dock's Compose open stage 1.
- Clicking a template card on the homepage or the /templates gallery keeps
  today's behavior: it jumps straight to stage 2 with that template chosen.
- Stage 1 is a swipeable row of template cards (codename + a small preview), one
  tap to advance. No confirm button, no second screen.
- The chosen template's codename in the top bar stays tappable in stage 2, so
  changing your mind costs one tap and never loses typed input.

## Stage 2 layout

**Top bar** — the current letterhead collapses into a compact sticky bar pinned
to the top of the modal: `TravelDoss® · <Template>` on the left, the Ref code on
the right (desktop only, as now), and the headline on one line beneath it:

> **Compose** your trip.

"Compose" renders in a new brand red; the rest stays ink. The long sub-line
("One entry — paste, upload, or describe…") is cut — the mode bar says the same
thing with less ink. The bar stays visible while the modal body scrolls, so you
always know which dossier you're composing.

**Mode bar** — the region directly under the top bar (the yellow box in the
reference) becomes a single horizontal three-segment bar: Paste · Upload ·
Generate, each with its icon, the active segment filled. The stacked full-width
cards go away, which lifts the paste box and the Compose Dossier button into
thumb reach on a phone. Each mode's one-line hint sits under the bar, so no
information is lost.

## The red

A new brand token, not the app's existing error red. A deep ruby that sits with
navy and tan rather than shouting at it, added as a semantic token so it is
available app-wide but used only for this accent for now. It will be checked for
contrast against the modal's paper surface in both light and dark, and against
the ten skin palettes, so accessibility stays at 100.

## Technical notes

- `src/components/flow/IngestionModal.tsx`: extend the existing `stage` state
  (`"source" | "review"`) with a `"template"` stage; render the filmstrip from
  the `SKINS` registry. Selecting a skin advances to `"source"` and reports the
  choice up so the parent's mint call uses it.
- `src/routes/index.tsx`: `openDock()` stops pre-seeding `SKINS[0]` and opens
  the modal on the template stage; `openWithTemplate()` is unchanged. The parent
  needs an `onTemplateChange` handler so the modal's pick lands in `picked`
  before `handleGenerate` runs. Same wiring for `src/routes/templates.tsx`.
- Letterhead becomes a `sticky top-0` bar with a backdrop blur inside the
  scrolling `DialogContent`; the `sr-only` `DialogTitle` text updates to
  "Compose your trip".
- Mode bar keeps the existing `role="tablist"` semantics and `TABS` array —
  only the presentation changes from stacked cards to segments, so keyboard
  behavior and the accessible names are preserved. Segments stay >=44px tall.
- New `--tds-ruby` (+ `--color-ruby` mapping in `@theme inline`) in
  `src/styles.css`; no hardcoded hex in components.
- Analytics (house Rule 9): `compose_opened` with an `entry` property
  (`mobile_bar` / `dock` / `template_card`), `template_picked` at stage 1, and
  `template_switched` when the top-bar chip is used to change it. Documented in
  `docs/analytics/tracking-plan.md` in the same change.
- Reserved space for the filmstrip previews so CLS stays 0; `npx vitest run`
  (or `bun test`) and `tsc --noEmit` before finishing.

## Out of scope

The site-wide header, the review stage, and the desktop dock's Paste/Import
shortcuts (they keep going straight to their tab once a template exists).
