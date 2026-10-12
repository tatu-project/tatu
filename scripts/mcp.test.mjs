import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { setTimeout as delay } from 'node:timers/promises';
import { setTimeout, clearTimeout } from 'node:timers';
import { readFile } from 'node:fs/promises';
import { execPath, env } from 'node:process';
import { fileURLToPath, URL } from 'node:url';

const script = fileURLToPath(new URL('./mcp.mjs', import.meta.url));
const uuid = '12345678-1234-1234-1234-123456789012';
function client(t, endpoint, options = {}) {
  const child = spawn(execPath, [options.script ?? script], {
    cwd: options.cwd,
    env: { ...env, TATU_MCP_BASE_URL: endpoint },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const lines = [];
  const waiters = new Map();
  let diagnostics = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (data) => {
    diagnostics += data;
  });
  const closed = once(child, 'close');
  createInterface({ input: child.stdout }).on('line', (line) => {
    const value = JSON.parse(line);
    lines.push(value);
    const callback = waiters.get(value.id);
    if (callback) {
      waiters.delete(value.id);
      callback(value);
    }
  });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.stdin.end();
      child.kill();
    }
    await closed;
  });
  const request = (id, method, params, timeout = 3000) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Missing response ${id}`)),
        timeout,
      );
      waiters.set(id, (value) => {
        clearTimeout(timer);
        resolve(value);
      });
      child.stdin.write(
        `${JSON.stringify({ jsonrpc: '2.0', id, method, ...(params === undefined ? {} : { params }) })}\n`,
      );
    });
  return {
    child,
    lines,
    closed,
    request,
    diagnostics: () => diagnostics,
    async ready(version = '2025-11-25') {
      const result = await request(1, 'initialize', {
        protocolVersion: version,
        capabilities: {},
        clientInfo: { name: 'fixture-client', version: '1' },
      });
      child.stdin.write(
        '{"jsonrpc":"2.0","method":"notifications/initialized"}\n',
      );
      return result;
    },
  };
}
async function fixture(t, handler) {
  const server = createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  return `http://127.0.0.1:${server.address().port}`;
}
const json = (response, value) => {
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(JSON.stringify(value));
};

test('actual stdio child negotiates lifecycle, advertises exact tools and validates protocol', async (t) => {
  const c = client(t, 'http://127.0.0.1:3000');
  assert.equal((await c.request(0, 'tools/list')).error.code, -32000);
  assert.equal(
    (await c.ready('2099-01-01')).result.protocolVersion,
    '2025-11-25',
  );
  const inventory = (await c.request(2, 'tools/list')).result.tools;
  assert.deepEqual(
    inventory.map((tool) => tool.name),
    [
      'listar_tarefas',
      'listar_execucoes',
      'obter_boletim',
      'buscar_notas',
      'listar_memorias',
      'preparar_tarefa',
    ],
  );
  assert.ok(
    inventory.every(
      (tool) =>
        tool.inputSchema.additionalProperties === false &&
        !tool.annotations.openWorldHint,
    ),
  );
  assert.equal(inventory.at(-1).annotations.readOnlyHint, false);
  assert.equal((await c.request(3, 'shell/run')).error.code, -32601);
  assert.equal(
    (
      await c.request(4, 'tools/call', {
        name: 'confirmar_tarefa',
        arguments: {},
      })
    ).error.code,
    -32602,
  );
  for (const args of [
    { executionId: '../../secret' },
    { executionId: uuid, arbitrary: 'fetch' },
  ])
    assert.equal(
      (
        await c.request(5, 'tools/call', {
          name: 'obter_boletim',
          arguments: args,
        })
      ).error.code,
      -32602,
    );
  c.child.stdin.write(
    '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"preparar_tarefa","arguments":{"message":"do not run","timezone":"UTC"}}}\n',
  );
  c.child.stdin.write('{"jsonrpc":"2.0","method":"notifications/unknown"}\n');
  assert.deepEqual((await c.request(6, 'ping')).result, {});
  assert.equal(c.lines.length, 8);
  c.child.stdin.end();
  await c.closed;
  assert.equal(c.diagnostics(), '');
});

