---
title: Current State
tags:
  - tatu
  - current-state
updated: 2026-09-16
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
- Stage 5 is complete for the deterministic cited-briefing acceptance: `@tatu/research` defines database-independent feed/synthesizer ports, a credential-free public HTTPS RSS adapter, and an optional loopback-only Ollama model adapter. RSS has cancellation, canonical URL/title deduplication, relevance-first ranking, source validation, bounded public fetching, private-destination rejection, explicit source-backed facts, and a selected TechCrunch Artificial Intelligence default that remains replaceable through `TATU_RSS_FEEDS`. Portuguese and English AI topic aliases match standalone `AI` titles without broad substring matching. Ollama receives only selected stories, requires strict JSON, validates exact citations, and never stores secrets. The worker emits separate `research_failed` and `model_failed` events; an empty Ollama model configuration keeps the explicit deterministic RSS route. `GET /api/executions/:id/briefing` returns validated saved results. `npm run ci` passed with 34 tests. A network-enabled temporary scheduled run produced three distinct HTTPS stories, three facts, a persisted result, and `queued` -> `claimed` -> `succeeded`; the Stage 6 routing/fallback/BYOK slice is now complete. Delivery remains a later Stage 7 outcome.
- Stage 6 has ADR-0006 through ADR-0012: `@tatu/shared` defines readonly model suitability metadata, a separate `ProviderStateStore`, a capability-only `ModelRouter`, a `QuotaProviderRouter`, replaceable BYOK connection/encrypted-record contracts, typed fallback metadata, and the `fallback_used` event; `CapabilityModelRouter` selects suitable models, while `QuotaProviderRouter` selects the first provider-bound candidate with matching capabilities and a healthy, non-exhausted provider snapshot. `InMemoryProviderStateStore` validates and tracks health, quota, rate limits, latency, and typed failures with frozen defensive snapshots. ADR-0010 records the existing local Ollama model route plus deterministic RSS development path, ADR-0011 adds a process-local AES-256-GCM BYOK service with owner scoping and a replaceable encrypted backing port, and ADR-0012 records automatic fallback from typed local-model failures to the already validated RSS result. The worker never repeats research or invokes a second model for this fallback; research errors, cancellation, and unknown errors remain failures. The full suite passes with 62 tests, including API fallback retrieval and the `queued` -> `claimed` -> `fallback_used` -> `succeeded` trace. Provider authentication/OAuth, multiple live providers, durable key management, quota-based multi-provider fallback, and additional worker provider integration remain future Stage 6 work. The deterministic RSS result remains a non-model fallback.
- Stage 7 has ADR-0013 through ADR-0021: `BriefingDelivery` is replaceable and the local worker uses `FileBriefingDelivery` to write deterministic cited Markdown to `data/deliveries` (or `TATU_DELIVERY_DIR`). Filenames hash the occurrence idempotency key; repeated identical content is idempotent, conflicts are rejected, credential-bearing cited URLs and unsafe artifact probes are rejected, and the scheduler records `delivered` before `succeeded` while delivery failures remain retryable. The web page lists persisted executions and ordered events through the API, then renders the validated briefing's allowlisted provider, model, tool, fallback, monotonic latency, and explicit unknown-cost metadata using DOM text nodes. ADR-0015 adds a deep API projection that omits occurrence keys, raw results, worker claims, event details, delivery idempotency keys, and nested unknown briefing fields; the SQLite adapter rejects cited URL userinfo credentials. ADR-0016 adds a visible Setup Health section and `/api/setup-health` contract with secret-free API/storage/configuration facts, explicit memory and scheduler unknown states, unknown cost, and configured next-task metadata without claiming provider probes. ADR-0017 adds the local Dockerfile and Compose reference with separate API/worker services, a shared data volume, and an API healthcheck; `docker compose config` exits 0, a clean `docker compose build --no-cache` produces both images, and `docker compose up -d` starts a healthy API plus running worker. The smoke test returned `200` from both `/api/health` and `/api/setup-health`; the build uses temporary native compilation tools for `better-sqlite3`, excludes TypeScript incremental artifacts from the context, and forces fresh TypeScript emission while keeping the runtime image slim. ADR-0018 adds `docs/DEPLOYMENT.md` as the guided zero-cost local/self-hosted path, verified around the existing `npm ci`, `npm run ci`, `npm run dev`, Setup Health, local SQLite, delivery outbox, and default credential-free RSS route. ADR-0019 adds one shared tested policy for credential-bearing URL queries across RSS, SQLite, file delivery, and the loopback model endpoint, fixed scheduler event detail codes, and fixed worker poll diagnostics; ordinary feed query parameters remain allowed. ADR-0020 adds shared high-confidence text-secret validation at parser, research, model and provider routers, provider-state IDs/observations, worker, persistence, delivery, and API projection boundaries; unknown runtime keys are rejected at model/worker/delivery-receipt/file-delivery boundaries and the SQLite adapter projects only approved fields from valid persisted rows. ADR-0021 adds the local “Test now” endpoint and idempotent manual occurrence queue; repeated task/key requests return one pending execution and the existing worker receives the distinct key, topic, and quantity. Credential-bearing IDs and observations are rejected before routing or process-local storage, while recognized values are redacted defensively at the public projection without claiming arbitrary PII detection. The latest full suite passes with 111 tests. This is a local inbox rather than push notification or distributed exactly-once delivery; arbitrary sensitive text/PII, unrestricted future network payloads and adapters, provider-specific pricing, health UI beyond the bounded setup surface, external push channels, and the 30-day trial remain next.

