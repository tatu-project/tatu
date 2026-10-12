import assert from 'node:assert/strict';
import test from 'node:test';
import { nextRunAt, runDue } from './scheduler.js';
import { createTestD1 } from './test-d1.js';
import type { CloudBriefing } from './feed.js';

const now = new Date('2026-10-12T09:00:00.000Z');
const result = (title = 'Cited fixture'): CloudBriefing => ({
  topic: 'AI',
  stories: [],
  facts: [
    {
      title,
      url: 'https://techcrunch.com/fixture/',
      publishedAt: now.toISOString(),
      source: 'techcrunch.com',
    },
  ],
  inference: [],
  route: 'deterministic-rss',
  delivery: { channel: 'in-app' },
  observability: {
    provider: 'public-rss',
    model: null,
    tools: ['public-rss', 'in-app'],
    latencyMs: 1,
    estimatedCost: { status: 'unknown' },
  },
});
const setup = () => {
  const db = createTestD1();
  const owner = crypto.randomUUID();
  const task = crypto.randomUUID();
  db.database
    .prepare('INSERT INTO owners VALUES (?,?,?,?)')
    .run(owner, 'test', 'owner', now.toISOString());
  db.database
    .prepare(
      "INSERT INTO tasks (owner_id,id,time,timezone,quantity,topic,next_run_at,created_at,updated_at) VALUES (?,?, '08:00','UTC',3,'AI',?,?,?)",
    )
    .run(
      owner,
      task,
      '2026-10-12T08:00:00.000Z',
      now.toISOString(),
      now.toISOString(),
    );
  return { db, owner, task };
};
test('next UTC occurrence handles timezones, skipped DST gaps and one ambiguous daily occurrence', () => {
  assert.equal(
    nextRunAt('08:00', 'America/Sao_Paulo', new Date('2026-10-12T10:00:00Z')),
    '2026-10-12T11:00:00.000Z',
  );
  assert.equal(
    nextRunAt('02:30', 'America/New_York', new Date('2026-03-08T05:00:00Z')),
    '2026-03-09T06:30:00.000Z',
  );
  assert.equal(
    nextRunAt('01:30', 'America/New_York', new Date('2026-11-01T04:00:00Z')),
    '2026-11-01T05:30:00.000Z',
  );
  assert.equal(
    nextRunAt('01:30', 'America/New_York', new Date('2026-11-01T05:45:00Z')),
    '2026-11-02T06:30:00.000Z',
  );
  assert.throws(() => nextRunAt('25:00', 'UTC', now));
});
test('concurrent cloud ticks queue and deliver a due occurrence once with immutable events', async () => {
  const { db } = setup();
  let calls = 0;
  try {
    const research = async () => {
      calls++;
      return result();
    };
    await Promise.all([
      runDue({ DB: db }, now, { research }),
      runDue({ DB: db }, now, { research }),
    ]);
    await runDue({ DB: db }, now, { research });
    assert.equal(calls, 1);
    const executions = db.database
      .prepare('SELECT * FROM executions')
      .all() as { status: string; result_json: string }[];
    assert.equal(executions.length, 1);
    assert.equal(executions[0].status, 'succeeded');
    assert.equal(
      JSON.parse(executions[0].result_json).delivery.channel,
      'in-app',
    );
    const events = db.database
      .prepare(
        'SELECT type,COUNT(*) as count FROM execution_events GROUP BY type',
      )
      .all() as { type: string; count: number }[];
    assert.deepEqual(
      new Set(events.map((event) => event.type)),
      new Set(['queued', 'claimed', 'delivered', 'succeeded']),
    );
    assert.ok(events.every((event) => event.count === 1));
  } finally {
    db.close();
  }
});
test('retry backoff is durable and bounded; errors never expose provider payloads', async () => {
  const { db } = setup();
  try {
    const research = async () => {
      throw new Error('private provider payload');
    };
    await runDue({ DB: db }, now, { research, clock: () => now });
    const first = db.database
      .prepare('SELECT status,available_at,attempt FROM executions')
      .get() as { status: string; available_at: string; attempt: number };
    assert.equal(first.status, 'pending');
    assert.equal(first.attempt, 1);
    assert.equal(first.available_at, '2026-10-12T09:00:30.000Z');
    await runDue({ DB: db }, new Date('2026-10-12T09:00:10Z'), { research });
    assert.equal(
      (
        db.database.prepare('SELECT attempt FROM executions').get() as {
          attempt: number;
        }
      ).attempt,
      1,
    );
    await runDue({ DB: db }, new Date('2026-10-12T09:00:31Z'), {
      research,
      clock: () => new Date('2026-10-12T09:00:31Z'),
    });
    await runDue({ DB: db }, new Date('2026-10-12T09:01:32Z'), {
      research,
      clock: () => new Date('2026-10-12T09:01:32Z'),
    });
    const last = db.database
      .prepare('SELECT status,attempt,failure FROM executions')
      .get() as { status: string; attempt: number; failure: string };
    assert.equal(last.status, 'failed');
    assert.equal(last.attempt, 3);
    assert.equal(last.failure, 'research_failure');
    assert.equal(
      JSON.stringify(
        db.database.prepare('SELECT * FROM execution_events').all(),
      ).includes('private provider'),
      false,
    );
  } finally {
    db.close();
  }
});
test('expired lease is reclaimed and fenced; stale worker cannot overwrite the winner', async () => {
  const { db } = setup();
  let release: () => void = () => {};
  let enter: () => void = () => {};
  const entered = new Promise<void>((resolve) => {
    enter = resolve;
  });
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    const stale = runDue({ DB: db }, now, {
      clock: () => new Date('2026-10-12T09:01:40Z'),
      research: async () => {
        enter();
        await blocked;
        return result('stale');
      },
    });
    await entered;
    // Use a later clock beyond the first 60-second lease, then a valid new claim.
    await runDue({ DB: db }, new Date('2026-10-12T09:02:41Z'), {
      clock: () => new Date('2026-10-12T09:02:41Z'),
      research: async () => result('winner'),
    });
    release();
    await stale;
    const execution = db.database
      .prepare('SELECT status,attempt,result_json FROM executions')
      .get() as { status: string; attempt: number; result_json: string };
    assert.equal(execution.status, 'succeeded');
    assert.equal(execution.attempt, 2);
    assert.equal(JSON.parse(execution.result_json).facts[0].title, 'winner');
    assert.equal(
      (
        db.database
          .prepare(
            "SELECT COUNT(*) as count FROM execution_events WHERE type='delivered'",
          )
          .get() as { count: number }
      ).count,
      1,
    );
  } finally {
    release();
    db.close();
  }
});
test('paused pending work is skipped while an already-running immutable snapshot can finish', async () => {
  const { db, owner, task } = setup();
  try {
    const id = crypto.randomUUID();
    db.database
      .prepare(
        'INSERT INTO executions (owner_id,id,task_id,occurrence_key,scheduled_for,available_at,schedule_revision,snapshot_json,created_at,updated_at) VALUES (?,?,?,?,?,?,1,?,?,?)',
      )
      .run(
        owner,
        id,
        task,
        'manual:paused',
        now.toISOString(),
        now.toISOString(),
        JSON.stringify({ topic: 'AI', quantity: 3 }),
        now.toISOString(),
        now.toISOString(),
      );
    db.database
      .prepare('UPDATE tasks SET enabled=0,next_run_at=NULL WHERE id=?')
      .run(task);
    await runDue({ DB: db }, now, {
      research: async () => {
        throw new Error('must not execute paused task');
      },
    });
    assert.equal(
      (
        db.database
          .prepare('SELECT status FROM executions WHERE id=?')
          .get(id) as { status: string }
      ).status,
      'skipped',
    );
    db.database
      .prepare('UPDATE tasks SET enabled=1,next_run_at=? WHERE id=?')
      .run('2026-10-12T08:00:00.000Z', task);
    await runDue({ DB: db }, now, {
      research: async () => {
        db.database
          .prepare('UPDATE tasks SET enabled=0,next_run_at=NULL WHERE id=?')
          .run(task);
        return result();
      },
    });
    assert.equal(
      (
        db.database
          .prepare(
            "SELECT COUNT(*) as count FROM executions WHERE status='succeeded'",
          )
          .get() as { count: number }
      ).count,
      1,
    );
  } finally {
    db.close();
  }
});
