import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ACHIEVEMENTS,
  APP_IDEAS,
  BETA_TESTER,
  CHIRPERS,
  DARK_EVENTS,
  EVENTS,
  MRR_GOAL,
  PAYWALL_AXES,
  PLAYER,
  REJECTIONS,
  SHOP,
} from '../content/content';
import type { IconName } from '../components/icons';
import { pickAppIdea } from './projectIdeas';
import {
  advanceHomeReactionExposure,
  calculatePaywallTransaction,
  emptyPendingOwnerBonus,
  offlineEarningsTransition,
  paywallReaction,
  parsePendingOwnerBonus,
  priorityHomeReactionState,
  resolveGameEvent,
  selectPersistedState,
  settlePendingOwnerBonus,
  tapReactionKind,
} from './experience';
import type {
  DurableHomeReceiptKind,
  MrrDelta,
  PendingOwnerBonus,
  PaywallTransaction,
  PriorityHomeReactionKind,
} from './experience';

export type Project = {
  name: string;
  idea: string;
  loc: number;
  need: number;
  manualTaps: number;
  depletionReactionDelivered: boolean;
};
export type ShippedApp = {
  id: string;
  name: string;
  idea: string;
  live: boolean;
  baseMrr: number;
  mult: number; // paywall conversion multiplier
  dark: number; // dark-pattern heat
  hasPaywall: boolean;
};
export type StoryKind = PriorityHomeReactionKind;
export type Chirp = {
  id: string;
  who: string;
  handle: string;
  text: string;
  likes: number;
  liked?: boolean;
  kind?: StoryKind;
  event?: string;
  delta?: MrrDelta;
};
export type HomePriority = Chirp & { kind: PriorityHomeReactionKind };
export type HomeReceipt = Chirp & { kind: DurableHomeReceiptKind };
type ChirpOptions = Omit<Partial<Chirp>, 'id' | 'who' | 'handle' | 'text' | 'likes' | 'liked'> & {
  author?: readonly [string, string];
};
export type Notif = { id: string; text: string; icon?: IconName; emoji?: string };
export type Overlay =
  | { type: 'review'; appName: string }
  | { type: 'verdict'; ok: boolean; appName: string; rule?: string; flavor?: string; gain?: number }
  | { type: 'paywall' }
  | { type: 'paywallDesigner'; appId: string }
  | { type: 'paywallResult'; appId: string; transaction: PaywallTransaction }
  | { type: 'win' }
  | null;

export type GameState = {
  day: number;
  dayTick: number;
  cash: number;
  mrr: number;
  energy: number;
  energyMax: number;
  energyRegen: number; // per fast tick (500ms)
  tapPower: number;
  autoCode: number; // LOC per second
  hasJob: boolean;
  salary: number;
  mrrMult: number;
  rejectShield: number; // 1 = none, 0.5 = halved rejection odds
  project: Project | null;
  apps: ShippedApp[];
  upgrades: Record<string, boolean>;
  chirps: Chirp[];
  unreadChirps: boolean;
  notifs: Notif[];
  overlay: Overlay;
  goIndieActive: boolean;
  goIndieResolved: boolean;
  won: boolean;
  achievements: Record<string, boolean>;
  lastSeen: number; // epoch ms; identity for base offline credit and pending owner bonus
  pendingOwnerBonus: PendingOwnerBonus;
  homePriority?: HomePriority;
  homePrioritySecondsLeft: number;
  homeReceipt?: HomeReceipt;
  homeReceiptSecondsLeft: number;
};

type Actions = {
  tapCode: () => boolean;
  newProject: () => void;
  submitToReview: () => void;
  resolveReview: () => void;
  dismissOverlay: () => void;
  openGoIndiePaywall: () => void;
  setGoIndieActive: (active: boolean) => void;
  buy: (id: string) => void;
  quitJob: () => void;
  fastTick: () => void;
  slowTick: () => void;
  recordHomeReactionExposure: (reactionId: string, elapsedSeconds: number) => void;
  maybeEvent: () => void;
  pushNotif: (text: string, icon?: IconName, emoji?: string) => void;
  expireNotif: (id: string) => void;
  pushChirp: (text: string, options?: ChirpOptions) => void;
  markChirpsRead: () => void;
  toggleChirpLike: (id: string) => void;
  openPaywallDesigner: (appId: string) => void;
  applyPaywall: (appId: string, picks: Record<string, string>) => void;
  unlock: (id: string) => void;
  applyOfflineEarnings: () => number;
  touchLastSeen: () => void;
};

const uid = () => Math.random().toString(36).slice(2, 10);
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

