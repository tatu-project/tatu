import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { AssistantError } from '@tatu/shared';
import { createCloudWorker } from './index.js';
import { ProviderError } from './providers.js';
import { QuotaError } from './quota.js';
import { splitMessage, telegramConfig } from './telegram.js';
import { createTestD1 } from './test-d1.js';
import { WorkspaceStore } from './storage.js';
import type { CloudEnv, ModelRoute, RemoteServices } from './types.js';

const origin = 'https://tatu.test',
  token = '123456789:' + 'A'.repeat(35),
  secret = 'w'.repeat(40),
  owner = 1001;
type Call = { method: string; body: Record<string, unknown> };
type Reply = RemoteServices['reply'];
function fixture(
  t: TestContext,
  reply: Reply = async () => ({
    reply: 'Resposta de fixture.',
    model: { provider: 'fixture', name: 'test-model' },
  }),
  overrides: Partial<CloudEnv> = {},
) {
  const db = createTestD1();
  t.after(() => db.close());
  const env: CloudEnv = {
    DB: db,
    SITE_ORIGIN: origin,
    TELEGRAM_BOT_TOKEN: token,
    TELEGRAM_WEBHOOK_SECRET: secret,
    TELEGRAM_OWNER_IDS: ` ${owner} ,2002`,
    ...overrides,
  };
  const calls: Call[] = [],
    preferences: (ModelRoute | undefined)[] = [];
  let fail = false;
  const services: RemoteServices = {
    reply: async (...args) => {
      preferences.push(args[3]);
      return reply(...args);
    },
    status: async () => ({
      configured: true,
      available: false,
      model: 'test-model',
      reason: 'fixture',
    }),
    routes: async () => [
      { id: 'groq', model: 'g', configured: false },
      { id: 'groq-sponsored', model: 'g', configured: false },
      { id: 'workers-ai', model: 'w', configured: true },
    ],
    connections: async () => [],
    connect: async () => {
      throw new AssistantError('unavailable');
    },
    disconnect: async () => false,
  };
  const fetcher = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const url = String(input);
    assert.ok(url.startsWith(`https://api.telegram.org/bot${token}/`));
    assert.equal(init?.redirect, 'manual');
    calls.push({
      method: url.slice(url.lastIndexOf('/') + 1),
      body: JSON.parse(String(init?.body)) as Record<string, unknown>,
    });
    if (fail) throw new Error(`network failure for ${url}`);
    return new Response(JSON.stringify({ ok: true, result: true }), {
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  const worker = createCloudWorker({
    authenticate: async () => null,
    services: () => services,
    telegramFetch: fetcher,
  });
  let updateId = 500_001;
  const post = async (
    payload: unknown,
    headers: Record<string, string> = {},
    raw?: string,
  ) => {
    const pending: Promise<unknown>[] = [];
    const response = await worker.fetch(
      new Request(`${origin}/api/telegram/webhook`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-telegram-bot-api-secret-token': secret,
          ...headers,
        },
        body: raw ?? JSON.stringify(payload),
      }),
      env,
      { waitUntil: (promise) => void pending.push(promise) },
    );
    await Promise.all(pending);
    return { response, text: await response.text() };
  };
  const message = (
    text: string | undefined,
    from = owner,
    chat: { id: number; type: string } = { id: from, type: 'private' },
    id = updateId++,
  ) => ({
    update_id: id,
    message: {
      message_id: 1,
      date: 1,
      from: { id: from, is_bot: false, first_name: 'Dono' },
      chat,
      ...(text === undefined ? { photo: [] } : { text }),
    },
  });
  const sent = () =>
    calls
      .filter((call) => call.method === 'sendMessage')
      .map((call) => String(call.body.text));
  const owners = () =>
    db.database.prepare('SELECT * FROM owners').all() as {
      id: string;
      issuer: string;
      subject: string;
    }[];
  return {
    db,
    env,
    calls,
    preferences,
    post,
    message,
    sent,
    owners,
    setFail: (value: boolean) => (fail = value),
  };
}

