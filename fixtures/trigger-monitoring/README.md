# Trigger Monitoring Fixtures

- [`cases.schema.json`](cases.schema.json) defines the state-transition fixture
  format.
- [`cases.json`](cases.json) contains the first bound Monitor acceptance cases.

Each case begins with an active Wait, one Monitor registration, and its committed
baseline Observation. Steps then check a source or rearm a recurring Monitor. The
expected state after every step makes duplicate suppression and failure visibility
executable without using a real customer system.

Fixture observers and origins are invented. Do not add customer URLs, selectors,
cookies, credentials, page content, screenshots, or production diagnostics.
