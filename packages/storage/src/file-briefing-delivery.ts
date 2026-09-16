import { createHash, randomUUID } from 'node:crypto';
import { access, link, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  BriefingDelivery,
  BriefingDeliveryReceipt,
  BriefingObservability,
  BriefingResult,
  ExecutionContext,
} from '@tatu/shared';
import { hasSensitiveUrlQuery } from '@tatu/shared';

export type FileBriefingDeliveryErrorCode =
  'aborted' | 'invalid_briefing' | 'delivery_conflict' | 'delivery_io';

export class FileBriefingDeliveryError extends Error {
  constructor(
    readonly code: FileBriefingDeliveryErrorCode,
    cause?: unknown,
  ) {
    super(code, cause === undefined ? undefined : { cause });
    this.name = 'FileBriefingDeliveryError';
  }
}

const isCitedStory = (value: unknown) => {
  if (!value || typeof value !== 'object') return false;
  const story = value as Partial<BriefingResult['stories'][number]>;
  try {
    if (typeof story.url !== 'string') return false;
    const url = new URL(story.url);
    return (
      typeof story.title === 'string' &&
      story.title.length > 0 &&
      typeof story.source === 'string' &&
      story.source.length > 0 &&
      typeof story.publishedAt === 'string' &&
      !Number.isNaN(Date.parse(story.publishedAt)) &&
      typeof story.url === 'string' &&
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !hasSensitiveUrlQuery(url)
    );
  } catch {
    return false;
  }
};

const hasControlCharacter = (value: string) =>
  [...value].some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code < 0x20 || code === 0x7f;
  });

const isBriefingObservability = (
  value: unknown,
  result: Pick<BriefingResult, 'route' | 'model' | 'fallback' | 'delivery'>,
): value is BriefingObservability => {
  if (!value || typeof value !== 'object') return false;
  const observability = value as Partial<BriefingObservability>;
  if (
    Object.keys(value).length !== 5 ||
    (observability.provider !== 'public-rss' &&
      observability.provider !== 'local-ollama') ||
    (observability.model !== null &&
      (typeof observability.model !== 'string' ||
        observability.model.length === 0 ||
        observability.model.length > 128 ||
        hasControlCharacter(observability.model))) ||
    !Array.isArray(observability.tools) ||
    observability.tools.length < 1 ||
    observability.tools.length > 3 ||
    new Set(observability.tools).size !== observability.tools.length ||
    observability.tools.some(
      (tool) =>
        tool !== 'public-rss' &&
        tool !== 'local-ollama' &&
        tool !== 'file-outbox',
    ) ||
    typeof observability.latencyMs !== 'number' ||
    !Number.isFinite(observability.latencyMs) ||
    !Number.isInteger(observability.latencyMs) ||
    observability.latencyMs < 0 ||
    observability.latencyMs > 86_400_000 ||
    !observability.estimatedCost ||
    typeof observability.estimatedCost !== 'object' ||
    Object.keys(observability.estimatedCost).length !== 1 ||
    (observability.estimatedCost as { status?: unknown }).status !== 'unknown'
  )
    return false;
  const tools = observability.tools;
  if (!tools.includes('public-rss')) return false;
  if (result.route === 'local-ollama') {
    if (
      observability.provider !== 'local-ollama' ||
      observability.model === null ||
      result.model?.id !== observability.model ||
      !tools.includes('local-ollama')
    )
      return false;
  } else if (
    observability.provider !== 'public-rss' ||
    observability.model !== null ||
    (result.fallback !== undefined && !tools.includes('local-ollama'))
  )
    return false;
  return result.delivery === undefined || tools.includes('file-outbox');
};

const isBriefing = (value: BriefingResult): boolean =>
  typeof value.topic === 'string' &&
  value.topic.length > 0 &&
  Array.isArray(value.stories) &&
  value.stories.every(isCitedStory) &&
  Array.isArray(value.facts) &&
  value.facts.every(isCitedStory) &&
  Array.isArray(value.inference) &&
  value.inference.every((item) => typeof item === 'string') &&
  (value.route === undefined ||
    value.route === 'deterministic-rss' ||
    value.route === 'local-ollama') &&
  (value.model === undefined ||
    (typeof value.model === 'object' &&
      value.model !== null &&
      typeof value.model.id === 'string' &&
      value.model.route === 'local-ollama')) &&
  (value.fallback === undefined ||
    (typeof value.fallback === 'object' &&
      value.fallback !== null &&
      value.route === 'deterministic-rss' &&
      value.fallback.from === 'local-ollama' &&
      (value.fallback.reason === 'model_unavailable' ||
        value.fallback.reason === 'model_invalid_output' ||
        value.fallback.reason === 'model_timeout'))) &&
  (value.observability === undefined ||
    isBriefingObservability(value.observability, value));

