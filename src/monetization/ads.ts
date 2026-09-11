import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useGame } from '../state/gameStore';
import type { GameState } from '../state/gameStore';

type AdsModule = typeof import('react-native-google-mobile-ads');
type AdsPreparationEligibility = () => boolean;
let sdk: AdsModule | null = null;
let sdkInitialization: Promise<boolean> | null = null;
let consentInfoUpdate: Promise<void> | null = null;
let consentInfoUpdateError: unknown | null = null;
let consentForm: Promise<void> | null = null;
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

export function consentRetryAvailable(): boolean {
  return consentInfoUpdate === null && consentInfoUpdateError !== null;
}

export async function refreshConsentSession(retryRejected = false): Promise<void> {
  const mod = adsModule();
  if (!mod) return;
  if (!consentInfoUpdate) {
    if (consentInfoUpdateError !== null && !retryRejected) throw consentInfoUpdateError;
    consentInfoUpdateError = null;
    consentInfoUpdate = (async () => {
      await mod.AdsConsent.requestInfoUpdate();
    })();
  }
  const update = consentInfoUpdate;
  try {
    await update;
  } catch (error) {
    if (consentInfoUpdate === update) {
      consentInfoUpdate = null;
      consentInfoUpdateError = error;
    }
    throw error;
  }
}

function preparationEligible(isRenderable: AdsPreparationEligibility): boolean {
  return isRenderable() && mayRequestAds(useGame.getState());
}

async function showConsentFormIfRequired(mod: AdsModule): Promise<void> {
  if (consentFormHandled) return;
  if (!consentForm) {
    consentForm = mod.AdsConsent.loadAndShowConsentFormIfRequired()
      .then(() => { consentFormHandled = true; })
      .finally(() => { consentForm = null; });
  }
  await consentForm;
}

export async function prepareAds(
  isRenderable: AdsPreparationEligibility,
  retryRejectedConsent = false,
): Promise<boolean> {
  if (!preparationEligible(isRenderable)) return false;
  const mod = adsModule();
  if (!mod) return false;
  try {
    await refreshConsentSession(retryRejectedConsent);
    if (!preparationEligible(isRenderable)) return false;
    // UMP combines loading and presentation; accept its in-flight window and recheck after dismissal.
    await showConsentFormIfRequired(mod);
    if (!preparationEligible(isRenderable)) return false;
    const consent = await mod.AdsConsent.getConsentInfo();
    if (!consent.canRequestAds || !preparationEligible(isRenderable)) return false;
    if (!sdkInitialization) {
      sdkInitialization = mod.default().initialize().then(() => true).catch(error => {
        if (__DEV__) console.warn('[Catvertising] Consent or SDK initialization unavailable.', error);
        return false;
      });
    }
    const initialization = sdkInitialization;
    const ready = await initialization;
    if (!ready && sdkInitialization === initialization) sdkInitialization = null;
    return ready && preparationEligible(isRenderable);
  } catch (error) {
    if (__DEV__) console.warn('[Catvertising] Consent or SDK initialization unavailable.', error);
    return false;
  }
}

export async function privacyOptionsRequired(): Promise<boolean> {
  const mod = adsModule();
  if (!mod) return false;
  const update = consentInfoUpdate;
  if (update) await update.catch(() => {});
  const info = await mod.AdsConsent.getConsentInfo();
  return info.privacyOptionsRequirementStatus === mod.AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;
}

export async function showAdPrivacyOptions(): Promise<void> {
  const mod = adsModule();
  if (!mod) return;
  sdkInitialization = null;
  await mod.AdsConsent.showPrivacyOptionsForm();
}
