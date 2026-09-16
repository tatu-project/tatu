import assert from 'node:assert/strict';
import test from 'node:test';
import { hasSensitiveUrlQuery } from './url-policy.js';

test('detects common secret query names across separator and casing variants', () => {
  for (const name of [
    'token',
    'access_token',
    'api-key',
    'secret_key',
    'privateKey',
    'client-secret',
  ]) {
    assert.equal(
      hasSensitiveUrlQuery(`https://source.test/feed?${name}=raw-secret`),
      true,
      name,
    );
  }
});

test('allows ordinary non-sensitive query parameters', () => {
  assert.equal(
    hasSensitiveUrlQuery('https://source.test/feed?page=2&format=rss'),
    false,
  );
});
