import assert from 'node:assert/strict';
import test from 'node:test';
import { hasTextSecret, redactTextSecrets } from './text-policy.js';

test('detects only high-confidence text credentials', () => {
  for (const value of [
    'api_key=abcdEFGH1234',
    'access_token: token-value-1234',
    'Authorization: Bearer abcdefghijkl',
    'Bearer abcdefghijkl',
    'Basic dXNlcjpwYXNz',
    'Token abcdefghijkl',
    'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature123',
    'https://user:password@example.com/story',
    'sk-proj-abcdefghijkl',
    'ghp_abcdefghijkl',
  ])
    assert.equal(hasTextSecret(value), true, value);
});

test('does not flag ordinary language, short values, unicode, or punctuation', () => {
  for (const value of [
    'API key rotation',
    'secret history',
    'tokenization',
    'https://example.com/news?q=api_key',
    'token: short',
    'Notícias sobre inteligência artificial — hoje!',
    '**Important**: (news) [today].',
  ])
    assert.equal(hasTextSecret(value), false, value);
});

test('redacts recognized substrings without changing surrounding text', () => {
  assert.equal(
    redactTextSecrets('Keep api_key=abcdEFGH1234 in context.'),
    'Keep api_key=[REDACTED] in context.',
  );
  assert.equal(
    redactTextSecrets('api_key=abcdEFGH1234 token=ijklMNOP5678'),
    'api_key=[REDACTED] token=[REDACTED]',
  );
});
