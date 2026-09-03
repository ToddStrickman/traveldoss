import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Whether the signed-in user holds the `admin` role.
 *
 * Read through the browser client on purpose: `user_roles` RLS lets a user read
 * only their own rows, so this cannot report anyone else's role, and it stays
 * quiet (no 401) on public pages where there is no session at all. It gates
 * *visibility* only — the admin server functions verify the role themselves.
 */
export function useIsAdmin(): boolean {
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    let alive = true;

    const check = async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) {
        if (alive) setAdmin(false);
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (alive) setAdmin(!!data);
    };

    void check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => void check());
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return admin;
}
