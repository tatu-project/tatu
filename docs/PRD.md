# Tatu product requirements and current state

Snapshot: October 14, 2026. Private version 3 is published with the connection/
context usability revision and verified limited implementation/publication gates.
This PRD connects user needs to
implemented behavior, evidence and remaining acceptance. [PROJECT.md](../PROJECT.md)
owns product scope, [ROADMAP.md](../ROADMAP.md) owns progress, [ADRs](decisions/README.md)
own technical choices, and code/tests define behavior. This is a navigable current
specification, not a replacement for those authorities or a private operations log.

## 1. Product and goals

Tatu is a Brazilian MIT-licensed personal assistant with a Portuguese mobile/
desktop web experience, an online backend and replaceable AI providers. Its
standard path is free-first whenever feasible, without an end-user PC left
running or local model installation. Independent hosting remains possible.

The long-term goal is useful personal context, current research, recurring work
and authorized owner actions. Grok, Muse and Dots inform direction; feature
parity is not an implemented claim. The immediate goal is a private assistant
with verified chat/context controls and a daily cited AI briefing.

The reference task is AI news at 09:00 in `America/Sao_Paulo`, with a NotebookLM
Audio Overview. Current audio handoff is cited-text export/manual import and
user-generated audio; automatic audio remains future work. No elapsed 30-day
pilot is required. Reliability must be demonstrated through reproducible checks,
without rewriting historic failures or claiming continuous uptime.

## 2. Personas and use cases

| Persona                | Need                                          | First path                                                         |
| ---------------------- | --------------------------------------------- | ------------------------------------------------------------------ |
| Individual mobile user | Conversation and control of personal context  | Authenticated workspace plus an available authorized model route   |
| Personal compute owner | Reuse a model in their own Google VM          | Private Colab pairing, consent and short interactive sessions      |
| Technical self-hoster  | Own credentials, data and deployment          | Portable Workers/D1/Access; legacy local profile when appropriate  |
| Maintainer/contributor | Reproduce work without private-account access | Generic configuration, checks, ADRs and explicit deployment inputs |

Primary scenarios:

- Ask a question, review exact selected context, receive an authorized model
  answer, reopen a conversation and explicitly delete it.
- Exclude prior conversation turns from one request without deleting saved
  messages; inspect selected notes/memories separately from conversation history.
- Authorize a public arithmetic probe in a separate conversation, inspect the
  real reply/model/elapsed time and distinguish received text from correctness.
- Add/edit/delete a preference or note and deliberately select it for a turn;
  complete transcripts do not automatically become permanent memories.
- Request a daily briefing, inspect/confirm its expiring proposal, pause/edit/
  resume the task and read execution results with citations.
- Reuse loaded Qwen in the owner's Colab VM through manual Run, or an optional
  short active session under eligible paid positive-unit entitlement.
- Use ChatGPT MCP to list tasks or prepare a proposal while Tatu retains
  confirmation authority.
- Eventually approve a specific official service action. Unsupported personal
  APIs require an assisted official handoff, not a fake execution claim.

## 3. Current evidence and scope

