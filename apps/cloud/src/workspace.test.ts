import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCloudWorker } from './index.js';
import { createTestD1 } from './test-d1.js';
import { WorkspaceStore, ownerForIdentity } from './storage.js';
import { body } from './workspace.js';
import { AssistantError, hasTextSecret, redactTextSecrets } from '@tatu/shared';
import type { CloudEnv, RemoteServices } from './types.js';
import { PROVIDER_CONTEXT_MAX_BYTES } from './types.js';

const origin = 'https://tatu.test';
const fixtureServices = (
  reply: RemoteServices['reply'] = async () => ({
    reply: 'Resposta de fixture, sem provedor real.',
    model: { provider: 'fixture', name: 'test-model' },
  }),
): RemoteServices => ({
  reply,
  status: async () => ({
    configured: false,
    available: false,
    model: null,
    reason: 'not_configured',
  }),
  connections: async () => [],
  connect: async () => {
    throw new AssistantError('unavailable');
  },
  disconnect: async () => false,
});
function fixture(services = fixtureServices()) {
  const db = createTestD1();
  const env: CloudEnv = { DB: db, SITE_ORIGIN: origin };
  const worker = createCloudWorker({
    authenticate: async (request) => {
      const subject = request.headers.get('x-test-subject');
      return subject ? { issuer: 'fixture:test-only', subject } : null;
    },
    services: () => services,
  });
  const call = async <T = Record<string, unknown>>(
    path: string,
    method = 'GET',
    input?: unknown,
    subject = 'alice',
    headers: Record<string, string> = {},
  ) => {
    const response = await worker.fetch(
      new Request(origin + path, {
        method,
        headers: {
          'x-test-subject': subject,
          ...(method === 'POST' || method === 'PATCH'
            ? { 'content-type': 'application/json', origin: origin }
            : {}),
          ...headers,
        },
        body: input === undefined ? undefined : JSON.stringify(input),
      }),
      env,
    );
    const text = await response.text();
    return { response, data: (text ? JSON.parse(text) : undefined) as T };
  };
  return { db, env, worker, call };
}
const phrase =
  'Todos os dias às 9h, encontre as três notícias mais importantes sobre inteligência artificial e me envie.';

test('provider context fits newest complete turn pairs while current message and selected context remain exact', async (context) => {
  type Message = Parameters<RemoteServices['reply']>[1][number];
  const captured: Message[][] = [],
    requests: string[] = [];
  const f = fixture(
    fixtureServices(async (_owner, messages) => {
      assert.ok(
        new TextEncoder().encode(JSON.stringify(messages)).byteLength <=
          PROVIDER_CONTEXT_MAX_BYTES,
      );
      captured.push(messages.map((message) => ({ ...message })));
      return {
        reply: `Resposta fixture ${captured.length - 1}: ${'r'.repeat(260)}`,
        model: { provider: 'fixture', name: 'test-only' },
      };
    }),
  );
  context.after(() => f.db.close());
  const memoryContent = 'Prefiro uma resposta breve em português.',
    noteContent = 'Nota selecionada com acentos: ação, café, coração. 🙂';
  const memory = await f.call<{ id: string }>('/api/memories', 'POST', {
      content: memoryContent,
      category: 'preference',
    }),
    note = await f.call<{ id: string }>('/api/notes', 'POST', {
      title: 'Contexto escolhido',
      content: noteContent,
    });
  let id: string | undefined;
  for (let index = 0; index < 12; index++) {
    const message = `Mensagem ${index}: ${'u'.repeat(220)} fim exato 🙂`;
    requests.push(message);
    const result = await f.call<{ conversationId: string }>(
      '/api/chat/messages',
      'POST',
      {
        ...(id ? { conversationId: id } : {}),
        message,
        memoryIds: [memory.data.id],
        noteIds: [note.data.id],
      },
    );
    assert.equal(result.response.status, 200);
    id = result.data.conversationId;
  }
  assert.equal(captured.length, 12);
  const final = captured.at(-1)!;
  assert.equal(final.at(-1)!.role, 'user');
  assert.equal(final.at(-1)!.content, requests.at(-1));
  const selected = JSON.parse(
    final[1].content.slice(
      'Contexto selecionado somente para esta mensagem: '.length,
    ),
  ) as {
    memories: { id: string; content: string }[];
    notes: { id: string; content: string }[];
  };
  assert.equal(selected.memories[0].id, memory.data.id);
  assert.equal(selected.memories[0].content, memoryContent);
  assert.equal(selected.notes[0].id, note.data.id);
  assert.equal(selected.notes[0].content, noteContent);
  const history = final.slice(2, -1);
  assert.equal(history.length % 2, 0);
  for (let index = 0; index < history.length; index += 2) {
    assert.equal(history[index].role, 'user');
    assert.equal(history[index + 1].role, 'assistant');
  }
  const oldUsers = history
    .filter((message) => message.role === 'user')
    .map((message) => message.content);
  assert.ok(oldUsers.length > 0 && oldUsers.length < requests.length - 1);
  assert.deepEqual(
    oldUsers,
    requests.slice(requests.length - 1 - oldUsers.length, -1),
  );
  const turns = await f.call<{ messages: unknown[] }>(
    '/api/conversations/' + id,
  );
  assert.equal(turns.data.messages.length, 24);
});

