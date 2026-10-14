/** Credential-safe private gateway QA. This helper never creates personal records or calls AI. */
import process from 'node:process';
import console from 'node:console';
import { URL } from 'node:url';
import { setTimeout, clearTimeout } from 'node:timers';
import { privateSiteOrigin } from './site-config.mjs';

const { fetch, AbortSignal, TextDecoder } = globalThis;
let failed = false;
const report = (label, status, pass, kind, metadata = {}) => {
  if (pass === false) failed = true;
  console.log(JSON.stringify({ label, status, pass, kind, ...metadata }));
};
async function readInput() {
  const input = process.stdin;
  input.setEncoding('utf8');
  if (input.isTTY) input.setRawMode(true);
  console.log('Ready for private Site probe JSON on stdin (input hidden).');
  try {
    return await new Promise((resolve, reject) => {
      let contents = '';
      let timeout;
      const clear = () => {
        clearTimeout(timeout);
        input.off('data', receive);
        input.off('end', end);
        input.off('error', error);
        input.pause();
        input.unref?.();
      };
      const error = () => {
        clear();
        reject(new Error('input_unavailable'));
      };
      const end = () => {
        clear();
        reject(new Error('one_json_line_required'));
      };
      const receive = (chunk) => {
        contents += chunk;
        if (contents.length > 16384 || contents.includes('\u0003')) {
          clear();
          reject(new Error('invalid_input'));
          return;
        }
        const newline = contents.search(/[\r\n]/u);
        if (newline < 0) return;
        clear();
        try {
          resolve(JSON.parse(contents.slice(0, newline).trim()));
        } catch {
          reject(new Error('invalid_input'));
        }
      };
      input.on('data', receive);
      input.once('end', end);
      input.once('error', error);
      timeout = setTimeout(() => {
        clear();
        reject(new Error('input_timeout'));
      }, 60000);
      input.resume();
    });
  } finally {
    if (input.isTTY) input.setRawMode(false);
  }
}
async function publicJson(response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('invalid_public_schema');
  let bytes = 0;
  let text = '';
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > 65536) {
        await reader.cancel();
        throw new Error('invalid_public_schema');
      }
      text += decoder.decode(next.value, { stream: true });
    }
    const value = JSON.parse(text + decoder.decode());
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('invalid_public_schema');
    return value;
  } finally {
    reader.releaseLock();
  }
}
const blocked = (status) =>
  [301, 302, 303, 307, 308, 401, 403].includes(status);
const fieldNames = (value) =>
  Object.keys(value)
    .filter((field) => /^[a-zA-Z][a-zA-Z0-9_]{0,47}$/u.test(field))
    .slice(0, 32);
