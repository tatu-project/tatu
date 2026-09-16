import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import test from 'node:test';
import { SqliteTaskStore } from './sqlite-task-store.js';

test('does not return a briefing with malformed observability metadata', () => {
  const directory = mkdtempSync(join(tmpdir(), 'tatu-store-observability-'));
  const databasePath = join(directory, 'tatu.sqlite');
  const stamp = '2026-09-15T00:00:00.000Z';
  const story = {
    title: 'AI story',
    url: 'https://source.test/story',
    publishedAt: stamp,
    source: 'source.test',
  };
  const resultFor = (model: unknown) =>
    JSON.stringify({
      topic: 'AI',
      stories: [story],
      facts: [story],
      inference: [],
      route: 'deterministic-rss',
      model,
      observability: {
        provider: 'public-rss',
        model: null,
        tools: ['public-rss'],
        latencyMs: 0,
        estimatedCost: { status: 'known' },
      },
    });

  try {
    const initial = new SqliteTaskStore(databasePath);
    initial.close();
    const database = new Database(databasePath);
    const insert = database.prepare(
      'INSERT INTO executions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    );
    for (const [id, model] of [
      ['execution', null],
      ['execution-primitive', 'invalid'],
    ] as const) {
      insert.run(
        id,
        'task',
        `occurrence-${id}`,
        stamp,
        'succeeded',
        1,
        1,
        stamp,
        null,
        null,
        resultFor(model),
        null,
        stamp,
        stamp,
      );
    }
    database.close();

    const store = new SqliteTaskStore(databasePath);
    assert.equal(store.briefing('execution'), undefined);
    assert.equal(store.briefing('execution-primitive'), undefined);
    store.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('does not return a briefing with a sensitive cited URL query', () => {
  const directory = mkdtempSync(join(tmpdir(), 'tatu-store-url-policy-'));
  const databasePath = join(directory, 'tatu.sqlite');
  const stamp = '2026-09-15T00:00:00.000Z';
  const story = {
    title: 'AI story',
    url: 'https://source.test/story?access_token=raw-secret',
    publishedAt: stamp,
    source: 'source.test',
  };
  try {
    const initial = new SqliteTaskStore(databasePath);
    initial.close();
    const database = new Database(databasePath);
    database
      .prepare('INSERT INTO executions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(
        'execution',
        'task',
        'occurrence-execution',
        stamp,
        'succeeded',
        1,
        1,
        stamp,
        null,
        null,
        JSON.stringify({
          topic: 'AI',
          stories: [story],
          facts: [story],
          inference: [],
          route: 'deterministic-rss',
        }),
        null,
        stamp,
        stamp,
      );
    database.close();

    const store = new SqliteTaskStore(databasePath);
    assert.equal(store.briefing('execution'), undefined);
    store.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
