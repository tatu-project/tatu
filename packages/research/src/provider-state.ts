import type {
  ProviderFailureKind,
  ProviderFailureObservation,
  ProviderLimitSnapshot,
  ProviderStateSnapshot,
  ProviderStateStore,
  ProviderSuccessObservation,
} from '@tatu/shared';
import { hasTextSecret } from '@tatu/shared';

const providerIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const isoTimestampPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const maxObservationLength = 1_024;

export class ProviderStateError extends Error {
  constructor(
    readonly code:
      | 'invalid_provider_id'
      | 'invalid_timestamp'
      | 'invalid_latency'
      | 'invalid_remaining'
      | 'invalid_failure'
      | 'invalid_kind'
      | 'invalid_observation',
  ) {
    super(code);
    this.name = 'ProviderStateError';
  }
}

const emptyLimit = (): ProviderLimitSnapshot => ({
  remaining: null,
  resetAt: null,
});

const emptyState = (providerId: string): ProviderStateSnapshot => ({
  providerId,
  status: 'unknown',
  lastObservedAt: null,
  lastLatencyMs: null,
  consecutiveFailures: 0,
  lastFailure: null,
  lastObservation: null,
  quota: emptyLimit(),
  rateLimit: emptyLimit(),
});

const isTimestamp = (value: unknown): value is string => {
  if (
    typeof value !== 'string' ||
    !isoTimestampPattern.test(value) ||
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

function validateProviderId(providerId: unknown): asserts providerId is string {
  if (
    typeof providerId !== 'string' ||
    !providerIdPattern.test(providerId) ||
    hasTextSecret(providerId)
  )
    throw new ProviderStateError('invalid_provider_id');
}

const failureKinds = new Set<ProviderFailureKind>([
  'unavailable',
  'timeout',
  'rate_limited',
  'quota_exhausted',
  'auth',
  'invalid_request',
]);
function validateFailure(
  failure: unknown,
): asserts failure is ProviderFailureKind {
  if (
    typeof failure !== 'string' ||
    !failureKinds.has(failure as ProviderFailureKind)
  )
    throw new ProviderStateError('invalid_failure');
}

const validateObservation = (value: string | null | undefined) => {
  if (
    value !== undefined &&
    value !== null &&
    (typeof value !== 'string' || value.length > maxObservationLength)
  )
    throw new ProviderStateError('invalid_observation');
  if (typeof value === 'string' && hasTextSecret(value))
    throw new ProviderStateError('invalid_observation');
};

const validateLimit = (value: ProviderLimitSnapshot | null | undefined) => {
  if (value === undefined) return;
  if (!value || typeof value !== 'object')
    throw new ProviderStateError('invalid_remaining');
  if (
    value.remaining !== null &&
    (!Number.isInteger(value.remaining) || value.remaining < 0)
  )
    throw new ProviderStateError('invalid_remaining');
  if (value.resetAt !== null && !isTimestamp(value.resetAt))
    throw new ProviderStateError('invalid_timestamp');
};

const validateObservationInput = (
  observation: unknown,
  expectedKind:
    ProviderSuccessObservation['kind'] | ProviderFailureObservation['kind'],
) => {
  if (!observation || typeof observation !== 'object')
    throw new ProviderStateError('invalid_observation');
  const value = observation as
    ProviderSuccessObservation | ProviderFailureObservation;
  if (value.kind !== expectedKind) throw new ProviderStateError('invalid_kind');
  validateProviderId(value.providerId);
  if (!isTimestamp(value.observedAt))
    throw new ProviderStateError('invalid_timestamp');
  if (
    value.latencyMs !== undefined &&
    (!Number.isInteger(value.latencyMs) || value.latencyMs < 0)
  )
    throw new ProviderStateError('invalid_latency');
  validateLimit(value.quota);
  validateLimit(value.rateLimit);
  validateObservation(value.observation);
  if (expectedKind === 'failure') {
    if (!('failure' in value)) throw new ProviderStateError('invalid_failure');
    validateFailure(value.failure);
  } else if ('failure' in value) {
    throw new ProviderStateError('invalid_kind');
  }
};

const statusForFailure = (
  failure: ProviderFailureKind,
): ProviderStateSnapshot['status'] => {
  if (failure === 'rate_limited') return 'rate-limited';
  if (failure === 'quota_exhausted') return 'quota-exhausted';
  return 'unavailable';
};

const freezeLimit = (value: ProviderLimitSnapshot): ProviderLimitSnapshot =>
  Object.freeze({ ...value });

const freezeState = (value: ProviderStateSnapshot): ProviderStateSnapshot =>
  Object.freeze({
    ...value,
    quota: freezeLimit(value.quota),
    rateLimit: freezeLimit(value.rateLimit),
  });

const copyState = (value: ProviderStateSnapshot): ProviderStateSnapshot =>
  freezeState({
    ...value,
    quota: { ...value.quota },
    rateLimit: { ...value.rateLimit },
  });

const nextLimit = (
  previous: ProviderLimitSnapshot,
  update: ProviderLimitSnapshot | undefined,
) => (update === undefined ? previous : { ...update });

/**
 * Small process-local provider state store. It records observations only; it
 * does not contact providers, persist state, hold credentials, or select routes.
 */
export class InMemoryProviderStateStore implements ProviderStateStore {
  private readonly states = new Map<string, ProviderStateSnapshot>();

  get(providerId: string): ProviderStateSnapshot {
    validateProviderId(providerId);
    return copyState(this.states.get(providerId) ?? emptyState(providerId));
  }

  recordSuccess(
    observation: ProviderSuccessObservation,
  ): ProviderStateSnapshot {
    validateObservationInput(observation, 'success');
    const previous =
      this.states.get(observation.providerId) ??
      emptyState(observation.providerId);
    const next = freezeState({
      providerId: observation.providerId,
      status: 'healthy',
      lastObservedAt: observation.observedAt,
      lastLatencyMs: observation.latencyMs ?? null,
      consecutiveFailures: 0,
      lastFailure: null,
      lastObservation: observation.observation ?? null,
      quota: nextLimit(previous.quota, observation.quota),
      rateLimit: nextLimit(previous.rateLimit, observation.rateLimit),
    });
    this.states.set(observation.providerId, next);
    return copyState(next);
  }

  recordFailure(
    observation: ProviderFailureObservation,
  ): ProviderStateSnapshot {
    validateObservationInput(observation, 'failure');
    const previous =
      this.states.get(observation.providerId) ??
      emptyState(observation.providerId);
    const next = freezeState({
      providerId: observation.providerId,
      status: statusForFailure(observation.failure),
      lastObservedAt: observation.observedAt,
      lastLatencyMs: observation.latencyMs ?? null,
      consecutiveFailures: previous.consecutiveFailures + 1,
      lastFailure: observation.failure,
      lastObservation: observation.observation ?? null,
      quota: nextLimit(previous.quota, observation.quota),
      rateLimit: nextLimit(previous.rateLimit, observation.rateLimit),
    });
    this.states.set(observation.providerId, next);
    return copyState(next);
  }
}
