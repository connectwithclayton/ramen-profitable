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
  assert.equal(receipt.delta.before, 230);
  assert.ok(Math.abs(receipt.delta.after - 300.2) < Number.EPSILON * 300.2);
});

test('paywall reaction only mentions close behavior the player committed', async () => {
  const { calculatePaywallTransaction, paywallReaction } = await loadExperience();
  const { PAYWALL_AXES } = await loadContent();
  const transaction = { mult: 1.6, dark: 5, delta: { before: 100, after: 160 } };

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
  assert.equal(automated.manualTapLabel, 'MANUAL TAP IN 5S');
  assert.equal(automated.manualTapAccessibilityLabel, 'Enough energy for another manual tap in 5 seconds.');

  const completed = codeProgressStatus({ done: true, energy: 0.4, energyRegen: 0.06, autoCode: 6 });
  assert.deepEqual(completed, { drained: true, prompt: 'SHIP IT AND FIND OUT' });
});

test('ten-tap reaction takes precedence over simultaneous depletion', async () => {
  const { tapReactionKind } = await loadExperience();

  assert.equal(tapReactionKind(true, true), 'ten-taps');
  assert.equal(tapReactionKind(true, false), 'ten-taps');
  assert.equal(tapReactionKind(false, true), 'energy-depleted');
  assert.equal(tapReactionKind(false, false), undefined);
});

test('Home selects intentional beta-tester reactions and ignores player verdicts', async () => {
  const { selectHomeReaction } = await loadExperience();
  const { BETA_TESTER, PLAYER } = await loadContent();
  const chirps = [
    { id: 'ambient', who: BETA_TESTER[0], handle: BETA_TESTER[1], kind: 'ambient' },
    { id: 'player-verdict', who: PLAYER[0], handle: PLAYER[1] },
    { id: 'random-event', who: BETA_TESTER[0], handle: BETA_TESTER[1] },
    { id: 'purchase', who: BETA_TESTER[0], handle: BETA_TESTER[1], kind: 'purchase' },
    { id: 'verdict', who: BETA_TESTER[0], handle: BETA_TESTER[1], kind: 'verdict' },
    { id: 'ten-taps', who: BETA_TESTER[0], handle: BETA_TESTER[1], kind: 'milestone' },
    { id: 'paywall-receipt', who: BETA_TESTER[0], handle: BETA_TESTER[1], kind: 'paywall' },
  ];
  const receipt = chirps.find(chirp => chirp.id === 'paywall-receipt');

  assert.equal(selectHomeReaction(chirps, receipt, 10, BETA_TESTER)?.id, 'paywall-receipt');
  assert.equal(selectHomeReaction(chirps, chirps[1], 10, BETA_TESTER)?.id, 'ambient');
  assert.equal(selectHomeReaction(chirps, receipt, 0, BETA_TESTER)?.id, 'ambient');
});

test('Home keeps a durable receipt independent of bounded Chirp history', async () => {
  const { selectHomeReaction, selectPersistedState } = await loadExperience();
  const { BETA_TESTER } = await loadContent();
  const receipt = {
    id: 'paywall-receipt',
    who: BETA_TESTER[0],
    handle: BETA_TESTER[1],
    kind: 'paywall',
    text: 'This paywall has a point of view.',
    likes: 42,
    event: 'PAYWALL SHIPPED · HEAT 3',
    delta: { before: 120, after: 156 },
  };
  const boundedFeed = Array.from({ length: 30 }, (_, index) => ({
    id: `newer-${index}`,
    who: BETA_TESTER[0],
    handle: BETA_TESTER[1],
    kind: 'ambient',
  }));
  const restored = JSON.parse(JSON.stringify(selectPersistedState({
    cash: 500,
    chirps: boundedFeed,
    homeReceipt: receipt,
    homeReceiptSecondsLeft: 20,
    notifs: [{ id: 'transient' }],
    overlay: { type: 'paywallResult' },
  }, BETA_TESTER)));

  assert.equal(restored.cash, 500);
  assert.equal('notifs' in restored, false);
  assert.equal('overlay' in restored, false);
  assert.deepEqual(restored.homeReceipt, receipt);
  assert.equal(restored.homeReceiptSecondsLeft, 20);
  assert.equal(
    selectHomeReaction(restored.chirps, restored.homeReceipt, restored.homeReceiptSecondsLeft, BETA_TESTER)?.id,
    receipt.id,
  );
  assert.equal(selectHomeReaction(restored.chirps, restored.homeReceipt, 0, BETA_TESTER)?.id, 'newer-0');

  const oldPin = selectPersistedState(
    { homeReactionId: 'old', homeReactionSecondsLeft: 20 },
    BETA_TESTER,
  );
  assert.equal(oldPin.homeReceipt, undefined);
  assert.equal(oldPin.homeReceiptSecondsLeft, 0);
  assert.equal('homeReactionId' in oldPin, false);
});

