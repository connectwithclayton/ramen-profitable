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
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
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
const nativeWidthTeardowns = [];
const privacyFormBannerCounts = [];
let nextBannerInstanceId = 0;
let mountedNativeBanners = 0;
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
    showPrivacyOptionsForm: async () => {
      privacyFormBannerCounts.push(mountedNativeBanners);
      consentAllowed = false;
      privacyRequired = false;
    },
  },
  BannerAd: props => {
    const instanceId = React.useRef(null);
    const previousWidth = React.useRef(null);
    if (instanceId.current === null) instanceId.current = ++nextBannerInstanceId;
    React.useLayoutEffect(() => {
      mountedNativeBanners++;
      return () => { mountedNativeBanners--; };
    }, []);
    React.useLayoutEffect(() => {
      if (previousWidth.current !== null && previousWidth.current !== props.width) {
        nativeWidthTeardowns.push({
          nativeInstanceId: instanceId.current,
          from: previousWidth.current,
          to: props.width,
        });
      }
      previousWidth.current = props.width;
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
  await act(async () => { tree = create(React.createElement(Store, { viewportBottom: 800 })); });
  return tree;
};
const setStoreBillboardViewport = async (tree, {
  scrollY = 0,
  viewportHeight = 800,
  sectionY = 100,
  phoneY = 20,
  billboardY = 30,
  billboardHeight = 50,
} = {}) => {
  const scroll = tree.root.findAllByType('ScrollView')
    .find(node => typeof node.props.onLayout === 'function' && typeof node.props.onScroll === 'function');
  const section = tree.root.findAllByProps({ testID: 'catvertising-section' })[0];
  const phone = tree.root.findAllByProps({ testID: 'catvertising-phone' })[0];
  const billboard = tree.root.findAllByProps({ testID: 'catvertising-billboard-frame' })[0];
  assert.ok(scroll, 'Store must expose its raw viewport handlers');
  assert.ok(section && phone && billboard, 'Catvertising must expose its nested content-coordinate frames');
  await act(async () => {
    section.props.onLayout({ nativeEvent: { layout: { x: 0, y: sectionY, width: 390, height: 180 } } });
    phone.props.onLayout({ nativeEvent: { layout: { x: 0, y: phoneY, width: 360, height: 140 } } });
    billboard.props.onLayout({ nativeEvent: { layout: { x: 0, y: billboardY, width: 320, height: billboardHeight } } });
    scroll.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 390, height: viewportHeight } } });
    scroll.props.onScroll({
      nativeEvent: {
        contentOffset: { x: 0, y: scrollY },
        contentSize: { width: 390, height: 1400 },
        layoutMeasurement: { width: 390, height: viewportHeight },
      },
    });
  });
  await flush();
};
const setBillboardProbeWidth = async (tree, width) => {
  const layout = tree.root.findAllByType('View')
    .find(node => (
      node.props.testID !== 'catvertising-billboard-frame' &&
      node.props.collapsable === false &&
      node.props.onLayout
    ));
  assert.ok(layout, 'an active Catvertising surface must expose its measurement probe');
  await act(async () => { layout.props.onLayout({ nativeEvent: { layout: { width } } }); });
  await flush();
};
const setBillboardWidth = async (tree, width) => {
  await setDefaultAppViewport(tree);
  await setStoreBillboardViewport(tree);
  await setBillboardProbeWidth(tree, width);
};
const setDockFadeTop = async (tree, y) => {
  const dockFade = tree.root.findAllByProps({ testID: 'dock-fade' })[0];
  assert.ok(dockFade?.props.onLayout, 'App must expose the measured dock-fade boundary');
  await act(async () => {
    dockFade.props.onLayout({ nativeEvent: { layout: { x: 0, y, width: 390, height: 172 } } });
  });
  await flush();
};
const setScreenHostTop = async (tree, y, height = 800) => {
  const host = tree.root.findAllByProps({ testID: 'screen-host' })[0];
  assert.ok(host?.props.onLayout, 'App must expose the measured screen origin');
  await act(async () => {
    host.props.onLayout({ nativeEvent: { layout: { x: 0, y, width: 390, height } } });
  });
  await flush();
};
const setDefaultAppViewport = async tree => {
  if (tree.root.findAllByProps({ testID: 'screen-host' }).length === 0) return;
  await act(async () => {
    const host = tree.root.findAllByProps({ testID: 'screen-host' })[0];
    const dockFade = tree.root.findAllByProps({ testID: 'dock-fade' })[0];
    host.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 800 } } });
    dockFade.props.onLayout({ nativeEvent: { layout: { x: 0, y: 800, width: 390, height: 172 } } });
  });
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
  nativeWidthTeardowns.length = 0;
  privacyFormBannerCounts.length = 0;
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

  const privacy = tree.root.findAllByType('Pressable')
    .find(node => node.props.accessibilityLabel === 'Ad privacy choices');
  assert.ok(privacy);
  assert.equal(consentFormCalls, 0, 'paid users must not receive a consent form');
  assert.equal(initializationCalls, 0, 'paid users must not initialize Mobile Ads');
  assert.equal(requests.length, 0, 'paid users must not request a banner');
  const consentInfoCallsBeforeForm = consentInfoCalls;
  await act(async () => { await privacy.props.onPress(); });
  await flush();
  assert.equal(
    consentInfoCalls,
    consentInfoCallsBeforeForm + 1,
    'privacy status must refresh once after the privacy form changes consent',
  );
  assert.equal(
    tree.root.findAllByType('Pressable')
      .some(node => node.props.accessibilityLabel === 'Ad privacy choices'),
    false,
  );
  await act(async () => { tree.unmount(); });
  consentAllowed = true;
  privacyRequired = false;
  consentStatus = 'NOT_REQUIRED';
});

