import React, { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useGame } from '../state/gameStore';
import { adsModule, bannerId, mayRequestAds, prepareAds, privacyOptionsRequired, showAdPrivacyOptions } from '../monetization/ads';
import { Btn, MonoText, Section, SectionHeader, Unit } from './ui';
import { C, S } from '../theme';

const NON_PERSONALIZED_REQUEST = { requestNonPersonalizedAdsOnly: true } as const;
const RETRY_INTERVAL_MS = 60_000;
type CreativeState = 'idle' | 'pending' | 'loaded' | 'failed' | 'retrying';

export default function PhoneBillboard({ active = true, indie }: { active?: boolean; indie: boolean }) {
  const eligible = useGame(mayRequestAds);
  const overlay = useGame(s => s.overlay !== null);
  const [ready, setReady] = useState(false);
  const [privacyRequired, setPrivacyRequired] = useState(false);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const lastRequestAtRef = useRef<number | null>(null);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [noFill, setNoFill] = useState(false);
  const [creativeState, setCreativeState] = useState<CreativeState>('idle');
  const [requestKey, setRequestKey] = useState(0);
  const requestable = active && eligible && foreground && !overlay && !privacyBusy && width > 0;
  const wasRequestableRef = useRef(requestable);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const needsPreparation = creativeState === 'idle' || creativeState === 'retrying';
    if (!ready && needsPreparation && (!noFill || creativeState === 'retrying') && active && eligible && foreground && !overlay && !privacyBusy && width > 0) {
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
  }, [active, creativeState, eligible, foreground, noFill, overlay, privacyBusy, ready, revision, width]);

  useEffect(() => {
    setReady(false);
    setCreativeState(state => {
      if (state === 'failed') return state;
      return state === 'retrying' ? 'failed' : 'idle';
    });
  }, [eligible, privacyBusy, revision, width]);

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
    }
  }, [creativeState, requestable]);

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
  const show = eligible && !privacyBusy && ready && bannerActive && (!noFill || creativeState === 'retrying') && width > 0 && Banner && id;
  const bannerMounted = Boolean(show);
  const concealed = !active || !foreground || overlay || privacyBusy;

  useEffect(() => {
    if (bannerMounted) lastRequestAtRef.current = Date.now();
  }, [bannerMounted, requestKey, revision]);

  return (
    <Section style={st.section}>
      <SectionHeader title="Your phone" meta="CATVERTISING" />
      <Unit style={st.phone}>
        <View style={st.speaker} />
        <MonoText style={st.label}>BILLBOARD · ADVERTISEMENT</MonoText>
        <View
          style={st.billboard}
          onLayout={event => {
            const nextWidth = event.nativeEvent.layout.width;
            if (nextWidth <= 0) return;
            widthRef.current = nextWidth;
            setWidth(nextWidth);
          }}
        >
          <View
            accessibilityElementsHidden={concealed}
            importantForAccessibility={concealed ? 'no-hide-descendants' : 'auto'}
            pointerEvents={concealed ? 'none' : 'auto'}
            style={[st.billboardContent, concealed && st.concealed]}
          >
            {show && (
              <View
                accessibilityElementsHidden={retryingWithFallback}
                importantForAccessibility={retryingWithFallback ? 'no-hide-descendants' : 'auto'}
                pointerEvents={retryingWithFallback ? 'none' : 'auto'}
                style={retryingWithFallback && st.pendingBanner}
              >
                <Banner
                  key={`${revision}:${requestKey}`}
                  unitId={id}
                  size={mod.BannerAdSize.INLINE_ADAPTIVE_BANNER}
                  width={width}
                  maxHeight={50}
                  requestOptions={NON_PERSONALIZED_REQUEST}
                  onAdLoaded={() => {
                    lastRequestAtRef.current = null;
                    setNoFill(false);
                    setCreativeState('loaded');
                  }}
                  onAdFailedToLoad={error => {
                    if (__DEV__) console.warn('[Catvertising] Banner unavailable.', error);
                    const failedNoFill = (error as Error & { code?: string }).code === 'googleMobileAds/no-fill';
                    lastRequestAtRef.current = Date.now();
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
  billboardContent: { minHeight: 50, width: '100%', alignItems: 'center', justifyContent: 'center' },
  concealed: { display: 'none' },
  pendingBanner: { position: 'absolute', left: 0, right: 0, alignItems: 'center', opacity: 0 },
  empty: { color: C.mut, fontSize: 12, textAlign: 'center', padding: S.gap },
  caption: { color: C.mut, fontSize: 12, textAlign: 'center', marginHorizontal: S.gap, marginTop: S.row, lineHeight: 18 },
  homeIndicator: { width: 70, height: 3, borderRadius: 2, backgroundColor: C.line, alignSelf: 'center', marginTop: S.row, marginBottom: S.gap },
  privacy: { marginTop: S.row, alignSelf: 'center' },
});
