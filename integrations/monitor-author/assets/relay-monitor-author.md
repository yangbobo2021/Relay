# Relay Monitor Author

Use this skill when the user wants the current DeepSeek Harness Session to resume
after an external condition. A generated module is not an installed Monitor.

Reply in the user's language. Preserve identifiers, tool results, and validation
errors exactly, but localize explanations in English or Simplified Chinese.

## Required workflow

1. Call `relay_list_monitor_bundle_types` with the user's locale. Treat this live
   result as authoritative; do not rely on a remembered type list.
2. If an `available` registered type satisfies the condition, call
   `relay_create_monitor_from_type` with its exact `type_id`, `bundle_version`, and
   schema-valid parameters. Do not generate a custom Bundle in this case.
3. If a matching type is `configuration_required`, `unavailable`, or
   `incompatible`, explain its localized remediation. Do not silently bypass its
   authorization with a custom Bundle.
4. Only when no registered type represents the condition, identify an installed
   read-only capability provider and request the narrowest resource handle it
   supports. For process exit, call `relay_issue_process_handle` with the exact PID
   and use the returned opaque Handle; never grant or poll a raw PID.
5. Choose `scope: session` by default. Choose `scope: project` only when the same
   immutable Bundle should be reusable by Sessions whose authenticated working
   directories resolve to the same canonical project root or a descendant. Never
   use project scope to cross a sibling, parent, path-prefix lookalike, or symlink
   escape boundary.
6. Build a contract-version-1 manifest and deterministic module. Use only approved
   provider, operation, and arguments. Set an explicitly zoned expiry no more than
   30 days away, a bounded cadence, complete schemas, one declared Event type, and
   both `en-US` and `zh-CN` presentation text.
7. Check `observe` and `detect` against at least: initial baseline, no change,
   target transition, repeated target state, malformed provider result, denied
   capability, and expiry. Detection must emit no initial Event and must use a
   stable non-secret trigger key.
8. Call `relay_validate_monitor_bundle` with the exact manifest and source. If it
   fails, stop or correct the reported issue. Never claim success.
9. Call `relay_install_monitor_bundle` using only the returned `validationId`.
   Never regenerate, edit, or substitute source or manifest after validation.
10. Report success only from the install result. Include Monitor IDs, artifact
    hash, approved capability names, next check, Bundle expiry, and that the
    Monitor can be inspected, paused, resumed, run now, or stopped with
    `relay_manage_monitor`.

For an update, validate the complete replacement first, then call
`relay_update_monitor_bundle` with the returned receipt, owned Monitor ID, and the
last inspected Monitor version. A failed baseline means the old version remains
active. For a rollback, call `relay_rollback_monitor_bundle` with a retained version
ID; Relay must reject an expired version or any rollback that would restore broader
capabilities.

## Security rules

- Never place credentials, tokens, environment values, raw secrets, or secret
  handles in prose, Event data, trigger keys, logs, or source.
- Never request mutation, command execution, outbound messaging, unrestricted
  network/browser access, or another Session/project's resource.
- Never invent a capability provider or assume a plugin is installed.
- Do not weaken schemas to `additionalProperties: true` merely to pass validation.
- Treat missing Relay Monitor tools, denied handles, failed validation, expired
  receipts, failed baselines, or missing durable IDs as a failed installation.
- Keep the continuation specific enough that the resumed Agent knows the next
  action, success condition, and relevant artifact.

For a process-exit custom Bundle, load `process-exit.md` from this skill's resource
directory before generating the manifest or module.
