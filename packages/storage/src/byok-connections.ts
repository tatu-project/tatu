import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
} from 'node:crypto';
import type {
  ByokAuthKind,
  ByokConnectionInput,
  ByokConnectionManager,
  ByokConnectionMetadata,
  EncryptedSecretEnvelope,
  EncryptedSecretRecord,
  EncryptedSecretRecordStore,
} from '@tatu/shared';

const algorithm = 'aes-256-gcm' as const;
const ivBytes = 12;
const authTagBytes = 16;
const maxSecretBytes = 16 * 1024;
const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const timestampPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const base64Pattern =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export const BYOK_MAX_SECRET_BYTES = maxSecretBytes;
export const BYOK_ENCRYPTION_ALGORITHM = algorithm;

export type ByokConnectionErrorCode =
  | 'invalid_master_key'
  | 'invalid_input'
  | 'invalid_owner_scope'
  | 'invalid_connection_id'
  | 'invalid_provider_id'
  | 'unsupported_auth_kind'
  | 'empty_secret'
  | 'secret_too_large'
  | 'connection_not_found'
  | 'owner_scope'
  | 'unsupported_algorithm'
  | 'malformed_record';

/** Stable, non-sensitive failure categories for BYOK boundary validation. */
export class ByokConnectionError extends Error {
  constructor(readonly code: ByokConnectionErrorCode) {
    super(code);
    this.name = 'ByokConnectionError';
  }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object';

const isIdentifier = (value: unknown): value is string =>
  typeof value === 'string' && identifierPattern.test(value);

function validateOwnerId(ownerId: unknown): asserts ownerId is string {
  if (!isIdentifier(ownerId))
    throw new ByokConnectionError('invalid_owner_scope');
}

function validateConnectionId(
  connectionId: unknown,
): asserts connectionId is string {
  if (
    typeof connectionId !== 'string' ||
    connectionId.length !== 36 ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      connectionId,
    )
  )
    throw new ByokConnectionError('invalid_connection_id');
}

function validateProviderId(providerId: unknown): asserts providerId is string {
  if (!isIdentifier(providerId))
    throw new ByokConnectionError('invalid_provider_id');
}

function validateAuthKind(authKind: unknown): asserts authKind is ByokAuthKind {
  if (authKind !== 'api-key')
    throw new ByokConnectionError('unsupported_auth_kind');
}

const isTimestamp = (value: unknown): value is string => {
  if (
    typeof value !== 'string' ||
    !timestampPattern.test(value) ||
    Number.isNaN(Date.parse(value))
  )
    return false;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  return (
    calendar.getUTCFullYear() === year &&
    calendar.getUTCMonth() === month - 1 &&
    calendar.getUTCDate() === day
  );
};

const decodeBase64 = (value: unknown): Buffer | undefined => {
  if (typeof value !== 'string' || !base64Pattern.test(value)) return undefined;
  try {
    const decoded = Buffer.from(value, 'base64');
    return decoded.toString('base64') === value ? decoded : undefined;
  } catch {
    return undefined;
  }
};

const aadFor = (
  connectionId: string,
  ownerId: string,
  providerId: string,
  authKind: ByokAuthKind,
) => Buffer.from(JSON.stringify([connectionId, ownerId, providerId, authKind]));

const copyEnvelope = (
  envelope: EncryptedSecretEnvelope,
): EncryptedSecretEnvelope =>
  Object.freeze({
    algorithm: envelope.algorithm,
    iv: envelope.iv,
    ciphertext: envelope.ciphertext,
    authTag: envelope.authTag,
  });

const copyRecord = (record: EncryptedSecretRecord): EncryptedSecretRecord =>
  Object.freeze({
    connectionId: record.connectionId,
    ownerId: record.ownerId,
    providerId: record.providerId,
    authKind: record.authKind,
    envelope: copyEnvelope(record.envelope),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });

