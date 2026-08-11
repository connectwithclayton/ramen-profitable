import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useGame, MRR_GOAL } from '../state/gameStore';
import { ACHIEVEMENTS } from '../content/content';
import {
  Btn,
  Divider,
  Eyebrow,
  Hero,
  HeroNumber,
  Monogram,
  MonoText,
  Rail,
  Screen,
  ScreenTop,
  Section,
  SectionHeader,
  Unit,
  fmt,
  initials,
  money,
} from '../components/ui';
import { C, R } from '../theme';
import { AbTestIcon, DrawnIcon, EnergyIcon, PaywallIcon, RamenProfitableIcon, VerdictIcon } from '../components/icons';

/** One shipped app: monogram, what it is, what it earns, what you can do to it. */
function AppRow({
  name,
  idea,
  live,
  hasPaywall,
  mult,
  mrr,
  onPress,
}: {
  name: string;
  idea: string;
  live: boolean;
  hasPaywall: boolean;
  mult: number;
  mrr: number;
  onPress: () => void;
}) {
  const label = live
    ? `${name}. ${idea}. Earning ${fmt(mrr)} per month. ` +
      (hasPaywall
        ? `Paywall shipped, conversion times ${mult.toFixed(2)}. Run an A/B test for $75.`
        : 'No paywall yet. Design one.')
    : `${name}. ${idea}. Rejected by App Review.`;

  const body = (
    <>
      <Monogram label={initials(name)} tone={live ? C.mint : C.pink} />
      <View style={st.appInfo}>
        <Text style={st.appName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={st.appIdea} numberOfLines={2}>
          {idea}
        </Text>
      </View>
      <View style={st.appAside}>
        {live ? (
          <>
            <MonoText style={st.appMrr}>{fmt(mrr)}/mo</MonoText>
            <View style={st.appAction}>
              {hasPaywall ? <AbTestIcon size={13} color={C.gold} /> : <PaywallIcon size={13} color={C.gold} />}
              <MonoText style={st.appActionText}>{hasPaywall ? `×${mult.toFixed(2)} · $75` : 'PAYWALL'}</MonoText>
            </View>
          </>
        ) : (
          <MonoText style={st.appRejected}>REJECTED</MonoText>
        )}
      </View>
    </>
  );

  if (!live) {
    return (
      <View accessible accessibilityLabel={label} style={[st.appRow, { opacity: 0.55 }]}>
        {body}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hasPaywall ? `Opens the paywall designer. Costs $75.` : 'Opens the paywall designer.'}
      onPress={onPress}
      style={({ pressed }) => [st.appRow, pressed && { opacity: 0.6 }]}
    >
      {body}
    </Pressable>
  );
}

export default function HomeScreen() {
  const s = useGame();
  const pct = Math.min(100, (s.mrr / MRR_GOAL) * 100);
  const live = s.apps.filter(a => a.live).length;
  const unlocked = ACHIEVEMENTS.filter(a => s.achievements[a.id]).length;
  const free = !s.hasJob;
  const canQuit = s.hasJob && s.mrr >= MRR_GOAL;

  return (
    <Screen>
      <ScreenTop
        day={s.day}
        right={`${money(s.cash)} CASH`}
        rightLabel={`${money(s.cash)} cash on hand`}
      />

      <Hero tone={free ? C.mint : C.gold}>
        <Eyebrow>{free ? 'Monthly recurring · no day job' : 'Monthly recurring'}</Eyebrow>
        <HeroNumber value={money(s.mrr)} suffix="/mo" color={free ? C.mint : C.gold} />

        <View style={st.railWrap}>
          <Rail
            pct={free ? 100 : pct}
            tone={free ? C.mint : C.gold}
            accessibilityLabel="Progress toward quitting your day job"
            accessibilityValue={{ now: Math.round(pct), min: 0, max: 100 }}
          />
        </View>

        {free ? (
          <View style={st.freeLine}>
            <RamenProfitableIcon size={14} />
            <MonoText style={st.freeText}>RAMEN PROFITABLE. YOU ARE FREE.</MonoText>
          </View>
        ) : (
          <View style={st.railLabels}>
            <MonoText style={st.railEnd}>$0</MonoText>
            <MonoText style={st.railMid}>{pct.toFixed(0)}% THERE</MonoText>
            <MonoText style={st.railGoal}>{money(MRR_GOAL)} · QUIT</MonoText>
          </View>
        )}

        {canQuit && (
          <Btn
            label="Send resignation email"
            icon={<VerdictIcon size={18} color={C.btnText} />}
            onPress={s.quitJob}
            style={{ marginTop: 18 }}
          />
        )}
      </Hero>

      <Section style={st.statusRow}>
        <Unit style={st.statUnit}>
          <View style={st.statTitle}>
            <EnergyIcon size={13} color={C.mint} />
            <Eyebrow color={C.mut}>Energy</Eyebrow>
          </View>
          <MonoText style={st.statValue}>
            {Math.floor(s.energy)}
            <MonoText style={st.statValueMuted}>/{s.energyMax}</MonoText>
          </MonoText>
          <View style={{ marginTop: 9 }}>
            <Rail
              pct={(s.energy / s.energyMax) * 100}
              tone={C.mint}
              height={5}
              accessibilityLabel="Energy"
              accessibilityValue={{ now: Math.floor(s.energy), min: 0, max: s.energyMax }}
            />
          </View>
        </Unit>

        <Unit style={st.statUnit}>
          <Eyebrow color={C.mut}>Day job</Eyebrow>
          <MonoText style={st.statValue}>{s.hasJob ? `+${fmt(s.salary)}` : 'NONE'}</MonoText>
          <Text style={st.statCaption}>{s.hasJob ? 'per day, soul-crushing' : 'Bliss, statistically'}</Text>
        </Unit>
      </Section>

      {s.goIndieResolved && s.goIndieActive && (
        <Section style={{ marginTop: S_GAP }}>
          <Unit tone={C.mint} style={st.indie}>
            <MonoText style={st.indieText}>INDIE OPERATOR · 2× OFFLINE EARNINGS</MonoText>
          </Unit>
        </Section>
      )}

      <Section>
        <SectionHeader
          title="Your apps"
          meta={s.apps.length ? `${live} OF ${s.apps.length} LIVE` : undefined}
        />
        {s.apps.length === 0 ? (
          <Text style={st.empty}>Nothing shipped yet. The Code tab awaits. Everyone starts at zero.</Text>
        ) : (
          <View style={st.appList}>
            {s.apps.map((a, i) => (
              <View key={a.id}>
                {i > 0 && <Divider />}
                <AppRow
                  name={a.name}
                  idea={a.idea}
                  live={a.live}
                  hasPaywall={a.hasPaywall}
                  mult={a.mult ?? 1}
                  mrr={a.baseMrr * (a.mult ?? 1) * s.mrrMult}
                  onPress={() => s.openPaywallDesigner(a.id)}
                />
              </View>
            ))}
          </View>
        )}
      </Section>

      <Section>
        <SectionHeader title="Achievements" meta={`${unlocked} / ${ACHIEVEMENTS.length}`} />
        <View style={st.achStrip}>
          {ACHIEVEMENTS.map(a => {
            const got = s.achievements[a.id];
            return (
              <View
                key={a.id}
                accessible
                accessibilityLabel={got ? `${a.name}. ${a.desc}` : 'Locked achievement'}
                style={[st.achTile, got && st.achTileGot]}
              >
                {got ? (
                  a.drawnIcon ? (
                    <DrawnIcon name={a.drawnIcon} size={18} color={C.gold} />
                  ) : (
                    <Text style={{ fontSize: 16 }}>{a.icon}</Text>
                  )
                ) : null}
              </View>
            );
          })}
        </View>
      </Section>
    </Screen>
  );
}

const S_GAP = 10;

const st = StyleSheet.create({
  railWrap: { marginTop: 16 },
  railLabels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 9 },
  railEnd: { fontSize: 11, color: C.dim },
  railMid: { fontSize: 11, color: C.mut, letterSpacing: 0.8 },
  railGoal: { fontSize: 11, color: C.ink, letterSpacing: 0.8, fontWeight: '600' },
  freeLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  freeText: { fontSize: 11, color: C.mint, letterSpacing: 1 },

  statusRow: { flexDirection: 'row', gap: S_GAP },
  statUnit: { flex: 1, justifyContent: 'flex-start' },
  statTitle: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statValue: { color: C.ink, fontSize: 22, fontWeight: '700', marginTop: 6 },
  statValueMuted: { color: C.dim, fontSize: 14, fontWeight: '400' },
  statCaption: { color: C.mut, fontSize: 11, marginTop: 4 },

  indie: { paddingVertical: 9, alignItems: 'center' },
  indieText: { color: C.mint, fontSize: 10, letterSpacing: 1.2, fontWeight: '600' },

  empty: { color: C.mut, fontSize: 13, lineHeight: 19, marginTop: 10 },
  appList: { marginTop: 4 },
  appRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  appInfo: { flex: 1 },
  appName: { color: C.ink, fontWeight: '700', fontSize: 15 },
  appIdea: { color: C.mut, fontSize: 11.5, lineHeight: 15, marginTop: 2 },
  appAside: { alignItems: 'flex-end', gap: 5, minWidth: 106 },
  appMrr: { color: C.mint, fontSize: 13, fontWeight: '600' },
  appAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  appActionText: { color: C.gold, fontSize: 9.5, letterSpacing: 0.6 },
  appRejected: { color: C.pink, fontSize: 11, letterSpacing: 1 },

  achStrip: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  achTile: {
    width: 34,
    height: 34,
    borderRadius: R.tile,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.45,
  },
  achTileGot: { backgroundColor: C.card2, borderColor: C.gold, opacity: 1 },
});
