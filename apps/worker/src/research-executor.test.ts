import assert from 'node:assert/strict';
import test from 'node:test';
import { ResearchError } from '@tatu/research';
import { createResearchExecutor } from './research-executor.js';

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
