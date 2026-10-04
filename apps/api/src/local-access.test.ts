import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer, request, type Server } from 'node:http';
import test from 'node:test';

import { createTatuServer } from './index.js';
import { listenLocally, localListenOptions } from './local-access.js';

const portOf = (server: Server) => {
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return address.port;
};
const close = (server: Server) =>
  new Promise<void>((resolve) => server.close(() => resolve()));
const send = (
  port: number,
  headers: Record<string, string | string[]>,
  path = '/api/tasks',
  method = 'GET',
  body?: string,
) =>
  new Promise<{ status: number; body: string }>((resolve, reject) => {
    const client = request(
      { hostname: '127.0.0.1', port, path, method, headers, setHost: false },
      (response) => {
        let text = '';
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => {
          text += chunk;
        });
        response.on('end', () =>
          resolve({ status: response.statusCode ?? 0, body: text }),
        );
      },
    );
    client.on('error', reject);
    client.end(method === 'GET' ? undefined : body);
  });

test('validates local listen configuration without reflecting config values', () => {
  assert.deepEqual(localListenOptions({}), { host: '127.0.0.1', port: 3000 });
  for (const PORT of [
    '',
    '0',
    '-1',
    '65536',
    '3000.5',
    '03000',
    ' 3000',
    'secret',
  ]) {
    assert.throws(
      () => localListenOptions({ PORT }),
      /^Error: PORT must be an integer from 1 to 65535\.$/u,
    );
  }
  for (const TATU_BIND_HOST of [
    '',
    'localhost',
    '192.168.1.2',
    '::',
    'secret',
  ]) {
    assert.throws(
      () => localListenOptions({ TATU_BIND_HOST }),
      /^Error: TATU_BIND_HOST must be 127\.0\.0\.1, ::1 or 0\.0\.0\.0\.$/u,
    );
  }
});

test('startup binds IPv4 loopback by default and requires explicit container or IPv6 bind', async () => {
  for (const host of ['127.0.0.1', '0.0.0.0', '::1']) {
    const reservation = createServer();
    reservation.listen(0, host);
    await once(reservation, 'listening');
    const port = portOf(reservation);
    await close(reservation);
    const server = createTatuServer(':memory:');
    try {
      listenLocally(server, {
        PORT: String(port),
        ...(host === '127.0.0.1' ? {} : { TATU_BIND_HOST: host }),
      });
      await once(server, 'listening');
      const address = server.address();
      assert.ok(address && typeof address !== 'string');
      assert.equal(address.address, host);
      const authority = host === '::1' ? '[::1]' : '127.0.0.1';
      assert.equal(
        (await fetch(`http://${authority}:${port}/api/health`)).status,
        200,
      );
    } finally {
      await close(server);
    }
  }
});

test('accepts local CLI and same-origin browser authorities on the actual port', async () => {
  const server = createTatuServer(':memory:');
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = portOf(server);
  try {
    for (const name of ['localhost', 'LOCALHOST', '127.0.0.1', '[::1]']) {
      const host = `${name}:${port}`;
      assert.equal((await send(port, { Host: host })).status, 200);
      assert.equal(
        (
          await send(
            port,
            {
              Host: host,
              Origin: `http://${host}`,
              'Sec-Fetch-Site': 'same-origin',
            },
            '/',
          )
        ).status,
        200,
      );
    }
    assert.equal(
      (
        await send(port, {
          Host: `localhost:${port}`,
          'Sec-Fetch-Site': 'none',
        })
      ).status,
      200,
    );
  } finally {
    await close(server);
  }
});

test('rejects hostile authorities, origins and fetch metadata before reads or mutations', async () => {
  const server = createTatuServer(':memory:');
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = portOf(server);
  const host = `127.0.0.1:${port}`;
  const phrase =
    'Todos os dias as 8h, encontre as 3 noticias mais importantes sobre inteligencia artificial e me envie.';
  try {
    const drafted = await send(
      port,
      { Host: host, 'Content-Type': 'application/json' },
      '/api/briefing-drafts',
      'POST',
      JSON.stringify({ message: phrase, timezone: 'America/Sao_Paulo' }),
    );
    assert.equal(drafted.status, 201);
    const draft = JSON.parse(drafted.body) as { draftId: string };
    const hostile: Record<string, string | string[]>[] = [
      { Host: `attacker.example:${port}` },
      { Host: '' },
      { Host: 'localhost:65536' },
      { Host: `localhost.attacker.example:${port}` },
      { Host: `127.1:${port}` },
      { Host: `localhost:${port + 1}` },
      { Host: 'localhost' },
      { Host: `user@localhost:${port}` },
      { Host: `localhost:${port}/` },
      { Host: `localhost:0${port}` },
      {
        Host: `attacker.example:${port}`,
        'X-Forwarded-Host': host,
        'X-Forwarded-Proto': 'http',
        Forwarded: `host=${host};proto=http`,
      },
      ...[
        'null',
        'https://attacker.example',
        `http://localhost:${port}`,
        `http://${host}/`,
        `http://${host}/path`,
        `http://${host}?x=1`,
        `https://${host}`,
        `http://user@${host}`,
        `http://127.0.0.1:${port + 1}`,
        'invalid',
      ].map((Origin) => ({ Host: host, Origin })),
      { Host: host, Origin: [`http://${host}`, `http://${host}`] },
      ...['cross-site', 'same-site', 'invalid', ''].map((site) => ({
        Host: host,
        'Sec-Fetch-Site': site,
      })),
    ];
    for (const headers of hostile) {
      for (const [path, method] of [
        ['/api/tasks', 'GET'],
        [`/api/briefing-drafts/${draft.draftId}/confirm`, 'POST'],
        ['/api/briefing-drafts', 'POST'],
      ]) {
        const result = await send(port, headers, path, method, '{}');
        assert.deepEqual(
          result,
          { status: 403, body: '{"error":"Local request denied."}' },
          JSON.stringify(headers),
        );
      }
    }
    assert.deepEqual(JSON.parse((await send(port, { Host: host })).body), []);
    const confirmed = await send(
      port,
      { Host: host, Origin: `http://${host}`, 'Sec-Fetch-Site': 'same-origin' },
      `/api/briefing-drafts/${draft.draftId}/confirm`,
      'POST',
    );
    assert.equal(confirmed.status, 201);
    const task = JSON.parse(confirmed.body) as { id: string };
    const queued = await send(
      port,
      { Host: host, 'Idempotency-Key': 'local-boundary-smoke' },
      `/api/tasks/${task.id}/test`,
      'POST',
    );
    assert.equal(queued.status, 202);
  } finally {
    await close(server);
  }
});
