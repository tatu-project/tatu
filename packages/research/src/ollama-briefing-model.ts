import type {
  BriefingResult,
  CitedStory,
  LocalBriefingModel,
} from '@tatu/shared';
export class ModelError extends Error {
  constructor(
    readonly code:
      'model_unavailable' | 'model_invalid_output' | 'model_timeout',
  ) {
    super(code);
  }
}
export class OllamaBriefingModel implements LocalBriefingModel {
  constructor(
    private readonly model: string,
    private readonly endpoint = 'http://127.0.0.1:11434',
    private readonly request: typeof fetch = fetch,
  ) {}
  async synthesize(
    input: BriefingResult,
    signal: AbortSignal,
  ): Promise<BriefingResult> {
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
        prompt: JSON.stringify(input),
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
        typeof story.url === 'string' &&
        typeof story.publishedAt === 'string' &&
        typeof story.source === 'string'
      );
    };
    if (
      !output ||
      typeof output !== 'object' ||
      output.topic !== input.topic ||
      !Array.isArray(output.stories) ||
      output.stories.length !== input.stories.length ||
      !Array.isArray(output.facts) ||
      output.facts.length !== input.facts.length ||
      !Array.isArray(output.inference) ||
      !output.stories.every(isCitedStory) ||
      !output.facts.every(isCitedStory) ||
      !output.inference.every((item) => typeof item === 'string') ||
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
