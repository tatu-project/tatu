import type {
  BriefingModelRequest,
  ProviderRouteCandidate,
  ProviderStateSnapshot,
  ProviderStateStore,
  QuotaProviderRouter as QuotaProviderRouterContract,
} from '@tatu/shared';
import { hasTextSecret } from '@tatu/shared';

const hasRequiredCapabilities = (
  request: BriefingModelRequest,
  candidate: ProviderRouteCandidate,
) =>
  request.requiredCapabilities.every((capability) =>
    candidate.model.metadata.capabilities.includes(capability),
  );

const isEligible = (state: ProviderStateSnapshot) =>
  state.status === 'healthy' &&
  state.quota.remaining !== 0 &&
  state.rateLimit.remaining !== 0;

/** Selects the first compatible model route with an eligible provider state. */
export class QuotaProviderRouter implements QuotaProviderRouterContract {
  select(
    request: BriefingModelRequest,
    candidates: readonly ProviderRouteCandidate[],
    stateStore: ProviderStateStore,
  ): ProviderRouteCandidate | undefined {
    return candidates.find(
      (candidate) =>
        !hasTextSecret(candidate.model.metadata.id) &&
        hasRequiredCapabilities(request, candidate) &&
        isEligible(stateStore.get(candidate.providerId)),
    );
  }
}
