# Relay Process Monitor Capability Specification

Status: Development delivery specification

This extension does not register a prebuilt Bundle Type. It registers the read-only
`process.read/status` capability and `relay_issue_process_handle` tool so an Agent can
author a temporary custom Bundle for a process-exit condition.

A Handle is HMAC-authenticated and binds a persistent host identity, PID, operating-
system process start identity, owner Session, and canonical project root. Issuance
requires the process to belong to the Host user and have a working directory within
the current project. Raw PID, forged Handle, cross-Session/project use, unverifiable
identity, and PID reuse fail closed. PID reuse is `identity_lost`, not `exited`.

The provider exposes no kill, signal, command, environment, filesystem, or process
output operation. Exit code is explicitly unavailable unless a future supervisor
provider owns reliable evidence.
