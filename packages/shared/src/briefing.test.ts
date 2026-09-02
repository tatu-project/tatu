import assert from 'node:assert/strict';
import test from 'node:test';
import { parseBriefing } from './index.js';
test('parses the roadmap briefing phrase', () => {
  assert.deepEqual(
    parseBriefing(
      'Todos os dias às 8h, encontre as três notícias mais importantes sobre inteligência artificial e me envie.',
      'America/Sao_Paulo',
    ),
    {
      ok: true,
      draft: {
        cadence: 'daily',
        time: '08:00',
        quantity: 3,
        topic: 'inteligência artificial',
        deliveryRequested: true,
        timezone: 'America/Sao_Paulo',
      },
    },
  );
});

test('clarifies ambiguous requests and invalid timezones', () => {
  assert.equal(
    parseBriefing('me envie notícias', 'America/Sao_Paulo').ok,
    false,
  );
  assert.equal(
    parseBriefing(
      'Todos os dias às 8h, encontre as três notícias mais importantes sobre inteligência artificial e me envie.',
      'Brasil/Sao_Paulo',
    ).ok,
    false,
  );
});
