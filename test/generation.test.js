import test from 'node:test';
import assert from 'node:assert/strict';
import { validateGeneration } from '../src/generation.js';

test('validateGeneration accepts valid payload', () => {
  const payload = {
    meaningTarget: 'x',
    meaningKnown: 'y',
    sentenceTarget: 'Today I use aufgeben at school',
    sentenceKnown: 'z'
  };
  assert.equal(validateGeneration(payload, { text: 'aufgeben', targetLanguage: 'de', level: 'A1' }), null);
});

test('validateGeneration rejects invalid keys', () => {
  const payload = { bad: 'x' };
  assert.equal(validateGeneration(payload, { text: 'aufgeben', targetLanguage: 'de', level: 'A1' }), 'INVALID_KEYS');
});
