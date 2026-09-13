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

test('ten-tap and depletion reactions each deliver at most their intended beat', async () => {
  const { tapReactionKind } = await loadExperience();

  assert.equal(tapReactionKind(10, true, false), 'ten-taps');
  assert.equal(tapReactionKind(10, false, false), 'ten-taps');
  assert.equal(tapReactionKind(9, true, false), 'energy-depleted');
  assert.equal(tapReactionKind(11, true, true), undefined);
  assert.equal(tapReactionKind(9, false, false), undefined);
  assert.equal(tapReactionKind(11, false, false), undefined);
});

test('Home selects intentional beta-tester reactions and ignores player verdicts', async () => {
  const { isPriorityHomeReaction, selectHomeReaction } = await loadExperience();
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
  const milestone = chirps.find(chirp => chirp.id === 'ten-taps');

  assert.equal(isPriorityHomeReaction(milestone, BETA_TESTER), true);
  assert.equal(isPriorityHomeReaction(chirps[0], BETA_TESTER), false);
  assert.equal(selectHomeReaction({
    chirps,
    priority: milestone,
    prioritySecondsLeft: 10,
    receipt,
    receiptSecondsLeft: 10,
    betaTester: BETA_TESTER,
  })?.id, 'ten-taps');
  assert.equal(selectHomeReaction({
    chirps,
    priority: chirps[1],
    prioritySecondsLeft: 10,
    receipt,
    receiptSecondsLeft: 10,
    betaTester: BETA_TESTER,
  })?.id, 'paywall-receipt');
  assert.equal(selectHomeReaction({
    chirps,
    priority: milestone,
    prioritySecondsLeft: 0,
    receipt,
    receiptSecondsLeft: 0,
    betaTester: BETA_TESTER,
  })?.id, 'purchase');
});

test('Home priority ignores ambience and keeps receipt persistence independent', async () => {
  const { priorityHomeReactionState } = await loadExperience();
  const { BETA_TESTER } = await loadContent();
  const earned = {
    id: 'ten-taps',
    who: BETA_TESTER[0],
    handle: BETA_TESTER[1],
    kind: 'milestone',
  };
  const ambient = {
    id: 'affordable',
    who: BETA_TESTER[0],
    handle: BETA_TESTER[1],
    kind: 'ambient',
  };
  const receipt = {
    id: 'paywall',
    who: BETA_TESTER[0],
    handle: BETA_TESTER[1],
    kind: 'paywall',
  };
  const earnedPriority = {
    homePriority: earned,
    homePrioritySecondsLeft: 20,
  };
  const receiptPriority = {
    homePriority: receipt,
    homePrioritySecondsLeft: 20,
    homeReceipt: receipt,
    homeReceiptSecondsLeft: 20,
  };

  assert.deepEqual(
    { ...earnedPriority, ...(priorityHomeReactionState(ambient, BETA_TESTER) ?? {}) },
    earnedPriority,
  );
  assert.deepEqual(priorityHomeReactionState(earned, BETA_TESTER), earnedPriority);
  assert.deepEqual(priorityHomeReactionState(receipt, BETA_TESTER), receiptPriority);
  assert.deepEqual({
    ...receiptPriority,
    ...priorityHomeReactionState(earned, BETA_TESTER),
  }, {
    ...earnedPriority,
    homeReceipt: receipt,
    homeReceiptSecondsLeft: 20,
  });
});

