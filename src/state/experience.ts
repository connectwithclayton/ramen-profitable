import type { PaywallAxis, PaywallChoice, ShopItem } from '../content/content';
import type { GameState } from './gameStore';

export type MrrDelta = {
  before: number;
  after: number;
};

export type PaywallTransaction = {
  mult: number;
  dark: number;
  delta: MrrDelta;
};

export function projectMilestoneId(projectId: string, milestone: string) {
  return `project:${projectId}:${milestone}`;
}

export function tapReactionKind(hitTenTaps: boolean, depletedEnergy: boolean) {
  if (hitTenTaps) return 'ten-taps' as const;
  if (depletedEnergy) return 'energy-depleted' as const;
  return undefined;
}

export function secondsUntilNextLine(energy: number, energyRegen: number) {
  if (energy >= 1 || energyRegen <= 0) return 0;
  return Math.max(1, Math.ceil((1 - energy) / (energyRegen * 2)));
}

type CodeProgressStatus = {
  drained: boolean;
  prompt: string;
  manualTapLabel?: string;
  manualTapAccessibilityLabel?: string;
};

export function codeProgressStatus({
  done,
  energy,
  energyRegen,
  autoCode,
}: {
  done: boolean;
  energy: number;
  energyRegen: number;
  autoCode: number;
}): CodeProgressStatus {
  const drained = energy < 1;
  if (done) return { drained, prompt: 'SHIP IT AND FIND OUT' };
  if (!drained) return { drained, prompt: 'TAP THE RING TO WRITE CODE' };

  const seconds = secondsUntilNextLine(energy, energyRegen);
  const duration = `${seconds} ${seconds === 1 ? 'second' : 'seconds'}`;
  return {
    drained,
    prompt: autoCode > 0 ? 'OUT OF ENERGY · AUTOMATION IS STILL WRITING' : 'OUT OF ENERGY · REGENERATING',
    manualTapLabel: `MANUAL TAP IN ${seconds}S`,
    manualTapAccessibilityLabel: `Enough energy for another manual tap in ${duration}.`,
  };
}

export function homeEmptyProjectCopy(apps: readonly { live: boolean }[]) {
  const lastApp = apps[apps.length - 1];
  if (!lastApp) return 'Nothing shipped yet. Everyone starts at zero.';
  return lastApp.live
    ? 'The last launch is out in the world. The next idea is waiting.'
    : 'The last submission was rejected. The next idea is waiting.';
}

export function homeAutomationStatus(
  autoCode: number,
  project: { loc: number; need: number } | null,
) {
  return autoCode > 0 && project && project.loc < project.need
    ? `AUTO ${autoCode} LOC/S · PROGRESS RUNS WHILE OPEN`
    : undefined;
}

export function homeProjectActionLabel(project: { loc: number; need: number } | null) {
  if (!project) return 'Open Code to start';
  return project.loc >= project.need ? 'Open Code to submit' : 'Continue coding';
}

type AutomationUpgrade = Pick<ShopItem, 'id' | 'name' | 'desc' | 'cost'>;

export function automationAffordabilityNudge(
  cash: number,
  upgrades: Readonly<Record<string, boolean>>,
  shop: readonly AutomationUpgrade[],
) {
  const upgrade = shop.find(item => item.id === 'claude');
  if (!upgrade || upgrades[upgrade.id] || cash < upgrade.cost) return undefined;
  const inlineDescription = upgrade.desc[0].toLowerCase() + upgrade.desc.slice(1);
  return {
    name: upgrade.name,
    cost: upgrade.cost,
    detail: `${upgrade.desc} while the app is open.`,
    chirpText: `${upgrade.name} just entered the budget — ${inlineDescription} while the app is open.`,
  };
}

export function newAutomationAffordabilityNudge(
  beforeCash: number,
  afterCash: number,
  upgrades: Readonly<Record<string, boolean>>,
  shop: readonly AutomationUpgrade[],
) {
  const nudge = automationAffordabilityNudge(afterCash, upgrades, shop);
  return nudge && beforeCash < nudge.cost ? nudge : undefined;
}