test('oversized mandatory message or explicit context returns precise 413 before dispatch or conversation mutation', async (context) => {
  let calls = 0;
  const f = fixture(
    fixtureServices(async () => {
      calls++;
      return {
        reply: 'Resposta fixture pequena.',
        model: { provider: 'fixture', name: 'test-only' },
      };
    }),
  );
  context.after(() => f.db.close());
  const started = await f.call<{ conversationId: string }>(
    '/api/chat/messages',
    'POST',
    { message: '/tarefas' },
  );
  const id = started.data.conversationId;
  const before = f.db.database.prepare('SELECT * FROM conversations').all();
  const messagesBefore = f.db.database.prepare('SELECT * FROM messages').all();
  const largeNote = await f.call<{ id: string }>('/api/notes', 'POST', {
    title: 'Nota grande',
    content: 'n'.repeat(4000),
  });
  const largeMemory = await f.call<{ id: string }>('/api/memories', 'POST', {
    content: 'm'.repeat(4000),
    category: 'preference',
  });
  for (const input of [
    { message: 'x'.repeat(4000) },
    { message: 'Pergunta pequena', noteIds: [largeNote.data.id] },
    { message: 'Pergunta pequena', memoryIds: [largeMemory.data.id] },
    { message: '🙂'.repeat(1000) },
  ]) {
    const result = await f.call<{
      error: string;
      code: string;
      maxContextBytes: number;
    }>('/api/chat/messages', 'POST', { conversationId: id, ...input });
    assert.equal(result.response.status, 413);
    assert.equal(result.data.code, 'context_too_large');
    assert.equal(result.data.maxContextBytes, 4096);
    assert.ok(result.data.error.includes('Reduza a mensagem'));
    assert.equal(calls, 0);
    assert.deepEqual(
      f.db.database.prepare('SELECT * FROM conversations').all(),
      before,
    );
    assert.deepEqual(
      f.db.database.prepare('SELECT * FROM messages').all(),
      messagesBefore,
    );
    const fresh = await f.call('/api/chat/messages', 'POST', input);
    assert.equal(fresh.response.status, 413);
    assert.equal(calls, 0);
  }
  assert.equal((await f.call<unknown[]>('/api/conversations')).data.length, 1);
  assert.equal(
    (
      await f.call('/api/chat/messages', 'POST', {
        conversationId: id,
        message: '🙂'.repeat(700),
      })
    ).response.status,
    200,
  );
  assert.equal(calls, 1);
});

