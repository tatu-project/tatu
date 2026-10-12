import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Contains no task contents, credentials, process identifiers, or exception text. */
export function writeHeartbeat(
  state: 'idle' | 'polling' | 'error',
  environment: NodeJS.ProcessEnv = process.env,
) {
  const path =
    environment.TATU_HEARTBEAT_PATH ??
    join(
      dirname(environment.TATU_DATABASE_PATH ?? 'data/tatu.sqlite'),
      'worker-heartbeat.json',
    );
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  writeFileSync(
    temporary,
    JSON.stringify({ at: new Date().toISOString(), state }),
    { mode: 0o600 },
  );
  renameSync(temporary, path);
}
