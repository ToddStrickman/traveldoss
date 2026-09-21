# Directive 08: Trip Collaboration (Shared Editing)

## 0. Agent Instructions (read first)

1. Saved as `docs/directives/08-collaboration.md`, alongside the existing directives.
2. Follow the project house rules, especially Rule 9: analytics events ship in the same change as the feature they measure.
3. Run the Section 2 Discovery read-only, and report what you find before writing any plan.
4. Plan and build **Phase 1 only**, then stop. Each later phase needs explicit approval before work starts.
5. Do not rename existing routes, tables, or components unless this directive says to. Where the codebase differs from an assumption in this directive, the codebase wins: adapt to it, and list the difference in the report.
6. Where this directive names a preferred mechanism, use it unless Discovery shows a clearly better fit. Explain any deviation.

### Decisions (defaults unless Todd changes them)

| Key | Default | Notes |
|---|---|---|
| MEMBER_ROLE_LABEL | "Co-planner" | User-facing name for the sub-admin role. Keep it in a single constant. The database role stays `editor`. |
| INVITE_EXPIRY_DAYS | 14 | |
| MEMBER_INVITE_POLICY_DEFAULT | require_approval | Set per trip. The creator can open it. |
| POLICY_PROMPT_TIMING | first_approval | Alternative `first_share_and_first_approval` also shows the toggle the first time the creator opens Share. |
| HISTORY_VISIBILITY | owner_only | Members see "Edited by" markers but not the history panel. |
| DELETE_NOTICE | in_app_plus_daily_email | Notify the owner when a member deletes a block the owner wrote. |
| CONTACT_SOURCE | google_people_other_contacts | Phase 4 only. Never read Gmail message content. |

## 1. Goal

Today, each dossier has a single owner. This directive adds shared editing with two access tiers:

- **Share link:** view-only for everyone, always.
- **Email invite:** the recipient becomes a sub-admin with full editing rights. Every edit is attributed by name, and the trip creator can restore anything.

People named in a trip are invited automatically once the creator confirms, so the creator never has to send separate emails.

| Capability | Owner (trip creator) | Sub-admin (member) | Link viewer |
|---|---|---|---|
| View dossier | Yes | Yes | Yes |
| Add, edit, or delete any block, including the owner's | Yes | Yes | No |
| Invite new sub-admins | Yes, sends immediately | Yes, queued for approval unless the trip's policy is open | No |
| Approve or decline pending invites | Yes | No | No |
| View history and restore | Yes | No (per HISTORY_VISIBILITY) | No |
| Remove members, change invite policy | Yes | No | No |
| Publish, mint, pay, renew, change skin, change visibility, delete trip | Yes | No | No |

## 2. Discovery (read-only; report before planning)

1. How trip ownership is stored (column name), and the current RLS policies on `trips`.
2. Every code path that writes `trips.content`: inline editor, generate, paste, upload, Gmail import, guide clone ("Make this yours"), the MCP `create_trip` tool, and any other found.
3. Whether every block in `content.blocks` has a stable id, and which creation paths assign one.
4. Whether `trip_revisions` (Directive 07, migration M3) exists, and its shape.
5. What the Share button does today, which route the link opens, and whether any link or route can grant editing.
6. The edit route, and how it is guarded.
7. The existing Resend integration and any email templates.
8. The existing Google OAuth setup used for Gmail import: the client, the scopes it requests, and whether the app is verified or still in testing mode.
9. Whether a trip lifecycle status exists (draft, live, locked) or only `visibility`, `locked_at`, and `expires_at`.
10. Whether `src/lib/analytics.ts` and `analytics.server.ts` exist, and which share events are already defined.
11. Which field in `profiles` holds a display name that can be used for attribution.

## 3. Requirements (non-negotiable)

- **R1. The share link is view-only.** No link, token, or route opened through Share grants editing, whether or not the visitor is signed in. The link also respects the trip's existing visibility setting.
- **R2. No edit goes unattributed.** Every content change, from every write path, produces a change-log row with an actor. Logging ships in Phase 1, before any member can edit.
- **R3. Every delete is restorable.** A deleted block, with its original position, is recoverable from the change log for the life of the trip.
- **R4. Owner-only actions are enforced on the server,** not just hidden in the interface. The interface hides them from members rather than showing them disabled.
- **R5. Member rights follow the trip's lifecycle.** When a trip is locked or expired, members are read-only, the same as the owner.
- **R6. Invites send from TravelDoss** through the existing Resend integration, never from a user's mailbox.
- **R7. Named-traveler invites require confirmation.** They never send without the owner's confirmation tap. After that tap, those travelers skip the approval gate.
- **R8. Invite tokens are locked down.** Each token is single-use, bound to one email address, hashed at rest, and expires after INVITE_EXPIRY_DAYS. Accepting requires signing in as that exact address.
- **R9. Contact lookup lives behind one function,** `findContactEmails()`, in a single module. If its configuration is missing, it disables gracefully and falls back to manual email entry.
- **R10. No PII in analytics.** No emails, names, or trip content in any event property.

