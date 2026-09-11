import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useGame } from '../state/gameStore';
import type { GameState } from '../state/gameStore';

type AdsModule = typeof import('react-native-google-mobile-ads');
let sdk: AdsModule | null = null;
let initialization: Promise<boolean> | null = null;
let consentGathered = false;

export function mayRequestAds(state: Pick<GameState, 'goIndieActive' | 'goIndieResolved' | 'purchasePending'>): boolean {
  return state.goIndieResolved && !state.goIndieActive && !state.purchasePending;
}

export function bannerId(): string | null {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;
  const ids = Constants.expoConfig?.extra?.admob?.[Platform.OS];
  if (!__DEV__) {
    const { assertProductionIds } = require('../../config/admob');
    assertProductionIds(ids, Platform.OS);
  }
  return ids?.bannerId ?? null;
}

// Runs at application import, including when an ad would otherwise be hidden.
// A release JS bundle carrying stale sample config cannot silently run.
bannerId();

export function adsModule(): AdsModule | null {
  if (sdk) return sdk;
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;
  try {
    sdk = require('react-native-google-mobile-ads');
    return sdk;
  } catch {
    return null; // Expo Go / an old development client has no native ads module.
  }
}

export async function prepareAds(): Promise<boolean> {
  if (!mayRequestAds(useGame.getState())) return false;
  const mod = adsModule();
  if (!mod) return false;
  if (!initialization) {
    initialization = (async () => {
      // Fail closed on consent errors; do not treat an error as permission.
      if (!consentGathered) {
        await mod.AdsConsent.gatherConsent();
        consentGathered = true;
      }
      const consent = await mod.AdsConsent.getConsentInfo();
      if (!consent.canRequestAds || !mayRequestAds(useGame.getState())) return false;
      await mod.default().setRequestConfiguration({ maxAdContentRating: mod.MaxAdContentRating.PG });
      if (!mayRequestAds(useGame.getState())) return false;
      await mod.default().initialize();
      return true;
    })().catch(error => {
      if (__DEV__) console.warn('[Catvertising] Consent or SDK initialization unavailable.', error);
      return false;
    });
  }
  const ready = await initialization;
  if (!ready) initialization = null;
  return ready && mayRequestAds(useGame.getState());
}

export async function privacyOptionsRequired(): Promise<boolean> {
  const mod = adsModule();
  if (!mod) return false;
  const info = await mod.AdsConsent.getConsentInfo();
  return info.privacyOptionsRequirementStatus === mod.AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;
}

export async function showAdPrivacyOptions(): Promise<void> {
  const mod = adsModule();
  if (!mod) return;
  initialization = null;
  await mod.AdsConsent.showPrivacyOptionsForm();
}
