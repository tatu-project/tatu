import assert from 'node:assert/strict';
import test from 'node:test';
import { createCloudWorker } from './index.js';
import { createTestD1 } from './test-d1.js';
import { ColabStore } from './colab-store.js';
import { base64, hash } from './colab-crypto.js';
import type { CloudEnv, RemoteServices } from './types.js';
import { AssistantError } from '@tatu/shared';
import { WorkspaceStore, ownerForIdentity } from './storage.js';

const origin = 'https://tatu.test';
const encoder = new TextEncoder();
const bytes = (text: string) =>
  Uint8Array.from(atob(text), (character) => character.charCodeAt(0));
type Envelope = {
  version: number;
  algorithm: string;
  fingerprint: string;
  origin: string;
  projectId: string;
  wrappedKey: string;
  nonce: string;
  ciphertext: string;
};
type Paired = { sessionToken: string; expiresAt: string };
type Queued = {
  jobId: string;
  conversationId: string;
  status: string;
  expiresAt: string;
};
type Claimed = {
  job: {
    id: string;
    leaseToken: string;
    messages: { role: string; content: string }[];
  } | null;
};
const fixture = () => {
  const db = createTestD1();
  const env: CloudEnv = {
    DB: db,
    AUTH_MODE: 'sites',
    SITES_OWNER_PRIVATE: '1',
    SITE_PROJECT_ID: 'appgprj_testproject123',
    SITE_ORIGIN: origin,
    TATU_COLAB_SITES_SERVICE_TOKEN:
      'fixture-outer-service-token-that-is-not-real-123456789',
  };
  let remoteCalls = 0;
  const services: RemoteServices = {
    reply: async () => {
      remoteCalls++;
      throw new AssistantError('unavailable');
    },
    status: async () => ({
      configured: false,
      available: false,
      model: null,
      reason: 'not_configured',
    }),
    connections: async () => [],
    connect: async () => null,
    disconnect: async () => false,
  };
  const worker = createCloudWorker({
    authenticate: async (request) =>
      request.headers.has('x-test-subject')
        ? {
            issuer: 'fixture-only',
            subject: request.headers.get('x-test-subject')!,
          }
        : null,
    services: () => services,
  });
  const call = async <T = Record<string, unknown>>(
    path: string,
    method = 'GET',
    input?: unknown,
    subject: string | null = 'alice',
    headers: Record<string, string> = {},
  ) => {
    const response = await worker.fetch(
      new Request(origin + path, {
        method,
        headers: {
          ...(subject ? { 'x-test-subject': subject } : {}),
          ...(input !== undefined
            ? { 'content-type': 'application/json' }
            : {}),
          ...headers,
        },
        body: input === undefined ? undefined : JSON.stringify(input),
      }),
      env,
    );
    const text = await response.text();
    return {
      status: response.status,
      data: (text ? JSON.parse(text) : undefined) as T,
      headers: response.headers,
    };
  };
  const pair = async (subject = 'alice') => {
    const keys = await crypto.subtle.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['encrypt', 'decrypt'],
    );
    const spki = new Uint8Array(
      await crypto.subtle.exportKey('spki', keys.publicKey),
    );
    const publicKeyPem = `-----BEGIN PUBLIC KEY-----\n${base64(spki)}\n-----END PUBLIC KEY-----`;
    const connected = await call<{ envelope: Envelope }>(
      '/api/colab/connect',
      'POST',
      {
        publicKeyPem,
        mode: 'manual',
        paidUnitsConfirmed: false,
        contextConsent: true,
      },
      subject,
    );
    assert.equal(connected.status, 201);
    const envelope = connected.data.envelope;
    assert.equal(envelope.fingerprint, await hash(spki));
    const unwrapped = await crypto.subtle.decrypt(
      { name: 'RSA-OAEP' },
      keys.privateKey,
      bytes(envelope.wrappedKey),
    );
    const aes = await crypto.subtle.importKey(
      'raw',
      unwrapped,
      'AES-GCM',
      false,
      ['decrypt'],
    );
    const aad = encoder.encode(
      JSON.stringify([
        'tatu-colab-bootstrap',
        1,
        envelope.projectId,
        envelope.origin,
        envelope.fingerprint,
      ]),
    );
    const plaintext = new TextDecoder().decode(
      await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: bytes(envelope.nonce),
          additionalData: aad,
          tagLength: 128,
        },
        aes,
        bytes(envelope.ciphertext),
      ),
    );
    const bootstrap = JSON.parse(plaintext) as {
      pairToken: string;
      serviceToken: string;
    };
    assert.equal(bootstrap.serviceToken, env.TATU_COLAB_SITES_SERVICE_TOKEN);
    assert.ok(!JSON.stringify(connected.data).includes(bootstrap.pairToken));
    assert.ok(!JSON.stringify(connected.data).includes(bootstrap.serviceToken));
    await assert.rejects(
      crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: bytes(envelope.nonce),
          additionalData: encoder.encode('changed-origin'),
          tagLength: 128,
        },
        aes,
        bytes(envelope.ciphertext),
      ),
    );
    const paired = await call<Paired>(
      '/api/colab/runtime/pair',
      'POST',
      { pairToken: bootstrap.pairToken },
      null,
    );
    assert.equal(paired.status, 200);
    return { ...paired.data, bootstrap, envelope };
  };
  return { db, env, call, pair, remoteCalls: () => remoteCalls };
};

