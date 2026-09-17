# Tatu Roadmap

> Current status: Stages 4, 5, and 6 are complete; Stage 7 has local delivery, timeline, bounded observability, API redaction, Setup Health, and bounded URL/text secret-boundary foundations.
> Rule: check an item only after its acceptance criterion has been verified.
> Compact session context: [`brain/04-Current-State.md`](brain/04-Current-State.md).

## Stage 1 — Repository and collaboration foundation

Outcome: both partners can safely work on the same public repository with Codex in VS Code.

- [x] Project name chosen: Tatu.
- [x] Public repository created under the organization.
- [x] `main` protection ruleset configured.
- [x] Partner invited and has accepted organization access.
- [x] Initial repository files added.
- [x] Both partners can clone/open the repository in VS Code.
- [x] Both partners are authenticated with GitHub for push access.
- [x] Node.js availability checked on both computers.
- [x] `AGENTS.md` instructions confirmed by Codex.
- [x] Initial documentation commit pushed to `main`.
- [x] Project-scoped `recon`, `executor`, and `reviewer` agents configured.
- [x] Primary-session orchestrator workflow documented.
- [x] Obsidian-compatible project brain created.
- [x] Agent and brain configuration shared through Git for cross-workstation synchronization.
- [x] Custom-agent discovery validated after restarting Codex.

Acceptance test:

- Both partners can pull current `main`, commit verified work, and push safely.
- Both partners may optionally create separate branches when working simultaneously on overlapping or risky changes.
- Force pushes and deletion of `main` are blocked.
- External contributors cannot push directly and must contribute through pull requests.
- Codex can summarize the repository instructions from `AGENTS.md`.

Verification note (September 2, 2026): the initial file set and repository-safe VS Code configuration were reviewed; Codex confirmed the `AGENTS.md` workflow; Git, Node.js, npm, and Docker were detected on the first founder's computer; and commit `9134593` containing the documentation foundation was pushed directly to `origin/main` using the configured founder bypass. After Codex and VS Code were restarted, the project-scoped `recon`, `executor`, and `reviewer` agents were each dispatched successfully. Their declared models, reasoning effort, sandbox modes, required fields, and Git restrictions were independently verified. Founder 2 attested that they accepted organization access, cloned the repository at `C:\Users\vitti\OneDrive\Desktop\tatu`, opened it in VS Code, and ran `git push --dry-run origin main` with `Everything up-to-date`; commit `844ed99` by Vittor Augusto Gomes is on `origin/main`. Founder 2 also reported Node.js `v24.13.0` and npm `11.6.2`.

Next action: Stage 1 is complete; its collaboration foundation supports the completed Stage 2 technical foundation.

## Stage 2 — Technical foundation

Outcome: a clean development environment starts the initial Tatu application and runs all checks.

- [x] Create ADR-0001 for the initial stack.
- [x] Confirm the supported Node.js version and package manager.
- [x] Create the TypeScript monorepo structure.
- [x] Add web application, API/worker, and shared packages.
- [x] Add formatting, lint, typecheck, tests, and build scripts.
- [x] Add `.env.example` with no real credentials.
- [x] Add CI workflow with required checks.
- [x] Document one-command local development setup.
- [x] Render a basic Tatu health page locally.

Acceptance test:

- A clean clone installs dependencies and starts locally using documented commands.
- Formatting, lint, typecheck, tests, and build all pass.
- CI runs the same checks on a pull request.

Verification note (September 2, 2026): Node.js `v24.11.1` and npm `11.6.4` ran `npm ci` successfully. `npm run ci` passed formatting, lint, TypeScript typecheck, three Node built-in tests, and build. `npm run dev` started the API and standby worker; `GET /api/health` returned `200` with the typed healthy status, and `GET /` returned `200` with the Tatu Health page.

Next action: begin Stage 3 only when explicitly directed.

## Stage 3 — Create and persist a scheduled briefing

Outcome: the user can request a recurring briefing and see a persisted task.

- [x] Chat accepts a natural-language briefing request.
- [x] Schedule, timezone, topic, quantity, and delivery intent are parsed.
- [x] Ambiguous requests trigger a clarification or confirmation.
- [x] Confirmed task is persisted.
- [x] Task appears in the Tasks interface.
- [x] Task survives an application restart.
- [x] Parsing and persistence tests pass.

