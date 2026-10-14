import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';

import { clientScript } from './client.js';
import { renderHealthPage } from './index.js';
import { pwaAssets, serviceWorkerScript } from './pwa.js';

class Node {
  children: Node[] = [];
  textContent = '';
  value = '';
  className = '';
  dataset: Record<string, string> = {};
  hidden = false;
  disabled = false;
  checked = false;
  type = '';
  href = '';
  rel = '';
  target = '';
  download = '';
  removed = false;
  clicks = 0;
  onclick?: () => Promise<void>;
  onchange?: () => void;
  onsubmit?: (event: unknown) => Promise<void>;
  append(...nodes: Node[]) {
    this.children.push(...nodes);
  }
  replaceChildren() {
    this.children = [];
  }
  focus() {}
  click() {
    this.clicks++;
  }
  remove() {
    this.removed = true;
  }
  setAttribute() {}
  removeAttribute() {}
  // Any accidental markup sink fails the test instead of simulating safe rendering.
  set innerHTML(_value: string) {
    throw new Error('Unsafe HTML sink');
  }
}

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

function browser() {
  const nodes = new Map<string, Node>();
  const calls: Array<{ path: string; options: RequestInit }> = [];
  const listeners: Record<string, () => void> = {};
  const timers = new Map<number, () => void>();
  let timerId = 0;
  let responder = (path: string): { status: number; body: unknown } => {
    if (path === '/api/me')
      return { status: 200, body: { authenticated: true } };
    if (path === '/api/assistant/status')
      return { status: 200, body: { configured: false, available: false } };
    return { status: 200, body: [] };
  };
  const context = vm.createContext({
    document: {
      body: new Node(),
      getElementById: (id: string) => {
        if (!nodes.has(id)) nodes.set(id, new Node());
        return nodes.get(id);
      },
      createElement: () => new Node(),
      querySelectorAll: () => [],
    },
    navigator: { onLine: true },
    window: {
      location: { protocol: 'https:', origin: 'https://tatu.example' },
      addEventListener: (name: string, listener: () => void) => {
        listeners[name] = listener;
      },
      confirm: () => true,
    },
    fetch: async (path: string, options: RequestInit) => {
      calls.push({ path, options });
      const response = responder(path);
      return {
        ok: response.status >= 200 && response.status < 300,
        status: response.status,
        headers: { get: () => '60' },
        json: async () => response.body,
      };
    },
    URL,
    Blob,
    Intl,
    AbortController,
    crypto: { randomUUID: () => 'fixed-key' },
    setInterval: () => 0,
    setTimeout: (fn: () => void) => {
      timers.set(++timerId, fn);
      return timerId;
    },
    clearTimeout: (id: number) => {
      timers.delete(id);
    },
  });
  vm.runInContext(clientScript, context);
  return {
    context,
    nodes,
    calls,
    listeners,
    tick: () => {
      const pending = [...timers.values()];
      timers.clear();
      for (const fn of pending) fn();
    },
    respond: (fn: typeof responder) => {
      responder = fn;
    },
  };
}

test('renders hostile conversation/source content as inert text and only opens safe HTTPS citations', async () => {
  const app = browser();
  await flush();
  const payload = '<img src=x onerror=alert(1)><script>alert(1)</script>';
  vm.runInContext(
    `conversationId='c';renderMessages([{role:'assistant',content:${JSON.stringify(payload)}}]);`,
    app.context,
  );
  const message = app.nodes.get('messages')!.children[0];
  assert.equal(message.children[1].textContent, payload);
  const parent = new Node();
  app.context.parent = parent;
  const bad = [
    'javascript:alert(1)',
    'http://example.org/',
    'https://user:pass@example.org/',
    'https://example.org/?token=secret',
    'https://example.org/?client-secret=secret',
    'https://example.org/?utm_credential=value',
    'https://example.org/?query=Bearer%20private',
  ];
  for (const url of bad) {
    assert.equal(
      vm.runInContext(`safeSourceUrl(${JSON.stringify(url)})`, app.context),
      null,
    );
  }
  vm.runInContext(
    `renderStories(parent,[{title:${JSON.stringify(payload)},source:'Fonte',publishedAt:'2026-10-12',url:'https://example.org/news'}]);`,
    app.context,
  );
  assert.equal(parent.children[0].children[0].textContent, payload);
  const anchor = parent.children[0].children[2];
  assert.equal(anchor.href, 'https://example.org/news');
  assert.equal(anchor.rel, 'noopener noreferrer');
  assert.equal(anchor.target, '_blank');
});

