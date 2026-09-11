const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { act, create } = require('react-test-renderer');

global.__DEV__ = true;
global.IS_REACT_ACT_ENVIRONMENT = true;
const deferred = () => {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
};
const info = active => ({ entitlements: { active: active ? { go_indie: {} } : {} } });
let customer = deferred();
let restored = deferred();
let paywall = deferred();
let consentInfoUpdate = deferred();
let consentForm = deferred();
let listener;
let storageRead = async () => null;
let consentAllowed = true;
let consentStatus = 'UNKNOWN';
let privacyRequired = false;
let initializationCalls = 0;
let consentInfoUpdateCalls = 0;
let consentInfoUpdateArguments;
let consentFormCalls = 0;
let admobConfig = require('../config/admob').TEST_IDS;
const requests = [];
const mockNative = {
  Platform: { OS: 'ios', select: options => options.ios ?? options.default },
  StyleSheet: { create: value => value, hairlineWidth: 1 },
  AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
  View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', SafeAreaView: 'SafeAreaView',
};
const ads = {
  default: () => ({
    setRequestConfiguration: async () => { throw new Error('unexpected request configuration'); },
    initialize: async () => { initializationCalls++; },
  }),
  BannerAdSize: { BANNER: 'BANNER' },
  AdsConsentPrivacyOptionsRequirementStatus: { REQUIRED: 'REQUIRED' },
  AdsConsent: {
    requestInfoUpdate: (...args) => {
      consentInfoUpdateCalls++;
      consentInfoUpdateArguments = args;
      return consentInfoUpdate.promise;
    },
    loadAndShowConsentFormIfRequired: () => {
      consentFormCalls++;
      return consentForm.promise;
    },
    getConsentInfo: async () => ({ status: consentStatus, canRequestAds: consentAllowed, privacyOptionsRequirementStatus: privacyRequired ? 'REQUIRED' : 'NOT_REQUIRED' }),
    showPrivacyOptionsForm: async () => { consentAllowed = false; },
  },
  BannerAd: props => {
    React.useEffect(() => { requests.push(props); }, []);
    return React.createElement('NativeBanner', props);
  },
};
const originalLoad = Module._load;
Module._load = function (name, parent, main) {
  if (name === 'react-native') return mockNative;
  if (name === 'expo-constants') return { __esModule: true, default: { expoConfig: { extra: {
    revenueCat: { testStoreApiKey: 'test_fixture' }, admob: admobConfig,
  } } } };
  if (name === '@react-native-async-storage/async-storage') return { getItem: () => storageRead(), setItem: async () => {} };
  if (name === 'expo-status-bar') return { StatusBar: 'StatusBar' };
  if (name === 'expo-haptics') return { selectionAsync: async () => {}, notificationAsync: async () => {}, NotificationFeedbackType: {} };
  if (name === 'react-native-svg') return new Proxy({ __esModule: true, default: 'Svg' }, { get: (obj, key) => obj[key] ?? String(key) });
  if (name === 'react-native-google-mobile-ads') return ads;
  if (name === 'react-native-purchases') return { default: {
    setLogHandler() {}, setLogLevel: async () => {}, configure() {},
    addCustomerInfoUpdateListener: cb => { listener = cb; },
    getCustomerInfo: () => customer.promise,
    restorePurchases: () => restored.promise,
    getOfferings: async () => ({ current: { availablePackages: [{}] } }),
  }, LOG_LEVEL: { VERBOSE: 'VERBOSE' } };
  if (name === 'react-native-purchases-ui') return { default: { presentPaywall: () => paywall.promise }, PAYWALL_RESULT: { PURCHASED: 'PURCHASED', RESTORED: 'RESTORED', CANCELLED: 'CANCELLED' } };
  return originalLoad(name, parent, main);
};
for (const ext of ['.ts', '.tsx']) Module._extensions[ext] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  module._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText, filename);
};
const { useGame } = require('../src/state/gameStore.ts');
const purchases = require('../src/monetization/purchases.ts');
const App = require('../App.tsx').default;
const StoreScreen = require('../src/screens/StoreScreen.tsx').default;
const flush = async () => { await act(async () => { await new Promise(resolve => setImmediate(resolve)); }); };

