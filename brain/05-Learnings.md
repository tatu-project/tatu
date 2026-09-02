---
title: Learnings
tags:
  - tatu
  - learnings
updated: 2026-09-02
---

# Learnings

## 2026-09-02 — Repository publication

- Founder direct pushes can use the configured `main` ruleset bypass while pull requests remain required for other contributors.
- Verification notes must distinguish evidence from one workstation from checks requiring both founders.

## 2026-09-02 — Codex team configuration

- Project-scoped custom agents live under `.codex/agents/` and are shared through Git.
- Agent files can pin subagent model, reasoning effort, and sandbox mode without pinning the primary orchestrator model.
- A running Codex session may not reload newly added custom-agent files; discovery must be tested after restart.

Add only durable discoveries that will change future execution or decisions. Do not copy session transcripts here.
