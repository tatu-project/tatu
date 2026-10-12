import test from 'node:test';
import assert from 'node:assert/strict';
import { handleMcp, type MCPWorkspace } from './mcp.js';
const uuid = '12345678-1234-1234-1234-123456789012';
const request = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://fixture.example/mcp', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': '2025-11-25',
      ...headers,
    },
    body: JSON.stringify(body),
  });
const rpc = (method: string, params: unknown = {}, id: unknown = 1) => ({
  jsonrpc: '2.0',
  id,
  method,
  params,
});
test('hosted MCP public discovery includes no data; anonymous private call fails closed', async () => {
  const env = { SITE_ORIGIN: 'https://fixture.example' };
  const init = await handleMcp(
    request(
      rpc('initialize', {
        protocolVersion: '2099',
        capabilities: {},
        clientInfo: { name: 'fixture', version: '1' },
      }),
    ),
    env,
    null,
    null,
  );
  assert.equal(
    ((await init.json()) as { result: { protocolVersion: string } }).result
      .protocolVersion,
    '2025-11-25',
  );
  const inventory = await handleMcp(
    request(rpc('tools/list')),
    env,
    null,
    null,
  );
  assert.equal(inventory.status, 200);
  assert.equal(
    ((await inventory.json()) as { result: { tools: unknown[] } }).result.tools
      .length,
    6,
  );
  assert.equal(
    (
      await handleMcp(
        request(rpc('tools/call', { name: 'listar_memorias' })),
        env,
        null,
        null,
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await handleMcp(
        request(rpc('tools/list'), { origin: 'https://attacker.example' }),
        env,
        null,
        null,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await handleMcp(
        request(rpc('ping'), { accept: 'text/plain' }),
        env,
        null,
        null,
      )
    ).status,
    406,
  );
});
test('authenticated tools use only scoped workspace, reject owner substitution and cannot confirm', async () => {
  let writes = 0;
  const calls: string[] = [];
  const workspace: MCPWorkspace = {
    async listTasks() {
      calls.push('alice');
      return [
        {
          id: uuid,
          topic: 'IA',
          ownerId: 'alice',
          occurrenceKey: 'internal-secret',
        },
      ];
    },
    async listExecutions() {
      return [];
    },
    async briefing() {
      return { topic: 'IA' };
    },
    async notes(query) {
      return [{ title: query }];
    },
    async memories() {
      return [{ content: 'Português' }];
    },
    async propose() {
      writes++;
      return { id: uuid, draft: { topic: 'IA' } };
    },
  };
  const env = { SITE_ORIGIN: 'https://fixture.example' };
  const read = await handleMcp(
    request(rpc('tools/call', { name: 'listar_tarefas', arguments: {} })),
    env,
    'alice',
    workspace,
  );
  assert.equal(read.status, 200);
  assert.ok(!(await read.text()).includes('internal-secret'));
  assert.deepEqual(calls, ['alice']);
  for (const params of [
    { name: 'listar_tarefas', arguments: { ownerId: 'bob' } },
    { name: 'confirmar_tarefa', arguments: { id: uuid } },
    { name: 'obter_boletim', arguments: { executionId: '../../secret' } },
  ]) {
    const response = await handleMcp(
      request(rpc('tools/call', params)),
      env,
      'alice',
      workspace,
    );
    assert.equal(
      ((await response.json()) as { error: { code: number } }).error.code,
      -32602,
    );
  }
  const proposal = await handleMcp(
    request(
      rpc('tools/call', {
        name: 'preparar_tarefa',
        arguments: {
          message: 'Envie 3 notícias de IA diariamente às 08:00',
          timezone: 'UTC',
        },
      }),
    ),
    env,
    'alice',
    workspace,
  );
  const result = (await proposal.json()) as {
    result: { content: { text: string }[] };
  };
  assert.equal(
    JSON.parse(result.result.content[0].text).requiresAppConfirmation,
    true,
  );
  assert.equal(writes, 1);
  const notice = request({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'preparar_tarefa',
      arguments: { message: 'ignored', timezone: 'UTC' },
    },
  });
  assert.equal((await handleMcp(notice, env, 'alice', workspace)).status, 202);
  assert.equal(writes, 1);
});
