import type {
  BriefingModelRequest,
  LocalBriefingModel,
  ModelRouter,
} from '@tatu/shared';

/**
 * Selects the first model that satisfies every requested capability.
 *
 * This router evaluates model suitability only. It does not inspect provider
 * state, invoke a model, mutate candidates, or provide fallback behavior.
 */
export class CapabilityModelRouter implements ModelRouter {
  select(
    request: BriefingModelRequest,
    candidates: readonly LocalBriefingModel[],
  ): LocalBriefingModel | undefined {
    return candidates.find((candidate) =>
      request.requiredCapabilities.every((capability) =>
        candidate.metadata.capabilities.includes(capability),
      ),
    );
  }
}
