/**
 * Pending-composer persistence: what the user had typed into the mint modal
 * when the login wall interrupted them. Saved before redirecting to /login,
 * restored when the modal reopens, so pasted itineraries and generate
 * prompts survive the round trip.
 *
 * localStorage (not sessionStorage) on purpose: signup requires an email
 * confirmation whose link commonly opens in a NEW tab, where sessionStorage
 * from the original tab does not exist. A TTL keeps stale drafts from
 * resurfacing weeks later.
 */

export type PendingComposer = {
  v: 1;
  templateId: string;
  tab: "paste" | "transcript" | "generate";
  text: string;
  genPrompt: string;
  savedAt: number;
};

const KEY = "td_pending_composer_v1";
const TTL_MS = 24 * 3600 * 1000;
/** Keep well under localStorage quotas even for huge pastes. */
const MAX_TEXT = 200_000;

export function savePendingComposer(
  state: Omit<PendingComposer, "v" | "savedAt">,
): void {
  try {
    const payload: PendingComposer = {
      v: 1,
      ...state,
      text: state.text.slice(0, MAX_TEXT),
      genPrompt: state.genPrompt.slice(0, MAX_TEXT),
      savedAt: Date.now(),
    };
    window.localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // Quota/privacy-mode failures must never block the login redirect.
  }
}

/** Read without consuming; clears and returns null when invalid or expired. */
export function peekPendingComposer(): PendingComposer | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingComposer;
    if (
      parsed?.v !== 1 ||
      typeof parsed.templateId !== "string" ||
      typeof parsed.text !== "string" ||
      typeof parsed.genPrompt !== "string" ||
      Date.now() - parsed.savedAt > TTL_MS
    ) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingComposer(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
