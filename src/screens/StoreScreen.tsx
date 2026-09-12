import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { SHOP } from '../content/content';
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
  fmt,
  money,
} from '../components/ui';
import { C } from '../theme';
import PhoneBillboard, { type BillboardViewportFrame } from '../components/PhoneBillboard';
import { restoreGoIndiePurchases } from '../monetization/purchases';

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
    indie: active && state.goIndieResolved && state.goIndieActive,
    buy: state.buy,
    pushNotif: state.pushNotif,
    openGoIndiePaywall: state.openGoIndiePaywall,
  })));
  const [restoring, setRestoring] = useState(false);
  const [billboardInViewport, setBillboardInViewport] = useState(false);
  const billboardInViewportRef = useRef(false);
  const billboardFrameRef = useRef<BillboardViewportFrame | null>(null);
  const viewportRef = useRef({ offsetY: 0, height: 0, insetTop: 0, insetBottom: 0 });
  const owned = SHOP.filter(i => s.upgrades[i.id]).length;
  const indie = s.indie;
  const catvertising = Platform.OS === 'ios';
  const indieCopy = indie
    ? catvertising
      ? 'Indie operator status is active. Ads are removed. Offline earnings are doubled — capped at 8 hours, same as always.'
      : 'Indie operator status is active. Offline earnings are doubled — capped at 8 hours, same as always.'
    : catvertising
      ? 'Make your character an indie operator. Go Indie removes ads and doubles what your apps earn while the app is closed.'
      : 'Make your character an indie operator. Go Indie doubles what your apps earn while the app is closed.';

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

  const onBillboardFrameChange = useCallback((frame: BillboardViewportFrame) => {
    billboardFrameRef.current = frame;
    updateBillboardVisibility();
  }, [updateBillboardVisibility]);

  const restore = async () => {
    if (restoring) return;
    setRestoring(true);
    const active = await restoreGoIndiePurchases();
    if (active === true) {
      s.pushNotif('Purchases restored. Go Indie is active.', 'growth');
    } else if (active === false) {
      s.pushNotif('No Go Indie purchase found to restore.', 'store');
    } else {
      s.pushNotif('Purchases are unavailable. Try restoring again later.', 'store');
    }
    setRestoring(false);
  };

  return (
    <Screen
      onLayout={catvertising ? onScreenLayout : undefined}
      onScroll={catvertising ? onScreenScroll : undefined}
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

      {catvertising && (
        <PhoneBillboard
          active={active}
          indie={indie}
          onViewportFrameChange={onBillboardFrameChange}
          viewportVisible={billboardInViewport}
        />
      )}

      <Section>
        <SectionHeader title="Go Indie" meta={indie ? 'ACTIVE' : undefined} metaColor={C.mint} />
        <Unit tone={indie ? C.mint : C.gold} style={st.indie}>
          <Text style={st.indieCopy}>{indieCopy}</Text>
          <Btn label="Go Indie" ghost={indie} onPress={s.openGoIndiePaywall} style={{ marginTop: 14 }} />
          <Btn
            small
            ghost
            label={restoring ? 'Restoring…' : 'Restore Purchases'}
            disabled={restoring}
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
  indie: { marginTop: 12 },
  indieCopy: { color: C.mut, fontSize: 13, lineHeight: 19 },
});
