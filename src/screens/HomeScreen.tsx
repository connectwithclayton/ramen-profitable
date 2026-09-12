import React from 'react';
import {
  AppState,
  Platform,
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useGame, MRR_GOAL } from '../state/gameStore';
import { ACHIEVEMENTS, BETA_TESTER } from '../content/content';
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
import {
  formatMrrDelta,
  homeAutomationStatus,
  homeEmptyProjectCopy,
  homeProjectActionLabel,
  sampleHomeExposure,
  selectHomeReaction,
  verticalFrameExposureRate,
} from '../state/experience';

function useForegroundExposure(
  enabled: boolean,
  record: (elapsedSeconds: number, remainsVisible: boolean) => void,
  exposureRate = 1,
) {
  React.useEffect(() => {
    if (!enabled) return;

    let appState = AppState.currentState;
    let focused = true;
    let visibleSince = appState === 'active' ? performance.now() : undefined;

    const report = (homeStillVisible: boolean) => {
      const sample = sampleHomeExposure(visibleSince, performance.now(), homeStillVisible);
      visibleSince = sample.nextStartedAt;
      if (sample.elapsedSeconds > 0) {
        record(sample.elapsedSeconds * exposureRate, homeStillVisible);
      }
    };

    const interval = setInterval(() => {
      if (appState === 'active' && focused) report(true);
    }, 1000);
    const appStateSubscription = AppState.addEventListener('change', nextState => {
      if (appState === 'active' && focused) report(false);
      appState = nextState;
      if (appState === 'active' && focused) visibleSince = performance.now();
    });
    const blurSubscription = Platform.OS === 'android'
      ? AppState.addEventListener('blur', () => {
          if (appState === 'active' && focused) report(false);
          focused = false;
        })
      : undefined;
    const focusSubscription = Platform.OS === 'android'
      ? AppState.addEventListener('focus', () => {
          if (focused) return;
          focused = true;
          if (appState === 'active') visibleSince = performance.now();
        })
      : undefined;

    return () => {
      if (appState === 'active' && focused) report(false);
      clearInterval(interval);
      appStateSubscription.remove();
      blurSubscription?.remove();
      focusSubscription?.remove();
    };
  }, [enabled, exposureRate, record]);
}

function useHomeReactionViewport(
  reactionId: string | undefined,
  bottomOcclusion: number | undefined,
) {
  const viewport = React.useRef<{ y: number; height: number }>({ y: 0, height: 0 });
  const sectionY = React.useRef<number | undefined>(undefined);
  const card = React.useRef<{ y: number; height: number } | undefined>(undefined);
  const currentReactionId = React.useRef(reactionId);
  const [exposureRate, setExposureRate] = React.useState(0);

  const updateExposure = React.useCallback(() => {
    const cardFrame = sectionY.current === undefined || !card.current
      ? undefined
      : { y: sectionY.current + card.current.y, height: card.current.height };
    const nextRate = verticalFrameExposureRate(
      cardFrame,
      viewport.current,
      bottomOcclusion ?? viewport.current.height,
    );
    setExposureRate(current => current === nextRate ? current : nextRate);
  }, [bottomOcclusion]);

  React.useLayoutEffect(() => {
    currentReactionId.current = reactionId;
    sectionY.current = undefined;
    card.current = undefined;
    setExposureRate(0);
  }, [reactionId]);

  React.useLayoutEffect(() => {
    updateExposure();
  }, [updateExposure]);

  const onViewportLayout = React.useCallback((event: LayoutChangeEvent) => {
    viewport.current = { ...viewport.current, height: event.nativeEvent.layout.height };
    updateExposure();
  }, [updateExposure]);

  const onViewportScroll = React.useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    viewport.current = {
      y: event.nativeEvent.contentOffset.y,
      height: event.nativeEvent.layoutMeasurement.height,
    };
    updateExposure();
  }, [updateExposure]);

  const onSectionLayout = React.useCallback((event: LayoutChangeEvent) => {
    if (currentReactionId.current !== reactionId) return;
    sectionY.current = event.nativeEvent.layout.y;
    updateExposure();
  }, [reactionId, updateExposure]);

  const onCardLayout = React.useCallback((event: LayoutChangeEvent) => {
    if (currentReactionId.current !== reactionId) return;
    card.current = {
      y: event.nativeEvent.layout.y,
      height: event.nativeEvent.layout.height,
    };
    updateExposure();
  }, [reactionId, updateExposure]);

  return { exposureRate, onViewportLayout, onViewportScroll, onSectionLayout, onCardLayout };
}

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

