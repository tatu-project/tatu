import assert from 'node:assert/strict';
import test from 'node:test';
import { ModelError, OllamaBriefingModel } from './ollama-briefing-model.js';
const facts = {
  topic: 'AI',
  stories: [
    {
      title: 'AI',
      url: 'https://source.test/a',
      publishedAt: '2026-01-01T00:00:00Z',
      source: 'source.test',
    },
  ],
  facts: [
    {
      title: 'AI',
      url: 'https://source.test/a',
      publishedAt: '2026-01-01T00:00:00Z',
      source: 'source.test',
    },
  ],
  inference: [],
};
const model = (response: string, ok = true) =>
  new OllamaBriefingModel(
    'local',
    'http://127.0.0.1:11434',
    async () =>
      new Response(JSON.stringify({ response }), { status: ok ? 200 : 503 }),
  );
test('accepts exact selected citations only', async () => {
  const adapter = model(JSON.stringify(facts));
  assert.deepEqual(
    await adapter.synthesize(facts, new AbortController().signal),
    {
      ...facts,
      route: 'local-ollama',
      model: { id: 'local', route: 'local-ollama' },
    },
  );
  assert.deepEqual(adapter.metadata, {
    id: 'local',
    capabilities: [
      'briefing-synthesis',
      'structured-json',
      'citation-preservation',
    ],
  });
  assert.equal(Object.isFrozen(adapter.metadata), true);
  assert.equal(Object.isFrozen(adapter.metadata.capabilities), true);
});
test('rejects malformed and invented model outputs', async () => {
  await assert.rejects(
    model('{bad').synthesize(facts, new AbortController().signal),
    ModelError,
  );
  await assert.rejects(
    model(
      JSON.stringify({
        ...facts,
        stories: [{ ...facts.stories[0], title: 'Fabricated title' }],
      }),
    ).synthesize(facts, new AbortController().signal),
    ModelError,
  );
  await assert.rejects(
    model(
      JSON.stringify({
        ...facts,
        stories: [{ ...facts.stories[0], url: 'https://invented.test' }],
      }),
    ).synthesize(facts, new AbortController().signal),
    ModelError,
  );
  await assert.rejects(
    model('', false).synthesize(facts, new AbortController().signal),
    ModelError,
  );
});
test('rejects non-loopback endpoints and sends no secret fields', async () => {
  const remote = new OllamaBriefingModel('local', 'https://remote.test');
  await assert.rejects(
    remote.synthesize(facts, new AbortController().signal),
    ModelError,
  );
  let body = '';
  const local = new OllamaBriefingModel(
    'local',
    'http://127.0.0.1:11434',
    async (_url, init) => {
      body = String(init?.body);
      return new Response(JSON.stringify({ response: JSON.stringify(facts) }));
    },
  );
  const inputWithUnknown = {
    ...facts,
    providerPayload: 'api_key=abcdEFGH1234',
  };
  await local.synthesize(inputWithUnknown, new AbortController().signal);
  assert.equal(body.includes('apiKey'), false);
  assert.equal(body.includes('password'), false);
  assert.equal(body.includes('providerPayload'), false);
  assert.equal(body.includes('abcdEFGH1234'), false);
});

test('rejects loopback endpoints with sensitive query parameters', async () => {
  const endpoint = new OllamaBriefingModel(
    'local',
    'http://127.0.0.1:11434/api?token=raw-secret',
  );
  await assert.rejects(
    endpoint.synthesize(facts, new AbortController().signal),
    (error: unknown) =>
      error instanceof ModelError && error.code === 'model_unavailable',
  );
});

test('rejects a credential-bearing configured model before making a request', async () => {
  let called = false;
  const configured = new OllamaBriefingModel(
    'api_key=abcdEFGH1234',
    'http://127.0.0.1:11434',
    async () => {
      called = true;
      return new Response('{}');
    },
  );
  await assert.rejects(
    configured.synthesize(facts, new AbortController().signal),
    (error: unknown) =>
      error instanceof ModelError && error.code === 'model_unavailable',
  );
  assert.equal(called, false);
});

test('rejects credential-bearing input before serializing or requesting', async () => {
  let called = false;
  const adapter = new OllamaBriefingModel('local', undefined, async () => {
    called = true;
    return new Response('{}');
  });
  await assert.rejects(
    adapter.synthesize(
      { ...facts, topic: 'access_token=abcdEFGH1234' },
      new AbortController().signal,
    ),
    (error: unknown) =>
      error instanceof ModelError && error.code === 'model_invalid_output',
  );
  assert.equal(called, false);
});

test('rejects credential-bearing citation URLs before requesting', async () => {
  let called = false;
  const adapter = new OllamaBriefingModel('local', undefined, async () => {
    called = true;
    return new Response('{}');
  });
  await assert.rejects(
    adapter.synthesize(
      {
        ...facts,
        stories: [
          { ...facts.stories[0], url: 'https://source.test/a?token=x' },
        ],
      },
      new AbortController().signal,
    ),
    (error: unknown) =>
      error instanceof ModelError && error.code === 'model_invalid_output',
  );
  assert.equal(called, false);
});

test('rejects credential-bearing optional metadata before requesting', async () => {
  let called = false;
  const adapter = new OllamaBriefingModel('local', undefined, async () => {
    called = true;
    return new Response('{}');
  });
  for (const input of [
    {
      ...facts,
      model: { id: 'api_key=abcdEFGH1234', route: 'local-ollama' as const },
    },
    {
      ...facts,
      observability: {
        provider: 'local-ollama' as const,
        model: 'token=abcdEFGH1234',
        tools: ['local-ollama' as const],
        latencyMs: 1,
        estimatedCost: { status: 'unknown' as const },
      },
    },
  ]) {
    await assert.rejects(
      adapter.synthesize(input, new AbortController().signal),
      (error: unknown) =>
        error instanceof ModelError && error.code === 'model_invalid_output',
    );
  }
  assert.equal(called, false);
});

test('rejects credential patterns in model inference output', async () => {
  const adapter = model(
    JSON.stringify({
      ...facts,
      inference: ['authorization: Bearer abcdefghijkl'],
    }),
  );
  await assert.rejects(
    adapter.synthesize(facts, new AbortController().signal),
    (error: unknown) =>
      error instanceof ModelError && error.code === 'model_invalid_output',
  );
});
