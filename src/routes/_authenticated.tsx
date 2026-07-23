import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const navigate = useNavigate();
  const currentHref = useRouterState({ select: (s) => s.location.href });

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Signed-out visitors go to the sign-in form. This must be a NAVIGATION
  // from an effect, not a `throw redirect()` from render — a redirect
  // thrown inside a component (outside loader/beforeLoad) is treated as a
  // crash by the router, so anonymous visitors to /app were getting the
  // "This page didn't load" error boundary instead of the login form.
  // Carry the intended destination so login returns them here after.
  useEffect(() => {
    if (session === null) {
      void navigate({ to: "/login", search: { redirect: currentHref }, replace: true });
    }
  }, [session, navigate, currentHref]);

  if (session === undefined || session === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return <Outlet />;
}