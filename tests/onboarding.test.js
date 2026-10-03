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
  Platform: { OS: 'ios', select: options => options.ios ?? options.default },
  StyleSheet: { create: value => value, hairlineWidth: 1 },
  StatusBar: { currentHeight: 0 },
  View: 'View', Text: 'Text', Pressable: 'Pressable', SafeAreaView: 'SafeAreaView',
};
const originalLoad = Module._load;
Module._load = function (name, parent, main) {
  if (name === 'react-native') return native;
  if (name === '@react-native-async-storage/async-storage') return {
    getItem: async () => saved,
    setItem: async (_key, value) => { saved = value; },
  };
  if (name === 'expo-status-bar') return { StatusBar: 'StatusBar' };
  if (name === 'expo-haptics') return {
    selectionAsync: async () => {}, notificationAsync: async () => {}, NotificationFeedbackType: {},
  };
  if (name === 'react-native-svg') return new Proxy(
    { __esModule: true, default: 'Svg' },
    { get: (obj, key) => obj[key] ?? String(key) },
  );
  if (name === './src/systems/useGameLoop') return { useGameLoop() {} };
  if (name === './src/monetization/purchases') return { initPurchases: async () => {} };
  if (name === './src/monetization/ads') return { refreshConsentSession: async () => {} };
  if (name === './src/components/NotifStack') return { __esModule: true, default: () => null };
  if (name === './src/components/OverlayHost') return { __esModule: true, default: () => null };
  if (name === './src/screens/HomeScreen') return { __esModule: true, default: () => null };
  if (name === './src/screens/CodeScreen') return { __esModule: true, default: () => null };
  if (name === './src/screens/StoreScreen') return { __esModule: true, default: () => null };
  if (name === './src/screens/ChirpScreen') return { __esModule: true, default: () => null };
  return originalLoad(name, parent, main);
};
for (const ext of ['.ts', '.tsx']) Module._extensions[ext] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText, filename);
};

const { useGame } = require('../src/state/gameStore.ts');
const App = require('../App.tsx').default;
const openingToast = '11:58 PM. The day job is done. The real work begins. Open Code.';
const waitForOpeningWindow = () => new Promise(resolve => setTimeout(resolve, 1000));

async function mountApp() {
  let view;
  await act(async () => { view = create(React.createElement(App)); });
  return view;
}

async function hydrate(value) {
  useGame.setState(useGame.getInitialState(), true);
  saved = value;
  await useGame.persist.rehydrate();
}

test('a fresh install receives the opening toast once across relaunches', async t => {
  await hydrate(null);
  const firstView = await mountApp();
  await act(waitForOpeningWindow);
  assert.equal(useGame.getState().notifs.filter(notif => notif.text === openingToast).length, 1);
  assert.equal(useGame.getState().hasSeenOpeningToast, true);
  const firstSessionSave = saved;
  assert.ok(firstSessionSave, 'claiming the toast must persist before relaunch');
  await act(async () => firstView.unmount());

  await hydrate(firstSessionSave);
  const returningView = await mountApp();
  t.after(async () => { await act(async () => returningView.unmount()); });
  await act(waitForOpeningWindow);
  assert.equal(useGame.getState().notifs.some(notif => notif.text === openingToast), false);
});

test('a migrated returning player does not receive the first-session opening toast', async t => {
  await hydrate(JSON.stringify({
    state: {
      day: 88,
      cash: 1000000,
      mrr: 2000,
      chirps: [{ id: 'returning', who: 'Founder', handle: '@founder', text: 'Still shipping', likes: 1 }],
      lastSeen: Date.now(),
    },
    version: 6,
  }));
  assert.equal(useGame.getState().day, 88);
  assert.equal(useGame.getState().cash, 1000000);
  assert.equal(useGame.getState().mrr, 2000);
  assert.equal(useGame.getState().hasSeenOpeningToast, true);

  const view = await mountApp();
  t.after(async () => { await act(async () => view.unmount()); });

  await act(waitForOpeningWindow);
  assert.equal(useGame.getState().notifs.some(notif => notif.text === openingToast), false);
});
