import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { LocalScheduler, SqliteTaskStore } from '@tatu/storage';

test('claims a due occurrence exactly once across restart and schedulers', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tatu-scheduler-'));
  const path = join(dir, 'tatu.sqlite');
  const db = new Database(path);
  db.exec(
    'CREATE TABLE tasks (id TEXT PRIMARY KEY, cadence TEXT, time TEXT, quantity INTEGER, topic TEXT, delivery_requested INTEGER, timezone TEXT, enabled INTEGER, created_at TEXT)',
  );
  db.prepare('INSERT INTO tasks VALUES (?,?,?,?,?,?,?,?,?)').run(
    'task',
    'daily',
    '08:00',
    3,
    'ai',
    1,
    'America/Sao_Paulo',
    1,
    '2026-01-01T00:00:00.000Z',
  );
  db.close();
  const now = new Date('2026-01-01T12:00:00.000Z');
  const a = new LocalScheduler(path, 'a');
  const b = new LocalScheduler(path, 'b');
  await a.poll(now);
  await b.poll(now);
  assert.equal(a.list().length, 1);
  assert.equal(a.list()[0].status, 'succeeded');
  assert.equal(a.list()[0].attempt, 1);
  a.close();
  b.close();
  const restarted = new LocalScheduler(path, 'c');
  await restarted.poll(now);
  assert.equal(restarted.list().length, 1);
  restarted.close();
  rmSync(dir, { recursive: true, force: true });
});

test('retries deterministic placeholder failures then succeeds', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tatu-retry-'));
  const path = join(dir, 'tatu.sqlite');
  const db = new Database(path);
  db.exec(
    'CREATE TABLE tasks (id TEXT PRIMARY KEY, cadence TEXT, time TEXT, quantity INTEGER, topic TEXT, delivery_requested INTEGER, timezone TEXT, enabled INTEGER, created_at TEXT)',
  );
  db.prepare('INSERT INTO tasks VALUES (?,?,?,?,?,?,?,?,?)').run(
    'task',
    'daily',
    '08:00',
    3,
    'ai',
    1,
    'America/Sao_Paulo',
    1,
    '2026-01-01T00:00:00.000Z',
  );
  db.close();
  let failures = 1;
  const scheduler = new LocalScheduler(path, 'retry', () => {
    if (failures-- > 0) throw new Error('x');
  });
  const now = new Date('2026-01-01T12:00:00Z');
  await scheduler.poll(now);
  assert.equal(scheduler.list()[0].status, 'pending');
  await scheduler.poll(new Date(now.getTime() + 3000));
  assert.equal(scheduler.list()[0].status, 'succeeded');
  scheduler.close();
  rmSync(dir, { recursive: true, force: true });
});

test('recovers an expired lease then records final failure', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tatu-lease-'));
  const path = join(dir, 'tatu.sqlite');
  const scheduler = new LocalScheduler(path, 'lease');
  const db = new Database(path);
  const old = '2026-01-01T00:00:00.000Z';
  db.prepare(
    "INSERT INTO executions VALUES (?,?,?,?, 'running',1,2,?,?,?,NULL,NULL,?,?)",
  ).run('one', 'task', 'one', old, old, old, 'other', old, old);
  db.close();
  await scheduler.poll(new Date('2026-01-01T01:00:00Z'));
  assert.equal(scheduler.list()[0].status, 'pending');
  const second = new Database(path);
  second
    .prepare(
      "UPDATE executions SET status='running',attempt=2,lease_expires_at=? WHERE id='one'",
    )
    .run(old);
  second.close();
  await scheduler.poll(new Date('2026-01-01T02:00:00Z'));
  assert.equal(scheduler.list()[0].status, 'failed');
  scheduler.close();
  rmSync(dir, { recursive: true, force: true });
});

test('uses one occurrence key when a fall-back local time repeats', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tatu-dst-'));
  const path = join(dir, 'tatu.sqlite');
  const db = new Database(path);
  db.exec(
    'CREATE TABLE tasks (id TEXT PRIMARY KEY, cadence TEXT, time TEXT, quantity INTEGER, topic TEXT, delivery_requested INTEGER, timezone TEXT, enabled INTEGER, created_at TEXT)',
  );
  db.prepare('INSERT INTO tasks VALUES (?,?,?,?,?,?,?,?,?)').run(
    'dst',
    'daily',
    '01:30',
    1,
    'ai',
    1,
    'America/New_York',
    1,
    '2026-11-01T00:00:00.000Z',
  );
  db.close();
  const scheduler = new LocalScheduler(path, 'dst');
  await scheduler.poll(new Date('2026-11-01T05:30:00Z'));
  await scheduler.poll(new Date('2026-11-01T06:30:00Z'));
  assert.equal(scheduler.list().length, 1);
  scheduler.close();
  rmSync(dir, { recursive: true, force: true });
});

