import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * Gmail → Google Doc import E2E.
 *
 * What this verifies end-to-end:
 *   1. The Gmail import panel lists candidate emails returned by the
 *      connector gateway (mocked here so the test is hermetic).
 *   2. Clicking "Import" hits importBookingEmail, which fetches the
 *      full message, creates a Google Doc, and persists a
 *      `trip_doc_previews` row.
 *   3. The dossier UI then renders an iframe pointing at the new
 *      Google Doc's /preview URL for the correct trip.
 *
 * Auth: server fns are gated by requireSupabaseAuth, so this spec needs
 * a real signed-in user. Set E2E_TEST_EMAIL / E2E_TEST_PASSWORD /
 * E2E_TRIP_SLUG in the environment to enable. Without them the suite
 * is skipped (so CI never fails for missing credentials).
 */

const EMAIL = process.env.E2E_TEST_EMAIL ?? "";
const PASSWORD = process.env.E2E_TEST_PASSWORD ?? "";
const TRIP_SLUG = process.env.E2E_TRIP_SLUG ?? "";

const HAS_CREDS = !!(EMAIL && PASSWORD && TRIP_SLUG);

test.describe.configure({ mode: "serial" });

test.skip(
  !HAS_CREDS,
  "Set E2E_TEST_EMAIL, E2E_TEST_PASSWORD, and E2E_TRIP_SLUG to run Gmail import E2E.",
);

const MOCK_EMAILS = [
  {
    id: "msg-flight-001",
    snippet: "Your United flight UA123 from SFO to JFK is confirmed",
    subject: "Flight Confirmation — UA123",
    from: "United Airlines <no-reply@united.com>",
    date: "Tue, 02 Sep 2025 09:00:00 +0000",
  },
  {
    id: "msg-hotel-001",
    snippet: "Your stay at Hotel Eden is booked for Oct 12–15",
    subject: "Reservation Confirmation — Hotel Eden",
    from: "Hotel Eden <reservations@hoteleden.it>",
    date: "Wed, 03 Sep 2025 14:30:00 +0000",
  },
];

const MOCK_DOC_ID = "doc_e2e_abc123";
const MOCK_DOC_URL = `https://docs.google.com/document/d/${MOCK_DOC_ID}/edit`;

type GatewayCounters = {
  docsCreate: number;
  docsBatchUpdate: number;
  gmailGetByMessageId: Record<string, number>;
};

async function installConnectorMocks(page: Page): Promise<GatewayCounters> {
  const counters: GatewayCounters = {
    docsCreate: 0,
    docsBatchUpdate: 0,
    gmailGetByMessageId: {},
  };
  // Intercept every connector-gateway call and serve canned responses.
  await page.route(
    "https://connector-gateway.lovable.dev/**",
    async (route: Route) => {
      const url = route.request().url();

      // Gmail: list messages
      if (/google_mail\/gmail\/v1\/users\/me\/messages\?/.test(url) && !/\/[A-Za-z0-9_-]+\?/.test(url.split("?")[0]!)) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            messages: MOCK_EMAILS.map((e) => ({ id: e.id, threadId: e.id })),
          }),
        });
      }

      // Gmail: get message (metadata or full)
      const msgMatch = url.match(/messages\/(msg-[a-z0-9-]+)/);
      if (msgMatch) {
        const fixture = MOCK_EMAILS.find((e) => e.id === msgMatch[1]);
        if (!fixture) {
          return route.fulfill({ status: 404, body: "not found" });
        }
        // Only count the full-format fetches (those are the ones that
        // would precede a Docs create). Metadata fetches happen during
        // the list step.
        if (/format=full/.test(url)) {
          counters.gmailGetByMessageId[fixture.id] =
            (counters.gmailGetByMessageId[fixture.id] ?? 0) + 1;
        }
        const body = `Booking confirmation for ${fixture.subject}.\n\nDay 1: arrive, check into Hotel Eden, dinner in Trastevere.\nDay 2: Colosseum, lunch at Roscioli.`;
        const b64 = Buffer.from(body, "utf-8")
          .toString("base64")
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "");
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: fixture.id,
            snippet: fixture.snippet,
            payload: {
              mimeType: "text/plain",
              body: { data: b64 },
              headers: [
                { name: "Subject", value: fixture.subject },
                { name: "From", value: fixture.from },
                { name: "Date", value: fixture.date },
              ],
            },
          }),
        });
      }

      // Google Docs: create document
      if (/google_docs\/v1\/documents$/.test(url) && route.request().method() === "POST") {
        counters.docsCreate += 1;
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ documentId: MOCK_DOC_ID, revisionId: "r1" }),
        });
      }

      // Google Docs: batchUpdate
      if (/:batchUpdate$/.test(url)) {
        counters.docsBatchUpdate += 1;
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ documentId: MOCK_DOC_ID, replies: [] }),
        });
      }

      // Anything else — let it through (mostly: the AI parser call goes to
      // ai.gateway.lovable.dev, not connector-gateway, so it isn't matched here).
      return route.continue();
    },
  );
  return counters;
}

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/app|\/t\//, { timeout: 15_000 });
}