The latest complete `npm run ci` suite passes with 112 tests; this supersedes the earlier count embedded in the historical Stage 7 summary above.

The 111-test references in the preceding Stage 7 and manual-flow summaries are
historical pre-rollback counts; the current suite has 112 tests.

- The local “Test now” flow is implemented through ADR-0021: `POST /api/tasks/:taskId/test` requires a bounded `Idempotency-Key`, hashes it into a distinct manual occurrence, and queues the row plus its `queued` event transactionally through the replaceable persistence port. Repeated task/key requests return one execution without exposing the occurrence key; the existing worker consumes it with the task's topic and quantity. The latest focused verification covers API validation, duplicate behavior, event cardinality, and worker context propagation; the full suite now passes with 111 tests. The 30-day reliability trial still requires the creator to begin and observe a real run.

- The 112-test suite supersedes the earlier 111-test count in the historical
  Stage 7 paragraph above; it includes the manual queue rollback proof.

- Stage 7 now distinguishes the verified bounded credential-secret policy from
  the still-open promise of arbitrary sensitive-payload/PII detection. The
  former is checked at known parser, routing, persistence, delivery, and public
  projection boundaries; the latter remains intentionally unclaimed.

- The Tasks UI exposes `Testar agora` for each confirmed task. It URL-encodes
  the task ID, reuses a per-task idempotency key only in browser memory, keeps
  both the key and occurrence identifier out of the DOM, and refreshes the
  execution timeline after a successful queue response. A SQLite fault-
  injection test proves that a failed `queued` event insert rolls back its
  execution row. The page contract and full suite pass with 112 tests.

- The execution details now show a bounded briefing preview from the public
  projection: at most three validated title/source pairs, rendered with DOM
  text nodes. URLs, keys, raw results, inference, and provider payloads are
  omitted.

- The creator-run 30-day trial protocol is documented in
  [`docs/RELIABILITY-TRIAL.md`](../docs/RELIABILITY-TRIAL.md). No trial days
  are claimed until the creator starts a real scheduled run and records the
  required public, non-sensitive evidence.

- Exact next action: the creator starts the protocol, confirms the scheduled
  task, and records the first public execution.

Exact progress and next action: [`ROADMAP.md`](../ROADMAP.md).

Session entry: [[07-Session-Log]].
