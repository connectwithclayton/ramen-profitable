import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useGame } from '../state/gameStore';
import { SHOP } from '../content/content';
import { Card, Eyebrow, Btn, MonoText, fmt } from '../components/ui';
import { C } from '../theme';

export default function StoreScreen() {
  const s = useGame();
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
