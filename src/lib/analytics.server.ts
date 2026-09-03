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
  // POSTHOG_API_KEY / POSTHOG_REGION come from the PostHog connector;
  // POSTHOG_KEY / POSTHOG_HOST remain supported as manual overrides.
  const apiKey = process.env["POSTHOG_KEY"] ?? process.env["POSTHOG_API_KEY"];
  if (!apiKey) return;
  const region = process.env["POSTHOG_REGION"] === "eu" ? "eu" : "us";
  const apiHost = process.env["POSTHOG_HOST"] ?? `https://${region}.i.posthog.com`;
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