const initial: GameState = {
  day: 1,
  dayTick: 0,
  cash: 120,
  mrr: 0,
  energy: 50,
  energyMax: 50,
  energyRegen: 0.06,
  tapPower: 3,
  autoCode: 0,
  hasJob: true,
  salary: 80,
  mrrMult: 1,
  rejectShield: 1,
  project: null,
  apps: [],
  upgrades: {},
  chirps: [],
  unreadChirps: false,
  notifs: [],
  overlay: null,
  goIndieActive: false,
  goIndieResolved: false,
  won: false,
  achievements: {},
  lastSeen: Date.now(),
  pendingOwnerBonus: emptyPendingOwnerBonus(),
  homePriority: undefined,
  homePrioritySecondsLeft: 0,
  homeReceipt: undefined,
  homeReceiptSecondsLeft: 0,
};

export const useGame = create<GameState & Actions>()(
  persist(
    (set, get) => ({
      ...initial,

      pushNotif: (text, icon, emoji) => {
        const n = { id: uid(), text, icon, emoji };
        set(s => ({ notifs: [...s.notifs.slice(-2), n] }));
      },
      expireNotif: id => set(s => ({ notifs: s.notifs.filter(n => n.id !== id) })),

      pushChirp: (text, options) => {
        const [who, handle] = options?.author ?? pick(CHIRPERS);
        const { author: _author, ...metadata } = options ?? {};
        const c: Chirp = {
          id: uid(),
          who,
          handle,
          text,
          likes: Math.floor(Math.random() * 900) + 12,
          ...metadata,
        };
        const homeReactionState = priorityHomeReactionState(c, BETA_TESTER);
        set(s => ({
          chirps: [c, ...s.chirps].slice(0, 30),
          unreadChirps: true,
          ...(homeReactionState ?? {}),
        }));
      },
      markChirpsRead: () => set({ unreadChirps: false }),
      toggleChirpLike: id =>
        set(s => ({
          chirps: s.chirps.map(c =>
            c.id === id ? { ...c, liked: !c.liked } : c,
          ),
        })),

      newProject: () => {
        const s = get();
        const usedNames = new Set([
          ...s.apps.map(app => app.name),
          ...(s.project ? [s.project.name] : []),
        ]);
        const [name, idea] = pickAppIdea(APP_IDEAS, usedNames);
        const project: Project = {
          name,
          idea,
          loc: 0,
          need: 250 + Math.floor(Math.random() * 250),
          manualTaps: 0,
          depletionReactionDelivered: false,
        };
        set({ project });
        get().pushChirp(`day 1 of building ${name} — ${idea}. who's in? #buildinpublic`, {
          author: PLAYER,
        });
        get().pushChirp(`does ${name} have dark mode? haven't opened it yet.`, {
          author: BETA_TESTER,
          kind: 'milestone',
          event: 'FIRST BETA REPLY',
        });
      },

      tapCode: () => {
        const s = get();
        if (!s.project || s.project.loc >= s.project.need) return false;
        if (s.energy < 1) {
          s.pushNotif('Out of energy. Coffee exists for a reason.', 'energy');
          return false;
        }
        const nextLoc = s.project.loc + s.tapPower;
        const nextEnergy = s.energy - 1;
        const manualTaps = (s.project.manualTaps ?? 0) + 1;
        const depletionReactionDelivered = s.project.depletionReactionDelivered ?? false;
        const reactionKind = tapReactionKind(
          manualTaps,
          nextEnergy < 1 && nextLoc < s.project.need && s.autoCode <= 0,
          depletionReactionDelivered,
        );
        set({
          energy: nextEnergy,
          project: {
            ...s.project,
            loc: nextLoc,
            manualTaps,
            depletionReactionDelivered:
              depletionReactionDelivered || reactionKind === 'energy-depleted',
          },
        });
        if (reactionKind === 'ten-taps') {
          get().pushChirp(`${Math.floor(nextLoc)} lines in and the launch thread is already longer than the app.`, {
            author: BETA_TESTER,
            kind: 'milestone',
            event: 'TEN TAPS',
          });
        }
        // This beat lands in the real regeneration wait and yields to the required ten-tap response.
        if (reactionKind === 'energy-depleted') {
          get().pushChirp('Have you tried delegating? My cat is between roles.', {
            author: BETA_TESTER,
            kind: 'milestone',
            event: 'ENERGY DEPLETED',
          });
        }
        return true;
      },

      submitToReview: () => {
        const p = get().project;
        if (!p || p.loc < p.need) return;
        set({ overlay: { type: 'review', appName: p.name } });
      },

      resolveReview: () => {
        const s = get();
        const p = s.project;
        if (!p) return;
        const rejected = Math.random() < 0.28 * s.rejectShield;
        if (rejected) {
          const [rule, flavor] = pick(REJECTIONS);
          set({
            apps: [...s.apps, { id: uid(), name: p.name, idea: p.idea, live: false, baseMrr: 0, mult: 1, dark: 0, hasPaywall: false }],
            project: null,
            overlay: { type: 'verdict', ok: false, appName: p.name, rule, flavor },
          });
          s.pushChirp(`App Review rejected ${p.name}. ${rule}. i'm fine. this is fine.`, {
            author: PLAYER,
          });
          s.unlock('first_reject');
        } else {
          const base = 40 + Math.floor(Math.random() * 160);
          const gain = base * s.mrrMult;
          const delta: MrrDelta = { before: s.mrr, after: s.mrr + gain };
          set({
            apps: [...s.apps, { id: uid(), name: p.name, idea: p.idea, live: true, baseMrr: base, mult: 1, dark: 0, hasPaywall: false }],
            mrr: s.mrr + gain,
            project: null,
            overlay: { type: 'verdict', ok: true, appName: p.name, gain },
          });
          s.pushChirp(`${p.name} just went live on the App Store!! ${base > 150 ? 'the numbers are actually good??' : 'it begins.'} #shipaton`, {
            author: PLAYER,
          });
          get().pushChirp(`${p.name} is live. congratulations. feature request: dark mode.`, {
            author: BETA_TESTER,
            kind: 'verdict',
            event: 'BETA TESTER · APPROVED',
            delta,
          });
          s.unlock('first_ship');
          if (get().apps.filter(a => a.live).length >= 3) s.unlock('portfolio');
        }
      },

      dismissOverlay: () => set({ overlay: null }),

      openGoIndiePaywall: () => set({ overlay: { type: 'paywall' } }),

      setGoIndieActive: active => {
        set(state => {
          const settlement = settlePendingOwnerBonus(state.pendingOwnerBonus, active);
          return {
            cash: state.cash + settlement.earned,
            goIndieActive: active,
            goIndieResolved: true,
            pendingOwnerBonus: settlement.pendingOwnerBonus,
          };
        });
      },

      buy: id => {
        const s = get();
        const item = SHOP.find(i => i.id === id);
        if (!item || s.upgrades[id] || s.cash < item.cost) return;
        const applied = item.apply(s);
        set({
          cash: s.cash - item.cost,
          upgrades: { ...s.upgrades, [id]: true },
          ...applied,
        });
        s.pushNotif(`${item.name} acquired.`, 'store');
        // The committed-rate purchase beat carries the automation joke; progress telemetry alone does not.
        if (id === 'claude') {
          const rate = typeof applied.autoCode === 'number' ? applied.autoCode : s.autoCode;
          get().pushChirp(`${rate} LOC/sec. You have been promoted to code reviewer.`, {
            author: BETA_TESTER,
            kind: 'purchase',
            event: 'AUTOMATION PURCHASED',
          });
        }
      },

      quitJob: () => {
        const s = get();
        if (s.mrr < MRR_GOAL) return;
        set({ hasJob: false, won: true, overlay: { type: 'win' } });
        s.pushChirp(`i just quit my job. MRR $${Math.floor(s.mrr)}. hands are shaking. #indiehacker #shipaton`, {
          author: PLAYER,
        });
        s.unlock('ramen');
      },

      fastTick: () => {
        const s = get();
        const next: Partial<GameState> = {
          energy: Math.min(s.energyMax, s.energy + s.energyRegen),
        };
        if (s.project && s.project.loc < s.project.need && s.autoCode > 0) {
          next.project = { ...s.project, loc: s.project.loc + s.autoCode / 2 };
        }
        set(next);
      },

      slowTick: () => {
        const s = get();
        const next: Partial<GameState> = {
          cash: s.cash + s.mrr / 120,
          dayTick: s.dayTick + 1,
        };
        if (s.dayTick + 1 >= 6) {
          next.dayTick = 0;
          next.day = s.day + 1;
          if (s.hasJob) {
            next.cash = (next.cash as number) + s.salary;
            s.pushNotif(`Payday. +$${s.salary} for 8 hours of meetings that could've been Slack messages.`, 'day-job');
          }
        }
        set(next);
        if (s.mrr >= 100) s.unlock('mrr_100');
        if (s.mrr >= 1000) s.unlock('mrr_1000');
      },

      recordHomeReactionExposure: (reactionId, elapsedSeconds) => {
        const s = get();
        const next = advanceHomeReactionExposure({
          priority: s.homePriority,
          prioritySecondsLeft: s.homePrioritySecondsLeft,
          receipt: s.homeReceipt,
          receiptSecondsLeft: s.homeReceiptSecondsLeft,
          displayedReactionId: reactionId,
          elapsedSeconds,
        });
        if (
          next.homePriority === s.homePriority &&
          next.homePrioritySecondsLeft === s.homePrioritySecondsLeft &&
          next.homeReceipt === s.homeReceipt &&
          next.homeReceiptSecondsLeft === s.homeReceiptSecondsLeft
        ) return;
        set(next);
      },

      maybeEvent: () => {
        const s = get();
        if (!s.apps.some(a => a.live)) return;
        if (Math.random() >= 0.5) return;
        const totalDark = s.apps.filter(a => a.live).reduce((n, a) => n + (a.dark ?? 0), 0);
        const useDark = totalDark >= 3 && Math.random() < 0.35;
        const ev = useDark ? pick(DARK_EVENTS) : pick(EVENTS);
        const outcome = resolveGameEvent(ev, s);
        if (!outcome) return;
        set(outcome.patch);
        s.pushNotif(outcome.text, ev.icon);
        if (Math.random() < 0.4) {
          s.pushChirp(outcome.chirpText);
        }
      },


      openPaywallDesigner: appId => {
        const s = get();
        const app = s.apps.find(a => a.id === appId);
        if (!app || !app.live) return;
        if (app.hasPaywall) {
          if (s.cash < 75) {
            s.pushNotif('A/B tests cost $75. Science is not free.', 'abTest');
            return;
          }
          set({ cash: s.cash - 75 });
        }
        set({ overlay: { type: 'paywallDesigner', appId } });
      },

      applyPaywall: (appId, picks) => {
        const s = get();
        const app = s.apps.find(a => a.id === appId);
        if (!app) return;
        const transaction = calculatePaywallTransaction({
          totalMrr: s.mrr,
          mrrMult: s.mrrMult,
          baseMrr: app.baseMrr,
          previousMult: app.mult ?? 1,
          picks,
          axes: PAYWALL_AXES,
        });
        const { mult, dark } = transaction;
        set({
          apps: s.apps.map(a => (a.id === appId ? { ...a, mult, dark, hasPaywall: true } : a)),
          mrr: transaction.delta.after,
          overlay: { type: 'paywallResult', appId, transaction },
        });
        s.unlock('paywall_first');
        if (dark >= 5) {
          s.unlock('dark_side');
        } else if (dark === 0) {
          s.unlock('saint');
        }
        get().pushChirp(paywallReaction(app.name, transaction, picks), {
          author: BETA_TESTER,
          kind: 'paywall',
          event: `PAYWALL SHIPPED · HEAT ${dark}`,
          delta: transaction.delta,
        });
      },

      unlock: id => {
        const s = get();
        if (s.achievements[id]) return;
        const a = ACHIEVEMENTS.find(x => x.id === id);
        if (!a) return;
        set({ achievements: { ...s.achievements, [id]: true } });
        s.pushNotif('Achievement: ' + a.name, a.drawnIcon ? 'achievement' : undefined, a.drawnIcon ? undefined : a.icon);
      },

      applyOfflineEarnings: () => {
        const now = Date.now();
        let earned = 0;
        set(s => {
          const transition = offlineEarningsTransition({
            mrr: s.mrr,
            from: s.lastSeen,
            until: now,
            ownership: s.goIndieResolved ? s.goIndieActive : null,
            rememberedOwner: s.goIndieActive,
            pendingOwnerBonus: s.pendingOwnerBonus,
          });
          earned = transition.earned;
          return {
            cash: s.cash + earned,
            lastSeen: now,
            pendingOwnerBonus: transition.pendingOwnerBonus,
          };
        });
        return earned;
      },
      touchLastSeen: () => set({ lastSeen: Date.now() }),
    }),
    {
      name: 'ramen-profitable-v1',
      version: 5,
      migrate: (persisted: any) => {
        const migrated = selectPersistedState(persisted, BETA_TESTER);
        if (migrated?.apps) {
          migrated.apps = migrated.apps.map((a: any) => ({ mult: 1, dark: 0, hasPaywall: false, ...a }));
        }
        migrated.achievements = migrated.achievements ?? {};
        migrated.goIndieActive = migrated.goIndieActive ?? false;
        migrated.pendingOwnerBonus = parsePendingOwnerBonus(migrated.pendingOwnerBonus);
        if (migrated.project) {
          migrated.project = {
            ...migrated.project,
            manualTaps: migrated.project.manualTaps ?? 0,
            depletionReactionDelivered: migrated.project.depletionReactionDelivered ?? false,
          };
        }
        return migrated;
      },
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persisted, current) => ({
        ...current,
        ...selectPersistedState(persisted, BETA_TESTER),
      }),
      partialize: s => selectPersistedState(s, BETA_TESTER),
    }
  )
);

export { MRR_GOAL };
