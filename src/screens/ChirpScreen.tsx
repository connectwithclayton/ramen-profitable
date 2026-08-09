import React, { useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useGame } from '../state/gameStore';
import { Card, MonoText } from '../components/ui';
import { C } from '../theme';
import { LikeFilledIcon, LikeIcon } from '../components/icons';

export default function ChirpScreen() {
  const chirps = useGame(s => s.chirps);
  const markRead = useGame(s => s.markChirpsRead);
  const toggleLike = useGame(s => s.toggleChirpLike);

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
              <View style={st.meta}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${c.liked ? 'Unlike' : 'Like'} post by ${c.who}`}
                  accessibilityState={{ selected: Boolean(c.liked) }}
                  hitSlop={8}
                  onPress={() => toggleLike(c.id)}
                  style={st.likeButton}
                >
                  {c.liked ? <LikeFilledIcon size={14} color={C.pink} /> : <LikeIcon size={14} color={C.dim} />}
                  <MonoText style={st.metaText}>{c.likes}</MonoText>
                </Pressable>
                <MonoText style={st.metaText}>⟳ {Math.floor(c.likes / 4)}</MonoText>
              </View>
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
  meta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  metaText: { color: C.dim, fontSize: 12 },
  likeButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
