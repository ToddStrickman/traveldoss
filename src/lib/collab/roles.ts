/**
 * Shared-editing constants (Directive 08 decision table). One place so the
 * user-facing role name and the invite lifetime never drift between the
 * database, the server functions, and the panels.
 */

/** User-facing name for the `editor` database role. */
export const MEMBER_ROLE_LABEL = "Co-planner";

/** Invite tokens expire after this many days. */
export const INVITE_EXPIRY_DAYS = 14;

export type MemberRole = "owner" | "editor";
export type MemberStatus = "invited" | "pending_approval" | "active" | "removed" | "declined";

/** Invite link for a raw (unhashed) token. */
export function inviteUrl(origin: string, token: string) {
  return `${origin.replace(/\/$/, "")}/invite/${token}`;
}
