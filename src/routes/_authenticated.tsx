import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Signed-out visitors go to the sign-in page. This must be an effect-time
  // navigation, not a render-time `throw redirect(...)`: thrown redirects are
  // only handled in loaders/beforeLoad — from a component they surface in the
  // error boundary, so anonymous visitors to /app saw "This page didn't
  // load" instead of the login form.
  useEffect(() => {
    if (session === null) {
      navigate({ to: "/login", search: { redirect: "/app" }, replace: true });
    }
  }, [session, navigate]);

  if (!session) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return <Outlet />;
}