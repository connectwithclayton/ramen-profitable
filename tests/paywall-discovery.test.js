const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { act, create } = require('react-test-renderer');

global.IS_REACT_ACT_ENVIRONMENT = true;
let saved = null;
let purchases = 0;
const native = {
  Platform: { OS: 'ios', select: options => options.ios ?? options.default },
  StyleSheet: { create: value => value, hairlineWidth: 1 },
  AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
  useWindowDimensions: () => ({ fontScale: 1 }),
  View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView',
};
const originalLoad = Module._load;
Module._load = function (name, parent, main) {
  if (name === 'react-native') return native;
  if (name === '@react-native-async-storage/async-storage') return {
    getItem: async () => saved,
    setItem: async (_key, value) => { saved = value; },
  };
  if (name === 'expo-haptics') return {
    selectionAsync: async () => {}, notificationAsync: async () => {}, NotificationFeedbackType: {},
  };
  if (name === 'react-native-svg') return new Proxy(
    { __esModule: true, default: 'Svg' }, { get: (obj, key) => obj[key] ?? String(key) },
  );
  if (name === '../monetization/purchases') return {
    presentGoIndiePaywall: async () => { purchases++; return false; },
  };
  return originalLoad(name, parent, main);
};
for (const ext of ['.ts', '.tsx']) Module._extensions[ext] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText, filename);
};
const { useGame } = require('../src/state/gameStore.ts');
const HomeScreen = require('../src/screens/HomeScreen.tsx').default;
const OverlayHost = require('../src/components/OverlayHost.tsx').default;
const { PAYWALL_AXES } = require('../src/content/content.ts');

const app = (id, patch = {}) => ({
  id, name: 'PlantParent', idea: 'guilt-based plant care', live: true,
  baseMrr: 100, mult: 1, dark: 0, hasPaywall: false, ...patch,
});
const buttons = root => root.findAllByType('Pressable');
const button = (root, label) => buttons(root).find(node => node.props.accessibilityLabel === label ||
  node.findAllByType('Text').some(text => text.props.children === label));
const setup = root => button(root, 'Set up paywall');
const press = async node => { assert.ok(node, 'action must be reachable'); await act(async () => node.props.onPress()); };
const completePaywall = async view => {
  for (const axis of PAYWALL_AXES) {
    await press(button(view.root, `${axis.choices[0].label}, heat ${axis.choices[0].dark}`));
  }
};

async function render(t, initialTab = 'home') {
  function Scene() {
    const [tab, setTab] = React.useState(initialTab);
    return React.createElement(React.Fragment, null,
      tab === 'home' && React.createElement(HomeScreen, { bottomOcclusion: 76, onOpenCode() {} }),
      React.createElement(OverlayHost, { onReturnHome: () => setTab('home') }),
    );
  }
  let view;
  await act(async () => { view = create(React.createElement(Scene)); });
  t.after(async () => { await act(async () => view.unmount()); });
  return view;
}

test.beforeEach(async () => {
  await useGame.persist.rehydrate();
  useGame.setState(useGame.getInitialState(), true);
  purchases = 0;
});

function approveProject() {
  useGame.setState({
    rejectShield: 0,
    project: { name: 'PlantParent', idea: 'guilt-based plant care', loc: 300, need: 300, manualTaps: 100, depletionReactionDelivered: false },
  });
  useGame.getState().submitToReview();
  assert.equal(useGame.getState().overlay.type, 'review');
  useGame.getState().resolveReview();
  assert.equal(useGame.getState().overlay.ok, true);
}

test('approval offers accessible free setup for the exact newly approved app, not its namesake', async t => {
  useGame.setState({ apps: [app('older-same-name')], cash: 0 });
  approveProject();
  const approved = useGame.getState().apps[1];
  assert.equal(useGame.getState().overlay.appId, approved.id);
  const view = await render(t, 'code');
  const action = setup(view.root);
  assert.equal(action.props.accessibilityRole, 'button');
  assert.equal(action.props.accessibilityLabel, 'Set up paywall for PlantParent. Free in-game design.');
  assert.equal(action.props.accessibilityState.disabled, false);
  assert.ok(view.root.findAllByType('View').some(node => node.props.accessibilityViewIsModal));
  await press(action);
  assert.deepEqual(useGame.getState().overlay, { type: 'paywallDesigner', appId: approved.id });
  assert.equal(useGame.getState().cash, 0);
  assert.equal(purchases, 0);
  await press(button(view.root, 'Never mind'));
  assert.equal(useGame.getState().overlay, null);
  assert.ok(view.root.findAllByType(HomeScreen).length, 'cancel returns to Home');
  assert.ok(setup(view.root), 'setup remains available after cancellation');
});

test('Continue remains purchase-free and Home keeps setup discoverable after relaunch', async t => {
  approveProject();
  const view = await render(t, 'code');
  await press(button(view.root, 'Continue to Home'));
  assert.equal(useGame.getState().overlay, null);
  assert.equal(purchases, 0);
  assert.ok(setup(view.root));
  const persisted = saved;
  await act(async () => {
    useGame.setState(useGame.getInitialState(), true);
    saved = persisted;
    await useGame.persist.rehydrate();
  });
  assert.ok(setup(view.root), 'returning players need no new approval or persisted tutorial flag');
  await press(setup(view.root));
  assert.equal(useGame.getState().overlay.type, 'paywallDesigner');
  assert.equal(purchases, 0);
});

