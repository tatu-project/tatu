# ADR-0008: Capability-only model router

- Status: accepted
- Date: 2026-09-15

## Context

Stage 6 needs a deterministic way to choose a model whose proven behavior fits
a task. Model suitability is separate from provider availability: the current
provider-state store must not decide whether a model is suitable, and this
first router must not become fallback or quota orchestration.

## Decision

Define `BriefingModelRequest` and `ModelRouter` in `@tatu/shared`. The first
implementation, `CapabilityModelRouter` in `@tatu/research`, receives an
ordered list of `LocalBriefingModel` candidates and selects the first model
whose metadata contains every requested `BriefingModelCapability`.

Selection is deterministic and capability-only:

- candidate order is the tie-break;
- an empty requirement list selects the first candidate;
- no candidate or no match returns `undefined`;
- selection never calls `synthesize` or mutates the candidates;
- provider health, quota, rate limits, credentials, persistence, fallback, and
  BYOK remain outside this contract.

## Consequences

- Later execution code can request proven capabilities without knowing how a
  model adapter is implemented.
- The router can be tested without network access or provider credentials.
- Availability and route eligibility still require the separate
  Quota/Provider Router work; this decision does not claim an executable
  fallback chain.

## Alternatives considered

- Consult `ProviderStateStore` during model selection: rejected because
  suitability and current availability are different decisions.
- Invoke `synthesize` while selecting: rejected because selection must remain
  side-effect free and provider calls belong to execution.
- Score models using latency, cost, or context heuristics now: rejected because
  those fields are not proven by the current capability contract and belong to
  later routing decisions.