test('stored receipt resumes after transient milestone exposure', async () => {
  const {
    advanceHomeReactionExposure,
    priorityHomeReactionState,
    selectHomeReaction,
  } = await loadExperience();
  const { BETA_TESTER } = await loadContent();
  const receipt = {
    id: 'paywall-receipt',
    who: BETA_TESTER[0],
    handle: BETA_TESTER[1],
    kind: 'paywall',
  };
  const milestone = {
    id: 'first-beta-reply',
    who: BETA_TESTER[0],
    handle: BETA_TESTER[1],
    kind: 'milestone',
  };
  const receiptState = {
    ...priorityHomeReactionState(receipt, BETA_TESTER),
    homeReceiptSecondsLeft: 15,
  };
  const state = {
    ...receiptState,
    ...priorityHomeReactionState(milestone, BETA_TESTER),
  };

  assert.equal(selectHomeReaction({
    chirps: [],
    priority: state.homePriority,
    prioritySecondsLeft: state.homePrioritySecondsLeft,
    receipt: state.homeReceipt,
    receiptSecondsLeft: state.homeReceiptSecondsLeft,
    betaTester: BETA_TESTER,
  })?.id, milestone.id);

  const exposed = advanceHomeReactionExposure({
    priority: state.homePriority,
    prioritySecondsLeft: state.homePrioritySecondsLeft,
    receipt: state.homeReceipt,
    receiptSecondsLeft: state.homeReceiptSecondsLeft,
    displayedReactionId: milestone.id,
    elapsedSeconds: 20,
  });
  assert.deepEqual(exposed, {
    homePriority: undefined,
    homePrioritySecondsLeft: 0,
    homeReceipt: receipt,
    homeReceiptSecondsLeft: 15,
  });
  assert.equal(selectHomeReaction({
    chirps: [],
    priority: exposed.homePriority,
    prioritySecondsLeft: exposed.homePrioritySecondsLeft,
    receipt: exposed.homeReceipt,
    receiptSecondsLeft: exposed.homeReceiptSecondsLeft,
    betaTester: BETA_TESTER,
  })?.id, receipt.id);
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
  const milestone = {
    id: 'ten-taps',
    who: BETA_TESTER[0],
    handle: BETA_TESTER[1],
    kind: 'milestone',
    text: 'Ten taps recorded.',
    likes: 12,
  };
  const restored = JSON.parse(JSON.stringify(selectPersistedState({
    cash: 500,
    chirps: boundedFeed,
    homePriority: milestone,
    homePrioritySecondsLeft: 20,
    homeReceipt: receipt,
    homeReceiptSecondsLeft: 20,
    notifs: [{ id: 'transient' }],
    overlay: { type: 'paywallResult' },
  }, BETA_TESTER)));

  assert.equal(restored.cash, 500);
  assert.equal('notifs' in restored, false);
  assert.equal('overlay' in restored, false);
  assert.equal('homePriority' in restored, false);
  assert.equal('homePrioritySecondsLeft' in restored, false);
  assert.deepEqual(restored.homeReceipt, receipt);
  assert.equal(restored.homeReceiptSecondsLeft, 20);
  assert.equal(
    selectHomeReaction({
      chirps: restored.chirps,
      priority: restored.homePriority,
      prioritySecondsLeft: restored.homePrioritySecondsLeft ?? 0,
      receipt: restored.homeReceipt,
      receiptSecondsLeft: restored.homeReceiptSecondsLeft,
      betaTester: BETA_TESTER,
    })?.id,
    receipt.id,
  );
  assert.equal(selectHomeReaction({
    chirps: restored.chirps,
    priority: undefined,
    prioritySecondsLeft: 0,
    receipt: restored.homeReceipt,
    receiptSecondsLeft: 0,
    betaTester: BETA_TESTER,
  }), undefined);

  const oldPin = selectPersistedState(
    { homeReactionId: 'old', homeReactionSecondsLeft: 20 },
    BETA_TESTER,
  );
  assert.equal(oldPin.homeReceipt, undefined);
  assert.equal(oldPin.homeReceiptSecondsLeft, 0);
  assert.equal('homeReactionId' in oldPin, false);
});

test('relaunch keeps ambient feed posts out of the prominent Home reaction', async () => {
  const { selectHomeReaction, selectPersistedState } = await loadExperience();
  const { BETA_TESTER } = await loadContent();
  const ambient = {
    id: 'affordability-nudge',
    who: BETA_TESTER[0],
    handle: BETA_TESTER[1],
    text: 'Claude just entered the budget.',
    likes: 12,
    kind: 'ambient',
  };
  const earned = {
    id: 'ten-taps',
    who: BETA_TESTER[0],
    handle: BETA_TESTER[1],
    kind: 'milestone',
    text: 'Ten taps recorded.',
    likes: 12,
  };
  const restored = JSON.parse(JSON.stringify(selectPersistedState({
    chirps: [ambient, earned],
    homePriority: earned,
    homePrioritySecondsLeft: 20,
  }, BETA_TESTER)));

  assert.deepEqual(restored.chirps, [ambient, earned]);
  assert.equal('homePriority' in restored, false);
  assert.equal(selectHomeReaction({
    chirps: restored.chirps,
    priority: restored.homePriority,
    prioritySecondsLeft: restored.homePrioritySecondsLeft ?? 0,
    receipt: restored.homeReceipt,
    receiptSecondsLeft: restored.homeReceiptSecondsLeft ?? 0,
    betaTester: BETA_TESTER,
  })?.id, earned.id);
  assert.equal(selectHomeReaction({
    chirps: [ambient],
    priority: undefined,
    prioritySecondsLeft: 0,
    receipt: undefined,
    receiptSecondsLeft: 0,
    betaTester: BETA_TESTER,
  }), undefined);
});

