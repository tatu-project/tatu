import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { setTimeout as sleep } from 'node:timers/promises';
import process from 'node:process';
import { setTimeout, clearTimeout } from 'node:timers';

export function loadEnvironment(path = '.env', environment = process.env) {
  try {
    for (const [key, value] of Object.entries(
      parseEnv(readFileSync(path, 'utf8')),
    )) {
      if (environment[key] === undefined) environment[key] = value;
    }
  } catch (error) {
    if (error.code !== 'ENOENT')
      throw new Error('Unable to load local configuration.');
  }
  return environment;
}

/** Direct Node children only: no shells, grandchildren, global process scans or system services. */
export function supervise(
  commands,
  {
    environment = process.env,
    spawnChild = spawn,
    retries = 3,
    backoffMs = 500,
    graceMs = 2000,
    onEvent = () => {},
  } = {},
) {
  const children = new Set();
  const timers = new Set();
  let stopping = false;
  let resolveDone;
  const done = new Promise((resolve) => {
    resolveDone = resolve;
  });
  const stop = async (code = 0) => {
    if (stopping) return done;
    stopping = true;
    for (const timer of timers) clearTimeout(timer);
    const snapshot = [...children];
    for (const child of snapshot) child.kill('SIGTERM');
    await Promise.race([
      Promise.all(
        snapshot.map((child) =>
          child.exitCode !== null || child.signalCode !== null
            ? Promise.resolve()
            : new Promise((resolve) => child.once('close', resolve)),
        ),
      ),
      sleep(graceMs),
    ]);
    for (const child of snapshot) {
      if (child.exitCode === null && child.signalCode === null)
        child.kill('SIGKILL');
    }
    await Promise.all(
      snapshot.map((child) =>
        child.exitCode !== null || child.signalCode !== null
          ? Promise.resolve()
          : new Promise((resolve) => child.once('close', resolve)),
      ),
    );
    resolveDone(code);
    return done;
  };
  const launch = (command, attempt = 0) => {
    if (stopping) return;
    let child;
    try {
      child = spawnChild(process.execPath, command, {
        env: environment,
        stdio: 'inherit',
      });
    } catch {
      void stop(1);
      return;
    }
    children.add(child);
    let handled = false;
    const finished = () => {
      if (handled) return;
      handled = true;
      children.delete(child);
      if (stopping) return;
      onEvent({ type: 'restart', attempt, command: command[0] });
      if (attempt >= retries) {
        void stop(1);
        return;
      }
      const timer = setTimeout(
        () => {
          timers.delete(timer);
          launch(command, attempt + 1);
        },
        Math.min(backoffMs * 2 ** attempt, 10000),
      );
      timers.add(timer);
    };
    child.once('error', finished);
    child.once('close', finished);
  };
  for (const command of commands) launch(command);
  return { stop, done };
}