test('HTTP CRUD is authenticated, origin-bound and owner-scoped for every resource', async (context) => {
  const f = fixture();
  context.after(() => f.db.close());
  const note = await f.call<{ id: string; revision: number }>(
    '/api/notes',
    'POST',
    {
      title: 'Meu caderno',
      content: '<img src=x onerror=alert(1)> texto literal',
    },
  );
  assert.equal(note.response.status, 201);
  const memory = await f.call<{ id: string }>('/api/memories', 'POST', {
    content: 'Prefiro respostas curtas.',
    category: 'preference',
  });
  assert.equal(memory.response.status, 201);
  const conversation = await f.call<{ conversationId: string }>(
    '/api/chat/messages',
    'POST',
    { message: '/tarefas' },
  );
  assert.equal(conversation.response.status, 200);
  const proposal = await f.call<{ id: string }>('/api/proposals', 'POST', {
    message: phrase,
    timezone: 'America/Sao_Paulo',
  });
  assert.equal(proposal.response.status, 201);
  for (const [path, method, input] of [
    [
      `/api/notes/${note.data.id}`,
      'PATCH',
      { title: 'roubo', content: 'alteração', revision: 1 },
    ],
    [`/api/notes/${note.data.id}`, 'DELETE', undefined],
    [
      `/api/memories/${memory.data.id}`,
      'PATCH',
      { content: 'roubo', category: 'preference' },
    ],
    [`/api/memories/${memory.data.id}`, 'DELETE', undefined],
    [
      `/api/conversations/${conversation.data.conversationId}`,
      'GET',
      undefined,
    ],
    [
      `/api/conversations/${conversation.data.conversationId}`,
      'DELETE',
      undefined,
    ],
    [`/api/proposals/${proposal.data.id}/confirm`, 'POST', undefined],
    [
      '/api/chat/messages',
      'POST',
      { message: 'olá', memoryIds: [memory.data.id] },
    ],
    ['/api/chat/messages', 'POST', { message: 'olá', noteIds: [note.data.id] }],
  ] as const) {
    assert.equal(
      (await f.call(path, method, input, 'bob')).response.status,
      404,
      `${method} ${path}`,
    );
  }
  assert.deepEqual(
    (await f.call('/api/notes', 'GET', undefined, 'bob')).data,
    [],
  );
  assert.deepEqual(
    (await f.call('/api/memories', 'GET', undefined, 'bob')).data,
    [],
  );
  const noIdentity = await f.worker.fetch(
    new Request(origin + '/api/notes'),
    f.env,
  );
  assert.equal(noIdentity.status, 401);
  for (const badOrigin of ['null', 'https://attacker.example'])
    assert.equal(
      (
        await f.call(
          '/api/notes',
          'POST',
          { title: 'bad', content: 'bad' },
          'alice',
          { origin: badOrigin },
        )
      ).response.status,
      403,
    );
  assert.equal(
    (
      await f.call('/api/notes', 'GET', undefined, 'alice', {
        'sec-fetch-site': 'cross-site',
      })
    ).response.status,
    403,
  );
  assert.equal(
    (
      await f.call('/api/notes', 'POST', {
        title: 'bad',
        content: 'bad',
        ownerId: 'bob',
      })
    ).response.status,
    400,
  );
  assert.equal(
    (
      await f.call(
        '/api/notes',
        'POST',
        { title: 'bad', content: 'bad' },
        'alice',
        { 'content-type': 'text/plain' },
      )
    ).response.status,
    415,
  );
  const retained = await f.call<{ content: string }[]>('/api/notes');
  assert.equal(
    retained.data[0].content,
    '<img src=x onerror=alert(1)> texto literal',
  );
  assert.equal(retained.response.headers.get('cache-control'), 'no-store');
  assert.equal(retained.response.headers.get('x-frame-options'), 'DENY');
});

