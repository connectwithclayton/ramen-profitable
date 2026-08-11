import React, { useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useGame } from '../state/gameStore';
import {
  Btn,
  Eyebrow,
  Hero,
  MonoText,
  Screen,
  ScreenTop,
  Section,
  fmtN,
} from '../components/ui';
import { C } from '../theme';
import { EnergyIcon, IdeaIcon, LaunchIcon } from '../components/icons';

const RING = 248;
const R_BUILD = 110;
const R_ENERGY = 94;
const C_BUILD = 2 * Math.PI * R_BUILD;
const C_ENERGY = 2 * Math.PI * R_ENERGY;

/** +N LOC drifting off the ring edge. Randomised so a fast tapper gets a scatter, not a column. */
function FloatingLoc({ amount, onDone }: { amount: number; onDone: () => void }) {
  const t = useRef(new Animated.Value(0)).current;
  const angle = useRef(Math.random() * Math.PI * 2).current;
  React.useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: 850, useNativeDriver: true }).start(onDone);
  }, []);
  const x = Math.cos(angle) * (R_BUILD - 18);
  const y = Math.sin(angle) * (R_BUILD - 18);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        st.float,
        {
          opacity: t.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 1, 0] }),
          transform: [
            { translateX: x },
            { translateY: Animated.add(new Animated.Value(y), t.interpolate({ inputRange: [0, 1], outputRange: [0, -34] })) },
            { scale: t.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0.7, 1, 1] }) },
          ],
        },
      ]}
    >
      <MonoText style={st.floatText}>+{amount} LOC</MonoText>
    </Animated.View>
  );
}

