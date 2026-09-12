const assert = require('node:assert/strict');
const test = require('node:test');

async function loadExperience() {
  return import('../src/state/experience.ts');
}

const axes = [
  { id: 'price', choices: [{ id: 'plain', mult: 1, dark: 0 }, { id: 'hot', mult: 1.3, dark: 2 }] },
  { id: 'close', choices: [{ id: 'big', mult: 0.95, dark: 0 }, { id: 'delayed', mult: 1.3, dark: 3 }] },
];

test('paywall receipt captures the committed transaction values', async () => {
  const { calculatePaywallTransaction } = await loadExperience();
  const receipt = calculatePaywallTransaction({
    totalMrr: 230,
    mrrMult: 1.3,
    baseMrr: 100,
    previousMult: 1.15,
    picks: { price: 'hot', close: 'delayed' },
    axes,
  });

  assert.equal(receipt.mult, 1.69);
  assert.equal(receipt.dark, 5);
  assert.equal(receipt.beforeMrr, 230);
  assert.ok(Math.abs(receipt.afterMrr - 300.2) < Number.EPSILON * 300.2);
  assert.equal(receipt.delta.metric, 'mrr');
  assert.equal(receipt.delta.before, receipt.beforeMrr);
  assert.equal(receipt.delta.after, receipt.afterMrr);
});

test('paywall copy only claims a delayed close button when selected', async () => {
  const { paywallReaction } = await loadExperience();
  const transaction = { mult: 1.6, dark: 5, beforeMrr: 100, afterMrr: 160, delta: { metric: 'mrr', before: 100, after: 160 } };

  assert.match(paywallReaction('Caffiend', transaction, { close: 'delayed' }), /FIVE SECONDS/);
  assert.doesNotMatch(paywallReaction('Caffiend', transaction, { close: 'tiny' }), /FIVE SECONDS/);
});

test('project milestones are scoped by stable project id', async () => {
  const { milestonesForProject, projectMilestoneId } = await loadExperience();
  const kept = milestonesForProject({
    [projectMilestoneId('old-id', 'ten-taps')]: true,
    [projectMilestoneId('new-id', 'started')]: true,
    'upgrade:claude-affordable': true,
  }, 'new-id');

  assert.deepEqual(kept, {
    [projectMilestoneId('new-id', 'started')]: true,
    'upgrade:claude-affordable': true,
  });
});

test('energy countdown follows the live regeneration rate', async () => {
  const { secondsUntilNextLine } = await loadExperience();
  assert.equal(secondsUntilNextLine(0.4, 0.06), 5);
  assert.equal(secondsUntilNextLine(1, 0.06), 0);
});

test('a priority receipt stays on Home while newer event posts arrive', async () => {
  const { selectHomeReaction } = await loadExperience();
  const chirps = [{ id: 'new-event' }, { id: 'paywall-receipt' }];

  assert.equal(selectHomeReaction(chirps, 'paywall-receipt', 10)?.id, 'paywall-receipt');
  assert.equal(selectHomeReaction(chirps, 'paywall-receipt', 0)?.id, 'new-event');
});