test('only real receipts survive persistence and their own exposure', async () => {
  const {
    advanceHomeReceiptExposure,
    homeReceiptStateForPersistence,
  } = await loadExperience();
  const { BETA_TESTER } = await loadContent();
  const receipt = {
    id: 'receipt-b',
    who: BETA_TESTER[0],
    handle: BETA_TESTER[1],
    kind: 'verdict',
    text: 'The app is live.',
  };

  for (const kind of ['verdict', 'purchase', 'paywall']) {
    const durable = { ...receipt, kind };
    assert.deepEqual(
      homeReceiptStateForPersistence(durable, 20, BETA_TESTER),
      { homeReceipt: durable, homeReceiptSecondsLeft: 20 },
    );
  }
  assert.deepEqual(
    homeReceiptStateForPersistence({ ...receipt, kind: 'milestone' }, 20, BETA_TESTER),
    { homeReceipt: undefined, homeReceiptSecondsLeft: 0 },
  );
  assert.deepEqual(
    homeReceiptStateForPersistence({ ...receipt, kind: 'ambient' }, 20, BETA_TESTER),
    { homeReceipt: undefined, homeReceiptSecondsLeft: 0 },
  );

  assert.deepEqual(
    advanceHomeReceiptExposure(receipt, 20, 'receipt-a', 7),
    { homeReceipt: receipt, homeReceiptSecondsLeft: 20 },
  );
  assert.deepEqual(
    advanceHomeReceiptExposure(receipt, 20, receipt.id, 7),
    { homeReceipt: receipt, homeReceiptSecondsLeft: 13 },
  );
  assert.deepEqual(
    advanceHomeReceiptExposure(receipt, 13, receipt.id, 13),
    { homeReceipt: undefined, homeReceiptSecondsLeft: 0 },
  );
});

test('Home receipt exposure requires the full card in the viewport', async () => {
  const { isVerticalFrameFullyVisible } = await loadExperience();
  const viewport = { y: 100, height: 400 };

  assert.equal(isVerticalFrameFullyVisible(undefined, viewport), false);
  assert.equal(isVerticalFrameFullyVisible({ y: 180, height: 160 }, viewport), true);
  assert.equal(isVerticalFrameFullyVisible({ y: 40, height: 59 }, viewport), false);
  assert.equal(isVerticalFrameFullyVisible({ y: 80, height: 160 }, viewport), false);
  assert.equal(isVerticalFrameFullyVisible({ y: 450, height: 80 }, viewport), false);
  assert.equal(isVerticalFrameFullyVisible({ y: 100, height: 0 }, viewport), false);
  assert.equal(isVerticalFrameFullyVisible({ y: 0, height: 160 }, { y: -20, height: 400 }), true);
  assert.equal(isVerticalFrameFullyVisible({ y: 430, height: 60 }, viewport, 80), false);
  assert.equal(isVerticalFrameFullyVisible({ y: 430, height: 60 }, viewport, 0), true);
});

