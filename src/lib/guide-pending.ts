/**
 * Pending guide clone: an anonymous visitor tapped "Make this yours", so the
 * intent is parked before the login redirect and replayed when they land back
 * on the guide signed in. Same localStorage + TTL shape as mint-pending, for
 * the same reason: email confirmation often opens in a new tab.
 */
export type PendingGuideClone = { v: 1; slug: string; savedAt: number };

const KEY = "td_pending_guide_clone_v1";
const TTL_MS = 24 * 3600 * 1000;

export function savePendingGuideClone(slug: string): void {
  try {
    const payload: PendingGuideClone = { v: 1, slug, savedAt: Date.now() };
    window.localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // Quota/privacy-mode failures must never block the login redirect.
  }
}

export function takePendingGuideClone(): string | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    window.localStorage.removeItem(KEY);
    const parsed = JSON.parse(raw) as PendingGuideClone;
    if (parsed?.v !== 1 || typeof parsed.slug !== "string") return null;
    if (Date.now() - parsed.savedAt > TTL_MS) return null;
    return parsed.slug;
  } catch {
    return null;
  }
}
