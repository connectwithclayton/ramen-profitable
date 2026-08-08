import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useGame } from '../state/gameStore';
import { PAYWALL_AXES } from '../content/content';
import { Btn, Eyebrow, MonoText } from './ui';
import { C } from '../theme';

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
                {ch.dark > 0 && <Text style={{ fontSize: 12 }}>{'🔥'.repeat(ch.dark)}</Text>}
              </Pressable>
            );
          })}
        </View>
      ))}

      <View style={st.previewRow}>
        <MonoText style={{ fontSize: 12, color: C.mut }}>
          conv ×{preview.mult.toFixed(2)}
          {preview.dark > 0 ? `   heat ${'🔥'.repeat(Math.min(preview.dark, 8))}` : '   heat: clean 😇'}
        </MonoText>
      </View>

      <Btn
        label={complete ? '🧱 Ship this paywall' : 'Pick one from each row'}
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
  previewRow: { alignItems: 'center', marginTop: 14 },
});
