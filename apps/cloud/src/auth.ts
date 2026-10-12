import type { CloudEnv, VerifiedIdentity } from './types.js';

type SigningKey = JsonWebKey & { kid?: string };
const caches = new Map<string, { expires: number; keys: SigningKey[] }>();
const unsafeSubject = (value: string) =>
  /\s/u.test(value) ||
  [...value].some((character) => character.charCodeAt(0) < 32);
const originFor = (environment: CloudEnv): string | null => {
  try {
    const url = new URL(String(environment.SITE_ORIGIN ?? ''));
    return url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      url.pathname === '/' &&
      !url.search &&
      !url.hash
      ? url.origin
      : null;
  } catch {
    return null;
  }
};
export function permitsCloudMutation(
  request: Request,
  environment: CloudEnv,
): boolean {
  const origin = originFor(environment);
  if (!origin || new URL(request.url).origin !== origin) return false;
  const supplied = request.headers.get('origin');
  if (supplied !== null && supplied !== origin) return false;
  const metadata = request.headers.get('sec-fetch-site');
  return metadata === null || metadata === 'same-origin' || metadata === 'none';
}
const decode = (encoded: string): Uint8Array<ArrayBuffer> => {
  if (!/^[A-Za-z0-9_-]+$/u.test(encoded)) throw new Error('invalid_token');
  const binary = atob(encoded.replace(/-/gu, '+').replace(/_/gu, '/'));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++)
    bytes[index] = binary.charCodeAt(index);
  return bytes;
};
const object = (encoded: string): Record<string, unknown> => {
  const value: unknown = JSON.parse(new TextDecoder().decode(decode(encoded)));
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('invalid_token');
  return value as Record<string, unknown>;
};
async function signingKeys(
  domain: string,
  fetcher: typeof fetch,
  now: number,
  refresh = false,
): Promise<SigningKey[]> {
  const cached = caches.get(domain);
  if (!refresh && cached && cached.expires > now) return cached.keys;
  const response = await fetcher(`https://${domain}/cdn-cgi/access/certs`, {
    redirect: 'error',
    signal: AbortSignal.timeout(3000),
  });
  if (
    !response.ok ||
    Number(response.headers.get('content-length') ?? 0) > 32768
  )
    throw new Error('invalid_keys');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('invalid_keys');
  let bytes = 0;
  let text = '';
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 32768) {
        await reader.cancel();
        throw new Error('invalid_keys');
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  const value = JSON.parse(text) as { keys?: SigningKey[] };
  if (
    !Array.isArray(value.keys) ||
    value.keys.length < 1 ||
    value.keys.length > 16
  )
    throw new Error('invalid_keys');
  const keys = value.keys.filter(
    (key) =>
      key.kty === 'RSA' &&
      key.alg === 'RS256' &&
      key.use === 'sig' &&
      typeof key.kid === 'string' &&
      key.kid.length <= 200,
  );
  if (!keys.length) throw new Error('invalid_keys');
  if (caches.size > 32) caches.clear();
  caches.set(domain, { keys, expires: now + 300000 });
  return keys;
}
/** Sites identity headers are trusted only behind configured Sites dispatch, never on the portable Access lane. */
export async function authenticate(
  request: Request,
  environment: CloudEnv,
  fetcher: typeof fetch = fetch,
  now = Date.now(),
): Promise<VerifiedIdentity | null> {
  const origin = originFor(environment);
  if (!origin || new URL(request.url).origin !== origin) return null;
  if (environment.AUTH_MODE === 'sites') {
    const project = environment.SITE_PROJECT_ID;
    const subject = request.headers.get('oai-authenticated-user-id');
    if (
      typeof project !== 'string' ||
      !/^appgprj_[a-zA-Z0-9_]{10,100}$/u.test(project) ||
      !subject ||
      subject.length > 200 ||
      unsafeSubject(subject)
    )
      return null;
    return { issuer: `sites:${project}`, subject };
  }
  if (environment.AUTH_MODE !== 'cloudflare-access') return null;
  const domain = environment.ACCESS_TEAM_DOMAIN;
  const audience = environment.ACCESS_AUDIENCE;
  if (
    typeof domain !== 'string' ||
    !/^[a-z0-9-]+\.cloudflareaccess\.com$/u.test(domain) ||
    typeof audience !== 'string' ||
    !audience ||
    audience.length > 256
  )
    return null;
  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token || token.length > 8192) return null;
  try {
    const pieces = token.split('.');
    if (pieces.length !== 3) return null;
    const header = object(pieces[0]);
    const claims = object(pieces[1]);
    const seconds = Math.floor(now / 1000);
    if (
      header.alg !== 'RS256' ||
      typeof header.kid !== 'string' ||
      header.kid.length > 200 ||
      claims.iss !== `https://${domain}` ||
      typeof claims.exp !== 'number' ||
      claims.exp <= seconds ||
      (claims.nbf !== undefined &&
        (typeof claims.nbf !== 'number' || claims.nbf > seconds)) ||
      typeof claims.iat !== 'number' ||
      claims.iat > seconds + 30 ||
      typeof claims.sub !== 'string' ||
      !claims.sub ||
      claims.sub.length > 200 ||
      unsafeSubject(claims.sub) ||
      !(
        claims.aud === audience ||
        (Array.isArray(claims.aud) && claims.aud.includes(audience))
      )
    )
      return null;
    let keys = await signingKeys(domain, fetcher, now);
    if (!keys.some((key) => key.kid === header.kid))
      keys = await signingKeys(domain, fetcher, now, true);
    const jwk = keys.find((key) => key.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      decode(pieces[2]),
      new TextEncoder().encode(`${pieces[0]}.${pieces[1]}`),
    );
    return valid ? { issuer: `access:${domain}`, subject: claims.sub } : null;
  } catch {
    return null;
  }
}

/** The owner-private Sites platform boundary permits a shared updater, never user impersonation. */
export function permitsSystemRun(
  request: Request,
  environment: CloudEnv,
): boolean {
  if (!permitsCloudMutation(request, environment)) return false;
  if (
    environment.AUTH_MODE === 'sites' &&
    environment.SITES_OWNER_PRIVATE === '1' &&
    typeof environment.SITE_PROJECT_ID === 'string'
  )
    return true;
  const secret = environment.SYSTEM_RUN_TOKEN;
  const supplied = request.headers.get('authorization');
  if (typeof secret !== 'string' || secret.length < 32 || !supplied)
    return false;
  const expected = `Bearer ${secret}`;
  if (supplied.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index++)
    mismatch |= supplied.charCodeAt(index) ^ expected.charCodeAt(index);
  return mismatch === 0;
}
