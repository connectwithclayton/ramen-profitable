import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useGame } from '../state/gameStore';
import { REVIEW_MSGS } from '../content/content';
import { Btn, Eyebrow, MonoText, fmt } from './ui';
import { C, R } from '../theme';
import { presentGoIndiePaywall } from '../monetization/purchases';
import PaywallDesigner from './PaywallDesigner';
import { CelebrateIcon, RamenProfitableIcon } from './icons';

function Spinner() {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true })
    ).start();
  }, []);
  const rot = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return <Animated.View style={[st.spinner, { transform: [{ rotate: rot }] }]} />;
}

function ReviewSheet({ appName }: { appName: string }) {
  const [msg, setMsg] = useState(REVIEW_MSGS[0]);
  const resolveReview = useGame(s => s.resolveReview);

  useEffect(() => {
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setMsg(REVIEW_MSGS[i % REVIEW_MSGS.length]);
      Haptics.selectionAsync().catch(() => {});
    }, 900);
    const done = setTimeout(() => {
      clearInterval(iv);
      resolveReview();
    }, 4200);
    return () => {
      clearInterval(iv);
      clearTimeout(done);
    };
  }, []);

  return (
    <>
      <Eyebrow>App Review</Eyebrow>
      <Text style={st.h1}>{appName}</Text>
      <Spinner />
      <MonoText style={{ color: C.mut, fontSize: 13, textAlign: 'center' }}>{msg}</MonoText>
    </>
  );
}

export default function OverlayHost() {
  const overlay = useGame(s => s.overlay);
  const dismiss = useGame(s => s.dismissOverlay);
  const showPaywall = useGame(s => s.showPaywallIfFirstLaunch);
  const markPaywallShown = useGame(s => s.markPaywallShown);
  const setGoIndieActive = useGame(s => s.setGoIndieActive);
  const pushNotif = useGame(s => s.pushNotif);
  const mrr = useGame(s => s.mrr);

  useEffect(() => {
    if (overlay?.type === 'verdict') {
      (overlay.ok
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      ).catch(() => {});
    }
    if (overlay?.type === 'win') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, [overlay?.type]);

  if (!overlay) return null;

  return (
    <View style={st.backdrop}>
      <View style={st.sheet}>
        {overlay.type === 'review' && <ReviewSheet appName={overlay.appName} />}

        {overlay.type === 'verdict' && overlay.ok && (
          <>
            <Eyebrow color={C.mint}>Approved</Eyebrow>
            <View style={st.titleRow}>
              <Text style={st.h1}>{overlay.appName} is LIVE</Text>
              <CelebrateIcon size={24} color={C.mint} />
            </View>
            <Text style={st.body}>First subscribers rolling in:</Text>
            <MonoText style={{ color: C.gold, fontSize: 30, fontWeight: '600', textAlign: 'center', marginTop: 4 }}>
              +{fmt(overlay.gain ?? 0)}/mo
            </MonoText>
            <Btn label="Refresh dashboard 47 times" onPress={showPaywall} style={{ marginTop: 16 }} />
          </>
        )}

        {overlay.type === 'verdict' && !overlay.ok && (
          <>
            <Eyebrow color={C.pink}>Rejected</Eyebrow>
            <Text style={st.h1}>{overlay.rule}</Text>
            <Text style={st.body}>{overlay.flavor}</Text>
            <Btn label="Grieve, then rebuild" ghost onPress={dismiss} style={{ marginTop: 16 }} />
          </>
        )}

        {overlay.type === 'paywall' && (
          <>
            <Eyebrow>A wild paywall appears</Eyebrow>
            <Text style={st.h1}>Go Indie</Text>
            <Text style={st.body}>Make your character an indie operator. Go Indie doubles offline earnings in this game.</Text>
            <MonoText style={{ color: C.dim, fontSize: 11, textAlign: 'center', marginVertical: 12 }}>
              [ RevenueCat Paywall · remotely configured ]
            </MonoText>
            <Btn
              label="Go Indie"
              onPress={async () => {
                const active = await presentGoIndiePaywall();
                if (active === true) {
                  setGoIndieActive(true);
                  markPaywallShown();
                  pushNotif('Go Indie active. Your character is now an indie operator.', 'growth');
                  dismiss();
                }
              }}
            />
            <Btn label="Remain humble" ghost onPress={dismiss} style={{ marginTop: 8 }} />
          </>
        )}

        {overlay.type === 'paywallDesigner' && <PaywallDesigner appId={overlay.appId} />}

        {overlay.type === 'paywallResult' && (
          <>
            <Eyebrow color={overlay.dark >= 5 ? C.pink : C.mint}>Paywall shipped</Eyebrow>
            <Text style={st.h1}>conv ×{overlay.mult.toFixed(2)}</Text>
            <Text style={st.body}>
              {overlay.dark >= 5
                ? 'Revenue is up. Somewhere, a subreddit stirs.'
                : overlay.dark > 0
                ? 'A little heat. Probably fine. Probably.'
                : 'Clean paywall. Your conscience sparkles. Your CFO weeps.'}
            </Text>
            <Btn label="Watch the numbers" onPress={dismiss} style={{ marginTop: 16 }} />
          </>
        )}

        {overlay.type === 'win' && (
          <>
            <View style={st.heroIcon}>
              <RamenProfitableIcon size={44} color={C.gold} />
            </View>
            <Eyebrow color={C.gold}>Achievement unlocked</Eyebrow>
            <Text style={st.h1}>RAMEN PROFITABLE</Text>
            <Text style={st.body}>
              You sent the resignation email. Your manager replied "k". Your apps ({fmt(mrr)}/mo) now pay for rent,
              ramen, and exactly one streaming service.
            </Text>
            <Btn label="Keep building anyway" onPress={dismiss} style={{ marginTop: 16 }} />
          </>
        )}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(8,10,18,0.92)',
    zIndex: 80,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    width: '100%',
    backgroundColor: C.card,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: R.sheet,
    padding: 22,
  },
  h1: {
    color: C.ink,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 4,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  heroIcon: { alignItems: 'center' },
  body: { color: C.mut, fontSize: 13, textAlign: 'center', marginTop: 10, lineHeight: 19 },
  spinner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: C.card2,
    borderTopColor: C.gold,
    alignSelf: 'center',
    marginVertical: 14,
  },
});
