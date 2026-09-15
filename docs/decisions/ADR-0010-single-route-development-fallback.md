# ADR-0010: Single real route with deterministic development fallback

- Status: accepted
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
access or credentials. This decision does not change worker selection and does
not claim that a model failure automatically retries through RSS.

## Consequences

- Development can run with zero model credentials while preserving a useful,
  source-backed result.
- A second eligible provider is not required for this checkbox, but the route
  pair is not yet an automatic failure fallback chain.
- Fallback-on-failure behavior, multiple live providers, BYOK, and delivery
  remain separate future work.

## Alternatives considered

- Require a second hosted provider now: rejected because it would add external
  credentials and infrastructure before the provider adapter boundary is
  proven.
- Treat the deterministic RSS result as a model provider: rejected because it
  performs no model synthesis and must remain an explicit non-model route.
- Claim automatic fallback on Ollama failure: rejected because the current
  worker records model failures and does not retry through RSS.
