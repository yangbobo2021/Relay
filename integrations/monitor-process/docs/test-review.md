# Process Capability Test Review

The controlled-OS test launches a real child in a temporary project, asks the
production inspector to bind its PID/start identity, observes it running, terminates
it, and observes exited. It separately mutates the start identity under the same PID
and requires `identity_lost`. Cross-owner and signature mutations must fail, and the
published operation schema contains only read-only `status(handle)`.
