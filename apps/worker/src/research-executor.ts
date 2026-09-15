import type {
  BriefingDelivery,
  BriefingResult,
  BriefingSynthesizer,
  ExecutionContext,
} from '@tatu/shared';
import {
  ModelError,
  OllamaBriefingModel,
  ResearchError,
  RssBriefingSynthesizer,
} from '@tatu/research';
import type { LocalBriefingModel } from '@tatu/shared';

const synthesizer = new RssBriefingSynthesizer();
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
    if (!modelName) {
      if (!delivery) return JSON.stringify(briefing);
      const receipt = await delivery.deliver(context, briefing, signal);
      return JSON.stringify({ ...briefing, delivery: receipt });
    }
    try {
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
    if (!delivery) return JSON.stringify(briefing);
    const receipt = await delivery.deliver(context, briefing, signal);
    return JSON.stringify({ ...briefing, delivery: receipt });
  };
