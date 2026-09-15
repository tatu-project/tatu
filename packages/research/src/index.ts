import { lookup } from 'node:dns/promises';
import type {
  BriefingResult,
  BriefingSynthesizer,
  CitedStory,
  ResearchFeed,
} from '@tatu/shared';

export interface FetchOptions {
  signal?: AbortSignal;
}

export type FetchLike = (
  input: string,
  options?: FetchOptions,
) => Promise<{
  ok: boolean;
  status?: number;
  url?: string;
  headers?: Headers;
  body?: ReadableStream<Uint8Array> | null;
  text(): Promise<string>;
}>;
export class ResearchError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'ResearchError';
  }
}
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
const decodeXml = (value: string) =>
  value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
const text = (value: string) =>
  decodeXml(value)
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
const field = (item: string, name: string) =>
  text(
    item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'))?.[1] ??
      '',
  );
const maxFeedBytes = 512 * 1024;
const maxRedirects = 3;
const isPrivateIpv4 = (address: string) => {
  const octets = address.split('.').map(Number);
  if (
    octets.length !== 4 ||
    octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)
  )
    return false;
  return (
    octets[0] === 10 ||
    octets[0] === 0 ||
    octets[0] === 127 ||
    (octets[0] === 169 && octets[1] === 254) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 0 && octets[2] === 0) ||
    (octets[0] === 192 && octets[1] === 168) ||
    (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127) ||
    (octets[0] === 198 && (octets[1] === 18 || octets[1] === 19)) ||
    (octets[0] === 198 && octets[1] === 51 && octets[2] === 100) ||
    (octets[0] === 203 && octets[1] === 0 && octets[2] === 113) ||
    octets[0] >= 224
  );
};
const mappedIpv4 = (value: string) => {
  const compressed = value.includes('::');
  const [left, right = ''] = value.split('::');
  if (value.split('::').length > 2) return undefined;
  const leftParts = left ? left.split(':') : [];
  const rightParts = right ? right.split(':') : [];
  if (rightParts.some((part) => part.includes('.'))) {
    const dotted = rightParts.pop();
    if (dotted) {
      const octets = dotted.split('.').map(Number);
      if (
        octets.length === 4 &&
        octets.every(
          (octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255,
        )
      )
        rightParts.push(
          ((octets[0] << 8) | octets[1]).toString(16),
          ((octets[2] << 8) | octets[3]).toString(16),
        );
    }
  }
  const missing = 8 - leftParts.length - rightParts.length;
  if (missing < 0 || (!compressed && missing !== 0)) return undefined;
  const parts = [
    ...leftParts,
    ...Array.from({ length: missing }, () => '0'),
    ...rightParts,
  ];
  if (
    parts.length !== 8 ||
    parts.some((part) => !/^[0-9a-f]{1,4}$/i.test(part)) ||
    parts.slice(0, 5).some((part) => part !== '0') ||
    parts[5].toLocaleLowerCase() !== 'ffff'
  )
    return undefined;
  const high = Number.parseInt(parts[6], 16);
  const low = Number.parseInt(parts[7], 16);
  return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
};
const isPrivateAddress = (address: string) => {
  const value = address.toLocaleLowerCase();
  if (value.includes('.')) {
    const mapped = mappedIpv4(value);
    return mapped ? isPrivateIpv4(mapped) : isPrivateIpv4(value);
  }
  const mapped = mappedIpv4(value);
  if (mapped) return isPrivateIpv4(mapped);
  return (
    value === '::' ||
    value === '::1' ||
    value.startsWith('fc') ||
    value.startsWith('fd') ||
    value.startsWith('fe8') ||
    value.startsWith('fe9') ||
    value.startsWith('fea') ||
    value.startsWith('feb') ||
    value.startsWith('ff') ||
    value.startsWith('2001:db8:')
  );
};
type LookupLike = (
  hostname: string,
  options: { all: true; verbatim: true },
) => Promise<Array<{ address: string; family: number }>>;
const dnsLookup = lookup as unknown as LookupLike;
const assertPublicUrl = async (
  value: URL,
  lookupImpl: LookupLike = dnsLookup,
) => {
  if (
    value.protocol !== 'https:' ||
    value.username ||
    value.password ||
    value.hostname === 'localhost' ||
    value.hostname.endsWith('.localhost') ||
    value.hostname.endsWith('.local')
  )
    throw new ResearchError('unsafe_rss_url');
  let addresses;
  try {
    addresses = await lookupImpl(value.hostname, { all: true, verbatim: true });
  } catch {
    throw new ResearchError('rss_unavailable');
  }
  if (
    !addresses.length ||
    addresses.some(({ address }) => isPrivateAddress(address))
  )
    throw new ResearchError('unsafe_rss_url');
};
const timeoutSignal = (parent?: AbortSignal) => {
  const timeout = AbortSignal.timeout(10_000);
  return parent ? AbortSignal.any([parent, timeout]) : timeout;
};
export async function fetchPublicRss(
  initialUrl: string,
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
  lookupImpl: LookupLike = dnsLookup,
): Promise<Response> {
  let current = new URL(initialUrl);
  for (let redirect = 0; redirect <= maxRedirects; redirect += 1) {
    await assertPublicUrl(current, lookupImpl);
    let response: Response;
    try {
      response = await fetchImpl(current.toString(), {
        redirect: 'manual',
        signal: timeoutSignal(signal),
      });
    } catch (error) {
      if (
        signal?.aborted ||
        (error instanceof Error && error.name === 'TimeoutError')
      )
        throw new ResearchError('research_timeout');
      throw new ResearchError('rss_unavailable');
    }
    if (response.status < 300 || response.status >= 400) {
      if (response.url)
        await assertPublicUrl(new URL(response.url), lookupImpl);
      return response;
    }
    const location = response.headers.get('location');
    if (!location || redirect === maxRedirects)
      throw new ResearchError('rss_redirect_limit');
    current = new URL(location, current);
  }
  throw new ResearchError('rss_redirect_limit');
}
const readLimitedText = async (response: {
  body?: ReadableStream<Uint8Array> | null;
  text(): Promise<string>;
}) => {
  if (!response.body) {
    const value = await response.text();
    if (new TextEncoder().encode(value).byteLength > maxFeedBytes)
      throw new ResearchError('rss_too_large');
    return value;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > maxFeedBytes) {
        await reader.cancel();
        throw new ResearchError('rss_too_large');
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(output);
};
const canonicalUrl = (value: string) => {
  const url = new URL(value);
  url.hash = '';
  url.hostname = url.hostname.toLocaleLowerCase();
  for (const key of [...url.searchParams.keys()])
    if (key.toLocaleLowerCase().startsWith('utm_') || key === 'ref')
      url.searchParams.delete(key);
  url.pathname = url.pathname.replace(/\/$/, '') || '/';
  return url.toString();
};
const safeArticleUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password
      ? canonicalUrl(value)
      : undefined;
  } catch {
    return undefined;
  }
};
export function parseRss(xml: string, source: string): CitedStory[] {
  return [...xml.matchAll(/<item[\s\S]*?>[\s\S]*?<\/item>/gi)]
    .map((match) => {
      const item = match[0];
      const url = safeArticleUrl(field(item, 'link'));
      return {
        title: field(item, 'title'),
        url: url ?? '',
        publishedAt: field(item, 'pubDate') || field(item, 'published'),
        source,
      };
    })
    .filter(
      (story) =>
        story.title &&
        story.url &&
        !Number.isNaN(Date.parse(story.publishedAt)),
    );
}
const topicTerms = (topic: string) =>
  normalize(topic)
    .split(/\s+/)
    .filter((term) => term.length >= 3);
