const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { act, create } = require('react-test-renderer');

global.IS_REACT_ACT_ENVIRONMENT = true;
let saved = null;
let serviceStatus = 'checking';
let purchaseOutcome = { status: 'cancelled' };
let restoreOutcome = false;
const serviceListeners = new Set();
const native = {
  Platform: { OS: 'ios', select: options => options.ios ?? options.default },
  StyleSheet: { create: value => value, hairlineWidth: 1, absoluteFill: {} },
  AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
  View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView',
  Animated: {
    Value: class { interpolate() { return '0deg'; } },
    View: 'AnimatedView',
    loop: () => ({ start() {} }),
    timing: () => ({}),
  },
  Easing: { linear: 'linear' },
};
const purchasesMock = {
  initPurchases: async () => serviceStatus === 'available',
  getPurchaseServiceStatus: () => serviceStatus,
  subscribePurchaseServiceStatus: listener => {
    serviceListeners.add(listener);
    return () => serviceListeners.delete(listener);
  },
  restoreGoIndiePurchases: async () => restoreOutcome,
  presentGoIndiePaywall: async () => purchaseOutcome,
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
  if (name === '../monetization/purchases') return purchasesMock;
  return originalLoad(name, parent, main);
};
for (const ext of ['.ts', '.tsx']) Module._extensions[ext] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText, filename);
};

const { useGame } = require('../src/state/gameStore.ts');
const StoreScreen = require('../src/screens/StoreScreen.tsx').default;
const OverlayHost = require('../src/components/OverlayHost.tsx').default;

const visibleText = node => typeof node === 'string'
  ? node
  : node.children.map(visibleText).join('');
const textIncludes = (root, value) => root.findAllByType('Text')
  .some(node => visibleText(node).includes(value));
const button = (root, label) => root.findAllByType('Pressable').find(node =>
  node.props.accessibilityLabel === label ||
  node.findAllByType('Text').some(text => visibleText(text) === label),
);
const press = async node => {
  assert.ok(node, 'action must be reachable');
  await act(async () => node.props.onPress());
};
const setServiceStatus = async status => {
  serviceStatus = status;
  await act(async () => {
    for (const listener of serviceListeners) listener();
  });
};

test.beforeEach(async () => {
  saved = null;
  serviceStatus = 'checking';
  purchaseOutcome = { status: 'cancelled' };
  restoreOutcome = false;
  await useGame.persist.rehydrate();
  useGame.setState(useGame.getInitialState(), true);
});

test('mounted Store distinguishes checking, unavailable, free, and confirmed ownership', async t => {
  let view;
  await act(async () => { view = create(React.createElement(StoreScreen)); });
  t.after(async () => { await act(async () => view.unmount()); });

  assert.ok(textIncludes(view.root, 'CHECKING'));
  assert.equal(button(view.root, 'Checking purchase status').props.accessibilityState.disabled, true);

  await setServiceStatus('unavailable');
  assert.ok(textIncludes(view.root, 'UNAVAILABLE'));
  assert.ok(button(view.root, 'Try Go Indie'));

  await act(async () => useGame.setState({ goIndieResolved: true, goIndieActive: false }));
  await setServiceStatus('available');
  assert.ok(textIncludes(view.root, 'FREE PLAYER'));
  assert.ok(button(view.root, 'View App Store price'));
  assert.ok(textIncludes(view.root, 'Optional one-time purchase with real money'));
  assert.ok(textIncludes(view.root, 'does not quit your character'));
  assert.ok(textIncludes(view.root, 'up to 8 hours'));
  assert.ok(textIncludes(view.root, 'current local price'));
  assert.ok(textIncludes(view.root, 'does not restore local game progress'));

  await act(async () => useGame.setState({ goIndieActive: true }));
  assert.ok(textIncludes(view.root, 'CONFIRMED OWNED'));
  assert.ok(textIncludes(view.root, 'Go Indie is confirmed active'));
  assert.equal(button(view.root, 'View App Store price'), undefined);
});

test('Restore Purchases explains and reports its existing-purchase-only outcomes', async t => {
  serviceStatus = 'available';
  useGame.setState({
    goIndieResolved: true,
    goIndieActive: false,
    cash: 321,
    mealsFunded: 4,
    notifs: [],
  });
  let view;
  await act(async () => { view = create(React.createElement(StoreScreen)); });
  t.after(async () => { await act(async () => view.unmount()); });

  await press(button(view.root, 'Restore Purchases'));
  assert.ok(useGame.getState().notifs.some(notif =>
    notif.text === 'No Go Indie purchase was found for this store account.',
  ));
  assert.equal(useGame.getState().cash, 321);
  assert.equal(useGame.getState().mealsFunded, 4);

  restoreOutcome = null;
  await press(button(view.root, 'Restore Purchases'));
  assert.ok(useGame.getState().notifs.some(notif =>
    notif.text === 'The App Store could not check existing purchases. Try again later.',
  ));

  restoreOutcome = true;
  await press(button(view.root, 'Restore Purchases'));
  assert.ok(useGame.getState().notifs.some(notif =>
    notif.text === 'Existing Go Indie purchase restored and confirmed.',
  ));
});

test('mounted purchase surface reports cancellation, catalog, service, and confirmation outcomes', async t => {
  serviceStatus = 'available';
  useGame.setState({ overlay: { type: 'paywall' }, goIndieResolved: true, goIndieActive: false });
  let view;
  await act(async () => { view = create(React.createElement(OverlayHost, { onReturnHome() {} })); });
  t.after(async () => { await act(async () => view.unmount()); });

  assert.ok(textIncludes(view.root, 'one-time purchase'));
  assert.ok(textIncludes(view.root, 'current local price'));
  assert.equal(textIncludes(view.root, 'RevenueCat'), false);

  purchaseOutcome = { status: 'cancelled' };
  await press(button(view.root, 'View price and purchase'));
  assert.equal(useGame.getState().overlay, null);
  assert.ok(useGame.getState().notifs.some(notif => notif.text === 'Purchase cancelled. Nothing was changed.'));

  const cases = [
    ['catalog-unavailable', 'Go Indie is not available from the App Store right now.'],
    ['service-error', 'The App Store could not complete that request.'],
    ['entitlement-unconfirmed', 'Go Indie could not be confirmed. No paid benefits were activated.'],
  ];
  for (const [status, message] of cases) {
    await act(async () => useGame.setState({ overlay: { type: 'paywall' } }));
    purchaseOutcome = { status };
    await press(button(view.root, 'View price and purchase'));
    assert.equal(useGame.getState().overlay?.type, 'paywall');
    assert.ok(textIncludes(view.root, message), `${status} needs distinct feedback`);
  }

  await act(async () => useGame.setState({ overlay: { type: 'paywall' } }));
  purchaseOutcome = { status: 'confirmed-owned' };
  await press(button(view.root, 'View price and purchase'));
  assert.equal(useGame.getState().overlay, null);
  assert.ok(useGame.getState().notifs.some(notif => notif.text.includes('Go Indie confirmed active')));
});
