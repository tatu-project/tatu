import { getHealthStatus } from '@tatu/shared';
import { LocalScheduler } from '@tatu/storage';

const status = getHealthStatus();
const scheduler = new LocalScheduler(
  process.env.TATU_DATABASE_PATH ?? 'data/tatu.sqlite',
);
let polling = false;
const poll = async () => {
  if (polling) return;
  polling = true;
  try {
    await scheduler.poll(
      new Date(),
      Number(process.env.TATU_LEASE_SECONDS ?? 30),
      Number(process.env.TATU_MAX_ATTEMPTS ?? 3),
      Number(process.env.TATU_EXECUTION_TIMEOUT_MS ?? 25_000),
    );
  } catch (error) {
    console.error('Tatu worker poll failed', error);
  } finally {
    polling = false;
  }
};
void poll();
console.log(
  `Tatu worker ${scheduler.workerId} polling local executions (${status.stage}).`,
);

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));

setInterval(
  () => void poll(),
  Number(process.env.TATU_WORKER_POLL_MS ?? 10_000),
);
