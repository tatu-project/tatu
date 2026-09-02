# Tatu — Project Source of Truth

> Status: pre-development / architecture and MVP definition
> Project name: Tatu (decided)
> License: MIT (decided)
> Project start: August 26, 2026
> Last updated: September 2, 2026

## 1. Executive summary

Build a free-first, open-source personal AI agent that can remain active 24/7, remember useful context, research the web, run recurring or conditional tasks, connect to external services, and safely take actions on the user's behalf.

It must be simple enough for a nontechnical person and extensible enough for developers.

The product promise is:

> Your free personal AI agent that works for you 24/7.

The product philosophy is:

> Free isn't a tier. It's the architecture.

The user describes an outcome in natural language. The system plans the work, selects available models and tools, executes it within explicit permissions, records a trace, and delivers the result.

## 2. Non-negotiable principles

### 2.1 Zero-cost architecture

The standard path must cost R$0 to the project creator and R$0 to the user whenever technically possible.

Priority order:

1. R$0.
2. Reliable.
3. Easy.
4. Few steps.

If a reliable setup requires seven free steps instead of three paid steps, the project chooses the free path and then improves the onboarding.

The project must not create infrastructure costs that grow proportionally with public adoption. Default deployment should use the user's machine, homelab, account, or free infrastructure allocation. A future sponsored or hosted option may exist, but the open-source product cannot depend on it.

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

Users may voluntarily connect API keys, subscriptions, paid models, or paid infrastructure for more intelligence, speed, context, quota, or convenience. Payment is an optional enhancement, never the requirement for the normal product path.

### 2.3 Beginner-simple, developer-powerful

The beginner sees Chat, Tasks, Connections, and clear health/status information. They should not need to understand LLMs, MCP, APIs, OAuth scopes, cron, context windows, vector databases, tool calling, Docker, or cloud infrastructure.

Advanced Mode may expose prompts, models, provider routing, quota, tools, MCP, memory, schedules, API, webhooks, logs, traces, tokens, permissions, secrets, and runtime details.

### 2.4 Provider-agnostic and portable

Model providers, search services, notification channels, storage, and hosting targets must sit behind interfaces. The core must be runnable in containers and avoid permanent coupling to one cloud or provider.

### 2.5 Safe autonomy

The agent may act only within explicit, inspectable permissions. Sensitive actions require confirmation appropriate to their risk. The system must prefer delegated authorization, OAuth, passkeys, and tokenized payment flows over passwords or raw financial credentials.

### 2.6 Open source and permissive adoption

The project will use the MIT License. People and companies may use, modify, redistribute, host, and commercialize the code subject to the license notice and the independent licenses or terms of dependencies, providers, models, and integrations.

Open source does not grant write access to the official repository. Contributions enter through forks and pull requests reviewed by maintainers. The main branch should be protected against direct pushes, force pushes, and deletion, with automated checks before merge.

### 2.7 Project identity

The official project name is **Tatu**: a short, Brazilian, easy-to-pronounce animal name suitable for an open-source project, personal assistant product, and visual mascot.

## 3. Origin and first real use case

The creator is the first user. The initial need is an agent that autonomously delivers recurring briefings, such as:

- Three important gaming stories every day.
- Daily AI developments.
- Stock-market and crypto news.
- Eventually, a daily business briefing from Up Digital.

The system should search, fetch, read, rank, summarize, remember relevant preferences, and deliver results without manual execution the following day.

The first major reliability test is:

> Keep one personally useful agent running for 30 consecutive days.

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
- Tools, MCP, REST, webhooks, and plugins.
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

Connect and manage services such as Gmail, Calendar, GitHub, MCP servers, and future device executors.

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
- Never store passwords, CVVs, raw card numbers, or unnecessary sensitive checkout data.

## 8. Automation engine

### 8.1 Initial scheduler

Natural-language requests become structured scheduled tasks. Advanced users may inspect or edit schedules directly.

### 8.2 Future event and condition engine

Later versions should support triggers such as:

- Bitcoin falls more than 5%.
- Important OpenAI news appears.
- A new Up Digital business condition is detected.
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

## 11. Quota and Provider Router

The Quota/Provider Router answers:

> Which eligible route can execute now, preferably at zero cost?

It tracks availability, quotas, rate limits, health, latency, failures, and provider/model compatibility. It performs automatic fallback without losing the execution context.

The routers are conceptually separate: model suitability is not the same decision as provider availability.

## 12. BYOK and optional premium power

Users may connect their own provider accounts, API keys, subscriptions, or compatible endpoints. Potential categories include hosted providers, routers, and local models.

