# Tatu Roadmap

> Direction (October 15): Telegram-first free no-training agent; see the direction reset and Stages 12–16 below.
> Current status: private version 3 is published with connection monitor/public probe/per-turn history controls; final root format/lint/types/226 tests/build, Python13+8, mocked desktop/mobile browser checks and 16 bounded live access/readiness checks pass. Direct-origin/positive owner-browser probes have explicit gaps. Public [78f5c2b](https://github.com/tatu-project/tatu/commit/78f5c2bf2816e12879cf41fa5732e54c33290dd9)/[CI38567151349](https://github.com/tatu-project/tatu/actions/runs/38567151349) passed Windows/Linux. October 14 owner-observed version 2 replies are separate from controlled version 3 inference/history/stop/active acceptance. Full browser/PWA, guardrails and scheduling remain open; no whole online stage is complete.
> Rule: check an item only after its acceptance criterion has been verified.
> Compact session context: [`brain/04-Current-State.md`](brain/04-Current-State.md).

## Active release plan — October 12–18, 2026

The user removed the 30-day pilot and explicitly corrected the goal to a mobile-first online assistant: no end-user PC, Ollama, model download, or local runtime. The target week uses `America/Sao_Paulo` and is a goal, not a completion claim. Bounded implementation/fixture checks and private QA publication are now evidenced below; no whole online stage is complete. Historical local evidence is not proof of positive cloud assistant operation.

1. **Stage 7:** cloud identity and owner-scoped D1 storage; private Sites beta and independent Workers/D1/Access configuration.
2. **Stage 8:** legitimate remote AI, durable encrypted optional Groq keys, strict global/per-user caps, and honest unavailable/manual-redirect states.
3. **Stage 9:** responsive Portuguese mobile workspace, saved conversations, explicit memory, notes/pages, task controls, and full cited reader.
4. **Stage 10:** hosted Cron, durable scheduled execution, cited in-app delivery, and observable retry/duplicate behavior.
5. **Stage 11:** authenticated remote MCP/private package and reproducible deployed-URL/mobile/CI verification.

Latest accepted direction: website plus installable mobile/desktop PWA first, actual native packages later against the same online backend; future authorized owner actions; daily 09:00 `America/Sao_Paulo` AI news with the user-confirmed NotebookLM Audio Overviews target; operational key encryption plus a separately verified client-held-key private vault. The current implemented handoff exports cited text for manual NotebookLM import, where the user generates audio. Automatic Tatu audio integration is not implemented and requires separate authorized acceptance; text-only delivery does not complete the audio goal. [ADR-0024](docs/decisions/ADR-0024-mobile-cloud-security-and-agent-boundaries.md) and [the security architecture](docs/SECURITY-ARCHITECTURE.md) define the approved boundaries; verified items and remaining gaps are recorded below.

Implementation may proceed in independent bounded packages. Publication requires the relevant checks in [`docs/RELIABILITY-TRIAL.md`](docs/RELIABILITY-TRIAL.md); missing credentials or scheduling capabilities remain explicit gaps rather than fixture/live-success claims. Free account eligibility, hosting, inference, and unlimited capacity are not guaranteed. Product scope is authoritative in [`PROJECT.md`, section 25](PROJECT.md#25-mvp-the-first-useful-vertical-slice).

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

Verification note (September 2, 2026): the initial file set and repository-safe VS Code configuration were reviewed; Codex confirmed the `AGENTS.md` workflow; Git, Node.js, npm, and Docker were detected on the first founder's computer; and commit `9134593` containing the documentation foundation was pushed directly to `origin/main` using the configured founder bypass. After Codex and VS Code were restarted, the project-scoped `recon`, `executor`, and `reviewer` agents were each dispatched successfully. Their declared models, reasoning effort, sandbox modes, required fields, and Git restrictions were independently verified. Founder 2 attested that they accepted organization access, cloned the repository at `<local checkout>`, opened it in VS Code, and ran `git push --dry-run origin main` with `Everything up-to-date`; commit `844ed99` by a founding maintainer is on `origin/main`. Founder 2 also reported Node.js `v24.13.0` and npm `11.6.2`.

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

## Local delivery and observability — historical pre-cloud evidence

These records describe the historical Node/SQLite/RSS self-hosted path and its bounded checks. They are preserved for the optional legacy deployment and do not establish cloud identity, D1, remote AI, hosted Cron, or remote MCP.

- [x] One free delivery channel implemented as a local filesystem inbox.
- [x] Execution timeline visible.
- [x] Provider, model, tools, latency, fallback, and estimated cost visible.
- [x] Credential-shaped secrets rejected or redacted at bounded validated boundaries.
- [x] Setup Health page visible.
- [x] Docker Compose reference deployment added when the service boundaries are stable.
- [x] Guided zero-cost deployment path documented.
- [x] Ordinary Windows installation and full quality checks pass without external C++ build tools.
- [x] Local HTTP defaults and browser request boundaries enforce the individual deployment scope.

Historical local acceptance target:

- A real scheduled occurrence delivers a real-source cited briefing without a manual trigger and exposes a complete, safe trace.
- Restart, repeated occurrence/request, transient failure, retry, and offline recovery checks preserve one intended delivery and show fixed public failure categories.
- The existing deterministic RSS briefing fallback is distinct from model inference.

Verification note (September 16, 2026): ADR-0013 defines the replaceable `BriefingDelivery` port and typed receipt; `FileBriefingDelivery` writes deterministic cited Markdown under `data/deliveries` by default or `TATU_DELIVERY_DIR` when overridden. The occurrence idempotency key is SHA-256 hashed into the artifact name, repeated identical deliveries are idempotent, conflicting content is rejected, aborted writes create no artifact, credential-bearing cited URLs are rejected, artifact probes require a valid hash filename, and the body contains no raw key or provider payload. The worker delivers after the final model/fallback result, validates the adapter receipt before serializing it, and the scheduler validates and persists the receipt while recording `delivered` before `succeeded`; delivery failures remain retryable and record `delivery_failed`. The Tatu page lists persisted executions and renders their ordered events through the existing execution APIs, using DOM text nodes for fetched values and omitting occurrence keys and raw results from the visible timeline. ADR-0014 adds a bounded `BriefingObservability` summary: allowlisted provider/tool identifiers, optional model ID, monotonic executor latency capped at one day, typed fallback metadata, and explicit `estimatedCost.status = unknown` until a pricing source exists. ADR-0015 adds an API-only public projection: execution listings omit occurrence keys, raw results, and worker claims; events expose only type/timestamp; briefing payloads deep-project approved fields and omit delivery idempotency keys; SQLite rejects cited URL userinfo credentials. ADR-0016 adds the visible Setup Health page and `/api/setup-health` contract: API/storage/configuration facts are shown without secrets, while memory, worker liveness, and cost remain explicit not-implemented/unknown states; no provider network probe is claimed. ADR-0017 adds a local/self-hosted Dockerfile and Compose reference with separate API/worker services, a shared data volume, and an API healthcheck. `docker compose config` exits 0, a clean `docker compose build --no-cache` produces both `tatu-api` and `tatu-worker` images, and `docker compose up -d` starts a healthy API plus running worker; `/api/health` and `/api/setup-health` each return `200`. The build stage installs only the native compilation tools required by `better-sqlite3`, excludes TypeScript incremental artifacts from the build context, and forces a fresh TypeScript emission; the runtime image remains slim. ADR-0018 adds `docs/DEPLOYMENT.md`, the verified zero-cost local/self-hosted path using `npm ci`, `npm run ci`, `npm run dev`, Setup Health, local SQLite, and the default credential-free RSS route; it explicitly keeps Docker optional and remote infrastructure out of scope. ADR-0019 adds one shared tested policy for credential-bearing URL queries across RSS, SQLite, file delivery, and the loopback model endpoint, fixed scheduler event detail codes, and fixed worker poll diagnostics; ordinary feed query parameters remain allowed. ADR-0020 adds a shared high-confidence text-secret policy across parser, research, model and provider routers, provider-state observations, worker, persistence, delivery, and the API projection; strict allowlists reject unknown model, worker, delivery-receipt, and file-delivery payload keys, while the local SQLite adapter validates known fields and projects only approved keys from persisted JSON. Recognized credential-shaped IDs and observations are rejected before routing or process-local storage and recognized values are redacted defensively at the public projection; arbitrary PII detection is not claimed. This remains local-first; arbitrary sensitive text/PII, unrestricted future network payloads and adapters, provider-specific pricing, external push channels, and the 30-day trial remain unchecked.

The September 16 historical `npm run ci` suite passed with 112 tests; later evidence records its own verified count.

The historical redaction acceptance is bounded: credential-shaped secrets are
rejected or redacted at known validated boundaries, while arbitrary sensitive
payload and PII detection remains unchecked.

The historical trial protocol has been replaced by reproducible release checks in
[`docs/RELIABILITY-TRIAL.md`](docs/RELIABILITY-TRIAL.md). On October 12, 2026,
the user removed elapsed 30 days as a prerequisite. No completed historical
trial or continuous-uptime claim is implied. Arbitrary sensitive payload/PII
detection across future inputs remains later work rather than a claim that
bounded credential redaction solves every privacy problem.

Next action: implement the cloud identity/storage and remote-provider boundaries
below before claiming a mobile backend. Optional legacy container startup retains
separate verification before that deployment is advertised as working.

Trial start record (September 16, 2026): a dedicated local database and
delivery outbox were started with one confirmed daily task at 08:00 in
`America/Sao_Paulo`. At that historical start record, the first scheduled
occurrence was pending; it did not establish a completed trial.

Preflight record (September 16, 2026): one manual preflight was excluded from
the trial count. It exhausted three research attempts, exposed only the public
`research_failed`, `retry_scheduled`, and `failed` states, and produced no
delivery artifact. The configured public feed resolved but outbound HTTPS could
not be established in this environment; no fixture or alternate feed was used.
That preflight did not verify scheduled delivery.

First scheduled observation (September 17, 2026): restart recovery created one
execution for the missed 08:00 occurrence with no duplicate. The worker exposed
`queued`, `claimed`, `research_failed`, `retry_scheduled`, and final `failed`
states after three attempts; no delivery artifact was created because outbound
HTTPS to the configured public feed was unavailable. This counts as one public
trial-day observation and does not claim reliability success.

Local release preparation (October 3, 2026): ADR-0022 records the reviewed
dependency-lifecycle policy and LF checkout rules; a clean ordinary `npm ci`
installed all 120 locked packages on Windows x64 with Node.js 24.13.0/npm
11.6.2, without external C++ tools. The full `npm run ci` passed formatting,
lint, typecheck, 116 tests, and build. ADR-0023 adds default IPv4 loopback,
validated explicit container/IPv6 binding, and deterministic Host/Origin/Fetch
Metadata checks before all routes. Regression tests prove hostile requests
cannot read or mutate tasks while the valid local flow remains usable.

An isolated live preflight confirmed a task, queued the same manual key twice
as one execution, restarted the API, then ran the real worker against the
default public feed. It delivered three distinct cited stories and facts as
one Markdown artifact, with `queued` -> `claimed` -> `delivered` -> `succeeded`;
a foreign Origin received `403`. Its processes were stopped after verification.
This is a manual preflight, adds no trial days, and does not prove 24/7 uptime.

Official standalone Compose 5.6.0 validated the updated configuration and host
loopback port mapping. No Docker engine is installed here, so image build/startup
was not rerun; the Dockerfile is unchanged. CI now defines Windows and Linux
jobs; remote job results must be checked separately. Portuguese onboarding and
truthful maintainer-support preparation are linked from the README. No public
release tag, adoption metrics, or program approval is claimed by this change.

## Stage 7 — Cloud identity and owner-scoped storage

Outcome: an authenticated phone user accesses only their own online assistant records.

- [x] Owner-private HTTPS version 2 published; native D1 confirms three migrations/15 applied tables. Earlier 12-table proof remains historical.
- [x] Identity/internal-owner mapping, scoped SQL, projection/deletion and auth/CSRF behavior pass fixture tests; live unauthenticated/forged/forwarded-identity requests are rejected.
- [x] Independent Workers/D1/Access configuration provided with separately tested adapters.
- [ ] Positive owner sign-in and authenticated persistent CRUD verified on the deployed Site.
- [ ] Independent Workers/D1/Access deployment and identity migration/remapping verified live; no raw Site user ID copying.

Acceptance test:

- A real deployed HTTPS URL identifies its authenticated owner without trusting a client-supplied owner ID.
- No raw Site user ID is copied across Sites as portable authorization; identity/provider migration requires reauthentication and an explicit internal-owner remap.
- Missing authentication, cross-owner reads/mutations, forged owners, and invalid cross-origin mutations fail safely before private access.
- The portable deployment does not require the founder's Sites account; managed and independent targets state their required credentials/bindings honestly.

## Stage 8 — Remote providers, encrypted keys, and quotas

Outcome: remote conversation uses a legitimate authorized route and stops safely at provider or budget limits.

- [x] Replaceable Workers AI/Groq adapters, unavailable states, encrypted owner-scoped envelopes and quota behavior pass fixture/SQL tests.
- [x] Runtime operational master key configured privately; bounded current/previous keyring and compare-and-swap rotation pass tests with owner/provider/version-bound authentication.
- [x] Bounded context/output/global/per-user limits, redaction, and provider failure paths pass the final suite and static review.
- [ ] Owner connects an authorized Groq key through the deployed HTTPS form and verifies a real first AI turn; no AI binding/key is currently configured.
- [ ] Live connection removal/provider revocation and auditable operational access verified with the owner's actual credential.
- [ ] Manual ChatGPT/Grok/Gemini redirect flow verified in the browser; no consumer-session scraping, implicit API entitlement, paid fallback, account pooling, or quota bypass.

October 13 operating boundary: unrelated production resources remain protected. Account ownership does not prove provider entitlement, free billing or isolated shared quota. No default hosted AI binding/key is assumed. The optional personal Colab route has its own eligible entitlement; reliable hosted inference/scheduling remains separately verified.

Manual Colab status (October 13): an earlier short Portuguese Qwen3-8B answer was user-reported. Download/loading and the optional hf_device_map diagnostic failure remain technical history. Corrected static/mock checks passed; independent placement/current pairing is still unconfirmed. No personal resource/balance measurements or private installation details are published. This is not an agent-run benchmark, 27B proof or unattended Tatu delivery.

Optional personal Colab adapter: historical release CI205/client18/audit0/static review pass; October 13 public-source checks are lint/types/210 tests/build and companion13/original8. Version 2 was privately published with three migrations/15 D1 tables, before current version 3. Its two 22-case phases confirmed gateway denial before/after the server-only service token was configured; native task read remains positive. Those probes created no owner job/Google inference or scheduled execution. On October 14 the owner reported model loading, pairing and real Tatu replies on version 2; this is attributed use, not independent controlled version 3 acceptance or stop/active proof. Historical public47bfc1e/CI38500459769 is verified. [Deployment evidence](docs/DEPLOYMENT.md#october-13-private-colab-publication-evidence), [ADR-0025](docs/decisions/ADR-0025-personal-colab-connection.md).

October 14 usability/history revision: responsive setup steps, complete PEM
instructions, collapsed encrypted envelope, session monitor/countdown and explicit
public arithmetic test are implemented. The test uses the existing bounded chat/
job path in a separate saved conversation without history/notes/memories; actual
receipt/model/time and expected-answer correctness are separate. Per-turn
`includeHistory` defaults true; false omits previous messages without deletion.
Colab trims oldest complete pairs to at most 12 total messages, preserving current
input/system/selected context and existing byte/token caps. Final root CI passed
226 tests after manual-tab/expired-feedback fixes. Actual-built browser checks
with mocked APIs at 1440×1000 and 390×844 found no horizontal overflow; manual
paid consent is hidden and active consent is aligned. Captured test POST omits
conversation ID/history/selected IDs; mocked expected/divergent replies show
reported model/time and distinct correctness. Expiry clears stale success and
bounded cancellation sends one DELETE with useful feedback. These are visual/
fixture checks, not Google inference. Version 3 deployment succeeded at the
existing private installation, preserving one-owner audience, secrets, three
migrations/15 tables and disabled scheduling. Sixteen live access/readiness checks
pass; direct-origin and positive browser-login gaps remain explicit. Public
[78f5c2b](https://github.com/tatu-project/tatu/commit/78f5c2bf2816e12879cf41fa5732e54c33290dd9)/
[CI38567151349](https://github.com/tatu-project/tatu/actions/runs/38567151349)
passed Windows/Linux; native task listing still returns `[]`.
Repeated refusal after a subject change is possible conversational carryover,
not a demonstrated static guardrail defect. [Connection/test guide](docs/COLAB-CONNECTION.md).

- [x] Manual one-shot implementation/static/mock checks enforce exact-context consent in Tatu and notebook `PROCESSAR` without private outputs; loaded-model reuse and no listener/tunnel/proxy/keepalive/unattended scheduler/third-party sharing/PC/Ollama are reviewed.
- [x] Code/route fixtures require independent `SYSTEM_RUN_TOKEN`; platform bypass and Colab credentials cannot authorize system dispatch or ordinary owner APIs. Live gateway proof remains separate.
- [x] Web Crypto/SQL/client fixtures validate owner pairing, ephemeral RSA and AES-GCM/RSA-OAEP/SHA-256 ciphertext; bootstrap secrets stay out of plaintext client projections/source/logs/output.
- [x] SQL/API fixtures prove hashed owner-scoped, one-use/expiring/revocable pair/session credentials and deny foreign-owner/replay/expiry/revoke/ordinary-API use.
- [x] Async job fixtures prove cancellation/revision, fenced short leases/TTL/quotas, rollback and duplicate/stale completion rejection without fallback or late answer append.
- [x] Client/notebook mocks prove exact-context consent, private-output suppression, stopped/offline states and secret handling; Google plaintext is disclosed without E2EE claims.
- [ ] Optional active interactive polling passes its 20-minute/owner-checkbox/stop checks under eligible paid entitlement with positive Colab units. Eligible paid entitlement/positive units were observed; active remains an owner choice, not permanent balance/availability or implicit consumer subscription access.
- [x] Final local CI/static/mock/security/reviewer checks pass after the last collision fix, including system/vault/Groq token collisions; this is not live owner acceptance.
- [x] Private version 2 publication/two 22-case gateway probe phases preserve owner-only access, reject bypass-only/forged/invalid credentials and deny system dispatch before/after service-token configuration; no real Google job/inference was created.
- [ ] Controlled current-revision same-owner pairing/response test verified; October 14 owner-observed version 2 replies are recorded separately, not equivalent to this acceptance.
- [x] Current usability/history implementation, mocked responsive browser checks, bounded gateway probes, private publication and public Windows/Linux CI pass; these limited gates do not prove owner inference/PWA/scheduling.
- [ ] Authorized version 3 owner probe/history/stop/active checks pass with real compute, separately from mocked browser evidence.

Acceptance test:

- Keys remain encrypted in durable storage and cannot be exposed through another owner, model input, logs, API projections, or errors.
- The current QA envelope can be decrypted by the server. Messages/notes/preferences are plaintext at the application layer; provider-bound context is not private-vault E2EE. The UI/docs explain those facts and do not imply deleting Tatu records erases provider copies.
- Requests cannot exceed the configured per-user/global caps or silently use a paid route; missing bindings/keys and exhausted quotas are visible.
- Real remote inference is claimed only after an authorized live binding/key succeeds; fixtures and unavailable states are labeled explicitly. Unpaid Gemini is not the default personal-context route.

## Stage 9 — Mobile personal-assistant workspace

Outcome: the authenticated owner can use a responsive Portuguese assistant from a phone without a local process or model.

- [x] Owner-scoped conversation/memory/note and task-control/result-reader implementations pass fixture SQL/API tests.
- [x] Client behavior suite passes 10 tests, including cited-text review/export for manual NotebookLM Audio Overviews handoff.
- [x] Portuguese web/PWA shell and unavailable/offline boundaries are implemented and covered by nonvisual client tests.
- [ ] Positive deployed owner CRUD, mobile visual QA, and actual PWA installation verified in an enabled browser.

Acceptance test:

- Deployed mobile smoke verifies message/reopen/delete, preference/note create/edit/delete, task controls, and full cited results for the authenticated owner.
- Context selection, missing AI, quota exhaustion, manual redirects, and internet failure are explained without fabricated replies.
- No flow requires a desktop process, Ollama, model download, consumer API entitlement, or unlimited free quota.

## Stage 10 — Hosted scheduling and delivery

Outcome: online scheduling produces owner-scoped cited results independently of the user's phone.

- [x] Durable owner-scoped scheduling/claim/retry/delivery implementation passes fixture SQL tests; Worker exports a `scheduled` handler.
- [x] Curated AI RSS adapter and cited in-app result/text-export implementation pass bounded fixture/client tests.
- [x] Historical October 12 owner-private dispatcher empty-queue probe passed; this is not the current candidate's independent-authority proof or a scheduled run.
- [ ] Native Sites scheduling bridge configured and verified before enabling dispatch; `SCHEDULER_ENABLED=false` and no schedule exists now.
- [ ] Independent one-minute Cron deployment verified live; portable configuration/tests alone do not satisfy this item.
- [ ] Actual remote scheduled occurrence plus repeat/retry/provider-outage/recovery verification.
- [ ] Founder daily 09:00 `America/Sao_Paulo` cited AI-news request, with cited text export/manual NotebookLM import for user-generated Audio Overviews.

Acceptance test:

- The remote worker reaches a configured due instant without manual execution or a user's device running and records one intended result/trace.
- Repeated Cron events and requests, failures, and recovery do not duplicate delivery or leak another owner's task/result.
- If the available deployment cannot run scheduled execution, retain an unchecked capability gap and disclose it before a limited beta publication; fixtures/manual runs are not proof.
- Text scheduling/delivery and export are verified separately from manual NotebookLM Audio Overview generation. No consumer API entitlement or automatic Tatu audio generation is implied; completing only text delivery does not complete the audio goal.

The published Colab version replaces the former private-gateway dispatch authority:
`/api/system/run-due` requires independent `SYSTEM_RUN_TOKEN`, including Sites;
without that live secret it stays disabled. Platform bypass alone grants no
dispatch or ordinary user API authority. Native automations are empty; prompt-based scheduling has no verified
code-dispatch bridge or entitlement/free-cadence guarantee. Keep disabled.

## Stage 11 — Remote MCP and private publication

Outcome: a verified authenticated online beta can be shared privately with its tested tools and explicit limits.

- [x] Bounded MCP protocol/tools and permission behavior pass fixture tests; real identity-free initialize/list/call requests fail at the private gateway.
- [x] Private Site and native MCP endpoint/plugin published/installed; authenticated native Tatu tools are exposed for the checked account.
- [x] Historical October 12 clean install/189-test suite/audit/review passed; latest Colab local 205-test proof is recorded in Stage 8.
- [x] Historical private HTTPS publication/CLI negative-access/system-readiness probes passed; new candidate live proof remains separate.
- [x] Live native `tatu_listar_tarefas` returns `[]`, and `tatu_preparar_tarefa` returns an expiring 09:00/three-story AI proposal requiring app confirmation; no task is created.
- [x] Historical public baseline `4323d45` pushed and remote CI38336981415 passed Windows/Linux.
- [x] New private Colab version 2 publication/gateway proof is verified separately from the earlier baseline.
- [x] Public source `47bfc1e` pushed; CI38500459769 passed Windows/Linux for that exact revision, separately from private Sites publication.
- [x] October 14 private version 3/public `78f5c2b` and CI38567151349 pass limited publication/access/readiness/mock-browser checks; controlled owner inference and remaining full acceptance stay open.
- [ ] Positive owner sign-in/mobile visual/PWA smoke and first real inference/scheduled task run satisfy the full online acceptance.

Historical October 12 baseline: app revision [4323d4584c0e8a9cce9857ff521ae1f5f27beafe](https://github.com/tatu-project/tatu/commit/4323d4584c0e8a9cce9857ff521ae1f5f27beafe)
is pushed to `origin/main`. Root confirmed
[run 38336981415](https://github.com/tatu-project/tatu/actions/runs/38336981415)
completed successfully on both Ubuntu and Windows, so only the combined
publication/remote-CI item is now checked. Local formatting/lint/types/build and
189 tests pass with zero failures/skips, including eight secure-export tests.
The owned SUBST-drive regression was reproduced and cleaned up; root's mapping
inventory is empty. Canonical/lstat/symlink/whitelist/preflight checks remain.
The cloud bundle is unchanged, and four user `.codex` edits remain excluded.
Earlier failed runs are retained as dated history in the session log.
No whole online stage is complete: web/mobile/AI/scheduling gates remain open.

The positive native-tool connection is verified for this platform account.
Standalone/manual OAuth setup, web cookie login, broader live CRUD/confirmation,
and independent deployment remain unverified. The October 12 suite included the
local-session regression fix: 189 passed, zero failed, with the same published
bundle. The new 205-pass Colab version has separate private-publication/gateway
proof above; public source `47bfc1e`/CI38500459769 now passes Windows/Linux.

Acceptance test:

- Remote MCP initializes, lists implemented tools, and exercises representative authorized reads/mutations; unsupported/malformed requests fail safely.
- The release protocol records dated revision/environment evidence and distinguishes fixtures, live inference, scheduled execution, and explicit gaps.
- Private publication does not claim public plugin approval, ChatGPT connectivity without live account-supported proof, parity, free account eligibility, unlimited hosting/inference, or continuous uptime.

## October 12, 2026 — bounded private QA evidence

- Clean ordinary `npm ci` installed 157 locked packages on Windows Node
  24.13.0/npm 11.6.2. Final `npm run ci` passed format, lint, types, 189 tests,
  and build; production audit reports zero known vulnerabilities. Final static
  review after export/quota/key-rotation/context fixes has no blocking findings.
- Private owner-only Sites publication succeeded at
  the QA URL (address supplied privately by the installation operator), with the
  native `DB` overview showing 12 applied tables. The published Worker is
  173,003 bytes with `fetch`/`scheduled`, two immutable SQL migrations, and zero
  native/external imports. Source/deployment/version IDs and probe details are
  in [DEPLOYMENT.md](docs/DEPLOYMENT.md#october-12-private-publication-evidence).
- Real HTTPS CLI probes reject anonymous, forged/forwarded identity, foreign
  Origin, and identity-free MCP requests. Service health and an authorized
  empty-queue platform-boundary dispatch succeed. Those negative probes created
  no user data; the later native MCP call created a transient proposal only.
  No key, LLM call, task or schedule was created; readiness is not scheduled proof.
- No AI binding/Groq credential is configured. Site scheduling remains false,
  portable Cron is not deployed, and owner sign-in/CRUD/mobile visual QA could
  not be checked without an enabled browser. The raw direct Worker origin is
  not exposed and remains unverified.
- Native Tatu tools are now available for this authenticated platform account:
  `tatu_listar_tarefas` returned `[]`; `tatu_preparar_tarefa` returned an expiring
  09:00 `America/Sao_Paulo`, quantity-three AI-news proposal with
  `requiresAppConfirmation: true`. This created transient owner QA proposal data,
  not a confirmed task. No LLM call, schedule, or provider key exists. Manual
  OAuth/web cookie flows and entire online stages remain open. Implementation
  app revision `4323d45` is pushed; remote CI passed Windows and Linux. Final local verification
  is 189 passed/zero failed.

Exact next action: refresh the Tatu app, re-pair only if the session expired,
authorize its isolated public probe and compare an inoffensive next turn with
history disabled using authorized owner compute. Keep a loaded Google model;
refreshing the app does not require another model load. October 14 version 2
loading/pairing/replies are owner-observed, not controlled version 3 proof.
Eligible paid entitlement with positive units was previously observed, not
guaranteed permanently. Hosted scheduling still needs entitlement outside
protected production resources, independent dispatch and a real due task.
Full browser CRUD/mobile/PWA and guardrail-quality acceptance remain open;
native MCP read/proposal already works.

## Direction reset — October 15, 2026

The user chose a simpler free agent combining Grok Bot, Muse and Dots patterns: Telegram first, free always-on runtime, no training on user data, Free Resource Radar, BYOK with in-chat model selection, tools with approvals, and Colab as an advanced option. [ADR-0027](docs/decisions/ADR-0027-free-agent-telegram-first.md) records scope, sources and free-plan limits. Stages 7–11 keep their evidence; their remaining open items continue only where the new stages reuse them.

## Stage 12 — Telegram bot on the free runtime

Outcome: the owner chats with Tatu in Telegram, served by the free Worker, with no PC or paid service.

- [ ] Webhook update handler with Telegram secret-token verification, owner allowlist and idempotent update IDs.
- [ ] Owner text message receives a real model reply from one eligible route; unavailable/quota states answer honestly.
- [x] Conversation history, `/memoria` notes and `/modelo` selection persist in D1 per owner.
- [ ] Handlers stay within free-plan CPU/subrequest/D1 limits under fixture load tests.

Acceptance test: from a phone, a non-owner message is ignored, and the owner gets a real reply, switches model with `/modelo` and sees the next reply use it.

Implementation note (October 19, 2026): `POST /api/telegram/webhook` ([telegram.ts](apps/cloud/src/telegram.ts), migration `0004_telegram.sql`, [setup guide](docs/TELEGRAM.md)) verifies the secret header in constant time, processes only allowlisted private chats, records update IDs at-most-once, and supports `/start`, `/ajuda`, `/novo`, `/memoria`, `/esquecer` and `/modelo` with honest failure texts. Fixture checks pass: format/lint/types/build and 239 of 246 tests (the 1 IPv6 and 6 cancelled `apps/api` cases fail identically without these changes in this container). Independent review found no blocking issue; its fixes were applied. No item is checked: no real bot, phone, model reply or free-plan CPU measurement has been verified. Live evidence (October 23, 2026, dedicated Cloudflare account, `workers.dev`, Telegram-only mode): the owner's phone received `/start` help, a real Workers AI (`@cf/openai/gpt-oss-20b`) reply stored in D1, `/memoria` save/list and `/modelo workers-ai` followed by a reply on that route. Bounded HTTPS probes returned 401 for the web API without login and for missing/wrong webhook secrets, and a non-allowlisted update with the valid secret was accepted with no owner, update or message row. Two runtime defects found live were fixed (`redirect: 'error'` is rejected by Workers; gpt-oss returns a chat completion). Still open: a real second Telegram account being ignored, honest unavailable/quota replies live, and free-plan CPU measurement. Deployment now publishes automatically from `main` after CI ([DEPLOYMENT.md](docs/DEPLOYMENT.md#automatic-deployment-from-main)); the private account IDs and webhook secret stay outside Git. The Telegram owner is currently separate from the web owner, and the Sites private lane cannot receive webhooks; use the independent Workers lane with an Access bypass for that path.

## Stage 13 — Free Resource Radar and no-training gate

Outcome: Tatu only uses free routes whose verified terms say no training, and learns about new free offers safely.

- [ ] Versioned registry schema (provider, model, limits, training, retention, region, terms URL, checked date, status) with validation tests.
- [ ] Router refuses unverified or training-allowed routes by default; BYOK routes show their recorded policy.
- [ ] Initial entries verified against official terms (Groq, Cloudflare Workers AI, Cerebras, OpenCode Zen, OpenRouter, Mistral, Gemini), each marked eligible or excluded with sources.
- [ ] Scheduled searcher proposes registry changes as untrusted suggestions; nothing becomes eligible without review.

## Stage 14 — Agent tools, routines and approvals

Outcome: Tatu plans and uses tools and runs routines by itself, asking before consequential actions.

- [ ] Tool loop with web search/RSS, reminders, scheduled routines, memory and notes, split into persisted steps within free limits.
- [ ] A Cron dispatcher delivers a real scheduled routine to Telegram without any device running (reuses Stage 10 durability).
- [ ] Irreversible actions require an inline-button approval bound to the exact action, expiring and single-use, with an audit record.
- [ ] First OAuth/MCP connector (Gmail or Calendar) with least-privilege scopes and revocation.

## Stage 15 — Five-minute setup and public release

Outcome: a nontechnical person installs their own Tatu for free in under five minutes.

- [ ] One-click deploy plus guided bot-token/key entry, with no terminal.
- [ ] Portuguese and English setup guides verified by a fresh user on a clean account.
- [ ] Public MIT release with honest limits (free quotas, model quality, no training gate).

## Stage 16 — Agent team in Telegram topics

Outcome: the owner runs a small team of named agents in one Telegram group, coordinated by a chief of staff, approving consequential actions with one tap. Scope: [PROJECT.md section 2.11](PROJECT.md#211-bounded-agent-team).

- [ ] Owner creates an agent by describing it (name, role, instructions, tools, routines); each maps to one forum topic of the owner supergroup.
- [ ] Each agent keeps separate memory/history; the chief-of-staff topic routes requests and hands work to another agent with context.
- [ ] Agent routines run on schedule and post in their topic; quotas are shared, visible and stop honestly.
- [ ] Irreversible agent actions use the Stage 14 approval flow; audit shows which agent proposed what.

## Later accepted outcomes — separate verification

These product requirements do not become implemented merely because the PWA/cloud beta is published. Each remains unchecked with its own evidence and permission boundary.

- [ ] Actual native mobile and desktop packages use the same online backend and pass build/install/sign-in/update/privacy tests; distinguish native packages from PWA installation.
- [ ] An optional physical-device companion is visible, opt-in, revocable, and narrowly authorized; test cancellation and permission denial before claiming app control.
- [ ] Connected accounts use official least-privilege OAuth/passkeys/API capabilities, with inspectable scopes and connection revocation.
- [ ] Typed external-action proposals bind exact owner/account/target/effect/inputs to expiring one-use approval, with deterministic permissions, idempotency, sanitized audit, cancellation, and revoke tests.
- [ ] Unsupported personal-account APIs use an explicitly user-assisted official settings/browser handoff; do not claim generic Play Store/YouTube Premium cancellation through the developer purchase API.
- [ ] Verify the NotebookLM Audio Overviews handoff: cited text export/manual import and user-generated audio, without claiming consumer API access or automatic Tatu generation.
- [ ] Replaceable audio port has explicit content/credential/permission/quota contracts, real audio/playback verification, and failure states separate from text delivery.
- [ ] An optional authorized NotebookLM Enterprise adapter passes Cloud-project/IAM/notebook/source and availability tests; otherwise retain cited export/manual handoff. Browser/device TTS or Google Cloud TTS is a separately identified adapter, not NotebookLM.
- [ ] A separate client-held-key E2EE/zero-knowledge private vault accepts passwords/private material only inside its ciphertext boundary; no password in chat/logs/models/plain SQL or server operational records.
- [ ] Private-vault lock, recovery, export, owner isolation, key-loss, ciphertext tampering, and independent security tests pass; the server never receives its decryption key.
- [ ] Any explicit narrow private-vault delegation states recipient, scope, expiration, and the temporary plaintext/runtime boundary; the unattended cloud agent cannot silently decrypt the zero-knowledge vault.

## Later roadmap

## Planning horizon

This horizon organizes confirmed needs without replacing or renumbering the verified stages above.

| Need                                | Status                                                                                                                                                                                                                                                                    | Planned verification                                                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Persistence and deployment decision | Standard mobile path is authenticated online API/worker with owner-scoped D1; Sites is the private first lane and independent Workers/D1/Access is the second lane. Node/SQLite remains optional legacy self-hosting.                                                     | Verify identity issuer/subject mapping, internal owners, cross-owner denial, and each deployed lane separately.             |
| Daily briefing end to end           | Scheduling, configurable RSS research, saved cited results, deterministic fallback, optional local model synthesis, selected default source, and live three-story acceptance run are implemented.                                                                         | Stage 5 is complete; future delivery and provider-health work continues in later stages.                                    |
| Task monitoring and “Test now”      | A local `POST /api/tasks/:taskId/test` endpoint queues a distinct pending execution for an existing task, with a bounded `Idempotency-Key`; the Tasks UI exposes `Testar agora` and a bounded title/source briefing preview backed by the existing worker/event pipeline. | Manual runs are separate from scheduled occurrences; repeated requests with the same key return one execution.              |
| Free limits and provider fallback   | The bounded local-model-to-deterministic-RSS fallback is implemented; quota-based multi-provider fallback is not implemented.                                                                                                                                             | Stage 6 distinguishes availability, rate limit, auth, temporary failure, capability compatibility, and authorized fallback. |
| Editable personal memory            | The owner-scoped cloud implementation passes fixture tests; positive deployed web CRUD remains open. Development `brain/` is not product memory.                                                                                                                          | Verify live owner edit/delete and context selection without treating full transcripts as permanent memory.                  |

- OAuth and first connected account.
- Conditional/event automations.
- Broader plugin/tool ecosystem and public plugin directory submission.
- Device executor.
- Payment initiation with external wallet authorization.
- Optional commercial hosted convenience product beyond the free-first private online beta.
- Arbitrary sensitive payload/PII detection across future inputs.
- Autonomous external messaging and broad OAuth integrations.

These items do not enter the MVP unless `PROJECT.md` is explicitly updated.

Verification note (September 16, 2026): ADR-0021 adds the database-independent
manual execution port and the local API endpoint. The endpoint rejects missing,
oversized, and unknown-task requests; hashes the request key before persistence;
returns no occurrence key; and queues exactly one execution and `queued` event
for repeated task/key requests. A worker test proves that the existing
scheduler consumes the manual row with the task topic, quantity, and distinct
manual idempotency key. A SQLite fault-injection test proves that a failed
`queued` event insert rolls back the execution row. The full `npm run ci` suite
passed with 112 tests. This historical manual-run verification did not establish
long-running reliability or broaden the bounded redaction policy. The local
Tasks UI now exposes `Testar agora`, URL-encodes the task ID,
reuses an in-memory per-task key for retries, and keeps the key and occurrence
identifier out of the DOM; the page contract test and the same 112-test suite
pass. The execution view also renders up to three validated briefing
title/source pairs from the public briefing projection, omitting URLs, raw
results, inference, and provider payloads.
