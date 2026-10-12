import type { D1Database } from './types.js';
export class QuotaError extends Error {
  readonly status = 429;
  readonly code = 'quota_exhausted';
  constructor(readonly retryAfter = 60) {
    super('quota_exhausted');
  }
}
export interface QuotaLimits {
  minuteRequests: number;
  dayRequests: number;
  minuteUnits: number;
  dayUnits: number;
  concurrency: number;
}
export interface QuotaReservation {
  (): Promise<void>;
  markDispatched(): void;
  refundBeforeDispatch(): Promise<void>;
}
export async function reserveQuota(
  db: D1Database,
  scope: string,
  provider: string,
  units: number,
  limits: QuotaLimits,
  now = Date.now(),
): Promise<QuotaReservation> {
  const minute = Math.floor(now / 60000),
    day = Math.floor(now / 86400000),
    lease = now + 30000;
  // One conditional UPSERT makes checking+incrementing atomic across isolates.
  const sql = `INSERT INTO provider_quota(scope,provider,minute,day,minute_requests,day_requests,minute_units,day_units,active,lease_epoch,blocked_until)
 SELECT ?,?,?,?,1,1,?,?,1,?,0 WHERE ?<=? AND ?<=?
 ON CONFLICT(scope,provider) DO UPDATE SET
 minute=excluded.minute,day=excluded.day,
 minute_requests=CASE WHEN provider_quota.minute=excluded.minute THEN provider_quota.minute_requests+1 ELSE 1 END,
 day_requests=CASE WHEN provider_quota.day=excluded.day THEN provider_quota.day_requests+1 ELSE 1 END,
 minute_units=CASE WHEN provider_quota.minute=excluded.minute THEN provider_quota.minute_units+excluded.minute_units ELSE excluded.minute_units END,
 day_units=CASE WHEN provider_quota.day=excluded.day THEN provider_quota.day_units+excluded.day_units ELSE excluded.day_units END,
 active=CASE WHEN provider_quota.lease_epoch>? THEN provider_quota.active+1 ELSE 1 END,lease_epoch=CASE WHEN provider_quota.lease_epoch>? THEN provider_quota.lease_epoch ELSE excluded.lease_epoch END
 WHERE provider_quota.blocked_until<=?
 AND (CASE WHEN provider_quota.minute=excluded.minute THEN provider_quota.minute_requests ELSE 0 END)< ?
 AND (CASE WHEN provider_quota.day=excluded.day THEN provider_quota.day_requests ELSE 0 END)< ?
 AND (CASE WHEN provider_quota.minute=excluded.minute THEN provider_quota.minute_units ELSE 0 END)+excluded.minute_units<=?
 AND (CASE WHEN provider_quota.day=excluded.day THEN provider_quota.day_units ELSE 0 END)+excluded.day_units<=?
 AND (CASE WHEN provider_quota.lease_epoch>? THEN provider_quota.active ELSE 0 END)<? RETURNING scope,lease_epoch`;
  const result = await db
    .prepare(sql)
    .bind(
      scope,
      provider,
      minute,
      day,
      units,
      units,
      lease,
      units,
      limits.minuteUnits,
      units,
      limits.dayUnits,
      now,
      now,
      now,
      limits.minuteRequests,
      limits.dayRequests,
      limits.minuteUnits,
      limits.dayUnits,
      now,
      limits.concurrency,
    )
    .all<{ scope: string; lease_epoch: number }>();
  if (!result.success || result.results.length !== 1) {
    const row = await db
      .prepare(
        'SELECT blocked_until FROM provider_quota WHERE scope=? AND provider=?',
      )
      .bind(scope, provider)
      .first<{ blocked_until: number }>();
    throw new QuotaError(
      Math.max(
        60,
        Math.min(86400, Math.ceil(((row?.blocked_until ?? now) - now) / 1000)),
      ),
    );
  }
  let released = false;
  let dispatched = false;
  const reservedLease = result.results[0].lease_epoch;
  const release = async () => {
    if (released) return;
    released = true;
    await db
      .prepare(
        'UPDATE provider_quota SET active=MAX(0,active-1) WHERE scope=? AND provider=? AND lease_epoch=?',
      )
      .bind(scope, provider, reservedLease)
      .run();
  };
  release.markDispatched = () => {
    if (released) throw new Error('invalid_reservation');
    dispatched = true;
  };
  release.refundBeforeDispatch = async () => {
    if (dispatched || released) return;
    // Refund only this reservation's counters in windows which still match.
    // A rollover must never decrement a different window's usage.
    released = true;
    await db
      .prepare(
        `UPDATE provider_quota SET
      minute_requests=CASE WHEN minute=? THEN MAX(0,minute_requests-1) ELSE minute_requests END,
      day_requests=CASE WHEN day=? THEN MAX(0,day_requests-1) ELSE day_requests END,
      minute_units=CASE WHEN minute=? THEN MAX(0,minute_units-?) ELSE minute_units END,
      day_units=CASE WHEN day=? THEN MAX(0,day_units-?) ELSE day_units END,
      active=CASE WHEN lease_epoch=? THEN MAX(0,active-1) ELSE active END
      WHERE scope=? AND provider=?`,
      )
      .bind(
        minute,
        day,
        minute,
        units,
        day,
        units,
        reservedLease,
        scope,
        provider,
      )
      .run();
  };
  return release;
}
export async function blockQuota(
  db: D1Database,
  scope: string,
  provider: string,
  retryAfter: number,
): Promise<void> {
  await db
    .prepare(
      'UPDATE provider_quota SET blocked_until=MAX(blocked_until,?) WHERE scope=? AND provider=?',
    )
    .bind(
      Date.now() + Math.min(86400, Math.max(1, retryAfter)) * 1000,
      scope,
      provider,
    )
    .run();
}
