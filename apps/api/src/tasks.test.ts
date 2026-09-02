import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
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