| Area                     | Implemented                                                       | Verified                                                                                | Remaining                                                          |
| ------------------------ | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Identity/D1              | Verified ingress mapped to internal owner, scoped SQL             | Auth/CSRF/cross-owner fixtures and private gateway denial                               | Independently observed browser owner CRUD/session flow             |
| Portuguese workspace/PWA | Chat, notes, memory, controls, reader; online-only actions        | Client checks, hosted code and mocked connection desktop/mobile visuals                 | Full owner CRUD/mobile/PWA installation and positive browser smoke |
| Conversations/context    | Persistent turns, per-request history selection, context/deletion | SQL/API/client checks; owner-observed v2 replies                                        | Current-revision browser/history acceptance                        |
| Workers AI/Groq          | Replaceable adapters, optional encrypted BYOK, quotas             | Provider/security fixtures                                                              | Configured provider turn and credential lifecycle                  |
| Colab                    | Sealed pairing/jobs, status monitor and isolated response probe   | Private v3/mock visuals/gateway; owner-observed v2 replies and crypto/SQL/client checks | Controlled current-revision probe, cancellation/stop/active proof  |
| Briefings                | Curated RSS, citations, scheduling/retry/results                  | Fixtures and earlier legacy delivery proof                                              | New actual hosted due occurrence/delivery                          |
| MCP                      | Bounded authenticated tools/private native connection             | Native task list/proposal calls                                                         | Broader confirmation, standalone OAuth/public directory            |
| Audio                    | Reviewed cited-text export/manual NotebookLM handoff              | Client checks                                                                           | Actual user-generated audio; automatic Enterprise adapter          |
| Private credentials      | Server operational encryption/bounded rotation                    | Crypto/owner/CAS/redaction checks                                                       | Live lifecycle and future client-held password vault               |
| Native/account actions   | Scope and permission boundaries                                   | Accepted architecture only                                                              | Packages, companion and official action adapters                   |

Private version 3 preserves three migrations/15 D1 tables, independently checked
through native metadata. Historical version 2's
recorded release proof includes 205 application tests, static review without
blocking findings, zero known production dependency vulnerabilities and two
22-case negative gateway phases. October 13 public-source checks passed lint/types/
210 tests/build plus 13 companion/eight original notebook checks. These Python
checks are static/mock/interop, not an agent-run GPU session.

