import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { loadEnvironment, supervise } from './runtime.mjs';

test('dotenv preserves explicit process configuration including blank values', () => {
  const directory = mkdtempSync(join(tmpdir(), 'tatu-env-'));
  try {
    const file = join(directory, '.env');
    writeFileSync(
      file,
      'PORT=4000\nTATU_CHAT_MODEL="tiny local"\nTATU_RSS_FEEDS=default\n',
    );
    const environment = { PORT: '3001', TATU_RSS_FEEDS: '' };
    loadEnvironment(file, environment);
    assert.deepEqual(environment, {
      PORT: '3001',
      TATU_RSS_FEEDS: '',
      TATU_CHAT_MODEL: 'tiny local',
    });
    assert.deepEqual(loadEnvironment(join(directory, 'absent'), {}), {});
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('supervisor bounds retries after either clean or failed unexpected exits', async () => {
  for (const code of [0, 2]) {
    const events = [];
    const runtime = supervise([['-e', `process.exit(${code})`]], {
      retries: 2,
      backoffMs: 10,
      graceMs: 20,
      onEvent: (event) => events.push(event),
    });
    assert.equal(await runtime.done, 1);
    assert.equal(events.length, 3);
  }
});

test('supervisor cleans up its direct children on explicit shutdown', async () => {
  const runtime = supervise([['-e', 'setInterval(()=>{},1000)']], {
    graceMs: 50,
  });
  await sleep(30);
  assert.equal(await runtime.stop(), 0);
  assert.equal(await runtime.done, 0);
});

test('supervisor handles a synchronous spawn failure', async () => {
  const runtime = supervise([['unavailable']], {
    spawnChild: () => {
      throw new Error('private details');
    },
    graceMs: 10,
  });
  assert.equal(await runtime.done, 1);
});