export function sampleHomeExposure(
  startedAt: number | undefined,
  now: number,
  remainsVisible: boolean,
) {
  return {
    elapsedSeconds: startedAt === undefined ? 0 : Math.max(0, now - startedAt) / 1000,
    nextStartedAt: remainsVisible ? now : undefined,
  };
}

export function homeReactionSecondsAfterExposure(secondsLeft: number, elapsedSeconds: number) {
  return Math.max(0, secondsLeft - elapsedSeconds);
}

export type VerticalFrame = { y: number; height: number };

export function verticalFrameExposureRate(
  frame: VerticalFrame | undefined,
  viewport: VerticalFrame,
  bottomOcclusion = 0,
) {
  const viewportHeight = Math.max(0, viewport.height - Math.max(0, bottomOcclusion));
  if (!frame || frame.height <= 0 || viewportHeight <= 0) return 0;
  const viewportBottom = viewport.y + viewportHeight;
  const frameBottom = frame.y + frame.height;
  const visibleHeight = Math.max(
    0,
    Math.min(frameBottom, viewportBottom) - Math.max(frame.y, viewport.y),
  );
  const maximumVisibleHeight = Math.min(frame.height, viewportHeight);
  return Math.min(1, visibleHeight / maximumVisibleHeight);
}

export type DurableHomeReceiptKind = 'purchase' | 'verdict' | 'paywall';
export type PriorityHomeReactionKind = 'milestone' | DurableHomeReceiptKind;
type HomeReaction = { id: string; who: string; handle: string; kind?: string };
type StoryAuthor = readonly [string, string];

export function isPriorityHomeReaction<T extends HomeReaction>(
  chirp: T | undefined,
  betaTester: StoryAuthor,
): chirp is T & { kind: PriorityHomeReactionKind } {
  // No ambient source is priority-eligible; making one eligible requires restoring unseen-priority protection.
  return Boolean(
    chirp &&
    chirp.who === betaTester[0] &&
    chirp.handle === betaTester[1] &&
    (chirp.kind === 'milestone' ||
      chirp.kind === 'purchase' ||
      chirp.kind === 'verdict' ||
      chirp.kind === 'paywall'),
  );
}

export function isDurableHomeReceipt<T extends HomeReaction>(
  chirp: T | undefined,
  betaTester: StoryAuthor,
): chirp is T & { kind: DurableHomeReceiptKind } {
  return Boolean(
    chirp &&
    isPriorityHomeReaction(chirp, betaTester) &&
    (chirp.kind === 'purchase' || chirp.kind === 'verdict' || chirp.kind === 'paywall'),
  );
}

export function priorityHomeReactionState<T extends HomeReaction>(
  chirp: T,
  betaTester: StoryAuthor,
) {
  if (!isPriorityHomeReaction(chirp, betaTester)) return undefined;
  const priority = {
    homePriority: chirp,
    homePrioritySecondsLeft: 20,
  };
  return isDurableHomeReceipt(chirp, betaTester)
    ? { ...priority, homeReceipt: chirp, homeReceiptSecondsLeft: 20 }
    : priority;
}

export function selectHomeReaction<T extends HomeReaction>({
  chirps,
  priority,
  prioritySecondsLeft,
  receipt,
  receiptSecondsLeft,
  betaTester,
}: {
  chirps: readonly T[];
  priority: T | undefined;
  prioritySecondsLeft: number;
  receipt: T | undefined;
  receiptSecondsLeft: number;
  betaTester: StoryAuthor;
}) {
  if (prioritySecondsLeft > 0 && isPriorityHomeReaction(priority, betaTester)) return priority;
  if (receiptSecondsLeft > 0 && isDurableHomeReceipt(receipt, betaTester)) return receipt;
  return chirps.find(chirp => isPriorityHomeReaction(chirp, betaTester));
}

