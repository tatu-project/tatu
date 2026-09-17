---
title: Session Log
tags:
  - tatu
  - session-log
updated: 2026-09-15
---

# Session Log

## 2026-09-02 — Initial repository foundation

- Added and verified the initial public repository documentation and collaboration files.
- Published the foundation directly to `main` using the founder bypass.
- Left partner-specific checks open pending evidence.

## 2026-09-02 — Codex team and project brain

- Added project-scoped `recon`, `executor`, and `reviewer` definitions with fixed subagent models and bounded responsibilities.
- Documented the primary-session orchestrator workflow without pinning its model.
- Created the Git-versioned Obsidian-compatible project brain.
- After restarting Codex and VS Code, `recon`, `executor`, and `reviewer` were each dispatched successfully; their scoped configuration and Git restrictions were verified.

## 2026-09-02 — Founder 2 online

- Founder 2 is online for the Tatu session.
- This records presence only; organization access, clone/open, GitHub push authentication, and Node.js availability remain unverified.

## 2026-09-02 — Founder 2 collaboration verification

- Founder 2 attested that organization access is active, the repository was cloned at `C:\Users\vitti\OneDrive\Desktop\tatu` and opened in VS Code, and `git push --dry-run origin main` returned `Everything up-to-date`.
- Founder 2 reported Node.js `v24.13.0` and npm `11.6.2`; commit `844ed99` by Vittor Augusto Gomes is on `origin/main`.
- The remaining Stage 1 collaboration checks are complete. Stage 2 has not started.

## 2026-09-02 — Stage 2 technical foundation

- Added the npm-workspaces TypeScript monorepo with a Node HTTP API, responsive Tatu Health page, standby worker, and typed shared health contract.
- Chose Node.js `>=24.11.0 <25`, npm `>=11.6.0 <12`, and a production runtime using only Node built-ins and TypeScript; the decision is recorded in ADR-0001.
- Verified `npm ci`, the full `npm run ci` quality suite, and the development server responses for `/` and `/api/health`.
- Stage 2 is complete. Stage 3 has not started.

Use [[templates/Session]] for future entries. Record outcomes and durable context, not full transcripts.

## 2026-09-02 — Stage 3 persisted briefing task

- Added deterministic Portuguese drafting, confirmation, local SQLite persistence, Tasks UI, and restart recovery verification.
- Stage 4 execution and scheduling have not started.

## 2026-09-08 — Stage 4 durable execution engine

- Isolated SQLite as the local `@tatu/storage` adapter behind database-independent persistence ports; PostgreSQL production selection remains open.
- Added durable occurrence idempotency keys, leases, retry/cooperative timeout behavior, restart recovery, DST policy, immutable execution events, and bounded SQLite contention retries.
- Verified 17 automated tests, including execution-event API history, idempotency-key propagation, and a real SQLite write-lock contention scenario.

## 2026-09-15 — Individual local deployment decision

- Accepted ADR-0004: the first continuous deployment is one local/self-hosted installation per user, with no remote database or hosted service.
- Deferred PostgreSQL and remote/shared deployment until an explicit future product need exists.

## 2026-09-15 — Stage 5 research foundation

- Added replaceable research contracts and a public HTTPS RSS adapter without credentials or provider lock-in.
- Validated source URLs, propagated cooperative cancellation, ranked topical stories before recency, canonicalized/deduplicated links and titles, and persisted source-backed facts with no inferred claims.
- Missing feeds and provider/quality failures remain visible as safe `research_failed` events; no placeholder success is recorded for the worker research path.
- Added API result retrieval and worker/API/research coverage. `npm run ci` passed with 25 tests.
- Stage 5 acceptance remains open: no default feed, delivery, or live three-story daily run has been verified.

## 2026-09-15 — Stage 5 local model route