test('chat sends only selected note and memory context; unavailable AI remains an error', async () => {
  const app = browser();
  await flush();
  app.respond((path) =>
    path === '/api/chat/messages'
      ? { status: 503, body: {} }
      : {
          status: 200,
          body: path.includes('assistant/status')
            ? { configured: false, available: false }
            : [],
        },
  );
  vm.runInContext(
    `renderMessages([]);selectedMemories.add('chosen-memory');selectedNotes.add('chosen-note');$('message').value='Olá';`,
    app.context,
  );
  await app.nodes.get('chat-form')!.onsubmit!({ preventDefault() {} });
  const request = app.calls.find((call) => call.path === '/api/chat/messages')!;
  const body = JSON.parse(String(request.options.body));
  assert.deepEqual(body.memoryIds, ['chosen-memory']);
  assert.deepEqual(body.noteIds, ['chosen-note']);
  assert.equal(typeof body.timezone, 'string');
  assert.equal(app.nodes.get('message')!.value, 'Olá');
  assert.match(app.nodes.get('notice')!.textContent, /indisponível/);
  assert.equal(app.nodes.get('messages')!.children.length, 0);
});

test('offline mutation cannot reach fetch, and stale note edits preserve unsaved content', async () => {
  const app = browser();
  await flush();
  vm.runInContext(`navigator.onLine=false`, app.context);
  const calls = app.calls.length;
  await assert.rejects(
    vm.runInContext(
      `api('/api/notes',sendBody('POST',{title:'a',content:'b'}))`,
      app.context,
    ),
  );
  assert.equal(app.calls.length, calls);
  vm.runInContext(
    `navigator.onLine=true;editNote({id:'n',title:'Saved',content:'Old',revision:2});$('note-content').value='My unsaved edit';`,
    app.context,
  );
  app.respond(() => ({ status: 409, body: {} }));
  const submitter = new Node();
  await app.nodes.get('note-editor')!.onsubmit!({
    preventDefault() {},
    submitter,
  });
  assert.equal(app.nodes.get('note-content')!.value, 'My unsaved edit');
  assert.equal(app.nodes.get('reload-note')!.hidden, false);
  const last = app.calls.at(-1)!;
  assert.equal(last.options.method, 'PATCH');
  assert.equal(JSON.parse(String(last.options.body)).revision, 2);
});

test('service worker caches only neutral assets and never intercepts API or mutation requests', async () => {
  const handlers: Record<string, (event: unknown) => void> = {};
  const cached: string[][] = [];
  const context = vm.createContext({
    self: {
      location: { origin: 'http://127.0.0.1:3000' },
      addEventListener: (name: string, handler: (event: unknown) => void) => {
        handlers[name] = handler;
      },
      skipWaiting() {},
      clients: { claim() {} },
    },
    caches: {
      open: async () => ({
        addAll: async (paths: string[]) => {
          cached.push(paths);
        },
        match: async () => null,
      }),
      keys: async () => [],
    },
    URL,
    fetch: async () => ({}),
  });
  vm.runInContext(serviceWorkerScript, context);
  let install: Promise<unknown> = Promise.resolve();
  handlers.install({
    waitUntil: (promise: Promise<unknown>) => {
      install = promise;
    },
  });
  await install;
  assert.deepEqual(Array.from(cached[0]), ['/offline.html', '/icon.svg']);
  for (const [pathname, method, mode] of [
    ['/api/conversations', 'GET', 'cors'],
    ['/api/chat/messages', 'POST', 'cors'],
    ['/api/memories', 'GET', 'cors'],
    ['/api/notes', 'DELETE', 'cors'],
  ]) {
    let intercepted = false;
    handlers.fetch({
      request: { url: 'http://127.0.0.1:3000' + pathname, method, mode },
      respondWith() {
        intercepted = true;
      },
    });
    assert.equal(intercepted, false);
  }
  const manifest = JSON.parse(pwaAssets['/manifest.webmanifest'].body);
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.display, 'standalone');
  assert.doesNotMatch(
    pwaAssets['/offline.html'].body,
    /\/api\/|messages|memoryIds|noteIds/,
  );
});

