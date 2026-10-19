import type {
  CloudEnv,
  ModelRoute,
  ModelRouteStatus,
  RemoteServices,
  RemoteStatus,
} from './types.js';
import { PROVIDER_CONTEXT_MAX_BYTES } from './types.js';
import { hasTextSecret } from '@tatu/shared';
import { sealSecret, openFromKeyring, type SecretEnvelope } from './vault.js';
import {
  reserveQuota,
  blockQuota,
  QuotaError,
  type QuotaLimits,
  type QuotaReservation,
} from './quota.js';
const GROQ_MODEL = 'openai/gpt-oss-20b';
const WORKERS_MODEL = '@cf/openai/gpt-oss-20b';
const MAX_OUTPUT = 1024,
  MAX_CONTEXT = PROVIDER_CONTEXT_MAX_BYTES;
export class ProviderError extends Error {
  constructor(
    readonly code:
      | 'invalid_input'
      | 'unavailable'
      | 'quota_exhausted'
      | 'invalid_output'
      | 'timeout',
    readonly status = 503,
    readonly retryAfter: number | null = null,
  ) {
    super(code);
  }
}
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const validKey = (value: unknown): value is string =>
  typeof value === 'string' && /^gsk_[A-Za-z0-9]{20,200}$/u.test(value);
