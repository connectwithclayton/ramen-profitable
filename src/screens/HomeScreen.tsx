import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useGame, MRR_GOAL } from '../state/gameStore';
import { ACHIEVEMENTS } from '../content/content';
import { Card, Eyebrow, Btn, Meter, MonoText, fmt } from '../components/ui';
import { C } from '../theme';
import { AbTestIcon, DrawnIcon, GoalIcon, PaywallIcon, RamenProfitableIcon, VerdictIcon } from '../components/icons';

export default function HomeScreen() {
  const s = useGame();
  const pct = Math.min(100, (s.mrr / MRR_GOAL) * 100);

  return (
    <ScrollView contentContainerStyle={st.wrap} showsVerticalScrollIndicator={false}>
      <Card>
        <Eyebrow>Monthly recurring revenue</Eyebrow>
        <View style={st.row}>
          <MonoText style={{ fontSize: 30, fontWeight: '600', color: C.gold }}>
            {fmt(s.mrr)}
            <MonoText style={{ fontSize: 14, color: C.dim }}>/mo</MonoText>
          </MonoText>
          <MonoText style={{ color: C.mut, fontSize: 13 }}>cash {fmt(s.cash)}</MonoText>
        </View>
        <Meter pct={pct} />
        {s.hasJob ? (
          <View style={st.goalLabel}>
            <GoalIcon size={13} />
            <MonoText style={st.label}>QUIT YOUR JOB at {fmt(MRR_GOAL)} MRR — {pct.toFixed(0)}%</MonoText>
          </View>
        ) : (
          <View style={st.goalLabel}>
            <RamenProfitableIcon size={13} />
            <MonoText style={st.label}>RAMEN PROFITABLE. You are free.</MonoText>
          </View>
        )}
        {s.hasJob && s.mrr >= MRR_GOAL && (
          <Btn label="Send resignation email" icon={<VerdictIcon size={18} color={C.btnText} />} onPress={s.quitJob} style={{ marginTop: 12 }} />
        )}
      </Card>

      <Card>
        <Eyebrow>Status</Eyebrow>
        <View style={st.grid}>
          <View style={{ flex: 1 }}>
            <Text style={st.k}>Day job</Text>
            <Text style={st.v}>{s.hasJob ? `Soul-crushing (+${fmt(s.salary)}/day)` : 'None. Bliss.'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.k}>Energy</Text>
            <Text style={[st.v, { color: C.mint }]}>
              {Math.floor(s.energy)}/{s.energyMax}
            </Text>
          </View>
        </View>
        {s.goIndieResolved && s.goIndieActive && (
          <View style={st.indieBadge}>
            <MonoText style={st.indieText}>GO INDIE ACTIVE · INDIE OPERATOR · 2× OFFLINE EARNINGS</MonoText>
          </View>
        )}
      </Card>

      <Card>
        <Eyebrow>Your apps ({s.apps.length})</Eyebrow>
        {s.apps.length === 0 ? (
          <Text style={st.empty}>Nothing shipped yet. The Code tab awaits. Everyone starts at zero.</Text>
        ) : (
          s.apps.map(a => (
            <View key={a.id} style={st.appRow}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.ink, fontWeight: '700', fontSize: 14 }}>{a.name}</Text>
                <Text style={{ color: C.mut, fontSize: 11 }}>{a.idea}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <View style={st.tag}>
                  <MonoText style={{ fontSize: 10, color: a.live ? C.mint : C.pink }}>
                    {a.live ? `${fmt(a.baseMrr * (a.mult ?? 1) * s.mrrMult)}/mo` : 'REJECTED'}
                  </MonoText>
                </View>
                {a.live && (
                  <Btn
                    small
                    ghost
                    label={a.hasPaywall ? `A/B ($75) ×${(a.mult ?? 1).toFixed(2)}` : 'Design paywall'}
                    icon={a.hasPaywall ? <AbTestIcon size={15} color={C.ink} /> : <PaywallIcon size={15} color={C.ink} />}
                    onPress={() => s.openPaywallDesigner(a.id)}
                  />
                )}
              </View>
            </View>
          ))
        )}
      </Card>
      <Card>
        <Eyebrow>Achievements</Eyebrow>
        <View style={st.achWrap}>
          {ACHIEVEMENTS.map(a => {
            const got = s.achievements[a.id];
            return (
              <View key={a.id} style={[st.ach, !got && { opacity: 0.28 }]}>
                {a.drawnIcon ? <DrawnIcon name={a.drawnIcon} size={18} color={C.mut} /> : <Text style={{ fontSize: 18 }}>{a.icon}</Text>}
                <Text style={st.achName}>{got ? a.name : '???'}</Text>
              </View>
            );
          })}
        </View>
      </Card>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  wrap: { padding: 14, paddingBottom: 110 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 11, color: C.mut, marginTop: 6 },
  goalLabel: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  grid: { flexDirection: 'row', gap: 10 },
  k: { color: C.mut, fontSize: 12 },
  v: { color: C.ink, fontWeight: '600', fontSize: 14, marginTop: 2 },
  indieBadge: {
    marginTop: 12,
    paddingVertical: 7,
    paddingHorizontal: 9,
    borderRadius: 7,
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: C.mint,
  },
  indieText: { color: C.mint, fontSize: 10, fontWeight: '600', textAlign: 'center' },
  empty: { color: C.mut, fontSize: 13 },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  tag: {
    backgroundColor: C.card2,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  achWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  ach: { width: '21%', alignItems: 'center', gap: 2 },
  achName: { color: C.mut, fontSize: 9, textAlign: 'center' },
});
