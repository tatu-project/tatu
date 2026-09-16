import type {
  BriefingDelivery,
  BriefingObservability,
  BriefingObservabilityTool,
  BriefingResult,
  BriefingSynthesizer,
  ExecutionContext,
} from '@tatu/shared';
import { hasSensitiveUrlQuery, hasTextSecret } from '@tatu/shared';
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
    if (containsTextSecret(briefing)) throw new ResearchError('unsafe_text');
    const receipt = delivery
      ? await delivery.deliver(context, briefing, signal)
      : undefined;
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