test('only durable receipts persist and matching priority layers expire together', async () => {
  const {
    advanceHomeReactionExposure,
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

  const milestone = { ...receipt, id: 'ten-taps', kind: 'milestone' };
  const exposedMilestone = advanceHomeReactionExposure({
    priority: milestone,
    prioritySecondsLeft: 20,
    receipt: undefined,
    receiptSecondsLeft: 0,
    displayedReactionId: milestone.id,
    elapsedSeconds: 20,
  });
  assert.deepEqual(exposedMilestone, {
    homePriority: undefined,
    homePrioritySecondsLeft: 0,
    homeReceipt: undefined,
    homeReceiptSecondsLeft: 0,
  });

  assert.deepEqual(advanceHomeReactionExposure({
    priority: receipt,
    prioritySecondsLeft: 20,
    receipt,
    receiptSecondsLeft: 20,
    displayedReactionId: 'stale-reaction',
    elapsedSeconds: 7,
  }), {
    homePriority: receipt,
    homePrioritySecondsLeft: 20,
    homeReceipt: receipt,
    homeReceiptSecondsLeft: 20,
  });
  assert.deepEqual(advanceHomeReactionExposure({
    priority: receipt,
    prioritySecondsLeft: 20,
    receipt,
    receiptSecondsLeft: 20,
    displayedReactionId: receipt.id,
    elapsedSeconds: 20,
  }), {
    homePriority: undefined,
    homePrioritySecondsLeft: 0,
    homeReceipt: undefined,
    homeReceiptSecondsLeft: 0,
  });
});

test('Home reaction exposure accumulates visible area on oversized accessibility cards', async () => {
  const { advanceHomeReactionExposure, verticalFrameExposureRate } = await loadExperience();
  const viewport = { y: 100, height: 400 };

  assert.equal(verticalFrameExposureRate(undefined, viewport), 0);
  assert.equal(verticalFrameExposureRate({ y: 180, height: 160 }, viewport), 1);
  assert.equal(verticalFrameExposureRate({ y: 20, height: 160 }, viewport), 0.5);
  assert.equal(verticalFrameExposureRate({ y: 500, height: 80 }, viewport), 0);
  assert.equal(verticalFrameExposureRate({ y: 100, height: 0 }, viewport), 0);
  assert.equal(verticalFrameExposureRate({ y: 390, height: 60 }, viewport, 80), 0.5);
  assert.equal(verticalFrameExposureRate({ y: 390, height: 60 }, viewport), 1);

  const partiallyExposed = {
    id: 'partial-reaction',
    who: 'Burnt Out Beta Tester',
    handle: '@burntoutbeta',
    kind: 'milestone',
  };
  assert.deepEqual(advanceHomeReactionExposure({
    priority: partiallyExposed,
    prioritySecondsLeft: 20,
    receipt: undefined,
    receiptSecondsLeft: 0,
    displayedReactionId: partiallyExposed.id,
    elapsedSeconds: 10 * 0.5,
  }), {
    homePriority: partiallyExposed,
    homePrioritySecondsLeft: 15,
    homeReceipt: undefined,
    homeReceiptSecondsLeft: 0,
  });

  const shortViewport = { y: 4000, height: 568 };
  const oversizedCard = { y: 0, height: 10000 };
  const exposureRate = verticalFrameExposureRate(oversizedCard, shortViewport, 104);
  assert.equal(exposureRate, 1);

  const receipt = {
    id: 'large-text-receipt',
    who: 'Burnt Out Beta Tester',
    handle: '@burntoutbeta',
    kind: 'paywall',
  };
  assert.deepEqual(advanceHomeReactionExposure({
    priority: receipt,
    prioritySecondsLeft: 20,
    receipt,
    receiptSecondsLeft: 20,
    displayedReactionId: receipt.id,
    elapsedSeconds: 20 * exposureRate,
  }), {
    homePriority: undefined,
    homePrioritySecondsLeft: 0,
    homeReceipt: undefined,
    homeReceiptSecondsLeft: 0,
  });
});

test('Home project copy and automation telemetry follow the latest real state', async () => {
  const { homeAutomationStatus, homeEmptyProjectCopy, homeProjectActionLabel } = await loadExperience();

  assert.equal(homeEmptyProjectCopy([]), 'Nothing shipped yet. Everyone starts at zero.');
  assert.equal(homeEmptyProjectCopy([{ live: true }]), 'The last launch is out in the world. The next idea is waiting.');
  assert.equal(homeEmptyProjectCopy([{ live: true }, { live: false }]), 'The last submission was rejected. The next idea is waiting.');
  assert.equal(homeAutomationStatus(6, { loc: 10, need: 100 }), 'AUTO 6 LOC/S · PROGRESS RUNS WHILE OPEN');
  assert.equal(homeAutomationStatus(6, { loc: 100, need: 100 }), undefined);
  assert.equal(homeAutomationStatus(6, null), undefined);
  assert.equal(homeProjectActionLabel(null), 'Open Code to start');
  assert.equal(homeProjectActionLabel({ loc: 10, need: 100 }), 'Continue coding');
  assert.equal(homeProjectActionLabel({ loc: 100, need: 100 }), 'Open Code to submit');
});

test('Home exposure persists at visibility boundaries, not shade coverage', async () => {
  const { homeExposureMeasurement } = await loadExperience();

  assert.deepEqual(homeExposureMeasurement('active', true, 1), { rate: 1, persist: false });
  assert.deepEqual(homeExposureMeasurement('active', true, 0), { rate: 0, persist: true });
  assert.deepEqual(homeExposureMeasurement('active', false, 1), { rate: 0, persist: false });
  assert.deepEqual(homeExposureMeasurement('background', true, 1), { rate: 0, persist: true });
  assert.deepEqual(homeExposureMeasurement('inactive', false, 0.5), { rate: 0, persist: true });
});

test('Home buffers measured exposure until a boundary or expiry', async () => {
  const { createHomeExposureBuffer, homeReactionSecondsAfterExposure } = await loadExperience();
  const expiryWrites = [];
  const expiry = createHomeExposureBuffer(20, 0, 1, seconds => expiryWrites.push(seconds));

  for (let second = 1; second < 20; second++) {
    expiry.sample(second * 1000, 1);
  }
  assert.deepEqual(expiryWrites, []);
  expiry.sample(20_000, 1);
  expiry.sample(21_000, 1);
  assert.deepEqual(expiryWrites, [20]);

  const hiddenWrites = [];
  const hidden = createHomeExposureBuffer(20, 0, 0.5, seconds => hiddenWrites.push(seconds));
  hidden.sample(10_000, 0);
  assert.deepEqual(hiddenWrites, []);
  hidden.flush();
  assert.deepEqual(hiddenWrites, [5]);

  const rateChangeWrites = [];
  const rateChanges = createHomeExposureBuffer(20, 0, 1, seconds => rateChangeWrites.push(seconds));
  rateChanges.sample(4_000, 0.5);
  rateChanges.sample(10_000, 0.25);
  rateChanges.sample(18_000, 0.25);
  assert.deepEqual(rateChangeWrites, []);
  rateChanges.flush();
  assert.deepEqual(rateChangeWrites, [9]);
  assert.equal(homeReactionSecondsAfterExposure(20, rateChangeWrites[0]), 11);
});

test('offline owner bonuses remain pending until definitive entitlement settlement', async () => {
  const {
    emptyPendingOwnerBonus,
    offlineEarningsTransition,
    parsePendingOwnerBonus,
    selectPersistedState,
    settlePendingOwnerBonus,
  } = await loadExperience();
  const { BETA_TESTER } = await loadContent();
  const empty = emptyPendingOwnerBonus();
  const launch = offlineEarningsTransition({
    mrr: 120,
    from: 0,
    until: 3_600_000,
    ownership: null,
    rememberedOwner: true,
    pendingOwnerBonus: empty,
  });

  assert.equal(launch.earned, 720);
  assert.deepEqual(launch.pendingOwnerBonus, { revision: 1, amount: 720 });
  const persisted = JSON.parse(JSON.stringify(selectPersistedState({
    cash: launch.earned,
    pendingOwnerBonus: launch.pendingOwnerBonus,
  }, BETA_TESTER)));
  assert.deepEqual(persisted.pendingOwnerBonus, launch.pendingOwnerBonus);

  const settlement = settlePendingOwnerBonus(
    parsePendingOwnerBonus(persisted.pendingOwnerBonus),
    true,
  );
  assert.deepEqual(settlement, {
    earned: 720,
    pendingOwnerBonus: { revision: 2, amount: 0 },
  });
  assert.deepEqual(settlePendingOwnerBonus(settlement.pendingOwnerBonus, true), {
    earned: 0,
    pendingOwnerBonus: settlement.pendingOwnerBonus,
  });

  const discarded = settlePendingOwnerBonus(launch.pendingOwnerBonus, false);
  assert.deepEqual(discarded, {
    earned: 0,
    pendingOwnerBonus: { revision: 2, amount: 0 },
  });
  assert.equal(settlePendingOwnerBonus(discarded.pendingOwnerBonus, true).earned, 0);
});

test('offline earnings aggregate unresolved intervals and validate persisted debt', async () => {
  const {
    emptyPendingOwnerBonus,
    offlineEarningsTransition,
    parsePendingOwnerBonus,
  } = await loadExperience();
  const first = offlineEarningsTransition({
    mrr: 120,
    from: 0,
    until: 61_000,
    ownership: null,
    rememberedOwner: true,
    pendingOwnerBonus: emptyPendingOwnerBonus(),
  });
  const second = offlineEarningsTransition({
    mrr: 120,
    from: 61_000,
    until: 122_000,
    ownership: null,
    rememberedOwner: true,
    pendingOwnerBonus: first.pendingOwnerBonus,
  });
  const confirmed = offlineEarningsTransition({
    mrr: 120,
    from: 0,
    until: 61_000,
    ownership: true,
    rememberedOwner: true,
    pendingOwnerBonus: emptyPendingOwnerBonus(),
  });
  const free = offlineEarningsTransition({
    mrr: 120,
    from: 0,
    until: 61_000,
    ownership: null,
    rememberedOwner: false,
    pendingOwnerBonus: emptyPendingOwnerBonus(),
  });

  assert.equal(first.earned, 12.2);
  assert.deepEqual(second.pendingOwnerBonus, { revision: 2, amount: 24.4 });
  assert.equal(confirmed.earned, 24.4);
  assert.deepEqual(confirmed.pendingOwnerBonus, emptyPendingOwnerBonus());
  assert.equal(free.earned, 12.2);
  assert.deepEqual(free.pendingOwnerBonus, emptyPendingOwnerBonus());
  assert.deepEqual(parsePendingOwnerBonus({ revision: 1, amount: 720 }), { revision: 1, amount: 720 });
  for (const malformed of [
    undefined,
    { amount: -1 },
    { amount: Infinity },
    { amount: Number.NaN },
  ]) {
    assert.deepEqual(parsePendingOwnerBonus(malformed), emptyPendingOwnerBonus());
  }
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

    const subcentOutcome = resolveGameEvent(event, { ...funded, cash: 0.002416 });
    assert.deepEqual(subcentOutcome.patch, { cash: 0 });
    assert.match(subcentOutcome.text, /-<\$0\.01\.$/);
    assert.match(subcentOutcome.chirpText, /-<\$0\.01\.$/);
    assert.equal(resolveGameEvent(event, { ...funded, cash: 0 }), undefined);
  }
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

  const unchanged = calculatePaywallTransaction({
    totalMrr: 167.42,
    mrrMult: 1,
    baseMrr: 40,
    previousMult: 0.98,
    picks: { price: 'same' },
    axes: [{ id: 'price', choices: [{ id: 'same', mult: 0.98, dark: 0 }] }],
  });
  assert.deepEqual(unchanged.delta, { before: 167.42, after: 167.42 });

  const roundedUnchanged = paywallResultPresentation({
    mult: 0.98,
    dark: 0,
    delta: { before: 167.42, after: 167.41999999999996 },
  });
  assert.equal(roundedUnchanged.direction, 'unchanged');
  assert.match(roundedUnchanged.body, /held steady/i);
  assert.equal(roundedUnchanged.receipt, 'MRR $167.42 → $167.42 (no change)');
});
