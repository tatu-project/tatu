import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fetchPublicRss,
  parseRss,
  ResearchError,
  researchBriefing,
} from './index.js';
const feed = (items: string) => `<rss><channel>${items}</channel></rss>`;
const item = (title: string, link: string, date: string) =>
  `<item><title>${title}</title><link>${link}</link><pubDate>${date}</pubDate></item>`;
test('returns cited, non-duplicated RSS stories', async () => {
  const result = await researchBriefing(
    'AI',
    3,
    ['https://one.test/rss', 'https://two.test/rss'],
    async (url) => ({
      ok: true,
      text: async () =>
        feed(
          item('AI one', 'https://a', 'Mon, 01 Jan 2026 10:00:00 GMT') +
            item('AI two', 'https://b', 'Tue, 02 Jan 2026 10:00:00 GMT') +
            item('AI three', 'https://c', 'Wed, 03 Jan 2026 10:00:00 GMT') +
            (url.includes('two')
              ? item('AI one', 'https://a', 'Mon, 01 Jan 2026 10:00:00 GMT')
              : ''),
        ),
    }),
  );
  assert.equal(result.stories.length, 3);
  assert.equal(new Set(result.stories.map((s) => s.url)).size, 3);
  assert.equal(result.stories[0].publishedAt.includes('2026'), true);
  assert.deepEqual(result.inference, []);
  assert.equal(result.facts.length, 3);
});

test('matches AI aliases without treating ai substrings as standalone titles', async () => {
  const titles = [
    'AI research breakthrough',
    'AI agents improve planning',
    'AI safety standards advance',
    'Mail automation reaches more teams',
  ];
  for (const topic of [
    'inteligência artificial',
    'ARTIFICIAL INTELLIGENCE',
    'IA',
  ]) {
    const result = await researchBriefing(
      topic,
      3,
      ['https://source.test/rss'],
      async () => ({
        ok: true,
        text: async () =>
          feed(
            titles
              .map((title, index) =>
                item(
                  title,
                  `https://source.test/story-${index}`,
                  `0${index + 1} Jan 2026 10:00:00 GMT`,
                ),
              )
              .join(''),
          ),
      }),
    );
    assert.equal(result.stories.length, 3);
    assert.equal(
      result.stories.every((story) => story.title.startsWith('AI ')),
      true,
    );
  }
});
test('does not fabricate stories on provider or malformed feed failure', async () => {
  await assert.rejects(
    researchBriefing('AI', 3, ['https://bad.test/rss'], async () => ({
      ok: false,
      text: async () => '',
    })),
  );
  await assert.rejects(
    researchBriefing('AI', 3, ['https://bad.test/rss'], async () => ({
      ok: true,
      text: async () => '<rss>bad</rss>',
    })),
  );
  await assert.rejects(
    researchBriefing('AI', 1, [], async () => ({
      ok: true,
      text: async () => '',
    })),
    (error: unknown) =>
      error instanceof ResearchError && error.code === 'rss_not_configured',
  );
  await assert.rejects(
    researchBriefing('AI', 1, ['http://unsafe.test/rss'], async () => ({
      ok: true,
      text: async () => '',
    })),
    (error: unknown) =>
      error instanceof ResearchError && error.code === 'invalid_rss_url',
  );
});

test('ranks relevant stories, canonicalizes links, and forwards cancellation', async () => {
  const controller = new AbortController();
  let receivedSignal: AbortSignal | undefined;
  const result = await researchBriefing(
    'AI research',
    1,
    ['https://one.test/rss'],
    async (_url, options) => {
      receivedSignal = options?.signal;
      return {
        ok: true,
        text: async () =>
          feed(
            item(
              'AI',
              'https://source.test/story?utm_source=x#part',
              'Mon, 01 Jan 2026 10:00:00 GMT',
            ) +
              item(
                'AI research breakthrough',
                'https://source.test/story/',
                'Sun, 31 Dec 2025 10:00:00 GMT',
              ),
          ),
      };
    },
    controller.signal,
  );
  assert.equal(receivedSignal, controller.signal);
  assert.equal(result.stories.length, 1);
  assert.equal(result.stories[0].title, 'AI research breakthrough');
  assert.equal(result.stories[0].url, 'https://source.test/story');
});

test('rejects credential-bearing article links and oversized feeds', async () => {
  assert.deepEqual(
    parseRss(
      feed(
        item(
          'AI',
          'https://user:secret@source.test/story',
          'Mon, 01 Jan 2026 10:00:00 GMT',
        ),
      ),
      'source.test',
    ),
    [],
  );
  await assert.rejects(
    researchBriefing('AI', 1, ['https://feed.test/rss'], async () => ({
      ok: true,
      text: async () => 'x'.repeat(512 * 1024 + 1),
    })),
    (error: unknown) =>
      error instanceof ResearchError && error.code === 'rss_too_large',
  );
  await assert.rejects(
    researchBriefing(
      'AI',
      1,
      ['https://feed.test/rss?api_key=raw-secret'],
      async () => ({
        ok: true,
        text: async () => '',
      }),
    ),
    (error: unknown) =>
      error instanceof ResearchError && error.code === 'unsafe_rss_url',
  );
  const safeQuery = await researchBriefing(
    'AI',
    1,
    ['https://feed.test/rss?page=2'],
    async () => ({
      ok: true,
      text: async () =>
        feed(
          item(
            'AI',
            'https://source.test/story?page=2',
            'Mon, 01 Jan 2026 10:00:00 GMT',
          ),
        ),
    }),
  );
  assert.equal(safeQuery.stories[0].url, 'https://source.test/story?page=2');
  assert.deepEqual(
    parseRss(
      feed(
        item(
          'AI',
          'https://source.test/story?access_token=raw-secret',
          'Mon, 01 Jan 2026 10:00:00 GMT',
        ),
      ),
      'source.test',
    ),
    [],
  );
});

test('rejects sensitive query parameters after public redirects', async () => {
  await assert.rejects(
    fetchPublicRss(
      'https://feed.test/rss',
      undefined,
      async () =>
        new Response('', {
          status: 302,
          headers: { location: 'https://feed.test/rss?token=raw-secret' },
        }),
      async () => [{ address: '93.184.216.34', family: 4 }],
    ),
    (error: unknown) =>
      error instanceof ResearchError && error.code === 'unsafe_rss_url',
  );
});

test('does not follow a public RSS redirect to HTTP', async () => {
  await assert.rejects(
    fetchPublicRss(
      'https://feed.test/rss',
      undefined,
      async () =>
        new Response('', {
          status: 302,
          headers: { location: 'http://127.0.0.1/private' },
        }),
      async () => [{ address: '93.184.216.34', family: 4 }],
    ),
    (error: unknown) =>
      error instanceof ResearchError && error.code === 'unsafe_rss_url',
  );
});

test('rejects private and mapped-loopback RSS destinations', async () => {
  const privateLookup = async () => [{ address: '0.0.0.0', family: 4 }];
  await assert.rejects(
    fetchPublicRss(
      'https://private.test/rss',
      undefined,
      async () => new Response('<rss/>'),
      privateLookup,
    ),
    (error: unknown) =>
      error instanceof ResearchError && error.code === 'unsafe_rss_url',
  );
  const mappedLookup = async () => [{ address: '::ffff:7f00:1', family: 6 }];
  await assert.rejects(
    fetchPublicRss(
      'https://mapped.test/rss',
      undefined,
      async () => new Response('<rss/>'),
      mappedLookup,
    ),
    (error: unknown) =>
      error instanceof ResearchError && error.code === 'unsafe_rss_url',
  );
});