test("imports a Gmail booking and embeds the Doc preview on the trip", async ({
  page,
}) => {
  const counters = await installConnectorMocks(page);
  await signIn(page);

  await page.goto(`/t/${TRIP_SLUG}?mode=edit`);

  // 1. Open the import panel and assert both mocked emails appear.
  await page.getByTestId("gmail-import-toggle").click();
  const list = page.getByTestId("gmail-import-list");
  await expect(list).toBeVisible();
  await expect(page.getByTestId(`gmail-email-${MOCK_EMAILS[0].id}`)).toBeVisible();
  await expect(page.getByTestId(`gmail-email-${MOCK_EMAILS[1].id}`)).toBeVisible();

  // 2. Click import on the flight confirmation.
  await page
    .getByTestId(`gmail-import-button-${MOCK_EMAILS[0].id}`)
    .click();

  // 3. Wait for the iframe to appear bound to the mocked doc.
  const iframe = page.getByTestId(`doc-preview-iframe-${MOCK_DOC_ID}`);
  await expect(iframe).toBeVisible({ timeout: 20_000 });
  await expect(iframe).toHaveAttribute(
    "src",
    new RegExp(`/document/d/${MOCK_DOC_ID}/preview`),
  );
  const initialSrc = await iframe.getAttribute("src");
  expect(initialSrc).toContain(`/document/d/${MOCK_DOC_ID}/preview`);

  // Snapshot counters after the first successful import. These are the
  // baseline we'll compare against after the re-import attempt.
  expect(counters.docsCreate).toBe(1);
  const baselineBatchUpdate = counters.docsBatchUpdate;
  const baselineGmailFullFetch =
    counters.gmailGetByMessageId[MOCK_EMAILS[0].id] ?? 0;
  expect(baselineGmailFullFetch).toBe(1);

  // 4. Re-import the SAME message. The server fn must short-circuit on
  //    `source_message_id` and return alreadyImported=true:
  //      - no new Google Doc is created (Docs:create count unchanged)
  //      - no new batchUpdate is issued
  //      - the Gmail full-message fetch is skipped entirely
  //      - the dossier keeps exactly one iframe pointing at the SAME
  //        documentId, with the same src attribute
  await page
    .getByTestId(`gmail-import-button-${MOCK_EMAILS[0].id}`)
    .click();

  // Give any in-flight request a chance to land before asserting.
  await page.waitForTimeout(1500);

  const iframes = page.locator(
    `[data-testid="doc-preview-iframe-${MOCK_DOC_ID}"]`,
  );
  await expect(iframes).toHaveCount(1);

  // The src (and therefore the embedded doc ID) must be byte-identical.
  const reimportSrc = await iframes.first().getAttribute("src");
  expect(reimportSrc).toBe(initialSrc);

  // No additional Docs API traffic should have occurred.
  expect(counters.docsCreate).toBe(1);
  expect(counters.docsBatchUpdate).toBe(baselineBatchUpdate);

  // And the server must not have re-fetched the Gmail message body.
  expect(counters.gmailGetByMessageId[MOCK_EMAILS[0].id] ?? 0).toBe(
    baselineGmailFullFetch,
  );

  // Belt-and-suspenders: only one trip_doc_previews row should be
  // surfaced for this doc id even after a full page reload.
  await page.reload();
  await expect(
    page.locator(`[data-testid="doc-preview-iframe-${MOCK_DOC_ID}"]`),
  ).toHaveCount(1);
  expect(counters.docsCreate).toBe(1);
});