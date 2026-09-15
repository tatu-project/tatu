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
  await local.synthesize(facts, new AbortController().signal);
  assert.equal(body.includes('apiKey'), false);
  assert.equal(body.includes('password'), false);
});
