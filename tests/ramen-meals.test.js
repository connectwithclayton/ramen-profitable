const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { act, create } = require('react-test-renderer');

global.IS_REACT_ACT_ENVIRONMENT = true;
let saved = null;
const native = {
  Platform: { OS: 'android', select: options => options.android ?? options.default },
  StyleSheet: { create: value => value, hairlineWidth: 1, absoluteFill: {} },
  AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
  useWindowDimensions: () => ({ fontScale: 1 }),
  View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView',
  Animated: {
    Value: class {
      interpolate() { return '0deg'; }
    },
    View: 'AnimatedView',
    loop: () => ({ start() {} }),
    timing: () => ({}),
  },
  Easing: { linear: 'linear' },
};
const originalLoad = Module._load;
Module._load = function (name, parent, main) {
  if (name === 'react-native') return native;
  if (name === '@react-native-async-storage/async-storage') return {
    getItem: async () => saved,
    setItem: async (_key, value) => { saved = value; },
    removeItem: async () => { saved = null; },
  };
  if (name === 'expo-haptics') return {
    selectionAsync: async () => {},
    notificationAsync: async () => {},
    NotificationFeedbackType: { Success: 'success', Error: 'error' },
  };
  if (name === 'react-native-svg') return new Proxy(
    { __esModule: true, default: 'Svg' },
    { get: (obj, key) => obj[key] ?? String(key) },
  );
  if (name === '../components/PhoneBillboard') return { __esModule: true, default: () => null };
  if (name === '../monetization/purchases') return {
    initPurchases: async () => false,
    getPurchaseServiceStatus: () => 'unavailable',
    subscribePurchaseServiceStatus: () => () => {},
    restoreGoIndiePurchases: async () => false,
    presentGoIndiePaywall: async () => ({ status: 'cancelled' }),
  };
  return originalLoad(name, parent, main);
};
for (const ext of ['.ts', '.tsx']) Module._extensions[ext] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText, filename);
};

const { ACHIEVEMENTS, RAMEN_MILESTONES, RAMEN_ORDERS, SHOP } = require('../src/content/content.ts');
const { useGame } = require('../src/state/gameStore.ts');
const StoreScreen = require('../src/screens/StoreScreen.tsx').default;
const HomeScreen = require('../src/screens/HomeScreen.tsx').default;
const OverlayHost = require('../src/components/OverlayHost.tsx').default;

const allUpgrades = () => Object.fromEntries(SHOP.map(item => [item.id, true]));
const reset = () => useGame.setState(useGame.getInitialState(), true);
const visibleText = node => typeof node === 'string' ? node : node.children.map(visibleText).join('');
const textExists = (root, value) => root.findAllByType('Text').some(node => visibleText(node) === value);
const button = (root, label) => root.findAllByType('Pressable').find(node =>
  node.props.accessibilityLabel === label ||
  node.findAllByType('Text').some(text => visibleText(text) === label),
);
const press = async node => {
  assert.ok(node, 'action must be reachable');
  await act(async () => node.props.onPress());
};

test.beforeEach(async () => {
  saved = null;
  await useGame.persist.rehydrate();
  reset();
});

test('ramen unlocks only after all upgrades or resignation and keeps the exact price ladder', () => {
  assert.deepEqual(
    RAMEN_ORDERS.map(({ quantity, cost }) => [quantity, cost]),
    [[1, 20], [4, 80], [40, 800], [400, 8000], [4000, 80000]],
  );

  useGame.getState().openRamenPurchase(1);
  assert.equal(useGame.getState().overlay, null);

  useGame.setState({ upgrades: { ...allUpgrades(), [SHOP[0].id]: false } });
  useGame.getState().openRamenPurchase(4);
  assert.equal(useGame.getState().overlay, null);

  useGame.setState({ upgrades: allUpgrades() });
  useGame.getState().openRamenPurchase(40);
  assert.deepEqual(useGame.getState().overlay, { type: 'ramenPurchase', quantity: 40, cost: 800 });

  reset();
  useGame.setState({ hasJob: false });
  useGame.getState().openRamenPurchase(4000);
  assert.deepEqual(useGame.getState().overlay, { type: 'ramenPurchase', quantity: 4000, cost: 80000 });
  useGame.getState().dismissOverlay();
  useGame.getState().openRamenPurchase(2);
  assert.equal(useGame.getState().overlay, null, 'only authored quantities can be quoted');
});

