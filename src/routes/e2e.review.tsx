/**
 * Dev-only harness for the parse ReviewStage (the "here's what we
 * extracted" step between Compose and mint). The live path sits behind an
 * authed AI parse, so this mounts the stage directly with offline-parsed
 * sample text — same component, same block shapes.
 */
import { useState } from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { toast } from "sonner";
import { ReviewStage } from "@/components/flow/IngestionModal";
import { parseDropInWithMeta } from "@/lib/itinerary/parse";
import type { Block } from "@/lib/skins/types";

const SAMPLE = `Day 1 — Rome
Land at FCO 7:45 AM. Drop bags at Hotel de la Ville.
Dinner at Roscioli, then the Colosseum at night.

Day 2 — Palermo
ITA AZ1781 to Palermo, 1:15 PM.
Check in Adler Spa Resort, Siculiana.
Sunset walk at Torre Salsa reserve.`;

export const Route = createFileRoute("/e2e/review")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  component: ReviewHarness,
});

function ReviewHarness() {
  const parsed = parseDropInWithMeta(SAMPLE, "text");
  const [blocks, setBlocks] = useState<Block[]>(parsed.blocks);
  const [destination, setDestination] = useState<string | null>(parsed.destination);
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <ReviewStage
        blocks={blocks}
        destination={destination}
        onBlocksChange={setBlocks}
        onDestinationChange={setDestination}
        onBack={() => toast.message("Back pressed")}
        onConfirm={() => toast.success(`Confirmed ${blocks.length} blocks`)}
        onCancel={() => toast.message("Cancelled")}
        templateName="Marguerite"
        refCode="TD-E2E"
      />
    </div>
  );
}