test('fixture HTTP reads and proposal are bounded, projected and never confirm', async (t) => {
  const calls = [];
  const endpoint = await fixture(t, async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    calls.push({ method: request.method, path: request.url, body });
    if (request.url === '/api/proposals') {
      json(response, {
        id: uuid,
        kind: 'create_briefing',
        expiresAt: 'later',
        draft: { topic: 'IA', time: '08:00', timezone: 'UTC', quantity: 3 },
        rawProviderPayload: 'secret',
      });
      return;
    }
    json(response, [
      {
        id: uuid,
        topic: 'IA',
        title: 'Nota',
        content: 'Texto explícito',
        occurrenceKey: 'secret',
        rawResult: 'secret',
      },
    ]);
  });
  const c = client(t, endpoint);
  await c.ready('2025-06-18');
  for (const [id, name, args] of [
    [2, 'listar_tarefas', {}],
    [3, 'buscar_notas', { query: 'ação & IA' }],
    [4, 'listar_memorias', {}],
    [5, 'listar_execucoes', {}],
  ]) {
    const result = await c.request(id, 'tools/call', { name, arguments: args });
    assert.equal(result.result.isError, false);
    assert.ok(!JSON.stringify(result).includes('secret'));
  }
  const proposal = await c.request(6, 'tools/call', {
    name: 'preparar_tarefa',
    arguments: {
      message: 'Envie 3 notícias de IA diariamente às 08:00',
      timezone: 'UTC',
    },
  });
  assert.equal(
    JSON.parse(proposal.result.content[0].text).requiresLocalConfirmation,
    true,
  );
  assert.equal(calls.at(-1).method, 'POST');
  assert.equal(calls.at(-1).path, '/api/proposals');
  assert.ok(
    calls.some(
      (item) => item.path === '/api/notes?q=a%C3%A7%C3%A3o%20%26%20IA',
    ),
  );
  assert.ok(calls.every((item) => !item.path.includes('confirm')));
  const count = calls.length;
  assert.equal(
    (
      await c.request(7, 'tools/call', {
        name: 'preparar_tarefa',
        arguments: { message: 'valid', timezone: 'Invalid' },
      })
    ).error.code,
    -32602,
  );
  assert.equal(calls.length, count);
});

test('rejects hostile endpoint configuration with fixed diagnostics and no stdout', async (t) => {
  for (const endpoint of [
    'https://example.com',
    'http://localhost:3000',
    'http://127.1:3000',
    'http://127.0.0.1:3000/anything',
    'http://user:password@127.0.0.1:3000',
    'http://127.0.0.1:3000?key=secret',
    'http://127.0.0.1:3000#secret',
  ]) {
    const c = client(t, endpoint);
    const [code] = await c.closed;
    assert.equal(code, 1);
    assert.equal(c.lines.length, 0);
    assert.equal(
      c.diagnostics(),
      'Tatu MCP: invalid local endpoint configuration.\n',
    );
  }
});

test('malformed JSON and chunked UTF8 are handled; oversized input exits without reflection', async (t) => {
  const c = client(t, 'http://127.0.0.1:3000');
  c.child.stdin.write('not JSON\n');
  c.child.stdin.write('{"jsonrpc":"2.0","id":true,"method":"ping"}\n');
  assert.deepEqual((await c.request(9, 'ping')).result, {});
  assert.deepEqual(
    c.lines.slice(0, 2).map((message) => message.error.code),
    [-32700, -32600],
  );
  c.child.stdin.write('x'.repeat(65537));
  await c.closed;
  assert.equal(c.lines.at(-1).error.message, 'Message too large');
});

test('redirect, HTTP errors and oversized replies become safe tool errors', async (t) => {
  let mode = 'redirect';
  let redirected = false;
  const endpoint = await fixture(t, (request, response) => {
    if (request.url === '/outside') {
      redirected = true;
      json(response, []);
      return;
    }
    if (mode === 'redirect') {
      response.writeHead(302, { location: '/outside' });
      response.end();
    } else if (mode === 'oversize') json(response, 'x'.repeat(524289));
    else {
      response.writeHead(500);
      response.end('private server details');
    }
  });
  const c = client(t, endpoint);
  await c.ready();
  for (const [id, next] of [
    [2, 'redirect'],
    [3, 'oversize'],
    [4, 'error'],
  ]) {
    mode = next;
    const result = await c.request(id, 'tools/call', {
      name: 'listar_tarefas',
      arguments: {},
    });
    assert.equal(result.result.isError, true);
    assert.ok(!JSON.stringify(result).includes('private server'));
  }
  assert.equal(redirected, false);
});

