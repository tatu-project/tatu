import type { CloudEnv, D1Database } from './types.js';
import { fetchBriefing, type CloudBriefing } from './feed.js';
import { pruneOwnerExecutionHistory } from './storage.js';

const formatters = new Map<string, Intl.DateTimeFormat>();
const parts = (date: Date, timezone: string) => {
  let formatter = formatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    if (formatters.size >= 32) formatters.clear();
    formatters.set(timezone, formatter);
  }
  return Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
};
/** A DST gap skips the day; an ambiguous time uses the first instant, once per local day. */
export function nextRunAt(time: string, timezone: string, after: Date): string {
  if (
    !/^([01]\d|2[0-3]):[0-5]\d$/u.test(time) ||
    !Number.isFinite(after.getTime())
  )
    throw new Error('invalid_schedule');
  const local = parts(after, timezone);
  const [hour, minute] = time.split(':').map(Number);
  for (let day = 0; day < 8; day++) {
    const seed = Date.UTC(
      Number(local.year),
      Number(local.month) - 1,
      Number(local.day) + day,
      hour,
      minute,
    );
    const target = new Date(seed).toISOString().slice(0, 10);
    const offsets = new Set<number>();
    for (const delta of [-36, -12, 0, 12, 36]) {
      const sample = new Date(seed + delta * 3600000);
      const sampled = parts(sample, timezone);
      offsets.add(
        Date.UTC(
          Number(sampled.year),
          Number(sampled.month) - 1,
          Number(sampled.day),
          Number(sampled.hour),
          Number(sampled.minute),
        ) - sample.getTime(),
      );
    }
    const candidates = [...offsets]
      .map((offset) => new Date(seed - offset))
      .filter((candidate) => {
        const value = parts(candidate, timezone);
        return (
          `${value.year}-${value.month}-${value.day}` === target &&
          `${value.hour}:${value.minute}` === time
        );
      })
      .sort((a, b) => a.getTime() - b.getTime());
    if (candidates[0] && candidates[0].getTime() > after.getTime())
      return candidates[0].toISOString();
  }
  throw new Error('invalid_schedule');
}
type TaskRow = {
  owner_id: string;
  id: string;
  time: string;
  timezone: string;
  quantity: number;
  topic: string;
  schedule_revision: number;
  next_run_at: string;
};
type ExecutionRow = {
  owner_id: string;
  id: string;
  task_id: string;
  attempt: number;
  max_attempts: number;
  claim_token: string | null;
  lease_until: string | null;
  snapshot_json: string;
  schedule_revision: number;
  status: string;
};
type SchedulerOptions = {
  research?: (
    topic: string,
    quantity: number,
    signal: AbortSignal,
  ) => Promise<CloudBriefing>;
  clock?: () => Date;
};
const event = (
  database: D1Database,
  row: Pick<ExecutionRow, 'owner_id' | 'id'>,
  type: string,
  stamp: string,
  condition: string,
  values: unknown[],
) =>
  database
    .prepare(
      `INSERT INTO execution_events (owner_id,id,execution_id,type,at,detail) SELECT owner_id,?,id,?,?,NULL FROM executions WHERE owner_id=? AND id=? AND ${condition}`,
    )
    .bind(crypto.randomUUID(), type, stamp, row.owner_id, row.id, ...values);

