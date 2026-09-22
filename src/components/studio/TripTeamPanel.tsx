/**
 * TripTeamPanel — the members panel and the invite composer (Directive 08,
 * Phase 2). Owner-only entry point; co-planners never see it.
 *
 * The invite step is deliberately two-tap: the creator types addresses, then
 * confirms a sentence that says plainly an email will be sent, from their
 * name, to those people. Nothing sends before that tap (R7).
 */
import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mail, Trash2, Link2, Check } from "lucide-react";
import { toast } from "sonner";
import { TdSheet } from "@/components/mobile/TdSheet";
import { MEMBER_ROLE_LABEL } from "@/lib/collab/roles";
import { getTripTeam, inviteToTrip, removeTripMember, revokeTripInvite } from "@/lib/collab.functions";
import { trackInviteSent, trackInviteRevoked, trackMemberRemoved } from "@/lib/analytics";

type Member = {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  status: string;
  source: string;
  joinedAt: string | null;
};
type Invite = { id: string; email: string; expiresAt: string };

const soft = "text-[11px] uppercase tracking-[0.3em] text-ink-soft";

function statusLabel(m: Member) {
  if (m.role === "owner") return "Trip creator";
  if (m.status === "active") return MEMBER_ROLE_LABEL;
  if (m.status === "invited") return "Invited";
  if (m.status === "removed") return "Removed";
  return m.status;
}

function parseEmails(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[\s,;]+/)
        .map((s) => s.trim().toLowerCase())
        .filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)),
    ),
  ];
}

