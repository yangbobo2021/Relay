# Monitor Author Test Review

The release suite separates static instruction checks from runtime proof. Static
checks ensure the safety sequence cannot silently regress; they do not claim that
DSH discovered the Skill. The Cordis integration test loads the real DSH Skill
registry, observes the entry, loads the body, and disposes the plugin. Package audit
checks the produced tarball rather than the source tree. Official-DSH acceptance
uses a packed artifact and a real DSH Agent whose Session-scoped Relay tool creates
a durable typed Monitor.

False-pass controls:

- discovery asserts the provider, source, invocation policy, resource base, and
  exact body marker rather than merely importing `host-plugin.js`;
- lifecycle checks the catalog after disposal;
- instruction ordering uses byte positions and fail-closed phrases;
- the package test rejects a surviving `.codex-plugin` path and checks tar entries;
- official acceptance checks the created Monitor's owner against the DSH Session.

An import-only smoke test, a source-directory Skill file, or a Monitor created
directly through the Events service is insufficient for MA-002, MA-003, or MA-009.
