/**
 * RevenueCat integration — the HAMM Award centerpiece.
 *
 * "Go Indie" is a real subscription that removes real ads AND upgrades
 * your in-game character. One purchase, two realities.
 *
 * react-native-purchases requires a dev build (EAS). In Expo Go the native
 * module is missing, so everything here degrades to mock mode gracefully.
 * Week 3 of SHIPPLAN.md swaps mock → live: add API keys, build with EAS,
 * create the "go_indie" entitlement in the RevenueCat dashboard.
 */

const API_KEYS = {
  ios: '', // appl_XXXX — from RevenueCat dashboard, Week 3
  android: '', // goog_XXXX
};

let Purchases: any = null;
let mockMode = true;

export async function initPurchases(): Promise<void> {
  try {
    // Dynamic require so Expo Go (no native module) doesn't crash at import time
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-purchases');
    Purchases = mod.default ?? mod;
    const { Platform } = require('react-native');
    const key = Platform.OS === 'ios' ? API_KEYS.ios : API_KEYS.android;
    if (!key) {
      console.log('[purchases] No API key set — mock mode.');
      return;
    }
    Purchases.configure({ apiKey: key });
    mockMode = false;
    console.log('[purchases] RevenueCat configured.');
  } catch (e) {
    console.log('[purchases] Native module unavailable (Expo Go?) — mock mode.', e);
  }
}

export async function presentGoIndiePaywall(): Promise<boolean> {
  if (mockMode || !Purchases) {
    // In mock mode the button is a wink, not a transaction.
    return false;
  }
  try {
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.availablePackages?.[0];
    if (!pkg) return false;
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo.entitlements.active['go_indie'] !== undefined;
  } catch (e: any) {
    if (!e?.userCancelled) console.warn('[purchases] purchase failed', e);
    return false;
  }
}

export async function hasGoIndie(): Promise<boolean> {
  if (mockMode || !Purchases) return false;
  try {
    const info = await Purchases.getCustomerInfo();
    return info.entitlements.active['go_indie'] !== undefined;
  } catch {
    return false;
  }
}