test('D1 migration, identity mapping and records survive restart; note CAS preserves winning edit', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tatu-cloud-test-'));
  let db = createTestD1(join(dir, 'workspace.sqlite'));
  try {
    const owner = await ownerForIdentity(db, {
        issuer: 'verified:site-one',
        subject: 'alice',
      }),
      otherIssuer = await ownerForIdentity(db, {
        issuer: 'verified:site-two',
        subject: 'alice',
      });
    assert.notEqual(owner, otherIssuer);
    let store = new WorkspaceStore(db, owner);
    const note = await store.createNote('Título', 'Original');
    const memory = await store.createMemory(
      'Preferência explícita',
      'preference',
    );
    const results = await Promise.allSettled([
      store.updateNote(note.id, 'Título', 'Vencedor A', 1),
      store.updateNote(note.id, 'Título', 'Vencedor B', 1),
    ]);
    assert.equal(
      results.filter((result) => result.status === 'fulfilled').length,
      1,
    );
    assert.equal(
      results.filter((result) => result.status === 'rejected').length,
      1,
    );
    db.close();
    db = createTestD1(join(dir, 'workspace.sqlite'), false);
    assert.equal(
      await ownerForIdentity(db, {
        issuer: 'verified:site-one',
        subject: 'alice',
      }),
      owner,
    );
    store = new WorkspaceStore(db, owner);
    assert.equal((await store.note(note.id))?.revision, 2);
    assert.equal((await store.memories())[0].id, memory.id);
    assert.equal(
      await new WorkspaceStore(db, otherIssuer).note(note.id),
      undefined,
    );
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('proposal creation/confirmation retry is exact, atomic and owner scoped; pause fences queued runs', async (context) => {
  const f = fixture();
  context.after(() => f.db.close());
  const input = { message: phrase, timezone: 'America/Sao_Paulo' };
  const proposals = await Promise.all([
    f.call<{ id: string }>('/api/proposals', 'POST', input, 'alice', {
      'idempotency-key': 'same-attempt',
    }),
    f.call<{ id: string }>('/api/proposals', 'POST', input, 'alice', {
      'idempotency-key': 'same-attempt',
    }),
  ]);
  assert.equal(proposals[0].data.id, proposals[1].data.id);
  assert.equal(
    (
      await f.call(
        '/api/proposals',
        'POST',
        { message: phrase.replace('9h', '10h'), timezone: 'America/Sao_Paulo' },
        'alice',
        { 'idempotency-key': 'same-attempt' },
      )
    ).response.status,
    409,
  );
  const id = proposals[0].data.id;
  const confirmations = await Promise.all([
    f.call<{ id: string }>('/api/proposals/' + id + '/confirm', 'POST'),
    f.call<{ id: string }>('/api/proposals/' + id + '/confirm', 'POST'),
  ]);
  assert.equal(confirmations[0].response.status, 201);
  assert.equal(confirmations[0].data.id, confirmations[1].data.id);
  assert.equal((await f.call<unknown[]>('/api/tasks')).data.length, 1);
  const task = confirmations[0].data.id;
  const queued = await f.call<{ id: string }>(
    '/api/tasks/' + task + '/test',
    'POST',
    undefined,
    'alice',
    { 'idempotency-key': 'manual-a' },
  );
  assert.equal(queued.response.status, 202);
  assert.equal(
    (await f.call('/api/tasks/' + task, 'PATCH', { enabled: false })).response
      .status,
    200,
  );
  const executions =
    await f.call<{ id: string; status: string }[]>('/api/executions');
  assert.equal(executions.data[0].status, 'skipped');
  assert.equal(
    (
      await f.call('/api/tasks/' + task + '/test', 'POST', undefined, 'alice', {
        'idempotency-key': 'manual-b',
      })
    ).response.status,
    409,
  );
  assert.equal(
    (await f.call('/api/tasks/' + task, 'PATCH', { enabled: true })).response
      .status,
    200,
  );
  for (const [path, method, input] of [
    [`/api/tasks/${task}`, 'PATCH', { enabled: false }],
    [`/api/tasks/${task}/test`, 'POST', undefined],
    [`/api/executions/${queued.data.id}/events`, 'GET', undefined],
    [`/api/executions/${queued.data.id}/briefing`, 'GET', undefined],
  ] as const)
    assert.equal(
      (
        await f.call(
          path,
          method,
          input,
          'bob',
          method === 'POST' ? { 'idempotency-key': 'foreign' } : {},
        )
      ).response.status,
      404,
      path,
    );
  const owner = await ownerForIdentity(f.db, {
      issuer: 'fixture:test-only',
      subject: 'alice',
    }),
    store = new WorkspaceStore(f.db, owner);
  const expired = await store.propose(
    {
      cadence: 'daily',
      time: '09:00',
      timezone: 'America/Sao_Paulo',
      quantity: 3,
      topic: 'AI',
      deliveryRequested: true,
    },
    'expired-fixture',
    new Date('2000-01-01'),
  );
  await assert.rejects(
    store.confirmProposal(expired.id),
    (error) => error instanceof AssistantError && error.code === 'expired',
  );
  assert.equal((await store.listTasks()).length, 1);
});

test('only explicitly selected current memory/note enters remote prompt; removed context cannot return through history', async (context) => {
  const inputs: string[] = [];
  const f = fixture(
    fixtureServices(async (_owner, messages) => {
      const text = JSON.stringify(messages);
      inputs.push(text);
      return {
        reply: text.includes('private-choice')
          ? 'Resposta fixture private-choice'
          : 'Resposta fixture sem contexto privado',
        model: { provider: 'fixture', name: 'test-only' },
      };
    }),
  );
  context.after(() => f.db.close());
  const memory = await f.call<{ id: string }>('/api/memories', 'POST', {
      content: 'private-choice',
      category: 'preference',
    }),
    note = await f.call<{ id: string }>('/api/notes', 'POST', {
      title: 'privado',
      content: 'selected-note-fixture',
    });
  const first = await f.call<{ conversationId: string }>(
    '/api/chat/messages',
    'POST',
    { message: 'Olá', memoryIds: [memory.data.id], noteIds: [note.data.id] },
  );
  assert.equal(first.response.status, 200);
  assert.ok(inputs[0].includes('private-choice'));
  assert.ok(inputs[0].includes('selected-note-fixture'));
  const second = await f.call('/api/chat/messages', 'POST', {
    message: 'Sem contexto agora',
    conversationId: first.data.conversationId,
    memoryIds: [],
    noteIds: [],
  });
  assert.equal(second.response.status, 200);
  assert.equal(inputs[1].includes('private-choice'), false);
  assert.equal(inputs[1].includes('selected-note-fixture'), false);
  const searched = await f.call('/api/chat/messages', 'POST', {
    message: '/notas selected-note-fixture',
    conversationId: first.data.conversationId,
  });
  assert.equal(searched.response.status, 200);
  assert.ok(JSON.stringify(searched.data).includes('selected-note-fixture'));
  assert.equal(
    (
      await f.call('/api/chat/messages', 'POST', {
        message: 'Continue sem contexto escolhido',
        conversationId: first.data.conversationId,
      })
    ).response.status,
    200,
  );
  assert.equal(inputs[2].includes('selected-note-fixture'), false);
  await f.call('/api/memories/' + memory.data.id, 'DELETE');
  await f.call('/api/notes/' + note.data.id, 'DELETE');
  assert.equal(
    (
      await f.call('/api/chat/messages', 'POST', {
        message: 'Teste',
        memoryIds: [memory.data.id],
      })
    ).response.status,
    404,
  );
  assert.equal(inputs.length, 3);
  assert.deepEqual((await f.call('/api/memories')).data, []);
  assert.equal((await f.call<unknown[]>('/api/conversations')).data.length, 1);
});

test('in-flight reply is fenced: concurrent turn conflicts and deleted conversation cannot resurrect', async (context) => {
  let entered: () => void = () => undefined,
    release: () => void = () => undefined;
  const began = new Promise<void>((resolve) => (entered = resolve)),
    gate = new Promise<void>((resolve) => (release = resolve));
  const f = fixture(
    fixtureServices(async () => {
      entered();
      await gate;
      return {
        reply: 'Resposta fixture após pausa.',
        model: { provider: 'fixture', name: 'test-only' },
      };
    }),
  );
  context.after(() => f.db.close());
  const start = await f.call<{ conversationId: string }>(
      '/api/chat/messages',
      'POST',
      { message: '/tarefas' },
    ),
    id = start.data.conversationId;
  const pending = f.call('/api/chat/messages', 'POST', {
    message: 'Aguarde',
    conversationId: id,
  });
  await began;
  assert.equal(
    (
      await f.call('/api/chat/messages', 'POST', {
        message: 'Concorrente',
        conversationId: id,
      })
    ).response.status,
    409,
  );
  assert.equal(
    (await f.call('/api/conversations/' + id, 'DELETE')).response.status,
    204,
  );
  release();
  assert.equal((await pending).response.status, 404);
  assert.deepEqual((await f.call('/api/conversations')).data, []);
  assert.equal(
    (
      f.db.database.prepare('SELECT COUNT(*) as count FROM messages').get() as {
        count: number;
      }
    ).count,
    0,
  );
});

test('secrets, unavailable provider, quota and malformed/oversized/aborted request bodies fail safely', async (context) => {
  const f = fixture(
    fixtureServices(async () => {
      throw {
        code: 'quota_exhausted',
        status: 429,
        retryAfter: 60,
        message: 'secret-provider-body',
      };
    }),
  );
  context.after(() => f.db.close());
  for (const path of ['/api/notes', '/api/memories', '/api/chat/messages']) {
    const input =
      path === '/api/notes'
        ? { title: 'segredo', content: 'gsk_abcdefghijklmnopqrstuvwx' }
        : path === '/api/memories'
          ? { content: 'gsk_abcdefghijklmnopqrstuvwx', category: 'preference' }
          : { message: 'gsk_abcdefghijklmnopqrstuvwx' };
    const result = await f.call(path, 'POST', input);
    assert.equal(result.response.status, 400);
    assert.equal(JSON.stringify(result.data).includes('gsk_'), false);
  }
  assert.equal(hasTextSecret('gsk_abcdefghijklmnopqrstuvwx'), true);
  assert.equal(redactTextSecrets('gsk_abcdefghijklmnopqrstuvwx'), '[REDACTED]');
  const quota = await f.call('/api/chat/messages', 'POST', {
    message: 'Pergunta de fixture',
  });
  assert.equal(quota.response.status, 429);
  assert.equal(quota.response.headers.get('retry-after'), '60');
  assert.equal(
    JSON.stringify(quota.data).includes('secret-provider-body'),
    false,
  );
  assert.deepEqual((await f.call('/api/conversations')).data, []);
  for (const content of [
    '{bad',
    JSON.stringify({ title: 'big', content: 'x'.repeat(70_000) }),
  ]) {
    const response = await f.worker.fetch(
      new Request(origin + '/api/notes', {
        method: 'POST',
        headers: {
          'x-test-subject': 'alice',
          'content-type': 'application/json',
          origin,
        },
        body: content,
      }),
      f.env,
    );
    assert.equal(response.status, 400);
  }
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    body(
      new Request(origin + '/api/notes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
        signal: controller.signal,
      }),
    ),
    AssistantError,
  );
  const chunks = new ReadableStream<Uint8Array>({
    start(stream) {
      for (let i = 0; i < 1100; i++)
        stream.enqueue(new TextEncoder().encode(' '));
      stream.close();
    },
  });
  await assert.rejects(
    body(
      new Request(origin + '/api/notes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: chunks,
        duplex: 'half',
      } as RequestInit),
    ),
    AssistantError,
  );
  assert.deepEqual((await f.call('/api/notes')).data, []);
});

