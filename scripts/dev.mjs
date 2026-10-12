import process from 'node:process';
import console from 'node:console';
import { loadEnvironment, supervise } from './runtime.mjs';

loadEnvironment();
const runtime = supervise(
  [['apps/api/dist/index.js'], ['apps/worker/dist/index.js']],
  {
    onEvent: () =>
      console.error(
        'Local process stopped; retrying within the bounded restart policy.',
      ),
  },
);
process.on('SIGINT', () => void runtime.stop());
process.on('SIGTERM', () => void runtime.stop());
process.exitCode = await runtime.done;
