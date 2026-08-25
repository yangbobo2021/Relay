# Active Writer Recovery Acceptance

This sanitized run used two real Codex App Server clients and one disposable Thread
in a temporary Workspace. One client retained writer ownership while the Codex DSH
adapter attempted native resume. The owner then exited and the same adapter retried.

The accepted run verified stable conflict classification, retry metadata, unchanged
one-to-one binding, and resume of the exact original Thread after owner exit. The
disposable Thread and Workspace were removed. No Thread ID or account data is stored
in this evidence.
