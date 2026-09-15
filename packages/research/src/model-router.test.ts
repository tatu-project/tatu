import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  BriefingModelCapability,
  BriefingModelRequest,
  BriefingResult,
  LocalBriefingModel,
} from '@tatu/shared';
import { CapabilityModelRouter } from './model-router.js';
import { OllamaBriefingModel } from './ollama-briefing-model.js';

const facts: BriefingResult = {
  topic: 'AI',
  stories: [],
  facts: [],
  inference: [],
};

const model = (
  id: string,
  capabilities: readonly BriefingModelCapability[],
  onSynthesize: () => void = () => undefined,
): LocalBriefingModel => ({
  metadata: { id, capabilities },
  async synthesize() {
    onSynthesize();
    return facts;
  },
});

const request = (
  requiredCapabilities: readonly BriefingModelCapability[],
): BriefingModelRequest => ({ requiredCapabilities });

test('selects the first candidate containing every required capability', () => {
  const router = new CapabilityModelRouter();
  const first = model('first', ['briefing-synthesis']);
  const second = model('second', [
    'briefing-synthesis',
    'structured-json',
    'citation-preservation',
  ]);
  const third = model('third', [
    'briefing-synthesis',
    'structured-json',
    'citation-preservation',
  ]);

  assert.equal(
    router.select(request(['briefing-synthesis', 'structured-json']), [
      first,
      second,
      third,
    ]),
    second,
  );
});

test('qualifies Ollama metadata for every briefing capability', () => {
  const router = new CapabilityModelRouter();
  const ollama = new OllamaBriefingModel('llama3.2');

  assert.equal(
    router.select(
      request([
        'briefing-synthesis',
        'structured-json',
        'citation-preservation',
      ]),
      [ollama],
    ),
    ollama,
  );
});

test('skips missing capabilities and returns undefined when no candidate qualifies', () => {
  const router = new CapabilityModelRouter();
  const candidates = [
    model('synthesis', ['briefing-synthesis']),
    model('structured', ['structured-json']),
  ];

  assert.equal(
    router.select(
      request(['briefing-synthesis', 'citation-preservation']),
      candidates,
    ),
    undefined,
  );
});

test('empty requirements select the first candidate without invoking synthesis', () => {
  const router = new CapabilityModelRouter();
  let invocations = 0;
  const first = model('first', [], () => {
    invocations += 1;
  });
  const second = model('second', ['briefing-synthesis']);
  const candidates = [first, second];

  assert.equal(router.select(request([]), candidates), first);
  assert.equal(invocations, 0);
  assert.deepEqual(candidates, [first, second]);
});

test('returns no model when the deterministic RSS route has no candidates', () => {
  const router = new CapabilityModelRouter();

  assert.equal(router.select(request([]), []), undefined);
});

test('does not mutate candidate order or capability metadata', () => {
  const router = new CapabilityModelRouter();
  const capabilities = Object.freeze([
    'briefing-synthesis',
    'structured-json',
  ] as const);
  const first = model('first', capabilities);
  const second = model('second', ['briefing-synthesis']);
  const candidates = Object.freeze([first, second]);

  assert.equal(router.select(request(['structured-json']), candidates), first);
  assert.deepEqual(
    candidates.map(({ metadata }) => metadata.id),
    ['first', 'second'],
  );
  assert.deepEqual(first.metadata.capabilities, capabilities);
});
