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
