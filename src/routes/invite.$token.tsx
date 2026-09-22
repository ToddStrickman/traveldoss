/**
 * /invite/$token — invite acceptance (Directive 08, Phase 2).
 *
 * Shows the trip and who invited you, then requires signing in as exactly the
 * invited address (R8). A mismatch explains itself and offers a switch rather
 * than silently failing.
 */
import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { acceptTripInvite, getInvitePreview } from "@/lib/collab.functions";
import { trackInviteAccepted } from "@/lib/analytics";

export const Route = createFileRoute("/invite/$token")({
  head: () => ({
    meta: [
      { title: "Your trip invitation · TravelDoss" },
      {
        name: "description",
        content: "Accept an invitation to help plan a TravelDoss trip dossier.",
      },
      { property: "og:title", content: "Your trip invitation · TravelDoss" },
      {
        property: "og:description",
        content: "Accept an invitation to help plan a TravelDoss trip dossier.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InvitePage,
});

type Preview = Awaited<ReturnType<typeof getInvitePreview>>;

function InvitePage() {
  const { token } = Route.useParams();
  const preview = useServerFn(getInvitePreview);
  const accept = useServerFn(acceptTripInvite);
  const navigate = useNavigate();

  const [state, setState] = React.useState<Preview | null>(null);
  const [sessionEmail, setSessionEmail] = React.useState<string | null | undefined>(undefined);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    preview({ data: { token } })
      .then(setState)
      .catch(() => setState({ state: "invalid" } as Preview));
    supabase.auth.getUser().then(({ data }) => setSessionEmail(data.user?.email ?? null));
  }, [preview, token]);

  const onAccept = async () => {
    setBusy(true);
    try {
      const r = await accept({ data: { token } });
      trackInviteAccepted({ source: "creator", days_to_accept: r.daysToAccept });
      toast.success("You're on the trip");
      if (r.slug) navigate({ to: "/t/$slug", params: { slug: r.slug }, search: {} });
      else navigate({ to: "/app" });
    } catch (e) {
      toast.error("Couldn't accept the invitation", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const shell = (children: React.ReactNode) => (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-5 px-6 py-16">
      {children}
    </main>
  );

  if (!state) {
    return shell(<p className="text-sm text-ink-soft">Checking your invitation…</p>);
  }

  if (state.state !== "ready") {
    const message =
      state.state === "used"
        ? "This invitation has already been used."
        : state.state === "expired"
          ? "This invitation has expired. Ask for a fresh one."
          : state.state === "revoked"
            ? "This invitation was withdrawn."
            : "This invitation link isn't valid.";
    return shell(
      <>
        <h1 className="font-serif text-2xl text-ink">Invitation unavailable</h1>
        <p className="text-sm text-ink-soft">{message}</p>
        <Link to="/" className="tap inline-flex min-h-[44px] items-center text-sm text-seal">
          Go to TravelDoss
        </Link>
      </>,
    );
  }

  const invited = state.email.toLowerCase();
  const signedInAs = sessionEmail?.toLowerCase() ?? null;
  const matched = signedInAs !== null && signedInAs === invited;

  return shell(
    <>
      <p className="text-[11px] uppercase tracking-[0.3em] text-ink-soft">You're invited to plan</p>
      <h1 className="font-serif text-3xl text-ink">{state.tripTitle}</h1>
      <p className="text-sm text-ink-soft">
        {state.inviterName} invited {state.email} to help plan this dossier. You'll be able to add, edit and
        remove anything in it; only {state.inviterName} can publish it or change who can see it.
      </p>
      {/* Reserved space: the image slot keeps its height whether or not a cover exists, so nothing shifts. */}
      <div className="aspect-[16/9] w-full overflow-hidden rounded-xl bg-white/[0.04]">
        {state.heroImageUrl ? (
          <img
            src={state.heroImageUrl}
            alt=""
            className="h-full w-full object-cover"
            width={1200}
            height={675}
          />
        ) : null}
      </div>

      {matched ? (
        <button
          type="button"
          disabled={busy}
          onClick={onAccept}
          className="tap inline-flex min-h-[44px] items-center justify-center rounded-full bg-seal px-5 text-sm text-paper disabled:opacity-60"
        >
          {busy ? "Joining…" : "Join the trip"}
        </button>
      ) : signedInAs ? (
        <div className="rounded-xl border border-seal/40 bg-seal/5 p-3 text-sm text-ink">
          <p>
            You're signed in as {sessionEmail}, but this invitation was sent to {state.email}. Sign in with that
            address to accept it.
          </p>
          <button
            type="button"
            className="tap mt-3 inline-flex min-h-[44px] items-center rounded-full border border-seal/40 px-4 text-sm"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/login", search: { redirect: `/invite/${token}` } });
            }}
          >
            Switch accounts
          </button>
        </div>
      ) : (
        <Link
          to="/login"
          search={{ redirect: `/invite/${token}` }}
          className="tap inline-flex min-h-[44px] items-center justify-center rounded-full bg-seal px-5 text-sm text-paper"
        >
          Sign in as {state.email}
        </Link>
      )}
    </>,
  );
}