test('recovers one missed occurrence after the worker restarts with its trace', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tatu-restart-'));
  const path = join(dir, 'nested', 'tatu.sqlite');
  const first = new LocalScheduler(path, 'first');
  first.close();
  const db = new Database(path);
  db.prepare('INSERT INTO tasks VALUES (?,?,?,?,?,?,?,?,?)').run(
    'restart',
    'daily',
    '08:00',
    1,
    'ai',
    1,
    'America/Sao_Paulo',
    1,
    '2026-01-01T00:00:00.000Z',
  );
  db.close();
  const now = new Date('2026-01-01T12:00:00Z');
  const restarted = new LocalScheduler(path, 'restarted');
  await restarted.poll(now);
  await restarted.poll(now);
  assert.equal(restarted.list().length, 1);
  assert.equal(restarted.list()[0].status, 'succeeded');
  assert.deepEqual(
    restarted.events(restarted.list()[0].id).map((event) => event.type),
    ['queued', 'claimed', 'succeeded'],
  );
  restarted.close();
  rmSync(dir, { recursive: true, force: true });
});

test('records a DST-gap occurrence without executing it', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tatu-gap-'));
  const path = join(dir, 'tatu.sqlite');
  const scheduler = new LocalScheduler(path, 'gap', () => {
    throw new Error('must not execute');
  });
  const db = new Database(path);
  db.prepare('INSERT INTO tasks VALUES (?,?,?,?,?,?,?,?,?)').run(
    'gap',
    'daily',
    '02:30',
    1,
    'ai',
    1,
    'America/New_York',
    1,
    '2026-03-08T00:00:00.000Z',
  );
  db.close();
  await scheduler.poll(new Date('2026-03-08T08:00:00Z'));
  assert.equal(scheduler.list().length, 1);
  assert.equal(scheduler.list()[0].status, 'skipped');
  assert.deepEqual(
    scheduler.events(scheduler.list()[0].id).map((event) => event.type),
    ['skipped_dst_gap'],
  );
  scheduler.close();
  rmSync(dir, { recursive: true, force: true });
});

test('times out a cooperative executor and schedules a retry', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tatu-timeout-'));
  const path = join(dir, 'tatu.sqlite');
  const scheduler = new LocalScheduler(
    path,
    'timeout',
    (_context, signal) =>
      new Promise<void>((_resolve, reject) =>
        signal.addEventListener('abort', () => reject(new Error('aborted'))),
      ),
  );
  const db = new Database(path);
  db.prepare('INSERT INTO tasks VALUES (?,?,?,?,?,?,?,?,?)').run(
    'timeout',
    'daily',
    '08:00',
    1,
    'ai',
    1,
    'America/Sao_Paulo',
    1,
    '2026-01-01T00:00:00.000Z',
  );
  db.close();
  await scheduler.poll(new Date('2026-01-01T12:00:00Z'), 30, 3, 1);
  assert.equal(scheduler.list()[0].status, 'pending');
  assert.deepEqual(
    scheduler.events(scheduler.list()[0].id).map((event) => event.type),
    ['queued', 'claimed', 'timed_out', 'retry_scheduled'],
  );
  scheduler.close();
  rmSync(dir, { recursive: true, force: true });
});

