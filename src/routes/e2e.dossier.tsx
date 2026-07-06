/**
 * Dev-only dossier harness (mirrors e2e.kanban): renders the full mobile
 * dossier chrome — masthead bar, day-jump sheet, view pill/sheet — around a
 * skin Render fed by the demo fixture, with no DB or auth. Used to develop
 * and design-review the mobile visitor path at phone widths.
 *
 * Query params:
 *   ?skin=<id>                      (default: fallback skin)
 *   ?view=vertical|horizontal|grid (default: vertical)
 */
import { useState } from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { FALLBACK_SKIN, getSkin } from "@/lib/skins/registry";
import type { SkinView } from "@/lib/skins/types";
import { DEMO_BLOCKS, DEMO_TRIP } from "@/lib/skins/demo";
import { DossierMastheadBar } from "@/components/mobile/DossierMastheadBar";
import { ViewPill } from "@/components/mobile/ViewSheet";
import { StudioBar } from "@/components/studio/StudioBar";
import { IngestionModal } from "@/components/flow/IngestionModal";

export const Route = createFileRoute("/e2e/dossier")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  validateSearch: (
    s: Record<string, unknown>,
  ): { skin?: string; view: SkinView } => ({
    skin: typeof s.skin === "string" ? s.skin : undefined,
    view:
      s.view === "horizontal" || s.view === "grid" ? s.view : "vertical",
  }),
  component: DossierHarness,
});

function DossierHarness() {
  const search = Route.useSearch();
  const skin = getSkin(search.skin ?? "") ?? FALLBACK_SKIN;
  const [layout, setLayout] = useState<SkinView>(search.view);
  const [mintOpen, setMintOpen] = useState(false);
  // ?bar=mint exercises the sample-mode bottom bar + mint sheet without a DB.
  const sampleBar =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("bar") === "mint";

  return (
    <>
      {skin.tokens.fontUrl && <link rel="stylesheet" href={skin.tokens.fontUrl} />}
      <DossierMastheadBar title={DEMO_TRIP.destination} blocks={DEMO_BLOCKS} />
      <div
        aria-hidden
        className="md:hidden"
        style={{ height: "calc(56px + env(safe-area-inset-top, 0px))" }}
      />
      <skin.Render trip={DEMO_TRIP} blocks={DEMO_BLOCKS} view={layout} />
      {sampleBar ? (
        <StudioBar
          emphasis="mint"
          leadingSlot={<ViewPill variant="inline" value={layout} onChange={setLayout} />}
          templateId={skin.meta.id}
          saving={false}
          savedAt={null}
          onTemplateChange={() => {}}
          onMint={() => setMintOpen(true)}
          mintLabel="Mint"
        />
      ) : (
        <ViewPill value={layout} onChange={setLayout} />
      )}
      <IngestionModal
        open={mintOpen}
        onOpenChange={setMintOpen}
        template={skin}
        onGenerate={() => setMintOpen(false)}
      />
    </>
  );
}
