import { hasTextSecret } from './text-policy.js';

export const healthStatus = {
  service: 'tatu',
  stage: 'technical-foundation',
  status: 'healthy',
} as const;

export type HealthStatus = typeof healthStatus;

export function getHealthStatus(): HealthStatus {
  return healthStatus;
}

export type SetupHealthState =
  | 'healthy'
  | 'configured'
  | 'disabled'
  | 'unknown'
  | 'not_implemented'
  | 'unavailable';

export type SetupHealthCheckId =
  'agent' | 'storage' | 'ai-route' | 'research' | 'memory' | 'scheduler';

export interface SetupHealthCheck {
  readonly id: SetupHealthCheckId;
  readonly label: string;
  readonly state: SetupHealthState;
  readonly detail: string;
}

export interface SetupHealthStatus {
  readonly checks: readonly SetupHealthCheck[];
  readonly estimatedCost: { readonly status: 'unknown' };
  readonly nextTask: {
    readonly time: string;
    readonly timezone: string;
  } | null;
}

export interface BriefingDraft {
  cadence: 'daily';
  time: string;
  quantity: number;
  topic: string;
  deliveryRequested: true;
  timezone: string;
}

export interface BriefingTask extends BriefingDraft {
  id: string;
  enabled: true;
  createdAt: string;
}