test('task retries reuse the same private key and external proposals require explicit confirmation', async () => {
  const app = browser();
  await flush();
  let attempts = 0;
  app.respond((path) => {
    if (path === '/api/tasks')
      return {
        status: 200,
        body: [
          {
            id: 'task/1',
            enabled: true,
            time: '08:00',
            timezone: 'America/Sao_Paulo',
            quantity: 3,
            topic: 'IA',
          },
        ],
      };
    if (path.endsWith('/test'))
      return {
        status: ++attempts === 1 ? 500 : 201,
        body: { id: 'execution' },
      };
    return { status: 200, body: [] };
  });
  await vm.runInContext('loadTasks()', app.context);
  const row = app.nodes.get('tasks')!.children[0].children[2];
  await row.children[1].onclick!();
  await row.children[1].onclick!();
  const requests = app.calls.filter((call) => call.path.endsWith('/test'));
  assert.equal(requests.length, 2);
  assert.equal(requests[0].path, '/api/tasks/task%2F1/test');
  assert.equal(
    (requests[0].options.headers as Record<string, string>)['Idempotency-Key'],
    (requests[1].options.headers as Record<string, string>)['Idempotency-Key'],
  );
  const parent = new Node();
  app.context.parent = parent;
  const count = app.calls.length;
  vm.runInContext(
    `renderProposal(parent,{id:'proposal',draft:{time:'09:30',timezone:'Europe/Lisbon',quantity:2,topic:'Tecnologia'},expiresAt:'2026-10-12T10:00:00Z'})`,
    app.context,
  );
  assert.equal(app.calls.length, count);
  assert.match(
    parent.children[0].children[1].textContent,
    /09:30 \(Europe\/Lisbon\)/,
  );
  await parent.children[0].children.at(-1)!.children[0].onclick!();
  assert.equal(app.calls[count].path, '/api/proposals/proposal/confirm');
  assert.equal(app.calls[count].options.method, 'POST');
});

test('authentication expiry blocks further writes without erasing drafts, and quota errors preserve manual continuation', async () => {
  const app = browser();
  await flush();
  vm.runInContext(
    `$('message').value='Unsaved request';$('note-content').value='Unsaved note';`,
    app.context,
  );
  app.respond(() => ({ status: 401, body: {} }));
  await assert.rejects(
    vm.runInContext(
      `api('/api/notes',sendBody('POST',{title:'x',content:'y'}))`,
      app.context,
    ),
  );
  assert.equal(app.nodes.get('signin')!.hidden, false);
  assert.equal(app.nodes.get('auth-notice')!.hidden, false);
  assert.equal(app.nodes.get('message')!.value, 'Unsaved request');
  assert.equal(app.nodes.get('note-content')!.value, 'Unsaved note');
  const count = app.calls.length;
  await assert.rejects(
    vm.runInContext(
      `api('/api/notes',sendBody('POST',{title:'x',content:'y'}))`,
      app.context,
    ),
  );
  assert.equal(app.calls.length, count);
  vm.runInContext('authState(true)', app.context);
  app.respond(() => ({ status: 429, body: {} }));
  const message = await vm.runInContext(
    `api('/api/chat/messages',sendBody('POST',{message:'x'})).catch(error=>errorMessage(error))`,
    app.context,
  );
  assert.match(message, /60 segundos/);
  assert.equal(app.nodes.get('manual-continuation')!.hidden, false);
});