const metadataFrom = (record: EncryptedSecretRecord): ByokConnectionMetadata =>
  Object.freeze({
    id: record.connectionId,
    ownerId: record.ownerId,
    providerId: record.providerId,
    authKind: record.authKind,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });

/** Validate a record before it can be used or returned by a connection port. */
function validateRecord(
  value: unknown,
): asserts value is EncryptedSecretRecord {
  if (!isObject(value)) throw new ByokConnectionError('malformed_record');
  if (
    typeof value.connectionId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      value.connectionId,
    ) ||
    !isIdentifier(value.ownerId) ||
    !isIdentifier(value.providerId) ||
    value.authKind !== 'api-key' ||
    !isTimestamp(value.createdAt) ||
    !isTimestamp(value.updatedAt) ||
    !isObject(value.envelope)
  )
    throw new ByokConnectionError('malformed_record');

  const envelope = value.envelope;
  if (envelope.algorithm !== algorithm) {
    if (typeof envelope.algorithm === 'string')
      throw new ByokConnectionError('unsupported_algorithm');
    throw new ByokConnectionError('malformed_record');
  }
  const iv = decodeBase64(envelope.iv);
  const ciphertext = decodeBase64(envelope.ciphertext);
  const authTag = decodeBase64(envelope.authTag);
  if (
    !iv ||
    iv.length !== ivBytes ||
    !ciphertext ||
    ciphertext.length === 0 ||
    !authTag ||
    authTag.length !== authTagBytes
  )
    throw new ByokConnectionError('malformed_record');
}

const encryptSecret = (
  secret: string,
  key: Buffer,
  connectionId: string,
  ownerId: string,
  providerId: string,
  authKind: ByokAuthKind,
): EncryptedSecretEnvelope => {
  const iv = randomBytes(ivBytes);
  const cipher = createCipheriv(algorithm, key, iv);
  cipher.setAAD(aadFor(connectionId, ownerId, providerId, authKind));
  const ciphertext = Buffer.concat([
    cipher.update(secret, 'utf8'),
    cipher.final(),
  ]);
  return {
    algorithm,
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
  };
};

const decryptSecret = (record: EncryptedSecretRecord, key: Buffer): string => {
  validateRecord(record);
  const iv = decodeBase64(record.envelope.iv);
  const ciphertext = decodeBase64(record.envelope.ciphertext);
  const authTag = decodeBase64(record.envelope.authTag);
  // validateRecord above guarantees these values, while the guards keep this
  // function safe if its implementation is changed independently later.
  if (!iv || !ciphertext || !authTag)
    throw new ByokConnectionError('malformed_record');
  try {
    const decipher = createDecipheriv(algorithm, key, iv);
    decipher.setAAD(
      aadFor(
        record.connectionId,
        record.ownerId,
        record.providerId,
        record.authKind,
      ),
    );
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    if (plaintext.length === 0 || plaintext.length > maxSecretBytes)
      throw new ByokConnectionError(
        plaintext.length === 0 ? 'empty_secret' : 'secret_too_large',
      );
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(plaintext);
    } catch {
      throw new ByokConnectionError('malformed_record');
    }
  } catch (error) {
    if (error instanceof ByokConnectionError) throw error;
    // Authentication failures, wrong keys, altered AAD, and malformed binary
    // payloads all have the same non-sensitive result.
    throw new ByokConnectionError('malformed_record');
  }
};

/**
 * Process-local encrypted-record adapter. It is intentionally not durable and
 * does not provide key management; callers can replace it with their own port.
 */
export class InMemoryEncryptedSecretRecordStore implements EncryptedSecretRecordStore {
  private readonly records = new Map<string, EncryptedSecretRecord>();

  get(connectionId: string): EncryptedSecretRecord | undefined {
    validateConnectionId(connectionId);
    const record = this.records.get(connectionId);
    return record ? copyRecord(record) : undefined;
  }