test('unconfigured real remote-service adapter returns honest unavailable with no fabricated conversation', async (context) => {
  const db = createTestD1();
  context.after(() => db.close());
  const worker = createCloudWorker({
    authenticate: async () => ({
      issuer: 'fixture:test-only',
      subject: 'unavailable',
    }),
  });
  const env: CloudEnv = { DB: db, SITE_ORIGIN: origin };
  const response = await worker.fetch(
    new Request(origin + '/api/chat/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin },
      body: JSON.stringify({
        message: 'Pergunta de teste sem provedor configurado.',
      }),
    }),
    env,
  );
  assert.equal(response.status, 503);
  const list = await worker.fetch(
    new Request(origin + '/api/conversations'),
    env,
  );
  assert.deepEqual(await list.json(), []);
  const status = await worker.fetch(
    new Request(origin + '/api/assistant/status'),
    env,
  );
  const data = (await status.json()) as {
    configured: boolean;
    available: boolean;
  };
  assert.equal(data.configured, false);
  assert.equal(data.available, false);
});

test('bounded terminal retention preserves queued/running work and other owners; events cascade', async (context) => {
  const db = createTestD1();
  context.after(() => db.close());
  const owner = await ownerForIdentity(db, {
      issuer: 'fixture',
      subject: 'retention-a',
    }),
    other = await ownerForIdentity(db, {
      issuer: 'fixture',
      subject: 'retention-b',
    });
  const store = new WorkspaceStore(db, owner),
    foreign = new WorkspaceStore(db, other);
  const draft = {
    cadence: 'daily' as const,
    time: '09:00',
    timezone: 'America/Sao_Paulo',
    quantity: 3,
    topic: 'AI',
    deliveryRequested: true as const,
  };
  const task = (await store.confirmProposal((await store.propose(draft)).id))!,
    foreignTask = (await foreign.confirmProposal(
      (await foreign.propose(draft)).id,
    ))!;
  const insert = db.database.prepare(
    'INSERT INTO executions (owner_id,id,task_id,occurrence_key,scheduled_for,status,attempt,max_attempts,available_at,schedule_revision,snapshot_json,created_at,updated_at) VALUES (?,?,?,?,?,?,0,3,?,1,?,?,?)',
  );
  const event = db.database.prepare(
    'INSERT INTO execution_events VALUES (?,?,?,?,?,?)',
  );
  let oldest = '';
  db.database.transaction(() => {
    for (let index = 0; index < 501; index++) {
      const id = crypto.randomUUID(),
        at = new Date(Date.UTC(2026, 0, 1) + index * 1000).toISOString();
      if (index === 0) oldest = id;
      insert.run(
        owner,
        id,
        task.id,
        `fixture:${index}`,
        at,
        'succeeded',
        at,
        JSON.stringify({ topic: 'AI', quantity: 3 }),
        at,
        at,
      );
      event.run(owner, crypto.randomUUID(), id, 'succeeded', at, null);
    }
    for (const [who, currentTask, status] of [
      [owner, task, 'pending'],
      [owner, task, 'running'],
      [other, foreignTask, 'succeeded'],
    ] as const) {
      const id = crypto.randomUUID(),
        at = '2026-02-01T00:00:00.000Z';
      insert.run(
        who,
        id,
        currentTask.id,
        `fixture:${status}`,
        at,
        status,
        at,
        '{}',
        at,
        at,
      );
      event.run(who, crypto.randomUUID(), id, 'fixture', at, null);
    }
  })();
  await store.pruneExecutionHistory();
  const count = (sql: string, ...args: unknown[]) =>
    (db.database.prepare(sql).get(...args) as { count: number }).count;
  assert.equal(
    count(
      "SELECT COUNT(*) as count FROM executions WHERE owner_id=? AND status='succeeded'",
      owner,
    ),
    500,
  );
  assert.equal(
    count(
      "SELECT COUNT(*) as count FROM executions WHERE owner_id=? AND status IN ('pending','running')",
      owner,
    ),
    2,
  );
  assert.equal(
    count('SELECT COUNT(*) as count FROM executions WHERE owner_id=?', other),
    1,
  );
  assert.equal(
    count(
      'SELECT COUNT(*) as count FROM execution_events WHERE owner_id=? AND execution_id=?',
      owner,
      oldest,
    ),
    0,
  );
  assert.equal(
    count(
      'SELECT COUNT(*) as count FROM execution_events WHERE owner_id=?',
      other,
    ),
    1,
  );
});

