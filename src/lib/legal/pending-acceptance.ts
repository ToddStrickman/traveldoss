/**
 * Bridge between the signup checkbox and the acceptance ledger.
 *
 * Email signups tick the Terms checkbox before any session exists (the
 * account may need email confirmation first), so the affirmative act is
 * stashed locally with its real timestamp and flushed to the server by
 * TermsGate on the first authenticated arrival. If the stash is lost
 * (cleared storage, different device), the gate simply shows the
 * acceptance interstitial instead — the user is never let through
 * without a recorded acceptance.
 */

const KEY = "td.pending-terms-acceptance";

export interface PendingAcceptance {
  version: string;
  acceptedAt: string;
}

export function stashPendingAcceptance(version: string): void {
  try {
    const pending: PendingAcceptance = { version, acceptedAt: new Date().toISOString() };
    localStorage.setItem(KEY, JSON.stringify(pending));
  } catch {
    // Storage unavailable (private mode etc.) — the TermsGate interstitial
    // will collect acceptance instead.
  }
}

export function readPendingAcceptance(): PendingAcceptance | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingAcceptance>;
    if (typeof parsed.version !== "string" || typeof parsed.acceptedAt !== "string") return null;
    return { version: parsed.version, acceptedAt: parsed.acceptedAt };
  } catch {
    return null;
  }
}

export function clearPendingAcceptance(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
