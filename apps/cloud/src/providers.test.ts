import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createTestD1 } from './test-d1.js';
import { sealSecret, openSecret } from './vault.js';
import { reserveQuota, QuotaError } from './quota.js';
import { createRemoteServices, ProviderError } from './providers.js';
import type { D1Database, D1PreparedStatement } from './types.js';
const master = btoa('a'.repeat(32)),
  key = 'gsk_' + 'a'.repeat(40);
// SQLite executes the actual D1 statements atomically; HTTP is an explicit fixture.
function fixture(t: TestContext) {
  const DB = createTestD1();
  const sqlite = DB.database;
  for (const id of ['alice', 'bob'])
    sqlite
      .prepare('INSERT INTO owners VALUES(?,?,?,?)')
      .run(id, 'fixture', id, 'today');
  t.after(() => DB.close());
  return { DB, sqlite };
}
test('AES vault uses random nonces and binds owner/provider/version/keyId; original-key restore works', async () => {
  const sealed = await sealSecret(key, master, 'v1', 'alice', 'groq');
  assert.notEqual(
    sealed.nonce,
    (await sealSecret(key, master, 'v1', 'alice', 'groq')).nonce,
  );
  assert.equal(await openSecret(sealed, master, 'v1', 'alice', 'groq'), key);
  for (const [secret, kid, owner, provider] of [
    [master, 'v1', 'bob', 'groq'],
    [master, 'v1', 'alice', 'other'],
    [master, 'v2', 'alice', 'groq'],
    [btoa('b'.repeat(32)), 'v1', 'alice', 'groq'],
  ])
    await assert.rejects(
      openSecret(sealed, secret, kid, owner, provider),
      /vault_unavailable/,
    );
  await assert.rejects(
    openSecret(
      { ...sealed, version: 2 } as unknown as typeof sealed,
      master,
      'v1',
      'alice',
      'groq',
    ),
  );
  assert.equal(
    await openSecret(
      JSON.parse(JSON.stringify(sealed)),
      master,
      'v1',
      'alice',
      'groq',
    ),
    key,
  );
  assert.ok(!JSON.stringify(sealed).includes(key));
});
test('actual atomic SQL rejects concurrent reservations, persists consumed budget and resets next window', async (t) => {
  const { DB } = fixture(t);
  const limits = {
    minuteRequests: 2,
    dayRequests: 3,
    minuteUnits: 100,
    dayUnits: 200,
    concurrency: 1,
  };
  const now = Date.UTC(2026, 9, 12);
  const results = await Promise.allSettled([
    reserveQuota(DB, 'alice', 'groq', 40, limits, now),
    reserveQuota(DB, 'alice', 'groq', 40, limits, now),
  ]);
  assert.equal(
    results.filter((result) => result.status === 'fulfilled').length,
    1,
  );
  for (const result of results)
    if (result.status === 'fulfilled') await result.value();
  const release = await reserveQuota(
    DB,
    'alice',
    'groq',
    40,
    limits,
    now + 500,
  );
  await release();
  await assert.rejects(
    reserveQuota(DB, 'alice', 'groq', 1, limits, now + 1000),
    QuotaError,
  );
  await (
    await reserveQuota(DB, 'alice', 'groq', 40, limits, now + 60000)
  )();
  await assert.rejects(
    reserveQuota(DB, 'alice', 'groq', 1, limits, now + 120000),
    QuotaError,
  );
  await (
    await reserveQuota(DB, 'alice', 'groq', 40, limits, now + 86400000)
  )();
  await (
    await reserveQuota(DB, 'bob', 'groq', 40, limits, now)
  )();
});
test('Groq connection validates allowlisted TLS endpoint, encrypts storage, isolates owners and deletes key', async (t) => {
  const { DB, sqlite } = fixture(t);
  const calls: { url: string; headers: Headers }[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), headers: new Headers(init?.headers) });
    assert.equal(init?.redirect, 'manual');
    return Response.json({ data: [{ id: 'openai/gpt-oss-20b' }] });
  };
  const services = createRemoteServices(
    { DB, TATU_ENCRYPTION_KEY: master },
    fetcher,
  );
  assert.deepEqual(await services.connections('alice'), []);
  await services.connect('alice', { provider: 'groq', apiKey: key });
  assert.equal(calls[0].url, 'https://api.groq.com/openai/v1/models');
  assert.equal(calls[0].headers.get('authorization'), 'Bearer ' + key);
  assert.ok(
    !JSON.stringify(
      sqlite.prepare('SELECT * FROM provider_connections').all(),
    ).includes(key),
  );
  assert.ok(!JSON.stringify(await services.connections('alice')).includes(key));
  assert.deepEqual(await services.connections('bob'), []);
  const status = await services.status('alice');
  assert.equal(status.configured, true);
  assert.equal(status.available, false);
  assert.equal(await services.disconnect('bob', 'groq'), false);
  assert.equal(await services.disconnect('alice', 'groq'), true);
  assert.deepEqual(await services.connections('alice'), []);
  await assert.rejects(
    services.connect('alice', {
      provider: 'groq',
      apiKey: key,
      endpoint: 'https://attacker.example',
    }),
    ProviderError,
  );
  assert.equal(calls.length, 1);
});
test('provider quota prevents network dispatch; outputs are projected; 429 persists cooldown; wrong-key fails closed', async (t) => {
  const { DB } = fixture(t);
  let mode = 'connect',
    calls = 0;
  const fetcher: typeof fetch = async (_input, init) => {
    calls++;
    const payload = init?.body ? JSON.parse(String(init.body)) : null;
    if (!payload)
      return Response.json({ data: [{ id: 'openai/gpt-oss-20b' }] });
    assert.equal(payload.model, 'openai/gpt-oss-20b');
    assert.equal(payload.max_completion_tokens, 1024);
    assert.equal(payload.stream, false);
    if (mode === '429')
      return new Response('private key details', {
        status: 429,
        headers: { 'retry-after': '120' },
      });
    if (mode === 'bad')
      return Response.json({
        choices: [{ message: { content: '<think>private chain</think>' } }],
      });
    return Response.json({
      choices: [
        {
          message: {
            content: 'Resposta pública',
            reasoning: 'private reasoning',
            tool_calls: [{ secret: 'private' }],
          },
        },
      ],
      usage: { secret: 'private' },
    });
  };
  const services = createRemoteServices(
    { DB, TATU_ENCRYPTION_KEY: master },
    fetcher,
  );
  await services.connect('alice', { provider: 'groq', apiKey: key });
  const messages = [{ role: 'user' as const, content: 'Olá' }],
    signal = new AbortController().signal;
  const result = await services.reply('alice', messages, signal);
  assert.deepEqual(result, {
    reply: 'Resposta pública',
    model: { provider: 'groq', name: 'openai/gpt-oss-20b' },
  });
  mode = 'bad';
  await assert.rejects(
    services.reply('alice', messages, signal),
    (error) =>
      error instanceof ProviderError && error.code === 'invalid_output',
  );
  mode = '429';
  await assert.rejects(
    services.reply('alice', messages, signal),
    (error) =>
      error instanceof ProviderError &&
      error.status === 429 &&
      error.retryAfter === 120,
  );
  const before = calls;
  await assert.rejects(services.reply('alice', messages, signal), QuotaError);
  assert.equal(calls, before);
  await assert.rejects(
    createRemoteServices(
      { DB, TATU_ENCRYPTION_KEY: btoa('b'.repeat(32)) },
      fetcher,
    ).reply('alice', messages, signal),
    ProviderError,
  );
  assert.equal(calls, before);
  await assert.rejects(
    services.reply('alice', [{ role: 'user', content: key }], signal),
    ProviderError,
  );
  assert.equal(calls, before);
});
test('missing AI binding is unavailable; Workers AI is fixed-model bounded and global hard-stop blocks dispatch', async (t) => {
  const { DB } = fixture(t);
  let calls = 0;
  const services = createRemoteServices({
    DB,
    AI: {
      async run(model: string, input: unknown) {
        calls++;
        assert.equal(model, '@cf/openai/gpt-oss-20b');
        assert.equal((input as { max_tokens: number }).max_tokens, 1024);
        return { response: 'IA remota' };
      },
    },
  });
  assert.equal(
    (await createRemoteServices({ DB }).status('alice')).configured,
    false,
  );
  assert.equal((await services.status('alice')).available, false);
  const messages = [{ role: 'user' as const, content: 'Olá' }],
    signal = new AbortController().signal;
  assert.equal(
    (await services.reply('alice', messages, signal)).reply,
    'IA remota',
  );
  await DB.prepare(
    "UPDATE provider_quota SET day_units=9500 WHERE scope='global'",
  ).run();
  await assert.rejects(services.reply('alice', messages, signal), QuotaError);
  assert.equal(calls, 1);
});