export function homeReceiptStateForPersistence<T extends HomeReaction>(
  receipt: T | undefined,
  secondsLeft: number,
  betaTester: StoryAuthor,
) {
  return secondsLeft > 0 && isDurableHomeReceipt(receipt, betaTester)
    ? { homeReceipt: receipt, homeReceiptSecondsLeft: secondsLeft }
    : { homeReceipt: undefined, homeReceiptSecondsLeft: 0 };
}

const persistedStateKeys = [
  'day', 'dayTick', 'cash', 'mrr', 'energy', 'energyMax', 'energyRegen', 'tapPower',
  'autoCode', 'hasJob', 'salary', 'mrrMult', 'rejectShield', 'project', 'apps',
  'upgrades', 'chirps', 'unreadChirps', 'goIndieActive', 'won', 'achievements', 'lastSeen',
  'storyMilestones', 'homeReceipt', 'homeReceiptSecondsLeft',
] as const satisfies readonly (keyof GameState)[];

export function selectPersistedState(
  value: unknown,
  betaTester: StoryAuthor,
): Partial<GameState> {
  if (!value || typeof value !== 'object') return {};
  const source = value as Record<string, unknown>;
  const selected = Object.fromEntries(
    persistedStateKeys
      .filter(key => key in source)
      .map(key => [key, source[key]]),
  ) as Partial<GameState>;
  const receiptState = homeReceiptStateForPersistence(
    selected.homeReceipt,
    selected.homeReceiptSecondsLeft ?? 0,
    betaTester,
  );
  selected.homeReceipt = receiptState.homeReceipt;
  selected.homeReceiptSecondsLeft = receiptState.homeReceiptSecondsLeft;
  return selected;
}

function advanceTimedHomeReaction<T extends HomeReaction>(
  reaction: T | undefined,
  secondsLeft: number,
  displayedReactionId: string,
  elapsedSeconds: number,
) {
  if (!reaction || reaction.id !== displayedReactionId || secondsLeft <= 0 || elapsedSeconds <= 0) {
    return { reaction, secondsLeft };
  }
  const nextSecondsLeft = homeReactionSecondsAfterExposure(secondsLeft, elapsedSeconds);
  return nextSecondsLeft > 0
    ? { reaction, secondsLeft: nextSecondsLeft }
    : { reaction: undefined, secondsLeft: 0 };
}

export function advanceHomeReactionExposure<
  Priority extends HomeReaction,
  Receipt extends HomeReaction,
>({
  priority,
  prioritySecondsLeft,
  receipt,
  receiptSecondsLeft,
  displayedReactionId,
  elapsedSeconds,
}: {
  priority: Priority | undefined;
  prioritySecondsLeft: number;
  receipt: Receipt | undefined;
  receiptSecondsLeft: number;
  displayedReactionId: string;
  elapsedSeconds: number;
}) {
  const nextPriority = advanceTimedHomeReaction(
    priority,
    prioritySecondsLeft,
    displayedReactionId,
    elapsedSeconds,
  );
  const nextReceipt = advanceTimedHomeReaction(
    receipt,
    receiptSecondsLeft,
    displayedReactionId,
    elapsedSeconds,
  );
  return {
    homePriority: nextPriority.reaction,
    homePrioritySecondsLeft: nextPriority.secondsLeft,
    homeReceipt: nextReceipt.reaction,
    homeReceiptSecondsLeft: nextReceipt.secondsLeft,
  };
}

export function calculatePaywallTransaction({
  totalMrr,
  mrrMult,
  baseMrr,
  previousMult,
  picks,
  axes,
}: {
  totalMrr: number;
  mrrMult: number;
  baseMrr: number;
  previousMult: number;
  picks: Record<string, string>;
  axes: PaywallAxis[];
}): PaywallTransaction {
  let mult = 1;
  let dark = 0;
  for (const axis of axes) {
    const choice: PaywallChoice | undefined = axis.choices.find(candidate => candidate.id === picks[axis.id]);
    if (choice) {
      mult *= choice.mult;
      dark += choice.dark;
    }
  }
  mult = Math.round(mult * 100) / 100;

  const previousContribution = baseMrr * previousMult * mrrMult;
  const nextContribution = baseMrr * mult * mrrMult;
  const afterMrr = Math.max(0, totalMrr + (nextContribution - previousContribution));

  return {
    mult,
    dark,
    delta: { before: totalMrr, after: afterMrr },
  };
}

