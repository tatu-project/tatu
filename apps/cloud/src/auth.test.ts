import assert from 'node:assert/strict';
import test from 'node:test';
import {
  authenticate,
  permitsCloudMutation,
  permitsSystemRun,
} from './auth.js';
import type { CloudEnv } from './types.js';

const site: CloudEnv = {
  AUTH_MODE: 'sites',
  SITE_ORIGIN: 'https://tatu.example',
  SITE_PROJECT_ID: 'appgprj_0123456789abc',
  SITES_OWNER_PRIVATE: '1',
};
test('Sites identity requires its configured dispatch boundary; service access is not identity', async () => {
  assert.equal(
    await authenticate(new Request('https://tatu.example/api/me'), site),
    null,
  );
  assert.equal(
    await authenticate(
      new Request('https://tatu.example/api/me', {
        headers: { 'OAI-Sites-Authorization': 'Bearer service-only' },
      }),
      site,
    ),
    null,
  );
  const identified = new Request('https://tatu.example/api/me', {
    headers: { 'oai-authenticated-user-id': 'user-stable' },
  });
  assert.deepEqual(await authenticate(identified, site), {
    issuer: 'sites:appgprj_0123456789abc',
    subject: 'user-stable',
  });
  assert.equal(
    await authenticate(
      new Request('https://attacker.example/api/me', {
        headers: identified.headers,
      }),
      site,
    ),
    null,
  );
  assert.equal(
    await authenticate(identified, { ...site, AUTH_MODE: 'cloudflare-access' }),
    null,
  );
  assert.equal(
    await authenticate(identified, { ...site, SITE_PROJECT_ID: undefined }),
    null,
  );
});
test('mutation and shared updater guards fail closed across origins and audience modes', () => {
  const make = (headers: HeadersInit = {}) =>
    new Request('https://tatu.example/api/system/run-due', {
      method: 'POST',
      headers,
    });
  assert.equal(
    permitsCloudMutation(make({ origin: 'https://attacker.example' }), site),
    false,
  );
  assert.equal(
    permitsCloudMutation(make({ 'sec-fetch-site': 'same-site' }), site),
    false,
  );
  assert.equal(
    permitsCloudMutation(
      make({ origin: 'https://tatu.example', 'sec-fetch-site': 'same-origin' }),
      site,
    ),
    true,
  );
  assert.equal(permitsSystemRun(make(), site), false);
  const strictSite = {
    ...site,
    SYSTEM_RUN_TOKEN: 'independent-system-secret-at-least-32-characters',
  };
  assert.equal(
    permitsSystemRun(
      make({ authorization: `Bearer ${strictSite.SYSTEM_RUN_TOKEN}` }),
      strictSite,
    ),
    true,
  );
  assert.equal(
    permitsSystemRun(
      make({ 'OAI-Sites-Authorization': 'Bearer outer-platform-bypass-only' }),
      strictSite,
    ),
    false,
  );
  assert.equal(
    permitsSystemRun(make(), { ...site, SITES_OWNER_PRIVATE: '0' }),
    false,
  );
  const operator = {
    ...site,
    AUTH_MODE: 'cloudflare-access',
    SYSTEM_RUN_TOKEN: 'operator-secret-token-at-least-32-characters',
  };
  assert.equal(permitsSystemRun(make(), operator), false);
  assert.equal(
    permitsSystemRun(
      make({ authorization: `Bearer ${operator.SYSTEM_RUN_TOKEN}` }),
      operator,
    ),
    true,
  );
});
test('Access verifies signatures and fixed issuer/audience/time claims, including rotated key discovery', async () => {
  const pair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
  const key = {
    ...(await crypto.subtle.exportKey('jwk', pair.publicKey)),
    alg: 'RS256',
    use: 'sig',
    kid: 'key-one',
  };
  const environment: CloudEnv = {
    AUTH_MODE: 'cloudflare-access',
    SITE_ORIGIN: 'https://tatu.example',
    ACCESS_TEAM_DOMAIN: 'tatu-test.cloudflareaccess.com',
    ACCESS_AUDIENCE: 'audience-one',
  };
  const now = Date.UTC(2026, 9, 12);
  const seconds = now / 1000;
  const claims = {
    iss: 'https://tatu-test.cloudflareaccess.com',
    sub: 'owner-one',
    aud: ['audience-one'],
    exp: seconds + 300,
    nbf: seconds - 10,
    iat: seconds - 10,
  };
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = async (overrides = {}, headerOverrides = {}) => {
    const body = `${encode({ alg: 'RS256', kid: 'key-one', ...headerOverrides })}.${encode({ ...claims, ...overrides })}`;
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      pair.privateKey,
      new TextEncoder().encode(body),
    );
    return `${body}.${Buffer.from(signature).toString('base64url')}`;
  };
  let calls = 0;
  const fetcher: typeof fetch = async (input) => {
    assert.equal(
      String(input),
      'https://tatu-test.cloudflareaccess.com/cdn-cgi/access/certs',
    );
    calls++;
    return new Response(JSON.stringify({ keys: [key] }), {
      headers: { 'content-type': 'application/json' },
    });
  };
  const request = (jwt: string) =>
    new Request('https://tatu.example/api/me', {
      headers: {
        'cf-access-jwt-assertion': jwt,
        'oai-authenticated-user-id': 'spoofed',
      },
    });
  assert.deepEqual(
    await authenticate(request(await token()), environment, fetcher, now),
    { issuer: 'access:tatu-test.cloudflareaccess.com', subject: 'owner-one' },
  );
  assert.equal(calls, 1);
  assert.deepEqual(
    await authenticate(
      request(await token({ nbf: undefined })),
      environment,
      fetcher,
      now,
    ),
    { issuer: 'access:tatu-test.cloudflareaccess.com', subject: 'owner-one' },
  );
  for (const changes of [
    { exp: seconds },
    { nbf: seconds + 1 },
    { iss: 'https://attacker.example' },
    { aud: ['another-app'] },
    { sub: '' },
  ])
    assert.equal(
      await authenticate(
        request(await token(changes)),
        environment,
        fetcher,
        now,
      ),
      null,
    );
  assert.equal(
    await authenticate(
      request(await token({}, { alg: 'none' })),
      environment,
      fetcher,
      now,
    ),
    null,
  );
  const valid = await token();
  assert.equal(
    await authenticate(
      request(valid.slice(0, -8) + 'aaaaaaaa'),
      environment,
      fetcher,
      now,
    ),
    null,
  );
  assert.equal(
    await authenticate(
      request(valid),
      { ...environment, ACCESS_TEAM_DOMAIN: 'attacker.example' },
      fetcher,
      now,
    ),
    null,
  );
  assert.equal(
    await authenticate(
      request(
        await token(
          {},
          { kid: 'rotated-unknown', jku: 'https://attacker.example/keys' },
        ),
      ),
      environment,
      fetcher,
      now,
    ),
    null,
  );
  assert.equal(calls, 2);
});
