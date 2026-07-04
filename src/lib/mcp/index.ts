import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listTripsTool from "./tools/list-trips";
import getTripTool from "./tools/get-trip";

// The OAuth issuer MUST be the direct Supabase host. VITE_SUPABASE_PROJECT_ID
// is inlined at build time and survives publish; the fallback keeps the
// issuer well-formed during the throwaway manifest-extract eval.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "traveldoss-mcp",
  title: "TravelDoss",
  version: "0.1.0",
  instructions:
    "Read the signed-in user's TravelDoss trip dossiers. Use `list_trips` to browse recent trips and `get_trip` to fetch a single dossier (by slug) with its content blocks.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listTripsTool, getTripTool],
});