- Added the replaceable local model contract and optional loopback-only Ollama adapter using native `fetch` and strict JSON output.
- Model output must preserve the selected topic and exact cited story set; invalid, unavailable, or timed-out output is discarded and traced as `model_failed`.
- With no `TATU_OLLAMA_MODEL`, the deterministic RSS result is explicitly marked as the fallback route. No API key, remote endpoint, or secret persistence was introduced.
- Worker wiring, scheduler event separation, model fixtures, and integration coverage passed in `npm run ci` with 31 tests.
- Stage 5 acceptance remains open until a default source and a live three-story daily run (with or without local Ollama) are verified.

## 2026-09-15 — Stage 5 default source and acceptance

- Accepted ADR-0005: an absent `TATU_RSS_FEEDS` uses the public TechCrunch Artificial Intelligence RSS feed; a non-empty value overrides it and an explicit empty value disables research safely.
- Added standalone `AI` aliasing for the Portuguese and English artificial-intelligence topics without matching unrelated substrings such as `Mail`.
- Verified a network-enabled temporary daily execution with the default feed: status `succeeded`, three distinct HTTPS stories, three source-backed facts, persisted briefing equal to the execution result, and immutable trace `queued` -> `claimed` -> `succeeded`.
- The final local suite passed with 34 tests. Stage 5 is complete; Stage 6 provider/model routing and fallback is next.

## 2026-09-15 — Stage 6 capability metadata

- Accepted ADR-0006: model suitability is represented by readonly shared metadata, separate from provider health, quota, rate limits, credentials, and routing.
- Added `BriefingModelCapability` values for `briefing-synthesis`, `structured-json`, and `citation-preservation`; `OllamaBriefingModel` exposes frozen metadata for its configured model ID.
- Updated injected model fixtures and assertions. The full suite remains green with 34 tests; provider routing, fallback orchestration, and BYOK remain unchecked.

## 2026-09-15 - Stage 6 provider availability state

- Accepted ADR-0007: provider availability is a separate typed contract from model suitability metadata.
- Added `ProviderStateStore` in `@tatu/shared` and a validated, process-local `InMemoryProviderStateStore` in `@tatu/research` for health, quota, rate-limit, latency, and typed failure observations.
- Defensive frozen snapshots, bounded diagnostics, runtime discriminant validation, and provider isolation are covered by the full 40-test suite. No provider calls, credentials, persistence, routing, BYOK, or fallback orchestration were introduced.
- The next unchecked Stage 6 item is Model Router work; provider-state durability and production database choice remain open decisions.

## 2026-09-15 - Stage 6 capability-only model router

- Accepted ADR-0008: model suitability selection is a deterministic capability-only contract, separate from provider availability and quota routing.
- Added `BriefingModelRequest`, `ModelRouter`, and `CapabilityModelRouter`; the router selects the first compatible candidate, returns `undefined` on no match, and never invokes or mutates candidates.
- Ollama metadata qualification, empty/no-candidate behavior, first-match ordering, missing capabilities, non-invocation, and immutability are covered by the full 53-test suite. Quota/provider routing, fallback, BYOK, and worker integration remain unchecked.

## 2026-09-15 - Stage 6 quota and provider eligibility router

- Accepted ADR-0009: provider-bound route eligibility combines model capabilities with a separate healthy, non-exhausted provider snapshot.
- Added `ProviderRouteCandidate` and `QuotaProviderRouter`; it selects the first eligible candidate without provider calls, retries, mutations, persistence, or execution fallback.
- Tests cover capability mismatch, provider statuses, zero limits, null limits, deterministic order, provider identity, no match, and non-invocation. Multiple eligible routes, fallback, BYOK, and worker integration remain unchecked.

## 2026-09-15 - Stage 6 route pair and development fallback

- Accepted ADR-0010: the existing local Ollama-compatible model route plus the explicit deterministic RSS route satisfy the one-real-route-plus-development-fallback outcome.
- Verified the worker tests cover both route paths and preserve explicit `local-ollama` or `deterministic-rss` metadata. This does not claim automatic fallback after a model failure.
- Automatic failure fallback, multiple live providers, BYOK, and worker route orchestration remain unchecked.

## 2026-09-15 - Stage 6 local BYOK encrypted-storage foundation