Secrets must be encrypted at rest, redacted from logs, scoped to the owning user, and never exposed to the model unless a tool invocation strictly requires a derived credential mechanism.

## 13. Universal capability and tool layer

```text
Agent
  -> Capability Registry
      -> Native tools
      -> MCP
      -> REST APIs
      -> OAuth apps
      -> Webhooks
      -> Plugins
      -> Device executors
```

Tools require schemas, permission metadata, risk level, timeout, retry policy, audit behavior, and secret requirements.

## 14. MCP

MCP is a first-class integration mechanism.

Advanced flow:

```text
Settings -> Connections -> Add MCP server -> Discover tools -> Review permissions -> Enable
```

The project should eventually provide an Up Digital MCP integration. An authorized client could request a daily briefing of business metrics, conversations, funnel activity, sales opportunities, and other permitted information without exposing raw credentials to the agent.

## 15. OAuth and connected accounts

Preferred flow:

```text
Connect service -> Provider login -> Review scopes -> Authorize -> Token stored securely
```

Potential integrations include Gmail, Google Calendar, Google Drive, GitHub, Slack, Discord, Notion, and others.

The agent should never ask to store a service password when OAuth, passkey, or delegated tokens can solve the task.

## 16. Permission Engine and action risk

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

## 17. Commerce and payments — future capability

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

## 18. Device Agent — future capability

The same agent brain may eventually use local executors for desktop or mobile actions, for example opening YouTube or another app.

```text
Agent -> Permission Engine -> Device executor -> Operating-system action
```

Device control must be opt-in, locally scoped, visible, revocable, and auditable. Arbitrary remote control is not an MVP feature.

## 19. Plugin and tool ecosystem

A future registry may let developers publish integrations. Installation must include manifest validation, declared permissions, version pinning, provenance, sandboxing where feasible, and clear warnings for privileged tools.

## 20. Web, mobile, and runtime strategy

Start with a responsive web application and installable PWA rather than separate native iOS and Android codebases.

Target runtimes:

- User's computer.
- Homelab or personal server.
- Docker-compatible VPS/cloud.
- Free compute when available.

Native/mobile executors can be added later if required for device capabilities.

## 21. Deployment and onboarding

Initial deployment methods should include:

1. Docker Compose for self-hosters.
2. A guided local setup.
3. At least one documented zero-cost deployment path using the user's own account.

Long-term onboarding may detect available free options and guide the user through account creation, authorization, deployment, provider setup, and health verification.

The architecture may later support hosted service, sponsored infrastructure, or a separate commercial convenience offering. None is currently an official product direction or dependency.

## 22. API

Core capabilities should eventually be API-accessible, including:

- Agents.
- Messages.
- Tasks and triggers.
- Tools and connections.
- Executions and traces.
- Memory.
- Permissions.

The web app should use the same domain services as the public/local API rather than maintaining separate business logic.

## 23. Observability

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

## 24. Security and privacy baseline

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

## 25. Conceptual architecture

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
 Web           MCP/API    OAuth     Device (future)
        |
Model Router -> Quota/Provider Router -> Providers/local models
```

Cross-cutting concerns are authentication, secrets, security, privacy, observability, tenancy, reliability, and cost accounting.

## 26. MVP: the first useful vertical slice

The MVP is deliberately narrower than the complete vision.

### 26.1 Required outcome

A user can create this task in natural language:

> Every day at 8 AM, find the three most important AI stories and send them to me.

The agent executes it the following day without user intervention, uses a free available model route, cites sources, records a trace, and delivers the briefing.

### 26.2 MVP scope

- Responsive PWA with Chat, Tasks, and Executions.
- One personal agent per installation/user.
- Natural-language creation of time-based tasks.
- Persistent scheduler.
- Web search/fetch with citations.
- Small, explicit preference memory.
- Provider adapter contract.
- At least two compatible AI routes or one route plus a local/mock fallback for development.
- Basic model/provider selection and fallback.
- One free notification/delivery channel.
- Execution traces, retries, and visible errors.
- Docker Compose and guided local installation.
- Basic authentication appropriate to chosen deployment mode.
- Cost indicator with a zero-cost target.

### 26.3 Explicitly excluded from MVP

- Payments and autonomous purchases.
- Device control.
- Marketplace.
- General multi-agent workflows.
- Dozens of integrations.
- Full event-condition engine.
- Hosted multi-tenant public SaaS.
- Advanced vector-memory system unless evidence proves it necessary.
- Automatic deployment to many clouds.

## 27. Proposed delivery roadmap

### Development operating model

The two project partners will develop primarily through Codex inside VS Code. Work is organized around sequential, verifiable project outcomes rather than permanently assigning subsystems or files to individual people.

The repository must contain a living execution checklist, initially in `ROADMAP.md`, with stages such as:

```text
[ ] Stage 1 — Repository and development environment ready
[ ] Stage 2 — Application starts locally
[ ] Stage 3 — User can create a scheduled briefing
[ ] Stage 4 — Worker executes the task after a restart
[ ] Stage 5 — Research and cited briefing work end to end
[ ] Stage 6 — Free routing and fallback work
[ ] Stage 7 — Delivery, trace, and zero-cost health are visible
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

