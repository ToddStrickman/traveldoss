import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SiteFooter } from "@/components/legal/SiteFooter";
import { submitContactMessage } from "@/lib/contact.functions";
import { CONTACT_CATEGORIES, CONTACT_MESSAGE_MAX, type ContactCategoryId } from "@/lib/contact";
import { trackContactFailed, trackContactSubmitted } from "@/lib/analytics";
import { SITE_URL } from "@/lib/site";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
  head: () => ({
    meta: [
      { title: "Contact TravelDoss — Support & Legal Notices" },
      {
        name: "description",
        content:
          "Reach TravelDoss for support, general questions, legal notices, or arbitration opt-outs. Every message is time-stamped on receipt.",
      },
      { property: "og:title", content: "Contact TravelDoss — Support & Legal Notices" },
      {
        property: "og:description",
        content:
          "Send TravelDoss a message: support, general questions, legal notices, or arbitration opt-outs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:url", content: `${SITE_URL}/contact` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/contact` }],
  }),
});

function ContactPage() {
  const submit = useServerFn(submitContactMessage);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ContactCategoryId>("general");
  const [message, setMessage] = useState("");
  const [trap, setTrap] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receivedAt, setReceivedAt] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address so we can reply.");
      return;
    }
    if (!message.trim()) {
      setError("Please write a message.");
      return;
    }
    if (message.length > CONTACT_MESSAGE_MAX) {
      setError(`Please keep your message under ${CONTACT_MESSAGE_MAX} characters.`);
      return;
    }
    setSending(true);
    try {
      const res = await submit({
        data: { email: email.trim(), name: name.trim() || undefined, category, message, trap },
      });
      setReceivedAt(res.receivedAt);
      trackContactSubmitted(category, message.length);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(msg);
      trackContactFailed(category, msg.slice(0, 80));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <main className="mx-auto w-full max-w-[42rem] flex-1 px-5 pb-16 pt-12 md:px-8 md:pt-20">
        <Link
          to="/"
          className="text-[10px] uppercase tracking-[0.4em] text-ink/45 transition-colors hover:text-seal"
        >
          ← TravelDoss
        </Link>
        <p className="mt-8 text-[10px] uppercase tracking-[0.4em] text-ink/45">Correspondence</p>
        <h1
          className="mt-3 text-4xl text-ink md:text-5xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Contact us<span className="text-seal">.</span>
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-ink-soft">
          Support, general questions, legal notices under the{" "}
          <Link to="/terms" className="underline decoration-ink/25 hover:text-seal">
            Terms of Service
          </Link>
          , and arbitration opt-outs all arrive here. Each message is stamped with the moment we
          receive it.
        </p>

        {receivedAt ? (
          <section
            aria-live="polite"
            className="mt-10 border-y border-ink/15 py-8"
          >
            <p className="text-[10px] uppercase tracking-[0.4em] text-seal">Received</p>
            <h2
              className="mt-3 text-2xl text-ink"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Your message is with us.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              Received — keep this date for your records:
            </p>
            <p className="mt-2 text-sm text-ink">
              <time dateTime={receivedAt}>
                {new Date(receivedAt).toLocaleString(undefined, {
                  dateStyle: "long",
                  timeStyle: "short",
                })}
              </time>
            </p>
            <Link
              to="/"
              className="tap mt-8 inline-flex min-h-[44px] items-center border-y border-ink/20 px-1 text-[10px] uppercase tracking-[0.4em] text-ink hover:border-seal hover:text-seal"
            >
              Back to TravelDoss
            </Link>
          </section>
        ) : (
          <form onSubmit={onSubmit} className="mt-10 space-y-6" noValidate>
            <div className="space-y-2">
              <Label htmlFor="contact-email">Email</Label>
              <Input
                id="contact-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-name">Name (optional)</Label>
              <Input
                id="contact-name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-category">Category</Label>
              <select
                id="contact-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as ContactCategoryId)}
                className="tap flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-ink"
              >
                {CONTACT_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-message">Message</Label>
              <Textarea
                id="contact-message"
                required
                rows={8}
                maxLength={CONTACT_MESSAGE_MAX}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                aria-describedby="contact-message-count"
              />
              <p
                id="contact-message-count"
                className="text-right text-[11px]"
                style={{ color: "color-mix(in oklab, var(--tds-soft, currentColor) 78%, var(--tds-ink, currentColor))" }}
              >
                {message.length} / {CONTACT_MESSAGE_MAX}
              </p>
            </div>

            {/* Honeypot: hidden from humans and assistive tech, catnip for bots. */}
            <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
              <label htmlFor="contact-company">Company</label>
              <input
                id="contact-company"
                tabIndex={-1}
                autoComplete="off"
                value={trap}
                onChange={(e) => setTrap(e.target.value)}
              />
            </div>

            <div aria-live="polite" className="min-h-[1.25rem]">
              {error && <p className="text-[13px] text-seal">{error}</p>}
            </div>

            <Button type="submit" disabled={sending} className="min-h-[44px] w-full md:w-auto">
              {sending ? "Sending…" : "Send message"}
            </Button>
          </form>
        )}
      </main>
      <SiteFooter mobileNavClearance />
    </div>
  );
}
