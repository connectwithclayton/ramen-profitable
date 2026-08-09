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
  | 'abTest'
  | 'survivor-4-3'
  | 'beer-money'
  | 'ramen-profitable'
  | 'dark-side'
  | 'ethically-sourced'
  | 'portfolio-guy'
  | 'achievement'
  | 'night'
  | 'day-job'
  | 'verdict'
  | 'celebrate'
  | 'idea'
  | 'launch'
  | 'caffeine'
  | 'app-store'
  | 'trending'
  | 'press'
  | 'thread'
  | 'like'
  | 'like-filled';

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

export function Survivor43Icon(props: IconProps) {
  return (
    <IconFrame {...props}>
      {({ color }) => (
        <>
          <Path d="M6 20V10.5a6 6 0 0 1 12 0V20" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M3.5 20h17" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M9.6 12.5h4.8" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </IconFrame>
  );
}

export function BeerMoneyIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      {({ color }) => (
        <>
          <Path d="M12 21v-7.5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M12 13.5c0-3.4 2.4-5.6 5.6-5.6 0 3.4-2.4 5.6-5.6 5.6z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M12 16c0-2.7-1.9-4.5-4.5-4.5 0 2.7 1.9 4.5 4.5 4.5z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </IconFrame>
  );
}

export function RamenProfitableIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      {({ color }) => (
        <>
          <Path d="M3 12.5h18" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M4.6 14.5a7.4 7.4 0 0 0 14.8 0" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M13.5 3.2L9.8 10.4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M17 4.6l-3.6 7.1" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </IconFrame>
  );
}

export function DarkSideIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      {({ color }) => (
        <>
          <Path d="M12 20.5a6.8 6.8 0 1 0 0-13.6 6.8 6.8 0 0 0 0 13.6z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M7.2 8.6L4.6 3.6l4.6 2.2" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M16.8 8.6l2.6-5-4.6 2.2" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </IconFrame>
  );
}

export function EthicallySourcedIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      {({ color }) => (
        <>
          <Path d="M12 21a6.6 6.6 0 1 0 0-13.2A6.6 6.6 0 0 0 12 21z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M12 6.4c2.9 0 5.2-.8 5.2-1.9S14.9 2.6 12 2.6s-5.2.8-5.2 1.9S9.1 6.4 12 6.4z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </IconFrame>
  );
}

export function PortfolioGuyIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      {({ color }) => (
        <>
          <Path d="M5.5 8.5h13a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M6 5.5h12" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M8 2.8h8" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </IconFrame>
  );
}

export function AchievementIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      {({ color }) => (
        <>
          <Path d="M7.5 3h9v5.2a4.5 4.5 0 0 1-9 0V3z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M7.5 4.8H5a2.4 2.4 0 0 0 2.9 3.6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M16.5 4.8H19a2.4 2.4 0 0 1-2.9 3.6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M12 12.7V17" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M8.5 20.5h7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M9.6 17h4.8l.8 3.5H8.8l.8-3.5z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </IconFrame>
  );
}

export function NightIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      {({ color }) => <Path d="M20.2 14.8A8.6 8.6 0 0 1 9.2 3.8a8.6 8.6 0 1 0 11 11z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
    </IconFrame>
  );
}

export function DayJobIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      {({ color }) => (
        <>
          <Path d="M4.5 7h15a2 2 0 0 1 2 2v9.5a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M9 7V5.4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2V7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M2.5 13h19" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M10.6 13h2.8" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </IconFrame>
  );
}

export function VerdictIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      {({ color }) => (
        <>
          <Path d="M4.5 5h15a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M3.2 7.2L12 13.6l8.8-6.4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </IconFrame>
  );
}

export function CelebrateIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      {({ color }) => (
        <>
          <Path d="M10.4 2.6c1 4.3 2.9 6.2 7.2 7.2-4.3 1-6.2 2.9-7.2 7.2-1-4.3-2.9-6.2-7.2-7.2 4.3-1 6.2-2.9 7.2-7.2z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M18.2 14.2c.4 2 1.3 2.9 3.3 3.3-2 .4-2.9 1.3-3.3 3.3-.4-2-1.3-2.9-3.3-3.3 2-.4 2.9-1.3 3.3-3.3z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </IconFrame>
  );
}

export function IdeaIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      {({ color }) => (
        <>
          <Path d="M12 2.8a6.2 6.2 0 0 0-3.6 11.3v2.4h7.2v-2.4A6.2 6.2 0 0 0 12 2.8z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M9.2 19h5.6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M10.4 21.5h3.2" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </IconFrame>
  );
}

export function LaunchIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      {({ color }) => (
        <>
          <Path d="M12 2.4c3 2.8 4.6 6.3 4.6 9.9l-1.7 4.3H9.1L7.4 12.3C7.4 8.7 9 5.2 12 2.4z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M9.3 13.6L6.2 16.8l1.6 1.1" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M14.7 13.6l3.1 3.2-1.6 1.1" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M12 8.2a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 0 0 0-3.8z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </IconFrame>
  );
}

export function CaffeineIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      {({ color }) => (
        <>
          <Path d="M3.5 9h12v5.6a4.6 4.6 0 0 1-4.6 4.6H8.1a4.6 4.6 0 0 1-4.6-4.6V9z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M15.5 10.8h1.7a2.7 2.7 0 0 1 0 5.4h-1.7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M7.4 6V3.4M11.4 6V2.8" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </IconFrame>
  );
}

export function AppStoreIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      {({ color }) => (
        <>
          <Path d="M5.5 2.8h8a3 3 0 0 1 3 3v6.4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M2.5 5.8v8a3 3 0 0 0 3 3H12" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M15.6 11.4a4.8 4.8 0 1 0 0 9.6 4.8 4.8 0 0 0 0-9.6z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M19.2 19.6l2.3 2.3" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </IconFrame>
  );
}

export function TrendingIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      {({ color }) => <Path d="M13.2 2.5c.5 4.4-3.9 6.4-3.9 10.7 0 1.4-1 1.9-1.7 1.2-.6-.6-.8-1.5-.8-2.4-1.6 1.7-2.4 3.6-2.4 5.6 0 2.2 2.9 3.9 7.6 3.9s7.6-1.7 7.6-3.9c0-5.2-4.6-7.6-6.4-15.1z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
    </IconFrame>
  );
}

