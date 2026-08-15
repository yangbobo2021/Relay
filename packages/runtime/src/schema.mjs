export const SCHEMA_VERSION = 4;

export const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS relay_schema (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS runtime_counters (
    name TEXT PRIMARY KEY,
    value INTEGER NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    state TEXT NOT NULL CHECK (state IN (
      'created', 'running', 'waiting', 'completed', 'failed', 'cancelled'
    )),
    task_summary TEXT NOT NULL,
    context_json TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    lease_owner TEXT,
    lease_expires_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS activations (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('start', 'event')),
    state TEXT NOT NULL CHECK (state IN ('active', 'committed')),
    delivery_ids_json TEXT NOT NULL,
    provisional_outcome_json TEXT,
    provisional_at TEXT,
    lease_owner TEXT,
    lease_expires_at TEXT,
    accepted_at TEXT,
    last_error TEXT,
    committed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;

  CREATE UNIQUE INDEX IF NOT EXISTS activations_one_active_per_session
    ON activations(session_id)
    WHERE state = 'active';

  CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    activation_id TEXT NOT NULL REFERENCES activations(id),
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('start', 'event')),
    state TEXT NOT NULL CHECK (state IN ('running', 'completed', 'failed')),
    delivery_ids_json TEXT NOT NULL,
    outcome_json TEXT,
    error TEXT,
    started_at TEXT NOT NULL,
    finished_at TEXT
  ) STRICT;

  CREATE TABLE IF NOT EXISTS waits (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    phase TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN (
      'active', 'claimed', 'consumed', 'superseded', 'cancelled'
    )),
    exclusive INTEGER NOT NULL CHECK (exclusive IN (0, 1)),
    exclusive_owner_key TEXT,
    wait_card_json TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;

  CREATE UNIQUE INDEX IF NOT EXISTS waits_live_exclusive_owner
    ON waits(exclusive_owner_key)
    WHERE exclusive_owner_key IS NOT NULL
      AND status IN ('active', 'claimed');

  CREATE INDEX IF NOT EXISTS waits_session_status
    ON waits(session_id, status);

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    source_event_id TEXT,
    fingerprint TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN (
      'received', 'routing', 'dispatched', 'resolved'
    )),
    version INTEGER NOT NULL DEFAULT 0,
    received_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;

  CREATE UNIQUE INDEX IF NOT EXISTS events_source_identity
    ON events(source, source_event_id)
    WHERE source_event_id IS NOT NULL;

  CREATE UNIQUE INDEX IF NOT EXISTS events_source_fingerprint
    ON events(source, fingerprint);

  CREATE TABLE IF NOT EXISTS routing_attempts (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES events(id),
    pass TEXT NOT NULL,
    router TEXT NOT NULL,
    model TEXT,
    output_json TEXT,
    usage_json TEXT,
    error TEXT,
    created_at TEXT NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS routing_decisions (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL UNIQUE REFERENCES events(id),
    disposition TEXT NOT NULL CHECK (disposition IN ('deliver', 'escalate', 'dismiss')),
    actionable INTEGER NOT NULL CHECK (actionable IN (0, 1)),
    summary TEXT NOT NULL,
    evidence_json TEXT NOT NULL,
    decision_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS deliveries (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES events(id),
    session_id TEXT NOT NULL REFERENCES sessions(id),
    state TEXT NOT NULL CHECK (state IN ('queued', 'running', 'resolved', 'failed')),
    run_id TEXT REFERENCES runs(id),
    relation TEXT NOT NULL,
    confidence REAL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(event_id, session_id)
  ) STRICT;

  CREATE TABLE IF NOT EXISTS delivery_waits (
    delivery_id TEXT NOT NULL REFERENCES deliveries(id),
    wait_id TEXT NOT NULL REFERENCES waits(id),
    PRIMARY KEY (delivery_id, wait_id)
  ) STRICT;

  CREATE INDEX IF NOT EXISTS deliveries_session_state
    ON deliveries(session_id, state, created_at);

  CREATE INDEX IF NOT EXISTS deliveries_event_state
    ON deliveries(event_id, state);

  CREATE TABLE IF NOT EXISTS monitors (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    wait_id TEXT NOT NULL REFERENCES waits(id),
    state TEXT NOT NULL CHECK (state IN (
      'active', 'triggered', 'completed', 'degraded',
      'failed', 'expired', 'cancelled'
    )),
    lifecycle TEXT NOT NULL CHECK (lifecycle IN ('one_shot', 'recurring')),
    fire_on_initial_match INTEGER NOT NULL CHECK (fire_on_initial_match IN (0, 1)),
    active_version_id TEXT NOT NULL,
    detector_json TEXT NOT NULL,
    schedule_json TEXT NOT NULL,
    retry_json TEXT NOT NULL,
    capabilities_json TEXT NOT NULL,
    next_check_at TEXT,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 0,
    lease_owner TEXT,
    lease_expires_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS monitor_versions (
    id TEXT PRIMARY KEY,
    monitor_id TEXT NOT NULL REFERENCES monitors(id),
    artifact_hash TEXT NOT NULL,
    manifest_json TEXT NOT NULL,
    created_by_run_id TEXT REFERENCES runs(id),
    created_at TEXT NOT NULL,
    UNIQUE(monitor_id, artifact_hash)
  ) STRICT;

  CREATE TABLE IF NOT EXISTS monitor_checks (
    id TEXT PRIMARY KEY,
    monitor_id TEXT NOT NULL REFERENCES monitors(id),
    version_id TEXT NOT NULL REFERENCES monitor_versions(id),
    kind TEXT NOT NULL CHECK (kind IN ('baseline', 'scheduled')),
    state TEXT NOT NULL CHECK (state IN ('running', 'succeeded', 'failed')),
    error_class TEXT,
    error TEXT,
    started_at TEXT NOT NULL,
    finished_at TEXT
  ) STRICT;

  CREATE TABLE IF NOT EXISTS observations (
    id TEXT PRIMARY KEY,
    check_id TEXT NOT NULL UNIQUE REFERENCES monitor_checks(id),
    monitor_id TEXT NOT NULL REFERENCES monitors(id),
    sequence INTEGER NOT NULL,
    state_hash TEXT NOT NULL,
    data_json TEXT NOT NULL,
    observed_at TEXT NOT NULL,
    UNIQUE(monitor_id, sequence)
  ) STRICT;

  CREATE TABLE IF NOT EXISTS monitor_triggers (
    id TEXT PRIMARY KEY,
    monitor_id TEXT NOT NULL REFERENCES monitors(id),
    check_id TEXT NOT NULL REFERENCES monitor_checks(id),
    trigger_key TEXT NOT NULL,
    event_id TEXT NOT NULL UNIQUE REFERENCES events(id),
    created_at TEXT NOT NULL,
    UNIQUE(monitor_id, trigger_key)
  ) STRICT;

  CREATE INDEX IF NOT EXISTS monitors_due
    ON monitors(state, next_check_at);

  CREATE INDEX IF NOT EXISTS monitors_session_state
    ON monitors(session_id, state);

  CREATE INDEX IF NOT EXISTS monitor_checks_monitor_time
    ON monitor_checks(monitor_id, started_at);
`;
