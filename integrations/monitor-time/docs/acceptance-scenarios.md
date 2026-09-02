# Relay Time Monitor Bundle Delivery Scenarios

| ID | Scenario | Required result | Evidence |
| --- | --- | --- | --- |
| MB05-001 | Core separation | Core contains no Time implementation or timer tool. | cross-package static test |
| MB05-002 | Extension discovery | Install adds localized type, Event, capability, provider, and tool; unload removes them. | registry + lifecycle + pack |
| MB05-003 | Relative deadline | Positive whole seconds resolve to UTC and bind to the authenticated Session. | unit + composition |
| MB05-004 | Absolute deadline | Timezone, calendar, future/immediate, overflow, Unicode, and mutual exclusion are explicit. | boundary unit |
| MB05-005 | Restart and clock movement | Overdue restart fires once; backward time is early-safe and forward time deduplicates. | SQLite restart |
| MB05-006 | Unload/reinstall | Missing provider is visible and compatible reinstall resumes without replay. | official DSH lifecycle |
| MB05-007 | Migration | Pre-platform timers retain identity, Wait, continuation, baseline, and deadline. | migration fixture |
| MB05-008 | Uninstall UI | Catalog/tool disappear while history remains understandable in both locales. | browser |