## 4. Data Model (preferred shape; adapt to Discovery)

**`trip_members`**
- Fields: id, trip_id, user_id (null until accepted), email, role (owner | editor), status (invited | pending_approval | active | removed | declined), source (owner | creator_invite | member_invite | named_in_trip), invited_by, created_at, joined_at.
- One row per trip per email address.
- Backfill one owner row for every existing trip.

**`trip_invites`**
- Fields: id, trip_id, email, token_hash, invited_by, expires_at, accepted_at, revoked_at.

**`trip_changes`**
- Fields: id, trip_id, actor_id, actor_kind (user | system), block_id, action (add | edit | delete | restore), before (jsonb), after (jsonb), position (index and previous sibling block id), restores_change_id, created_at.
- If `trip_revisions` exists, use it for point-in-time snapshots, and use `trip_changes` for per-block attribution. Do not build two overlapping histories.

**`trips` (new columns)**
- member_invite_policy (require_approval | open)
- invite_policy_prompted (boolean)
- detected_travelers (jsonb, names only; Phase 4)
- Per-block version tracking, if needed for Phase 2 concurrency.

**Block ids**
- If blocks lack stable ids, add a UUID to each through a backfill migration.
- Ensure every creation path assigns ids going forward.

**RLS**
- Add a helper, `is_trip_member(trip_id, roles[])`.
- `trips`: active members can read and update content. Existing public rules stay as they are.
- `trip_members`: active members can read the active member list. The owner can read all rows, including pending ones.
- `trip_changes`: readable per HISTORY_VISIBILITY. Writes happen only through the logging mechanism.
- `trip_invites`: no client read access. Accepting happens through a server function.

## 5. Phases

### Phase 1: Foundation (no member editing yet)

**Scope**
- **Migrations** for the Section 4 tables and columns, the owner backfill, and the block-id backfill.
- **Attribution logging.** Preferred mechanism: a Postgres trigger on `trips` that diffs `content.blocks` by block id and inserts one `trip_changes` row per added, edited, or deleted block, with actor = `auth.uid()`.
  - Server-side writes that run with elevated privileges must set the actor for their transaction (for example, `set_config('app.actor_id', ...)`).
  - Writes with no human behind them are logged with actor_kind = system.
  - No row may have an unknown actor.
- **Deletes.** Do not add deleted flags to blocks. A delete removes the block from content; its `trip_changes` row keeps the full block and its position, which is what makes it restorable.
- **Share sheet.** Label the link option "Copy view-only link" and audit R1.

**Acceptance**
- Every existing trip has exactly one owner row.
- An owner edit through any write path found in Discovery produces correctly attributed `trip_changes` rows.
- A signed-out visitor, and a signed-in non-member, can open the share link read-only. A direct update attempt from either of their sessions is denied by RLS.
- Owners see no change other than the Share sheet label.

### Phase 2: Creator Invites, Member Editing, History, Restore

**Scope**
- **"Invite to edit" in the Share sheet.** Accepts multiple addresses. Owner invites send immediately.
- **Invite email** through Resend, in the neutral app style used for account emails.
  - Subject: "{inviter} invited you to plan {trip title}".
  - Button: "Join the trip".
- **Accept route `/invite/$token`.**
  - Shows the trip title, cover, and inviter name.
  - The recipient signs in by magic link as the invited address. If already signed in as a different address, explain the mismatch and offer to switch accounts.
  - On acceptance, the membership becomes active and the member lands in the editor.
- **Member editing.** Members get the full editor, minus owner-only actions (R4).
- **"Edited by {name}" marker** on any block whose latest change came from someone other than the owner.
  - Shows in the editor only, never on the public dossier.
  - Styled with the trip's skin tokens.
- **Concurrency.** Each block carries a version.
  - A save based on a stale version is rejected.
  - The member sees "{name} changed this since you opened it", with options to reload or keep their own version. Keeping their own version is still logged.
