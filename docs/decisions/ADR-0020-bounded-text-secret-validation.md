# ADR-0020: Bounded text-secret validation

- Status: accepted
- Date: 2026-09-16

## Context

ADR-0019 closed several URL, event, and diagnostic paths, but ordinary text
fields could still carry a credential-shaped value into research results,
model output, persistence, delivery artifacts, or the public API projection.
The product does not need to claim universal PII classification to block the
highest-confidence accidental credential leaks in the current local routes.

## Decision

Add one shared, deliberately narrow text policy that detects credential-shaped
assignments, bearer/basic/token schemes, JWT-like values, URL userinfo, and
well-known key prefixes. Apply it at the current boundaries:

- reject unsafe topics during parsing, task creation, and research;
- filter unsafe RSS titles/sources and reject unsafe model IDs or model output;
- reject unsafe briefing values before SQLite persistence or file delivery;
- reject unsafe final worker results before delivery or serialization; and
- reject credential-bearing provider observations before process-local state;
- redact recognized values in the API's defensive public projection.

The policy is not a general PII detector. Short or ambiguous natural-language
values remain allowed, while URL query credentials continue to use ADR-0019's
separate URL policy.

## Alternatives considered

- Claim complete arbitrary-text/PII redaction: rejected because reliable
  classification is not implemented.
- Redact every text value: rejected because it would damage ordinary topics,
  citations, and model metadata.
- Leave text validation to one adapter: rejected because future adapters and
  direct persistence paths need defense in depth.

## Consequences

Current parser, research, Ollama, provider-state, worker, SQLite,
file-delivery, and API paths have tested coverage for high-confidence text
credentials. This remains a bounded local policy: unrestricted future network
payloads, arbitrary PII, additional providers, and new adapters require their
own validation before the Stage 7 redaction checkbox can be marked complete.
