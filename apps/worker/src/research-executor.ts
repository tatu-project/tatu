import type {
  BriefingDelivery,
  BriefingObservability,
  BriefingObservabilityTool,
  BriefingResult,
  BriefingSynthesizer,
  ExecutionContext,
} from '@tatu/shared';
import {
  hasExactKeys,
  hasOnlyKeys,
  hasSensitiveUrlQuery,
  hasTextSecret,
} from '@tatu/shared';
import { performance } from 'node:perf_hooks';
import {
  ModelError,
  OllamaBriefingModel,
  ResearchError,
  RssBriefingSynthesizer,
} from '@tatu/research';
import type { LocalBriefingModel } from '@tatu/shared';

const synthesizer = new RssBriefingSynthesizer();
const containsTextSecret = (briefing: BriefingResult) =>
  hasTextSecret(briefing.topic) ||
  briefing.stories.some(
    (story) =>
      hasTextSecret(story.title) ||
      hasTextSecret(story.source) ||
      hasTextSecret(story.url) ||
      hasSensitiveUrlQuery(story.url),
  ) ||
  briefing.facts.some(
    (story) =>
      hasTextSecret(story.title) ||
      hasTextSecret(story.source) ||
      hasTextSecret(story.url) ||
      hasSensitiveUrlQuery(story.url),
  ) ||
  briefing.inference.some(hasTextSecret) ||
  (briefing.model !== undefined && hasTextSecret(briefing.model.id)) ||
  (briefing.observability !== undefined &&
    briefing.observability.model !== null &&
    hasTextSecret(briefing.observability.model));

const isCitedStory = (value: unknown): boolean => {
  if (!hasExactKeys(value, ['title', 'url', 'publishedAt', 'source']))
    return false;
  const story = value as Record<string, unknown>;
  if (
    typeof story.title !== 'string' ||
    typeof story.url !== 'string' ||
    typeof story.publishedAt !== 'string' ||
    typeof story.source !== 'string' ||
    Number.isNaN(Date.parse(story.publishedAt))
  )
    return false;
  try {
    const url = new URL(story.url);
    return (
      url.protocol === 'https:' &&
      url.username === '' &&
      url.password === '' &&
      !hasSensitiveUrlQuery(url)
    );
  } catch {
    return false;
  }
};

const isBriefingDelivery = (value: unknown): boolean => {
  if (
    !hasExactKeys(value, [
      'channel',
      'idempotencyKey',
      'artifactId',
      'contentSha256',
    ])
  )
    return false;
  const receipt = value as Record<string, unknown>;
  return (
    receipt.channel === 'file-outbox' &&
    typeof receipt.idempotencyKey === 'string' &&
    receipt.idempotencyKey.length > 0 &&
    typeof receipt.artifactId === 'string' &&
    /^[a-f0-9]{64}\.md$/u.test(receipt.artifactId) &&
    typeof receipt.contentSha256 === 'string' &&
    /^[a-f0-9]{64}$/u.test(receipt.contentSha256)
  );
};

const isBriefingObservability = (value: unknown): boolean => {
  if (
    !hasExactKeys(value, [
      'provider',
      'model',
      'tools',
      'latencyMs',
      'estimatedCost',
    ])
  )
    return false;
  const observability = value as Record<string, unknown>;
  const tools = observability.tools;
  return (
    (observability.provider === 'public-rss' ||
      observability.provider === 'local-ollama') &&
    (observability.model === null || typeof observability.model === 'string') &&
    Array.isArray(tools) &&
    tools.length >= 1 &&
    tools.length <= 3 &&
    new Set(tools).size === tools.length &&
    tools.every(
      (tool) =>
        tool === 'public-rss' ||
        tool === 'local-ollama' ||
        tool === 'file-outbox',
    ) &&
    typeof observability.latencyMs === 'number' &&
    Number.isInteger(observability.latencyMs) &&
    observability.latencyMs >= 0 &&
    observability.latencyMs <= 86_400_000 &&
    hasExactKeys(observability.estimatedCost, ['status']) &&
    observability.estimatedCost.status === 'unknown'
  );
};