test('Colab queued context preserves mandatory messages and newest complete pairs within the Python twelve-message bound', async (t) => {
  for (const withSelected of [false, true]) {
    await t.test(`selected context: ${withSelected}`, async (t) => {
      const f = fixture();
      t.after(() => f.db.close());
      const p = await f.pair();
      const owner = await ownerForIdentity(f.db, {
        issuer: 'fixture-only',
        subject: 'alice',
      });
      const store = new WorkspaceStore(f.db, owner);
      const conversation = await store.createConversation('Short turns');
      for (let index = 0; index < 10; index++) {
        const token = await store.claimTurn(conversation.id, index);
        await store.appendTurn(
          conversation.id,
          index,
          token,
          `Question ${index}`,
          `Answer ${index}`,
          '',
        );
      }
      const note = await store.createNote(
        'Selected title',
        'Selected note content',
      );
      const memory = await store.createMemory(
        'Selected preference',
        'preference',
      );
      const queued = await f.call<Queued>('/api/chat/messages', 'POST', {
        provider: 'colab',
        contextConsent: true,
        conversationId: conversation.id,
        message: 'Explain solar energy.',
        ...(withSelected ? { noteIds: [note.id], memoryIds: [memory.id] } : {}),
      });
      assert.equal(queued.status, 202);
      const claim = await f.call<Claimed>(
        '/api/colab/runtime/claim',
        'POST',
        {},
        null,
        {
          authorization: `Bearer ${p.sessionToken}`,
        },
      );
      assert.equal(claim.status, 200);
      const messages = claim.data.job!.messages;
      assert.equal(messages.length, withSelected ? 11 : 12);
      assert.equal(messages[0].role, 'system');
      assert.deepEqual(messages.at(-1), {
        role: 'user',
        content: 'Explain solar energy.',
      });
      if (withSelected) {
        assert.equal(messages[1].role, 'system');
        assert.ok(messages[1].content.includes('Selected note content'));
        assert.ok(messages[1].content.includes('Selected preference'));
      }
      const history = messages.slice(withSelected ? 2 : 1, -1);
      const firstIndex = withSelected ? 6 : 5;
      assert.deepEqual(
        history,
        Array.from({ length: 10 - firstIndex }, (_, offset) => [
          { role: 'user', content: `Question ${firstIndex + offset}` },
          { role: 'assistant', content: `Answer ${firstIndex + offset}` },
        ]).flat(),
      );
      assert.equal(
        (await store.conversation(conversation.id))!.messages.length,
        20,
      );
      assert.equal(f.remoteCalls(), 0);
    });
  }
});

