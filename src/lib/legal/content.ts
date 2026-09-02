// Vite `?raw` imports — usable from routes/components (client and SSR),
// but NOT from bun tests. Keep server functions on `registry.ts` metadata.
import termsV12 from "@/content/legal/terms-v1.2.md?raw";
import privacyV11 from "@/content/legal/privacy-v1.1.md?raw";
import disclaimerV10 from "@/content/legal/disclaimer-v1.0.md?raw";

import type { LegalDocSlug } from "./registry";

export const LEGAL_CONTENT: Record<LegalDocSlug, string> = {
  terms: termsV12,
  privacy: privacyV11,
  disclaimer: disclaimerV10,
};
