# ADR-0012: Automatic fallback from local model to deterministic RSS

- Status: accepted
- Date: 2026-09-15

## Context

The local Ollama route can be unavailable or return an invalid/timeout result
after the RSS research has already produced a validated, source-backed
briefing. Treating that model error as a terminal execution failure would lose
the useful result and force a duplicate research request on retry.

## Decision

After successful RSS research, `createResearchExecutor` catches only the typed
`ModelError` classifications `model_unavailable`, `model_invalid_output`, and
`model_timeout` while the execution signal is still active. It returns the
already validated deterministic RSS result with sanitized metadata identifying
the source route and reason:

```text
route: deterministic-rss
fallback: { from: local-ollama, reason: <typed model reason> }
```

The scheduler persists that result and emits `fallback_used` immediately before
`succeeded` in the same SQLite transaction. The event detail contains only the
typed route and reason. SQLite result validation accepts only this exact
fallback shape.

Research errors, cancellation, aborted execution, and unknown model exceptions
remain failures. Research is never repeated and no second model is invoked by
this fallback.

## Consequences

The proven local route pair now preserves a useful briefing when local model
synthesis fails, while the execution trace makes the route change observable.
The fallback is limited to `local-ollama -> deterministic-rss`; it is not a
general provider/quota router, does not add a live provider, and does not claim
exactly-once external effects.

## Alternatives considered

- Retrying the model before using RSS was rejected because it delays a valid
  source-backed result and can repeat provider work.
- Re-running RSS after a model failure was rejected because the validated result
  is already available and a second fetch could change the briefing.
- Treating every exception as fallback was rejected because research failures,
  cancellation, and programming errors must remain visible failures.
