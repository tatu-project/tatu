import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  EncryptedSecretRecord,
  EncryptedSecretRecordStore,
} from '@tatu/shared';
import {
  BYOK_MAX_SECRET_BYTES,
  ByokConnectionError,
  ByokConnectionService,
  InMemoryEncryptedSecretRecordStore,
} from './byok-connections.js';

const key = () => Buffer.alloc(32, 7);
const input = (ownerId = 'owner-a', secret = 'super-secret-key') => ({
  ownerId,
  providerId: 'provider-a',
  authKind: 'api-key' as const,
  secret,
});

class ForwardingStore implements EncryptedSecretRecordStore {
  readonly backing = new InMemoryEncryptedSecretRecordStore();
  calls = { get: 0, put: 0, list: 0, delete: 0 };
  tampered: EncryptedSecretRecord | undefined;

  get(connectionId: string) {
    this.calls.get += 1;
    return this.tampered ?? this.backing.get(connectionId);
  }
  put(record: EncryptedSecretRecord) {
    this.calls.put += 1;
    this.backing.put(record);
  }
  list(ownerId: string) {
    this.calls.list += 1;
    return this.backing.list(ownerId);
  }
  delete(connectionId: string) {
    this.calls.delete += 1;
    return this.backing.delete(connectionId);
  }
}

test('round-trips through AES-GCM while the record and metadata contain no plaintext', () => {
  const records = new InMemoryEncryptedSecretRecordStore();
  const service = new ByokConnectionService(key(), records);
  const metadata = service.connect(input());
  const stored = records.get(metadata.id);

  assert.equal(service.reveal(metadata.id, 'owner-a'), 'super-secret-key');
  assert.equal('secret' in metadata, false);
  assert.ok(stored);
  assert.equal('secret' in stored, false);
  assert.notEqual(stored.envelope.ciphertext, 'super-secret-key');
  assert.equal(stored.envelope.ciphertext.includes('super-secret-key'), false);
});

test('listing is metadata-only and strictly scoped to the owner', () => {
  const service = new ByokConnectionService(key());
  const first = service.connect(input('owner-a', 'a-secret'));
  service.connect(input('owner-b', 'b-secret'));

  assert.deepEqual(service.list('owner-a'), [first]);
  assert.deepEqual(
    service.list('owner-b').map(({ ownerId }) => ownerId),
    ['owner-b'],
  );
  assert.equal('secret' in service.list('owner-a')[0], false);
  assert.throws(
    () => service.reveal(first.id, 'owner-b'),
    (error: unknown) =>
      error instanceof ByokConnectionError && error.code === 'owner_scope',
  );
});

test('owner-scoped disconnect removes a connection and does not expose another owner', () => {
  const service = new ByokConnectionService(key());
  const metadata = service.connect(input());

  assert.throws(
    () => service.disconnect(metadata.id, 'owner-b'),
    (error: unknown) =>
      error instanceof ByokConnectionError && error.code === 'owner_scope',
  );
  assert.equal(service.disconnect(metadata.id, 'owner-a'), true);
  assert.equal(service.disconnect(metadata.id, 'owner-a'), false);
  assert.throws(
    () => service.reveal(metadata.id, 'owner-a'),
    (error: unknown) =>
      error instanceof ByokConnectionError &&
      error.code === 'connection_not_found',
  );
});

test('rejects invalid keys, scopes, auth kinds, and secret bounds', () => {
  assert.throws(
    () => new ByokConnectionService(Buffer.alloc(31)),
    (error: unknown) =>
      error instanceof ByokConnectionError &&
      error.code === 'invalid_master_key',
  );
  const service = new ByokConnectionService(key());
  assert.throws(() => service.connect(input('')), ByokConnectionError);
  assert.throws(
    () => service.connect({ ...input(), authKind: 'oauth' as never }),
    (error: unknown) =>
      error instanceof ByokConnectionError &&
      error.code === 'unsupported_auth_kind',
  );
  assert.throws(
    () => service.connect(input('owner-a', '')),
    (error: unknown) =>
      error instanceof ByokConnectionError && error.code === 'empty_secret',
  );
  assert.throws(
    () =>
      service.connect(input('owner-a', 'x'.repeat(BYOK_MAX_SECRET_BYTES + 1))),
    (error: unknown) =>
      error instanceof ByokConnectionError && error.code === 'secret_too_large',
  );
});

test('rejects tampered ciphertext, altered AAD, wrong keys, and unsupported algorithms', () => {
  const records = new ForwardingStore();
  const service = new ByokConnectionService(key(), records);
  const metadata = service.connect(input());
  const original = records.backing.get(metadata.id);
  assert.ok(original);

  records.tampered = {
    ...original,
    envelope: {
      ...original.envelope,
      ciphertext: `${original.envelope.ciphertext.slice(0, -1)}${
        original.envelope.ciphertext.endsWith('A') ? 'B' : 'A'
      }`,
    },
  };
  assert.throws(
    () => service.reveal(metadata.id, 'owner-a'),
    (error: unknown) =>
      error instanceof ByokConnectionError && error.code === 'malformed_record',
  );

  records.tampered = {
    ...original,
    providerId: 'provider-b',
  };
  assert.throws(
    () => service.reveal(metadata.id, 'owner-a'),
    (error: unknown) =>
      error instanceof ByokConnectionError && error.code === 'malformed_record',
  );

  records.tampered = {
    ...original,
    envelope: { ...original.envelope, algorithm: 'unsupported' as never },
  };
  assert.throws(
    () => service.reveal(metadata.id, 'owner-a'),
    (error: unknown) =>
      error instanceof ByokConnectionError &&
      error.code === 'unsupported_algorithm',
  );

  records.tampered = undefined;
  const wrongKey = new ByokConnectionService(Buffer.alloc(32, 8), records);
  assert.throws(
    () => wrongKey.reveal(metadata.id, 'owner-a'),
    (error: unknown) =>
      error instanceof ByokConnectionError && error.code === 'malformed_record',
  );
});

test('uses the replaceable encrypted-record backing port without passing plaintext to it', () => {
  const records = new ForwardingStore();
  const service = new ByokConnectionService(key(), records);
  const metadata = service.connect(input());
  assert.equal(service.reveal(metadata.id, 'owner-a'), 'super-secret-key');
  assert.deepEqual(service.list('owner-a'), [metadata]);
  assert.equal(service.disconnect(metadata.id, 'owner-a'), true);
  assert.deepEqual(records.calls, { get: 2, put: 1, list: 1, delete: 1 });
});