test('route stays disabled without complete valid configuration', async (t) => {
  for (const overrides of [
    { TELEGRAM_BOT_TOKEN: undefined },
    { TELEGRAM_BOT_TOKEN: 'not-a-token' },
    { TELEGRAM_WEBHOOK_SECRET: 'short' },
    { TELEGRAM_OWNER_IDS: undefined },
    { TELEGRAM_OWNER_IDS: '1001,abc' },
    { TELEGRAM_OWNER_IDS: '' },
  ]) {
    const f = fixture(t, undefined, overrides);
    const result = await f.post(f.message('oi'));
    assert.equal(result.response.status, 404);
    assert.equal(f.calls.length, 0);
    assert.equal(f.owners().length, 0);
  }
  const f = fixture(t, undefined, { DB: undefined });
  assert.equal((await f.post(f.message('oi'))).response.status, 503);
  assert.deepEqual(telegramConfig({})?.botId, undefined);
});

test('wrong or missing secret is 401; unprocessable authenticated updates are acknowledged with 200', async (t) => {
  const f = fixture(t);
  for (const headers of [
    { 'x-telegram-bot-api-secret-token': 'x'.repeat(40) },
    { 'x-telegram-bot-api-secret-token': secret + 'x' },
  ])
    assert.equal((await f.post(f.message('oi'), headers)).response.status, 401);
  const missing = await createCloudWorker({
    authenticate: async () => null,
  }).fetch(
    new Request(`${origin}/api/telegram/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    }),
    f.env,
  );
  assert.equal(missing.status, 401);
  assert.equal(
    (await f.post(undefined, { 'content-type': 'text/plain' }, '{}')).response
      .status,
    415,
  );
  // Cross-site browser requests never reach the webhook.
  assert.equal(
    (await f.post(f.message('oi'), { origin: 'https://evil.example' })).response
      .status,
    403,
  );
  assert.equal(
    (await f.post(f.message('oi'), { 'sec-fetch-site': 'cross-site' })).response
      .status,
    403,
  );
  // Telegram retries non-2xx, so authenticated junk is acknowledged and ignored.
  assert.equal((await f.post(undefined, {}, '{not json')).response.status, 200);
  assert.equal(
    (await f.post(undefined, {}, JSON.stringify({ pad: 'x'.repeat(70_000) })))
      .response.status,
    200,
  );
  for (const payload of [
    { update_id: 'one' },
    { update_id: 1, message: { from: { id: '1001' }, chat: { id: 1001 } } },
  ])
    assert.equal((await f.post(payload)).response.status, 200);
  assert.equal(f.calls.length, 0);
  assert.equal(f.owners().length, 0);
  // An identifiable owner with text over Telegram's limit gets a short answer.
  assert.equal(
    (await f.post(f.message('x'.repeat(4097)))).response.status,
    200,
  );
  assert.deepEqual(f.sent(), [
    'Mensagem grande demais: envie até 4096 caracteres por vez.',
  ]);
});

test('strangers and group chats are ignored without owners, writes or replies', async (t) => {
  const f = fixture(t);
  for (const update of [
    f.message('oi', 3003),
    f.message('oi', owner, { id: -100, type: 'group' }),
    f.message('oi', owner, { id: -100, type: 'supergroup' }),
    { update_id: 9, edited_message: {} },
  ]) {
    const result = await f.post(update);
    assert.equal(result.response.status, 200);
  }
  assert.equal(f.calls.length, 0);
  assert.equal(f.owners().length, 0);
  assert.equal(
    (
      f.db.database
        .prepare('SELECT COUNT(*) AS n FROM telegram_updates')
        .get() as { n: number }
    ).n,
    0,
  );
});

test('owner text gets typing plus the real reply, persisted in a reused Telegram conversation; /novo starts another', async (t) => {
  const f = fixture(t);
  const update = f.message('Olá Tatu');
  const first = await f.post(update);
  assert.equal(first.response.status, 200);
  assert.deepEqual(
    f.calls.map((call) => call.method),
    ['sendChatAction', 'sendMessage'],
  );
  assert.equal(f.calls[0].body.action, 'typing');
  assert.equal(f.calls[1].body.chat_id, owner);
  assert.deepEqual(f.sent(), ['Resposta de fixture.']);
  // Duplicate delivery of the same update is processed only once.
  await f.post(update);
  assert.equal(f.calls.length, 2);
  const [row] = f.owners();
  assert.equal(row.issuer, 'telegram:123456789');
  assert.equal(row.subject, String(owner));
  assert.notEqual(row.id, String(owner));
  await f.post(f.message('Segunda mensagem'));
  const conversations = () =>
    f.db.database
      .prepare(
        'SELECT c.id,c.title,(SELECT COUNT(*) FROM messages m WHERE m.conversation_id=c.id) AS n FROM conversations c WHERE owner_id=? ORDER BY created_at',
      )
      .all(row.id) as { id: string; title: string; n: number }[];
  assert.equal(conversations().length, 1);
  assert.equal(conversations()[0].title, 'Telegram');
  assert.equal(conversations()[0].n, 4);
  await f.post(f.message('/novo'));
  await f.post(f.message('Terceira'));
  assert.equal(conversations().length, 2);
  assert.equal(conversations()[1].n, 2);
});

test('history is sent to the provider like the web chat', async (t) => {
  const seen: number[] = [];
  const f = fixture(t, async (_owner, messages) => {
    seen.push(messages.length);
    return { reply: 'ok', model: { provider: 'f', name: 'm' } };
  });
  await f.post(f.message('um'));
  await f.post(f.message('dois'));
  assert.deepEqual(seen, [2, 4]);
});

test('provider failures answer honestly and store no assistant message', async (t) => {
  for (const [error, expected] of [
    [new ProviderError('unavailable'), /não está disponível/u],
    [new ProviderError('quota_exhausted', 429, 60), /cota/u],
    [new QuotaError(), /cota/u],
    [new ProviderError('timeout', 504), /prazo/u],
    [new ProviderError('invalid_output', 422), /inválida/u],
  ] as const) {
    const f = fixture(t, async () => {
      throw error;
    });
    await f.post(f.message('Olá'));
    assert.equal(f.sent().length, 1);
    assert.match(f.sent()[0], expected);
    assert.match(f.sent()[0], /Nenhuma resposta|descartada/u);
    assert.equal(
      (
        f.db.database.prepare('SELECT COUNT(*) AS n FROM messages').get() as {
          n: number;
        }
      ).n,
      0,
    );
  }
  const invalid = fixture(t, async () => ({
    reply: 'api_key=abcdefghijklmnop',
    model: { provider: 'f', name: 'm' },
  }));
  await invalid.post(invalid.message('Olá'));
  assert.match(invalid.sent()[0], /inválida/u);
});

test('secret-like messages are refused before the provider and never stored', async (t) => {
  const f = fixture(t);
  for (const text of [
    `meu token ${token}`,
    `segredo ${secret}`,
    'api_key=abcdefghijklmnop',
  ]) {
    await f.post(f.message(text));
    await f.post(f.message(`/memoria ${text}`));
  }
  assert.equal(f.preferences.length, 0);
  assert.equal(f.sent().length, 6);
  for (const text of f.sent()) assert.match(text, /segredo/u);
  for (const table of ['messages', 'memories'])
    assert.equal(
      (
        f.db.database.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as {
          n: number;
        }
      ).n,
      0,
    );
});

test('/memoria saves and lists preference memories; /start explains limits', async (t) => {
  const f = fixture(t);
  await f.post(f.message('/start'));
  assert.match(f.sent()[0], /cotas/u);
  assert.match(f.sent()[0], /treinam/u);
  await f.post(f.message('/memoria'));
  assert.match(f.sent()[1], /Nenhuma memória/u);
  await f.post(f.message('/memoria Prefiro respostas curtas.'));
  await f.post(f.message('/memória@TatuBot'));
  assert.match(f.sent()[2], /salva/u);
  assert.match(f.sent()[3], /1\. Prefiro respostas curtas\./u);
  const stored = f.db.database
    .prepare('SELECT content,category FROM memories')
    .all();
  assert.deepEqual(stored, [
    { content: 'Prefiro respostas curtas.', category: 'preference' },
  ]);
  await f.post(f.message(undefined));
  assert.match(f.sent()[4], /só entendo mensagens de texto/u);
  await f.post(f.message('/desconhecido'));
  assert.match(f.sent()[5], /Comando desconhecido/u);
  for (const text of ['/modelo_auto', '/start123']) {
    await f.post(f.message(text));
    assert.match(f.sent().at(-1)!, /Comando desconhecido/u);
  }
  await f.post(f.message('/help'));
  assert.match(f.sent().at(-1)!, /\/esquecer/u);
});

test('/modelo lists routes, rejects unknown or unconfigured ones and the choice reaches the provider', async (t) => {
  const f = fixture(t);
  await f.post(f.message('/modelo'));
  assert.match(f.sent()[0], /Escolha atual: auto/u);
  assert.match(f.sent()[0], /workers-ai — .*: configurada/u);
  assert.match(f.sent()[0], /groq — .*: indisponível/u);
  await f.post(f.message('/modelo gpt-5'));
  assert.match(f.sent()[1], /Rota desconhecida/u);
  await f.post(f.message('/modelo groq'));
  assert.match(f.sent()[2], /não está configurada/u);
  await f.post(f.message('oi'));
  await f.post(f.message('/modelo workers-ai'));
  assert.match(f.sent()[4], /alterada para workers-ai/u);
  await f.post(f.message('oi de novo'));
  assert.deepEqual(f.preferences, ['auto', 'workers-ai']);
  await f.post(f.message('/modelo'));
  assert.match(f.sent().at(-1)!, /Escolha atual: workers-ai/u);
});

test('long replies are split into bounded chunks and Telegram failures never expose the token', async (t) => {
  const long = ('linha de resposta '.repeat(20) + '\n').repeat(40);
  const f = fixture(t, async () => ({
    reply: long,
    model: { provider: 'f', name: 'm' },
  }));
  await f.post(f.message('texto longo'));
  const chunks = f.sent();
  assert.ok(chunks.length >= 3 && chunks.length <= 4);
  for (const chunk of chunks) assert.ok(chunk.length <= 4000);
  assert.equal(chunks.join('\n').replace(/\n/gu, ''), long.replace(/\n/gu, ''));
  const huge = splitMessage('x'.repeat(20_000));
  assert.equal(huge.length, 4);
  assert.match(huge[3], /cortada/u);
  assert.ok(huge.every((chunk) => chunk.length <= 4000));
  const emoji = splitMessage('a' + '🙂'.repeat(2500));
  assert.ok(emoji.every((chunk) => !/^[\udc00-\udfff]/u.test(chunk)));

  f.setFail(true);
  const result = await f.post(f.message('outra'));
  assert.equal(result.response.status, 200);
  assert.ok(!result.text.includes(token));
  // The turn is still stored in history even when delivery fails.
  assert.equal(
    (
      f.db.database.prepare('SELECT COUNT(*) AS n FROM messages').get() as {
        n: number;
      }
    ).n,
    4,
  );
});

test('handler work per update stays within free-plan subrequest and D1 bounds', async (t) => {
  const f = fixture(t);
  const prepare = f.db.prepare.bind(f.db);
  let statements = 0;
  f.db.prepare = (sql: string) => {
    statements++;
    return prepare(sql);
  };
  for (let index = 0; index < 30; index++) {
    const before = statements,
      calls = f.calls.length;
    await f.post(f.message(`mensagem ${index}`));
    assert.ok(
      statements - before <= 20,
      `D1 statements ${statements - before}`,
    );
    assert.ok(f.calls.length - calls <= 2 + 4);
  }
  assert.equal(f.sent().length, 30);
  // Strangers cost zero D1 statements.
  const before = statements;
  await f.post(f.message('spam', 4004));
  assert.equal(statements, before);
});

test('saved memories reach the provider newest first, bounded, without breaking history reuse', async (t) => {
  type Message = Parameters<Reply>[1][number];
  const seen: Message[][] = [];
  const f = fixture(t, async (_owner, messages) => {
    seen.push(messages.map((message) => ({ ...message })));
    return { reply: 'ok', model: { provider: 'f', name: 'm' } };
  });
  await f.post(f.message('/memoria Prefiro respostas curtas.'));
  await f.post(f.message('/memoria Moro em Recife.'));
  // Saves within one millisecond tie; pin distinct creation times.
  f.db.database
    .prepare(
      "UPDATE memories SET created_at='2026-01-01' WHERE content LIKE 'Prefiro%'",
    )
    .run();
  await f.post(f.message('Olá'));
  const system = seen[0].filter((message) => message.role === 'system');
  assert.equal(system.length, 2);
  assert.match(system[1].content, /Preferências que o usuário salvou/u);
  assert.ok(
    system[1].content.indexOf('Moro em Recife.') <
      system[1].content.indexOf('Prefiro respostas curtas.'),
  );
  // A later memory change keeps earlier turns in history.
  await f.post(f.message('/memoria Gosto de café.'));
  await f.post(f.message('Segunda'));
  assert.equal(seen[1].length, 2 + 2 + 1);
  assert.match(seen[1][1].content, /Gosto de café\./u);

  // Oversized memories are dropped; the message still goes through.
  const big = fixture(t, async (_owner, messages) => {
    seen.push(messages.map((message) => ({ ...message })));
    return { reply: 'ok', model: { provider: 'f', name: 'm' } };
  });
  seen.length = 0;
  await big.post(big.message(`/memoria ${'a'.repeat(1600)}`));
  await big.post(big.message('/memoria curta'));
  await big.post(big.message('Olá'));
  assert.equal(seen.length, 1);
  assert.match(seen[0][1].content, /- curta/u);
  assert.ok(!seen[0][1].content.includes('a'.repeat(1600)));
  // Memories that fit alone but not with a large message are omitted, not fatal.
  seen.length = 0;
  const near = fixture(t, async (_owner, messages) => {
    seen.push(messages.map((message) => ({ ...message })));
    return { reply: 'ok', model: { provider: 'f', name: 'm' } };
  });
  await near.post(near.message(`/memoria ${'b'.repeat(1300)}`));
  await near.post(near.message('c'.repeat(3200)));
  assert.equal(seen.length, 1);
  assert.equal(
    seen[0].filter((message) => message.role === 'system').length,
    1,
  );
  assert.equal(near.sent().at(-1), 'ok');
});

test('/esquecer deletes only the listed memory of this owner', async (t) => {
  const f = fixture(t);
  await f.post(f.message('/memoria primeira'));
  await f.post(f.message('/memoria segunda'));
  await f.post(f.message('/memoria', 2002));
  await f.post(f.message('/memoria outra pessoa', 2002));
  f.db.database
    .prepare(
      "UPDATE memories SET created_at='2026-01-01' WHERE content='primeira'",
    )
    .run();
  await f.post(f.message('/memoria'));
  assert.match(f.sent().at(-1)!, /1\. segunda\n2\. primeira/u);
  await f.post(f.message('/esquecer 9'));
  assert.match(f.sent().at(-1)!, /Use \/esquecer/u);
  await f.post(f.message('/esquecer x'));
  assert.match(f.sent().at(-1)!, /Use \/esquecer/u);
  await f.post(f.message('/esquecer 1'));
  assert.match(f.sent().at(-1)!, /Memória 1 apagada/u);
  // The deleted entry is "segunda", the newest listed one.
  assert.deepEqual(
    f.db.database
      .prepare('SELECT content FROM memories ORDER BY content')
      .all(),
    [{ content: 'outra pessoa' }, { content: 'primeira' }],
  );
});

test('lease is released after failures, busy and rate limits answer honestly', async (t) => {
  let failNext = true;
  const f = fixture(t, async () => {
    if (failNext) {
      failNext = false;
      throw new ProviderError('unavailable');
    }
    return { reply: 'recuperado', model: { provider: 'f', name: 'm' } };
  });
  await f.post(f.message('primeira'));
  await f.post(f.message('segunda'));
  assert.equal(f.sent().at(-1), 'recuperado');
  const conversation = f.db.database
    .prepare('SELECT id,turn_token FROM conversations')
    .all() as { id: string; turn_token: string | null }[];
  assert.equal(conversation.length, 1);
  assert.equal(conversation[0].turn_token, null);
  // A turn still in flight elsewhere makes the next message wait.
  f.db.database
    .prepare('UPDATE conversations SET turn_token=?,turn_expires_at=?')
    .run('other', new Date(Date.now() + 60_000).toISOString());
  await f.post(f.message('terceira'));
  assert.match(f.sent().at(-1)!, /Ainda estou respondendo/u);
  f.db.database
    .prepare('UPDATE api_usage SET requests=60,window_minute=?')
    .run(Math.floor(Date.now() / 60_000));
  await f.post(f.message('quarta'));
  assert.match(f.sent().at(-1)!, /Muitas mensagens/u);
});

test('a hanging or failing typing action never blocks the reply', async (t) => {
  const db = createTestD1();
  t.after(() => db.close());
  const sent: string[] = [];
  let typing = 0;
  const fetcher = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    if (String(input).endsWith('/sendChatAction')) {
      typing++;
      if (typing === 1)
        return new Promise<Response>((_, reject) =>
          init?.signal?.addEventListener('abort', () =>
            reject(new Error('aborted')),
          ),
        );
      return new Response('{"ok":false}', { status: 500 });
    }
    sent.push(String(JSON.parse(String(init?.body)).text));
    return new Response('{"ok":true}');
  }) as typeof fetch;
  const worker = createCloudWorker({
    authenticate: async () => null,
    services: () => ({
      reply: async () => ({
        reply: 'pronto',
        model: { provider: 'f', name: 'm' },
      }),
      status: async () => ({
        configured: true,
        available: false,
        model: null,
        reason: 'f',
      }),
      connections: async () => [],
      connect: async () => undefined,
      disconnect: async () => false,
    }),
    telegramFetch: fetcher,
  });
  const env: CloudEnv = {
    DB: db,
    SITE_ORIGIN: origin,
    TELEGRAM_BOT_TOKEN: token,
    TELEGRAM_WEBHOOK_SECRET: secret,
    TELEGRAM_OWNER_IDS: String(owner),
  };
  for (const id of [1, 2]) {
    const started = Date.now();
    await worker.fetch(
      new Request(`${origin}/api/telegram/webhook`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-telegram-bot-api-secret-token': secret,
        },
        body: JSON.stringify({
          update_id: id,
          message: {
            from: { id: owner },
            chat: { id: owner, type: 'private' },
            text: 'oi',
          },
        }),
      }),
      env,
    );
    assert.ok(Date.now() - started < 1500);
  }
  assert.deepEqual(sent, ['pronto', 'pronto']);
});

test('stale mappings, the conversation cap and parallel first messages recover safely', async (t) => {
  const f = fixture(t);
  await f.post(f.message('um'));
  const [{ id: ownerId }] = f.owners();
  const mapped = () =>
    (
      f.db.database
        .prepare('SELECT conversation_id FROM telegram_chats WHERE owner_id=?')
        .get(ownerId) as { conversation_id: string | null }
    ).conversation_id;
  const first = mapped();
  // Deleted elsewhere: the next message recreates and remaps a conversation.
  f.db.database.prepare('DELETE FROM conversations').run();
  await f.post(f.message('dois'));
  assert.equal(f.sent().at(-1), 'Resposta de fixture.');
  assert.notEqual(mapped(), first);
  // At the 200-conversation cap the least recently used one is dropped once.
  const insert = f.db.database.prepare(
    'INSERT INTO conversations (owner_id,id,title,revision,created_at,updated_at) VALUES (?,?,?,0,?,?)',
  );
  for (let index = 0; index < 199; index++)
    insert.run(
      ownerId,
      crypto.randomUUID(),
      `antiga ${index}`,
      '2020-01-01',
      `2020-01-01T00:00:${String(index % 60).padStart(2, '0')}.${String(index).padStart(3, '0')}Z`,
    );
  const kept = mapped();
  await f.post(f.message('/novo'));
  await f.post(f.message('três'));
  assert.match(f.sent().at(-1)!, /conversa mais antiga foi apagada/u);
  const count = () =>
    (
      f.db.database
        .prepare('SELECT COUNT(*) AS n FROM conversations WHERE owner_id=?')
        .get(ownerId) as { n: number }
    ).n;
  assert.equal(count(), 200);
  assert.ok(
    f.db.database.prepare('SELECT 1 FROM conversations WHERE id=?').get(kept),
  );
  assert.ok(
    !f.db.database
      .prepare("SELECT 1 FROM conversations WHERE title='antiga 0'")
      .get(),
  );
  // Two first messages in parallel end up in a single mapped conversation.
  f.db.database.prepare('DELETE FROM conversations').run();
  await f.post(f.message('/novo'));
  await Promise.all([f.post(f.message('a')), f.post(f.message('b'))]);
  assert.equal(count(), 1);
  const [{ id }] = f.db.database
    .prepare('SELECT id FROM conversations')
    .all() as { id: string }[];
  assert.equal(mapped(), id);
  assert.equal(
    (
      f.db.database
        .prepare('SELECT COUNT(*) AS n FROM messages WHERE conversation_id<>?')
        .get(id) as { n: number }
    ).n,
    0,
  );
});

test('model preference reads as auto before migration 0004 is applied', async (t) => {
  const db = createTestD1();
  t.after(() => db.close());
  db.database
    .prepare(
      "INSERT INTO owners VALUES ('" +
        '0'.repeat(8) +
        '-0000-0000-0000-' +
        '0'.repeat(12) +
        "','f','s','now')",
    )
    .run();
  db.database.exec('DROP TABLE owner_preferences');
  const store = new WorkspaceStore(db, '00000000-0000-0000-0000-000000000000');
  assert.equal(await store.modelRoute(), 'auto');
});
