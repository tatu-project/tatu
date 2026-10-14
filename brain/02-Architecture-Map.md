---
title: Architecture Map
tags:
  - tatu
  - architecture
updated: 2026-10-13
---

# Architecture Map

Current runtime:

```text
Portuguese web/PWA or authenticated MCP client
  -> Fetch Worker identity/ownership/quotas/domain services
  -> D1 workspace/provider/task/result/Colab records
  -> replaceable Workers AI/Groq or personal Colab adapter
  -> curated RSS and durable scheduling/result pipeline
```

Managed Sites is the verified private lane; independent Workers/D1/Access/Cron
is configured but not live-verified. Legacy Node/SQLite remains optional developer/
self-host behavior, not the mobile backend. Native packages/device/account actions
and a client-key private vault remain planned. Model suitability and provider
availability are separate; broad autonomous planning is not proven by a task parser.

Public source uses a generic template. Private identity/credentials are operator
configuration, not defaults or public notes. Colab metadata is supplied through
hidden VM prompts. Code/fixture proof is separate from actual model pairing,
browser CRUD, active behavior and scheduled delivery.

Full map: [PRD.md](../docs/PRD.md). Scope: [PROJECT.md](../PROJECT.md).
Decisions: [[03-Decisions-Index]]. Status: [[04-Current-State]].