test('Workers AI chat-completion output (gpt-oss) is read; reasoning is never returned', async (t) => {
  const { DB } = fixture(t);
  const services = createRemoteServices({
    DB,
    AI: {
      async run() {
        return {
          object: 'chat.completion',
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'Oi',
                reasoning_content: 'pensamento interno',
              },
            },
          ],
        };
      },
    },
  });
  const result = await services.reply(
    'alice',
    [{ role: 'user', content: 'diga oi' }],
    new AbortController().signal,
  );
  assert.equal(result.reply, 'Oi');
});

test('a redirected Groq response is unavailable, never followed', async (t) => {
  const { DB } = fixture(t);
  let followed = false;
  const fetcher: typeof fetch = async (input, init) => {
    assert.equal(init?.redirect, 'manual');
    if (String(input).includes('example.invalid')) followed = true;
    return new Response(null, {
      status: 302,
      headers: { location: 'https://example.invalid/' },
    });
  };
  const services = createRemoteServices(
    {
      DB,
      TATU_ENABLE_SPONSORED_GROQ: 'true',
      TATU_GROQ_API_KEY: key,
    },
    fetcher,
  );
  await assert.rejects(
    services.reply(
      'alice',
      [{ role: 'user', content: 'Olá' }],
      new AbortController().signal,
    ),
    (error: unknown) =>
      error instanceof ProviderError && error.code === 'unavailable',
  );
  assert.equal(followed, false);
});

