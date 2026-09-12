const assert = require('node:assert/strict');
const test = require('node:test');

async function loadExperience() {
  return import('../src/state/experience.ts');
}

async function loadContent() {
  return import('../src/content/content.ts');
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
  assert.equal(receipt.delta.metric, 'mrr');
  assert.equal(receipt.delta.before, 230);
  assert.ok(Math.abs(receipt.delta.after - 300.2) < Number.EPSILON * 300.2);
});

test('paywall reaction only mentions close behavior the player committed', async () => {
  const { calculatePaywallTransaction, paywallReaction } = await loadExperience();
  const { PAYWALL_AXES } = await loadContent();
  const transaction = { mult: 1.6, dark: 5, delta: { metric: 'mrr', before: 100, after: 160 } };

  assert.match(paywallReaction('Caffiend', transaction, { close: 'delayed' }), /FIVE SECONDS/);
  assert.doesNotMatch(paywallReaction('Caffiend', transaction, { close: 'tiny' }), /FIVE SECONDS/);

  const moderate = calculatePaywallTransaction({
    totalMrr: 100,
    mrrMult: 1,
    baseMrr: 100,
    previousMult: 1,
    picks: { price: 'confident', trial: 'forget', headline: 'honest', close: 'big' },
    axes: PAYWALL_AXES,
  });
  assert.equal(moderate.dark, 3);
  assert.doesNotMatch(
    paywallReaction('Caffiend', moderate, { close: 'big' }),
    /\b(close|x)\b/i,
  );
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
  const { codeProgressStatus, secondsUntilNextLine } = await loadExperience();
  assert.equal(secondsUntilNextLine(0.4, 0.06), 5);
  assert.equal(secondsUntilNextLine(1, 0.06), 0);

  const automated = codeProgressStatus({ done: false, energy: 0.4, energyRegen: 0.06, autoCode: 6 });
  assert.equal(automated.prompt, 'OUT OF ENERGY · AUTOMATION IS STILL WRITING');
  assert.equal(automated.manualTapLabel, 'MANUAL TAP IN 5S · OPEN STORE →');
  assert.equal(automated.manualTapAccessibilityLabel, 'Enough energy for another manual tap in 5 seconds. Open Store.');
});

test('Home selects intentional beta-tester reactions and ignores player verdicts', async () => {
  const { selectHomeReaction } = await loadExperience();
  const { BETA_TESTER, PLAYER } = await loadContent();
  const chirps = [
    { id: 'player-verdict', who: PLAYER[0], handle: PLAYER[1], kind: 'verdict' },
    { id: 'random-event', who: BETA_TESTER[0], handle: BETA_TESTER[1], kind: 'event' },
    { id: 'ten-taps', who: BETA_TESTER[0], handle: BETA_TESTER[1], kind: 'milestone' },
    { id: 'paywall-receipt', who: BETA_TESTER[0], handle: BETA_TESTER[1], kind: 'paywall' },
  ];

  assert.equal(selectHomeReaction(chirps, 'paywall-receipt', 10, BETA_TESTER)?.id, 'paywall-receipt');
  assert.equal(selectHomeReaction(chirps, 'player-verdict', 10, BETA_TESTER)?.id, 'ten-taps');
  assert.equal(selectHomeReaction(chirps, 'paywall-receipt', 0, BETA_TESTER)?.id, 'ten-taps');
});

test('Home project copy and automation telemetry follow the latest real state', async () => {
  const { homeAutomationStatus, homeEmptyProjectCopy } = await loadExperience();

  assert.equal(homeEmptyProjectCopy([]), 'Nothing shipped yet. Everyone starts at zero.');
  assert.equal(homeEmptyProjectCopy([{ live: true }]), 'The last launch is out in the world. The next idea is waiting.');
  assert.equal(homeEmptyProjectCopy([{ live: true }, { live: false }]), 'The last submission was rejected. The next idea is waiting.');
  assert.equal(homeAutomationStatus(6, { loc: 10, need: 100 }), 'AUTO 6 LOC/S · PROGRESS RUNS WHILE OPEN');
  assert.equal(homeAutomationStatus(6, { loc: 100, need: 100 }), undefined);
  assert.equal(homeAutomationStatus(6, null), undefined);
});

test('semantic no-op patches are rejected before event output', async () => {
  const { hasStateChange } = await loadExperience();

  assert.equal(hasStateChange({ cash: 0, energy: 50 }, { cash: 0 }), false);
  assert.equal(hasStateChange({ cash: 10, energy: 50 }, { cash: 0 }), true);
  assert.equal(hasStateChange({ cash: 10, energy: 50 }, {}), false);
});

test('paywall result presentation follows the committed MRR direction', async () => {
  const { calculatePaywallTransaction, paywallResultPresentation } = await loadExperience();
  const { PAYWALL_AXES } = await loadContent();
  const transaction = calculatePaywallTransaction({
    totalMrr: 285,
    mrrMult: 1,
    baseMrr: 100,
    previousMult: 2.85,
    picks: { price: 'cheap', trial: 'none', headline: 'unhinged', close: 'delayed' },
    axes: PAYWALL_AXES,
  });
  const decreased = paywallResultPresentation(transaction);

  assert.equal(transaction.mult, 1.38);
  assert.equal(transaction.dark, 5);
  assert.deepEqual(transaction.delta, { metric: 'mrr', before: 285, after: 138 });
  assert.equal(decreased.direction, 'down');
  assert.equal(decreased.receipt, 'MRR $285 → $138 (−$147/mo)');
  assert.match(decreased.body, /decreased/i);
  assert.doesNotMatch(decreased.body, /\b(up|increased)\b/i);

  assert.equal(paywallResultPresentation({ mult: 1.2, dark: 0, delta: { metric: 'mrr', before: 100, after: 120 } }).direction, 'up');
  assert.equal(paywallResultPresentation({ mult: 1, dark: 0, delta: { metric: 'mrr', before: 100, after: 100 } }).direction, 'unchanged');
});
