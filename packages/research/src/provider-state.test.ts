import assert from 'node:assert/strict';
import test from 'node:test';
import {
  InMemoryProviderStateStore,
  ProviderStateError,
} from './provider-state.js';

const observedAt = '2026-09-15T12:00:00.000Z';
const later = '2026-09-15T12:01:00.000Z';

test('starts each provider as unknown without sharing state', () => {
  const store = new InMemoryProviderStateStore();
  assert.deepEqual(store.get('ollama'), {
    providerId: 'ollama',
    status: 'unknown',
    lastObservedAt: null,
    lastLatencyMs: null,
    consecutiveFailures: 0,
    lastFailure: null,
    lastObservation: null,
    quota: { remaining: null, resetAt: null },
    rateLimit: { remaining: null, resetAt: null },
  });
  assert.equal(store.get('cloud').status, 'unknown');
  assert.equal(store.get('ollama').consecutiveFailures, 0);
});

test('records a successful observation with quota and rate-limit data', () => {
  const store = new InMemoryProviderStateStore();
  const state = store.recordSuccess({
    kind: 'success',
    providerId: 'ollama',
    observedAt,
    latencyMs: 42,
    quota: { remaining: 100, resetAt: later },
    rateLimit: { remaining: 9, resetAt: later },
    observation: 'local model responded',
  });
  assert.deepEqual(state, {
    providerId: 'ollama',
    status: 'healthy',
    lastObservedAt: observedAt,
    lastLatencyMs: 42,
    consecutiveFailures: 0,
    lastFailure: null,
    lastObservation: 'local model responded',
    quota: { remaining: 100, resetAt: later },
    rateLimit: { remaining: 9, resetAt: later },
  });
});

test('maps every failure classification and increments consecutive failures', () => {
  const expected = [
    ['unavailable', 'unavailable'],
    ['timeout', 'unavailable'],
    ['rate_limited', 'rate-limited'],
    ['quota_exhausted', 'quota-exhausted'],
    ['auth', 'unavailable'],
    ['invalid_request', 'unavailable'],
  ] as const;
  for (const [failure, status] of expected) {
    const store = new InMemoryProviderStateStore();
    const state = store.recordFailure({
      kind: 'failure',
      providerId: 'provider',
      observedAt,
      failure,
      observation: failure,
    });
    assert.equal(state.status, status);
    assert.equal(state.lastFailure, failure);
    assert.equal(state.consecutiveFailures, 1);
  }
  const store = new InMemoryProviderStateStore();
  store.recordFailure({
    kind: 'failure',
    providerId: 'provider',
    observedAt,
    failure: 'timeout',
  });
  assert.equal(
    store.recordFailure({
      kind: 'failure',
      providerId: 'provider',
      observedAt: later,
      failure: 'unavailable',
    }).consecutiveFailures,
    2,
  );
});

test('success restores healthy state and resets failure history while preserving limits', () => {
  const store = new InMemoryProviderStateStore();
  store.recordFailure({
    kind: 'failure',
    providerId: 'provider',
    observedAt,
    failure: 'rate_limited',
    rateLimit: { remaining: 0, resetAt: later },
  });
  const state = store.recordSuccess({
    kind: 'success',
    providerId: 'provider',
    observedAt: later,
    latencyMs: 7,
  });
  assert.equal(state.status, 'healthy');
  assert.equal(state.consecutiveFailures, 0);
  assert.equal(state.lastFailure, null);
  assert.deepEqual(state.rateLimit, { remaining: 0, resetAt: later });
});

