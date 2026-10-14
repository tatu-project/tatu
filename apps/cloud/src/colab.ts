import { AssistantError, hasOnlyKeys } from '@tatu/shared';
import { ColabStore } from './colab-store.js';
import {
  bootstrapEnvelope,
  colabConfiguration,
  credential,
} from './colab-crypto.js';
import { body, json } from './workspace.js';
import { permitsCloudMutation } from './auth.js';
import type { CloudEnv } from './types.js';

export function configuredColab(env: CloudEnv): boolean {
  try {
    colabConfiguration(env);
    return true;
  } catch {
    return false;
  }
}
export function denyColabSecrets(value: string, env: CloudEnv) {
  if (
    /\bcolab_[a-f0-9]{64}\b/u.test(value) ||
    [
      env.TATU_COLAB_SITES_SERVICE_TOKEN,
      env.SYSTEM_RUN_TOKEN,
      env.TATU_ENCRYPTION_KEY,
      env.TATU_PREVIOUS_ENCRYPTION_KEY,
    ].some(
      (secret) =>
        typeof secret === 'string' &&
        secret.length >= 32 &&
        value.includes(secret),
    )
  )
    throw new AssistantError('invalid_input');
}
export async function handleColabOwner(
  request: Request,
  env: CloudEnv,
  ownerId: string,
): Promise<Response> {
  if (!env.DB) throw new AssistantError('unavailable');
  const store = new ColabStore(env.DB, ownerId),
    path = new URL(request.url).pathname;
  if (path === '/api/colab/status' && request.method === 'GET')
    return json(await store.status(configuredColab(env)));
  if (path === '/api/colab/connect' && request.method === 'POST') {
    colabConfiguration(env);
    const input = await body(request);
    if (
      !hasOnlyKeys(input, [
        'publicKeyPem',
        'mode',
        'paidUnitsConfirmed',
        'contextConsent',
      ]) ||
      typeof input.publicKeyPem !== 'string' ||
      !['manual', 'active'].includes(String(input.mode)) ||
      typeof input.paidUnitsConfirmed !== 'boolean' ||
      input.contextConsent !== true ||
      (input.mode === 'active' && input.paidUnitsConfirmed !== true)
    )
      throw new AssistantError('invalid_input');
    const pairToken = credential(),
      pairExpiresAt = new Date(Date.now() + 120_000).toISOString(),
      expiresAt = new Date(Date.now() + 1_200_000).toISOString(),
      mode = input.mode as 'manual' | 'active';
    // Validate and encrypt before mutating a previously valid session.
    const envelope = await bootstrapEnvelope(input.publicKeyPem, env, {
      pairToken,
      pairExpiresAt,
      expiresAt,
      mode,
    });
    const metadata = await store.reservePair(mode, pairToken);
    return json({ envelope, ...metadata }, 201);
  }
  if (path === '/api/colab/connect' && request.method === 'DELETE') {
    await store.revoke();
    return json(undefined, 204);
  }
  const job = path.match(/^\/api\/colab\/jobs\/([^/]+)$/u);
  if (job && request.method === 'GET') return json(await store.job(job[1]));
  if (job && request.method === 'DELETE')
    return json(await store.cancel(job[1]));
  throw new AssistantError('not_found');
}
/** Scoped machine lane runs before visitor resolution; it never resolves an owner from input. */
export async function handleColabRuntime(
  request: Request,
  env: CloudEnv,
): Promise<Response> {
  if (!permitsCloudMutation(request, env))
    return json({ error: 'Origem da ação não permitida.' }, 403);
  if (!configuredColab(env) || !env.DB)
    return json(
      { error: 'Conexão pessoal Colab indisponível nesta instalação.' },
      503,
    );
  if (request.method !== 'POST')
    return json({ error: 'Acesso não autorizado.' }, 401);
  const input = await body(request),
    path = new URL(request.url).pathname;
  try {
    if (path === '/api/colab/runtime/pair') {
      if (
        !hasOnlyKeys(input, ['pairToken']) ||
        typeof input.pairToken !== 'string'
      )
        throw new AssistantError('invalid_input');
      return json(await ColabStore.pair(env.DB, input.pairToken));
    }
    const { store, session } = await ColabStore.authenticate(
      env.DB,
      request.headers.get('authorization'),
    );
    if (path === '/api/colab/runtime/claim') {
      if (!hasOnlyKeys(input, [])) throw new AssistantError('invalid_input');
      return json(await store.claim(session.id));
    }
    if (path === '/api/colab/runtime/complete') {
      if (
        hasOnlyKeys(input, ['jobId', 'leaseToken', 'error']) &&
        typeof input.jobId === 'string' &&
        typeof input.leaseToken === 'string' &&
        ['input_too_large', 'model_unavailable', 'generation_failed'].includes(
          String(input.error),
        )
      )
        return json(
          await store.fail(session.id, input.jobId, input.leaseToken),
        );
      if (
        !hasOnlyKeys(input, [
          'jobId',
          'leaseToken',
          'reply',
          'inputTokens',
          'outputTokens',
        ]) ||
        typeof input.jobId !== 'string' ||
        typeof input.leaseToken !== 'string' ||
        typeof input.reply !== 'string' ||
        typeof input.inputTokens !== 'number' ||
        typeof input.outputTokens !== 'number'
      )
        throw new AssistantError('invalid_input');
      denyColabSecrets(input.reply, env);
      return json(
        await store.complete(session.id, {
          jobId: input.jobId,
          leaseToken: input.leaseToken,
          reply: input.reply,
          inputTokens: input.inputTokens,
          outputTokens: input.outputTokens,
        }),
      );
    }
    return json({ error: 'Registro não encontrado.' }, 404);
  } catch (error) {
    if (error instanceof AssistantError && error.code === 'not_found')
      return json({ error: 'Credencial Colab inválida ou expirada.' }, 401);
    throw error;
  }
}
