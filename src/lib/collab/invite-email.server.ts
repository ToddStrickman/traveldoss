/**
 * Invite email delivery.
 *
 * The invite is sent by TravelDoss on the trip creator's behalf: the creator's
 * name is the visible sender name and their address is the reply-to, so the
 * recipient recognises who invited them (R6 — never from the creator's own
 * mailbox).
 *
 * Sending needs a verified sender domain for this project. Until one exists,
 * this returns `sent: false` and the panel falls back to a copyable invite
 * link — the membership row and the token are created either way, so nothing
 * has to be redone once sending is switched on.
 */

export type InviteEmailInput = {
  to: string;
  inviterName: string;
  inviterEmail: string;
  tripTitle: string;
  link: string;
};

export type InviteEmailResult = { sent: boolean; reason?: string };

/** Sender domain, set once the project's email domain is verified. */
function senderDomain(): string | undefined {
  const d = process.env["FROM_DOMAIN"] || process.env["SENDER_DOMAIN"];
  return d && d.length > 0 ? d : undefined;
}

export async function sendInviteEmail(input: InviteEmailInput): Promise<InviteEmailResult> {
  const domain = senderDomain();
  if (!domain) return { sent: false, reason: "email_not_configured" };
  try {
    const res = await fetch(`https://${domain}/lovable/email/transactional/send`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env["LOVABLE_API_KEY"] ?? ""}`,
      },
      body: JSON.stringify({
        templateName: "trip-invite",
        recipientEmail: input.to,
        idempotencyKey: `trip-invite-${input.link.split("/").pop()}`,
        replyTo: input.inviterEmail,
        senderName: `${input.inviterName} via TravelDoss`,
        templateData: {
          inviterName: input.inviterName,
          tripTitle: input.tripTitle,
          link: input.link,
        },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[invite-email] send failed [${res.status}]: ${body}`);
      return { sent: false, reason: `send_failed_${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error("[invite-email] send threw", err);
    return { sent: false, reason: "send_threw" };
  }
}
