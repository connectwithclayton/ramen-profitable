import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_IDEAS, REJECTIONS, EVENTS, DARK_EVENTS, SHOP, CHIRPERS, MRR_GOAL, PAYWALL_AXES, ACHIEVEMENTS } from '../content/content';
import type { IconName } from '../components/icons';
import { pickAppIdea } from './projectIdeas';
import {
  BETA_TESTER,
  PLAYER,
  calculatePaywallTransaction,
  financialDeltas,
  milestonesForProject,
  paywallReaction,
  projectMilestoneId,
} from './experience';
import type { StoryDelta } from './experience';

export type Project = { id: string; name: string; idea: string; loc: number; need: number; manualTaps: number };
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
export type StoryKind = 'ambient' | 'milestone' | 'purchase' | 'verdict' | 'paywall' | 'event';
export type Chirp = {
  id: string;
  who: string;
  handle: string;
  text: string;
  likes: number;
  liked?: boolean;
  kind?: StoryKind;
  subjectId?: string;
  subject?: string;
  event?: string;
  deltas?: StoryDelta[];
  heat?: number;
};
type ChirpOptions = Omit<Partial<Chirp>, 'id' | 'who' | 'handle' | 'text' | 'likes' | 'liked'> & {
  author?: readonly [string, string];
};
type StoryBeat = { text: string; options: ChirpOptions; priority: number; projectId?: string };
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
  goIndieActive: boolean;
  goIndieResolved: boolean;
  won: boolean;
  achievements: Record<string, boolean>;
  storyMilestones: Record<string, boolean>;
  lastSeen: number; // epoch ms, for offline earnings
  // Session-only delivery state. Persisted receipts live in chirps; timers and queues do not.
  pendingStoryBeats: StoryBeat[];
  storyActiveSeconds: number;
  lastAmbientStoryAt: number;
  preShipAmbientCount: number;
  homeReactionId?: string;
  homeReactionSecondsLeft: number;
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

const persistedStateKeys = [
  'day', 'dayTick', 'cash', 'mrr', 'energy', 'energyMax', 'energyRegen', 'tapPower',
  'autoCode', 'hasJob', 'salary', 'mrrMult', 'rejectShield', 'project', 'apps',
  'upgrades', 'chirps', 'unreadChirps', 'goIndieActive', 'won', 'achievements', 'lastSeen',
  'storyMilestones',
] as const satisfies readonly (keyof GameState)[];

