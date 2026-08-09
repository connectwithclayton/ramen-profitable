import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_IDEAS, REJECTIONS, EVENTS, DARK_EVENTS, SHOP, CHIRPERS, MRR_GOAL, PAYWALL_AXES, ACHIEVEMENTS } from '../content/content';
import type { IconName } from '../components/icons';

export type Project = { name: string; idea: string; loc: number; need: number };
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
export type Chirp = { id: string; who: string; handle: string; text: string; likes: number; liked?: boolean };
export type Notif = { id: string; text: string; icon?: IconName; emoji?: string };
export type Overlay =
  | { type: 'review'; appName: string }
  | { type: 'verdict'; ok: boolean; appName: string; rule?: string; flavor?: string; gain?: number }
  | { type: 'paywall' }
  | { type: 'paywallDesigner'; appId: string }
  | { type: 'paywallResult'; appId: string; mult: number; dark: number }
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
  paywallShown: boolean;
  won: boolean;
  achievements: Record<string, boolean>;
  lastSeen: number; // epoch ms, for offline earnings
};

type Actions = {
  tapCode: () => boolean;
  newProject: () => void;
  submitToReview: () => void;
  resolveReview: () => void;
  dismissOverlay: () => void;
  showPaywallIfFirstLaunch: () => void;
  buy: (id: string) => void;
  quitJob: () => void;
  fastTick: () => void;
  slowTick: () => void;
  maybeEvent: () => void;
  pushNotif: (text: string, icon?: IconName, emoji?: string) => void;
  expireNotif: (id: string) => void;
  pushChirp: (text: string) => void;
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
  paywallShown: false,
  won: false,
  achievements: {},
  lastSeen: Date.now(),
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

      pushChirp: text => {
        const [who, handle] = pick(CHIRPERS);
        const c: Chirp = { id: uid(), who, handle, text, likes: Math.floor(Math.random() * 900) + 12 };
        set(s => ({ chirps: [c, ...s.chirps].slice(0, 30), unreadChirps: true }));
      },
      markChirpsRead: () => set({ unreadChirps: false }),
      toggleChirpLike: id =>
        set(s => ({
          chirps: s.chirps.map(c =>
            c.id === id ? { ...c, liked: !c.liked, likes: Math.max(0, c.likes + (c.liked ? -1 : 1)) } : c,
          ),
        })),

      newProject: () => {
        const [name, idea] = pick(APP_IDEAS);
        set({ project: { name, idea, loc: 0, need: 250 + Math.floor(Math.random() * 250) } });
        get().pushChirp(`day 1 of building ${name} — ${idea}. who's in? #buildinpublic`);
      },

      tapCode: () => {
        const s = get();
        if (!s.project) return false;
        if (s.energy < 1) {
          s.pushNotif('Out of energy. Coffee exists for a reason.', 'energy');
          return false;
        }
        set({
          energy: s.energy - 1,
          project: { ...s.project, loc: s.project.loc + s.tapPower },
        });
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
          s.pushChirp(`App Review rejected ${p.name}. ${rule}. i'm fine. this is fine.`);
          s.unlock('first_reject');
        } else {
          const base = 40 + Math.floor(Math.random() * 160);
          const gain = base * s.mrrMult;
          set({
            apps: [...s.apps, { id: uid(), name: p.name, idea: p.idea, live: true, baseMrr: base, mult: 1, dark: 0, hasPaywall: false }],
            mrr: s.mrr + gain,
            project: null,
            overlay: { type: 'verdict', ok: true, appName: p.name, gain },
          });
          s.pushChirp(`${p.name} just went live on the App Store!! ${base > 150 ? 'the numbers are actually good??' : 'it begins.'} #shipaton`);
          s.unlock('first_ship');
          if (get().apps.filter(a => a.live).length >= 3) s.unlock('portfolio');
        }
      },

      dismissOverlay: () => set({ overlay: null }),

      showPaywallIfFirstLaunch: () => {
        const s = get();
        if (!s.paywallShown && s.apps.some(a => a.live)) {
          set({ paywallShown: true, overlay: { type: 'paywall' } });
        } else {
          set({ overlay: null });
        }
      },

      buy: id => {
        const s = get();
        const item = SHOP.find(i => i.id === id);
        if (!item || s.upgrades[id] || s.cash < item.cost) return;
        set({
          cash: s.cash - item.cost,
          upgrades: { ...s.upgrades, [id]: true },
          ...item.apply(s),
        });
        s.pushNotif(`${item.name} acquired.`, 'store');
      },

      quitJob: () => {
        const s = get();
        if (s.mrr < MRR_GOAL) return;
        set({ hasJob: false, won: true, overlay: { type: 'win' } });
        s.pushChirp(`i just quit my job. MRR $${Math.floor(s.mrr)}. hands are shaking. #indiehacker #shipaton`);
        s.unlock('ramen');
      },

      fastTick: () => {
        const s = get();
        const next: Partial<GameState> = {
          energy: Math.min(s.energyMax, s.energy + s.energyRegen),
        };
        if (s.project && s.autoCode > 0) {
          next.project = { ...s.project, loc: s.project.loc + s.autoCode / 2 };
        }
        set(next);
      },

      slowTick: () => {
        const s = get();
        const next: Partial<GameState> = { cash: s.cash + s.mrr / 120, dayTick: s.dayTick + 1 };
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

      maybeEvent: () => {
        const s = get();
        if (!s.apps.some(a => a.live)) return;
        if (Math.random() >= 0.5) return;
        const totalDark = s.apps.filter(a => a.live).reduce((n, a) => n + (a.dark ?? 0), 0);
        const useDark = totalDark >= 3 && Math.random() < 0.35;
        const ev = useDark ? pick(DARK_EVENTS) : pick(EVENTS);
        set(ev.apply(s));
        s.pushNotif(ev.text, ev.icon);
        if (Math.random() < 0.4) s.pushChirp(ev.chirpText ?? ev.text);
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
        let mult = 1;
        let dark = 0;
        for (const axis of PAYWALL_AXES) {
          const choice = axis.choices.find(c => c.id === picks[axis.id]);
          if (choice) {
            mult *= choice.mult;
            dark += choice.dark;
          }
        }
        mult = Math.round(mult * 100) / 100;
        const oldContribution = app.baseMrr * (app.mult ?? 1) * s.mrrMult;
        const newContribution = app.baseMrr * mult * s.mrrMult;
        set({
          apps: s.apps.map(a => (a.id === appId ? { ...a, mult, dark, hasPaywall: true } : a)),
          mrr: Math.max(0, s.mrr - oldContribution + newContribution),
          overlay: { type: 'paywallResult', appId, mult, dark },
        });
        s.unlock('paywall_first');
        if (dark >= 5) {
          s.unlock('dark_side');
          s.pushChirp(`just saw the new ${app.name} paywall... the X appears AFTER FIVE SECONDS?? screenshot saved.`);
        } else if (dark === 0) {
          s.unlock('saint');
          s.pushChirp(`shoutout to ${app.name} for the most ethical paywall i've ever closed without paying`);
        }
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
        const s = get();
        const awayMs = Date.now() - s.lastSeen;
        if (awayMs < 60_000 || s.mrr <= 0) {
          set({ lastSeen: Date.now() });
          return 0;
        }
        // Earn cash at the live rate, capped at 8 hours away
        const cappedSec = Math.min(awayMs / 1000, 8 * 3600);
        const earned = (s.mrr / 120) * (cappedSec / 5);
        set({ cash: s.cash + earned, lastSeen: Date.now() });
        return earned;
      },
      touchLastSeen: () => set({ lastSeen: Date.now() }),
    }),
    {
      name: 'ramen-profitable-v1',
      version: 2,
      migrate: (persisted: any) => {
        if (persisted?.apps) {
          persisted.apps = persisted.apps.map((a: any) => ({ mult: 1, dark: 0, hasPaywall: false, ...a }));
        }
        persisted.achievements = persisted.achievements ?? {};
        return persisted;
      },
      storage: createJSONStorage(() => AsyncStorage),
      partialize: s => {
        const { notifs, overlay, ...rest } = s as GameState;
        return rest;
      },
    }
  )
);

export { MRR_GOAL };
