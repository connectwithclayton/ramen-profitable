import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  Platform,
  View,
  Text,
  StyleSheet,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { useGame } from '../state/gameStore';
import { RAMEN_MILESTONES, RAMEN_ORDERS, SHOP } from '../content/content';
import {
  Btn,
  Divider,
  Eyebrow,
  Hero,
  HeroNumber,
  MonoText,
  Screen,
  ScreenTop,
  Section,
  SectionHeader,
  Unit,
  exactMoney,
  fmt,
  money,
} from '../components/ui';
import { C } from '../theme';
import PhoneBillboard, { type BillboardViewportFrame } from '../components/PhoneBillboard';
import {
  getPurchaseServiceStatus,
  initPurchases,
  restoreGoIndiePurchases,
  subscribePurchaseServiceStatus,
} from '../monetization/purchases';
import { RamenProfitableIcon } from '../components/icons';
import { ramenFundingEligible } from '../state/experience';

/**
 * Presentation only: seven upgrades in one flat list is a list, not a shop.
 * Grouping is derived from the existing SHOP ids — no new content, no new state.
 */
const AISLES: { title: string; ids: string[] }[] = [
  { title: 'Output', ids: ['kb', 'claude', 'agent'] },
  { title: 'Stamina', ids: ['coffee', 'desk'] },
  { title: 'Odds & reach', ids: ['cat', 'aso'] },
];

/** Anything a future SHOP entry adds lands here rather than silently disappearing. */
const AISLED = new Set(AISLES.flatMap(a => a.ids));
const HIDDEN_UPGRADES: Record<string, boolean> = {};

function scrollContinuesAfterDrag(event: NativeSyntheticEvent<NativeScrollEvent>): boolean {
  const { contentOffset, targetContentOffset, velocity } = event.nativeEvent;
  if (
    targetContentOffset &&
    Number.isFinite(targetContentOffset.y) &&
    Number.isFinite(contentOffset.y)
  ) {
    return targetContentOffset.y !== contentOffset.y;
  }
  if (velocity && Number.isFinite(velocity.y)) return velocity.y !== 0;
  return true;
}