export async function runDue(
  environment: CloudEnv,
  now = new Date(),
  options: SchedulerOptions = {},
): Promise<{ processed: number }> {
  const database = environment.DB;
  if (!database) throw new Error('storage_unavailable');
  const start = performance.now();
  const clock =
    options.clock ??
    (() => new Date(now.getTime() + performance.now() - start));
  const stamp = now.toISOString();
  const ownersToPrune = new Set<string>();
  const due = (
    await database
      .prepare(
        'SELECT * FROM tasks WHERE enabled=1 AND next_run_at<=? ORDER BY next_run_at,owner_id,id LIMIT 3',
      )
      .bind(stamp)
      .all<TaskRow>()
  ).results;
  for (const task of due) {
    const id = crypto.randomUUID();
    const key = `${task.id}:${task.schedule_revision}:${task.next_run_at}`;
    const snapshot = JSON.stringify({
      topic: task.topic,
      quantity: task.quantity,
    });
    const next = nextRunAt(task.time, task.timezone, now);
    await database.batch([
      database
        .prepare(
          `INSERT OR IGNORE INTO executions (owner_id,id,task_id,occurrence_key,scheduled_for,status,attempt,max_attempts,available_at,schedule_revision,snapshot_json,created_at,updated_at) SELECT owner_id,?,id,?,next_run_at,'pending',0,3,?,schedule_revision,?,?,? FROM tasks WHERE owner_id=? AND id=? AND enabled=1 AND schedule_revision=? AND next_run_at=?`,
        )
        .bind(
          id,
          key,
          stamp,
          snapshot,
          stamp,
          stamp,
          task.owner_id,
          task.id,
          task.schedule_revision,
          task.next_run_at,
        ),
      event(
        database,
        { owner_id: task.owner_id, id },
        'queued',
        stamp,
        "status='pending'",
        [],
      ),
      database
        .prepare(
          'UPDATE tasks SET next_run_at=? WHERE owner_id=? AND id=? AND enabled=1 AND schedule_revision=? AND next_run_at=?',
        )
        .bind(
          next,
          task.owner_id,
          task.id,
          task.schedule_revision,
          task.next_run_at,
        ),
    ]);
  }
  const expired = (
    await database
      .prepare(
        "SELECT * FROM executions WHERE status='running' AND lease_until<=? ORDER BY lease_until LIMIT 3",
      )
      .bind(stamp)
      .all<ExecutionRow>()
  ).results;
  for (const row of expired) {
    ownersToPrune.add(row.owner_id);
    const terminal = row.attempt >= row.max_attempts;
    await database.batch([
      event(
        database,
        row,
        terminal ? 'failed' : 'retry_scheduled',
        stamp,
        "status='running' AND claim_token=? AND lease_until<=?",
        [row.claim_token, stamp],
      ),
      database
        .prepare(
          "UPDATE executions SET status=?,failure='lease_expired',available_at=?,claim_token=NULL,lease_until=NULL,updated_at=? WHERE owner_id=? AND id=? AND status='running' AND claim_token=? AND lease_until<=?",
        )
        .bind(
          terminal ? 'failed' : 'pending',
          stamp,
          stamp,
          row.owner_id,
          row.id,
          row.claim_token,
          stamp,
        ),
    ]);
  }
  const ready = (
    await database
      .prepare(
        "SELECT * FROM executions WHERE status='pending' AND available_at<=? ORDER BY available_at,owner_id,id LIMIT 3",
      )
      .bind(stamp)
      .all<ExecutionRow>()
  ).results;
  let processed = 0;
  for (const row of ready) {
    ownersToPrune.add(row.owner_id);
    await database.batch([
      event(
        database,
        row,
        'skipped_task_changed',
        stamp,
        "status='pending' AND NOT EXISTS (SELECT 1 FROM tasks WHERE owner_id=executions.owner_id AND id=executions.task_id AND enabled=1 AND schedule_revision=executions.schedule_revision)",
        [],
      ),
      database
        .prepare(
          "UPDATE executions SET status='skipped',failure='task_changed',updated_at=? WHERE owner_id=? AND id=? AND status='pending' AND NOT EXISTS (SELECT 1 FROM tasks WHERE owner_id=executions.owner_id AND id=executions.task_id AND enabled=1 AND schedule_revision=executions.schedule_revision)",
        )
        .bind(stamp, row.owner_id, row.id),
    ]);
    const claimedAt = clock().toISOString();
    const token = crypto.randomUUID();
    const lease = new Date(Date.parse(claimedAt) + 60000).toISOString();
    const claim = await database
      .prepare(
        "UPDATE executions SET status='running',attempt=attempt+1,claim_token=?,lease_until=?,failure=NULL,updated_at=? WHERE owner_id=? AND id=? AND status='pending' AND available_at<=? AND attempt<max_attempts AND EXISTS (SELECT 1 FROM tasks WHERE owner_id=executions.owner_id AND id=executions.task_id AND enabled=1 AND schedule_revision=executions.schedule_revision)",
      )
      .bind(token, lease, claimedAt, row.owner_id, row.id, claimedAt)
      .run();
    if (!claim.meta.changes) continue;
    await event(
      database,
      row,
      'claimed',
      claimedAt,
      "status='running' AND claim_token=?",
      [token],
    ).run();
    try {
      const snapshot: unknown = JSON.parse(row.snapshot_json);
      if (!snapshot || typeof snapshot !== 'object')
        throw new Error('invalid_snapshot');
      const input = snapshot as { topic?: unknown; quantity?: unknown };
      if (typeof input.topic !== 'string' || typeof input.quantity !== 'number')
        throw new Error('invalid_snapshot');
      const result = await (options.research ?? fetchBriefing)(
        input.topic,
        input.quantity,
        AbortSignal.timeout(20000),
      );
      const finished = clock().toISOString();
      const completion = await database.batch([
        database
          .prepare(
            "UPDATE executions SET status='succeeded',result_json=?,updated_at=?,failure=NULL WHERE owner_id=? AND id=? AND status='running' AND claim_token=? AND lease_until>?",
          )
          .bind(
            JSON.stringify(result),
            finished,
            row.owner_id,
            row.id,
            token,
            finished,
          ),
        event(
          database,
          row,
          'delivered',
          finished,
          "status='succeeded' AND claim_token=? AND updated_at=?",
          [token, finished],
        ),
        event(
          database,
          row,
          'succeeded',
          finished,
          "status='succeeded' AND claim_token=? AND updated_at=?",
          [token, finished],
        ),
      ]);
      if (completion[0].meta.changes) processed++;
    } catch {
      const finished = clock().toISOString();
      const terminal = row.attempt + 1 >= row.max_attempts;
      const available = new Date(
        Date.parse(finished) + Math.min(300000, 30000 * 2 ** row.attempt),
      ).toISOString();
      await database.batch([
        event(
          database,
          row,
          'research_failed',
          finished,
          "status='running' AND claim_token=? AND lease_until>?",
          [token, finished],
        ),
        event(
          database,
          row,
          terminal ? 'failed' : 'retry_scheduled',
          finished,
          "status='running' AND claim_token=? AND lease_until>?",
          [token, finished],
        ),
        database
          .prepare(
            "UPDATE executions SET status=?,failure='research_failure',available_at=?,updated_at=?,claim_token=NULL,lease_until=NULL WHERE owner_id=? AND id=? AND status='running' AND claim_token=? AND lease_until>?",
          )
          .bind(
            terminal ? 'failed' : 'pending',
            available,
            finished,
            row.owner_id,
            row.id,
            token,
            finished,
          ),
      ]);
    }
  }
  for (const owner of ownersToPrune)
    await pruneOwnerExecutionHistory(database, owner);
  return { processed };
}