test('aborted provider call fails with fixed timeout and keeps its reservation consumed', async (t) => {
  const { DB } = fixture(t);
  let calls = 0;
  const fetcher: typeof fetch = async (_input, init) => {
    if (!init?.body)
      return Response.json({ data: [{ id: 'openai/gpt-oss-20b' }] });
    calls++;
    return new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener(
        'abort',
        () => reject(new Error('private-provider-secret')),
        { once: true },
      );
    });
  };
  const services = createRemoteServices(
    { DB, TATU_ENCRYPTION_KEY: master },
    fetcher,
  );
  await services.connect('alice', { provider: 'groq', apiKey: key });
  const controller = new AbortController();
  const pending = services.reply(
    'alice',
    [{ role: 'user', content: 'Olá' }],
    controller.signal,
  );
  while (calls === 0)
    await new Promise<void>((resolve) => setTimeout(resolve, 1));
  controller.abort();
  await assert.rejects(
    pending,
    (error) =>
      error instanceof ProviderError &&
      error.code === 'timeout' &&
      error.message === 'timeout',
  );
  const row = await DB.prepare(
    "SELECT day_requests FROM provider_quota WHERE scope='alice' AND provider='groq'",
  ).first<{ day_requests: number }>();
  assert.equal(row?.day_requests, 1);
});

test('capped owner cannot consume shared quota on repeated rejected requests; global rejection refunds owner', async (t) => {
  const { DB } = fixture(t);
  let calls = 0;
  const services = createRemoteServices({
    DB,
    AI: {
      async run() {
        calls++;
        return { response: 'Fixture' };
      },
    },
  });
  const messages = [{ role: 'user' as const, content: 'Olá' }],
    signal = new AbortController().signal;
  await services.reply('alice', messages, signal);
  await DB.prepare(
    "UPDATE provider_quota SET minute_requests=8 WHERE scope='alice'",
  ).run();
  const before = await DB.prepare(
    "SELECT * FROM provider_quota WHERE scope='global'",
  ).first();
  for (let i = 0; i < 100; i++)
    await assert.rejects(services.reply('alice', messages, signal), QuotaError);
  assert.deepEqual(
    await DB.prepare(
      "SELECT * FROM provider_quota WHERE scope='global'",
    ).first(),
    before,
  );
  assert.equal(calls, 1);
  await DB.prepare(
    "UPDATE provider_quota SET day_units=9500 WHERE scope='global'",
  ).run();
  await assert.rejects(services.reply('bob', messages, signal), QuotaError);
  const rejected = await DB.prepare(
    "SELECT day_requests,day_units,minute_requests,minute_units,active FROM provider_quota WHERE scope='bob'",
  ).first();
  assert.deepEqual(rejected, {
    day_requests: 0,
    day_units: 0,
    minute_requests: 0,
    minute_units: 0,
    active: 0,
  });
  assert.equal(calls, 1);
});

