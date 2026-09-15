# ADR-0003: Local durable scheduler

- Status: accepted
- Date: 2026-09-08

Use SQLite occurrence keys, conditional lease claims, immutable events, a 30-second lease and up to three attempts. The placeholder executor has no external effects. This gives effectively-once completion for a claimed local occurrence, not distributed exactly-once delivery. Every future external adapter receives the occurrence key as its idempotency key and must propagate it when the provider supports idempotency.

SQLite uses WAL mode, a five-second busy timeout, and three bounded exponential retries around every state transition. A temporary `SQLITE_BUSY` therefore leaves the occurrence unchanged for a later poll rather than recording a false failure. The worker never holds a transaction while executing work.

The execution deadline is cooperative: Tatu aborts the supplied `AbortSignal` and records timeout/retry or final failure, but synchronous or non-cooperative code cannot be force-stopped in the same Node.js process. Future external adapters must honor the signal and idempotency key; isolated worker processes are a later hard-cancellation option.

DST uses the timezone's local date/time occurrence key. Repeated local times execute once; a nonexistent spring-forward local time is recorded as `skipped_dst_gap` and is not executed late. Restart recovery examines only the preceding 36 hours. Execution events are immutable and exposed in insertion order through `GET /api/executions/:id/events`.