test('cancellation and EOF abort in-flight work and suppress late protocol output', async (t) => {
  const endpoint = await fixture(t, async (_request, response) => {
    await delay(300);
    json(response, []);
  });
  const c = client(t, endpoint);
  await c.ready();
  c.child.stdin.write(
    '{"jsonrpc":"2.0","id":7,"method":"tools/call","params":{"name":"listar_tarefas"}}\n',
  );
  await delay(50);
  c.child.stdin.write(
    '{"jsonrpc":"2.0","method":"notifications/cancelled","params":{"requestId":7}}\n',
  );
  await delay(400);
  assert.ok(!c.lines.some((item) => item.id === 7));
  c.child.stdin.write(
    '{"jsonrpc":"2.0","id":8,"method":"tools/call","params":{"name":"listar_tarefas"}}\n',
  );
  await delay(50);
  c.child.stdin.end();
  await c.closed;
  assert.ok(!c.lines.some((item) => item.id === 8));
});

test('portable package paths resolve inside plugin and child initializes outside repo CWD', async (t) => {
  const plugin = JSON.parse(
    await readFile(
      new URL('../plugins/tatu/plugin.json', import.meta.url),
      'utf8',
    ),
  );
  const config = JSON.parse(
    await readFile(
      new URL('../plugins/tatu/mcp.json', import.meta.url),
      'utf8',
    ),
  );
  assert.equal(
    plugin.$schema,
    'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
  );
  assert.equal(plugin.license, 'MIT');
  assert.equal(config.mcpServers.tatu.cwd, '${PLUGIN_ROOT}');
  assert.equal(config.mcpServers.tatu.args[0], '${PLUGIN_ROOT}/server/mcp.mjs');
  const c = client(t, 'http://127.0.0.1:3000', {
    script: './server/mcp.mjs',
    cwd: fileURLToPath(new URL('../plugins/tatu/', import.meta.url)),
  });
  assert.equal((await c.ready()).result.serverInfo.name, 'tatu');
});

test('full fixture briefing strips internal nested payloads', async (t) => {
  const endpoint = await fixture(t, (_request, response) =>
    json(response, {
      topic: 'IA',
      stories: [
        {
          title: 'Notícia',
          url: 'https://example.com/news',
          publishedAt: 'today',
          source: 'Fixture',
          providerPayload: 'internal-secret',
        },
      ],
      facts: [
        {
          title: 'Fato',
          url: 'https://example.com/news',
          publishedAt: 'today',
          source: 'Fixture',
        },
      ],
      inference: ['Inferência explícita'],
      route: 'deterministic-rss',
      model: { id: 'fixture', route: 'ollama', credential: 'internal-secret' },
      delivery: {
        channel: 'filesystem',
        artifactId: 'fixture.md',
        idempotencyKey: 'internal-secret',
      },
      occurrenceKey: 'internal-secret',
    }),
  );
  const c = client(t, endpoint);
  await c.ready();
  const result = await c.request(2, 'tools/call', {
    name: 'obter_boletim',
    arguments: { executionId: uuid },
  });
  assert.equal(result.result.isError, false);
  assert.ok(!JSON.stringify(result).includes('internal-secret'));
  assert.equal(
    JSON.parse(result.result.content[0].text).facts[0].title,
    'Fato',
  );
});

test('concurrency is capped and hung HTTP calls time out with safe tool errors', async (t) => {
  let calls = 0;
  const endpoint = await fixture(t, () => {
    calls++;
  });
  const c = client(t, endpoint);
  await c.ready();
  const pending = [2, 3, 4, 5].map((id) =>
    c.request(
      id,
      'tools/call',
      { name: 'listar_tarefas', arguments: {} },
      13000,
    ),
  );
  await delay(150);
  const excess = await c.request(6, 'tools/call', {
    name: 'listar_tarefas',
    arguments: {},
  });
  assert.equal(excess.error.message, 'Too many active requests');
  assert.equal(calls, 4);
  for (const response of await Promise.all(pending))
    assert.equal(response.result.isError, true);
});