test('concurrent owners respect global cap; rejection refunds only undispatched reservation', async (t) => {
  const { DB } = fixture(t);
  const release: Array<() => void> = [];
  const services = createRemoteServices({
    DB,
    AI: {
      run() {
        return new Promise((resolve) =>
          release.push(() => resolve({ response: 'Fixture' })),
        );
      },
    },
  });
  const messages = [{ role: 'user' as const, content: 'Olá' }],
    signal = new AbortController().signal;
  const active = ['alice', 'alice', 'bob', 'bob'].map((owner) =>
    services.reply(owner, messages, signal),
  );
  while (release.length < 4)
    await new Promise<void>((resolve) => setTimeout(resolve, 1));
  const before = await DB.prepare(
    "SELECT day_requests,day_units FROM provider_quota WHERE scope='global'",
  ).first();
  await assert.rejects(services.reply('carol', messages, signal), QuotaError);
  assert.deepEqual(
    await DB.prepare(
      "SELECT day_requests,day_units FROM provider_quota WHERE scope='global'",
    ).first(),
    before,
  );
  assert.equal(
    (
      await DB.prepare(
        "SELECT day_requests FROM provider_quota WHERE scope='carol'",
      ).first<{ day_requests: number }>()
    )?.day_requests,
    0,
  );
  for (const done of release) done();
  await Promise.all(active);
  assert.equal(
    (
      await DB.prepare(
        "SELECT day_requests FROM provider_quota WHERE scope='global'",
      ).first<{ day_requests: number }>()
    )?.day_requests,
    4,
  );
});

test('bounded previous-key rotation reseals current key and missing previous key fails closed', async (t) => {
  const { DB } = fixture(t);
  const next = btoa('b'.repeat(32));
  const fetcher: typeof fetch = async () =>
    Response.json({ data: [{ id: 'openai/gpt-oss-20b' }] });
  await createRemoteServices(
    { DB, TATU_ENCRYPTION_KEY: master, TATU_ENCRYPTION_KEY_ID: 'v1' },
    fetcher,
  ).connect('alice', { provider: 'groq', apiKey: key });
  const original = await DB.prepare(
    "SELECT envelope_json FROM provider_connections WHERE owner_id='alice'",
  ).first<{ envelope_json: string }>();
  const missing = createRemoteServices(
    { DB, TATU_ENCRYPTION_KEY: next, TATU_ENCRYPTION_KEY_ID: 'v2' },
    fetcher,
  );
  assert.equal((await missing.status('alice')).configured, false);
  assert.equal(
    (
      await createRemoteServices(
        { DB, TATU_ENCRYPTION_KEY: master },
        fetcher,
      ).status('alice')
    ).configured,
    true,
  );
  const rotated = createRemoteServices(
    {
      DB,
      TATU_ENCRYPTION_KEY: next,
      TATU_ENCRYPTION_KEY_ID: 'v2',
      TATU_PREVIOUS_ENCRYPTION_KEY: master,
      TATU_PREVIOUS_ENCRYPTION_KEY_ID: 'v1',
    },
    fetcher,
  );
  assert.equal((await rotated.status('alice')).configured, true);
  const current = await DB.prepare(
    "SELECT envelope_json FROM provider_connections WHERE owner_id='alice'",
  ).first<{ envelope_json: string }>();
  const envelope = JSON.parse(current!.envelope_json);
  assert.equal(envelope.keyId, 'v2');
  assert.notEqual(envelope.nonce, JSON.parse(original!.envelope_json).nonce);
  assert.equal(await openSecret(envelope, next, 'v2', 'alice', 'groq'), key);
  const metadata = JSON.stringify(await rotated.connections('alice'));
  assert.ok(
    !metadata.includes(master) &&
      !metadata.includes(next) &&
      !metadata.includes(key),
  );
  assert.equal((await missing.status('alice')).configured, true);
});

test('disconnect racing old-key reseal cannot resurrect encrypted connection', async (t) => {
  const { DB } = fixture(t);
  const fetcher: typeof fetch = async () =>
    Response.json({ data: [{ id: 'openai/gpt-oss-20b' }] });
  await createRemoteServices(
    { DB, TATU_ENCRYPTION_KEY: master },
    fetcher,
  ).connect('alice', { provider: 'groq', apiKey: key });
  const wrapped: D1Database = {
    ...DB,
    prepare(sql) {
      const wrap = (statement: D1PreparedStatement): D1PreparedStatement => ({
        bind(...values) {
          return wrap(statement.bind(...values));
        },
        first: () => statement.first(),
        all: () => statement.all(),
        async run() {
          if (sql.startsWith('UPDATE provider_connections'))
            await DB.prepare(
              "DELETE FROM provider_connections WHERE owner_id='alice'",
            ).run();
          return statement.run();
        },
      });
      return wrap(DB.prepare(sql));
    },
    batch: (statements) => DB.batch(statements),
  };
  const services = createRemoteServices(
    {
      DB: wrapped,
      TATU_ENCRYPTION_KEY: btoa('b'.repeat(32)),
      TATU_ENCRYPTION_KEY_ID: 'v2',
      TATU_PREVIOUS_ENCRYPTION_KEY: master,
      TATU_PREVIOUS_ENCRYPTION_KEY_ID: 'v1',
    },
    fetcher,
  );
  assert.equal((await services.status('alice')).configured, false);
  assert.deepEqual(await services.connections('alice'), []);
});

