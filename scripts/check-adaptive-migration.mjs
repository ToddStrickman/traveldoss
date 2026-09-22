/**
 * Run against a disposable in-memory Postgres, never the configured Supabase.
 * bun run scripts/check-adaptive-migration.mjs <absolute path to @electric-sql/pglite/dist/index.js>
 */
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const a = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  b = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
let checks = 0;
await db.exec(
  "create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated; create table public.trips(id uuid primary key);",
);
await db.exec(
  await readFile(
    new URL("../supabase/migrations/20260921120000_adaptive_trip_dossier.sql", import.meta.url),
    "utf8",
  ),
);
await db.query("insert into auth.users(id) values ($1),($2)", [a, b]);
const state = JSON.stringify({
  schemaVersion: 1,
  items: [],
  sources: [],
  versions: [],
  notifications: [],
});
await db.query(
  "insert into adaptive_workspaces(user_id,state) values ($1,$3::jsonb),($2,$3::jsonb)",
  [a, b, state],
);
await db.query("select set_config('request.jwt.claim.sub',$1,false)", [a]);
await db.exec("set role authenticated");
let rows = await db.query("select user_id from adaptive_workspaces");
assert.deepEqual(
  rows.rows.map((r) => r.user_id),
  [a],
);
checks++;
for (const sql of [
  "select * from adaptive_email_accounts",
  "select * from adaptive_oauth_states",
  "select * from adaptive_push_subscriptions",
  "update adaptive_workspaces set revision=100",
  "select adaptive_compare_and_swap('" + a + "',0,'{}')",
  "select * from adaptive_claim_jobs(5)",
]) {
  await assert.rejects(db.exec(sql));
  checks++;
}
await db.exec("reset role; set role anon");
await assert.rejects(db.exec("select * from adaptive_workspaces"));
checks++;
await db.exec("reset role; set role service_role");
rows = await db.query("select adaptive_compare_and_swap($1,0,$2::jsonb) as revision", [a, state]);
assert.equal(rows.rows[0].revision, 1);
checks++;
rows = await db.query("select adaptive_compare_and_swap($1,0,$2::jsonb) as revision", [a, state]);
assert.equal(rows.rows[0].revision, null);
checks++;
rows = await db.query("select * from adaptive_claim_jobs(1)");
assert.equal(rows.rows.length, 1);
checks++;
const first = rows.rows[0].user_id;
rows = await db.query("select * from adaptive_claim_jobs(5)");
assert.equal(rows.rows.length, 1);
assert.notEqual(rows.rows[0].user_id, first);
checks++;
rows = await db.query(
  "insert into adaptive_email_accounts(user_id,provider,email,sync) values($1,'gmail','one@example.test','{}') returning id",
  [a],
);
const account = rows.rows[0].id;
rows = await db.query("select adaptive_claim_account($1,$2,gen_random_uuid()) as claimed", [
  account,
  b,
]);
assert.equal(rows.rows[0].claimed, false);
checks++;
rows = await db.query("select adaptive_claim_account($1,$2,gen_random_uuid()) as claimed", [
  account,
  a,
]);
assert.equal(rows.rows[0].claimed, true);
checks++;
rows = await db.query("select adaptive_claim_account($1,$2,gen_random_uuid()) as claimed", [
  account,
  a,
]);
assert.equal(rows.rows[0].claimed, false);
checks++;
rows = await db.query("select adaptive_lock_account($1,$2,gen_random_uuid()) as claimed", [
  account,
  a,
]);
assert.equal(rows.rows[0].claimed, false);
checks++;
rows = await db.query(
  "select adaptive_connect_account($1,'one@example.test','encrypted-new','{}') as connected",
  [a],
);
assert.equal(rows.rows[0].connected, false);
checks++;
await db.query(
  "update adaptive_email_accounts set lease_until=now()-interval '1 minute',status='disconnected' where id=$1",
  [account],
);
rows = await db.query("select adaptive_claim_account($1,$2,gen_random_uuid()) as claimed", [
  account,
  a,
]);
assert.equal(rows.rows[0].claimed, false);
checks++;
rows = await db.query("select adaptive_lock_account($1,$2,gen_random_uuid()) as claimed", [
  account,
  b,
]);
assert.equal(rows.rows[0].claimed, false);
checks++;
rows = await db.query("select adaptive_lock_account($1,$2,gen_random_uuid()) as claimed", [
  account,
  a,
]);
assert.equal(rows.rows[0].claimed, true);
checks++;
await db.query("update adaptive_email_accounts set lease_until=null where id=$1", [account]);
rows = await db.query(
  "select adaptive_connect_account($1,'one@example.test','encrypted-new','{}') as connected",
  [a],
);
assert.equal(rows.rows[0].connected, true);
checks++;
rows = await db.query(
  "select id,status,encrypted_tokens from adaptive_email_accounts where id=$1",
  [account],
);
assert.equal(rows.rows[0].status, "connected");
assert.equal(rows.rows[0].encrypted_tokens, "encrypted-new");
checks++;
console.log(
  "Adaptive migration: " +
    checks +
    " checks passed (ownership, grants, atomic revision, account/job leases).",
);
await db.close();