test('Groq key goes only to the dedicated HTTPS connection request and is cleared without echoing provider errors', async () => {
  const app = browser();
  await flush();
  const secret = 'gsk_privateKeyOnlyForConnection000000000000';
  app.respond(() => ({ status: 422, body: { clarification: secret } }));
  vm.runInContext(`$('groq-key').value=${JSON.stringify(secret)}`, app.context);
  const count = app.calls.length;
  await app.nodes.get('connection-form')!.onsubmit!({
    preventDefault() {},
    submitter: new Node(),
  });
  const requests = app.calls.slice(count);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].path, '/api/connections');
  assert.deepEqual(JSON.parse(String(requests[0].options.body)), {
    provider: 'groq',
    apiKey: secret,
  });
  assert.equal(app.nodes.get('groq-key')!.value, '');
  assert.equal(
    app.nodes.get('connection-feedback')!.textContent.includes(secret),
    false,
  );
  assert.equal(
    app.nodes.get('message')?.value.includes(secret) ?? false,
    false,
  );
  vm.runInContext(
    `window.location.protocol='http:';$('groq-key').value='another-key'`,
    app.context,
  );
  const before = app.calls.length;
  await app.nodes.get('connection-form')!.onsubmit!({
    preventDefault() {},
    submitter: new Node(),
  });
  assert.equal(app.calls.length, before);
  assert.equal(app.nodes.get('groq-key')!.value, '');
});

test('manual copy requires review, includes only explicitly selected context, and redirects never contain the prompt', async () => {
  const app = browser();
  await flush();
  vm.runInContext(
    `$('message').value='My request';memories=[{id:'a',content:'Chosen memory'},{id:'b',content:'Not chosen'}];allNotes=[{id:'n',title:'Chosen note',content:'Chosen content'},{id:'private',title:'Private',content:'Not included'}];selectedMemories.add('a');selectedNotes.add('n');`,
    app.context,
  );
  const before = app.calls.length;
  await app.nodes.get('prepare-copy')!.onclick!();
  assert.equal(app.calls.length, before);
  const preview = app.nodes.get('copy-preview')!.value;
  assert.match(preview, /My request/);
  assert.match(preview, /Chosen memory/);
  assert.match(preview, /Chosen content/);
  assert.doesNotMatch(preview, /Not chosen|Not included/);
  assert.equal(app.nodes.get('copy-review')!.hidden, false);
  vm.runInContext(`selectedNotes.clear();updateContextCount()`, app.context);
  assert.equal(app.nodes.get('copy-review')!.hidden, true);
  const page = renderHealthPage();
  for (const url of [
    'https://chatgpt.com/',
    'https://grok.com/',
    'https://gemini.google.com/',
  ])
    assert.ok(
      page.includes(
        'href="' + url + '" target="_blank" rel="noopener noreferrer"',
      ),
    );
  assert.doesNotMatch(
    page,
    /Ollama|TATU_CHAT_MODEL|localStorage|sessionStorage|n\u00e3o oferece login remoto/,
  );
  assert.match(page, /servidor do Tatu e o provedor de IA recebem/);
  assert.match(page, /n\u00e3o apaga automaticamente/);
});

