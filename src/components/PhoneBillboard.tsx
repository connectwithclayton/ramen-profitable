import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useGame } from '../state/gameStore';
import { adsModule, bannerId, mayRequestAds, prepareAds, privacyOptionsRequired, showAdPrivacyOptions } from '../monetization/ads';
import { Btn, MonoText, Section, SectionHeader, Unit } from './ui';
import { C, S } from '../theme';

const NON_PERSONALIZED_REQUEST = { requestNonPersonalizedAdsOnly: true } as const;
const RETRY_INTERVAL_MS = 60_000;
const CREATIVE_EXPIRY_MS = 60 * 60_000;
type CreativeState = 'idle' | 'pending' | 'loaded' | 'failed' | 'retrying';

export default function PhoneBillboard({ active = true, indie }: { active?: boolean; indie: boolean }) {
  const eligible = useGame(mayRequestAds);
  const overlay = useGame(s => s.overlay !== null);
  const [ready, setReady] = useState(false);
  const [privacyRequired, setPrivacyRequired] = useState(false);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [width, setWidth] = useState(0);
  const [bannerWidth, setBannerWidth] = useState(0);
  const [layoutReady, setLayoutReady] = useState(false);
  const widthRef = useRef(0);
  const lastRequestAtRef = useRef<number | null>(null);
  const lastLoadedAtRef = useRef<number | null>(null);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const wasBackgroundedRef = useRef(AppState.currentState === 'background');
  const [loadedForegroundReturnAt, setLoadedForegroundReturnAt] = useState<number | null>(null);
  const wasActiveRef = useRef(active);
  const [loadedStoreReturnAt, setLoadedStoreReturnAt] = useState<number | null>(null);
  const [noFill, setNoFill] = useState(false);
  const [creativeState, setCreativeState] = useState<CreativeState>('idle');
  const creativeStateRef = useRef(creativeState);
  const [requestKey, setRequestKey] = useState(0);
  const measurementActive = active && foreground && !overlay && !privacyBusy;
  const requestable = measurementActive && layoutReady && eligible && width > 0;
  const nativeRequestInFlight = ready && (creativeState === 'pending' || creativeState === 'retrying');
  const wasRequestableRef = useRef(requestable);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'background') wasBackgroundedRef.current = true;
      if (state === 'active' && wasBackgroundedRef.current) {
        wasBackgroundedRef.current = false;
        setLoadedForegroundReturnAt(creativeStateRef.current === 'loaded' ? Date.now() : null);
      }
      setForeground(state === 'active');
    });
    return () => sub.remove();
  }, []);

  useLayoutEffect(() => {
    creativeStateRef.current = creativeState;
  }, [creativeState]);

  useLayoutEffect(() => {
    if (active === wasActiveRef.current) return;
    wasActiveRef.current = active;
    setLoadedStoreReturnAt(
      active && AppState.currentState === 'active' && creativeStateRef.current === 'loaded'
        ? Date.now()
        : null,
    );
  }, [active]);

  useLayoutEffect(() => {
    if (!measurementActive) setLayoutReady(false);
  }, [measurementActive]);

  useEffect(() => {
    let cancelled = false;
    const needsPreparation = creativeState === 'idle' || creativeState === 'retrying';
    if (!ready && needsPreparation && (!noFill || creativeState === 'retrying') && requestable) {
      const isRenderable = () => (
        !cancelled &&
        active &&
        widthRef.current > 0 &&
        AppState.currentState === 'active' &&
        useGame.getState().overlay === null
      );
      void prepareAds(isRenderable).then(async allowed => {
        if (!cancelled) {
          setReady(allowed);
          if (allowed) {
            setBannerWidth(widthRef.current);
            if (creativeState === 'idle') setCreativeState('pending');
          } else {
            if (creativeState === 'retrying' && lastRequestAtRef.current !== null) {
              lastRequestAtRef.current = Date.now();
            }
            setCreativeState('failed');
          }
        }
        const required = await privacyOptionsRequired().catch(() => false);
        if (!cancelled) setPrivacyRequired(required);
      });
    }
    void privacyOptionsRequired().then(required => {
      if (!cancelled) setPrivacyRequired(required);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [active, creativeState, noFill, ready, requestable, revision, width]);

  useEffect(() => {
    setReady(false);
    setCreativeState(state => {
      if (state === 'failed') return state;
      return state === 'retrying' ? 'failed' : 'idle';
    });
  }, [eligible, privacyBusy, revision]);

  useEffect(() => {
    if (!requestable || nativeRequestInFlight) return;
    const requestAt = lastRequestAtRef.current;
    const reloadLoadedAfterForeground = (
      creativeState === 'loaded' &&
      loadedForegroundReturnAt !== null &&
      requestAt !== null &&
      loadedForegroundReturnAt - requestAt >= RETRY_INTERVAL_MS
    );
    const loadedAt = lastLoadedAtRef.current;
    const reloadExpiredAfterStoreReturn = (
      creativeState === 'loaded' &&
      loadedStoreReturnAt !== null &&
      loadedAt !== null &&
      loadedStoreReturnAt - loadedAt >= CREATIVE_EXPIRY_MS
    );
    if (loadedForegroundReturnAt !== null) setLoadedForegroundReturnAt(null);
    if (loadedStoreReturnAt !== null) setLoadedStoreReturnAt(null);
    if (width === bannerWidth && !reloadLoadedAfterForeground && !reloadExpiredAfterStoreReturn) return;
    if (creativeState === 'loaded') {
      setCreativeState('pending');
      setRequestKey(value => value + 1);
    }
    setBannerWidth(width);
  }, [bannerWidth, creativeState, loadedForegroundReturnAt, loadedStoreReturnAt, nativeRequestInFlight, requestable, width]);

  // Any unloaded creative retries only on a qualifying return after any existing request cooldown.
  useEffect(() => {
    const returning = requestable && !wasRequestableRef.current;
    wasRequestableRef.current = requestable;
    const lastRequestAt = lastRequestAtRef.current;
    const retryDue = lastRequestAt === null
      ? creativeState === 'failed'
      : Date.now() - lastRequestAt >= RETRY_INTERVAL_MS;
    if (
      returning &&
      creativeState !== 'loaded' &&
      retryDue
    ) {
      if (lastRequestAt !== null) lastRequestAtRef.current = Date.now();
      setCreativeState('retrying');
      setRequestKey(value => value + 1);
      setBannerWidth(width);
    }
  }, [creativeState, requestable, width]);

  const privacy = async () => {
    setPrivacyBusy(true); // Unmount the native banner before changing consent.
    setReady(false);
    try {
      await showAdPrivacyOptions();
    } catch {
      useGame.getState().pushNotif('Ad privacy choices are unavailable. Try again later.', 'store');
    } finally {
      setPrivacyBusy(false);
      setRevision(value => value + 1);
    }
  };

  const mod = ready ? adsModule() : null;
  const id = bannerId();
  const Banner = mod?.BannerAd;
  const bannerActive = creativeState === 'pending' || creativeState === 'loaded' || creativeState === 'retrying';
  const retryingWithFallback = noFill && creativeState === 'retrying';
  const show = eligible && !privacyBusy && ready && bannerActive && (!noFill || creativeState === 'retrying') && bannerWidth > 0 && Banner && id;
  const bannerMounted = Boolean(show);
  const geometryCurrent = layoutReady && width === bannerWidth;
  const bannerConcealed = retryingWithFallback || !geometryCurrent;
  const expiredStoreReturnPending = (
    creativeState === 'loaded' &&
    loadedStoreReturnAt !== null &&
    lastLoadedAtRef.current !== null &&
    loadedStoreReturnAt - lastLoadedAtRef.current >= CREATIVE_EXPIRY_MS
  );
  const concealed = !active || !foreground || overlay || privacyBusy || expiredStoreReturnPending || (creativeState === 'loaded' && !geometryCurrent);

  useEffect(() => {
    if (bannerMounted) lastRequestAtRef.current = Date.now();
  }, [bannerMounted, bannerWidth, requestKey, revision]);

  return (
    <Section style={st.section}>
      <SectionHeader title="Your phone" meta="CATVERTISING" />
      <Unit style={st.phone}>
        <View style={st.speaker} />
        <MonoText style={st.label}>BILLBOARD · ADVERTISEMENT</MonoText>
        <View
          style={st.billboard}
        >
          {measurementActive && (
            <View
              collapsable={false}
              pointerEvents="none"
              style={st.measurement}
              onLayout={event => {
                const nextWidth = event.nativeEvent.layout.width;
                if (nextWidth <= 0) return;
                widthRef.current = nextWidth;
                setWidth(nextWidth);
                setLayoutReady(true);
              }}
            />
          )}
          <View
            accessibilityElementsHidden={concealed}
            importantForAccessibility={concealed ? 'no-hide-descendants' : 'auto'}
            pointerEvents={concealed ? 'none' : 'auto'}
            style={[st.billboardContent, concealed && st.concealed]}
          >
            {show && (
              <View
                accessibilityElementsHidden={bannerConcealed}
                importantForAccessibility={bannerConcealed ? 'no-hide-descendants' : 'auto'}
                pointerEvents={bannerConcealed ? 'none' : 'auto'}
                style={bannerConcealed && st.pendingBanner}
              >
                <Banner
                  key={`${revision}:${requestKey}`}
                  unitId={id}
                  size={mod.BannerAdSize.INLINE_ADAPTIVE_BANNER}
                  width={bannerWidth}
                  maxHeight={50}
                  requestOptions={NON_PERSONALIZED_REQUEST}
                  onAdLoaded={() => {
                    lastLoadedAtRef.current = Date.now();
                    const latestWidth = widthRef.current;
                    if (requestable && latestWidth > 0 && latestWidth !== bannerWidth) {
                      setCreativeState(state => state === 'loaded' ? 'pending' : state);
                      setRequestKey(value => value + 1);
                      setBannerWidth(latestWidth);
                      return;
                    }
                    setNoFill(false);
                    setCreativeState('loaded');
                  }}
                  onAdFailedToLoad={error => {
                    if (__DEV__) console.warn('[Catvertising] Banner unavailable.', error);
                    const failedNoFill = (error as Error & { code?: string }).code === 'googleMobileAds/no-fill';
                    lastRequestAtRef.current = Date.now();
                    const failedState = creativeStateRef.current;
                    if (failedState !== 'pending' && failedState !== 'retrying') return;
                    if (failedNoFill) setNoFill(true);
                    setCreativeState('failed');
                  }}
                />
              </View>
            )}
            {indie ? (
              <Text style={st.empty}>Go Indie. No ads. Just you and the cat.</Text>
            ) : noFill ? (
              <Text style={st.empty}>The cat is between sponsors.</Text>
            ) : null}
          </View>
        </View>
        <Text style={st.caption}>Even your fictional phone has a business model.</Text>
        <View style={st.homeIndicator} />
      </Unit>
      {privacyRequired && <Btn small ghost label="Ad privacy choices" accessibilityLabel="Ad privacy choices" disabled={privacyBusy} onPress={privacy} style={st.privacy} />}
    </Section>
  );
}

const st = StyleSheet.create({
  section: { paddingHorizontal: S.gap },
  phone: { padding: 7, marginTop: S.gap, alignSelf: 'center', width: '100%', maxWidth: 360, borderRadius: 24 },
  speaker: { width: 42, height: 4, borderRadius: 2, backgroundColor: C.line, alignSelf: 'center', marginVertical: S.gap },
  label: { color: C.mut, fontSize: 10, letterSpacing: 1, textAlign: 'center', marginVertical: S.gap },
  billboard: { minHeight: 50, backgroundColor: C.midnight },
  measurement: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  billboardContent: { minHeight: 50, width: '100%', alignItems: 'center', justifyContent: 'center' },
  concealed: { display: 'none' },
  pendingBanner: { position: 'absolute', left: 0, right: 0, alignItems: 'center', opacity: 0 },
  empty: { color: C.mut, fontSize: 12, textAlign: 'center', padding: S.gap },
  caption: { color: C.mut, fontSize: 12, textAlign: 'center', marginHorizontal: S.gap, marginTop: S.row, lineHeight: 18 },
  homeIndicator: { width: 70, height: 3, borderRadius: 2, backgroundColor: C.line, alignSelf: 'center', marginTop: S.row, marginBottom: S.gap },
  privacy: { marginTop: S.row, alignSelf: 'center' },
});
