# ADR-0019: Bounded secret boundaries for URLs and execution diagnostics

- Status: accepted
- Date: 2026-09-16

## Context

ADR-0015 established an API projection that omits internal execution fields, but
secrets could still enter lower-level boundaries through URL query parameters,
delivery artifacts, scheduler event details, or worker error logging. These
paths must fail closed without exposing raw provider payloads or changing the
replaceable storage and provider contracts.

## Decision

Apply one shared URL policy at every current URL boundary:

- reject URL userinfo and obvious credential query names or token-shaped query
  values before public RSS fetches, redirects, cited-story persistence, loopback
  model endpoint use, or file delivery;
- preserve ordinary query parameters such as pagination and feed format;
- persist only fixed scheduler event detail codes, never worker IDs, retry
  timestamps, artifact IDs, URLs, or exception messages;
- log a fixed redacted worker poll diagnostic rather than the thrown error.

This is a bounded secret boundary, not a general PII or arbitrary sensitive
text detector. New providers, delivery adapters, network payloads, and user
content require their own validation before this item can be considered
complete.

## Alternatives considered

- Strip every query parameter: rejected because ordinary public feeds may use
  pagination or format parameters.
- Serialize or redact raw exceptions: rejected because a fixed diagnostic is
  safer and sufficient for the current worker surface.
- Claim complete PII detection: rejected because reliable arbitrary-text
  classification is not implemented.

## Consequences

The current RSS, SQLite briefing, local file delivery, scheduler event, and
worker-log paths have explicit, tested secret boundaries. Some legitimate URLs
whose query names intentionally carry credentials are rejected rather than
redacted. The Stage 7 redaction checkbox remains open for arbitrary sensitive
text/PII, future adapter coverage, and complete network-payload redaction.
