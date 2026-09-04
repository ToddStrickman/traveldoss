/**
 * Public read for an investor snapshot link. Deliberately unauthenticated: the
 * random token in the URL is the whole credential, and the payload it returns
 * is frozen aggregate numbers only. Unknown, revoked and expired tokens all
 * return the same null so a probe learns nothing.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const TokenSchema = z.object({ token: z.string().max(64) });
const TOKEN_RE = /^[0-9a-f]{32}$/;

export const getAdminSnapshot = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => TokenSchema.parse(input))
  .handler(async ({ data }) => {
    if (!TOKEN_RE.test(data.token)) return null;
    const { readSnapshot } = await import("@/lib/admin/snapshots.server");
    const snapshot = await readSnapshot(data.token);
    if (snapshot) {
      const { captureServer } = await import("@/lib/analytics.server");
      await captureServer("admin_snapshot_viewed", "snapshot-viewer", {
        range_days: snapshot.rangeDays,
      });
    }
    return snapshot;
  });
