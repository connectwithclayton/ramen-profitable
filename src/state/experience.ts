import type { PaywallAxis, PaywallChoice } from '../content/content';

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

/** Project callbacks belong to one run of one project, even when an app name is reused. */
export function milestonesForProject(
  milestones: Record<string, boolean>,
  projectId: string,
): Record<string, boolean> {
  return Object.fromEntries(
    Object.entries(milestones).filter(([key]) => !key.startsWith('project:') || key.startsWith(`project:${projectId}:`)),
  );
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
    manualTapLabel: `MANUAL TAP IN ${seconds}S · OPEN STORE →`,
    manualTapAccessibilityLabel: `Enough energy for another manual tap in ${duration}. Open Store.`,
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

export function homeProjectActionLabel(done: boolean) {
  return done ? 'Open Code to submit' : 'Continue coding';
}

export function advanceHomeStoryClock({
  homeCovered,
  storyActiveSeconds,
  homeReactionSecondsLeft,
  elapsedSeconds,
}: {
  homeCovered: boolean;
  storyActiveSeconds: number;
  homeReactionSecondsLeft: number;
  elapsedSeconds: number;
}) {
  if (homeCovered) return { storyActiveSeconds, homeReactionSecondsLeft };
  return {
    storyActiveSeconds: storyActiveSeconds + elapsedSeconds,
    homeReactionSecondsLeft: Math.max(0, homeReactionSecondsLeft - elapsedSeconds),
  };
}

export function canDeliverAmbientStory({
  homeCovered,
  activeSeconds,
  lastDeliveredAt,
  beforeFirstShip,
  preShipCount,
}: {
  homeCovered: boolean;
  activeSeconds: number;
  lastDeliveredAt: number;
  beforeFirstShip: boolean;
  preShipCount: number;
}) {
  return !homeCovered && activeSeconds - lastDeliveredAt >= 20 && (!beforeFirstShip || preShipCount < 3);
}

type HomeReaction = { id: string; who: string; handle: string; kind?: string };
type StoryAuthor = readonly [string, string];

export function isEligibleHomeReaction(chirp: HomeReaction, betaTester: StoryAuthor) {
  const intentionalKind =
    chirp.kind === 'ambient' ||
    chirp.kind === 'milestone' ||
    chirp.kind === 'purchase' ||
    chirp.kind === 'verdict' ||
    chirp.kind === 'paywall';
  return chirp.who === betaTester[0] && chirp.handle === betaTester[1] && intentionalKind;
}

export function selectHomeReaction<T extends HomeReaction>(
  chirps: T[],
  pinnedId: string | undefined,
  secondsLeft: number,
  betaTester: StoryAuthor,
) {
  const eligible = chirps.filter(chirp => isEligibleHomeReaction(chirp, betaTester));
  return (secondsLeft > 0 && eligible.find(chirp => chirp.id === pinnedId)) || eligible[0];
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
  const afterMrr = Math.max(0, totalMrr - previousContribution + nextContribution);

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

const receiptMoney = (value: number) =>
  `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export function mrrDirection(delta: MrrDelta) {
  if (delta.after > delta.before) return 'up' as const;
  if (delta.after < delta.before) return 'down' as const;
  return 'unchanged' as const;
}

export function formatMrrDelta(delta: MrrDelta) {
  const change = delta.after - delta.before;
  const signedChange = change > 0
    ? `+${receiptMoney(change)}`
    : change < 0
      ? `−${receiptMoney(Math.abs(change))}`
      : 'no change';
  const period = change !== 0 ? '/mo' : '';
  return `MRR ${receiptMoney(delta.before)} → ${receiptMoney(delta.after)} (${signedChange}${period})`;
}

export function homeReactionAccessibilityLabel(reaction: {
  who: string;
  text: string;
  event?: string;
  delta?: MrrDelta;
}) {
  return [
    'Open Chirp.',
    reaction.event ? `${reaction.event}.` : undefined,
    `${reaction.who} says: ${reaction.text}`,
    reaction.delta ? formatMrrDelta(reaction.delta) : undefined,
  ].filter(Boolean).join(' ');
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