test('Store reveals repeatable meal controls at eligibility and quotes exact totals before commit', async t => {
  let view;
  await act(async () => { view = create(React.createElement(StoreScreen)); });
  t.after(async () => { await act(async () => view.unmount()); });
  assert.ok(textExists(view.root, 'Ramen run'));
  assert.ok(textExists(view.root, 'LOCKED'));
  assert.ok(textExists(view.root, 'Buy all 7 upgrades or quit your day job to unlock fictional ramen.'));
  assert.ok(textExists(view.root, '7 UPGRADES LEFT · OR QUIT YOUR DAY JOB'));

  await act(async () => useGame.setState({ upgrades: allUpgrades(), cash: 80000.25 }));
  assert.ok(textExists(view.root, 'UNLOCKED'));
  assert.ok(textExists(view.root, 'Fictional game cash only. No real meals or donations. Every $20 records one in-game meal and adds zero MRR.'));
  assert.ok(textExists(view.root, 'NEXT MILESTONE · 4 MEALS · 4 TO GO'));
  for (const order of RAMEN_ORDERS) {
    const meals = order.quantity === 1 ? 'meal' : 'meals';
    assert.ok(button(
      view.root,
      `Review ${order.quantity.toLocaleString()} fictional ramen ${meals} for $${order.cost.toLocaleString()} game cash.`,
    ));
  }

  await press(button(view.root, 'Review 4,000 fictional ramen meals for $80,000 game cash.'));
  assert.deepEqual(useGame.getState().overlay, { type: 'ramenPurchase', quantity: 4000, cost: 80000 });

  let overlay;
  await act(async () => { overlay = create(React.createElement(OverlayHost, { onReturnHome() {} })); });
  t.after(async () => { await act(async () => overlay.unmount()); });
  assert.equal(overlay.root.findAllByType('ScrollView').length, 1, 'the complete transaction is viewport-scrollable');
  assert.ok(overlay.root.findByProps({ accessibilityLabel: 'Total: $80,000.' }));
  assert.ok(overlay.root.findByProps({ accessibilityLabel: 'Cash after: $0.25.' }));
  assert.ok(overlay.root.findByProps({ accessibilityLabel: 'Lifetime after: 4,000 meals.' }));
  assert.ok(textExists(overlay.root, '$80,000'));
  assert.ok(textExists(overlay.root, '$0.25'));
  assert.ok(textExists(overlay.root, '4,000 MEALS'));
  assert.equal(
    button(overlay.root, 'Confirm recording 4,000 fictional ramen meals for $80,000 game cash. $0.25 game cash will remain.').props.accessibilityState.disabled,
    false,
  );

  assert.ok(textExists(overlay.root, 'Fictional game cash only. No real meals or donations. This optional in-game record adds no income, energy, or other gameplay boost.'));
  await press(button(overlay.root, 'Not tonight'));
  assert.equal(useGame.getState().cash, 80000.25);
  assert.equal(useGame.getState().mealsFunded, 0);
  assert.equal(useGame.getState().chirps.length, 0);
});

test('purchases are repeatable, atomic, consolidated, and safe when funds change', () => {
  useGame.setState({ hasJob: false, cash: 160.5, mrr: 123, energy: 17 });

  useGame.getState().openRamenPurchase(4);
  assert.equal(useGame.getState().fundRamen(), true);
  assert.equal(useGame.getState().cash, 80.5);
  assert.equal(useGame.getState().mealsFunded, 4);
  assert.equal(useGame.getState().mrr, 123);
  assert.equal(useGame.getState().energy, 17);
  assert.equal(useGame.getState().chirps.length, 1);
  assert.match(useGame.getState().chirps[0].text, /4 fictional ramen meals recorded, 4 lifetime, \$80\.5 game cash left/);

  assert.equal(useGame.getState().fundRamen(), false, 'the consumed confirmation cannot double commit');
  assert.equal(useGame.getState().cash, 80.5);
  assert.equal(useGame.getState().chirps.length, 1);

  useGame.getState().openRamenPurchase(4);
  assert.equal(useGame.getState().fundRamen(), true);
  assert.equal(useGame.getState().cash, 0.5);
  assert.equal(useGame.getState().mealsFunded, 8);
  assert.equal(useGame.getState().chirps.length, 2, 'each purchase emits exactly one receipt');

  useGame.getState().openRamenPurchase(1);
  assert.equal(useGame.getState().fundRamen(), false);
  assert.equal(useGame.getState().cash, 0.5);
  assert.equal(useGame.getState().mealsFunded, 8);
  assert.equal(useGame.getState().overlay.type, 'ramenPurchase', 'failed commits remain inspectable and cancellable');

  reset();
  useGame.setState({ hasJob: false, cash: Number.MAX_SAFE_INTEGER });
  useGame.getState().openRamenPurchase(4000);
  assert.equal(useGame.getState().fundRamen(), true);
  assert.equal(useGame.getState().cash, Number.MAX_SAFE_INTEGER - 80000);
  assert.equal(Number.isSafeInteger(useGame.getState().cash), true);
});

