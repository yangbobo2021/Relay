# Email Connector Delivery Acceptance Scenarios

| ID | Scenario | Evidence |
|---|---|---|
| EML-001 | First push establishes a durable cursor and creates no historical replay Event. | SQLite + protocol |
| EML-002 | Incremental push retrieves every added message and advances only after durable Events handling. | provider fake + SQLite |
| EML-003 | Failure after one message preserves the old cursor; retry deduplicates the first and delivers the remainder. | fault injection |
| EML-004 | Plain, HTML, multipart, Unicode, reply, empty subject, automated, and failure messages normalize bounded evidence. | sanitized fixtures |
| EML-005 | Attachment metadata is bounded; executable and oversized content is never downloaded or executed. | security fixtures |
| EML-006 | One thread artifact uses trusted binding; missing/ambiguous correlation uses ordinary routing. | Events composition |
| EML-007 | Shared Push token and Google Pub/Sub OIDC signature/issuer/audience/service-account/time claims, content type, payload size, Base64, account, and cursor errors fail closed and persist nothing. | protocol security |
| EML-008 | Provider duplicate notification/history/message replay creates one Event and Delivery. | SQLite composition |
| EML-009 | Authentication, permission, rate, 5xx, invalid JSON, network, and expired cursor are stable and redacted. | provider fake |
| EML-010 | Cursor restart resumes from the last committed value without mailbox loss. | process restart |
| EML-011 | Packed Email+Events+Router installs and boots in pristine official DSH. | official DSH |
| EML-012 | Invalid/expired cursor performs bounded resync, advances only after all Events, and preserves old cursor/status when resync exceeds 500 or fails. | provider fault + SQLite |
| EML-013 | Partial history-page rate/provider failure survives process restart and later delivers every message exactly once from the prior checkpoint. | real file restart |
| EML-014 | Concurrent push and poll reads overlap in production code yet converge to one Event per Gmail message and one final cursor. | concurrency composition |
| EML-015 | Forward, BCC, quoted history, lists, automated replies, delivery failures, encrypted/oversized/executable attachments, malformed dates/addresses, and hostile HTML normalize safely. | sanitized fixture matrix |
| EML-016 | Configure/revoke credentials and mailbox pause/resume/disconnect persist correctly, remain redacted, and work with complete English/Chinese accessible UI. | official DSH browser + SQLite |
