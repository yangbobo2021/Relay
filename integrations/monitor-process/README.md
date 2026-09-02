# Relay Process Monitor Capability

This extension supplies a read-only, identity-safe process status capability for
Agent-authored Relay Monitor Bundles. It deliberately does not add a prebuilt Bundle
Type: the Agent discovers no process type, issues an authorized Process Handle, and
uses the `relay-monitor-author` Skill to create a task-scoped Bundle.
