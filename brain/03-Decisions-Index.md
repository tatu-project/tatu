---
title: Decisions Index
tags:
  - tatu
  - decisions
updated: 2026-09-15
---

# Decisions Index

Individual technical decisions are authoritative only when recorded under [`docs/decisions/`](../docs/decisions/).

## Accepted ADRs

- [ADR-0001: Initial technical foundation](../docs/decisions/ADR-0001-initial-stack.md) — accepted September 2, 2026; selects the dependency-free Stage 2 foundation.
- [ADR-0002: Local task persistence](../docs/decisions/ADR-0002-local-task-persistence.md) — accepted September 2, 2026; narrowly supersedes ADR-0001's runtime restriction and approves `better-sqlite3` as the sole production dependency.
- [ADR-0003: Local durable scheduler](../docs/decisions/ADR-0003-local-durable-scheduler.md) — accepted September 8, 2026; keeps SQLite as a replaceable local adapter and records durable scheduling semantics.
- [ADR-0004: Individual local deployment](../docs/decisions/ADR-0004-individual-local-deployment.md) — accepted September 15, 2026; selects one local/self-hosted installation per user for the first deployment.

Use [[templates/Decision]] as a drafting aid, then place accepted records in `docs/decisions/` using the repository's sequential naming convention.

Related: [[06-Open-Questions]].
