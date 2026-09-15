import type {
  BriefingResult,
  BriefingSynthesizer,
  ExecutionContext,
} from '@tatu/shared';
import {
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
    const selected = modelName
      ? (model ?? new OllamaBriefingModel(modelName, endpoint)).synthesize(
          facts,
          signal,
        )
      : Promise.resolve(facts);
    return JSON.stringify(await selected);
  };