test('NotebookLM export is reviewed inert UTF-8 text with only public briefing fields, safe URLs, and object URL cleanup', async () => {
  const app = browser();
  await flush();
  const parent = new Node();
  app.context.parent = parent;
  const created: Blob[] = [];
  const revoked: string[] = [];
  class ExportURL extends URL {
    static createObjectURL(blob: Blob) {
      created.push(blob);
      return 'blob:briefing-export';
    }
    static revokeObjectURL(url: string) {
      revoked.push(url);
    }
  }
  app.context.URL = ExportURL;
  const briefing = {
    topic: 'Inteligência artificial',
    stories: [
      {
        title: '<img src=x onerror=alert(1)> — São Paulo',
        source: 'TechCrunch',
        url: 'https://techcrunch.com/news',
        publishedAt: '2026-10-12T09:00:00Z',
      },
      {
        title: 'Unsafe source',
        source: 'Other',
        url: 'javascript:alert(1)',
        publishedAt: '2026-10-12',
      },
    ],
    facts: [
      {
        title: 'Trecho publicado pela fonte: um avanço.',
        source: 'TechCrunch',
        url: 'https://techcrunch.com/news',
        publishedAt: '2026-10-12T09:00:00Z',
      },
    ],
    inference: ['Uma interpretação separada.'],
    notes: 'DO_NOT_EXPORT_NOTE',
    memories: 'DO_NOT_EXPORT_MEMORY',
    messages: 'DO_NOT_EXPORT_CHAT',
    occurrenceKey: 'DO_NOT_EXPORT_INTERNAL_KEY',
    observability: { provider: 'DO_NOT_EXPORT_PROVIDER' },
    providerPayload: { apiKey: 'DO_NOT_EXPORT_SECRET' },
  };
  app.context.briefing = briefing;
  vm.runInContext(
    `navigator.onLine=false;renderNotebookHandoff(parent,briefing)`,
    app.context,
  );
  const card = parent.children[0];
  assert.match(card.children[1].textContent, /ainda não gera áudio/);
  assert.equal(card.children[2].href, 'https://notebooklm.google.com/');
  assert.equal(card.children[2].rel, 'noopener noreferrer');
  assert.equal(created.length, 0);
  const before = app.calls.length;
  await card.children[4].onclick!();
  assert.equal(created.length, 0);
  const review = card.children[3];
  assert.equal(review.hidden, false);
  const preview = review.children[1].children[0].value;
  assert.match(preview, /São Paulo/);
  assert.match(preview, /https:\/\/techcrunch.com\/news/);
  assert.match(preview, /2026-10-12T09:00:00.000Z/);
  assert.match(preview, /INTERPRETAÇÕES DA IA/);
  assert.doesNotMatch(preview, /DO_NOT_EXPORT_|javascript:|Unsafe source/);
  assert.equal(created.length, 0);
  await review.children[2].onclick!();
  assert.equal(app.calls.length, before);
  assert.equal(created.length, 1);
  assert.equal(created[0].type, 'text/plain;charset=utf-8');
  assert.equal(await created[0].text(), preview);
  assert.deepEqual(revoked, ['blob:briefing-export']);
  const download = app.context.document.body.children.at(-1) as Node;
  assert.equal(download.download, 'tatu-briefing-notebooklm.txt');
  assert.equal(download.clicks, 1);
  assert.equal(download.removed, true);
});

test('oversized current context receives fixed guidance and preserves the draft and explicit selections', async () => {
  const app = browser();
  await flush();
  app.respond((path) =>
    path === '/api/chat/messages'
      ? {
          status: 413,
          body: {
            code: 'context_too_large',
            maxContextBytes: 4096,
            error: 'RAW_SECRET_PROVIDER_PAYLOAD',
            clarification: 'RAW_SECRET_PROVIDER_PAYLOAD',
          },
        }
      : {
          status: 200,
          body: path.includes('assistant/status')
            ? {
                configured: true,
                available: false,
                model: 'openai/gpt-oss-20b',
              }
            : [],
        },
  );
  vm.runInContext(
    `$('message').value='My unchanged long draft';selectedMemories.add('chosen-memory');selectedNotes.add('chosen-note')`,
    app.context,
  );
  await app.nodes.get('chat-form')!.onsubmit!({ preventDefault() {} });
  assert.equal(app.nodes.get('message')!.value, 'My unchanged long draft');
  assert.equal(
    vm.runInContext(
      `selectedMemories.has('chosen-memory') && selectedNotes.has('chosen-note')`,
      app.context,
    ),
    true,
  );
  const message = app.nodes.get('notice')!.textContent;
  assert.match(message, /Reduza a mensagem/);
  assert.match(message, /menos memórias e notas/);
  assert.doesNotMatch(message, /RAW_SECRET_PROVIDER_PAYLOAD|Confira a conexão/);
  assert.equal(
    vm.runInContext(
      `errorMessage({status:413,code:'untrusted-code'})`,
      app.context,
    ),
    'Não foi possível concluir. Confira a conexão com o Tatu e tente novamente.',
  );
});

