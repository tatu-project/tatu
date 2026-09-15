# ADR-0011: Local BYOK encrypted connection storage foundation

- Status: accepted
- Date: 2026-09-15

## Context

Stage 6 needs a safe boundary for users who eventually connect their own model
provider credentials (BYOK). The boundary must not couple the domain to SQLite,
leak plaintext secrets to persistence, or imply that provider authentication is
already implemented.

## Decision

`@tatu/shared` defines a replaceable `ByokConnectionManager` and an
`EncryptedSecretRecordStore` port. `@tatu/storage` provides a process-local
`ByokConnectionService` that:

- encrypts API-key secrets with AES-256-GCM using a caller-supplied 32-byte key;
- uses a random IV and authenticated data bound to connection, owner, provider,
  and authentication kind;
- stores only encrypted envelopes through the backing port;
- returns metadata, never plaintext, from owner-scoped listing;
- enforces owner scope for reveal and disconnect; and
- rejects malformed, tampered, wrong-key, unsupported-algorithm, oversized, and
  invalid-auth records.

The default backing adapter is an in-memory local adapter for the first version.
The port is intentionally replaceable so a future durable adapter can target
PostgreSQL or another approved store without spreading storage-specific SQL into
the domain.

## Explicit limits

This decision is a local encrypted-storage foundation, not provider integration.
It does not implement provider authentication or OAuth, provider calls, key
ownership, key rotation, a production key-management system, durable secret
persistence, worker route integration, or automatic fallback after a model
failure. The production database and deployment decision remain open. No
Supabase, Firebase, VPS, or new dependency is introduced.

## Alternatives considered

- Plaintext environment variables or maps were rejected because they cannot
  provide an encrypted persistence boundary or owner-scoped retrieval.
- Storing raw API keys in SQLite was rejected because it would couple the first
  adapter to a database choice and expose secrets at rest.
- A managed external secret service was deferred because the first local,
  zero-cost deployment does not yet have a provider or key-management decision.

## Consequences

The connection contract and encryption behavior can be tested now without real
provider credentials or network access. A future adapter must preserve the
encrypted-record port and key-management guarantees before this foundation can
be called production-ready.
