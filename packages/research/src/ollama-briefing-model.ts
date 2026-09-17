import type {
  BriefingModelMetadata,
  BriefingResult,
  CitedStory,
  LocalBriefingModel,
} from '@tatu/shared';
import { hasSensitiveUrlQuery, hasTextSecret } from '@tatu/shared';
export class ModelError extends Error {
  constructor(
    readonly code:
      'model_unavailable' | 'model_invalid_output' | 'model_timeout',
  ) {
    super(code);
  }
}
export class OllamaBriefingModel implements LocalBriefingModel {
  readonly metadata: BriefingModelMetadata;

  constructor(
    private readonly model: string,
    private readonly endpoint = 'http://127.0.0.1:11434',
    private readonly request: typeof fetch = fetch,
  ) {
    if (hasTextSecret(model)) throw new ModelError('model_unavailable');
    this.metadata = Object.freeze({
      id: model,
      capabilities: Object.freeze([
        'briefing-synthesis',
        'structured-json',
        'citation-preservation',
      ] as const),
    });
  }
  async synthesize(
    input: BriefingResult,
    signal: AbortSignal,
  ): Promise<BriefingResult> {
    if (hasTextSecret(this.model)) throw new ModelError('model_unavailable');
    const safeInputStory = (story: CitedStory) => {
      if (
        hasTextSecret(story.title) ||
        hasTextSecret(story.source) ||
        hasTextSecret(story.publishedAt)
      )
        return false;
      try {
        const url = new URL(story.url);
        return (
          !hasTextSecret(story.url) &&
          !url.username &&
          !url.password &&
          !hasSensitiveUrlQuery(url)
        );
      } catch {
        return false;
      }
    };
    if (
      hasTextSecret(input.topic) ||
      !input.stories.every(safeInputStory) ||
      !input.facts.every(safeInputStory) ||
      input.inference.some(hasTextSecret) ||
      (input.model !== undefined && hasTextSecret(input.model.id)) ||
      (input.observability !== undefined &&
        input.observability.model !== null &&
        hasTextSecret(input.observability.model))
    )
      throw new ModelError('model_invalid_output');
    const prompt = {
      topic: input.topic,
      stories: input.stories.map(({ title, url, publishedAt, source }) => ({
        title,
        url,
        publishedAt,
        source,
      })),
      facts: input.facts.map(({ title, url, publishedAt, source }) => ({
        title,
        url,
        publishedAt,
        source,
      })),
      inference: [...input.inference],
    };
    let endpoint: URL;
    try {
      endpoint = new URL(this.endpoint);
    } catch {
      throw new ModelError('model_unavailable');
    }
    if (
      !['http:', 'https:'].includes(endpoint.protocol) ||
      endpoint.username ||
      endpoint.password ||
      hasSensitiveUrlQuery(endpoint) ||
      (endpoint.hostname !== '127.0.0.1' && endpoint.hostname !== 'localhost')
    )
      throw new ModelError('model_unavailable');
    const response = await this.request(`${endpoint.origin}/api/generate`, {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        stream: false,
        format: 'json',
        prompt: JSON.stringify(prompt),
      }),
    }).catch(() => {
      throw new ModelError(
        signal.aborted ? 'model_timeout' : 'model_unavailable',
      );
    });
    if (!response.ok) throw new ModelError('model_unavailable');
    let output: BriefingResult;
    try {
      output = JSON.parse(
        ((await response.json()) as { response: string }).response,
      ) as BriefingResult;
    } catch {
      throw new ModelError('model_invalid_output');
    }
    const allowed = new Set(input.stories.map((story) => story.url));
    const exactStory = (story: CitedStory, selected: CitedStory[]) => {
      const original = selected.find(
        (candidate) => candidate.url === story.url,
      );
      return (
        original &&
        original.title === story.title &&
        original.publishedAt === story.publishedAt &&
        original.source === story.source
      );
    };
    const isCitedStory = (value: unknown): value is CitedStory => {
      if (!value || typeof value !== 'object') return false;
      const story = value as Partial<CitedStory>;
      return (
        typeof story.title === 'string' &&
        !hasTextSecret(story.title) &&
        typeof story.url === 'string' &&
        typeof story.publishedAt === 'string' &&
        typeof story.source === 'string' &&
        !hasTextSecret(story.source)
      );
    };
    if (
      !output ||
      typeof output !== 'object' ||
      output.topic !== input.topic ||
      hasTextSecret(output.topic) ||
      !Array.isArray(output.stories) ||
      output.stories.length !== input.stories.length ||
      !Array.isArray(output.facts) ||
      output.facts.length !== input.facts.length ||
      !Array.isArray(output.inference) ||
      !output.stories.every(isCitedStory) ||
      !output.facts.every(isCitedStory) ||
      !output.inference.every(
        (item) => typeof item === 'string' && !hasTextSecret(item),
      ) ||
      output.stories.some((story) => !allowed.has(story.url)) ||
      output.facts.some((story) => !allowed.has(story.url)) ||
      output.stories.some((story) => !exactStory(story, input.stories)) ||
      output.facts.some((story) => !exactStory(story, input.facts)) ||
      new Set(output.stories.map((story) => story.url)).size !==
        input.stories.length ||
      new Set(output.facts.map((story) => story.url)).size !==
        input.facts.length ||
      output.inference.length > 8
    )
      throw new ModelError('model_invalid_output');
    return {
      ...output,
      route: 'local-ollama',
      model: { id: this.model, route: 'local-ollama' },
    };
  }
}
