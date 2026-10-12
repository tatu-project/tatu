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
  });
  vm.runInContext(clientScript, context);
  return {
    context,
    nodes,
    calls,
    listeners,
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
