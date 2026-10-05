import React, { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '../theme';
import { Divider } from './ui';

const LINKS = [
  { label: 'Privacy Policy', url: 'https://ramen.clayj.app/privacy/' },
  { label: 'Support', url: 'https://ramen.clayj.app/support/' },
] as const;

export default function PrivacySupportLinks() {
  const [opening, setOpening] = useState<string | null>(null);

  const open = async (label: string, url: string) => {
    if (opening) return;
    setOpening(label);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      // Linking.openURL can succeed even when Safari cannot load the page offline.
      // Check the actual destination first so the player gets feedback in the app.
      let response: Response;
      try {
        response = await fetch(url, { signal: controller.signal });
      } catch {
        Alert.alert('Page not reachable', 'Check your internet connection and try again.');
        return;
      }
      if (!response.ok) {
        Alert.alert('Page unavailable', 'This page is unavailable right now. Try again later.');
        return;
      }
      try {
        await Linking.openURL(url);
      } catch {
        Alert.alert('Cannot open link', 'Could not open this page in your browser. Try again later.');
      }
    } finally {
      clearTimeout(timeout);
      setOpening(null);
    }
  };

  return (
    <View>
      <Text style={st.copy}>
        Learn how Ramen Profitable handles game progress, purchases, and advertising, or get help.
      </Text>
      <View style={st.links}>
        {LINKS.map(({ label, url }, index) => (
          <React.Fragment key={label}>
            {index > 0 && <Divider />}
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={label}
              accessibilityHint="Opens in your browser"
              accessibilityState={{ disabled: opening !== null }}
              disabled={opening !== null}
              onPress={() => open(label, url)}
              style={({ pressed }) => [st.link, pressed && st.pressed]}
            >
              <Text style={st.linkText}>{label}</Text>
            </Pressable>
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  copy: { color: C.mut, fontSize: 14, lineHeight: 21 },
  links: { marginTop: 12 },
  link: { minHeight: 48, justifyContent: 'center', paddingVertical: 10 },
  linkText: { color: C.gold, fontSize: 16, lineHeight: 23, fontWeight: '600', textDecorationLine: 'underline' },
  pressed: { opacity: 0.7 },
});