export default function HomeScreen({
  bottomOcclusion,
  onOpenCode,
}: {
  bottomOcclusion: number | undefined;
  onOpenCode: () => void;
}) {
  const s = useGame();
  const pct = Math.min(100, (s.mrr / MRR_GOAL) * 100);
  const live = s.apps.filter(a => a.live).length;
  const unlocked = ACHIEVEMENTS.filter(a => s.achievements[a.id]).length;
  const free = !s.hasJob;
  const canQuit = s.hasJob && s.mrr >= MRR_GOAL;
  const reaction = selectHomeReaction({
    chirps: s.chirps,
    priority: s.homePriority,
    prioritySecondsLeft: s.homePrioritySecondsLeft,
    receipt: s.homeReceipt,
    receiptSecondsLeft: s.homeReceiptSecondsLeft,
    betaTester: BETA_TESTER,
  });
  const timedReactionId = reaction && (
    (s.homePrioritySecondsLeft > 0 && reaction.id === s.homePriority?.id) ||
    (s.homeReceiptSecondsLeft > 0 && reaction.id === s.homeReceipt?.id)
  ) ? reaction.id : undefined;
  const reactionViewport = useHomeReactionViewport(reaction?.id, bottomOcclusion);
  const recordReactionExposure = React.useCallback((elapsedSeconds: number) => {
    if (timedReactionId) s.recordHomeReactionExposure(timedReactionId, elapsedSeconds);
  }, [timedReactionId, s.recordHomeReactionExposure]);
  useForegroundExposure(s.overlay === null, s.recordHomeExposure);
  useForegroundExposure(
    Boolean(
      s.overlay === null &&
      timedReactionId &&
      reactionViewport.exposureRate > 0
    ),
    recordReactionExposure,
    reactionViewport.exposureRate,
  );
  const projectDone = Boolean(s.project && s.project.loc >= s.project.need);
  const automationStatus = homeAutomationStatus(s.autoCode, s.project);
  const emptyProjectCopy = homeEmptyProjectCopy(s.apps);

  return (
    <Screen
      onLayout={reactionViewport.onViewportLayout}
      onScroll={reactionViewport.onViewportScroll}
      scrollEventThrottle={16}
    >
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

      {reaction && (
        <Section key={reaction.id} onLayout={reactionViewport.onSectionLayout}>
          <SectionHeader title="From Chirp" meta={reaction.event} />
          <Unit
            style={st.reaction}
            tone={reaction.kind === 'paywall' ? C.pink : C.gold}
            onLayout={reactionViewport.onCardLayout}
          >
            <View style={st.reactionByline}>
              <Text style={st.reactionWho}>{reaction.who}</Text>
              <MonoText style={st.reactionHandle}>{reaction.handle}</MonoText>
            </View>
            <Text style={st.reactionText}>{reaction.text}</Text>
            {reaction.delta && (
              <MonoText
                style={[st.receipt, { color: reaction.delta.after >= reaction.delta.before ? C.mint : C.pink }]}
              >
                {formatMrrDelta(reaction.delta)}
              </MonoText>
            )}
          </Unit>
        </Section>
      )}

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
        {s.project ? (
          <Unit style={st.projectUnit} tone={projectDone ? C.mint : C.gold}>
            <View style={st.projectTop}>
              <View style={st.projectCopy}>
                <Text style={st.projectName} numberOfLines={1}>{s.project.name}</Text>
                <Text style={st.projectIdea} numberOfLines={2}>{s.project.idea}</Text>
              </View>
              <MonoText style={[st.projectState, projectDone && { color: C.mint }]}>
                {projectDone ? 'READY' : Math.floor(s.project.loc) + ' / ' + s.project.need + ' LOC'}
              </MonoText>
            </View>
            <Rail
              pct={(s.project.loc / s.project.need) * 100}
              tone={projectDone ? C.mint : C.gold}
              height={5}
              accessibilityLabel={'Build progress for ' + s.project.name}
              accessibilityValue={{ now: Math.min(100, Math.round((s.project.loc / s.project.need) * 100)), min: 0, max: 100 }}
            />
            {automationStatus && (
              <MonoText style={st.automation}>{automationStatus}</MonoText>
            )}
            <Btn small label={homeProjectActionLabel(projectDone)} onPress={onOpenCode} style={st.projectButton} />
          </Unit>
        ) : (
          <Unit style={st.projectUnit}>
            <Text style={st.empty}>
              {emptyProjectCopy}
            </Text>
            <Btn
              small
              label={s.apps.length === 0 ? 'Start your first app' : 'Start another app'}
              onPress={onOpenCode}
              style={st.projectCta}
            />
          </Unit>
        )}
        {s.apps.length > 0 && (
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
          {ACHIEVEMENTS.map((a, i) => {
            const got = s.achievements[a.id];
            return (
              <View
                key={a.id}
                accessible
                accessibilityLabel={got ? `${a.name}. ${a.desc}` : `Locked achievement, ${i + 1} of ${ACHIEVEMENTS.length}`}
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

  reaction: { paddingVertical: 13 },
  reactionByline: { flexDirection: 'row', alignItems: 'baseline', gap: 7 },
  reactionWho: { color: C.ink, fontSize: 13, fontWeight: '700' },
  reactionHandle: { color: C.dim, fontSize: 10 },
  reactionText: { color: C.ink, fontSize: 14, lineHeight: 20, marginTop: 7 },
  receipt: { fontSize: 10.5, marginTop: 8, letterSpacing: 0.25 },

  statusRow: { flexDirection: 'row', gap: S_GAP },
  statUnit: { flex: 1, justifyContent: 'flex-start' },
  statTitle: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statValue: { color: C.ink, fontSize: 22, fontWeight: '700', marginTop: 6 },
  statValueMuted: { color: C.dim, fontSize: 14, fontWeight: '400' },
  statCaption: { color: C.mut, fontSize: 11, marginTop: 4 },

  indie: { paddingVertical: 9, alignItems: 'center' },
  indieText: { color: C.mint, fontSize: 10, letterSpacing: 1.2, fontWeight: '600' },

  projectUnit: { marginTop: 10 },
  projectTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  projectCopy: { flex: 1 },
  projectName: { color: C.ink, fontWeight: '700', fontSize: 15 },
  projectIdea: { color: C.mut, fontSize: 11.5, lineHeight: 16, marginTop: 3 },
  projectState: { color: C.gold, fontSize: 10, letterSpacing: 0.4 },
  automation: { color: C.mint, fontSize: 9.5, letterSpacing: 0.5, marginTop: 9 },
  projectButton: { marginTop: 12 },
  projectCta: { marginTop: 12 },
  empty: { color: C.mut, fontSize: 13, lineHeight: 19 },
  appList: { marginTop: 8 },
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
