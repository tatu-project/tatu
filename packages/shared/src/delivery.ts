import type { BriefingResult, ExecutionContext } from './index.js';

/**
 * A sanitized receipt returned after a delivery adapter has committed its
 * artifact. The occurrence key is retained for correlation, but the adapter
 * must never put it into the delivered payload.
 */
export interface BriefingDeliveryReceipt {
  readonly channel: 'file-outbox';
  readonly idempotencyKey: string;
  readonly artifactId: string;
  readonly contentSha256: string;
}

/** Provider-independent delivery port for a validated final briefing. */
export interface BriefingDelivery {
  deliver(
    context: ExecutionContext,
    briefing: BriefingResult,
    signal: AbortSignal,
  ): Promise<BriefingDeliveryReceipt>;
}
