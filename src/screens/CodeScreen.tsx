import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useGame } from '../state/gameStore';
import { Card, Eyebrow, Btn, Meter, MonoText, fmtN } from '../components/ui';
import { C } from '../theme';
import { CodeIcon, EnergyIcon, ShipIcon } from '../components/icons';

function FloatingLoc({ amount, onDone }: { amount: number; onDone: () => void }) {
  const y = useRef(new Animated.Value(0)).current;
  const op = useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(y, { toValue: -46, duration: 800, useNativeDriver: true }),
      Animated.timing(op, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start(onDone);
  }, []);
  const x = useRef(Math.random() * 120 - 60).current;
  return (
    <Animated.View style={[st.float, { opacity: op, transform: [{ translateY: y }, { translateX: x }] }]}>
      <MonoText style={{ color: C.mint, fontSize: 13, fontWeight: '600' }}>+{amount} LOC</MonoText>
    </Animated.View>
  );
}

export default function CodeScreen() {
  const s = useGame();
  const [floats, setFloats] = useState<number[]>([]);
  const nextId = useRef(0);

  const onTap = () => {
    const ok = s.tapCode();
    if (ok) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const id = nextId.current++;
      setFloats(f => [...f.slice(-6), id]);
    }
  };

  const p = s.project;

  return (
    <ScrollView contentContainerStyle={st.wrap} showsVerticalScrollIndicator={false}>
      <Card>
        <Eyebrow>Current project</Eyebrow>
        {p ? (
          <>
            <Text style={st.h1}>{p.name}</Text>
            <Text style={st.idea}>{p.idea}</Text>
            <View style={st.row}>
              <MonoText style={{ fontSize: 13 }}>
                {fmtN(p.loc)} / {fmtN(p.need)} LOC
              </MonoText>
              {s.autoCode > 0 && <MonoText style={{ fontSize: 13, color: C.mut }}>auto {s.autoCode}/s</MonoText>}
            </View>
            <Meter pct={(p.loc / p.need) * 100} />

            <View style={{ marginTop: 14 }}>
              {p.loc >= p.need ? (
                <Btn label="Submit to App Review" icon={<ShipIcon size={18} color={C.btnText} />} onPress={s.submitToReview} />
              ) : (
                <View>
                  <Btn label={`Write code  (+${s.tapPower} LOC, −1 energy)`} icon={<CodeIcon size={18} color={C.btnText} />} onPress={onTap} />
                  {floats.map(id => (
                    <FloatingLoc key={id} amount={s.tapPower} onDone={() => setFloats(f => f.filter(x => x !== id))} />
                  ))}
                </View>
              )}
            </View>

            <View style={st.energyLabel}>
              <EnergyIcon size={13} color={C.mint} />
              <MonoText style={{ fontSize: 11, color: C.mut }}>{Math.floor(s.energy)}/{s.energyMax} energy</MonoText>
            </View>
            <Meter pct={(s.energy / s.energyMax) * 100} color={C.mint} />
          </>
        ) : (
          <>
            <Text style={st.idea}>No active project. Ideas are free. Shipping is the hard part.</Text>
            <Btn label="💡 Start a new app" onPress={s.newProject} style={{ marginTop: 12 }} />
          </>
        )}
      </Card>

      <Card>
        <Eyebrow>Dev notes</Eyebrow>
        <Text style={st.notes}>
          Tap to write code. Energy regenerates over time — or buy caffeine in the Store. Your apps earn while you're
          away. That's the whole point.
        </Text>
      </Card>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  wrap: { padding: 14, paddingBottom: 110 },
  h1: { color: C.ink, fontSize: 22, fontWeight: '800' },
  idea: { color: C.mut, fontSize: 13, marginTop: 4, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  notes: { color: C.mut, fontSize: 12, lineHeight: 18 },
  float: { position: 'absolute', top: -8, alignSelf: 'center' },
  energyLabel: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
});
