# Email Routing Fixtures

- [`cases.schema.json`](cases.schema.json) defines the executable fixture format.
- [`cases.json`](cases.json) is the initial regression suite and the source of truth
  for case descriptions and expected outcomes.

The suite exercises the whole ingestion and routing boundary. `deliver`, `escalate`, and
`dismiss` are router decisions. `deduplicate` is an ingestion result that must bypass
the router and produce no additional Delivery or inbox injection.

All people, companies, identifiers, and messages are invented. Email addresses use
reserved example domains. Never replace them with production messages or customer
data.

When adding a case:

1. Keep one behavioral reason for the case.
2. Include only the session context needed to make the expected decision.
3. Mark revenue, commitment, security, or task-progress events as `critical`.
4. Use `must_not_target_session_ids` to make dangerous false positives explicit.
5. Validate the file against the schema before committing it.