- Accepted ADR-0011: a replaceable shared BYOK connection/encrypted-record contract and a process-local storage adapter.
- `ByokConnectionService` uses AES-256-GCM with a caller-supplied 32-byte key, random IVs, authenticated owner/provider data, metadata-only listings, and owner-scoped reveal/disconnect.
- Tests cover encrypted-only backing, round trips, scope enforcement, size and input bounds, tampering, altered authenticated data, wrong keys, unsupported algorithms, and a replaceable backing store. The full suite passes with 59 tests.
- Provider authentication/OAuth, key ownership/rotation, durable production persistence, worker route integration, automatic failure fallback, and production database choice remain open.

## 2026-09-15 - Stage 6 automatic model fallback

- Accepted ADR-0012: after successful RSS research, typed local-model failures (`model_unavailable`, `model_invalid_output`, or `model_timeout`) reuse the validated deterministic RSS result instead of retrying research.
- Added sanitized fallback metadata and the `fallback_used` event. The scheduler persists the result and records `queued` -> `claimed` -> `fallback_used` -> `succeeded` atomically; the API returns the fallback metadata.
- Tests cover all typed model reasons, one research/model call, research-error and cancellation propagation, unknown model errors, event detail redaction, and persisted API retrieval. The full suite passes with 62 tests.
- Multiple live providers, provider authentication/OAuth, durable key management, and quota-based multi-provider fallback remain open.

## 2026-09-15 - Stage 7 local filesystem delivery channel

- Accepted ADR-0013: a replaceable `BriefingDelivery` port with a local `FileBriefingDelivery` adapter, enabled by the worker under `data/deliveries` or `TATU_DELIVERY_DIR`.
- The adapter writes deterministic cited Markdown using a SHA-256 filename derived from the occurrence key, publishes without overwriting a concurrent artifact, treats identical retries as idempotent, rejects content conflicts, and never writes the raw key or provider payload.
- The executor delivers the final model/fallback result; the scheduler persists the strict receipt and records `delivered` before `succeeded`. Delivery errors produce `delivery_failed` and remain retryable.
- `npm test` passes with 69 tests, including outbox idempotency/abort/path-safety, credential-bearing URL rejection, executor key propagation, scheduler receipt/event validation, and delivery failure behavior. Push notifications, external channels, complete timeline/metrics, health UI, Docker, guided deployment, and the 30-day trial remain open.

## 2026-09-15 â€” Stage 7 execution timeline

- Added a visible Execution timeline to the local web page, backed by the existing `/api/executions` and `/api/executions/:id/events` endpoints.
- The page renders status, schedule, attempts, failures, and ordered event types/timestamps/details using DOM text nodes; occurrence keys and raw briefing results are not displayed.
- The page refreshes the timeline after task confirmation, and the API health smoke test verifies both event fetch paths. The full suite remains green with 69 tests.
- Provider/model/latency/cost observability, broader network-payload redaction, health UI, Docker, guided deployment, push channels, and the 30-day trial remain open.

## 2026-09-15 â€” Stage 7 bounded execution observability

- Accepted ADR-0014 for a provider-independent `BriefingObservability` summary with allowlisted provider/tool IDs, optional model ID, monotonic executor latency capped at one day, and explicit `estimatedCost.status = unknown` until a pricing source exists.
- The worker attaches metadata for deterministic RSS, local Ollama, typed fallback, and file-outbox paths; SQLite/API validation rejects malformed or unbounded metadata, and the web timeline renders only the validated summary with DOM text nodes.
- The full suite passes with 71 tests, including deterministic/model/fallback metadata, API retrieval, UI smoke markers, malformed delivery metadata, and malformed persisted briefing metadata.
- Provider-specific pricing, broad network-payload redaction, Setup Health, Docker, guided deployment, external push channels, and the 30-day trial remain open.

## 2026-09-16 - Stage 7 Setup Health

