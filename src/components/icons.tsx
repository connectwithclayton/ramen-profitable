import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { C } from '../theme';

export type IconProps = {
  size?: number;
  color?: string;
  active?: boolean;
};

export type IconName =
  | 'home'
  | 'code'
  | 'store'
  | 'chirp'
  | 'energy'
  | 'goal'
  | 'ship'
  | 'paywall'
  | 'growth'
  | 'churn'
  | 'cash'
  | 'abTest';

type DrawingProps = { color: string };

function IconFrame({ children, size = 24, color = C.mut, active = false }: IconProps & { children: (props: DrawingProps) => React.ReactNode }) {
  const stroke = active ? C.gold : color;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible={false}>
      {children({ color: stroke })}
    </Svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      {({ color }) => (
        <>
          <Path d="M3 10.5h18" stroke={color} strokeWidth={2} strokeLinecap="round" />
          <Path d="M4.6 12.5a7.4 7.4 0 0 0 14.8 0" stroke={color} strokeWidth={2} strokeLinecap="round" />
          <Path d="M9 7V4.5M12 7V3.5M15 7V5" stroke={color} strokeWidth={2} strokeLinecap="round" />
        </>
      )}
    </IconFrame>
  );
}

export function CodeIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      {({ color }) => <Path d="M9 7l-5 5 5 5M15 7l5 5-5 5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
    </IconFrame>
  );
}

export function StoreIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      {({ color }) => (
        <>
          <Path d="M5 8h14l-1.2 11.5H6.2L5 8z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M9 8V6.2a3 3 0 0 1 6 0V8" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </IconFrame>
  );
}

export function ChirpIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      {({ color }) => (
        <>
          <Rect x={3.5} y={5} width={17} height={12} rx={3.5} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M8.5 17v3.2l4.2-3.2" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </IconFrame>
  );
}

export function EnergyIcon({ color = C.mint, ...props }: IconProps) {
  return (
    <IconFrame color={color} {...props}>
      {({ color }) => <Path d="M13 3l-7 10h5l-1 8 7-10h-5l1-8z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
    </IconFrame>
  );
}

export function GoalIcon({ color = C.gold, ...props }: IconProps) {
  return (
    <IconFrame color={color} {...props}>
      {({ color }) => (
        <>
          <Circle cx={12} cy={12} r={8.5} stroke={color} strokeWidth={2} />
          <Circle cx={12} cy={12} r={4} stroke={color} strokeWidth={2} />
          <Circle cx={12} cy={12} r={1} fill={color} stroke={color} strokeWidth={2} />
        </>
      )}
    </IconFrame>
  );
}

export function ShipIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      {({ color }) => (
        <>
          <Path d="M12 3.5l7 4v9l-7 4-7-4v-9l7-4z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M12 12v8.5M5 7.5l7 4 7-4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </IconFrame>
  );
}

export function PaywallIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      {({ color }) => (
        <>
          <Rect x={3.5} y={5} width={17} height={5} rx={1.5} stroke={color} strokeWidth={2} strokeLinecap="round" />
          <Rect x={3.5} y={14} width={17} height={5} rx={1.5} stroke={color} strokeWidth={2} strokeLinecap="round" />
          <Path d="M12 10v4" stroke={color} strokeWidth={2} strokeLinecap="round" />
        </>
      )}
    </IconFrame>
  );
}

export function GrowthIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      {({ color }) => (
        <>
          <Path d="M4 18l5-6 4 3.5 6.5-8" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M15 7.5h5v5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </IconFrame>
  );
}

export function ChurnIcon({ color = C.pink, ...props }: IconProps) {
  return (
    <IconFrame color={color} {...props}>
      {({ color }) => (
        <>
          <Path d="M4 18l5 -6 4 3.5 6.5 -8" transform="scale(1,-1) translate(0,-24)" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M15 16.5h5v-5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </IconFrame>
  );
}

export function CashIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      {({ color }) => (
        <>
          <Circle cx={12} cy={12} r={8.5} stroke={color} strokeWidth={2} />
          <Path d="M12 7.5v9M14.5 9.5h-4a1.8 1.8 0 0 0 0 3.6h3a1.8 1.8 0 0 1 0 3.6h-4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </IconFrame>
  );
}

export function AbTestIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      {({ color }) => <Path d="M9.5 3.5h5M12 3.5v5.5L18 19a1.6 1.6 0 0 1-1.4 2.4H7.4A1.6 1.6 0 0 1 6 19l6-10V3.5z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
    </IconFrame>
  );
}

const ICONS: Record<IconName, React.ComponentType<IconProps>> = {
  home: HomeIcon,
  code: CodeIcon,
  store: StoreIcon,
  chirp: ChirpIcon,
  energy: EnergyIcon,
  goal: GoalIcon,
  ship: ShipIcon,
  paywall: PaywallIcon,
  growth: GrowthIcon,
  churn: ChurnIcon,
  cash: CashIcon,
  abTest: AbTestIcon,
};

export function DrawnIcon({ name, ...props }: IconProps & { name: IconName }) {
  const Component = ICONS[name];
  return <Component {...props} />;
}
