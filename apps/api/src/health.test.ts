import assert from 'node:assert/strict';
import test from 'node:test';

import { createTatuServer } from './index.js';

test('serves the health contract', async (context) => {
  const server = createTatuServer();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  context.after(() => server.close());

  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const response = await fetch(`http://127.0.0.1:${address.port}/api/health`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    service: 'tatu',
    stage: 'technical-foundation',
    status: 'healthy',
  });
});

test('serves the Tatu Health page', async (context) => {
  const server = createTatuServer();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  context.after(() => server.close());

  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const response = await fetch(`http://127.0.0.1:${address.port}/`);

  assert.equal(response.status, 200);
  assert.match(await response.text(), /Tatu Health/);
});
