import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { LocalScheduler } from '@tatu/storage';
import type { BriefingResult, TatuStore } from '@tatu/shared';
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

test('rejects a credential-bearing topic before task persistence', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tatu-topic-secret-'));
  const server = createTatuServer(join(dir, 'tatu.sqlite'));
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const response = await fetch(`${base}/api/briefing-drafts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      message:
        'Todos os dias as 8h, encontre as 3 noticias mais importantes sobre api_key=abcdEFGH1234 e me envie.',
      timezone: 'America/Sao_Paulo',
    }),
  });
  assert.equal(response.status, 422);
  assert.match((await response.json()).clarification, /credencial/iu);
  assert.deepEqual(
    await fetch(`${base}/api/tasks`).then((item) => item.json()),
    [],
  );
  await new Promise<void>((resolve) => server.close(() => resolve()));
  rmSync(dir, { recursive: true, force: true });
});

test('redacts credential patterns from legacy task topics in the public API', async () => {
  const repository = {
    create: () => {
      throw new Error('not used');
    },
    list: () => [
      {
        id: 'legacy-task',
        cadence: 'daily',
        time: '08:00',
        quantity: 3,
        topic: 'api_key=abcdEFGH1234',
        deliveryRequested: true,
        timezone: 'America/Sao_Paulo',
        enabled: true,
        createdAt: '2026-09-15T00:00:00.000Z',
        providerPayload: 'must not cross the public API boundary',
      },
    ],
    listExecutions: () => [],
    events: () => [],
    briefing: () => undefined,
    close: () => undefined,
  } as unknown as TatuStore;
  const server = createTatuServer('unused', repository);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/tasks`);
    const body = await response.text();
    assert.equal(response.status, 200);
    assert.doesNotMatch(body, /abcdEFGH1234/);
    assert.match(body, /api_key=\[REDACTED\]/u);
    assert.doesNotMatch(body, /providerPayload/);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('redacts credential patterns from a defensive public projection', async () => {
  const unsafe: BriefingResult = {
    topic: 'api_key=abcdEFGH1234',
    stories: [
      {
        title: 'Authorization: Bearer abcdefghijkl',
        url: 'https://source.test/story?token=x',
        publishedAt: '2026-09-15T00:00:00.000Z',
        source: 'source.test',
      },
    ],
    facts: [
      {
        title: 'AI story',
        url: 'https://source.test/story',
        publishedAt: '2026-09-15T00:00:00.000Z',
        source: 'password=abcdEFGH1234',
      },
    ],
    inference: ['client_secret=abcdEFGH1234'],
    route: 'local-ollama',
    model: { id: 'private_key=abcdEFGH1234', route: 'local-ollama' },
    observability: {
      provider: 'local-ollama',
      model: 'token=abcdEFGH1234',
      tools: ['public-rss', 'local-ollama'],
      latencyMs: 1,
      estimatedCost: { status: 'unknown' },
    },
  };
  const repository = {
    create: () => {
      throw new Error('not used');
    },
    list: () => [],
    listExecutions: () => [
      {
        id: 'execution',
        taskId: 'task',
        occurrenceKey: 'internal',
        scheduledFor: '2026-09-15T00:00:00.000Z',
        status: 'succeeded',
        attempt: 1,
        maxAttempts: 1,
        availableAt: '2026-09-15T00:00:00.000Z',
        leaseExpiresAt: null,
        claimedBy: 'worker',
        result: JSON.stringify(unsafe),
        failure: 'authorization=Bearer abcdefghijkl',
        createdAt: '2026-09-15T00:00:00.000Z',
        updatedAt: '2026-09-15T00:00:00.000Z',
      },
    ],
    events: () => [],
    briefing: () => unsafe,
    close: () => undefined,
  } as unknown as TatuStore;
  const server = createTatuServer('unused', repository);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const briefingResponse = await fetch(
    `${base}/api/executions/execution/briefing`,
  );
  const briefingText = await briefingResponse.text();
  assert.equal(briefingResponse.status, 200);
  assert.doesNotMatch(briefingText, /abcdEFGH1234|abcdefghijkl/);
  assert.match(briefingText, /REDACTED/);
  const executions = (await fetch(`${base}/api/executions`).then((response) =>
    response.json(),
  )) as Array<{ failure: string | null }>;
  assert.equal(executions[0].failure, 'execution_failed');
  await new Promise<void>((resolve) => server.close(() => resolve()));
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

test('queues a manual test execution idempotently without exposing its key', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tatu-manual-'));
  const db = join(dir, 'tatu.sqlite');
  const server = createTatuServer(db);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const base = `http://127.0.0.1:${address.port}`;
    const draft = await fetch(`${base}/api/briefing-drafts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: phrase, timezone: 'America/Sao_Paulo' }),
    });
    const { draftId } = (await draft.json()) as { draftId: string };
    const confirmed = await fetch(
      `${base}/api/briefing-drafts/${draftId}/confirm`,
      { method: 'POST' },
    );
    const task = (await confirmed.json()) as { id: string };
    const missing = await fetch(`${base}/api/tasks/${task.id}/test`, {
      method: 'POST',
    });
    assert.equal(missing.status, 400);
    const oversized = await fetch(`${base}/api/tasks/${task.id}/test`, {
      method: 'POST',
      headers: { 'Idempotency-Key': 'x'.repeat(257) },
    });
    assert.equal(oversized.status, 400);
    const unknownTask = await fetch(`${base}/api/tasks/missing/test`, {
      method: 'POST',
      headers: { 'Idempotency-Key': 'manual-check-unknown' },
    });
    assert.equal(unknownTask.status, 404);

    const first = await fetch(`${base}/api/tasks/${task.id}/test`, {
      method: 'POST',
      headers: { 'Idempotency-Key': 'manual-check-1' },
    });
    assert.equal(first.status, 202);
    const firstBody = (await first.json()) as {
      id: string;
      occurrenceKey?: string;
    };
    assert.equal('occurrenceKey' in firstBody, false);
    const duplicate = await fetch(`${base}/api/tasks/${task.id}/test`, {
      method: 'POST',
      headers: { 'Idempotency-Key': 'manual-check-1' },
    });
    assert.equal(duplicate.status, 202);
    assert.equal(((await duplicate.json()) as { id: string }).id, firstBody.id);
    const second = await fetch(`${base}/api/tasks/${task.id}/test`, {
      method: 'POST',
      headers: { 'Idempotency-Key': 'manual-check-2' },
    });
    assert.equal(second.status, 202);
    assert.notEqual(((await second.json()) as { id: string }).id, firstBody.id);
    const executions = (await fetch(`${base}/api/executions`).then((r) =>
      r.json(),
    )) as Array<{ id: string }>;
    assert.equal(executions.length, 2);
    assert.equal(
      (
        await fetch(`${base}/api/executions/${firstBody.id}/events`).then((r) =>
          r.json(),
        )
      ).length,
      1,
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(dir, { recursive: true, force: true });
  }
});
