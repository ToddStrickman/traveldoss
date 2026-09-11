# Make every layout use the template carousel

## Goal
Keep the template-browsing experience consistent across desktop and mobile: Vertical, Horizontal, and Grid all use the carousel shown in the reference. Changing Layout changes the artwork on each dossier cover, not the browsing structure.

## Changes
- Use the existing 3D atelier carousel for all three layout choices on desktop instead of switching Vertical to a stacked list or Grid to cards.
- Pass the selected layout into every carousel cover so its abstract preview and caption accurately switch between Vertical, Horizontal, and Grid.
- Keep the existing swipeable cover carousel on mobile for all three choices, preserving its centered snap behavior, dots, Preview action, and Mint action.
- Preserve search, filters, saved layout preference, keyboard arrows, drag/swipe controls, reduced-motion behavior, and the current mint flow.
- Remove only the now-unused templates-page branches and imports; do not modify individual skin files.

## Analytics
Continue using the existing `template_browse_mode_changed` event. No new measurable moment is introduced.

## Verification
- Add or update coverage proving all three choices retain carousel semantics on desktop and mobile while displaying the matching layout artwork/caption.
- Check 375px and 430px mobile widths plus 1280px desktop for centering, no horizontal page overflow, stable dimensions, and usable controls.
- Run the full test suite and TypeScript check, noting any confirmed pre-existing failures separately.