export function paywallReaction(appName: string, transaction: PaywallTransaction, picks: Record<string, string>) {
  if (transaction.dark === 0) {
    return `shoutout to ${appName} for the most ethical paywall i've ever closed without paying`;
  }
  if (transaction.dark >= 5 && picks.close === 'delayed') {
    return `just saw the new ${appName} paywall... the X appears AFTER FIVE SECONDS?? screenshot saved.`;
  }
  if (transaction.dark >= 5) {
    return `just saw the new ${appName} paywall. growth found the heat slider and kept going.`;
  }
  return `${appName}'s new paywall has a point of view. unfortunately, so do I.`;
}

export function hasStateChange<State extends object>(state: State, patch: Partial<State>) {
  return Object.keys(patch).some(key =>
    !Object.is(state[key as keyof State], patch[key as keyof State]),
  );
}

type EventText<State> = string | ((state: State, patch: Partial<State>) => string);

export function resolveGameEvent<State extends object>(
  event: {
    text: EventText<State>;
    chirpText?: EventText<State>;
    apply: (state: State) => Partial<State>;
  },
  state: State,
) {
  const patch = event.apply(state);
  if (!hasStateChange(state, patch)) return undefined;
  const resolveText = (text: EventText<State>) =>
    typeof text === 'function' ? text(state, patch) : text;
  return {
    patch,
    text: resolveText(event.text),
    chirpText: resolveText(event.chirpText ?? event.text),
  };
}

const displayedMoney = (value: number) =>
  Number(value.toLocaleString('en-US', {
    useGrouping: false,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }));

const receiptMoney = (value: number) =>
  `$${displayedMoney(value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export function mrrDirection(delta: MrrDelta) {
  const before = displayedMoney(delta.before);
  const after = displayedMoney(delta.after);
  if (after > before) return 'up' as const;
  if (after < before) return 'down' as const;
  return 'unchanged' as const;
}

export function formatMrrDelta(delta: MrrDelta) {
  const before = displayedMoney(delta.before);
  const after = displayedMoney(delta.after);
  const change = after - before;
  const signedChange = change > 0
    ? `+${receiptMoney(change)}`
    : change < 0
      ? `−${receiptMoney(Math.abs(change))}`
      : 'no change';
  const period = change !== 0 ? '/mo' : '';
  return `MRR ${receiptMoney(before)} → ${receiptMoney(after)} (${signedChange}${period})`;
}

export function paywallResultPresentation(transaction: PaywallTransaction) {
  const direction = mrrDirection(transaction.delta);
  let body: string;
  if (direction === 'up') {
    body = transaction.dark >= 5
      ? 'MRR increased. Somewhere, a subreddit stirs.'
      : transaction.dark > 0
        ? 'MRR increased. A little heat. Probably fine. Probably.'
        : 'MRR increased. Your conscience sparkles.';
  } else if (direction === 'down') {
    body = transaction.dark >= 5
      ? 'MRR decreased. The heat did not convert; the subreddit may still stir.'
      : transaction.dark > 0
        ? 'MRR decreased. A little heat, less revenue.'
        : 'MRR decreased. Your conscience sparkles. Your CFO weeps.';
  } else {
    body = transaction.dark >= 5
      ? 'MRR held steady. Somewhere, a subreddit stirs anyway.'
      : transaction.dark > 0
        ? 'MRR held steady. All that heat moved nothing.'
        : 'MRR held steady. Your conscience still sparkles.';
  }
  return { direction, body, receipt: formatMrrDelta(transaction.delta) };
}