test('app launch refreshes paid-user privacy state without requesting an ad', async () => {
  useGame.setState({ goIndieActive: true, goIndieResolved: true, overlay: null, notifs: [] });
  let tree;
  await act(async () => { tree = create(React.createElement(App)); });
  await flush();
  assert.equal(consentInfoUpdateCalls, 1, 'UMP must refresh once at launch');
  assert.deepEqual(consentInfoUpdateArguments, [], 'general-audience refresh must not send an age tag');

  consentStatus = 'OBTAINED';
  privacyRequired = true;
  await act(async () => { consentInfoUpdate.resolve(); await consentInfoUpdate.promise; });
  const storeTab = tree.root.findAllByType('Pressable').find(node => node.props.accessibilityRole === 'tab' && node.props.accessibilityLabel === 'Store');
  await act(async () => { storeTab.props.onPress(); });
  await flush();

  assert.ok(tree.root.findAllByType('Pressable').some(node => node.props.accessibilityLabel === 'Ad privacy choices'));
  assert.equal(consentFormCalls, 0, 'paid users must not receive a consent form');
  assert.equal(initializationCalls, 0, 'paid users must not initialize Mobile Ads');
  assert.equal(requests.length, 0, 'paid users must not request a banner');
  await act(async () => { tree.unmount(); });
  privacyRequired = false;
  consentStatus = 'NOT_REQUIRED';
});

// Exercise the mounted Store screen, real Zustand state, and public purchase APIs.
// Only native/network boundaries are doubles; removing the production gate must fail.
test('Store billboard waits for ownership and consent, honors purchases, and handles privacy changes', async () => {
  useGame.setState({ goIndieActive: true, goIndieResolved: false, overlay: null, notifs: [] });
  let tree;
  await act(async () => { tree = create(React.createElement(StoreScreen)); });
  const banners = () => tree.root.findAllByType('NativeBanner');
  const layout = () => tree.root.findAllByType('View').find(node => node.props.onLayout);
  await act(async () => { layout().props.onLayout({ nativeEvent: { layout: { width: 340 } } }); });
  const visibleText = tree.root.findAllByType('Text').map(node => node.props.children);
  assert.ok(visibleText.includes('The cat is between sponsors.'));
  assert.equal(visibleText.includes('Go Indie. No ads. Just you and the cat.'), false);
  const initial = purchases.initPurchases();
  await flush();
  assert.equal(banners().length, 0, 'unknown ownership must not render ads');
  assert.equal(initializationCalls, 0);
  await act(async () => { customer.resolve(info(false)); consentInfoUpdate.resolve(); await initial; });
  assert.equal(banners().length, 0, 'consent is still pending');
  await act(async () => { listener(info(true)); consentForm.resolve(); });
  await flush();
  assert.equal(banners().length, 0, 'a purchase during consent must cancel the late ad');
  assert.equal(initializationCalls, 0, 'purchasers must not initialize ads after consent');
  await act(async () => { listener(info(false)); });
  await flush();
  assert.equal(banners().length, 1);
  assert.equal(requests[0].unitId, require('../config/admob').TEST_IDS.ios.bannerId);
  assert.equal(consentInfoUpdateCalls, 1, 'free ads must reuse the launch UMP refresh');
  assert.equal(consentFormCalls, 1);
  assert.deepEqual(requests[0].requestOptions, { requestNonPersonalizedAdsOnly: true });

  let restore;
  await act(async () => { restore = purchases.restoreGoIndiePurchases(); });
  await act(async () => { restored.resolve(info(true)); assert.equal(await restore, true); });
  assert.equal(banners().length, 0, 'restored lifetime entitlement must remain ad free');
  await act(async () => { tree.unmount(); tree = create(React.createElement(StoreScreen)); });
  await act(async () => { layout().props.onLayout({ nativeEvent: { layout: { width: 340 } } }); });
  assert.equal(banners().length, 0, 'remount cannot resurrect a restored purchaser ad');

  await act(async () => { listener(info(false)); });
  await flush();
  assert.equal(banners().length, 1);
  let purchase;
  await act(async () => { purchase = purchases.presentGoIndiePaywall(); });
  await act(async () => { customer = { promise: Promise.resolve(info(true)) }; paywall.resolve('PURCHASED'); assert.equal(await purchase, true); });
  assert.equal(banners().length, 0, 'purchase suppresses without a restart');

  await act(async () => { listener(info(false)); });
  await flush();
  assert.equal(banners().length, 1);
  await act(async () => { banners()[0].props.onAdFailedToLoad(new Error('no fill')); });
  assert.equal(banners().length, 0, 'no-fill returns to fictional empty inventory');
  await act(async () => { tree.unmount(); });

  // A fresh install starts unknown, even if a persisted flag says not purchased.
  useGame.setState({ goIndieActive: false, goIndieResolved: false });
  await act(async () => { tree = create(React.createElement(StoreScreen)); });
  await act(async () => { layout().props.onLayout({ nativeEvent: { layout: { width: 340 } } }); });
  const before = requests.length;
  restored = deferred();
  await act(async () => { restore = purchases.restoreGoIndiePurchases(); });
  await act(async () => { restored.resolve(info(true)); await restore; });
  assert.equal(requests.length, before, 'fresh-install restore must never mount an ad');

  privacyRequired = true;
  await act(async () => { listener(info(false)); });
  await flush();
  assert.equal(banners().length, 1);
  const privacy = tree.root.findAllByType('Pressable').find(node => node.props.accessibilityLabel === 'Ad privacy choices');
  assert.ok(privacy, 'required privacy options must be accessible');
  await act(async () => { await privacy.props.onPress(); });
  await flush();
  assert.equal(banners().length, 0, 'withdrawal cannot leave the old creative mounted');
  await act(async () => { tree.unmount(); });
});