Acceptance test:

> “Todos os dias às 8h, encontre as três notícias mais importantes sobre inteligência artificial e me envie.”

creates one visible, enabled, persistent daily task in the user's timezone.

Verification note (September 2, 2026): the deterministic parser, API, SQLite repository, and UI were verified through seven Node tests, including create → confirm → API restart → list and bounded request-body rejection. `npm run ci` passed. Task delivery is requested but not implemented; Stage 4 remains unchecked.

## Stage 4 — Durable execution engine

Outcome: a persisted task has one durable occurrence and idempotency key, executes once within Tatu at the configured time, and recovers safely after restart.

- [x] Database-backed scheduler implemented without paid infrastructure.
- [x] Worker claims jobs safely.
- [x] Duplicate execution prevention implemented.
- [x] Retry, timeout, and failure state implemented.
- [x] Execution history persisted.
- [x] Restart recovery tested.

Acceptance test:

- A scheduled job survives restart and has one persisted occurrence, idempotency key, trace, and final status.

Verification note (September 8, 2026): the SQLite local adapter is isolated in `@tatu/storage` behind database-independent persistence ports; no production database is selected. The scheduler uses durable occurrence keys, short transactional leases, WAL, bounded `SQLITE_BUSY` retries, cooperative timeout/retry/failure handling, DST gap/overlap policy, and immutable events exposed by `GET /api/executions/:id/events`. The full `npm run ci` suite passed with 17 tests, including restart recovery, timeout, API event history, idempotency-key propagation, and a real SQLite write-lock contention test. Future PostgreSQL (self-hosted or hosted) must implement the same ports; no Supabase, Firebase, or VPS is introduced here.

## Stage 5 — Web research and cited briefing

Outcome: an execution researches live sources and generates a useful cited briefing.

- [x] Search adapter contract defined.
- [x] First zero-cost search route implemented.
- [x] Fetch/read pipeline implemented.
- [x] Ranking and deduplication implemented.
- [x] Model adapter contract defined.
- [x] First free or user-supplied model route implemented.
- [x] Briefing includes source links and separates facts from inference.
- [x] Research failures are visible in the trace.

Acceptance test:

- The daily AI task produces three current, non-duplicated, cited stories.

Verification note (September 15, 2026): the database-independent research ports, configurable public HTTPS RSS route, XML read/validation, relevance-first ranking, canonical URL/title deduplication, cancellation propagation, bounded public fetching, private-destination rejection, structured source-backed facts with an empty inference list, persisted briefing retrieval, optional loopback-only Ollama JSON synthesis with strict citation validation, separate `research_failed`/`model_failed` trace events, default-feed wiring, and Portuguese/English AI-topic aliasing are covered by 34 passing tests. Missing `TATU_RSS_FEEDS` uses the selected TechCrunch Artificial Intelligence feed; an explicit empty value still fails safely instead of recording a fabricated success; missing `TATU_OLLAMA_MODEL` uses the deterministic RSS route. A network-enabled temporary scheduled run produced exactly three distinct HTTPS stories, three facts, a persisted result, and the `queued` -> `claimed` -> `succeeded` trace with no research failure. Stage 5 acceptance is complete; the default source remains replaceable through configuration and the Ollama route remains optional.

## Stage 6 — Free routing, fallback, and BYOK

Outcome: Tatu selects an eligible model route and falls back without losing the task.

- [x] Model capability metadata implemented.
- [x] Provider health, quota, and rate-limit state implemented.
- [x] Model Router implemented.
- [x] Quota/Provider Router implemented separately.
- [x] At least two eligible routes or one real route plus deterministic development fallback.
- [x] BYOK connection and encrypted secret storage implemented as a replaceable local foundation.
- [x] Fallback behavior tested for model failure with trace and persisted result.

Acceptance test:

- When the preferred route is unavailable, the execution continues through another eligible route and records the fallback.