### Phase 1 — Local vertical slice (v0.1)

- Chat accepts the daily-news request.
- System persists a scheduled task.
- Worker wakes at the correct time.
- Research pipeline obtains and ranks sources.
- One model produces a cited briefing.
- Result appears in-app and in one delivery channel.
- Execution trace explains the run.
- Docker Compose starts the full local system.

### Phase 2 — Free routing and memory (v0.2)

- Provider adapter interface.
- Model capability metadata.
- Quota/health tracking and fallback.
- BYOK.
- Explicit preference memory and memory controls.
- Setup Health view.

### Phase 3 — Extensibility (v0.3)

- MCP client integration.
- Stable tool schemas and permission metadata.
- Local/public API.
- Up Digital MCP proof of concept for authorized daily business briefing.

### Phase 4 — Connected accounts (v0.4)

- OAuth foundation.
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

## 28. Immediate technical decisions still required

Before implementation, decide and record ADRs for:

1. Repository owner/organization and final GitHub handle availability for Tatu.
2. Primary language and monorepo structure.
3. Web framework and API framework.
4. Local-first database and migration strategy.
5. Scheduler/queue implementation that works without paid infrastructure.
6. First model/provider adapters and development mock.
7. Web search approach and first free route.
8. First delivery/notification channel.
9. Authentication for local and remote deployment.
10. Secret encryption and key ownership.
11. Initial zero-cost deployment target.

Current recommendation to validate, not yet a final decision:

- TypeScript end to end.
- Monorepo with web app, API/worker, and shared packages.
- Responsive PWA.
- SQLite for the first single-user/local installation, with a clean repository layer and a planned PostgreSQL path for hosted/multi-user deployments.
- Durable database-backed jobs without requiring Redis for v0.1.
- Docker Compose as the reference runtime.
- Provider, search, delivery, and tool adapters defined as interfaces from day one.

## 29. First acceptance test

The first development milestone is complete only when:

1. A clean machine can start the project using documented steps.
2. The user types a daily briefing request.
3. The system shows the parsed schedule and asks for confirmation if ambiguous.
4. The task survives an application restart.
5. The worker runs at the configured time exactly once.
6. Live sources are fetched and ranked.
7. A free or user-supplied model produces a cited briefing.
8. The user receives the result through the selected channel.
9. The execution page shows steps, provider route, fallbacks, latency, errors, and estimated cost.
10. No secret appears in source control or logs.

## 30. Success criteria

- The creator depends on it for 30 consecutive days.
- The normal operating path remains R$0 for creator and user.
- Another person can deploy it without deep infrastructure knowledge.
- Nontechnical users can create reliable automations in natural language.
- Free-provider failures fall back cleanly.
- Users can understand why an action happened or failed.
- Developers can extend the agent through documented adapters, MCP, and APIs.
- GitHub adoption comes from real utility rather than feature count.

## 31. Decisions versus possibilities

Decided:

- Project name: Tatu.
- Free-first, zero-cost architecture.
- Open source under MIT.
- PWA before native apps.
- Provider-agnostic and self-hostable.
- Optional BYOK/premium power.
- MCP as a first-class mechanism.
- Explicit permissions and risk-based confirmation.
- No password/raw payment credential storage.
- Narrow daily-briefing vertical slice first.

Future possibilities, not current commitments:

- A separately branded low-cost hosted SaaS.
- Cloud sponsorship or partnerships.
- Payment initiation through supported wallets.
- General device control.
- Plugin marketplace.
- Multi-agent workflows.

## 32. Source-of-truth rule

This file is the portable, detailed source of truth for the project. Product principles, architectural decisions, scope changes, roadmap changes, and important unresolved questions must be reflected here.

Concrete technical decisions should also receive short Architecture Decision Records in the repository so alternatives and reasoning are not lost.

When moving to another conversation, provide this file and continue from its latest version rather than reconstructing the project from memory.
