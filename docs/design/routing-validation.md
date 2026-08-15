# Routing Validation Design

## Question to Prove

Can Relay autonomously give every accepted email an appropriate disposition while
favoring actionable-event recall over token cost and avoiding incorrect exclusive
session wakeups?

The first experiment tests routing decisions only. It does not call Gmail or a real
agent and does not measure the quality of actions taken after delivery.

## Prototype Strategy

For the initial fixture set, the candidate builder includes every active or claimed
wait. This establishes a recall baseline before retrieval optimization can hide model
failures.

The experiment compares two semantic strategies:

1. A single-pass router sees every candidate and returns the final structured
   decision directly.
2. A two-pass router first evaluates every candidate independently, then gives all
   positive and uncertain candidates to an adjudicator for the final decision.

In the two-pass variant, the recall pass must not choose a single winner. The
adjudicator may deliver to multiple sessions only when all selected relationships
are non-exclusive. When an actionable exclusive event cannot be attached safely, it
returns `escalate`.

Exact identifiers, headers, sender addresses, subjects, and timestamps are features,
not hard requirements. At least one test variant strips provider correlation fields
from every event.

## Baselines

Run the same fixtures through:

1. metadata-only exact matching;
2. one-pass semantic routing; and
3. two-pass recall plus adjudication.

The comparison determines whether the second model pass buys enough recall or
exclusive-target safety to justify its token and latency cost. Model names and prompt
versions are recorded with every result, not fixed by this design.

The initial runtime should use the least expensive strategy that passes the fixed
gates. A second pass can remain an escalation path for invalid output, an unresolved
exclusive conflict, or an actionable `escalate` that still has plausible existing
candidates.

## Metrics

`actionable coverage` is the share of expected `deliver` or `escalate` events that the
router does not dismiss.

`target recall` is the share of expected existing-session targets included in the
deliveries.

`exclusive misroute rate` counts events delivered to the wrong session when the
expected relationship is exclusive.

`escalation overhead` counts escalations where an existing target was expected.

`duplicate injection count` measures extra deliveries caused by repeated
ingestion.

Also record unresolved-event age, total model calls, input and output tokens, and
end-to-end routing latency.

## Initial Gates

Before runtime implementation is extended beyond the local vertical slice:

- every critical fixture must have actionable coverage;
- every expected exclusive target in the fixed regression set must be selected
  without an additional wrong target;
- duplicate ingestion must create zero extra deliveries and runs;
- every accepted event must reach its expected terminal outcome after injected
  transient failures; and
- each result must retain enough evidence to reproduce the model decision.

These gates apply to a fixed regression set and are not a claim of perfect real-world
model accuracy. A production threshold should be chosen only after the fixture set is
large and representative enough to estimate it.

## Fixture Policy

The executable cases live in the
[email routing fixture index](../../fixtures/email-routing/README.md). Cases use only
reserved example domains and invented business data. Each case defines candidate
sessions, the incoming event, and one expected disposition.

Add a regression case before changing a prompt or policy to fix an observed routing
failure. Do not weaken an expected result merely to make a model pass; document an
intentional policy change in the specification or decision log first.