test('Colab pairing displays only a validated encrypted envelope, requires explicit eligibility, and clears on logout', async () => {
  const app = browser();
  await flush();
  const envelope = {
    version: 1,
    algorithm: 'RSA-OAEP-256+A256GCM',
    fingerprint: 'a'.repeat(64),
    projectId: 'project_1',
    origin: 'https://tatu.example',
    wrappedKey: 'YWJjZA==',
    nonce: 'YWJjZA==',
    ciphertext: 'YWJjZA==',
    serviceToken: 'DO_NOT_DISPLAY',
    pairToken: 'DO_NOT_DISPLAY',
  };
  app.respond(() => ({
    status: 200,
    body: {
      envelope,
      pairExpiresAt: new Date(Date.now() + 60000).toISOString(),
    },
  }));
  vm.runInContext(
    `$('colab-public-key').value='-----BEGIN PUBLIC KEY-----\\nabc\\n-----END PUBLIC KEY-----';$('colab-mode').value='active';$('colab-connect-consent').checked=true;`,
    app.context,
  );
  const count = app.calls.length;
  await app.nodes.get('colab-form')!.onsubmit!({
    preventDefault() {},
    submitter: new Node(),
  });
  assert.equal(app.calls.length, count);
  vm.runInContext(`$('colab-mode').value='manual';`, app.context);
  await app.nodes.get('colab-form')!.onsubmit!({
    preventDefault() {},
    submitter: new Node(),
  });
  const call = app.calls.at(-1)!;
  assert.equal(call.path, '/api/colab/connect');
  assert.equal(JSON.parse(String(call.options.body)).paidUnitsConfirmed, false);
  assert.equal(call.options.credentials, 'same-origin');
  assert.equal(call.options.cache, 'no-store');
  const displayed = app.nodes.get('colab-bootstrap')!.value;
  assert.equal(JSON.parse(displayed).ciphertext, 'YWJjZA==');
  assert.doesNotMatch(displayed, /serviceToken|pairToken|DO_NOT_DISPLAY/);
  assert.equal(app.nodes.get('colab-public-key')!.value, '');
  await app.nodes.get('signout')!.onclick!();
  assert.equal(app.nodes.get('colab-bootstrap')!.value, '');
  app.context.badEnvelope = { ...envelope, origin: 'https://other.example' };
  assert.throws(() =>
    vm.runInContext('sealedColabEnvelope(badEnvelope)', app.context),
  );
});

test('Colab queued chat requires per-message consent, polls bounded state and renders one saved answer', async () => {
  const app = browser();
  await flush();
  let polls = 0;
  app.respond((path) => {
    if (path === '/api/chat/messages')
      return {
        status: 202,
        body: {
          jobId: 'j/1',
          conversationId: 'c',
          status: 'queued',
          expiresAt: new Date(Date.now() + 60000).toISOString(),
        },
      };
    if (path === '/api/colab/jobs/j%2F1')
      return {
        status: 200,
        body: { status: ++polls === 1 ? 'queued' : 'completed' },
      };
    if (path === '/api/conversations/c')
      return {
        status: 200,
        body: {
          id: 'c',
          messages: [
            { role: 'user', content: 'Olá' },
            { role: 'assistant', content: '<script>Resposta</script>' },
          ],
        },
      };
    return {
      status: 200,
      body:
        path === '/api/assistant/status'
          ? { configured: false, available: false }
          : [],
    };
  });
  vm.runInContext(
    `$('message').value='Olá';$('chat-provider').value='colab';selectedMemories.add('chosen');`,
    app.context,
  );
  const count = app.calls.length;
  await app.nodes.get('chat-form')!.onsubmit!({ preventDefault() {} });
  assert.equal(app.calls.length, count);
  vm.runInContext(`$('colab-chat-consent').checked=true`, app.context);
  const request = app.nodes.get('chat-form')!.onsubmit!({
    preventDefault() {},
  });
  await flush();
  assert.equal(app.nodes.get('message')!.value, 'Olá');
  assert.match(app.nodes.get('model-status')!.textContent, /execute a célula/);
  const sent = app.calls.find((x) => x.path === '/api/chat/messages')!;
  assert.deepEqual(JSON.parse(String(sent.options.body)).memoryIds, ['chosen']);
  assert.equal(JSON.parse(String(sent.options.body)).contextConsent, true);
  assert.equal(JSON.parse(String(sent.options.body)).provider, 'colab');
  app.tick();
  await request;
  assert.equal(polls, 2);
  assert.equal(app.nodes.get('messages')!.children.length, 2);
  assert.equal(
    app.nodes.get('messages')!.children[1].children[1].textContent,
    '<script>Resposta</script>',
  );
  assert.equal(app.nodes.get('message')!.value, '');
  assert.equal(app.nodes.get('colab-chat-consent')!.checked, false);
});