- Accepted ADR-0016 for a separate `/api/setup-health` contract and visible Setup Health section on the local page.
- The surface reports API/storage/configuration facts without exposing environment values, URLs, paths, credentials, task topics, or provider payloads. Memory is `not_implemented`, scheduler liveness is `unknown` without a heartbeat, and estimated cost remains `unknown`.
- Tests cover the endpoint, disabled-research/model configuration redaction, page marker, and existing health contract. The full suite passes with 73 tests.
- Docker Compose, guided deployment, external push channels, and the 30-day trial remain open.

## 2026-09-16 - Stage 7 Docker Compose reference

- Added a multi-stage `Dockerfile`, `.dockerignore`, and `compose.yaml` for separate API and worker services sharing `/app/data`, with API healthcheck and persistent local volume.
- `docker compose config` passes. A full image build was attempted but the workstation Docker client could not evaluate the Windows context symlinks before Dockerfile execution; the roadmap acceptance remains unchecked until a clean build/startup smoke test is verified.
- No remote database, Supabase, Firebase, VPS, provider credential, or production deployment decision was introduced.

## 2026-09-16 - Stage 7 guided zero-cost deployment

- Accepted ADR-0018 and added `docs/DEPLOYMENT.md` with the clean-clone `npm ci`/`npm run ci`/`npm run dev` path, Setup Health verification, default credential-free RSS route, optional local Ollama, local backup guidance, and security/troubleshooting limits.
- The guide keeps Docker optional and does not introduce Supabase, Firebase, VPS hosting, remote/shared PostgreSQL, provider credentials, or a production deployment claim.

## 2026-09-16 - Stage 7 Docker Compose verification boundary rechecked

- `docker compose config` exits 0 and validates the API/worker services, shared data volume, API healthcheck, and worker dependency; Docker CLI `29.8.0` and Compose `v5.5.1` are installed.
- `docker version` cannot connect to the Docker Engine named pipe, and the Docker client reports access denied for the user Docker configuration/context. No image build or container startup result is claimed.
- The next action is to start or repair Docker Desktop/the Docker daemon and rerun `docker compose build` followed by a `docker compose up` smoke test. The Stage 7 Docker checkbox remains unchecked.
- No Supabase, Firebase, VPS, remote database, provider credential, or production deployment decision was introduced.

## 2026-09-16 - Stage 7 bounded secret boundaries

- Accepted ADR-0019 and added a shared sensitive-query URL policy used by RSS fetch/redirect validation, SQLite briefing validation, file delivery, and loopback model endpoint validation. Ordinary query parameters remain allowed; credential-like names and token-shaped values are rejected before network or artifact boundaries.
- Scheduler event details now use fixed safe codes, and worker poll diagnostics no longer include thrown error objects or messages. Tests cover query variants, delivery artifacts, persisted briefings/events, and fake bearer/token errors.
- `npm run ci` passes with 81 tests. The Stage 7 redaction checkbox remains open for arbitrary sensitive text/PII, unrestricted future network payloads/adapters, and other pending Stage 7 work.

## 2026-09-16 - Stage 7 bounded text-secret validation

- Accepted ADR-0020 and added a shared high-confidence detector/redactor for credential-shaped assignments, bearer/basic/token schemes, JWT-like values, URL userinfo, and well-known key prefixes.
- Parser, RSS, Ollama, worker, SQLite, file delivery, and API projection boundaries now reject or redact recognized text credentials; URL query handling remains covered by ADR-0019.
- Tests cover normal-language negatives, parser/API rejection, model output/configuration, worker pre-delivery rejection, persisted briefings, and artifact safety. Arbitrary sensitive text/PII and unrestricted future payloads/adapters remain outside this bounded policy.
- The complete `npm run ci` suite passes with 96 tests.

## 2026-09-16 - Stage 7 Docker Compose acceptance