// Exercise the mounted Store screen, real Zustand state, and public purchase APIs.
// Only native/network boundaries are doubles; removing the production gate must fail.
test('Store billboard waits for ownership and consent, honors purchases, and handles privacy changes', async () => {
  useGame.setState({ goIndieActive: true, goIndieResolved: false, overlay: null, notifs: [] });
  let tree;
  await act(async () => { tree = create(React.createElement(StoreScreen, { viewportBottom: 800 })); });
  const banners = () => tree.root.findAllByType('NativeBanner');
  await setBillboardWidth(tree, 340);
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
  await act(async () => { tree.unmount(); tree = create(React.createElement(StoreScreen, { viewportBottom: 800 })); });
  await setBillboardWidth(tree, 340);
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
  privacyRequired = true;
  await act(async () => { tree = create(React.createElement(StoreScreen, { viewportBottom: 800 })); });
  await setBillboardWidth(tree, 340);
  const before = requests.length;
  restored = deferred();
  await act(async () => { restore = purchases.restoreGoIndiePurchases(); });
  await act(async () => { restored.resolve(info(true)); await restore; });
  assert.equal(requests.length, before, 'fresh-install restore must never mount an ad');

  await act(async () => { listener(info(false)); });
  await flush();
  assert.equal(banners().length, 1);
  const privacy = tree.root.findAllByType('Pressable').find(node => node.props.accessibilityLabel === 'Ad privacy choices');
  assert.ok(privacy, 'required privacy options must be accessible');
  const privacyFormsBeforePress = privacyFormBannerCounts.length;
  await act(async () => { await privacy.props.onPress(); });
  await flush();
  assert.deepEqual(
    privacyFormBannerCounts.slice(privacyFormsBeforePress),
    [0],
    'the native privacy form must start only after the banner unmount commits',
  );
  assert.equal(banners().length, 0, 'withdrawal cannot leave the old creative mounted');
  assert.equal(
    tree.root.findAllByType('Pressable').some(node => node.props.accessibilityLabel === 'Ad privacy choices'),
    false,
    'privacy requirements must refresh after choices change',
  );
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

test('late hydration preserves the post-entitlement earnings clock', async t => {
  const originalNow = Date.now;
  const previousStorageRead = storageRead;
  const previousState = useGame.getState();
  let now = 1_000_000;
  Date.now = () => now;
  t.after(() => {
    Date.now = originalNow;
    storageRead = previousStorageRead;
    useGame.setState({
      cash: previousState.cash,
      mrr: previousState.mrr,
      lastSeen: previousState.lastSeen,
      goIndieActive: previousState.goIndieActive,
      goIndieResolved: previousState.goIndieResolved,
    });
  });

  useGame.setState({
    cash: 0,
    mrr: 120,
    lastSeen: 100,
    goIndieActive: false,
    goIndieResolved: false,
  });
  const disk = deferred();
  storageRead = () => disk.promise;
  const hydration = useGame.persist.rehydrate();
  listener(info(true));
  now += 5_000;
  useGame.getState().touchLastSeen();
  const departedAt = useGame.getState().lastSeen;
  disk.resolve(JSON.stringify({
    version: 2,
    state: { cash: 0, mrr: 120, lastSeen: 100, goIndieActive: false },
  }));
  await hydration;
  assert.equal(useGame.getState().goIndieActive, true);
  assert.equal(useGame.getState().goIndieResolved, true);
  assert.equal(useGame.getState().lastSeen, departedAt);

  now += 61_000;
  assert.equal(useGame.getState().applyOfflineEarnings(), 24.4);
});

test('an active restore preserves the paid offline earnings interval', async t => {
  const originalNow = Date.now;
  const previousState = useGame.getState();
  let now = 1_000_000;
  Date.now = () => now;
  t.after(() => {
    Date.now = originalNow;
    useGame.setState({
      cash: previousState.cash,
      mrr: previousState.mrr,
      lastSeen: previousState.lastSeen,
      goIndieActive: previousState.goIndieActive,
      goIndieResolved: previousState.goIndieResolved,
    });
  });

  useGame.setState({
    cash: 0,
    mrr: 120,
    lastSeen: now,
    goIndieActive: true,
    goIndieResolved: true,
  });
  customer = { promise: Promise.resolve(info(true)) };
  await purchases.initPurchases();
  restored = deferred();
  const restore = purchases.restoreGoIndiePurchases();
  await new Promise(resolve => setImmediate(resolve));
  useGame.getState().touchLastSeen();
  const departedAt = useGame.getState().lastSeen;

  now += 30_000;
  restored.resolve(info(true));
  assert.equal(await restore, true);
  assert.equal(useGame.getState().lastSeen, departedAt);

  now += 31_000;
  assert.equal(useGame.getState().applyOfflineEarnings(), 24.4);
});

test('a stale restore listener cannot revoke a newer confirmed purchase', async () => {
  customer = { promise: Promise.resolve(info(false)) };
  await purchases.initPurchases();
  listener(info(false));
  restored = deferred();
  const restore = purchases.restoreGoIndiePurchases();
  await new Promise(resolve => setImmediate(resolve));

  customer = { promise: Promise.resolve(info(true)) };
  paywall = deferred();
  const purchase = purchases.presentGoIndiePaywall();
  paywall.resolve('PURCHASED');
  assert.equal(await purchase, true);
  assert.equal(useGame.getState().goIndieActive, true);

  const staleRestoreInfo = info(false);
  listener(staleRestoreInfo);
  assert.equal(useGame.getState().goIndieActive, true);
  assert.equal(useGame.getState().goIndieResolved, true);
  assert.equal(require('../src/monetization/ads.ts').mayRequestAds(useGame.getState()), false);

  restored.resolve(staleRestoreInfo);
  assert.equal(await restore, true);
  assert.equal(useGame.getState().goIndieActive, true);
  assert.equal(useGame.getState().goIndieResolved, true);
  assert.equal(require('../src/monetization/ads.ts').mayRequestAds(useGame.getState()), false);

  listener(info(false));
  assert.equal(useGame.getState().goIndieActive, false);
  assert.equal(useGame.getState().goIndieResolved, true);
  assert.equal(require('../src/monetization/ads.ts').mayRequestAds(useGame.getState()), true);
});

test('a stalled purchase refresh cannot discard confirmed restore ownership', async () => {
  customer = { promise: Promise.resolve(info(false)) };
  await purchases.initPurchases();
  listener(info(false));

  restored = deferred();
  const restore = purchases.restoreGoIndiePurchases();
  await new Promise(resolve => setImmediate(resolve));

  const refreshInfo = deferred();
  const refreshStarted = deferred();
  customer = {
    get promise() {
      refreshStarted.resolve();
      return refreshInfo.promise;
    },
  };
  paywall = deferred();
  const purchase = purchases.presentGoIndiePaywall();
  paywall.resolve('PURCHASED');
  await refreshStarted.promise;

  restored.resolve(info(true));
  assert.equal(await restore, true);
  assert.equal(useGame.getState().goIndieActive, true);
  assert.equal(useGame.getState().goIndieResolved, true);
  assert.equal(require('../src/monetization/ads.ts').mayRequestAds(useGame.getState()), false);

  refreshInfo.resolve(info(true));
  assert.equal(await purchase, true);
});

test('a stale negative restore cannot clear the post-payment ad barrier', async () => {
  resetAdLifecycleState();
  useGame.setState({ notifs: [] });
  customer = { promise: Promise.resolve(info(false)) };
  await purchases.initPurchases();
  listener(info(false));

  const FreshApp = loadFreshApp();
  let tree;
  await act(async () => { tree = create(React.createElement(FreshApp)); });
  const tab = tree.root.findAllByType('Pressable')
    .find(node => node.props.accessibilityRole === 'tab' && node.props.accessibilityLabel === 'Store');
  const banners = () => tree.root.findAllByType('NativeBanner');
  const button = label => tree.root.findAllByType('Pressable')
    .filter(node => node.findAllByType('Text').some(text => text.props.children === label))
    .at(-1);

  await act(async () => { tab.props.onPress(); });
  await setBillboardWidth(tree, 320);
  await act(async () => { consentInfoUpdate.resolve(); await consentInfoUpdate.promise; });
  await flush();
  await act(async () => { consentForm.resolve(); await consentForm.promise; });
  await flush();
  assert.equal(banners().length, 1);
  await act(async () => { banners()[0].props.onAdLoaded({ width: 320, height: 50 }); });
  await act(async () => { useGame.getState().openGoIndiePaywall(); });

  restored = deferred();
  const restore = purchases.restoreGoIndiePurchases();
  await new Promise(resolve => setImmediate(resolve));

  const refreshInfo = deferred();
  const refreshStarted = deferred();
  customer = {
    get promise() {
      refreshStarted.resolve();
      return refreshInfo.promise;
    },
  };
  paywall = deferred();
  const purchase = purchases.presentGoIndiePaywall();
  await act(async () => {
    paywall.resolve('PURCHASED');
    await refreshStarted.promise;
  });
  await act(async () => {
    listener(info(false));
    restored.resolve(info(false));
    assert.equal(await restore, null);
  });
  assert.equal(useGame.getState().goIndieResolved, false);
  assert.equal(require('../src/monetization/ads.ts').mayRequestAds(useGame.getState()), false);
  assert.equal(banners().length, 0, 'pending purchase confirmation must unmount the advert');

  await act(async () => { button('Remain humble').props.onPress(); });
  await flush();
  await setBillboardWidth(tree, 320);
  assert.equal(useGame.getState().overlay, null);
  assert.equal(require('../src/monetization/ads.ts').mayRequestAds(useGame.getState()), false);
  assert.equal(banners().length, 0, 'overlay dismissal must not reveal an advert after payment');
  assert.equal(requests.length, 1, 'overlay dismissal must not issue another native request');

  await act(async () => {
    refreshInfo.resolve(info(true));
    assert.equal(await purchase, true);
  });
  assert.equal(useGame.getState().goIndieActive, true);
  assert.equal(useGame.getState().goIndieResolved, true);
  await act(async () => { tree.unmount(); });
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

test('suppressed CustomerInfo cannot confirm unresolved persisted ownership', async () => {
  useGame.setState({ goIndieActive: true, goIndieResolved: false });
  paywall = deferred();
  customer = { promise: Promise.resolve(info(false)) };
  const purchase = purchases.presentGoIndiePaywall();
  paywall.resolve('PURCHASED');
  assert.equal(await purchase, null);
  assert.equal(useGame.getState().goIndieResolved, false);
  assert.equal(require('../src/monetization/ads.ts').mayRequestAds(useGame.getState()), false);
});

test('release runtime accepts a valid pair and rejects cross-publisher identifiers', () => {
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
    admobConfig = {
      ios: {
        appId: 'ca-app-pub-2222222222222222~1111111111',
        bannerId: 'ca-app-pub-1111111111111111/1111111111',
      },
    };
    delete require.cache[modulePath];
    assert.throws(() => require(modulePath), /same publisher account/);
  } finally {
    global.__DEV__ = true;
    delete require.cache[modulePath];
  }
});

test('the measured dock-fade boundary requires the full billboard above the fade', async () => {
  resetAdLifecycleState();
  useGame.setState({ notifs: [] });
  const FreshApp = loadFreshApp();
  let tree;
  try {
    await act(async () => { tree = create(React.createElement(FreshApp)); });
    await setDockFadeTop(tree, 638);
    const storeTab = tree.root.findAllByType('Pressable')
      .find(node => node.props.accessibilityRole === 'tab' && node.props.accessibilityLabel === 'Store');
    await act(async () => { storeTab.props.onPress(); });

    const frame = {
      viewportHeight: 763,
      sectionY: 650,
      phoneY: 60,
      billboardY: 20,
      billboardHeight: 50,
    };
    await setStoreBillboardViewport(tree, { ...frame, scrollY: 0 });
    assert.equal(
      tree.root.findAllByType('View').filter(node => node.props.collapsable === false && node.props.onLayout).length,
      0,
      'a dock-fade measurement without the screen origin must fail closed',
    );
    assert.equal(requests.length, 0);

    await setScreenHostTop(tree, 47, 763);
    assert.equal(
      tree.root.findAllByType('View').filter(node => node.props.collapsable === false && node.props.onLayout).length,
      0,
      'a billboard entirely behind the normalized dock-fade boundary must not activate ad measurement',
    );
    assert.equal(requests.length, 0);

    await setStoreBillboardViewport(tree, { ...frame, scrollY: 60 });
    assert.equal(
      tree.root.findAllByType('View').filter(node => node.props.collapsable === false && node.props.onLayout).length,
      0,
      'a billboard above the dock but beneath the fade must not activate ad measurement',
    );
    assert.equal(requests.length, 0);

    await setStoreBillboardViewport(tree, { ...frame, scrollY: 189 });
    await setBillboardProbeWidth(tree, 320);
    await act(async () => { consentInfoUpdate.resolve(); await consentInfoUpdate.promise; });
    await flush();
    await act(async () => { consentForm.resolve(); await consentForm.promise; });
    await flush();
    assert.equal(requests.length, 1, 'full containment above the dock fade must permit one request');
  } finally {
    if (tree) await act(async () => { tree.unmount(); });
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

  await setBillboardWidth(tree, 344);
  assert.equal(banners().length, 1, 'iPad Split View-sized layout must mount Catvertising');
  assert.equal(banners()[0].props.size, 'INLINE_ADAPTIVE_BANNER');
  assert.equal(banners()[0].props.width, 344, 'iPad Split View-sized layout must use its measured width');
  assert.equal(banners()[0].props.maxHeight, 50);
  assert.deepEqual(banners()[0].props.requestOptions, { requestNonPersonalizedAdsOnly: true });
  assert.equal(requests.length, 2, 'the completed resize must issue exactly one native request');
  assert.notStrictEqual(banners()[0].props.nativeInstanceId, initialInstanceId);
  const splitViewRequest = banners()[0];

  await setBillboardWidth(tree, 330);
  await setBillboardWidth(tree, 284);
  assert.strictEqual(banners()[0], splitViewRequest, 'in-flight resizing must retain the native request');
  assert.equal(banners()[0].props.width, 344, 'in-flight resizing must not mutate the committed native width');
  assert.equal(requests.length, 2, 'continuous in-flight resizing must not issue native requests');
  assert.deepEqual(nativeWidthTeardowns, [], 'the native wrapper must never receive an in-place width change');

  await act(async () => { splitViewRequest.props.onAdLoaded({ width: 344, height: 50 }); });
  assert.equal(banners().length, 1, 'the latest iPad Slide Over-sized layout must mount Catvertising');
  assert.notStrictEqual(banners()[0], splitViewRequest, 'settlement must replace the stale-width native request');
  assert.equal(banners()[0].props.width, 284, 'settlement must coalesce to the latest measured width');
  assert.equal(requests.length, 3, 'settlement must issue one latest-width replacement request');
  assert.equal(requests.at(-1).nativeInstanceId, banners()[0].props.nativeInstanceId);
  assert.equal(hasNoFillCopy(), false);
  assert.deepEqual(nativeWidthTeardowns, []);

  const slideOverRequest = banners()[0];
  await act(async () => { slideOverRequest.props.onAdLoaded({ width: 284, height: 50 }); });
  assert.strictEqual(banners()[0], slideOverRequest);
  assert.equal(requests.length, 3, 'the latest-width load must not issue another request');
  assert.deepEqual(requests.map(request => request.width), [339, 344, 284]);

  const refreshNoFill = Object.assign(new Error('no fill'), { code: 'googleMobileAds/no-fill' });
  await act(async () => { slideOverRequest.props.onAdFailedToLoad(refreshNoFill); });
  assert.equal(banners().length, 1, 'an automatic-refresh failure must retain the loaded banner');
  assert.strictEqual(banners()[0], slideOverRequest);
  assert.equal(banners()[0].props.nativeInstanceId, slideOverRequest.props.nativeInstanceId);
  assert.equal(requests.length, 3);
  assert.equal(hasNoFillCopy(), false, 'a refresh failure must not replace a loaded advert with no-fill copy');
  assert.deepEqual(nativeWidthTeardowns, []);
  await act(async () => { tree.unmount(); });
});

test('preparation coalesces width changes without repeating consent reads', async t => {
  resetAdLifecycleState();
  useGame.setState({ notifs: [] });
  const FreshStoreScreen = loadFreshStoreScreen();
  const tree = await mountStore(FreshStoreScreen);
  t.after(async () => {
    consentInfoGate = null;
    await act(async () => { tree.unmount(); });
  });

  await setBillboardWidth(tree, 320);
  await act(async () => { consentInfoUpdate.resolve(); await consentInfoUpdate.promise; });
  await flush();
  consentInfoGate = deferred();
  const consentReadsBeforeForm = consentInfoCalls;
  await act(async () => { consentForm.resolve(); await consentForm.promise; });
  await flush();
  assert.equal(consentInfoCalls, consentReadsBeforeForm + 1);

  await setBillboardProbeWidth(tree, 300);
  await setBillboardProbeWidth(tree, 284);
  assert.equal(
    consentInfoCalls,
    consentReadsBeforeForm + 1,
    'positive width changes must not restart consent preparation',
  );

  await act(async () => { consentInfoGate.resolve(); await consentInfoGate.promise; });
  await flush();
  assert.equal(initializationCalls, 1);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].width, 284);
});

test('surface loss retires pending requests but retains loaded creatives', async t => {
  resetAdLifecycleState();
  useGame.setState({ notifs: [] });
  const originalNow = Date.now;
  let now = originalNow();
  Date.now = () => now;
  let tree;
  t.after(async () => {
    Date.now = originalNow;
    if (tree) await act(async () => { tree.unmount(); });
  });

  const FreshStoreScreen = loadFreshStoreScreen();
  const renderStore = active => React.createElement(FreshStoreScreen, { active, viewportBottom: 800 });
  const setActive = async active => {
    await act(async () => { tree.update(renderStore(active)); });
    await flush();
  };
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

  await act(async () => { tree = create(renderStore(true)); });
  await setBillboardWidth(tree, 320);
  await act(async () => { consentInfoUpdate.resolve(); await consentInfoUpdate.promise; });
  await flush();
  await act(async () => { consentForm.resolve(); await consentForm.promise; });
  await flush();
  assert.equal(requests.length, 1);
  assert.equal(banners().length, 1);
  const pendingBanner = banners()[0];
  const pendingInstanceId = pendingBanner.props.nativeInstanceId;
  const retiredLoad = pendingBanner.props.onAdLoaded;

  await setActive(false);
  assert.equal(probes().length, 0);
  assert.equal(banners().length, 0, 'surface loss must unmount a pending native request');
  await act(async () => { retiredLoad({ width: 320, height: 50 }); });
  await flush();
  assert.equal(banners().length, 0, 'a retired pending load must not settle shared state');

  await setActive(true);
  assert.equal(probes().length, 1);
  assert.equal(banners().length, 0, 'a return must await fresh measured geometry');
  await setBillboardProbeWidth(tree, 320);
  assert.equal(requests.length, 1, 'a sub-cooldown return must not remount the retired request');
  assert.equal(banners().length, 0);

  now += 60_000;
  await flush();
  assert.equal(requests.length, 1, 'elapsed time alone must not retry a retired request');
  await setActive(false);
  await setActive(true);
  await setBillboardProbeWidth(tree, 320);
  assert.equal(requests.length, 2, 'the next due measured return must mount one retry');
  assert.equal(banners().length, 1);
  const retryingBanner = banners()[0];
  assert.notEqual(retryingBanner.props.nativeInstanceId, pendingInstanceId);

  await setActive(false);
  assert.equal(banners().length, 0, 'surface loss must also unmount a retrying native request');
  await setActive(true);
  await setBillboardProbeWidth(tree, 320);
  assert.equal(requests.length, 2, 'a retired retry must keep the same cooldown boundary');
  assert.equal(banners().length, 0);

  now += 60_000;
  await flush();
  assert.equal(requests.length, 2);
  await setActive(false);
  await setActive(true);
  await setBillboardProbeWidth(tree, 320);
  assert.equal(requests.length, 3);
  const loadedBanner = banners()[0];
  await act(async () => { loadedBanner.props.onAdLoaded({ width: 320, height: 50 }); });

  await setActive(false);
  assert.strictEqual(banners()[0], loadedBanner, 'surface loss may retain an already loaded creative');
  assert.equal(bannerConcealed(), true, 'the retained loaded creative must remain concealed and disabled');
  assert.equal(requests.length, 3);
});

test('App retains loaded banners and reloads only after due foregrounds', async t => {
  resetAdLifecycleState();
  useGame.setState({ notifs: [] });
  const originalNow = Date.now;
  const originalSetTimeout = global.setTimeout;
  const originalClearTimeout = global.clearTimeout;
  let now = originalNow();
  Date.now = () => now;
  let tree;
  t.after(async () => {
    Date.now = originalNow;
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
    mockNative.AppState.currentState = 'active';
    if (tree) await act(async () => { tree.unmount(); });
  });
  const FreshApp = loadFreshApp();
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
  const foregroundTimerDelays = [];
  const foregroundTimerHandles = new Set();
  global.setTimeout = (_callback, delay) => {
    foregroundTimerDelays.push(delay);
    const handle = {};
    foregroundTimerHandles.add(handle);
    return handle;
  };
  global.clearTimeout = handle => { foregroundTimerHandles.delete(handle); };

  await act(async () => { setAppState('background'); });
  await flush();
  assert.equal(probes().length, 0, 'backgrounding must remove the active measurement probe');
  assert.strictEqual(banners()[0], loadedBanner, 'backgrounding must retain the loaded native banner');
  assert.equal(requests.length, 1);
  assert.equal(bannerConcealed(), true, 'backgrounding must conceal and disable the retained advert');
  now += 59_999;
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
  now += 1;
  await flush();
  assert.equal(requests.length, 1, 'elapsed cooldown time must not defer a foreground reload');
  assert.deepEqual(foregroundTimerDelays, [], 'a sub-cooldown foreground must not schedule recovery');

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

  now += 60_000;
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

  await act(async () => { resizedBanner.props.onAdLoaded({ width: 284, height: 50 }); });

  await act(async () => { setAppState('background'); });
  await flush();
  assert.strictEqual(banners()[0], resizedBanner, 'suspension must retain the loaded native banner');
  assert.equal(requests.length, 2);
  await act(async () => { setAppState('active'); });
  await flush();
  assert.strictEqual(banners()[0], resizedBanner, 'foreground recovery must await fresh geometry');
  assert.equal(requests.length, 2, 'foregrounding must not request before layout completes');
  await setBillboardWidth(tree, 284);
  assert.strictEqual(banners()[0], resizedBanner, 'a fresh automatic load must renew the foreground cooldown');
  assert.equal(requests.length, 2, 'a brief suspension must retain the automatically refreshed advert');

  now += 60_000;
  await act(async () => { setAppState('background'); });
  await flush();
  await act(async () => { setAppState('active'); });
  await flush();
  assert.strictEqual(banners()[0], resizedBanner, 'due foreground recovery must await fresh geometry');
  assert.equal(requests.length, 2, 'due foregrounding must not request before layout completes');
  await setBillboardWidth(tree, 284);
  assert.equal(requests.length, 3, 'the first post-cooldown foreground must issue one reload');
  assert.notStrictEqual(banners()[0], resizedBanner, 'foreground recovery must replace the suspended native banner');
  assert.equal(banners()[0].props.width, 284);
  assert.equal(requests.at(-1).nativeInstanceId, banners()[0].props.nativeInstanceId);
  assert.deepEqual(nativeWidthTeardowns, [], 'foreground recovery must not mutate a native banner width');
  const foregroundReplacement = banners()[0];
  await act(async () => { foregroundReplacement.props.onAdLoaded({ width: 284, height: 50 }); });
  await setBillboardWidth(tree, 284);
  assert.strictEqual(banners()[0], foregroundReplacement);
  assert.equal(requests.length, 3, 'loading the foreground replacement must not request again');
  assert.deepEqual(foregroundTimerDelays, [], 'suspension recovery must not schedule a timer');
});

test('replaced banners drop stale native callbacks before shared state changes', async t => {
  resetAdLifecycleState();
  useGame.setState({ notifs: [] });
  const originalNow = Date.now;
  const originalWarn = console.warn;
  let now = originalNow();
  const warnings = [];
  let tree;
  Date.now = () => now;
  console.warn = (...args) => { warnings.push(args); };
  t.after(async () => {
    Date.now = originalNow;
    console.warn = originalWarn;
    mockNative.AppState.currentState = 'active';
    if (tree) await act(async () => { tree.unmount(); });
  });

  const FreshStoreScreen = loadFreshStoreScreen();
  tree = await mountStore(FreshStoreScreen);
  const banners = () => tree.root.findAllByType('NativeBanner');
  const probes = () => tree.root.findAllByType('View')
    .filter(node => node.props.collapsable === false && node.props.onLayout);
  const hasNoFillCopy = () => tree.root.findAllByType('Text')
    .some(node => node.props.children === 'The cat is between sponsors.');
  const noFill = Object.assign(new Error('no fill'), { code: 'googleMobileAds/no-fill' });

  await setBillboardWidth(tree, 284);
  await act(async () => { consentInfoUpdate.resolve(); await consentInfoUpdate.promise; });
  await flush();
  await act(async () => { consentForm.resolve(); await consentForm.promise; });
  await flush();
  assert.equal(requests.length, 1);
  const first = banners()[0];
  const firstInstanceId = first.props.nativeInstanceId;
  const staleLoad = first.props.onAdLoaded;
  const staleFailure = first.props.onAdFailedToLoad;
  const staleOpen = first.props.onAdOpened;
  await act(async () => { staleLoad({ width: 284, height: 50 }); });

  now += 60_000;
  await act(async () => { setAppState('background'); });
  await flush();
  await act(async () => { setAppState('active'); });
  await flush();
  await setBillboardWidth(tree, 284);
  assert.equal(requests.length, 2, 'a due foreground must mount one same-width successor');
  const successor = banners()[0];
  assert.notEqual(successor.props.nativeInstanceId, firstInstanceId);

  await act(async () => { staleOpen(); });
  await flush();
  assert.equal(probes().length, 1, 'a retired destination event must not hide the current request');
  await act(async () => { staleLoad({ width: 284, height: 50 }); });
  await flush();
  assert.strictEqual(banners()[0], successor, 'a retired load must not replace or settle its successor');
  await act(async () => { staleFailure(noFill); });
  await flush();
  assert.strictEqual(banners()[0], successor, 'a retired failure must not tear down its successor');
  assert.equal(requests.length, 2);
  assert.equal(hasNoFillCopy(), false, 'a retired no-fill event must not change fallback copy');
  assert.deepEqual(warnings, [], 'retired failures must be dropped silently');

  await act(async () => { successor.props.onAdFailedToLoad(noFill); });
  await flush();
  assert.equal(banners().length, 0, 'the current request failure must still be honored');
  assert.equal(hasNoFillCopy(), true, 'only the current no-fill may reveal fallback copy');
});

test('fully visible scroll returns replace one expired creative without timers', async t => {
  resetAdLifecycleState();
  useGame.setState({ notifs: [] });
  const originalNow = Date.now;
  const originalSetTimeout = global.setTimeout;
  const originalSetInterval = global.setInterval;
  let now = originalNow();
  Date.now = () => now;
  let tree;
  const timeoutDelays = [];
  const intervalDelays = [];
  t.after(async () => {
    Date.now = originalNow;
    global.setTimeout = originalSetTimeout;
    global.setInterval = originalSetInterval;
    mockNative.AppState.currentState = 'active';
    if (tree) await act(async () => { tree.unmount(); });
    useGame.setState({ overlay: null });
  });

  const FreshApp = loadFreshApp();
  await act(async () => { tree = create(React.createElement(FreshApp)); });
  await setDefaultAppViewport(tree);
  const tab = label => tree.root.findAllByType('Pressable')
    .find(node => node.props.accessibilityRole === 'tab' && node.props.accessibilityLabel === label);
  const banners = () => tree.root.findAllByType('NativeBanner');
  const probes = () => tree.root.findAllByType('View')
    .filter(node => (
      node.props.testID !== 'catvertising-billboard-frame' &&
      node.props.collapsable === false &&
      node.props.onLayout
    ));
  const storeScroll = () => tree.root.findAllByType('ScrollView')
    .find(node => typeof node.props.onLayout === 'function' && typeof node.props.onScroll === 'function');
  const bannerConcealed = () => {
    const frame = tree.root.findAllByType('View')
      .find(node => node.props.accessibilityElementsHidden !== undefined);
    const styles = (Array.isArray(frame.props.style) ? frame.props.style.flat() : [frame.props.style])
      .filter(Boolean);
    return frame.props.accessibilityElementsHidden === true &&
      frame.props.pointerEvents === 'none' &&
      styles.some(style => style.display === 'none');
  };
  const scrollTo = async y => {
    const scroll = storeScroll();
    assert.ok(scroll, 'Store must expose its raw viewport handlers');
    await act(async () => {
      scroll.props.onScroll({
        nativeEvent: {
          contentOffset: { x: 0, y },
          contentSize: { width: 390, height: 1400 },
          layoutMeasurement: { width: 390, height: 600 },
        },
      });
    });
    await flush();
  };

  await act(async () => { tab('Store').props.onPress(); });
  await setStoreBillboardViewport(tree, {
    scrollY: 0,
    viewportHeight: 600,
    sectionY: 600,
    phoneY: 80,
    billboardY: 20,
    billboardHeight: 50,
  });
  await scrollTo(0);
  assert.equal(probes().length, 0, 'an offscreen billboard must not expose an ad measurement boundary');
  assert.equal(requests.length, 0, 'an initially offscreen billboard must not request an advert');

  await scrollTo(150);
  assert.equal(probes().length, 1, 'full vertical visibility must activate measurement');
  await setBillboardProbeWidth(tree, 320);
  await act(async () => { consentInfoUpdate.resolve(); await consentInfoUpdate.promise; });
  await flush();
  await act(async () => { consentForm.resolve(); await consentForm.promise; });
  await flush();
  assert.equal(requests.length, 1);
  assert.equal(banners().length, 1);
  await act(async () => { banners()[0].props.onAdLoaded({ width: 320, height: 50 }); });
  const loadedBanner = banners()[0];
  const loadedInstanceId = loadedBanner.props.nativeInstanceId;
  assert.equal(bannerConcealed(), false);

  global.setTimeout = (_callback, delay) => {
    timeoutDelays.push(delay);
    return {};
  };
  global.setInterval = (_callback, delay) => {
    intervalDelays.push(delay);
    return {};
  };

  await act(async () => { tab('Home').props.onPress(); });
  await flush();
  assert.equal(probes().length, 0);
  assert.strictEqual(banners()[0], loadedBanner);
  assert.equal(bannerConcealed(), true);
  await act(async () => { tab('Store').props.onPress(); });
  await flush();
  assert.equal(probes().length, 1, 'a Store return must use the shared measurement boundary');
  assert.strictEqual(banners()[0], loadedBanner);
  assert.equal(bannerConcealed(), true);
  await setBillboardProbeWidth(tree, 320);
  assert.strictEqual(banners()[0], loadedBanner);
  assert.equal(requests.length, 1);
  assert.equal(bannerConcealed(), false);

  await act(async () => { useGame.getState().openGoIndiePaywall(); });
  await flush();
  assert.equal(probes().length, 0);
  assert.strictEqual(banners()[0], loadedBanner);
  assert.equal(bannerConcealed(), true);
  await act(async () => { useGame.getState().dismissOverlay(); });
  await flush();
  assert.equal(probes().length, 1, 'an overlay dismissal must use the shared measurement boundary');
  assert.strictEqual(banners()[0], loadedBanner);
  await setBillboardProbeWidth(tree, 320);
  assert.strictEqual(banners()[0], loadedBanner);
  assert.equal(requests.length, 1);
  assert.equal(bannerConcealed(), false);

  await act(async () => { setAppState('background'); });
  await flush();
  assert.equal(probes().length, 0);
  assert.strictEqual(banners()[0], loadedBanner);
  assert.equal(bannerConcealed(), true);
  await act(async () => { setAppState('active'); });
  await flush();
  assert.equal(probes().length, 1, 'foregrounding must use the shared measurement boundary');
  assert.strictEqual(banners()[0], loadedBanner);
  await setBillboardProbeWidth(tree, 320);
  assert.strictEqual(banners()[0], loadedBanner);
  assert.equal(requests.length, 1);
  assert.equal(bannerConcealed(), false);

  await scrollTo(750);
  assert.equal(probes().length, 0, 'zero vertical intersection must conceal the billboard');
  assert.strictEqual(banners()[0], loadedBanner, 'scrolling away must retain the loaded native banner');
  assert.equal(bannerConcealed(), true);
  now += 60 * 60_000;
  await flush();
  assert.equal(requests.length, 1, 'expiry while offscreen must not issue a request');

  await scrollTo(700);
  assert.equal(probes().length, 1, 'full vertical visibility must create a fresh measurement boundary');
  assert.strictEqual(banners()[0], loadedBanner, 'an expired return must await fresh width');
  assert.equal(bannerConcealed(), true);
  assert.equal(requests.length, 1);
  await setBillboardProbeWidth(tree, 320);
  assert.equal(requests.length, 2, 'the expired scroll return must issue exactly one replacement');
  assert.notStrictEqual(banners()[0], loadedBanner);
  assert.notEqual(banners()[0].props.nativeInstanceId, loadedInstanceId);
  assert.deepEqual(requests.map(request => request.width), [320, 320]);
  assert.deepEqual(nativeWidthTeardowns, []);
  const replacement = banners()[0];

  await scrollTo(700);
  await setBillboardProbeWidth(tree, 320);
  assert.strictEqual(banners()[0], replacement);
  assert.equal(requests.length, 2, 'repeated visible scroll events must not duplicate the replacement');
  await act(async () => { replacement.props.onAdLoaded({ width: 320, height: 50 }); });
  await scrollTo(700);
  await setBillboardProbeWidth(tree, 320);
  assert.strictEqual(banners()[0], replacement);
  assert.equal(requests.length, 2, 'settling the replacement must not create another request');
  assert.deepEqual(timeoutDelays, [], 'visibility recovery must not schedule timers');
  assert.deepEqual(intervalDelays, [], 'visibility recovery must not schedule loops');
});

test('visibility returns replace creatives one hour after the latest native load', async t => {
  resetAdLifecycleState();
  useGame.setState({ notifs: [] });
  const originalNow = Date.now;
  const originalSetTimeout = global.setTimeout;
  const originalClearTimeout = global.clearTimeout;
  let now = originalNow();
  Date.now = () => now;
  let tree;
  t.after(async () => {
    Date.now = originalNow;
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
    mockNative.AppState.currentState = 'active';
    if (tree) await act(async () => { tree.unmount(); });
    useGame.setState({ overlay: null });
  });
  const FreshApp = loadFreshApp();
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

  await act(async () => { tab('Store').props.onPress(); });
  await setBillboardWidth(tree, 320);
  await act(async () => { consentInfoUpdate.resolve(); await consentInfoUpdate.promise; });
  await flush();
  await act(async () => { consentForm.resolve(); await consentForm.promise; });
  await flush();
  assert.equal(requests.length, 1);
  await act(async () => { banners()[0].props.onAdLoaded({ width: 320, height: 50 }); });
  const loadedBanner = banners()[0];
  const loadedInstanceId = loadedBanner.props.nativeInstanceId;
  const timerDelays = [];
  global.setTimeout = (_callback, delay) => {
    timerDelays.push(delay);
    return {};
  };
  global.clearTimeout = () => {};
  const returnToStoreAfter = async elapsed => {
    await act(async () => { tab('Home').props.onPress(); });
    now += elapsed;
    await act(async () => { tab('Store').props.onPress(); });
    await flush();
    await setBillboardWidth(tree, 320);
  };

  await returnToStoreAfter(3_599_999);
  assert.strictEqual(banners()[0], loadedBanner, 'a pre-expiry Store return must reuse the loaded creative');
  assert.equal(requests.length, 1);

  await act(async () => { loadedBanner.props.onAdLoaded({ width: 320, height: 50 }); });
  assert.equal(requests.length, 1, 'an automatic refresh load must keep the native instance');
  await act(async () => { useGame.getState().openGoIndiePaywall(); });
  now += 3_599_999;
  await flush();
  assert.equal(requests.length, 1, 'a hidden billboard must not request before a visibility return');
  await act(async () => { useGame.getState().dismissOverlay(); });
  await flush();
  assert.strictEqual(banners()[0], loadedBanner, 'a pre-expiry overlay dismissal must await fresh geometry');
  assert.equal(bannerConcealed(), true);
  await setBillboardWidth(tree, 320);
  assert.strictEqual(banners()[0], loadedBanner, 'expiry must be measured from the latest automatic refresh load');
  assert.equal(requests.length, 1);
  assert.equal(bannerConcealed(), false);

  const refreshFailure = Object.assign(new Error('refresh unavailable'), { code: 'googleMobileAds/network-error' });
  await act(async () => { loadedBanner.props.onAdFailedToLoad(refreshFailure); });
  assert.strictEqual(banners()[0], loadedBanner, 'a post-load refresh failure must retain the loaded creative');
  assert.equal(requests.length, 1);
  await act(async () => { useGame.getState().openGoIndiePaywall(); });
  now += 1;
  await flush();
  assert.equal(requests.length, 1, 'reaching expiry while hidden must not issue a request');
  await act(async () => { useGame.getState().dismissOverlay(); });
  await flush();
  assert.strictEqual(banners()[0], loadedBanner, 'an expired return inside the request cooldown must retain its state');
  assert.equal(bannerConcealed(), true, 'overlay dismissal must await fresh geometry');
  assert.equal(requests.length, 1);
  await setBillboardWidth(tree, 320);
  assert.strictEqual(banners()[0], loadedBanner, 'replacement must defer until a later visibility transition');
  assert.equal(requests.length, 1);
  assert.equal(bannerConcealed(), false);

  now += 59_999;
  await flush();
  assert.equal(requests.length, 1, 'elapsed cooldown time alone must not issue a replacement');
  await act(async () => { useGame.getState().openGoIndiePaywall(); });
  await act(async () => { useGame.getState().dismissOverlay(); });
  await flush();
  assert.strictEqual(banners()[0], loadedBanner, 'expiry replacement must await returned overlay geometry');
  assert.equal(bannerConcealed(), true, 'the due expired creative must remain concealed after overlay dismissal');
  assert.equal(requests.length, 1);
  const returnedProbe = probes()[0];
  assert.ok(returnedProbe);
  await act(async () => {
    returnedProbe.props.onLayout({ nativeEvent: { layout: { width: 284 } } });
    returnedProbe.props.onLayout({ nativeEvent: { layout: { width: 320 } } });
  });
  await flush();
  assert.equal(requests.length, 2, 'the next due overlay dismissal must issue one replacement request');
  assert.notStrictEqual(banners()[0], loadedBanner);
  assert.notEqual(banners()[0].props.nativeInstanceId, loadedInstanceId);
  assert.equal(banners()[0].props.width, 320, 'the replacement must use the latest coalesced width');
  assert.deepEqual(requests.map(request => request.width), [320, 320]);
  assert.deepEqual(nativeWidthTeardowns, []);
  assert.deepEqual(timerDelays, [], 'creative expiry must not schedule a timer');
  const replacement = banners()[0];
  await act(async () => { replacement.props.onAdLoaded({ width: 320, height: 50 }); });
  await setBillboardWidth(tree, 320);
  assert.strictEqual(banners()[0], replacement);
  assert.equal(requests.length, 2, 'settling the replacement must not issue another request');
});

test('returning from an ad destination rechecks creative expiry', async t => {
  resetAdLifecycleState();
  useGame.setState({ notifs: [] });
  const originalNow = Date.now;
  let now = originalNow();
  Date.now = () => now;
  let tree;
  t.after(async () => {
    Date.now = originalNow;
    if (tree) await act(async () => { tree.unmount(); });
  });

  const FreshStoreScreen = loadFreshStoreScreen();
  tree = await mountStore(FreshStoreScreen);
  const banners = () => tree.root.findAllByType('NativeBanner');
  const probes = () => tree.root.findAllByType('View')
    .filter(node => node.props.collapsable === false && node.props.onLayout);
  await setBillboardWidth(tree, 320);
  await act(async () => { consentInfoUpdate.resolve(); await consentInfoUpdate.promise; });
  await flush();
  await act(async () => { consentForm.resolve(); await consentForm.promise; });
  await flush();
  assert.equal(requests.length, 1);
  await act(async () => { banners()[0].props.onAdLoaded({ width: 320, height: 50 }); });
  const loadedBanner = banners()[0];

  await act(async () => { loadedBanner.props.onAdOpened(); });
  await flush();
  assert.equal(probes().length, 0, 'an SDK-presented destination must suspend measurement');
  now += 60 * 60_000 - 1;
  await act(async () => { loadedBanner.props.onAdClosed(); });
  await flush();
  await setBillboardProbeWidth(tree, 320);
  assert.strictEqual(banners()[0], loadedBanner, 'a pre-expiry destination return must reuse the creative');
  assert.equal(requests.length, 1);

  await act(async () => { loadedBanner.props.onAdOpened(); });
  now += 1;
  await act(async () => { loadedBanner.props.onAdClosed(); });
  await flush();
  assert.equal(probes().length, 1, 'destination return must create a fresh measurement boundary');
  await setBillboardProbeWidth(tree, 320);
  assert.equal(requests.length, 2, 'an expired destination return must issue one replacement');
  assert.notStrictEqual(banners()[0], loadedBanner);
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

    const retryingBanner = banners()[0];
    await setBillboardWidth(tree, 270);
    await setBillboardWidth(tree, 250);
    assert.equal(requests.length, 2, 'continuous retrying resizes must not issue native requests');
    assert.strictEqual(banners()[0], retryingBanner, 'retrying resizes must retain the in-flight native request');
    assert.equal(banners()[0].props.width, 284, 'retrying resizes must keep the committed native width immutable');
    assert.deepEqual(nativeWidthTeardowns, [], 'retrying resizes must not trigger native teardown');
    assert.equal(hasNoFillCopy(), true, 'retrying resizes must retain the confirmed fallback');

    await act(async () => { retryingBanner.props.onAdFailedToLoad(networkError); });
    await flush();
    assert.equal(banners().length, 0);
    assert.equal(hasNoFillCopy(), true, 'a stale-width failure must retain the confirmed fallback');
    assert.equal(requests.length, 2, 'a stale-width failure must not request the coalesced width');
    await act(async () => { tab('Home').props.onPress(); });
    await act(async () => { tab('Store').props.onPress(); });
    await setBillboardWidth(tree, 250);
    await flush();
    assert.equal(requests.length, 2, 'an immediate return after failure must honor the retry interval');
    assert.equal(hasNoFillCopy(), true);

    now += 60_000;
    await flush();
    assert.equal(requests.length, 2, 'elapsed time alone must not issue a replacement request');
    await act(async () => { setAppState('background'); });
    await flush();
    assert.equal(requests.length, 2, 'no request may run while the app is backgrounded');
    await act(async () => { setAppState('active'); });
    await setBillboardWidth(tree, 250);
    await flush();
    assert.equal(requests.length, 3, 'foregrounding into Store must recover on a qualifying return');
    assert.equal(hasNoFillCopy(), true, 'the fallback must remain until the replacement reports loaded');
    const recoveredBanner = banners()[0];
    assert.equal(recoveredBanner.props.width, 250);

    await setBillboardWidth(tree, 240);
    await setBillboardWidth(tree, 230);
    assert.strictEqual(banners()[0], recoveredBanner, 'recovery resizes must retain the in-flight native request');
    assert.equal(banners()[0].props.width, 250);
    assert.equal(requests.length, 3, 'recovery resizes must not issue native requests');
    assert.equal(hasNoFillCopy(), true);

    await act(async () => { recoveredBanner.props.onAdLoaded({ width: 250, height: 50 }); });
    assert.equal(requests.length, 4, 'retry settlement must issue one request at the latest width');
    assert.notStrictEqual(banners()[0], recoveredBanner, 'retry settlement must replace the stale native request');
    assert.equal(banners()[0].props.width, 230, 'retry settlement must use only the latest measured width');
    assert.equal(hasNoFillCopy(), true, 'a stale-width load must not clear the confirmed fallback');
    assert.deepEqual(nativeWidthTeardowns, []);

    const replacement = banners()[0];
    await act(async () => { replacement.props.onAdLoaded({ width: 230, height: 50 }); });
    assert.strictEqual(banners()[0], replacement, 'the latest-width load must reveal the replacement without remounting it');
    assert.equal(hasNoFillCopy(), false, 'only a loaded replacement may clear the fallback');
    assert.equal(requests.length, 4);
    assert.deepEqual(requests.map(request => request.width), [320, 284, 250, 230]);
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

test('a rejected UMP refresh retries only on a measured visibility return', async t => {
  resetAdLifecycleState();
  useGame.setState({ notifs: [], goIndieActive: false, goIndieResolved: false });
  const originalSetTimeout = global.setTimeout;
  const originalSetInterval = global.setInterval;
  const timeoutDelays = [];
  const intervalDelays = [];
  let tree;
  t.after(async () => {
    global.setTimeout = originalSetTimeout;
    global.setInterval = originalSetInterval;
    if (tree) await act(async () => { tree.unmount(); });
  });
  global.setTimeout = (_callback, delay) => {
    timeoutDelays.push(delay);
    return {};
  };
  global.setInterval = (_callback, delay) => {
    intervalDelays.push(delay);
    return {};
  };

  const FreshStoreScreen = loadFreshStoreScreen();
  const adsSession = require('../src/monetization/ads.ts');
  const failedUpdate = consentInfoUpdate;
  const launchRefresh = adsSession.refreshConsentSession();
  const sharedRefresh = adsSession.refreshConsentSession();
  assert.equal(consentInfoUpdateCalls, 1, 'concurrent consumers must share the launch refresh');

  tree = await mountStore(FreshStoreScreen);
  await setStoreBillboardViewport(tree);
  assert.equal(consentInfoUpdateCalls, 1, 'viewport intersection must await completed width measurement');
  await setBillboardProbeWidth(tree, 320);
  assert.equal(consentInfoUpdateCalls, 1, 'visible preparation must share the launch refresh');

  const launchRejected = assert.rejects(launchRefresh, /offline at launch/);
  const sharedRejected = assert.rejects(sharedRefresh, /offline at launch/);
  await act(async () => {
    failedUpdate.reject(new Error('offline at launch'));
    await Promise.all([launchRejected, sharedRejected]);
  });
  await flush();
  assert.equal(consentInfoCalls, 1, 'a rejected launch refresh must produce one privacy-status read');
  await setBillboardProbeWidth(tree, 300);
  assert.equal(consentInfoUpdateCalls, 1, 'continuous visibility must not immediately retry consent');
  assert.equal(consentInfoCalls, 1, 'layout changes must not repeat privacy-status reads');
  assert.equal(initializationCalls, 0);
  assert.equal(requests.length, 0);

  await act(async () => { useGame.setState({ goIndieResolved: true }); });
  await flush();
  assert.equal(
    consentInfoUpdateCalls,
    1,
    'ownership resolving free while continuously visible must not retry the rejected launch refresh',
  );

  consentInfoUpdate = deferred();
  await setStoreBillboardViewport(tree, { scrollY: 1_000 });
  await setStoreBillboardViewport(tree);
  assert.equal(consentInfoUpdateCalls, 1, 'visibility return must await its new width measurement');
  await setBillboardProbeWidth(tree, 284);
  assert.equal(consentInfoUpdateCalls, 2, 'the next measured visibility return must retry once');
  assert.equal(consentInfoCalls, 1, 'retry privacy status must await the replacement consent update');

  const recoveredUpdate = consentInfoUpdate;
  const sharedRecovery = adsSession.refreshConsentSession();
  assert.equal(consentInfoUpdateCalls, 2, 'recovery consumers must share one in-flight refresh');
  await act(async () => {
    recoveredUpdate.resolve();
    await Promise.all([recoveredUpdate.promise, sharedRecovery]);
  });
  await flush();
  assert.equal(consentInfoCalls, 2, 'each consent update must produce one privacy-status read');
  assert.equal(consentFormCalls, 1);
  await act(async () => { consentForm.resolve(); await consentForm.promise; });
  await flush();
  assert.equal(initializationCalls, 1);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].width, 284);
  assert.equal(consentInfoCalls, 3, 'ad preparation may read consent once after the form settles');

  await adsSession.refreshConsentSession();
  assert.equal(consentInfoUpdateCalls, 2, 'a successful refresh must remain deduplicated for the launch');
  assert.deepEqual(timeoutDelays, [], 'consent recovery must not schedule timers');
  assert.deepEqual(intervalDelays, [], 'consent recovery must not schedule loops');
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

test('notifications block ad preparation and conceal retained creatives', async () => {
  resetAdLifecycleState();
  useGame.setState({ notifs: [] });
  const FreshStoreScreen = loadFreshStoreScreen();
  const tree = await mountStore(FreshStoreScreen);
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

  try {
    await setBillboardWidth(tree, 320);
    await act(async () => { useGame.getState().pushNotif('Payday.', 'day-job'); });
    await flush();
    assert.equal(probes().length, 0, 'a notification must remove the active measurement boundary');

    await act(async () => { consentInfoUpdate.resolve(); await consentInfoUpdate.promise; });
    await flush();
    assert.equal(consentFormCalls, 0, 'a notification shown during refresh must block consent presentation');
    assert.equal(initializationCalls, 0);
    assert.equal(requests.length, 0);

    await act(async () => { useGame.setState({ notifs: [] }); });
    await flush();
    assert.equal(probes().length, 1, 'clearing notifications must create a fresh measurement boundary');
    await setBillboardProbeWidth(tree, 320);
    assert.equal(consentFormCalls, 1);
    await act(async () => { consentForm.resolve(); await consentForm.promise; });
    await flush();
    assert.equal(initializationCalls, 1);
    assert.equal(banners().length, 1);
    assert.equal(requests.length, 1);
    await act(async () => { banners()[0].props.onAdLoaded({ width: 320, height: 50 }); });
    const loadedBanner = banners()[0];
    assert.equal(bannerConcealed(), false);

    await act(async () => { useGame.getState().pushNotif('An event occurred.', 'store'); });
    await flush();
    assert.equal(probes().length, 0);
    assert.strictEqual(banners()[0], loadedBanner, 'a notification may retain the loaded native banner');
    assert.equal(bannerConcealed(), true, 'a notification must conceal and disable the retained advert');
    assert.equal(requests.length, 1);

    await act(async () => { useGame.setState({ notifs: [] }); });
    await flush();
    assert.equal(probes().length, 1);
    assert.strictEqual(banners()[0], loadedBanner);
    assert.equal(bannerConcealed(), true, 'a notification return must await fresh geometry');
    await setBillboardProbeWidth(tree, 320);
    assert.strictEqual(banners()[0], loadedBanner);
    assert.equal(bannerConcealed(), false);
    assert.equal(requests.length, 1, 'clearing notifications must not duplicate the loaded request');
  } finally {
    useGame.setState({ notifs: [] });
    await act(async () => { tree.unmount(); });
  }
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
