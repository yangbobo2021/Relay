# Monitor Runtime

This package implements Relay's local bound-Monitor slice on the shared SQLite store.

It validates Agent-authored Monitor proposals and captures a baseline before atomic
Wait registration. Due checks are lease protected; deterministic detectors commit
Observation, Trigger, Event, Delivery, and Wait claim together. One-shot Monitors end
after delivery, recurring Monitors pause until the Agent registers a replacement Wait
and explicitly rearms them, and failures remain visible through `monitor.failed`.

Attach a `MonitorRuntime` as `RelayRuntime.monitorRegistrar` for registration and give
the checking instance a `RelayRuntime` to dispatch triggered Events into the existing
DSH inbox.

Observers are injected. Current tests use sanitized fixtures and do not execute
generated JavaScript, browser automation, customer credentials, or network calls.
Those require the sandbox and capability broker in the
[Monitor Specification](../../docs/spec/trigger-monitoring.md#generated-code-boundary).