const escapeText = (value: string) =>
  value.replace(/[\\`*_{}[\]()#+.!|<>]/g, '\\$&').replace(/\r?\n/g, ' ');

const markdownFor = (briefing: BriefingResult) => {
  const route = briefing.route ?? 'unspecified';
  const model = briefing.model?.id ?? 'none';
  const fallback = briefing.fallback
    ? `${briefing.fallback.from}/${briefing.fallback.reason}`
    : 'none';
  const stories = briefing.stories
    .map(
      (story, index) =>
        `${index + 1}. [${escapeText(story.title)}](<${story.url}>) — ${escapeText(story.source)} — ${escapeText(story.publishedAt)}`,
    )
    .join('\n');
  return [
    '# Tatu briefing',
    '',
    `- Topic: ${escapeText(briefing.topic)}`,
    `- Route: ${escapeText(route)}`,
    `- Model: ${escapeText(model)}`,
    `- Fallback: ${escapeText(fallback)}`,
    '',
    '## Cited stories',
    '',
    stories,
    '',
  ].join('\n');
};

const digest = (content: string) =>
  createHash('sha256').update(content, 'utf8').digest('hex');

const receiptFor = (
  context: ExecutionContext,
  artifactId: string,
  contentSha256: string,
): BriefingDeliveryReceipt => ({
  channel: 'file-outbox',
  idempotencyKey: context.idempotencyKey,
  artifactId,
  contentSha256,
});

/**
 * Local filesystem outbox. It is deliberately a replaceable delivery adapter,
 * not a distributed exactly-once protocol: the occurrence key is hashed into
 * the artifact name and the committed body is compared on retries.
 */
export class FileBriefingDelivery implements BriefingDelivery {
  private readonly locks = new Map<string, Promise<void>>();

  constructor(readonly directory = 'data/deliveries') {}

  async deliver(
    context: ExecutionContext,
    briefing: BriefingResult,
    signal: AbortSignal,
  ): Promise<BriefingDeliveryReceipt> {
    if (signal.aborted) throw new FileBriefingDeliveryError('aborted');
    if (
      typeof context.idempotencyKey !== 'string' ||
      context.idempotencyKey.length === 0 ||
      !isBriefing(briefing)
    )
      throw new FileBriefingDeliveryError('invalid_briefing');

    const previous =
      this.locks.get(context.idempotencyKey) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queued = previous.then(() => current);
    this.locks.set(context.idempotencyKey, queued);
    await previous;
    try {
      return await this.commit(context, briefing, signal);
    } finally {
      release();
      if (this.locks.get(context.idempotencyKey) === queued)
        this.locks.delete(context.idempotencyKey);
    }
  }

  private async commit(
    context: ExecutionContext,
    briefing: BriefingResult,
    signal: AbortSignal,
  ): Promise<BriefingDeliveryReceipt> {
    if (signal.aborted) throw new FileBriefingDeliveryError('aborted');
    const content = markdownFor(briefing);
    const contentSha256 = digest(content);
    const artifactId = `${createHash('sha256')
      .update(context.idempotencyKey, 'utf8')
      .digest('hex')}.md`;
    const target = join(this.directory, artifactId);
    try {
      await mkdir(this.directory, { recursive: true });
      if (signal.aborted) throw new FileBriefingDeliveryError('aborted');
      try {
        const existing = await readFile(target, 'utf8');
        if (digest(existing) !== contentSha256)
          throw new FileBriefingDeliveryError('delivery_conflict');
        return receiptFor(context, artifactId, contentSha256);
      } catch (error) {
        if (error instanceof FileBriefingDeliveryError) throw error;
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }

      if (signal.aborted) throw new FileBriefingDeliveryError('aborted');
      const temporary = join(
        this.directory,
        `.${artifactId}.${randomUUID()}.tmp`,
      );
      try {
        await writeFile(temporary, content, { encoding: 'utf8', signal });
        if (signal.aborted) throw new FileBriefingDeliveryError('aborted');
        try {
          // A hard link publishes the complete temporary file without
          // overwriting a concurrent artifact for the same idempotency key.
          await link(temporary, target);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
          const existing = await readFile(target, 'utf8');
          if (digest(existing) !== contentSha256)
            throw new FileBriefingDeliveryError('delivery_conflict');
        }
        await rm(temporary, { force: true });
      } catch (error) {
        await rm(temporary, { force: true }).catch(() => undefined);
        if (error instanceof FileBriefingDeliveryError) throw error;
        if (
          signal.aborted ||
          (error as NodeJS.ErrnoException).name === 'AbortError'
        )
          throw new FileBriefingDeliveryError('aborted', error);
        throw error;
      }
      return receiptFor(context, artifactId, contentSha256);
    } catch (error) {
      if (error instanceof FileBriefingDeliveryError) throw error;
      throw new FileBriefingDeliveryError('delivery_io', error);
    }
  }
}

export const hasFileBriefingDeliveryArtifact = async (
  directory: string,
  artifactId: string,
) => {
  if (!/^[a-f0-9]{64}\.md$/.test(artifactId)) return false;
  try {
    await access(join(directory, artifactId));
    return true;
  } catch {
    return false;
  }
};
