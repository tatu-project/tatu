import assert from 'node:assert/strict';
import test from 'node:test';
import { ResearchError } from '@tatu/research';
import type {
  BriefingResult,
  BriefingSynthesizer,
  LocalBriefingModel,
} from '@tatu/shared';
import {
  createResearchExecutor,
  DEFAULT_RSS_FEED,
} from './research-executor.js';

const sourceResult: BriefingResult = {
  topic: 'AI',
  stories: [
    {
      title: 'AI story',
      url: 'https://source.test/story',
      publishedAt: '2026-01-01T00:00:00Z',
      source: 'source.test',
    },
  ],
  facts: [
    {
      title: 'AI story',
      url: 'https://source.test/story',
      publishedAt: '2026-01-01T00:00:00Z',
      source: 'source.test',
    },
  ],
  inference: [],
  route: 'deterministic-rss',
};
const research = { create: async () => sourceResult };

test('does not report success when no public RSS source is configured', async () => {
  await assert.rejects(
    createResearchExecutor('')(
      {
        executionId: 'execution',
        idempotencyKey: 'occurrence',
        topic: 'AI',
        quantity: 3,
      },
      new AbortController().signal,
    ),
    (error: unknown) =>
      error instanceof ResearchError && error.code === 'rss_not_configured',
  );
});

test('uses the named default RSS feed when configuration is absent', async () => {
  let receivedFeeds: string[] = [];
  const adapter: BriefingSynthesizer = {
    async create(_topic, _quantity, feeds) {
      receivedFeeds = feeds.map((feed) => feed.url);
      return sourceResult;
    },
  };
  await createResearchExecutor(
    undefined,
    undefined,
    undefined,
    undefined,
    adapter,
  )(
    {
      executionId: 'execution',
      idempotencyKey: 'occurrence',
      topic: 'AI',
      quantity: 3,
    },
    new AbortController().signal,
  );
  assert.deepEqual(receivedFeeds, [DEFAULT_RSS_FEED]);
});

test('uses an explicit RSS feed override instead of the default', async () => {
  let receivedFeeds: string[] = [];
  const adapter: BriefingSynthesizer = {
    async create(_topic, _quantity, feeds) {
      receivedFeeds = feeds.map((feed) => feed.url);
      return sourceResult;
    },
  };
  await createResearchExecutor(
    'https://custom.test/rss, https://backup.test/feed',
    undefined,
    undefined,
    undefined,
    adapter,
  )(
    {
      executionId: 'execution',
      idempotencyKey: 'occurrence',
      topic: 'AI',
      quantity: 3,
    },
    new AbortController().signal,
  );
  assert.deepEqual(receivedFeeds, [
    'https://custom.test/rss',
    'https://backup.test/feed',
  ]);
});

test('keeps the deterministic route explicit when no local model is configured', async () => {
  const output = JSON.parse(
    await createResearchExecutor(
      'https://source.test/rss',
      undefined,
      undefined,
      undefined,
      research,
    )(
      {
        executionId: 'execution',
        idempotencyKey: 'occurrence',
        topic: 'AI',
        quantity: 1,
      },
      new AbortController().signal,
    ),
  ) as BriefingResult;
  assert.equal(output.route, 'deterministic-rss');
  assert.equal(output.model, undefined);
});

test('wires a configured local model after research and persists route metadata', async () => {
  let received: BriefingResult | undefined;
  const model: LocalBriefingModel = {
    metadata: {
      id: 'local',
      capabilities: [
        'briefing-synthesis',
        'structured-json',
        'citation-preservation',
      ],
    },
    async synthesize(input) {
      received = input;
      return {
        ...input,
        route: 'local-ollama',
        model: { id: 'local', route: 'local-ollama' },
      };
    },
  };
  const output = JSON.parse(
    await createResearchExecutor(
      'https://source.test/rss',
      'local',
      undefined,
      model,
      research,
    )(
      {
        executionId: 'execution',
        idempotencyKey: 'occurrence',
        topic: 'AI',
        quantity: 1,
      },
      new AbortController().signal,
    ),
  ) as BriefingResult;
  assert.equal(received?.stories[0].url, 'https://source.test/story');
  assert.equal(output.route, 'local-ollama');
  assert.equal(output.model?.id, 'local');
  assert.deepEqual(model.metadata, {
    id: 'local',
    capabilities: [
      'briefing-synthesis',
      'structured-json',
      'citation-preservation',
    ],
  });
});