test('late CustomerInfo and disk hydration cannot resurrect ads for a known purchaser', async () => {
  customer = deferred();
  const refresh = purchases.hasGoIndie();
  await new Promise(resolve => setImmediate(resolve));
  listener(info(true));
  customer.resolve(info(false));
  assert.equal(await refresh, true);
  assert.equal(useGame.getState().goIndieActive, true);
  const disk = deferred();
  storageRead = () => disk.promise;
  const hydration = useGame.persist.rehydrate();
  listener(info(true));
  disk.resolve(JSON.stringify({ version: 2, state: { goIndieActive: false } }));
  await hydration;
  assert.equal(useGame.getState().goIndieActive, true);
});

test('a paywall success without a confirmed go_indie entitlement fails closed', async () => {
  listener(info(false));
  paywall = deferred();
  customer = { promise: Promise.reject(new Error('offline after payment')) };
  // Attach a handler immediately; the production refresh consumes this later.
  customer.promise.catch(() => {});
  const purchase = purchases.presentGoIndiePaywall();
  paywall.resolve('PURCHASED');
  assert.equal(await purchase, null);
  assert.equal(useGame.getState().goIndieResolved, false);
  assert.equal(require('../src/monetization/ads.ts').mayRequestAds(useGame.getState()), false);
});

test('release runtime accepts valid production identifiers', () => {
  const modulePath = require.resolve('../src/monetization/ads.ts');
  admobConfig = {
    ios: {
      appId: 'ca-app-pub-1111111111111111~1111111111',
      bannerId: 'ca-app-pub-1111111111111111/1111111111',
    },
  };
  global.__DEV__ = false;
  delete require.cache[modulePath];
  try {
    assert.equal(require(modulePath).bannerId(), admobConfig.ios.bannerId);
  } finally {
    global.__DEV__ = true;
    delete require.cache[modulePath];
  }
});
