# ADR-0006: Model capability metadata

- Status: accepted
- Date: 2026-09-15

## Context

Stage 6 needs model suitability information before a router can choose among routes. The existing local Ollama adapter already enforces briefing synthesis, strict structured JSON, and exact citation preservation. Provider availability, quotas, rate limits, credentials, and fallback decisions are separate concerns and must not be encoded as model capabilities.

## Decision

Define `BriefingModelMetadata` in `@tatu/shared` with a stable model ID and readonly `BriefingModelCapability` values. The current model contract records only:

- `briefing-synthesis`
- `structured-json`
- `citation-preservation`

Every `LocalBriefingModel` exposes frozen metadata. `OllamaBriefingModel` reports the configured model ID and these capabilities. The deterministic RSS route remains a non-model fallback and does not invent model metadata.

## Consequences

- A future Model Router can evaluate suitability through a shared, provider-independent contract.
- Capability metadata cannot be mistaken for current provider health or quota eligibility; those remain later Stage 6 state and routing work.
- The metadata is intentionally narrow and can grow through explicit capability additions when a route proves a new behavior.

## Alternatives considered

- Put provider health and quota in the model metadata: rejected because suitability and availability are different decisions in the project architecture.
- Use an untyped string map: rejected because route selection needs compile-time vocabulary and tests.
- Mark the deterministic RSS fallback as a model: rejected because it does not perform model synthesis.
