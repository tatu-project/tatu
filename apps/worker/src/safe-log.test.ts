import assert from 'node:assert/strict';
import test from 'node:test';
import { workerPollFailureMessage } from './safe-log.js';

test('worker poll diagnostics are fixed and contain no thrown error text', () => {
  const secretError = new Error(
    'authorization=Bearer super-secret https://user:pass@example.test/?token=raw',
  );
  const rendered = workerPollFailureMessage;
  assert.equal(rendered, 'Tatu worker poll failed [redacted]');
  assert.doesNotMatch(rendered, /super-secret|user:pass|token=raw/);
  assert.doesNotMatch(rendered, new RegExp(secretError.message));
});