- **Members panel (owner).** Lists each member's name, source, status, and join date, with an option to remove them.
- **History panel (owner).**
  - Changes in time order, filterable by person, each with a before-and-after preview.
  - "Restore" on each change returns a deleted block to its original position.
  - "Roll back to here" restores the whole trip to a point in time.
  - Restores are logged, so they can be undone.
- **Delete notice** per DELETE_NOTICE, with one-tap restore.
- **Member entry point.** A "Start your own dossier" link in the member view.

**Acceptance**
- The full loop works: invite, accept, edit, and the owner sees the marker, the history row, and a working restore.
- When a member deletes an owner block, the owner is notified, and one tap restores the block to its original position.
- Tokens are single-use, bound to one address, and expire on schedule. A revoked token fails.
- An owner-only action called directly by a member is rejected by the server.
- Members are read-only on a locked or expired trip.

### Phase 3: Member-Sent Invites and Approval

**Scope**
- **Member invites** from the Share sheet.
  - Under `require_approval`: the invite is stored as pending_approval, and the member sees "Sent to {owner} for approval". The owner gets an in-app badge and an email with Approve and Decline.
    - Approve: the invite email sends.
    - Decline: the member sees it was declined, and no email reaches the invitee.
  - Under `open`: member invites send immediately.
- **One-time policy prompt** on the owner's first approval: "Let people on this trip add others without your approval?"
  - The answer sets member_invite_policy, and invite_policy_prompted becomes true.
  - The setting stays editable in trip settings.
- **Revoking.** The owner can revoke any pending invite.

**Acceptance**
- Under require_approval, no email goes out before the owner approves.
- Under open, member invites send immediately.
- The policy prompt appears exactly once per trip.

### Phase 4: Auto-Add Named Travelers

**Discovery first**
- Confirm Google's verification tier for `contacts.other.readonly` and `contacts.readonly`, and report it before building.
- If either scope requires a third-party security assessment, stop and report.

**Scope**
- **Extraction.** On every trip creation path, extract traveler names from the trip text, excluding the creator, and store them in `detected_travelers` pending confirmation.
- **`findContactEmails(names)`.** Uses the Google People API, searching other contacts plus saved contacts. For each name it returns one match, several candidates, or no match.
- **Confirmation card** in the editor after creation:
  - Each traveler appears with their matched address, a picker when there are several candidates, or an input when there is no match.
  - One button: "Invite {n} travelers". Nothing sends before this tap.
- **Confirmed travelers** join as sub-admins with source named_in_trip, and skip the approval gate.
- **If Google contacts are not connected,** the card offers "Find their emails" (connect Google) or manual entry.
- **MCP-created trips** show the same card the next time the owner opens the editor. Nothing sends from the MCP path.

**Acceptance**
- No named-traveler invite sends without the confirmation tap.
- Ambiguous matches always require a choice.
- With contact lookup disabled, manual entry still works end to end.

## 6. Analytics (Rule 9; object_verb snake_case; standard trip context props)

- **Sharing:** Reuse `share_sheet_opened` and `share_link_copied` if they already exist; otherwise create them.
- **Invites:**
  - invite_sent {source: creator | member | named_traveler, count}
  - invite_approval_requested
  - invite_approved
  - invite_declined
  - invite_revoked
  - invite_accepted {source, days_to_accept}
- **Policy:** invite_policy_set {policy, surface: prompt | settings}
- **Editing and history:**
  - member_edit_made {action: add | edit | delete}
  - change_restored {mode: single | point_in_time}
  - edit_conflict_shown
- **Named travelers:**
  - travelers_detected {count}
  - travelers_confirmed {sent_count, manual_count}
  - contacts_connected
- **Growth loop:** member_started_own_trip

Update the tracking-plan doc in the same commit as each event.

## 7. Tests (end-to-end)

- Share link access is read-only, and RLS denies direct writes from link viewers.
- Every write path produces attributed change rows.
- Single restore and point-in-time rollback both work, and restores can themselves be undone.
- Tokens: single-use, bound to one address, expiry, and revocation.
- Member invite approval gate under both policies.
- Owner-only actions are rejected on the server for members.
- Members are read-only on a locked or expired trip.
- Named-traveler invites never send without confirmation.

## 8. Out of Scope

- Live co-presence or cursors
- Comments or chat
- Per-block permissions
- Ownership transfer
- Members paying for mints or renewals
- View-only invites (view-only access is the link)
- Notifications beyond those specified here
