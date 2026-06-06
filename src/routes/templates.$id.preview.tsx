import { createFileRoute, Link, useNavigate, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { getSkin, SKINS } from "@/lib/skins/registry";
import { pickTemplate } from "@/lib/templates.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/templates/$id/preview")({
  component: TemplatePreview,
  loader: ({ params }) => {
    const skin = getSkin(params.id);
    if (!skin) throw notFound();
    return { skinId: skin.meta.id };
  },
  head: ({ params }) => {
    const skin = SKINS.find((s) => s.meta.id === params.id);
    const name = skin?.meta.codename ?? "Template";
    return {
      meta: [
        { title: `${name} — Preview a TravelDoss Dossier` },
        {
          name: "description",
          content: `Preview the ${name} dossier template with a sample itinerary, then mint your own.`,
        },
      ],
    };
  },
});

function TemplatePreview() {
  const { skinId } = Route.useLoaderData();
  const skin = getSkin(skinId)!;
  const navigate = useNavigate();
  const pickFn = useServerFn(pickTemplate);
  const [minting, setMinting] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    let m = true;
    supabase.auth.getUser().then(({ data }) => m && setAuthed(!!data.user));
    return () => { m = false; };
  }, []);

  async function mint() {
    if (minting) return;
    if (authed === false) {
      window.sessionStorage.setItem("td_pending_mint_template", skinId);
      toast.message("Sign in to mint your dossier", {
        description: "We'll bring you right back to mint this template.",
      });
      navigate({ to: "/login", search: { redirect: `/templates/${skinId}/preview` } });
      return;
    }
    setMinting(true);
    try {
      const r = await pickFn({ data: { templateId: skinId } });
      navigate({ to: "/t/$slug", params: { slug: r.slug }, search: { mode: "edit" } });
    } catch (e) {
      console.error(e);
      toast.error("Couldn't mint your dossier", {
        description: e instanceof Error ? e.message : String(e),
      });
      setMinting(false);
    }
  }

  // If user returns from login with pending mint, auto-mint.
  useEffect(() => {
    if (authed !== true) return;
    const pending = window.sessionStorage.getItem("td_pending_mint_template");
    if (pending === skinId) {
      window.sessionStorage.removeItem("td_pending_mint_template");
      void mint();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  const { Render, previewFixture, tokens } = skin;

  return (
    <div className="relative min-h-dvh bg-background text-foreground">
      {/* Top bar */}
      <header
        data-print="hide"
        className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-ink/10 bg-paper/85 px-4 py-3 backdrop-blur-md sm:px-6"
      >
        <Link
          to="/templates"
          className="inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.35em] text-ink/65 transition-colors hover:text-seal"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Back to templates</span>
          <span className="sm:hidden">Back</span>
        </Link>
        <div className="hidden items-center gap-2 text-[10px] font-medium uppercase tracking-[0.35em] text-ink/55 sm:flex">
          <span className="h-1 w-1 rounded-full" style={{ background: tokens.accent }} />
          {skin.meta.codename} · Sample preview
        </div>
        <button
          type="button"
          onClick={mint}
          disabled={minting || authed === null}
          className="td-mint-button inline-flex shrink-0 items-center gap-2 rounded-full bg-seal px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-paper transition-all hover:-translate-y-0.5 disabled:opacity-60 sm:px-5 sm:py-2.5"
        >
          <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-paper" />
          {minting ? "Minting…" : "Mint this dossier"}
          <span aria-hidden>→</span>
        </button>
      </header>

      <div className="mx-auto max-w-[1400px] px-3 pt-4 sm:px-6">
        <p className="mb-3 text-center text-[10px] uppercase tracking-[0.35em] text-ink/45">
          You're previewing with sample content. Mint to make it yours.
        </p>
      </div>

      {/* Live, full-size skin render */}
      <div className="relative">
        {tokens.fontUrl && <link rel="stylesheet" href={tokens.fontUrl} />}
        <div className="pointer-events-none">
          <Render trip={previewFixture.trip} blocks={previewFixture.blocks} />
        </div>
      </div>

      {/* Floating mobile mint CTA */}
      <div
        data-print="hide"
        className="fixed inset-x-0 z-40 flex justify-center px-4 sm:hidden bottom-[max(16px,env(safe-area-inset-bottom))]"
      >
        <button
          type="button"
          onClick={mint}
          disabled={minting || authed === null}
          className="inline-flex w-full max-w-sm items-center justify-center gap-2 rounded-full bg-seal px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-paper shadow-lg disabled:opacity-60"
        >
          <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-paper" />
          {minting ? "Minting…" : "Mint this dossier"}
          <span aria-hidden>→</span>
        </button>
      </div>
    </div>
  );
}