test('Colab cancellation stops polling, preserves the draft and rejects raw failure payloads', async () => {
  const app = browser();
  await flush();
  app.respond((path) => ({
    status: 200,
    body:
      path === '/api/chat/messages'
        ? {
            jobId: 'job',
            conversationId: 'c',
            status: 'queued',
            expiresAt: new Date(Date.now() + 60000).toISOString(),
          }
        : path === '/api/colab/jobs/job'
          ? { status: 'queued' }
          : path === '/api/assistant/status'
            ? { configured: false, available: false }
            : [],
  }));
  vm.runInContext(
    `$('message').value='Meu rascunho';$('chat-provider').value='colab';$('colab-chat-consent').checked=true`,
    app.context,
  );
  const pending = app.nodes.get('chat-form')!.onsubmit!({
    preventDefault() {},
  });
  await flush();
  await app.nodes.get('cancel-chat')!.onclick!();
  await pending;
  const pollCount = app.calls.filter(
    (x) => x.path === '/api/colab/jobs/job' && x.options.method !== 'DELETE',
  ).length;
  app.tick();
  await flush();
  assert.equal(
    app.calls.filter(
      (x) => x.path === '/api/colab/jobs/job' && x.options.method !== 'DELETE',
    ).length,
    pollCount,
  );
  assert.ok(
    app.calls.some(
      (x) => x.path === '/api/colab/jobs/job' && x.options.method === 'DELETE',
    ),
  );
  assert.equal(app.nodes.get('message')!.value, 'Meu rascunho');
  assert.equal(app.nodes.get('messages')?.children.length ?? 0, 0);
  assert.doesNotMatch(
    vm.runInContext(
      `colabError({status:422,clarification:'RAW_SECRET'})`,
      app.context,
    ),
    /RAW_SECRET/,
  );
});

test('expired and revoked Colab state clears encrypted bootstrap and context edits revoke send consent', async () => {
  const app = browser();
  await flush();
  app.respond(() => ({
    status: 200,
    body: {
      reason: 'expired',
      mode: 'manual',
      expiresAt: new Date(Date.now() - 1).toISOString(),
    },
  }));
  vm.runInContext(
    `$('colab-bootstrap').value='encrypted';$('colab-bootstrap-review').hidden=false;$('colab-chat-consent').checked=true;updateContextCount();`,
    app.context,
  );
  assert.equal(app.nodes.get('colab-chat-consent')!.checked, false);
  await vm.runInContext('loadColabStatus()', app.context);
  assert.equal(app.nodes.get('colab-bootstrap')!.value, '');
  assert.match(app.nodes.get('colab-status')!.textContent, /expirou/);
  const page = renderHealthPage();
  assert.match(page, /id="colab-mode"><option value="manual"/);
  assert.match(page, /saldo positivo/);
  assert.equal((page.match(/id="colab-form"/g) || []).length, 1);
  assert.equal((page.match(/id="chat-provider"/g) || []).length, 1);
});

test('leaving a queued Colab conversation aborts its poll and cannot overwrite a newer view', async () => {
  const app = browser();
  await flush();
  app.respond((path) => ({
    status: 200,
    body:
      path === '/api/chat/messages'
        ? {
            jobId: 'old',
            conversationId: 'old-c',
            status: 'queued',
            expiresAt: new Date(Date.now() + 60000).toISOString(),
          }
        : path === '/api/colab/jobs/old'
          ? { status: 'queued' }
          : path === '/api/conversations/new-c'
            ? {
                id: 'new-c',
                messages: [{ role: 'assistant', content: 'New conversation' }],
              }
            : path === '/api/assistant/status'
              ? { configured: false, available: false }
              : [],
  }));
  vm.runInContext(
    `$('message').value='Old draft';$('chat-provider').value='colab';$('colab-chat-consent').checked=true`,
    app.context,
  );
  const pending = app.nodes.get('chat-form')!.onsubmit!({
    preventDefault() {},
  });
  await flush();
  await vm.runInContext(`openConversation('new-c')`, app.context);
  await pending;
  app.tick();
  await flush();
  assert.equal(
    app.nodes.get('messages')!.children[0].children[1].textContent,
    'New conversation',
  );
  assert.equal(app.nodes.get('message')!.value, 'Old draft');
  assert.equal(app.nodes.get('cancel-chat')!.hidden, true);
  assert.ok(
    app.calls.some(
      (x) => x.path === '/api/colab/jobs/old' && x.options.method === 'DELETE',
    ),
  );
  assert.equal(
    app.calls.filter(
      (x) => x.path === '/api/colab/jobs/old' && x.options.method !== 'DELETE',
    ).length,
    1,
  );
});