test('pending setup skips rejected/configured apps, advances to the next app and clears after shipping', async t => {
  useGame.setState({
    apps: [app('rejected', { live: false }), app('configured', { hasPaywall: true }), app('pending'), app('next')],
    cash: 0, mrr: 300,
  });
  const view = await render(t);
  await press(setup(view.root));
  assert.equal(useGame.getState().overlay.appId, 'pending');
  const incomplete = button(view.root, 'Pick one from each row');
  assert.equal(incomplete.props.accessibilityState.disabled, true);
  await completePaywall(view);
  await press(button(view.root, 'Ship this paywall'));
  assert.equal(useGame.getState().apps.find(a => a.id === 'pending').hasPaywall, true);
  await press(button(view.root, 'Watch the numbers'));
  await press(setup(view.root));
  assert.equal(useGame.getState().overlay.appId, 'next');
  await act(async () => {
    useGame.getState().applyPaywall('next', Object.fromEntries(PAYWALL_AXES.map(axis => [axis.id, axis.choices[0].id])));
    useGame.getState().dismissOverlay();
  });
  assert.equal(setup(view.root), undefined);
  assert.equal(purchases, 0);
  assert.equal(useGame.getState().cash, 0);
});

test('opening and cancelling an existing paywall inspection is free', async t => {
  useGame.setState({ apps: [app('configured', { hasPaywall: true })], cash: 100 });
  const view = await render(t);
  const openDesigner = buttons(view.root).find(node => node.props.accessibilityLabel?.includes('Run an A/B test'));
  assert.match(openDesigner.props.accessibilityHint, /designer for free/);

  await press(openDesigner);
  assert.deepEqual(useGame.getState().overlay, { type: 'paywallDesigner', appId: 'configured' });
  assert.equal(useGame.getState().cash, 100);
  assert.ok(view.root.findAllByType('View').some(node => node.props.accessibilityLabel ===
    'A/B test fee $75. Charged only when you run the test.'));
  assert.ok(button(view.root, 'Never mind'), 'the free inspection remains cancellable');

  await press(button(view.root, 'Never mind'));
  assert.equal(useGame.getState().overlay, null);
  assert.equal(useGame.getState().cash, 100);
});

test('an unaffordable A/B commit stays open and charges nothing', async t => {
  useGame.setState({ apps: [app('configured', { hasPaywall: true })], cash: 74 });
  const view = await render(t);
  await press(buttons(view.root).find(node => node.props.accessibilityLabel?.includes('Run an A/B test')));
  await completePaywall(view);

  const commit = button(view.root, 'Run A/B test · $75');
  assert.equal(commit.props.accessibilityLabel, 'Run A/B test for $75');
  assert.ok(view.root.findAllByType('Text').some(node => node.props.children === '$1 more cash needed. Opening and leaving are free.'));
  await press(commit);

  assert.deepEqual(useGame.getState().overlay, { type: 'paywallDesigner', appId: 'configured' });
  assert.equal(useGame.getState().cash, 74);
  assert.ok(useGame.getState().notifs.some(notif => notif.text.includes('cost $75')));
});

test('a committed repeat A/B test charges exactly $75', async t => {
  useGame.setState({ apps: [app('configured', { hasPaywall: true })], cash: 100, mrr: 100 });
  const view = await render(t);
  await press(buttons(view.root).find(node => node.props.accessibilityLabel?.includes('Run an A/B test')));
  await completePaywall(view);
  await press(button(view.root, 'Run A/B test · $75'));

  assert.equal(useGame.getState().cash, 25);
  assert.equal(useGame.getState().mrr, 81, 'the existing paywall conversion math is unchanged');
  assert.equal(useGame.getState().overlay.type, 'paywallResult');
  assert.equal(useGame.getState().chirps.filter(chirp => chirp.kind === 'paywall').length, 1);
});

test('repeated A/B commit callbacks cannot double-charge', async t => {
  useGame.setState({ apps: [app('configured', { hasPaywall: true })], cash: 200, mrr: 100 });
  const view = await render(t);
  await press(buttons(view.root).find(node => node.props.accessibilityLabel?.includes('Run an A/B test')));
  await completePaywall(view);
  const commit = button(view.root, 'Run A/B test · $75').props.onPress;

  await act(async () => {
    assert.equal(commit(), true);
    assert.equal(commit(), false);
  });

  assert.equal(useGame.getState().cash, 125);
  assert.equal(useGame.getState().chirps.filter(chirp => chirp.kind === 'paywall').length, 1);
});

test('new or rejected-only players have no setup cue', async t => {
  const view = await render(t);
  assert.equal(setup(view.root), undefined);
  await act(async () => {
    useGame.setState({
      rejectShield: 4,
      project: { name: 'PlantParent', idea: 'plants', loc: 300, need: 300 },
    });
    useGame.getState().submitToReview();
    useGame.getState().resolveReview();
  });
  assert.equal(useGame.getState().overlay.ok, false);
  assert.equal(setup(view.root), undefined);
  await press(button(view.root, 'Grieve, then rebuild'));
  assert.equal(setup(view.root), undefined);
});

test('Go Indie remains a separate, deliberate purchase path', async t => {
  approveProject();
  const view = await render(t, 'code');
  assert.equal(purchases, 0);
  await press(button(view.root, 'Go Indie'));
  assert.equal(useGame.getState().overlay.type, 'paywall');
  assert.equal(purchases, 0, 'approval action only opens the existing Go Indie explanation');
  await press(button(view.root, 'Go Indie'));
  assert.equal(purchases, 1, 'only explicit Go Indie confirmation calls the purchase SDK');
  assert.equal(useGame.getState().apps[0].hasPaywall, false);
});
