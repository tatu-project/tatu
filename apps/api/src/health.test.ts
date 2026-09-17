import assert from 'node:assert/strict';
import test from 'node:test';

import { createTatuServer, getSetupHealthStatus } from './index.js';

test('serves the health contract', async (context) => {
  const server = createTatuServer();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  context.after(() => server.close());

  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const response = await fetch(`http://127.0.0.1:${address.port}/api/health`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    service: 'tatu',
    stage: 'technical-foundation',
    status: 'healthy',
  });
});

test('serves a secret-free setup health contract', async (context) => {
  const server = createTatuServer();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  context.after(() => server.close());

  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const response = await fetch(
    `http://127.0.0.1:${address.port}/api/setup-health`,
  );

  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    checks: Array<{ id: string; state: string }>;
    estimatedCost: { status: string };
    nextTask: unknown;
  };
  assert.deepEqual(
    body.checks.map((check) => [check.id, check.state]),
    [
      ['agent', 'healthy'],
      ['storage', 'healthy'],
      ['ai-route', 'configured'],
      ['research', 'configured'],
      ['memory', 'not_implemented'],
      ['scheduler', 'unknown'],
    ],
  );
  assert.deepEqual(body.estimatedCost, { status: 'unknown' });
  assert.equal(body.nextTask, null);
  assert.equal(JSON.stringify(body).includes('data/tatu.sqlite'), false);
});

test('reports disabled research without exposing configuration values', () => {
  const repository = {
    list: () => [
      { enabled: true, time: '08:00', timezone: 'America/Sao_Paulo' },
    ],
  } as unknown as Parameters<typeof getSetupHealthStatus>[0];
  const body = getSetupHealthStatus(repository, {
    TATU_RSS_FEEDS: ' , ',
    TATU_OLLAMA_MODEL: 'private-model-name',
    TATU_OLLAMA_BASE_URL: 'http://user:secret@127.0.0.1:11434',
  });
  const research = body.checks.find((check) => check.id === 'research');
  const aiRoute = body.checks.find((check) => check.id === 'ai-route');
  assert.deepEqual(research && [research.state, research.detail], [
    'disabled',
    'Research is disabled by configuration.',
  ]);
  assert.deepEqual(aiRoute && [aiRoute.state, aiRoute.detail], [
    'configured',
    'A local model route is configured.',
  ]);
  assert.deepEqual(body.nextTask, {
    time: '08:00',
    timezone: 'America/Sao_Paulo',
  });
  assert.equal(JSON.stringify(body).includes('private-model-name'), false);
  assert.equal(JSON.stringify(body).includes('secret@'), false);
});

test('serves the Tatu Health page', async (context) => {
  const server = createTatuServer();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  context.after(() => server.close());

  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const response = await fetch(`http://127.0.0.1:${address.port}/`);

  assert.equal(response.status, 200);
  const page = await response.text();
  assert.match(page, /Tatu Health/);
  assert.match(page, /Setup Health/);
  assert.match(page, /fetch\('\/api\/setup-health'\)/);
  assert.match(page, /id="executions-title"/);
  assert.match(page, /fetch\('\/api\/executions'\)/);
  assert.match(page, /Testar agora/);
  assert.match(
    page,
    /fetch\('\/api\/tasks\/'.*encodeURIComponent\(taskId\).*\/test'/,
  );
  assert.match(page, /'Idempotency-Key': key/);
  assert.match(page, /safeBriefingPreview/);
  assert.match(page, /Briefing preview/);
  assert.match(
    page,
    /\/api\/executions\/.*encodeURIComponent\(execution\.id\).*\/events/,
  );
  assert.match(
    page,
    /\/api\/executions\/.*encodeURIComponent\(execution\.id\).*\/briefing/,
  );
  assert.match(page, /function safeBriefingPreview\(value\)/);
  assert.match(page, /safeBriefingPreview\(briefing\)/);
  assert.match(page, /Estimated cost: unknown/);
  assert.match(page, /Measured latency:/);
});
