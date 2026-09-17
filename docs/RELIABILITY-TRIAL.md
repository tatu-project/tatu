# 30-day reliability trial

This protocol is a creator-run observation plan. It does not by itself claim
that a reliability target has been met. The Stage 7 checklist remains
unchecked until the creator records and reviews a real 30-calendar-day run.

## Start checklist

1. Pull the published `main` and confirm the worktree is clean.
2. Install the documented dependencies with `npm ci`.
3. Run `npm run ci` and save the result showing the current passing test count.
4. Start the local API and standby worker with `npm run dev`.
5. In Chat, create and confirm the daily AI-news task in the creator's local
   timezone. Choose a start time that can be observed on the following day.
6. Confirm Setup Health, the task row, and the delivery outbox before the first
   scheduled occurrence.

The published baseline for this checklist is `npm run ci` with 112 passing
tests. A later change must record its new verified count rather than reusing
this baseline.

The `Testar agora` control is useful for a local preflight, but it is not a
scheduled-trial observation and must not be counted as a trial day.

## Daily observation

For each calendar day, record only public, non-sensitive evidence:

| Date | Execution status | Public event types | Delivery artifact present | Restart/recovery note | Safe failure note |
| ---- | ---------------- | ------------------ | ------------------------- | --------------------- | ----------------- |
|      |                  |                    |                           |                       |                   |

Use the execution ID and the public event endpoint for correlation. Do not
copy occurrence keys, `Idempotency-Key` values, raw provider responses, local
database rows, credentials, or full briefing content into the log.

If the worker or machine restarts, record the restart window and whether the
same scheduled occurrence was recovered without a duplicate public delivery.
If research, model, or delivery fails, record the fixed public failure category
and preserve the corresponding timeline; do not convert a safe failure into a
success claim.

## Completion criteria

The creator may request the Stage 7 checkbox to be reviewed only after:

- 30 consecutive calendar days have been observed from the chosen start date;
- every expected occurrence has a public status and event timeline, including
  safe failures;
- delivery artifacts and any restart/recovery observations are accounted for;
- the evidence contains no secrets, raw keys, or unrestricted provider payloads;
- the creator and both founders review the resulting notes.

Until those conditions are met, this document is preparation only and the
roadmap item remains unchecked.
