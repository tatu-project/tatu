# ADR-0021: Manual test execution

- Status: accepted
- Date: 2026-09-16

## Context

The first local workflow proves scheduled executions, but waiting for the
configured time is slow when a creator needs to verify a task or troubleshoot
delivery. A manual run must not consume or alter the scheduled occurrence. It
also needs to remain safe when a client retries the request after a timeout.

## Decision

Expose `POST /api/tasks/:taskId/test` for an existing task. The endpoint
requires a bounded, non-empty `Idempotency-Key` header and derives a hashed
manual occurrence key from the task ID and that header. The raw request key is
never stored or returned.

The database-independent `ExecutionStore.enqueueManualExecution` port queues a
pending execution with the task's own topic and quantity. The local SQLite
adapter inserts the execution and its `queued` event in one transaction and
returns the existing row when the occurrence key is repeated. The existing
worker scheduler consumes that row through the normal execution, retry,
delivery, and trace pipeline.

## Alternatives considered

- Execute the task synchronously in the API: rejected because it would bypass
  the worker lease, retry, timeout, and restart behavior.
- Reuse the next scheduled occurrence: rejected because a manual check could
  consume or duplicate the user's scheduled run.
- Generate a new occurrence for every request: rejected because client retries
  could create duplicate work and delivery.

## Consequences

Creators can verify a confirmed task immediately while retaining the same
replaceable persistence boundary and worker semantics. Manual executions are
distinct from scheduled occurrences and remain pending until a worker polls
the local database. The initial adapter uses the scheduler's default
three-attempt policy; future adapters can implement the same port without
coupling the application to SQLite. This does not start or claim the separate
30-day reliability trial.
