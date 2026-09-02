import assert from 'node:assert/strict';
import test from 'node:test';

import { getHealthStatus } from './index.js';

test('returns the stable health contract', () => {
  assert.deepEqual(getHealthStatus(), {
    service: 'tatu',
    stage: 'technical-foundation',
    status: 'healthy',
  });
});
