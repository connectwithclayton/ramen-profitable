import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, SafeAreaView, Platform, StatusBar as RNStatusBar } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useGame } from './src/state/gameStore';
import { useGameLoop } from './src/systems/useGameLoop';
import { initPurchases } from './src/monetization/purchases';
import NotifStack from './src/components/NotifStack';
import OverlayHost from './src/components/OverlayHost';
import HomeScreen from './src/screens/HomeScreen';
import CodeScreen from './src/screens/CodeScreen';
import StoreScreen from './src/screens/StoreScreen';
import ChirpScreen from './src/screens/ChirpScreen';
import { MonoText } from './src/components/ui';
import { C, R } from './src/theme';
import { DrawnIcon, RamenProfitableIcon } from './src/components/icons';
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
  const day = useGame(s => s.day);
  const unread = useGame(s => s.unreadChirps);
  const pushNotif = useGame(s => s.pushNotif);
  const pushChirp = useGame(s => s.pushChirp);
  const setGoIndieActive = useGame(s => s.setGoIndieActive);
  const hydrated = useGame(s => s.day !== undefined);

  useGameLoop();

  useEffect(() => {
    let cancelled = false;
    void initPurchases().then(active => {
      if (!cancelled) {
        setGoIndieActive(active === true);
        useGame.getState().applyOfflineEarnings();
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
      <View style={st.statusbar}>
        <MonoText style={{ fontSize: 12, fontWeight: '600' }}>Day {day}</MonoText>
        <View style={st.brand}>
          <RamenProfitableIcon size={13} />
          <MonoText style={{ fontSize: 12, color: C.mut }}>RAMEN PROFITABLE</MonoText>
        </View>
        <MonoText style={{ fontSize: 12, color: C.mut }}>v0.1</MonoText>
      </View>

      <View style={{ flex: 1 }}>
        {tab === 'home' && <HomeScreen />}
        {tab === 'code' && <CodeScreen />}
        {tab === 'store' && <StoreScreen />}
        {tab === 'chirp' && <ChirpScreen />}
      </View>

      <View style={st.dock}>
        {TABS.map(t => (
          <Pressable key={t.key} onPress={() => setTab(t.key)} style={st.dockBtn}>
            <DrawnIcon name={t.icon} size={20} active={tab === t.key} color={C.dim} />
            <Text style={[st.dockLabel, tab === t.key && { color: C.gold }]}>{t.label}</Text>
            {t.key === 'chirp' && unread && <View style={st.badge} />}
          </Pressable>
        ))}
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
  statusbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 5 },
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
