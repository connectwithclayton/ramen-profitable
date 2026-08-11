import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
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

export default function StoreScreen() {
  const s = useGame();
  const [restoring, setRestoring] = useState(false);
  const owned = SHOP.filter(i => s.upgrades[i.id]).length;
  const indie = s.goIndieResolved && s.goIndieActive;

  const restore = async () => {
    if (restoring) return;
    setRestoring(true);
    const active = await restoreGoIndiePurchases();
    if (active !== null) {
      s.setGoIndieActive(active);
    }
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
    <Screen>
      <ScreenTop
        day={s.day}
        right={`${owned} / ${SHOP.length} OWNED`}
        rightLabel={`${owned} of ${SHOP.length} upgrades owned`}
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
                return (
                  <View key={item.id}>
                    {i > 0 && <Divider />}
                    <View
                      style={[st.item, !isOwned && !affordable && { opacity: 0.5 }]}
                      accessible={isOwned || !affordable}
                      accessibilityLabel={
                        isOwned
                          ? `${item.name}. ${item.desc}. Owned.`
                          : `${item.name}. ${item.desc}. ${fmt(item.cost)}. ${fmt(short)} short.`
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
                          <MonoText style={st.lockedShort}>{fmt(short)} SHORT</MonoText>
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
        <SectionHeader title="Go Indie" meta={indie ? 'ACTIVE' : undefined} metaColor={C.mint} />
        <Unit tone={indie ? C.mint : C.gold} style={st.indie}>
          <Text style={st.indieCopy}>
            {indie
              ? 'Indie operator status is active. Offline earnings are doubled — capped at 8 hours, same as always.'
              : 'Make your character an indie operator. Go Indie doubles what your apps earn while the app is closed.'}
          </Text>
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

      <Section>
        <SectionHeader title="Coming next" meta="v0.1" />
        <Text style={st.roadmap}>
          In v1.0: paywall designer minigame · A/B tests · real ads on in-game billboards · hiring · acquisition offers
          you'll regret refusing
        </Text>
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
  roadmap: { color: C.dim, fontSize: 12, lineHeight: 19, marginTop: 10 },
});
