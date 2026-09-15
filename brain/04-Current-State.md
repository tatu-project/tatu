---
title: Current State
tags:
  - tatu
  - current-state
updated: 2026-09-15
---

# Current State

- Stage 2 — technical foundation is complete.
- Foundation documents and repository-safe editor settings are on `main`.
- Project-scoped Codex roles are configured as `recon`, `executor`, and `reviewer`; all three were discovered and dispatched successfully after the Codex restart.
- This Obsidian-compatible brain is the compact continuity layer; it does not replace authoritative sources.
- The npm-workspaces TypeScript foundation uses Node.js `>=24.11.0 <25` and npm `>=11.6.0 <12`. ADR-0001's dependency-free Stage 2 runtime is superseded narrowly by ADR-0002: `better-sqlite3` is the sole approved production runtime dependency for local task persistence.
- Founder 2 attested that organization access is active, the repository was cloned at `C:\Users\vitti\OneDrive\Desktop\tatu` and opened in VS Code, and `git push --dry-run origin main` returned `Everything up-to-date`. Node.js `v24.13.0` and npm `11.6.2` were reported; commit `844ed99` by Vittor Augusto Gomes is on `origin/main`.
- `npm ci` and `npm run ci` were verified on Node.js `v24.11.1` and npm `11.6.4`; the dev smoke test returned `200` from both `/` and `/api/health`.
- Stage 4 is complete: SQLite is isolated as the local `@tatu/storage` adapter behind persistence ports. The approved first deployment is one individual local/self-hosted installation; future remote/shared PostgreSQL remains conditional. Durable occurrence keys are propagated as future adapter idempotency keys; local execution has a single final state, leases, retry/cooperative timeout, DST policy, restart recovery, immutable events, and `SQLITE_BUSY` contention handling. `npm run ci` passed with 17 tests, including API event, idempotency-key, and SQLite lock coverage.
- Stage 5 is complete for the deterministic cited-briefing acceptance: `@tatu/research` defines database-independent feed/synthesizer ports, a credential-free public HTTPS RSS adapter, and an optional loopback-only Ollama model adapter. RSS has cancellation, canonical URL/title deduplication, relevance-first ranking, source validation, bounded public fetching, private-destination rejection, explicit source-backed facts, and a selected TechCrunch Artificial Intelligence default that remains replaceable through `TATU_RSS_FEEDS`. Portuguese and English AI topic aliases match standalone `AI` titles without broad substring matching. Ollama receives only selected stories, requires strict JSON, validates exact citations, and never stores secrets. The worker emits separate `research_failed` and `model_failed` events; an empty Ollama model configuration keeps the explicit deterministic RSS fallback. `GET /api/executions/:id/briefing` returns validated saved results. `npm run ci` passed with 34 tests. A network-enabled temporary scheduled run produced three distinct HTTPS stories, three facts, a persisted result, and `queued` -> `claimed` -> `succeeded`; Stage 6 is next. Delivery remains a later Stage 7 outcome.
- Stage 6 has ADR-0006, ADR-0007, and ADR-0008: `@tatu/shared` defines readonly model suitability metadata, a separate `ProviderStateStore`, and a capability-only `ModelRouter`; `CapabilityModelRouter` selects the first candidate satisfying every requested capability without invoking it or mutating candidates. `InMemoryProviderStateStore` validates and tracks health, quota, rate limits, latency, and typed failures with frozen defensive snapshots. Both implementations are process-local and observation-only: they do not call providers, persist state, hold credentials, or perform provider routing. The full suite passes with 46 tests; Quota/Provider Router, eligible-route selection, BYOK, and fallback orchestration remain future Stage 6 work. The deterministic RSS result remains a non-model fallback.

Exact progress and next action: [`ROADMAP.md`](../ROADMAP.md).

Session entry: [[07-Session-Log]].
