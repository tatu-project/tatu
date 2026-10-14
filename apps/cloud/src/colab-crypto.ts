import { AssistantError } from '@tatu/shared';
import type { CloudEnv } from './types.js';

const encoder = new TextEncoder();
export const COLAB_MODEL = 'Qwen/Qwen3-8B';
export const COLAB_REVISION = 'b968826d9c46dd6066d109eabc6255188de91218';
export const COLAB_INPUT_TOKENS = 1024;
export const COLAB_OUTPUT_TOKENS = 256;
export const base64 = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes));
export const hash = async (value: string | Uint8Array<ArrayBuffer>) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        typeof value === 'string' ? encoder.encode(value) : value,
      ),
    ),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('');
export const credential = () =>
  'colab_' +
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
export function colabConfiguration(env: CloudEnv) {
  const token = env.TATU_COLAB_SITES_SERVICE_TOKEN;
  if (
    env.AUTH_MODE !== 'sites' ||
    env.SITES_OWNER_PRIVATE !== '1' ||
    typeof env.SITE_PROJECT_ID !== 'string' ||
    !/^appgprj_[a-zA-Z0-9_]{8,100}$/u.test(env.SITE_PROJECT_ID) ||
    typeof token !== 'string' ||
    token.length < 32 ||
    token.length > 8192 ||
    /\s/u.test(token) ||
    token.startsWith('Bearer ') ||
    [
      env.SYSTEM_RUN_TOKEN,
      env.TATU_ENCRYPTION_KEY,
      env.TATU_PREVIOUS_ENCRYPTION_KEY,
      env.TATU_GROQ_API_KEY,
    ].some((secret) => typeof secret === 'string' && secret === token)
  )
    throw new AssistantError('unavailable');
  let origin: URL;
  try {
    origin = new URL(String(env.SITE_ORIGIN));
  } catch {
    throw new AssistantError('unavailable');
  }
  if (
    origin.protocol !== 'https:' ||
    origin.username ||
    origin.password ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash
  )
    throw new AssistantError('unavailable');
  return {
    origin: origin.origin,
    projectId: env.SITE_PROJECT_ID,
    serviceToken: token,
  };
}
export async function bootstrapEnvelope(
  publicKeyPem: string,
  env: CloudEnv,
  input: {
    pairToken: string;
    pairExpiresAt: string;
    expiresAt: string;
    mode: 'manual' | 'active';
  },
) {
  const configuration = colabConfiguration(env);
  if (
    publicKeyPem.length > 1600 ||
    !/^-----BEGIN PUBLIC KEY-----\s+[A-Za-z0-9+/=\s]+-----END PUBLIC KEY-----\s*$/u.test(
      publicKeyPem,
    )
  )
    throw new AssistantError('invalid_input');
  let publicKey: CryptoKey;
  let spki: Uint8Array<ArrayBuffer>;
  try {
    spki = Uint8Array.from(
      atob(publicKeyPem.replace(/-----[A-Z ]+-----/gu, '').replace(/\s/gu, '')),
      (character) => character.charCodeAt(0),
    );
    publicKey = await crypto.subtle.importKey(
      'spki',
      spki,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['encrypt'],
    );
    const algorithm = publicKey.algorithm as RsaHashedKeyAlgorithm;
    if (algorithm.modulusLength < 2048 || algorithm.modulusLength > 4096)
      throw new Error();
  } catch {
    throw new AssistantError('invalid_input');
  }
  const fingerprint = await hash(spki);
  const key = crypto.getRandomValues(new Uint8Array(32));
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const aad = encoder.encode(
    JSON.stringify([
      'tatu-colab-bootstrap',
      1,
      configuration.projectId,
      configuration.origin,
      fingerprint,
    ]),
  );
  const plaintext = encoder.encode(
    JSON.stringify({
      ...input,
      ...configuration,
      model: COLAB_MODEL,
      revision: COLAB_REVISION,
    }),
  );
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: aad, tagLength: 128 },
    await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['encrypt']),
    plaintext,
  );
  const wrappedKey = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    publicKey,
    key,
  );
  key.fill(0);
  return {
    version: 1,
    algorithm: 'RSA-OAEP-256+A256GCM',
    fingerprint,
    projectId: configuration.projectId,
    origin: configuration.origin,
    wrappedKey: base64(new Uint8Array(wrappedKey)),
    nonce: base64(nonce),
    ciphertext: base64(new Uint8Array(ciphertext)),
  };
}
