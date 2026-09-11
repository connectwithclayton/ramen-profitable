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
let consentInfoGate = null;
let consentInfoCalls = 0;
let initializationCalls = 0;
let initializationFailuresRemaining = 0;
let consentInfoUpdateCalls = 0;
let consentInfoUpdateArguments;
let consentFormCalls = 0;
let admobConfig = require('../config/admob').TEST_IDS;
const requests = [];
let nextBannerInstanceId = 0;
const appStateListeners = new Set();
const mockNative = {
  Platform: { OS: 'ios', select: options => options[mockNative.Platform.OS] ?? options.default },
  StyleSheet: { create: value => value, hairlineWidth: 1 },
  AppState: {
    currentState: 'active',
    addEventListener: (_event, listener) => {
      appStateListeners.add(listener);
      return { remove: () => appStateListeners.delete(listener) };
    },
  },
  StatusBar: { currentHeight: 0 },
  View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', SafeAreaView: 'SafeAreaView',
};
const setAppState = state => {
  mockNative.AppState.currentState = state;
  for (const listener of appStateListeners) listener(state);
};
const ads = {
  default: () => ({
    setRequestConfiguration: async () => { throw new Error('unexpected request configuration'); },
    initialize: async () => {
      initializationCalls++;
      if (initializationFailuresRemaining > 0) {
        initializationFailuresRemaining--;
        throw new Error('initialization unavailable');
      }
    },
  }),
  BannerAdSize: { INLINE_ADAPTIVE_BANNER: 'INLINE_ADAPTIVE_BANNER' },
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
    getConsentInfo: async () => {
      consentInfoCalls++;
      if (consentInfoGate) await consentInfoGate.promise;
      return { status: consentStatus, canRequestAds: consentAllowed, privacyOptionsRequirementStatus: privacyRequired ? 'REQUIRED' : 'NOT_REQUIRED' };
    },
    showPrivacyOptionsForm: async () => { consentAllowed = false; },
  },
  BannerAd: props => {
    const instanceId = React.useRef(null);
    if (instanceId.current === null) instanceId.current = ++nextBannerInstanceId;
    React.useLayoutEffect(() => {
      requests.push({ ...props, nativeInstanceId: instanceId.current });
    }, [props.width]);
    return React.createElement('NativeBanner', { ...props, nativeInstanceId: instanceId.current });
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
const loadFreshStoreScreen = () => {
  for (const path of [
    '../src/monetization/ads.ts',
    '../src/components/PhoneBillboard.tsx',
    '../src/screens/StoreScreen.tsx',
  ]) {
    delete require.cache[require.resolve(path)];
  }
  return require('../src/screens/StoreScreen.tsx').default;
};
const loadFreshApp = () => {
  for (const path of [
    '../src/monetization/ads.ts',
    '../src/components/PhoneBillboard.tsx',
    '../src/screens/StoreScreen.tsx',
    '../App.tsx',
  ]) {
    delete require.cache[require.resolve(path)];
  }
  return require('../App.tsx').default;
};
const mountStore = async Store => {
  let tree;
  await act(async () => { tree = create(React.createElement(Store)); });
  return tree;
};
const setBillboardWidth = async (tree, width) => {
  const layout = tree.root.findAllByType('View')
    .find(node => node.props.collapsable === false && node.props.onLayout);
  assert.ok(layout, 'an active Catvertising surface must expose its measurement probe');
  await act(async () => { layout.props.onLayout({ nativeEvent: { layout: { width } } }); });
  await flush();
};
const resetAdLifecycleState = () => {
  consentAllowed = true;
  consentStatus = 'NOT_REQUIRED';
  privacyRequired = false;
  consentInfoGate = null;
  consentInfoCalls = 0;
  consentInfoUpdate = deferred();
  consentForm = deferred();
  initializationCalls = 0;
  initializationFailuresRemaining = 0;
  consentInfoUpdateCalls = 0;
  consentInfoUpdateArguments = undefined;
  consentFormCalls = 0;
  admobConfig = require('../config/admob').TEST_IDS;
  requests.length = 0;
  appStateListeners.clear();
  mockNative.AppState.currentState = 'active';
  useGame.setState({ goIndieActive: false, goIndieResolved: true, overlay: null });
};

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
  const layout = () => tree.root.findAllByType('View')
    .find(node => node.props.collapsable === false && node.props.onLayout);
  await act(async () => { layout().props.onLayout({ nativeEvent: { layout: { width: 340 } } }); });
  const visibleText = tree.root.findAllByType('Text').map(node => node.props.children);
  assert.equal(visibleText.includes('The cat is between sponsors.'), false);
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
  const noFill = Object.assign(new Error('no fill'), { code: 'googleMobileAds/no-fill' });
  await act(async () => { banners()[0].props.onAdFailedToLoad(noFill); });
  assert.equal(banners().length, 0, 'no-fill returns to fictional empty inventory');
  assert.ok(tree.root.findAllByType('Text').some(node => node.props.children === 'The cat is between sponsors.'));
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

test('billboard requests measured-width adaptive ads in phone and iPad multitasking layouts', async () => {
  resetAdLifecycleState();
  const FreshStoreScreen = loadFreshStoreScreen();
  const tree = await mountStore(FreshStoreScreen);
  const banners = () => tree.root.findAllByType('NativeBanner');
  const hasNoFillCopy = () => tree.root.findAllByType('Text')
    .some(node => node.props.children === 'The cat is between sponsors.');

  assert.equal(hasNoFillCopy(), false, 'measurement and consent are not no-fill');
  await setBillboardWidth(tree, 339);
  await act(async () => { consentInfoUpdate.resolve(); await consentInfoUpdate.promise; });
  await flush();
  await act(async () => { consentForm.resolve(); await consentForm.promise; });
  await flush();
  assert.equal(initializationCalls, 1);
  assert.equal(banners().length, 1, 'phone layout must mount Catvertising');
  assert.equal(banners()[0].props.size, 'INLINE_ADAPTIVE_BANNER');
  assert.equal(banners()[0].props.width, 339, 'phone layout must use its measured width');
  assert.equal(banners()[0].props.maxHeight, 50);
  assert.deepEqual(banners()[0].props.requestOptions, { requestNonPersonalizedAdsOnly: true });
  const initialInstanceId = banners()[0].props.nativeInstanceId;
  assert.equal(requests.length, 1);

  await setBillboardWidth(tree, 339);
  assert.equal(requests.length, 1, 'an unchanged width must not issue another native request');
  assert.equal(banners()[0].props.nativeInstanceId, initialInstanceId);
  await act(async () => { banners()[0].props.onAdLoaded({ width: 339, height: 50 }); });

  for (const [layout, width] of [
    ['iPad Split View-sized', 344],
    ['iPad Slide Over-sized', 284],
  ]) {
    const previousInstanceId = banners()[0].props.nativeInstanceId;
    const requestCount = requests.length;
    await setBillboardWidth(tree, width);
    assert.equal(banners().length, 1, `${layout} layout must mount Catvertising`);
    assert.equal(banners()[0].props.size, 'INLINE_ADAPTIVE_BANNER');
    assert.equal(banners()[0].props.width, width, `${layout} layout must use its measured width`);
    assert.equal(banners()[0].props.maxHeight, 50);
    assert.deepEqual(banners()[0].props.requestOptions, { requestNonPersonalizedAdsOnly: true });
    assert.equal(requests.length, requestCount + 1, `${layout} resize must issue exactly one native request`);
    assert.notStrictEqual(
      banners()[0].props.nativeInstanceId,
      previousInstanceId,
      `${layout} resize must replace the loaded native banner before changing width`,
    );
    assert.equal(requests.at(-1).nativeInstanceId, banners()[0].props.nativeInstanceId);
    assert.equal(hasNoFillCopy(), false);
    await act(async () => { banners()[0].props.onAdLoaded({ width, height: 50 }); });
  }
  assert.deepEqual(requests.map(request => request.width), [339, 344, 284]);

  const networkError = Object.assign(new Error('offline'), { code: 'googleMobileAds/network-error' });
  await act(async () => { banners()[0].props.onAdFailedToLoad(networkError); });
  assert.equal(banners().length, 0, 'a failed unloaded banner must leave the native tree');
  assert.equal(hasNoFillCopy(), false, 'a network error is not no-fill');
  await act(async () => { tree.unmount(); });
});

test('App retains loaded banners while concealed and replaces resized creatives once visible', async () => {
  resetAdLifecycleState();
  useGame.setState({ notifs: [] });
  const FreshApp = loadFreshApp();
  let tree;
  await act(async () => { tree = create(React.createElement(FreshApp)); });
  const tab = label => tree.root.findAllByType('Pressable')
    .find(node => node.props.accessibilityRole === 'tab' && node.props.accessibilityLabel === label);
  const banners = () => tree.root.findAllByType('NativeBanner');
  const probes = () => tree.root.findAllByType('View')
    .filter(node => node.props.collapsable === false && node.props.onLayout);
  const bannerConcealed = () => {
    const frame = tree.root.findAllByType('View')
      .find(node => node.props.accessibilityElementsHidden !== undefined);
    const styles = (Array.isArray(frame.props.style) ? frame.props.style.flat() : [frame.props.style])
      .filter(Boolean);
    return frame.props.accessibilityElementsHidden === true &&
      frame.props.pointerEvents === 'none' &&
      styles.some(style => style.display === 'none');
  };
  const hasNoFillCopy = () => tree.root.findAllByType('Text')
    .some(node => node.props.children === 'The cat is between sponsors.');

  await act(async () => { tab('Store').props.onPress(); });
  await setBillboardWidth(tree, 320);
  await act(async () => { consentInfoUpdate.resolve(); await consentInfoUpdate.promise; });
  await flush();
  await act(async () => { consentForm.resolve(); await consentForm.promise; });
  await flush();
  assert.equal(banners().length, 1);
  assert.equal(requests.length, 1);
  assert.equal(bannerConcealed(), false, 'the loaded advert must be visible in Store');
  await act(async () => { banners()[0].props.onAdLoaded({ width: 320, height: 50 }); });
  const loadedBanner = banners()[0];
  const loadedBannerInstanceId = loadedBanner.props.nativeInstanceId;
  const initialProbe = probes()[0];

  await act(async () => { setAppState('background'); });
  await flush();
  assert.equal(probes().length, 0, 'backgrounding must remove the active measurement probe');
  assert.strictEqual(banners()[0], loadedBanner, 'backgrounding must retain the loaded native banner');
  assert.equal(requests.length, 1);
  assert.equal(bannerConcealed(), true, 'backgrounding must conceal and disable the retained advert');
  await act(async () => { setAppState('active'); });
  await flush();
  assert.equal(probes().length, 1);
  assert.notStrictEqual(probes()[0], initialProbe, 'foregrounding must create a fresh measurement boundary');
  assert.strictEqual(banners()[0], loadedBanner, 'foregrounding must retain the same loaded banner before layout');
  assert.equal(requests.length, 1, 'foregrounding must not issue another request');
  assert.equal(bannerConcealed(), true, 'foregrounding must keep the advert concealed until layout completes');
  await setBillboardWidth(tree, 320);
  assert.strictEqual(banners()[0], loadedBanner);
  assert.equal(bannerConcealed(), false);

  await act(async () => { tab('Home').props.onPress(); });
  await flush();
  assert.equal(banners().length, 1, 'leaving Store must retain the loaded native banner');
  assert.equal(bannerConcealed(), true, 'the inactive Store must conceal and disable the retained advert');
  await act(async () => { tab('Store').props.onPress(); });
  await flush();
  assert.equal(bannerConcealed(), true, 'returning must keep the retained advert concealed until layout completes');
  await setBillboardWidth(tree, 320);
  assert.equal(banners().length, 1);
  assert.equal(requests.length, 1, 'returning to Store must reuse the loaded advert');
  assert.equal(bannerConcealed(), false, 'returning to Store must reveal the retained advert');
  assert.equal(hasNoFillCopy(), false);

  await act(async () => { tab('Home').props.onPress(); });
  await flush();
  assert.strictEqual(banners()[0], loadedBanner, 'hiding must retain the loaded native banner');
  assert.equal(banners()[0].props.width, 320, 'the concealed banner must retain its committed width');
  assert.equal(requests.length, 1, 'hiding must not issue a native request');
  await act(async () => { tab('Store').props.onPress(); });
  await flush();
  assert.strictEqual(banners()[0], loadedBanner, 'returning must await the completed layout before replacement');
  assert.equal(bannerConcealed(), true, 'a potentially stale creative must remain concealed before returned layout');
  assert.equal(requests.length, 1);
  await setBillboardWidth(tree, 284);
  assert.equal(banners().length, 1);
  assert.notStrictEqual(banners()[0], loadedBanner, 'returning after a resize must replace the old native banner');
  assert.notStrictEqual(banners()[0].props.nativeInstanceId, loadedBannerInstanceId);
  assert.equal(banners()[0].props.width, 284);
  assert.equal(requests.length, 2, 'returning after a hidden resize must issue exactly one request');
  assert.equal(requests.at(-1).nativeInstanceId, banners()[0].props.nativeInstanceId);
  await act(async () => { banners()[0].props.onAdLoaded({ width: 284, height: 50 }); });
  const resizedBanner = banners()[0];

  await act(async () => { useGame.getState().openGoIndiePaywall(); });
  await flush();
  assert.equal(banners().length, 1, 'the paywall must conceal without destroying the advert');
  assert.strictEqual(banners()[0], resizedBanner);
  assert.equal(bannerConcealed(), true, 'the paywall must disable the retained advert');
  await act(async () => { useGame.getState().dismissOverlay(); });
  await flush();
  assert.equal(banners().length, 1);
  assert.strictEqual(banners()[0], resizedBanner);
  assert.equal(bannerConcealed(), true, 'closing the paywall must await fresh billboard geometry');
  await setBillboardWidth(tree, 284);
  assert.equal(requests.length, 2, 'closing the paywall must reveal the loaded advert');
  assert.equal(bannerConcealed(), false);
  assert.equal(hasNoFillCopy(), false);
  await act(async () => { tree.unmount(); });
});

test('no-fill retries only on a Store return after sixty seconds', async () => {
  resetAdLifecycleState();
  useGame.setState({ notifs: [] });
  const originalNow = Date.now;
  let now = originalNow();
  Date.now = () => now;
  let tree;
  try {
    const FreshApp = loadFreshApp();
    await act(async () => { tree = create(React.createElement(FreshApp)); });
    const tab = label => tree.root.findAllByType('Pressable')
      .find(node => node.props.accessibilityRole === 'tab' && node.props.accessibilityLabel === label);
    const banners = () => tree.root.findAllByType('NativeBanner');
    const hasNoFillCopy = () => tree.root.findAllByType('Text')
      .some(node => node.props.children === 'The cat is between sponsors.');
    const noFill = Object.assign(new Error('no fill'), { code: 'googleMobileAds/no-fill' });
    const networkError = Object.assign(new Error('offline'), { code: 'googleMobileAds/network-error' });

    await act(async () => { tab('Store').props.onPress(); });
    await setBillboardWidth(tree, 320);
    await act(async () => { consentInfoUpdate.resolve(); await consentInfoUpdate.promise; });
    await flush();
    await act(async () => { consentForm.resolve(); await consentForm.promise; });
    await flush();
    assert.equal(requests.length, 1);

    await act(async () => { banners()[0].props.onAdFailedToLoad(noFill); });
    assert.equal(banners().length, 0);
    assert.equal(hasNoFillCopy(), true);

    await setBillboardWidth(tree, 300);
    assert.equal(requests.length, 1, 'layout changes must not bypass no-fill recovery timing');
    assert.equal(hasNoFillCopy(), true);

    await act(async () => { setAppState('background'); });
    now += 59_999;
    await act(async () => { setAppState('active'); });
    await setBillboardWidth(tree, 300);
    await flush();
    assert.equal(requests.length, 1, 'a visible return before sixty seconds must not request another advert');
    assert.equal(banners().length, 0);
    assert.equal(hasNoFillCopy(), true);

    now += 1;
    await flush();
    assert.equal(requests.length, 1, 'elapsed time alone must not retry while Store remains visible');
    await act(async () => { tab('Home').props.onPress(); });
    await act(async () => { tab('Store').props.onPress(); });
    await flush();
    assert.equal(requests.length, 1, 'a return must await its completed layout before retrying');
    await setBillboardWidth(tree, 284);
    assert.equal(requests.length, 2, 'the next qualifying return must issue one request');
    assert.equal(banners().length, 1);
    assert.equal(banners()[0].props.width, 284);
    assert.equal(hasNoFillCopy(), true, 'the confirmed fallback must remain while replacement loads');

    const retryingInstanceId = banners()[0].props.nativeInstanceId;
    const requestCount = requests.length;
    await setBillboardWidth(tree, 270);
    assert.equal(requests.length, requestCount + 1, 'a retrying resize must issue exactly one native request');
    assert.equal(banners().length, 1, 'a retrying resize must keep its native banner mounted');
    assert.equal(banners()[0].props.nativeInstanceId, retryingInstanceId, 'a retrying resize must reuse the in-flight native banner');
    assert.equal(banners()[0].props.width, 270);
    assert.equal(hasNoFillCopy(), true, 'a retrying resize must retain the confirmed fallback');

    await act(async () => { banners()[0].props.onAdFailedToLoad(networkError); });
    await flush();
    assert.equal(banners().length, 0);
    assert.equal(hasNoFillCopy(), true, 'a failed replacement must retain the confirmed fallback');
    assert.equal(requests.length, 3, 'a failed replacement must not start a retry loop');
    await act(async () => { tab('Home').props.onPress(); });
    await act(async () => { tab('Store').props.onPress(); });
    await setBillboardWidth(tree, 270);
    await flush();
    assert.equal(requests.length, 3, 'an immediate return after failure must honor the retry interval');
    assert.equal(hasNoFillCopy(), true);

    now += 60_000;
    await flush();
    assert.equal(requests.length, 3, 'elapsed time alone must not issue a replacement request');
    await act(async () => { setAppState('background'); });
    await flush();
    assert.equal(requests.length, 3, 'no request may run while the app is backgrounded');
    await act(async () => { setAppState('active'); });
    await setBillboardWidth(tree, 270);
    await flush();
    assert.equal(requests.length, 4, 'foregrounding into Store must recover on a qualifying return');
    assert.equal(hasNoFillCopy(), true, 'the fallback must remain until the replacement reports loaded');
    const replacement = banners()[0];
    await act(async () => { replacement.props.onAdLoaded({ width: 270, height: 50 }); });
    assert.strictEqual(banners()[0], replacement, 'loading must reveal the replacement without remounting it');
    assert.equal(hasNoFillCopy(), false, 'only a loaded replacement may clear the fallback');
    assert.equal(requests.length, 4);
  } finally {
    Date.now = originalNow;
    mockNative.AppState.currentState = 'active';
    if (tree) await act(async () => { tree.unmount(); });
  }
});

test('unloaded banners recover only on qualifying Store returns', async () => {
  resetAdLifecycleState();
  useGame.setState({ notifs: [] });
  const originalNow = Date.now;
  const originalSetTimeout = global.setTimeout;
  const originalClearTimeout = global.clearTimeout;
  let now = originalNow();
  Date.now = () => now;
  const retryTimerDelays = [];
  const retryTimerHandles = new Set();
  let tree;
  try {
    const FreshApp = loadFreshApp();
    await act(async () => { tree = create(React.createElement(FreshApp)); });
    const tab = label => tree.root.findAllByType('Pressable')
      .find(node => node.props.accessibilityRole === 'tab' && node.props.accessibilityLabel === label);
    const banners = () => tree.root.findAllByType('NativeBanner');
    const hasNoFillCopy = () => tree.root.findAllByType('Text')
      .some(node => node.props.children === 'The cat is between sponsors.');
    const networkError = Object.assign(new Error('offline'), { code: 'googleMobileAds/network-error' });
    global.setTimeout = (callback, delay, ...args) => {
      if (typeof delay === 'number' && delay >= 60_000) {
        retryTimerDelays.push(delay);
        const handle = { callback, args };
        retryTimerHandles.add(handle);
        return handle;
      }
      return originalSetTimeout(callback, delay, ...args);
    };
    global.clearTimeout = handle => {
      if (retryTimerHandles.delete(handle)) return;
      return originalClearTimeout(handle);
    };

    await act(async () => { tab('Store').props.onPress(); });
    await setBillboardWidth(tree, 320);
    await act(async () => { consentInfoUpdate.resolve(); await consentInfoUpdate.promise; });
    await flush();
    await act(async () => { consentForm.resolve(); await consentForm.promise; });
    await flush();
    assert.equal(requests.length, 1);
    assert.equal(banners().length, 1);
    assert.equal(hasNoFillCopy(), false, 'an unresolved request is not no-fill');

    await act(async () => { banners()[0].props.onAdFailedToLoad(networkError); });
    await flush();
    assert.equal(banners().length, 0);
    assert.equal(hasNoFillCopy(), false, 'a network failure must not claim genuine no-fill');

    now += 59_999;
    await act(async () => { tab('Home').props.onPress(); });
    await act(async () => { tab('Store').props.onPress(); });
    await setBillboardWidth(tree, 320);
    await flush();
    assert.equal(requests.length, 1, 'a failed advert must honor the retry interval');

    now += 1;
    await flush();
    assert.equal(requests.length, 1, 'elapsed time alone must not retry a failed advert');
    await act(async () => { tab('Home').props.onPress(); });
    await act(async () => { tab('Store').props.onPress(); });
    await setBillboardWidth(tree, 320);
    await flush();
    assert.equal(requests.length, 2, 'a qualifying return must recover a network failure');
    assert.equal(banners().length, 1);
    assert.equal(hasNoFillCopy(), false);

    now += 59_999;
    await act(async () => { tab('Home').props.onPress(); });
    await act(async () => { tab('Store').props.onPress(); });
    await setBillboardWidth(tree, 320);
    await flush();
    assert.equal(requests.length, 2, 'an unresolved request must honor the retry interval');

    now += 1;
    await flush();
    assert.equal(requests.length, 2, 'elapsed time alone must not retry an unresolved request');
    await act(async () => { tab('Home').props.onPress(); });
    await act(async () => { tab('Store').props.onPress(); });
    await setBillboardWidth(tree, 320);
    await flush();
    assert.equal(requests.length, 3, 'the next qualifying return must replace an advert that never loaded');
    const replacement = banners()[0];
    await act(async () => { replacement.props.onAdLoaded({ width: 320, height: 50 }); });

    now += 60_000;
    await act(async () => { tab('Home').props.onPress(); });
    await act(async () => { tab('Store').props.onPress(); });
    await setBillboardWidth(tree, 320);
    await flush();
    assert.equal(requests.length, 3, 'a loaded creative must be reused without another request');
    assert.strictEqual(banners()[0], replacement);
    assert.deepEqual(retryTimerDelays, [], 'banner recovery must not schedule a background timer');
  } finally {
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
    Date.now = originalNow;
    mockNative.AppState.currentState = 'active';
    if (tree) await act(async () => { tree.unmount(); });
  }
});

test('SDK preparation failure retries without a loop', async () => {
  resetAdLifecycleState();
  initializationFailuresRemaining = 1;
  useGame.setState({ notifs: [] });
  const originalNow = Date.now;
  let now = originalNow();
  Date.now = () => now;
  let tree;
  try {
    const FreshApp = loadFreshApp();
    await act(async () => { tree = create(React.createElement(FreshApp)); });
    const tab = label => tree.root.findAllByType('Pressable')
      .find(node => node.props.accessibilityRole === 'tab' && node.props.accessibilityLabel === label);
    const banners = () => tree.root.findAllByType('NativeBanner');

    await act(async () => { tab('Store').props.onPress(); });
    await setBillboardWidth(tree, 320);
    await act(async () => { consentInfoUpdate.resolve(); await consentInfoUpdate.promise; });
    await flush();
    await act(async () => { consentForm.resolve(); await consentForm.promise; });
    await flush();
    assert.equal(initializationCalls, 1);
    assert.equal(requests.length, 0);
    await flush();
    assert.equal(initializationCalls, 1, 'a preparation failure must not create a retry loop');

    await act(async () => { tab('Home').props.onPress(); });
    await act(async () => { tab('Store').props.onPress(); });
    await setBillboardWidth(tree, 320);
    await flush();
    assert.equal(initializationCalls, 2, 'the next Store return must retry preparation before any banner request exists');
    assert.equal(requests.length, 1);
    const replacement = banners()[0];
    await act(async () => { replacement.props.onAdLoaded({ width: 320, height: 50 }); });

    now += 60_000;
    await act(async () => { tab('Home').props.onPress(); });
    await act(async () => { tab('Store').props.onPress(); });
    await setBillboardWidth(tree, 320);
    await flush();
    assert.equal(initializationCalls, 2);
    assert.equal(requests.length, 1, 'loaded creative must survive later returns');
    assert.strictEqual(banners()[0], replacement);
  } finally {
    initializationFailuresRemaining = 0;
    Date.now = originalNow;
    mockNative.AppState.currentState = 'active';
    if (tree) await act(async () => { tree.unmount(); });
  }
});

test('hidden Store ignores unrelated game ticks', async () => {
  resetAdLifecycleState();
  const FreshStoreScreen = loadFreshStoreScreen();
  const before = useGame.getState();
  let commits = 0;
  let tree;
  try {
    await act(async () => {
      tree = create(
        React.createElement(
          React.Profiler,
          { id: 'Store', onRender: () => { commits++; } },
          React.createElement(FreshStoreScreen, { active: false }),
        ),
      );
    });
    const initialCommits = commits;
    await act(async () => { useGame.setState({ energy: before.energy + 1 }); });
    assert.equal(commits, initialCommits, 'an unrelated energy tick must not rerender hidden Store');
    await act(async () => { useGame.setState({ cash: before.cash + 1 }); });
    assert.ok(commits > initialCommits, 'a Store-visible balance change must still rerender Store');
  } finally {
    if (tree) await act(async () => { tree.unmount(); });
    useGame.setState({ energy: before.energy, cash: before.cash });
  }
});

test('a live remount continues one in-flight consent form', async () => {
  resetAdLifecycleState();
  const FreshStoreScreen = loadFreshStoreScreen();
  let tree = await mountStore(FreshStoreScreen);
  await setBillboardWidth(tree, 320);
  await act(async () => { tree.unmount(); });
  await act(async () => { consentInfoUpdate.resolve(); await consentInfoUpdate.promise; });
  await flush();
  assert.equal(consentFormCalls, 0, 'an unmounted billboard must not present consent');
  assert.equal(initializationCalls, 0);

  tree = await mountStore(FreshStoreScreen);
  await setBillboardWidth(tree, 320);
  assert.equal(consentFormCalls, 1);
  await act(async () => { tree.unmount(); });
  tree = await mountStore(FreshStoreScreen);
  await setBillboardWidth(tree, 320);
  assert.equal(consentFormCalls, 1, 'remounting must not duplicate an in-flight form');
  await act(async () => { consentForm.resolve(); await consentForm.promise; });
  await flush();
  assert.equal(initializationCalls, 1, 'the live remount must initialize after consent');
  assert.equal(tree.root.findAllByType('NativeBanner').length, 1);
  await act(async () => { tree.unmount(); });
});

test('an overlay blocks consent presentation and Mobile Ads initialization', async () => {
  resetAdLifecycleState();
  const FreshStoreScreen = loadFreshStoreScreen();
  const tree = await mountStore(FreshStoreScreen);
  await setBillboardWidth(tree, 320);

  await act(async () => { useGame.setState({ overlay: { type: 'paywall' } }); });
  await act(async () => { consentInfoUpdate.resolve(); await consentInfoUpdate.promise; });
  await flush();
  assert.equal(consentFormCalls, 0, 'an overlay opened during refresh must prevent consent presentation');

  await act(async () => { useGame.setState({ overlay: null }); });
  await setBillboardWidth(tree, 320);
  await flush();
  assert.equal(consentFormCalls, 1);
  consentInfoGate = deferred();
  const consentReadsBeforeForm = consentInfoCalls;
  await act(async () => { consentForm.resolve(); await consentForm.promise; });
  await flush();
  assert.ok(consentInfoCalls > consentReadsBeforeForm, 'preparation must reach the consent-info boundary');
  await act(async () => { useGame.setState({ overlay: { type: 'paywall' } }); });
  await act(async () => { consentInfoGate.resolve(); await consentInfoGate.promise; });
  await flush();
  assert.equal(initializationCalls, 0, 'an overlay opened before initialization must prevent it');

  await act(async () => { useGame.setState({ overlay: null }); });
  await setBillboardWidth(tree, 320);
  await flush();
  assert.equal(initializationCalls, 1);
  assert.equal(tree.root.findAllByType('NativeBanner').length, 1);
  await act(async () => { tree.unmount(); });
});

test('backgrounding blocks consent presentation and Mobile Ads initialization', async () => {
  resetAdLifecycleState();
  const FreshStoreScreen = loadFreshStoreScreen();
  const tree = await mountStore(FreshStoreScreen);
  await setBillboardWidth(tree, 320);

  await act(async () => { setAppState('background'); });
  await act(async () => { consentInfoUpdate.resolve(); await consentInfoUpdate.promise; });
  await flush();
  assert.equal(consentFormCalls, 0, 'backgrounding during refresh must prevent consent presentation');

  await act(async () => { setAppState('active'); });
  await setBillboardWidth(tree, 320);
  await flush();
  assert.equal(consentFormCalls, 1);
  await act(async () => { setAppState('background'); });
  await act(async () => { consentForm.resolve(); await consentForm.promise; });
  await flush();
  assert.equal(initializationCalls, 0, 'backgrounding during consent must prevent initialization');

  await act(async () => { setAppState('active'); });
  await setBillboardWidth(tree, 320);
  await flush();
  assert.equal(initializationCalls, 1);
  assert.equal(tree.root.findAllByType('NativeBanner').length, 1);
  await act(async () => { tree.unmount(); });
});

test('Android App unmounts Store between visits', async () => {
  const previousOS = mockNative.Platform.OS;
  let tree;
  try {
    mockNative.Platform.OS = 'android';
    resetAdLifecycleState();
    useGame.setState({ notifs: [] });
    const FreshApp = loadFreshApp();
    const FreshStoreScreen = require('../src/screens/StoreScreen.tsx').default;
    await act(async () => { tree = create(React.createElement(FreshApp)); });
    const tab = label => tree.root.findAllByType('Pressable')
      .find(node => node.props.accessibilityRole === 'tab' && node.props.accessibilityLabel === label);
    const stores = () => tree.root.findAllByType(FreshStoreScreen);

    await act(async () => { tab('Store').props.onPress(); });
    assert.equal(stores().length, 1);
    const firstStore = stores()[0];
    await act(async () => { tab('Home').props.onPress(); });
    assert.equal(stores().length, 0, 'Android must remove Store when another tab is active');
    await act(async () => { tab('Store').props.onPress(); });
    assert.equal(stores().length, 1);
    assert.notStrictEqual(stores()[0], firstStore, 'Android must create a fresh Store on return');
    assert.equal(requests.length, 0);
  } finally {
    if (tree) await act(async () => { tree.unmount(); });
    mockNative.Platform.OS = previousOS;
    useGame.setState({ overlay: null });
  }
});

test('Android omits Catvertising and describes only the offline Go Indie benefit', async () => {
  const previousOS = mockNative.Platform.OS;
  const visibleText = tree => tree.root.findAllByType('Text')
    .flatMap(node => React.Children.toArray(node.props.children))
    .filter(value => typeof value === 'string');
  let store;
  let overlay;
  try {
    mockNative.Platform.OS = 'android';
    useGame.setState({ goIndieActive: false, goIndieResolved: true, overlay: null });
    store = await mountStore(StoreScreen);

    assert.equal(visibleText(store).includes('Your phone'), false);
    assert.equal(visibleText(store).includes('CATVERTISING'), false);
    assert.ok(visibleText(store).includes('Make your character an indie operator. Go Indie doubles what your apps earn while the app is closed.'));
    assert.equal(visibleText(store).some(value => value.includes('removes ads')), false);

    await act(async () => { useGame.setState({ goIndieActive: true }); });
    assert.ok(visibleText(store).includes('Indie operator status is active. Offline earnings are doubled — capped at 8 hours, same as always.'));
    assert.equal(visibleText(store).some(value => value.includes('Ads are removed')), false);
    await act(async () => { store.unmount(); });
    store = null;

    useGame.setState({ overlay: { type: 'paywall' } });
    const OverlayHost = require('../src/components/OverlayHost.tsx').default;
    await act(async () => { overlay = create(React.createElement(OverlayHost, { onReturnHome() {} })); });
    assert.ok(visibleText(overlay).includes('Make your character an indie operator. Go Indie doubles offline earnings in this game.'));
    assert.equal(visibleText(overlay).some(value => value.includes('removes ads')), false);
  } finally {
    if (store) await act(async () => { store.unmount(); });
    if (overlay) await act(async () => { overlay.unmount(); });
    mockNative.Platform.OS = previousOS;
    useGame.setState({ overlay: null });
  }
});
