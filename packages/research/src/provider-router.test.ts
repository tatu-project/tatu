import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  BriefingModelCapability,
  BriefingModelRequest,
  BriefingResult,
  ProviderFailureKind,
  ProviderRouteCandidate,
} from '@tatu/shared';
import { InMemoryProviderStateStore } from './provider-state.js';
import { QuotaProviderRouter } from './provider-router.js';

const result: BriefingResult = {
  topic: 'AI',
  stories: [],
  facts: [],
  inference: [],
};

const request = (
  requiredCapabilities: readonly BriefingModelCapability[],
): BriefingModelRequest => ({ requiredCapabilities });

const candidate = (
  providerId: string,
  modelId: string,
  capabilities: readonly BriefingModelCapability[],
  onSynthesize: () => void = () => undefined,
): ProviderRouteCandidate => ({
  providerId,
  model: {
    metadata: { id: modelId, capabilities },
    async synthesize() {
      onSynthesize();
      return result;
    },
  },
});

const healthy = (
  store: InMemoryProviderStateStore,
  providerId: string,
  quota: number | null = null,
  rateLimit: number | null = null,
) =>
  store.recordSuccess({
    kind: 'success',
    providerId,
    observedAt: '2026-09-15T12:00:00.000Z',
    quota: { remaining: quota, resetAt: null },
    rateLimit: { remaining: rateLimit, resetAt: null },
  });

test('skips candidates whose model metadata misses a required capability', () => {
  const router = new QuotaProviderRouter();
  const store = new InMemoryProviderStateStore();
  healthy(store, 'compatible');
  healthy(store, 'incompatible');
  const incompatible = candidate('incompatible', 'small', [
    'briefing-synthesis',
  ]);
  const compatible = candidate('compatible', 'complete', [
    'briefing-synthesis',
    'structured-json',
  ]);

  assert.equal(
    router.select(
      request(['briefing-synthesis', 'structured-json']),
      [incompatible, compatible],
      store,
    ),
    compatible,
  );
});

test('requires the provider status to be exactly healthy', () => {
  const statuses: readonly [ProviderFailureKind, string][] = [
    ['unavailable', 'unavailable'],
    ['rate_limited', 'rate-limited'],
    ['quota_exhausted', 'quota-exhausted'],
  ];

  for (const [failure, expectedStatus] of statuses) {
    const router = new QuotaProviderRouter();
    const store = new InMemoryProviderStateStore();
    store.recordFailure({
      kind: 'failure',
      providerId: 'provider',
      observedAt: '2026-09-15T12:00:00.000Z',
      failure,
    });
    assert.equal(store.get('provider').status, expectedStatus);
    assert.equal(
      router.select(
        request(['briefing-synthesis']),
        [candidate('provider', 'model', ['briefing-synthesis'])],
        store,
      ),
      undefined,
    );
  }

  const unknownStore = new InMemoryProviderStateStore();
  assert.equal(
    new QuotaProviderRouter().select(
      request(['briefing-synthesis']),
      [candidate('unknown', 'model', ['briefing-synthesis'])],
      unknownStore,
    ),
    undefined,
  );
});

test('rejects zero quota or rate-limit remaining while allowing null limits', () => {
  for (const [quota, rateLimit] of [
    [0, null],
    [null, 0],
  ] as const) {
    const store = new InMemoryProviderStateStore();
    healthy(store, 'provider', quota, rateLimit);
    assert.equal(
      new QuotaProviderRouter().select(
        request(['briefing-synthesis']),
        [candidate('provider', 'model', ['briefing-synthesis'])],
        store,
      ),
      undefined,
    );
  }

  const store = new InMemoryProviderStateStore();
  healthy(store, 'provider');
  const eligible = candidate('provider', 'model', ['briefing-synthesis']);
  assert.equal(
    new QuotaProviderRouter().select(
      request(['briefing-synthesis']),
      [eligible],
      store,
    ),
    eligible,
  );
});

test('returns the first eligible candidate in deterministic order', () => {
  const store = new InMemoryProviderStateStore();
  healthy(store, 'first');
  healthy(store, 'second');
  const first = candidate('first', 'first-model', ['briefing-synthesis']);
  const second = candidate('second', 'second-model', ['briefing-synthesis']);

  assert.equal(
    new QuotaProviderRouter().select(
      request(['briefing-synthesis']),
      [first, second],
      store,
    ),
    first,
  );
});

test('skips credential-shaped model IDs even for healthy providers', () => {
  const store = new InMemoryProviderStateStore();
  healthy(store, 'unsafe-provider');
  healthy(store, 'safe-provider');
  const unsafe = candidate('unsafe-provider', 'api_key=unsafe-model-secret', [
    'briefing-synthesis',
  ]);
  const safe = candidate('safe-provider', 'safe-model', ['briefing-synthesis']);
  const candidates = Object.freeze([unsafe, safe]);
  const beforeUnsafe = {
    id: unsafe.model.metadata.id,
    capabilities: [...unsafe.model.metadata.capabilities],
  };

  assert.equal(
    new QuotaProviderRouter().select(
      request(['briefing-synthesis']),
      candidates,
      store,
    ),
    safe,
  );
  assert.deepEqual(unsafe.model.metadata, beforeUnsafe);
  assert.deepEqual(candidates, [unsafe, safe]);
});

test('returns no route when no candidate satisfies both decisions', () => {
  const store = new InMemoryProviderStateStore();
  healthy(store, 'missing-capability');
  store.recordFailure({
    kind: 'failure',
    providerId: 'unavailable',
    observedAt: '2026-09-15T12:00:00.000Z',
    failure: 'unavailable',
  });
  const candidates = [
    candidate('missing-capability', 'model-a', ['briefing-synthesis']),
    candidate('unavailable', 'model-b', [
      'briefing-synthesis',
      'structured-json',
    ]),
  ];

  assert.equal(
    new QuotaProviderRouter().select(
      request(['briefing-synthesis', 'structured-json']),
      candidates,
      store,
    ),
    undefined,
  );
});

test('does not mutate candidates or state and never invokes synthesis', () => {
  const store = new InMemoryProviderStateStore();
  healthy(store, 'provider');
  let invocations = 0;
  const capabilities = Object.freeze([
    'briefing-synthesis',
    'structured-json',
  ] as const);
  const first = candidate('provider', 'model', capabilities, () => {
    invocations += 1;
  });
  const candidates = Object.freeze([first]);
  const before = store.get('provider');

  assert.equal(
    new QuotaProviderRouter().select(
      request(['briefing-synthesis']),
      candidates,
      store,
    ),
    first,
  );
  assert.equal(invocations, 0);
  assert.deepEqual(candidates, [first]);
  assert.deepEqual(first.model.metadata.capabilities, capabilities);
  assert.deepEqual(store.get('provider'), before);
});

test('uses provider identity independently when the same model is bound twice', () => {
  const store = new InMemoryProviderStateStore();
  store.recordFailure({
    kind: 'failure',
    providerId: 'blocked-provider',
    observedAt: '2026-09-15T12:00:00.000Z',
    failure: 'quota_exhausted',
  });
  healthy(store, 'available-provider');
  const model = candidate('model-provider-placeholder', 'shared-model', [
    'briefing-synthesis',
  ]).model;
  const blocked = { providerId: 'blocked-provider', model };
  const available = { providerId: 'available-provider', model };

  assert.equal(
    new QuotaProviderRouter().select(
      request(['briefing-synthesis']),
      [blocked, available],
      store,
    ),
    available,
  );
});
