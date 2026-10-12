import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createCloudWorker } from './index.js';
import { createTestD1 } from './test-d1.js';
import type { RemoteServices } from './types.js';

test('portable Cron advertises configuration while an unverified Sites bridge does not', async () => {
  const configuration = JSON.parse(
    readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8').replace(
      /,\s*([}\]])/gu,
      '$1',
    ),
  ) as { vars: { SCHEDULER_ENABLED: string }; triggers: { crons: string[] } };
  assert.deepEqual(configuration.triggers.crons, ['* * * * *']);
  assert.equal(configuration.vars.SCHEDULER_ENABLED, 'true');
  const db = createTestD1();
  const services: RemoteServices = {
    reply: async () => {
      throw new Error('unused');
    },
    status: async () => ({
      configured: false,
      available: false,
      model: null,
      reason: 'not_configured',
    }),
    connections: async () => [],
    connect: async () => {
      throw new Error('unused');
    },
    disconnect: async () => false,
  };
  const worker = createCloudWorker({
    authenticate: async () => ({
      issuer: 'test-only',
      subject: 'runtime-health-owner',
    }),
    services: () => services,
  });
  const origin = 'https://tatu.test';
  try {
    for (const [enabled, expected] of [
      [configuration.vars.SCHEDULER_ENABLED, 'configured'],
      [undefined, 'unavailable'],
      ['false', 'unavailable'],
    ] as const) {
      const response = await worker.fetch(
        new Request(`${origin}/api/setup-health`),
        { DB: db, SITE_ORIGIN: origin, SCHEDULER_ENABLED: enabled },
      );
      assert.equal(response.status, 200);
      const health = (await response.json()) as {
        checks: { id: string; state: string }[];
      };
      assert.equal(
        health.checks.find((check) => check.id === 'scheduler')?.state,
        expected,
      );
    }
  } finally {
    db.close();
  }
});
