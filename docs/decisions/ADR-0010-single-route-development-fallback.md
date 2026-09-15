# ADR-0010: Single real route with deterministic development fallback

- Status: accepted; automatic failure behavior is extended by ADR-0012
- Date: 2026-09-15

## Context

Stage 6 requires either two eligible model routes or one real route plus a
deterministic development fallback. Stage 5 already provides a local
Ollama-compatible model adapter and a source-backed RSS result. The worker
currently chooses the model route only when `TATU_OLLAMA_MODEL` is configured;
otherwise it keeps the deterministic RSS route.

## Decision

Accept the current route pair for this roadmap outcome:

- `OllamaBriefingModel` is the first real model route and records
  `local-ollama` route metadata after strict cited-output validation.
- `RssBriefingSynthesizer` is the deterministic development fallback when no
  local model is configured and records `deterministic-rss`.

The existing worker tests prove both explicit paths without requiring network
access or credentials. Automatic failure behavior was intentionally deferred at
the time of this decision; ADR-0012 later adds the bounded typed model-failure
fallback without changing this route-pair choice.

## Consequences

- Development can run with zero model credentials while preserving a useful,
  source-backed result.
- A second eligible provider is not required for this checkbox; the route pair
  remains the local model plus a non-model deterministic result.
- Multiple live providers, BYOK, and delivery remain separate future work.

## Alternatives considered

- Require a second hosted provider now: rejected because it would add external
  credentials and infrastructure before the provider adapter boundary is
  proven.
- Treat the deterministic RSS result as a model provider: rejected because it
  performs no model synthesis and must remain an explicit non-model route.
- Claim automatic fallback on Ollama failure in this ADR: deferred to ADR-0012,
  which defines the later bounded behavior and its explicit tests.
