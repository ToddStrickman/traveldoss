import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/20260922194117_8fd33f7b-caa9-42e4-aaa6-1a36610250c0.sql", import.meta.url),
  "utf8",
);
const constraintMigration = readFileSync(
  new URL("../supabase/migrations/20260922194039_77c09745-9b1f-4f9c-9342-6e5f8acb2a04.sql", import.meta.url),
  "utf8",
);

describe("invitation acceptance migration", () => {
  test("provides a plain conflict target and canonical email guard", () => {
    expect(constraintMigration).toContain("UNIQUE (trip_id, email)");
    expect(constraintMigration).toContain("email = lower(btrim(email))");
    expect(constraintMigration).toContain("trip_invites_one_live_email_key");
  });

  test("keeps invitation state transitions atomic and server-only", () => {
    expect(migration).toContain("CREATE FUNCTION public.create_trip_invite");
    expect(migration).toContain("CREATE FUNCTION public.accept_trip_invite");
    expect(migration).toContain("FOR UPDATE");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.accept_trip_invite(uuid, text) TO service_role");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.accept_trip_invite(uuid, text) FROM PUBLIC, anon, authenticated");
  });
});