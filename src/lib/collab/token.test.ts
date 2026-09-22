import { describe, expect, it } from "bun:test";
import { hashInviteToken, newInviteToken, normalizeEmail } from "./token.server";
import { INVITE_EXPIRY_DAYS, inviteUrl, MEMBER_ROLE_LABEL } from "./roles";

describe("invite tokens", () => {
  it("mints distinct, URL-safe tokens", () => {
    const a = newInviteToken();
    const b = newInviteToken();
    expect(a).not.toBe(b);
    expect(a).toHaveLength(32);
    expect(a).toMatch(/^[A-Za-z0-9]+$/);
  });

  it("hashes deterministically and irreversibly", async () => {
    const token = newInviteToken();
    const once = await hashInviteToken(token);
    const twice = await hashInviteToken(token);
    expect(once).toBe(twice);
    expect(once).toHaveLength(64);
    expect(once).not.toContain(token);
  });

  it("different tokens never collide", async () => {
    const hashes = new Set<string>();
    for (let i = 0; i < 20; i++) hashes.add(await hashInviteToken(newInviteToken()));
    expect(hashes.size).toBe(20);
  });

  it("binds addresses case- and space-insensitively", () => {
    expect(normalizeEmail("  Anna@Example.COM ")).toBe("anna@example.com");
  });
});

describe("collab constants", () => {
  it("keeps the co-planner label and expiry in one place", () => {
    expect(MEMBER_ROLE_LABEL).toBe("Co-planner");
    expect(INVITE_EXPIRY_DAYS).toBe(14);
  });

  it("builds an invite link without a double slash", () => {
    expect(inviteUrl("https://traveldoss.com/", "abc123xyz")).toBe("https://traveldoss.com/invite/abc123xyz");
  });
});
