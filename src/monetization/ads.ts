import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useGame } from '../state/gameStore';
import type { GameState } from '../state/gameStore';

type AdsModule = typeof import('react-native-google-mobile-ads');
let sdk: AdsModule | null = null;
let initialization: Promise<boolean> | null = null;
let consentInfoUpdate: Promise<void> | null = null;
let consentFormHandled = false;

export function mayRequestAds(state: Pick<GameState, 'goIndieActive' | 'goIndieResolved'>): boolean {
  return state.goIndieResolved && !state.goIndieActive;
}

export function bannerId(): string | null {
  if (Platform.OS !== 'ios') return null;
  const ids = Constants.expoConfig?.extra?.admob?.ios;
  if (!__DEV__) {
    const { assertProductionIds } = require('../../config/admob');
    assertProductionIds(ids);
  }
  return ids?.bannerId ?? null;
}

bannerId();

export function adsModule(): AdsModule | null {
  if (sdk) return sdk;
  if (Platform.OS !== 'ios') return null;
  try {
    sdk = require('react-native-google-mobile-ads');
    return sdk;
  } catch {
    return null; // Expo Go / an old development client has no native ads module.
  }
}

export async function refreshConsentSession(): Promise<void> {
  const mod = adsModule();
  if (!mod) return;
  if (!consentInfoUpdate) {
    consentInfoUpdate = (async () => {
      await mod.AdsConsent.requestInfoUpdate();
    })();
  }
  await consentInfoUpdate;
}

export async function prepareAds(): Promise<boolean> {
  if (!mayRequestAds(useGame.getState())) return false;
  const mod = adsModule();
  if (!mod) return false;
  if (!initialization) {
    initialization = (async () => {
      // Fail closed on consent errors; do not treat an error as permission.
      await refreshConsentSession();
      if (!mayRequestAds(useGame.getState())) return false;
      if (!consentFormHandled) {
        await mod.AdsConsent.loadAndShowConsentFormIfRequired();
        consentFormHandled = true;
      }
      const consent = await mod.AdsConsent.getConsentInfo();
      if (!consent.canRequestAds || !mayRequestAds(useGame.getState())) return false;
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
  await refreshConsentSession().catch(() => {});
  const info = await mod.AdsConsent.getConsentInfo();
  return info.privacyOptionsRequirementStatus === mod.AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;
}

export async function showAdPrivacyOptions(): Promise<void> {
  const mod = adsModule();
  if (!mod) return;
  initialization = null;
  await mod.AdsConsent.showPrivacyOptionsForm();
}
