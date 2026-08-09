import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, View } from 'react-native';
import { useGame, Notif } from '../state/gameStore';
import { C } from '../theme';
import { DrawnIcon } from './icons';

function NotifCard({ n }: { n: Notif }) {
  const y = useRef(new Animated.Value(-30)).current;
  const op = useRef(new Animated.Value(0)).current;
  const expire = useGame(s => s.expireNotif);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(y, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(op, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => {
      Animated.timing(op, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => expire(n.id));
    }, 4600);
    return () => clearTimeout(t);
  }, []);

  return (
    <Animated.View style={[st.notif, { opacity: op, transform: [{ translateY: y }] }]}>
      {n.icon && <DrawnIcon name={n.icon} size={18} />}
      <Text style={st.text}>{n.text}</Text>
    </Animated.View>
  );
}

export default function NotifStack() {
  const notifs = useGame(s => s.notifs);
  return (
    <View style={st.wrap} pointerEvents="none">
      {notifs.map(n => (
        <NotifCard key={n.id} n={n} />
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { position: 'absolute', top: 54, left: 10, right: 10, zIndex: 60, gap: 6 },
  notif: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(29,35,56,0.96)',
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  text: { flex: 1, color: C.ink, fontSize: 13 },
});
