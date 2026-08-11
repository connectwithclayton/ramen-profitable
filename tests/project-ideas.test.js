const assert = require('node:assert/strict');
const test = require('node:test');

async function loadPicker() {
  return import('../src/state/projectIdeas.ts');
}

test('prefers an app idea that has not been used', async () => {
  const { pickAppIdea } = await loadPicker();
  const ideas = [
    ['First', 'first pitch'],
    ['Second', 'second pitch'],
    ['Third', 'third pitch'],
  ];

  assert.deepEqual(pickAppIdea(ideas, new Set(['First']), () => 0), ideas[1]);
});

test('reuses an app idea after the catalog is exhausted', async () => {
  const { pickAppIdea } = await loadPicker();
  const ideas = [
    ['First', 'first pitch'],
    ['Second', 'second pitch'],
  ];

  assert.deepEqual(
    pickAppIdea(ideas, new Set(['First', 'Second']), () => 0.99),
    ideas[1],
  );
});
