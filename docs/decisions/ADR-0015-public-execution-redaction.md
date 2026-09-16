# ADR-0015: Public execution redaction boundary

- Status: accepted
- Date: 2026-09-16

## Context

Execution persistence needs internal correlation keys, raw serialized results, worker claims, and event diagnostics to support retries and recovery. Those records are not safe API payloads: a raw result or event detail can contain provider output, internal identifiers, or future integration data. A delivery receipt also contains the occurrence idempotency key required by the delivery contract, but that key is not part of a public briefing.

## Decision

Keep the persistence and scheduler contracts unchanged and add an API-only projection boundary:

- execution listings expose operational status, schedule, attempts, failure, and timestamps, while omitting occurrence keys, raw results, and worker claims;
- event listings expose only the allowlisted event type and timestamp, with detail set to `null`;
- briefing responses deep-project the approved topic, citations, facts, inference, route, model, fallback, observability, and delivery fields; delivery exposes channel and digests but never the idempotency key;
- cited URLs accepted by the SQLite adapter must be HTTPS and must not contain URL userinfo credentials.

The projection is provider-agnostic and does not change the replaceable `TatuStore` or introduce a production database decision.

## Consequences

The local web/API timeline remains useful without exposing internal correlation or raw provider payloads. Storage can retain the data required for idempotency and recovery. ADR-0019 adds tested URL query, delivery, scheduler-detail, and worker-log boundaries. This remains a bounded redaction boundary, not complete secret or PII detection: arbitrary sensitive text, unrestricted future network payloads, and future adapters require their own validation before the Stage 7 redaction checkbox can be marked complete.
