import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  // Optional key so plain <Link to="/login"> typechecks everywhere; the
  // open-redirect guard stays (same-origin paths only) and the "/app"
  // default is applied at the use site below.
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect:
      typeof search.redirect === "string" && search.redirect.startsWith("/") && !search.redirect.startsWith("//")
        ? search.redirect
        : undefined,
  }),
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
  const { redirect = "/app" } = Route.useSearch();
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
          options: { emailRedirectTo: window.location.origin + redirect },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.assign(redirect);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + redirect,
      });
      if (result.error) {
        const raw = result.error.message ?? "";
        const friendly = /denied|cancel|consent|access_denied/i.test(raw)
          ? "Google sign-in was cancelled before consent finished. Try again and approve access to continue."
          : /popup|blocked/i.test(raw)
            ? "Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again."
            : /network|fetch|timeout/i.test(raw)
              ? "We couldn't reach Google. Check your connection and try again."
              : raw || "Google sign-in failed. Please try again, or use email below.";
        console.error("[google-signin] consent failed", result.error);
        toast.error("Google sign-in failed", { description: friendly });
        setLoading(false);
        return;
      }
      if (!result.redirected) {
        window.location.assign(redirect);
      }
    } catch (err) {
      console.error("[google-signin] threw", err);
      toast.error("Google sign-in failed", {
        description:
          err instanceof Error
            ? `${err.message}. You can also sign in with email below.`
            : "Something went wrong launching Google sign-in. You can also sign in with email below.",
      });
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background text-foreground selection:bg-seal/40">
      <div aria-hidden className="td-grain fixed inset-0 z-0" />
      <div aria-hidden className="td-vignette fixed inset-0 z-0" />

      <header className="relative z-10 mx-auto flex max-w-[1600px] items-center justify-between border-b border-ink/10 px-5 py-5 md:px-8 md:py-6">
        <Link to="/" className="inline-flex items-center gap-3 td-eyebrow text-ink/70 transition-colors hover:text-seal">
          <span className="h-px w-6 bg-ink/30" />
          TravelDoss<span className="text-ink/30">®</span>
        </Link>
        <Link to="/" className="td-eyebrow text-ink/45 transition-colors hover:text-seal">
          ← Back
        </Link>
      </header>

      <main className="relative z-10 mx-auto grid min-h-[82vh] max-w-[1400px] grid-cols-12 gap-6 md:gap-10 px-5 py-12 md:px-8 md:py-20 md:py-28">
        <aside className="col-span-12 md:col-span-5 md:border-r md:border-ink/10 md:pr-10">
          <span className="td-eyebrow text-ink/50">
            {mode === "signin" ? "Members · Return" : "Members · Begin"}
          </span>
          <h1 className="td-headline mt-6 text-6xl text-ink md:text-7xl">
            {mode === "signin" ? (
              <>
                Welcome <span className="italic text-ink/85">back<span className="text-seal">.</span></span>
              </>
            ) : (
              <>
                Open a <span className="italic text-ink/85">dossier<span className="text-seal">.</span></span>
              </>
            )}
          </h1>
          <p className="mt-8 max-w-sm text-sm leading-relaxed text-ink-soft">
            {mode === "signin"
              ? "Every dossier holds mapped routes, day-by-day plans, and reservations — quiet, owned, and yours."
              : "Each trip becomes a quietly composed dossier with mapped routes, day-by-day plans, and a private URL to share."}
          </p>
          <div className="mt-12 flex items-center gap-3 text-ink/60">
            <span className="h-px w-10 bg-ink/15" />
            <ElevateTagline className="text-base" />
          </div>
        </aside>

        <section className="col-span-12 md:col-span-7">
          <div className="surface-card mx-auto max-w-md rounded-none p-8 md:p-10">
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-none border-ink/15 bg-transparent py-6 text-[10px] uppercase tracking-[0.4em] text-ink hover:border-seal hover:bg-seal hover:text-paper"
              onClick={onGoogle}
              disabled={loading}
            >
              Continue with Google
            </Button>

            <div className="my-7 flex items-center gap-4 td-eyebrow text-ink/40">
              <div className="h-px flex-1 bg-ink/10" />
              or
              <div className="h-px flex-1 bg-ink/10" />
            </div>

            <form className="space-y-6" onSubmit={onSubmit}>
              <div>
                <Label htmlFor="email" className="td-eyebrow text-ink/55">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-3 rounded-none border-0 border-b border-ink/20 bg-transparent px-0 text-base text-ink shadow-none focus-visible:border-seal focus-visible:ring-0"
                />
              </div>
              <div>
                <Label htmlFor="password" className="td-eyebrow text-ink/55">
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
                  className="mt-3 rounded-none border-0 border-b border-ink/20 bg-transparent px-0 text-base text-ink shadow-none focus-visible:border-seal focus-visible:ring-0"
                />
              </div>
              <Button
                type="submit"
                className="mt-4 w-full rounded-none bg-seal py-6 text-[10px] uppercase tracking-[0.4em] text-paper hover:bg-seal-soft"
                disabled={loading}
              >
                {mode === "signin" ? "Sign in" : "Create account"}
              </Button>
            </form>

            <button
              type="button"
              className="mt-8 w-full text-center td-eyebrow text-ink/45 transition-colors hover:text-seal"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "No account — Sign up" : "Have an account — Sign in"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}