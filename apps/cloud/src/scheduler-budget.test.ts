import assert from 'node:assert/strict';
import test from 'node:test';
import { createTestD1 } from './test-d1.js';
import { runDue } from './scheduler.js';
import type { D1Database } from './types.js';
import type { CloudBriefing } from './feed.js';

test('one scheduler tick stays below the free D1 invocation budget even with due work and expired claims', async () => {
  const db = createTestD1();
  const now = new Date('2026-10-12T09:00:00.000Z');
  const owner = crypto.randomUUID();
  db.database
    .prepare('INSERT INTO owners VALUES (?,?,?,?)')
    .run(owner, 'test', 'budget-owner', now.toISOString());
  for (let index = 0; index < 3; index++) {
    const task = crypto.randomUUID();
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
    db.database
      .prepare(
        "INSERT INTO executions (owner_id,id,task_id,occurrence_key,scheduled_for,status,attempt,max_attempts,available_at,lease_until,claim_token,schedule_revision,snapshot_json,created_at,updated_at) VALUES (?,?,?,?,?,'running',1,3,?,?,?,1,?,?,?)",
      )
      .run(
        owner,
        crypto.randomUUID(),
        task,
        `expired:${index}`,
        now.toISOString(),
        now.toISOString(),
        '2026-10-12T08:59:00.000Z',
        crypto.randomUUID(),
        JSON.stringify({ topic: 'AI', quantity: 3 }),
        now.toISOString(),
        now.toISOString(),
      );
  }
  let statements = 0;
  const counted: D1Database = {
    prepare(sql) {
      statements++;
      return db.prepare(sql);
    },
    batch(statements) {
      return db.batch(statements);
    },
  };
  const briefing: CloudBriefing = {
    topic: 'AI',
    stories: [],
    facts: [],
    inference: [],
    route: 'deterministic-rss',
    delivery: { channel: 'in-app' },
    observability: {
      provider: 'public-rss',
      model: null,
      tools: ['public-rss', 'in-app'],
      latencyMs: 0,
      estimatedCost: { status: 'unknown' },
    },
  };
  try {
    await runDue({ DB: counted }, now, { research: async () => briefing });
    assert.ok(statements <= 45, `tick used ${statements} SQL statements`);
    assert.equal(
      (
        db.database
          .prepare(
            "SELECT COUNT(*) as count FROM executions WHERE status='succeeded'",
          )
          .get() as { count: number }
      ).count,
      3,
    );
  } finally {
    db.close();
  }
});
