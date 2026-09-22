# Fix invitation acceptance and long-itinerary parsing

## Invitation acceptance
- Add a forward database migration that replaces the expression-only member uniqueness with a real `(trip_id, email)` unique constraint while preserving case-insensitive behavior by normalizing stored emails to lowercase.
- Keep both invite creation and acceptance on the same conflict target, and stop immediately if roster insertion fails so an invitation cannot appear successful without a member row.
- Add regression tests covering schema compatibility and error handling.

## Long-itinerary parsing
- Move the existing parser call from the deprecated capped Gemini path to the assigned `openai/gpt-6-astra` Responses API using streaming, required reasoning settings, stateless request options, and gateway run-ID propagation.
- Consume the stream server-side, remove the 8,192-token truncation point, and do not retry unchanged malformed/truncated output; retain bounded retry behavior only for retryable gateway statuses.
- Update concise note synthesis to use the same streaming Responses path and current structured-output contract.
- Add a deterministic long-output regression test and run one live parser request through the real server implementation.

## Verification
- Apply the database migration and verify the resulting constraint.
- Run collaboration, parser, type, and full Vitest checks; verify the invite acceptance flow in the browser when an authenticated test session is available.
- Resolve each monitoring finding only after its relevant verification passes.

## Technical details
- No existing migration will be edited; deployed databases receive a new corrective migration.
- Existing user-facing routes and fallback behavior remain unchanged except that deterministic output truncation no longer triggers repeated identical attempts.
