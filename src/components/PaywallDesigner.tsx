import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useGame } from '../state/gameStore';
import { PAYWALL_AXES } from '../content/content';
import { Btn, Eyebrow, MonoText } from './ui';
import { C } from '../theme';
import { EthicallySourcedIcon, ShipIcon, TrendingIcon } from './icons';

export default function PaywallDesigner({ appId }: { appId: string }) {
  const app = useGame(s => s.apps.find(a => a.id === appId));
  const applyPaywall = useGame(s => s.applyPaywall);
  const dismiss = useGame(s => s.dismissOverlay);
  const [picks, setPicks] = useState<Record<string, string>>({});

  if (!app) return null;

  const complete = PAYWALL_AXES.every(ax => picks[ax.id]);
  const preview = PAYWALL_AXES.reduce(
    (acc, ax) => {
      const c = ax.choices.find(ch => ch.id === picks[ax.id]);
      return c ? { mult: acc.mult * c.mult, dark: acc.dark + c.dark } : acc;
    },
    { mult: 1, dark: 0 }
  );

  return (
    <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false}>
      <Eyebrow>Paywall Designer</Eyebrow>
      <Text style={st.h1}>{app.name}</Text>
      <Text style={st.sub}>Every choice moves conversion. Some choices have… consequences.</Text>

      {PAYWALL_AXES.map(axis => (
        <View key={axis.id} style={{ marginTop: 14 }}>
          <Text style={st.axisTitle}>{axis.title}</Text>
          {axis.choices.map(ch => {
            const active = picks[axis.id] === ch.id;
            return (
              <Pressable
                key={ch.id}
                accessibilityLabel={`${ch.label}, heat ${ch.dark}`}
                accessibilityState={{ selected: active }}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setPicks(p => ({ ...p, [axis.id]: ch.id }));
                }}
                style={[st.choice, active && st.choiceActive]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[st.choiceLabel, active && { color: C.ink }]}>{ch.label}</Text>
                  <Text style={st.choiceFlavor}>{ch.flavor}</Text>
                </View>
                {ch.dark > 0 && (
                  <View style={st.heatIcons}>
                    {Array.from({ length: ch.dark }, (_, i) => <TrendingIcon key={i} size={12} color={C.pink} />)}
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}

      <View style={st.previewRow}>
        <MonoText style={{ fontSize: 12, color: C.mut }}>conv ×{preview.mult.toFixed(2)}   heat {preview.dark}: </MonoText>
        {preview.dark > 0 ? (
          <View style={st.heatIcons}>
            {Array.from({ length: Math.min(preview.dark, 8) }, (_, i) => <TrendingIcon key={i} size={12} color={C.pink} />)}
          </View>
        ) : (
          <View style={st.cleanStatus}>
            <MonoText style={{ fontSize: 12, color: C.mut }}>clean</MonoText>
            <EthicallySourcedIcon size={13} color={C.mint} />
          </View>
        )}
      </View>

      <Btn
        label={complete ? 'Ship this paywall' : 'Pick one from each row'}
        icon={complete ? <ShipIcon size={18} color={C.btnText} /> : undefined}
        disabled={!complete}
        onPress={() => applyPaywall(appId, picks)}
        style={{ marginTop: 12 }}
      />
      <Btn label="Never mind" ghost onPress={dismiss} style={{ marginTop: 8 }} />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  h1: { color: C.ink, fontSize: 22, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  sub: { color: C.mut, fontSize: 12, textAlign: 'center', marginTop: 6 },
  axisTitle: { color: C.dim, fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase', fontWeight: '600', marginBottom: 6 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.card2,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  choiceActive: { borderColor: C.gold, backgroundColor: '#241F14' },
  choiceLabel: { color: C.mut, fontWeight: '700', fontSize: 13 },
  choiceFlavor: { color: C.dim, fontSize: 11, marginTop: 1 },
  previewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  heatIcons: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  cleanStatus: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
