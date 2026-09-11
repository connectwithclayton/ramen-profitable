import React, { useEffect, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useGame } from '../state/gameStore';
import { adsModule, bannerId, mayRequestAds, prepareAds, privacyOptionsRequired, showAdPrivacyOptions } from '../monetization/ads';
import { Btn, MonoText, Section, SectionHeader, Unit } from './ui';
import { C, S } from '../theme';

const NON_PERSONALIZED_REQUEST = { requestNonPersonalizedAdsOnly: true } as const;

/** A fictional phone is the unit; Google's real 320x50 creative stays intact. */
export default function PhoneBillboard() {
  const eligible = useGame(mayRequestAds);
  const indie = useGame(s => s.goIndieActive);
  const overlay = useGame(s => s.overlay !== null);
  const [ready, setReady] = useState(false);
  const [privacyRequired, setPrivacyRequired] = useState(false);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [width, setWidth] = useState(0);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setFailed(false);
    if (eligible && foreground && !overlay && !privacyBusy) {
      void prepareAds().then(async allowed => {
        if (!cancelled) setReady(allowed);
        const required = await privacyOptionsRequired().catch(() => false);
        if (!cancelled) setPrivacyRequired(required);
      });
    }
    void privacyOptionsRequired().then(required => {
      if (!cancelled) setPrivacyRequired(required);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [eligible, foreground, overlay, privacyBusy, revision]);

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
  const show = eligible && foreground && !overlay && !privacyBusy && ready && !failed && width >= 320 && Banner && id;

  return (
    <Section style={st.section}>
      <SectionHeader title="Your phone" meta="CATVERTISING" />
      <Unit style={st.phone}>
        <View style={st.speaker} />
        <MonoText style={st.label}>BILLBOARD · ADVERTISEMENT</MonoText>
        <View style={st.billboard} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
          {show ? (
            <Banner
              key={revision}
              unitId={id}
              size={mod.BannerAdSize.BANNER}
              requestOptions={NON_PERSONALIZED_REQUEST}
              onAdFailedToLoad={error => {
                if (__DEV__) console.warn('[Catvertising] Banner unavailable.', error);
                setFailed(true);
              }}
            />
          ) : (
            <Text style={st.empty}>{indie ? 'Go Indie. No ads. Just you and the cat.' : 'The cat is between sponsors.'}</Text>
          )}
        </View>
        <Text style={st.caption}>Even your fictional phone has a business model.</Text>
        <View style={st.homeIndicator} />
      </Unit>
      {privacyRequired && <Btn small ghost label="Ad privacy choices" accessibilityLabel="Ad privacy choices" disabled={privacyBusy} onPress={privacy} style={st.privacy} />}
    </Section>
  );
}

const st = StyleSheet.create({
  // A 320pt creative + 16pt bezel fits a 375pt phone without scaling the ad.
  section: { paddingHorizontal: S.gap },
  phone: { padding: 7, marginTop: S.gap, alignSelf: 'center', width: '100%', maxWidth: 360, borderRadius: 24 },
  speaker: { width: 42, height: 4, borderRadius: 2, backgroundColor: C.line, alignSelf: 'center', marginVertical: S.gap },
  label: { color: C.mut, fontSize: 10, letterSpacing: 1, textAlign: 'center', marginVertical: S.gap },
  billboard: { minHeight: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: C.midnight },
  empty: { color: C.mut, fontSize: 12, textAlign: 'center', padding: S.gap },
  caption: { color: C.mut, fontSize: 12, textAlign: 'center', marginHorizontal: S.gap, marginTop: S.row, lineHeight: 18 },
  homeIndicator: { width: 70, height: 3, borderRadius: 2, backgroundColor: C.line, alignSelf: 'center', marginTop: S.row, marginBottom: S.gap },
  privacy: { marginTop: S.row, alignSelf: 'center' },
});
