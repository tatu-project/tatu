/** Authentication mechanisms supported by the bounded BYOK foundation. */
export type ByokAuthKind = 'api-key';

/** User input accepted when creating a provider-owned connection. */
export interface ByokConnectionInput {
  readonly ownerId: string;
  readonly providerId: string;
  readonly authKind: ByokAuthKind;
  readonly secret: string;
}

/** Metadata that is safe to return to callers; it contains no secret material. */
export interface ByokConnectionMetadata {
  readonly id: string;
  readonly ownerId: string;
  readonly providerId: string;
  readonly authKind: ByokAuthKind;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * The serialized encrypted payload held by a secret-record backing store.
 * Values are encoded for storage and never contain the plaintext secret.
 */
export interface EncryptedSecretEnvelope {
  /** Algorithm identifier is open for record validation and future rotation. */
  readonly algorithm: string;
  readonly iv: string;
  readonly ciphertext: string;
  readonly authTag: string;
}

/** Metadata plus an encrypted envelope, suitable for replaceable storage. */
export interface EncryptedSecretRecord {
  readonly connectionId: string;
  readonly ownerId: string;
  readonly providerId: string;
  readonly authKind: ByokAuthKind;
  readonly envelope: EncryptedSecretEnvelope;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Replaceable port for records whose payload is already encrypted. A backing
 * adapter must never need to receive or return a plaintext secret.
 */
export interface EncryptedSecretRecordStore {
  get(connectionId: string): EncryptedSecretRecord | undefined;
  put(record: EncryptedSecretRecord): void;
  list(ownerId: string): readonly EncryptedSecretRecord[];
  delete(connectionId: string): boolean;
}

/** Process-local BYOK connection port. */
export interface ByokConnectionManager {
  connect(input: ByokConnectionInput): ByokConnectionMetadata;
  reveal(connectionId: string, ownerId: string): string;
  list(ownerId: string): readonly ByokConnectionMetadata[];
  disconnect(connectionId: string, ownerId: string): boolean;
}
