import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fetchBriefing,
  DEFAULT_CLOUD_FEED,
  supportsCloudTopic,
} from './feed.js';
const xml = `<rss><channel>${[1, 2, 3, 1].map((id) => `<item><title>AI fact ${id}</title><link>https://techcrunch.com/story-${id}/</link><pubDate>Mon, 12 Oct 2026 12:00:00 GMT</pubDate></item>`).join('')}</channel></rss>`;
test('fixed public RSS route parses distinct cited facts and never claims AI inference', async () => {
  const result = await fetchBriefing(
    'AI',
    3,
    new AbortController().signal,
    DEFAULT_CLOUD_FEED,
    async (_input, options) => {
      assert.equal(options?.redirect, 'manual');
      return new Response(xml, {
        headers: { 'content-type': 'application/rss+xml' },
      });
    },
  );
  assert.equal(result.facts.length, 3);
  assert.equal(new Set(result.facts.map((fact) => fact.url)).size, 3);
  assert.deepEqual(result.inference, []);
  assert.equal(result.delivery.channel, 'in-app');
  assert.ok(
    result.facts.every((fact) =>
      fact.title.startsWith('Título da fonte; sem resumo publicado:'),
    ),
  );
});
test('AI aliases are explicit and unrelated topics never receive AI feed stories', async () => {
  for (const topic of [
    'IA',
    'AI',
    'inteligência artificial',
    'artificial intelligence',
    'notícias sobre inteligência artificial',
  ])
    assert.equal(supportsCloudTopic(topic), true);
  for (const topic of ['gaming', 'criptomoedas', 'IA e jogos', 'weather']) {
    assert.equal(supportsCloudTopic(topic), false);
    await assert.rejects(
      fetchBriefing(
        topic,
        3,
        new AbortController().signal,
        DEFAULT_CLOUD_FEED,
        async () => {
          throw new Error('unsupported topic must not fetch');
        },
      ),
      /unsupported_topic/u,
    );
  }
});
test('up to ten cited source excerpts are bounded, redacted and sanitized without invented inference', async () => {
  const description =
    '&lt;p&gt;Published AI development.&lt;/p&gt; &lt;script&gt;hostile-script-content&lt;/script&gt; api_key=privateCredential123';
  const source = `<rss><channel>${Array.from({ length: 10 }, (_, index) => `<item><title>AI headline ${index}</title><link>https://techcrunch.com/article-${index}/</link><pubDate>Mon, 12 Oct 2026 12:00:00 GMT</pubDate><description><![CDATA[${description}${' Long excerpt.'.repeat(300)}]]></description></item>`).join('')}</channel></rss>`;
  const result = await fetchBriefing(
    'inteligência artificial',
    10,
    new AbortController().signal,
    DEFAULT_CLOUD_FEED,
    async () =>
      new Response(source, {
        headers: { 'content-type': 'application/rss+xml' },
      }),
  );
  assert.equal(result.facts.length, 10);
  assert.equal(result.stories.length, 10);
  for (const fact of result.facts) {
    assert.ok(
      fact.title.startsWith(
        'Trecho publicado pela fonte: Published AI development.',
      ),
    );
    assert.ok(fact.title.length <= 1500);
    assert.equal(fact.title.includes('hostile-script-content'), false);
    assert.equal(fact.title.includes('privateCredential123'), false);
    assert.equal(fact.title.includes('<'), false);
    assert.ok(fact.title.includes('[REDACTED]'));
  }
  assert.deepEqual(result.inference, []);
});
test('cancellation stops a stalled response reader', async () => {
  const controller = new AbortController();
  let canceled = false;
  const stream = new ReadableStream<Uint8Array>({
    cancel() {
      canceled = true;
    },
  });
  const pending = fetchBriefing(
    'AI',
    3,
    controller.signal,
    DEFAULT_CLOUD_FEED,
    async () =>
      new Response(stream, { headers: { 'content-type': 'text/xml' } }),
  );
  await new Promise<void>((resolve) => setTimeout(resolve, 5));
  controller.abort();
  await assert.rejects(pending);
  assert.equal(canceled, true);
});
test('private/user URLs, redirects, bad statuses, non-XML and oversized feeds fail safely', async () => {
  const signal = new AbortController().signal;
  for (const url of [
    'https://127.0.0.1/rss',
    'https://attacker.example/rss',
    'http://techcrunch.com/category/artificial-intelligence/feed/',
  ])
    await assert.rejects(
      fetchBriefing('AI', 3, signal, url, async () => {
        throw new Error('must not fetch');
      }),
    );
  for (const response of [
    new Response('', { status: 302 }),
    new Response('', { status: 500 }),
    new Response(xml, { headers: { 'content-type': 'text/html' } }),
    new Response('x'.repeat(524289), {
      headers: { 'content-type': 'text/xml' },
    }),
    new Response('<!DOCTYPE rss><rss/>', {
      headers: { 'content-type': 'text/xml' },
    }),
  ])
    await assert.rejects(
      fetchBriefing('AI', 3, signal, DEFAULT_CLOUD_FEED, async () => response),
    );
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    fetchBriefing(
      'AI',
      3,
      controller.signal,
      DEFAULT_CLOUD_FEED,
      async () =>
        new Response(xml, { headers: { 'content-type': 'text/xml' } }),
    ),
  );
});