test('Colab history exclusion is explicit per turn, does not erase records, and rejects malformed flags', async (t) => {
  for (const includeHistory of [undefined, true, false]) {
    await t.test(`includeHistory: ${includeHistory}`, async (t) => {
      const f = fixture();
      t.after(() => f.db.close());
      const p = await f.pair();
      const owner = await ownerForIdentity(f.db, {
        issuer: 'fixture-only',
        subject: 'alice',
      });
      const store = new WorkspaceStore(f.db, owner);
      const conversation = await store.createConversation('Synthetic context');
      const token = await store.claimTurn(conversation.id, 0);
      await store.appendTurn(
        conversation.id,
        0,
        token,
        'Previous synthetic question',
        'Synthetic refusal for the previous question.',
        '',
      );
      const note = await store.createNote(
        'Chosen note',
        'Benign selected content',
      );
      const input = {
        provider: 'colab',
        contextConsent: true,
        conversationId: conversation.id,
        message: 'What is two plus two?',
        noteIds: [note.id],
        ...(includeHistory === undefined ? {} : { includeHistory }),
      };
      for (const invalid of [null, 'false', 0, {}, []]) {
        assert.equal(
          (
            await f.call('/api/chat/messages', 'POST', {
              ...input,
              includeHistory: invalid,
            })
          ).status,
          400,
        );
      }
      assert.equal(
        (await f.call('/api/chat/messages', 'POST', input)).status,
        202,
      );
      const claim = await f.call<Claimed>(
        '/api/colab/runtime/claim',
        'POST',
        {},
        null,
        { authorization: `Bearer ${p.sessionToken}` },
      );
      const messages = claim.data.job!.messages;
      assert.equal(messages.length, includeHistory === false ? 3 : 5);
      assert.equal(
        JSON.stringify(messages).includes('Synthetic refusal'),
        includeHistory !== false,
      );
      assert.ok(messages[1].content.includes('Benign selected content'));
      assert.deepEqual(messages.at(-1), {
        role: 'user',
        content: 'What is two plus two?',
      });
      assert.equal(
        (await store.conversation(conversation.id))!.messages.length,
        2,
      );
      // A new conversation remains isolated even when history is enabled.
      assert.equal(
        (await f.call('/api/colab/jobs/' + claim.data.job!.id, 'DELETE'))
          .status,
        200,
      );
      assert.equal(
        (
          await f.call('/api/chat/messages', 'POST', {
            provider: 'colab',
            contextConsent: true,
            message: 'Explain daylight.',
            includeHistory: true,
          })
        ).status,
        202,
      );
      const payloads = f.db.database
        .prepare('SELECT payload_json FROM colab_jobs ORDER BY rowid')
        .all() as { payload_json: string }[];
      const isolated = JSON.parse(payloads.at(-1)!.payload_json) as {
        role: string;
        content: string;
      }[];
      assert.equal(isolated.length, 2);
      assert.equal(
        JSON.stringify(isolated).includes('Synthetic refusal'),
        false,
      );
    });
  }
});

test('operator, vault or stored AI credential collision disables Colab before envelope or machine authorization', async () => {
  const keys = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt'],
  );
  const publicKeyPem = `-----BEGIN PUBLIC KEY-----\n${base64(new Uint8Array(await crypto.subtle.exportKey('spki', keys.publicKey)))}\n-----END PUBLIC KEY-----`;
  for (const name of [
    'SYSTEM_RUN_TOKEN',
    'TATU_ENCRYPTION_KEY',
    'TATU_PREVIOUS_ENCRYPTION_KEY',
    'TATU_GROQ_API_KEY',
  ]) {
    const f = fixture();
    try {
      const collision =
        name === 'SYSTEM_RUN_TOKEN'
          ? 'fixture-operator-secret-at-least-32-characters'
          : name === 'TATU_GROQ_API_KEY'
            ? 'gsk_' + 'A'.repeat(52)
            : base64(new Uint8Array(32).fill(9));
      f.env[name] = collision;
      f.env.TATU_COLAB_SITES_SERVICE_TOKEN = collision;
      const connected = await f.call('/api/colab/connect', 'POST', {
        publicKeyPem,
        mode: 'manual',
        paidUnitsConfirmed: false,
        contextConsent: true,
      });
      assert.equal(connected.status, 503, name);
      assert.equal(connected.data.envelope, undefined, name);
      assert.ok(!JSON.stringify(connected.data).includes(collision), name);
      assert.equal(
        (await f.call('/api/colab/status')).data.configured,
        false,
        name,
      );
      for (const path of ['pair', 'claim', 'complete']) {
        const runtime = await f.call(
          `/api/colab/runtime/${path}`,
          'POST',
          path === 'pair' ? { pairToken: 'colab_' + 'a'.repeat(64) } : {},
          null,
        );
        assert.equal(runtime.status, 503, name);
        assert.ok(!JSON.stringify(runtime.data).includes(collision), name);
      }
      assert.equal(
        (
          f.db.database
            .prepare('SELECT COUNT(*) n FROM colab_sessions')
            .get() as { n: number }
        ).n,
        0,
        name,
      );
      f.env.TATU_COLAB_SITES_SERVICE_TOKEN =
        'fixture-independent-platform-only-token-123456789';
      const note = await f.call('/api/notes', 'POST', {
        title: 'Credencial protegida',
        content: collision,
      });
      assert.equal(note.status, 400, name);
      assert.ok(!JSON.stringify(note.data).includes(collision), name);
      assert.equal(
        (
          await f.call('/api/colab/connect', 'POST', {
            publicKeyPem,
            mode: 'manual',
            paidUnitsConfirmed: false,
            contextConsent: true,
          })
        ).status,
        201,
        name,
      );
    } finally {
      f.db.close();
    }
  }
});

