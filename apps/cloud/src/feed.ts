import { hasTextSecret, redactTextSecrets } from '@tatu/shared';

export const DEFAULT_CLOUD_FEED =
  'https://techcrunch.com/category/artificial-intelligence/feed/';
const allowlist = new Set([DEFAULT_CLOUD_FEED]);
/** Curated first route covers AI only; arbitrary topics must not receive unrelated stories. */
export function supportsCloudTopic(topic: string): boolean {
  const normalized = topic
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
  return /^(?:(?:noticias|novidades|desenvolvimentos)\s+(?:de|sobre)\s+)?(?:ia|ai|inteligencia artificial|artificial intelligence)$/u.test(
    normalized,
  );
}
export type CitedFact = {
  title: string;
  url: string;
  publishedAt: string;
  source: string;
};
export type CloudBriefing = {
  topic: string;
  stories: CitedFact[];
  facts: CitedFact[];
  inference: string[];
  route: 'deterministic-rss';
  delivery: { channel: 'in-app' };
  observability: {
    provider: 'public-rss';
    model: null;
    tools: string[];
    latencyMs: number;
    estimatedCost: { status: 'unknown' };
  };
};
const decode = (value: string): string =>
  value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gu, '$1')
    .replace(/&amp;/gu, '&')
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'")
    .replace(
      /<(script|style|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1>/giu,
      ' ',
    )
    .replace(/<[^>]*>/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
const field = (value: string, name: string): string =>
  decode(
    (
      value.match(
        new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'iu'),
      )?.[1] ?? ''
    ).slice(0, 8192),
  );
const safeArticle = (value: string): string | null => {
  try {
    const url = new URL(value);
    // A fixed public source publishes only public HTTPS article links; no user URL is ever fetched.
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'techcrunch.com' ||
      url.username ||
      url.password ||
      url.port ||
      url.search
    )
      return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
};
export async function fetchBriefing(
  topic: string,
  quantity: number,
  signal: AbortSignal,
  feed = DEFAULT_CLOUD_FEED,
  fetcher: typeof fetch = fetch,
): Promise<CloudBriefing> {
  const started = performance.now();
  if (
    !allowlist.has(feed) ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 10 ||
    !topic ||
    Boolean(hasTextSecret(topic)) ||
    topic.length > 512
  )
    throw new Error('invalid_research');
  if (!supportsCloudTopic(topic)) throw new Error('unsupported_topic');
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(20000)]);
  const response = await fetcher(feed, {
    redirect: 'manual',
    signal: deadline,
    headers: { accept: 'application/rss+xml, application/xml, text/xml' },
  });
  if (
    response.status !== 200 ||
    (response.url && response.url !== feed) ||
    !/(?:application\/(?:rss\+xml|xml)|text\/xml)/iu.test(
      response.headers.get('content-type') ?? '',
    ) ||
    Number(response.headers.get('content-length') ?? 0) > 524288
  )
    throw new Error('rss_unavailable');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('rss_unavailable');
  const cancel = () => {
    void reader.cancel().catch(() => {});
  };
  deadline.addEventListener('abort', cancel, { once: true });
  let size = 0;
  let xml = '';
  const decoder = new TextDecoder();
  try {
    for (;;) {
      deadline.throwIfAborted();
      const next = await reader.read();
      deadline.throwIfAborted();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > 524288) {
        await reader.cancel();
        throw new Error('rss_too_large');
      }
      xml += decoder.decode(next.value, { stream: true });
    }
    xml += decoder.decode();
  } finally {
    deadline.removeEventListener('abort', cancel);
    reader.releaseLock();
  }
  if (!/<rss(?:\s|>)/iu.test(xml) || /<!DOCTYPE|<!ENTITY/iu.test(xml))
    throw new Error('invalid_rss');
  const stories: CitedFact[] = [];
  const seen = new Set<string>();
  const excerpts = new Map<string, string>();
  for (const match of xml.matchAll(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/giu)) {
    const title = redactTextSecrets(field(match[0], 'title'));
    const url = safeArticle(field(match[0], 'link'));
    const date = Date.parse(field(match[0], 'pubDate'));
    if (
      !url ||
      !title ||
      title.length > 1024 ||
      !Number.isFinite(date) ||
      seen.has(url)
    )
      continue;
    seen.add(url);
    const description = redactTextSecrets(field(match[0], 'description')).slice(
      0,
      1400,
    );
    excerpts.set(
      url,
      description
        ? `Trecho publicado pela fonte: ${description}`
        : `Título da fonte; sem resumo publicado: ${title}`,
    );
    stories.push({
      title,
      url,
      publishedAt: new Date(date).toISOString(),
      source: 'techcrunch.com',
    });
    if (stories.length >= 200) break;
  }
  stories.sort(
    (left, right) =>
      right.publishedAt.localeCompare(left.publishedAt) ||
      left.url.localeCompare(right.url),
  );
  const selected = stories.slice(0, quantity);
  if (selected.length !== quantity) throw new Error('insufficient_sources');
  return {
    topic,
    stories: selected,
    facts: selected.map((story) => ({
      ...story,
      title: excerpts.get(story.url)!,
    })),
    inference: [],
    route: 'deterministic-rss',
    delivery: { channel: 'in-app' },
    observability: {
      provider: 'public-rss',
      model: null,
      tools: ['public-rss', 'in-app'],
      latencyMs: Math.max(0, Math.round(performance.now() - started)),
      estimatedCost: { status: 'unknown' },
    },
  };
}
