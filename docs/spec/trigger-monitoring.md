# Trigger Monitoring Specification

## Objective

Trigger Monitoring observes conditions that external systems cannot push to the
user's computer. During a normal DSH turn, the Agent may bind a Monitor to one of its
Waits. Relay runs the Monitor independently of Agent lifetime and emits a normal
durable Event when the condition is met.

Monitoring determines that something happened. It does not decide what the Agent
should do afterward.

## Records

`Monitor` describes the source, schedule, detector, ownership, capabilities, retry
policy, and lifecycle.

`MonitorVersion` is an immutable observer/detector artifact and capability manifest.
Changing generated code, selectors, or contracts creates a new version.

`MonitorCheck` records one observation attempt. `Observation` stores compact
structured source state. `Trigger` links one detected change to its emitted Event.

## Ownership

A bound Monitor belongs to one DSH Session and one active Wait. Its Event is delivered
to that owner without semantic routing. The first slice supports bound Monitors.

An unbound Monitor watches a shared source. Its Events require normal semantic
routing and are outside the first slice.

## Registration

The Agent registers a Monitor atomically with its Wait and declares:

- observation provider and schedule;
- detector and stable Event type;
- bound Wait;
- one-shot or recurring lifecycle;
- retry, degradation, failure, and optional expiry policy;
- minimum credentials and capabilities.

Relay validates ownership, artifact shape, capabilities, and one baseline Observation
before activation. Failed validation commits neither the new Wait set nor Monitor.
Monitor code never receives Relay database authority or unrelated credentials.

## Check And Trigger Flow

1. A local scheduler leases a due Monitor.
2. A restricted observer reads the source and returns structured data.
3. A deterministic detector compares it with the prior Observation.
4. Relay atomically stores the check, Observation, Trigger, Event, Delivery, and Wait
   claim.
5. Normal Relay delivery injects the Event into the existing DSH inbox.

Retries preserve Monitor and trigger identities. A stable trigger key prevents one
source change from emitting duplicate Events.

## Lifecycle

```text
one-shot:   validating -> active -> completed
recurring:  validating -> active -> triggered -> active
failure:    active -> degraded -> failed
other:      active -> expired | cancelled
```

A one-shot Monitor completes after its trigger. A recurring Monitor pauses in
`triggered`; after handling the Event, the Agent must register a replacement Wait and
explicitly rearm it. Cancelling or superseding a Wait cancels its Monitor unless that
same registration rearms it.

Monitor failure emits a visible `monitor.failed` Event but does not pretend the
business condition occurred or consume the business Wait.

## Source Strategies

Prefer the least fragile available mechanism:

1. webhook, callback, provider notification, or queue;
2. incremental feed or official API;
3. authenticated read-only polling;
4. browser observation for systems with no usable interface.

Email may use push/watch where practical and local polling as fallback. IM should use
bot webhooks or official streaming APIs. CI should use webhooks first and status APIs
second. Customer web systems may require a task-specific browser observer with a
versioned page contract.

## Generated Code Boundary

An Agent may propose task-specific observer code, but Relay must not execute it in the
main Agent or Relay process. Production execution requires a separate sandbox with a
narrow capability broker, read-only defaults, resource limits, network allowlists,
secret handles instead of raw secrets, immutable artifacts, and auditable output.

Until that boundary exists, only built-in declarative detectors and trusted observer
providers may activate. Arbitrary actions, unrestricted browser sessions, shell
access, outbound messaging, and mutation of customer systems are not Monitors.

## Built-In Timer

The first production-shaped source is a durable one-shot timer. The Agent supplies a
positive `after_seconds` delay and a continuation prompt. Relay stores the computed
UTC deadline as a bound Monitor, emits `timer.elapsed` when it becomes due, and
delivers it to the owning DSH Session without semantic routing. An overdue timer is
checked after Relay restarts, so the Session need not remain live while waiting.

This first slice does not include recurring schedules, calendar rules, or natural
language time parsing.

## Management

The Wait management surface exposes Monitor owner, condition, state, next and last
check, last trigger, error class, artifact version, and controls for pause/resume,
cancel, run-now, and opening the owning DSH conversation.

The first management slice lists live Wait registrations and Monitor health, opens
the owning conversation, cancels a Session's live waits, and forces a Monitor check.
Pause/resume follows only after its durable lifecycle transitions are specified.
