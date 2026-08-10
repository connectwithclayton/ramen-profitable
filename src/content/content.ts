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
  ['Tabsy', 'saves your 400 open tabs so you can ignore them somewhere else'],
  ['Subscript', 'finds your forgotten subscriptions, $4.99/mo'],
  ['Focusly', 'blocks distracting apps until you tap "just 5 more minutes"'],
  ['Wordlike', 'a daily word game that is legally distinct from Wordle'],
  ['Standupp', 'writes your standup update from your commit history'],
  ['Reciply', 'recipes with the 900-word story about a grandmother removed'],
  ['Gratitud', 'three good things a day, your last entry was in March'],
  ['Bookshelfie', 'tracks the books you own against the books you finished'],
  ['MacroMate', 'lets you log a burrito as six separate ingredients'],
  ['NoiseFloor', 'forty ambient sounds, eleven of which are rain'],
  ['NomadRank', 'ranks cities by wifi speed, then rent, then visa length'],
  ['Unread', 'counts the podcasts you subscribed to and never played'],
];

export const REJECTIONS: [string, string][] = [
  ['Guideline 4.3 — Spam', 'Your app duplicates the concept of 14,000 other apps. Bold of you.'],
  ['Guideline 2.1 — Crashed on launch', 'It worked on your machine. It did not work on theirs.'],
  ['Metadata Rejected', 'Your screenshots show a status bar with 3% battery. Unacceptable.'],
  ['Guideline 3.1.1 — Payments', 'You linked to your Ko-fi. You know what you did.'],
  ['Guideline 5.2.1 — Legal', 'Your privacy policy is a Notion page titled "privacy policy???"'],
  ['Guideline 4.2 — Minimum Functionality', 'Your app is a webview with a haptic on the back button.'],
  ['Guideline 2.3.7 — App Name', 'Your app is not called "Habit Tracker: Daily Planner, Focus & Goals".'],
  ['Guideline 5.1.1(v) — Account Deletion', 'Users sign up in two taps and delete their account by emailing you.'],
  ['Guideline 1.2 — User-Generated Content', 'You shipped a comment section with no way to report anything.'],
  ['Guideline 2.1 — App Completeness', 'The demo credentials you provided were test@test.com and "password".'],
  ['Guideline 3.1.2 — Subscriptions', 'Nowhere on your paywall does it say the $99.99 is annual.'],
  ['Guideline 4.0 — Design', 'Your icon has the rounded corners pre-applied. It now has two sets.'],
];

export type GameEvent = {
  kind: 'good' | 'bad';
  text: string;
  chirpText?: string;
  icon?: IconName;
  apply: (s: GameState) => Partial<GameState>;
};

export const EVENTS: GameEvent[] = [
  { kind: 'good', text: '⭐️ 5-star review: "life changing. also crashes sometimes."', apply: s => ({ mrr: s.mrr * 1.05 }) },
  { kind: 'good', text: "Featured in 'Apps We Also Noticed This Week'", chirpText: "📈 Featured in 'Apps We Also Noticed This Week'", icon: 'growth', apply: s => ({ mrr: s.mrr * 1.12 }) },
  { kind: 'good', text: 'Your build-in-public thread got 40k views. 3 conversions.', chirpText: '🧵 Your build-in-public thread got 40k views. 3 conversions.', icon: 'thread', apply: s => ({ mrr: s.mrr + 15 }) },
  { kind: 'bad', text: 'Churn monster attacks! A cohort just remembered they subscribed.', chirpText: '📉 Churn monster attacks! A cohort just remembered they subscribed.', icon: 'churn', apply: s => ({ mrr: s.mrr * 0.92 }) },
  { kind: 'bad', text: 'You got Sherlocked. Apple announced your app, but worse, at WWDC.', chirpText: '🍎 You got Sherlocked. Apple announced your app, but worse, at WWDC.', icon: 'app-store', apply: s => ({ mrr: s.mrr * 0.88 }) },
  { kind: 'bad', text: '⭐️ 1-star review: "app opened. did not read minds. uninstalling."', apply: s => ({ mrr: s.mrr * 0.95 }) },
  { kind: 'good', text: 'Barista spelled your name right. Morale up. Energy restored.', chirpText: '☕️ Barista spelled your name right. Morale up. Energy restored.', icon: 'caffeine', apply: s => ({ energy: Math.min(s.energyMax, s.energy + 20) }) },
  { kind: 'bad', text: 'Your Mac needs a new battery. -$60.', chirpText: '💸 Your Mac needs a new battery. -$60.', icon: 'cash', apply: s => ({ cash: Math.max(0, s.cash - 60) }) },
  { kind: 'good', text: 'You made a "10 indie apps I actually use" list. Number 9.', chirpText: '📰 You made a "10 indie apps I actually use" list. Number 9.', icon: 'press', apply: s => ({ mrr: s.mrr * 1.1 }) },
  { kind: 'good', text: 'A competitor raised $12M and immediately got worse.', chirpText: '📈 A competitor raised $12M and immediately got worse.', icon: 'growth', apply: s => ({ mrr: s.mrr * 1.06 }) },
  { kind: 'good', text: 'Annual plans renewed. You had forgotten about them too.', chirpText: '💰 Annual plans renewed. You had forgotten about them too.', icon: 'cash', apply: s => ({ cash: s.cash + 45 }) },
  { kind: 'good', text: 'You slept eight hours by accident.', chirpText: '🌙 You slept eight hours by accident.', icon: 'night', apply: s => ({ energy: Math.min(s.energyMax, s.energy + 25) }) },
  { kind: 'bad', text: 'Apple Developer Program membership renewed. -$99.', chirpText: '🍎 Apple Developer Program membership renewed. -$99.', icon: 'cash', apply: s => ({ cash: Math.max(0, s.cash - 99) }) },
  { kind: 'bad', text: 'App Store Connect logged you out mid-submission. Twice.', chirpText: '🔒 App Store Connect logged you out mid-submission. Twice.', icon: 'app-store', apply: s => ({ energy: Math.max(0, s.energy - 15) }) },
  { kind: 'bad', text: 'A Reddit thread found you. Top comment: "why not just use a spreadsheet".', chirpText: '🔥 A Reddit thread found you. Top comment: "why not just use a spreadsheet".', icon: 'trending', apply: s => ({ mrr: s.mrr * 0.96 }) },
  { kind: 'bad', text: 'Support inbox: 14 emails, 11 asking for a feature that already exists.', chirpText: '📮 Support inbox: 14 emails, 11 asking for a feature that already exists.', icon: 'churn', apply: s => ({ energy: Math.max(0, s.energy - 10) }) },
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
  ['Design Twitter', '@kerning_police'],
  ['Your Old Coworker', '@still_at_the_job'],
  ['Product Hunt Regular', '@4th_place_tuesday'],
  ['Pivoted to AI', '@formerly_web3'],
  ['Angel Investor', '@checksize_25k'],
  ['Burnt Out Beta Tester', '@testflight_gremlin'],
];

