const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { act, create } = require('react-test-renderer');

global.IS_REACT_ACT_ENVIRONMENT = true;
const native = {
  Platform: { OS: 'ios', select: options => options.ios ?? options.default },
  StyleSheet: { create: value => value, hairlineWidth: 1 },
  AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
  View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView',
};
const originalLoad = Module._load;
Module._load = function (name, parent, main) {
  if (name === 'react-native') return native;
  if (name === '@react-native-async-storage/async-storage') return {
    getItem: async () => null,
    setItem: async () => {},
  };
  if (name === 'react-native-svg') return new Proxy(
    { __esModule: true, default: 'Svg' },
    { get: (obj, key) => obj[key] ?? String(key) },
  );
  return originalLoad(name, parent, main);
};
for (const ext of ['.ts', '.tsx']) Module._extensions[ext] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText, filename);
};

const { ACHIEVEMENTS, MRR_GOAL, PAYWALL_AXES } = require('../src/content/content.ts');
const { useGame } = require('../src/state/gameStore.ts');
const HomeScreen = require('../src/screens/HomeScreen.tsx').default;
const reset = () => useGame.setState(useGame.getInitialState(), true);
const app = id => ({ id, name: 'Test app', idea: 'Test idea', live: true, baseMrr: 40, mult: 1, dark: 0, hasPaywall: false });
const project = { name: 'Test app', idea: 'Test idea', loc: 100, need: 100, manualTaps: 34, depletionReactionDelivered: false };

function visibleText(node) {
  return typeof node === 'string' ? node : node.children.map(visibleText).join('');
}

for (const state of ['locked', 'mixed', 'unlocked']) {
  test(`Home explains every achievement in the ${state} state, visually and to assistive technology`, async () => {
    await useGame.persist.rehydrate();
    reset();
    const achievements = Object.fromEntries(ACHIEVEMENTS.map((a, i) => [a.id, state === 'unlocked' || (state === 'mixed' && i % 2 === 0)]));
    useGame.setState({ achievements });
    let tree;
    await act(async () => {
      tree = create(React.createElement(HomeScreen, { bottomOcclusion: 80, onOpenCode() {} }));
    });
    try {
      for (const a of ACHIEVEMENTS) {
        const status = achievements[a.id] ? 'Unlocked' : 'Locked';
        const row = tree.root.findByProps({ accessibilityLabel: `${a.name}. ${status}. ${a.desc}` });
        assert.equal(row.props.accessible, true);
        assert.equal(row.props.onPress, undefined, 'criteria must not require discovering a tap target');
        assert.equal(row.props.accessibilityState?.disabled, undefined, 'locked achievements are still readable');
        const texts = row.findAllByType('Text');
        assert.ok(texts.some(text => visibleText(text) === a.name));
        assert.ok(texts.some(text => visibleText(text) === a.desc));
        assert.ok(texts.some(text => visibleText(text) === status.toUpperCase()));
        for (const text of texts) {
          assert.equal(text.props.numberOfLines, undefined, 'text can wrap on small screens');
          assert.notEqual(text.props.allowFontScaling, false, 'text respects Dynamic Type');
        }
      }
      const count = Object.values(achievements).filter(Boolean).length;
      assert.ok(tree.root.findAllByType('Text').some(text => visibleText(text) === `${count} / ${ACHIEVEMENTS.length}`));
      await act(async () => { useGame.getState().unlock('portfolio'); });
      assert.equal(tree.root.findByProps({
        accessibilityLabel: `Portfolio Guy. Unlocked. ${ACHIEVEMENTS.find(a => a.id === 'portfolio').desc}`,
      }).props.accessible, true);
    } finally {
      await act(async () => { tree.unmount(); });
    }
  });
}

