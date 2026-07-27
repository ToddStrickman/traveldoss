import { createFileRoute } from "@tanstack/react-router";
import { LegalDocPage } from "@/components/legal/LegalDocPage";
import { SITE_URL } from "@/lib/site";

export const Route = createFileRoute("/terms")({
  component: () => <LegalDocPage slug="terms" />,
  head: () => ({
    meta: [
      { title: "Terms of Service | TravelDoss" },
      {
        name: "description",
        content:
          "The Terms of Service governing your use of TravelDoss — the AI-powered travel dossier platform.",
      },
      { property: "og:title", content: "Terms of Service | TravelDoss" },
      { property: "og:url", content: `${SITE_URL}/terms` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/terms` }],
  }),
});