  put(record: EncryptedSecretRecord): void {
    validateRecord(record);
    if (record.connectionId.length !== 36)
      throw new ByokConnectionError('malformed_record');
    this.records.set(record.connectionId, copyRecord(record));
  }

  list(ownerId: string): readonly EncryptedSecretRecord[] {
    validateOwnerId(ownerId);
    return Object.freeze(
      [...this.records.values()]
        .filter((record) => record.ownerId === ownerId)
        .map(copyRecord),
    );
  }

  delete(connectionId: string): boolean {
    validateConnectionId(connectionId);
    return this.records.delete(connectionId);
  }
}

/** AES-256-GCM BYOK connection service with strict owner scoping. */
export class ByokConnectionService implements ByokConnectionManager {
  private readonly key: Buffer;
  private readonly records: EncryptedSecretRecordStore;

  constructor(
    masterKey: Uint8Array,
    records: EncryptedSecretRecordStore = new InMemoryEncryptedSecretRecordStore(),
  ) {
    if (!(masterKey instanceof Uint8Array) || masterKey.byteLength !== 32)
      throw new ByokConnectionError('invalid_master_key');
    this.key = Buffer.from(masterKey);
    this.records = records;
  }

  connect(input: ByokConnectionInput): ByokConnectionMetadata {
    if (!isObject(input)) throw new ByokConnectionError('invalid_input');
    validateOwnerId(input.ownerId);
    validateProviderId(input.providerId);
    validateAuthKind(input.authKind);
    if (typeof input.secret !== 'string' || input.secret.length === 0)
      throw new ByokConnectionError('empty_secret');
    if (Buffer.byteLength(input.secret, 'utf8') > maxSecretBytes)
      throw new ByokConnectionError('secret_too_large');

    const id = randomUUID();
    const timestamp = new Date().toISOString();
    const record: EncryptedSecretRecord = {
      connectionId: id,
      ownerId: input.ownerId,
      providerId: input.providerId,
      authKind: input.authKind,
      envelope: encryptSecret(
        input.secret,
        this.key,
        id,
        input.ownerId,
        input.providerId,
        input.authKind,
      ),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.records.put(record);
    return metadataFrom(record);
  }

  reveal(connectionId: string, ownerId: string): string {
    validateConnectionId(connectionId);
    validateOwnerId(ownerId);
    const record = this.records.get(connectionId);
    if (!record) throw new ByokConnectionError('connection_not_found');
    if (record.ownerId !== ownerId)
      throw new ByokConnectionError('owner_scope');
    if (record.connectionId !== connectionId)
      throw new ByokConnectionError('malformed_record');
    return decryptSecret(record, this.key);
  }

  list(ownerId: string): readonly ByokConnectionMetadata[] {
    validateOwnerId(ownerId);
    const records = this.records.list(ownerId);
    if (!Array.isArray(records))
      throw new ByokConnectionError('malformed_record');
    return Object.freeze(
      records.flatMap((record) => {
        if (!isObject(record))
          throw new ByokConnectionError('malformed_record');
        // A replaceable adapter must scope list results. Still reject records
        // whose owner field is not even structurally valid rather than
        // silently swallowing a malformed entry.
        if (typeof record.ownerId !== 'string')
          throw new ByokConnectionError('malformed_record');
        if (record.ownerId !== ownerId) return [];
        validateRecord(record);
        return [metadataFrom(record)];
      }),
    );
  }

  disconnect(connectionId: string, ownerId: string): boolean {
    validateConnectionId(connectionId);
    validateOwnerId(ownerId);
    const record = this.records.get(connectionId);
    if (!record) return false;
    if (record.ownerId !== ownerId)
      throw new ByokConnectionError('owner_scope');
    validateRecord(record);
    return this.records.delete(connectionId);
  }
}

// Explicit aliases keep the contract vocabulary discoverable for callers
// without introducing a second implementation or a second storage policy.
export {
  ByokConnectionService as EncryptedByokConnectionStore,
  ByokConnectionService as ByokConnectionStore,
};
