/** Isolated release check. Default RSS is a labelled child-only fixture; --live uses the real feed. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import process from 'node:process';
import console from 'node:console';
const { fetch, AbortSignal } = globalThis;

const live = process.argv.includes('--live');
const directory = mkdtempSync(join(tmpdir(), 'tatu-release-'));
const children = new Set();
const probe = createServer();
await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const base = `http://127.0.0.1:${port}`;
const environment = {
  ...process.env,
  PORT: String(port),
  TATU_BIND_HOST: '127.0.0.1',
  TATU_DATABASE_PATH: join(directory, 'tatu.sqlite'),
  TATU_DELIVERY_DIR: join(directory, 'deliveries'),
  TATU_HEARTBEAT_PATH: join(directory, 'heartbeat.json'),
  TATU_WORKER_POLL_MS: '500',
  TATU_CHAT_MODEL: 'tatu-intentionally-missing-model',
  TATU_CHAT_TIMEOUT_MS: '1000',
  TATU_OLLAMA_MODEL: '',
  TATU_OLLAMA_BASE_URL: 'http://127.0.0.1:1',
  TATU_TIMEZONE: 'UTC',
  TATU_EXECUTION_TIMEOUT_MS: '25000',
  TATU_MAX_ATTEMPTS: '3',
  TATU_LEASE_SECONDS: '30',
  TATU_RSS_FEEDS: live
    ? 'https://techcrunch.com/category/artificial-intelligence/feed/'
    : 'https://fixture.tatu.invalid/rss',
};
const fixturePath = join(directory, 'fixture.mjs');
if (!live) {
  const stories = [1, 2, 3]
    .map(
      (number) =>
        `<item><title>Artificial intelligence fixture ${number}</title><link>https://fixture.tatu.invalid/story-${number}</link><pubDate>${new Date().toUTCString()}</pubDate><description>Explicit local fixture story.</description></item>`,
    )
    .join('');
  writeFileSync(
    fixturePath,
    `import dns from 'node:dns/promises'; import {syncBuiltinESMExports} from 'node:module';
const originalLookup=dns.lookup;dns.lookup=async(host,...args)=>host==='fixture.tatu.invalid'?[{address:'93.184.216.34',family:4}]:originalLookup(host,...args);syncBuiltinESMExports();
const originalFetch=globalThis.fetch;globalThis.fetch=(url,options)=>String(url)==='https://fixture.tatu.invalid/rss'?Promise.resolve(new Response(${JSON.stringify(`<rss><channel>${stories}</channel></rss>`)},{status:200,headers:{'content-type':'application/rss+xml'}})):originalFetch(url,options);`,
  );
}
const launch = (path, fixture = false) => {
  const child = spawn(
    process.execPath,
    [
      ...(fixture && !live
        ? ['--import', pathToFileURL(fixturePath).href]
        : []),
      path,
    ],
    { env: environment, stdio: ['ignore', 'ignore', 'pipe'] },
  );
  children.add(child);
  child.on('error', () => {});
  child.stderr.resume();
  return child;
};
const stop = async (child) => {
  if (child.exitCode !== null || child.signalCode !== null) {
    children.delete(child);
    return;
  }
  const closed = new Promise((resolve) => child.once('close', resolve));
  child.kill('SIGTERM');
  await Promise.race([closed, sleep(2000)]);
  if (child.exitCode === null && child.signalCode === null)
    child.kill('SIGKILL');
  await closed;
  children.delete(child);
};
const request = async (
  path,
  method = 'GET',
  body,
  expected = 200,
  headers = {},
) => {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(10000),
  });
  const value = response.status === 204 ? null : await response.json();
  assert.equal(
    response.status,
    expected,
    `${method} ${path}: ${JSON.stringify(value)}`,
  );
  return value;
};
const waitFor = async (operation, timeout = 15000) => {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const result = await operation();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await sleep(200);
  }
  throw lastError ?? new Error('Timed out waiting for release check.');
};
try {
  let api = launch('apps/api/dist/index.js');
  await waitFor(() => request('/api/health'));
  const denied = await fetch(`${base}/api/tasks`, {
    headers: { origin: 'https://hostile.invalid' },
  });
  assert.equal(denied.status, 403);
  const unavailable = await request('/api/assistant/status');
  assert.equal(unavailable.available, false);
  const note = await request(
    '/api/notes',
    'POST',
    { title: 'Release smoke', content: 'Local note content' },
    201,
  );
  const editedNote = await request(`/api/notes/${note.id}`, 'PATCH', {
    title: 'Edited note',
    content: 'Revised content',
    revision: note.revision,
  });
  await request(
    `/api/notes/${note.id}`,
    'PATCH',
    { title: 'Stale title', content: 'Stale edit', revision: note.revision },
    409,
  );
  assert.notEqual(editedNote.revision, note.revision);
  const memory = await request(
    '/api/memories',
    'POST',
    { category: 'preference', content: 'Prefiro respostas em português.' },
    201,
  );
  const updatedMemory = await request(`/api/memories/${memory.id}`, 'PATCH', {
    content: 'Prefiro respostas breves.',
    category: 'preference',
  });
  assert.equal(updatedMemory.content, 'Prefiro respostas breves.');
  const draft = await request(
    '/api/briefing-drafts',
    'POST',
    {
      message:
        'Todos os dias às 8h, encontre as três notícias mais importantes sobre inteligência artificial e me envie.',
      timezone: 'UTC',
    },
    201,
  );
  const task = await request(
    `/api/briefing-drafts/${draft.draftId}/confirm`,
    'POST',
    undefined,
    201,
  );
  await request(`/api/tasks/${task.id}`, 'PATCH', { enabled: false });
  await request(`/api/tasks/${task.id}/test`, 'POST', undefined, 409, {
    'idempotency-key': 'paused-smoke',
  });
  const due = new Date(Math.ceil((Date.now() + 20000) / 60000) * 60000);
  const time = due.toISOString().slice(11, 16);
  await request(`/api/tasks/${task.id}`, 'PATCH', {
    time,
    timezone: 'UTC',
    quantity: 3,
    enabled: true,
  });
  const key = 'release-smoke-repeat';
  const manual = await request(
    `/api/tasks/${task.id}/test`,
    'POST',
    undefined,
    202,
    { 'idempotency-key': key },
  );
  const repeated = await request(
    `/api/tasks/${task.id}/test`,
    'POST',
    undefined,
    202,
    { 'idempotency-key': key },
  );
  assert.equal(manual.id, repeated.id);
  await stop(api);
  api = launch('apps/api/dist/index.js');
  await waitFor(() => request('/api/health'));
  assert.ok(
    (await request('/api/tasks')).some(
      (item) => item.id === task.id && item.time === time,
    ),
  );
  let worker = launch('apps/worker/dist/index.js', true);
  const completed = await waitFor(
    async () =>
      (await request('/api/executions')).find(
        (item) => item.id === manual.id && item.status === 'succeeded',
      ),
    live ? 90000 : 15000,
  );
  const briefing = await request(`/api/executions/${completed.id}/briefing`);
  assert.equal(briefing.facts.length, 3);
  assert.equal(new Set(briefing.facts.map((item) => item.url)).size, 3);
  const events = await request(`/api/executions/${completed.id}/events`);
  assert.ok(events.some((event) => event.type === 'delivered'));
  await stop(worker);
  worker = launch('apps/worker/dist/index.js', true);
  await waitFor(
    async () =>
      (await request('/api/executions')).find(
        (item) =>
          item.id !== manual.id &&
          item.status === 'succeeded' &&
          item.scheduledFor === due.toISOString(),
      ),
    Math.max(15000, due.getTime() - Date.now() + 90000),
  );
  await sleep(800);
  const executions = await request('/api/executions');
  assert.equal(
    executions.filter((item) => item.scheduledFor === due.toISOString()).length,
    1,
  );
  assert.equal(
    readdirSync(environment.TATU_DELIVERY_DIR).filter((name) =>
      name.endsWith('.md'),
    ).length,
    2,
  );
  await request(`/api/notes/${note.id}`, 'DELETE', undefined, 204);
  await request(`/api/memories/${memory.id}`, 'DELETE', undefined, 204);
  assert.equal((await request('/api/notes')).length, 0);
  assert.equal((await request('/api/memories')).length, 0);
  console.log(
    JSON.stringify({
      source: live ? 'real-public-rss' : 'explicit-local-rss-fixture',
      apiRestart: true,
      workerRestart: true,
      scheduledRealClock: true,
      manualIdempotency: true,
      taskControls: true,
      noteMemoryRevisionDeletion: true,
      modelUnavailable: true,
      savedBriefings: 2,
      hostileOrigin: 403,
      elapsedDayGate: false,
    }),
  );
} finally {
  await Promise.all([...children].map(stop));
  rmSync(directory, { recursive: true, force: true });
}
