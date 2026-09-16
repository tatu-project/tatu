import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import test from 'node:test';
import { join } from 'node:path';
import type { BriefingResult, ExecutionContext } from '@tatu/shared';
import {
  FileBriefingDelivery,
  FileBriefingDeliveryError,
  hasFileBriefingDeliveryArtifact,
} from './file-briefing-delivery.js';

const context = (idempotencyKey: string): ExecutionContext => ({
  executionId: 'execution',
  idempotencyKey,
  topic: 'AI',
  quantity: 1,
});

const briefing = (topic = 'AI'): BriefingResult => ({
  topic,
  stories: [
    {
      title: 'A cited story',
      url: 'https://source.test/story',
      publishedAt: '2026-01-01T00:00:00.000Z',
      source: 'source.test',
    },
  ],
  facts: [
    {
      title: 'A cited story',
      url: 'https://source.test/story',
      publishedAt: '2026-01-01T00:00:00.000Z',
      source: 'source.test',
    },
  ],
  inference: [],
  route: 'deterministic-rss',
});

test('writes a cited markdown briefing and creates the outbox directory', async () => {
  const root = await mkdtemp('tatu-delivery-');
  const directory = join(root, 'nested', 'deliveries');
  try {
    const delivery = new FileBriefingDelivery(directory);
    const receipt = await delivery.deliver(
      context('task:2026-01-01:08:00'),
      briefing(),
      new AbortController().signal,
    );
    assert.equal(receipt.channel, 'file-outbox');
    assert.match(receipt.artifactId, /^[a-f0-9]{64}\.md$/);
    const files = await readdir(directory);
    assert.deepEqual(files, [receipt.artifactId]);
    const markdown = await readFile(
      join(directory, receipt.artifactId),
      'utf8',
    );
    assert.match(markdown, /# Tatu briefing/);
    assert.match(markdown, /Route: deterministic-rss/);
    assert.match(markdown, /https:\/\/source\.test\/story/);
    assert.match(markdown, /A cited story/);
    assert.doesNotMatch(markdown, /task:2026-01-01:08:00/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('same key and content is idempotent; changed content conflicts', async () => {
  const root = await mkdtemp('tatu-delivery-repeat-');
  try {
    const delivery = new FileBriefingDelivery(root);
    const first = await delivery.deliver(
      context('same-key'),
      briefing(),
      new AbortController().signal,
    );
    const second = await delivery.deliver(
      context('same-key'),
      briefing(),
      new AbortController().signal,
    );
    assert.deepEqual(second, first);
    assert.deepEqual(await readdir(root), [first.artifactId]);
    await assert.rejects(
      delivery.deliver(
        context('same-key'),
        briefing('different topic'),
        new AbortController().signal,
      ),
      (error: unknown) =>
        error instanceof FileBriefingDeliveryError &&
        error.code === 'delivery_conflict',
    );
    assert.deepEqual(await readdir(root), [first.artifactId]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('aborted delivery creates no artifact and hashes unsafe keys safely', async () => {
  const root = await mkdtemp('tatu-delivery-abort-');
  try {
    const delivery = new FileBriefingDelivery(root);
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      delivery.deliver(
        context('../../secrets?key=raw'),
        briefing(),
        controller.signal,
      ),
      (error: unknown) =>
        error instanceof FileBriefingDeliveryError && error.code === 'aborted',
    );
    assert.deepEqual(await readdir(root), []);
    const receipt = await delivery.deliver(
      context('../../secrets?key=raw'),
      briefing(),
      new AbortController().signal,
    );
    assert.equal(receipt.artifactId.includes('/'), false);
    assert.equal(receipt.artifactId.includes('..'), false);
    const markdown = await readFile(join(root, receipt.artifactId), 'utf8');
    assert.doesNotMatch(markdown, /secrets\?key=raw/);
    assert.equal(
      await hasFileBriefingDeliveryArtifact(root, '../../secrets.txt'),
      false,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects credential-bearing cited URLs before writing them', async () => {
  const root = await mkdtemp('tatu-delivery-credentials-');
  try {
    const delivery = new FileBriefingDelivery(root);
    await assert.rejects(
      delivery.deliver(
        context('credential-bearing'),
        {
          ...briefing(),
          stories: [
            {
              ...briefing().stories[0],
              url: 'https://user:secret@example.com/story',
            },
          ],
        },
        new AbortController().signal,
      ),
      (error: unknown) =>
        error instanceof FileBriefingDeliveryError &&
        error.code === 'invalid_briefing',
    );
    assert.deepEqual(await readdir(root), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects secret-bearing cited URL queries before writing them', async () => {
  const root = await mkdtemp('tatu-delivery-query-secret-');
  try {
    const delivery = new FileBriefingDelivery(root);
    await assert.rejects(
      delivery.deliver(
        context('query-secret'),
        {
          ...briefing(),
          stories: [
            {
              ...briefing().stories[0],
              url: 'https://source.test/story?secret_key=raw-secret',
            },
          ],
        },
        new AbortController().signal,
      ),
      (error: unknown) =>
        error instanceof FileBriefingDeliveryError &&
        error.code === 'invalid_briefing',
    );
    assert.deepEqual(await readdir(root), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects unbounded observability metadata before writing it', async () => {
  const root = await mkdtemp('tatu-delivery-observability-');
  try {
    const delivery = new FileBriefingDelivery(root);
    const invalid = {
      ...briefing(),
      observability: {
        provider: 'arbitrary-provider',
        model: null,
        tools: ['public-rss'],
        latencyMs: 0,
        estimatedCost: { status: 'known', amount: 1 },
      },
    } as unknown as BriefingResult;
    await assert.rejects(
      delivery.deliver(
        context('invalid-observability'),
        invalid,
        new AbortController().signal,
      ),
      (error: unknown) =>
        error instanceof FileBriefingDeliveryError &&
        error.code === 'invalid_briefing',
    );
    assert.deepEqual(await readdir(root), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
