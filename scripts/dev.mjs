import { spawn } from 'node:child_process';
import process from 'node:process';

const processes = [
  spawn(process.execPath, ['apps/api/dist/index.js'], { stdio: 'inherit' }),
  spawn(process.execPath, ['apps/worker/dist/index.js'], { stdio: 'inherit' }),
];

const stop = (exitCode = 0) => {
  for (const child of processes) {
    child.kill('SIGTERM');
  }
  process.exit(exitCode);
};

process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());

for (const child of processes) {
  child.on('exit', (code) => {
    if (code !== 0) {
      stop(code ?? 1);
    }
  });
}