test('revenue criteria name the real thresholds and quitting is a separate action', () => {
  reset();
  for (const [mrr, earned] of [[99, []], [100, ['mrr_100']], [999, ['mrr_100']], [1000, ['mrr_100', 'mrr_1000']]]) {
    useGame.setState({ mrr });
    useGame.getState().slowTick();
    assert.deepEqual(Object.keys(useGame.getState().achievements).sort(), earned.sort());
  }
  assert.match(ACHIEVEMENTS.find(a => a.id === 'mrr_100').desc, /\$100 in monthly recurring revenue/);
  assert.match(ACHIEVEMENTS.find(a => a.id === 'mrr_1000').desc, /\$1,000 in monthly recurring revenue/);
  assert.ok(ACHIEVEMENTS.find(a => a.id === 'ramen').desc.includes(`$${MRR_GOAL.toLocaleString('en-US')}`));
  useGame.setState({ mrr: MRR_GOAL - 1 });
  useGame.getState().quitJob();
  assert.equal(useGame.getState().achievements.ramen, undefined);
  useGame.setState({ mrr: MRR_GOAL });
  useGame.getState().slowTick();
  assert.equal(useGame.getState().achievements.ramen, undefined);
  useGame.getState().quitJob();
  assert.equal(useGame.getState().achievements.ramen, true);
  assert.equal(useGame.getState().hasJob, false);
});

test('App Review and three simultaneously live apps retain their unlock conditions', () => {
  reset();
  const random = Math.random;
  try {
    Math.random = () => 0;
    useGame.setState({ project });
    useGame.getState().resolveReview();
    assert.equal(useGame.getState().achievements.first_reject, true);
    assert.equal(useGame.getState().achievements.first_ship, undefined);
    Math.random = () => 0.9;
    for (let live = 1; live <= 3; live++) {
      useGame.setState({ project });
      useGame.getState().resolveReview();
      assert.equal(useGame.getState().achievements.first_ship, true);
      assert.equal(useGame.getState().achievements.portfolio, live === 3 ? true : undefined);
    }
  } finally {
    Math.random = random;
  }
});

test('paywall descriptions reflect exact heat conditions, without changing the payoff', () => {
  // Select real catalog choices for each heat boundary rather than bypassing the transaction.
  let combinations = [{ picks: {}, heat: 0, mult: 1 }];
  for (const axis of PAYWALL_AXES) {
    combinations = combinations.flatMap(combo => axis.choices.map(choice => ({
      picks: { ...combo.picks, [axis.id]: choice.id },
      heat: combo.heat + choice.dark,
      mult: combo.mult * choice.mult,
    })));
  }
  for (const heat of [0, 1, 4, 5, 6]) {
    reset();
    const combo = combinations.find(combo => combo.heat === heat);
    assert.ok(combo, `catalog supports heat ${heat}`);
    useGame.setState({ apps: [app('test')], mrr: 40 });
    useGame.getState().openPaywallDesigner('test');
    useGame.getState().applyPaywall('test', combo.picks);
    const result = useGame.getState();
    assert.equal(result.achievements.paywall_first, true);
    assert.equal(result.achievements.saint, heat === 0 ? true : undefined);
    assert.equal(result.achievements.dark_side, heat >= 5 ? true : undefined);
    assert.equal(result.apps[0].dark, heat);
    const expectedMult = Math.round(combo.mult * 100) / 100;
    assert.equal(result.apps[0].mult, expectedMult);
    assert.equal(result.mrr, 40 * expectedMult);
  }
  assert.match(ACHIEVEMENTS.find(a => a.id === 'dark_side').desc, /heat 5 or higher/);
  assert.match(ACHIEVEMENTS.find(a => a.id === 'saint').desc, /heat 0/);
});

test('unlocking remains idempotent and does not award cash or revenue', () => {
  reset();
  const { cash, mrr } = useGame.getState();
  for (const a of ACHIEVEMENTS) useGame.getState().unlock(a.id);
  const { notifs } = useGame.getState();
  for (const a of ACHIEVEMENTS) useGame.getState().unlock(a.id);
  assert.equal(useGame.getState().cash, cash);
  assert.equal(useGame.getState().mrr, mrr);
  assert.deepEqual(useGame.getState().notifs, notifs);
  assert.equal(Object.keys(useGame.getState().achievements).length, ACHIEVEMENTS.length);
});
