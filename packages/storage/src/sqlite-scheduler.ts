/** Local SQLite scheduler adapter; application code must depend on its contract. */
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import type {
  BriefingFallback,
  BriefingDeliveryReceipt,
  BriefingTask,
  ExecutionContext,
  ExecutionEvent,
  ExecutionRecord,
} from '@tatu/shared';

const deliveryFromResult = (
  value: string | void,
  expectedIdempotencyKey: string,
): BriefingDeliveryReceipt | undefined => {
  if (typeof value !== 'string') return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return undefined;
    const result = parsed as { delivery?: unknown };
    const delivery = result.delivery;
    if (!delivery || typeof delivery !== 'object') return undefined;
    const receipt = delivery as Partial<BriefingDeliveryReceipt>;
    if (
      Object.keys(delivery).length !== 4 ||
      receipt.channel !== 'file-outbox' ||
      receipt.idempotencyKey !== expectedIdempotencyKey ||
      typeof receipt.artifactId !== 'string' ||
      !/^[a-f0-9]{64}\.md$/.test(receipt.artifactId) ||
      typeof receipt.contentSha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(receipt.contentSha256)
    )
      return undefined;
    return {
      channel: 'file-outbox',
      idempotencyKey: receipt.idempotencyKey,
      artifactId: receipt.artifactId,
      contentSha256: receipt.contentSha256,
    };
  } catch {
    return undefined;
  }
};

const fallbackFromResult = (
  value: string | void,
): BriefingFallback | undefined => {
  if (typeof value !== 'string') return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return undefined;
    const result = parsed as {
      route?: unknown;
      fallback?: unknown;
    };
    const fallback = result.fallback;
    if (!fallback || typeof fallback !== 'object') return undefined;
    const metadata = fallback as Partial<BriefingFallback>;
    if (
      result.route !== 'deterministic-rss' ||
      Object.keys(fallback).length !== 2 ||
      metadata.from !== 'local-ollama' ||
      (metadata.reason !== 'model_unavailable' &&
        metadata.reason !== 'model_invalid_output' &&
        metadata.reason !== 'model_timeout')
    )
      return undefined;
    return {
      from: 'local-ollama',
      reason: metadata.reason,
    };
  } catch {
    return undefined;
  }
};

type LocalParts = Record<'year' | 'month' | 'day' | 'hour' | 'minute', string>;
const recoveryWindowMs = 36 * 60 * 60 * 1000;
const sqliteBusyRetryLimit = 3;
const eventDetail = {
  claimed: 'worker_claimed',
  deliveryFailed: 'delivery_failed',
  delivered: 'delivery_completed',
  dstGap: 'dst_gap',
  failed: 'execution_failed',
  fallback: 'model_fallback',
  modelFailed: 'model_failed',
  persisted: 'persisted_result',
  researchFailed: 'research_failed',
  retryScheduled: 'retry_scheduled',
  timedOut: 'execution_timeout',
} as const;
const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
const isSqliteBusy = (error: unknown) =>
  error instanceof Error &&
  (error.message.includes('SQLITE_BUSY') ||
    (error as Error & { code?: string }).code === 'SQLITE_BUSY');
class ExecutionTimeoutError extends Error {}
const rejectWhenAborted = (signal: AbortSignal) =>
  new Promise<never>((_, reject) => {
    if (signal.aborted) reject(new ExecutionTimeoutError());
    signal.addEventListener(
      'abort',
      () => reject(new ExecutionTimeoutError()),
      { once: true },
    );
  });

const partsAt = (value: Date, timezone: string): LocalParts =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(value)
    .reduce(
      (out, part) => ({ ...out, [part.type]: part.value }),
      {} as Record<string, string>,
    ) as LocalParts;
const localDate = (parts: LocalParts) =>
  `${parts.year}-${parts.month}-${parts.day}`;