export const REVIEW_MSGS = [
  'Waiting for review…',
  'In review…',
  'Reviewer is squinting…',
  'Reviewer opened the app…',
  'Deliberating…',
  'Reviewer is reading your release notes…',
  'Reviewer is trying the demo account…',
  'Reviewer tapped Restore Purchases…',
  'Reviewer found the settings screen…',
  'Reviewer went to lunch…',
  'Still in review…',
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
  { kind: 'bad', text: 'Your paywall hit r/assholedesign. 40k upvotes. Refund requests incoming.', chirpText: '🔥 Your paywall hit r/assholedesign. 40k upvotes. Refund requests incoming.', icon: 'trending', apply: s => ({ mrr: s.mrr * 0.8 }) },
  { kind: 'bad', text: 'Guideline 3.1.2 crackdown: Apple made you resubmit your paywall.', chirpText: '🍎 Guideline 3.1.2 crackdown: Apple made you resubmit your paywall.', icon: 'app-store', apply: s => ({ mrr: s.mrr * 0.9, cash: Math.max(0, s.cash - 40) }) },
  { kind: 'bad', text: 'A journalist DMed you "just want to ask about your trial flow :)"', chirpText: '📰 A journalist DMed you "just want to ask about your trial flow :)"', icon: 'press', apply: s => ({ mrr: s.mrr * 0.93 }) },
  { kind: 'bad', text: 'Your rating fell to 2.9. Every new review mentions the X button.', chirpText: '⭐️ Your rating fell to 2.9. Every new review mentions the X button.', icon: 'app-store', apply: s => ({ mrr: s.mrr * 0.88 }) },
  { kind: 'bad', text: 'Someone made a video walking through how to cancel. 200k views.', chirpText: '📹 Someone made a video walking through how to cancel. 200k views.', icon: 'trending', apply: s => ({ mrr: s.mrr * 0.85 }) },
  { kind: 'bad', text: 'Your 3-day trial is now a slide in someone\'s dark patterns talk.', chirpText: '🎓 Your 3-day trial is now a slide in someone\'s dark patterns talk.', icon: 'dark-side', apply: s => ({ mrr: s.mrr * 0.9 }) },
  { kind: 'bad', text: 'Chargebacks cleared. Stripe would like to discuss your refund rate.', chirpText: '💳 Chargebacks cleared. Stripe would like to discuss your refund rate.', icon: 'cash', apply: s => ({ mrr: s.mrr * 0.95, cash: Math.max(0, s.cash - 50) }) },
];

/* ---------- Achievements ---------- */

type AchievementDetails = { id: string; name: string; desc: string };

export type Achievement = AchievementDetails & ({ icon: string; drawnIcon?: never } | { icon?: never; drawnIcon: IconName });

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_ship', drawnIcon: 'ship', name: 'Shipped', desc: 'Got an app approved. Everything changes now.' },
  { id: 'first_reject', drawnIcon: 'survivor-4-3', name: '4.3 Survivor', desc: 'Got rejected and lived to tell Chirp about it.' },
  { id: 'mrr_100', drawnIcon: 'beer-money', name: 'Beer Money', desc: 'Reached $100 MRR.' },
  { id: 'mrr_1000', drawnIcon: 'growth', name: 'Rent Adjacent', desc: 'Reached $1,000 MRR.' },
  { id: 'ramen', drawnIcon: 'ramen-profitable', name: 'Ramen Profitable', desc: 'Quit the day job. Free at last.' },
  { id: 'paywall_first', drawnIcon: 'paywall', name: 'Paywall Architect', desc: 'Designed your first paywall.' },
  { id: 'dark_side', drawnIcon: 'dark-side', name: 'The Dark Side', desc: 'Shipped a paywall with heat ≥ 5. We saw that.' },
  { id: 'saint', drawnIcon: 'ethically-sourced', name: 'Ethically Sourced', desc: 'Shipped a completely clean paywall.' },
  { id: 'portfolio', drawnIcon: 'portfolio-guy', name: 'Portfolio Guy', desc: 'Three live apps at once.' },
];
