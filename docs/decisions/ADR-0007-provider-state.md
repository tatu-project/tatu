# ADR-0007: Provider availability state

- Status: accepted
- Date: 2026-09-15

## Context

Stage 6 needs current provider availability facts before a future router can
choose an eligible route. Model suitability metadata is not enough: quota,
rate limits, latency, and recent failures describe the provider at runtime and
must remain separate from the model contract.

## Decision

Define `ProviderStateStore` in `@tatu/shared` with typed observations and
readonly snapshots. The first implementation is
`InMemoryProviderStateStore` in `@tatu/research`. It records:

- `unknown`, `healthy`, `unavailable`, `rate-limited`, and `quota-exhausted`
  status;
- bounded provider identifiers and sanitized diagnostic text;
- quota and rate-limit remaining counts with reset timestamps;
- observed latency, the last typed failure, and consecutive failures.

The store is process-local and observation-only. It does not call providers,
hold credentials, persist data, or select routes. Snapshots are defensive and
frozen. The persistence port remains replaceable so a future PostgreSQL or
other deployment adapter can be introduced without putting provider-specific
or SQLite-specific behavior in the domain.

## Consequences

- A future Model Router and Quota/Provider Router can consume separate,
  explicit suitability and availability contracts.
- Restarting the process clears this first implementation's state; durable
  provider state is intentionally deferred until its storage and lifecycle are
  designed.
- The current implementation proves state transitions and validation without
  claiming provider routing, fallback, BYOK, or production persistence.

## Alternatives considered

- Put health and quota into `BriefingModelMetadata`: rejected because model
  suitability and provider availability change for different reasons.
- Persist provider state directly in SQLite: rejected because the first
  implementation is a local adapter and production database selection remains
  open.
- Store raw provider responses or credentials in observations: rejected due to
  secret and payload exposure risk.
