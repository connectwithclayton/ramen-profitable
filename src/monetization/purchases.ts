/**
 * RevenueCat integration — the HAMM Award centerpiece.
 *
 * "Go Indie" is a non-consumable unlock that upgrades your in-game character.
 *
 * react-native-purchases requires a development build for real purchases.
 * When the native module or the appropriate environment key is unavailable,
 * everything here degrades to mock mode gracefully.
 */

import Constants from 'expo-constants';

type NativePlatform = 'ios' | 'android';

type KeySelection =
  | { apiKey: string; environment: 'test-store' | 'production' }
  | { apiKey: null; reason: string };

export type RevenueCatKeyConfig = {
  testStoreApiKey?: string;
  iosApiKey?: string;
  androidApiKey?: string;
};

const TEST_STORE_KEY_PREFIX = 'test_';
const PLATFORM_KEY_PREFIX: Record<NativePlatform, string> = {
  ios: 'appl_',
  android: 'goog_',
};

function cleanKey(value: string | undefined): string | null {
  const key = value?.trim();
  return key ? key : null;
}

/**
 * Debug bundles can only use the Test Store variable. Release bundles never
 * read it and only accept the public key prefix for their current platform.
 * A misplaced Test Store key therefore leaves purchases disabled instead of
 * silently configuring a store build with it.
 */
export function selectRevenueCatApiKey(
  platform: string,
  isDevelopment: boolean,
  keys: RevenueCatKeyConfig,
): KeySelection {
  if (platform !== 'ios' && platform !== 'android') {
    return { apiKey: null, reason: `unsupported platform: ${platform}` };
  }

  if (isDevelopment) {
    const testStoreKey = cleanKey(keys.testStoreApiKey);
    if (!testStoreKey) {
      return { apiKey: null, reason: 'Test Store API key is not set' };
    }
    if (!testStoreKey.startsWith(TEST_STORE_KEY_PREFIX)) {
      return {
        apiKey: null,
        reason: 'development key is not a RevenueCat Test Store key',
      };
    }
    return { apiKey: testStoreKey, environment: 'test-store' };
  }

  const platformKey = cleanKey(
    platform === 'ios' ? keys.iosApiKey : keys.androidApiKey,
  );
  if (!platformKey) {
    return { apiKey: null, reason: `${platform} release API key is not set` };
  }
  if (!platformKey.startsWith(PLATFORM_KEY_PREFIX[platform])) {
    return {
      apiKey: null,
      reason: `${platform} release API key has the wrong key type`,
    };
  }
  return { apiKey: platformKey, environment: 'production' };
}

let Purchases: any = null;
let RevenueCatUI: any = null;
let mockMode = true;
let initializationPromise: Promise<boolean | null> | null = null;
let purchaseOperation: Promise<unknown> = Promise.resolve();

const GO_INDIE_ENTITLEMENT = 'go_indie';

function configuredKeys(): RevenueCatKeyConfig {
  const extra = Constants.expoConfig?.extra?.revenueCat;
  return extra && typeof extra === 'object' ? extra : {};
}

function isGoIndieActive(customerInfo: any): boolean {
  return customerInfo?.entitlements?.active?.[GO_INDIE_ENTITLEMENT] !== undefined;
}

async function refreshGoIndieEntitlement(): Promise<boolean | null> {
  if (mockMode || !Purchases) return null;
  try {
    const info = await Purchases.getCustomerInfo();
    return isGoIndieActive(info);
  } catch (e) {
    console.warn('[purchases] Could not refresh CustomerInfo.', e);
    return null;
  }
}

function serializePurchaseOperation<T>(operation: () => Promise<T>): Promise<T> {
  const next = purchaseOperation.then(() => operation(), () => operation());
  purchaseOperation = next.then(() => undefined, () => undefined);
  return next;
}

async function configurePurchases(): Promise<boolean | null> {
  try {
    // Dynamic require so Expo Go (no native module) doesn't crash at import time
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-purchases');
    Purchases = mod.default ?? mod;
    const { Platform } = require('react-native');
    const selection = selectRevenueCatApiKey(
      Platform.OS,
      __DEV__,
      configuredKeys(),
    );
    if ('reason' in selection) {
      console.log(`[purchases] ${selection.reason} — mock mode.`);
      return null;
    }
    const logLevel = __DEV__ ? mod.LOG_LEVEL.VERBOSE : mod.LOG_LEVEL.WARN;
    await Purchases.setLogLevel(logLevel);
    Purchases.configure({ apiKey: selection.apiKey });
    mockMode = false;
    console.log(`[purchases] RevenueCat configured for ${selection.environment}.`);
    return refreshGoIndieEntitlement();
  } catch (e) {
    console.log('[purchases] Native module unavailable (Expo Go?) — mock mode.', e);
    return null;
  }
}

export function initPurchases(): Promise<boolean | null> {
  if (!initializationPromise) {
    initializationPromise = serializePurchaseOperation(configurePurchases);
  }
  return initializationPromise;
}

export async function presentGoIndiePaywall(): Promise<boolean> {
  await initPurchases();
  if (mockMode || !Purchases) return false;
  return serializePurchaseOperation(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const uiMod = require('react-native-purchases-ui');
      RevenueCatUI = uiMod.default ?? uiMod;
      const offerings = await Purchases.getOfferings();
      const offering = offerings.current;
      if (!offering?.availablePackages?.length) {
        console.warn('[purchases] Current Offering has no available packages.');
        return false;
      }

      if (__DEV__) {
        const packageIds = offering.availablePackages
          .map((pkg: any) => pkg.product?.identifier ?? pkg.identifier)
          .join(', ');
        console.log(`[purchases] Current Offering "${offering.identifier}" packages: ${packageIds}`);
      }

      await RevenueCatUI.presentPaywall({ offering });
      return (await refreshGoIndieEntitlement()) === true;
    } catch (e: any) {
      if (!e?.userCancelled) console.warn('[purchases] purchase failed', e);
      return false;
    }
  });
}

export async function restoreGoIndiePurchases(): Promise<boolean | null> {
  await initPurchases();
  if (mockMode || !Purchases) return null;
  return serializePurchaseOperation(async () => {
    try {
      const customerInfo = await Purchases.restorePurchases();
      return isGoIndieActive(customerInfo);
    } catch (e) {
      console.warn('[purchases] restore failed', e);
      return null;
    }
  });
}

export async function hasGoIndie(): Promise<boolean> {
  await initPurchases();
  if (mockMode || !Purchases) return false;
  return (await serializePurchaseOperation(refreshGoIndieEntitlement)) === true;
}
