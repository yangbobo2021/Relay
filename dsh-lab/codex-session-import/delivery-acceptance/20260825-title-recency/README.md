# Imported Title And Recency Regression Acceptance

This run used an isolated DSH Home, the unmodified official DSH checkout, the built
Codex plugin, and the local real Codex App Server. It imported the complete Relay
Workspace and inspected `session.list` before opening any imported Session.

The initial run was rejected because `thread/read.updatedAt` disagreed with Codex
inventory for older Threads. The corrected run uses `thread/list.updatedAt` as the
source-recency authority. It passed immediate-title, exact stable-timestamp, ordering,
and cold-restart checks. Only aggregate results are retained so real Thread IDs and
conversation titles do not enter the repository.
