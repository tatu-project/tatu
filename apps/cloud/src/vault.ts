export interface SecretEnvelope {
  version: 1;
  keyId: string;
  nonce: string;
  ciphertext: string;
}
export interface VaultKeyring {
  current: { id: string; key: unknown };
  previous?: { id: string; key: unknown };
}
export async function openFromKeyring(
  envelope: SecretEnvelope,
  ring: VaultKeyring,
  owner: string,
  provider: string,
): Promise<{ secret: string; needsReseal: boolean }> {
  if (ring.previous?.id === ring.current.id)
    throw new Error('vault_unavailable');
  const selected =
    envelope.keyId === ring.current.id
      ? ring.current
      : envelope.keyId === ring.previous?.id
        ? ring.previous
        : undefined;
  if (!selected) throw new Error('vault_unavailable');
  return {
    secret: await openSecret(
      envelope,
      selected.key,
      selected.id,
      owner,
      provider,
    ),
    needsReseal: selected !== ring.current,
  };
}
const encoder = new TextEncoder();
const base64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const decode = (value: string) =>
  Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
async function key(secret: unknown): Promise<CryptoKey> {
  if (typeof secret !== 'string' || !/^[A-Za-z0-9+/]{43}=$/u.test(secret))
    throw new Error('vault_unavailable');
  const bytes = decode(secret);
  if (bytes.length !== 32) throw new Error('vault_unavailable');
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
}
const aad = (owner: string, provider: string, keyId: string) =>
  encoder.encode(JSON.stringify(['tatu-secret', 1, owner, provider, keyId]));
export async function sealSecret(
  secret: string,
  keyMaterial: unknown,
  keyId: string,
  owner: string,
  provider: string,
): Promise<SecretEnvelope> {
  if (!/^[a-zA-Z0-9_-]{1,64}$/u.test(keyId))
    throw new Error('vault_unavailable');
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: nonce,
      additionalData: aad(owner, provider, keyId),
      tagLength: 128,
    },
    await key(keyMaterial),
    encoder.encode(secret),
  );
  return {
    version: 1,
    keyId,
    nonce: base64(nonce),
    ciphertext: base64(new Uint8Array(encrypted)),
  };
}
export async function openSecret(
  envelope: SecretEnvelope,
  keyMaterial: unknown,
  keyId: string,
  owner: string,
  provider: string,
): Promise<string> {
  try {
    if (
      envelope.version !== 1 ||
      envelope.keyId !== keyId ||
      decode(envelope.nonce).length !== 12 ||
      envelope.ciphertext.length > 2048
    )
      throw new Error();
    const value = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: decode(envelope.nonce),
        additionalData: aad(owner, provider, keyId),
        tagLength: 128,
      },
      await key(keyMaterial),
      decode(envelope.ciphertext),
    );
    return new TextDecoder('utf-8', { fatal: true }).decode(value);
  } catch {
    throw new Error('vault_unavailable');
  }
}