export function TripTeamPanel({
  tripId,
  open,
  onOpenChange,
}: {
  tripId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const load = useServerFn(getTripTeam);
  const invite = useServerFn(inviteToTrip);
  const remove = useServerFn(removeTripMember);
  const revoke = useServerFn(revokeTripInvite);

  const [members, setMembers] = React.useState<Member[]>([]);
  const [invites, setInvites] = React.useState<Invite[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [raw, setRaw] = React.useState("");
  const [confirming, setConfirming] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [links, setLinks] = React.useState<Array<{ email: string; link: string }>>([]);

  const refresh = React.useCallback(() => {
    setLoading(true);
    load({ data: { tripId } })
      .then((r) => {
        setMembers(r.members as Member[]);
        setInvites(r.invites as Invite[]);
      })
      .catch((e: Error) => toast.error("Couldn't load the trip team", { description: e.message }))
      .finally(() => setLoading(false));
  }, [load, tripId]);

  React.useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const pending = parseEmails(raw);

  const onSend = async () => {
    setSending(true);
    try {
      const res = await invite({ data: { tripId, emails: pending } });
      trackInviteSent({ source: "creator", count: res.invited.length });
      const unsent = res.invited.filter((i) => !i.emailed);
      setLinks(unsent.map((i) => ({ email: i.email, link: i.link })));
      if (unsent.length === 0) {
        toast.success(`Invitation sent to ${res.invited.length === 1 ? pending[0] : `${res.invited.length} people`}`);
      } else {
        toast.message("Invitations created", {
          description: "Email sending isn't switched on yet — share each link below instead.",
        });
      }
      setRaw("");
      setConfirming(false);
      refresh();
    } catch (e) {
      toast.error("Couldn't send the invitations", { description: (e as Error).message });
    } finally {
      setSending(false);
    }
  };

  return (
    <TdSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Trip team"
      description="People who can edit this dossier with you"
      snapHeight="full"
      className="max-w-xl md:mx-auto"
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8 pt-4">
        <section>
          <h3 className={soft}>On this trip</h3>
          <ul className="mt-3 space-y-2">
            {loading && members.length === 0 ? (
              <li className="text-sm text-ink-soft">Loading…</li>
            ) : null}
            {members
              .filter((m) => m.status !== "removed")
              .map((m) => (
                <li
                  key={m.id}
                  className="flex min-h-[44px] items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-ink">{m.name || m.email || "Invited traveller"}</span>
                    <span className="block truncate text-xs text-ink-soft">{statusLabel(m)}</span>
                  </span>
                  {m.role !== "owner" ? (
                    <button
                      type="button"
                      className="tap inline-flex h-11 w-11 items-center justify-center rounded-full text-ink-soft hover:text-ink"
                      aria-label={`Remove ${m.name || m.email || "this person"}`}
                      onClick={async () => {
                        try {
                          await remove({ data: { tripId, memberId: m.id } });
                          trackMemberRemoved();
                          toast.success("Removed from the trip");
                          refresh();
                        } catch (e) {
                          toast.error("Couldn't remove them", { description: (e as Error).message });
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  ) : null}
                </li>
              ))}
          </ul>
        </section>

        {invites.length > 0 ? (
          <section className="mt-6">
            <h3 className={soft}>Waiting to accept</h3>
            <ul className="mt-3 space-y-2">
              {invites.map((i) => (
                <li
                  key={i.id}
                  className="flex min-h-[44px] items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2"
                >
                  <span className="min-w-0 truncate text-sm text-ink">{i.email}</span>
                  <button
                    type="button"
                    className="tap min-h-[44px] rounded-full px-3 text-xs uppercase tracking-[0.2em] text-ink-soft hover:text-ink"
                    onClick={async () => {
                      try {
                        await revoke({ data: { tripId, inviteId: i.id } });
                        trackInviteRevoked();
                        toast.success("Invitation withdrawn");
                        refresh();
                      } catch (e) {
                        toast.error("Couldn't withdraw it", { description: (e as Error).message });
                      }
                    }}
                  >
                    Withdraw
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="mt-6">
          <h3 className={soft}>Invite someone to edit</h3>
          <p className="mt-2 text-sm text-ink-soft">
            They get full editing rights on this dossier. Only you can publish, change the template, or
            change who can see it.
          </p>
          <label className="mt-3 block">
            <span className="sr-only">Email addresses</span>
            <textarea
              value={raw}
              onChange={(e) => {
                setRaw(e.target.value);
                setConfirming(false);
              }}
              rows={2}
              placeholder="anna@example.com, sam@example.com"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-ink placeholder:text-ink-soft focus:outline-none focus:ring-1 focus:ring-seal"
            />
          </label>

          {pending.length > 0 ? (
            confirming ? (
              <div className="mt-3 rounded-xl border border-seal/40 bg-seal/5 p-3">
                <p className="text-sm text-ink">
                  TravelDoss will email {pending.length === 1 ? pending[0] : `${pending.length} people`} on your
                  behalf — the message carries your name as the sender, and replies come back to you. Each link works once
                  and only for the address it was sent to.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={sending}
                    onClick={onSend}
                    className="tap inline-flex min-h-[44px] items-center gap-2 rounded-full bg-seal px-4 text-sm text-paper disabled:opacity-60"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Mail className="h-4 w-4" aria-hidden />}
                    Send the invitation {pending.length > 1 ? `to ${pending.length}` : ""}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className="tap min-h-[44px] rounded-full px-4 text-sm text-ink-soft hover:text-ink"
                  >
                    Not yet
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="tap mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-full border border-seal/40 px-4 text-sm text-ink"
              >
                <Mail className="h-4 w-4" aria-hidden />
                Review the email before it sends
              </button>
            )
          ) : null}

          {links.length > 0 ? (
            <div className="mt-4 space-y-2">
              <h4 className={soft}>Invitation links</h4>
              {links.map((l) => (
                <CopyLinkRow key={l.email} email={l.email} link={l.link} />
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </TdSheet>
  );
}

function CopyLinkRow({ email, link }: { email: string; link: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      className="tap flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2 text-left"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(link);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        } catch {
          toast.error("Clipboard unavailable");
        }
      }}
    >
      <span className="min-w-0 truncate text-sm text-ink">{email}</span>
      <span className="inline-flex items-center gap-1 text-xs text-ink-soft">
        {copied ? <Check className="h-4 w-4" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />}
        {copied ? "Copied" : "Copy link"}
      </span>
    </button>
  );
}
