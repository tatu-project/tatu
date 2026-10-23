---
title: Current State
tags:
  - tatu
  - current-state
updated: 2026-10-15
---

# Current State

- October 15 direction reset ([ADR-0027](../docs/decisions/ADR-0027-free-agent-telegram-first.md)):
  Telegram-first free agent, no training on user data, Free Resource Radar,
  BYOK/in-chat model selection, tools with approvals; Colab is advanced.
  Stage 12 Telegram bot is live on a dedicated free Cloudflare account (Oct 23):
  real Workers AI replies, memory and model switch verified from the owner's
  phone; auto-deploy from `main` after CI is configured. Stage 16 is accepted scope.
- Private version 3 is published at the existing owner-only installation,
  preserving three migrations/15 D1 tables, existing secrets and zero automations.
  Sixteen live access/readiness checks pass; direct-origin/positive owner-browser
  tests have explicit gaps. Historical v2 had two 22-case gateway phases; native
  task listing remains verified. October 14 owner reports show Qwen loaded,
  pairing and real Tatu replies on version 2; this is attributed use, not a
  controlled current-revision probe or full browser/mobile/PWA acceptance.
- Historical v2 release proof is 205 tests/static review/audit0. October 13
  public-source format/lint/types/210 tests/build and companion13/original8 pass.
  [47bfc1e](https://github.com/tatu-project/tatu/commit/47bfc1e7de4e44a4bf9b074618df0d921db48b1b)
  is public; [CI38500459769](https://github.com/tatu-project/tatu/actions/runs/38500459769)
  passed Windows/Linux for that revision. Four user `.codex` edits stay excluded.
- Final connection/history format/lint/types/226 tests/build and Python13+8 pass;
  private handoff checks pass separately. Built-browser desktop/mobile fixtures
  verify no overflow, correct mode visibility/isolated POST/response distinctions,
  expiry and bounded cancellation. These are mocked visuals, not Google inference.
  Public [78f5c2b](https://github.com/tatu-project/tatu/commit/78f5c2bf2816e12879cf41fa5732e54c33290dd9)/
  [CI38567151349](https://github.com/tatu-project/tatu/actions/runs/38567151349)
  passed Windows/Linux; current publication has no blocker. No whole stage is complete.
- Implemented connection steps, aligned consents, collapsed ciphertext,
  monitor/countdown and explicit public arithmetic probe separate pairing from
  receipt/model/time/correctness. The probe saves a separate conversation and
  uses normal quota, without history/notes/memories; controlled live proof is open.
- Next-turn history defaults on and can be excluded without deleting saved turns.
  The counter is notes/memories only. Colab preserves mandatory context and trims
  old complete pairs within 12 messages/byte/token bounds. Repeated refusal may
  be conversational carryover; a static guardrail defect is not proven.
- Standard path: Portuguese online app, owner D1 data and replaceable providers;
  no mandatory PC/Ollama. Optional Colab adapter reuses loaded Google-VM Qwen,
  encrypted pairing and bounded jobs. Exact context is reviewed in Tatu; manual
  notebook confirmation uses PROCESSAR without private outputs. OpenRouter is cancelled.
- Eligible paid entitlement/positive Colab units were observed, not guaranteed.
  Live stop/revoke/active checks remain open. Owner-observed v2 replies do not
  establish guardrail quality, an agent benchmark or continuous availability.
- HTTP dispatch requires independent SYSTEM_RUN_TOKEN; platform bypass grants
  no owner or dispatch authority. No native scheduling bridge/due occurrence is
  verified; managed scheduling stays off. Portable deployment is a separate open lane.
- Server-decryptable operational encryption is not E2EE; assistant records are
  application-plaintext and selected context leaves for providers/Google VM.
  Expiry denies access, but physical cleanup depends on later configured
  access/revoke/delete/retention; no timed erase/Python zeroization promise.
- Daily 09:00 São Paulo AI news with NotebookLM Audio Overviews remains the goal:
  current handoff exports cited text for manual import/user audio generation;
  automatic audio/native/account actions/client-key vault are later unchecked work.
- Public docs/code use generic configuration: no private origins/IDs/accounts,
  keys/screenshots/operational records. Export identity is explicit per process;
  companion origin/project is entered in hidden VM prompts. Exact evidence stays
  private outside Git; previous Git history has not been rewritten.

Next: refresh the app and re-pair only if expired; keep a loaded Google model
and verify the isolated public probe/history-off turn with authorized owner
compute. Then prove full browser/mobile/PWA, stop/active and actual scheduled
delivery. Historical source/CI and owner use are separate from those gates.

Scope: [PROJECT.md](../PROJECT.md). Progress: [ROADMAP.md](../ROADMAP.md).
Current specification: [PRD.md](../docs/PRD.md). Operations: [DEPLOYMENT.md](../docs/DEPLOYMENT.md).
Decisions: [[03-Decisions-Index]]. Questions: [[06-Open-Questions]].
Security: [SECURITY-ARCHITECTURE.md](../docs/SECURITY-ARCHITECTURE.md).
Technical history: [[07-Session-Log]]; no private installation records here.