async function run(credentials) {
  if (
    !credentials ||
    typeof credentials !== 'object' ||
    Array.isArray(credentials) ||
    Object.keys(credentials).length !== 2 ||
    typeof credentials.origin !== 'string' ||
    typeof credentials.serviceToken !== 'string' ||
    credentials.serviceToken.length < 16 ||
    credentials.serviceToken.length > 8192 ||
    /\s/u.test(credentials.serviceToken)
  )
    throw new Error('invalid_input');
  const origin = new URL(credentials.origin);
  const approvedOrigin = privateSiteOrigin(process.env.SITE_ORIGIN);
  if (
    origin.origin !== approvedOrigin ||
    origin.protocol !== 'https:' ||
    origin.username ||
    origin.password ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash
  )
    throw new Error('invalid_origin');
  const service = {
    'OAI-Sites-Authorization': `Bearer ${credentials.serviceToken}`,
  };
  const request = async (
    label,
    path,
    { method = 'GET', headers = {}, body, test = blocked, schema } = {},
  ) => {
    try {
      const response = await fetch(`${approvedOrigin}${path}`, {
        method,
        headers: {
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          ...headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        redirect: 'manual',
        signal: AbortSignal.timeout(10000),
      });
      let metadata = {};
      let pass = Boolean(test(response.status));
      if (schema && response.status === 200) {
        const value = await publicJson(response);
        const checked = schema(value);
        pass = Boolean(pass && checked.pass);
        metadata = checked.metadata ?? {};
      } else await response.body?.cancel().catch(() => {});
      const kind = [301, 302, 303, 307, 308].includes(response.status)
        ? 'gateway_redirect'
        : response.status === 401
          ? 'identity_or_gateway_required'
          : response.status === 403
            ? 'denied'
            : response.status === 200
              ? 'served'
              : 'unexpected_status';
      report(label, response.status, pass, kind, metadata);
      return { status: response.status, pass };
    } catch {
      report(label, null, false, 'network_or_schema_error');
      return { status: null, pass: false };
    }
  };
  await request('anonymous_root', '/');
  await request('anonymous_identity', '/api/me');
  const health = await request('service_health', '/api/health', {
    headers: service,
    test: (status) => status === 200,
    schema: (value) => ({
      pass:
        value.service === 'tatu' &&
        value.status === 'configured' &&
        Object.keys(value).every((field) =>
          ['service', 'stage', 'status'].includes(field),
        ),
      metadata: { fields: fieldNames(value) },
    }),
  });
  if (!health.pass) return;
  const identity = await request('service_without_identity', '/api/me', {
    headers: service,
    test: (status) => status === 401,
  });
  if (!identity.pass) return;
  const spoof = {
    ...service,
    'oai-authenticated-user-id': 'tatu-probe-forged-identity',
  };
  const spoofed = await request('forged_identity', '/api/me', {
    headers: spoof,
    test: (status) => status === 401,
  });
  if (!spoofed.pass) {
    report(
      'personal_reads_after_spoof',
      null,
      null,
      'skipped_after_identity_boundary_failure',
    );
    return;
  }
  for (const resource of ['tasks', 'notes', 'memories', 'executions']) {
    const result = await request(
      `forged_read_${resource}`,
      `/api/${resource}`,
      { headers: spoof, test: (status) => status === 401 },
    );
    if (!result.pass) return;
  }
  await request('forwarded_identity_ignored', '/api/me', {
    headers: {
      ...service,
      'x-forwarded-user': 'tatu-probe-forged-identity',
      'x-oai-authenticated-user-id': 'tatu-probe-forged-identity',
    },
    test: (status) => status === 401,
  });
  await request('cross_origin_note_denied', '/api/notes', {
    method: 'POST',
    headers: { ...service, origin: 'https://example.invalid' },
    body: { title: 'Never persisted', content: 'Denied verification request.' },
    test: (status) => status === 403,
  });
  const mcpHeaders = {
    ...service,
    accept: 'application/json, text/event-stream',
    'MCP-Protocol-Version': '2025-06-18',
  };
  await request('mcp_initialize_without_identity', '/mcp', {
    method: 'POST',
    headers: mcpHeaders,
    body: {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'tatu-private-probe', version: '1' },
      },
    },
    test: (status) => [200, 401].includes(status),
    schema: (value) => ({
      pass:
        value.jsonrpc === '2.0' &&
        Object.keys(value).every((field) =>
          ['jsonrpc', 'id', 'result'].includes(field),
        ) &&
        value.result &&
        Object.keys(value.result).every((field) =>
          ['protocolVersion', 'capabilities', 'serverInfo'].includes(field),
        ) &&
        typeof value.result.protocolVersion === 'string',
      metadata: { fields: fieldNames(value) },
    }),
  });
  await request('mcp_discovery_without_identity', '/mcp', {
    method: 'POST',
    headers: mcpHeaders,
    body: { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
    test: (status) => [200, 401].includes(status),
    schema: (value) => {
      const tools = value.result?.tools;
      if (
        value.jsonrpc !== '2.0' ||
        Object.keys(value).some(
          (field) => !['jsonrpc', 'id', 'result'].includes(field),
        ) ||
        !value.result ||
        Object.keys(value.result).some((field) => field !== 'tools') ||
        !Array.isArray(tools) ||
        tools.length > 32 ||
        tools.some(
          (tool) =>
            typeof tool.name !== 'string' ||
            !/^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/u.test(tool.name),
        )
      )
        return { pass: false };
      return {
        pass: true,
        metadata: {
          toolCount: tools.length,
          toolNames: tools.map((tool) => tool.name),
        },
      };
    },
  });
  await request('mcp_personal_call_denied', '/mcp', {
    method: 'POST',
    headers: mcpHeaders,
    body: {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'listar_tarefas', arguments: {} },
    },
    test: (status) => status === 401,
  });
  await request('system_without_service_denied', '/api/system/run-due', {
    method: 'POST',
    headers: { origin: approvedOrigin },
  });
  await request(
    'service_system_without_independent_token_denied',
    '/api/system/run-due',
    {
      method: 'POST',
      headers: { ...service, origin: approvedOrigin },
      test: (status) => status === 401,
    },
  );
  report('direct_origin', null, null, 'not_available');
  report('positive_personal_workspace', null, null, 'user_login_needed');
}
try {
  await run(await readInput());
  process.exitCode = failed ? 1 : 0;
} catch {
  report('probe_input_or_boundary', null, false, 'invalid_input_or_boundary');
  process.exitCode = 1;
}
