import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readWorkerHealth } from './runtime-health.js';

test('only bounded recent valid successful worker heartbeats report healthy', () => {
  const directory = mkdtempSync(join(tmpdir(), 'tatu-heartbeat-'));
  const path = join(directory, 'worker-heartbeat.json');
  const environment = { TATU_DATABASE_PATH: join(directory, 'tatu.sqlite') };
  const now = new Date('2026-10-12T12:00:00.000Z');
  try {
    assert.equal(readWorkerHealth(environment, now).status, 'unavailable');
    const put = (at: string, state: string) =>
      writeFileSync(path, JSON.stringify({ at, state }));
    put(now.toISOString(), 'polling');
    assert.deepEqual(readWorkerHealth(environment, now), {
      status: 'healthy',
      lastSeenAt: now.toISOString(),
      polling: true,
    });
    put(now.toISOString(), 'error');
    assert.equal(readWorkerHealth(environment, now).status, 'unavailable');
    put('2026-10-12T11:59:00.000Z', 'idle');
    assert.equal(readWorkerHealth(environment, now).status, 'stale');
    put('2026-10-12T12:00:06.000Z', 'idle');
    assert.equal(readWorkerHealth(environment, now).status, 'invalid');
    for (const value of [
      'invalid',
      '{}',
      'x'.repeat(1025),
      JSON.stringify({ at: now.toISOString(), state: 'idle', secret: 'no' }),
    ]) {
      writeFileSync(path, value);
      assert.equal(readWorkerHealth(environment, now).status, 'invalid');
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
