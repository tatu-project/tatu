import type { ExecutionContext } from '@tatu/shared';
import { ResearchError, RssBriefingSynthesizer } from '@tatu/research';

const synthesizer = new RssBriefingSynthesizer();

export const createResearchExecutor =
  (feedsValue: string | undefined) =>
  async (context: ExecutionContext, signal: AbortSignal) => {
    const feeds = (feedsValue ?? '')
      .split(',')
      .map((feed) => feed.trim())
      .filter(Boolean);
    if (!context.topic || !context.quantity)
      throw new ResearchError('invalid_research_context');
    if (feeds.length === 0) throw new ResearchError('rss_not_configured');
    return JSON.stringify(
      await synthesizer.create(
        context.topic,
        context.quantity,
        feeds.map((url) => ({ url })),
        signal,
      ),
    );
  };