test('encrypted bootstrap binds key/origin/project, pairing is one-use, DB and metadata contain only credential hashes', async (t) => {
  const f = fixture();
  t.after(() => f.db.close());
  const p = await f.pair();
  assert.equal(
    (
      await f.call(
        '/api/colab/runtime/pair',
        'POST',
        { pairToken: p.bootstrap.pairToken },
        null,
      )
    ).status,
    401,
  );
  const row = f.db.database.prepare('SELECT * FROM colab_sessions').get();
  assert.ok(!JSON.stringify(row).includes(p.sessionToken));
  assert.ok(!JSON.stringify(row).includes(p.bootstrap.pairToken));
  assert.ok(!JSON.stringify(row).includes(p.bootstrap.serviceToken));
  const status = await f.call('/api/colab/status');
  assert.equal(status.data.connected, true);
  assert.equal(status.data.available, false);
  assert.ok(!JSON.stringify(status.data).includes('hash'));
});

test('Colab queues selected context only, one claim, fenced complete stores exactly one pair with no fallback', async (t) => {
  const f = fixture();
  t.after(() => f.db.close());
  const p = await f.pair();
  const selected = await f.call<{ id: string }>('/api/memories', 'POST', {
    content: 'Prefiro respostas curtas.',
    category: 'preference',
  });
  await f.call('/api/memories', 'POST', {
    content: 'Memoria nao selecionada.',
    category: 'instruction',
  });
  const q = await f.call<Queued>('/api/chat/messages', 'POST', {
    provider: 'colab',
    contextConsent: true,
    message: 'Explique energia solar.',
    memoryIds: [selected.data.id],
  });
  assert.equal(q.status, 202);
  const headers = { authorization: `Bearer ${p.sessionToken}` };
  const claim = await f.call<Claimed>(
    '/api/colab/runtime/claim',
    'POST',
    {},
    null,
    headers,
  );
  assert.equal(claim.status, 200);
  assert.ok(claim.data.job);
  assert.ok(JSON.stringify(claim.data).includes('Prefiro respostas curtas.'));
  assert.ok(!JSON.stringify(claim.data).includes('Memoria nao selecionada.'));
  assert.equal(
    (
      await f.call<Claimed>(
        '/api/colab/runtime/claim',
        'POST',
        {},
        null,
        headers,
      )
    ).data.job,
    null,
  );
  const job = claim.data.job;
  const complete = {
    jobId: job.id,
    leaseToken: job.leaseToken,
    reply: 'Energia solar usa a luz do Sol.',
    inputTokens: 90,
    outputTokens: 12,
  };
  assert.equal(
    (
      await f.call(
        '/api/colab/runtime/complete',
        'POST',
        complete,
        null,
        headers,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await f.call(
        '/api/colab/runtime/complete',
        'POST',
        complete,
        null,
        headers,
      )
    ).status,
    409,
  );
  const saved = await f.call<{ messages: unknown[] }>(
    '/api/conversations/' + q.data.conversationId,
  );
  assert.equal(saved.data.messages.length, 2);
  const polled = await f.call('/api/colab/jobs/' + q.data.jobId);
  assert.equal(polled.data.status, 'completed');
  const persisted = f.db.database.prepare('SELECT * FROM colab_jobs').get() as {
    payload_json: unknown;
    user_text: unknown;
  };
  assert.equal(persisted.payload_json, null);
  assert.equal(persisted.user_text, null);
  assert.ok(!JSON.stringify(persisted).includes(job.leaseToken));
  assert.equal(f.remoteCalls(), 0);
});

test('outer gate/session bearer never authorizes workspace or system dispatcher; owner and origin boundaries reject', async (t) => {
  const f = fixture();
  t.after(() => f.db.close());
  const p = await f.pair();
  const scopedHeaders: Record<string, string>[] = [
    {
      authorization: `Bearer ${p.sessionToken}`,
      'oai-authenticated-user-id': 'forged-owner',
    },
    {
      'OAI-Sites-Authorization': 'Bearer fixture-gate',
      'oai-authenticated-user-id': 'forged-owner',
    },
  ];
  for (const headers of scopedHeaders) {
    assert.equal(
      (await f.call('/api/memories', 'GET', undefined, 'alice', headers))
        .status,
      401,
    );
    assert.equal(
      (await f.call('/api/system/run-due', 'POST', undefined, null, headers))
        .status,
      401,
    );
  }
  assert.equal(
    (
      await f.call(
        '/api/colab/runtime/claim',
        'POST',
        { ownerId: 'alice' },
        null,
        { authorization: `Bearer ${p.sessionToken}` },
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await f.call('/api/colab/runtime/claim', 'POST', {}, null, {
        authorization: `Bearer ${p.sessionToken}`,
        origin: 'https://evil.test',
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await f.call('/api/colab/runtime/claim', 'POST', {}, null, {
        authorization: `Bearer ${p.sessionToken}`,
        'sec-fetch-site': 'cross-site',
      })
    ).status,
    403,
  );
  const q = await f.call<Queued>('/api/chat/messages', 'POST', {
    provider: 'colab',
    contextConsent: true,
    message: 'Oi, explique nuvens.',
  });
  assert.equal(
    (await f.call('/api/colab/jobs/' + q.data.jobId, 'GET', undefined, 'bob'))
      .status,
    404,
  );
  assert.equal(
    (
      await f.call(
        '/api/colab/jobs/' + q.data.jobId,
        'DELETE',
        undefined,
        'bob',
      )
    ).status,
    404,
  );
});

test('cancel/revoke/conversation delete/expired lease prevent late append and clear queued payloads', async (t) => {
  for (const action of ['cancel', 'revoke', 'delete', 'lease', 'revision']) {
    const f = fixture();
    const p = await f.pair();
    try {
      const q = await f.call<Queued>('/api/chat/messages', 'POST', {
        provider: 'colab',
        contextConsent: true,
        message: 'Pergunta publica.',
      });
      const headers = { authorization: `Bearer ${p.sessionToken}` };
      const c = await f.call<Claimed>(
        '/api/colab/runtime/claim',
        'POST',
        {},
        null,
        headers,
      );
      assert.ok(c.data.job);
      if (action === 'cancel')
        await f.call('/api/colab/jobs/' + q.data.jobId, 'DELETE');
      if (action === 'revoke') await f.call('/api/colab/connect', 'DELETE');
      if (action === 'delete')
        await f.call('/api/conversations/' + q.data.conversationId, 'DELETE');
      if (action === 'lease')
        f.db.database
          .prepare(
            "UPDATE colab_jobs SET lease_until='2000-01-01T00:00:00.000Z'",
          )
          .run();
      if (action === 'revision')
        f.db.database
          .prepare('UPDATE conversations SET revision=revision+1')
          .run();
      const response = await f.call(
        '/api/colab/runtime/complete',
        'POST',
        {
          jobId: c.data.job.id,
          leaseToken: c.data.job.leaseToken,
          reply: 'Nao deve ser salva.',
          inputTokens: 80,
          outputTokens: 8,
        },
        null,
        headers,
      );
      assert.ok([401, 409].includes(response.status), action);
      assert.equal(
        f.db.database.prepare('SELECT COUNT(*) AS n FROM messages').get() &&
          (
            f.db.database
              .prepare('SELECT COUNT(*) AS n FROM messages')
              .get() as { n: number }
          ).n,
        0,
        action,
      );
      if (action !== 'delete' && action !== 'revision')
        assert.equal(
          (
            f.db.database
              .prepare('SELECT payload_json FROM colab_jobs')
              .get() as { payload_json: unknown }
          ).payload_json,
          null,
          action,
        );
    } finally {
      f.db.close();
    }
  }
  void t;
});

test('honest missing/expired connection, consent, active units, output/token/credential caps fail before writes', async (t) => {
  const f = fixture();
  t.after(() => f.db.close());
  assert.equal(
    (
      await f.call('/api/chat/messages', 'POST', {
        provider: 'colab',
        contextConsent: true,
        message: 'Oi.',
      })
    ).status,
    503,
  );
  assert.equal(
    (
      f.db.database.prepare('SELECT COUNT(*) n FROM conversations').get() as {
        n: number;
      }
    ).n,
    0,
  );
  assert.equal(
    (
      await f.call('/api/colab/connect', 'POST', {
        publicKeyPem: 'invalid',
        mode: 'active',
        paidUnitsConfirmed: false,
        contextConsent: true,
      })
    ).status,
    400,
  );
  const p = await f.pair();
  assert.equal(
    (
      await f.call('/api/chat/messages', 'POST', {
        provider: 'colab',
        message: 'Oi.',
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await f.call('/api/chat/messages', 'POST', {
        provider: 'colab',
        contextConsent: true,
        message: p.sessionToken,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await f.call('/api/chat/messages', 'POST', {
        provider: 'colab',
        contextConsent: true,
        message: 'x'.repeat(4096),
      })
    ).status,
    413,
  );
  const q = await f.call<Queued>('/api/chat/messages', 'POST', {
    provider: 'colab',
    contextConsent: true,
    message: 'Explique a chuva.',
  });
  assert.equal(
    (
      await f.call('/api/chat/messages', 'POST', {
        provider: 'colab',
        contextConsent: true,
        message: 'Outra pergunta.',
      })
    ).status,
    409,
  );
  const headers = { authorization: `Bearer ${p.sessionToken}` };
  const c = await f.call<Claimed>(
    '/api/colab/runtime/claim',
    'POST',
    {},
    null,
    headers,
  );
  assert.ok(c.data.job);
  for (const extra of [
    { outputTokens: 257 },
    { inputTokens: 1025 },
    { reply: p.sessionToken },
    { reply: 'gsk_' + 'A'.repeat(40) },
  ]) {
    assert.equal(
      (
        await f.call(
          '/api/colab/runtime/complete',
          'POST',
          {
            jobId: c.data.job.id,
            leaseToken: c.data.job.leaseToken,
            reply: 'Resposta.',
            inputTokens: 80,
            outputTokens: 8,
            ...extra,
          },
          null,
          headers,
        )
      ).status,
      400,
    );
  }
  assert.equal(
    (
      await f.call(
        '/api/colab/runtime/complete',
        'POST',
        {
          jobId: q.data.jobId,
          leaseToken: c.data.job.leaseToken,
          error: 'input_too_large',
        },
        null,
        headers,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      f.db.database.prepare('SELECT COUNT(*) n FROM messages').get() as {
        n: number;
      }
    ).n,
    0,
  );
  f.db.database
    .prepare("UPDATE colab_sessions SET expires_at='2000-01-01T00:00:00.000Z'")
    .run();
  assert.equal(
    (await f.call('/api/colab/runtime/claim', 'POST', {}, null, headers))
      .status,
    401,
  );
  assert.equal((await f.call('/api/colab/status')).data.reason, 'expired');
  assert.equal(f.remoteCalls(), 0);
});

test('expired pair cannot be consumed, claim/job quotas remain durable and owner-scoped', async (t) => {
  const f = fixture();
  t.after(() => f.db.close());
  const p = await f.pair();
  const row = f.db.database
    .prepare('SELECT owner_id,id FROM colab_sessions')
    .get() as { owner_id: string; id: string };
  const store = new ColabStore(f.db, row.owner_id);
  const token = 'colab_' + 'a'.repeat(64);
  await store.reservePair('manual', token);
  f.db.database
    .prepare(
      "UPDATE colab_sessions SET pair_expires_at='2000-01-01T00:00:00.000Z'",
    )
    .run();
  await assert.rejects(ColabStore.pair(f.db, token));
  await f.pair();
  const session = f.db.database
    .prepare('SELECT id FROM colab_sessions')
    .get() as { id: string };
  f.db.database
    .prepare('UPDATE colab_sessions SET poll_window=?,poll_count=25')
    .run(Math.floor(Date.now() / 60000));
  await assert.rejects(store.claim(session.id));
  f.db.database
    .prepare(
      'INSERT INTO colab_usage(owner_id,lane,window_hour,count) VALUES (?,?,?,20)',
    )
    .run(row.owner_id, 'job', Math.floor(Date.now() / 3600000));
  assert.equal(
    (
      await f.call('/api/chat/messages', 'POST', {
        provider: 'colab',
        contextConsent: true,
        message: 'Cota esgotada.',
      })
    ).status,
    429,
  );
  assert.equal(
    (
      f.db.database.prepare('SELECT COUNT(*) n FROM colab_jobs').get() as {
        n: number;
      }
    ).n,
    0,
  );
  assert.ok(
    !JSON.stringify(await f.call('/api/colab/status')).includes(p.sessionToken),
  );
});

test('concurrent queue/claim and completion rollback preserve one answer and other-session isolation', async (t) => {
  const f = fixture();
  t.after(() => f.db.close());
  const alice = await f.pair(),
    bob = await f.pair('bob');
  const queued = await Promise.all(
    [1, 2].map((i) =>
      f.call<Queued>('/api/chat/messages', 'POST', {
        provider: 'colab',
        contextConsent: true,
        message: `Pergunta publica ${i}.`,
      }),
    ),
  );
  assert.deepEqual(queued.map((q) => q.status).sort(), [202, 409]);
  const q = queued.find((value) => value.status === 202)!;
  const bobHeaders = { authorization: `Bearer ${bob.sessionToken}` };
  assert.equal(
    (
      await f.call<Claimed>(
        '/api/colab/runtime/claim',
        'POST',
        {},
        null,
        bobHeaders,
      )
    ).data.job,
    null,
  );
  const headers = { authorization: `Bearer ${alice.sessionToken}` };
  const claims = await Promise.all(
    [1, 2].map(() =>
      f.call<Claimed>('/api/colab/runtime/claim', 'POST', {}, null, headers),
    ),
  );
  assert.equal(claims.filter((c) => c.data.job).length, 1);
  const claim = claims.find((c) => c.data.job)!.data.job!;
  const complete = {
    jobId: claim.id,
    leaseToken: claim.leaseToken,
    reply: 'Resposta publica.',
    inputTokens: 80,
    outputTokens: 8,
  };
  assert.equal(
    (
      await f.call(
        '/api/colab/runtime/complete',
        'POST',
        complete,
        null,
        bobHeaders,
      )
    ).status,
    409,
  );
  f.db.database.exec(
    "CREATE TRIGGER reject_colab_answer BEFORE INSERT ON messages WHEN NEW.role='assistant' BEGIN SELECT RAISE(ABORT,'fixture injected failure'); END",
  );
  assert.equal(
    (
      await f.call(
        '/api/colab/runtime/complete',
        'POST',
        complete,
        null,
        headers,
      )
    ).status,
    500,
  );
  assert.equal(
    (
      f.db.database.prepare('SELECT COUNT(*) n FROM messages').get() as {
        n: number;
      }
    ).n,
    0,
  );
  assert.equal(
    (await f.call('/api/colab/jobs/' + q.data.jobId)).data.status,
    'running',
  );
  f.db.database.exec('DROP TRIGGER reject_colab_answer');
  assert.equal(
    (
      await f.call(
        '/api/colab/runtime/complete',
        'POST',
        complete,
        null,
        headers,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      f.db.database.prepare('SELECT COUNT(*) n FROM messages').get() as {
        n: number;
      }
    ).n,
    2,
  );
  assert.equal(
    (
      await f.call('/api/memories', 'POST', {
        content: alice.sessionToken,
        category: 'instruction',
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await f.call('/api/notes', 'POST', {
        title: 'Credencial recusada',
        content: f.env.TATU_COLAB_SITES_SERVICE_TOKEN,
      })
    ).status,
    400,
  );
});
