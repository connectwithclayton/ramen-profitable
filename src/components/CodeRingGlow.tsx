import React, { useEffect, useId, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, StyleSheet } from 'react-native';
import * as Battery from 'expo-battery';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { C } from '../theme';

/** Stay still until both system preferences are known, including when either read fails. */
function useGlowMotion() {
  const [reducedMotion, setReducedMotion] = useState(true);
  const [lowPower, setLowPower] = useState(true);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');

  useEffect(() => {
    let live = true;
    let motionRevision = 0;
    let powerRevision = 0;
    const refresh = () => {
      const motionRead = ++motionRevision;
      const powerRead = ++powerRevision;
      void AccessibilityInfo.isReduceMotionEnabled().then(value => {
        if (live && motionRead === motionRevision) setReducedMotion(value);
      }).catch(() => { if (live && motionRead === motionRevision) setReducedMotion(true); });
      void Battery.isLowPowerModeEnabledAsync().then(value => {
        if (live && powerRead === powerRevision) setLowPower(value);
      }).catch(() => { if (live && powerRead === powerRevision) setLowPower(true); });
    };
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
      motionRevision++;
      setReducedMotion(value);
    });
    const power = Battery.addLowPowerModeListener(({ lowPowerMode }) => {
      powerRevision++;
      setLowPower(lowPowerMode);
    });
    const lifecycle = AppState.addEventListener('change', state => {
      setForeground(state === 'active');
      if (state === 'active') {
        setReducedMotion(true);
        setLowPower(true);
        refresh();
      }
    });
    refresh();
    return () => {
      live = false;
      motion.remove();
      power.remove();
      lifecycle.remove();
    };
  }, []);

  return { foreground, animate: foreground && !reducedMotion && !lowPower };
}

/** An annular light behind the track, never a fill over the counter or code panel. */
export default React.memo(function CodeRingGlow({ size, discovered }: { size: number; discovered: boolean }) {
  const { foreground, animate } = useGlowMotion();
  const phase = useRef(new Animated.Value(0)).current;
  const gradientId = useId();
  const quiet = discovered ? 0.08 : 0.42;
  const bright = discovered ? 0.16 : 1;

  useEffect(() => {
    phase.setValue(0);
    if (!animate) return;
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(phase, {
        toValue: 1, duration: 1900, easing: Easing.inOut(Easing.sin),
        useNativeDriver: true, isInteraction: false,
      }),
      Animated.timing(phase, {
        toValue: 0, duration: 1900, easing: Easing.inOut(Easing.sin),
        useNativeDriver: true, isInteraction: false,
      }),
    ]));
    pulse.start();
    return () => pulse.stop();
  }, [animate, phase]);

  if (!foreground) return null;
  return (
    <Animated.View
      testID="code-ring-glow"
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        st.glow,
        {
          opacity: animate
            ? phase.interpolate({ inputRange: [0, 1], outputRange: [quiet, bright] })
            : discovered ? 0.11 : 0.64,
        },
      ]}
    >
      <Svg width={size + 24} height={size + 24} viewBox="0 0 272 272">
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
            <Stop offset="0.72" stopColor={C.gold} stopOpacity={0} />
            <Stop offset="0.77" stopColor={C.gold} stopOpacity={0.18} />
            <Stop offset="0.81" stopColor={C.gold} stopOpacity={0.5} />
            <Stop offset="0.86" stopColor={C.gold} stopOpacity={0.32} />
            <Stop offset="1" stopColor={C.gold} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={272} height={272} fill={`url(#${gradientId})`} />
      </Svg>
    </Animated.View>
  );
});

const st = StyleSheet.create({
  glow: { position: 'absolute', top: -12, left: -12 },
});
