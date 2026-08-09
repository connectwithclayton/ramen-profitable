import type { GameState } from '../state/gameStore';
import type { IconName } from '../components/icons';

export const APP_IDEAS: [string, string][] = [
  ['PlantParent', 'habit tracker, but for your dying succulents'],
  ['DogNal', "AI journaling app for your dog's inner life"],
  ['GrudgeList', 'a to-do app, but for grudges'],
  ['SleepShame', 'alarm that posts to your group chat if you snooze'],
  ['Fridgely', "tells you what's expiring in your fridge (badly)"],
  ['GymGhost', 'tracks how long since you actually went'],
  ['LoreKeeper', 'note app for your D&D campaign nobody reads'],
  ['Caffiend', 'logs your coffee intake and judges you'],
  ['Splitsies', 'bill splitting for friend groups on the brink'],
  ['ZenNudge', 'meditation app that passive-aggressively sighs'],
  ['Regrets', 'a photo album that only shows old haircuts'],
  ['InboxZeroHero', 'archives your email and your ambitions'],
];

export const REJECTIONS: [string, string][] = [
  ['Guideline 4.3 — Spam', 'Your app duplicates the concept of 14,000 other apps. Bold of you.'],
  ['Guideline 2.1 — Crashed on launch', 'It worked on your machine. It did not work on theirs.'],
  ['Metadata Rejected', 'Your screenshots show a status bar with 3% battery. Unacceptable.'],
  ['Guideline 3.1.1 — Payments', 'You linked to your Ko-fi. You know what you did.'],
  ['Guideline 5.2.1 — Legal', 'Your privacy policy is a Notion page titled "privacy policy???"'],
];

export type GameEvent = {
  kind: 'good' | 'bad';
  text: string;
  icon?: IconName;
  apply: (s: GameState) => Partial<GameState>;
};

export const EVENTS: GameEvent[] = [
  { kind: 'good', text: '⭐️ 5-star review: "life changing. also crashes sometimes."', apply: s => ({ mrr: s.mrr * 1.05 }) },
  { kind: 'good', text: "Featured in 'Apps We Also Noticed This Week'", icon: 'growth', apply: s => ({ mrr: s.mrr * 1.12 }) },
  { kind: 'good', text: 'Your build-in-public thread got 40k views. 3 conversions.', icon: 'chirp', apply: s => ({ mrr: s.mrr + 15 }) },
  { kind: 'bad', text: 'Churn monster attacks! A cohort just remembered they subscribed.', icon: 'churn', apply: s => ({ mrr: s.mrr * 0.92 }) },
  { kind: 'bad', text: '🍎 You got Sherlocked. Apple announced your app, but worse, at WWDC.', apply: s => ({ mrr: s.mrr * 0.88 }) },
  { kind: 'bad', text: '⭐️ 1-star review: "app opened. did not read minds. uninstalling."', apply: s => ({ mrr: s.mrr * 0.95 }) },
  { kind: 'good', text: 'Barista spelled your name right. Morale up. Energy restored.', icon: 'energy', apply: s => ({ energy: Math.min(s.energyMax, s.energy + 20) }) },
  { kind: 'bad', text: 'Your Mac needs a new battery. -$60.', icon: 'cash', apply: s => ({ cash: Math.max(0, s.cash - 60) }) },
];

export type ShopItem = {
  id: string;
  name: string;
  desc: string;
  cost: number;
  apply: (s: GameState) => Partial<GameState>;
};

export const SHOP: ShopItem[] = [
  { id: 'coffee', name: 'Espresso machine', desc: '+120% energy regen', cost: 90, apply: s => ({ energyRegen: s.energyRegen * 2.2 }) },
  { id: 'kb', name: 'Mechanical keyboard', desc: '+4 LOC per tap (thock)', cost: 140, apply: s => ({ tapPower: s.tapPower + 4 }) },
  { id: 'claude', name: 'Claude Max subscription', desc: 'Auto-writes 6 LOC/sec', cost: 260, apply: s => ({ autoCode: s.autoCode + 6 }) },
  { id: 'cat', name: 'Hire your cat as QA', desc: 'Halves App Review rejection risk', cost: 180, apply: () => ({ rejectShield: 0.5 }) },
  { id: 'aso', name: 'ASO course (from a guy on Chirp)', desc: '+30% MRR on all apps', cost: 320, apply: s => ({ mrrMult: s.mrrMult * 1.3, mrr: s.mrr * 1.3 }) },
  { id: 'desk', name: 'Standing desk', desc: '+30 max energy', cost: 220, apply: s => ({ energyMax: s.energyMax + 30 }) },
  { id: 'agent', name: 'Agentic coding rig', desc: 'Auto-writes 20 LOC/sec', cost: 900, apply: s => ({ autoCode: s.autoCode + 20 }) },
];

