# Plugin Persistent Data Lifecycle Specification

## Purpose

This specification governs every Relay DSH plugin that creates or consumes data
which survives the plugin process, package installation, DSH restart, or plugin
uninstall. Persistent data includes databases, schema metadata, files, caches that
affect correctness, credentials, bindings, queues, and recovery artifacts.

Package lifecycle and data lifecycle are independent. Removing a plugin package
MUST NOT be treated as proof that its data is absent. A later reinstall MUST safely
handle the same data states as an in-place upgrade.

## PD-01: Ownership And Inventory

Each persistent plugin MUST document, in its own repository:

- every default and configurable data location, including whether it is global,
  profile-scoped, project-scoped, or shared with another plugin;
- the records, tables, indexes, triggers, files, and schema-version metadata it owns;
- the oldest schema version the current release supports upgrading;
- retention, backup, export, recovery, and explicit deletion behavior;
- whether older plugin binaries can read data after the upgrade.

Schema versions MUST be explicit and MUST NOT be inferred only from the npm package
version. A plugin sharing a database MUST mutate only its documented namespace and
MUST preserve data owned by other plugins.

## PD-02: Lifecycle Contract

A supported plugin release MUST define behavior for all of these entry states:

1. no data path exists;
2. the data path exists but is empty or contains only storage metadata;
3. data is already at the current schema;
4. data is at every supported historical schema;
5. the package was uninstalled while its data was retained, then reinstalled;
6. a previous activation or migration was interrupted or only partially applied;
7. another process attempts activation or migration concurrently;
8. data is corrupt, structurally inconsistent, from an unsupported older schema,
   or from a newer schema.

Missing or empty storage MUST initialize directly to the current safe schema.
Current storage MUST open without destructive rewrites. Supported historical states
MUST migrate automatically during plugin activation. Normal supported upgrades MUST
NOT require users to locate or delete their data manually.

Uninstall MUST preserve user data by default unless the product explicitly documents
a separate deletion operation. Data deletion MUST name the affected paths and require
explicit confirmation; it MUST NOT be hidden inside package removal, reinstallation,
or a startup fallback.

Unsupported, unknown non-empty, corrupt, and future-schema states MUST fail closed
before mutation. The error MUST identify the data location, detected state, supported
range, and a safe recovery action without exposing private record contents.

## PD-03: Migration Ordering

Migration code and all required migration assets MUST ship in the plugin artifact.
The first activation after installation or upgrade MUST run storage discovery,
validation, backup when required, and migration before starting any consumer of the
new schema.

In particular, a plugin MUST add or backfill a column or record shape before it
creates an index, trigger, prepared statement, query, Remote, listener, or background
worker that depends on that shape. Storage initialization MUST NOT create the latest
dependent indexes first and attempt historical migration afterward.

Version metadata alone is insufficient evidence of structure. Before each step, the
plugin MUST validate the expected version and structural preconditions. It MUST
validate the resulting structure before recording the new version. The current
schema version is committed last.

Activation readiness MUST be reported only after migration and post-migration
validation succeed. If activation fails, the original migration cause and recovery
location MUST remain visible rather than being reduced to a generic DSH startup
failure.

## PD-04: Atomicity, Backup, And Recovery

Migration execution MUST be single-writer and deterministic. Each supported path
MUST be an ordered sequence of versioned steps. A retry after interruption MUST
either be idempotent or detect the completed structural effect before continuing.

Before changing existing non-empty user data, the plugin MUST create and verify a
recoverable backup unless it can prove that the whole change is durably atomic and
non-destructive. The original data, schema version, and backup path MUST be known
before mutation begins. Backup files MUST retain appropriately restrictive access,
remain excluded from source control and package artifacts, and receive the same
privacy treatment as the source data.

All changes for one migration attempt MUST run in the strongest transaction supported
by the storage engine. On failure, the plugin MUST:

- roll back uncommitted schema and data changes;
- leave the source usable by the previous version whenever the storage engine permits;
- retain the verified backup;
- avoid starting workers against a mixed schema;
- emit an actionable, sanitized error with the failed migration step.

A successful migration MUST validate structural invariants, constraints, and storage
integrity before normal plugin work begins. Backups MUST NOT be silently deleted as
part of the same activation; retention or cleanup is a separate documented policy.

## PD-05: Data Semantics

Migrations MUST preserve user-visible and operational semantics, not only make the
latest code stop throwing. Required identifiers, ownership, ordering, deduplication,
correlation, retry state, terminal state, timestamps, and references MUST retain their
meaning across the upgrade.

New required values need an explicit deterministic backfill or a documented nullable
transition. A migration MUST NOT invent successful delivery, authorization, ownership,
or completion evidence. Destructive or lossy transformations require an export or
backup, explicit release notes, and user confirmation when they cannot be reversed.

## PD-06: Compatibility And Downgrade

Each release MUST declare its readable and migratable schema range. A plugin MUST
refuse to open a future schema for writes. If downgrade is not supported, the upgrade
documentation MUST say so before the migration is applied and identify the backup or
export recovery path.

Moving a default data location does not reset this obligation. The plugin MUST either
discover and migrate known legacy locations safely or stop with instructions that
preserve the old data. It MUST NOT silently initialize a second empty store while
abandoning an existing authoritative store.

## PD-07: Required Test Matrix

Every persistent plugin MUST keep sanitized, reproducible fixtures or builders for
every supported historical schema. Those fixtures MUST represent the schema actually
published, not only a reconstruction from current migration code.

Automated tests MUST cover the entry states in PD-02 and assert, as applicable:

- final schema version and exact required columns, records, indexes, triggers, and
  constraints;
- preservation and correct backfill of representative records;
- storage integrity and referential-integrity checks;
- no mutation of data outside the plugin's ownership;
- creation and usability of the required backup;
- transaction rollback after an injected failure at each material migration phase;
- safe serialization or rejection of concurrent activation;
- a second activation as a no-op, proving retry and startup idempotency;
- actionable fail-closed behavior for unsupported, future, unknown, and corrupt data.

At least one acceptance scenario MUST create representative data with the previously
published plugin, retain that data while installing the packed candidate, and start
the candidate in an isolated official DSH profile. It MUST wait for DSH readiness and
verify the migrated data afterward. A second scenario MUST uninstall the old package
without deleting its data, reinstall the candidate, and produce the same result.

A fresh-profile boot alone is not upgrade evidence. Tests that replace, delete, or
rebuild the historical database before candidate startup do not satisfy this gate.

## PD-08: Release Gate

Any pull request that changes persistent structure, default data location, migration
logic, or storage dependencies MUST update the inventory, migration fixtures, test
matrix, and recovery documentation in the same change.

Before publishing or advancing an npm dist-tag, the owning plugin repository MUST
record all of the following:

1. unit and failure-injection migration tests pass;
2. packed-artifact upgrade and uninstall/reinstall scenarios pass against the pinned
   official DSH version;
3. the candidate reaches DSH readiness with both fresh and upgraded storage;
4. retained records and post-migration integrity checks pass;
5. the published artifact contains the migration implementation and documented
   recovery instructions;
6. release notes state the supported source-schema range, backup behavior, and any
   downgrade limitation.

Stable and preview channels are independent gates. If a faulty immutable npm preview
was published, the fix MUST use a higher prerelease version and move the preview
dist-tag only after the same upgrade checks pass. A stable tag MUST NOT be advanced
from fresh-install evidence alone.

The Relay distribution MUST NOT advance a persistent plugin submodule pointer or
claim compatibility until this evidence is linked from the relevant acceptance
record.
