import React, { useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useGame } from '../state/gameStore';
import { Card, MonoText } from '../components/ui';
import { C } from '../theme';

export default function ChirpScreen() {
  const chirps = useGame(s => s.chirps);
  const markRead = useGame(s => s.markChirpsRead);

  useEffect(() => {
    markRead();
  }, [chirps.length]);

  return (
    <ScrollView contentContainerStyle={st.wrap} showsVerticalScrollIndicator={false}>
      <Card style={{ paddingVertical: 6 }}>
        {chirps.length === 0 ? (
          <Text style={st.empty}>Your feed is empty. Ship something and the internet will have opinions.</Text>
        ) : (
          chirps.map(c => (
            <View key={c.id} style={st.chirp}>
              <Text style={st.line}>
                <Text style={st.who}>{c.who} </Text>
                <Text style={st.handle}>{c.handle}</Text>
              </Text>
              <Text style={st.body}>{c.text}</Text>
              <MonoText style={st.meta}>
                ♡ {c.likes}   ⟳ {Math.floor(c.likes / 4)}
              </MonoText>
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  wrap: { padding: 14, paddingBottom: 110 },
  empty: { color: C.mut, fontSize: 13, paddingVertical: 14 },
  chirp: {
    paddingVertical: 12,
    paddingHorizontal: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  line: { marginBottom: 2 },
  who: { color: C.ink, fontWeight: '700', fontSize: 14 },
  handle: { color: C.dim, fontSize: 12 },
  body: { color: C.ink, fontSize: 14, lineHeight: 20 },
  meta: { color: C.dim, fontSize: 12, marginTop: 6 },
});
