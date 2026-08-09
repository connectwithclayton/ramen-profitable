import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform, ViewStyle, TextStyle } from 'react-native';
import { C, R } from '../theme';

export const mono = Platform.select({ ios: 'Menlo', default: 'monospace' });

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[st.card, style]}>{children}</View>;
}

export function Eyebrow({ children, color }: { children: React.ReactNode; color?: string }) {
  return <Text style={[st.eyebrow, color ? { color } : null]}>{children}</Text>;
}

type BtnProps = ({ label: string; children?: never } | { label?: never; children: React.ReactNode }) & {
  icon?: React.ReactNode;
  onPress: () => void;
  ghost?: boolean;
  disabled?: boolean;
  small?: boolean;
  style?: ViewStyle;
};

export function Btn({
  label,
  children,
  icon,
  onPress,
  ghost,
  disabled,
  small,
  style,
}: BtnProps) {
  const textStyle = [st.btnText, ghost && { color: C.ink, fontWeight: '600' as const }, small && { fontSize: 13 }];
  const content = children ? (
    <View style={st.btnLabel}>
      {React.Children.map(children, child =>
        typeof child === 'string' || typeof child === 'number' ? <Text style={textStyle}>{child}</Text> : child,
      )}
    </View>
  ) : (
    <Text style={textStyle}>{label}</Text>
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        st.btn,
        ghost && st.btnGhost,
        small && st.btnSmall,
        disabled && { opacity: 0.35 },
        pressed && !disabled && { transform: [{ scale: 0.97 }] },
        style,
      ]}
    >
      {icon || children ? (
        <View style={st.btnContent}>
          {icon}
          {content}
        </View>
      ) : (
        content
      )}
    </Pressable>
  );
}

export function Meter({ pct, color }: { pct: number; color?: string }) {
  return (
    <View style={st.meter}>
      <View style={[st.meterFill, { width: `${Math.max(0, Math.min(100, pct))}%` }, color ? { backgroundColor: color } : null]} />
    </View>
  );
}

export function MonoText({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[{ fontFamily: mono, color: C.ink }, style]}>{children}</Text>;
}

export const fmt = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.floor(n)}`);
export const fmtN = (n: number) => Math.floor(n).toLocaleString();

const st = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: R.card,
    padding: 14,
    marginBottom: 10,
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: C.dim,
    marginBottom: 6,
    fontWeight: '600',
  },
  btn: {
    backgroundColor: C.gold,
    borderRadius: R.btn,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  btnGhost: {
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: C.line,
  },
  btnSmall: { paddingVertical: 9, paddingHorizontal: 12 },
  btnContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  btnLabel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 },
  btnText: { color: C.btnText, fontWeight: '700', fontSize: 15 },
  meter: {
    height: 8,
    borderRadius: 6,
    backgroundColor: C.card2,
    overflow: 'hidden',
    marginTop: 6,
  },
  meterFill: { height: '100%', borderRadius: 6, backgroundColor: C.gold },
});