On October 14 the owner reported loaded Qwen3-8B, pairing and real replies inside
the published version 2. Earlier ChatGPT sign-in and manual model output remain
attributed history. Version 3 passed final root format/lint/types/226 tests/
build and companion13/original8; private handoff checks pass separately. Actual-built browser checks use mocked
APIs at 1440×1000 and 390×844: no horizontal overflow, mode-specific consent
visibility, isolated request capture and distinct expected/divergent reply states.
These verify layout/client behavior, not real Google inference or model latency.
Final browser retests also clear stale success on expiry and send one bounded
cancel DELETE with useful feedback. Private deployment succeeded, preserving
existing audience/secrets/scheduling state. Sixteen live access/readiness checks
pass; direct-origin and positive owner-browser tests have explicit gaps. Public
[78f5c2b](https://github.com/tatu-project/tatu/commit/78f5c2bf2816e12879cf41fa5732e54c33290dd9)/
[CI38567151349](https://github.com/tatu-project/tatu/actions/runs/38567151349)
passed Windows/Linux. These are limited code/visual/publication proofs, not a new
Google inference or scheduled run.
The owner-observed replies do not prove a controlled current-revision probe,
guardrail quality, full browser CRUD or scheduled delivery. A repeated refusal
after a subject change suggests possible conversational carryover, not a proven
static refusal defect. Historical public [47bfc1e](https://github.com/tatu-project/tatu/commit/47bfc1e7de4e44a4bf9b074618df0d921db48b1b)
and [CI38500459769](https://github.com/tatu-project/tatu/actions/runs/38500459769)
are verified, with Windows/Linux success for that revision. Public source omits private install metadata, credentials and exact
personal operational records.

## 4. Workspace requirements

- Authenticate private routes and scope reads/writes/foreign references to the
  server-verified internal owner; client input cannot choose another owner.
- Persist conversations with revision/turn control and explicit deletion.
- Keep preferences/instructions and notes separate, editable and deletable.
- Preview exact bounded context and obtain required consent; exclude operational
  credentials and private-vault material.
- Offer default-on **Usar histórico desta conversa** for the next turn. An
  explicit false omits previous turns while retaining current input and chosen
  notes/memories; it never deletes saved messages. The counter reports selected
  notes/memories only and cannot imply that zero excludes conversation history.
- Safely render untrusted text and show unavailable/offline/stopped/failed/quota
  states without invented replies.
- Provide a PWA shell without personal API caching or offline actions that
  pretend online work can run without connectivity.

Acceptance is a real authenticated browser flow: create/reopen/delete a
conversation, edit/delete note/memory, control a task, read citations and verify
responsive installation/reopen behavior. Implementation/client checks alone
do not complete it.

## 5. AI and personal compute

Model suitability is separate from provider/budget availability. Workers AI
requires an available binding; Groq uses the official API and optional encrypted
owner key submitted through HTTPS. Adapters remain replaceable. There is no
account pooling, quota bypass, consumer-session scraping or automatic paid
fallback. Manual ChatGPT/Grok/Gemini redirects are explicit independent handoffs;
unpaid Gemini is not the default for personal context.

The Colab connector reuses Qwen3-8B loaded in the Google VM. It opens no listener,
tunnel/proxy/keepalive or third-party service, and installs no local PC model.
The installation operator supplies origin/project identity privately; the user
enters them in hidden VM prompts. Sealed header/AAD/plaintext/fingerprint must
match explicit configuration before decryption or HTTP. No owner-specific
defaults are shipped in source.

Manual Run handles one job, with exact Tatu context review and `PROCESSAR`
confirmation without private outputs. Optional active mode requires owner
selection/consent and eligible paid entitlement with positive Colab units; it
stops within 20 minutes/20 replies. Observed eligibility is not permanent balance
or availability. This route cannot provide unattended daily scheduling.

The connection panel separates disconnected/pending/paired/expired/revoked
states from actual response evidence, with next-step instructions and remaining
session time. A valid pairing does not prove that the notebook is serving.
The optional probe explicitly discloses a public 17 × 19 question, one normal
quota request and a saved separate conversation. It sends no prior history,
selected notes/memories or open draft through the existing chat/job path.
The result displays actual reply, model and elapsed time; expected `323` is
checked separately from receipt. Cancellation/expiry/timeout must never fabricate
success; this simple probe is not a guardrail, web-research or scheduling test.

Colab context is bounded to 12 messages. Oldest complete historical pairs are
removed as necessary, preserving system instructions, the current message and
explicit selected context; byte/token limits remain enforced. Other remote
providers retain their eight-pair history bound. An oversized mandatory context
fails visibly rather than dropping the user's explicit selection silently.

Credentials are hashed, owner-scoped, expiring/revocable and limited to inference
claim/complete. Jobs bind conversation/revision, cancellation, fenced short
lease, TTL and input/output bounds. Stale/duplicate completion must not append
after cancellation/deletion/replacement. Owner-observed version 2 pairing/replies
remain distinct from a controlled current-revision probe and live stop/revoke/
active acceptance.

## 6. Tasks, research and delivery

- Parse bounded time-based AI-news requests into proposals, requiring explicit
  owner confirmation and expiry rather than silent scheduling.
- Support edit/pause/resume with schedule revision and safe stale-run behavior.
- Fetch bounded curated public AI sources, retain citations/deduplication and
  distinguish source excerpts from model inference.
- Claim durable executions, retry safely and prevent duplicate delivery; provide
  in-app results, bounded traces/history and a full cited reader.
- Keep manual testing distinct from scheduled occurrences.
- Managed scheduling stays disabled until a real native dispatch bridge/due
  execution is verified. HTTP dispatch also requires independent operator
  authorization; platform gateway access alone is insufficient.
- Portable native Cron needs its own deployment/account/allowance/live proof.

Actual due execution must produce a real-source cited result and trace without
manual triggering or a user's device running. Duplicate/retry/outage/recovery
must preserve one intended result. A missing bridge remains an explicit gap.

NotebookLM Audio Overviews is the audio target. Text export is a manual import
handoff where the user generates audio, not automatic Tatu generation. Enterprise
audio APIs have separate project/IAM/license/availability requirements; consumer
access is not an API grant. Text-only delivery does not finish the audio goal.

## 7. MCP and future actions

Current tools list tasks/executions, retrieve a briefing, search notes, list
explicit memory and prepare a task proposal. Schemas, owner checks and bounded
results apply. Tools cannot confirm tasks, call models, execute commands/files
or control connected accounts. Managed native authentication and standalone
manual OAuth are separate paths. [MCP.md](MCP.md) defines the protocol.

Future service actions bind exact owner/account/target/effect/inputs to expiring
single-use approval, deterministic permissions, idempotency, sanitized audit,
cancellation and revoke. Prefer official least-privilege OAuth/APIs/passkeys.
Google Play's developer cancellation API is not general consumer subscription
control. Unsupported APIs use assisted official settings; a PWA does not imply
physical app automation. [ADR-0024](decisions/ADR-0024-mobile-cloud-security-and-agent-boundaries.md)
records these boundaries.

## 8. Architecture and modules

```text
Portuguese web/PWA or authenticated MCP client
  -> online Fetch Worker: identity, ownership, quotas, domain services
  -> D1: workspace, provider records, tasks/results, scoped Colab jobs
  -> adapters: Workers AI / Groq / optional personal Colab
  -> curated research and durable scheduler/result delivery
```

| Module                                 | Responsibility                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------- |
| `apps/cloud`                           | Hosted API/auth/D1/providers/vault/quotas, feeds/scheduler/MCP and Colab routes |
| `apps/web`                             | Portuguese workspace, exact context controls and online/PWA shell               |
| Shared/research/storage packages       | Contracts/domain utilities, portable or historical adapters                     |
| `apps/api`, `apps/worker`              | Optional Node/SQLite developer/self-host profile, not mobile backend            |
| Companion/notebook/checkers            | Google-VM connection, installation binding and static/mock checks               |
| Build/export scripts, hosting template | Neutral public builds, explicit private identity and guarded preparation        |
| `plugins/tatu`, local MCP helper       | Optional local-client prototype, distinct from hosted MCP                       |

Managed Sites auth/D1/MCP is the verified private lane. Independent Workers/D1/
Access/Cron is portable configuration, not a live-verified second deployment.
Redis/paid infrastructure is not assumed. OpenRouter is cancelled for current
connection work. Native surfaces later use the same online backend.

## 9. Data, security and privacy

The 15-table schema groups owners/usage, conversations/messages, memories/notes,
tasks/proposals/executions/events, provider connections/quotas and
`colab_sessions`/`colab_jobs`/`colab_usage`. Verified issuer/subject maps to
internal owners. Migration needs reauthentication/explicit remap, not copied
platform IDs; installation metadata itself grants no user authority.

- TLS/platform storage encryption complement AES-256-GCM operational envelopes.
  The server can decrypt keys: **not E2EE**.
- Assistant text is plaintext at the application layer. Selected context goes
  to providers/Google VM; MCP results may reach its client/model provider.
  Local deletion cannot erase external copies.
- Bootstrap is sealed to an ephemeral notebook RSA key; only ciphertext crosses
  owner UI. Gateway credentials grant no owner/system authority; reject operator/
  vault/provider collisions. Inner credentials stay hashed server-side.
- Expiry denies access/late completion immediately. Payload/hash cleanup needs
  later configured access/revoke/delete/retention, not an independent TTL eraser;
  disabled configuration has no guaranteed timed erase. Python reference cleanup
  is not guaranteed physical memory zeroization.
- A separate future client-key/zero-knowledge vault may hold passwords. Never
  put them in agent chat/logs/models/plain SQL or operational records. No raw
  cards/CVV/bank/wallet passwords enter the agent path.
- Client-key E2EE cannot silently supply an unattended cloud agent. Narrow
  explicit delegation creates a temporary plaintext/runtime boundary.
- Public source carries no real keys/private origins/IDs/accounts/screenshots.
  Runtime configuration and exact operations evidence stay outside Git.
  Forward-source sanitation does not rewrite existing Git history.

[SECURITY-ARCHITECTURE.md](SECURITY-ARCHITECTURE.md) defines current versus planned
guarantees; there is no 100%-secure claim.

## 10. Installation and operation

An end user opens their installation's private HTTPS address and authenticates;
developer tools are not required. Operators apply migrations and configure
verified identity/origin/secrets privately. Public hosting metadata is a generic
template; ordinary builds/CI need no private identity. Managed export requires
valid explicit per-process `SITE_PROJECT_ID` and preserves checkout/realpath/
archive guards. Missing/invalid identity fails before export build.

Enter origin/project only in hidden companion VM prompts; never derive trust
from the received envelope or publish those values in source/outputs/screenshots.
Keep secrets in the runtime control plane, backups private and local APIs on
loopback. Do not alter unrelated production resources or infer free billing
from account ownership. [DEPLOYMENT.md](DEPLOYMENT.md),
[COLAB-CONNECTION.md](COLAB-CONNECTION.md) and [DEVELOPMENT.md](DEVELOPMENT.md)
provide procedures.

## 11. Nonfunctional acceptance

| Requirement            | Evidence required                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| Privacy/authentication | Missing/forged/cross-owner/CSRF misuse fails before private access; no secret projections/logs              |
| Reliability            | Restart/duplicate/lease/retry/outage/rollback preserve one result                                           |
| Budget safety          | Deterministic input/output/concurrency/shared caps; no paid fallback                                        |
| Mobile usability       | Positive CRUD/reopen/delete/task/reader/responsive/PWA flow                                                 |
| Compute                | Controlled current-revision pair/probe/history flow; stop/revoke/expiry/active behavior separately verified |
| Scheduling             | Real hosted due occurrence with sources/trace/no duplication                                                |
| Portability            | Neutral public build, safe explicit configuration and separate independent deployment proof                 |
| Release quality        | Format/lint/types/tests/build, security review, gateway smoke and actual public CI                          |

A short manual model run does not justify latency, continuous uptime,
unlimited-free capacity or E2EE SLA claims. Keep failures visible and traces
bounded/redacted.

## 12. Stages, risks and next action

Historical stages 1–6 provide repository/local scheduling/research/routing proof.
Stages 7–11 remain partially complete: identity, providers, workspace, hosted
scheduling and MCP/private publication. Code/gateway/publication checks are
verified; whole online stages are not complete. [ROADMAP.md](../ROADMAP.md)
contains the exact checks, not inferred completion from this PRD.

Next: refresh the deployed app, re-pair only if expired and verify the explicit
public probe/history selection with authorized compute; reuse a loaded Google
model rather than reload it solely for an app refresh.
Owner-observed version 2 replies are an initial integration observation, not
completion of those checks. Then prove browser/mobile flows, live active behavior
and hosted scheduled delivery. Historical public-source/remote CI remains
separate from the new revision's private deployment and owner live use. Native packages/device
companion, connected accounts, automatic audio, private password vault and broad
agent workflows require independent later acceptance.

Risks include runtime/quota loss, unverified managed scheduling bridge, unknown
account billing/eligibility, provider-visible context, expired-data retention,
unsupported consumer APIs and mixing public source with private deployment
identity. Those risks require bounded tests/real authority, not prompt-only
permissions or unpublished assumptions.

Key decisions: [ADR-0024](decisions/ADR-0024-mobile-cloud-security-and-agent-boundaries.md),
[ADR-0025](decisions/ADR-0025-personal-colab-connection.md),
[ADR-0026](decisions/ADR-0026-public-source-private-installation-configuration.md).
[Brain navigation](../brain/00-Home.md) summarizes current truth/questions without
holding private operations records. This PRD adds no new dependency, paid route,
permission or completion claim.
