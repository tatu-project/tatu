import assert from 'node:assert/strict';
import test from 'node:test';
import { ResearchError } from '@tatu/research';
import type { BriefingResult, LocalBriefingModel } from '@tatu/shared';
import { createResearchExecutor } from './research-executor.js';

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
});