- `docker compose config` exits 0. A clean `docker compose build --no-cache` completed for both `tatu-api` and `tatu-worker`.
- `docker compose up -d` started a healthy API and running worker. `GET /api/health` returned `200` with the typed healthy contract, and `GET /api/setup-health` returned `200` with secret-free setup checks.
- The build installs only temporary native compilation tools needed by `better-sqlite3`, ignores TypeScript incremental artifacts, and forces fresh TypeScript emission; the runtime image remains slim. `docker compose down` stopped the smoke-test stack while preserving the named data volume.
- The Docker Compose checkbox is now proven for the local/self-hosted reference. No Supabase, Firebase, VPS, remote database, provider credential, production hardening, or external delivery guarantee was introduced.

## 2026-09-16 - Stage 7 provider-state secret boundary

- Provider availability observations now reuse the shared high-confidence text-secret policy and reject credential-shaped diagnostics before process-local state mutation.
- Tests cover assignments, Bearer/Basic schemes, JWT-like values, URL userinfo, known key prefixes, both success/failure transitions, unchanged snapshots after rejection, and ordinary diagnostic text.
- The full redaction checkbox remains bounded: arbitrary sensitive text/PII, unrestricted future network payloads, and new adapters still require separate validation.

## 2026-09-16 - Stage 7 model/provider identity boundaries

- Provider IDs are rejected before state lookup or mutation; the Ollama adapter rejects credential-shaped model IDs before metadata exposure; capability and quota/provider routers skip unsafe model metadata IDs.
- Tests cover healthy-provider routing, constructor rejection without network calls, unchanged candidate/state data, and ordinary identifiers. The complete `npm run ci` suite passes with 102 tests.
- The Stage 7 redaction checkbox remains intentionally bounded to recognized credential patterns; arbitrary sensitive text/PII and future adapters are not claimed.

## 2026-09-16 - Stage 7 unknown briefing payload boundaries

- Added shared runtime object-key helpers and strict allowlists at the Ollama
  model output, final worker result, delivery receipt, and filesystem delivery
  boundaries. Model, citation, delivery, observability, and estimated-cost
  payloads reject unknown keys before they can be delivered or serialized.
- The local SQLite adapter continues to validate known briefing fields and now
  projects only the provider-independent allowlist when reading persisted JSON;
  valid legacy rows therefore remain available without exposing provider
  payloads through the API.
- Regression tests cover top-level and nested unknown fields in the model,
  worker, file delivery, SQLite adapter, and API event/briefing path. The full
  `npm run ci` suite passes with 109 tests. Arbitrary PII detection, unrestricted
  future payloads, and future adapters remain outside this bounded policy.

## 2026-09-16 - Local manual test execution

- Accepted ADR-0021 and added `POST /api/tasks/:taskId/test` for an existing
  confirmed task. The endpoint requires a bounded `Idempotency-Key`, hashes it
  with the task ID into a distinct manual occurrence, and never exposes the
  raw key or occurrence key.
- The database-independent execution port queues the row and `queued` event
  transactionally in the local SQLite adapter. Repeated task/key requests
  return the same execution, while different keys create independent runs;
  the existing worker consumes the manual row with the task topic and
  quantity.
- API and worker tests cover validation, duplicate/event cardinality,
  public projection, and context propagation. The complete `npm run ci` suite
  passes with 111 tests. This is a local verification control, not the start
  of the separate 30-day reliability trial.

## 2026-09-16 - Manual test control in the Tasks UI

- Added a `Testar agora` button to each confirmed task in the local Tasks UI.
  It calls the existing manual execution endpoint with an URL-encoded task ID,
  disables the button while waiting, refreshes the execution timeline after a
  `202` response, and reports a safe fixed failure message otherwise.
- The browser keeps one generated idempotency key per task only in memory so a
  retry is duplicate-safe; neither the key nor the internal occurrence key is
  rendered or persisted. The page contract and complete `npm run ci` suite pass
  with 111 tests.

## 2026-09-16 - Manual queue rollback proof

- Added an isolated SQLite fault-injection test that removes only the temporary
  database's `execution_events` table, confirms `enqueueManualExecution` fails,
  and verifies that no execution row remains after the transaction rolls back.
- Focused storage verification passes 5/5; the complete suite is rerun before
  publication. This strengthens the manual queue's atomicity evidence without
  changing the replaceable persistence boundary.
