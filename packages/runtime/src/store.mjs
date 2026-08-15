import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

import { SCHEMA_SQL, SCHEMA_VERSION } from "./schema.mjs";

export class RelayStore {
  constructor(path = ":memory:", { clock = () => new Date(), idFactory = randomUUID } = {}) {
    this.clock = clock;
    this.idFactory = idFactory;
    this.database = new DatabaseSync(path);
    this.database.exec("PRAGMA foreign_keys = ON");
    this.database.exec("PRAGMA busy_timeout = 5000");
    this.database.exec("PRAGMA journal_mode = WAL");
    this.database.exec(SCHEMA_SQL);
    const schemaVersion = this.database
      .prepare("SELECT MAX(version) AS version FROM relay_schema")
      .get().version;
    if (schemaVersion == null) {
      this.database
        .prepare("INSERT INTO relay_schema (version, applied_at) VALUES (?, ?)")
        .run(SCHEMA_VERSION, this.now());
    } else {
      assert.ok(schemaVersion <= SCHEMA_VERSION, `unsupported schema version ${schemaVersion}`);
      if (schemaVersion < SCHEMA_VERSION) {
        this.migrateSchema(schemaVersion);
        this.database
          .prepare("INSERT INTO relay_schema (version, applied_at) VALUES (?, ?)")
          .run(SCHEMA_VERSION, this.now());
      }
    }
    this.database
      .prepare("INSERT OR IGNORE INTO runtime_counters (name, value) VALUES ('routing_epoch', 0)")
      .run();
  }

  migrateSchema(fromVersion) {
    if (fromVersion < 3) {
      const runColumns = this.database.prepare("PRAGMA table_info(runs)").all();
      if (!runColumns.some((column) => column.name === "activation_id")) {
        this.transaction(() => {
          this.database.exec("ALTER TABLE runs ADD COLUMN activation_id TEXT");
          const runs = this.database.prepare("SELECT * FROM runs ORDER BY started_at, id").all();
          for (const run of runs) {
            const activationId = `legacy-${run.id}`;
            const state = run.state === "running" ? "active" : "committed";
            const timestamp = run.finished_at ?? run.started_at;
            this.database
              .prepare(`
                INSERT INTO activations (
                  id, session_id, trigger_type, state, delivery_ids_json,
                  provisional_outcome_json, provisional_at, committed_at,
                  created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `)
              .run(
                activationId,
                run.session_id,
                run.trigger_type,
                state,
                run.delivery_ids_json,
                run.outcome_json,
                run.outcome_json == null ? null : timestamp,
                state === "committed" ? timestamp : null,
                run.started_at,
                timestamp,
              );
            this.database
              .prepare("UPDATE runs SET activation_id = ? WHERE id = ?")
              .run(activationId, run.id);
          }
        });
      }
    }
    if (fromVersion < 4) {
      const columns = this.database.prepare("PRAGMA table_info(activations)").all();
      const names = new Set(columns.map((column) => column.name));
      for (const [name, type] of [
        ["lease_owner", "TEXT"],
        ["lease_expires_at", "TEXT"],
        ["accepted_at", "TEXT"],
        ["last_error", "TEXT"],
      ]) {
        if (!names.has(name)) {
          this.database.exec(`ALTER TABLE activations ADD COLUMN ${name} ${type}`);
        }
      }
      this.transaction(() => {
        this.database.exec(`
          ALTER TABLE routing_decisions RENAME TO routing_decisions_v3;
          CREATE TABLE routing_decisions (
            id TEXT PRIMARY KEY,
            event_id TEXT NOT NULL UNIQUE REFERENCES events(id),
            disposition TEXT NOT NULL CHECK (disposition IN ('deliver', 'escalate', 'dismiss')),
            actionable INTEGER NOT NULL CHECK (actionable IN (0, 1)),
            summary TEXT NOT NULL,
            evidence_json TEXT NOT NULL,
            decision_json TEXT NOT NULL,
            created_at TEXT NOT NULL
          ) STRICT;
          INSERT INTO routing_decisions (
            id, event_id, disposition, actionable, summary,
            evidence_json, decision_json, created_at
          )
          SELECT id, event_id,
            CASE disposition WHEN 'spawn' THEN 'escalate' ELSE disposition END,
            actionable, summary, evidence_json, decision_json, created_at
          FROM routing_decisions_v3;
          DROP TABLE routing_decisions_v3;
        `);
      });
    }
  }

  close() {
    this.database.close();
  }