test('meal totals cross every permanent milestone without multiplying Chirp receipts', () => {
  useGame.setState({ hasJob: false, cash: 800000 });
  for (let purchase = 1; purchase <= 10; purchase++) {
    useGame.getState().openRamenPurchase(4000);
    assert.equal(useGame.getState().fundRamen(), true);
    assert.equal(useGame.getState().chirps.length, purchase);
  }

  assert.equal(useGame.getState().mealsFunded, 40000);
  assert.equal(useGame.getState().cash, 0);
  for (const milestone of RAMEN_MILESTONES) {
    assert.equal(useGame.getState().achievements[milestone.id], true);
    assert.ok(ACHIEVEMENTS.some(achievement => achievement.id === milestone.id));
  }
  assert.equal(
    Object.keys(useGame.getState().achievements).filter(id => id.startsWith('ramen_meals_')).length,
    RAMEN_MILESTONES.length,
  );
  assert.equal(useGame.getState().chirps[0].event, 'RAMEN MILESTONE · 40,000 MEALS');
  assert.equal(useGame.getState().homeReceipt.id, useGame.getState().chirps[0].id);
});

test('meal totals and receipt achievements survive relaunch while old saves default to zero', async () => {
  useGame.setState({ hasJob: false, cash: 1000 });
  useGame.getState().openRamenPurchase(40);
  assert.equal(useGame.getState().fundRamen(), true);
  await new Promise(resolve => setImmediate(resolve));
  const fundedSave = saved;
  assert.ok(fundedSave);

  reset();
  saved = fundedSave;
  await useGame.persist.rehydrate();
  assert.equal(useGame.getState().mealsFunded, 40);
  assert.equal(useGame.getState().achievements.ramen_meals_4, true);
  assert.equal(useGame.getState().achievements.ramen_meals_40, true);
  assert.match(useGame.getState().chirps[0].text, /40 fictional ramen meals recorded/);

  reset();
  saved = JSON.stringify({
    state: { cash: 4321, hasJob: true, upgrades: { coffee: true }, achievements: { first_ship: true } },
    version: 5,
  });
  await useGame.persist.rehydrate();
  assert.equal(useGame.getState().cash, 4321);
  assert.equal(useGame.getState().upgrades.coffee, true);
  assert.equal(useGame.getState().achievements.first_ship, true);
  assert.equal(useGame.getState().mealsFunded, 0);
});

test('final upgrade and resignation reveal the existing ramen run without changing eligibility', () => {
  const lastUpgrade = SHOP.at(-1);
  const upgrades = allUpgrades();
  delete upgrades[lastUpgrade.id];
  useGame.setState({ upgrades, cash: lastUpgrade.cost, notifs: [] });
  useGame.getState().buy(lastUpgrade.id);
  assert.ok(useGame.getState().notifs.some(notif => notif.text === 'Ramen run unlocked in Store.'));

  reset();
  useGame.setState({ mrr: 2000, notifs: [] });
  useGame.getState().quitJob();
  assert.ok(useGame.getState().notifs.some(notif => notif.text === 'Ramen run unlocked in Store.'));
});

test('Home puts its actionable next step above passive fictional meal recognition', async t => {
  useGame.setState({
    mealsFunded: 40000,
    achievements: { ramen_meals_40000: true },
    apps: [{
      id: 'needs-paywall', name: 'PlantParent', idea: 'guilt-based plant care', live: true,
      baseMrr: 100, mult: 1, dark: 0, hasPaywall: false,
    }],
  });
  let view;
  await act(async () => {
    view = create(React.createElement(HomeScreen, { bottomOcclusion: 80, onOpenCode() {} }));
  });
  t.after(async () => { await act(async () => view.unmount()); });
  assert.ok(view.root.findByProps({ accessibilityLabel: '40,000 fictional ramen meals recorded over your lifetime.' }));
  assert.ok(textExists(view.root, 'per game day, soul-crushing'));
  assert.ok(textExists(view.root, '40,000 FICTIONAL RAMEN MEALS · LIFETIME'));
  const homeText = visibleText(view.root);
  assert.ok(
    homeText.indexOf('Next step') < homeText.indexOf('40,000 FICTIONAL RAMEN MEALS · LIFETIME'),
    'the actionable free setup must precede passive lifetime recognition',
  );
  assert.ok(view.root.findByProps({
    accessibilityLabel: `Ramen Endowment. Unlocked. ${ACHIEVEMENTS.find(a => a.id === 'ramen_meals_40000').desc}`,
  }));
});
