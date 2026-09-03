/**
 * Admin console RPC. Every function here verifies the caller holds the `admin`
 * role before touching the service-role query layer — a route guard protects the
 * page's UI, not this endpoint.
 *
 * The role check runs through `context.supabase` (the caller's own RLS-scoped
 * client) via `has_role`, never through the admin client: asking the privileged
 * client "is this user an admin?" would answer for everyone.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RangeSchema = z.object({ days: z.number().int().min(1).max(365) });

type AdminContext = {
  supabase: {
    rpc: (
      fn: "has_role",
      args: { _user_id: string; _role: "admin" },
    ) => PromiseLike<{ data: boolean | null }>;
  };
  userId: string;
};

async function checkAdmin(context: AdminContext): Promise<boolean> {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  return data === true;
}

async function assertAdmin(context: AdminContext): Promise<void> {
  if (!(await checkAdmin(context))) throw new Error("Forbidden");
}

export const isAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ({ admin: await checkAdmin(context) }));

export const getAdminMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RangeSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { loadAdminMetrics } = await import("@/lib/admin/queries.server");
    return loadAdminMetrics(data.days);
  });

export const getLiveFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ limit: z.number().int().min(1).max(100) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { loadLiveFeed } = await import("@/lib/admin/queries.server");
    return loadLiveFeed(data.limit);
  });
