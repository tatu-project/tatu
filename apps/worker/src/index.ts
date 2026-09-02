import { getHealthStatus } from '@tatu/shared';

const status = getHealthStatus();
console.log(
  `Tatu worker is on standby (${status.stage}); no scheduled work is implemented.`,
);

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));

setInterval(() => undefined, 60_000);