test('Colab authentication expiry aborts polling and clears bootstrap without disclosing response errors', async () => {
  const app = browser();
  await flush();
  app.respond((path) =>
    path === '/api/chat/messages'
      ? {
          status: 202,
          body: {
            jobId: 'j',
            conversationId: 'c',
            status: 'queued',
            expiresAt: new Date(Date.now() + 60000).toISOString(),
          },
        }
      : { status: 401, body: { clarification: 'RAW_CREDENTIAL' } },
  );
  vm.runInContext(
    `$('message').value='Preserved';$('colab-bootstrap').value='encrypted';$('chat-provider').value='colab';$('colab-chat-consent').checked=true`,
    app.context,
  );
  await app.nodes.get('chat-form')!.onsubmit!({ preventDefault() {} });
  app.tick();
  await flush();
  assert.equal(app.nodes.get('message')!.value, 'Preserved');
  assert.equal(app.nodes.get('colab-bootstrap')!.value, '');
  assert.equal(app.nodes.get('signin')!.hidden, false);
  assert.doesNotMatch(app.nodes.get('notice')!.textContent, /RAW_CREDENTIAL/);
  assert.equal(
    app.calls.filter((x) => x.path === '/api/colab/jobs/j').length,
    1,
  );
});

test('expired queued Colab requests stop before polling and never manufacture an answer', async () => {
  const app = browser();
  await flush();
  app.respond((path) => ({
    status: 200,
    body:
      path === '/api/chat/messages'
        ? {
            jobId: 'expired',
            conversationId: 'c',
            status: 'queued',
            expiresAt: new Date(Date.now() - 1000).toISOString(),
          }
        : path === '/api/assistant/status'
          ? { configured: false, available: false }
          : [],
  }));
  vm.runInContext(
    `$('message').value='Preserved';$('chat-provider').value='colab';$('colab-chat-consent').checked=true`,
    app.context,
  );
  await app.nodes.get('chat-form')!.onsubmit!({ preventDefault() {} });
  assert.equal(
    app.calls.filter((x) => x.path.includes('/api/colab/jobs/')).length,
    0,
  );
  assert.equal(app.nodes.get('message')!.value, 'Preserved');
  assert.equal(app.nodes.get('messages')?.children.length ?? 0, 0);
});

test('a pairing response arriving after signout cannot redisplay its encrypted bootstrap', async () => {
  const app = browser();
  await flush();
  let finish: ((value: unknown) => void) | undefined;
  app.context.fetch = async () => ({
    ok: true,
    status: 200,
    json: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  vm.runInContext(
    `$('colab-public-key').value='-----BEGIN PUBLIC KEY-----\\nabc\\n-----END PUBLIC KEY-----';$('colab-mode').value='manual';$('colab-connect-consent').checked=true`,
    app.context,
  );
  const pending = app.nodes.get('colab-form')!.onsubmit!({
    preventDefault() {},
    submitter: new Node(),
  });
  await flush();
  await app.nodes.get('signout')!.onclick!();
  finish!({
    envelope: {
      version: 1,
      algorithm: 'RSA-OAEP-256+A256GCM',
      fingerprint: 'a'.repeat(64),
      projectId: 'project_1',
      origin: 'https://tatu.example',
      wrappedKey: 'YWJjZA==',
      nonce: 'YWJjZA==',
      ciphertext: 'YWJjZA==',
    },
  });
  await pending;
  assert.equal(app.nodes.get('colab-bootstrap')!.value, '');
  assert.equal(app.nodes.get('colab-bootstrap-review')!.hidden, true);
});