const relevance = (story: CitedStory, terms: string[]) => {
  const haystack = normalize(story.title);
  return terms.reduce(
    (score, term) => score + (haystack.includes(term) ? 1 : 0),
    0,
  );
};
export async function researchBriefing(
  topic: string,
  quantity: number,
  feeds: string[],
  fetcher: FetchLike = async (url, options) =>
    fetchPublicRss(url, options?.signal),
  signal?: AbortSignal,
): Promise<BriefingResult> {
  if (!Number.isInteger(quantity) || quantity < 1)
    throw new ResearchError('invalid_quantity');
  if (signal?.aborted) throw new ResearchError('research_timeout');
  const urls: URL[] = [];
  try {
    for (const feed of feeds) {
      const url = new URL(feed);
      if (url.protocol !== 'https:') throw new ResearchError('invalid_rss_url');
      if (url.username || url.password)
        throw new ResearchError('unsafe_rss_url');
      urls.push(url);
    }
  } catch (error) {
    if (error instanceof ResearchError) throw error;
    throw new ResearchError('invalid_rss_url');
  }
  if (urls.length === 0) throw new ResearchError('rss_not_configured');
  const settled = await Promise.allSettled(
    urls.map(async (url) => {
      const response = await fetcher(url.toString(), { signal });
      if (!response.ok) throw new ResearchError('rss_unavailable');
      return parseRss(await readLimitedText(response), url.hostname);
    }),
  );
  if (signal?.aborted) throw new ResearchError('research_timeout');
  const terms = topicTerms(topic);
  const stories = settled
    .flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
    .filter((story) => terms.length === 0 || relevance(story, terms) > 0)
    .sort(
      (a, b) =>
        relevance(b, terms) - relevance(a, terms) ||
        Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
    )
    .filter(
      (story, index, all) =>
        all.findIndex(
          (candidate) =>
            canonicalUrl(candidate.url) === canonicalUrl(story.url) ||
            normalize(candidate.title) === normalize(story.title),
        ) === index,
    )
    .slice(0, quantity);
  if (stories.length < quantity) {
    const typedFailure = settled.find(
      (result) =>
        result.status === 'rejected' && result.reason instanceof ResearchError,
    );
    if (
      typedFailure?.status === 'rejected' &&
      ['rss_too_large', 'research_timeout', 'unsafe_rss_url'].includes(
        typedFailure.reason.code,
      )
    )
      throw typedFailure.reason;
    const allFailed = settled.every((result) => result.status === 'rejected');
    throw new ResearchError(
      allFailed ? 'rss_unavailable' : 'insufficient_cited_stories',
    );
  }
  return { topic, stories, facts: stories, inference: [] };
}

export class RssBriefingSynthesizer implements BriefingSynthesizer {
  async create(
    topic: string,
    quantity: number,
    feeds: ResearchFeed[],
    signal: AbortSignal,
  ): Promise<BriefingResult> {
    if (signal.aborted) throw new ResearchError('research_timeout');
    return researchBriefing(
      topic,
      quantity,
      feeds.map((feed) => feed.url),
      async (url, options) => fetchPublicRss(url, options?.signal),
      signal,
    );
  }
}
