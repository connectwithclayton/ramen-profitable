import React from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  StyleProp,
  TextProps,
  ViewStyle,
  TextStyle,
} from 'react-native';
import Svg, { Defs, Rect as SvgRect, RadialGradient, Stop } from 'react-native-svg';
import { C, R, S } from '../theme';

export const mono = Platform.select({ ios: 'Menlo', default: 'monospace' });

/**
 * Two voices, used consistently across all four screens:
 *   mono  — telemetry the game reports (labels, counters, money, state)
 *   sans  — things a person wrote (app names, ideas, prose)
 * Hero numerals are sans so they read as the loudest thing on the screen.
 */
export const hairline = StyleSheet.hairlineWidth;

export function Eyebrow({ children, color }: { children: React.ReactNode; color?: string }) {
  return <Text style={[st.eyebrow, color ? { color } : null]}>{children}</Text>;
}

type BtnProps = ({ label: string; children?: never } | { label?: never; children: React.ReactNode }) & {
  icon?: React.ReactNode;
  accessibilityLabel?: string;
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
  accessibilityLabel,
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
      accessibilityLabel={accessibilityLabel}
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

export function MonoText({
  children,
  style,
  ...rest
}: TextProps & { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <Text {...rest} style={[{ fontFamily: mono, color: C.ink }, style]}>
      {children}
    </Text>
  );
}

export const fmt = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.floor(n)}`);
export const fmtN = (n: number) => Math.floor(n).toLocaleString();
/** Full-precision money for hero numerals, where "$2.0k" would be a lie about a real balance. */
export const money = (n: number) => `$${Math.floor(n).toLocaleString()}`;

/* ------------------------------------------------------------------ *
 * Screen scaffold
 *
 * Every screen is the same three-part shape:
 *   ScreenTop   the game clock plus this screen's one piece of telemetry
 *   Hero        full-bleed, no box, the loudest thing on the screen
 *   Section*    section headers sit on the midnight ground; only genuine
 *               units (Unit) keep a border.
 * ------------------------------------------------------------------ */

export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView contentContainerStyle={st.screen} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
}

/** The line that replaced the old global status bar: day on the left, one live number on the right. */
export function ScreenTop({
  day,
  right,
  rightLabel,
  rightColor,
}: {
  day: number;
  right?: string;
  rightLabel?: string;
  rightColor?: string;
}) {
  return (
    <View style={st.screenTop}>
      <MonoText style={st.screenTopDay} accessibilityLabel={`Day ${day}`}>
        DAY {day}
      </MonoText>
      {right ? (
        <MonoText
          style={[st.screenTopRight, rightColor ? { color: rightColor } : null]}
          accessibilityLabel={rightLabel ?? right}
        >
          {right}
        </MonoText>
      ) : null}
    </View>
  );
}

let glowSeq = 0;

/**
 * Full-bleed hero band. No border, no card — it earns its place with scale and
 * a single soft wash of the screen's accent colour behind the numerals.
 */
export function Hero({ children, tone = C.gold }: { children: React.ReactNode; tone?: string }) {
  const id = React.useRef(`heroGlow${glowSeq++}`).current;
  return (
    <View style={st.hero}>
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id={id} cx="10%" cy="36%" rx="76%" ry="66%">
            <Stop offset="0" stopColor={tone} stopOpacity={0.15} />
            <Stop offset="0.55" stopColor={tone} stopOpacity={0.045} />
            <Stop offset="1" stopColor={tone} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <SvgRect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
      {children}
    </View>
  );
}

export function HeroNumber({ value, suffix, color = C.gold }: { value: string; suffix?: string; color?: string }) {
  const size = value.length > 9 ? 34 : value.length > 7 ? 42 : value.length > 5 ? 50 : 58;
  return (
    <View style={st.heroNumberRow}>
      <Text style={[st.heroNumber, { fontSize: size, lineHeight: Math.round(size * 1.12), color }]} allowFontScaling={false}>
        {value}
      </Text>
      {suffix ? <MonoText style={st.heroSuffix}>{suffix}</MonoText> : null}
    </View>
  );
}

export function SectionHeader({ title, meta, metaColor }: { title: string; meta?: string; metaColor?: string }) {
  return (
    <View style={st.sectionHeader}>
      <Eyebrow>{title}</Eyebrow>
      {meta ? <MonoText style={[st.sectionMeta, metaColor ? { color: metaColor } : null]}>{meta}</MonoText> : null}
    </View>
  );
}

export function Section({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[st.section, style]}>{children}</View>;
}

/** A genuine unit: something that is one thing. The only shape that still gets a border. */
export function Unit({ children, style, tone }: { children: React.ReactNode; style?: ViewStyle; tone?: string }) {
  return <View style={[st.unit, tone ? { borderColor: tone } : null, style]}>{children}</View>;
}

export function Divider() {
  return <View style={st.divider} />;
}

/**
 * The quit-your-job rail. A meter with a position marker, so progress reads as
 * "how far along the run am I" rather than "how full is this bar".
 */
export function Rail({
  pct,
  tone = C.gold,
  knob = C.mint,
  height = 10,
  accessibilityLabel,
  accessibilityValue,
}: {
  pct: number;
  tone?: string;
  knob?: string;
  height?: number;
  accessibilityLabel?: string;
  accessibilityValue?: { now: number; min: number; max: number };
}) {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <View
      accessible={Boolean(accessibilityLabel)}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={accessibilityValue}
      style={[st.rail, { height, borderRadius: height / 2 }]}
    >
      <View style={[st.railFill, { width: `${p}%`, backgroundColor: tone, borderRadius: height / 2 }]} />
      {p > 0 && p < 100 ? (
        <View style={[st.railKnob, { left: `${p}%`, backgroundColor: knob, height: height + 8, shadowColor: knob }]} />
      ) : null}
    </View>
  );
}

/** Square initial tile — gives shipped apps and chirpers a face without inventing avatars. */
export function Monogram({ label, tone, size = 38 }: { label: string; tone: string; size?: number }) {
  return (
    <View style={[st.monogram, { width: size, height: size, borderRadius: R.tile }]}>
      <MonoText style={{ color: tone, fontSize: size * 0.35, fontWeight: '700', letterSpacing: 0.5 }}>{label}</MonoText>
    </View>
  );
}

/** Deterministic accent per handle, so the same chirper always looks the same. */
const ACCENTS = [C.gold, C.pink, C.mint, C.ink];
export function accentFor(key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return ACCENTS[h % ACCENTS.length];
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
}

const st = StyleSheet.create({
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
  screen: { paddingBottom: 132 },
  screenTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: S.gutter,
    paddingTop: 10,
    paddingBottom: 2,
  },
  screenTopDay: { fontSize: 11, letterSpacing: 1.6, color: C.dim, fontWeight: '600' },
  screenTopRight: { fontSize: 11, letterSpacing: 1.4, color: C.mut },

  hero: {
    paddingHorizontal: S.gutter,
    paddingTop: 14,
    paddingBottom: 22,
    // This one-sided RULE separates the hero from the ground; it encloses no unit.
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
    overflow: 'hidden',
  },
  heroNumberRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 2 },
  heroNumber: { fontWeight: '800', letterSpacing: -1.6 },
  heroSuffix: { color: C.dim, fontSize: 15, marginLeft: 4, marginBottom: 8 },

  section: { paddingHorizontal: S.gutter, marginTop: S.section },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sectionMeta: { fontSize: 11, letterSpacing: 1.2, color: C.dim },

  unit: {
    backgroundColor: C.card,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: R.unit,
    padding: S.row,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.line },

  rail: { backgroundColor: C.card2, justifyContent: 'center' },
  railFill: { height: '100%' },
  railKnob: {
    position: 'absolute',
    width: 5,
    borderRadius: 3,
    marginLeft: -2.5,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },

  monogram: { backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center' },
});
