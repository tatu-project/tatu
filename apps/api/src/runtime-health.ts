import { openSync, readSync, closeSync } from 'node:fs';
import { dirname, join } from 'node:path';

export type WorkerHealth = {
  status: 'healthy' | 'stale' | 'unavailable' | 'invalid';
  lastSeenAt: string | null;
  polling: boolean | null;
};

export function readWorkerHealth(
  environment: NodeJS.ProcessEnv = process.env,
  now: Date = new Date(),
): WorkerHealth {
  let descriptor: number | undefined;
  const absent: WorkerHealth = {
    status: 'unavailable',
    lastSeenAt: null,
    polling: null,
  };
  try {
    const path =
      environment.TATU_HEARTBEAT_PATH ??
      join(
        dirname(environment.TATU_DATABASE_PATH ?? 'data/tatu.sqlite'),
        'worker-heartbeat.json',
      );
    descriptor = openSync(path, 'r');
    const buffer = Buffer.alloc(1025);
    const bytes = readSync(descriptor, buffer, 0, buffer.length, 0);
    if (bytes > 1024) return { ...absent, status: 'invalid' };
    const value: unknown = JSON.parse(
      buffer.subarray(0, bytes).toString('utf8'),
    );
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return { ...absent, status: 'invalid' };
    const record = value as Record<string, unknown>;
    if (
      Object.keys(record).length !== 2 ||
      typeof record.at !== 'string' ||
      !['idle', 'polling', 'error'].includes(String(record.state))
    )
      return { ...absent, status: 'invalid' };
    const timestamp = Date.parse(record.at);
    const age = now.getTime() - timestamp;
    if (
      !Number.isFinite(age) ||
      age < -5000 ||
      new Date(timestamp).toISOString() !== record.at
    )
      return { ...absent, status: 'invalid' };
    const configured = Number(environment.TATU_WORKER_POLL_MS ?? 10000);
    const pollMs =
      Number.isFinite(configured) && configured >= 100 && configured <= 60000
        ? configured
        : 10000;
    return {
      status:
        age > Math.max(30000, pollMs * 3)
          ? 'stale'
          : record.state === 'error'
            ? 'unavailable'
            : 'healthy',
      lastSeenAt: record.at,
      polling: record.state === 'polling',
    };
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ENOENT'
      ? absent
      : { ...absent, status: 'invalid' };
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}
