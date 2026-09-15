# ADR-0013: Local filesystem delivery channel

- Status: accepted
- Date: 2026-09-15

## Context

Stage 7 needs one zero-cost delivery channel that works in the approved local
self-hosted deployment without requiring an account, paid service, or network
credential. The channel must remain replaceable and must not turn a filesystem
write into a claim of distributed exactly-once delivery.

## Decision

Add the shared `BriefingDelivery` port and a `FileBriefingDelivery` adapter in
`@tatu/storage`. The worker enables it by default under `data/deliveries`, with
`TATU_DELIVERY_DIR` available for a local override.

For each final validated briefing, the adapter:

- receives the occurrence's exact `idempotencyKey`;
- hashes that key into a safe Markdown artifact name;
- writes a deterministic, cited, human-readable briefing without the raw key,
  provider payload, or credentials;
- publishes through a temporary file and atomic non-overwriting link;
- treats the same key and identical content as idempotent; and
- rejects the same key with different content as a delivery conflict.

The executor delivers after research/model/fallback selection and returns a
typed receipt. The scheduler validates that receipt, persists it with the
briefing, and records `delivered` before `succeeded`. Delivery errors remain
retryable/failable and are recorded as `delivery_failed`.

## Limits

This is a local inbox artifact, not a push notification to a phone and not an
email, Telegram, webhook, or OAuth integration. It does not provide retention,
cleanup, cross-machine synchronization, encryption beyond the host filesystem,
or distributed exactly-once guarantees for future external effects. The user
must open the configured local directory or a future local UI to read it.

## Alternatives considered

- stdout was rejected because it is not durable across a worker restart.
- Email, Telegram, and webhooks were deferred because they require provider
  choices, credentials, and additional delivery semantics.
- Writing the occurrence key directly into a path was rejected because a key is
  untrusted input; hashing keeps the artifact name bounded and safe.
