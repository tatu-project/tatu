# ADR-0009: Quota and provider eligibility router

- Status: accepted
- Date: 2026-09-15

## Context

The capability-only Model Router can identify a suitable model, but execution
also needs a separate provider availability decision. The provider state
foundation now records health, quota, and rate-limit observations without
selecting routes.

## Decision

Define `ProviderRouteCandidate` and `QuotaProviderRouter` in `@tatu/shared`.
The first `@tatu/research` implementation evaluates each ordered candidate by
both decisions:

- the model metadata contains every requested capability;
- the candidate's provider snapshot is `healthy`;
- quota and rate-limit `remaining` values are either `null` or nonzero.

The router returns the first eligible candidate, or `undefined` when none is
eligible. It reads the injected `ProviderStateStore` but does not call a
provider, mutate candidates or state, persist data, retry, or execute fallback.
Provider identity stays on the route candidate rather than being inferred from
model suitability metadata.

## Consequences

- Model suitability and current provider eligibility remain explicit, separate
  decisions that later execution code can compose.
- The first implementation is deterministic and testable with process-local
  state, while production persistence and provider adapters remain replaceable.
- This decision does not claim two working providers, automatic fallback,
  BYOK, or worker integration.

## Alternatives considered

- Let `ModelRouter` inspect provider state: rejected because its contract is
  capability-only.
- Treat `unknown` providers as eligible: rejected because execution needs a
  positive health observation and should not guess availability.
- Retry or fall back inside this selector: rejected because execution policy,
  trace semantics, and idempotency belong to a later outcome.
