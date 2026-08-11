import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, SafeAreaView, Platform, StatusBar as RNStatusBar } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Svg, { Defs, LinearGradient, Rect as SvgRect, Stop } from 'react-native-svg';
import { useGame } from './src/state/gameStore';
import { useGameLoop } from './src/systems/useGameLoop';
import { initPurchases } from './src/monetization/purchases';
import NotifStack from './src/components/NotifStack';
import OverlayHost from './src/components/OverlayHost';
import HomeScreen from './src/screens/HomeScreen';
import CodeScreen from './src/screens/CodeScreen';
import StoreScreen from './src/screens/StoreScreen';
import ChirpScreen from './src/screens/ChirpScreen';
import { C, R } from './src/theme';
import { DrawnIcon } from './src/components/icons';
import type { IconName } from './src/components/icons';

type Tab = 'home' | 'code' | 'store' | 'chirp';
const TABS: { key: Tab; icon: IconName; label: string }[] = [
  { key: 'home', icon: 'home', label: 'Home' },
  { key: 'code', icon: 'code', label: 'Code' },
  { key: 'store', icon: 'store', label: 'Store' },
  { key: 'chirp', icon: 'chirp', label: 'Chirp' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  const unread = useGame(s => s.unreadChirps);
  const pushNotif = useGame(s => s.pushNotif);
  const pushChirp = useGame(s => s.pushChirp);
  const setGoIndieActive = useGame(s => s.setGoIndieActive);
  const hydrated = useGame(s => s.day !== undefined);

  useGameLoop();

  useEffect(() => {
    let cancelled = false;
    void initPurchases().then(active => {
      if (!cancelled && active !== null) {
        setGoIndieActive(active);
      }
    });
    const t1 = setTimeout(() => pushNotif('11:58 PM. The day job is done. The real work begins. Open Code.', 'night'), 900);
    const t2 = setTimeout(() => {
      const s = useGame.getState();
      if (s.chirps.length === 0) {
        pushChirp(`everyone's shipping for #shipaton and i'm still "validating my idea" (scrolling)`);
      }
    }, 3000);
    return () => {
      cancelled = true;
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [setGoIndieActive]);

  return (
    <SafeAreaView style={st.root}>
      <StatusBar style="light" />

      <View style={{ flex: 1 }}>
        {tab === 'home' && <HomeScreen />}
        {tab === 'code' && <CodeScreen />}
        {tab === 'store' && <StoreScreen />}
        {tab === 'chirp' && <ChirpScreen />}
      </View>

      <View pointerEvents="none" style={st.dockFade}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="dockFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={C.midnight} stopOpacity={0} />
              {/* Opaque from the dock's top edge down, so nothing ghosts through the dock fill. */}
              <Stop offset="0.57" stopColor={C.midnight} stopOpacity={1} />
              <Stop offset="1" stopColor={C.midnight} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <SvgRect x="0" y="0" width="100%" height="100%" fill="url(#dockFade)" />
        </Svg>
      </View>

      <View style={st.dock} accessibilityRole="tablist">
        {TABS.map(t => {
          const active = tab === t.key;
          const flagged = t.key === 'chirp' && unread;
          return (
            <Pressable
              key={t.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={flagged ? `${t.label}, new posts` : t.label}
              onPress={() => setTab(t.key)}
              style={({ pressed }) => [st.dockBtn, pressed && { opacity: 0.6 }]}
            >
              <DrawnIcon name={t.icon} size={20} active={active} color={C.dim} />
              <Text style={[st.dockLabel, active && { color: C.gold }]}>{t.label}</Text>
              {flagged && <View style={st.badge} />}
            </Pressable>
          );
        })}
      </View>

      <NotifStack />
      <OverlayHost />
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.midnight,
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  // Runs to the very bottom, not just to the dock's top edge: content scrolling
  // past needs to fade out *and* stop showing through the dock's translucent fill.
  dockFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 172,
  },
  dock: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 16,
    backgroundColor: 'rgba(29,35,56,0.94)',
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: R.dock,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  dockBtn: { alignItems: 'center', gap: 2, paddingHorizontal: 10, paddingVertical: 4 },
  dockLabel: { fontSize: 10, letterSpacing: 0.4, color: C.dim },
  badge: {
    position: 'absolute',
    top: 2,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.pink,
  },
});