test('persists a cited research result once and records safe research failure', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tatu-research-'));
  const path = join(dir, 'nested', 'tatu.sqlite');
  mkdirSync(join(dir, 'nested'));
  const seed = new Database(path);
  seed.exec(
    'CREATE TABLE tasks (id TEXT PRIMARY KEY, cadence TEXT, time TEXT, quantity INTEGER, topic TEXT, delivery_requested INTEGER, timezone TEXT, enabled INTEGER, created_at TEXT)',
  );
  seed
    .prepare('INSERT INTO tasks VALUES (?,?,?,?,?,?,?,?,?)')
    .run(
      'research',
      'daily',
      '08:00',
      3,
      'ai',
      1,
      'America/Sao_Paulo',
      1,
      '2026-01-01T00:00:00Z',
    );
  seed.close();
  const now = new Date('2026-01-01T12:00:00Z');
  const good = new LocalScheduler(path, 'good', async () =>
    JSON.stringify({
      topic: 'ai',
      stories: [
        {
          title: 'AI',
          url: 'https://source.test/a',
          publishedAt: '2026-01-01T00:00:00Z',
          source: 'source.test',
        },
      ],
      facts: [
        {
          title: 'AI',
          url: 'https://source.test/a',
          publishedAt: '2026-01-01T00:00:00Z',
          source: 'source.test',
        },
      ],
      inference: [],
    }),
  );
  await good.poll(now);
  const execution = good.list()[0];
  assert.match(execution.result ?? '', /source.test/);
  await good.poll(now);
  assert.equal(good.list().length, 1);
  good.close();
  const bad = new LocalScheduler(path, 'bad', async () => {
    throw new Error('rss_unavailable');
  });
  const second = new Database(path);
  second
    .prepare('INSERT INTO tasks VALUES (?,?,?,?,?,?,?,?,?)')
    .run(
      'failure',
      'daily',
      '08:00',
      3,
      'ai',
      1,
      'America/Sao_Paulo',
      1,
      '2026-01-01T00:00:00Z',
    );
  second.close();
  await bad.poll(now);
  const failed = bad.list().find((item) => item.taskId === 'failure');
  assert.equal(failed?.result, null);
  assert.equal(failed?.failure, 'research_failure');
  assert.equal(
    bad.events(failed!.id).some((event) => event.type === 'research_failed'),
    true,
  );
  bad.close();
  rmSync(dir, { recursive: true, force: true });
});

test('records model failures separately from research failures', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tatu-model-failure-'));
  const path = join(dir, 'tatu.sqlite');
  const scheduler = new LocalScheduler(path, 'model-failure', async () => {
    throw new Error('model_invalid_output');
  });
  const db = new Database(path);
  db.prepare('INSERT INTO tasks VALUES (?,?,?,?,?,?,?,?,?)').run(
    'model-failure',
    'daily',
    '08:00',
    1,
    'ai',
    1,
    'America/Sao_Paulo',
    1,
    '2026-01-01T00:00:00Z',
  );
  db.close();
  await scheduler.poll(new Date('2026-01-01T12:00:00Z'));
  const execution = scheduler.list()[0];
  assert.equal(execution.failure, 'model_failure');
  assert.equal(
    scheduler
      .events(execution.id)
      .some((event) => event.type === 'model_failed'),
    true,
  );
  assert.equal(
    scheduler
      .events(execution.id)
      .some((event) => event.type === 'research_failed'),
    false,
  );
  scheduler.close();
  rmSync(dir, { recursive: true, force: true });
});

test('persists a model fallback and records it before success', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tatu-model-fallback-'));
  const path = join(dir, 'tatu.sqlite');
  const scheduler = new LocalScheduler(path, 'model-fallback', async () =>
    JSON.stringify({
      topic: 'ai',
      stories: [
        {
          title: 'AI',
          url: 'https://source.test/a',
          publishedAt: '2026-01-01T00:00:00Z',
          source: 'source.test',
        },
      ],
      facts: [
        {
          title: 'AI',
          url: 'https://source.test/a',
          publishedAt: '2026-01-01T00:00:00Z',
          source: 'source.test',
        },
      ],
      inference: [],
      route: 'deterministic-rss',
      fallback: {
        from: 'local-ollama',
        reason: 'model_invalid_output',
      },
    }),
  );
  const db = new Database(path);
  db.prepare('INSERT INTO tasks VALUES (?,?,?,?,?,?,?,?,?)').run(
    'model-fallback',
    'daily',
    '08:00',
    1,
    'ai',
    1,
    'America/Sao_Paulo',
    1,
    '2026-01-01T00:00:00Z',
  );
  db.close();
  await scheduler.poll(new Date('2026-01-01T12:00:00Z'));
  const execution = scheduler.list()[0];
  assert.equal(execution.status, 'succeeded');
  assert.equal(execution.failure, null);
  assert.match(execution.result ?? '', /model_invalid_output/);
  assert.deepEqual(
    scheduler.events(execution.id).map((event) => event.type),
    ['queued', 'claimed', 'fallback_used', 'succeeded'],
  );
  const fallbackEvent = scheduler
    .events(execution.id)
    .find((event) => event.type === 'fallback_used');
  assert.equal(
    fallbackEvent?.detail,
    'fallback:local-ollama:model_invalid_output',
  );
  assert.doesNotMatch(fallbackEvent?.detail ?? '', /secret|payload|response/i);
  scheduler.close();
  rmSync(dir, { recursive: true, force: true });
});

