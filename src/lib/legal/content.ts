// Vite `?raw` imports — usable from routes/components (client and SSR),
// but NOT from bun tests. Keep server functions on `registry.ts` metadata.
import termsV10 from "@/content/legal/terms-v1.0.md?raw";
import privacyV10 from "@/content/legal/privacy-v1.0.md?raw";
import disclaimerV10 from "@/content/legal/disclaimer-v1.0.md?raw";

import type { LegalDocSlug } from "./registry";

export const LEGAL_CONTENT: Record<LegalDocSlug, string> = {
  terms: termsV10,
  privacy: privacyV10,
  disclaimer: disclaimerV10,
};
