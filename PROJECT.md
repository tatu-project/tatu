# Tatu — Project Source of Truth

> Status: private Colab version 3 is published, preserving owner-only access, three migrations/15 D1 tables, secrets and disabled scheduling. Connection monitor/public probe/per-turn history checks pass root format/lint/types/226 tests/build and Python13+8; mocked desktop/mobile visuals and 16 bounded live gateway/readiness checks pass, with direct-origin/positive owner-browser gaps explicit. Public [78f5c2b](https://github.com/tatu-project/tatu/commit/78f5c2bf2816e12879cf41fa5732e54c33290dd9)/[CI38567151349](https://github.com/tatu-project/tatu/actions/runs/38567151349) passed Windows/Linux. Version 2 Qwen loading/pairing/replies remain October 14 owner observations, not controlled version 3 inference or guardrail-quality proof. Controlled owner/history/stop/active, full browser/PWA and scheduling acceptance remain open. Historical [47bfc1e](https://github.com/tatu-project/tatu/commit/47bfc1e7de4e44a4bf9b074618df0d921db48b1b)/[CI38500459769](https://github.com/tatu-project/tatu/actions/runs/38500459769) is separate 210-test/Python13+8 proof; original version 2 release had 205 tests.
> Project name: Tatu (decided)
> License: MIT (decided)
> Project start: August 26, 2026
> Last updated: October 15, 2026
> Direction (October 15–18): Telegram-first free agent with a no-training gate, Free Resource Radar, BYOK model selection, approvals and a bounded agent team (section 2.11); see [ADR-0027](docs/decisions/ADR-0027-free-agent-telegram-first.md). Not implemented yet.

## 1. Executive summary

Build a free-first, open-source personal AI agent that can remain active 24/7, remember useful context, research the web, run recurring or conditional tasks, connect to external services, and safely take actions on the user's behalf.

It must be simple enough for a nontechnical person and extensible enough for developers.

The product promise is:

> Your free personal AI agent that works for you 24/7.

The product philosophy is:

> Free isn't a tier. It's the architecture.

The user describes an outcome in natural language. The system plans the work, selects available models and tools, executes it within explicit permissions, records a trace, and delivers the result.

The historical baseline at `803e1e6` accepts a bounded daily-briefing request through local Node/SQLite/RSS and a filesystem inbox. It remains an optional self-hosted path, not the mobile backend. The online QA beta is privately published at the Tatu beta (address supplied privately by the installation operator), and its [implementation commit d2a8bc2](https://github.com/tatu-project/tatu/commit/d2a8bc22e9ecb6a990852ca38c8dc8fb596ab680) is pushed to `origin/main`. October 12 local 189-test and bounded live HTTPS/MCP evidence are verified; [remote CI](https://github.com/tatu-project/tatu/actions/runs/38336981415) passed on Windows and Linux for verified app revision `4323d45`. Publication is not full assistant acceptance.

Live private MCP `tatu_listar_tarefas` returned an empty list, and `tatu_preparar_tarefa` returned an expiring 09:00 `America/Sao_Paulo` AI-news proposal for three stories with `requiresAppConfirmation: true`. The proposal is transient owner QA data; it did not confirm or create a task. No AI binding/Groq key or schedule is configured. Web cookie sign-in/CRUD, mobile visual QA, actual inference, and unattended scheduled execution remain unverified. Exact source/deployment records are in [DEPLOYMENT.md](docs/DEPLOYMENT.md#october-12-private-publication-evidence).

On October 12, 2026, the user removed the elapsed 30-day pilot and explicitly corrected the delivery goal to a mobile-first online assistant: an HTTPS PWA, authenticated online API/worker, owner-scoped cloud storage, remote AI, and hosted scheduling. End users must not need a computer left running, a local model, Ollama, or a model download. The target week is October 12–18, 2026 in `America/Sao_Paulo`; this is a goal, not evidence of completion. Section 25 defines the approved private founder beta. Grok, Muse, and Dots are product references; capability parity is not a release claim.

The user also requires a website plus mobile and desktop app surfaces sharing the same online backend, eventual authorized account actions, a daily 09:00 AI-news briefing in `America/Sao_Paulo`, NotebookLM Audio Overviews, encrypted credentials, and the strongest practical end-to-end privacy. The first surface to verify is the installable mobile/desktop PWA; actual native packages, account-action adapters, automatic audio integration, and a client-held private vault require separate acceptance. The user confirmed NotebookLM summaries in audio as the target. The current implemented handoff exports cited text for manual import into NotebookLM, where the user generates the Audio Overview. Automatic Tatu-to-NotebookLM audio API integration is not implemented, and consumer access is not an API grant.

## 2. Non-negotiable principles

### 2.1 Zero-cost architecture

The standard path must cost R$0 to the project creator and R$0 to the user whenever technically possible.

Priority order:

1. R$0.
2. Reliable.
3. Easy.
4. Few steps.

If a reliable setup requires seven free steps instead of three paid steps, the project chooses the free path and then improves the onboarding.

The standard mobile path uses an authenticated online deployment with owner-scoped data and remote execution. Minimal hosted account isolation and authentication are now first-release requirements; the earlier individual-local-only restriction is superseded by the user's October 12 correction. The initial private founder beta may use Sites managed authentication, D1, and MCP. Independent Cloudflare Workers/D1/Access configuration must preserve a portable deployment path; open-source adoption must not require the founder's hosted account.

Legitimate free quotas and strict global/per-user caps bound sponsored infrastructure and AI usage. A missing binding, exhausted allowance, unavailable provider, or absent credential must produce an honest unavailable state; no paid fallback, quota bypass, or account pooling is permitted. Free hosting, inference, and account eligibility are not guaranteed. Optional independent self-hosting remains supported as a separate path, without making an end-user PC or local model a mobile prerequisite.

Operational constraint (October 13, updated October 14): do not alter unrelated production resources or infer free billing from account ownership. The standard Tatu path remains free-first. The optional personal Colab adapter is privately published with local/security/gateway checks; version 2 model loading/pairing/replies are now owner-observed. Controlled current-revision live acceptance and stop/active proof remain open. OpenRouter is cancelled. Exact context is reviewed in Tatu and manual execution confirms PROCESSAR without private notebook outputs. Active mode is optional, at most 20 minutes, and requires eligible paid entitlement with positive Colab units. Eligibility was observed, not guaranteed permanently; a consumer AI subscription alone does not prove compute units. The adapter supplies personal interactive compute, not an unattended/shared/free-permanent backend. Public source has no actual installation defaults; private origin/project is entered in hidden VM prompts. [ADR-0025](docs/decisions/ADR-0025-personal-colab-connection.md) defines the boundaries and [ADR-0026](docs/decisions/ADR-0026-public-source-private-installation-configuration.md) separates public/private configuration.

The creator's ChatGPT/Codex subscription is a personal development expense and is not considered an operating dependency of the product.

### 2.2 Free-first, not free-dependent

Essential capabilities must not depend exclusively on one third-party free tier.

The system should resolve capabilities through replaceable fallback chains:

```text
Capability request
  -> eligible implementations
  -> free available route
  -> fallback on quota, rate limit, outage, or incompatibility
  -> execution
```

The initial online release may use a compatible Workers AI model within a sponsored free allowance when the binding is available, or an official Groq API with the user's optional encrypted BYOK credential. Provider adapters remain replaceable. No automatic paid fallback is part of this release.

Explicit manual redirects to ChatGPT, Grok, or Gemini may help a user continue independently when a route is unavailable. Consumer login or subscription does not grant API access; redirects are manual, not autonomous execution. Do not scrape consumer sessions. Unpaid Gemini and other free tiers that train on user data are not eligible routes (section 2.10). Any later paid enhancement must be voluntary and cannot weaken the normal free-first path.

### 2.3 Beginner-simple, developer-powerful

The beginner sees Chat, Tasks, Connections, and clear health/status information. They should not need to understand LLMs, APIs, OAuth scopes, cron, context windows, vector databases, tool calling, Docker, or cloud infrastructure.

Advanced Mode may expose prompts, models, provider routing, quota, tools, memory, schedules, API, webhooks, logs, traces, tokens, permissions, secrets, and runtime details.

### 2.4 Provider-agnostic and portable

Model providers, search services, notification channels, storage, and hosting targets must sit behind interfaces. Runtime-specific adapters must keep the domain logic portable across online Workers and independent deployments. The historical Node/container path remains optional; managed Sites is a private beta target rather than permanent provider lock-in.

### 2.5 Safe autonomy

The agent may act only within explicit, inspectable permissions. Sensitive actions require confirmation appropriate to their risk. Prefer official APIs, least-privilege OAuth, passkeys, and delegated authorization. External action proposals bind an exact account/target/effect and normalized inputs to an expiring, one-use owner approval; deterministic code enforces permission, idempotency, auditing, cancellation, and revocation. A prompt alone is never authorization. Unsupported personal-account APIs use an explicit user-assisted official settings/browser handoff rather than a false execution claim.

### 2.6 Open source and permissive adoption

The project will use the MIT License. People and companies may use, modify, redistribute, host, and commercialize the code subject to the license notice and the independent licenses or terms of dependencies, providers, models, and integrations.

Open source does not grant write access to the official repository. Contributions enter through forks and pull requests reviewed by maintainers. The main branch should be protected against direct pushes, force pushes, and deletion, with automated checks before merge.

### 2.7 Project identity

The official project name is **Tatu**: a short, Brazilian, easy-to-pronounce animal name suitable for an open-source project, personal assistant product, and visual mascot.

### 2.8 Public source and private installation configuration

Public code/docs contain no actual keys, private installation URLs/IDs, account details, personal screenshots or operational release records. Exact evidence and configuration remain private outside Git. Public hosting uses a generic template; normal builds are identity-neutral and managed export requires explicit valid per-process `SITE_PROJECT_ID`. The Colab companion receives origin/project through hidden VM inputs and verifies bootstrap binding before HTTP. [ADR-0026](docs/decisions/ADR-0026-public-source-private-installation-configuration.md) records this separation. Forward-source cleanup does not rewrite prior Git history. [PRD.md](docs/PRD.md) connects current behavior and planned requirements without replacing this document or ROADMAP.

### 2.9 Telegram-first, simple setup

Accepted October 15, 2026 ([ADR-0027](docs/decisions/ADR-0027-free-agent-telegram-first.md)). The first user surface is a Telegram bot answering only allowlisted owner IDs, backed by the free serverless runtime; the web app/PWA handles settings and long results, and native store apps come later. Setup target: create a bot with @BotFather, one-click deploy, paste the bot token and optionally one key, in under five minutes without a terminal. Personal Colab becomes an advanced option.

### 2.10 No training on user data

A model, compute or tool route is eligible by default only when its current official terms state that inputs/outputs are not used for training, recorded with source URL and check date. Free routes that train, or whose policy is unknown, are excluded. A versioned Free Resource Radar tracks free models/compute/tools and their limits and data policies; its scheduled searcher may only propose changes, because web content is untrusted, and a route becomes eligible only through a reviewed registry change. Owners may add any provider or OpenAI-compatible endpoint with their own key and switch models in chat; Tatu never falls back to a paid route the owner did not add.

### 2.11 Bounded agent team

Accepted October 18, 2026 (user decision, extends [ADR-0027](docs/decisions/ADR-0027-free-agent-telegram-first.md)). After the single Telegram assistant works, the owner may create named agents with a role, instructions, own memory, allowed tools and routines (for example support, growth, community), plus one chief-of-staff agent that routes requests and hands work between agents with context. In Telegram they live as topics of one owner supergroup served by a single bot; separate bots per agent are an optional later setup. Every irreversible action (send, post, buy, delete, merge) still needs the owner's one-tap approval enforced in code, and every agent action is audited. Agent runs share the owner's free-route quotas, which are shown and stop honestly when exhausted. Code-changing agents (bug fix to pull request) are later work that requires an explicitly verified execution environment.

## 3. Origin and first real use case

The creator is the first user. The initial need is an agent that autonomously delivers recurring briefings, such as:

- Three important gaming stories every day.
- Daily AI developments.
- Stock-market and crypto news.

The latest founder request is an AI-news briefing every day at **09:00 in `America/Sao_Paulo`**, with NotebookLM Audio Overviews. Tatu's current handoff delivers and exports cited text for manual NotebookLM import; the user generates audio there. Automatic audio integration requires separate authorized adapter acceptance and Enterprise prerequisites; consumer access does not establish an automation API. Text delivery alone does not complete the user's audio goal.

The system should search, fetch, read, rank, summarize, remember relevant preferences, and deliver results without manual execution the following day.

Release reliability is demonstrated through reproducible online scheduled execution, restart/retry/duplicate behavior, provider outage and quota states, real-source delivery, authenticated owner boundaries, and mobile browser checks. The protocol and historical observations are recorded in [`docs/RELIABILITY-TRIAL.md`](docs/RELIABILITY-TRIAL.md).

Long-running observations may continue after release, but no elapsed-day pilot is a launch prerequisite. The historical trial has not been completed; removing its gate does not turn past failures into successes or prove 24/7 uptime.

## 4. Target users

### 4.1 Nontechnical user

Example request:

> Every day at 8 AM, send me the three most important AI news stories.

The system creates and explains the task, asks only for missing information, and handles the technical configuration.

### 4.2 Power user and developer

Advanced Mode provides control over:

- Agent instructions and planning.
- Model and provider routing.
- Memory.
- Tools, REST, webhooks, and plugins.
- Schedules and event triggers.
- API access.
- Executions and traces.
- Usage, quotas, latency, and fallbacks.
- OAuth connections, secrets, and permissions.

## 5. Product surfaces

### 5.1 Chat

The main natural-language interface for questions, commands, and task creation.

### 5.2 Tasks

View, create, edit, pause, resume, and inspect recurring or conditional automations.

### 5.3 Connections

Connect and manage services such as Gmail, Calendar, GitHub, and future device executors.

### 5.4 Setup Health

A simple operational view for beginners:

```text
Agent online               green
AI route available         green
Web research available     green
Memory online              green
Scheduler online           green
Estimated cost             R$0.00
Next task                  Tomorrow, 08:00
```

### 5.5 Advanced Mode

Technical configuration and diagnostics remain available without cluttering the default experience.

## 6. Agent engine

The agent engine receives goals and coordinates:

- Task analysis.
- Planning.
- Missing-information questions.
- Memory retrieval.
- Model selection.
- Tool selection.
- Permission checks.
- Execution.
- Result validation.
- Delivery.
- Trace recording.

The LLM should request normalized capabilities; integration-specific implementation must not be scattered through the core.

## 7. Memory system

Memory is a core subsystem but must be selective, transparent, and controllable.

Categories:

- Profile memory: stable preferences and relevant user profile.
- Instruction memory: persistent behavioral rules.
- Task memory: recurring, pending, and conditional automations.
- Knowledge memory: useful facts learned from authorized content.
- Execution memory: previous actions and outcomes.

Requirements:

- Do not treat the complete chat transcript as permanent memory.
- Store only information with a clear purpose.
- Let users inspect and delete stored memories.
- Attach source, time, scope, and confidence where relevant.
- Keep tenant/user data isolated.
- Never put passwords, CVVs, raw card numbers, or unnecessary sensitive checkout data in assistant memory, chat, logs, model input, or plaintext operational records. The only approved password-storage direction is a separate planned client-held-key private vault, not this memory system.

## 8. Automation engine

### 8.1 Initial scheduler

Natural-language requests become structured scheduled tasks. Advanced users may inspect or edit schedules directly.

### 8.2 Future event and condition engine

Later versions should support triggers such as:

- Bitcoin falls more than 5%.
- Important OpenAI news appears.
- An external webhook is received.

This evolves the scheduler into a general automation engine.

Every execution must be idempotent where appropriate, retryable, observable, and protected against duplicate delivery.

## 9. Web research

Pipeline:

```text
Search -> Fetch -> Read -> Rank -> Summarize -> Cite -> Remember if useful -> Deliver
```

The agent decides when fresh information is required. Stable facts should not automatically consume search resources; current news, prices, availability, laws, schedules, or explicitly requested research should use live sources.

Research results should preserve source links and distinguish sourced facts from agent inference.

The historical zero-cost route is a replaceable public HTTPS RSS adapter. The initial default for the daily AI briefing is the TechCrunch Artificial Intelligence feed; `TATU_RSS_FEEDS` can override or explicitly disable it in that runtime. ADR-0005 records this choice. Hosted research must retain citations and bounded network behavior through its own verified adapter; local RSS success does not establish a working cloud source.

## 10. Model Router

The Model Router answers:

> Which model class best fits this task?

Inputs may include:

- Task type and complexity.
- Expected quality.
- Tool-calling support.
- Vision or multimodal requirements.
- Context length.
- Latency.
- Structured-output reliability.
- Privacy constraints.
- Free availability and user preferences.

Simple tasks should not consume the strongest route unnecessarily. Programming, vision, long-context, and difficult reasoning may use specialized or stronger models.

The first shared suitability contract records only the capabilities a model adapter proves. Provider health, quota, rate limits, credentials, and fallback eligibility remain separate routing state; ADR-0006 records this boundary. ADR-0007 adds a process-local, observation-only provider-state port and implementation; ADR-0008 adds a deterministic capability-only Model Router. Neither decision persists state, calls providers, or selects a provider route.

## 11. Quota and Provider Router

The Quota/Provider Router answers:

> Which eligible route can execute now, preferably at zero cost?

It tracks availability, quotas, rate limits, health, latency, failures, and provider/model compatibility. ADR-0009 provides a deterministic, process-local eligibility selector that combines model capabilities with a healthy provider snapshot and non-exhausted limits. ADR-0010 accepts the existing local Ollama route plus deterministic RSS development path; ADR-0012 adds the bounded automatic fallback from a typed local-model failure to the already validated deterministic RSS result. General quota-based multi-provider fallback remains future work.

The routers are conceptually separate: model suitability is not the same decision as provider availability.

## 12. BYOK and optional premium power

Users may connect their own provider accounts, API keys, subscriptions, or compatible endpoints. Potential categories include hosted providers, routers, and local models.

Secrets must be encrypted at rest, redacted from logs, scoped to the owning user, and never exposed to the model unless a tool invocation strictly requires a derived credential mechanism.

ADR-0011 provides the historical local BYOK connection and encrypted-envelope foundation. It uses AES-256-GCM before handing records to a replaceable backing port and enforces owner-scoped, metadata-only listing; that process-local adapter is not cloud key management. The online beta now requires durable encrypted owner-scoped Groq keys in the D1-backed runtime. Bounded key/auth/redaction/current-previous rotation checks pass; real owner credential lifecycle remains open, while broader OAuth/KMS stays later work.

The current cloud implementation uses server envelope AES-256-GCM for operational provider keys: the runtime can decrypt them, so this is **not E2EE**. Conversation, note, and preference content is currently plaintext at the application layer in D1, despite platform storage encryption; selected assistant context is sent to the authorized AI provider. A separate planned user-key E2EE/zero-knowledge private vault holds passwords/private material with a key never sent to the server. This scoped vault supersedes the former blanket password ban only for that client-held boundary; passwords remain prohibited in the agent path. See [ADR-0024](docs/decisions/ADR-0024-mobile-cloud-security-and-agent-boundaries.md) and [the security architecture](docs/SECURITY-ARCHITECTURE.md) for current versus planned guarantees and the delegation tradeoff.

## 13. Universal capability and tool layer

```text
Agent
  -> Capability Registry
      -> Native tools
      -> REST APIs
      -> OAuth apps
      -> Webhooks
      -> Plugins
      -> Device executors
```

Tools require schemas, permission metadata, risk level, timeout, retry policy, audit behavior, and secret requirements.

## 14. OAuth and connected accounts

Preferred flow:

```text
Connect service -> Provider login -> Review scopes -> Authorize -> Token stored securely
```

Potential integrations include Gmail, Google Calendar, Google Drive, GitHub, Slack, Discord, Notion, and others.

The agent should never ask to store a service password when OAuth, passkey, or delegated tokens can solve the task.

The user's YouTube Premium/Play Store cancellation example is a desired future owner action, not a supported integration. Google Play's developer cancellation API requires app/developer permissions and a purchase token; it is not a general consumer subscription-control API. First use an authenticated user-assisted official subscription/settings handoff where no authorized personal API exists. An actual physical app action requires a separately accepted, visible, revocable native companion; a PWA must not claim Play Store automation. The researched boundaries and official sources are in [the security architecture](docs/SECURITY-ARCHITECTURE.md#account-actions-and-platform-boundaries).

## 15. Permission Engine and action risk

Permissions are capability-specific and user-configurable. The initial risk model is:

| Level | Category | Examples | Default behavior |
| --- | --- | --- | --- |
| 0 | Read | Search web, read authorized metrics, check weather | Automatic when permitted |
| 1 | Low risk | Open an app, create a reminder | Automatic only if previously authorized |
| 2 | External action | Send email, create meeting, publish content | Confirmation or explicit standing policy |
| 3 | Financial | Buy, subscribe, renew, pay | Fresh explicit confirmation and strong authorization |
| 4 | Critical | Delete account, change security, sensitive transfer | Strong confirmation; some actions may remain blocked |

Permission checks must happen in deterministic application code, not only in an LLM prompt.

An action proposal should show the target, effect, price when applicable, data shared, selected tool, and whether it can be reversed.

## 16. Commerce and payments — future capability

The long-term agent may research products, ask for missing requirements such as color and size, recommend options, and initiate checkout after explicit user approval.

Example:

```text
User goal -> Research -> Clarify constraints -> Present candidate and total
  -> Explicit confirmation -> External wallet/checkout authorization
  -> Merchant confirmation -> Receipt/trace
```

Security rules:

- Never store raw card number, CVV, banking password, or wallet password.
- Prefer merchant checkout plus tokenized/delegated wallets such as supported Google Pay, Apple Pay, or equivalent flows.
- The user authorizes payment in the trusted wallet/provider surface.
- The agent receives only the minimum status and receipt data required.
- Never assume a wallet permits arbitrary agent purchases; implementation must follow the current platform, merchant, legal, and payment-provider rules.
- Financial actions always require explicit confirmation; optional spending limits cannot eliminate required authorization unless a future legal and security design proves it safe.

This is a long-term direction, not MVP scope.

## 17. Device Agent — future capability

The same agent brain may eventually use local executors for desktop or mobile actions, for example opening YouTube or another app.

```text
Agent -> Permission Engine -> Device executor -> Operating-system action
```

Device control must be opt-in, locally scoped, visible, revocable, and auditable. Arbitrary remote control is not an MVP feature.

Native mobile/desktop packages may share the online backend, but their device permissions and execution must be separately verified. A native wrapper or installable PWA does not by itself provide app control. Device actions need a visible opt-in companion, exact scoped authorization, cancellation/revocation, and independent platform acceptance.

## 18. Plugin and tool ecosystem

A future registry may let developers publish integrations. Installation must include manifest validation, declared permissions, version pinning, provenance, sandboxing where feasible, and clear warnings for privileged tools.

## 19. Web, mobile, and runtime strategy

Deliver the website and installable mobile/desktop PWA against the same online backend first. Actual native mobile and desktop packages are required product direction with distinct build/install/authentication/privacy acceptance; the PWA must not be advertised as already shipped native apps. A device executor is another explicit opt-in capability, not a consequence of packaging.

Standard first-release runtime:

- HTTPS mobile-first PWA with an online Worker/API, authenticated owner-scoped D1, remote AI, and online Cron.
- Private founder beta on Sites managed auth/D1/MCP when available.
- Independent Cloudflare Workers/D1/Access configuration for portability.

Optional independent self-hosting may use the historical Node/SQLite/container path. Mobile users do not need to run it or download a model.

Native/mobile executors can be added later if required for device capabilities.

## 20. Deployment and onboarding

The initial mobile beta is an authenticated HTTPS deployment with an online API/worker, owner-scoped D1 records, remote inference, and online scheduling. The private Sites managed auth/D1/MCP beta is the first deployment lane. Portable Workers/D1/Access configuration is the second lane and is not live-verified until deployed and tested independently. Deployment identity and authorization are server-enforced, not inferred from a client-supplied owner ID.

Identity adapters map a verified issuer/subject to an internal owner ID. Moving between Sites or identity providers requires reauthentication and an explicit owner remap; raw Site user IDs must not be copied across Sites or treated as portable authorization.

Onboarding explains the active provider, available free allowance, optional encrypted Groq key, stored data, and manual external-AI redirects. A phone browser can use the HTTPS PWA without a local process or model. Missing credentials, unsupported scheduled execution, account eligibility, or unavailable hosting features must be identified honestly before publication.

Independent self-hosting remains optional. Unlimited free shared service, open public signups, billing, broad integrations, and a commercial convenience offering are not commitments of this private beta. Secrets stay encrypted and owner-scoped; the UI and logs expose only safe metadata. The earlier unauthenticated local API must not be exposed as the cloud backend.

## 21. API

Core capabilities should eventually be API-accessible, including:

- Agents.
- Messages.
- Tasks and triggers.
- Tools and connections.
- Executions and traces.
- Memory.
- Permissions.

The web app should use the same domain services as the public/local API rather than maintaining separate business logic.

## 22. Observability

Every autonomous run receives an execution ID and structured trace.

Useful events include:

- Task started and trigger source.
- Memory loaded.
- Plan created.
- Permission decision.
- Model and provider selected.
- Quota fallback.
- Tool requested, started, and completed.
- Sources processed.
- Output generated.
- Notification delivered.
- Error, retry, cancellation, or timeout.
- Tokens, latency, and estimated cost.

Secrets and unnecessarily sensitive tool payloads must be redacted. Beginner UI explains failures plainly; Advanced Mode exposes technical detail.

## 23. Security and privacy baseline

[ADR-0024](docs/decisions/ADR-0024-mobile-cloud-security-and-agent-boundaries.md) accepts the layered security and action boundaries. [SECURITY-ARCHITECTURE.md](docs/SECURITY-ARCHITECTURE.md) distinguishes current code, platform protection, and planned capabilities. No system is claimed 100% secure.

- No secrets committed to Git.
- `.env` and local secret files ignored by default.
- Encrypted secrets at rest.
- TLS for remote connections.
- Least-privilege OAuth scopes.
- Token revocation and connection removal.
- Per-user data isolation.
- Confirmation enforcement outside model prompts.
- Audit logs for external, financial, and critical actions.
- Input/output validation at tool boundaries.
- Dependency and secret scanning in CI.
- Protected main branch and reviewed pull requests.
- No untrusted pull-request workflow may access production secrets.
- Clear retention and deletion controls.
- Server-held operational API/OAuth tokens are envelope-encrypted with a runtime-only master key and owner/provider/version-bound authenticated data; this remains server-decryptable and is not E2EE.
- A separate client-held-key E2EE vault is planned with lock, recovery, export, and independent security tests. It cannot silently supply plaintext to an unattended cloud agent: every narrow delegation creates an explicit authorized plaintext/runtime boundary.
- Content sent to an AI/audio provider is outside the private E2EE boundary; deleting Tatu data does not erase provider-held copies.

## 24. Conceptual architecture

```text
User / PWA / API
        |
    Agent Engine
        |
  +-----+-------------------+
  |     |         |         |
Memory Planner Scheduler  Automation events
  +-----+---------+---------+
        |
Permission Engine
        |
Capability / Tool Registry
  +-----+--------+---------+----------+
  |              |         |          |
 Web             API      OAuth     Device (future)
        |
Model Router -> Quota/Provider Router -> Providers/local models
```

Cross-cutting concerns are authentication, secrets, security, privacy, observability, tenancy, reliability, and cost accounting.

## 25. MVP: the first useful vertical slice

The first mobile-first online release is a private founder beta with replaceable providers, server-enforced owner isolation, explicit controls, and no automatic paid service fallback. The user's October 12 correction supersedes the earlier local-only MVP and its ban on minimal hosted account isolation. Only evidence-backed individual roadmap items are verified: private QA publication, implementation/fixture checks, live negative guards, and live MCP read/proposal. No whole online stage is complete; positive web/mobile/AI/scheduling acceptance remains open.

### 25.1 Required outcome

A user can create this task in natural language:

> Every day at 8 AM, find the three most important AI stories and send them to me.

An authenticated phone user can converse through an available authorized remote AI route, manage saved context and tasks, and read cited briefings without a PC or local model. Online scheduling must execute confirmed tasks independently of the phone and produce an owner-scoped trace and result. If the deployment does not yet support scheduled execution or a live inference credential, the UI and release notes must state that gap; unavailable AI must never be replaced with a fabricated answer.

### 25.2 First online release scope

- Responsive Portuguese application with Chat, Tasks, Executions, notes/pages, memory controls, and a full cited briefing reader.
- Website and installable mobile/desktop PWA shell sharing the online backend; personal API responses are not cached, and offline actions are disabled with a clear explanation. Native packages remain separately verified later work.
- HTTPS mobile-first PWA and online API/worker, with authenticated identities and D1 records scoped to the server-verified owner.
- Private founder beta deployable through Sites managed auth/D1/MCP, plus independent Cloudflare Workers/D1/Access configuration.
- Remote general chat through replaceable adapters: sponsored compatible Workers AI when bound and available; optional official Groq BYOK with durable encrypted owner-scoped credentials.
- Optional owner-only Colab connection reuses the owner's already-loaded Qwen through explicit notebook execution, expiring encrypted pairing and bounded asynchronous inference. Version 3 is privately published with verified implementation/mock visuals/gateway guards; predecessor version 2 has owner-observed pairing/replies. Controlled current-revision owner inference/history/stop/active acceptance remains pending. The update adds distinct connection/response status, an explicitly authorized isolated public probe and next-turn history selection without deleting saved turns. Active mode requires declared eligible paid Colab/Google AI entitlement with positive Colab units. It does not supply unattended scheduling or a free hosted backend.
- Strict global/per-user caps and honest provider/quota/credential states; no paid fallback, account pooling, quota bypass, or consumer-session scraping.
- Explicit manual redirects to ChatGPT/Grok/Gemini when useful; consumer login is not API authorization and unpaid Gemini is not the default for personal context.
- Persistent conversations with explicit deletion, separate from preference memory.
- Explicit editable and deletable preferences and owner-scoped notes/pages; no automatic extraction of permanent memories from complete transcripts.
- Natural-language creation of time-based tasks.
- Task editing, pause, and resume, with deterministic validation and clear effect on future occurrences.
- Hosted Cron and durable online scheduling/delivery; an unsupported runtime capability remains an explicit gap.
- Founder daily 09:00 `America/Sao_Paulo` cited AI-news task with text export/manual NotebookLM import for user-generated Audio Overviews; no assumed consumer API or automatic Tatu audio generation.
- Existing public RSS research with citations and a full result reader; unrestricted web research is not implied.
- Provider adapter contract.
- Remote AI and an explicitly identified deterministic research result where appropriate; deterministic output is not a general conversation fallback.
- Basic model/provider selection and fallback.
- Owner-scoped in-app delivery and a persistent cited briefing reader; external push delivery is a separately verified option.
- Execution traces, retries, and visible errors.
- Authenticated cloud runtime/provider health and deployment instructions; no end-user local runtime or model download.
- Bounded authenticated remote MCP and a private plugin package using verified hosted tools. ChatGPT connectivity is claimed only after a supported live connection succeeds.
- Auth, owner-isolation, CSRF, key-redaction, and quota boundaries verified for every personal-data and tool route.
- Honest allowance, cost, model, and scheduler indicators; no unlimited-free, eligible-account, inference, or uptime claim without evidence.

### 25.3 Release acceptance gate

The release is gated by observable checks, not elapsed calendar days:

- A real deployed HTTPS URL works from a mobile browser using authenticated online services and owner-scoped storage, without a local runtime.
- Auth/cross-owner/CSRF/key-redaction/quota tests pass; untrusted text renders safely and deletion respects the verified owner.
- Remote inference is demonstrated only when authorized credentials/bindings are available; fixture responses and unavailable states are labeled honestly.
- An actual remote scheduled occurrence produces a real-source cited result without a manual trigger, or an explicit scheduler capability gap keeps that item unchecked and is disclosed before a limited beta publication.
- Repeated request/occurrence, transient failure, retry, dependency outage, and recovery checks preserve the intended persisted state without duplicate delivery.
- Conversation, memory, note, task-control, and reader flows work in the Portuguese mobile UI; unavailable AI and manual external redirects are clear.
- Authenticated remote MCP enforces schemas, owner boundaries, and bounded actions; private packaging is verified and ChatGPT connectivity requires separate live proof.
- Formatting, lint, typecheck, unit/integration tests, build, CI, and responsive browser/PWA smoke checks pass for the release revision.

[`ROADMAP.md`](ROADMAP.md) tracks evidence and open items. Optional independent self-hosting and the legacy container path retain separate verification. Neither fixtures, local smoke checks, a deployed page alone, nor accelerated tests establish live inference, scheduled execution, unlimited quotas, or continuous uptime.

### 25.4 Explicitly excluded from this release

- Payments and autonomous purchases.
- Device control.
- Marketplace.
- General multi-agent workflows beyond the bounded agent team in section 2.11.
- Dozens of integrations.
- Full event-condition engine.
- Open public signups, billing, and broad public multi-tenant SaaS operations beyond the private beta's required authentication and owner isolation.
- Advanced vector-memory system unless evidence proves it necessary.
- Automatic deployment to many clouds.
- Autonomous external messaging.
- Public plugin directory submission and unverified public ChatGPT connectivity.
- Native mobile/desktop package publication, physical app/device execution, and unrestricted connected-account actions before their separate acceptance.
- Unverified automatic NotebookLM audio generation without an authorized adapter and an E2EE claim for current chat/server-held credentials.

## 26. Proposed delivery roadmap

### Development operating model

The two project partners will develop primarily through Codex inside VS Code. Work is organized around sequential, verifiable project outcomes rather than permanently assigning subsystems or files to individual people.

The repository must contain a living execution checklist, initially in `ROADMAP.md`, with stages such as:

```text
[x] Stage 1 — Repository and development environment ready
[x] Stage 2 — Application starts locally
[x] Stage 3 — User can create a scheduled briefing
[x] Stage 4 — Worker executes the task after a restart
[x] Stage 5 — Research and cited briefing work end to end
[x] Stage 6 — Free routing and fallback work
[ ] Stage 7 — Cloud identity and owner-scoped storage
[ ] Stage 8 — Remote providers, encrypted keys, and quotas
[ ] Stage 9 — Mobile personal-assistant workspace
[ ] Stage 10 — Hosted scheduling and delivery
[ ] Stage 11 — Remote MCP and private publication
```

Each stage must define observable acceptance criteria and automated verification where possible. A stage is checked only after Codex runs the relevant tests, build, lint/type checks, and end-to-end validation and records evidence of success.

Both partners may ask Codex to continue from the next unchecked stage. Before changing code, Codex should read `PROJECT.md`, `ROADMAP.md`, the repository instructions, and the current Git state. At the end of a successful work session it should update the checklist and project documentation when decisions changed.

This goal-based model does not require fixed ownership such as “one partner owns frontend and the other backend.” During the initial founder-only development phase, both founding maintainers may commit and push verified work directly to `main`. Branches and pull requests are optional safety mechanisms for simultaneous overlapping work, risky experiments, automated review, or outside contributions—not a mandatory division of product ownership.

Coordination rules:

- The repository and its files are the shared source of truth, not separate chat histories.
- Neither partner should start an already in-progress stage without checking the remote branch and roadmap state.
- Each Codex session begins from updated remote state and produces small, understandable commits.
- `main` remains protected against deletion and force pushes; the two founders may bypass the pull-request requirement for direct verified pushes.
- If both partners work simultaneously on overlapping areas, they should use separate branches or worktrees, or coordinate sequential pushes to avoid avoidable conflicts.
- Codex must never mark a stage complete based only on code generation; verification is mandatory.
- Partially completed work remains unchecked and includes a short note describing the exact blocker or next action.
- Major architectural or product decisions update `PROJECT.md`; execution progress updates `ROADMAP.md`; technical decisions receive ADRs.

### Phase 0 — Foundation

- Choose project name.
- Create GitHub repository.
- Add README, MIT LICENSE, `.gitignore`, security policy, contribution guide, code of conduct, issue/PR templates, and architecture decision log.
- Protect `main` and enable security checks.
- Decide the initial stack through short technical spikes.
- Define the first end-to-end acceptance test.

### Phase 1 — Mobile-first online private beta (v0.1)

- Chat accepts the daily-news request.
- System persists a scheduled task.
- Authenticated online API and owner-scoped D1 store messages, preferences, notes, and tasks.
- Remote AI uses a legitimate available binding or optional encrypted authorized API key under strict caps.
- Hosted Cron wakes the worker at the correct time, or an explicit capability gap remains unchecked.
- Research pipeline obtains and ranks sources.
- One model produces a cited briefing.
- Result appears in-app and in one delivery channel.
- Execution trace explains the run.
- General remote chat, conversation deletion, explicit preference memory, and owner-scoped notes/pages work through verified domain services.
- Task pause/resume/edit and the full cited reader are available in the Portuguese interface.
- A deployed HTTPS URL, mobile/installable shell, authenticated remote MCP/private package, owner isolation, CSRF, key-redaction, quota, and runtime-health checks pass.
- Sites managed auth/D1/MCP may supply the founder beta; independent Workers/D1/Access configuration and optional historical self-hosting preserve portability.

### Phase 2 — Free routing and memory (v0.2)

- Provider adapter interface.
- Model capability metadata.
- Quota/health tracking and fallback.
- BYOK.
- Further preference-memory integration and provider routes beyond the verified online beta.
- Broader provider health and key-lifecycle controls.

### Phase 3 — Extensibility (v0.3)

- Stable tool schemas and permission metadata.
- Local/public API.

### Phase 4 — Connected accounts (v0.4)

- OAuth foundation and one typed owner action using official APIs/least privilege, or an explicit user-assisted official handoff where no compatible API exists.
- One high-value integration such as Google Calendar or Gmail.
- Deterministic permission enforcement and confirmations.

### Phase 5 — Ecosystem and events (v0.5+)

- Conditional/event triggers.
- Webhooks.
- Plugin/tool registry foundations.
- Additional zero-cost deployment targets.

### Long-term

- Device executors.
- Carefully designed commerce/payment initiation.
- More sophisticated workflows and optional multi-agent behavior.
- Possible hosted convenience product, without weakening the free self-hosted core.
- Native mobile/desktop packages sharing the online backend; optional visible/revocable device companion with independent permission acceptance.
- Client-held-key private password vault and separately authorized audio adapters, with explicit encryption/delegation and provider-data boundaries.

## 27. Accepted foundations and remaining decisions

Historical accepted ADRs and the published Node baseline establish:

- TypeScript npm workspaces with web, native Node HTTP API, worker, and shared packages; Node.js `>=24.11.0 <25` and npm `>=11.6.0 <12` (ADR-0001).
- The replaceable local SQLite adapter using `better-sqlite3`, with durable occurrences, leases, retries, and restart recovery; no Redis requirement (ADR-0002 and ADR-0003).
- One individual local/self-hosted installation per user, with optional Docker Compose packaging (ADR-0004 and ADR-0017).
- Public HTTPS RSS research, optional loopback-only Ollama synthesis, and an explicit deterministic RSS fallback (ADR-0005 through ADR-0012).
- Local cited Markdown delivery, bounded public execution projections, and Setup Health (ADR-0013 through ADR-0020).
- Idempotent manual test executions through the existing worker (ADR-0021).

Remaining decisions and unverified outcomes include:

1. Passing the revised online release protocol; historical local observations do not verify deployed cloud behavior.
2. Verifying cloud identity, owner-scoped D1 storage, encrypted optional Groq keys, strict quotas, and authorized remote inference.
3. Verifying the mobile workspace, hosted Cron/delivery, and truthful runtime/provider capability states.
4. Provider/key rotation and additional integrations beyond the first verified remote route.
5. Future search expansion and external push delivery channels.
6. Verifying authenticated remote MCP/private packaging and, separately, an account-supported ChatGPT connection. A package does not establish that live connection.

The mobile-first online beta and its reproducible acceptance checks are the immediate priority. No 30-day wait, end-user PC, Ollama, or model download is required. Open-source support applications use truthful public release, maintenance, and adoption evidence; personal development subscriptions are not an operating dependency of Tatu.

## 28. First acceptance test

The historical local briefing milestone used the checks below. These records remain useful for the optional legacy runtime; the current online beta must pass section 25.3 instead.

1. A clean machine can start the project using documented steps.
2. The user types a daily briefing request.
3. The system shows the parsed schedule and asks for confirmation if ambiguous.
4. The task survives an application restart.
5. The worker runs at the configured time exactly once.
6. Live sources are fetched and ranked.
7. The explicitly identified deterministic RSS route or an available local model produces a cited briefing; model unavailability is represented honestly.
8. The user receives the result through the selected channel.
9. The execution page shows steps, provider route, fallbacks, latency, errors, and estimated cost.
10. No secret appears in source control or logs.

This original local scheduled-briefing test does not verify the online assistant, authentication, D1, remote inference, hosted Cron, or remote MCP.

## 29. Success criteria

- The creator can use the verified online assistant from a phone without a local runtime and understand its hosting/provider limits; longer-term observations improve later releases without blocking this launch.
- The normal operating path remains R$0 for creator and user.
- Another authorized user can use the authenticated mobile beta, and an independent maintainer can deploy the portable configuration.
- Nontechnical users can create reliable automations in natural language.
- Free-provider failures fall back cleanly.
- Users can understand why an action happened or failed.
- Developers can extend the agent through documented adapters and APIs.
- GitHub adoption comes from real utility rather than feature count.

## 30. Decisions versus possibilities

Decided:

- Project name: Tatu.
- Free-first, zero-cost architecture.
- Open source under MIT.
- PWA before native apps.
- Provider-agnostic and self-hostable.
- Optional BYOK/premium power.
- Explicit permissions and risk-based confirmation.
- No passwords/raw payment credentials in the agent path; password storage is scoped only to the separately planned client-held-key private vault.
- Mobile-first online runtime, authenticated owner-scoped storage, legitimate capped remote AI, hosted scheduling, and private remote MCP; preserve historical local foundations as an optional independent path.

Future possibilities, not current commitments:

- A separately branded low-cost hosted SaaS.
- Cloud sponsorship or partnerships.
- Payment initiation through supported wallets.
- General device control.
- Plugin marketplace.
- Multi-agent workflows beyond the bounded agent team in section 2.11.

## 31. Source-of-truth rule

This file is the portable, detailed source of truth for the project. Product principles, architectural decisions, scope changes, roadmap changes, and important unresolved questions must be reflected here.

Concrete technical decisions should also receive short Architecture Decision Records in the repository so alternatives and reasoning are not lost.

The Git-versioned [`brain/`](brain/README.md) directory provides an Obsidian-compatible navigation and continuity layer. It summarizes current state, learnings, and open questions but never overrides this file, `ROADMAP.md`, accepted ADRs, code, or tests.

When moving to another conversation, provide this file and continue from its latest version rather than reconstructing the project from memory.
