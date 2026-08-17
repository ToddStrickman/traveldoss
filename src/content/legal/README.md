# Legal documents

Source of truth for every legal document TravelDoss publishes (`/terms`,
`/privacy`, `/disclaimer`). Pages render these markdown files directly —
no legal text lives in component code.

## Publishing a revision (no engineering required beyond this)

1. Copy the current file to a new version, e.g. `terms-v1.1.md`, and edit it.
   Keep the existing heading structure (`## 19. Limitation of Liability` etc.)
   — anchor links like `/terms#limitation-of-liability` derive from headings.
2. In `src/lib/legal/registry.ts`:
   - add a `?raw` import for the new file in the `CONTENT` map, and
   - update that document's entry: bump `version`, set `publishedAt` /
     `effectiveAt`, and paste the new `contentHash` (run
     `bun test src/lib/legal` — the failing integrity test prints the
     expected hash for the new content).
3. Keep the old `.md` file forever. Acceptance records reference the version
   and hash of the exact text a user agreed to; deleting old versions orphans
   those records.

Bumping the **terms** version automatically re-prompts every signed-in user
for acceptance on their next visit to the app (see `TermsGate` in
`src/routes/_authenticated.tsx`). Bumping `privacy`/`disclaimer` only updates
the public page.

## Rules

- Never edit a published version's text in place — the integrity unit test
  (`registry.test.ts`) fails if content changes without a version bump.
- Markdown subset: headings, lists, bold/italic, links, blockquotes, tables.
  Raw HTML is **not rendered** (react-markdown default: HTML in markdown is
  ignored), which is what keeps the pipeline XSS-safe.