const previousDate = (date: string) => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day - 1))
    .toISOString()
    .slice(0, 10);
};
/** First real instant for a local time. No match means a DST gap. */
const scheduledInstant = (date: string, time: string, timezone: string) => {
  const [year, month, day] = date.split('-').map(Number);
  const center = Date.UTC(year, month - 1, day, 12);
  for (let offset = -18 * 60; offset <= 18 * 60; offset += 1) {
    const candidate = new Date(center + offset * 60_000);
    const parts = partsAt(candidate, timezone);
    if (localDate(parts) === date && `${parts.hour}:${parts.minute}` === time)
      return candidate;
  }
  return undefined;
};

export class LocalScheduler {
  readonly workerId: string;
  private readonly db: Database.Database;

  constructor(
    path: string,
    workerId: string = crypto.randomUUID(),
    private readonly execute: (
      context: ExecutionContext,
      signal: AbortSignal,
    ) => string | void | Promise<string | void> = () => undefined,
  ) {
    this.workerId = workerId;
    mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path);
    this.db
      .exec(`CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY);
CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, cadence TEXT NOT NULL, time TEXT NOT NULL, quantity INTEGER NOT NULL, topic TEXT NOT NULL, delivery_requested INTEGER NOT NULL, timezone TEXT NOT NULL, enabled INTEGER NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS executions (id TEXT PRIMARY KEY, task_id TEXT NOT NULL, occurrence_key TEXT NOT NULL UNIQUE, scheduled_for TEXT NOT NULL, status TEXT NOT NULL, attempt INTEGER NOT NULL, max_attempts INTEGER NOT NULL, available_at TEXT NOT NULL, lease_expires_at TEXT, claimed_by TEXT, result TEXT, failure TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS execution_events (id TEXT PRIMARY KEY, execution_id TEXT NOT NULL, type TEXT NOT NULL, at TEXT NOT NULL, detail TEXT);
INSERT OR IGNORE INTO schema_migrations VALUES (1);`);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 5000');
  }

  private atomic<T>(operation: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = operation();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  private async atomicWithBusyRetry<T>(operation: () => T): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return this.atomic(operation);
      } catch (error) {
        if (!isSqliteBusy(error) || attempt >= sqliteBusyRetryLimit)
          throw error;
        await wait(25 * 2 ** attempt);
      }
    }
  }
  private event(
    id: string,
    type: string,
    at: string,
    detail: string | null = null,
  ) {
    this.db
      .prepare('INSERT INTO execution_events VALUES (?,?,?,?,?)')
      .run(crypto.randomUUID(), id, type, at, detail);
  }

  async poll(
    now = new Date(),
    leaseSeconds = 30,
    maxAttempts = 3,
    timeoutMs = 25_000,
  ): Promise<void> {
    const stamp = now.toISOString();
    let candidate: string | undefined;
    try {
      candidate = await this.atomicWithBusyRetry(() => {
        const expired = this.db
          .prepare(
            "SELECT id,attempt,max_attempts as maxAttempts FROM executions WHERE status='running' AND lease_expires_at < ?",
          )
          .all(stamp) as Array<{
          id: string;
          attempt: number;
          maxAttempts: number;
        }>;
        for (const execution of expired) {
          const terminal = execution.attempt >= execution.maxAttempts;
          const retryAt = new Date(
            now.getTime() + 1000 * 2 ** execution.attempt,
          ).toISOString();
          this.db
            .prepare(
              "UPDATE executions SET status=?,claimed_by=NULL,lease_expires_at=NULL,available_at=?,failure='lease_timeout',updated_at=? WHERE id=? AND status='running'",
            )
            .run(
              terminal ? 'failed' : 'pending',
              terminal ? stamp : retryAt,
              stamp,
              execution.id,
            );
          this.event(execution.id, 'timed_out', stamp, eventDetail.timedOut);
          this.event(
            execution.id,
            terminal ? 'failed' : 'retry_scheduled',
            stamp,
            terminal ? eventDetail.failed : eventDetail.retryScheduled,
          );
        }
        const tasks = this.db
          .prepare(
            'SELECT id,cadence,time,quantity,topic,delivery_requested as deliveryRequested,timezone,enabled,created_at as createdAt FROM tasks WHERE enabled=1',
          )
          .all() as BriefingTask[];
        for (const task of tasks) {
          const todayParts = partsAt(now, task.timezone);
          const today = localDate(todayParts);
          for (const date of [previousDate(today), today]) {
            const key = `${task.id}:${date}:${task.time}:${task.timezone}`;
            const scheduled = scheduledInstant(date, task.time, task.timezone);
            if (!scheduled) {
              if (
                date === today &&
                `${todayParts.hour}:${todayParts.minute}` < task.time
              )
                continue;
              const inserted = this.db
                .prepare(
                  "INSERT OR IGNORE INTO executions VALUES (?,?,?,?, 'skipped',0,?,?,NULL,NULL,NULL,'dst_gap',?,?)",
                )
                .run(
                  crypto.randomUUID(),
                  task.id,
                  key,
                  stamp,
                  maxAttempts,
                  stamp,
                  stamp,
                  stamp,
                );
              if (inserted.changes) {
                const row = this.db
                  .prepare('SELECT id FROM executions WHERE occurrence_key=?')
                  .get(key) as { id: string };
                this.event(
                  row.id,
                  'skipped_dst_gap',
                  stamp,
                  eventDetail.dstGap,
                );
              }
              continue;
            }
            const taskCreatedAt = new Date(task.createdAt).getTime();
            if (
              scheduled.getTime() > now.getTime() ||
              scheduled.getTime() < now.getTime() - recoveryWindowMs ||
              (!Number.isNaN(taskCreatedAt) &&
                scheduled.getTime() < taskCreatedAt)
            )
              continue;
            const inserted = this.db
              .prepare(
                "INSERT OR IGNORE INTO executions VALUES (?,?,?,?, 'pending',0,?,?,NULL,NULL,NULL,NULL,?,?)",
              )
              .run(
                crypto.randomUUID(),
                task.id,
                key,
                scheduled.toISOString(),
                maxAttempts,
                stamp,
                stamp,
                stamp,
              );
            if (inserted.changes) {
              const row = this.db
                .prepare('SELECT id FROM executions WHERE occurrence_key=?')
                .get(key) as { id: string };
              this.event(row.id, 'queued', stamp);
            }
          }
        }
        const row = this.db
          .prepare(
            "SELECT id FROM executions WHERE status='pending' AND available_at <= ? ORDER BY scheduled_for LIMIT 1",
          )
          .get(stamp) as { id: string } | undefined;
        if (!row) return undefined;
        const claimed = this.db
          .prepare(
            "UPDATE executions SET status='running',attempt=attempt+1,claimed_by=?,lease_expires_at=?,updated_at=? WHERE id=? AND status='pending'",
          )
          .run(
            this.workerId,
            new Date(now.getTime() + leaseSeconds * 1000).toISOString(),
            stamp,
            row.id,
          );
        if (!claimed.changes) return undefined;
        this.event(row.id, 'claimed', stamp, eventDetail.claimed);
        return row.id;
      });
    } catch (error) {
      if (isSqliteBusy(error)) return;
      throw error;
    }
    if (!candidate) return;
    try {
      const signal = AbortSignal.timeout(
        Math.min(timeoutMs, leaseSeconds * 1000),
      );
      const occurrence = this.db
        .prepare(
          'SELECT executions.occurrence_key as occurrenceKey,tasks.topic as topic,tasks.quantity as quantity FROM executions JOIN tasks ON tasks.id=executions.task_id WHERE executions.id=?',
        )
        .get(candidate) as {
        occurrenceKey: string;
        topic: string;
        quantity: number;
      };
      const result = await Promise.race([
        Promise.resolve().then(() =>
          this.execute(
            {
              executionId: candidate,
              idempotencyKey: occurrence.occurrenceKey,
              topic: occurrence.topic,
              quantity: occurrence.quantity,
            },
            signal,
          ),
        ),
        rejectWhenAborted(signal),
      ]);
      await this.atomicWithBusyRetry(() => {
        const fallback = fallbackFromResult(result);
        const delivery = deliveryFromResult(result, occurrence.occurrenceKey);
        const done = this.db
          .prepare(
            "UPDATE executions SET status='succeeded',result=?,lease_expires_at=NULL,updated_at=? WHERE id=? AND status='running' AND claimed_by=?",
          )
          .run(result ?? 'stage4_placeholder', stamp, candidate, this.workerId);
        if (done.changes) {
          if (fallback)
            this.event(candidate, 'fallback_used', stamp, eventDetail.fallback);
          if (delivery)
            this.event(candidate, 'delivered', stamp, eventDetail.delivered);
          this.event(candidate, 'succeeded', stamp, eventDetail.persisted);
        }
      });
    } catch (error) {
      const researchFailure =
        error instanceof Error &&
        [
          'rss_unavailable',
          'rss_not_configured',
          'insufficient_cited_stories',
          'invalid_rss_url',
          'unsafe_rss_url',
          'rss_too_large',
          'rss_redirect_limit',
          'invalid_quantity',
          'invalid_research_context',
          'research_timeout',
        ].includes(error.message);
      const modelFailure =
        error instanceof Error &&
        ['model_unavailable', 'model_invalid_output', 'model_timeout'].includes(
          error.message,
        );
      const deliveryFailure =
        error instanceof Error &&
        [
          'aborted',
          'invalid_briefing',
          'delivery_conflict',
          'delivery_io',
        ].includes(error.message);
      const failure =
        error instanceof ExecutionTimeoutError
          ? 'execution_timeout'
          : modelFailure
            ? 'model_failure'
            : deliveryFailure
              ? 'delivery_failure'
              : researchFailure
                ? 'research_failure'
                : 'placeholder_failure';
      await this.atomicWithBusyRetry(() => {
        const row = this.db
          .prepare(
            "SELECT attempt,max_attempts as maxAttempts FROM executions WHERE id=? AND status='running' AND claimed_by=?",
          )
          .get(candidate, this.workerId) as
          { attempt: number; maxAttempts: number } | undefined;
        if (!row) return;
        const terminal = row.attempt >= row.maxAttempts;
        const retryAt = new Date(
          now.getTime() + 1000 * 2 ** row.attempt,
        ).toISOString();
        this.db
          .prepare(
            'UPDATE executions SET status=?,available_at=?,lease_expires_at=NULL,failure=?,updated_at=? WHERE id=? AND claimed_by=?',
          )
          .run(
            terminal ? 'failed' : 'pending',
            terminal ? stamp : retryAt,
            failure,
            stamp,
            candidate,
            this.workerId,
          );
        if (failure === 'execution_timeout')
          this.event(candidate, 'timed_out', stamp, eventDetail.timedOut);
        if (failure === 'research_failure')
          this.event(
            candidate,
            'research_failed',
            stamp,
            eventDetail.researchFailed,
          );
        if (failure === 'model_failure')
          this.event(candidate, 'model_failed', stamp, eventDetail.modelFailed);
        if (failure === 'delivery_failure')
          this.event(
            candidate,
            'delivery_failed',
            stamp,
            eventDetail.deliveryFailed,
          );
        this.event(
          candidate,
          terminal ? 'failed' : 'retry_scheduled',
          stamp,
          terminal ? eventDetail.failed : eventDetail.retryScheduled,
        );
      });
    }
  }

  list(): ExecutionRecord[] {
    return this.db
      .prepare(
        'SELECT id,task_id as taskId,occurrence_key as occurrenceKey,scheduled_for as scheduledFor,status,attempt,max_attempts as maxAttempts,available_at as availableAt,lease_expires_at as leaseExpiresAt,claimed_by as claimedBy,result,failure,created_at as createdAt,updated_at as updatedAt FROM executions ORDER BY created_at',
      )
      .all() as ExecutionRecord[];
  }
  events(executionId: string): ExecutionEvent[] {
    return this.db
      .prepare(
        'SELECT id,type,at,detail FROM execution_events WHERE execution_id=? ORDER BY rowid',
      )
      .all(executionId) as ExecutionEvent[];
  }
  close() {
    this.db.close();
  }
}