test('cloud curated AI briefing scope is enforced before creation or task edits', async (context) => {
  const f = fixture();
  context.after(() => f.db.close());
  const invalid = await f.call('/api/proposals', 'POST', {
    message: phrase.replace('inteligência artificial', 'games'),
    timezone: 'America/Sao_Paulo',
  });
  assert.equal(invalid.response.status, 400);
  assert.ok(JSON.stringify(invalid.data).includes('RSS'));
  assert.deepEqual((await f.call('/api/proposals')).data, []);
  const proposed = await f.call<{ id: string }>('/api/proposals', 'POST', {
    message: phrase,
    timezone: 'America/Sao_Paulo',
  });
  const task = await f.call<{ id: string }>(
    '/api/proposals/' + proposed.data.id + '/confirm',
    'POST',
  );
  assert.equal(
    (await f.call('/api/tasks/' + task.data.id, 'PATCH', { topic: 'games' }))
      .response.status,
    400,
  );
  assert.equal(
    (await f.call<{ topic: string }[]>('/api/tasks')).data[0].topic,
    'inteligência artificial',
  );
});

test('default worker denies fake identity headers outside authenticated lane, rate budget is owner-scoped', async (context) => {
  const db = createTestD1();
  context.after(() => db.close());
  const worker = createCloudWorker();
  const response = await worker.fetch(
    new Request(origin + '/api/notes', {
      headers: {
        'x-test-subject': 'alice',
        'x-owner-id': crypto.randomUUID(),
        'oai-authenticated-user-id': 'alice',
      },
    }),
    { DB: db, SITE_ORIGIN: origin, AUTH_MODE: 'cloudflare-access' },
  );
  assert.equal(response.status, 401);
  const owner = await ownerForIdentity(db, {
      issuer: 'fixture',
      subject: 'rate-a',
    }),
    other = await ownerForIdentity(db, {
      issuer: 'fixture',
      subject: 'rate-b',
    });
  const store = new WorkspaceStore(db, owner);
  for (let i = 0; i < 60; i++)
    assert.equal(await store.consumeApiBudget(true, 60_000), true);
  assert.equal(await store.consumeApiBudget(true, 60_000), false);
  assert.equal(
    await new WorkspaceStore(db, other).consumeApiBudget(true, 60_000),
    true,
  );
  assert.equal(await store.consumeApiBudget(true, 120_000), true);
});