  getWaitRegistration(sessionId) {
    const row = this.database.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId);
    return row ? hydrateWaitRegistration(row, this.getWaits(sessionId)) : null;
  }

  inspectWaitRegistration(sessionId) {
    const session = this.getWaitRegistration(sessionId);
    if (!session) {
      return null;
    }
    const deliveries = this.database
      .prepare("SELECT * FROM deliveries WHERE session_id = ? ORDER BY created_at, id")
      .all(sessionId)
      .map((row) => this.hydrateDelivery(row));
    return { ...session, deliveries, monitors: this.getMonitors(sessionId) };
  }

  registerWaits({
    sessionId,
    taskSummary,
    context = {},
    waits,
    monitors = [],
    monitorRearms = [],
  }) {
    assert.ok(sessionId, "DSH session id is required");
    assert.ok(Array.isArray(waits) && waits.length > 0, "at least one wait is required");
    return this.transaction(() => {
      const timestamp = this.now();
      const existing = this.database.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId);
      if (!existing) {
        this.insertSession({ sessionId, taskSummary, context, state: "waiting" });
      } else {
        this.database
          .prepare(`
            UPDATE waits
            SET status = 'superseded', version = version + 1, updated_at = ?
            WHERE session_id = ? AND status IN ('active', 'claimed')
          `)
          .run(timestamp, sessionId);
        this.cancelEndedMonitors(
          sessionId,
          monitorRearms.map((rearm) => rearm.monitor_id),
          timestamp,
        );
        this.database
          .prepare(`
            UPDATE sessions
            SET state = 'waiting', task_summary = ?, context_json = ?,
                lease_owner = NULL, lease_expires_at = NULL,
                version = version + 1, updated_at = ?
            WHERE id = ?
          `)
          .run(taskSummary, encodeJson(context), timestamp, sessionId);
      }
      this.insertWaits(sessionId, waits);
      this.insertMonitors(sessionId, monitors);
      if (monitorRearms.length > 0) {
        this.rearmMonitors(sessionId, monitorRearms, timestamp);
      }
      this.bumpRoutingEpoch();
      return this.inspectWaitRegistration(sessionId);
    });
  }

  cancelWaits(sessionId) {
    return this.transaction(() => {
      const row = this.requireWaitRegistrationRow(sessionId);
      const timestamp = this.now();
      this.database
        .prepare(`
          UPDATE waits
          SET status = 'cancelled', version = version + 1, updated_at = ?
          WHERE session_id = ? AND status IN ('active', 'claimed')
        `)
        .run(timestamp, sessionId);
      this.cancelEndedMonitors(sessionId, [], timestamp);
      this.database
        .prepare(`
          UPDATE sessions
          SET state = 'created', lease_owner = NULL, lease_expires_at = NULL,
              version = version + 1, updated_at = ?
          WHERE id = ?
        `)
        .run(timestamp, sessionId);
      this.bumpRoutingEpoch();
      return hydrateWaitRegistration(this.requireWaitRegistrationRow(row.id), this.getWaits(row.id));
    });
  }

  listWaitRegistrations() {
    return this.database
      .prepare("SELECT * FROM sessions ORDER BY updated_at DESC, id")
      .all()
      .map((row) => ({
        ...hydrateWaitRegistration(row, this.getWaits(row.id)),
        monitors: this.getMonitors(row.id),
      }))
      .filter((registration) =>
        registration.waits.some((wait) => wait.status === "active" || wait.status === "claimed") ||
        registration.monitors.some((monitor) =>
          new Set(["active", "triggered", "degraded"]).has(monitor.state)
        )
      );
  }

  getActivation(activationId) {
    const row = this.database.prepare("SELECT * FROM activations WHERE id = ?").get(activationId);
    return row ? hydrateActivation(row) : null;
  }

  beginDispatch(sessionId, owner, leaseMs) {
    return this.transaction(() => {
      this.requireWaitRegistrationRow(sessionId);
      const nowDate = this.clock();
      const now = toIso(nowDate);
      let activationRow = this.database
        .prepare("SELECT * FROM activations WHERE session_id = ? AND state = 'active'")
        .get(sessionId);

      if (activationRow?.lease_owner && activationRow.lease_expires_at > now) {
        return { status: "busy" };
      }

      let deliveryRows;
      if (activationRow) {
        deliveryRows = decodeJson(activationRow.delivery_ids_json).map((deliveryId) => {
          const row = this.database.prepare("SELECT * FROM deliveries WHERE id = ?").get(deliveryId);
          assert.ok(row, `activation delivery ${deliveryId} does not exist`);
          assert.equal(row.state, "queued", `activation delivery ${deliveryId} is not queued`);
          return row;
        });
      } else {
        deliveryRows = this.database
          .prepare(`
            SELECT * FROM deliveries
            WHERE session_id = ? AND state = 'queued'
            ORDER BY created_at, id
          `)
          .all(sessionId);
        if (deliveryRows.length === 0) return { status: "no_work" };
        const activationId = this.idFactory();
        this.database
          .prepare(`
            INSERT INTO activations (
              id, session_id, trigger_type, state, delivery_ids_json, created_at, updated_at
            ) VALUES (?, ?, 'event', 'active', ?, ?, ?)
          `)
          .run(
            activationId,
            sessionId,
            encodeJson(deliveryRows.map((row) => row.id)),
            now,
            now,
          );
        activationRow = this.database.prepare("SELECT * FROM activations WHERE id = ?").get(activationId);
      }

      const leaseExpiresAt = new Date(nowDate.getTime() + leaseMs).toISOString();
      this.database
        .prepare(`
          UPDATE activations
          SET lease_owner = ?, lease_expires_at = ?, last_error = NULL, updated_at = ?
          WHERE id = ? AND state = 'active'
        `)
        .run(owner, leaseExpiresAt, now, activationRow.id);

      return {
        status: "started",
        activation: this.getActivation(activationRow.id),
        session: this.getWaitRegistration(sessionId),
        deliveries: deliveryRows.map((row) => this.hydrateDelivery(row, true)),
      };
    });
  }

  completeDispatch(sessionId, activationId, owner) {
    return this.transaction(() => {
      const activation = this.database.prepare("SELECT * FROM activations WHERE id = ?").get(activationId);
      assert.ok(activation, `activation ${activationId} does not exist`);
      assert.equal(activation.session_id, sessionId, `activation ${activationId} has wrong session`);
      assert.equal(activation.state, "active", `activation ${activationId} is not active`);
      assert.equal(activation.lease_owner, owner, `worker does not own activation ${activationId}`);
      const timestamp = this.now();
      const deliveryIds = decodeJson(activation.delivery_ids_json);
      const eventIds = new Set();
      for (const deliveryId of deliveryIds) {
        const delivery = this.database.prepare("SELECT * FROM deliveries WHERE id = ?").get(deliveryId);
        assert.ok(delivery, `delivery ${deliveryId} does not exist`);
        assert.equal(delivery.state, "queued", `delivery ${deliveryId} is not queued`);
        eventIds.add(delivery.event_id);
        this.database
          .prepare("UPDATE deliveries SET state = 'resolved', updated_at = ? WHERE id = ?")
          .run(timestamp, deliveryId);
        this.database
          .prepare(`
            UPDATE waits
            SET status = 'consumed', version = version + 1, updated_at = ?
            WHERE id IN (SELECT wait_id FROM delivery_waits WHERE delivery_id = ?)
              AND status = 'claimed'
          `)
          .run(timestamp, deliveryId);
      }
      const pausedRecurringMonitorIds = this.database
        .prepare(`
          SELECT id FROM monitors
          WHERE session_id = ? AND lifecycle = 'recurring' AND state = 'triggered'
        `)
        .all(sessionId)
        .map((row) => row.id);
      this.cancelEndedMonitors(sessionId, pausedRecurringMonitorIds, timestamp);
      for (const eventId of eventIds) {
        const unresolved = this.database
          .prepare("SELECT COUNT(*) AS count FROM deliveries WHERE event_id = ? AND state != 'resolved'")
          .get(eventId).count;
        if (unresolved === 0) {
          this.database
            .prepare(`
              UPDATE events
              SET state = 'resolved', version = version + 1, updated_at = ?
              WHERE id = ?
            `)
            .run(timestamp, eventId);
        }
      }
      this.database
        .prepare(`
          UPDATE activations
          SET state = 'committed', accepted_at = ?, committed_at = ?,
              lease_owner = NULL, lease_expires_at = NULL, updated_at = ?
          WHERE id = ?
        `)
        .run(timestamp, timestamp, timestamp, activationId);
      const liveWaits = this.database
        .prepare("SELECT COUNT(*) AS count FROM waits WHERE session_id = ? AND status IN ('active', 'claimed')")
        .get(sessionId).count;
      this.database
        .prepare(`
          UPDATE sessions
          SET state = ?, version = version + 1, updated_at = ?
          WHERE id = ?
        `)
        .run(liveWaits > 0 ? "waiting" : "created", timestamp, sessionId);
      this.bumpRoutingEpoch();
      return this.inspectWaitRegistration(sessionId);
    });
  }

  failDispatch(sessionId, activationId, owner, error) {
    return this.transaction(() => {
      const activation = this.database.prepare("SELECT * FROM activations WHERE id = ?").get(activationId);
      assert.ok(activation, `activation ${activationId} does not exist`);
      assert.equal(activation.session_id, sessionId, `activation ${activationId} has wrong session`);
      assert.equal(activation.state, "active", `activation ${activationId} is not active`);
      assert.equal(activation.lease_owner, owner, `worker does not own activation ${activationId}`);
      this.database
        .prepare(`
          UPDATE activations
          SET lease_owner = NULL, lease_expires_at = NULL, last_error = ?, updated_at = ?
          WHERE id = ?
        `)
        .run(error, this.now(), activationId);
      return this.getActivation(activationId);
    });
  }

  getWaits(sessionId) {
    return this.database
      .prepare("SELECT * FROM waits WHERE session_id = ? ORDER BY created_at, id")
      .all(sessionId)
      .map(hydrateWait);
  }

  getMonitor(monitorId) {
    const row = this.database.prepare("SELECT * FROM monitors WHERE id = ?").get(monitorId);
    return row ? this.hydrateMonitor(row) : null;
  }

  getMonitors(sessionId) {
    return this.database
      .prepare("SELECT * FROM monitors WHERE session_id = ? ORDER BY created_at, id")
      .all(sessionId)
      .map((row) => this.hydrateMonitor(row));
  }

  inspectMonitor(monitorId) {
    const monitor = this.getMonitor(monitorId);
    if (!monitor) {
      return null;
    }
    const versions = this.database
      .prepare("SELECT * FROM monitor_versions WHERE monitor_id = ? ORDER BY created_at, id")
      .all(monitorId)
      .map(hydrateMonitorVersion);
    const checks = this.database
      .prepare("SELECT * FROM monitor_checks WHERE monitor_id = ? ORDER BY started_at, id")
      .all(monitorId)
      .map(hydrateMonitorCheck);
    const observations = this.database
      .prepare("SELECT * FROM observations WHERE monitor_id = ? ORDER BY sequence")
      .all(monitorId)
      .map(hydrateObservation);
    const triggers = this.database
      .prepare("SELECT * FROM monitor_triggers WHERE monitor_id = ? ORDER BY created_at, id")
      .all(monitorId)
      .map(hydrateMonitorTrigger);
    return { ...monitor, versions, checks, observations, triggers };
  }

  ingestEvent(input) {
    return this.transaction(() => {
      const existing = this.findDuplicateEvent(input);
      if (existing) {
        return { event: hydrateEvent(existing), duplicate: true };
      }

      const eventId = input.event_id ?? this.idFactory();
      const timestamp = this.now();
      this.database
        .prepare(`
          INSERT INTO events (
            id, source, source_event_id, fingerprint, payload_json,
            state, version, received_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 'received', 0, ?, ?)
        `)
        .run(
          eventId,
          input.source,
          input.source_event_id ?? null,
          input.fingerprint,
          encodeJson(input),
          timestamp,
          timestamp,
        );
      return { event: this.getEvent(eventId), duplicate: false };
    });
  }

  getEvent(eventId) {
    const row = this.database.prepare("SELECT * FROM events WHERE id = ?").get(eventId);
    return row ? hydrateEvent(row) : null;
  }

  inspectEvent(eventId) {
    const event = this.getEvent(eventId);
    if (!event) {
      return null;
    }
    const decisionRow = this.database
      .prepare("SELECT * FROM routing_decisions WHERE event_id = ?")
      .get(eventId);
    const deliveries = this.database
      .prepare("SELECT * FROM deliveries WHERE event_id = ? ORDER BY created_at, id")
      .all(eventId)
      .map((row) => this.hydrateDelivery(row));
    const routingAttempts = this.database
      .prepare("SELECT * FROM routing_attempts WHERE event_id = ? ORDER BY created_at, id")
      .all(eventId)
      .map(hydrateRoutingAttempt);
    return {
      ...event,
      decision: decisionRow ? hydrateDecision(decisionRow) : null,
      deliveries,
      routing_attempts: routingAttempts,
    };
  }

  beginRouting(eventId) {
    const state = this.transaction(() => {
      const eventRow = this.requireEventRow(eventId);
      const decision = this.database
        .prepare("SELECT id FROM routing_decisions WHERE event_id = ?")
        .get(eventId);
      if (decision) {
        return { alreadyRouted: true };
      }
      assert.ok(
        eventRow.state === "received" || eventRow.state === "routing",
        `event ${eventId} cannot route from ${eventRow.state}`,
      );
      if (eventRow.state === "received") {
        this.database
          .prepare(`
            UPDATE events
            SET state = 'routing', version = version + 1, updated_at = ?
            WHERE id = ?
          `)
          .run(this.now(), eventId);
      }
      return { alreadyRouted: false };
    });

    if (state.alreadyRouted) {
      return { alreadyRouted: true, result: this.getRoutingResult(eventId) };
    }

    return {
      alreadyRouted: false,
      event: this.getEvent(eventId),
      sessions: this.listRoutingCandidates(),
      routingEpoch: this.getRoutingEpoch(),
    };
  }

  listRoutingCandidates() {
    const sessionRows = this.database
      .prepare(`
        SELECT * FROM sessions
        WHERE state IN ('waiting', 'running')
        ORDER BY created_at, id
      `)
      .all();
    return sessionRows.map((row) => hydrateWaitRegistration(row, this.getWaits(row.id).filter((wait) =>
      wait.status === "active" || wait.status === "claimed"
    )));
  }

  recordRoutingAttempt({ eventId, pass = "final", router, model = null, output = null, usage = null, error = null }) {
    this.database
      .prepare(`
        INSERT INTO routing_attempts (
          id, event_id, pass, router, model, output_json, usage_json, error, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        this.idFactory(),
        eventId,
        pass,
        router,
        model,
        output == null ? null : encodeJson(output),
        usage == null ? null : encodeJson(usage),
        error,
        this.now(),
      );
  }

  commitRouting(snapshot, decision) {
    const committed = this.transaction(() => {
      const existingDecision = this.database
        .prepare("SELECT id FROM routing_decisions WHERE event_id = ?")
        .get(snapshot.event.event_id);
      if (existingDecision) {
        return { alreadyCommitted: true };
      }

      const eventRow = this.requireEventRow(snapshot.event.event_id);
      assert.equal(eventRow.state, "routing", `event ${eventRow.id} is not routing`);
      assert.equal(eventRow.version, snapshot.event.version, `event ${eventRow.id} version changed`);
      assert.equal(
        this.getRoutingEpoch(),
        snapshot.routingEpoch,
        `routing candidates changed for event ${eventRow.id}`,
      );

      const timestamp = this.now();
      this.database
        .prepare(`
          INSERT INTO routing_decisions (
            id, event_id, disposition, actionable, summary,
            evidence_json, decision_json, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          this.idFactory(),
          eventRow.id,
          decision.disposition,
          Number(decision.actionable),
          decision.summary,
          encodeJson(decision.evidence),
          encodeJson(decision),
          timestamp,
        );

      const deliveryIds = [];
      const sessionIds = [];

      if (decision.disposition === "deliver") {
        const snapshotSessions = new Map(
          snapshot.sessions.map((session) => [session.session_id, session]),
        );
        for (const delivery of decision.deliveries) {
          const snapshotSession = snapshotSessions.get(delivery.session_id);
          assert.ok(snapshotSession, `unknown snapshot session ${delivery.session_id}`);
          const sessionRow = this.requireWaitRegistrationRow(delivery.session_id);
          assert.equal(
            sessionRow.version,
            snapshotSession.version,
            `session ${sessionRow.id} version changed`,
          );
          const deliveryId = this.insertDelivery({
            eventId: eventRow.id,
            sessionId: delivery.session_id,
            relation: delivery.relation,
            confidence: delivery.confidence,
            timestamp,
          });
          deliveryIds.push(deliveryId);
          sessionIds.push(delivery.session_id);

          for (const waitId of delivery.wait_ids) {
            const snapshotWait = snapshotSession.waits.find((wait) => wait.wait_id === waitId);
            assert.ok(snapshotWait, `unknown snapshot wait ${waitId}`);
            const waitRow = this.database.prepare("SELECT * FROM waits WHERE id = ?").get(waitId);
            assert.ok(waitRow, `wait ${waitId} no longer exists`);
            assert.equal(waitRow.status, "active", `wait ${waitId} is not active`);
            assert.equal(waitRow.version, snapshotWait.version, `wait ${waitId} version changed`);
            this.database
              .prepare("INSERT INTO delivery_waits (delivery_id, wait_id) VALUES (?, ?)")
              .run(deliveryId, waitId);
            this.database
              .prepare(`
                UPDATE waits
                SET status = 'claimed', version = version + 1, updated_at = ?
                WHERE id = ?
              `)
              .run(timestamp, waitId);
          }
        }
      }

      const eventState = decision.disposition === "deliver" ? "dispatched" : "resolved";
      this.database
        .prepare(`
          UPDATE events
          SET state = ?, version = version + 1, updated_at = ?
          WHERE id = ?
        `)
        .run(eventState, timestamp, eventRow.id);
      if (decision.disposition === "deliver") {
        this.bumpRoutingEpoch();
      }

      return { alreadyCommitted: false, deliveryIds, sessionIds };
    });

    if (committed.alreadyCommitted) {
      return this.getRoutingResult(snapshot.event.event_id);
    }
    return this.getRoutingResult(snapshot.event.event_id);
  }

  getRoutingResult(eventId) {
    const decisionRow = this.database
      .prepare("SELECT * FROM routing_decisions WHERE event_id = ?")
      .get(eventId);
    if (!decisionRow) {
      return null;
    }
    const deliveries = this.database
      .prepare("SELECT * FROM deliveries WHERE event_id = ? ORDER BY created_at, id")
      .all(eventId)
      .map((row) => this.hydrateDelivery(row));
    return {
      decision: hydrateDecision(decisionRow),
      deliveries,
      sessionIds: [...new Set(deliveries.map((delivery) => delivery.session_id))],
    };
  }

  listDueMonitors(at = this.now(), limit = 100) {
    return this.database
      .prepare(`
        SELECT * FROM monitors
        WHERE state IN ('active', 'degraded')
          AND next_check_at IS NOT NULL
          AND next_check_at <= ?
        ORDER BY next_check_at, id
        LIMIT ?
      `)
      .all(toIso(at), limit)
      .map((row) => this.hydrateMonitor(row));
  }

  beginMonitorCheck(monitorId, owner, leaseMs, { force = false } = {}) {
    return this.transaction(() => {
      let row = this.requireMonitorRow(monitorId);
      if (!new Set(["active", "degraded"]).has(row.state)) {
        return { status: "inactive", monitor: this.hydrateMonitor(row) };
      }

      const nowDate = this.clock();
      const now = toIso(nowDate);
      if (!force && (row.next_check_at == null || row.next_check_at > now)) {
        return { status: "not_due", monitor: this.hydrateMonitor(row) };
      }
      if (row.lease_owner && row.lease_expires_at > now) {
        return { status: "busy" };
      }
      if (row.lease_owner) {
        this.database
          .prepare(`
            UPDATE monitor_checks
            SET state = 'failed', error_class = 'lease_expired',
                error = 'monitor lease expired', finished_at = ?
            WHERE monitor_id = ? AND state = 'running'
          `)
          .run(now, monitorId);
      }

      const leaseExpiresAt = new Date(nowDate.getTime() + leaseMs).toISOString();
      this.database
        .prepare(`
          UPDATE monitors
          SET lease_owner = ?, lease_expires_at = ?, version = version + 1,
              updated_at = ?
          WHERE id = ?
        `)
        .run(owner, leaseExpiresAt, now, monitorId);
      row = this.requireMonitorRow(monitorId);

      const checkId = this.idFactory();
      this.database
        .prepare(`
          INSERT INTO monitor_checks (
            id, monitor_id, version_id, kind, state, started_at
          ) VALUES (?, ?, ?, 'scheduled', 'running', ?)
        `)
        .run(checkId, monitorId, row.active_version_id, now);

      return {
        status: "started",
        check_id: checkId,
        monitor: this.hydrateMonitor(row),
      };
    });
  }

  completeMonitorCheck(snapshot, owner, observation, proposedEvents) {
    assert.ok(observation && typeof observation === "object", "observation is required");
    assert.ok(Array.isArray(proposedEvents), "proposedEvents must be an array");
    assert.ok(proposedEvents.length <= 1, "initial Monitor slice emits at most one Event per check");

    return this.transaction(() => {
      const row = this.requireMonitorCommit(snapshot, owner);
      const timestamp = this.now();
      const prior = this.latestObservationRow(row.id);
      const sequence = (prior?.sequence ?? -1) + 1;
      const observationId = this.idFactory();
      this.database
        .prepare(`
          INSERT INTO observations (
            id, check_id, monitor_id, sequence, state_hash, data_json, observed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          observationId,
          snapshot.check_id,
          row.id,
          sequence,
          hashJson(observation),
          encodeJson(observation),
          timestamp,
        );

      const eventIds = [];
      if (proposedEvents.length === 1) {
        eventIds.push(this.insertBoundMonitorEvent({
          monitorRow: row,
          checkId: snapshot.check_id,
          proposal: proposedEvents[0],
          claimWait: true,
          timestamp,
        }));
      }

      const nextState = proposedEvents.length === 0
        ? "active"
        : row.lifecycle === "one_shot" ? "completed" : "triggered";
      const nextCheckAt = proposedEvents.length === 0
        ? nextMonitorCheckAt(decodeJson(row.schedule_json), this.clock())
        : null;
      this.database
        .prepare(`
          UPDATE monitors
          SET state = ?, next_check_at = ?, consecutive_failures = 0,
              lease_owner = NULL, lease_expires_at = NULL,
              version = version + 1, updated_at = ?
          WHERE id = ?
        `)
        .run(nextState, nextCheckAt, timestamp, row.id);
      this.database
        .prepare(`
          UPDATE monitor_checks
          SET state = 'succeeded', finished_at = ?
          WHERE id = ? AND state = 'running'
        `)
        .run(timestamp, snapshot.check_id);

      return {
        status: proposedEvents.length === 0 ? "observed" : "triggered",
        monitor: this.inspectMonitor(row.id),
        eventIds,
        sessionIds: eventIds.length === 0 ? [] : [row.session_id],
      };
    });
  }

  failMonitorCheck(snapshot, owner, errorClass, errorMessage) {
    return this.transaction(() => {
      const row = this.requireMonitorCommit(snapshot, owner);
      const timestamp = this.now();
      const retry = decodeJson(row.retry_json);
      const failures = row.consecutive_failures + 1;
      const failed = failures >= retry.fail_after;
      const nextState = failed
        ? "failed"
        : failures >= retry.degraded_after ? "degraded" : "active";
      const delaySeconds = retry.backoff_seconds?.[
        Math.min(failures - 1, retry.backoff_seconds.length - 1)
      ] ?? decodeJson(row.schedule_json).interval_seconds;
      const nextCheckAt = failed
        ? null
        : new Date(this.clock().getTime() + delaySeconds * 1000).toISOString();

      this.database
        .prepare(`
          UPDATE monitor_checks
          SET state = 'failed', error_class = ?, error = ?, finished_at = ?
          WHERE id = ? AND state = 'running'
        `)
        .run(errorClass, errorMessage, timestamp, snapshot.check_id);

      const eventIds = [];
      if (failed) {
        eventIds.push(this.insertBoundMonitorEvent({
          monitorRow: row,
          checkId: snapshot.check_id,
          proposal: {
            type: "monitor.failed",
            key: `${row.id}:failed:${errorClass}`,
            data: {
              monitor_id: row.id,
              error_class: errorClass,
              error: errorMessage,
              version_id: row.active_version_id,
            },
          },
          claimWait: false,
          timestamp,
        }));
      }

      this.database
        .prepare(`
          UPDATE monitors
          SET state = ?, next_check_at = ?, consecutive_failures = ?,
              lease_owner = NULL, lease_expires_at = NULL,
              version = version + 1, updated_at = ?
          WHERE id = ?
        `)
        .run(nextState, nextCheckAt, failures, timestamp, row.id);

      return {
        status: nextState,
        monitor: this.inspectMonitor(row.id),
        eventIds,
        sessionIds: eventIds.length === 0 ? [] : [row.session_id],
      };
    });
  }

  getRoutingEpoch() {
    return this.database
      .prepare("SELECT value FROM runtime_counters WHERE name = 'routing_epoch'")
      .get().value;
  }

  transaction(callback) {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const result = callback();
      this.database.exec("COMMIT");
      return result;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  now() {
    return toIso(this.clock());
  }

  insertSession({ sessionId, taskSummary, context, state }) {
    assert.ok(taskSummary, "task summary is required");
    const timestamp = this.now();
    this.database
      .prepare(`
        INSERT INTO sessions (
          id, state, task_summary, context_json, version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 0, ?, ?)
      `)
      .run(sessionId, state, taskSummary, encodeJson(context), timestamp, timestamp);
  }

  insertWaits(sessionId, waits) {
    const timestamp = this.now();
    for (const wait of waits) {
      const waitId = wait.wait_id ?? this.idFactory();
      const card = {
        expected_event: wait.expected_event,
        caused_by: wait.caused_by,
        actors: wait.actors ?? [],
        entities: wait.entities ?? [],
        prior_exchange: wait.prior_exchange,
      };
      this.database
        .prepare(`
          INSERT INTO waits (
            id, session_id, phase, status, exclusive, exclusive_owner_key,
            wait_card_json, version, created_at, updated_at
          ) VALUES (?, ?, ?, 'active', ?, ?, ?, 0, ?, ?)
        `)
        .run(
          waitId,
          sessionId,
          wait.phase,
          Number(wait.exclusive),
          wait.exclusive_owner_key ?? null,
          encodeJson(card),
          timestamp,
          timestamp,
        );
    }
  }

  insertMonitors(sessionId, monitors) {
    const timestamp = this.now();
    for (const monitor of monitors) {
      assert.ok(monitor.monitor_id, "monitor_id is required");
      assert.ok(monitor.wait_id, `monitor ${monitor.monitor_id} requires wait_id`);
      assert.ok(
        monitor.lifecycle === "one_shot" || monitor.lifecycle === "recurring",
        `monitor ${monitor.monitor_id} has invalid lifecycle`,
      );
      assert.equal(
        monitor.fire_on_initial_match ?? false,
        false,
        "fire_on_initial_match is outside the initial Monitor slice",
      );
      assert.ok(monitor.detector && typeof monitor.detector === "object", "monitor detector is required");
      assert.ok(
        monitor.baseline_observation && typeof monitor.baseline_observation === "object",
        "monitor baseline_observation is required",
      );

      const waitRow = this.database.prepare("SELECT * FROM waits WHERE id = ?").get(monitor.wait_id);
      assert.ok(waitRow, `monitor wait ${monitor.wait_id} does not exist`);
      assert.equal(waitRow.session_id, sessionId, `monitor wait ${monitor.wait_id} has wrong owner`);
      assert.equal(waitRow.status, "active", `monitor wait ${monitor.wait_id} is not active`);

      const schedule = {
        interval_seconds: monitor.schedule?.interval_seconds ?? 60,
        jitter_seconds: monitor.schedule?.jitter_seconds ?? 0,
      };
      assert.ok(schedule.interval_seconds > 0, "monitor interval_seconds must be positive");
      const retry = {
        degraded_after: monitor.retry?.degraded_after ?? 1,
        fail_after: monitor.retry?.fail_after ?? 3,
        backoff_seconds: monitor.retry?.backoff_seconds ?? [],
      };
      assert.ok(retry.degraded_after > 0, "monitor degraded_after must be positive");
      assert.ok(retry.fail_after >= retry.degraded_after, "monitor fail_after must follow degraded_after");

      const versionId = this.idFactory();
      const manifest = {
        detector: monitor.detector,
        schedule,
        retry,
        capabilities: monitor.capabilities ?? {},
        artifact: monitor.artifact ?? { kind: "fixture" },
      };
      const artifactHash = monitor.artifact?.sha256 ?? hashJson(manifest);
      this.database
        .prepare(`
          INSERT INTO monitors (
            id, session_id, wait_id, state, lifecycle, fire_on_initial_match,
            active_version_id, detector_json, schedule_json, retry_json,
            capabilities_json, next_check_at, consecutive_failures, version,
            created_at, updated_at
          ) VALUES (?, ?, ?, 'active', ?, 0, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
        `)
        .run(
          monitor.monitor_id,
          sessionId,
          monitor.wait_id,
          monitor.lifecycle,
          versionId,
          encodeJson(monitor.detector),
          encodeJson(schedule),
          encodeJson(retry),
          encodeJson(monitor.capabilities ?? {}),
          nextMonitorCheckAt(schedule, this.clock()),
          timestamp,
          timestamp,
        );
      this.database
        .prepare(`
          INSERT INTO monitor_versions (
            id, monitor_id, artifact_hash, manifest_json, created_by_run_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `)
        .run(
          versionId,
          monitor.monitor_id,
          artifactHash,
          encodeJson(manifest),
          monitor.created_by_run_id ?? null,
          timestamp,
        );

      const checkId = this.idFactory();
      this.database
        .prepare(`
          INSERT INTO monitor_checks (
            id, monitor_id, version_id, kind, state, started_at, finished_at
          ) VALUES (?, ?, ?, 'baseline', 'succeeded', ?, ?)
        `)
        .run(checkId, monitor.monitor_id, versionId, timestamp, timestamp);
      this.database
        .prepare(`
          INSERT INTO observations (
            id, check_id, monitor_id, sequence, state_hash, data_json, observed_at
          ) VALUES (?, ?, ?, 0, ?, ?, ?)
        `)
        .run(
          this.idFactory(),
          checkId,
          monitor.monitor_id,
          hashJson(monitor.baseline_observation),
          encodeJson(monitor.baseline_observation),
          timestamp,
        );
    }
  }

  rearmMonitors(sessionId, rearms, timestamp) {
    const rearmIds = new Set(rearms.map((rearm) => rearm.monitor_id));
    assert.equal(rearmIds.size, rearms.length, "monitor rearm IDs must be unique");
    for (const rearm of rearms) {
      const row = this.requireMonitorRow(rearm.monitor_id);
      assert.equal(row.session_id, sessionId, `monitor ${row.id} has wrong owner`);
      assert.equal(row.lifecycle, "recurring", `monitor ${row.id} is not recurring`);
      assert.equal(row.state, "triggered", `monitor ${row.id} is not triggered`);
      const waitRow = this.database.prepare("SELECT * FROM waits WHERE id = ?").get(rearm.wait_id);
      assert.ok(waitRow, `rearm wait ${rearm.wait_id} does not exist`);
      assert.equal(waitRow.session_id, sessionId, `rearm wait ${rearm.wait_id} has wrong owner`);
      assert.equal(waitRow.status, "active", `rearm wait ${rearm.wait_id} is not active`);
      this.database
        .prepare(`
          UPDATE monitors
          SET wait_id = ?, state = 'active', next_check_at = ?,
              consecutive_failures = 0, version = version + 1, updated_at = ?
          WHERE id = ?
        `)
        .run(
          rearm.wait_id,
          nextMonitorCheckAt(decodeJson(row.schedule_json), this.clock()),
          timestamp,
          row.id,
        );
    }
  }

  cancelEndedMonitors(sessionId, rearmIds, timestamp) {
    const excluded = new Set(rearmIds);
    const rows = this.database
      .prepare(`
        SELECT m.id
        FROM monitors m
        JOIN waits w ON w.id = m.wait_id
        WHERE m.session_id = ?
          AND m.state IN ('active', 'degraded', 'triggered')
          AND w.status IN ('consumed', 'superseded', 'cancelled')
      `)
      .all(sessionId);
    for (const row of rows) {
      if (excluded.has(row.id)) {
        continue;
      }
      this.database
        .prepare(`
          UPDATE monitors
          SET state = 'cancelled', next_check_at = NULL,
              lease_owner = NULL, lease_expires_at = NULL,
              version = version + 1, updated_at = ?
          WHERE id = ?
        `)
        .run(timestamp, row.id);
    }
  }

  insertDelivery({ eventId, sessionId, relation, confidence, timestamp }) {
    const deliveryId = this.idFactory();
    this.database
      .prepare(`
        INSERT INTO deliveries (
          id, event_id, session_id, state, relation, confidence, created_at, updated_at
        ) VALUES (?, ?, ?, 'queued', ?, ?, ?, ?)
      `)
      .run(deliveryId, eventId, sessionId, relation, confidence, timestamp, timestamp);
    return deliveryId;
  }

  hydrateDelivery(row, includeEvent = false) {
    const waitIds = this.database
      .prepare("SELECT wait_id FROM delivery_waits WHERE delivery_id = ? ORDER BY wait_id")
      .all(row.id)
      .map((item) => item.wait_id);
    const delivery = {
      delivery_id: row.id,
      event_id: row.event_id,
      session_id: row.session_id,
      state: row.state,
      wait_ids: waitIds,
      relation: row.relation,
      confidence: row.confidence,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
    if (includeEvent) {
      delivery.event = this.getEvent(row.event_id)?.payload ?? null;
    }
    return delivery;
  }

  findDuplicateEvent(input) {
    if (input.source_event_id != null) {
      const bySourceId = this.database
        .prepare("SELECT * FROM events WHERE source = ? AND source_event_id = ?")
        .get(input.source, input.source_event_id);
      if (bySourceId) {
        return bySourceId;
      }
    }
    return this.database
      .prepare("SELECT * FROM events WHERE source = ? AND fingerprint = ?")
      .get(input.source, input.fingerprint);
  }

  requireEventRow(eventId) {
    const row = this.database.prepare("SELECT * FROM events WHERE id = ?").get(eventId);
    assert.ok(row, `event ${eventId} does not exist`);
    return row;
  }

  requireWaitRegistrationRow(sessionId) {
    const row = this.database.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId);
    assert.ok(row, `session ${sessionId} does not exist`);
    return row;
  }

  requireMonitorRow(monitorId) {
    const row = this.database.prepare("SELECT * FROM monitors WHERE id = ?").get(monitorId);
    assert.ok(row, `monitor ${monitorId} does not exist`);
    return row;
  }

  requireMonitorCommit(snapshot, owner) {
    const row = this.requireMonitorRow(snapshot.monitor.monitor_id);
    assert.equal(row.lease_owner, owner, `worker does not own monitor ${row.id}`);
    assert.equal(row.version, snapshot.monitor.version, `monitor ${row.id} version changed`);
    assert.equal(row.active_version_id, snapshot.monitor.active_version_id, `monitor ${row.id} version changed`);
    const check = this.database.prepare("SELECT * FROM monitor_checks WHERE id = ?").get(snapshot.check_id);
    assert.ok(check, `monitor check ${snapshot.check_id} does not exist`);
    assert.equal(check.state, "running", `monitor check ${snapshot.check_id} is not running`);
    return row;
  }

  latestObservationRow(monitorId) {
    return this.database
      .prepare("SELECT * FROM observations WHERE monitor_id = ? ORDER BY sequence DESC LIMIT 1")
      .get(monitorId);
  }

  hydrateMonitor(row) {
    const versionRow = this.database
      .prepare("SELECT * FROM monitor_versions WHERE id = ?")
      .get(row.active_version_id);
    const observationRow = this.latestObservationRow(row.id);
    return {
      monitor_id: row.id,
      session_id: row.session_id,
      wait_id: row.wait_id,
      state: row.state,
      lifecycle: row.lifecycle,
      fire_on_initial_match: Boolean(row.fire_on_initial_match),
      active_version_id: row.active_version_id,
      artifact_hash: versionRow?.artifact_hash ?? null,
      detector: decodeJson(row.detector_json),
      schedule: decodeJson(row.schedule_json),
      retry: decodeJson(row.retry_json),
      capabilities: decodeJson(row.capabilities_json),
      next_check_at: row.next_check_at,
      consecutive_failures: row.consecutive_failures,
      version: row.version,
      lease_owner: row.lease_owner,
      lease_expires_at: row.lease_expires_at,
      last_observation: observationRow ? hydrateObservation(observationRow) : null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  insertBoundMonitorEvent({ monitorRow, checkId, proposal, claimWait, timestamp }) {
    assert.equal(typeof proposal.type, "string", "monitor Event type is required");
    assert.equal(typeof proposal.key, "string", "monitor trigger key is required");
    const existing = this.database
      .prepare("SELECT event_id FROM monitor_triggers WHERE monitor_id = ? AND trigger_key = ?")
      .get(monitorRow.id, proposal.key);
    if (existing) {
      return existing.event_id;
    }

    const waitRow = this.database.prepare("SELECT * FROM waits WHERE id = ?").get(monitorRow.wait_id);
    assert.ok(waitRow, `monitor wait ${monitorRow.wait_id} does not exist`);
    assert.equal(waitRow.session_id, monitorRow.session_id, "monitor binding owner changed");
    if (claimWait) {
      assert.equal(waitRow.status, "active", `monitor wait ${waitRow.id} is not active`);
    }

    const eventId = this.idFactory();
    const sourceEventId = `${monitorRow.id}:${proposal.key}`;
    const payload = {
      event_id: eventId,
      source: "relay-monitor",
      source_event_id: sourceEventId,
      fingerprint: hashJson({ monitor_id: monitorRow.id, trigger_key: proposal.key }),
      channel: "monitor",
      type: proposal.type,
      monitor_id: monitorRow.id,
      trigger_key: proposal.key,
      data: proposal.data ?? {},
    };
    this.database
      .prepare(`
        INSERT INTO events (
          id, source, source_event_id, fingerprint, payload_json,
          state, version, received_at, updated_at
        ) VALUES (?, 'relay-monitor', ?, ?, ?, 'dispatched', 1, ?, ?)
      `)
      .run(eventId, sourceEventId, payload.fingerprint, encodeJson(payload), timestamp, timestamp);

    const waitIds = claimWait ? [monitorRow.wait_id] : [];
    const relation = claimWait
      ? `bound Monitor ${monitorRow.id} detected ${proposal.type}`
      : `bound Monitor ${monitorRow.id} failed`;
    const decision = {
      disposition: "deliver",
      actionable: true,
      deliveries: [{
        session_id: monitorRow.session_id,
        wait_ids: waitIds,
        relation,
        confidence: 1,
      }],
      evidence: [`validated binding from Monitor ${monitorRow.id}`],
      summary: relation,
    };
    this.database
      .prepare(`
        INSERT INTO routing_decisions (
          id, event_id, disposition, actionable, summary,
          evidence_json, decision_json, created_at
        ) VALUES (?, ?, 'deliver', 1, ?, ?, ?, ?)
      `)
      .run(
        this.idFactory(),
        eventId,
        decision.summary,
        encodeJson(decision.evidence),
        encodeJson(decision),
        timestamp,
      );
    const deliveryId = this.insertDelivery({
      eventId,
      sessionId: monitorRow.session_id,
      relation,
      confidence: 1,
      timestamp,
    });
    if (claimWait) {
      this.database
        .prepare("INSERT INTO delivery_waits (delivery_id, wait_id) VALUES (?, ?)")
        .run(deliveryId, monitorRow.wait_id);
      this.database
        .prepare(`
          UPDATE waits
          SET status = 'claimed', version = version + 1, updated_at = ?
          WHERE id = ?
        `)
        .run(timestamp, monitorRow.wait_id);
    }
    this.database
      .prepare(`
        INSERT INTO monitor_triggers (
          id, monitor_id, check_id, trigger_key, event_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(this.idFactory(), monitorRow.id, checkId, proposal.key, eventId, timestamp);
    this.bumpRoutingEpoch();
    return eventId;
  }

  bumpRoutingEpoch() {
    this.database
      .prepare("UPDATE runtime_counters SET value = value + 1 WHERE name = 'routing_epoch'")
      .run();
  }
}

function hydrateWaitRegistration(row, waits) {
  return {
    session_id: row.id,
    task_summary: row.task_summary,
    context: decodeJson(row.context_json),
    version: row.version,
    created_at: row.created_at,
    updated_at: row.updated_at,
    waits,
  };
}

function hydrateWait(row) {
  return {
    wait_id: row.id,
    session_id: row.session_id,
    phase: row.phase,
    status: row.status,
    exclusive: Boolean(row.exclusive),
    exclusive_owner_key: row.exclusive_owner_key,
    version: row.version,
    ...decodeJson(row.wait_card_json),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function hydrateRoutingAttempt(row) {
  return {
    routing_attempt_id: row.id,
    event_id: row.event_id,
    pass: row.pass,
    router: row.router,
    model: row.model,
    output: row.output_json == null ? null : decodeJson(row.output_json),
    usage: row.usage_json == null ? null : decodeJson(row.usage_json),
    error: row.error,
    created_at: row.created_at,
  };
}

function hydrateEvent(row) {
  return {
    event_id: row.id,
    source: row.source,
    source_event_id: row.source_event_id,
    fingerprint: row.fingerprint,
    payload: decodeJson(row.payload_json),
    state: row.state,
    version: row.version,
    received_at: row.received_at,
    updated_at: row.updated_at,
  };
}

function hydrateDecision(row) {
  return {
    decision_id: row.id,
    event_id: row.event_id,
    disposition: row.disposition,
    actionable: Boolean(row.actionable),
    summary: row.summary,
    evidence: decodeJson(row.evidence_json),
    raw: decodeJson(row.decision_json),
    created_at: row.created_at,
  };
}

function hydrateActivation(row) {
  return {
    activation_id: row.id,
    session_id: row.session_id,
    trigger_type: row.trigger_type,
    state: row.state,
    delivery_ids: decodeJson(row.delivery_ids_json),
    lease_owner: row.lease_owner ?? null,
    lease_expires_at: row.lease_expires_at ?? null,
    accepted_at: row.accepted_at ?? null,
    last_error: row.last_error ?? null,
    committed_at: row.committed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function hydrateMonitorCheck(row) {
  return {
    check_id: row.id,
    monitor_id: row.monitor_id,
    version_id: row.version_id,
    kind: row.kind,
    state: row.state,
    error_class: row.error_class,
    error: row.error,
    started_at: row.started_at,
    finished_at: row.finished_at,
  };
}

function hydrateMonitorVersion(row) {
  return {
    version_id: row.id,
    monitor_id: row.monitor_id,
    artifact_hash: row.artifact_hash,
    manifest: decodeJson(row.manifest_json),
    created_at: row.created_at,
  };
}

function hydrateObservation(row) {
  return {
    observation_id: row.id,
    check_id: row.check_id,
    monitor_id: row.monitor_id,
    sequence: row.sequence,
    state_hash: row.state_hash,
    data: decodeJson(row.data_json),
    observed_at: row.observed_at,
  };
}

function hydrateMonitorTrigger(row) {
  return {
    trigger_id: row.id,
    monitor_id: row.monitor_id,
    check_id: row.check_id,
    trigger_key: row.trigger_key,
    event_id: row.event_id,
    created_at: row.created_at,
  };
}

function nextMonitorCheckAt(schedule, clockValue) {
  const intervalMs = schedule.interval_seconds * 1000;
  return new Date(clockValue.getTime() + intervalMs).toISOString();
}

function hashJson(value) {
  return createHash("sha256").update(encodeJson(value)).digest("hex");
}

function encodeJson(value) {
  return JSON.stringify(value);
}

function decodeJson(value) {
  return value == null ? null : JSON.parse(value);
}

function toIso(value) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
