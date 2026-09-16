# ADR-0014: Bounded execution observability metadata

- Status: accepted
- Date: September 15, 2026

## Context

The first execution timeline showed status and immutable events, but it did
not explain which route produced a briefing or how long the local execution
took. The project has no pricing source and no general tool-call contract yet,
so displaying guessed costs or arbitrary provider payloads would be unsafe.

## Decision

The validated briefing result carries an optional `BriefingObservability`
summary. It contains only allowlisted provider and tool identifiers, a bounded
model identifier, a non-negative integer execution latency capped at one day,
and `estimatedCost: { status: "unknown" }` until a pricing basis exists.

The worker measures elapsed time with a monotonic clock across research,
optional local-model synthesis, fallback handling, and delivery. The first
route reports `public-rss`; a successful local model reports `local-ollama` and
its model ID. The tool list records the public RSS route, an attempted local
model, and the local file outbox when those paths participate. Existing typed
fallback metadata remains the source of fallback reasons.

The SQLite adapter validates this summary before returning a persisted
briefing, and the web timeline fetches the validated briefing endpoint and
renders only the bounded fields through DOM text nodes.

## Alternatives considered

- Guess a monetary value for free/local routes: rejected because no pricing
  source exists and a false cost would be misleading.
- Persist raw provider responses or arbitrary tool names: rejected because it
  would expand the sensitive payload and provider coupling surface.
- Add a separate telemetry service: deferred until the local execution slice
  proves a need for durable metrics.

## Consequences

The local page can explain route, model, tools, fallback, and measured latency
without adding a provider call or paid infrastructure. Estimated cost remains
explicitly unknown, and broader network-payload redaction, provider-specific
pricing, and multi-provider telemetry remain future work.