Verification note (September 15, 2026): `@tatu/shared` defines readonly `BriefingModelMetadata`, `BriefingModelRequest`, `ModelRouter`, `ProviderRouteCandidate`, `QuotaProviderRouter`, `ByokConnectionManager`, encrypted-record backing contracts, typed fallback metadata, and the `fallback_used` execution event. `OllamaBriefingModel` exposes frozen metadata for its configured model ID, `CapabilityModelRouter` selects the first candidate satisfying every requested capability, and `QuotaProviderRouter` selects the first provider-bound candidate whose model is suitable and whose observed provider state is healthy with nonzero-or-unknown quota and rate limits. The worker proves the first real `local-ollama` model route, the explicit `deterministic-rss` route when no model is configured, and automatic fallback to the already validated RSS result for typed model failures without repeating research; the scheduler persists the fallback and records `queued` -> `claimed` -> `fallback_used` -> `succeeded` in one transaction. ADR-0010 records the development route pair, ADR-0011 records the local BYOK foundation, and ADR-0012 records the bounded automatic fallback. The full `npm run ci` suite passed with 62 tests, including API briefing/event coverage, fallback reason coverage, cancellation and error propagation, and persisted fallback trace coverage. Provider authentication/OAuth, key management and rotation, durable production persistence, worker integration for additional providers, multiple live providers, and quota-based multi-provider fallback remain unchecked.

## Stage 7 — Delivery, observability, and 30-day trial

Outcome: the creator receives briefings automatically and can understand every run.

- [x] One free delivery channel implemented as a local filesystem inbox.
- [x] Execution timeline visible.
- [x] Provider, model, tools, latency, fallback, and estimated cost visible.
- [x] Credential-shaped secrets rejected or redacted at bounded validated boundaries.
- [ ] Arbitrary sensitive payloads and PII redacted across future inputs.
- [x] Setup Health page visible.
- [x] Docker Compose reference deployment added when the service boundaries are stable.
- [x] Guided zero-cost deployment path documented.
- [ ] Creator begins the 30-day reliability trial.

Acceptance test:

- Tatu delivers the briefing automatically on the following day and exposes a complete, safe trace.

Verification note (September 16, 2026): ADR-0013 defines the replaceable `BriefingDelivery` port and typed receipt; `FileBriefingDelivery` writes deterministic cited Markdown under `data/deliveries` by default or `TATU_DELIVERY_DIR` when overridden. The occurrence idempotency key is SHA-256 hashed into the artifact name, repeated identical deliveries are idempotent, conflicting content is rejected, aborted writes create no artifact, credential-bearing cited URLs are rejected, artifact probes require a valid hash filename, and the body contains no raw key or provider payload. The worker delivers after the final model/fallback result, validates the adapter receipt before serializing it, and the scheduler validates and persists the receipt while recording `delivered` before `succeeded`; delivery failures remain retryable and record `delivery_failed`. The Tatu page lists persisted executions and renders their ordered events through the existing execution APIs, using DOM text nodes for fetched values and omitting occurrence keys and raw results from the visible timeline. ADR-0014 adds a bounded `BriefingObservability` summary: allowlisted provider/tool identifiers, optional model ID, monotonic executor latency capped at one day, typed fallback metadata, and explicit `estimatedCost.status = unknown` until a pricing source exists. ADR-0015 adds an API-only public projection: execution listings omit occurrence keys, raw results, and worker claims; events expose only type/timestamp; briefing payloads deep-project approved fields and omit delivery idempotency keys; SQLite rejects cited URL userinfo credentials. ADR-0016 adds the visible Setup Health page and `/api/setup-health` contract: API/storage/configuration facts are shown without secrets, while memory, worker liveness, and cost remain explicit not-implemented/unknown states; no provider network probe is claimed. ADR-0017 adds a local/self-hosted Dockerfile and Compose reference with separate API/worker services, a shared data volume, and an API healthcheck. `docker compose config` exits 0, a clean `docker compose build --no-cache` produces both `tatu-api` and `tatu-worker` images, and `docker compose up -d` starts a healthy API plus running worker; `/api/health` and `/api/setup-health` each return `200`. The build stage installs only the native compilation tools required by `better-sqlite3`, excludes TypeScript incremental artifacts from the build context, and forces a fresh TypeScript emission; the runtime image remains slim. ADR-0018 adds `docs/DEPLOYMENT.md`, the verified zero-cost local/self-hosted path using `npm ci`, `npm run ci`, `npm run dev`, Setup Health, local SQLite, and the default credential-free RSS route; it explicitly keeps Docker optional and remote infrastructure out of scope. ADR-0019 adds one shared tested policy for credential-bearing URL queries across RSS, SQLite, file delivery, and the loopback model endpoint, fixed scheduler event detail codes, and fixed worker poll diagnostics; ordinary feed query parameters remain allowed. ADR-0020 adds a shared high-confidence text-secret policy across parser, research, model and provider routers, provider-state observations, worker, persistence, delivery, and the API projection; strict allowlists reject unknown model, worker, delivery-receipt, and file-delivery payload keys, while the local SQLite adapter validates known fields and projects only approved keys from persisted JSON. Recognized credential-shaped IDs and observations are rejected before routing or process-local storage and recognized values are redacted defensively at the public projection; arbitrary PII detection is not claimed. This remains local-first; arbitrary sensitive text/PII, unrestricted future network payloads and adapters, provider-specific pricing, external push channels, and the 30-day trial remain unchecked.

