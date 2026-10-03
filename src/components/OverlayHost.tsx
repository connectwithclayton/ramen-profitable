import React, { useEffect, useRef, useState } from 'react';
import { Platform, View, Text, ScrollView, StyleSheet, Animated, Easing, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useGame } from '../state/gameStore';
import { REVIEW_MSGS } from '../content/content';
import { Btn, Eyebrow, MonoText, exactMoney, fmt, fmtN } from './ui';
import { C, R } from '../theme';
import { presentGoIndiePaywall } from '../monetization/purchases';
import PaywallDesigner from './PaywallDesigner';
import { CelebrateIcon, RamenProfitableIcon } from './icons';
import { handleApprovedVerdictAction } from './approvedVerdictActions';
import { paywallResultPresentation } from '../state/experience';
import CodePanel from './CodePanel';
import { paywallCodeView } from '../content/codePanel';

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

export default function OverlayHost({ onReturnHome }: { onReturnHome: () => void }) {
  const overlay = useGame(s => s.overlay);
  const dismiss = useGame(s => s.dismissOverlay);
  const openGoIndiePaywall = useGame(s => s.openGoIndiePaywall);
  const openPaywallDesigner = useGame(s => s.openPaywallDesigner);
  const pushNotif = useGame(s => s.pushNotif);
  const fundRamen = useGame(s => s.fundRamen);
  const cash = useGame(s => s.cash);
  const mealsFunded = useGame(s => s.mealsFunded);
  const mrr = useGame(s => s.mrr);
  const { fontScale } = useWindowDimensions();
  const stackRamenQuote = fontScale > 1.3;
  const paywallApp = useGame(s =>
    overlay?.type === 'paywallResult' ? s.apps.find(app => app.id === overlay.appId) : undefined,
  );
  const [goIndiePending, setGoIndiePending] = useState(false);
  const paywallResult = overlay?.type === 'paywallResult'
    ? paywallResultPresentation(overlay.transaction)
    : null;
  const paywallCode = overlay?.type === 'paywallResult'
    ? paywallCodeView(overlay.transaction)
    : null;

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
    <View style={st.backdrop} accessibilityViewIsModal>
      <View
        style={[
          st.sheet,
          (overlay.type === 'paywallResult' || overlay.type === 'ramenPurchase' || (overlay.type === 'verdict' && overlay.ok)) && st.scrollSheet,
        ]}
      >
        {overlay.type === 'review' && <ReviewSheet appName={overlay.appName} />}

        {overlay.type === 'verdict' && overlay.ok && (
          <ScrollView style={st.sheetScroll} contentContainerStyle={st.sheetContent}>
            <Eyebrow color={C.mint}>Approved</Eyebrow>
            <View style={st.titleRow}>
              <Text style={[st.h1, st.approvedTitle]}>{overlay.appName} is LIVE</Text>
              <CelebrateIcon size={24} color={C.mint} />
            </View>
            <Text style={st.body}>First subscribers rolling in:</Text>
            <MonoText style={{ color: C.gold, fontSize: 30, fontWeight: '600', textAlign: 'center', marginTop: 4 }}>
              +{fmt(overlay.gain ?? 0)}/mo
            </MonoText>
            <Text style={st.body}>
              Next: set up your app's paywall to shape subscriber conversion. Free, in-game design - no purchase needed.
            </Text>
            <Btn
              label="Set up paywall"
              accessibilityLabel={`Set up paywall for ${overlay.appName}. Free in-game design.`}
              onPress={() =>
                handleApprovedVerdictAction('set-up-paywall', {
                  dismissOverlay: dismiss,
                  returnHome: onReturnHome,
                  openGoIndiePaywall,
                  setUpPaywall: () => openPaywallDesigner(overlay.appId),
                })
              }
              style={{ marginTop: 16 }}
            />
            <Btn
              label="Continue to Home"
              ghost
              onPress={() =>
                handleApprovedVerdictAction('continue', {
                  dismissOverlay: dismiss,
                  returnHome: onReturnHome,
                  openGoIndiePaywall,
                  setUpPaywall: () => openPaywallDesigner(overlay.appId),
                })
              }
              style={{ marginTop: 8 }}
            />
            <Btn
              label="Go Indie"
              ghost
              onPress={() =>
                handleApprovedVerdictAction('go-indie', {
                  dismissOverlay: dismiss,
                  returnHome: onReturnHome,
                  openGoIndiePaywall,
                  setUpPaywall: () => openPaywallDesigner(overlay.appId),
                })
              }
              style={{ marginTop: 8 }}
            />
          </ScrollView>
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
            <Text style={st.body}>
              {Platform.OS === 'ios'
                ? 'Make your character an indie operator. Go Indie removes ads and doubles offline earnings in this game.'
                : 'Make your character an indie operator. Go Indie doubles offline earnings in this game.'}
            </Text>
            <MonoText style={{ color: C.dim, fontSize: 11, textAlign: 'center', marginVertical: 12 }}>
              [ RevenueCat Paywall · remotely configured ]
            </MonoText>
            <Btn
              label="Go Indie"
              disabled={goIndiePending}
              onPress={async () => {
                setGoIndiePending(true);
                try {
                  const active = await presentGoIndiePaywall();
                  if (active === true) {
                    pushNotif('Go Indie active. Your character is now an indie operator.', 'growth');
                    dismiss();
                  }
                } finally {
                  setGoIndiePending(false);
                }
              }}
            />
            <Btn label="Remain humble" ghost onPress={dismiss} style={{ marginTop: 8 }} />
          </>
        )}

        {overlay.type === 'paywallDesigner' && <PaywallDesigner appId={overlay.appId} />}

        {overlay.type === 'ramenPurchase' && (
          <ScrollView
            style={st.sheetScroll}
            contentContainerStyle={st.sheetContent}
            showsVerticalScrollIndicator
          >
            <View style={st.heroIcon}>
              <RamenProfitableIcon size={40} color={C.gold} />
            </View>
            <Eyebrow color={C.gold}>Review ramen receipt</Eyebrow>
            <Text style={st.h1}>
              Fund {fmtN(overlay.quantity)} {overlay.quantity === 1 ? 'meal' : 'meals'}?
            </Text>
            <Text style={st.body}>
              This is optional recognition spending. It adds no income, energy, or other gameplay boost.
            </Text>
            <View style={st.ramenQuote}>
              <View
                accessible
                accessibilityLabel={`Total: ${exactMoney(overlay.cost)}.`}
                style={[st.quoteRow, stackRamenQuote && st.quoteRowStack]}
              >
                <MonoText style={st.quoteLabel}>TOTAL</MonoText>
                <MonoText style={st.quoteValue}>{exactMoney(overlay.cost)}</MonoText>
              </View>
              <View
                accessible
                accessibilityLabel={cash >= overlay.cost
                  ? `Cash after: ${exactMoney(cash - overlay.cost)}.`
                  : `Cash short: ${exactMoney(overlay.cost - cash)}.`}
                style={[st.quoteRow, stackRamenQuote && st.quoteRowStack]}
              >
                <MonoText style={st.quoteLabel}>CASH AFTER</MonoText>
                <MonoText style={[st.quoteValue, cash < overlay.cost && { color: C.pink }]}>
                  {cash >= overlay.cost ? exactMoney(cash - overlay.cost) : `${exactMoney(overlay.cost - cash)} SHORT`}
                </MonoText>
              </View>
              <View
                accessible
                accessibilityLabel={`Lifetime after: ${fmtN(mealsFunded + overlay.quantity)} meals.`}
                style={[st.quoteRow, stackRamenQuote && st.quoteRowStack]}
              >
                <MonoText style={st.quoteLabel}>LIFETIME AFTER</MonoText>
                <MonoText style={st.quoteValue}>{fmtN(mealsFunded + overlay.quantity)} MEALS</MonoText>
              </View>
            </View>
            <Btn
              label={cash >= overlay.cost ? 'Fund these meals' : 'Not enough cash'}
              accessibilityLabel={cash >= overlay.cost
                ? `Confirm funding ${fmtN(overlay.quantity)} ramen ${overlay.quantity === 1 ? 'meal' : 'meals'} for ${exactMoney(overlay.cost)}. ${exactMoney(cash - overlay.cost)} cash will remain.`
                : `Cannot fund this order. ${exactMoney(overlay.cost - cash)} more cash needed.`}
              disabled={cash < overlay.cost}
              onPress={() => {
                if (!fundRamen()) pushNotif('That ramen receipt is no longer available.', 'store');
              }}
              style={{ marginTop: 16 }}
            />
            <Btn label="Not tonight" ghost onPress={dismiss} style={{ marginTop: 8 }} />
          </ScrollView>
        )}

        {overlay.type === 'paywallResult' && paywallResult && (
          <ScrollView
            style={st.sheetScroll}
            contentContainerStyle={st.sheetContent}
            showsVerticalScrollIndicator
          >
            <Eyebrow
              color={overlay.transaction.dark >= 5 || paywallResult.direction === 'down' ? C.pink : C.mint}
            >
              Paywall shipped
            </Eyebrow>
            <Text style={st.h1}>conv ×{overlay.transaction.mult.toFixed(2)}</Text>
            <MonoText style={[st.resultReceipt, { color: paywallResult.direction === 'down' ? C.pink : C.mint }]}>
              {paywallResult.receipt}
            </MonoText>
            {paywallCode ? (
              <View style={st.paywallCode}>
                <CodePanel
                  title={`${paywallApp?.name ?? 'App'}Paywall`}
                  source={paywallCode.source}
                  mode={`paywall-${paywallCode.quality}`}
                  accessibilityLabel={`${paywallApp?.name ?? 'App'} paywall code quality is ${paywallCode.quality}. ${paywallCode.source}`}
                />
              </View>
            ) : null}
            <Text style={st.body}>{paywallResult.body}</Text>
            <Btn label="Watch the numbers" onPress={dismiss} style={{ marginTop: 16 }} />
          </ScrollView>
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
  scrollSheet: {
    maxHeight: '100%',
    flexShrink: 1,
    padding: 0,
  },
  sheetScroll: {
    width: '100%',
    flexShrink: 1,
  },
  sheetContent: { padding: 22 },
  h1: {
    color: C.ink,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 4,
  },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 7 },
  approvedTitle: { maxWidth: '100%' },
  heroIcon: { alignItems: 'center' },
  body: { color: C.mut, fontSize: 13, textAlign: 'center', marginTop: 10, lineHeight: 19 },
  resultReceipt: { fontSize: 11, textAlign: 'center', marginTop: 10 },
  paywallCode: { marginTop: 16 },
  ramenQuote: { backgroundColor: C.card2, borderRadius: R.tile, marginTop: 16, padding: 12, gap: 9 },
  quoteRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  quoteRowStack: { flexDirection: 'column', alignItems: 'stretch', gap: 2 },
  quoteLabel: { color: C.dim, fontSize: 10, letterSpacing: 0.8, flexShrink: 1 },
  quoteValue: { color: C.ink, fontSize: 12, fontWeight: '600', textAlign: 'right', flexShrink: 1, maxWidth: '100%' },
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