function selectPersistedState(value: unknown): Partial<GameState> {
  if (!value || typeof value !== 'object') return {};
  const source = value as Record<string, unknown>;
  return Object.fromEntries(
    persistedStateKeys
      .filter(key => key in source)
      .map(key => [key, source[key]]),
  ) as Partial<GameState>;
}

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
  storyMilestones: {},
  lastSeen: Date.now(),
  pendingStoryBeats: [],
  storyActiveSeconds: 0,
  lastAmbientStoryAt: -20,
  preShipAmbientCount: 0,
  homeReactionId: undefined,
  homeReactionSecondsLeft: 0,
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
        const pinsHome = c.kind === 'verdict' || c.kind === 'paywall' || c.kind === 'purchase';
        set(s => ({
          chirps: [c, ...s.chirps].slice(0, 30),
          unreadChirps: true,
          ...(pinsHome ? { homeReactionId: c.id, homeReactionSecondsLeft: 20 } : {}),
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
        const project: Project = { id: uid(), name, idea, loc: 0, need: 250 + Math.floor(Math.random() * 250), manualTaps: 0 };
        const startedReply = projectMilestoneId(project.id, 'started-reply');
        const milestones = { ...milestonesForProject(s.storyMilestones, project.id), [startedReply]: true };
        const beat: StoryBeat = {
          text: `does ${name} have dark mode? haven't opened it yet.`,
          options: { author: BETA_TESTER, kind: 'milestone', subjectId: project.id, subject: name, event: 'FIRST BETA REPLY' },
          priority: 1,
          projectId: project.id,
        };
        set({
          project,
          storyMilestones: milestones,
          pendingStoryBeats: [...s.pendingStoryBeats.filter(item => item.projectId === project.id), beat]
            .sort((a, b) => b.priority - a.priority)
            .slice(0, 4),
        });
        get().pushChirp(`day 1 of building ${name} — ${idea}. who's in? #buildinpublic`, {
          author: PLAYER,
          kind: 'milestone',
          subjectId: project.id,
          subject: name,
          event: 'PROJECT STARTED',
        });
      },

      tapCode: () => {
        const s = get();
        if (!s.project || s.project.loc >= s.project.need) return false;
        if (s.energy < 1) {
          s.pushNotif('Out of energy. Coffee exists for a reason.', 'energy');
          if (s.autoCode <= 0) {
            const key = projectMilestoneId(s.project.id, 'energy-depleted');
            if (!s.storyMilestones[key]) {
              set({ storyMilestones: { ...s.storyMilestones, [key]: true } });
              get().pushChirp('Have you tried delegating? My cat is between roles.', {
                author: BETA_TESTER,
                kind: 'milestone',
                subjectId: s.project.id,
                subject: s.project.name,
                event: 'ENERGY DEPLETED',
              });
            }
          }
          return false;
        }
        const nextLoc = s.project.loc + s.tapPower;
        const manualTaps = (s.project.manualTaps ?? 0) + 1;
        const tenTapKey = projectMilestoneId(s.project.id, 'ten-taps');
        const hitTenTaps = manualTaps >= 10 && !s.storyMilestones[tenTapKey];
        set({
          energy: s.energy - 1,
          project: { ...s.project, loc: nextLoc, manualTaps },
          ...(hitTenTaps ? { storyMilestones: { ...s.storyMilestones, [tenTapKey]: true } } : {}),
        });
        if (hitTenTaps) {
          get().pushChirp(`${Math.floor(nextLoc)} lines in and the launch thread is already longer than the app.`, {
            author: BETA_TESTER,
            kind: 'milestone',
            subjectId: s.project.id,
            subject: s.project.name,
            event: 'TEN TAPS',
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
            pendingStoryBeats: s.pendingStoryBeats.filter(beat => beat.projectId !== p.id),
          });
          s.pushChirp(`App Review rejected ${p.name}. ${rule}. i'm fine. this is fine.`, {
            author: PLAYER,
            kind: 'verdict',
            subjectId: p.id,
            subject: p.name,
            event: 'APP REVIEW · REJECTED',
          });
          s.unlock('first_reject');
        } else {
          const base = 40 + Math.floor(Math.random() * 160);
          const gain = base * s.mrrMult;
          set({
            apps: [...s.apps, { id: uid(), name: p.name, idea: p.idea, live: true, baseMrr: base, mult: 1, dark: 0, hasPaywall: false }],
            mrr: s.mrr + gain,
            project: null,
            overlay: { type: 'verdict', ok: true, appName: p.name, gain },
            pendingStoryBeats: s.pendingStoryBeats.filter(beat => beat.projectId !== p.id),
          });
          s.pushChirp(`${p.name} just went live on the App Store!! ${base > 150 ? 'the numbers are actually good??' : 'it begins.'} #shipaton`, {
            author: PLAYER,
            kind: 'verdict',
            subjectId: p.id,
            subject: p.name,
            event: 'APP REVIEW · APPROVED',
            deltas: [{ metric: 'mrr', before: s.mrr, after: s.mrr + gain }],
          });
          s.unlock('first_ship');
          if (get().apps.filter(a => a.live).length >= 3) s.unlock('portfolio');
        }
      },

      dismissOverlay: () => set({ overlay: null }),

      openGoIndiePaywall: () => set({ overlay: { type: 'paywall' } }),

      setGoIndieActive: active => {
        if (active) set({ lastSeen: Date.now() });
        set({ goIndieActive: active, goIndieResolved: true });
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
        if (id === 'claude') {
          const rate = typeof applied.autoCode === 'number' ? applied.autoCode : s.autoCode;
          get().pushChirp(`${rate} LOC/sec. You have been promoted to code reviewer.`, {
            author: BETA_TESTER,
            kind: 'purchase',
            subjectId: s.project?.id,
            subject: s.project?.name,
            event: 'AUTOMATION PURCHASED',
          });
        }
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
          storyActiveSeconds: s.storyActiveSeconds + 5,
          homeReactionSecondsLeft: Math.max(0, s.homeReactionSecondsLeft - 5),
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

        const current = get();
        const pending = current.pendingStoryBeats.filter(beat => !beat.projectId || beat.projectId === current.project?.id);
        const beforeFirstShip = !current.apps.some(app => app.live);
        const canDeliverAmbient =
          current.storyActiveSeconds - current.lastAmbientStoryAt >= 20 &&
          (!beforeFirstShip || current.preShipAmbientCount < 3);
        let beat = canDeliverAmbient ? pending.shift() : undefined;
        let milestones = current.storyMilestones;
        if (!beat && canDeliverAmbient) {
          const claude = SHOP.find(item => item.id === 'claude');
          const affordableKey = 'upgrade:claude-affordable';
          if (claude && current.cash >= claude.cost && !current.upgrades.claude && !milestones[affordableKey]) {
            milestones = { ...milestones, [affordableKey]: true };
            beat = {
              text: `${claude.name} is within budget — ${claude.desc.toLowerCase()}.`,
              options: { author: BETA_TESTER, kind: 'ambient', event: 'UPGRADE WITHIN BUDGET' },
              priority: 1,
            };
          }
        }
        set({
          pendingStoryBeats: pending,
          storyMilestones: milestones,
          ...(beat ? {
            lastAmbientStoryAt: current.storyActiveSeconds,
            preShipAmbientCount: current.preShipAmbientCount + (beforeFirstShip ? 1 : 0),
          } : {}),
        });
        if (beat) get().pushChirp(beat.text, beat.options);
      },

      maybeEvent: () => {
        const s = get();
        if (!s.apps.some(a => a.live)) return;
        if (Math.random() >= 0.5) return;
        const totalDark = s.apps.filter(a => a.live).reduce((n, a) => n + (a.dark ?? 0), 0);
        const useDark = totalDark >= 3 && Math.random() < 0.35;
        const ev = useDark ? pick(DARK_EVENTS) : pick(EVENTS);
        const applied = ev.apply(s);
        const deltas = financialDeltas(s, applied);
        set(applied);
        s.pushNotif(ev.text, ev.icon);
        if (deltas.length > 0 || Math.random() < 0.4) {
          s.pushChirp(ev.chirpText ?? ev.text, {
            kind: 'event',
            event: 'LIVE EVENT',
            deltas,
          });
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
          mrr: transaction.afterMrr,
          overlay: { type: 'paywallResult', appId, mult, dark },
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
          subjectId: app.id,
          subject: app.name,
          event: `PAYWALL SHIPPED · HEAT ${dark}`,
          deltas: [transaction.delta],
          heat: dark,
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
        const s = get();
        const awayMs = Date.now() - s.lastSeen;
        if (awayMs < 60_000 || s.mrr <= 0) {
          set({ lastSeen: Date.now() });
          return 0;
        }
        // Earn cash at the live rate, capped at 8 hours away
        const cappedSec = Math.min(awayMs / 1000, 8 * 3600);
        const earned = (s.mrr / 120) * (cappedSec / 5) * (s.goIndieResolved && s.goIndieActive ? 2 : 1);
        set({ cash: s.cash + earned, lastSeen: Date.now() });
        return earned;
      },
      touchLastSeen: () => set({ lastSeen: Date.now() }),
    }),
    {
      name: 'ramen-profitable-v1',
      version: 3,
      migrate: (persisted: any) => {
        const migrated = selectPersistedState(persisted);
        if (migrated?.apps) {
          migrated.apps = migrated.apps.map((a: any) => ({ mult: 1, dark: 0, hasPaywall: false, ...a }));
        }
        migrated.achievements = migrated.achievements ?? {};
        migrated.storyMilestones = migrated.storyMilestones ?? {};
        migrated.goIndieActive = migrated.goIndieActive ?? false;
        if (migrated.project) {
          migrated.project = {
            ...migrated.project,
            id: migrated.project.id ?? uid(),
            manualTaps: migrated.project.manualTaps ?? 0,
          };
        }
        return migrated;
      },
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persisted, current) => ({
        ...current,
        ...selectPersistedState(persisted),
      }),
      partialize: s => selectPersistedState(s),
    }
  )
);

export { MRR_GOAL };