export default function StoreScreen({
  active = true,
  viewportBottom,
}: {
  active?: boolean;
  viewportBottom?: number;
}) {
  const s = useGame(useShallow(state => ({
    day: active ? state.day : 0,
    cash: active ? state.cash : 0,
    mrr: active ? state.mrr : 0,
    upgrades: active ? state.upgrades : HIDDEN_UPGRADES,
    hasJob: active ? state.hasJob : true,
    mealsFunded: active ? state.mealsFunded : 0,
    indieActive: active && state.goIndieActive,
    indieResolved: active && state.goIndieResolved,
    buy: state.buy,
    openRamenPurchase: state.openRamenPurchase,
    pushNotif: state.pushNotif,
    openGoIndiePaywall: state.openGoIndiePaywall,
  })));
  const purchaseService = useSyncExternalStore(
    subscribePurchaseServiceStatus,
    getPurchaseServiceStatus,
    getPurchaseServiceStatus,
  );
  const [restoring, setRestoring] = useState(false);
  const [billboardInViewport, setBillboardInViewport] = useState(false);
  const [viewportMeasurementCurrent, setViewportMeasurementCurrent] = useState(true);
  const billboardInViewportRef = useRef(false);
  const billboardFrameRef = useRef<BillboardViewportFrame | null>(null);
  const viewportRef = useRef({ offsetY: 0, height: 0, insetTop: 0, insetBottom: 0 });
  const owned = SHOP.filter(i => s.upgrades[i.id]).length;
  const upgradesLeft = SHOP.length - owned;
  const ramenEligible = ramenFundingEligible(s.upgrades, s.hasJob, SHOP);
  const nextRamenMilestone = RAMEN_MILESTONES.find(milestone => milestone.threshold > s.mealsFunded);
  const indie = s.indieResolved && s.indieActive;
  const catvertising = Platform.OS === 'ios';
  const purchaseSurface = indie
    ? 'confirmed-owned'
    : purchaseService === 'unavailable'
      ? 'unavailable'
      : purchaseService === 'checking' || !s.indieResolved
        ? 'checking'
        : 'free';
  const indieCopy = purchaseSurface === 'confirmed-owned'
    ? catvertising
      ? 'Go Indie is confirmed active. iOS ads are removed and offline app income is doubled, up to 8 hours. Your character\'s job is unchanged.'
      : 'Go Indie is confirmed active. Offline app income is doubled, up to 8 hours. Your character\'s job is unchanged.'
    : purchaseSurface === 'checking'
      ? 'Checking your App Store purchase status before showing this optional offer.'
      : purchaseSurface === 'unavailable'
        ? 'The App Store is unavailable right now. No purchase or ownership status was assumed.'
        : catvertising
          ? 'Optional one-time purchase with real money: removes iOS ads and doubles offline app income, up to 8 hours. It does not quit your character\'s day job.'
          : 'Optional one-time purchase with real money: doubles offline app income, up to 8 hours. It does not quit your character\'s day job.';
  const purchaseMeta = purchaseSurface === 'confirmed-owned'
    ? 'CONFIRMED OWNED'
    : purchaseSurface === 'free'
      ? 'FREE PLAYER'
      : purchaseSurface.toUpperCase();

  useEffect(() => {
    void initPurchases();
  }, []);

  const updateBillboardVisibility = useCallback(() => {
    const frame = billboardFrameRef.current;
    const viewport = viewportRef.current;
    const top = viewport.offsetY + viewport.insetTop;
    const bottom = viewport.offsetY + Math.min(
      viewport.height - viewport.insetBottom,
      viewportBottom ?? 0,
    );
    const visible = Boolean(
      viewportBottom !== undefined &&
      frame &&
      frame.height > 0 &&
      viewport.height > 0 &&
      frame.y >= top &&
      frame.y + frame.height <= bottom
    );
    if (billboardInViewportRef.current === visible) return;
    billboardInViewportRef.current = visible;
    setBillboardInViewport(visible);
  }, [viewportBottom]);

  useEffect(() => {
    updateBillboardVisibility();
  }, [updateBillboardVisibility]);

  const onScreenLayout = useCallback((event: LayoutChangeEvent) => {
    viewportRef.current.height = event.nativeEvent.layout.height;
    updateBillboardVisibility();
  }, [updateBillboardVisibility]);

  const onScreenScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentInset, contentOffset, layoutMeasurement } = event.nativeEvent;
    viewportRef.current = {
      offsetY: contentOffset.y,
      height: layoutMeasurement.height,
      insetTop: contentInset?.top ?? 0,
      insetBottom: contentInset?.bottom ?? 0,
    };
    updateBillboardVisibility();
  }, [updateBillboardVisibility]);

  // Accepted limitation: UIKit can move an already-loaded banner beneath the dock fade before
  // coalesced React Native events reach JavaScript. Keeping that banner mounted avoids scroll
  // flicker, but JavaScript cannot close the native movement gap; a durable fix requires
  // native-side occlusion enforcement.
  const onScreenScrollBegin = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setViewportMeasurementCurrent(false);
    onScreenScroll(event);
  }, [onScreenScroll]);

  const onScreenScrollEndDrag = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    onScreenScroll(event);
    if (!scrollContinuesAfterDrag(event)) setViewportMeasurementCurrent(true);
  }, [onScreenScroll]);

  const onScreenMomentumScrollEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    onScreenScroll(event);
    setViewportMeasurementCurrent(true);
  }, [onScreenScroll]);

  const onBillboardFrameChange = useCallback((frame: BillboardViewportFrame) => {
    billboardFrameRef.current = frame;
    updateBillboardVisibility();
  }, [updateBillboardVisibility]);

  const restore = async () => {
    if (restoring) return;
    setRestoring(true);
    try {
      const restoredOwnership = await restoreGoIndiePurchases();
      if (restoredOwnership === true) {
        s.pushNotif('Existing Go Indie purchase restored and confirmed.', 'growth');
      } else if (restoredOwnership === false) {
        s.pushNotif('No Go Indie purchase was found for this store account.', 'store');
      } else {
        s.pushNotif('The App Store could not check existing purchases. Try again later.', 'store');
      }
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Screen
      onLayout={catvertising ? onScreenLayout : undefined}
      onScroll={catvertising ? onScreenScroll : undefined}
      onScrollBeginDrag={catvertising ? onScreenScrollBegin : undefined}
      onScrollEndDrag={catvertising ? onScreenScrollEndDrag : undefined}
      onMomentumScrollBegin={catvertising ? onScreenScrollBegin : undefined}
      onMomentumScrollEnd={catvertising ? onScreenMomentumScrollEnd : undefined}
    >
      <ScreenTop
        day={s.day}
        right={owned > 0 ? `${owned} / ${SHOP.length} OWNED` : undefined}
        rightLabel={owned > 0 ? `${owned} of ${SHOP.length} upgrades owned` : undefined}
      />

      <Hero>
        <Eyebrow>Cash on hand</Eyebrow>
        <HeroNumber value={money(s.cash)} />
        <MonoText style={st.heroSub} accessibilityLabel={`Earning ${fmt(s.mrr)} per month`}>
          {s.mrr > 0 ? `EARNING ${fmt(s.mrr)}/MO` : 'NOTHING COMING IN YET'}
        </MonoText>
      </Hero>

      {[...AISLES, { title: 'More', ids: SHOP.filter(i => !AISLED.has(i.id)).map(i => i.id) }].map(aisle => {
        const items = aisle.ids.map(id => SHOP.find(i => i.id === id)).filter(Boolean) as typeof SHOP;
        if (!items.length) return null;
        return (
          <Section key={aisle.title}>
            <SectionHeader title={aisle.title} />
            <View style={st.list}>
              {items.map((item, i) => {
                const isOwned = Boolean(s.upgrades[item.id]);
                const short = Math.max(0, item.cost - s.cash);
                const affordable = short === 0;
                const shortDisplay = Math.ceil(short);
                return (
                  <View key={item.id}>
                    {i > 0 && <Divider />}
                    <View
                      style={[st.item, !isOwned && !affordable && { opacity: 0.5 }]}
                      accessible={isOwned || !affordable}
                      accessibilityLabel={
                        isOwned
                          ? `${item.name}. ${item.desc}. Owned.`
                          : `${item.name}. ${item.desc}. ${fmt(item.cost)}. ${fmt(shortDisplay)} short.`
                      }
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={st.name}>{item.name}</Text>
                        <Text style={st.desc}>{item.desc}</Text>
                      </View>
                      {isOwned ? (
                        <MonoText style={st.owned}>OWNED</MonoText>
                      ) : affordable ? (
                        <Btn
                          small
                          label={fmt(item.cost)}
                          accessibilityLabel={`Buy ${item.name} for ${fmt(item.cost)}. ${item.desc}.`}
                          onPress={() => s.buy(item.id)}
                          style={st.buy}
                        />
                      ) : (
                        <View style={st.lockedPrice}>
                          <MonoText style={st.lockedCost}>{fmt(item.cost)}</MonoText>
                          <MonoText style={st.lockedShort}>{fmt(shortDisplay)} SHORT</MonoText>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </Section>
        );
      })}

      <Section>
        <SectionHeader
          title="Ramen run"
          meta={ramenEligible
            ? s.mealsFunded > 0
              ? `${s.mealsFunded.toLocaleString()} RECORDED`
              : 'UNLOCKED'
            : 'LOCKED'}
          metaColor={ramenEligible ? C.gold : undefined}
        />
        {ramenEligible ? (
          <Unit tone={C.gold} style={st.ramenUnit}>
            <View style={st.ramenIntro}>
              <RamenProfitableIcon size={25} color={C.gold} />
              <View style={st.ramenIntroCopy}>
                <Text style={st.ramenTitle}>Spend success on fictional dinner</Text>
                <Text style={st.ramenCopy}>
                  Fictional game cash only. No real meals or donations. Every $20 records one in-game meal and adds zero MRR.
                </Text>
                <MonoText style={st.ramenMilestone}>
                  {nextRamenMilestone
                    ? `NEXT MILESTONE · ${nextRamenMilestone.threshold.toLocaleString()} MEALS · ${(nextRamenMilestone.threshold - s.mealsFunded).toLocaleString()} TO GO`
                    : 'ALL RAMEN MILESTONES COMPLETE'}
                </MonoText>
              </View>
            </View>
            <View style={st.ramenMenu}>
              {RAMEN_ORDERS.map((order, index) => {
                const affordable = s.cash >= order.cost;
                const short = Math.max(0, order.cost - s.cash);
                const mealLabel = order.quantity === 1 ? 'meal' : 'meals';
                return (
                  <View key={order.quantity}>
                    {index > 0 && <Divider />}
                    <View style={[st.ramenRow, !affordable && st.ramenUnaffordable]}>
                      <View style={st.ramenOrderCopy}>
                        <Text style={st.name}>{order.quantity.toLocaleString()} {mealLabel}</Text>
                        <Text style={st.desc}>{order.label}</Text>
                      </View>
                      {affordable ? (
                        <Btn
                          small
                          label={exactMoney(order.cost)}
                          accessibilityLabel={`Review ${order.quantity.toLocaleString()} fictional ramen ${mealLabel} for ${exactMoney(order.cost)} game cash.`}
                          onPress={() => s.openRamenPurchase(order.quantity)}
                          style={st.ramenBuy}
                        />
                      ) : (
                        <View style={st.lockedPrice}>
                          <MonoText style={st.lockedCost}>{exactMoney(order.cost)}</MonoText>
                          <MonoText style={st.lockedShort}>{exactMoney(Math.ceil(short))} SHORT</MonoText>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </Unit>
        ) : (
          <Unit style={st.ramenLocked}>
            <Text style={st.ramenCopy}>Buy all 7 upgrades or quit your day job to unlock fictional ramen.</Text>
            <MonoText style={st.ramenLockedProgress}>
              {upgradesLeft} {upgradesLeft === 1 ? 'UPGRADE' : 'UPGRADES'} LEFT · OR QUIT YOUR DAY JOB
            </MonoText>
          </Unit>
        )}
      </Section>

      {catvertising && (
        <PhoneBillboard
          active={active}
          indie={indie}
          onViewportFrameChange={onBillboardFrameChange}
          viewportMeasurementCurrent={viewportMeasurementCurrent}
          viewportVisible={billboardInViewport}
        />
      )}

      <Section>
        <SectionHeader
          title="Go Indie"
          meta={purchaseMeta}
          metaColor={purchaseSurface === 'confirmed-owned' ? C.mint : undefined}
        />
        <Unit tone={purchaseSurface === 'confirmed-owned' ? C.mint : C.gold} style={st.indie}>
          <Text style={st.indieCopy}>{indieCopy}</Text>
          {purchaseSurface === 'free' && (
            <Text style={st.storePriceCopy}>The App Store shows the current local price before purchase.</Text>
          )}
          {purchaseSurface !== 'confirmed-owned' && (
            <Btn
              label={purchaseSurface === 'checking'
                ? 'Checking purchase status'
                : purchaseSurface === 'unavailable'
                  ? 'Try Go Indie'
                  : 'View App Store price'}
              disabled={purchaseSurface === 'checking'}
              onPress={s.openGoIndiePaywall}
              style={{ marginTop: 14 }}
            />
          )}
          <Text style={st.restoreCopy}>
            Restore only rechecks an existing Go Indie purchase for this store account. It does not restore local game progress.
          </Text>
          <Btn
            small
            ghost
            label={restoring ? 'Restoring…' : 'Restore Purchases'}
            disabled={restoring || purchaseSurface === 'checking'}
            onPress={restore}
            style={{ marginTop: 8 }}
          />
        </Unit>
      </Section>

    </Screen>
  );
}

const st = StyleSheet.create({
  heroSub: { color: C.mut, fontSize: 11, letterSpacing: 1.2, marginTop: 8 },
  list: { marginTop: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  name: { color: C.ink, fontWeight: '600', fontSize: 15 },
  desc: { color: C.mut, fontSize: 12, marginTop: 3, lineHeight: 17 },
  buy: { minWidth: 76 },
  owned: { color: C.mint, fontSize: 11, letterSpacing: 1.2, fontWeight: '600' },
  lockedPrice: { alignItems: 'flex-end' },
  lockedCost: { color: C.ink, fontSize: 14, fontWeight: '600' },
  lockedShort: { color: C.pink, fontSize: 10, letterSpacing: 0.8, marginTop: 3 },
  ramenUnit: { marginTop: 12, paddingBottom: 0 },
  ramenIntro: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  ramenIntroCopy: { flex: 1 },
  ramenTitle: { color: C.ink, fontSize: 16, fontWeight: '700' },
  ramenCopy: { color: C.mut, fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  ramenMenu: { marginTop: 12 },
  ramenMilestone: { color: C.gold, fontSize: 10, letterSpacing: 0.6, lineHeight: 15, marginTop: 9 },
  ramenLocked: { marginTop: 12 },
  ramenLockedProgress: { color: C.dim, fontSize: 10, letterSpacing: 0.6, lineHeight: 15, marginTop: 9 },
  ramenRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  ramenOrderCopy: { flex: 1 },
  ramenUnaffordable: { opacity: 0.5 },
  ramenBuy: { minWidth: 84 },
  indie: { marginTop: 12 },
  indieCopy: { color: C.mut, fontSize: 13, lineHeight: 19 },
  storePriceCopy: { color: C.dim, fontSize: 11, lineHeight: 16, marginTop: 8 },
  restoreCopy: { color: C.dim, fontSize: 11, lineHeight: 16, marginTop: 14 },
});