export function PressIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      {({ color }) => (
        <>
          <Path d="M4.5 4h11a2 2 0 0 1 2 2v14H4.5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M17.5 8.5h2a2 2 0 0 1 2 2V18a2 2 0 0 1-4 0" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M6 8h8M6 11.5h8M6 15h5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </IconFrame>
  );
}

export function ThreadIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      {({ color }) => (
        <>
          <Path d="M5.5 3.4a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M5.5 16.4a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M5.5 8.6v7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M10.5 5.5h10M10.5 18.5h6.5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </IconFrame>
  );
}

export function LikeIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      {({ color }) => <Path d="M12 20.4L4.8 13.2a4.6 4.6 0 1 1 7.2-5.7 4.6 4.6 0 1 1 7.2 5.7L12 20.4z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
    </IconFrame>
  );
}

export function LikeFilledIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      {({ color }) => <Path d="M12 20.4L4.8 13.2a4.6 4.6 0 1 1 7.2-5.7 4.6 4.6 0 1 1 7.2 5.7L12 20.4z" fill={color} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
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
  'survivor-4-3': Survivor43Icon,
  'beer-money': BeerMoneyIcon,
  'ramen-profitable': RamenProfitableIcon,
  'dark-side': DarkSideIcon,
  'ethically-sourced': EthicallySourcedIcon,
  'portfolio-guy': PortfolioGuyIcon,
  achievement: AchievementIcon,
  night: NightIcon,
  'day-job': DayJobIcon,
  verdict: VerdictIcon,
  celebrate: CelebrateIcon,
  idea: IdeaIcon,
  launch: LaunchIcon,
  caffeine: CaffeineIcon,
  'app-store': AppStoreIcon,
  trending: TrendingIcon,
  press: PressIcon,
  thread: ThreadIcon,
  like: LikeIcon,
  'like-filled': LikeFilledIcon,
};

export function DrawnIcon({ name, ...props }: IconProps & { name: IconName }) {
  const Component = ICONS[name];
  return <Component {...props} />;
}