test('Home project copy and automation telemetry follow the latest real state', async () => {
  const { homeAutomationStatus, homeEmptyProjectCopy, homeProjectActionLabel } = await loadExperience();

  assert.equal(homeEmptyProjectCopy([]), 'Nothing shipped yet. Everyone starts at zero.');
  assert.equal(homeEmptyProjectCopy([{ live: true }]), 'The last launch is out in the world. The next idea is waiting.');
  assert.equal(homeEmptyProjectCopy([{ live: true }, { live: false }]), 'The last submission was rejected. The next idea is waiting.');
  assert.equal(homeAutomationStatus(6, { loc: 10, need: 100 }), 'AUTO 6 LOC/S · PROGRESS RUNS WHILE OPEN');
  assert.equal(homeAutomationStatus(6, { loc: 100, need: 100 }), undefined);
  assert.equal(homeAutomationStatus(6, null), undefined);
  assert.equal(homeProjectActionLabel(false), 'Continue coding');
  assert.equal(homeProjectActionLabel(true), 'Open Code to submit');
});

test('Home reaction expiry uses measured visible foreground time', async () => {
  const { homeReactionSecondsAfterExposure, sampleHomeExposure } = await loadExperience();
  let visibleSince;
  let visibleSeconds = 0;

  const sample = (now, remainsVisible) => {
    const exposure = sampleHomeExposure(visibleSince, now, remainsVisible);
    visibleSince = exposure.nextStartedAt;
    visibleSeconds += exposure.elapsedSeconds;
  };

  sample(0, true);
  sample(7000, false);
  sample(67000, false);
  sample(67000, true);
  sample(80000, false);

  assert.equal(visibleSeconds, 20);
  assert.equal(homeReactionSecondsAfterExposure(20, visibleSeconds), 0);
  assert.deepEqual(sampleHomeExposure(1000, 2375, true), {
    elapsedSeconds: 1.375,
    nextStartedAt: 2375,
  });
});

test('semantic no-op patches are rejected before event output', async () => {
  const { hasStateChange } = await loadExperience();

  assert.equal(hasStateChange({ cash: 0, energy: 50 }, { cash: 0 }), false);
  assert.equal(hasStateChange({ cash: 10, energy: 50 }, { cash: 0 }), true);
  assert.equal(hasStateChange({ cash: 10, energy: 50 }, {}), false);
});

test('cash debit events report the realized transition', async () => {
  const { resolveGameEvent } = await loadExperience();
  const { EVENTS } = await loadContent();
  const funded = { cash: 100, mrr: 100, energy: 50, energyMax: 50 };
  const debitEvents = EVENTS.filter(event => {
    const after = event.apply(funded).cash;
    return after === 40 || after === 1;
  });

  assert.equal(debitEvents.length, 2);
  for (const event of debitEvents) {
    const outcome = resolveGameEvent(event, { ...funded, cash: 30 });
    assert.deepEqual(outcome.patch, { cash: 0 });
    assert.match(outcome.text, /-\$30\.$/);
    assert.match(outcome.chirpText, /-\$30\.$/);
    assert.equal(resolveGameEvent(event, { ...funded, cash: 0 }), undefined);
  }
});

test('Home reaction accessibility includes the committed receipt', async () => {
  const { homeReactionAccessibilityLabel } = await loadExperience();
  const label = homeReactionAccessibilityLabel({
    who: 'Burnt Out Beta Tester',
    text: "the new paywall has a point of view. unfortunately, so do I.",
    event: 'PAYWALL SHIPPED · HEAT 5',
    delta: { before: 285, after: 138 },
  });

  assert.equal(
    label,
    'Open Chirp. PAYWALL SHIPPED · HEAT 5. Burnt Out Beta Tester says: the new paywall has a point of view. unfortunately, so do I. MRR $285 → $138 (−$147/mo)',
  );
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
  assert.deepEqual(transaction.delta, { before: 285, after: 138 });
  assert.equal(decreased.direction, 'down');
  assert.equal(decreased.receipt, 'MRR $285 → $138 (−$147/mo)');
  assert.match(decreased.body, /decreased/i);
  assert.doesNotMatch(decreased.body, /\b(up|increased)\b/i);

  assert.equal(paywallResultPresentation({ mult: 1.2, dark: 0, delta: { before: 100, after: 120 } }).direction, 'up');
  assert.equal(paywallResultPresentation({ mult: 1, dark: 0, delta: { before: 100, after: 100 } }).direction, 'unchanged');
});