export interface ExecutionRecord {
  id: string;
  taskId: string;
  occurrenceKey: string;
  scheduledFor: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';
  attempt: number;
  maxAttempts: number;
  availableAt: string;
  leaseExpiresAt: string | null;
  claimedBy: string | null;
  result: string | null;
  failure: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ExecutionEventType =
  | 'queued'
  | 'claimed'
  | 'succeeded'
  | 'timed_out'
  | 'retry_scheduled'
  | 'failed'
  | 'skipped_dst_gap'
  | 'research_failed'
  | 'model_failed'
  | 'fallback_used'
  | 'delivered'
  | 'delivery_failed';

export interface ExecutionEvent {
  id: string;
  type: ExecutionEventType;
  at: string;
  detail: string | null;
}

/** Must be propagated to every future external delivery or provider call. */
export interface ExecutionContext {
  executionId: string;
  idempotencyKey: string;
  topic?: string;
  quantity?: number;
}

export interface CitedStory {
  title: string;
  url: string;
  publishedAt: string;
  source: string;
}

export type BriefingFallbackReason =
  'model_unavailable' | 'model_invalid_output' | 'model_timeout';

/** Sanitized metadata for returning to the source-backed RSS route. */
export interface BriefingFallback {
  readonly from: 'local-ollama';
  readonly reason: BriefingFallbackReason;
}

/** Bounded provider identities exposed by an execution's final result. */
export type BriefingObservabilityProvider = 'public-rss' | 'local-ollama';

/** Bounded tools that may participate in the first delivery slice. */
export type BriefingObservabilityTool =
  'public-rss' | 'local-ollama' | 'file-outbox';

/** Pricing is intentionally not guessed until a real pricing source exists. */
export interface BriefingEstimatedCost {
  readonly status: 'unknown';
}

/** Sanitized, provider-independent execution measurements. */
export interface BriefingObservability {
  readonly provider: BriefingObservabilityProvider;
  readonly model: string | null;
  readonly tools: readonly BriefingObservabilityTool[];
  readonly latencyMs: number;
  readonly estimatedCost: BriefingEstimatedCost;
}

export interface BriefingResult {
  topic: string;
  stories: CitedStory[];
  /** Every claim is source-backed; model inference is intentionally empty in this route. */
  facts: CitedStory[];
  inference: string[];
  route?: 'deterministic-rss' | 'local-ollama';
  model?: { id: string; route: 'local-ollama' };
  fallback?: BriefingFallback;
  delivery?: import('./delivery.js').BriefingDeliveryReceipt;
  observability?: BriefingObservability;
}

export interface ResearchFeed {
  url: string;
}
export interface BriefingSynthesizer {
  create(
    topic: string,
    quantity: number,
    feeds: ResearchFeed[],
    signal: AbortSignal,
  ): Promise<BriefingResult>;
}

/** Suitability facts enforced by the briefing model adapter itself. */
export type BriefingModelCapability =
  'briefing-synthesis' | 'structured-json' | 'citation-preservation';

/** Stable model identity and supported behavior, independent of provider state. */
export interface BriefingModelMetadata {
  readonly id: string;
  readonly capabilities: readonly BriefingModelCapability[];
}

/** Current availability facts about a provider, independent of model suitability. */
export type ProviderStatus =
  'unknown' | 'healthy' | 'unavailable' | 'rate-limited' | 'quota-exhausted';

/** Failure categories observed while contacting a provider. */
export type ProviderFailureKind =
  | 'unavailable'
  | 'timeout'
  | 'rate_limited'
  | 'quota_exhausted'
  | 'auth'
  | 'invalid_request';

export interface ProviderLimitSnapshot {
  readonly remaining: number | null;
  readonly resetAt: string | null;
}

/** Immutable provider availability and usage snapshot. No credentials are represented. */
export interface ProviderStateSnapshot {
  readonly providerId: string;
  readonly status: ProviderStatus;
  readonly lastObservedAt: string | null;
  readonly lastLatencyMs: number | null;
  readonly consecutiveFailures: number;
  readonly lastFailure: ProviderFailureKind | null;
  readonly lastObservation: string | null;
  readonly quota: ProviderLimitSnapshot;
  readonly rateLimit: ProviderLimitSnapshot;
}

export interface ProviderObservation {
  readonly providerId: string;
  readonly observedAt: string;
  readonly latencyMs?: number;
  readonly quota?: ProviderLimitSnapshot;
  readonly rateLimit?: ProviderLimitSnapshot;
  /** Optional sanitized diagnostic only; never include credentials or raw payloads. */
  readonly observation?: string | null;
}

export interface ProviderSuccessObservation extends ProviderObservation {
  readonly kind: 'success';
}

export interface ProviderFailureObservation extends ProviderObservation {
  readonly kind: 'failure';
  readonly failure: ProviderFailureKind;
}

/** Process-local state port; persistence and provider calls remain outside this contract. */
export interface ProviderStateStore {
  get(providerId: string): ProviderStateSnapshot;
  recordSuccess(observation: ProviderSuccessObservation): ProviderStateSnapshot;
  recordFailure(observation: ProviderFailureObservation): ProviderStateSnapshot;
}

export interface LocalBriefingModel {
  readonly metadata: BriefingModelMetadata;
  synthesize(
    input: BriefingResult,
    signal: AbortSignal,
  ): Promise<BriefingResult>;
}

/** Suitability requirements for selecting a local briefing model. */
export interface BriefingModelRequest {
  readonly requiredCapabilities: readonly BriefingModelCapability[];
}

/** Selects a model by suitability only; provider availability is separate state. */
export interface ModelRouter {
  select(
    request: BriefingModelRequest,
    candidates: readonly LocalBriefingModel[],
  ): LocalBriefingModel | undefined;
}

/** A model candidate bound to the provider that can execute it. */
export interface ProviderRouteCandidate {
  readonly providerId: string;
  readonly model: LocalBriefingModel;
}

/** Selects the first suitable model route whose provider is currently eligible. */
export interface QuotaProviderRouter {
  select(
    request: BriefingModelRequest,
    candidates: readonly ProviderRouteCandidate[],
    stateStore: ProviderStateStore,
  ): ProviderRouteCandidate | undefined;
}

export type { ExecutionStore, TaskStore, TatuStore } from './persistence.js';
export type {
  ByokAuthKind,
  ByokConnectionInput,
  ByokConnectionMetadata,
  ByokConnectionManager,
  EncryptedSecretEnvelope,
  EncryptedSecretRecord,
  EncryptedSecretRecordStore,
} from './byok.js';
export type { BriefingDelivery, BriefingDeliveryReceipt } from './delivery.js';
export { hasSensitiveUrlQuery } from './url-policy.js';
export { hasTextSecret, redactTextSecrets } from './text-policy.js';

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR');

export function parseBriefing(
  message: string,
  timezone: string,
): { ok: true; draft: BriefingDraft } | { ok: false; clarification: string } {
  const normalized = normalize(message);
  if (!Intl.supportedValuesOf('timeZone').includes(timezone)) {
    return {
      ok: false,
      clarification:
        'Informe um fuso horário IANA válido, como America/Sao_Paulo.',
    };
  }
  const match = normalized.match(
    /todos os dias\s+as\s+(\d{1,2})(?::|h)(\d{2})?[,.]?\s*encontre as\s+(\d+|tres)\s+noticias mais importantes sobre\s+(.+?)\s+e me envie/,
  );
  if (!match) {
    return {
      ok: false,
      clarification:
        'Esclareça recorrência diária, horário, quantidade, tema e intenção de envio.',
    };
  }
  const hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const quantity = match[3] === 'tres' ? 3 : Number(match[3]);
  const normalizedTopic = match[4].replace(/[.!?]+$/, '').trim();
  if (hasTextSecret(normalizedTopic)) {
    return {
      ok: false,
      clarification:
        'O tema parece conter uma credencial; informe apenas o tema.',
    };
  }
  const topic =
    normalizedTopic === 'inteligencia artificial'
      ? 'inteligência artificial'
      : normalizedTopic;
  if (hour > 23 || minute > 59 || quantity < 1 || !topic) {
    return {
      ok: false,
      clarification:
        'Informe horário, quantidade e tema válidos para a tarefa.',
    };
  }
  return {
    ok: true,
    draft: {
      cadence: 'daily',
      time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      quantity,
      topic,
      deliveryRequested: true,
      timezone,
    },
  };
}
