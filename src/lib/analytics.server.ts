/**
 * Server-side analytics. Money and lifecycle transitions are captured here
 * only — never trusted from the client. No-ops when POSTHOG_KEY is absent.
 * Must only be imported from server function handlers.
 */
type Props = Record<string, string | number | boolean | null | undefined>;

export async function captureServer(
  event: string,
  distinctId: string,
  props: Props = {},
): Promise<void> {
  const apiKey = process.env["POSTHOG_KEY"];
  if (!apiKey) return;
  const apiHost = process.env["POSTHOG_HOST"] ?? "https://us.i.posthog.com";
  try {
    await fetch(`${apiHost}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        event,
        distinct_id: distinctId,
        properties: props,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    // Analytics must never fail the request that produced the event.
  }
}