const metadata = () => ({
  provider: 'groq',
  connected: true,
  model: GROQ_MODEL,
  externalQuota: 'unknown',
  revocation: 'manual',
  revocationUrl: 'https://console.groq.com/keys',
});
const limits = (sponsored: boolean): QuotaLimits => ({
  minuteRequests: 8,
  dayRequests: sponsored ? 30 : 100,
  minuteUnits: 8000,
  dayUnits: sponsored ? 100000 : 180000,
  concurrency: 2,
});
const encoder = new TextEncoder();
const retryDelay = (value: string | null) => {
  const seconds =
    value && /^\d+$/u.test(value)
      ? Number(value)
      : value
        ? Math.ceil((Date.parse(value) - Date.now()) / 1000)
        : 60;
  return Math.min(86400, Math.max(1, Number.isFinite(seconds) ? seconds : 60));
};
async function boundedJSON(response: Response): Promise<unknown> {
  if (
    !response.headers.get('content-type')?.includes('application/json') ||
    !response.body
  )
    throw new ProviderError('invalid_output', 422);
  const reader = response.body.getReader(),
    parts: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 65536) throw new ProviderError('invalid_output', 422);
      parts.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new ProviderError('invalid_output', 422);
  }
}
export function createRemoteServices(
  env: CloudEnv,
  fetcher: typeof fetch = fetch,
): RemoteServices {
  const db = () => {
    if (!env.DB) throw new ProviderError('unavailable');
    return env.DB;
  };
  const keyId = () =>
    typeof env.TATU_ENCRYPTION_KEY_ID === 'string'
      ? env.TATU_ENCRYPTION_KEY_ID
      : 'v1';
  const connection = async (owner: string) =>
    db()
      .prepare(
        'SELECT envelope_json FROM provider_connections WHERE owner_id=? AND provider=?',
      )
      .bind(owner, 'groq')
      .first<{ envelope_json: string }>();
  const workers = () => object(env.AI) && typeof env.AI.run === 'function';
  const sponsoredGroq = () =>
    env.TATU_ENABLE_SPONSORED_GROQ === 'true' &&
    validKey(env.TATU_GROQ_API_KEY);
  /** A preferred route wins only while configured; otherwise the fixed precedence applies, never a new route. */
  async function choose(
    owner: string,
    preferred: ModelRoute = 'auto',
  ): Promise<{
    provider: 'groq' | 'workers-ai';
    key?: string;
    sponsored: boolean;
  }> {
    if (preferred === 'groq-sponsored' && sponsoredGroq())
      return {
        provider: 'groq',
        key: env.TATU_GROQ_API_KEY as string,
        sponsored: true,
      };
    if (preferred === 'workers-ai' && workers())
      return { provider: 'workers-ai', sponsored: true };
    const row = await connection(owner);
    if (row) {
      try {
        const opened = await openFromKeyring(
          JSON.parse(row.envelope_json) as SecretEnvelope,
          {
            current: { id: keyId(), key: env.TATU_ENCRYPTION_KEY },
            ...(typeof env.TATU_PREVIOUS_ENCRYPTION_KEY_ID === 'string'
              ? {
                  previous: {
                    id: env.TATU_PREVIOUS_ENCRYPTION_KEY_ID,
                    key: env.TATU_PREVIOUS_ENCRYPTION_KEY,
                  },
                }
              : {}),
          },
          owner,
          'groq',
        );
        if (opened.needsReseal) {
          const fresh = await sealSecret(
            opened.secret,
            env.TATU_ENCRYPTION_KEY,
            keyId(),
            owner,
            'groq',
          );
          const update = await db()
            .prepare(
              'UPDATE provider_connections SET envelope_json=?,updated_at=? WHERE owner_id=? AND provider=? AND envelope_json=?',
            )
            .bind(
              JSON.stringify(fresh),
              new Date().toISOString(),
              owner,
              'groq',
              row.envelope_json,
            )
            .run();
          // Concurrent disconnect/reconnection/rotation must not resurrect a key.
          if (!update.success || update.meta.changes !== 1)
            throw new Error('vault_unavailable');
        }
        return {
          provider: 'groq',
          key: opened.secret,
          sponsored: false,
        };
      } catch {
        throw new ProviderError('unavailable');
      }
    }
    if (sponsoredGroq())
      return {
        provider: 'groq',
        key: env.TATU_GROQ_API_KEY as string,
        sponsored: true,
      };
    if (workers()) return { provider: 'workers-ai', sponsored: true };
    throw new ProviderError('unavailable');
  }
  return {
    async connections(owner) {
      return (await connection(owner)) ? [metadata()] : [];
    },
    async connect(owner, input) {
      if (
        !object(input) ||
        Object.keys(input).some(
          (key) => !['provider', 'apiKey'].includes(key),
        ) ||
        input.provider !== 'groq' ||
        !validKey(input.apiKey)
      )
        throw new ProviderError('invalid_input', 422);
      let envelope: SecretEnvelope;
      try {
        envelope = await sealSecret(
          input.apiKey,
          env.TATU_ENCRYPTION_KEY,
          keyId(),
          owner,
          'groq',
        );
      } catch {
        throw new ProviderError('unavailable');
      }
      const release = await reserveQuota(db(), owner, 'groq-connect', 1, {
        minuteRequests: 2,
        dayRequests: 10,
        minuteUnits: 2,
        dayUnits: 10,
        concurrency: 1,
      });
      try {
        const response = await fetcher(
          'https://api.groq.com/openai/v1/models',
          {
            headers: { authorization: `Bearer ${input.apiKey}` },
            redirect: 'error',
            signal: AbortSignal.timeout(10000),
          },
        );
        if (!response.ok) {
          const retry = retryDelay(response.headers.get('retry-after'));
          await response.body?.cancel();
          if (response.status === 429)
            await blockQuota(db(), owner, 'groq-connect', retry);
          throw new ProviderError(
            response.status === 429 ? 'quota_exhausted' : 'invalid_input',
            response.status === 429 ? 429 : 422,
            retry,
          );
        }
        const result = await boundedJSON(response);
        if (
          !object(result) ||
          !Array.isArray(result.data) ||
          !result.data.some((item) => object(item) && item.id === GROQ_MODEL)
        )
          throw new ProviderError('invalid_input', 422);
        const at = new Date().toISOString();
        await db()
          .prepare(
            'INSERT INTO provider_connections(owner_id,provider,envelope_json,created_at,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(owner_id,provider) DO UPDATE SET envelope_json=excluded.envelope_json,updated_at=excluded.updated_at',
          )
          .bind(owner, 'groq', JSON.stringify(envelope), at, at)
          .run();
        return metadata();
      } catch (error) {
        if (error instanceof ProviderError || error instanceof QuotaError)
          throw error;
        throw new ProviderError('unavailable');
      } finally {
        await release();
      }
    },
    async disconnect(owner, id) {
      if (id !== 'groq') throw new ProviderError('invalid_input', 422);
      const result = await db()
        .prepare(
          'DELETE FROM provider_connections WHERE owner_id=? AND provider=?',
        )
        .bind(owner, 'groq')
        .run();
      return (result.meta.changes ?? 0) > 0;
    },
    async routes(owner): Promise<ModelRouteStatus[]> {
      return [
        {
          id: 'groq',
          model: GROQ_MODEL,
          configured: Boolean(await connection(owner)),
        },
        {
          id: 'groq-sponsored',
          model: GROQ_MODEL,
          configured: sponsoredGroq(),
        },
        { id: 'workers-ai', model: WORKERS_MODEL, configured: workers() },
      ];
    },
    async status(owner, preferred): Promise<RemoteStatus> {
      try {
        const route = await choose(owner, preferred);
        return {
          configured: true,
          available: false,
          model: route.provider === 'groq' ? GROQ_MODEL : WORKERS_MODEL,
          reason: 'configured_external_quota_unknown',
        };
      } catch {
        return {
          configured: false,
          available: false,
          model: null,
          reason: 'connect_provider_or_configure_free_binding',
        };
      }
    },
    async reply(owner, messages, signal, preferred) {
      if (
        !Array.isArray(messages) ||
        messages.length < 1 ||
        messages.length > 20 ||
        messages.some(
          (message) =>
            !object(message) ||
            !['system', 'user', 'assistant'].includes(String(message.role)) ||
            typeof message.content !== 'string' ||
            hasTextSecret(message.content) ||
            /\bgsk_[A-Za-z0-9]{20,}/u.test(message.content),
        )
      )
        throw new ProviderError('invalid_input', 422);
      const bytes = encoder.encode(JSON.stringify(messages)).length;
      if (bytes > MAX_CONTEXT) throw new ProviderError('invalid_input', 422);
      const route = await choose(owner, preferred);
      const units = bytes + MAX_OUTPUT;
      let globalRelease: QuotaReservation | undefined;
      let release: QuotaReservation | undefined;
      const timed = AbortSignal.any([signal, AbortSignal.timeout(15000)]);
      try {
        if (timed.aborted) throw new ProviderError('timeout', 504);
        // Reject owner caps before reserving any shared sponsored budget.
        release = await reserveQuota(
          db(),
          owner,
          route.provider,
          units,
          limits(route.sponsored),
        );
        if (route.sponsored) {
          const neurons = Math.ceil(
            (bytes * 18182) / 1e6 + (MAX_OUTPUT * 27273) / 1e6,
          );
          globalRelease = await reserveQuota(
            db(),
            'global',
            route.provider,
            route.provider === 'workers-ai' ? neurons : units,
            {
              minuteRequests: 16,
              dayRequests: route.provider === 'workers-ai' ? 100 : 100,
              minuteUnits: route.provider === 'workers-ai' ? 10000 : 8000,
              dayUnits: route.provider === 'workers-ai' ? 9500 : 180000,
              concurrency: 4,
            },
          );
        }
        if (timed.aborted) throw new ProviderError('timeout', 504);
        release.markDispatched();
        globalRelease?.markDispatched();
        let output: unknown;
        if (route.provider === 'groq') {
          const response = await fetcher(
            'https://api.groq.com/openai/v1/chat/completions',
            {
              method: 'POST',
              headers: {
                authorization: `Bearer ${route.key}`,
                'content-type': 'application/json',
              },
              body: JSON.stringify({
                model: GROQ_MODEL,
                messages,
                max_completion_tokens: MAX_OUTPUT,
                stream: false,
                reasoning_effort: 'low',
              }),
              redirect: 'error',
              signal: timed,
            },
          );
          if (response.status === 429) {
            const retry = retryDelay(response.headers.get('retry-after'));
            await response.body?.cancel();
            await blockQuota(db(), owner, route.provider, retry);
            if (route.sponsored)
              await blockQuota(db(), 'global', route.provider, retry);
            throw new ProviderError('quota_exhausted', 429, retry);
          }
          if (!response.ok) {
            await response.body?.cancel();
            throw new ProviderError('unavailable');
          }
          const raw = await boundedJSON(response);
          output =
            object(raw) &&
            Array.isArray(raw.choices) &&
            object(raw.choices[0]) &&
            object(raw.choices[0].message)
              ? raw.choices[0].message.content
              : undefined;
        } else {
          const ai = env.AI as {
            run(model: string, input: unknown): Promise<unknown>;
          };
          const abort = new Promise<never>((_, reject) => {
            timed.addEventListener(
              'abort',
              () => reject(new ProviderError('timeout', 504)),
              { once: true },
            );
            if (timed.aborted) reject(new ProviderError('timeout', 504));
          });
          const raw = await Promise.race([
            ai.run(WORKERS_MODEL, {
              messages,
              max_tokens: MAX_OUTPUT,
              stream: false,
            }),
            abort,
          ]);
          output = object(raw) ? raw.response : undefined;
        }
        if (
          typeof output !== 'string' ||
          output.trim().length === 0 ||
          encoder.encode(output).length > 16384 ||
          hasTextSecret(output) ||
          /\bgsk_[A-Za-z0-9]{20,}/u.test(output) ||
          /<(?:think|analysis)>/iu.test(output)
        )
          throw new ProviderError('invalid_output', 422);
        return {
          reply: output,
          model: {
            provider: route.provider,
            name: route.provider === 'groq' ? GROQ_MODEL : WORKERS_MODEL,
          },
        };
      } catch (error) {
        if (error instanceof ProviderError || error instanceof QuotaError)
          throw error;
        throw new ProviderError(
          timed.aborted ? 'timeout' : 'unavailable',
          timed.aborted ? 504 : 503,
        );
      } finally {
        await release?.refundBeforeDispatch();
        await globalRelease?.refundBeforeDispatch();
        await release?.();
        await globalRelease?.();
      }
    },
  };
}