test('does not create a duplicate or failure while SQLite is busy', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tatu-busy-'));
  const path = join(dir, 'tatu.sqlite');
  const scheduler = new LocalScheduler(path, 'busy');
  const db = new Database(path);
  db.prepare('INSERT INTO tasks VALUES (?,?,?,?,?,?,?,?,?)').run(
    'busy',
    'daily',
    '08:00',
    1,
    'ai',
    1,
    'America/Sao_Paulo',
    1,
    '2026-01-01T00:00:00.000Z',
  );
  db.exec('BEGIN IMMEDIATE');
  await scheduler.poll(new Date('2026-01-01T12:00:00Z'));
  assert.equal(scheduler.list().length, 0);
  db.exec('ROLLBACK');
  db.close();
  await scheduler.poll(new Date('2026-01-01T12:00:00Z'));
  assert.equal(scheduler.list().length, 1);
  assert.equal(scheduler.list()[0].status, 'succeeded');
  scheduler.close();
  rmSync(dir, { recursive: true, force: true });
});

test('passes the durable occurrence key to the executor as idempotencyKey', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tatu-idempotency-'));
  const path = join(dir, 'tatu.sqlite');
  let received: string | undefined;
  const scheduler = new LocalScheduler(path, 'idempotency', (context) => {
    received = context.idempotencyKey;
  });
  const db = new Database(path);
  db.prepare('INSERT INTO tasks VALUES (?,?,?,?,?,?,?,?,?)').run(
    'idempotency',
    'daily',
    '08:00',
    1,
    'ai',
    1,
    'America/Sao_Paulo',
    1,
    '2026-01-01T00:00:00.000Z',
  );
  db.close();
  await scheduler.poll(new Date('2026-01-01T12:00:00Z'));
  assert.equal(received, scheduler.list()[0].occurrenceKey);
  scheduler.close();
  rmSync(dir, { recursive: true, force: true });
});

test('persists a strict delivery receipt and emits delivered before succeeded', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tatu-delivery-event-'));
  const path = join(dir, 'tatu.sqlite');
  const scheduler = new LocalScheduler(
    path,
    'delivery-event',
    async (context) => {
      const artifactId = `${createHash('sha256')
        .update(context.idempotencyKey)
        .digest('hex')}.md`;
      return JSON.stringify({
        topic: 'ai',
        stories: [
          {
            title: 'AI',
            url: 'https://source.test/a',
            publishedAt: '2026-01-01T00:00:00Z',
            source: 'source.test',
          },
        ],
        facts: [
          {
            title: 'AI',
            url: 'https://source.test/a',
            publishedAt: '2026-01-01T00:00:00Z',
            source: 'source.test',
          },
        ],
        inference: [],
        route: 'deterministic-rss',
        delivery: {
          channel: 'file-outbox',
          idempotencyKey: context.idempotencyKey,
          artifactId,
          contentSha256: 'b'.repeat(64),
        },
      });
    },
  );
  const db = new Database(path);
  db.prepare('INSERT INTO tasks VALUES (?,?,?,?,?,?,?,?,?)').run(
    'delivery-event',
    'daily',
    '08:00',
    1,
    'ai',
    1,
    'America/Sao_Paulo',
    1,
    '2026-01-01T00:00:00Z',
  );
  db.close();
  await scheduler.poll(new Date('2026-01-01T12:00:00Z'));
  const execution = scheduler.list()[0];
  assert.equal(execution.status, 'succeeded');
  assert.deepEqual(
    scheduler.events(execution.id).map((event) => event.type),
    ['queued', 'claimed', 'delivered', 'succeeded'],
  );
  scheduler.close();
  const store = new SqliteTaskStore(path);
  assert.equal(store.briefing(execution.id)?.delivery?.channel, 'file-outbox');
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

test('keeps a delivery failure retryable and never reports success', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tatu-delivery-failure-'));
  const path = join(dir, 'tatu.sqlite');
  const scheduler = new LocalScheduler(path, 'delivery-failure', async () => {
    throw new Error('delivery_conflict');
  });
  const db = new Database(path);
  db.prepare('INSERT INTO tasks VALUES (?,?,?,?,?,?,?,?,?)').run(
    'delivery-failure',
    'daily',
    '08:00',
    1,
    'ai',
    1,
    'America/Sao_Paulo',
    1,
    '2026-01-01T00:00:00Z',
  );
  db.close();
  await scheduler.poll(new Date('2026-01-01T12:00:00Z'));
  const execution = scheduler.list()[0];
  assert.equal(execution.status, 'pending');
  assert.equal(execution.failure, 'delivery_failure');
  assert.deepEqual(
    scheduler.events(execution.id).map((event) => event.type),
    ['queued', 'claimed', 'delivery_failed', 'retry_scheduled'],
  );
  scheduler.close();
  rmSync(dir, { recursive: true, force: true });
});
