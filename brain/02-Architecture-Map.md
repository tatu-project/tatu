---
title: Architecture Map
tags:
  - tatu
  - architecture
updated: 2026-09-02
---

# Architecture Map

The conceptual flow is:

```text
User / PWA / API
  -> Agent Engine
  -> Memory, planning, scheduling, and automation
  -> Permission Engine
  -> Capability / Tool Registry
  -> Web/API, OAuth, and future device adapters
  -> Model Router
  -> Quota / Provider Router
  -> Replaceable providers or local models
```

Cross-cutting constraints are security, privacy, observability, reliability, tenancy boundaries, and cost accounting. Model suitability and provider availability remain separate decisions. Redis and paid infrastructure are not assumed for v0.1.

No initial application stack has been accepted yet. Consult [`PROJECT.md`](../PROJECT.md) for the full conceptual architecture and [[03-Decisions-Index]] for accepted technical decisions.
