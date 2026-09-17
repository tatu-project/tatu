import assert from 'node:assert/strict';
import test from 'node:test';
import { hasExactKeys, hasOnlyKeys } from './object-policy.js';

test('allows known runtime object keys and rejects unknown or non-record values', () => {
  assert.equal(hasOnlyKeys({ topic: 'AI' }, ['topic', 'stories']), true);
  assert.equal(
    hasOnlyKeys({ topic: 'AI', providerPayload: { raw: true } }, ['topic']),
    false,
  );
  assert.equal(hasOnlyKeys(['topic'], ['topic']), false);
  assert.equal(hasOnlyKeys(null, ['topic']), false);
});

test('hasExactKeys requires every key exactly once', () => {
  assert.equal(hasExactKeys({ topic: 'AI' }, ['topic']), true);
  assert.equal(hasExactKeys({}, ['topic']), false);
  assert.equal(hasExactKeys({ topic: 'AI', extra: true }, ['topic']), false);
});