const hasStrictBriefingShape = (value: unknown): value is BriefingResult => {
  if (
    !hasOnlyKeys(value, [
      'topic',
      'stories',
      'facts',
      'inference',
      'route',
      'model',
      'fallback',
      'delivery',
      'observability',
    ])
  )
    return false;
  const result = value as unknown as BriefingResult;
  if (
    typeof result.topic !== 'string' ||
    result.topic.length === 0 ||
    !Array.isArray(result.stories) ||
    !result.stories.every(isCitedStory) ||
    !Array.isArray(result.facts) ||
    !result.facts.every(isCitedStory) ||
    !Array.isArray(result.inference) ||
    !result.inference.every((item) => typeof item === 'string') ||
    (result.route !== undefined &&
      result.route !== 'deterministic-rss' &&
      result.route !== 'local-ollama')
  )
    return false;
  if (
    result.model !== undefined &&
    (!hasExactKeys(result.model, ['id', 'route']) ||
      typeof result.model.id !== 'string' ||
      result.model.id.length === 0 ||
      result.model.route !== 'local-ollama')
  )
    return false;
  if (
    result.fallback !== undefined &&
    (!hasExactKeys(result.fallback, ['from', 'reason']) ||
      result.route !== 'deterministic-rss' ||
      result.fallback.from !== 'local-ollama' ||
      (result.fallback.reason !== 'model_unavailable' &&
        result.fallback.reason !== 'model_invalid_output' &&
        result.fallback.reason !== 'model_timeout'))
  )
    return false;
  if (result.delivery !== undefined && !isBriefingDelivery(result.delivery))
    return false;
  if (
    result.observability !== undefined &&
    !isBriefingObservability(result.observability)
  )
    return false;
  return true;
};
export const DEFAULT_RSS_FEED =
  'https://techcrunch.com/category/artificial-intelligence/feed/';

export const createResearchExecutor =
  (
    feedsValue: string | undefined,
    modelName?: string,
    endpoint?: string,
    model?: LocalBriefingModel,
    research: BriefingSynthesizer = synthesizer,
    delivery?: BriefingDelivery,
  ) =>
  async (context: ExecutionContext, signal: AbortSignal) => {
    const startedAt = performance.now();
    const feeds = (feedsValue === undefined ? DEFAULT_RSS_FEED : feedsValue)
      .split(',')
      .map((feed) => feed.trim())
      .filter(Boolean);
    if (!context.topic || !context.quantity)
      throw new ResearchError('invalid_research_context');
    if (feeds.length === 0) throw new ResearchError('rss_not_configured');
    const facts: BriefingResult = await research.create(
      context.topic,
      context.quantity,
      feeds.map((url) => ({ url })),
      signal,
    );
    let briefing = facts;
    const modelAttempted = Boolean(modelName);
    if (modelName && hasTextSecret(modelName))
      throw new ResearchError('unsafe_text');
    try {
      if (modelName)
        briefing = await (
          model ?? new OllamaBriefingModel(modelName, endpoint)
        ).synthesize(facts, signal);
    } catch (error) {
      if (error instanceof ModelError && !signal.aborted) {
        briefing = {
          ...facts,
          route: 'deterministic-rss',
          fallback: { from: 'local-ollama', reason: error.code },
        };
      } else {
        throw error;
      }
    }
    if (!hasStrictBriefingShape(briefing) || containsTextSecret(briefing))
      throw new ResearchError('unsafe_text');
    const receipt = delivery
      ? await delivery.deliver(context, briefing, signal)
      : undefined;
    if (receipt !== undefined && !isBriefingDelivery(receipt))
      throw new ResearchError('unsafe_text');
    const provider =
      briefing.route === 'local-ollama' ? 'local-ollama' : 'public-rss';
    const tools: BriefingObservabilityTool[] = ['public-rss'];
    if (modelAttempted) tools.push('local-ollama');
    if (delivery) tools.push('file-outbox');
    const observability: BriefingObservability = {
      provider,
      model:
        provider === 'local-ollama'
          ? (briefing.model?.id ?? modelName ?? null)
          : null,
      tools,
      latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
      estimatedCost: { status: 'unknown' },
    };
    return JSON.stringify({
      ...briefing,
      ...(receipt ? { delivery: receipt } : {}),
      observability,
    });
  };