test('actual sponsored dispatch failure consumes both budgets without refund', async (t) => {
  const { DB } = fixture(t);
  let calls = 0;
  const services = createRemoteServices({
    DB,
    AI: {
      async run() {
        calls++;
        throw new Error('fixture-private-payload');
      },
    },
  });
  await assert.rejects(
    services.reply(
      'alice',
      [{ role: 'user', content: 'Olá' }],
      new AbortController().signal,
    ),
    (error) =>
      error instanceof ProviderError && error.message === 'unavailable',
  );
  assert.equal(calls, 1);
  for (const scope of ['alice', 'global']) {
    const row = await DB.prepare(
      'SELECT day_requests,day_units,active FROM provider_quota WHERE scope=? AND provider=?',
    )
      .bind(scope, 'workers-ai')
      .first<{ day_requests: number; day_units: number; active: number }>();
    assert.equal(row?.day_requests, 1);
    assert.ok(row!.day_units > 0);
    assert.equal(row?.active, 0);
  }
});

test('owner route preference reorders only among configured routes; auto keeps fixed precedence', async (t) => {
  const { DB } = fixture(t);
  const sponsored = 'gsk_' + 'b'.repeat(40),
    used: string[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith('/models'))
      return Response.json({ data: [{ id: 'openai/gpt-oss-20b' }] });
    used.push(new Headers(init?.headers).get('authorization') ?? '');
    return Response.json({
      choices: [{ message: { content: 'resposta groq' } }],
    });
  };
  const env = {
    DB,
    TATU_ENCRYPTION_KEY: master,
    TATU_ENABLE_SPONSORED_GROQ: 'true',
    TATU_GROQ_API_KEY: sponsored,
    AI: {
      async run() {
        used.push('workers-ai');
        return { response: 'resposta workers' };
      },
    },
  };
  const services = createRemoteServices(env, fetcher);
  const ask = (preferred?: Parameters<typeof services.reply>[3]) =>
    services.reply(
      'alice',
      [{ role: 'user', content: 'Olá' }],
      new AbortController().signal,
      preferred,
    );
  assert.deepEqual(
    (await services.routes!('alice')).map((route) => [
      route.id,
      route.configured,
    ]),
    [
      ['groq', false],
      ['groq-sponsored', true],
      ['workers-ai', true],
    ],
  );
  await ask();
  await ask('auto');
  await ask('groq');
  await ask('workers-ai');
  assert.deepEqual(used, [
    `Bearer ${sponsored}`,
    `Bearer ${sponsored}`,
    `Bearer ${sponsored}`,
    'workers-ai',
  ]);
  used.length = 0;
  await services.connect('alice', { provider: 'groq', apiKey: key });
  assert.equal((await services.routes!('alice'))[0].configured, true);
  await ask('auto');
  await ask('groq-sponsored');
  const reply = await ask('workers-ai');
  assert.equal(reply.model.provider, 'workers-ai');
  assert.deepEqual(used, [
    `Bearer ${key}`,
    `Bearer ${sponsored}`,
    'workers-ai',
  ]);
  assert.equal(
    (await services.status('alice', 'workers-ai')).model,
    '@cf/openai/gpt-oss-20b',
  );
  // An unconfigured preference falls back to the default order, never a new route.
  used.length = 0;
  const bare = createRemoteServices(
    { DB, TATU_ENCRYPTION_KEY: master },
    fetcher,
  );
  await bare.reply(
    'alice',
    [{ role: 'user', content: 'Olá' }],
    new AbortController().signal,
    'workers-ai',
  );
  assert.deepEqual(used, [`Bearer ${key}`]);
  await assert.rejects(
    bare.reply(
      'bob',
      [{ role: 'user', content: 'Olá' }],
      new AbortController().signal,
      'groq-sponsored',
    ),
    (error) =>
      error instanceof ProviderError && error.message === 'unavailable',
  );
});
