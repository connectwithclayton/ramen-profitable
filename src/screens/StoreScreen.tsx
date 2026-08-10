import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useGame } from '../state/gameStore';
import { SHOP } from '../content/content';
import { Card, Eyebrow, Btn, MonoText, fmt } from '../components/ui';
import { C } from '../theme';
import { restoreGoIndiePurchases } from '../monetization/purchases';

export default function StoreScreen() {
  const s = useGame();
  const [restoring, setRestoring] = useState(false);

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
    <ScrollView contentContainerStyle={st.wrap} showsVerticalScrollIndicator={false}>
      <Card>
        <Eyebrow>Upgrades</Eyebrow>
        {SHOP.map(item => {
          const owned = s.upgrades[item.id];
          return (
            <View key={item.id} style={st.item}>
              <View style={{ flex: 1 }}>
                <Text style={st.t}>{item.name}</Text>
                <Text style={st.d}>{item.desc}</Text>
              </View>
              {owned ? (
                <MonoText style={{ color: C.mint, fontSize: 12, fontWeight: '600' }}>OWNED</MonoText>
              ) : (
                <Btn
                  small
                  ghost={s.cash < item.cost}
                  disabled={s.cash < item.cost}
                  label={fmt(item.cost)}
                  onPress={() => s.buy(item.id)}
                />
              )}
            </View>
          );
        })}
      </Card>

      <Card>
        <Eyebrow>Go Indie</Eyebrow>
        <Text style={st.d}>
          {s.goIndieActive
            ? 'Indie operator status is active. Offline earnings are doubled.'
            : 'Already bought Go Indie? Restore the lifetime unlock on this device.'}
        </Text>
        <Btn
          small
          ghost
          label={restoring ? 'Restoring…' : 'Restore Purchases'}
          disabled={restoring}
          onPress={restore}
          style={{ marginTop: 10 }}
        />
      </Card>

      <Card>
        <Eyebrow>Coming in v1.0</Eyebrow>
        <Text style={st.d}>
          Paywall designer minigame · A/B tests · real ads on in-game billboards · hiring · acquisition offers you'll
          regret refusing
        </Text>
      </Card>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  wrap: { padding: 14, paddingBottom: 110 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  t: { color: C.ink, fontWeight: '600', fontSize: 14 },
  d: { color: C.mut, fontSize: 12, marginTop: 2, lineHeight: 17 },
});
