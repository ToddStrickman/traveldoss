import { createFileRoute } from "@tanstack/react-router";
import { LegalDocPage } from "@/components/legal/LegalDocPage";
import { SITE_URL } from "@/lib/site";

export const Route = createFileRoute("/privacy")({
  component: () => <LegalDocPage slug="privacy" />,
  head: () => ({
    meta: [
      { title: "Privacy Policy | TravelDoss" },
      {
        name: "description",
        content: "How TravelDoss collects, uses, and protects your information.",
      },
      { property: "og:title", content: "Privacy Policy | TravelDoss" },
      { property: "og:url", content: `${SITE_URL}/privacy` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/privacy` }],
  }),
});