export const CHIRPERS: [string, string][] = [
  ['Indie Dev Dan', '@shipfast_dan'],
  ['Paywall Patty', '@churnqueen'],
  ['VC Larper', '@preseed_energy'],
  ['Your Mom', '@mom_official'],
  ['ASO Guy', '@ranks4days'],
  ['Anonymous Founder', '@definitely_not_sad'],
];

export const REVIEW_MSGS = [
  'Waiting for review…',
  'In review…',
  'Reviewer is squinting…',
  'Reviewer opened the app…',
  'Deliberating…',
];

export const MRR_GOAL = 2000;

/* ---------- Paywall Designer ---------- */

export type PaywallChoice = {
  id: string;
  label: string;
  flavor: string;
  mult: number; // conversion multiplier
  dark: number; // dark-pattern heat (0 = clean)
};

export type PaywallAxis = { id: string; title: string; choices: PaywallChoice[] };

export const PAYWALL_AXES: PaywallAxis[] = [
  {
    id: 'price',
    title: 'Price point',
    choices: [
      { id: 'cheap', label: '$2.99/mo', flavor: 'Impulse-buy territory', mult: 1.0, dark: 0 },
      { id: 'mid', label: '$6.99/mo', flavor: 'The respectable default', mult: 1.15, dark: 0 },
      { id: 'confident', label: '$99.99/yr', flavor: 'Called "confidence pricing" on Chirp', mult: 1.3, dark: 1 },
    ],
  },
  {
    id: 'trial',
    title: 'Free trial',
    choices: [
      { id: 'none', label: 'No trial', flavor: 'Pay up front, cowards', mult: 0.85, dark: 0 },
      { id: 'week', label: '7-day trial', flavor: 'The industry handshake', mult: 1.2, dark: 0 },
      { id: 'forget', label: '3-day trial', flavor: 'Short enough that they forget to cancel', mult: 1.35, dark: 2 },
    ],
  },
  {
    id: 'headline',
    title: 'Headline',
    choices: [
      { id: 'honest', label: '"Unlock all features"', flavor: 'It simply is what it is', mult: 1.0, dark: 0 },
      { id: 'aspire', label: '"Become your best self"', flavor: 'The app tracks grudges', mult: 1.15, dark: 0 },
      { id: 'unhinged', label: '"Your last chance"', flavor: 'It is not their last chance', mult: 1.25, dark: 2 },
    ],
  },
  {
    id: 'close',
    title: 'Close button',
    choices: [
      { id: 'big', label: 'Prominent X', flavor: 'Ethical. Almost smug about it', mult: 0.95, dark: 0 },
      { id: 'tiny', label: 'Tiny gray X', flavor: 'Technically present', mult: 1.15, dark: 1 },
      { id: 'delayed', label: 'X appears after 5s', flavor: 'You know exactly what this is', mult: 1.3, dark: 3 },
    ],
  },
];

export const DARK_EVENTS: GameEvent[] = [
  { kind: 'bad', text: '🔥 Your paywall hit r/assholedesign. 40k upvotes. Refund requests incoming.', apply: s => ({ mrr: s.mrr * 0.8 }) },
  { kind: 'bad', text: '🍎 Guideline 3.1.2 crackdown: Apple made you resubmit your paywall.', apply: s => ({ mrr: s.mrr * 0.9, cash: Math.max(0, s.cash - 40) }) },
  { kind: 'bad', text: '📰 A journalist DMed you "just want to ask about your trial flow :)"', apply: s => ({ mrr: s.mrr * 0.93 }) },
];

/* ---------- Achievements ---------- */

export type Achievement = { id: string; icon?: string; drawnIcon?: IconName; name: string; desc: string };

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_ship', drawnIcon: 'ship', name: 'Shipped', desc: 'Got an app approved. Everything changes now.' },
  { id: 'first_reject', icon: '🪦', name: '4.3 Survivor', desc: 'Got rejected and lived to tell Chirp about it.' },
  { id: 'mrr_100', icon: '🌱', name: 'Beer Money', desc: 'Reached $100 MRR.' },
  { id: 'mrr_1000', drawnIcon: 'growth', name: 'Rent Adjacent', desc: 'Reached $1,000 MRR.' },
  { id: 'ramen', icon: '🍜', name: 'Ramen Profitable', desc: 'Quit the day job. Free at last.' },
  { id: 'paywall_first', drawnIcon: 'paywall', name: 'Paywall Architect', desc: 'Designed your first paywall.' },
  { id: 'dark_side', icon: '😈', name: 'The Dark Side', desc: 'Shipped a paywall with heat ≥ 5. We saw that.' },
  { id: 'saint', icon: '😇', name: 'Ethically Sourced', desc: 'Shipped a completely clean paywall.' },
  { id: 'portfolio', icon: '🗂', name: 'Portfolio Guy', desc: 'Three live apps at once.' },
];