function Ring({
  build,
  energy,
  done,
  dim,
}: {
  build: number;
  energy: number;
  done: boolean;
  dim: boolean;
}) {
  const buildTone = done ? C.mint : C.gold;
  return (
    <Svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`} pointerEvents="none">
      <Circle cx={RING / 2} cy={RING / 2} r={R_BUILD} stroke={C.card2} strokeWidth={12} fill="none" />
      <Circle
        cx={RING / 2}
        cy={RING / 2}
        r={R_BUILD}
        stroke={buildTone}
        strokeOpacity={dim ? 0.35 : 1}
        strokeWidth={12}
        strokeLinecap="round"
        strokeDasharray={`${C_BUILD} ${C_BUILD}`}
        strokeDashoffset={C_BUILD * (1 - build)}
        fill="none"
        transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
      />
      {!done && (
        <>
          <Circle cx={RING / 2} cy={RING / 2} r={R_ENERGY} stroke={C.card2} strokeWidth={3} fill="none" />
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={R_ENERGY}
            stroke={C.mint}
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={`${C_ENERGY} ${C_ENERGY}`}
            strokeDashoffset={C_ENERGY * (1 - energy)}
            fill="none"
            transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
          />
        </>
      )}
    </Svg>
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
  const spent = p ? Math.min(1, p.loc / p.need) : 0;
  const done = Boolean(p && p.loc >= p.need);
  const drained = s.energy < 1;
  const built = p ? Math.round((p.loc / p.need) * 100) : 0;
  const locText = p ? fmtN(p.loc) : '0';
  const locSize = locText.length > 7 ? 30 : locText.length > 5 ? 40 : 54;

  const writeLabel = p
    ? `Write code. Plus ${s.tapPower} ${s.tapPower === 1 ? 'line' : 'lines'} of code, costs 1 energy. ` +
      `${fmtN(p.loc)} of ${fmtN(p.need)} lines written.`
    : '';

  return (
    <Screen>
      <ScreenTop
        day={s.day}
        {/* ScreenTop carries telemetry, not an absence, so omit this slot at zero. */}
        right={s.autoCode > 0 ? `AUTO ${s.autoCode} LOC/S` : undefined}
        rightLabel={`Automation writes ${s.autoCode} lines per second`}
        rightColor={C.mint}
      />

      {p ? (
        <Hero tone={done ? C.mint : C.gold}>
          <View style={st.head}>
            <Eyebrow>Current project</Eyebrow>
            <Text style={st.name}>{p.name}</Text>
            <Text style={st.idea}>{p.idea}</Text>
          </View>

          <View style={st.ringArea}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={done ? `${p.name} is finished. ${fmtN(p.loc)} lines written.` : writeLabel}
              accessibilityState={{ disabled: done }}
              disabled={done}
              onPress={onTap}
              style={({ pressed }) => [st.ringPress, pressed && { transform: [{ scale: 0.975 }] }]}
            >
              <Ring build={spent} energy={s.energy / s.energyMax} done={done} dim={drained && !done} />
              <View style={st.ringCenter} pointerEvents="none">
                <Text style={[st.loc, { fontSize: locSize }]} allowFontScaling={false}>
                  {locText}
                </Text>
                <MonoText style={st.need}>/ {fmtN(p.need)} LOC</MonoText>
                <MonoText style={[st.built, done && { color: C.mint }]}>
                  {done ? 'READY TO SHIP' : `${built}% BUILT`}
                </MonoText>
              </View>
              {floats.map(id => (
                <FloatingLoc key={id} amount={s.tapPower} onDone={() => setFloats(f => f.filter(x => x !== id))} />
              ))}
            </Pressable>
          </View>

          <MonoText style={[st.prompt, drained && !done && { color: C.pink }]}>
            {done ? 'SHIP IT AND FIND OUT' : drained ? 'OUT OF ENERGY · REGENERATING' : 'TAP THE RING TO WRITE CODE'}
          </MonoText>

          {done && (
            <Btn
              label="Submit to App Review"
              icon={<LaunchIcon size={18} color={C.btnText} />}
              onPress={s.submitToReview}
              style={{ marginTop: 16 }}
            />
          )}

          {!done && (
            <View style={st.meta}>
              <View style={st.metaLeft}>
                <EnergyIcon size={13} color={C.mint} />
                <MonoText
                  style={st.metaText}
                  accessibilityLabel={`${Math.floor(s.energy)} of ${s.energyMax} energy`}
                >
                  {Math.floor(s.energy)}/{s.energyMax}
                </MonoText>
              </View>
              <MonoText style={st.metaText} accessibilityLabel={`Each tap writes ${s.tapPower} lines and costs 1 energy`}>
                +{s.tapPower} LOC · −1 PER TAP
              </MonoText>
            </View>
          )}
        </Hero>
      ) : (
        <Hero>
          <View style={st.head}>
            <Eyebrow>No active project</Eyebrow>
            <Text style={st.emptyTitle}>Ideas are free.{'\n'}Shipping is the hard part.</Text>
          </View>
          <View style={st.ringArea}>
            <View style={st.emptyRing}>
              <IdeaIcon size={52} color={C.dim} />
            </View>
          </View>
          <Btn
            label="Start a new app"
            icon={<IdeaIcon size={18} color={C.btnText} />}
            onPress={s.newProject}
            style={{ marginTop: 6 }}
          />
        </Hero>
      )}

      <Section>
        <Text style={st.notes}>
          Energy regenerates on its own — or faster with caffeine from the Store. Your live apps keep earning while the
          app is closed. That's the whole point.
        </Text>
      </Section>
    </Screen>
  );
}

const st = StyleSheet.create({
  head: { alignItems: 'center' },
  name: { color: C.ink, fontSize: 27, fontWeight: '800', letterSpacing: -0.4, marginTop: 4 },
  idea: { color: C.mut, fontSize: 13, marginTop: 4, textAlign: 'center' },
  emptyTitle: { color: C.ink, fontSize: 21, fontWeight: '700', textAlign: 'center', lineHeight: 29, marginTop: 6 },

  ringArea: { alignItems: 'center', justifyContent: 'center', marginTop: 18, marginBottom: 16 },
  ringPress: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  emptyRing: {
    width: RING - 28,
    height: RING - 28,
    borderRadius: (RING - 28) / 2,
    borderWidth: 2,
    borderColor: C.line,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loc: { color: C.ink, fontWeight: '800', letterSpacing: -1.4 },
  need: { color: C.mut, fontSize: 13, marginTop: 2 },
  built: { color: C.gold, fontSize: 11, letterSpacing: 1.6, marginTop: 12 },

  float: { position: 'absolute' },
  floatText: { color: C.mint, fontSize: 13, fontWeight: '700' },

  prompt: { color: C.mut, fontSize: 10, letterSpacing: 2, textAlign: 'center' },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 22,
  },
  metaLeft: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { color: C.mut, fontSize: 11, letterSpacing: 0.6 },

  notes: { color: C.dim, fontSize: 12, lineHeight: 19 },
});
