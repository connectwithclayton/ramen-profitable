import React, { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useGame } from '../state/gameStore';
import { adsModule, bannerId, mayRequestAds, prepareAds, privacyOptionsRequired, showAdPrivacyOptions } from '../monetization/ads';
import { Btn, MonoText, Section, SectionHeader, Unit } from './ui';
import { C, S } from '../theme';

const NON_PERSONALIZED_REQUEST = { requestNonPersonalizedAdsOnly: true } as const;
const NO_FILL_RETRY_INTERVAL_MS = 60_000;

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
  const [retryingNoFill, setRetryingNoFill] = useState(false);
  const requestable = active && eligible && foreground && !overlay && !privacyBusy && width > 0;
  const wasRequestableRef = useRef(requestable);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!ready && (!noFill || retryingNoFill) && active && eligible && foreground && !overlay && !privacyBusy && width > 0) {
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
          if (!allowed && retryingNoFill) {
            lastRequestAtRef.current = Date.now();
            setRetryingNoFill(false);
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
  }, [active, eligible, foreground, noFill, overlay, privacyBusy, ready, retryingNoFill, revision, width]);

  useEffect(() => {
    setReady(false);
    setRetryingNoFill(retrying => {
      if (retrying) lastRequestAtRef.current = Date.now();
      return false;
    });
  }, [eligible, privacyBusy, revision, width]);

  useEffect(() => {
    const returning = requestable && !wasRequestableRef.current;
    wasRequestableRef.current = requestable;
    const lastRequestAt = lastRequestAtRef.current;
    if (
      returning &&
      noFill &&
      !retryingNoFill &&
      lastRequestAt !== null &&
      Date.now() - lastRequestAt >= NO_FILL_RETRY_INTERVAL_MS
    ) {
      lastRequestAtRef.current = Date.now();
      setRetryingNoFill(true);
    }
  }, [noFill, requestable, retryingNoFill]);

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
  const show = eligible && !privacyBusy && ready && (!noFill || retryingNoFill) && width > 0 && Banner && id;
  const concealed = !active || !foreground || overlay || privacyBusy;

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
                accessibilityElementsHidden={retryingNoFill}
                importantForAccessibility={retryingNoFill ? 'no-hide-descendants' : 'auto'}
                pointerEvents={retryingNoFill ? 'none' : 'auto'}
                style={retryingNoFill && st.pendingBanner}
              >
                <Banner
                  key={revision}
                  unitId={id}
                  size={mod.BannerAdSize.INLINE_ADAPTIVE_BANNER}
                  width={width}
                  maxHeight={50}
                  requestOptions={NON_PERSONALIZED_REQUEST}
                  onAdLoaded={() => {
                    if (retryingNoFill) {
                      lastRequestAtRef.current = null;
                      setNoFill(false);
                      setRetryingNoFill(false);
                    }
                  }}
                  onAdFailedToLoad={error => {
                    if (__DEV__) console.warn('[Catvertising] Banner unavailable.', error);
                    const failedNoFill = (error as Error & { code?: string }).code === 'googleMobileAds/no-fill';
                    if (failedNoFill || retryingNoFill) lastRequestAtRef.current = Date.now();
                    if (failedNoFill) setNoFill(true);
                    if (retryingNoFill) setRetryingNoFill(false);
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
