import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useGame } from '../state/gameStore';
import {
  Divider,
  Monogram,
  MonoText,
  Screen,
  ScreenTop,
  accentFor,
  initials,
} from '../components/ui';
import { C, S } from '../theme';
import { ChirpIcon, LikeFilledIcon, LikeIcon } from '../components/icons';

export default function ChirpScreen() {
  const day = useGame(s => s.day);
  const chirps = useGame(s => s.chirps);
  const markRead = useGame(s => s.markChirpsRead);
  const toggleLike = useGame(s => s.toggleChirpLike);

  useEffect(() => {
    markRead();
  }, [chirps.length]);

  return (
    <Screen>
      <ScreenTop
        day={day}
        right={chirps.length ? `${chirps.length} POSTS` : undefined}
        rightLabel={`${chirps.length} posts in your feed`}
      />

      <View style={st.masthead}>
        <Text style={st.wordmark}>Chirp</Text>
        <MonoText style={st.tagline}>THE INTERNET HAS OPINIONS</MonoText>
      </View>

      {chirps.length === 0 ? (
        <View style={st.empty}>
          <ChirpIcon size={34} color={C.dim} />
          <Text style={st.emptyText}>Your feed is empty. Ship something and the internet will have opinions.</Text>
        </View>
      ) : (
        <View>
          {chirps.map((c, i) => {
            const tone = accentFor(c.handle);
            const likes = c.likes + (c.liked ? 1 : 0);
            return (
              <View key={c.id}>
                {i > 0 && <View style={st.dividerWrap}><Divider /></View>}
                <View style={st.chirp}>
                  <Monogram label={initials(c.who)} tone={tone} size={40} />
                  <View style={st.chirpBody}>
                    <Text style={st.line} numberOfLines={1}>
                      <Text style={st.who}>{c.who}</Text>
                      <Text style={st.handle}>{'  '}{c.handle}</Text>
                    </Text>
                    <Text style={st.text}>{c.text}</Text>
                    <View style={st.meta}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${c.liked ? 'Unlike' : 'Like'} post by ${c.who}, ${likes} likes`}
                        accessibilityState={{ selected: Boolean(c.liked) }}
                        hitSlop={{ top: 14, bottom: 14, left: 12, right: 22 }}
                        onPress={() => toggleLike(c.id)}
                        style={({ pressed }) => [st.likeButton, pressed && { opacity: 0.6 }]}
                      >
                        {c.liked ? <LikeFilledIcon size={14} color={C.pink} /> : <LikeIcon size={14} color={C.dim} />}
                        <MonoText style={[st.metaText, c.liked && { color: C.pink }]}>{likes}</MonoText>
                      </Pressable>
                      <MonoText style={st.metaText} accessibilityLabel={`${Math.floor(c.likes / 4)} reposts`}>
                        ⟳ {Math.floor(c.likes / 4)}
                      </MonoText>
                    </View>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  masthead: {
    paddingHorizontal: S.gutter,
    paddingTop: 10,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  wordmark: { color: C.ink, fontSize: 30, fontWeight: '800', letterSpacing: -0.8 },
  tagline: { color: C.dim, fontSize: 10, letterSpacing: 1.8, marginTop: 4 },

  empty: { paddingHorizontal: S.gutter, paddingTop: 40, alignItems: 'center', gap: 14 },
  emptyText: { color: C.mut, fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 280 },

  dividerWrap: { paddingHorizontal: S.gutter },
  chirp: { flexDirection: 'row', gap: 12, paddingHorizontal: S.gutter, paddingVertical: 15 },
  chirpBody: { flex: 1 },
  line: { marginBottom: 4 },
  who: { color: C.ink, fontWeight: '700', fontSize: 14.5 },
  handle: { color: C.dim, fontSize: 12.5 },
  text: { color: C.ink, fontSize: 14.5, lineHeight: 21 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 5 },
  metaText: { color: C.dim, fontSize: 12 },
  likeButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4, paddingRight: 6 },
});
