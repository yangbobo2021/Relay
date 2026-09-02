# Relay Time Monitor Bundle Extension Specification

Status: Development delivery specification

This independently installable extension owns the `time.deadline` Bundle Type,
`clock.read` trusted Observer/Detector provider, `timer.elapsed` Event proposal, and
`relay_schedule_timer` convenience tool. Monitor Core owns none of those identifiers
or their implementation.

The extension accepts one positive whole-second relative delay or one explicitly
zoned RFC3339 deadline. It resolves and persists UTC deadline plus original intent,
records a baseline, emits one stable trigger after the deadline, and binds ownership
to the authenticated root Agent's Session. It reads only the host clock and requests
no files, network, process, browser, or credentials.

Installing or unloading the extension atomically adds or removes its Bundle Type,
provider, and tool. Persisted timers remain in Events; checks cannot execute while
the provider is absent and can recover after a compatible reinstall.

Both `relay_schedule_timer` and Core's generic
`relay_create_monitor_from_type(type_id=time.deadline)` call the same public registry
instantiation path before Events performs baseline and atomic commit.
