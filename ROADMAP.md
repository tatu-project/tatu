# Tatu Roadmap

> Current status: Stage 1 — repository foundation
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

Next action: Stage 1 is complete. Do not begin Stage 2 until explicitly directed.

## Stage 2 — Technical foundation

Outcome: a clean development environment starts the initial Tatu application and runs all checks.

- [ ] Create ADR-0001 for the initial stack.
- [ ] Confirm the supported Node.js version and package manager.
- [ ] Create the TypeScript monorepo structure.
- [ ] Add web application, API/worker, and shared packages.
- [ ] Add formatting, lint, typecheck, tests, and build scripts.
- [ ] Add `.env.example` with no real credentials.
- [ ] Add CI workflow with required checks.
- [ ] Document one-command local development setup.
- [ ] Render a basic Tatu health page locally.

Acceptance test:

- A clean clone installs dependencies and starts locally using documented commands.
- Formatting, lint, typecheck, tests, and build all pass.
- CI runs the same checks on a pull request.

## Stage 3 — Create and persist a scheduled briefing

Outcome: the user can request a recurring briefing and see a persisted task.

- [ ] Chat accepts a natural-language briefing request.
- [ ] Schedule, timezone, topic, quantity, and delivery intent are parsed.
- [ ] Ambiguous requests trigger a clarification or confirmation.
- [ ] Confirmed task is persisted.
- [ ] Task appears in the Tasks interface.
- [ ] Task survives an application restart.
- [ ] Parsing and persistence tests pass.

Acceptance test:

> “Todos os dias às 8h, encontre as três notícias mais importantes sobre inteligência artificial e me envie.”

creates one visible, enabled, persistent daily task in the user's timezone.

## Stage 4 — Durable execution engine

Outcome: a persisted task executes exactly once at the configured time, including after restart.

- [ ] Database-backed scheduler implemented without paid infrastructure.
- [ ] Worker claims jobs safely.
- [ ] Duplicate execution prevention implemented.
- [ ] Retry, timeout, and failure state implemented.
- [ ] Execution history persisted.
- [ ] Restart recovery tested.

Acceptance test:

- A scheduled job survives restart and executes once, with a trace and final status.

## Stage 5 — Web research and cited briefing

Outcome: an execution researches live sources and generates a useful cited briefing.

- [ ] Search adapter contract defined.
- [ ] First zero-cost search route implemented.
- [ ] Fetch/read pipeline implemented.
- [ ] Ranking and deduplication implemented.
- [ ] Model adapter contract defined.
- [ ] First free or user-supplied model route implemented.
- [ ] Briefing includes source links and separates facts from inference.
- [ ] Research failures are visible in the trace.

Acceptance test:

- The daily AI task produces three current, non-duplicated, cited stories.

## Stage 6 — Free routing, fallback, and BYOK

Outcome: Tatu selects an eligible model route and falls back without losing the task.

- [ ] Model capability metadata implemented.
- [ ] Provider health, quota, and rate-limit state implemented.
- [ ] Model Router implemented.
- [ ] Quota/Provider Router implemented separately.
- [ ] At least two eligible routes or one real route plus deterministic development fallback.
- [ ] BYOK connection and encrypted secret storage implemented.
- [ ] Fallback behavior tested.

Acceptance test:

- When the preferred route is unavailable, the execution continues through another eligible route and records the fallback.

## Stage 7 — Delivery, observability, and 30-day trial

Outcome: the creator receives briefings automatically and can understand every run.

- [ ] One free delivery channel implemented.
- [ ] Execution timeline visible.
- [ ] Provider, model, tools, latency, fallback, and estimated cost visible.
- [ ] Secrets and sensitive payloads redacted.
- [ ] Setup Health page visible.
- [ ] Docker Compose reference deployment added when the service boundaries are stable.
- [ ] Guided zero-cost deployment path documented.
- [ ] Creator begins the 30-day reliability trial.

Acceptance test:

- Tatu delivers the briefing automatically on the following day and exposes a complete, safe trace.

## Later roadmap

- OAuth and first connected account.
- Conditional/event automations.
- Plugin/tool ecosystem.
- Device executor.
- Payment initiation with external wallet authorization.
- Optional hosted convenience product.

These items do not enter the MVP unless `PROJECT.md` is explicitly updated.