test('rejects invalid provider observations before changing state', () => {
  const store = new InMemoryProviderStateStore();
  const invalid = [
    [{ providerId: '', observedAt }, 'invalid_provider_id'],
    [{ providerId: 1, observedAt }, 'invalid_provider_id'],
    [{ providerId: null, observedAt }, 'invalid_provider_id'],
    [{ providerId: 'provider', observedAt: 'not-a-date' }, 'invalid_timestamp'],
    [
      { providerId: 'provider', observedAt: '2026-02-30T12:00:00.000Z' },
      'invalid_timestamp',
    ],
    [{ providerId: 'provider', observedAt, latencyMs: -1 }, 'invalid_latency'],
    [
      {
        providerId: 'provider',
        observedAt,
        quota: { remaining: 1.5, resetAt: null },
      },
      'invalid_remaining',
    ],
    [
      {
        providerId: 'provider',
        observedAt,
        rateLimit: { remaining: 1, resetAt: 'tomorrow' },
      },
      'invalid_timestamp',
    ],
    [{ providerId: 'provider', observedAt, quota: null }, 'invalid_remaining'],
    [{ providerId: 'provider', observedAt, failure: 'bogus' }, 'invalid_kind'],
    [
      { providerId: 'provider', observedAt, observation: 'x'.repeat(1_025) },
      'invalid_observation',
    ],
  ] as const;
  for (const [input, code] of invalid) {
    assert.throws(
      () =>
        store.recordSuccess({
          kind: 'success',
          ...input,
        } as never),
      (error: unknown) =>
        error instanceof ProviderStateError && error.code === code,
    );
  }
  assert.equal(store.get('provider').status, 'unknown');
  assert.throws(() => store.get('bad id'), ProviderStateError);
  assert.throws(
    () =>
      store.recordFailure({
        kind: 'failure',
        providerId: 'provider',
        observedAt,
        failure: 'bogus' as never,
      }),
    (error: unknown) =>
      error instanceof ProviderStateError && error.code === 'invalid_failure',
  );
  assert.throws(
    () =>
      store.recordSuccess({
        kind: 'success',
        providerId: 'provider',
        observedAt,
        quota: { remaining: 1, resetAt: Symbol('invalid') as never },
      }),
    (error: unknown) =>
      error instanceof ProviderStateError && error.code === 'invalid_timestamp',
  );
  assert.throws(
    () =>
      store.recordFailure({
        kind: 'failure',
        providerId: 'provider',
        observedAt,
      } as never),
    (error: unknown) =>
      error instanceof ProviderStateError && error.code === 'invalid_failure',
  );
  assert.throws(
    () =>
      store.recordFailure({
        kind: 'success',
        providerId: 'provider',
        observedAt,
        failure: 'timeout',
      } as never),
    (error: unknown) =>
      error instanceof ProviderStateError && error.code === 'invalid_kind',
  );
  assert.throws(
    () =>
      store.recordSuccess({
        kind: 'failure',
        providerId: 'provider',
        observedAt,
        failure: 'timeout',
      } as never),
    (error: unknown) =>
      error instanceof ProviderStateError && error.code === 'invalid_kind',
  );
});

test('rejects credential-bearing observations without changing success state', () => {
  const store = new InMemoryProviderStateStore();
  store.recordSuccess({
    kind: 'success',
    providerId: 'provider',
    observedAt,
    observation: 'ordinary diagnostic',
  });
  const before = store.get('provider');
  const unsafeObservations = [
    'request failed: api_key=abcdEFGH1234',
    'request failed: Bearer abcdEFGH1234',
    'request failed: eyJhbGciOiJIUzI1NiJ9.payload123.signature123',
    'request failed: https://user:password@example.com/path',
    'request failed: sk_live_12345678',
  ];
  for (const observation of unsafeObservations) {
    assert.throws(
      () =>
        store.recordSuccess({
          kind: 'success',
          providerId: 'provider',
          observedAt: later,
          observation,
        }),
      (error: unknown) =>
        error instanceof ProviderStateError &&
        error.code === 'invalid_observation',
    );
    assert.deepEqual(store.get('provider'), before);
  }
});

test('rejects credential-bearing observations without changing failure state', () => {
  const store = new InMemoryProviderStateStore();
  store.recordFailure({
    kind: 'failure',
    providerId: 'provider',
    observedAt,
    failure: 'timeout',
    observation: 'ordinary diagnostic',
  });
  const before = store.get('provider');
  const unsafeObservations = [
    'request failed: token=abcdEFGH1234',
    'request failed: Basic abcdEFGH1234',
    'request failed: eyJhbGciOiJIUzI1NiJ9.payload123.signature123',
    'request failed: http://user:password@example.com/path',
    'request failed: ghp_1234567890',
  ];
  for (const observation of unsafeObservations) {
    assert.throws(
      () =>
        store.recordFailure({
          kind: 'failure',
          providerId: 'provider',
          observedAt: later,
          failure: 'unavailable',
          observation,
        }),
      (error: unknown) =>
        error instanceof ProviderStateError &&
        error.code === 'invalid_observation',
    );
    assert.deepEqual(store.get('provider'), before);
  }
});

test('accepts ordinary provider observations', () => {
  const store = new InMemoryProviderStateStore();
  const success = store.recordSuccess({
    kind: 'success',
    providerId: 'provider',
    observedAt,
    observation: 'response completed in 42ms',
  });
  assert.equal(success.lastObservation, 'response completed in 42ms');
  const failure = store.recordFailure({
    kind: 'failure',
    providerId: 'provider',
    observedAt: later,
    failure: 'timeout',
    observation: 'upstream did not respond before deadline',
  });
  assert.equal(
    failure.lastObservation,
    'upstream did not respond before deadline',
  );
});

test('returns frozen defensive snapshots', () => {
  const store = new InMemoryProviderStateStore();
  const first = store.recordSuccess({
    kind: 'success',
    providerId: 'provider',
    observedAt,
    quota: { remaining: 3, resetAt: later },
  });
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.quota), true);
  assert.equal(Object.isFrozen(first.rateLimit), true);
  assert.throws(() => {
    (first.quota as { remaining: number }).remaining = 0;
  }, TypeError);
  const second = store.get('provider');
  assert.notEqual(first, second);
  assert.notEqual(first.quota, second.quota);
  assert.equal(second.quota.remaining, 3);
});
