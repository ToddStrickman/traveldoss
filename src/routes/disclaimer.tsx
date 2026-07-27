import { createFileRoute } from "@tanstack/react-router";
import { LegalDocPage } from "@/components/legal/LegalDocPage";
import { SITE_URL } from "@/lib/site";

export const Route = createFileRoute("/disclaimer")({
  component: () => <LegalDocPage slug="disclaimer" />,
  head: () => ({
    meta: [
      { title: "Disclaimer | TravelDoss" },
      {
        name: "description",
        content:
          "Important disclaimers about TravelDoss, AI-generated travel information, and your responsibility for travel decisions.",
      },
      { property: "og:title", content: "Disclaimer | TravelDoss" },
      { property: "og:url", content: `${SITE_URL}/disclaimer` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/disclaimer` }],
  }),
});
