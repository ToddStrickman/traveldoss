import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Sign in — TravelDoss" },
      {
        name: "description",
        content:
          "Sign in to TravelDoss to access your trip dossiers and start planning your next journey.",
      },
      { property: "og:title", content: "Sign in — TravelDoss" },
      {
        property: "og:description",
        content: "Access your TravelDoss trip dossiers and continue planning your journey.",
      },
      { property: "og:url", content: "https://traveldoss.lovable.app/login" },
      { name: "robots", content: "noindex,follow" },
    ],
    links: [{ rel: "canonical", href: "https://traveldoss.lovable.app/login" }],
  }),
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/app" },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/app" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/app",
    });
    if (result.error) {
      toast.error(result.error.message ?? "Google sign-in failed");
      setLoading(false);
      return;
    }
    if (!result.redirected) {
      navigate({ to: "/app" });
    }
  };

  return (
    <div className="min-h-screen bg-background font-light">
      <div className="h-px w-full bg-border" />
      <header className="mx-auto flex max-w-[1600px] items-center justify-between px-8 py-6 text-xs uppercase tracking-[0.2em]">
        <Link to="/" className="font-normal">
          Travel<span className="text-muted-foreground">/</span>Doss
        </Link>
        <Link to="/" className="text-muted-foreground transition-colors hover:text-foreground">
          ← Back
        </Link>
      </header>

      <div className="mx-auto grid min-h-[80vh] max-w-[1600px] grid-cols-12 gap-6 px-8 py-16 md:py-24">
        <p className="col-span-12 text-xs uppercase tracking-[0.3em] text-muted-foreground md:col-span-3">
          {mode === "signin" ? "Return" : "Begin"}
        </p>
        <div className="col-span-12 md:col-span-6">
          <h1 className="text-5xl font-extralight tracking-[-0.03em] md:text-7xl">
            {mode === "signin" ? "Welcome back." : "Open a doc."}
          </h1>
          <p className="mt-6 max-w-md text-base font-light text-muted-foreground">
            {mode === "signin" ? "Sign in to your trips." : "Start planning your next trip."}
          </p>

          <Button
            type="button"
            variant="outline"
            className="mt-12 w-full rounded-none border-foreground py-6 text-xs uppercase tracking-[0.2em]"
            onClick={onGoogle}
            disabled={loading}
          >
            Continue with Google
          </Button>

          <div className="my-8 flex items-center gap-4 text-xs uppercase tracking-[0.3em] text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            or
            <div className="h-px flex-1 bg-border" />
          </div>

          <form className="space-y-6" onSubmit={onSubmit}>
            <div>
              <Label htmlFor="email" className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 rounded-none border-0 border-b border-border px-0 shadow-none focus-visible:ring-0"
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 rounded-none border-0 border-b border-border px-0 shadow-none focus-visible:ring-0"
              />
            </div>
            <Button
              type="submit"
              className="w-full rounded-none py-6 text-xs uppercase tracking-[0.2em]"
              disabled={loading}
            >
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <button
            type="button"
            className="mt-8 w-full text-center text-xs uppercase tracking-[0.3em] text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "No account — Sign up" : "Have an account — Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}