The full `npm run ci` suite passes with 112 tests.

The Stage 7 redaction acceptance is bounded: credential-shaped secrets are
rejected or redacted at known validated boundaries, while arbitrary sensitive
payload and PII detection remains unchecked.

## Later roadmap

## Planning horizon

This horizon organizes confirmed needs without replacing or renumbering the verified stages above.

| Need                                | Status                                                                                                                                                                                                                                                                    | Planned verification                                                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Persistence and deployment decision | Individual local/self-hosted deployment and the local SQLite adapter are decided; remote/shared PostgreSQL remains conditional future work.                                                                                                                               | Record a remote deployment need and a PostgreSQL adapter ADR before any remote migration.                                   |
| Daily briefing end to end           | Scheduling, configurable RSS research, saved cited results, deterministic fallback, optional local model synthesis, selected default source, and live three-story acceptance run are implemented.                                                                         | Stage 5 is complete; future delivery and provider-health work continues in later stages.                                    |
| Task monitoring and “Test now”      | A local `POST /api/tasks/:taskId/test` endpoint queues a distinct pending execution for an existing task, with a bounded `Idempotency-Key`; the Tasks UI exposes `Testar agora` and a bounded title/source briefing preview backed by the existing worker/event pipeline. | Manual runs are separate from scheduled occurrences; repeated requests with the same key return one execution.              |
| Free limits and provider fallback   | The bounded local-model-to-deterministic-RSS fallback is implemented; quota-based multi-provider fallback is not implemented.                                                                                                                                             | Stage 6 distinguishes availability, rate limit, auth, temporary failure, capability compatibility, and authorized fallback. |
| Editable personal memory            | Not implemented; development `brain/` is not product memory.                                                                                                                                                                                                              | Structured user memories are editable, selectable per task, and deletable without storing secrets or full transcripts.      |

- OAuth and first connected account.
- Conditional/event automations.
- Plugin/tool ecosystem.
- Device executor.
- Payment initiation with external wallet authorization.
- Optional hosted convenience product.

These items do not enter the MVP unless `PROJECT.md` is explicitly updated.

Verification note (September 16, 2026): ADR-0021 adds the database-independent
manual execution port and the local API endpoint. The endpoint rejects missing,
oversized, and unknown-task requests; hashes the request key before persistence;
returns no occurrence key; and queues exactly one execution and `queued` event
for repeated task/key requests. A worker test proves that the existing
scheduler consumes the manual row with the task topic, quantity, and distinct
manual idempotency key. A SQLite fault-injection test proves that a failed
`queued` event insert rolls back the execution row. The full `npm run ci` suite
passes with 112 tests. This
does not start the 30-day reliability trial or broaden the bounded redaction
policy. The local Tasks UI now exposes `Testar agora`, URL-encodes the task ID,
reuses an in-memory per-task key for retries, and keeps the key and occurrence
identifier out of the DOM; the page contract test and the same 112-test suite
pass. The execution view also renders up to three validated briefing
title/source pairs from the public briefing projection, omitting URLs, raw
results, inference, and provider payloads.
