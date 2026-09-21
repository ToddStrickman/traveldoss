/**
 * EditingStatusBar — desktop-only sticky Share button in the dossier header.
 *
 * The auto-save read-out and Edit/View label live on mobile/the StudioBar;
 * desktop keeps just the share affordance in the top-right corner.
 */
import { SharedDossierCard } from "./SharedDossierCard";

export function EditingStatusBar({
  slug,
}: {
  slug: string;
}) {
  return (
    <div
      data-print="hide"
      className="fixed right-4 z-40 hidden items-center md:inline-flex"
      style={{ top: "max(1rem, env(safe-area-inset-top))" }}
    >
      <SharedDossierCard slug={slug} />
    </div>
  );
}