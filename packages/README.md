# Packages

No product runtime remains in this directory. Durable state and delivery moved to
`integrations/events`, semantic model routing to `integrations/semantic-router`,
and monitor execution to `integrations/monitors`. These are independent Git
submodules, each owning its specification, tests, build and distribution.

Relay root owns composition and cross-plugin acceptance, not a private runtime SDK
required by those plugins.
