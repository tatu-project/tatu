import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { LocalScheduler } from '@tatu/storage';
import { createTatuServer } from './index.js';
const phrase =
  'Todos os dias às 8h, encontre as três notícias mais importantes sobre inteligência artificial e me envie.';
test('creates, confirms, and recovers a persisted task', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tatu-'));
  const db = join(dir, 'tatu.sqlite');
  const start = async () => {
    const server = createTatuServer(db);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    return { server, base: `http://127.0.0.1:${address.port}` };
  };
  const first = await start();
  const draft = await fetch(`${first.base}/api/briefing-drafts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: phrase, timezone: 'America/Sao_Paulo' }),
  });
  assert.equal(draft.status, 201);
  const body = (await draft.json()) as { draftId: string };
  const confirmed = await fetch(
    `${first.base}/api/briefing-drafts/${body.draftId}/confirm`,
    { method: 'POST' },
  );
  assert.equal(confirmed.status, 201);
  await new Promise<void>((resolve) => first.server.close(() => resolve()));
  const second = await start();
  const tasks = (await fetch(`${second.base}/api/tasks`).then((r) =>
    r.json(),
  )) as Array<{ enabled: boolean; time: string }>;
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].enabled, true);
  assert.equal(tasks[0].time, '08:00');
  await new Promise<void>((resolve) => second.server.close(() => resolve()));
  rmSync(dir, { recursive: true, force: true });
});

test('rejects an oversized draft body without persisting a task', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tatu-limit-'));
  const server = createTatuServer(join(dir, 'tatu.sqlite'));
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const response = await fetch(`${base}/api/briefing-drafts`, {
    method: 'POST',
    body: JSON.stringify({
      message: 'x'.repeat(256 * 1024),
      timezone: 'America/Sao_Paulo',
    }),
  });
  assert.equal(response.status, 413);
  assert.deepEqual(
    await fetch(`${base}/api/tasks`).then((item) => item.json()),
    [],
  );
  await new Promise<void>((resolve) => server.close(() => resolve()));
  rmSync(dir, { recursive: true, force: true });
});

test('exposes persisted execution events through the API', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tatu-events-'));
  const db = join(dir, 'tatu.sqlite');
  const server = createTatuServer(db);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const draft = await fetch(`${base}/api/briefing-drafts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: phrase, timezone: 'America/Sao_Paulo' }),
  });
  const { draftId } = (await draft.json()) as { draftId: string };
  await fetch(`${base}/api/briefing-drafts/${draftId}/confirm`, {
    method: 'POST',
  });
  const scheduler = new LocalScheduler(db, 'api-test', async (context) =>
    JSON.stringify({
      topic: 'inteligência artificial',
      stories: [
        {
          title: 'AI story',
          url: 'https://source.test/story',
          publishedAt: '2026-09-15T00:00:00.000Z',
          source: 'source.test',
          providerPayload: 'must not cross the public API boundary',
        },
      ],
      facts: [
        {
          title: 'AI story',
          url: 'https://source.test/story',
          publishedAt: '2026-09-15T00:00:00.000Z',
          source: 'source.test',
          providerPayload: 'must not cross the public API boundary',
        },
      ],
      inference: [],
      route: 'deterministic-rss',
      fallback: {
        from: 'local-ollama',
        reason: 'model_unavailable',
      },
      observability: {
        provider: 'public-rss',
        model: null,
        tools: ['public-rss', 'local-ollama', 'file-outbox'],
        latencyMs: 7,
        estimatedCost: { status: 'unknown' },
      },
      delivery: {
        channel: 'file-outbox',
        idempotencyKey: context.idempotencyKey,
        artifactId: `${'a'.repeat(64)}.md`,
        contentSha256: 'b'.repeat(64),
      },
      providerPayload: 'must not cross the public API boundary',
    }),
  );
  await scheduler.poll(new Date(Date.now() + 24 * 60 * 60 * 1000));
  scheduler.close();
  const executions = (await fetch(`${base}/api/executions`).then((response) =>
    response.json(),
  )) as Array<{
    id: string;
    occurrenceKey?: string;
    result?: string;
    claimedBy?: string;
  }>;
  assert.equal(executions.length, 1);
  assert.equal('occurrenceKey' in executions[0], false);
  assert.equal('result' in executions[0], false);
  assert.equal('claimedBy' in executions[0], false);
  const events = (await fetch(
    `${base}/api/executions/${executions[0].id}/events`,
  ).then((response) => response.json())) as Array<{
    type: string;
    detail: string | null;
  }>;
  assert.equal(
    events.every((event) => event.detail === null),
    true,
  );
  assert.deepEqual(
    events.map((event) => event.type),
    ['queued', 'claimed', 'fallback_used', 'delivered', 'succeeded'],
  );
  const savedBriefing = await fetch(
    `${base}/api/executions/${executions[0].id}/briefing`,
  );
  assert.equal(savedBriefing.status, 200);
  const publicBriefing = (await savedBriefing.json()) as {
    stories: Array<{ url: string; providerPayload?: unknown }>;
    fallback?: unknown;
    delivery: Record<string, unknown>;
    providerPayload?: unknown;
  };
  assert.equal(publicBriefing.stories[0].url, 'https://source.test/story');
  assert.equal('providerPayload' in publicBriefing.stories[0], false);
  assert.deepEqual(
    (
      await fetch(`${base}/api/executions/${executions[0].id}/briefing`).then(
        (response) => response.json(),
      )
    ).fallback,
    {
      from: 'local-ollama',
      reason: 'model_unavailable',
    },
  );
  assert.equal('providerPayload' in publicBriefing, false);
  assert.equal('idempotencyKey' in publicBriefing.delivery, false);
  assert.deepEqual(publicBriefing.delivery, {
    channel: 'file-outbox',
    artifactId: `${'a'.repeat(64)}.md`,
    contentSha256: 'b'.repeat(64),
  });
  const observability = (
    await fetch(`${base}/api/executions/${executions[0].id}/briefing`).then(
      (response) => response.json(),
    )
  ).observability as {
    provider: string;
    model: string | null;
    tools: string[];
    latencyMs: number;
    estimatedCost: { status: string };
  };
  assert.deepEqual(observability, {
    provider: 'public-rss',
    model: null,
    tools: ['public-rss', 'local-ollama', 'file-outbox'],
    latencyMs: 7,
    estimatedCost: { status: 'unknown' },
  });
  await new Promise<void>((resolve) => server.close(() => resolve()));
  rmSync(dir, { recursive: true, force: true });
});
